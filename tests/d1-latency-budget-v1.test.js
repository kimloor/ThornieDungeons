const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");
const { applyAutoMigration, applyRequiredAutoMigrations } = require("./helpers/auto-migrations");

class Statement {
  constructor(raw, sql, values = []) { this.raw = raw; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.raw, this.sql, values); }
  async first() { return this.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.values) }; }
  async run() {
    const normalized = this.sql.trim().toUpperCase();
    if (/^(SELECT|PRAGMA)\b/.test(normalized)) return { results: this.raw.prepare(this.sql).all(...this.values) };
    const result = this.raw.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class D1Harness {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Statement(this.raw, sql); }
  async batch(statements) {
    const out = [];
    for (const statement of statements) out.push(await statement.run());
    return out;
  }
}

function createWorkerEntrypoint() {
  let workerSource = loadWorkerSource(path.resolve(__dirname, ".."));
  workerSource = workerSource.replace("export default {", "const workerDefault = {");
  const entrySource = fs.readFileSync(
    path.resolve(__dirname, "../workers/thornie-dungeons-api-entry.js"),
    "utf8"
  )
    .replace('import worker from "./thornie-dungeons-api.js";', "const worker = workerDefault;")
    .replace("export default {", "const entryDefault = {")
    .replace("export { createD1CountingBinding };", "");
  const source = `${workerSource}\n${entrySource}\nglobalThis.__entry = entryDefault;`;
  const sandbox = {
    console,
    Math,
    Date,
    Response,
    Headers,
    Request,
    URL,
    TextEncoder,
    Uint8Array,
    crypto,
    atob,
    btoa,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__entry;
}

function database() {
  const db = new D1Harness();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      diamonds INTEGER DEFAULT 0,
      active_slot INTEGER,
      created_at TEXT NOT NULL
    );
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      name TEXT DEFAULT '',
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      stat_points INTEGER DEFAULT 0,
      str INTEGER DEFAULT 0,
      vit INTEGER DEFAULT 0,
      agi INTEGER DEFAULT 0,
      dex INTEGER DEFAULT 0,
      luk INTEGER DEFAULT 0,
      gold INTEGER DEFAULT 0,
      unlocked_floor INTEGER DEFAULT 1,
      potions INTEGER DEFAULT 2,
      protection_stones INTEGER DEFAULT 0,
      chest_pity INTEGER DEFAULT 0,
      pets_json TEXT DEFAULT '[]',
      active_pet_id TEXT DEFAULT '',
      created_at TEXT,
      updated_at TEXT,
      last_active_at TEXT NOT NULL DEFAULT '',
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY,
      player_id TEXT,
      character_id TEXT,
      slot_type TEXT,
      equipped INTEGER DEFAULT 0,
      inventory_slot TEXT,
      item_template_id TEXT,
      rarity TEXT,
      name TEXT,
      item_level INTEGER DEFAULT 0,
      enhance_level INTEGER DEFAULT 0,
      bound INTEGER DEFAULT 0,
      quantity INTEGER DEFAULT 1,
      atk INTEGER DEFAULT 0,
      def INTEGER DEFAULT 0,
      hp INTEGER DEFAULT 0,
      mp INTEGER DEFAULT 0,
      extra_json TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(character_id) ON DELETE CASCADE
    );
    CREATE TABLE run_state (
      player_id TEXT PRIMARY KEY,
      floor INTEGER,
      level INTEGER,
      xp INTEGER,
      hp INTEGER,
      mp INTEGER,
      base_atk INTEGER,
      base_def INTEGER,
      base_max_hp INTEGER,
      base_max_mp INTEGER,
      run_gold INTEGER,
      potions INTEGER,
      updated_at TEXT,
      character_id TEXT
    );
    CREATE TABLE progress (
      player_id TEXT PRIMARY KEY,
      bank_gold INTEGER,
      diamonds INTEGER,
      best_floor INTEGER,
      potions INTEGER,
      char_level INTEGER,
      char_xp INTEGER,
      char_points INTEGER,
      char_str INTEGER,
      char_vit INTEGER,
      char_dex INTEGER,
      char_luk INTEGER,
      pets_json TEXT,
      active_pet_id TEXT,
      updated_at TEXT
    );
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "fixtures/auth-v2-schema.sql"), "utf8"));
  applyAutoMigration(db, path.resolve(__dirname, ".."), "0012_battle_persistence_v1.sql");
  applyAutoMigration(db, path.resolve(__dirname, ".."), "0013_pet_run_state_v1.sql");
  applyAutoMigration(db, path.resolve(__dirname, ".."), "0026_w45_authority_receipts.sql");
  applyRequiredAutoMigrations(db, path.resolve(__dirname, ".."));
  return db;
}

async function post(entry, db, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await entry.fetch(
    new Request("https://api.test", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { DB: db }
  );
  return {
    response,
    status: response.status,
    body: await response.json(),
    d1Calls: Number(response.headers.get("Server-Timing")?.match(/desc="(\\d+) calls"/)?.[1] || -1),
  };
}

function makeBattleCheckpoint(started) {
  const context = started.body.context;
  return {
    version: 1,
    battleId: started.body.battleId,
    mode: "dungeon",
    floor: context.floor,
    encounterType: context.role,
    safeActionSeq: 1,
    serverContext: context,
    enemyIds: context.enemies.map(enemy => enemy.instanceId),
    units: Object.fromEntries(context.enemies.map(enemy => [enemy.instanceId, {
      id: enemy.instanceId,
      kind: enemy.kind,
      side: "enemy",
      isBoss: enemy.isBoss,
      monsterDefId: enemy.id,
      encounterType: context.role,
    }])),
  };
}

async function measureLatencyScenario() {
  const entry = createWorkerEntrypoint();
  const db = database();

  const registration = await post(entry, db, null, {
    action: "register",
    id: "LatencyBudgetQA",
    password: "pass123",
    confirmPassword: "pass123",
  });
  assert.equal(registration.status, 200, JSON.stringify(registration.body));
  const token = registration.body.sessionToken;

  const created = await post(entry, db, token, {
    action: "createCharacter",
    slotIndex: 0,
    name: "Latency QA",
  });
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const characterId = created.body.character.character_id;

  db.raw.prepare("UPDATE characters SET gold = ?, unlocked_floor = ? WHERE character_id = ?").run(100, 1, characterId);
  db.raw.prepare("UPDATE players SET diamonds = ? WHERE id = ?").run(100, "LatencyBudgetQA");

  const purchase = await post(entry, db, token, {
    action: "purchaseCharacterResource",
    characterId,
    resource: { kind: "material", id: "iron" },
    quantity: 1,
    requestId: "latency-purchase-01",
  });
  assert.equal(purchase.status, 200, JSON.stringify(purchase.body));
  assert.ok(purchase.d1Calls >= 0);

  const purchased = db.raw.prepare(
    "SELECT item_id FROM items WHERE character_id = ? ORDER BY rowid DESC LIMIT 1"
  ).get(characterId);
  assert.ok(purchased?.item_id);

  const sell = await post(entry, db, token, {
    action: "sellCharacterItem",
    characterId,
    itemId: purchased.item_id,
    quantity: 1,
    requestId: "latency-sell-01",
  });
  assert.equal(sell.status, 200, JSON.stringify(sell.body));
  assert.ok(sell.d1Calls >= 0);

  const started = await post(entry, db, token, {
    action: "startDungeonBattle",
    characterId,
    floor: 1,
  });
  assert.equal(started.status, 200, JSON.stringify(started.body));

  const checkpoint = makeBattleCheckpoint(started);
  db.raw.prepare(
    "UPDATE battle_checkpoints SET checkpoint_seq = ?, payload_json = ?, state = 'active' WHERE battle_id = ? AND character_id = ?"
  ).run(1, JSON.stringify(checkpoint), started.body.battleId, characterId);

  const reward = {
    floor: 1,
    encounterType: started.body.context.role,
    rewardRole: started.body.context.role,
    packCount: started.body.context.packCount,
    gold: 23,
    xp: 8,
  };
  const completionPayload = {
    result: "victory",
    safeActionSeq: 2,
    floor: 1,
    reward,
  };

  const complete = await post(entry, db, token, {
    action: "completeBattle",
    characterId,
    battleId: started.body.battleId,
    result: completionPayload,
  });
  assert.equal(complete.status, 200, JSON.stringify(complete.body));

  const replay = await post(entry, db, token, {
    action: "completeBattle",
    characterId,
    battleId: started.body.battleId,
    result: completionPayload,
  });
  assert.equal(replay.status, 200, JSON.stringify(replay.body));
  assert.equal(replay.body.firstCompletion, false);

  const measured = {
    purchaseCharacterResource: purchase.d1Calls,
    sellCharacterItem: sell.d1Calls,
    completeBattleNormal: complete.d1Calls,
    completeBattleReplay: replay.d1Calls,
  };
  console.log("D1_LATENCY_MEASURED " + JSON.stringify(measured));
  return measured;
}

test("real worker + sqlite D1 measurement stays within production budgets", async () => {
  const measured = await measureLatencyScenario();
  const budgets = {
    purchaseCharacterResource: 4,
    sellCharacterItem: 4,
    completeBattleNormal: 4,
    completeBattleReplay: 2,
  };
  assert.ok(measured.purchaseCharacterResource <= budgets.purchaseCharacterResource);
  assert.ok(measured.sellCharacterItem <= budgets.sellCharacterItem);
  assert.ok(measured.completeBattleNormal <= budgets.completeBattleNormal);
  assert.ok(measured.completeBattleReplay <= budgets.completeBattleReplay);
});

test("D1 measurement counter is exposed as Server-Timing on the real Worker entrypoint", async () => {
  const entry = createWorkerEntrypoint();
  assert.equal(typeof entry.fetch, "function");
  assert.match(
    fs.readFileSync("workers/thornie-dungeons-api-entry.js", "utf8"),
    /Server-Timing.*d1/
  );
});
