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

function worker(options = {}) {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  if (Object.prototype.hasOwnProperty.call(options, "eventId")) {
    const eventId = options.eventId == null ? "null" : JSON.stringify(String(options.eventId));
    source = source.replace(
      /function dungeonV2ServerRollEventId\(rng = Math\.random\) \{[\s\S]*?\n\}/,
      `function dungeonV2ServerRollEventId(rng = Math.random) { return ${eventId}; }`
    );
  }
  if (Number.isInteger(options.packCount) && options.packCount >= 1 && options.packCount <= 3) {
    source = source.replace(
      /const packCount = role !== "normal" \|\| floor < 5 \? 1 : \(\(\) => \{[\s\S]*?\n  \}\)\(\);/,
      `const packCount = role === "normal" ? ${options.packCount} : 1;`
    );
  }
  const math = Object.create(Math);
  if (typeof options.random === "function") math.random = options.random;
  const sandbox = { console, Math: math, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
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
  assert.ok(token, `registration failed for ${id}: ${JSON.stringify(registration.body)}`);
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: id });
  assert.ok(created.body.character, `character creation failed for ${id}: ${JSON.stringify(created.body)}`);
  return { token, characterId: created.body.character.character_id };
}
async function submit(api, db, token, characterId, battleId, rev, command, actionKey = `action-${rev}-${Math.random()}`) {
  return post(api, db, token, { action: "submitDungeonBattleAction", characterId, battleId, expectedRev: rev, actionKey, command });
}
async function resolveBattle(api, db, token, characterId, started) {
  let state = started.body.state, rev = started.body.stateRev;
  for (let i = 0; i < 500 && !state.result; i += 1) {
    const actor = state.units[state.queue[state.queueIndex]] || Object.values(state.units)
      .filter(unit => !unit.dead && unit.hp > 0)
      .sort((a, b) => Number(b.speed) - Number(a.speed) || a.tieOrder - b.tieOrder || a.id.localeCompare(b.id))[0];
    const enemy = Object.values(state.units).find(unit => unit.side === "enemy" && !unit.dead && unit.hp > 0);
    const command = actor.kind === "hero" ? (state.heroTurnCount >= 5 ? { type: "skip_battle" } : { type: "basic", targetId: enemy.id }) : { type: "advance" };
    const result = await submit(api, db, token, characterId, started.body.battleId, rev, command, `legal-${rev}`);
    assert.equal(result.body.ok, true, JSON.stringify(result.body));
    state = result.body.state; rev = result.body.stateRev;
  }
  return { state, rev };
}
function forceAuthoritativeVictory(db, battleId) {
  const row = db.raw.prepare("SELECT state_rev,state_json FROM battle_authority WHERE battle_id=?").get(battleId);
  assert.ok(row, "authority row exists");
  const state = JSON.parse(row.state_json);
  for (const unit of Object.values(state.units || {})) {
    if (unit.side !== "enemy") continue;
    unit.hp = 0;
    unit.dead = true;
  }
  state.result = "victory";
  const nextRev = Number(row.state_rev) + 1;
  db.raw.prepare("UPDATE battle_authority SET state_rev=?,state_json=?,outcome='victory',updated_at=? WHERE battle_id=?")
    .run(nextRev, JSON.stringify(state), new Date().toISOString(), battleId);
  return { state, rev: nextRev };
}
function carriedCount(db, characterId) {
  return Number(db.raw.prepare(
    "SELECT COUNT(*) AS c FROM items WHERE character_id=? AND equipped=0 AND COALESCE(json_extract(CASE WHEN json_valid(extra_json) THEN extra_json ELSE '{}' END,'$.overflow'),0) NOT IN (1,'1','true')"
  ).get(characterId).c);
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

test("terminal authoritative result survives reload until settlement", async () => {
  const api = worker({ eventId: null }), db = database();
  const { token, characterId } = await account(api, db, "TermResume");
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 1 });
  const terminal = forceAuthoritativeVictory(db, started.body.battleId);

  const reloadedApi = worker({ eventId: null });
  const pending = await get(reloadedApi, db, token, { action: "getBattleState", characterId });
  assert.equal(pending.body.checkpoint.authoritative, true);
  assert.equal(pending.body.checkpoint.payload.result, "victory");
  assert.equal(pending.body.checkpoint.payload.authorityRev, terminal.rev);

  const blockedStart = await post(reloadedApi, db, token, { action: "startDungeonBattle", characterId, floor: 1 });
  assert.equal(blockedStart.status, 409);
  assert.equal(blockedStart.body.error, "battle_settlement_pending");
  assert.equal(db.raw.prepare("SELECT state FROM battle_checkpoints WHERE battle_id=?").get(started.body.battleId).state, "active");

  const completed = await post(reloadedApi, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", floor: 999, reward: { gold: 999999, xp: 999999 } }
  });
  assert.equal(completed.body.firstCompletion, true, JSON.stringify(completed.body));
  assert.ok(db.raw.prepare("SELECT settled_at FROM battle_authority WHERE battle_id=?").get(started.body.battleId).settled_at);
  assert.equal((await get(reloadedApi, db, token, { action: "getBattleState", characterId })).body.checkpoint, null);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE battle_id=?").get(started.body.battleId).c, 1);
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

test("authoritative settlement sends rewards to Overflow and replays without duplicate credit", async () => {
  const api = worker({ eventId: null }), db = database();
  const { token, characterId } = await account(api, db, "Authority_Overflow");
  const playerId = db.raw.prepare("SELECT player_id FROM characters WHERE character_id=?").get(characterId).player_id;
  for (let i = 0; i < 30; i += 1) {
    db.raw.prepare("INSERT INTO items (item_id,player_id,character_id,slot_type,name,rarity,quantity,extra_json) VALUES (?,?,?,'weapon','Filler','rare',1,'{}')")
      .run(`coverage-filler-${i}`, playerId, characterId);
  }
  db.raw.prepare("UPDATE characters SET unlocked_floor=10,str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(characterId);
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 10 });
  assert.equal(started.body.context.role, "chapter_boss");
  forceAuthoritativeVictory(db, started.body.battleId);
  const forged = { result: "victory", floor: 999, reward: { gold: 999999, xp: 999999, diamonds: 999999, items: [{ id: "forged-overflow" }] } };
  const first = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: forged });
  assert.equal(first.body.firstCompletion, true, JSON.stringify(first.body));
  assert.equal(carriedCount(db, characterId), 30);
  const rewards = db.raw.prepare("SELECT item_id,extra_json FROM items WHERE character_id=? AND item_id NOT LIKE 'coverage-filler-%'").all(characterId);
  assert.ok(rewards.length >= 1);
  assert.ok(rewards.every(row => JSON.parse(row.extra_json).overflow === true));
  assert.equal(rewards.some(row => row.item_id === "forged-overflow"), false);
  const beforeReplay = db.raw.prepare("SELECT gold,xp FROM characters WHERE character_id=?").get(characterId);
  const replay = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: forged });
  assert.equal(replay.body.firstCompletion, false);
  assert.deepEqual({ ...db.raw.prepare("SELECT gold,xp FROM characters WHERE character_id=?").get(characterId) }, { ...beforeReplay });
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE battle_id=?").get(started.body.battleId).c, 1);
  assert.ok(db.raw.prepare("SELECT settled_at FROM battle_authority WHERE battle_id=?").get(started.body.battleId).settled_at);
});

test("authoritative F5 settlement preserves claims and grants Starter Pet exactly once", async () => {
  const api = worker({ eventId: null }), db = database();
  const { token, characterId } = await account(api, db, "AuthStarter");
  const activePet = { instId: "active-flamekit", defId: "flamekit", level: 1, xp: 0, star: 1, stats: { str: 5, vit: 3, agi: 4, dex: 4, luk: 4 } };
  const envelope = { list: [activePet], dup: {}, skills: {}, skillVersion: 1, firstClearAccessoryClaims: { "10": true }, battleRewardReceipts: ["battle:historic"] };
  db.raw.prepare("UPDATE characters SET unlocked_floor=5,str=1000,vit=1000,agi=1000,dex=1000,luk=1000,pets_json=?,active_pet_id=? WHERE character_id=?")
    .run(JSON.stringify(envelope), activePet.instId, characterId);
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 5 });
  assert.equal(started.body.context.role, "elite");
  forceAuthoritativeVictory(db, started.body.battleId);
  const forged = { result: "victory", reward: { starterPetGrant: { defId: "forged" }, xp: 999999 } };
  const first = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: forged });
  assert.equal(first.body.firstCompletion, true, JSON.stringify(first.body));
  const stored = db.raw.prepare("SELECT pets_json,active_pet_id FROM characters WHERE character_id=?").get(characterId);
  const pets = JSON.parse(stored.pets_json);
  assert.equal(pets.list.filter(pet => pet.defId === "sprout").length, 1);
  assert.equal(pets.list.some(pet => pet.defId === "forged"), false);
  assert.equal(stored.active_pet_id, activePet.instId);
  assert.equal(pets.firstClearAccessoryClaims["10"], true);
  assert.ok(pets.battleRewardReceipts.includes("battle:historic"));
  const activeXp = pets.list.find(pet => pet.instId === activePet.instId).xp;
  const replay = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: forged });
  assert.equal(replay.body.firstCompletion, false);
  const replayPets = JSON.parse(db.raw.prepare("SELECT pets_json FROM characters WHERE character_id=?").get(characterId).pets_json);
  assert.equal(replayPets.list.filter(pet => pet.defId === "sprout").length, 1);
  assert.equal(replayPets.list.find(pet => pet.instId === activePet.instId).xp, activeXp);
});

test("multi-enemy modifier context remains server-owned through settlement", async () => {
  const api = worker({ eventId: "golden", packCount: 3 }), db = database();
  const { token, characterId } = await account(api, db, "AuthMulti");
  db.raw.prepare("UPDATE characters SET unlocked_floor=6,str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(characterId);
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 6 });
  assert.equal(started.body.context.packCount, 3);
  assert.equal(started.body.context.enemies.length, started.body.context.packCount);
  assert.ok(started.body.context.enemies.every(enemy => enemy.modifierId === "golden"));
  assert.equal(started.body.state.enemyIds.length, started.body.context.packCount);
  assert.deepEqual(Array.from(started.body.state.enemyIds), started.body.context.enemies.map(enemy => enemy.instanceId));
  forceAuthoritativeVictory(db, started.body.battleId);
  const result = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", floor: 999, reward: { packCount: 1, encounterType: "chapter_boss", gold: 999999 } }
  });
  assert.equal(result.body.firstCompletion, true, JSON.stringify(result.body));
  assert.equal(result.body.result.reward.floor, 6);
  assert.equal(result.body.result.reward.rewardRole, "normal");
  assert.equal(result.body.result.reward.packCount, started.body.context.packCount);
  assert.equal(result.body.result.reward.rewardSeed, started.body.context.rewardSeed);
  assert.ok(result.body.result.reward.gold > 0 && result.body.result.reward.gold < 999999);
});

test("settlement rebuilds reward context and ignores every client reward field", async () => {
  const api = worker({ eventId: "arcane" }), db = database();
  const { token, characterId } = await account(api, db, "AuthRewardCtx");
  db.raw.prepare("UPDATE characters SET unlocked_floor=6,str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(characterId);
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 6 });
  assert.ok(started.body.context.enemies.every(enemy => enemy.modifierId === "arcane"));
  forceAuthoritativeVictory(db, started.body.battleId);
  const forged = {
    result: "victory", safeActionSeq: 999999, floor: 999,
    reward: { floor: 999, encounterType: "chapter_boss", rewardRole: "chapter_boss", packCount: 99,
      gold: 999999, xp: 999999, diamonds: 999999, rewardSeed: "forged", sourceIdentity: "forged",
      items: [{ id: "forged-context-item", type: "weapon", atk: 999999 }] }
  };
  const result = await post(api, db, token, { action: "completeBattle", characterId, battleId: started.body.battleId, result: forged });
  assert.equal(result.body.firstCompletion, true, JSON.stringify(result.body));
  const reward = result.body.result.reward;
  assert.deepEqual(
    { floor: reward.floor, role: reward.rewardRole, packCount: reward.packCount, seed: reward.rewardSeed, source: reward.sourceIdentity },
    { floor: started.body.context.floor, role: started.body.context.role, packCount: started.body.context.packCount, seed: started.body.context.rewardSeed, source: started.body.context.enemies[0].id }
  );
  assert.equal(reward.diamonds, 0);
  assert.ok(reward.gold < 999999 && reward.xp < 999999);
  assert.equal(db.raw.prepare("SELECT diamonds FROM players WHERE id=(SELECT player_id FROM characters WHERE character_id=?)").get(characterId).diamonds, 0);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id='forged-context-item'").get().c, 0);
  assert.equal(JSON.parse(db.raw.prepare("SELECT result_json FROM battle_completions WHERE battle_id=?").get(started.body.battleId).result_json).reward.rewardSeed, started.body.context.rewardSeed);
});

test("receipt retention beyond 128 battles cannot bypass durable settlement replay", async () => {
  const api = worker({ eventId: null }), db = database();
  const { token, characterId } = await account(api, db, "Authority_Receipts");
  db.raw.prepare("UPDATE characters SET str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(characterId);
  const battleIds = [];

  for (let i = 0; i < 129; i += 1) {
    const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 1 });
    assert.equal(started.body.authoritative, true, JSON.stringify(started.body));
    battleIds.push(started.body.battleId);
    const terminal = await resolveBattle(api, db, token, characterId, started);
    assert.equal(terminal.state.result, "victory", `battle ${i + 1} did not reach authoritative victory`);
    const completed = await post(api, db, token, {
      action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory" }
    });
    assert.equal(completed.body.firstCompletion, true, `battle ${i + 1}: ${JSON.stringify(completed.body)}`);
  }

  const envelope = JSON.parse(db.raw.prepare("SELECT pets_json FROM characters WHERE character_id=?").get(characterId).pets_json);
  const expectedReceipts = battleIds.slice(-128).map(battleId => `battle:${battleId}`);
  assert.deepEqual(envelope.battleRewardReceipts, expectedReceipts);
  assert.deepEqual(envelope.rewardReceipts, expectedReceipts);
  assert.equal(envelope.battleRewardReceipts.includes(`battle:${battleIds[0]}`), false);
  assert.equal(envelope.battleRewardReceipts.includes(`battle:${battleIds.at(-1)}`), true);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE character_id=?").get(characterId).c, 129);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_checkpoints WHERE character_id=? AND state='completed'").get(characterId).c, 129);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_authority WHERE character_id=? AND outcome='victory' AND settled_at<>''").get(characterId).c, 129);

  const beforeReplay = db.raw.prepare(
    "SELECT level,xp,gold,(SELECT COUNT(*) FROM items WHERE character_id=?) AS item_count FROM characters WHERE character_id=?"
  ).get(characterId, characterId);
  for (const battleId of [battleIds[0], battleIds.at(-1)]) {
    const replay = await post(api, db, token, {
      action: "completeBattle", characterId, battleId, result: { result: "victory", reward: { gold: 999999 } }
    });
    assert.equal(replay.body.firstCompletion, false, JSON.stringify(replay.body));
  }
  assert.deepEqual({ ...db.raw.prepare(
    "SELECT level,xp,gold,(SELECT COUNT(*) FROM items WHERE character_id=?) AS item_count FROM characters WHERE character_id=?"
  ).get(characterId, characterId) }, { ...beforeReplay });
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE character_id=?").get(characterId).c, 129);
});

test("equipped and existing Overflow items do not consume carried reward capacity", async () => {
  const api = worker({ eventId: null }), db = database();
  const { token, characterId } = await account(api, db, "Authority_Capacity");
  const playerId = db.raw.prepare("SELECT player_id FROM characters WHERE character_id=?").get(characterId).player_id;
  const insert = db.raw.prepare(
    "INSERT INTO items (item_id,player_id,character_id,slot_type,equipped,name,rarity,quantity,extra_json) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  for (let i = 0; i < 29; i += 1) insert.run(`capacity-carried-${i}`, playerId, characterId, "weapon", 0, "Carried", "rare", 1, "{}");
  insert.run("capacity-equipped", playerId, characterId, "helmet", 1, "Equipped", "rare", 1, JSON.stringify({ marker: "equipped" }));
  insert.run("capacity-overflow", playerId, characterId, "boots", 0, "Existing Overflow", "rare", 1, JSON.stringify({ overflow: true, marker: "existing" }));
  db.raw.prepare("UPDATE characters SET unlocked_floor=10,str=1000,vit=1000,agi=1000,dex=1000,luk=1000 WHERE character_id=?").run(characterId);

  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 10 });
  assert.equal(started.body.context.role, "chapter_boss");
  assert.equal((await resolveBattle(api, db, token, characterId, started)).state.result, "victory");
  const first = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory" }
  });
  assert.equal(first.body.firstCompletion, true, JSON.stringify(first.body));
  assert.equal(first.body.result.reward.items.length, 2);
  assert.equal(carriedCount(db, characterId), 30);

  const equipped = db.raw.prepare("SELECT player_id,character_id,equipped,extra_json FROM items WHERE item_id='capacity-equipped'").get();
  assert.deepEqual(
    { playerId: equipped.player_id, characterId: equipped.character_id, equipped: equipped.equipped, extra: JSON.parse(equipped.extra_json) },
    { playerId, characterId, equipped: 1, extra: { marker: "equipped" } }
  );
  const existingOverflow = db.raw.prepare("SELECT player_id,character_id,equipped,extra_json FROM items WHERE item_id='capacity-overflow'").get();
  assert.equal(existingOverflow.player_id, playerId);
  assert.equal(existingOverflow.character_id, characterId);
  assert.equal(existingOverflow.equipped, 0);
  assert.deepEqual(JSON.parse(existingOverflow.extra_json), { overflow: true, marker: "existing" });

  const rewardIds = first.body.result.reward.items.map(item => item.id);
  const rewardRows = rewardIds.map(itemId => db.raw.prepare(
    "SELECT item_id,player_id,character_id,extra_json FROM items WHERE item_id=?"
  ).get(itemId));
  assert.equal(rewardRows.filter(row => JSON.parse(row.extra_json).overflow === false).length, 1);
  assert.equal(rewardRows.filter(row => JSON.parse(row.extra_json).overflow === true).length, 1);
  assert.ok(rewardRows.every(row => row.player_id === playerId && row.character_id === characterId));
  assert.ok(rewardIds.every(itemId => db.raw.prepare(
    "SELECT COUNT(*) AS c FROM item_ownership_events WHERE item_id=? AND to_player_id=? AND to_character_id=? AND event_type='acquire'"
  ).get(itemId, playerId, characterId).c === 1));
  assert.ok(rewardIds.every(itemId => db.raw.prepare(
    "SELECT COUNT(*) AS c FROM item_provenance WHERE item_id=? AND original_player_id=? AND original_character_id=?"
  ).get(itemId, playerId, characterId).c === 1));

  const beforeReplay = db.raw.prepare(
    "SELECT gold,xp,(SELECT COUNT(*) FROM items WHERE character_id=?) AS item_count,(SELECT COUNT(*) FROM item_ownership_events WHERE to_character_id=?) AS ownership_count FROM characters WHERE character_id=?"
  ).get(characterId, characterId, characterId);
  const replay = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory" }
  });
  assert.equal(replay.body.firstCompletion, false);
  assert.deepEqual({ ...db.raw.prepare(
    "SELECT gold,xp,(SELECT COUNT(*) FROM items WHERE character_id=?) AS item_count,(SELECT COUNT(*) FROM item_ownership_events WHERE to_character_id=?) AS ownership_count FROM characters WHERE character_id=?"
  ).get(characterId, characterId, characterId) }, { ...beforeReplay });
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE battle_id=?").get(started.body.battleId).c, 1);
  assert.ok(db.raw.prepare("SELECT settled_at FROM battle_authority WHERE battle_id=?").get(started.body.battleId).settled_at);
});

test("canonical runtime checkpoint resumes across reload without granting client victory", async () => {
  const api = worker({ eventId: null }), db = database();
  const { token, characterId } = await account(api, db, "Authority_Resume");
  const started = await post(api, db, token, { action: "startDungeonBattle", characterId, floor: 1 });
  const actor = started.body.state.units[started.body.state.queue[started.body.state.queueIndex]];
  const command = actor.kind === "hero"
    ? { type: "basic", targetId: started.body.state.enemyIds[0] }
    : { type: "advance" };
  const advanced = await submit(api, db, token, characterId, started.body.battleId, started.body.stateRev, command, "canonical-first-action");
  assert.equal(advanced.body.ok, true, JSON.stringify(advanced.body));

  const checkpoint = await get(api, db, token, { action: "getBattleState", characterId });
  assert.equal(checkpoint.body.checkpoint.authoritative, true);
  assert.equal(checkpoint.body.checkpoint.checkpointSeq, advanced.body.stateRev);
  assert.equal(checkpoint.body.checkpoint.payload.authorityRev, advanced.body.stateRev);
  assert.deepEqual(checkpoint.body.checkpoint.payload.serverContext, advanced.body.state.serverContext);
  assert.deepEqual(Array.from(checkpoint.body.checkpoint.payload.enemyIds), Array.from(advanced.body.state.enemyIds));

  const reloadedApi = worker({ eventId: null });
  const reloaded = await get(reloadedApi, db, token, { action: "getBattleState", characterId });
  assert.deepEqual(reloaded.body.checkpoint, checkpoint.body.checkpoint);
  const authorityBeforeClientSave = db.raw.prepare("SELECT state_rev,state_json,outcome FROM battle_authority WHERE battle_id=?").get(started.body.battleId);
  const clientCheckpoint = {
    ...reloaded.body.checkpoint.payload,
    result: "victory",
    safeActionSeq: 999999,
    units: {},
    serverContext: { ...reloaded.body.checkpoint.payload.serverContext, floor: 999 }
  };
  const ignored = await post(reloadedApi, db, token, {
    action: "saveBattleCheckpoint", characterId, battleId: started.body.battleId,
    checkpointSeq: 999999, payload: clientCheckpoint
  });
  assert.deepEqual(ignored.body, { ok: true, accepted: false, checkpointSeq: advanced.body.stateRev, authoritative: true });
  assert.deepEqual({ ...db.raw.prepare("SELECT state_rev,state_json,outcome FROM battle_authority WHERE battle_id=?").get(started.body.battleId) }, { ...authorityBeforeClientSave });
  const premature = await post(reloadedApi, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory" }
  });
  assert.equal(premature.status, 409);
  assert.equal(premature.body.error, "battle_outcome_not_verified");

  const resumed = { body: {
    battleId: started.body.battleId,
    state: reloaded.body.checkpoint.payload,
    stateRev: reloaded.body.checkpoint.checkpointSeq
  } };
  const terminal = await resolveBattle(reloadedApi, db, token, characterId, resumed);
  assert.equal(terminal.state.result, "victory");
  const completed = await post(reloadedApi, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId,
    result: { result: "victory", floor: 999, reward: { gold: 999999 } }
  });
  assert.equal(completed.body.firstCompletion, true, JSON.stringify(completed.body));
  assert.equal(completed.body.result.floor, 1);
  assert.equal(completed.body.result.reward.floor, 1);
  assert.equal((await get(reloadedApi, db, token, { action: "getBattleState", characterId })).body.checkpoint, null);
  const replay = await post(api, db, token, {
    action: "completeBattle", characterId, battleId: started.body.battleId, result: { result: "victory" }
  });
  assert.equal(replay.body.firstCompletion, false);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM battle_completions WHERE battle_id=?").get(started.body.battleId).c, 1);
});
