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

function loadInternals() {
  const source = workerSource.replace('export default {', 'const workerDefault = {') + `
globalThis.__arena = {
  workerDefault, arenaTicketStateAt, arenaNextSundayCutoff, ensureArenaV2Season,
  ensureArenaSetup, sanitizeArenaSetup, reconcileArenaV2Tickets,
  handleGetArenaV2Status, handleGetArenaV2Opponents, handleRefreshArenaV2Opponents,
  handleGetArenaV2PlayerCard, handleSaveArenaV2Setup, handlePurchaseArenaV2Ticket,
  handleAcknowledgeArenaV2Unlock, arenaTierForRating, ARENA_TICKET_MAX,
  generateArenaV2Opponents, ARENA_MATCH_BANDS, PVP_TICKET_MAX,
  PVP_TICKET_REGEN_MS, PVP_DIAMOND_REFILL_COST
};`;
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__arena;
}
const arena = loadInternals();

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
      pets_json TEXT NOT NULL DEFAULT '[]', active_pet_id TEXT NOT NULL DEFAULT '',
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE character_settings (character_id TEXT PRIMARY KEY REFERENCES characters(character_id) ON DELETE CASCADE, quick_slots_json TEXT NOT NULL DEFAULT '[null,null,null,null]', updated_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY, player_id TEXT, character_id TEXT REFERENCES characters(character_id) ON DELETE CASCADE,
      slot_type TEXT, equipped INTEGER DEFAULT 0, inventory_slot TEXT, item_template_id TEXT, rarity TEXT,
      name TEXT, item_level INTEGER DEFAULT 0, enhance_level INTEGER DEFAULT 0, bound INTEGER DEFAULT 0,
      quantity INTEGER DEFAULT 1, atk INTEGER DEFAULT 0, def INTEGER DEFAULT 0, hp INTEGER DEFAULT 0,
      mp INTEGER DEFAULT 0, extra_json TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE pvp_ranking (character_id TEXT PRIMARY KEY, player_id TEXT, name TEXT, rating INTEGER DEFAULT 1000, wins INTEGER DEFAULT 0, losses INTEGER DEFAULT 0, updated_at TEXT);
    CREATE TABLE pvp_snapshots (character_id TEXT PRIMARY KEY, player_id TEXT, name TEXT, stats_json TEXT, updated_at TEXT);
    CREATE TABLE pvp_match_log (id INTEGER PRIMARY KEY AUTOINCREMENT, attacker_character_id TEXT, defender_character_id TEXT, result TEXT, rating_change INTEGER, created_at TEXT);
    CREATE TABLE pvp_matches (match_id TEXT PRIMARY KEY, attacker_character_id TEXT, defender_character_id TEXT, status TEXT, state_json TEXT, result_json TEXT, created_at TEXT, updated_at TEXT);
  `);
  db.raw.prepare('INSERT INTO players (id, password, diamonds) VALUES (?, \'x\', ?)').run('p1', 100);
  db.raw.prepare('INSERT INTO players (id, password, diamonds) VALUES (?, \'x\', ?)').run('p2', 0);
  const character = db.raw.prepare(`
    INSERT INTO characters (character_id, player_id, slot_index, name, level, str, vit, agi, dex, luk, pets_json, active_pet_id)
    VALUES (?, ?, ?, ?, ?, 3, 2, 2, 2, 1, ?, ?)
  `);
  const pets = JSON.stringify({ list: [{ instId: 'pet-1', defId: 'sprout', level: 1, star: 1 }], skills: { power_strike: 1, weapon_mastery: 1, toxic_strike: 1 } });
  character.run('char-9', 'p1', 0, 'Nine', 9, pets, 'pet-1');
  character.run('char-10', 'p1', 1, 'Ten', 10, pets, 'pet-1');
  character.run('char-11', 'p2', 0, 'Eleven', 10, pets, 'pet-1');
  character.run('char-12', 'p2', 1, 'Twelve', 10, pets, 'pet-1');
  character.run('char-13', 'p2', 2, 'Thirteen', 10, pets, 'pet-1');
  db.raw.prepare('INSERT INTO character_settings (character_id, quick_slots_json) VALUES (?, ?)').run('char-10', JSON.stringify([{ kind: 'skill', key: 'power_strike' }, { kind: 'potion', potionId: 'hp_small' }, { kind: 'skill', key: 'weapon_mastery' }, { kind: 'skill', key: 'toxic_strike' }]));
  db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, equipped, slot_type, item_template_id, name, atk, def, hp, mp) VALUES ('eq-1','p1','char-11',1,'weapon','azure_sword','Azure Sword',20,2,0,0)`).run();
  db.raw.exec(migration);
  return db;
}

const session = (id) => ({ ok: true, row: { id } });
async function jsonBody(response) { return await response.json(); }

test('W9.4 is isolated from V1 Arena constants and routes', () => {
  assert.equal(arena.PVP_TICKET_MAX, 5);
  assert.equal(arena.PVP_TICKET_REGEN_MS, 20 * 60 * 1000);
  assert.equal(arena.PVP_DIAMOND_REFILL_COST, 30);
  assert.match(workerSource, /getArenaV2Status/);
  assert.match(workerSource, /saveArenaV2Setup/);
  assert.match(workerSource, /startArenaMatch/);
  assert.match(workerSource, /submitArenaTurn/);
});

test('Lv9 is locked, Lv10 unlocks, migrated Lv10 is silent, crossing Lv10 shows once, acknowledgement is idempotent', async () => {
  const db = createDb();
  const locked = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-9'));
  assert.deepEqual(locked, { ok: true, unlocked: false, requiredLevel: 10 });
  const lockedMutation = await jsonBody(await arena.handleSaveArenaV2Setup(db, 'p1', session('p1'), 'char-9', '', [null, null, null, null]));
  assert.equal(lockedMutation.error, 'arena_locked');
  const migrated = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  assert.equal(migrated.unlocked, true);
  assert.equal(migrated.showUnlockNotice, false);
  db.raw.prepare("UPDATE characters SET level = 10 WHERE character_id = 'char-9'").run();
  const crossed = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-9'));
  assert.equal(crossed.showUnlockNotice, true);
  assert.equal((await jsonBody(await arena.handleAcknowledgeArenaV2Unlock(db, 'p1', session('p1'), 'char-9'))).showUnlockNotice, false);
  assert.equal((await jsonBody(await arena.handleAcknowledgeArenaV2Unlock(db, 'p1', session('p1'), 'char-9'))).ok, true);
  db.close();
});

test('first setup copies only valid active skill quick slots and active Pet, then initializes once', async () => {
  const db = createDb();
  const status = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  assert.deepEqual(status.setup, { petInstId: 'pet-1', skillSlots: ['power_strike', null, null, 'toxic_strike'], initialized: true });
  db.prepare('UPDATE character_settings SET quick_slots_json = ? WHERE character_id = ?').bind(JSON.stringify([{ kind: 'skill', key: 'silent_edge' }, null, null, null]), 'char-10').run();
  db.raw.prepare('UPDATE characters SET active_pet_id = \'missing\' WHERE character_id = \'char-10\'').run();
  const second = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  assert.deepEqual(second.setup, { petInstId: 'pet-1', skillSlots: ['power_strike', null, null, 'toxic_strike'], initialized: true });
  db.close();
});

test('setup sanitization removes deleted Pet/skills, preserves order, atomic save excludes equipment', async () => {
  const db = createDb();
  await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10');
  db.raw.prepare("UPDATE characters SET pets_json = ?, active_pet_id = '' WHERE character_id = 'char-10'").run(JSON.stringify({ list: [], skills: { power_strike: 1 } }));
  const sanitized = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  assert.equal(sanitized.setup.petInstId, '');
  assert.deepEqual(sanitized.setup.skillSlots, ['power_strike', null, null, null]);
  const saved = await jsonBody(await arena.handleSaveArenaV2Setup(db, 'p1', session('p1'), 'char-10', '', ['power_strike', 'not-owned', null, null]));
  assert.deepEqual(saved.setup.skillSlots, ['power_strike', null, null, null]);
  assert.deepEqual(db.raw.prepare('PRAGMA table_info(arena_setup)').all().map((row) => row.name), ['character_id', 'pet_inst_id', 'skill_slots_json', 'initialized_at', 'updated_at']);
  db.close();
});

test('ticket reconciliation implements current-day, missed UTC resets, passive ticks, cap clearing, and no banked time', () => {
  const t0 = Date.parse('2026-09-28T08:00:00Z');
  const first = arena.arenaTicketStateAt({ tickets: 0, ticket_updated_at: '', last_daily_ticket_date: '' }, t0);
  assert.equal(first.tickets, 5);
  const sameDay = arena.arenaTicketStateAt({ tickets: first.tickets, ticket_updated_at: first.ticketUpdatedAt, last_daily_ticket_date: first.lastDailyTicketDate }, t0 + 60 * 60 * 1000);
  assert.equal(sameDay.dailyGrant, 0);
  const missed = arena.arenaTicketStateAt({ tickets: 3, ticket_updated_at: '2026-09-28T07:00:00.000Z', last_daily_ticket_date: '2026-09-27' }, t0);
  assert.equal(missed.tickets, 8);
  const multi = arena.arenaTicketStateAt({ tickets: 0, ticket_updated_at: '2026-09-25T08:00:00.000Z', last_daily_ticket_date: '2026-09-25' }, t0);
  assert.equal(multi.tickets, 10);
  assert.equal(multi.ticketUpdatedAt, '');
  const underTwoHours = arena.arenaTicketStateAt({ tickets: 5, ticket_updated_at: '2026-09-28T07:00:00.000Z', last_daily_ticket_date: '2026-09-28' }, t0);
  assert.equal(underTwoHours.tickets, 5);
  const sixHours = arena.arenaTicketStateAt({ tickets: 5, ticket_updated_at: '2026-09-28T02:00:00.000Z', last_daily_ticket_date: '2026-09-28' }, t0);
  assert.equal(sixHours.tickets, 8);
  const cap = arena.arenaTicketStateAt({ tickets: 10, ticket_updated_at: '2026-09-01T00:00:00Z', last_daily_ticket_date: '2026-09-28' }, t0);
  assert.equal(cap.ticketUpdatedAt, '');
});

test('database ticket reconciliation persists idempotently and purchase costs exactly 10 Diamonds', async () => {
  const db = createDb();
  const now = '2026-09-28T08:00:00.000Z';
  const first = await arena.reconcileArenaV2Tickets(db, 'char-10', now);
  assert.equal(first.tickets, 5);
  const again = await arena.reconcileArenaV2Tickets(db, 'char-10', now);
  assert.equal(again.dailyGrant, 0);
  db.raw.prepare("UPDATE arena_character_state SET tickets = 5, ticket_updated_at = ?, last_daily_ticket_date = date('now') WHERE character_id = 'char-10'").run(new Date().toISOString());
  const purchased = await jsonBody(await arena.handlePurchaseArenaV2Ticket(db, 'p1', session('p1'), 'char-10', 'req-1'));
  assert.equal(purchased.ok, true);
  assert.equal(purchased.tickets, 6);
  assert.equal(purchased.diamonds, 90);
  const replay = await jsonBody(await arena.handlePurchaseArenaV2Ticket(db, 'p1', session('p1'), 'char-10', 'req-1'));
  assert.equal(replay.replayed, true);
  assert.equal(replay.tickets, 6);
  assert.equal(db.raw.prepare("SELECT diamonds FROM players WHERE id='p1'").get().diamonds, 90);
  db.raw.prepare("UPDATE arena_character_state SET tickets = 10 WHERE character_id = 'char-10'").run();
  const full = await jsonBody(await arena.handlePurchaseArenaV2Ticket(db, 'p1', session('p1'), 'char-10', 'req-2'));
  assert.equal(full.error, 'arena_tickets_full');
  assert.equal(db.raw.prepare("SELECT diamonds FROM players WHERE id='p1'").get().diamonds, 90);
  db.raw.prepare("UPDATE arena_character_state SET tickets = 0 WHERE character_id = 'char-10'").run();
  db.raw.prepare("UPDATE players SET diamonds = 0 WHERE id = 'p1'").run();
  const poor = await jsonBody(await arena.handlePurchaseArenaV2Ticket(db, 'p1', session('p1'), 'char-10', 'req-3'));
  assert.equal(poor.error, 'insufficient_diamonds');
  db.close();
});

test('concurrent different purchase requestIds cannot double-charge the last Diamond or exceed cap', async () => {
  const db = createDb();
  await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10');
  db.raw.prepare("UPDATE arena_character_state SET tickets = 9, ticket_updated_at = '', last_daily_ticket_date = date('now') WHERE character_id = 'char-10'").run();
  db.raw.prepare("UPDATE players SET diamonds = 10 WHERE id = 'p1'").run();
  const results = await Promise.all([
    arena.handlePurchaseArenaV2Ticket(db, 'p1', session('p1'), 'char-10', 'concurrent-a'),
    arena.handlePurchaseArenaV2Ticket(db, 'p1', session('p1'), 'char-10', 'concurrent-b'),
  ]);
  const bodies = await Promise.all(results.map(jsonBody));
  const state = db.raw.prepare("SELECT tickets FROM arena_character_state WHERE character_id = 'char-10'").get();
  const player = db.raw.prepare("SELECT diamonds FROM players WHERE id = 'p1'").get();
  assert.equal(state.tickets, 10);
  assert.equal(player.diamonds, 0);
  assert.equal(bodies.filter((body) => body.ok && body.replayed === false).length, 1);
  for (const [index, body] of bodies.entries()) {
    if (body.replayed) {
      const requestId = index === 0 ? 'concurrent-a' : 'concurrent-b';
      assert.ok(db.raw.prepare('SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?').get(`arena:ticket-purchase:char-10:${requestId}`));
    }
  }
  const failedIndex = bodies.findIndex((body) => !body.ok);
  assert.notEqual(failedIndex, -1);
  const failedRequestId = failedIndex === 0 ? 'concurrent-a' : 'concurrent-b';
  const retry = await jsonBody(await arena.handlePurchaseArenaV2Ticket(db, 'p1', session('p1'), 'char-10', failedRequestId));
  assert.notEqual(retry.replayed, true);
  assert.equal(retry.error, 'arena_tickets_full');
  assert.equal(db.raw.prepare('SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?').get(`arena:ticket-purchase:char-10:${failedRequestId}`), undefined);
  db.close();
});

test('season creation/cutoff and player initialization are authoritative and do not import V1 rating', async () => {
  const db = createDb();
  const beforeCutoff = Date.parse('2026-10-04T15:59:59Z');
  const first = await arena.ensureArenaV2Season(db, beforeCutoff);
  assert.equal(first.season_number, 1);
  assert.equal(first.ends_at, '2026-10-04T16:00:00.000Z');
  const repeat = await arena.ensureArenaV2Season(db, beforeCutoff);
  assert.equal(repeat.season_id, first.season_id);
  const next = await arena.ensureArenaV2Season(db, Date.parse('2026-10-04T16:00:00Z'));
  assert.equal(next.season_number, 2);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_seasons").get().c, 2);
  const caughtUp = await arena.ensureArenaV2Season(db, Date.parse('2026-10-20T12:00:00Z'));
  assert.equal(caughtUp.season_number, 4);
  assert.ok(Date.parse(caughtUp.ends_at) > Date.parse('2026-10-20T12:00:00Z'));
  assert.equal(caughtUp.ends_at, '2026-10-25T16:00:00.000Z');
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_seasons WHERE status = 'active'").get().c, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_seasons WHERE status = 'finalized'").get().c, 3);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM pvp_ranking").get().c, 0);
  db.close();

  // Regression: inactivity can exceed the old 104-week guard. The catch-up must
  // still preserve every weekly identity/cadence and return the season containing now.
  const longGapDb = createDb();
  await arena.ensureArenaV2Season(longGapDb, beforeCutoff);
  const longNow = Date.parse('2029-03-30T12:00:00Z');
  const longCaughtUp = await arena.ensureArenaV2Season(longGapDb, longNow);
  assert.equal(longCaughtUp.season_number, 131);
  assert.equal(longCaughtUp.ends_at, '2029-04-01T16:00:00.000Z');
  assert.ok(Date.parse(longCaughtUp.ends_at) > longNow);
  assert.equal(longGapDb.raw.prepare("SELECT COUNT(*) AS c FROM arena_seasons WHERE status = 'active'").get().c, 1);
  assert.equal(longGapDb.raw.prepare("SELECT COUNT(*) AS c FROM arena_seasons WHERE status = 'finalized'").get().c, 130);

  const longSeasons = longGapDb.raw.prepare("SELECT season_number, starts_at, ends_at FROM arena_seasons ORDER BY season_number").all();
  assert.equal(longSeasons.length, 131);
  for (let i = 1; i < longSeasons.length; i++) {
    assert.equal(longSeasons[i].season_number, i + 1);
    assert.equal(longSeasons[i].starts_at, longSeasons[i - 1].ends_at);
    assert.equal(Date.parse(longSeasons[i].ends_at) - Date.parse(longSeasons[i].starts_at), 7 * 24 * 60 * 60 * 1000);
  }
  assert.equal(longGapDb.raw.prepare("SELECT COUNT(*) AS c FROM pvp_ranking").get().c, 0);
  longGapDb.close();
});

test('opponents persist exactly three rows, enforce eligibility/bands, fallback to bots, and refresh changes identity', async () => {
  const db = createDb();
  const status = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  const seasonId = status.season.seasonId;
  const insert = db.raw.prepare(`INSERT INTO arena_season_players (season_id, character_id, rating, rating_reached_at, attack_wins, created_at, updated_at) VALUES (?, ?, ?, 'now', ?, 'now', 'now')`);
  insert.run(seasonId, 'char-11', 1000, 1);
  insert.run(seasonId, 'char-12', 1100, 1);
  insert.run(seasonId, 'char-13', 1300, 0);
  const first = await jsonBody(await arena.handleGetArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  assert.equal(first.opponents.length, 3);
  assert.equal(first.opponents.every((row) => !('slot' in row) && !('rewardEstimate' in row)), true);
  const stored = JSON.parse(db.raw.prepare('SELECT opponents_json FROM arena_opponent_state WHERE character_id = ?').get('char-10').opponents_json);
  assert.equal(stored.length, 3);
  assert.equal(stored.filter((row) => row.type === 'player').length, 2);
  assert.equal(stored.some((row) => row.type === 'bot'), true);
  const second = await jsonBody(await arena.handleGetArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  assert.deepEqual(second.opponents, first.opponents);
  db.raw.prepare("UPDATE arena_opponent_state SET refresh_available_at = '' WHERE character_id = 'char-10'").run();
  const refreshedResults = await Promise.all([
    arena.handleRefreshArenaV2Opponents(db, 'p1', session('p1'), 'char-10'),
    arena.handleRefreshArenaV2Opponents(db, 'p1', session('p1'), 'char-10'),
  ]);
  const refreshedBodies = await Promise.all(refreshedResults.map(jsonBody));
  assert.equal(refreshedBodies.filter((body) => body.ok).length, 1);
  assert.equal(refreshedBodies.filter((body) => body.error === 'arena_refresh_cooldown').length, 1);
  const refreshed = refreshedBodies.find((body) => body.ok);
  assert.equal(refreshed.opponents.some((row) => !first.opponents.some((old) => old.opponentKey === row.opponentKey)), true);
  const persisted = JSON.parse(db.raw.prepare('SELECT opponents_json FROM arena_opponent_state WHERE character_id = ?').get('char-10').opponents_json);
  assert.deepEqual(persisted.map((row) => row.opponentKey), refreshed.opponents.map((row) => row.opponentKey));
  const cooldown = await jsonBody(await arena.handleRefreshArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  assert.equal(cooldown.error, 'arena_refresh_cooldown');

  // With no eligible real players, every slot is a bot whose virtual rating
  // remains in its requested band at low, mid, tier-boundary and high ratings.
  db.raw.prepare("UPDATE arena_season_players SET attack_wins = 0, attack_draws = 0, attack_losses = 0 WHERE season_id = ? AND character_id != 'char-10'").run(seasonId);
  for (const selfRating of [1000, 1200, 1400, 1500, 1800]) {
    db.raw.prepare("UPDATE arena_season_players SET rating = ? WHERE season_id = ? AND character_id = 'char-10'").run(selfRating, seasonId);
    const generated = await arena.generateArenaV2Opponents(db, { season_id: seasonId }, { character_id: 'char-10' });
    assert.equal(generated.length, 3);
    for (const row of generated) {
      assert.equal(row.type, 'bot');
      const band = arena.ARENA_MATCH_BANDS[row.slot];
      assert.ok(row.rating >= Math.max(1000, selfRating + band.min));
      assert.ok(row.rating <= Math.max(1000, selfRating + band.max));
    }
  }
  db.close();
});

test('Player Card resolves only from persisted opponent list, uses live equipment/saved Pet, and hides skills/private fields', async () => {
  const db = createDb();
  const status = await jsonBody(await arena.handleGetArenaV2Status(db, 'p1', session('p1'), 'char-10'));
  const seasonId = status.season.seasonId;
  db.raw.prepare(`INSERT INTO arena_season_players (season_id, character_id, rating, rating_reached_at, attack_wins, created_at, updated_at) VALUES (?, 'char-11', 1000, 'now', 1, 'now', 'now')`).run(seasonId);
  const opponents = await jsonBody(await arena.handleGetArenaV2Opponents(db, 'p1', session('p1'), 'char-10'));
  const real = opponents.opponents.find((row) => row.name === 'Eleven');
  const card = await jsonBody(await arena.handleGetArenaV2PlayerCard(db, 'p1', session('p1'), 'char-10', real.opponentKey));
  assert.equal(card.playerCard.equipment[0].itemTemplateId, 'azure_sword');
  assert.equal(card.playerCard.pet, null);
  assert.equal('skillSlots' in card.playerCard, false);
  assert.equal('playerId' in card.playerCard, false);
  const forged = await jsonBody(await arena.handleGetArenaV2PlayerCard(db, 'p1', session('p1'), 'char-10', 'real:char-12'));
  assert.equal(forged.error, 'arena_opponent_not_found');
  const bot = opponents.opponents.find((row) => row.name.startsWith('BOT'));
  const botCard = await jsonBody(await arena.handleGetArenaV2PlayerCard(db, 'p1', session('p1'), 'char-10', bot.opponentKey));
  assert.equal(botCard.playerCard.isBot, true);
  assert.ok(botCard.playerCard.cp > 0);
  assert.ok(botCard.playerCard.archetype);
  assert.deepEqual(botCard.playerCard.equipment, []);
  assert.equal(botCard.playerCard.pet, null);
  assert.equal(botCard.playerCard.profileFrameKey, null);
  db.close();
});

test('Worker keeps W9.6 combat orchestration separate from W9.7 settlement and generated frontend remains untouched', () => {
  const section = workerSource.slice(workerSource.indexOf('// ---------- W9.6 Arena combat orchestration ----------'), workerSource.indexOf('// ---------- admin / QA ----------'));
  assert.match(section, /submitArenaV2Action|handleSubmitArenaV2Action|lowestHpPercentTarget/);
  assert.match(section, /arenaSettleV2Match|arena_match_history|milestone|promotion/);
  assert.match(section, /arenaCombatState|handleSubmitArenaV2Action/);
  assert.equal(fs.existsSync(path.join(ROOT, 'index.html')), true);
});
