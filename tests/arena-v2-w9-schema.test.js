const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ADMIN_MIGRATION_PATH = path.join(__dirname, '../migrations/auto/0022_admin_v2_auth.sql');
const MIGRATION_PATH = path.join(__dirname, '../migrations/auto/0023_arena_v2_foundation.sql');
const adminMigrationSql = fs.readFileSync(ADMIN_MIGRATION_PATH, 'utf8');
const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

const NEW_TABLES = [
  'arena_seasons', 'arena_character_state', 'arena_setup', 'arena_season_players',
  'arena_pair_season_stats', 'arena_opponent_state', 'arena_matches',
  'arena_match_actions', 'arena_match_history', 'arena_idempotency_receipts',
  'profile_frame_entitlements', 'character_profile_frame_state',
];

const INDEXES = [
  'idx_arena_seasons_one_active', 'idx_arena_seasons_ends_at',
  'idx_arena_season_players_leaderboard', 'idx_arena_season_players_character',
  'idx_arena_season_players_pool', 'idx_arena_pair_character_b',
  'idx_arena_matches_open_attacker', 'idx_arena_matches_season_attacker',
  'idx_arena_matches_season_defender', 'idx_arena_matches_active_deadline',
  'idx_arena_matches_prepared_expiry', 'idx_arena_history_attack',
  'idx_arena_history_defense', 'idx_arena_receipts_character',
  'idx_arena_receipts_season', 'idx_profile_frame_entitlement_lookup',
];

const LEGACY_COLUMNS = {
  pvp_snapshots: ['character_id', 'player_id', 'name', 'stats_json', 'updated_at'],
  pvp_ranking: ['character_id', 'player_id', 'name', 'rating', 'wins', 'losses', 'updated_at'],
  pvp_match_log: ['id', 'attacker_character_id', 'defender_character_id', 'result', 'rating_change', 'created_at'],
  pvp_matches: ['match_id', 'attacker_character_id', 'attacker_player_id', 'defender_character_id', 'status', 'turn', 'state_json', 'result_json', 'created_at', 'updated_at'],
};

function createPreProductionDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      level INTEGER NOT NULL DEFAULT 1,
      pvp_tickets INTEGER NOT NULL DEFAULT 5,
      pvp_tickets_updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE pvp_snapshots (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      stats_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL
    );
    CREATE TABLE pvp_ranking (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 1000,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE pvp_match_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attacker_character_id TEXT NOT NULL REFERENCES characters(character_id),
      defender_character_id TEXT NOT NULL REFERENCES characters(character_id),
      result TEXT NOT NULL,
      rating_change INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE pvp_matches (
      match_id TEXT PRIMARY KEY,
      attacker_character_id TEXT NOT NULL REFERENCES characters(character_id),
      attacker_player_id TEXT NOT NULL,
      defender_character_id TEXT NOT NULL REFERENCES characters(character_id),
      status TEXT NOT NULL DEFAULT 'active',
      turn INTEGER NOT NULL DEFAULT 0,
      state_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO players (id) VALUES (?)').run('player-a');
  db.prepare('INSERT INTO players (id) VALUES (?)').run('player-b');
  db.prepare('INSERT INTO players (id) VALUES (?)').run('admin');
  const character = db.prepare(`
    INSERT INTO characters (character_id, player_id, slot_index, name, level)
    VALUES (?, ?, ?, ?, ?)
  `);
  character.run('char-10', 'player-a', 0, 'Ten', 10);
  character.run('char-12', 'player-a', 1, 'Twelve', 12);
  character.run('char-5', 'player-a', 2, 'Five', 5);
  character.run('char-other', 'player-b', 0, 'Other', 10);
  // Verify the production sequence: Admin V2 claims 0022, then Arena V2
  // applies additively as 0023 without damaging Admin or Arena V1 state.
  db.exec(adminMigrationSql);
  db.exec(migrationSql);
  return db;
}

function tableNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
}

function indexNames(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name);
}

function columns(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

function throwsConstraint(fn) {
  assert.throws(fn, /constraint|unique|check|foreign key/i);
}

function addSeason(db, seasonId = 'season-1', status = 'active') {
  db.prepare(`
    INSERT INTO arena_seasons
      (season_id, season_number, starts_at, ends_at, status, created_at, updated_at)
    VALUES (?, ?, '2026-01-01T00:00:00Z', '2026-01-08T00:00:00Z', ?, 'now', 'now')
  `).run(seasonId, Number(seasonId.replace(/\D/g, '') || 1), status);
}

function addSeasonPlayer(db, seasonId = 'season-1', characterId = 'char-10') {
  db.prepare(`
    INSERT INTO arena_season_players
      (season_id, character_id, rating_reached_at, created_at, updated_at)
    VALUES (?, ?, '2026-01-01T00:00:00Z', 'now', 'now')
  `).run(seasonId, characterId);
}

function addMatch(db, matchId, attackerId = 'char-10', defender = { type: 'player', characterId: 'char-5', botId: '' }, status = 'prepared') {
  db.prepare(`
    INSERT INTO arena_matches (
      match_id, season_id, attacker_character_id, defender_type, defender_character_id,
      defender_bot_id, source, reward_slot, status, seed, snapshot_json,
      prepared_at, prepared_expires_at, created_at, updated_at
    ) VALUES (?, 'season-1', ?, ?, ?, ?, 'matchmaking', 'equal', ?, 1, '{}', 'now', 'later', 'now', 'now')
  `).run(matchId, attackerId, defender.type, defender.characterId ?? null, defender.botId ?? '', status);
}

test('0022 Admin then 0023 Arena applies, creates locked tables/indexes, and preserves V1 schema', () => {
  const db = createPreProductionDatabase();
  assert.deepEqual(NEW_TABLES.every((name) => tableNames(db).includes(name)), true);
  assert.deepEqual(INDEXES.every((name) => indexNames(db).includes(name)), true);
  assert.deepEqual(['admin_users', 'admin_sessions', 'admin_audit_log'].every((name) => tableNames(db).includes(name)), true);
  const owner = db.prepare("SELECT player_id, role, enabled FROM admin_users WHERE player_id = 'admin'").get();
  assert.equal(owner.player_id, 'admin');
  assert.equal(owner.role, 'owner');
  assert.equal(owner.enabled, 1);
  for (const [table, expected] of Object.entries(LEGACY_COLUMNS)) assert.deepEqual(columns(db, table), expected);
  assert.deepEqual(columns(db, 'characters').filter((name) => name.startsWith('pvp_')), ['pvp_tickets', 'pvp_tickets_updated_at']);
  db.close();
});

test('level backfill suppresses unlock notice only for existing level 10+', () => {
  const db = createPreProductionDatabase();
  const states = db.prepare('SELECT character_id, arena_coin, tickets, unlock_notice_seen FROM arena_character_state ORDER BY character_id').all().map((row) => ({ ...row }));
  assert.deepEqual(states, [
    { character_id: 'char-10', arena_coin: 0, tickets: 0, unlock_notice_seen: 1 },
    { character_id: 'char-12', arena_coin: 0, tickets: 0, unlock_notice_seen: 1 },
    { character_id: 'char-other', arena_coin: 0, tickets: 0, unlock_notice_seen: 1 },
  ]);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM arena_character_state WHERE character_id = 'char-5'").get().count, 0);
  db.close();
});

test('coin, ticket, rating, and active-season constraints are enforced', () => {
  const db = createPreProductionDatabase();
  throwsConstraint(() => db.prepare("UPDATE arena_character_state SET arena_coin = -1 WHERE character_id = 'char-10'").run());
  throwsConstraint(() => db.prepare("UPDATE arena_character_state SET tickets = -1 WHERE character_id = 'char-10'").run());
  throwsConstraint(() => db.prepare("UPDATE arena_character_state SET tickets = 11 WHERE character_id = 'char-10'").run());
  addSeason(db);
  throwsConstraint(() => addSeason(db, 'season-2'));
  addSeason(db, 'season-2', 'finalized');
  addSeason(db, 'season-3', 'finalizing');
  throwsConstraint(() => db.prepare("INSERT INTO arena_season_players (season_id, character_id, rating_reached_at, rating) VALUES ('season-2', 'char-10', 'now', 999)").run());
  db.close();
});

test('open attacker guard and player/bot defender shapes are enforced', () => {
  const db = createPreProductionDatabase();
  addSeason(db);
  addMatch(db, 'match-1');
  throwsConstraint(() => addMatch(db, 'match-2'));
  db.prepare("UPDATE arena_matches SET status = 'done' WHERE match_id = 'match-1'").run();
  addMatch(db, 'match-2');
  db.prepare("UPDATE arena_matches SET status = 'expired' WHERE match_id = 'match-2'").run();
  addMatch(db, 'match-3');
  throwsConstraint(() => addMatch(db, 'bad-player', 'char-12', { type: 'player', characterId: null, botId: 'bot-x' }));
  db.prepare("UPDATE arena_matches SET status = 'done' WHERE match_id = 'match-3'").run();
  throwsConstraint(() => addMatch(db, 'bad-bot', 'char-12', { type: 'bot', characterId: 'char-5', botId: '' }));
  db.prepare("UPDATE arena_matches SET status = 'done' WHERE match_id = 'match-3'").run();
  addMatch(db, 'valid-bot', 'char-12', { type: 'bot', characterId: null, botId: 'bot-x' });
  db.close();
});

test('pair rows require canonical distinct character order', () => {
  const db = createPreProductionDatabase();
  addSeason(db);
  const insert = db.prepare("INSERT INTO arena_pair_season_stats (season_id, character_id_a, character_id_b, updated_at) VALUES ('season-1', ?, ?, 'now')");
  insert.run('char-10', 'char-12');
  throwsConstraint(() => insert.run('char-12', 'char-10'));
  throwsConstraint(() => insert.run('char-10', 'char-10'));
  throwsConstraint(() => insert.run('char-10', 'char-12'));
  db.close();
});

test('match action and generic receipt identities are exact-once', () => {
  const db = createPreProductionDatabase();
  addSeason(db);
  addMatch(db, 'match-1');
  const action = db.prepare("INSERT INTO arena_match_actions (match_id, action_key, action_seq, response_json, created_at) VALUES ('match-1', ?, ?, '{}', 'now')");
  action.run('a', 1);
  throwsConstraint(() => action.run('a', 2));
  throwsConstraint(() => action.run('b', 1));
  db.prepare("INSERT INTO arena_idempotency_receipts (receipt_key, kind, payload_json, created_at) VALUES ('receipt-1', 'test', '{}', 'now')").run();
  throwsConstraint(() => db.prepare("INSERT INTO arena_idempotency_receipts (receipt_key, kind, payload_json, created_at) VALUES ('receipt-1', 'test', '{}', 'now')").run());
  db.close();
});

test('history identity, profile-frame source uniqueness, expiry storage, and empty equip state work', () => {
  const db = createPreProductionDatabase();
  addSeason(db);
  addMatch(db, 'match-1');
  const history = db.prepare(`
    INSERT INTO arena_match_history
      (match_id, season_id, attacker_character_id, defender_type, defender_character_id,
       attacker_result, resolution, completed_at)
    VALUES ('match-1', 'season-1', 'char-10', 'player', 'char-5', 'win', 'normal', 'now')
  `);
  history.run();
  throwsConstraint(() => history.run());
  const entitlement = db.prepare(`
    INSERT INTO profile_frame_entitlements
      (entitlement_id, character_id, frame_key, source_type, source_key, granted_at, expires_at, created_at, updated_at)
    VALUES (?, 'char-10', 'arena_rank_1', 'season_reward', ?, 'now', 'past', 'now', 'now')
  `);
  entitlement.run('ent-1', 'season-1');
  throwsConstraint(() => entitlement.run('ent-2', 'season-1'));
  entitlement.run('ent-3', 'season-2');
  db.prepare("INSERT INTO character_profile_frame_state (character_id, equipped_frame_key, updated_at) VALUES ('char-10', '', 'now')").run();
  assert.equal(db.prepare("SELECT expires_at FROM profile_frame_entitlements WHERE entitlement_id = 'ent-1'").get().expires_at, 'past');
  db.close();
});

test('deleting a character cascades Arena-owned rows but leaves another character intact', () => {
  const db = createPreProductionDatabase();
  addSeason(db);
  addSeasonPlayer(db, 'season-1', 'char-10');
  addSeasonPlayer(db, 'season-1', 'char-other');
  db.prepare("INSERT INTO arena_setup (character_id, initialized_at, updated_at) VALUES ('char-10', 'now', 'now'), ('char-other', 'now', 'now')").run();
  db.prepare("INSERT INTO arena_opponent_state (season_id, character_id, updated_at) VALUES ('season-1', 'char-10', 'now'), ('season-1', 'char-other', 'now')").run();
  db.prepare("INSERT INTO arena_pair_season_stats (season_id, character_id_a, character_id_b, updated_at) VALUES ('season-1', 'char-10', 'char-other', 'now')").run();
  addMatch(db, 'match-1', 'char-10', { type: 'player', characterId: 'char-other', botId: '' });
  db.prepare("INSERT INTO arena_match_actions (match_id, action_key, action_seq, response_json, created_at) VALUES ('match-1', 'a', 1, '{}', 'now')").run();
  db.prepare("INSERT INTO arena_idempotency_receipts (receipt_key, kind, character_id, match_id, payload_json, created_at) VALUES ('receipt-1', 'test', 'char-10', 'match-1', '{}', 'now')").run();
  db.prepare("INSERT INTO profile_frame_entitlements (entitlement_id, character_id, frame_key, granted_at, created_at, updated_at) VALUES ('ent-1', 'char-10', 'arena_rank_1', 'now', 'now', 'now')").run();
  db.prepare("INSERT INTO character_profile_frame_state (character_id, equipped_frame_key, updated_at) VALUES ('char-10', '', 'now'), ('char-other', '', 'now')").run();
  db.prepare("DELETE FROM characters WHERE character_id = 'char-10'").run();
  const ownedRows = [
    ['arena_character_state', 'character_id'],
    ['arena_setup', 'character_id'],
    ['arena_season_players', 'character_id'],
    ['arena_opponent_state', 'character_id'],
    ['arena_matches', 'attacker_character_id'],
    ['arena_pair_season_stats', 'character_id_a'],
    ['profile_frame_entitlements', 'character_id'],
    ['character_profile_frame_state', 'character_id'],
  ];
  for (const [table, column] of ownedRows) assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column} = 'char-10'`).get().count, 0, table);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM arena_season_players WHERE character_id = 'char-other'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM characters WHERE character_id = 'char-other'").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM pvp_matches").get().count, 0);
  db.close();
});

test('migration is additive and does not destroy Arena V1 objects', () => {
  const upper = migrationSql.toUpperCase();
  assert.doesNotMatch(upper, /\bDROP\s+TABLE\b/);
  assert.doesNotMatch(upper, /\bDELETE\s+FROM\s+(PVP_|CHARACTERS)/);
  assert.doesNotMatch(upper, /\bALTER\s+TABLE\s+(PVP_|CHARACTERS)/);
});
