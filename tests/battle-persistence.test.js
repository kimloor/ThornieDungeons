const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");
const { applyRequiredAutoMigrations } = require("./helpers/auto-migrations");

class Statement {
  constructor(raw, sql, values = []) { this.raw = raw; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.raw, this.sql, values); }
  async first() { return this.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.values) }; }
  async run() {
    if (/^(SELECT|PRAGMA)\b/.test(this.sql.trim().toUpperCase())) return { results: this.raw.prepare(this.sql).all(...this.values) };
    const result = this.raw.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}
class D1 {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Statement(this.raw, sql); }
  async batch(statements) {
    this.raw.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

function worker() {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console, Math, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
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
  applyRequiredAutoMigrations(db, path.resolve(__dirname, ".."));
  return db;
}
async function post(api, db, token, body) {
  const response = await api.fetch(new Request("https://api.test", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }), { DB: db });
  return { status: response.status, body: await response.json() };
}
async function get(api, db, token, params) {
  const response = await api.fetch(new Request(`https://api.test?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${token}` } }), { DB: db });
  return { status: response.status, body: await response.json() };
}
async function account(api, db, id = "Battle_Authority") {
  const registration = await post(api, db, "", { action: "register", id, password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: id });
  return { token, characterId: created.body.character.character_id };
}
async function submit(api, db, token, characterId, battleId, rev, command, actionKey = `action-${rev}-${Math.random()}`) {
  return post(api, db, token, { action: "submitDungeonBattleAction", characterId, battleId, expectedRev: rev, actionKey, command });
}
async function resolveBattle(api, db, token, characterId, started) {
  let state = started.body.state, rev = started.body.stateRev;
  for (let i = 0; i < 500 && !state.result; i += 1) {
    const actor = state.units[state.queue[state.queueIndex]];
    const enemy = Object.values(state.units).find(unit => unit.side === "enemy" && !unit.dead && unit.hp > 0);
    const command = actor.kind === "hero" ? (state.heroTurnCount >= 5 ? { type: "skip_battle" } : { type: "basic", targetId: enemy.id }) : { type: "advance" };
    const result = await submit(api, db, token, characterId, started.body.battleId, rev, command, `legal-${rev}`);
    assert.equal(result.body.ok, true, JSON.stringify(result.body));
    state = result.body.state; rev = result.body.stateRev;
  }
  return { state, rev };
}

test("server state rejects forged checkpoint and premature victory", async () => {
  const api = worker(), db = database();
  const { token, characterId } = await account(api, db);
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 1 });
  assert.equal(started.body.authoritative, true);
  const forged = { ...started.body.state, result: "victory", safeActionSeq: 999, units: {} };
  const checkpoint = await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 999, payload: forged });
  assert.equal(checkpoint.body.authoritative, true); assert.equal(checkpoint.body.accepted, false);
  const completion = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory", safeActionSeq: 1000, gold: 999999 } });
  assert.equal(completion.status, 409); assert.equal(completion.body.error, "battle_outcome_not_verified");
  assert.deepEqual({ ...db.raw.prepare("SELECT state_rev, outcome, settled_at FROM battle_authority WHERE battle_id = ?").get(started.body.battleId) }, { state_rev: 0, outcome: "", settled_at: "" });
});

test("actions enforce ownership, revision, idempotency, order, and targets", async () => {
  const api = worker(), db = database();
  const owner = await account(api, db, "Battle_Owner"), other = await account(api, db, "Battle_Other");
  const started = await post(api, db, owner.token, { action: "startDungeonBattle", characterId: owner.characterId, floor: 1 });
  const actor = started.body.state.units[started.body.state.queue[0]];
  const legal = actor.kind === "hero" ? { type: "basic", targetId: started.body.state.enemyIds[0] } : { type: "advance" };
  const first = await submit(api, db, owner.token, owner.characterId, started.body.battleId, 0, legal, "stable-action-key");
  assert.equal(first.body.ok, true);
  const replay = await submit(api, db, owner.token, owner.characterId, started.body.battleId, 0, legal, "stable-action-key");
  assert.equal(replay.body.replayed, true); assert.equal(replay.body.stateRev, 1);
  assert.equal((await submit(api, db, owner.token, owner.characterId, started.body.battleId, 0, legal, "stale-action-key")).body.error, "battle_revision_conflict");
  assert.equal((await submit(api, db, other.token, other.characterId, started.body.battleId, 1, { type: "advance" }, "cross-character")).body.error, "battle_identity_conflict");
  const current = first.body.state, currentActor = current.units[current.queue[current.queueIndex]];
  const illegal = currentActor.kind === "hero" ? { type: "basic", targetId: "not-an-enemy" } : { type: "basic" };
  assert.equal((await submit(api, db, owner.token, owner.characterId, started.body.battleId, 1, illegal, "illegal-action")).body.error, "battle_action_not_legal");
});

test("Worker-derived victory settles exactly once and ignores forged rewards", async () => {
  const api = worker(), db = database();
  const { token, characterId } = await account(api, db, "Battle_Winner");
  db.raw.prepare("UPDATE characters SET str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(characterId);
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 1 });
  assert.equal((await resolveBattle(api, db, token, characterId, started)).state.result, "victory");
  const forged = { result: "victory", safeActionSeq: 999999, floor: 999, hp: 999999, damage: 999999, reward: { gold: 999999, xp: 999999, diamonds: 999999, items: [{ type: "weapon", atk: 999999 }] } };
  const [a, b] = await Promise.all([post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: forged }), post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: forged })]);
  assert.equal(a.body.ok, true); assert.equal(b.body.ok, true);
  assert.equal([a.body.firstCompletion, b.body.firstCompletion].filter(Boolean).length, 1);
  const character = db.raw.prepare("SELECT gold,xp,unlocked_floor FROM characters WHERE character_id=?").get(characterId);
  assert.ok(character.gold > 0 && character.gold < 999999); assert.ok(character.xp > 0 && character.xp < 999999); assert.equal(character.unlocked_floor, 2);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE battle_id=?").get(started.body.battleId).c, 1);
});

test("legacy checkpoint uses restart-same-floor policy without rewards", async () => {
  const api = worker(), db = database();
  const { token, characterId } = await account(api, db, "Battle_Legacy");
  const now = new Date().toISOString();
  db.raw.prepare("INSERT INTO battle_checkpoints (battle_id,character_id,checkpoint_seq,payload_json,state,created_at,updated_at) VALUES (?,?,7,?,'active',?,?)").run("legacy-battle", characterId, JSON.stringify({ battleId: "legacy-battle", mode: "dungeon", floor: 1, result: "victory" }), now, now);
  const state = await get(api, db, token, { action: "getBattleState", characterId });
  assert.equal(state.body.checkpoint, null); assert.equal(state.body.legacyRecovery.policy, "restart_same_floor");
  const denied = await post(api, db, token, { action: "completeBattle", characterId, battleId: "legacy-battle", result: { result: "victory", safeActionSeq: 8 } });
  assert.equal(denied.body.error, "battle_authority_upgrade_required");
  const restarted = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 1 });
  const hero = restarted.body.state.units[restarted.body.state.heroId];
  assert.equal(hero.hp, hero.maxHp); assert.equal(hero.sp, hero.maxSp);
});
