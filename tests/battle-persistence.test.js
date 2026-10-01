const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");

class Statement {
  constructor(raw, sql, values = []) { this.raw = raw; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.raw, this.sql, values); }
  async first() { return this.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.values) }; }
  async run() { const result = this.raw.prepare(this.sql).run(...this.values); return { meta: { changes: Number(result.changes) } }; }
}
class D1 {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Statement(this.raw, sql); }
  async batch(statements) { const out = []; for (const statement of statements) out.push(await statement.run()); return out; }
}

function worker() {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox); vm.runInContext(source, sandbox); return sandbox.__worker;
}

function database() {
  const db = new D1();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL, diamonds INTEGER DEFAULT 0, active_slot INTEGER, created_at TEXT NOT NULL);
    CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, slot_index INTEGER NOT NULL, name TEXT DEFAULT '', level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, stat_points INTEGER DEFAULT 0, str INTEGER DEFAULT 0, vit INTEGER DEFAULT 0, agi INTEGER DEFAULT 0, dex INTEGER DEFAULT 0, luk INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, unlocked_floor INTEGER DEFAULT 1, potions INTEGER DEFAULT 2, protection_stones INTEGER DEFAULT 0, chest_pity INTEGER DEFAULT 0, pets_json TEXT DEFAULT '[]', active_pet_id TEXT DEFAULT '', created_at TEXT, updated_at TEXT, last_active_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE items (item_id TEXT PRIMARY KEY, player_id TEXT, character_id TEXT, slot_type TEXT, equipped INTEGER DEFAULT 0, inventory_slot TEXT, item_template_id TEXT, rarity TEXT, name TEXT, item_level INTEGER DEFAULT 0, enhance_level INTEGER DEFAULT 0, bound INTEGER DEFAULT 0, quantity INTEGER DEFAULT 1, atk INTEGER DEFAULT 0, def INTEGER DEFAULT 0, hp INTEGER DEFAULT 0, mp INTEGER DEFAULT 0, extra_json TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE run_state (player_id TEXT PRIMARY KEY, floor INTEGER, level INTEGER, xp INTEGER, hp INTEGER, mp INTEGER, base_atk INTEGER, base_def INTEGER, base_max_hp INTEGER, base_max_mp INTEGER, run_gold INTEGER, potions INTEGER, updated_at TEXT, character_id TEXT);
    CREATE TABLE progress (player_id TEXT PRIMARY KEY, bank_gold INTEGER, diamonds INTEGER, best_floor INTEGER, potions INTEGER, char_level INTEGER, char_xp INTEGER, char_points INTEGER, char_str INTEGER, char_vit INTEGER, char_dex INTEGER, char_luk INTEGER, pets_json TEXT, active_pet_id TEXT, updated_at TEXT);
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "fixtures/auth-v2-schema.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0012_battle_persistence_v1.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0013_pet_run_state_v1.sql"), "utf8"));
  return db;
}

async function post(api, db, token, body) {
  const response = await api.fetch(new Request("https://api.test", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }), { DB: db });
  return { status: response.status, body: await response.json() };
}
async function get(api, db, token, params) {
  const url = `https://api.test?${new URLSearchParams(params)}`;
  const response = await api.fetch(new Request(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }), { DB: db });
  return { status: response.status, body: await response.json() };
}

test("saveRunState, Battle checkpoint, quick slots and completion are character-scoped and stale-safe", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Battle_1", password: "pass", confirmPassword: "pass" });
  assert.equal(registration.body.ok, true);
  const tokenA = registration.body.sessionToken;
  const createdA = await post(api, db, tokenA, { action: "createCharacter", slotIndex: 0, name: "A" });
  const createdB = await post(api, db, tokenA, { action: "createCharacter", slotIndex: 1, name: "B" });
  const charA = createdA.body.character.character_id, charB = createdB.body.character.character_id;

  assert.equal((await post(api, db, tokenA, { action: "saveRunState", characterId: charA, runState: { floor: 4, hp: 33, mp: 8, pet_state_json: JSON.stringify({ activePetId: "pet-a", currentHp: 17, wasDead: false }) } })).body.ok, true);
  const entered = await post(api, db, tokenA, { action: "enterCharacter", slotIndex: 0 });
  assert.equal(entered.body.runState.floor, 4);
  assert.deepEqual(JSON.parse(entered.body.runState.pet_state_json), { activePetId: "pet-a", currentHp: 17, wasDead: false });

  const checkpoint = { version: 1, battleId: "battle-a", floor: 4, safeActionSeq: 1, units: { hero: { hp: 33 } } };
  assert.equal((await post(api, db, tokenA, { action: "saveBattleCheckpoint", characterId: charA, battleId: "battle-a", checkpointSeq: 1, payload: checkpoint })).body.accepted, true);
  const stale = await post(api, db, tokenA, { action: "saveBattleCheckpoint", characterId: charA, battleId: "battle-a", checkpointSeq: 0, payload: { ...checkpoint, safeActionSeq: 0 } });
  assert.equal(stale.body.accepted, false);
  assert.equal((await post(api, db, tokenA, { action: "saveBattleCheckpoint", characterId: charB, battleId: "battle-a", checkpointSeq: 2, payload: checkpoint })).status, 409);

  const slots = [{ kind: "skill", key: "power_strike" }, null, null, { kind: "potion", potionId: "hp_small" }];
  assert.equal((await post(api, db, tokenA, { action: "saveQuickSlots", characterId: charA, quickSlots: slots })).body.ok, true);
  const state = await get(api, db, tokenA, { action: "getBattleState", characterId: charA });
  assert.equal(state.body.checkpoint.checkpointSeq, 1);
  assert.deepEqual(Array.from(state.body.quickSlots, slot => slot && slot.kind), ["skill", null, null, "potion"]);

  const missingCheckpoint = await post(api, db, tokenA, { action: "completeBattle", characterId: charB, battleId: "battle-missing", result: { result: "victory", safeActionSeq: 1 } });
  assert.equal(missingCheckpoint.status, 409);
  assert.equal(missingCheckpoint.body.error, "battle_checkpoint_missing");

  const complete1 = await post(api, db, tokenA, { action: "completeBattle", characterId: charA, battleId: "battle-a", result: { result: "victory", safeActionSeq: 2, gold: 5 } });
  const complete2 = await post(api, db, tokenA, { action: "completeBattle", characterId: charA, battleId: "battle-a", result: { result: "victory", safeActionSeq: 2, gold: 999 } });
  assert.equal(complete1.body.firstCompletion, true);
  assert.equal(complete2.body.firstCompletion, false);
  assert.equal(complete2.body.result.gold, 5);

  const loginB = await post(api, db, "", { action: "login", id: "battle_1", password: "pass" });
  const staleSession = await post(api, db, tokenA, { action: "saveBattleCheckpoint", characterId: charB, battleId: "battle-b", checkpointSeq: 1, payload: { ...checkpoint, battleId: "battle-b" } });
  assert.equal(staleSession.status, 401);
  assert.equal(staleSession.body.error, "session_replaced");
  assert.equal((await get(api, db, loginB.body.sessionToken, { action: "getBattleState", characterId: charB })).body.ok, true);
});

test("Dungeon V2 reward commit keeps permanent claims and replay idempotency beyond 128 battles", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_1", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Reward QA" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 10 WHERE character_id = ?").run(characterId);
  const accessory = {
    id: "v2-qa-first-clear", type: "accessory", rarity: "rare", name: "Lucky Charm", gearTier: 1,
    rewardVersion: 2, itemModelVersion: 2, empowerSlotCapacity: 1, empowerSlots: [null],
    sourceType: "dungeon_boss_first_clear", sourceFloor: 10, specialSource: "first_clear_accessory",
    sourceIdentity: "moss_king", utilityStat: "critChance", critChance: 2.5
  };
  const firstCheckpoint = { battleId: "qa-f10", floor: 10, safeActionSeq: 1, units: {} };
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: "qa-f10", checkpointSeq: 1, payload: firstCheckpoint })).body.accepted, true);
  const first = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: "qa-f10",
    result: { result: "victory", safeActionSeq: 2, floor: 10, reward: {
      floor: 10, encounterType: "chapter_boss", rewardRole: "chapter_boss", packCount: 1,
      gold: 100, xp: 60, diamonds: 0, unlockedNext: true, firstClear: true, items: [accessory]
    } }
  });
  assert.equal(first.body.ok, true);
  assert.equal(first.body.firstCompletion, true);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ?").get(characterId).c, 1);
  const before = db.raw.prepare("SELECT gold, xp, pets_json FROM characters WHERE character_id = ?").get(characterId);
  assert.equal(JSON.parse(before.pets_json).firstClearAccessoryClaims["10"], true);

  for (let i = 0; i < 129; i++) {
    const battleId = `qa-later-${i}`;
    const seq = 10 + i * 2;
    const cp = { battleId, floor: 11, safeActionSeq: seq, units: {} };
    assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId, checkpointSeq: seq, payload: cp })).body.accepted, true);
    const later = await post(api, db, token, {
      action: "completeBattle", characterId, battleId,
      result: { result: "victory", safeActionSeq: seq + 1, floor: 11, reward: {
        floor: 11, encounterType: "normal", rewardRole: "normal", packCount: 1,
        gold: 53, xp: 32, diamonds: 0, unlockedNext: false, firstClear: false, items: []
      } }
    });
    assert.equal(later.body.firstCompletion, true);
  }
  const after = db.raw.prepare("SELECT gold, xp, pets_json FROM characters WHERE character_id = ?").get(characterId);
  assert.equal(JSON.parse(after.pets_json).firstClearAccessoryClaims["10"], true);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ?").get(characterId).c, 1);
  const replay = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: "qa-f10",
    result: { result: "victory", safeActionSeq: 2, floor: 10, reward: {
      floor: 10, encounterType: "chapter_boss", rewardRole: "chapter_boss", packCount: 1,
      gold: 100, xp: 60, diamonds: 0, unlockedNext: true, firstClear: true, items: [accessory]
    } }
  });
  assert.equal(replay.body.firstCompletion, false);
  const final = db.raw.prepare("SELECT gold, xp, pets_json FROM characters WHERE character_id = ?").get(characterId);
  assert.deepEqual({ gold: final.gold, xp: final.xp }, { gold: after.gold, xp: after.xp });
  assert.equal(JSON.parse(final.pets_json).firstClearAccessoryClaims["10"], true);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ?").get(characterId).c, 1);
});

test("F5 starter Pet remains an exact-once entitlement in the atomic reward boundary", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_F5", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "F5 QA" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 5 WHERE character_id = ?").run(characterId);
  const starter = { instId: "starter-qa", defId: "sprout", level: 1, star: 1, exp: 0, stats: { str: 3, vit: 5, agi: 4, dex: 4, luk: 4 } };
  const reward = {
    floor: 5, encounterType: "elite", rewardRole: "elite", packCount: 1,
    gold: 53, xp: 27, diamonds: 0, unlockedNext: true, firstClear: false, items: [],
    starterPetGrant: { defId: "sprout", instance: starter }
  };
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: "qa-f5", checkpointSeq: 1, payload: { battleId: "qa-f5", floor: 5, safeActionSeq: 1 } })).body.accepted, true);
  const first = await post(api, db, token, { action: "completeBattle", characterId, battleId: "qa-f5", result: { result: "victory", safeActionSeq: 2, floor: 5, reward } });
  assert.equal(first.body.firstCompletion, true);
  const petsAfterFirst = JSON.parse(db.raw.prepare("SELECT pets_json FROM characters WHERE character_id = ?").get(characterId).pets_json).list;
  assert.equal(petsAfterFirst.filter(pet => pet.defId === "sprout").length, 1);
  const replay = await post(api, db, token, { action: "completeBattle", characterId, battleId: "qa-f5", result: { result: "victory", safeActionSeq: 2, floor: 5, reward } });
  assert.equal(replay.body.firstCompletion, false);
  const petsAfterReplay = JSON.parse(db.raw.prepare("SELECT pets_json FROM characters WHERE character_id = ?").get(characterId).pets_json).list;
  assert.equal(petsAfterReplay.filter(pet => pet.defId === "sprout").length, 1);
});

test("atomic Dungeon V2 item commit preserves overflow when the carried inventory is full", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_OV", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Overflow QA" });
  const characterId = created.body.character.character_id;
  for (let i = 0; i < 30; i++) {
    db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, name, rarity, quantity, extra_json) VALUES (?, ?, ?, 'junk', 'Iron', 'common', 1, ?)")
      .run(`existing-${i}`, "Reward_QA_OV", characterId, JSON.stringify({ junkId: "iron", quantity: 1 }));
  }
  const item = { id: "v2-overflow", type: "weapon", rarity: "rare", name: "Beginner Sword", gearTier: 1, atk: 14, rewardVersion: 2, itemModelVersion: 2, empowerSlotCapacity: 1, empowerSlots: [null], sourceType: "dungeon_normal", sourceFloor: 1 };
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: "qa-overflow", checkpointSeq: 1, payload: { battleId: "qa-overflow", floor: 1, safeActionSeq: 1 } })).body.accepted, true);
  const result = await post(api, db, token, { action: "completeBattle", characterId, battleId: "qa-overflow", result: { result: "victory", safeActionSeq: 2, floor: 1, reward: { floor: 1, encounterType: "normal", rewardRole: "normal", packCount: 1, gold: 23, xp: 8, diamonds: 0, unlockedNext: true, firstClear: false, items: [item] } } });
  assert.equal(result.body.ok, true);
  const stored = db.raw.prepare("SELECT extra_json FROM items WHERE item_id = ?").get("v2-overflow");
  assert.equal(JSON.parse(stored.extra_json).overflow, true);
});
