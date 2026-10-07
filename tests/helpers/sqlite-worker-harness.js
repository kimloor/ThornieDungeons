const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./worker-source");
const { applyRequiredAutoMigrations } = require("./auto-migrations");

class Statement {
  constructor(owner, sql, values = []) { this.owner = owner; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.owner, this.sql, values); }
  async first() { this.owner.calls += 1; return this.owner.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { this.owner.calls += 1; return { results: this.owner.raw.prepare(this.sql).all(...this.values) }; }
  async run() {
    this.owner.calls += 1;
    const normalized = this.sql.trim().toUpperCase();
    if (/^(SELECT|PRAGMA)\b/.test(normalized)) return { results: this.owner.raw.prepare(this.sql).all(...this.values) };
    const result = this.owner.raw.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}

class CountingD1 {
  constructor() { this.raw = new DatabaseSync(":memory:"); this.calls = 0; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    this.calls += 1;
    const out = [];
    for (const statement of statements) {
      const normalized = statement.sql.trim().toUpperCase();
      if (/^(SELECT|PRAGMA)\\b/.test(normalized)) {
        out.push({ results: this.raw.prepare(statement.sql).all(...statement.values) });
      } else {
        const result = this.raw.prepare(statement.sql).run(...statement.values);
        out.push({ meta: { changes: Number(result.changes) } });
      }
    }
    return out;
  }
  resetCount() { this.calls = 0; }
  count() { return this.calls; }
}

function createDatabase() {
  const db = new CountingD1();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL, diamonds INTEGER DEFAULT 0, active_slot INTEGER, created_at TEXT NOT NULL);
    CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, slot_index INTEGER NOT NULL, name TEXT DEFAULT '', level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, stat_points INTEGER DEFAULT 0, str INTEGER DEFAULT 0, vit INTEGER DEFAULT 0, agi INTEGER DEFAULT 0, dex INTEGER DEFAULT 0, luk INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, unlocked_floor INTEGER DEFAULT 1, potions INTEGER DEFAULT 2, protection_stones INTEGER DEFAULT 0, chest_pity INTEGER DEFAULT 0, pets_json TEXT DEFAULT '[]', active_pet_id TEXT DEFAULT '', created_at TEXT, updated_at TEXT, last_active_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE items (item_id TEXT PRIMARY KEY, player_id TEXT, character_id TEXT, slot_type TEXT, equipped INTEGER DEFAULT 0, inventory_slot TEXT, item_template_id TEXT, rarity TEXT, name TEXT, item_level INTEGER DEFAULT 0, enhance_level INTEGER DEFAULT 0, bound INTEGER DEFAULT 0, quantity INTEGER DEFAULT 1, atk INTEGER DEFAULT 0, def INTEGER DEFAULT 0, hp INTEGER DEFAULT 0, mp INTEGER DEFAULT 0, extra_json TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE run_state (player_id TEXT PRIMARY KEY, floor INTEGER, level INTEGER, xp INTEGER, hp INTEGER, mp INTEGER, base_atk INTEGER, base_def INTEGER, base_max_hp INTEGER, base_max_mp INTEGER, run_gold INTEGER, potions INTEGER, updated_at TEXT, character_id TEXT);
    CREATE TABLE progress (player_id TEXT PRIMARY KEY, bank_gold INTEGER, diamonds INTEGER, best_floor INTEGER, potions INTEGER, char_level INTEGER, char_xp INTEGER, char_points INTEGER, char_str INTEGER, char_vit INTEGER, char_dex INTEGER, char_luk INTEGER, pets_json TEXT, active_pet_id TEXT, updated_at TEXT, character_id TEXT);
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "..", "fixtures/auth-v2-schema.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "..", "..", "migrations/auto/0012_battle_persistence_v1.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "..", "..", "migrations/auto/0013_pet_run_state_v1.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "..", "..", "migrations/auto/0026_w45_authority_receipts.sql"), "utf8"));
  applyRequiredAutoMigrations(db, path.resolve(__dirname, "..", ".."));
  return db;
}

function createWorker(runtimeConsole = console) {
  let source = loadWorkerSource(path.resolve(__dirname, "..", ".."));
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console: runtimeConsole, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__worker;
}

async function post(api, db, token, body) {
  const response = await api.fetch(
    new Request("https://api.test", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body)
    }),
    { DB: db }
  );
  return { status: response.status, body: await response.json() };
}

async function setupCharacter(api, db, prefix, { gold = 0, unlockedFloor = 1 } = {}) {
  const registration = await post(api, db, "", { action: "register", id: prefix, password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(api, db, token, { action: "createCharacter", slotIndex: 0, name: prefix });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET gold = ?, unlocked_floor = ? WHERE character_id = ?").run(gold, unlockedFloor, characterId);
  const playerId = db.raw.prepare("SELECT player_id FROM characters WHERE character_id = ?").get(characterId).player_id;
  db.resetCount();
  return { token, characterId, playerId };
}

module.exports = { createDatabase, createWorker, post, setupCharacter };
