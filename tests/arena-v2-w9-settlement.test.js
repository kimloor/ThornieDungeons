const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { DatabaseSync } = require('node:sqlite');
const { loadWorkerSource } = require('./helpers/worker-source');

const ROOT = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0023_arena_v2_foundation.sql'), 'utf8');
const mailboxMigration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0024_arena_w98_rewards.sql'), 'utf8');
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
  async batch(statements) {
    return statements.map((statement, index) => {
      try { const result = statement.raw.prepare(statement.sql).run(...statement.values); return { meta: { changes: Number(result.changes) } }; }
      catch (error) { error.message = `batch[${index}] ${error.message}\nSQL=${statement.sql}\nVALUES=${JSON.stringify(statement.values)}`; throw error; }
    });
  }
  close() { this.raw.close(); }
}

function loadArena() {
  const source = workerSource.replace('export default {', 'const workerDefault = {') + `
globalThis.__arenaSettlement = {
  workerDefault, arenaSettleV2Match, arenaFinalizeSeason, ensureArenaSeasonPlayer,
  arenaSettleStoredTerminalMatch, arenaRankAheadSql, arenaSeasonRewardForRank,
  arenaTierRank, arenaRoundRatingDelta, arenaApplyPairMultiplier
};`;
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__arenaSettlement;
}
const arena = loadArena();

function createDb() {
  const db = new D1();
  db.raw.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '', diamonds INTEGER NOT NULL DEFAULT 0, active_slot INTEGER, created_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL, name TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 10,
      xp INTEGER NOT NULL DEFAULT 0, stat_points INTEGER NOT NULL DEFAULT 0,
      str INTEGER NOT NULL DEFAULT 0, vit INTEGER NOT NULL DEFAULT 0, agi INTEGER NOT NULL DEFAULT 0,
      dex INTEGER NOT NULL DEFAULT 0, luk INTEGER NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 0,
      unlocked_floor INTEGER NOT NULL DEFAULT 1, potions INTEGER NOT NULL DEFAULT 2,
      protection_stones INTEGER NOT NULL DEFAULT 0, chest_pity INTEGER NOT NULL DEFAULT 0,
      pets_json TEXT NOT NULL DEFAULT '[]', active_pet_id TEXT NOT NULL DEFAULT '', created_at TEXT, updated_at TEXT
    );
  `);
  db.raw.prepare("INSERT INTO players (id, password, diamonds) VALUES ('p1', 'x', 0), ('p2', 'x', 0)").run();
  db.raw.prepare("INSERT INTO characters (character_id, player_id, slot_index, name) VALUES ('char-10', 'p1', 0, 'Attacker'), ('char-11', 'p2', 0, 'Defender')").run();
  db.raw.exec(`
    CREATE TABLE mailbox (
      mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0,
      junk_json TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '',
      claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT ''
    );
  `);
  db.raw.exec(migration);
  db.raw.exec(mailboxMigration);
  const season = 'season-1';
  const now = '2026-09-28T12:00:00.000Z';
  db.raw.prepare("INSERT INTO arena_seasons (season_id, season_number, starts_at, ends_at, status, created_at, updated_at) VALUES (?, 1, ?, ?, 'active', ?, ?)").run(season, '2026-09-21T16:00:00.000Z', '2026-10-04T16:00:00.000Z', now, now);
  db.raw.prepare("INSERT INTO arena_season_players (season_id, character_id, rating, rating_reached_at, created_at, updated_at) VALUES (?, 'char-10', 1200, ?, ?, ?), (?, 'char-11', 1200, ?, ?, ?)").run(season, now, now, now, season, now, now, now);
  db.raw.prepare("UPDATE arena_character_state SET tickets = 5 WHERE character_id IN ('char-10', 'char-11')").run();
  return db;
}

function state(result, winnerSide = null) {
  return { mode: 'arena', result, winnerSide, flags: { auto: false }, round: 20, log: [], logSeq: 0 };
}
function snapshot(defenderType = 'player', defenderRating = 1200) {
  return JSON.stringify({
    attacker: { name: 'Attacker', rating: 1200 },
    defender: { type: defenderType, name: defenderType === 'bot' ? 'BOT Warrior' : 'Defender', rating: defenderRating },
  });
}
function insertMatch(db, matchId, { attacker = 'char-10', defender = 'char-11', defenderType = 'player', rewardSlot = 'equal', status = 'done' } = {}) {
  const now = '2026-09-28T12:00:00.000Z';
  db.raw.prepare(`
    INSERT INTO arena_matches (match_id, season_id, attacker_character_id, defender_type, defender_character_id, defender_bot_id, source, reward_slot, status, seed, snapshot_json, state_json, result_json, prepared_at, prepared_expires_at, activated_at, ticket_consumed_at, deadline_at, completed_at, created_at, updated_at)
    VALUES (?, 'season-1', ?, ?, ?, ?, 'matchmaking', ?, ?, 1, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    matchId, attacker, defenderType, defenderType === 'player' ? defender : null, defenderType === 'bot' ? 'arena-warrior' : '', rewardSlot, status,
    snapshot(defenderType), JSON.stringify({}), now, now, now, now, now, now, now, now,
  );
  return db.raw.prepare('SELECT * FROM arena_matches WHERE match_id = ?').get(matchId);
}

async function settle(db, matchId, combatState, resolution = 'normal') {
  const match = db.raw.prepare('SELECT * FROM arena_matches WHERE match_id = ?').get(matchId);
  return arena.arenaSettleV2Match(db, match, combatState, resolution);
}

test('normal loss/surrender settles rating, stats, coin, history and replay exactly once', async () => {
  const db = createDb();
  insertMatch(db, 'm-surrender');
  const first = await settle(db, 'm-surrender', state('surrender', 'team_b'), 'surrender');
  assert.equal(first.result.result, 'loss');
  assert.equal(first.result.resolution, 'surrender');
  assert.equal(first.result.arenaCoin.earned, 5);
  assert.equal(db.raw.prepare("SELECT rating, attack_losses FROM arena_season_players WHERE character_id = 'char-10'").get().rating, 1188);
  assert.equal(db.raw.prepare("SELECT defense_wins FROM arena_season_players WHERE character_id = 'char-11'").get().defense_wins, 1);
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-10'").get().arena_coin, 5);
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_match_history').get().c, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE kind = 'settlement'").get().c, 1);
  const retry = await settle(db, 'm-surrender', state('surrender', 'team_b'), 'surrender');
  assert.equal(retry.replayed, true);
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-10'").get().arena_coin, 5);
  assert.equal(db.raw.prepare("SELECT attack_losses FROM arena_season_players WHERE character_id = 'char-10'").get().attack_losses, 1);
  db.close();
});

test('draw and ordinary timeout settle the correct stats/coin without inventing a win', async () => {
  const db = createDb();
  insertMatch(db, 'm-draw');
  const draw = await settle(db, 'm-draw', state('draw', null));
  assert.equal(draw.result.result, 'draw');
  assert.equal(draw.result.attacker.ratingChange, 0);
  assert.equal(draw.result.arenaCoin.earned, 9);
  assert.equal(db.raw.prepare("SELECT attack_draws FROM arena_season_players WHERE character_id = 'char-10'").get().attack_draws, 1);
  assert.equal(db.raw.prepare("SELECT defense_draws FROM arena_season_players WHERE character_id = 'char-11'").get().defense_draws, 1);

  insertMatch(db, 'm-timeout', { status: 'active', rewardSlot: 'higher' });
  const timeout = await settle(db, 'm-timeout', state(null, null), 'timeout');
  assert.equal(timeout.result.result, 'loss');
  assert.equal(timeout.result.resolution, 'timeout');
  assert.equal(timeout.result.arenaCoin.earned, 7);
  assert.equal(timeout.result.attacker.ratingChange < 0, true);
  assert.notEqual(db.raw.prepare("SELECT completed_at FROM arena_matches WHERE match_id = 'm-timeout'").get().completed_at, '');
  db.close();
});

test('real-player pair diminishing is symmetric and applies 100%, 50%, then 0%', async () => {
  const db = createDb();
  const deltas = [];
  for (let i = 1; i <= 3; i++) {
    insertMatch(db, `m-pair-${i}`);
    const result = await settle(db, `m-pair-${i}`, state('victory', 'team_a'));
    deltas.push(result.result.attacker.ratingChange);
  }
  assert.equal(deltas[0] > deltas[1], true);
  assert.equal(deltas[2], 0);
  assert.equal(db.raw.prepare('SELECT encounter_count FROM arena_pair_season_stats WHERE season_id = ? AND character_id_a = ? AND character_id_b = ?').get('season-1', 'char-10', 'char-11').encounter_count, 3);
  insertMatch(db, 'm-pair-reversed', { attacker: 'char-11', defender: 'char-10' });
  const reversed = await settle(db, 'm-pair-reversed', state('defeat', 'team_a'));
  assert.equal(reversed.result.defender.characterId, 'char-10');
  assert.equal(db.raw.prepare('SELECT COUNT(*) AS c FROM arena_pair_season_stats').get().c, 1);
  assert.equal(db.raw.prepare('SELECT encounter_count FROM arena_pair_season_stats').get().encounter_count, 4);
  db.close();
});

test('bot wins cannot promote into Diamond and rating floor is enforced', async () => {
  const db = createDb();
  db.raw.prepare("UPDATE arena_season_players SET rating = 1449 WHERE character_id = 'char-10'").run();
  insertMatch(db, 'm-bot', { defender: null, defenderType: 'bot', rewardSlot: 'higher' });
  const win = await settle(db, 'm-bot', state('victory', 'team_a'));
  assert.equal(win.result.attacker.ratingAfter, 1449);
  assert.equal(win.result.promotion.attacker.length, 0);
  db.raw.prepare("UPDATE arena_season_players SET rating = 1000 WHERE character_id = 'char-10'").run();
  insertMatch(db, 'm-floor');
  const loss = await settle(db, 'm-floor', state('defeat', 'team_b'));
  assert.equal(loss.result.attacker.ratingAfter, 1000);
  db.close();
});

test('rating change in result and history equals clamped rating delta for both players', async () => {
  const db = createDb();
  db.raw.prepare("UPDATE arena_season_players SET rating = 1000 WHERE character_id = 'char-11'").run();
  insertMatch(db, 'm-defender-floor');
  const settled = await settle(db, 'm-defender-floor', state('victory', 'team_a'));
  assert.equal(settled.result.attacker.ratingChange, settled.result.attacker.ratingAfter - settled.result.attacker.ratingBefore);
  assert.equal(settled.result.defender.ratingChange, settled.result.defender.ratingAfter - settled.result.defender.ratingBefore);
  assert.equal(settled.result.defender.ratingAfter, 1000);
  const history = db.raw.prepare("SELECT attacker_rating_change, defender_rating_change FROM arena_match_history WHERE match_id = 'm-defender-floor'").get();
  assert.equal(history.attacker_rating_change, settled.result.attacker.ratingChange);
  assert.equal(history.defender_rating_change, settled.result.defender.ratingChange);
  db.close();
});

test('concurrent/replayed settlement has one authoritative receipt, history row and economy mutation', async () => {
  const db = createDb();
  insertMatch(db, 'm-concurrent');
  const outcomes = await Promise.all([
    settle(db, 'm-concurrent', state('victory', 'team_a')),
    settle(db, 'm-concurrent', state('victory', 'team_a')),
    settle(db, 'm-concurrent', state('victory', 'team_a')),
  ]);
  assert.equal(outcomes.filter((entry) => !entry.replayed).length, 1);
  assert.equal(db.raw.prepare("SELECT attack_wins FROM arena_season_players WHERE character_id = 'char-10'").get().attack_wins, 1);
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-10'").get().arena_coin, 15);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_match_history WHERE match_id = 'm-concurrent'").get().c, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE receipt_key = 'arena:settlement:m-concurrent'").get().c, 1);
  db.close();
});

test('terminal combat commit is recovered into settlement on replay', async () => {
  const db = createDb();
  const match = insertMatch(db, 'm-crash-recovery', { status: 'done' });
  const terminalState = state('victory', 'team_a');
  db.raw.prepare("UPDATE arena_matches SET state_json = ?, result_json = ?, completed_at = '' WHERE match_id = 'm-crash-recovery'")
    .run(JSON.stringify(terminalState), JSON.stringify({ result: 'victory', winnerSide: 'team_a' }));
  db.raw.prepare("INSERT INTO arena_match_actions (match_id, action_key, action_seq, response_json, created_at) VALUES ('m-crash-recovery', 'action-1', 1, ?, '2026-09-28T12:00:00.000Z')")
    .run(JSON.stringify({ ok: true, matchId: 'm-crash-recovery', actionKey: 'action-1', result: { result: 'victory', winnerSide: 'team_a' } }));

  const recovered = await arena.arenaSettleStoredTerminalMatch(db, match, terminalState, Date.parse('2026-09-28T12:00:00.000Z'));
  assert.equal(recovered.result.settlementVersion, 1);
  assert.equal(recovered.result.result, 'win');
  assert.equal(recovered.result.resolution, 'normal');
  assert.equal(db.raw.prepare("SELECT attack_wins FROM arena_season_players WHERE character_id = 'char-10'").get().attack_wins, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_match_history WHERE match_id = 'm-crash-recovery'").get().c, 1);
  assert.notEqual(db.raw.prepare("SELECT completed_at FROM arena_matches WHERE match_id = 'm-crash-recovery'").get().completed_at, '');
  db.close();
});

test('terminal result completed before cutoff keeps normal settlement when recovered after cutoff', async () => {
  const db = createDb();
  insertMatch(db, 'm-precutoff-recovery', { status: 'done', rewardSlot: 'equal' });
  const terminalState = state('victory', 'team_a');
  db.raw.prepare("UPDATE arena_seasons SET ends_at = '2026-09-28T12:00:00.000Z' WHERE season_id = 'season-1'").run();
  db.raw.prepare("UPDATE arena_matches SET state_json = ?, result_json = ?, completed_at = '2026-09-28T11:59:59.000Z' WHERE match_id = 'm-precutoff-recovery'")
    .run(JSON.stringify(terminalState), JSON.stringify({ result: 'victory', winnerSide: 'team_a' }));

  const match = db.raw.prepare("SELECT * FROM arena_matches WHERE match_id = 'm-precutoff-recovery'").get();
  const recovered = await arena.arenaSettleStoredTerminalMatch(db, match, terminalState, Date.parse('2026-09-28T12:00:01.000Z'));
  assert.equal(recovered.result.resolution, 'normal');
  assert.equal(recovered.result.result, 'win');
  assert.equal(recovered.result.statsApplied, true);
  assert.equal(recovered.result.attacker.ratingChange > 0, true);
  assert.equal(db.raw.prepare("SELECT attack_wins FROM arena_season_players WHERE character_id = 'char-10'").get().attack_wins, 1);
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-10'").get().arena_coin, 15);
  const history = db.raw.prepare("SELECT resolution, arena_coin_earned FROM arena_match_history WHERE match_id = 'm-precutoff-recovery'").get();
  assert.equal(history.resolution, 'normal');
  assert.equal(history.arena_coin_earned, 15);
  db.close();
});

test('milestones and promotion rewards are exact-once and tier re-promotion does not duplicate', async () => {
  const db = createDb();
  db.raw.prepare("UPDATE arena_season_players SET rating = 1095, attack_wins = 4, attack_losses = 5 WHERE character_id = 'char-10'").run();
  db.raw.prepare("UPDATE players SET diamonds = 0 WHERE id = 'p1'").run();
  insertMatch(db, 'm-reward');
  const first = await settle(db, 'm-reward', state('victory', 'team_a'));
  assert.equal(first.result.milestones.length, 2);
  assert.equal(first.result.promotion.attacker.some((reward) => reward.tier === 1), true);
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-10'").get().arena_coin, 765);
  assert.equal(db.raw.prepare("SELECT diamonds FROM players WHERE id = 'p1'").get().diamonds, 100);
  const coinsBefore = db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-10'").get().arena_coin;
  db.raw.prepare("UPDATE arena_season_players SET rating = 1000 WHERE character_id = 'char-10'").run();
  insertMatch(db, 'm-repromote');
  const second = await settle(db, 'm-repromote', state('victory', 'team_a'));
  assert.equal(second.result.promotion.attacker.length, 0);
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-10'").get().arena_coin, coinsBefore + 15);
  assert.equal(db.raw.prepare("SELECT diamonds FROM players WHERE id = 'p1'").get().diamonds, 100);
  db.close();
});

test('cutoff grants only base loss coin and never changes rating, stats or rewards', async () => {
  const db = createDb();
  const match = insertMatch(db, 'm-cutoff', { status: 'active', rewardSlot: 'lower' });
  db.raw.prepare("UPDATE arena_season_players SET attack_wins = 49, highest_rewarded_tier = 0 WHERE character_id = 'char-10'").run();
  db.raw.prepare("UPDATE arena_seasons SET ends_at = '2026-09-28T11:00:00.000Z' WHERE season_id = 'season-1'").run();
  const first = await settle(db, match.match_id, state(null, null), 'cutoff');
  assert.equal(first.result.resolution, 'cutoff');
  assert.equal(first.result.attacker.ratingChange, 0);
  assert.equal(first.result.arenaCoin.earned, 3);
  assert.equal(first.result.statsApplied, false);
  assert.equal(first.result.seasonEligible, false);
  assert.equal(first.result.milestones.length, 0);
  assert.equal(first.result.promotion.attacker.length, 0);
  assert.equal(db.raw.prepare("SELECT rating, attack_losses FROM arena_season_players WHERE character_id = 'char-10'").get().rating, 1200);
  assert.equal(db.raw.prepare("SELECT attack_wins, attack_losses, highest_rewarded_tier FROM arena_season_players WHERE character_id = 'char-10'").get().attack_wins, 49);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_idempotency_receipts WHERE kind IN ('milestone', 'promotion', 'season_eligibility')").get().c, 0);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM arena_pair_season_stats").get().c, 0);
  assert.notEqual(db.raw.prepare("SELECT completed_at FROM arena_matches WHERE match_id = 'm-cutoff'").get().completed_at, '');
  assert.equal(db.raw.prepare("SELECT status FROM arena_matches WHERE match_id = 'm-cutoff'").get().status, 'done');
  db.close();
});

test('season progression material uses approved Mana Ore quantities', () => {
  assert.equal(arena.arenaSeasonRewardForRank(1).manaOre, 25);
  assert.equal(arena.arenaSeasonRewardForRank(2).manaOre, 20);
  assert.equal(arena.arenaSeasonRewardForRank(3).manaOre, 15);
  assert.equal(arena.arenaSeasonRewardForRank(4).manaOre, 10);
  assert.equal(arena.arenaSeasonRewardForRank(10).manaOre, 10);
  assert.equal(arena.arenaSeasonRewardForRank(11).manaOre, 0);
  assert.equal(arena.arenaSeasonRewardForRank(101).manaOre, 0);
});

test('season finalization ranks deterministically, pays currency/material once and resets next season by one tier', async () => {
  const db = createDb();
  db.raw.prepare("UPDATE arena_seasons SET status = 'finalizing' WHERE season_id = 'season-1'").run();
  db.raw.prepare("UPDATE arena_season_players SET rating = 1300, attack_wins = 2 WHERE character_id = 'char-10'").run();
  db.raw.prepare("UPDATE arena_season_players SET rating = 1400, attack_wins = 3 WHERE character_id = 'char-11'").run();
  db.raw.prepare("UPDATE players SET diamonds = 0").run();
  const result = await arena.arenaFinalizeSeason(db, { season_id: 'season-1', status: 'finalizing' }, Date.parse('2026-09-28T12:00:00.000Z'));
  assert.equal(result.finalized, true);
  assert.equal(db.raw.prepare("SELECT status FROM arena_seasons WHERE season_id = 'season-1'").get().status, 'finalized');
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-11'").get().arena_coin, 5000);
  assert.equal(db.raw.prepare("SELECT diamonds FROM players WHERE id = 'p2'").get().diamonds, 1000);
  const reward = db.raw.prepare("SELECT payload_json FROM arena_idempotency_receipts WHERE receipt_key = 'arena:season-reward:season-1:char-11'").get();
  const rewardPayload = JSON.parse(reward.payload_json);
  assert.deepEqual(rewardPayload.progressionMaterial, {
    enabled: true, junkId: 'manaOre', quantity: 25, delivery: 'mailbox',
    sourceKey: 'arena:season-reward:season-1:char-11'
  });
  const materialMail = db.raw.prepare("SELECT source_key, junk_json FROM mailbox WHERE source_key = 'arena:season-reward:season-1:char-11'").get();
  assert.ok(materialMail);
  assert.deepEqual(JSON.parse(materialMail.junk_json), [{ junkId: 'manaOre', quantity: 25 }]);
  await arena.arenaFinalizeSeason(db, { season_id: 'season-1', status: 'finalizing' }, Date.parse('2026-09-28T12:00:00.000Z'));
  assert.equal(db.raw.prepare("SELECT arena_coin FROM arena_character_state WHERE character_id = 'char-11'").get().arena_coin, 5000);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS c FROM mailbox WHERE source_key = 'arena:season-reward:season-1:char-11'").get().c, 1);
  db.raw.prepare("INSERT INTO arena_seasons (season_id, season_number, starts_at, ends_at, status, created_at, updated_at) VALUES ('season-2', 2, '2026-09-28T12:00:00.000Z', '2026-10-05T16:00:00.000Z', 'active', 'now', 'now')").run();
  const next = await arena.ensureArenaSeasonPlayer(db, { season_id: 'season-2', season_number: 2 }, { character_id: 'char-11' }, Date.parse('2026-09-28T12:00:00.000Z'));
  assert.equal(next.rating, 1100);
  db.close();
});

test('season finalization preserves terminal results completed before cutoff', async () => {
  const db = createDb();
  insertMatch(db, 'm-finalize-recovery', { status: 'done', rewardSlot: 'equal' });
  db.raw.prepare("UPDATE arena_seasons SET status = 'finalizing', ends_at = '2026-09-28T12:00:00.000Z' WHERE season_id = 'season-1'").run();
  db.raw.prepare("UPDATE arena_matches SET state_json = ?, result_json = ?, completed_at = '2026-09-28T11:59:59.000Z' WHERE match_id = 'm-finalize-recovery'")
    .run(JSON.stringify(state('victory', 'team_a')), JSON.stringify({ result: 'victory', winnerSide: 'team_a' }));

  await arena.arenaFinalizeSeason(db, { season_id: 'season-1', status: 'finalizing' }, Date.parse('2026-09-28T12:00:01.000Z'));
  const stored = JSON.parse(db.raw.prepare("SELECT result_json FROM arena_matches WHERE match_id = 'm-finalize-recovery'").get().result_json);
  assert.equal(stored.settlementVersion, 1);
  assert.equal(stored.resolution, 'normal');
  assert.equal(stored.result, 'win');
  assert.equal(db.raw.prepare("SELECT attack_wins FROM arena_season_players WHERE character_id = 'char-10'").get().attack_wins, 1);
  const history = db.raw.prepare("SELECT resolution, arena_coin_earned FROM arena_match_history WHERE match_id = 'm-finalize-recovery'").get();
  assert.equal(history.resolution, 'normal');
  assert.equal(history.arena_coin_earned, 15);
  db.close();
});

test('live rank tie-break uses rating, attack wins, reached time and character id', () => {
  const db = createDb();
  db.raw.prepare("UPDATE arena_season_players SET rating = 1200, attack_wins = 3, rating_reached_at = '2026-09-28T12:00:00.000Z' WHERE season_id = 'season-1'").run();
  const clause = arena.arenaRankAheadSql();
  const row = db.raw.prepare(`
    SELECT COUNT(*) AS c FROM arena_season_players p
    WHERE p.season_id = ? AND ${clause}
  `).get('season-1', 1200, 1200, 3, 1200, 3, '2026-09-28T12:00:00.000Z', '2026-09-28T12:00:00.000Z', 'char-11');
  assert.equal(row.c, 1);
  db.close();
});
