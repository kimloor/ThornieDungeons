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
  async run() {\n    const normalized = this.sql.trim().toUpperCase();\n    if (/^(SELECT|WITH|PRAGMA)\\b/.test(normalized)) return { results: this.raw.prepare(this.sql).all(...this.values) };\n    const result = this.raw.prepare(this.sql).run(...this.values);\n    return { meta: { changes: Number(result.changes) } };\n  }
}
class D1 {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Statement(this.raw, sql); }
  async batch(statements) { const out = []; for (const statement of statements) out.push(await statement.run()); return out; }
}

function worker(runtimeConsole = console) {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console: runtimeConsole, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox); vm.runInContext(source, sandbox); return sandbox.__worker;
}

function productionDungeonRuntime() {
  const sandbox = { console, Math, Date, crypto, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  for (const file of [
    "src/data/constants.js",
    "src/systems/pets.js",
    "src/systems/floorModifier.js",
    "src/systems/dungeonV2.js",
    "src/systems/stats.js",
    "src/systems/battleCore.js"
  ]) {
    const source = fs.readFileSync(path.resolve(__dirname, "..", file), "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  }
  // The production build installs this presentation patch after App.js. Its
  // makeEncounter wrapper must preserve the serverContext options used by a
  // fresh authoritative Dungeon battle.
  vm.runInContext(`
    async function cloudGetBattleState() { return { ok: true, checkpoint: null }; }
    async function cloudCompleteBattle() { return { ok: true }; }
    async function cloudClearBattleCheckpoint() { return { ok: true }; }
  `, sandbox);
  vm.runInContext(
    fs.readFileSync(path.resolve(__dirname, "..", "src/ui/resumePreviewPatch.js"), "utf8"),
    sandbox,
    { filename: "src/ui/resumePreviewPatch.js" }
  );
  vm.runInContext("globalThis.__makeEncounter = makeEncounter;", sandbox);
  return vm.runInContext(`({ makeEncounter: __makeEncounter, dungeon: DUNGEON_V2, battle: BATTLE_CORE_V1 })`, sandbox);
}

function assertAuthoritativeEnemyIdentity(checkpoint, context, label) {
  const expected = context.enemies.map(enemy => String(enemy.instanceId));
  assert.deepEqual(Array.from(checkpoint.enemyIds, String), expected, `${label}: checkpoint enemyIds`);
  for (const instanceId of expected) {
    assert.ok(checkpoint.units[instanceId], `${label}: unit map contains ${instanceId}`);
    assert.equal(String(checkpoint.units[instanceId].id), instanceId, `${label}: unit.id preserves instanceId`);
  }
  const enemyUnitKeys = Object.keys(checkpoint.units)
    .filter(id => checkpoint.units[id]?.side === "enemy")
    .sort();
  assert.deepEqual(enemyUnitKeys, [...expected].sort(), `${label}: enemy unit keys`);
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
  const url = `https://api.test?${new URLSearchParams(params)}`;
  const response = await api.fetch(new Request(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }), { DB: db });
  return { status: response.status, body: await response.json() };
}
async function startDungeon(api, db, token, characterId, floor) {
  return post(api, db, token, { action: "startDungeonBattle", characterId, floor });
}
function checkpointForStart(started, safeActionSeq = 1) {
  const context = started.body.context;
  return {
    version: 1,
    battleId: started.body.battleId,
    mode: "dungeon",
    floor: context.floor,
    encounterType: context.role,
    safeActionSeq,
    serverContext: context,
    enemyIds: context.enemies.map(enemy => enemy.instanceId),
    units: Object.fromEntries(context.enemies.map(enemy => [enemy.instanceId, {
      id: enemy.instanceId,
      kind: enemy.kind,
      side: "enemy",
      isBoss: enemy.isBoss,
      monsterDefId: enemy.id,
      encounterType: context.role,
      modifier: enemy.modifierId ? { id: enemy.modifierId } : null
    }]))
  };
}
// Mirrors the canonical runtime checkpoint shape at the server-validation boundary.
// Mirrors the checkpoint fields the current Battle Core persistence boundary guarantees.
function battleCoreLikeCheckpointForStart(started, safeActionSeq = 0, options = {}) {
  const context = started.body.context;
  const omitDefinitionAlias = options.omitDefinitionAlias === true;
  const units = {
    hero: {
      id: "hero", kind: "hero", side: "ally", hp: 100, maxHp: 100,
      sp: 20, maxSp: 20, atk: 10, def: 5, speed: 10, statuses: {}, cooldowns: {}, skills: {}, flags: {}
    }
  };
  for (const enemy of context.enemies) {
    units[enemy.instanceId] = {
      id: enemy.instanceId,
      kind: enemy.kind,
      side: "enemy",
      isBoss: enemy.isBoss,
      encounterType: context.role,
      hp: 100,
      maxHp: 100,
      atk: 8,
      def: 3,
      speed: 5,
      statuses: {},
      cooldowns: {},
      skills: {},
      flags: {},
      ...(omitDefinitionAlias ? {} : { monsterDefId: enemy.id })
    };
  }
  return {
    version: 1,
    battleId: started.body.battleId,
    mode: "dungeon",
    floor: context.floor,
    round: 1,
    queue: ["hero", ...context.enemies.map(enemy => enemy.instanceId)],
    queueIndex: 0,
    speedSnapshot: {},
    teamIds: ["ally", "enemy"],
    teams: {
      ally: { id: "ally", unitIds: ["hero"] },
      enemy: { id: "enemy", unitIds: context.enemies.map(enemy => enemy.instanceId) }
    },
    controlledSide: "ally",
    units,
    heroId: "hero",
    petId: null,
    enemyIds: context.enemies.map(enemy => enemy.instanceId),
    selectedTargetId: context.enemies[0].instanceId,
    heroTurnCount: 0,
    resources: {},
    flags: { auto: false, skipResolving: false, heroReviveNextFloor: false, fled: false },
    result: null,
    safeActionSeq,
    logSeq: 1,
    rngState: context.encounterSeed,
    log: [],
    serverContext: context
  };
}

function rewardForContext(context) {
  const floor = context.floor;
  const baseXp = Math.round(6 + floor * 2.4);
  const baseGold = floor <= 30 ? 20 + 3 * floor : floor <= 50 ? 120 + 4 * (floor - 31) : floor <= 70 ? 210 + 5 * (floor - 51) : floor <= 90 ? 320 + 7 * (floor - 71) : 480 + 10 * (floor - 91);
  const roleMultiplier = context.role === "chapter_boss" ? 2 : context.role === "elite" ? 1.5 : 1;
  const packMultiplier = context.role === "normal" ? ({ 1: 1, 2: 1.35, 3: 1.65 })[context.packCount] : 1;
  return {
    floor,
    encounterType: context.role,
    rewardRole: context.role,
    packCount: context.packCount,
    gold: Math.round(baseGold * roleMultiplier * packMultiplier),
    xp: Math.round(baseXp * roleMultiplier * packMultiplier),
    diamonds: 0,
    items: []
  };
}
function bossStoneIdForContext(context) {
  return ({ moss_king: "earthStone", ember_drake: "fireStone", frost_warden: "waterStone" })[context?.enemies?.[0]?.id] || null;
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

test("Dungeon battle start is the trust root for floor eligibility and old-floor replay", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Start_Trust_QA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Start Trust" });
  const characterId = created.body.character.character_id;

  assert.equal((await startDungeon(api, db, token, characterId, 100)).body.error, "dungeon_floor_locked");
  assert.equal((await startDungeon(api, db, token, characterId, 10)).body.error, "dungeon_floor_locked");
  const forgedBoss = {
    battleId: "client-forged-f100", mode: "dungeon", floor: 100, encounterType: "chapter_boss", safeActionSeq: 1,
    enemyIds: ["forged-boss"],
    units: { "forged-boss": { id: "forged-boss", kind: "boss", side: "enemy", monsterDefId: "moss_king", encounterType: "chapter_boss" } }
  };
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: forgedBoss.battleId, checkpointSeq: 1, payload: forgedBoss })).body.error, "dungeon_battle_not_authorized");
  const forgedF10 = { ...forgedBoss, battleId: "client-forged-f10", floor: 10 };
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: forgedF10.battleId, checkpointSeq: 1, payload: forgedF10 })).body.error, "dungeon_battle_not_authorized");
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_checkpoints WHERE character_id = ?").get(characterId).c, 0);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE character_id = ?").get(characterId).c, 0);

  db.raw.prepare("UPDATE characters SET unlocked_floor = 50 WHERE character_id = ?").run(characterId);
  const oldFloor = await startDungeon(api, db, token, characterId, 20);
  assert.equal(oldFloor.body.ok, true);
  assert.equal(oldFloor.body.context.floor, 20);
  assert.equal(oldFloor.body.context.role, "chapter_boss");
  assert.match(oldFloor.body.battleId, /^dungeon-/);
  assert.equal((await get(api, db, token, { action: "getBattleState", characterId })).body.checkpoint, null);
  const premature = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: oldFloor.body.battleId,
    result: { result: "victory", safeActionSeq: 1, floor: 20, reward: rewardForContext(oldFloor.body.context) }
  });
  assert.equal(premature.body.error, "battle_checkpoint_missing");
});

test("Dungeon checkpoint validator accepts canonical runtime identity without optional definition aliases", async () => {
  const warnings = [];
  const runtimeConsole = { ...console, warn: (...args) => warnings.push(args) };
  const api = worker(runtimeConsole), db = database();
  const registration = await post(api, db, "", { action: "register", id: "ChkRuntimeQA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Checkpoint Runtime" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 110 WHERE character_id = ?").run(characterId);

  const scenarios = [
    { floor: 6, label: "normal" },
    { floor: 5, label: "elite" },
    { floor: 10, label: "chapter boss" }
  ];

  for (const scenario of scenarios) {
    const started = await startDungeon(api, db, token, characterId, scenario.floor);
    assert.equal(started.body.ok, true, scenario.label);

    const fresh = battleCoreLikeCheckpointForStart(started, 0, { omitDefinitionAlias: true });
    const first = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 0, payload: fresh
    });
    assert.equal(first.status, 200, scenario.label);
    assert.equal(first.body.accepted, true, scenario.label);

    const later = { ...fresh, safeActionSeq: 1, queueIndex: 1 };
    const second = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: later
    });
    assert.equal(second.status, 200, scenario.label);
    assert.equal(second.body.accepted, true, scenario.label);

    const restored = await get(api, db, token, { action: "getBattleState", characterId });
    assert.equal(restored.body.checkpoint.payload.safeActionSeq, 1, scenario.label);
    const resumed = { ...restored.body.checkpoint.payload, safeActionSeq: 2, queueIndex: 0 };
    const resumeSave = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 2, payload: resumed
    });
    assert.equal(resumeSave.status, 200, scenario.label);
    assert.equal(resumeSave.body.accepted, true, scenario.label);

    const expectedEnemy = started.body.context.enemies[0];
    const forgedDefinition = {
      ...resumed,
      safeActionSeq: 3,
      units: {
        ...resumed.units,
        [expectedEnemy.instanceId]: {
          ...resumed.units[expectedEnemy.instanceId],
          monsterDefId: expectedEnemy.id === "jelly_slime" ? "spore_cap" : "jelly_slime"
        }
      }
    };
    const rejectedDefinition = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 3, payload: forgedDefinition
    });
    assert.equal(rejectedDefinition.status, 400, scenario.label);
    assert.equal(rejectedDefinition.body.error, "invalid_dungeon_checkpoint", scenario.label);

    const forgedInstance = {
      ...resumed,
      safeActionSeq: 3,
      // Reproduce the Production identity class exactly: a definition/client ID
      // occupies enemyIds where only the server-issued instanceId is authorized.
      enemyIds: resumed.enemyIds.map((id, index) => index === 0 ? expectedEnemy.id : id)
    };
    const rejectedInstance = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 3, payload: forgedInstance
    });
    assert.equal(rejectedInstance.status, 400, scenario.label);
    assert.equal(rejectedInstance.body.error, "invalid_dungeon_checkpoint", scenario.label);
    const diagnostic = warnings
      .filter(args => args[0] === "[battle-checkpoint-invalid]")
      .map(args => JSON.parse(args[1]))
      .at(-1);
    assert.equal(diagnostic?.reason, "enemy_id_not_authorized", scenario.label);

    await post(api, db, token, { action: "clearBattleCheckpoint", characterId, battleId: started.body.battleId });
  }
});

test("real App encounter and Battle Core checkpoint matches Worker authorization", async () => {
  const api = worker(), db = database();
  const runtime = productionDungeonRuntime();
  const registration = await post(api, db, "", { action: "register", id: "ChkRuntimeQA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Runtime QA" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 110 WHERE character_id = ?").run(characterId);

  const scenarios = [1, 5, 10].map(floor => ({ floor, label: `floor ${floor}` }));
  let multi = null;
  let modifier = null;
  for (let floor = 6; floor <= 109 && (!multi || !modifier); floor += 1) {
    if (floor % 5 === 0) continue;
    const candidate = await startDungeon(api, db, token, characterId, floor);
    const context = candidate.body.context;
    if (!multi && context.role === "normal" && context.packCount > 1) multi = { floor, label: "normal multi" };
    if (!modifier && context.enemies.some(enemy => enemy.modifierId)) modifier = { floor, label: "modifier" };
    await post(api, db, token, { action: "clearBattleCheckpoint", characterId, battleId: candidate.body.battleId });
  }
  assert.ok(multi, "expected a real normal multi-enemy encounter");
  assert.ok(modifier, "expected a real modifier encounter");
  scenarios.push(multi, modifier);

  for (const scenario of scenarios) {
    const floor = scenario.floor;
    const started = await startDungeon(api, db, token, characterId, floor);
    assert.equal(started.body.ok, true, `start ${scenario.label}`);
    const context = started.body.context;
    const spawned = runtime.makeEncounter(floor, { serverContext: context });
    const enemies = spawned.map((monster, index) => runtime.dungeon.toDungeonV2BattleEnemy(monster, index));
    const state = runtime.battle.createDungeonBattle({
      battleId: started.body.battleId,
      floor,
      mode: "dungeon",
      seed: context.encounterSeed,
      hero: { id: "hero", kind: "hero", side: "ally", hp: 100, maxHp: 100, sp: 20, maxSp: 20, atk: 10, def: 5, speed: 10 },
      enemies
    });
    state.serverContext = context;
    // App persists this exact boundary: battleCheckpointWithoutLog() makes a
    // shallow snapshot and the persistence queue/cloudSaveSnapshot forwards it
    // without going through Battle Core's optional JSON serializer.
    const payload = { ...state, log: [] };
    assertAuthoritativeEnemyIdentity(payload, context, `${scenario.label} fresh`);
    // Deliberately do not inject a top-level encounterType. The Worker contract
    // treats that presentation alias as optional; this proves its absence is
    // not the source of invalid_dungeon_checkpoint.
    assert.equal(payload.encounterType, undefined, `${scenario.label}: no synthetic encounterType`);
    const serverEnemies = context.enemies.map(enemy => ({
      id: enemy.id,
      instanceId: enemy.instanceId,
      modifierId: enemy.modifierId
    }));
    const firstMismatch = [
      ["mode", payload.mode, "dungeon"],
      ["floor", payload.floor, context.floor],
      ["serverContext", JSON.stringify(payload.serverContext), JSON.stringify(context)],
      ["serverContext.enemies", JSON.stringify(serverEnemies), JSON.stringify(context.enemies.map(enemy => ({ id: enemy.id, instanceId: enemy.instanceId, modifierId: enemy.modifierId })))],
      ["serverContext.packCount", payload.serverContext?.packCount, context.packCount],
      ["enemyIds", JSON.stringify(payload.enemyIds), JSON.stringify(context.enemies.map(enemy => enemy.instanceId))],
      ["unitKeys", JSON.stringify(Object.keys(payload.units).filter(id => payload.units[id].side === "enemy").sort()), JSON.stringify(context.enemies.map(enemy => enemy.instanceId).sort())],
      ...context.enemies.map(enemy => {
        const unit = payload.units[enemy.instanceId];
        return [`enemy:${enemy.instanceId}`, unit && JSON.stringify({ id: unit.id, kind: unit.kind, side: unit.side, isBoss: unit.isBoss, monsterDefId: unit.monsterDefId, dungeonV2ProfileId: unit.dungeonV2ProfileId }), JSON.stringify({ id: enemy.instanceId, kind: enemy.kind, side: "enemy", isBoss: enemy.isBoss, monsterDefId: enemy.id, dungeonV2ProfileId: enemy.id })];
      })
    ].find(([, actual, expected]) => actual !== expected);
    assert.equal(firstMismatch, undefined, `first runtime mismatch ${scenario.label}: ${JSON.stringify(firstMismatch)}`);
    const saved = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId,
      checkpointSeq: payload.safeActionSeq, payload
    });
    assert.equal(saved.body.accepted, true, `real runtime checkpoint ${scenario.label}: ${JSON.stringify({ payload, context, response: saved.body })}`);

    const action = runtime.battle.battleStep(state, {
      type: "basic",
      targetId: state.enemyIds[0]
    });
    const laterPayload = { ...action.state, log: [] };
    assertAuthoritativeEnemyIdentity(laterPayload, context, `${scenario.label} after action`);
    const laterSaved = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId,
      checkpointSeq: laterPayload.safeActionSeq, payload: laterPayload
    });
    assert.equal(laterSaved.body.accepted, true, `later real runtime checkpoint ${scenario.label}`);

    const restored = await get(api, db, token, { action: "getBattleState", characterId });
    const resumed = runtime.battle.restoreCheckpoint(restored.body.checkpoint.payload);
    const resumedPayload = { ...resumed, log: [] };
    assertAuthoritativeEnemyIdentity(resumedPayload, context, `${scenario.label} restored`);
    const resumedSaved = await post(api, db, token, {
      action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId,
      checkpointSeq: resumedPayload.safeActionSeq + 1,
      payload: { ...resumedPayload, safeActionSeq: resumedPayload.safeActionSeq + 1 }
    });
    assert.equal(resumedSaved.body.accepted, true, `resume real runtime checkpoint ${scenario.label}`);
    await post(api, db, token, { action: "clearBattleCheckpoint", characterId, battleId: started.body.battleId });
  }
});

test("Dungeon checkpoint validator accepts a canonical normal multi-enemy pack with exact instance mapping", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "ChkMultiQA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Checkpoint Multi" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 110 WHERE character_id = ?").run(characterId);

  let started = null;
  for (let floor = 6; floor <= 109; floor += 1) {
    if (floor % 5 === 0) continue;
    const candidate = await startDungeon(api, db, token, characterId, floor);
    if (candidate.body.context.role === "normal" && candidate.body.context.packCount > 1) {
      started = candidate;
      break;
    }
    await post(api, db, token, { action: "clearBattleCheckpoint", characterId, battleId: candidate.body.battleId });
  }
  assert.ok(started, "expected deterministic server generator to produce a multi-enemy normal pack");

  const checkpoint = battleCoreLikeCheckpointForStart(started, 0, { omitDefinitionAlias: true });
  assert.equal(checkpoint.enemyIds.length, started.body.context.packCount);
  assert.deepEqual(
    new Set(checkpoint.enemyIds),
    new Set(started.body.context.enemies.map(enemy => enemy.instanceId))
  );

  const saved = await post(api, db, token, {
    action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 0, payload: checkpoint
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accepted, true);

  const forgedUnits = { ...checkpoint.units };
  const first = started.body.context.enemies[0];
  const second = started.body.context.enemies[1];
  forgedUnits[first.instanceId] = { ...forgedUnits[first.instanceId], id: second.instanceId };
  const forged = {
    ...checkpoint,
    safeActionSeq: 1,
    units: forgedUnits
  };
  const denied = await post(api, db, token, {
    action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: forged
  });
  assert.equal(denied.status, 400);
  assert.equal(denied.body.error, "invalid_dungeon_checkpoint");
});

test("Dungeon checkpoint validator accepts server-issued modifier encounters without trusting client modifier identity", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "ChkModifierQA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Checkpoint Modifier" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 110 WHERE character_id = ?").run(characterId);

  let started = null;
  for (let floor = 6; floor <= 109; floor += 1) {
    if (floor % 5 === 0) continue;
    const candidate = await startDungeon(api, db, token, characterId, floor);
    if (candidate.body.context.enemies.some(enemy => enemy.modifierId)) {
      started = candidate;
      break;
    }
    await post(api, db, token, { action: "clearBattleCheckpoint", characterId, battleId: candidate.body.battleId });
  }
  assert.ok(started, "expected deterministic server generator to produce a modifier encounter");

  const checkpoint = battleCoreLikeCheckpointForStart(started, 0, { omitDefinitionAlias: true });
  const saved = await post(api, db, token, {
    action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 0, payload: checkpoint
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accepted, true);

  const forgedFloor = { ...checkpoint, safeActionSeq: 1, floor: checkpoint.floor + 1 };
  const floorDenied = await post(api, db, token, {
    action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: forgedFloor
  });
  assert.equal(floorDenied.status, 400);
  assert.equal(floorDenied.body.error, "invalid_dungeon_checkpoint");

  const forgedContext = {
    ...checkpoint,
    safeActionSeq: 1,
    serverContext: { ...checkpoint.serverContext, rewardSeed: (checkpoint.serverContext.rewardSeed + 1) >>> 0 || 1 }
  };
  const contextDenied = await post(api, db, token, {
    action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: forgedContext
  });
  assert.ok([400, 409].includes(contextDenied.status));
  assert.ok(["invalid_dungeon_checkpoint", "checkpoint_context_conflict"].includes(contextDenied.body.error));
});

test("Dungeon checkpoints cannot alter server-issued context but mutable state remains saveable", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Context_Trust_QA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Context Trust" });
  const characterId = created.body.character.character_id;
  const started = await startDungeon(api, db, token, characterId, 1);
  const legitimate = checkpointForStart(started);
  const enemyId = legitimate.enemyIds[0];

  const firstForgeries = [
    { ...legitimate, floor: 100, encounterType: "chapter_boss" },
    { ...legitimate, encounterType: "chapter_boss", units: { ...legitimate.units, [enemyId]: { ...legitimate.units[enemyId], kind: "boss", isBoss: true, encounterType: "chapter_boss", monsterDefId: "moss_king" } } },
    { ...legitimate, enemyIds: [...legitimate.enemyIds, "forged-pack"], units: { ...legitimate.units, "forged-pack": { id: "forged-pack", kind: "monster", side: "enemy", monsterDefId: "spore_cap", encounterType: "normal" } } },
    { ...legitimate, units: { ...legitimate.units, [enemyId]: { ...legitimate.units[enemyId], monsterDefId: legitimate.units[enemyId].monsterDefId === "jelly_slime" ? "spore_cap" : "jelly_slime" } } }
  ];
  for (const forged of firstForgeries) {
    const response = await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: forged });
    assert.ok([400, 409].includes(response.status));
  }
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: legitimate })).body.accepted, true);

  for (const forged of firstForgeries) {
    const response = await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 2, payload: { ...forged, safeActionSeq: 2 } });
    assert.ok([400, 409].includes(response.status));
  }
  const mutable = { ...legitimate, safeActionSeq: 2, units: { ...legitimate.units, hero: { id: "hero", kind: "hero", side: "ally", hp: 17 } } };
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 2, payload: mutable })).body.accepted, true);
});

test("server-authorized encounter generation covers normal packs, Elite, Boss, and stable restart seeds", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Encounter_Trust_QA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Encounter Trust" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 110 WHERE character_id = ?").run(characterId);
  const packs = new Set();
  for (let floor = 6; floor <= 109 && packs.size < 3; floor++) {
    if (floor % 5 === 0) continue;
    const started = await startDungeon(api, db, token, characterId, floor);
    packs.add(started.body.context.packCount);
    const repeated = await startDungeon(api, db, token, characterId, floor);
    assert.equal(repeated.body.battleId, started.body.battleId);
    assert.deepEqual(repeated.body.context, started.body.context);
    await post(api, db, token, { action: "clearBattleCheckpoint", characterId, battleId: started.body.battleId });
  }
  assert.deepEqual([...packs].sort(), [1, 2, 3]);
  const elite = await startDungeon(api, db, token, characterId, 5);
  assert.deepEqual({ role: elite.body.context.role, pack: elite.body.context.packCount }, { role: "elite", pack: 1 });
  await post(api, db, token, { action: "clearBattleCheckpoint", characterId, battleId: elite.body.battleId });
  const boss = await startDungeon(api, db, token, characterId, 10);
  assert.deepEqual({ role: boss.body.context.role, pack: boss.body.context.packCount }, { role: "chapter_boss", pack: 1 });
});

test("Dungeon authorization survives checkpoint reload and completes without reroll", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Resume_Trust_QA", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Resume Trust" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 8 WHERE character_id = ?").run(characterId);
  const started = await startDungeon(api, db, token, characterId, 6);
  const checkpoint = checkpointForStart(started);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: checkpoint })).body.accepted, true);
  const restored = await get(api, db, token, { action: "getBattleState", characterId });
  assert.equal(restored.body.checkpoint.battleId, started.body.battleId);
  assert.deepEqual(restored.body.checkpoint.payload.serverContext, started.body.context);
  assert.deepEqual(restored.body.checkpoint.payload.enemyIds, checkpoint.enemyIds);
  const nextCheckpoint = { ...restored.body.checkpoint.payload, safeActionSeq: 2, round: 2 };
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 2, payload: nextCheckpoint })).body.accepted, true);
  const completion = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", safeActionSeq: 3, floor: 6, reward: rewardForContext(started.body.context) }
  });
  assert.equal(completion.body.firstCompletion, true);
  const replay = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", safeActionSeq: 3, floor: 6, reward: rewardForContext(started.body.context) }
  });
  assert.equal(replay.body.firstCompletion, false);
  assert.deepEqual(replay.body.result.reward, completion.body.result.reward);
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
  const startedF10 = await startDungeon(api, db, token, characterId, 10);
  const firstCheckpoint = checkpointForStart(startedF10);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: startedF10.body.battleId, checkpointSeq: 1, payload: firstCheckpoint })).body.accepted, true);
  const first = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: startedF10.body.battleId,
    result: { result: "victory", safeActionSeq: 2, floor: 10, reward: { ...rewardForContext(startedF10.body.context), unlockedNext: true, firstClear: true, items: [accessory] } }
  });
  assert.equal(first.body.ok, true);
  assert.equal(first.body.firstCompletion, true);
  const storedAccessory = db.raw.prepare("SELECT item_id, player_id, character_id, extra_json FROM items WHERE character_id = ? AND slot_type = 'accessory'").get(characterId);
  assert.ok(storedAccessory);
  assert.equal(storedAccessory.player_id, "Reward_QA_1");
  assert.equal(storedAccessory.character_id, characterId);
  const storedAccessoryExtra = JSON.parse(storedAccessory.extra_json);
  const expectedSourceIdentity = startedF10.body.context.enemies[0].id;
  assert.equal(storedAccessoryExtra.sourceType, "dungeon_boss_first_clear");
  assert.equal(storedAccessoryExtra.sourceIdentity, expectedSourceIdentity);
  assert.equal(storedAccessoryExtra.overflow, false);
  const provenance = db.raw.prepare("SELECT original_player_id, original_character_id, origin_type, origin_source_id FROM item_provenance WHERE item_id = ?").get(storedAccessory.item_id);
  assert.equal(provenance.original_player_id, "Reward_QA_1");
  assert.equal(provenance.original_character_id, characterId);
  assert.equal(provenance.origin_type, "dungeon_boss_first_clear");
  assert.equal(provenance.origin_source_id, expectedSourceIdentity);
  const bossStoneId = bossStoneIdForContext(startedF10.body.context);
  const bossStone = db.raw.prepare("SELECT extra_json FROM items WHERE character_id = ? AND json_extract(extra_json, '$.junkId') = ?").get(characterId, bossStoneId);
  assert.ok(bossStone);
  assert.ok([1, 2].includes(JSON.parse(bossStone.extra_json).quantity));
  const before = db.raw.prepare("SELECT gold, xp, pets_json FROM characters WHERE character_id = ?").get(characterId);
  assert.equal(JSON.parse(before.pets_json).firstClearAccessoryClaims["10"], true);

  for (let i = 0; i < 129; i++) {
    const seq = 10 + i * 2;
    const started = await startDungeon(api, db, token, characterId, 11);
    const battleId = started.body.battleId;
    const cp = checkpointForStart(started, seq);
    assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId, checkpointSeq: seq, payload: cp })).body.accepted, true);
    const later = await post(api, db, token, {
      action: "completeBattle", characterId, battleId,
      result: { result: "victory", safeActionSeq: seq + 1, floor: 11, reward: { ...rewardForContext(started.body.context), unlockedNext: false, firstClear: false } }
    });
    assert.equal(later.body.firstCompletion, true);
  }
  const after = db.raw.prepare("SELECT gold, xp, pets_json FROM characters WHERE character_id = ?").get(characterId);
  assert.equal(JSON.parse(after.pets_json).firstClearAccessoryClaims["10"], true);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ? AND slot_type = 'accessory'").get(characterId).c, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ? AND json_extract(extra_json, '$.junkId') = ?").get(characterId, bossStoneId).c, 1);
  const replay = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: startedF10.body.battleId,
    result: { result: "victory", safeActionSeq: 2, floor: 10, reward: { ...rewardForContext(startedF10.body.context), unlockedNext: true, firstClear: true, items: [accessory] } }
  });
  assert.equal(replay.body.firstCompletion, false);
  const final = db.raw.prepare("SELECT gold, xp, pets_json FROM characters WHERE character_id = ?").get(characterId);
  assert.deepEqual({ gold: final.gold, xp: final.xp }, { gold: after.gold, xp: after.xp });
  assert.equal(JSON.parse(final.pets_json).firstClearAccessoryClaims["10"], true);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ? AND slot_type = 'accessory'").get(characterId).c, 1);
});

test("F5 starter Pet remains an exact-once entitlement in the atomic reward boundary", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_F5", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "F5 QA" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 5 WHERE character_id = ?").run(characterId);
  const activePet = { instId: "active-flamekit", defId: "flamekit", level: 1, xp: 0, star: 1, stats: { str: 5, vit: 3, agi: 4, dex: 4, luk: 4 } };
  db.raw.prepare("UPDATE characters SET pets_json = ?, active_pet_id = ? WHERE character_id = ?")
    .run(JSON.stringify({ list: [activePet], dup: {}, skills: {}, skillVersion: 1 }), activePet.instId, characterId);
  const starter = { instId: "starter-qa", defId: "sprout", level: 1, star: 1, exp: 0, stats: { str: 3, vit: 5, agi: 4, dex: 4, luk: 4 } };
  const reward = {
    floor: 5, encounterType: "elite", rewardRole: "elite", packCount: 1,
    gold: 53, xp: 27, diamonds: 0, unlockedNext: true, firstClear: false, items: [],
    starterPetGrant: { defId: "sprout", instance: starter }
  };
  const started = await startDungeon(api, db, token, characterId, 5);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: checkpointForStart(started) })).body.accepted, true);
  const first = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory", safeActionSeq: 2, floor: 5, reward: { ...reward, ...rewardForContext(started.body.context), starterPetGrant: reward.starterPetGrant } } });
  assert.equal(first.body.firstCompletion, true);
  const petsAfterFirst = JSON.parse(db.raw.prepare("SELECT pets_json FROM characters WHERE character_id = ?").get(characterId).pets_json).list;
  assert.equal(petsAfterFirst.filter(pet => pet.defId === "sprout").length, 1);
  assert.deepEqual(petsAfterFirst.find(pet => pet.defId === "sprout"), {
    instId: petsAfterFirst.find(pet => pet.defId === "sprout").instId,
    defId: "sprout", level: 1, xp: 0, star: 1,
    stats: { str: 3, vit: 5, agi: 4, dex: 4, luk: 4 }
  });
  assert.equal(petsAfterFirst.find(pet => pet.instId === activePet.instId).xp, 22);
  assert.equal(first.body.result.reward.petProgress.xpGained, 22);
  const replay = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory", safeActionSeq: 2, floor: 5, reward: { ...reward, ...rewardForContext(started.body.context), starterPetGrant: reward.starterPetGrant } } });
  assert.equal(replay.body.firstCompletion, false);
  const petsAfterReplay = JSON.parse(db.raw.prepare("SELECT pets_json FROM characters WHERE character_id = ?").get(characterId).pets_json).list;
  assert.equal(petsAfterReplay.filter(pet => pet.defId === "sprout").length, 1);
  assert.equal(petsAfterReplay.find(pet => pet.instId === activePet.instId).xp, 22);
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
  db.raw.prepare("UPDATE characters SET unlocked_floor = 10 WHERE character_id = ?").run(characterId);
  const forgedItem = { id: "v2-overflow-forged", type: "accessory", rarity: "rare", name: "Forged", gearTier: 5, critChance: 999999, dodgeChance: 999999, critDamage: 999999, rewardVersion: 2, itemModelVersion: 2, sourceType: "forged", sourceFloor: 999 };
  const started = await startDungeon(api, db, token, characterId, 10);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: checkpointForStart(started) })).body.accepted, true);
  const result = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory", safeActionSeq: 2, floor: 10, reward: { ...rewardForContext(started.body.context), unlockedNext: true, firstClear: true, items: [forgedItem] } } });
  assert.equal(result.body.ok, true);
  const stored = db.raw.prepare("SELECT item_id, player_id, character_id, extra_json FROM items WHERE character_id = ? AND slot_type = 'accessory' ORDER BY created_at DESC LIMIT 1").get(characterId);
  const storedExtra = JSON.parse(stored.extra_json);
  assert.equal(storedExtra.overflow, true);
  assert.equal(storedExtra.sourceFloor, 10);
  const overflowProvenance = db.raw.prepare("SELECT original_player_id, original_character_id, origin_type, origin_source_id FROM item_provenance WHERE item_id = ?").get(stored.item_id);
  assert.equal(stored.player_id, "Reward_QA_OV");
  assert.equal(stored.character_id, characterId);
  assert.equal(overflowProvenance.original_player_id, "Reward_QA_OV");
  assert.equal(overflowProvenance.original_character_id, characterId);
  assert.equal(overflowProvenance.origin_type, "dungeon_boss_first_clear");
  assert.equal(overflowProvenance.origin_source_id, started.body.context.enemies[0].id);
  assert.equal(["critChance", "dodgeChance", "critDamage"].filter(key => Number(storedExtra[key]) > 0).length, 1);
  assert.notEqual(storedExtra.critChance, 999999);
  assert.notEqual(storedExtra.dodgeChance, 999999);
  assert.notEqual(storedExtra.critDamage, 999999);
});

test("Dungeon reward capacity excludes equipped and existing Overflow rows", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_CAP", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Capacity QA" });
  const characterId = created.body.character.character_id;
  for (let i = 0; i < 29; i++) {
    db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, name, rarity, quantity, extra_json) VALUES (?, ?, ?, 'weapon', 'Filler', 'rare', 1, '{}')")
      .run(`capacity-carried-${i}`, "Reward_QA_CAP", characterId);
  }
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, name, rarity, equipped, extra_json) VALUES ('capacity-equipped', ?, ?, 'weapon', 'Equipped', 'rare', 1, '{}')")
    .run("Reward_QA_CAP", characterId);
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, name, rarity, extra_json) VALUES ('capacity-overflow', ?, ?, 'weapon', 'Overflow', 'rare', ?)")
    .run("Reward_QA_CAP", characterId, JSON.stringify({ overflow: true }));
  db.raw.prepare("UPDATE characters SET unlocked_floor = 10 WHERE character_id = ?").run(characterId);
  const started = await startDungeon(api, db, token, characterId, 10);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: checkpointForStart(started) })).body.accepted, true);
  const result = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", safeActionSeq: 2, floor: 10, reward: { ...rewardForContext(started.body.context), unlockedNext: true, firstClear: true, items: [
      { id: "capacity-reward", type: "accessory", rarity: "rare", name: "Capacity Reward", rewardVersion: 2, itemModelVersion: 2 },
      { type: "junk", junkId: "forged-capacity", quantity: 1 }
    ] } } });
  assert.equal(result.body.ok, true);
  const carried = db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ? AND equipped = 0 AND COALESCE(json_extract(extra_json, '$.overflow'), 0) != 1").get(characterId).c;
  assert.equal(carried, 30);
  const newRewards = db.raw.prepare("SELECT extra_json FROM items WHERE character_id = ? AND item_id NOT LIKE 'capacity-%'").all(characterId);
  assert.ok(newRewards.some(row => JSON.parse(row.extra_json).overflow === false));
});

test("Dungeon V2 reward authority rejects forged floor, role, and pack context", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_CTX", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Context QA" });
  const characterId = created.body.character.character_id;
  const started = await startDungeon(api, db, token, characterId, 1);
  const checkpoint = checkpointForStart(started);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: checkpoint })).body.accepted, true);
  const complete = (reward, resultFloor = 1) => post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", safeActionSeq: 2, floor: resultFloor, reward }
  });
  assert.equal((await complete({ floor: 100, encounterType: "chapter_boss", rewardRole: "chapter_boss", packCount: 1, gold: 1000, xp: 1000, diamonds: 0, items: [] }, 100)).body.error, "invalid_battle_context");
  assert.equal((await complete({ floor: 1, encounterType: "elite", rewardRole: "elite", packCount: 1, gold: 35, xp: 12, diamonds: 0, items: [] })).body.error, "invalid_reward_context");
  assert.equal((await complete({ floor: 1, encounterType: "chapter_boss", rewardRole: "chapter_boss", packCount: 1, gold: 46, xp: 16, diamonds: 0, items: [] })).body.error, "invalid_reward_context");
  assert.equal((await complete({ floor: 1, encounterType: "normal", rewardRole: "normal", packCount: 3, gold: 38, xp: 13, diamonds: 0, items: [] })).body.error, "invalid_reward_context");
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE battle_id = ?").get(started.body.battleId).c, 0);
});

test("Dungeon V2 reward authority rebuilds forged diamonds, equipment, utility, and junk", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_AUTH", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Authority QA" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET unlocked_floor = 10 WHERE character_id = ?").run(characterId);
  const started = await startDungeon(api, db, token, characterId, 10);
  const checkpoint = checkpointForStart(started);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: checkpoint })).body.accepted, true);
  const forged = {
    id: "forged-item", type: "accessory", rarity: "mythic", gearTier: 5,
    atk: 999999, def: 999999, critChance: 999999, dodgeChance: 999999, critDamage: 999999,
    rewardVersion: 2, itemModelVersion: 2, empowerSlotCapacity: 999,
    sourceType: "forged", sourceFloor: 999, specialSource: "forged", sourceIdentity: "forged",
    utilityStat: "critChance"
  };
  const result = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", safeActionSeq: 2, floor: 10, reward: {
      ...rewardForContext(started.body.context), diamonds: 999999, items: [forged, { type: "junk", junkId: "forged", quantity: 999999, source: "forged" }]
    } }
  });
  assert.equal(result.body.ok, true);
  assert.equal(result.body.result.reward.diamonds, 0);
  assert.equal(db.raw.prepare("SELECT diamonds FROM players WHERE id = ?").get("Reward_QA_AUTH").diamonds, 0);
  const item = db.raw.prepare("SELECT * FROM items WHERE character_id = ? AND slot_type = 'accessory'").get(characterId);
  assert.ok(item);
  const extra = JSON.parse(item.extra_json);
  assert.equal(extra.rewardVersion, 2);
  assert.equal(extra.itemModelVersion, 2);
  assert.equal(extra.sourceFloor, 10);
  assert.equal(extra.sourceType, "dungeon_boss_first_clear");
  assert.equal(extra.specialSource, "first_clear_accessory");
  assert.equal(["critChance", "dodgeChance", "critDamage"].filter(key => Number(extra[key]) > 0).length, 1);
  const bossStoneId = bossStoneIdForContext(started.body.context);
  const stone = db.raw.prepare("SELECT extra_json FROM items WHERE character_id = ? AND json_extract(extra_json, '$.junkId') = ?").get(characterId, bossStoneId);
  assert.ok(stone);
  assert.ok([1, 2].includes(JSON.parse(stone.extra_json).quantity));
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ? AND json_extract(extra_json, '$.junkId') = 'forged'").get(characterId).c, 0);
  assert.notEqual(extra.critChance, 999999);
  assert.notEqual(extra.dodgeChance, 999999);
  assert.notEqual(extra.critDamage, 999999);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ? AND extra_json LIKE '%forged%'").get(characterId).c, 0);
});

test("concurrent duplicate Dungeon V2 completions share one atomic reward commit", async () => {
  const api = worker(), db = database();
  const registration = await post(api, db, "", { action: "register", id: "Reward_QA_CONCURRENT", password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: "Concurrent QA" });
  const characterId = created.body.character.character_id;
  const started = await startDungeon(api, db, token, characterId, 1);
  const checkpoint = checkpointForStart(started);
  assert.equal((await post(api, db, token, { action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId, checkpointSeq: 1, payload: checkpoint })).body.accepted, true);
  const body = {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", safeActionSeq: 2, floor: 1, reward: rewardForContext(started.body.context) }
  };
  const results = await Promise.all([post(api, db, token, body), post(api, db, token, body)]);
  assert.equal(results.filter(result => result.body.firstCompletion === true).length, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE battle_id = ?").get(started.body.battleId).c, 1);
  const character = db.raw.prepare("SELECT gold, xp FROM characters WHERE character_id = ?").get(characterId);
  assert.deepEqual({ gold: character.gold, xp: character.xp }, { gold: 23, xp: 8 });
});
