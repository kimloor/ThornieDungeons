const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");

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
  let source = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox); vm.runInContext(source, sandbox); return sandbox.__worker;
}

function database() {
  const db = new D1();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL, diamonds INTEGER DEFAULT 0, active_slot INTEGER, created_at TEXT NOT NULL);
    CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, slot_index INTEGER NOT NULL, name TEXT DEFAULT '', level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, stat_points INTEGER DEFAULT 0, str INTEGER DEFAULT 0, vit INTEGER DEFAULT 0, agi INTEGER DEFAULT 0, dex INTEGER DEFAULT 0, luk INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, unlocked_floor INTEGER DEFAULT 1, potions INTEGER DEFAULT 2, protection_stones INTEGER DEFAULT 0, chest_pity INTEGER DEFAULT 0, pets_json TEXT DEFAULT '[]', active_pet_id TEXT DEFAULT '', created_at TEXT, updated_at TEXT);
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
