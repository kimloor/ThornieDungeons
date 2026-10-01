const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const worker = fs.readFileSync(path.join(ROOT, 'workers/thornie-dungeons-api.js'), 'utf8');
const api = fs.readFileSync(path.join(ROOT, 'src/state/api.js'), 'utf8');
const ui = fs.readFileSync(path.join(ROOT, 'src/ui/components.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');
const cleanupMigration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0025_arena_v1_cleanup.sql'), 'utf8');

test('W9 closeout removes legacy Arena V1 runtime entry points', () => {
  for (const route of ['getArenaStatus', 'getArenaOpponents', 'startArenaMatch', 'submitArenaTurn']) {
    assert.equal(worker.includes('"' + route + '"') || worker.includes("'" + route + "'"), false, route);
  }
  for (const helper of ['cloudGetArenaStatus', 'cloudGetArenaOpponents', 'cloudStartArenaMatch', 'cloudSubmitArenaTurn']) {
    assert.doesNotMatch(api, new RegExp('function ' + helper + '\\b'));
  }
  assert.doesNotMatch(ui, /function ArenaScreen\b|function ArenaLobby\b|PVP_TICKET_MAX_CLIENT/);
  assert.doesNotMatch(styles, /\.md-pvp-stage\b|\.md-pvp-unit\b|\.md-pvp-skill-btn\b/);
});

test('global Arena leaderboard compatibility key reads authoritative V2 season data', () => {
  assert.match(worker, /if \(board === "pvp"\)/);
  assert.match(worker, /FROM arena_season_players p/);
  assert.match(worker, /JOIN characters c ON c\.character_id = p\.character_id/);
  assert.match(worker, /ORDER BY p\.rating DESC, p\.attack_wins DESC, p\.rating_reached_at ASC, p\.character_id ASC/);
  assert.doesNotMatch(worker, /FROM pvp_ranking/);
});

test('Arena V2 runtime remains present after V1 cutover', () => {
  for (const route of ['getArenaV2Status', 'getArenaV2Opponents', 'prepareArenaV2Match', 'activateArenaV2Match', 'submitArenaV2Action']) {
    assert.match(worker, new RegExp(route));
  }
  assert.match(ui, /function ArenaV2Screen\b/);
  assert.match(api, /function cloudGetArenaV2Status\b/);
});

test('0025 drops retired V1 tables while preserving V2 and unrelated player data', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pvp_tickets INTEGER NOT NULL DEFAULT 5,
      pvp_tickets_updated_at TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE items (item_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, name TEXT NOT NULL);
    CREATE TABLE arena_seasons (season_id TEXT PRIMARY KEY, season_number INTEGER NOT NULL);
    CREATE TABLE arena_season_players (
      season_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      PRIMARY KEY (season_id, character_id)
    );
    CREATE TABLE pvp_ranking (character_id TEXT PRIMARY KEY, rating INTEGER NOT NULL);
    CREATE TABLE pvp_snapshots (character_id TEXT PRIMARY KEY, stats_json TEXT NOT NULL);
    CREATE TABLE pvp_match_log (match_id TEXT PRIMARY KEY, result TEXT NOT NULL);
    CREATE TABLE pvp_matches (match_id TEXT PRIMARY KEY, state_json TEXT NOT NULL);

    INSERT INTO characters (character_id, name, pvp_tickets, pvp_tickets_updated_at)
      VALUES ('char-1', 'Keep Me', 3, 'legacy-marker');
    INSERT INTO items (item_id, character_id, name) VALUES ('item-1', 'char-1', 'Keep Item');
    INSERT INTO arena_seasons (season_id, season_number) VALUES ('season-v2', 1);
    INSERT INTO arena_season_players (season_id, character_id, rating) VALUES ('season-v2', 'char-1', 1234);
    INSERT INTO pvp_ranking VALUES ('char-1', 9999);
    INSERT INTO pvp_snapshots VALUES ('char-1', '{}');
    INSERT INTO pvp_match_log VALUES ('old-log', 'win');
    INSERT INTO pvp_matches VALUES ('old-match', '{}');
  `);

  db.exec(cleanupMigration);

  const tableNames = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name));
  for (const retired of ['pvp_matches', 'pvp_match_log', 'pvp_snapshots', 'pvp_ranking']) {
    assert.equal(tableNames.has(retired), false, retired);
  }
  for (const retained of ['characters', 'items', 'arena_seasons', 'arena_season_players']) {
    assert.equal(tableNames.has(retained), true, retained);
  }

  const character = db.prepare("SELECT name, pvp_tickets, pvp_tickets_updated_at FROM characters WHERE character_id = 'char-1'").get();
  assert.equal(character.name, 'Keep Me');
  assert.equal(character.pvp_tickets, 3);
  assert.equal(character.pvp_tickets_updated_at, 'legacy-marker');
  assert.equal(db.prepare("SELECT name FROM items WHERE item_id = 'item-1'").get().name, 'Keep Item');
  assert.equal(db.prepare("SELECT rating FROM arena_season_players WHERE character_id = 'char-1'").get().rating, 1234);
  db.close();
});
