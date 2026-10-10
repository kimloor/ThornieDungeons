const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { loadWorkerSource } = require('./helpers/worker-source');

const ROOT = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0023_arena_v2_foundation.sql'), 'utf8');
const workerSource = loadWorkerSource(ROOT);

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

function loadInternals() {
  const source = workerSource.replace('export default {', 'const workerDefault = {') + `
globalThis.__arena = {
  workerDefault, handleGetArenaV2Status, handleGetArenaV2Opponents, handleGetArenaV2History,
  handlePrepareArenaV2Match, handleActivateArenaV2Match, handleGetArenaV2Match, handleGetArenaV2Replay,
  ensureArenaSetup, ARENA_PREPARED_TTL_MS, ARENA_ACTIVE_DURATION_MS
};`;
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__arena;
}
const arena = loadInternals();
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
  const pets = JSON.stringify({ list: [{ instId: 'pet-1', defId: 'sprout', level: 1, star: 1 }], skills: { power_strike: 1, weapon_mastery: 1, toxic_strike: 1 } });
  const character = db.raw.prepare(`INSERT INTO characters (character_id, player_id, slot_index, name, level, str, vit, agi, dex, luk, pets_json, active_pet_id) VALUES (?, ?, ?, ?, 10, 3, 2, 2, 2, 1, ?, 'pet-1')`);
  character.run('char-10', 'p1', 0, 'Attacker', pets);
  character.run('char-11', 'p2', 0, 'Defender', pets);
  db.raw.prepare("INSERT INTO character_settings (character_id, quick_slots_json) VALUES ('char-10', ?), ('char-11', ?)").run(
    JSON.stringify([{ kind: 'skill', key: 'power_strike' }, null, { kind: 'skill', key: 'weapon_mastery' }, null]),
    JSON.stringify([{ kind: 'skill', key: 'toxic_strike' }, null, null, null])
  );
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, equipped, slot_type, item_template_id, name, atk, def, hp, mp) VALUES ('eq-1','p1','char-10',1,'weapon','azure_sword','Azure Sword',20,2,0,0), ('eq-2','p2','char-11',1,'weapon','iron_sword','Iron Sword',8,1,0,0)").run();
  db.raw.exec(migration);
  return db;
}

async function ready(db, tickets = 3) {
  const status = await body(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  const today = new Date().toISOString().slice(0, 10);
  db.raw.prepare('UPDATE arena_character_state SET tickets = ?, ticket_updated_at = \'\', last_daily_ticket_date = ? WHERE character_id = \'char-10\'').run(tickets, today);
  const opponents = await body(await arena.handleGetArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  const stored = JSON.parse(db.raw.prepare("SELECT opponents_json FROM arena_opponent_state WHERE character_id = 'char-10'").get().opponents_json);
  return { seasonId: status.season.seasonId, opponents: opponents.opponents, stored };
}

test('prepare is ticket-free, snapshots current state, and retries reuse one open match', async () => {
  const db = createDb();
  const { opponents } = await ready(db);
  const target = opponents[0].opponentKey;
  const first = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', target));
  assert.equal(first.ok, true);
  assert.equal(first.replayed, false);
  assert.equal(first.match.status, 'prepared');
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 3);
  const frozen = JSON.stringify(first.match.snapshot);
  db.raw.prepare("UPDATE characters SET active_pet_id = '' WHERE character_id = 'char-10'").run();
  db.raw.prepare("UPDATE arena_setup SET skill_slots_json = '[null,null,null,null]' WHERE character_id = 'char-10'").run();
  db.raw.prepare("UPDATE items SET atk = 999 WHERE item_id = 'eq-1'").run();
  const retry = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', target));
  assert.equal(retry.replayed, true);
  assert.equal(retry.match.matchId, first.match.matchId);
  assert.equal(JSON.stringify(retry.match.snapshot), frozen);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_matches WHERE attacker_character_id = 'char-10' AND status = 'prepared'").get().c, 1);
  db.close();
});

test('Arena snapshot preserves W4 Mythic set stats and Boss Weapon combat identity', async () => {
  const db = createDb();
  db.raw.prepare("DELETE FROM items WHERE character_id = 'char-10'").run();
  const insert = db.raw.prepare(`INSERT INTO items
    (item_id, player_id, character_id, equipped, slot_type, item_template_id, rarity, name, atk, def, hp, mp, extra_json)
    VALUES (?, 'p1', 'char-10', 1, ?, ?, 'mythic', ?, ?, ?, 0, 0, ?)`);
  for (const [index, slot] of ['helmet', 'chest', 'gloves', 'boots'].entries()) {
    insert.run(`skeleton-${slot}`, slot, `skeleton_${slot}`, `Skeleton ${slot}`, slot === 'gloves' ? 10 : 0, slot === 'gloves' ? 0 : 10,
      JSON.stringify({ itemModelVersion: 2, rewardVersion: 2, setId: 'skeleton', empowerSlotCapacity: 4, empowerSlots: [null, null, null, null] }));
  }
  insert.run('spirit-weapon', 'weapon', 'spirit_greatsword', 'Spirit Greatsword', 21, 0,
    JSON.stringify({ itemModelVersion: 2, rewardVersion: 2, bossWeaponId: 'spirit_greatsword', signatureId: 'spirit_restore', empowerSlotCapacity: 4, empowerSlots: [null, null, null, null] }));
  const { opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  assert.equal(prepared.match.snapshot.attacker.stats.critDamage, 80);
  assert.equal(prepared.match.snapshot.attacker.equipmentEffects.skeletonCritArmorBreak, false);
  assert.equal(prepared.match.snapshot.attacker.equipmentEffects.bossWeaponSignature, 'spirit_restore');
  const weapon = prepared.match.snapshot.attacker.equipment.find(item => item.slotType === 'weapon');
  assert.equal(weapon.bossWeaponId, 'spirit_greatsword');
  assert.equal(weapon.itemModelVersion, 2);
  db.close();
});

test('prepared expiry costs zero tickets and permits a fresh prepare', async () => {
  const db = createDb();
  const { opponents } = await ready(db);
  const first = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  db.raw.prepare("UPDATE arena_matches SET prepared_expires_at = '2000-01-01T00:00:00.000Z' WHERE match_id = ?").run(first.match.matchId);
  const expired = await body(await arena.handleGetArenaV2Match(db, 'p1', session('p1'), 'char-10', first.match.matchId));
  assert.equal(expired.match.status, 'expired');
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 3);
  const second = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  assert.equal(second.ok, true);
  assert.notEqual(second.match.matchId, first.match.matchId);
  db.close();
});

test('season cutoff immediately expires prepared match and releases the open slot', async () => {
  const db = createDb();
  const { seasonId, opponents } = await ready(db, 3);
  const first = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));

  db.raw.prepare("UPDATE arena_seasons SET starts_at = '1999-01-01T00:00:00.000Z', ends_at = '2000-01-01T00:00:00.000Z' WHERE season_id = ?").run(seasonId);
  const rejected = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', first.match.matchId));
  assert.equal(rejected.error, 'arena_match_expired');
  assert.equal(db.raw.prepare('SELECT status FROM arena_matches WHERE match_id = ?').get(first.match.matchId).status, 'expired');
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 3);

  const nextOpponents = await body(await arena.handleGetArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  const fresh = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', nextOpponents.opponents[0].opponentKey));
  assert.equal(fresh.ok, true);
  assert.equal(fresh.match.status, 'prepared');
  assert.notEqual(fresh.match.seasonId, seasonId);
  db.close();
});

test('prepare after rollover expires stale prepared match without requiring activation', async () => {
  const db = createDb();
  const { seasonId, opponents } = await ready(db, 3);
  const first = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));

  db.raw.prepare("UPDATE arena_seasons SET starts_at = '1999-01-01T00:00:00.000Z', ends_at = '2000-01-01T00:00:00.000Z' WHERE season_id = ?").run(seasonId);
  const nextOpponents = await body(await arena.handleGetArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  const fresh = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', nextOpponents.opponents[0].opponentKey));

  assert.equal(fresh.ok, true);
  assert.equal(fresh.match.status, 'prepared');
  assert.notEqual(fresh.match.matchId, first.match.matchId);
  assert.notEqual(fresh.match.seasonId, seasonId);
  assert.equal(db.raw.prepare('SELECT status FROM arena_matches WHERE match_id = ?').get(first.match.matchId).status, 'expired');
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 3);
  db.close();
});

test('activation consumes exactly one ticket and duplicate activation resumes the same active match', async () => {
  const db = createDb();
  const { opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const activated = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.equal(activated.ok, true);
  assert.equal(activated.match.status, 'active');
  assert.equal(activated.match.state.phase, 'active');
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 2);
  const retry = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.equal(retry.replayed, true);
  assert.equal(retry.match.matchId, prepared.match.matchId);
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 2);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE kind = 'match_activate'").get().c, 1);
  db.close();
});

test('concurrent activation has one ticket boundary and no second active match', async () => {
  const db = createDb();
  const { opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const results = await Promise.all([
    arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId),
    arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId),
  ]);
  const bodies = await Promise.all(results.map(body));
  assert.equal(bodies.filter((result) => result.ok).length, 2, JSON.stringify(bodies));
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 2);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_matches WHERE attacker_character_id = 'char-10' AND status IN ('prepared','active')").get().c, 1);
  db.close();
});

test('activation with zero tickets fails safely and leaves prepared match unchanged', async () => {
  const db = createDb();
  const { opponents } = await ready(db, 0);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const result = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.equal(result.error, 'arena_no_ticket');
  assert.equal(db.raw.prepare('SELECT status FROM arena_matches WHERE match_id = ?').get(prepared.match.matchId).status, 'prepared');
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE kind = 'match_activate'").get().c, 0);
  db.close();
});

test('resume returns exact prepared, active and done payloads without consuming tickets', async () => {
  const db = createDb();
  const { opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const preparedResume = await body(await arena.handleGetArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.equal(preparedResume.match.status, 'prepared');
  const active = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  const activeResume = await body(await arena.handleGetArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.deepEqual(activeResume.match.snapshot, active.match.snapshot);
  assert.deepEqual(activeResume.match.state, active.match.state);
  db.raw.prepare("UPDATE arena_matches SET status = 'done', result_json = '{\"result\":\"draw\"}', completed_at = 'now' WHERE match_id = ?").run(prepared.match.matchId);
  const done = await body(await arena.handleGetArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  assert.deepEqual(done.match.result, { result: 'draw' });
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, 2);
  db.close();
});

test('real and bot defenders freeze their own safe snapshot, and forged targets are rejected', async () => {
  const db = createDb();
  const { seasonId, opponents } = await ready(db);
  db.raw.prepare("INSERT INTO arena_season_players (season_id, character_id, rating, attack_wins, rating_reached_at, created_at, updated_at) VALUES (?, 'char-11', 1000, 1, 'now', 'now', 'now')").run(seasonId);
  db.raw.prepare("INSERT INTO arena_setup (character_id, pet_inst_id, skill_slots_json, initialized_at, updated_at) VALUES ('char-11', 'pet-1', '[\"toxic_strike\",null,null,null]', 'now', 'now')").run();
  db.raw.prepare("UPDATE arena_opponent_state SET opponents_json = ? WHERE character_id = 'char-10'").run(JSON.stringify([
    { opponentKey: 'real:char-11', type: 'player', slot: 'equal', rewardSlot: 'equal', characterId: 'char-11', name: 'Defender', level: 10, rating: 1000 },
    ...opponents.slice(1),
  ]));
  const real = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', 'real:char-11'));
  assert.equal(real.match.snapshot.defender.type, 'player');
  assert.equal(real.match.snapshot.defender.equipment[0].itemTemplateId, 'iron_sword');
  assert.deepEqual(real.match.snapshot.defender.skillSlots, ['toxic_strike', null, null, null]);
  assert.equal((await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', 'forged:bot'))).error, 'arena_opponent_not_found');
  assert.equal((await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', 'forged-match'))).error, 'arena_match_not_found');
  db.close();
});

test('activation deadline is ten minutes or the season cutoff, whichever comes first', async () => {
  const db = createDb();
  const { seasonId, opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const normal = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  const normalStart = Date.parse(normal.match.activatedAt);
  assert.ok(Date.parse(normal.match.deadlineAt) - normalStart <= 10 * 60 * 1000);
  db.raw.prepare("UPDATE arena_matches SET status = 'done', completed_at = 'now' WHERE match_id = ?").run(prepared.match.matchId);
  db.raw.prepare("UPDATE arena_character_state SET tickets = 3 WHERE character_id = 'char-10'").run();
  const second = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const cutoff = new Date(Date.now() + 20 * 1000).toISOString();
  db.raw.prepare('UPDATE arena_seasons SET ends_at = ? WHERE season_id = ?').run(cutoff, seasonId);
  const nearCutoff = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', second.match.matchId));
  assert.ok(Date.parse(nearCutoff.match.deadlineAt) <= Date.parse(cutoff));
  db.close();
});

test('W9.5 adds no combat resolver, settlement, AI or W9.6/W9.7 scope', () => {
  const start = workerSource.indexOf('Phase 5: PvP Arena V2 server foundation');
  const end = workerSource.indexOf('// ---------- W9.6 Arena combat orchestration ----------');
  const section = workerSource.slice(start, end);
  assert.match(section, /prepareArenaV2Match|handlePrepareArenaV2Match/);
  assert.doesNotMatch(section, /settleArena|defense AI|lowest HP|arena_match_history/);
});

test('Arena History Replay returns ordered recorded frames only to participants without changing tickets or settlement', async () => {
  const db = createDb();
  const { seasonId, opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const activated = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  const matchId = prepared.match.matchId, completedAt = new Date().toISOString();
  db.raw.prepare("UPDATE arena_matches SET status = 'done', completed_at = ?, result_json = ? WHERE match_id = ?").run(completedAt, JSON.stringify({ result: 'win', settlementVersion: 1 }), matchId);
  db.raw.prepare(`INSERT INTO arena_match_history (match_id, season_id, attacker_character_id, defender_type, defender_character_id, defender_bot_id, attacker_name, defender_name, attacker_result, attacker_rating_change, defender_rating_change, arena_coin_earned, resolution, completed_at) VALUES (?, ?, 'char-10', ?, ?, ?, 'Attacker', 'Opponent', 'win', 10, 0, 100, 'normal', ?)`).run(matchId, seasonId, prepared.match.defenderType, prepared.match.defenderCharacterId, prepared.match.defenderBotId || '', completedAt);
  const baseState = JSON.parse(JSON.stringify(activated.match.state));
  for (let seq = 1; seq <= 2; seq++) {
    const frame = { ...baseState, actionSeq: seq, log: [...(baseState.log || []), { seq: 100 + seq, round: 1, type: seq === 1 ? 'damage' : 'heal', text: seq === 1 ? 'Recorded damage' : 'Recorded heal' }] };
    db.raw.prepare("INSERT INTO arena_match_actions (match_id, action_key, action_seq, response_json, created_at) VALUES (?, ?, ?, ?, ?)").run(matchId, `test-action-${seq}`, seq, JSON.stringify({ ok: true, actionSeq: seq, state: frame }), completedAt);
  }
  const ticketsBefore = db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets;
  const receiptsBefore = db.raw.prepare("SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE match_id = ?").get(matchId).c;
  const history = await body(await arena.handleGetArenaV2History(db, 'p1', session('p1'), 'char-10'));
  assert.equal(history.attack.find(row => row.matchId === matchId).replayAvailable, true);
  const replay = await body(await arena.handleGetArenaV2Replay(db, 'p1', session('p1'), 'char-10', matchId));
  assert.equal(replay.replayAvailable, true);
  assert.deepEqual(replay.replay.frames.map(frame => frame.actionSeq), [1, 2]);
  assert.equal(replay.replay.initialState.mode, 'arena');
  assert.equal(replay.replay.snapshot.attacker.name, 'Attacker');
  const unauthorized = await body(await arena.handleGetArenaV2Replay(db, 'p2', session('p2'), 'char-11', matchId));
  assert.equal(unauthorized.error, 'arena_replay_not_found');
  assert.equal(db.raw.prepare("SELECT status FROM arena_matches WHERE match_id = ?").get(matchId).status, 'done');
  assert.equal(db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets, ticketsBefore);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE match_id = ?").get(matchId).c, receiptsBefore);
  db.close();
});

test('Arena History Replay rejects incomplete action sequences instead of fabricating missing events', async () => {
  const db = createDb();
  const { seasonId, opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const activated = await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  const matchId = prepared.match.matchId, completedAt = new Date().toISOString();
  db.raw.prepare("UPDATE arena_matches SET status = 'done', completed_at = ?, result_json = ? WHERE match_id = ?").run(completedAt, JSON.stringify({ result: 'draw', settlementVersion: 1 }), matchId);
  db.raw.prepare(`INSERT INTO arena_match_history (match_id, season_id, attacker_character_id, defender_type, defender_character_id, defender_bot_id, attacker_name, defender_name, attacker_result, attacker_rating_change, defender_rating_change, arena_coin_earned, resolution, completed_at) VALUES (?, ?, 'char-10', ?, ?, ?, 'Attacker', 'Opponent', 'draw', 0, 0, 0, 'normal', ?)`).run(matchId, seasonId, prepared.match.defenderType, prepared.match.defenderCharacterId, prepared.match.defenderBotId || '', completedAt);
  const state = JSON.parse(JSON.stringify(activated.match.state));
  db.raw.prepare("INSERT INTO arena_match_actions (match_id, action_key, action_seq, response_json, created_at) VALUES (?, 'gap-action', 2, ?, ?)").run(matchId, JSON.stringify({ ok: true, actionSeq: 2, state: { ...state, actionSeq: 2 } }), completedAt);
  const replay = await body(await arena.handleGetArenaV2Replay(db, 'p1', session('p1'), 'char-10', matchId));
  assert.equal(replay.ok, true);
  assert.equal(replay.replayAvailable, false);
  db.close();
});

// A strong, faster defender ends the match while Activation resolves the opening turns: status 'done',
// activated_at === completed_at, arenaActionSeq 0 and no arena_match_actions rows (production "REPLAY N/A").
async function finishedAtActivationMatch(db) {
  const { opponents } = await ready(db);
  const prepared = await body(await arena.handlePrepareArenaV2Match(db, 'p1', session('p1'), 'char-10', opponents[0].opponentKey));
  const snap = JSON.parse(JSON.stringify(prepared.match.snapshot));
  snap.attacker.stats.maxHp = 1; snap.attacker.stats.def = 0; snap.attacker.stats.dodgeChance = 0; snap.attacker.stats.agi = 0; snap.attacker.pet = null;
  Object.assign(snap.defender.stats, { atk: 999999, accuracy: 9999, maxHp: 1000000, agi: 9999 });
  db.raw.prepare('UPDATE arena_matches SET snapshot_json = ? WHERE match_id = ?').run(JSON.stringify(snap), prepared.match.matchId);
  await body(await arena.handleActivateArenaV2Match(db, 'p1', session('p1'), 'char-10', prepared.match.matchId));
  return prepared.match.matchId;
}
function replayCounts(db, matchId) {
  const count = sql => db.raw.prepare(sql).get(matchId).c;
  return {
    matches: count('SELECT COUNT(*) AS c FROM arena_matches WHERE match_id = ?'),
    actions: count('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?'),
    history: count('SELECT COUNT(*) AS c FROM arena_match_history WHERE match_id = ?'),
    receipts: count('SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE match_id = ?'),
    tickets: db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get().tickets,
    row: JSON.stringify(db.raw.prepare('SELECT * FROM arena_matches WHERE match_id = ?').get(matchId)),
  };
}

test('Arena History Replay replays a match that finished during Activation with zero recorded actions', async () => {
  const db = createDb();
  const matchId = await finishedAtActivationMatch(db);
  const row = db.raw.prepare('SELECT status, activated_at, completed_at FROM arena_matches WHERE match_id = ?').get(matchId);
  assert.equal(row.status, 'done');
  assert.equal(row.activated_at, row.completed_at);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_actions WHERE match_id = ?').get(matchId).c, 0);
  const history = await body(await arena.handleGetArenaV2History(db, 'p1', session('p1'), 'char-10'));
  assert.equal(history.attack.find(item => item.matchId === matchId).replayAvailable, true);
  const before = replayCounts(db, matchId);
  const replay = await body(await arena.handleGetArenaV2Replay(db, 'p1', session('p1'), 'char-10', matchId));
  assert.equal(replay.replayAvailable, true);
  assert.deepEqual(replay.replay.frames, []);
  assert.equal(replay.replay.initialState.mode, 'arena');
  assert.equal(replay.replay.initialState.result.result, 'defeat');
  assert.equal(replay.replay.initialState.result.winnerSide, 'team_b');
  assert.ok(Array.isArray(replay.replay.initialState.log));
  assert.equal(replay.replay.snapshot.attacker.name, 'Attacker');
  const unauthorized = await body(await arena.handleGetArenaV2Replay(db, 'p2', session('p2'), 'char-11', matchId));
  assert.equal(unauthorized.error, 'arena_replay_not_found');
  assert.deepEqual(replayCounts(db, matchId), before);
  db.close();
});

test('Arena History Replay stays N/A when the re-simulation disagrees with the stored outcome or the match is not an activation finish', async () => {
  const db = createDb();
  const matchId = await finishedAtActivationMatch(db);
  const original = db.raw.prepare('SELECT result_json, completed_at FROM arena_matches WHERE match_id = ?').get(matchId);
  const tampered = JSON.parse(original.result_json);
  tampered.combatResult = 'victory'; tampered.winnerSide = 'team_a';
  db.raw.prepare('UPDATE arena_matches SET result_json = ? WHERE match_id = ?').run(JSON.stringify(tampered), matchId);
  assert.equal((await body(await arena.handleGetArenaV2Replay(db, 'p1', session('p1'), 'char-10', matchId))).replayAvailable, false);
  db.raw.prepare('UPDATE arena_matches SET result_json = ? WHERE match_id = ?').run('', matchId);
  assert.equal((await body(await arena.handleGetArenaV2Replay(db, 'p1', session('p1'), 'char-10', matchId))).replayAvailable, false);
  db.raw.prepare('UPDATE arena_matches SET result_json = ?, completed_at = ? WHERE match_id = ?').run(original.result_json, new Date(Date.parse(original.completed_at) + 5000).toISOString(), matchId);
  assert.equal((await body(await arena.handleGetArenaV2Replay(db, 'p1', session('p1'), 'char-10', matchId))).replayAvailable, false);
  db.close();
});

test('Arena replay client supports zero-frame replays and keeps the N/A fallback', () => {
  const ui = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'components.js'), 'utf8');
  assert.match(ui, /!Array\.isArray\(res\?\.replay\?\.frames\) \|\| !res\?\.replay\?\.initialState/);
  assert.match(ui, /playing: res\.replay\.frames\.length > 0/);
  assert.match(ui, /replay\.frames\.length === 0 \? "Match ended during the opening turns"/);
  assert.match(ui, /disabled: replay\.frames\.length === 0, onClick: onPlayPause/);
  assert.match(ui, /setReplayError\(/);
});
