const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0023_arena_v2_foundation.sql'), 'utf8');
const workerSource = fs.readFileSync(path.join(ROOT, 'workers/thornie-dungeons-api.js'), 'utf8');

class Statement {
  constructor(raw, sql, values = []) { this.raw = raw; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.raw, this.sql, values); }
  async first() { return this.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.values) }; }
  async run() { const result = this.raw.prepare(this.sql).run(...this.values); return { meta: { changes: Number(result.changes) } }; }
}
class D1 {
  constructor() { this.raw = new DatabaseSync(':memory:'); }
  prepare(sql) { return new Statement(this.raw, sql); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
  close() { this.raw.close(); }
}

function loadArena() {
  const source = workerSource.replace('export default {', 'const workerDefault = {') + `
globalThis.__arenaCombat = {
  workerDefault, handleGetArenaV2Status, handleGetArenaV2Opponents,
  handlePrepareArenaV2Match, handleActivateArenaV2Match, handleGetArenaV2Match,
  handleSubmitArenaV2Action, handleSetArenaV2Auto
};`;
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__arenaCombat;
}
const arena = loadArena();
const session = (id) => ({ ok: true, row: { id } });
async function body(response) { return await response.json(); }

function createDb() {
  const db = new D1();
  db.raw.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '', diamonds INTEGER NOT NULL DEFAULT 0, active_slot INTEGER, created_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL, name TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0, stat_points INTEGER NOT NULL DEFAULT 0,
      str INTEGER NOT NULL DEFAULT 0, vit INTEGER NOT NULL DEFAULT 0, agi INTEGER NOT NULL DEFAULT 0,
      dex INTEGER NOT NULL DEFAULT 0, luk INTEGER NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 0,
      unlocked_floor INTEGER NOT NULL DEFAULT 1, potions INTEGER NOT NULL DEFAULT 2,
      protection_stones INTEGER NOT NULL DEFAULT 0, chest_pity INTEGER NOT NULL DEFAULT 0,
      pets_json TEXT NOT NULL DEFAULT '[]', active_pet_id TEXT NOT NULL DEFAULT '', created_at TEXT, updated_at TEXT,
      pvp_tickets INTEGER NOT NULL DEFAULT 5, pvp_tickets_updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE character_settings (character_id TEXT PRIMARY KEY REFERENCES characters(character_id) ON DELETE CASCADE, quick_slots_json TEXT NOT NULL DEFAULT '[null,null,null,null]', updated_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY, player_id TEXT, character_id TEXT REFERENCES characters(character_id) ON DELETE CASCADE,
      slot_type TEXT, equipped INTEGER DEFAULT 0, inventory_slot TEXT, item_template_id TEXT, rarity TEXT,
      name TEXT, item_level INTEGER DEFAULT 0, enhance_level INTEGER DEFAULT 0, bound INTEGER DEFAULT 0,
      quantity INTEGER DEFAULT 1, atk INTEGER DEFAULT 0, def INTEGER DEFAULT 0, hp INTEGER DEFAULT 0,
      mp INTEGER DEFAULT 0, extra_json TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE pvp_snapshots (character_id TEXT PRIMARY KEY, player_id TEXT, name TEXT, stats_json TEXT, updated_at TEXT);
    CREATE TABLE pvp_ranking (character_id TEXT PRIMARY KEY, player_id TEXT, name TEXT, rating INTEGER DEFAULT 1000, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, updated_at TEXT);
    CREATE TABLE pvp_match_log (id INTEGER PRIMARY KEY AUTOINCREMENT, attacker_character_id TEXT, defender_character_id TEXT, result TEXT, rating_change INTEGER, created_at TEXT);
    CREATE TABLE pvp_matches (match_id TEXT PRIMARY KEY, attacker_character_id TEXT, defender_character_id TEXT, status TEXT, state_json TEXT, result_json TEXT, created_at TEXT, updated_at TEXT);
  `);
  db.raw.prepare("INSERT INTO players (id, password, diamonds) VALUES ('p1', 'x', 0), ('p2', 'x', 0)").run();
  const pets = JSON.stringify({ list: [{ instId: 'pet-1', defId: 'flamekit', level: 1, star: 1 }], skills: { power_strike: 1, weapon_mastery: 1, toxic_strike: 1 } });
  const character = db.raw.prepare(`INSERT INTO characters (character_id, player_id, slot_index, name, level, str, vit, agi, dex, luk, pets_json, active_pet_id) VALUES (?, ?, ?, ?, 10, 3, 2, 4, 2, 1, ?, 'pet-1')`);
  character.run('char-10', 'p1', 0, 'Attacker', pets);
  character.run('char-11', 'p2', 0, 'Defender', pets);
  db.raw.prepare("INSERT INTO character_settings (character_id, quick_slots_json) VALUES ('char-10', ?), ('char-11', ?)").run(
    JSON.stringify([{ kind: 'skill', key: 'power_strike' }, null, null, null]),
    JSON.stringify([{ kind: 'skill', key: 'power_strike' }, null, null, null])
  );
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, equipped, slot_type, item_template_id, name, atk, def, hp, mp) VALUES ('eq-1','p1','char-10',1,'weapon','azure_sword','Azure Sword',20,2,0,0), ('eq-2','p2','char-11',1,'weapon','iron_sword','Iron Sword',8,1,0,0)").run();
  db.raw.exec(migration);
  return db;
}

async function ready(db) {
  await body(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  const today = new Date().toISOString().slice(0, 10);
  db.raw.prepare("UPDATE arena_character_state SET tickets = 5, ticket_updated_at = '', last_daily_ticket_date = ? WHERE character_id = 'char-10'").run(today);
  const opponents = await body(await arena.handleGetArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  return opponents.opponents;
}
async function activate(db, opponentKey) {
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponentKey));
  const active = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  return { prepared, active };
}

test('activation initializes shared Arena Battle Core state and exposes safe queue/action metadata', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  assert.equal(active.ok, true);
  assert.equal(active.match.status, 'active');
  assert.equal(active.match.state.mode, 'arena');
  assert.equal(active.match.state.round, 1);
  assert.equal(active.match.state.roundMax, 20);
  assert.equal(active.match.state.queue.length, 4);
  assert.equal(active.match.state.currentActorId, 'team_a_hero');
  assert.equal(active.match.state.action.activeSkills.length, 1);
  assert.equal(Object.hasOwn(active.match.state.units.find((unit) => unit.side === 'team_b'), 'skills'), false);
  db.close();
});

test('Hero-only attacker/defender combinations remain valid Arena teams', async () => {
  const db = createDb();
  const opponents = await ready(db);
  db.raw.prepare("UPDATE arena_setup SET pet_inst_id = '' WHERE character_id = 'char-10'").run();
  const { active } = await activate(db, opponents[0].opponentKey);
  assert.equal(active.ok, true);
  assert.deepEqual(active.match.state.units.map((unit) => unit.kind), ['hero', 'hero']);
  const action = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'hero-only-1', 'basic', null, 'team_b_hero', false));
  assert.equal(action.ok, true);
  db.close();
});

test('manual illegal target is rejected without advancing core state or action receipt', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  const before = db.raw.prepare('SELECT state_json FROM arena_matches WHERE match_id = ?').get(active.match.matchId).state_json;
  const rejected = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'bad-target', 'basic', null, 'team_a_hero', false));
  assert.equal(rejected.error, 'arena_action_illegal');
  assert.equal(db.raw.prepare('SELECT state_json FROM arena_matches WHERE match_id = ?').get(active.match.matchId).state_json, before);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?').get(active.match.matchId).c, 0);
  db.close();
});

test('manual legal action is exact-once and retry returns the stored response', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  const first = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'action-1', 'basic', null, 'team_b_hero', false));
  assert.equal(first.ok, true);
  assert.equal(first.replayed, false);
  const retry = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'action-1', 'basic', null, 'team_b_hero', false));
  assert.equal(retry.ok, true);
  assert.equal(retry.replayed, true);
  assert.deepEqual(retry.state, first.state);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?').get(active.match.matchId).c, 1);
  db.close();
});

test('concurrent different action keys cannot advance one Arena sequence twice', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  const responses = await Promise.all([
    arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'race-a', 'basic', null, 'team_b_hero', false),
    arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'race-b', 'basic', null, 'team_b_hero', false),
  ]);
  const bodies = await Promise.all(responses.map(body));
  assert.equal(bodies.filter((result) => result.ok).length, 1, JSON.stringify(bodies));
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?').get(active.match.matchId).c, 1);
  db.close();
});

test('self/support action does not require a target and configured skill priority is preserved', async () => {
  const db = createDb();
  const opponents = await ready(db);
  db.raw.prepare("UPDATE character_settings SET quick_slots_json = ? WHERE character_id = 'char-10'").run(JSON.stringify([{ kind: 'skill', key: 'rampage' }, null, null, null]));
  db.raw.prepare("UPDATE characters SET pets_json = ? WHERE character_id = 'char-10'").run(JSON.stringify({ list: [{ instId: 'pet-1', defId: 'flamekit', level: 1, star: 1 }], skills: { rampage: 1 } }));
  db.raw.prepare("UPDATE arena_setup SET skill_slots_json = '[\"rampage\",null,null,null]' WHERE character_id = 'char-10'").run();
  const { active } = await activate(db, opponents[0].opponentKey);
  const result = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'self-buff', 'active', 'rampage', null, false));
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.state.units.find((unit) => unit.id === 'team_a_hero').statuses.includes('rampage'), true);
  db.close();
});

test('Auto mode advances attacker Hero plus both automatic Pets through shared core', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  const toggled = await body(await arena.handleSetArenaV2Auto(db, 'p1', session('p1'), 'char-10', active.match.matchId, true));
  assert.equal(toggled.ok, true);
  const result = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'auto-1', 'basic', null, 'team_b_hero', true));
  assert.equal(result.ok, true);
  assert.ok(result.state.actionSeq >= 1);
  assert.ok(result.state.units.some((unit) => unit.kind === 'pet'));
  db.close();
});

test('defender AI uses configured priority and targets the lowest HP percentage with Hero tie-break', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const seasonId = db.raw.prepare("SELECT season_id FROM arena_season_players WHERE character_id = 'char-10'").get().season_id;
  db.raw.prepare("INSERT INTO arena_season_players (season_id, character_id, rating, attack_wins, rating_reached_at, created_at, updated_at) VALUES (?, 'char-11', 1000, 1, 'now', 'now', 'now')").run(seasonId);
  db.raw.prepare("INSERT INTO arena_setup (character_id, pet_inst_id, skill_slots_json, initialized_at, updated_at) VALUES ('char-11', 'pet-1', '[\"power_strike\",\"rampage\",null,null]', 'now', 'now')").run();
  db.raw.prepare("UPDATE characters SET pets_json = ? WHERE character_id = 'char-11'").run(JSON.stringify({ list: [{ instId: 'pet-1', defId: 'flamekit', level: 1, star: 1 }], skills: { rampage: 1, power_strike: 1 } }));
  const real = { opponentKey: 'real:char-11', type: 'player', slot: 'equal', rewardSlot: 'equal', characterId: 'char-11', name: 'Defender', level: 10, rating: 1000 };
  db.raw.prepare("UPDATE arena_opponent_state SET opponents_json = ? WHERE character_id = 'char-10'").run(JSON.stringify([real, ...opponents.slice(1)]));
  const { active } = await activate(db, real.opponentKey);
  assert.deepEqual(active.match.snapshot.defender.skillSlots.slice(0, 2), ['power_strike', 'rampage']);
  const raw = JSON.parse(db.raw.prepare('SELECT state_json FROM arena_matches WHERE match_id = ?').get(active.match.matchId).state_json);
  raw.units.team_a_hero.hp = 50;
  raw.units.team_a_hero.atk = 1;
  raw.units.team_a_pet.maxHp = 1000;
  raw.units.team_a_pet.hp = 100;
  db.raw.prepare('UPDATE arena_matches SET state_json = ? WHERE match_id = ?').run(JSON.stringify(raw), active.match.matchId);
  const first = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'ai-target-1', 'basic', null, 'team_b_hero', false));
  assert.equal(first.ok, true);
  const result = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'ai-target-2', 'basic', null, 'team_b_hero', false));
  assert.equal(result.ok, true);
  const defenderLog = result.state.log.find((entry) => entry.actorId === 'team_b_hero');
  assert.ok(defenderLog, JSON.stringify(result.state.log));
  assert.equal(defenderLog.targetId, 'team_a_pet');
  assert.equal(defenderLog.actionName, 'Power Strike');
  db.close();
});

test('Surrender is an idempotent authoritative settlement result', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  db.raw.prepare('UPDATE arena_matches SET activated_at = ? WHERE match_id = ?').run(new Date(Date.now() - 11000).toISOString(), active.match.matchId);
  const result = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'surrender-1', 'surrender', null, null, false));
  assert.equal(result.result.result, 'loss');
  assert.equal(result.result.combatResult, 'surrender');
  assert.equal(db.raw.prepare('SELECT status FROM arena_matches WHERE match_id = ?').get(active.match.matchId).status, 'done');
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_match_history WHERE match_id = ?").get(active.match.matchId).c, 1);
  const retry = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'surrender-1', 'surrender', null, null, false));
  assert.equal(retry.replayed, true);
  db.close();
});

test('activation stores immediate opening defeat as done while consuming exactly one ticket', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const row = db.raw.prepare('SELECT snapshot_json FROM arena_matches WHERE match_id = ?').get(prepared.match.matchId);
  const snapshot = JSON.parse(row.snapshot_json);
  snapshot.attacker.stats.maxHp = 1;
  snapshot.attacker.stats.def = 0;
  snapshot.attacker.stats.agi = 0;
  snapshot.defender.stats = { maxHp: 1000, maxMp: 100, atk: 99999, def: 0, accuracy: 100, dodgeChance: 0, critChance: 0, critDamage: 50, agi: 999 };
  db.raw.prepare('UPDATE arena_matches SET snapshot_json = ? WHERE match_id = ?').run(JSON.stringify(snapshot), prepared.match.matchId);
  const beforeTickets = db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets;

  const activated = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.equal(activated.ok, true);
  assert.equal(activated.match.status, 'done');
  assert.equal(activated.match.result.result, 'loss');
  assert.equal(activated.match.result.combatResult, 'defeat');
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, beforeTickets - 1);

  const resumed = await body(await arena.handleGetArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.equal(resumed.match.status, 'done');
  assert.equal(resumed.match.result.result, 'loss');
  assert.equal(resumed.match.result.combatResult, 'defeat');
  db.close();
});

test('setAuto and submit action share one state revision so concurrent writes cannot clobber each other', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  const responses = await Promise.all([
    arena.handleSetArenaV2Auto(db, 'p1', session('p1'), 'char-10', active.match.matchId, true),
    arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'auto-race-action', 'basic', null, 'team_b_hero', false),
  ]);
  const bodies = await Promise.all(responses.map(body));
  const successCount = bodies.filter((result) => result.ok).length;
  assert.ok(successCount === 1 || successCount === 2, JSON.stringify(bodies));

  const saved = JSON.parse(db.raw.prepare('SELECT state_json FROM arena_matches WHERE match_id = ?').get(active.match.matchId).state_json);
  const receipts = db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?').get(active.match.matchId).c;
  if (successCount === 2) {
    // Both transitions may legitimately serialize. If the action observed Auto
    // enabled it may finish the battle, and Battle Core then resets Auto=false.
    // Otherwise the successful Auto transition must remain visible.
    assert.equal(receipts, 1);
    assert.equal(Number(saved.arenaStateRev), 2);
    assert.equal(saved.flags.auto === true || !!saved.result, true);
  } else if (bodies[0].ok) {
    assert.equal(saved.flags.auto, true);
    assert.equal(receipts, 0);
    assert.equal(Number(saved.arenaStateRev), 1);
  } else {
    assert.equal(bodies[1].ok, true);
    assert.equal(receipts, 1);
    assert.equal(Number(saved.arenaStateRev), 1);
  }
  db.close();
});

test('Surrender is rejected for 10 seconds without receipt or state advance, then remains exact-once', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { active } = await activate(db, opponents[0].opponentKey);
  const before = db.raw.prepare('SELECT state_json FROM arena_matches WHERE match_id = ?').get(active.match.matchId).state_json;

  const early = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'surrender-cooldown', 'surrender', null, null, false));
  assert.equal(early.error, 'arena_surrender_cooldown');
  assert.equal(db.raw.prepare('SELECT state_json FROM arena_matches WHERE match_id = ?').get(active.match.matchId).state_json, before);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?').get(active.match.matchId).c, 0);

  db.raw.prepare('UPDATE arena_matches SET activated_at = ? WHERE match_id = ?').run(new Date(Date.now() - 11000).toISOString(), active.match.matchId);
  const result = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'surrender-cooldown', 'surrender', null, null, false));
  assert.equal(result.result.result, 'loss');
  assert.equal(result.result.combatResult, 'surrender');
  const retry = await body(await arena.handleSubmitArenaV2Action(db, 'p1', session('p1'), 'char-10', active.match.matchId, 'surrender-cooldown', 'surrender', null, null, false));
  assert.equal(retry.replayed, true);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?').get(active.match.matchId).c, 1);
  db.close();
});

test('resume returns deterministic stored public combat state without consuming another ticket', async () => {
  const db = createDb();
  const opponents = await ready(db);
  const { prepared, active } = await activate(db, opponents[0].opponentKey);
  const tickets = db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets;
  const resumed = await body(await arena.handleGetArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.deepEqual(resumed.match.state, active.match.state);
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, tickets);
  db.close();
});
