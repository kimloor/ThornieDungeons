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
  async batch(statements) {
    const result = [];
    this.raw.exec("BEGIN");
    try {
      for (const statement of statements) result.push(await statement.run());
      this.raw.exec("COMMIT");
      return result;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

function worker(consoleImpl = console) {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {");
  source += "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console: consoleImpl, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__worker;
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
    CREATE TABLE recipes (recipe_id TEXT PRIMARY KEY, result_item_def TEXT, materials_json TEXT, source TEXT, created_at TEXT);
    CREATE TABLE monster_loot (entry_id TEXT PRIMARY KEY, monster_id TEXT, kind TEXT, item_type TEXT, rarity TEXT, junk_id TEXT, qty_min INTEGER, qty_max INTEGER, weight REAL, drop_chance REAL, created_at TEXT, updated_at TEXT);
    CREATE TABLE junk_info (junk_id TEXT PRIMARY KEY, name TEXT, icon TEXT, created_at TEXT, updated_at TEXT);
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "fixtures/auth-v2-schema.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0012_battle_persistence_v1.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0013_pet_run_state_v1.sql"), "utf8"));
  return db;
}

async function call(api, db, body, token = "", envExtra = {}) {
  const response = await api.fetch(new Request("https://api.test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), { DB: db, ...envExtra });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function postRaw(api, db, raw, headers = {}, envExtra = {}) {
  const response = await api.fetch(new Request("https://api.test", {
    method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: raw,
  }), { DB: db, ...envExtra });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function get(api, db, params, headers = {}, envExtra = {}) {
  const response = await api.fetch(new Request(`https://api.test/?${new URLSearchParams(params)}`, { headers }), { DB: db, ...envExtra });
  return { status: response.status, headers: response.headers, body: await response.json() };
}
async function register(api, db, id) {
  const result = await call(api, db, { action: "register", id, password: "pass", confirmPassword: "pass" });
  assert.equal(result.body.ok, true);
  return result.body.sessionToken;
}
async function createCharacter(api, db, token, slot = 0) {
  const result = await call(api, db, { action: "createCharacter", slotIndex: slot, name: `${token.slice(0, 4)}-${slot}` }, token);
  assert.equal(result.body.ok, true);
  return result.body.character.character_id;
}

test("CORS allows configured production origin, preserves preflight, and rejects unapproved origins", async () => {
  const api = worker(), db = database();
  const allowed = await get(api, db, { action: "getRecipes" }, { Origin: "https://thorniedungeons.ekqtjl.workers.dev" });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get("Access-Control-Allow-Origin"), "https://thorniedungeons.ekqtjl.workers.dev");

  const preflightResponse = await api.fetch(new Request("https://api.test", { method: "OPTIONS", headers: { Origin: "http://localhost:5173" } }), { DB: db });
  assert.equal(preflightResponse.status, 200);
  assert.equal(preflightResponse.headers.get("Access-Control-Allow-Methods"), "GET,POST,OPTIONS");
  assert.match(preflightResponse.headers.get("Access-Control-Allow-Headers"), /Authorization/);
  assert.equal(preflightResponse.headers.get("Access-Control-Allow-Origin"), "http://localhost:5173");

  const rejected = await get(api, db, { action: "getRecipes" }, { Origin: "https://evil.example" });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.body.error, "cors_origin_not_allowed");
  assert.equal(rejected.headers.get("Access-Control-Allow-Origin"), null);
});

test("request body boundary rejects oversized payloads before route processing", async () => {
  const api = worker(), db = database();
  const oversized = JSON.stringify({ action: "register", id: "BodyLimit", password: "pass", confirmPassword: "pass", padding: "x".repeat(512 * 1024) });
  const result = await postRaw(api, db, oversized, { "Content-Length": String(Buffer.byteLength(oversized)) });
  assert.equal(result.status, 413);
  assert.equal(result.body.error, "request_body_too_large");
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM players").get().c, 0);
});

test("client receives stable parse errors without SQL or stack details", async () => {
  const api = worker(), db = database();
  const result = await postRaw(api, db, "{not-json");
  assert.equal(result.status, 400);
  assert.equal(result.body.error, "invalid_json");
  assert.equal(Object.hasOwn(result.body, "stack"), false);
  assert.equal(Object.hasOwn(result.body, "message"), false);
});

test("inventory slot writes validate bounds and preserve two-account ownership isolation", async () => {
  const api = worker(), db = database();
  const tokenA = await register(api, db, "Slot_A");
  const charA = await createCharacter(api, db, tokenA, 0);
  db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, inventory_slot, extra_json, created_at, updated_at) VALUES (?, ?, ?, 'weapon', 0, '', '{}', 'now', 'now')`).run("item-a", "Slot_A", charA);

  for (const inventorySlot of [-1, 5000, "4"]) {
    const result = await call(api, db, { action: "setInventorySlot", characterId: charA, itemId: "item-a", inventorySlot }, tokenA);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, "invalid_inventory_slot");
  }
  const valid = await call(api, db, { action: "setInventorySlot", characterId: charA, itemId: "item-a", inventorySlot: 4 }, tokenA);
  assert.equal(valid.body.ok, true);
  assert.equal(Number(db.raw.prepare("SELECT inventory_slot FROM items WHERE item_id='item-a'").get().inventory_slot), 4);

  const tokenB = await register(api, db, "Slot_B");
  const deniedCharacter = await call(api, db, { action: "setInventorySlot", characterId: charA, itemId: "item-a", inventorySlot: 2 }, tokenB);
  assert.equal(deniedCharacter.status, 403);
  assert.equal(deniedCharacter.body.error, "forbidden");
  const deniedSync = await call(api, db, { action: "syncItems", characterId: charA, items: [{ itemId: "item-a", equipped: false, inventorySlot: 2 }] }, tokenB);
  assert.equal(deniedSync.status, 403);
  assert.equal(deniedSync.body.error, "forbidden");
  assert.equal(Number(db.raw.prepare("SELECT inventory_slot FROM items WHERE item_id='item-a'").get().inventory_slot), 4);
});

test("syncItems emits bounded diagnostics for unknown owned-scope item while preserving rejection", async () => {
  const warnings = [];
  const api = worker({ ...console, warn: (...args) => warnings.push(args.join(" ")) });
  const db = database();
  const token = await register(api, db, "SyncDiag_QA");
  const characterId = await createCharacter(api, db, token);

  const rejected = await call(api, db, {
    action: "syncItems", characterId,
    items: [{ itemId: "unknown-item-diag", equipped: false, inventorySlot: 3, password: "must-not-log" }]
  }, token);
  assert.equal(rejected.status, 403);
  assert.equal(rejected.body.error, "item_not_owned");
  assert.equal(rejected.body.action, "syncItems");
  assert.equal(rejected.body.itemId, "unknown-item-diag");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /inventory_sync_rejected/);
  assert.match(warnings[0], /"snapshotIndex":0/);
  assert.match(warnings[0], /"snapshotCount":1/);
  assert.doesNotMatch(warnings[0], /must-not-log|pass|Authorization|sessionToken/);

  db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, inventory_slot, extra_json, created_at, updated_at) VALUES (?, ?, ?, 'weapon', 0, '', '{}', 'now', 'now')`).run("valid-sync-item", "SyncDiag_QA", characterId);
  const accepted = await call(api, db, { action: "syncItems", characterId, items: [{ itemId: "valid-sync-item", equipped: false, inventorySlot: 3 }] }, token);
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.ok, true);
});

test("inventory reads preserve two-account ownership isolation", async () => {
  const api = worker(), db = database();
  const tokenA = await register(api, db, "Read_A");
  const charA = await createCharacter(api, db, tokenA, 0);
  db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, inventory_slot, extra_json, created_at, updated_at) VALUES (?, ?, ?, 'weapon', 0, '', '{}', 'now', 'now')`).run("private-item", "Read_A", charA);

  const tokenB = await register(api, db, "Read_B");
  await createCharacter(api, db, tokenB, 0);

  const denied = await get(api, db, { action: "getInventory", characterId: charA, page: 1, pageSize: 100 }, { Authorization: `Bearer ${tokenB}` });
  assert.equal(denied.status, 403);
  assert.equal(denied.body.error, "forbidden");
  assert.equal(Object.hasOwn(denied.body, "items"), false);

  const allowed = await get(api, db, { action: "getInventory", characterId: charA, page: 1, pageSize: 100 }, { Authorization: `Bearer ${tokenA}` });
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.ok, true);
  assert.deepEqual(allowed.body.items.map(item => item.item_id), ["private-item"]);
});

test("Dungeon checkpoint accepts canonical server context when mutable combat metadata is incomplete", async () => {
  const api = worker(), db = database();
  const token = await register(api, db, "Checkpoint_QA");
  const characterId = await createCharacter(api, db, token);
  db.raw.prepare("UPDATE characters SET unlocked_floor=6 WHERE character_id=?").run(characterId);

  const battleId = "battle-checkpoint-context-qa";
  const serverContext = {
    version: 1,
    mode: "dungeon",
    floor: 6,
    role: "normal",
    packCount: 1,
    enemies: [{
      id: "jelly_slime",
      instanceId: "dungeon-enemy-1-context-qa",
      modifierId: "golden",
      kind: "monster",
      isBoss: false
    }],
    encounterSeed: 123456789,
    rewardSeed: 987654321
  };
  const authorization = {
    version: 1,
    battleId,
    mode: "dungeon",
    floor: 6,
    encounterType: "normal",
    safeActionSeq: -1,
    authorizationOnly: true,
    serverContext
  };
  db.raw.prepare(`
    INSERT INTO battle_checkpoints
      (battle_id, character_id, checkpoint_seq, payload_json, state, created_at, updated_at)
    VALUES (?, ?, -1, ?, 'active', 'now', 'now')
  `).run(battleId, characterId, JSON.stringify(authorization));

  const payload = {
    version: 1,
    battleId,
    mode: "dungeon",
    floor: 6,
    encounterType: "normal",
    safeActionSeq: 0,
    serverContext,
    enemyIds: ["dungeon-enemy-1-context-qa"],
    units: {
      "dungeon-enemy-1-context-qa": {
        id: "dungeon-enemy-1-context-qa",
        monsterDefId: "jelly_slime",
        kind: "monster",
        side: "enemy",
        hp: 1,
        maxHp: 100
      }
    }
  };
  const saved = await call(api, db, {
    action: "saveBattleCheckpoint",
    characterId,
    battleId,
    checkpointSeq: 0,
    payload
  }, token);
  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.accepted, true);

  const stored = db.raw.prepare("SELECT checkpoint_seq, payload_json FROM battle_checkpoints WHERE battle_id=?").get(battleId);
  assert.equal(stored.checkpoint_seq, 0);
  assert.equal(JSON.parse(stored.payload_json).serverContext.enemies[0].modifierId, "golden");
});

test("Dungeon checkpoint still rejects forged enemy identity even with copied server context", async () => {
  const api = worker(), db = database();
  const token = await register(api, db, "Checkpoint_Forge_QA");
  const characterId = await createCharacter(api, db, token);

  const battleId = "battle-checkpoint-forge-qa";
  const serverContext = {
    version: 1,
    mode: "dungeon",
    floor: 1,
    role: "normal",
    packCount: 1,
    enemies: [{
      id: "jelly_slime",
      instanceId: "dungeon-enemy-1-forge-qa",
      modifierId: null,
      kind: "monster",
      isBoss: false
    }],
    encounterSeed: 111,
    rewardSeed: 222
  };
  db.raw.prepare(`
    INSERT INTO battle_checkpoints
      (battle_id, character_id, checkpoint_seq, payload_json, state, created_at, updated_at)
    VALUES (?, ?, -1, ?, 'active', 'now', 'now')
  `).run(battleId, characterId, JSON.stringify({
    version: 1, battleId, mode: "dungeon", floor: 1, encounterType: "normal",
    safeActionSeq: -1, authorizationOnly: true, serverContext
  }));

  const denied = await call(api, db, {
    action: "saveBattleCheckpoint",
    characterId,
    battleId,
    checkpointSeq: 0,
    payload: {
      version: 1,
      battleId,
      mode: "dungeon",
      floor: 1,
      encounterType: "normal",
      safeActionSeq: 0,
      serverContext,
      enemyIds: ["dungeon-enemy-1-forge-qa"],
      units: {
        "dungeon-enemy-1-forge-qa": {
          id: "dungeon-enemy-1-forge-qa",
          monsterDefId: "sandy_crab",
          kind: "monster",
          side: "enemy"
        }
      }
    }
  }, token);
  assert.equal(denied.status, 400);
  assert.equal(denied.body.error, "invalid_dungeon_checkpoint");
});

test("run-state save cannot forge progression, currency, or consumables", async () => {
  const api = worker(), db = database();
  const token = await register(api, db, "Run_State_QA");
  const characterId = await createCharacter(api, db, token);
  db.raw.prepare("UPDATE characters SET level=7, xp=42, gold=99, potions=3, unlocked_floor=6 WHERE character_id=?").run(characterId);
  const saved = await call(api, db, {
    action: "saveRunState", characterId,
    runState: { floor: 999, level: 9999, xp: 999999, run_gold: 999999, potions: 999, hp: 12, mp: 4 },
  }, token);
  assert.equal(saved.body.ok, true);
  const row = db.raw.prepare("SELECT floor, level, xp, run_gold, potions, hp, mp FROM character_run_state WHERE character_id=?").get(characterId);
  assert.deepEqual({ ...row }, { floor: 999, level: 7, xp: 42, run_gold: 0, potions: 3, hp: 12, mp: 4 });
  const character = db.raw.prepare("SELECT level, xp, gold, potions, unlocked_floor FROM characters WHERE character_id=?").get(characterId);
  assert.deepEqual({ ...character }, { level: 7, xp: 42, gold: 99, potions: 3, unlocked_floor: 6 });
});

test("duplicate registration exposes one generic availability error", async () => {
  const api = worker(), db = database();
  await register(api, db, "Enum_QA");
  const duplicate = await call(api, db, { action: "register", id: "enum_qa", password: "pass", confirmPassword: "pass" });
  assert.equal(duplicate.status, 400);
  assert.equal(duplicate.body.error, "registration_unavailable");
  assert.equal(duplicate.body.error === "id_unavailable", false);
});

test("Admin output escapes untrusted values before HTML interpolation", () => {
  const html = fs.readFileSync(path.join(__dirname, "../admin.html"), "utf8");
  assert.match(html, /function escapeHtml\(value\)/);
  assert.doesNotMatch(html, /\$\{r\.(?:recipeId|type|name|setId|item_type|rarity|weight|junk_id|qty_min|qty_max|drop_chance)\}/);
  assert.doesNotMatch(html, /\$\{j\.(?:junk_id|name|icon)\}/);
});
