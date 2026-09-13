const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const migrationSql = fs.readFileSync(
  path.join(__dirname, "../migrations/auto/0012_battle_persistence_v1.sql"),
  "utf8"
);

function legacyDatabase() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      active_slot INTEGER
    );
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL
    );
    CREATE TABLE run_state (
      player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
      floor INTEGER NOT NULL DEFAULT 1,
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      hp INTEGER NOT NULL DEFAULT 0,
      mp INTEGER NOT NULL DEFAULT 0,
      base_atk INTEGER NOT NULL DEFAULT 0,
      base_def INTEGER NOT NULL DEFAULT 0,
      base_max_hp INTEGER NOT NULL DEFAULT 0,
      base_max_mp INTEGER NOT NULL DEFAULT 0,
      run_gold INTEGER NOT NULL DEFAULT 0,
      potions INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      character_id TEXT
    );
  `);
  return db;
}

test("V12 copies the active legacy character and makes character upsert valid", () => {
  const db = legacyDatabase();
  db.exec(`
    INSERT INTO players (id, active_slot) VALUES ('player-a', 1);
    INSERT INTO characters (character_id, player_id, slot_index) VALUES
      ('char-a0', 'player-a', 0),
      ('char-a1', 'player-a', 1);
    INSERT INTO run_state (player_id, floor, hp, updated_at, character_id)
      VALUES ('player-a', 4, 19, 'old', NULL);
  `);

  db.exec(migrationSql);

  assert.deepEqual(
    { ...db.prepare("SELECT character_id, floor, hp FROM character_run_state").get() },
    { character_id: "char-a1", floor: 4, hp: 19 }
  );
  assert.equal(db.prepare("SELECT character_id FROM run_state WHERE player_id = 'player-a'").get().character_id, null);

  db.prepare(`
    INSERT INTO character_run_state (character_id, floor, hp, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(character_id) DO UPDATE SET
      floor = excluded.floor,
      hp = excluded.hp,
      updated_at = excluded.updated_at
  `).run("char-a1", 5, 31, "new");

  assert.deepEqual(
    { ...db.prepare("SELECT character_id, floor, hp, updated_at FROM character_run_state WHERE character_id = ?").get("char-a1") },
    { character_id: "char-a1", floor: 5, hp: 31, updated_at: "new" }
  );
});

test("V12 permits isolated checkpoints for multiple characters", () => {
  const db = legacyDatabase();
  db.exec(`
    INSERT INTO players (id, active_slot) VALUES ('player-a', 0);
    INSERT INTO characters (character_id, player_id, slot_index) VALUES
      ('char-a0', 'player-a', 0),
      ('char-a1', 'player-a', 1);
  `);
  db.exec(migrationSql);

  const save = db.prepare(`
    INSERT INTO character_run_state (character_id, floor, hp, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(character_id) DO UPDATE SET
      floor = excluded.floor,
      hp = excluded.hp,
      updated_at = excluded.updated_at
  `);
  save.run("char-a0", 2, 20, "a0");
  save.run("char-a1", 8, 80, "a1");

  assert.deepEqual(
    db.prepare("SELECT character_id, floor, hp FROM character_run_state ORDER BY character_id").all().map(row => ({ ...row })),
    [
      { character_id: "char-a0", floor: 2, hp: 20 },
      { character_id: "char-a1", floor: 8, hp: 80 }
    ]
  );
});

test("V12 refuses ambiguous duplicate character checkpoints", () => {
  const db = legacyDatabase();
  db.exec(`
    INSERT INTO players (id, active_slot) VALUES ('player-a', 0), ('player-b', 0);
    INSERT INTO characters (character_id, player_id, slot_index) VALUES
      ('char-shared', 'player-a', 0),
      ('char-b', 'player-b', 0);
    INSERT INTO run_state (player_id, floor, hp, updated_at, character_id) VALUES
      ('player-a', 1, 10, 'a', 'char-shared'),
      ('player-b', 2, 20, 'b', 'char-shared');
  `);

  assert.throws(() => db.exec(migrationSql), /UNIQUE constraint failed/);
});
