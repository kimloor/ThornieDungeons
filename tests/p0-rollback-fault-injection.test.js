const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");
const { applyAutoMigration, applyRequiredAutoMigrations } = require("./helpers/auto-migrations");
const { extractFunction } = require("./helpers/extract-source");

class Statement {
  constructor(raw, sql, values = []) { this.raw = raw; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.raw, this.sql, values); }
  async first() { return this.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.values) }; }
  async run() {
    if (/^(SELECT|PRAGMA)\b/.test(this.sql.trim().toUpperCase())) {
      return { results: this.raw.prepare(this.sql).all(...this.values) };
    }
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

function loadFaultModule() {
  const filename = path.join(__dirname, "../workers/qa/p0-rollback-fault.js");
  const source = fs.readFileSync(filename, "utf8").replace(/^export /gm, "")
    + "\nglobalThis.__fault = { P0_ROLLBACK_FAULT_MODE, P0_ROLLBACK_OPERATION, createRewardSettlementFaultBinding, constantTimeSecretEqual, configuredFaultScope, claimFaultInjection };";
  const sandbox = { crypto, TextEncoder, Uint8Array, Date, JSON, Proxy, Reflect, Symbol };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__fault;
}

function worker() {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console, Math, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__worker;
}

function countingBinding(db) {
  const source = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api-entry.js"), "utf8");
  const sandbox = { Proxy, Reflect };
  vm.createContext(sandbox);
  vm.runInContext(`${extractFunction(source, "createD1CountingBinding")}\nglobalThis.__counting = createD1CountingBinding;`, sandbox);
  return sandbox.__counting(db);
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
  applyAutoMigration(db, path.resolve(__dirname, ".."), "0026_w45_authority_receipts.sql");
  applyRequiredAutoMigrations(db, path.resolve(__dirname, ".."));
  return db;
}

async function post(api, db, token, body) {
  const response = await api.fetch(new Request("https://api.test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), { DB: db });
  return { status: response.status, body: await response.json() };
}

async function account(api, db, id) {
  const registration = await post(api, db, "", { action: "register", id, password: "pass", confirmPassword: "pass" });
  assert.ok(registration.body.sessionToken, JSON.stringify(registration.body));
  const created = await post(api, db, registration.body.sessionToken, { action: "createCharacter", slotIndex: 0, name: id });
  assert.ok(created.body.character, JSON.stringify(created.body));
  return { token: registration.body.sessionToken, characterId: created.body.character.character_id, playerId: id };
}

async function submit(api, db, token, characterId, battleId, rev, command) {
  return post(api, db, token, {
    action: "submitDungeonBattleAction",
    characterId,
    battleId,
    expectedRev: rev,
    actionKey: `p0-rollback-action-${rev}`,
    command,
  });
}

async function resolveBattle(api, db, token, characterId, started) {
  let state = started.body.state;
  let rev = started.body.stateRev;
  for (let index = 0; index < 500 && !state.result; index += 1) {
    const actor = state.units[state.queue[state.queueIndex]] || Object.values(state.units)
      .filter(unit => !unit.dead && unit.hp > 0)
      .sort((left, right) => Number(right.speed) - Number(left.speed) || left.tieOrder - right.tieOrder || left.id.localeCompare(right.id))[0];
    const enemy = Object.values(state.units).find(unit => unit.side === "enemy" && !unit.dead && unit.hp > 0);
    const command = actor.kind === "hero"
      ? (state.heroTurnCount >= 5 ? { type: "skip_battle" } : { type: "basic", targetId: enemy.id })
      : { type: "advance" };
    const response = await submit(api, db, token, characterId, started.body.battleId, rev, command);
    assert.equal(response.body.ok, true, JSON.stringify(response.body));
    state = response.body.state;
    rev = response.body.stateRev;
  }
  assert.equal(state.result, "victory");
  return { state, rev };
}

function rewardState(db, characterId, battleId) {
  const character = db.raw.prepare("SELECT level,xp,stat_points,gold,unlocked_floor,pets_json,active_pet_id FROM characters WHERE character_id=?").get(characterId);
  const playerId = db.raw.prepare("SELECT player_id FROM characters WHERE character_id=?").get(characterId).player_id;
  return {
    character: { ...character },
    diamonds: db.raw.prepare("SELECT diamonds FROM players WHERE id=?").get(playerId).diamonds,
    items: db.raw.prepare("SELECT item_id,player_id,character_id,quantity,extra_json FROM items WHERE character_id=? ORDER BY item_id").all(characterId),
    provenance: db.raw.prepare("SELECT item_id,original_player_id,original_character_id,origin_type,origin_source_id FROM item_provenance WHERE original_character_id=? ORDER BY item_id").all(characterId),
    ownership: db.raw.prepare("SELECT event_id,item_id,to_player_id,to_character_id,event_type FROM item_ownership_events WHERE to_character_id=? ORDER BY event_id").all(characterId),
    completion: db.raw.prepare("SELECT battle_id,character_id,result_json,completed_at FROM battle_completions WHERE battle_id=?").get(battleId) || null,
    checkpoint: { ...db.raw.prepare("SELECT state,checkpoint_seq,payload_json FROM battle_checkpoints WHERE battle_id=?").get(battleId) },
    authority: { ...db.raw.prepare("SELECT state_rev,state_json,outcome,settled_at FROM battle_authority WHERE battle_id=?").get(battleId) },
  };
}

test("R01/R02/R03: settlement fault rolls back every reward write, then recovers exactly once", async () => {
  const fault = loadFaultModule();
  const api = worker();
  const db = database();
  const qa = await account(api, db, "P0RollbackQA");
  db.raw.prepare("UPDATE characters SET unlocked_floor=10,str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(qa.characterId);
  const started = await post(api, db, qa.token, { action: "startDungeonBattle", characterId: qa.characterId, floor: 10 });
  assert.equal(started.body.context.role, "chapter_boss");
  await resolveBattle(api, db, qa.token, qa.characterId, started);

  const scope = {
    playerId: qa.playerId,
    characterId: qa.characterId,
    battleId: started.body.battleId,
    nonce: "rollback-local-0001",
  };
  assert.equal(await fault.claimFaultInjection(db, scope, "2026-11-02T00:00:00.000Z"), true);
  assert.equal(await fault.claimFaultInjection(db, scope, "2026-11-02T00:00:01.000Z"), false);
  assert.equal(await fault.claimFaultInjection(db, { ...scope, nonce: "rollback-local-0002" }, "2026-11-02T00:00:02.000Z"), false);
  const before = rewardState(db, qa.characterId, started.body.battleId);
  const { binding, state } = fault.createRewardSettlementFaultBinding(db, scope);
  const counted = countingBinding(binding);
  const failed = await post(api, counted.binding, qa.token, {
    action: "completeBattle",
    characterId: qa.characterId,
    battleId: started.body.battleId,
    result: { result: "victory", reward: { gold: 999999 } },
  });
  assert.deepEqual(failed, { status: 500, body: { error: "server_error" } });
  assert.equal(state.matchedBatches, 1);
  assert.equal(state.injections, 1);
  assert.ok(state.injectedAfterStatements >= 6, `fault inserted after only ${state.injectedAfterStatements} statements`);
  assert.ok(counted.getCount() >= 4);
  assert.deepEqual(rewardState(db, qa.characterId, started.body.battleId), before);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM character_operation_receipts WHERE character_id=? AND operation=?").get(qa.characterId, fault.P0_ROLLBACK_OPERATION).c, 1);

  const completionBody = {
    action: "completeBattle",
    characterId: qa.characterId,
    battleId: started.body.battleId,
    result: { result: "victory" },
  };
  const [first, second] = await Promise.all([
    post(api, db, qa.token, completionBody),
    post(api, db, qa.token, completionBody),
  ]);
  assert.equal(first.body.ok, true, JSON.stringify(first.body));
  assert.equal(second.body.ok, true, JSON.stringify(second.body));
  assert.equal([first.body.firstCompletion, second.body.firstCompletion].filter(Boolean).length, 1);
  const settled = rewardState(db, qa.characterId, started.body.battleId);
  assert.ok(settled.character.gold > before.character.gold);
  assert.ok(settled.character.xp !== before.character.xp || settled.character.level > before.character.level);
  assert.ok(settled.items.length > before.items.length);
  assert.ok(settled.provenance.length > before.provenance.length);
  assert.ok(settled.ownership.length > before.ownership.length);
  assert.ok(settled.completion);
  assert.equal(settled.checkpoint.state, "completed");
  assert.ok(settled.authority.settled_at);

  const replay = await post(api, db, qa.token, completionBody);
  assert.equal(replay.body.firstCompletion, false);
  assert.deepEqual(rewardState(db, qa.characterId, started.body.battleId), settled);
});
test("R04 and guards: no-injection path preserves approved Normal/Chapter Boss behavior", async () => {
  const fault = loadFaultModule();
  assert.equal(await fault.constantTimeSecretEqual("qa-secret", "qa-secret"), true);
  assert.equal(await fault.constantTimeSecretEqual("wrong", "qa-secret"), false);
  assert.equal(await fault.constantTimeSecretEqual("", ""), false);
  assert.equal(fault.configuredFaultScope({
    P0_ROLLBACK_PLAYER_ID: "P0Parity",
    P0_ROLLBACK_CHARACTER_ID: "char-qa",
    P0_ROLLBACK_BATTLE_ID: "battle-qa",
  }, { characterId: "char-other", battleId: "battle-qa" }, "rollback-parity-0001"), null);

  const api = worker();
  const db = database();
  const normal = await account(api, db, "P0ParityNormal");
  db.raw.prepare("UPDATE characters SET str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(normal.characterId);
  const normalBattle = await post(api, db, normal.token, { action: "startDungeonBattle", characterId: normal.characterId, floor: 1 });
  await resolveBattle(api, db, normal.token, normal.characterId, normalBattle);
  const normalCompleted = await post(api, db, normal.token, {
    action: "completeBattle", characterId: normal.characterId, battleId: normalBattle.body.battleId, result: { result: "victory" },
  });
  assert.equal(normalCompleted.body.firstCompletion, true, JSON.stringify(normalCompleted.body));
  assert.equal(normalCompleted.body.result.reward.rewardRole, "normal");

  const boss = await account(api, db, "P0ParityBoss");
  db.raw.prepare("UPDATE characters SET unlocked_floor=10,str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(boss.characterId);
  const bossBattle = await post(api, db, boss.token, { action: "startDungeonBattle", characterId: boss.characterId, floor: 10 });
  await resolveBattle(api, db, boss.token, boss.characterId, bossBattle);
  const bossCompleted = await post(api, db, boss.token, {
    action: "completeBattle", characterId: boss.characterId, battleId: bossBattle.body.battleId, result: { result: "victory" },
  });
  assert.equal(bossCompleted.body.firstCompletion, true, JSON.stringify(bossCompleted.body));
  assert.equal(bossCompleted.body.result.reward.rewardRole, "chapter_boss");
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM character_operation_receipts WHERE operation=?").get(fault.P0_ROLLBACK_OPERATION).c, 0);
});

test("test-only entrypoint cannot drift into the approved production entrypoint", () => {
  const qaEntry = fs.readFileSync(path.join(__dirname, "../workers/qa/p0-rollback-entry.js"), "utf8");
  const productionEntry = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api-entry.js"), "utf8");
  assert.match(qaEntry, /import approvedWorker from "\.\.\/thornie-dungeons-api-entry\.js"/);
  assert.match(qaEntry, /P0_ROLLBACK_TEST_KEY/);
  assert.match(qaEntry, /configuredFaultScope/);
  assert.doesNotMatch(qaEntry, /scheduled\s*\(/);
  assert.doesNotMatch(productionEntry, /P0_ROLLBACK|p0-rollback|qa_fault/i);
});
