// W2-A (ADMIN-V2.md 22.3): every Admin mutation writes exactly one admin_audit_log row,
// atomically with the mutation, with redacted non-secret before/after detail.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const nodeCrypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");

class D1Statement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new D1Statement(this.database, this.sql, values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  async run() { const r = this.database.prepare(this.sql).run(...this.values); return { meta: { changes: Number(r.changes) } }; }
}
class D1Database {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new D1Statement(this.raw, sql); }
  async batch(statements) {
    const results = [];
    this.raw.exec("BEGIN");
    try {
      for (const s of statements) results.push(await s.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) { this.raw.exec("ROLLBACK"); throw error; }
  }
}

function loadWorker() {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {");
  source += `\nglobalThis.__worker = workerDefault;\nglobalThis.__h = {
    handleAdminSaveGameConfig, handleAdminSetGameConfigItem, handleAdminUpsertRecipe, handleAdminDeleteRecipe,
    handleAdminUpsertMonsterLootEntry, handleAdminDeleteMonsterLootEntry, handleAdminUpsertJunkInfo, handleAdminDeleteJunkInfo
  };\n`;
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { h: sandbox.__h, worker: sandbox.__worker };
}
const { h, worker } = loadWorker();

function createDb() {
  const db = new D1Database();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE game_config (key TEXT PRIMARY KEY, value_json TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
    CREATE TABLE recipes (recipe_id TEXT PRIMARY KEY, result_item_def TEXT NOT NULL, materials_json TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE monster_loot (entry_id TEXT PRIMARY KEY, monster_id TEXT NOT NULL, kind TEXT NOT NULL, item_type TEXT, rarity TEXT, junk_id TEXT, qty_min INTEGER DEFAULT 1, qty_max INTEGER DEFAULT 1, weight REAL DEFAULT 1, drop_chance REAL DEFAULT 1.0, created_at TEXT, updated_at TEXT);
    CREATE TABLE junk_info (junk_id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '📦', created_at TEXT, updated_at TEXT);
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0022_admin_v2_auth.sql"), "utf8").replace(/ALTER TABLE players[^;]*;/g, ""));
  db.raw.prepare("INSERT INTO players (id) VALUES ('Admin_1')").run();
  return db;
}
const ADMIN = { ok: true, playerId: "Admin_1", role: "admin" };
const audits = (db) => db.raw.prepare("SELECT * FROM admin_audit_log ORDER BY rowid").all()
  .map((r) => ({ ...r, meta: JSON.parse(r.metadata_json) }));
const failAudit = (db) => db.raw.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_log BEGIN SELECT RAISE(ABORT, 'audit down'); END;`);
const j = async (res) => ({ status: res.status, ...(await res.json()) });

test("saveGameConfig audits only changed keys, atomically, with actor", async () => {
  const db = createDb();
  db.raw.prepare("INSERT INTO game_config VALUES ('a','1','t0'),('b','\"x\"','t0')").run();
  const res = await j(await h.handleAdminSaveGameConfig(db, ADMIN, { a: 1, b: "y", c: { n: 3 } }));
  assert.equal(res.ok, true);
  const rows = audits(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_type, "ADMIN_GAME_CONFIG_SAVE");
  assert.equal(rows[0].player_id, "Admin_1");
  assert.equal(rows[0].target_type, "game_config");
  assert.equal(rows[0].target_id, "*");
  assert.deepEqual(rows[0].meta.changedKeys.sort(), ["b", "c"]);
  assert.deepEqual(rows[0].meta.before, { b: "x", c: null });
  assert.deepEqual(rows[0].meta.after, { b: "y", c: { n: 3 } });
  assert.equal(db.raw.prepare("SELECT value_json FROM game_config WHERE key='b'").get().value_json, '"y"');
});

test("setGameConfigItem audits insert, change, and identical-value no-op", async () => {
  const db = createDb();
  await h.handleAdminSetGameConfigItem(db, ADMIN, "k", { v: 1 });
  await h.handleAdminSetGameConfigItem(db, ADMIN, "k", { v: 2 });
  await h.handleAdminSetGameConfigItem(db, ADMIN, "k", { v: 2 });
  const rows = audits(db);
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.event_type === "ADMIN_GAME_CONFIG_SET" && r.target_id === "k"));
  assert.equal(rows[0].meta.before, null);
  assert.deepEqual(rows[1].meta.before, { value: { v: 1 } });
  assert.deepEqual(rows[1].meta.after, { value: { v: 2 } });
  assert.deepEqual(rows[1].meta.changedKeys, ["k"]);
  assert.deepEqual(rows[2].meta.changedKeys, []);
});

test("recipe upsert/delete audit full before/after", async () => {
  const db = createDb();
  await h.handleAdminUpsertRecipe(db, ADMIN, "r1", "sword", "Blade", "azure", 5, { iron: 2 });
  await h.handleAdminUpsertRecipe(db, ADMIN, "r1", "sword", "Blade+", "azure", 5, { iron: 3 });
  await h.handleAdminDeleteRecipe(db, ADMIN, "r1", "test cleanup", "r1");
  const rows = audits(db);
  assert.deepEqual(rows.map((r) => r.event_type), ["ADMIN_RECIPE_UPSERT", "ADMIN_RECIPE_UPSERT", "ADMIN_RECIPE_DELETE"]);
  assert.ok(rows.every((r) => r.target_type === "recipe" && r.target_id === "r1" && r.player_id === "Admin_1"));
  assert.equal(rows[0].meta.before, null);
  assert.equal(rows[0].meta.after.source, "admin");
  assert.deepEqual(rows[1].meta.changedKeys.sort(), ["materials", "result_item_def"]);
  assert.deepEqual(rows[1].meta.before.materials, { iron: 2 });
  assert.deepEqual(rows[1].meta.after.materials, { iron: 3 });
  assert.equal(rows[2].meta.after, null);
  assert.deepEqual(rows[2].meta.before.materials, { iron: 3 });
  assert.equal(db.raw.prepare("SELECT COUNT(*) c FROM recipes").get().c, 0);
});

test("monster loot upsert/delete audit; after-state mirrors the stored row", async () => {
  const db = createDb();
  const entry = { entryId: "e1", monsterId: "slime", kind: "gear", itemType: "sword", rarity: "rare", qtyMin: 1, qtyMax: 2, weight: 3, dropChance: 0.5 };
  assert.equal((await j(await h.handleAdminUpsertMonsterLootEntry(db, ADMIN, entry))).entryId, "e1");
  await h.handleAdminUpsertMonsterLootEntry(db, ADMIN, { ...entry, weight: 9 });
  await h.handleAdminDeleteMonsterLootEntry(db, ADMIN, "e1", "test cleanup", "e1");
  const rows = audits(db);
  assert.deepEqual(rows.map((r) => r.event_type), ["ADMIN_MONSTER_LOOT_UPSERT", "ADMIN_MONSTER_LOOT_UPSERT", "ADMIN_MONSTER_LOOT_DELETE"]);
  assert.equal(rows[0].meta.after.drop_chance, 0.5);
  assert.deepEqual(rows[1].meta.changedKeys, ["weight"]);
  assert.equal(rows[1].meta.before.weight, 3);
  assert.equal(rows[1].meta.after.weight, 9);
  assert.equal(rows[2].meta.before.weight, 9);
});

test("junk info upsert/delete audit", async () => {
  const db = createDb();
  await h.handleAdminUpsertJunkInfo(db, ADMIN, "j1", "Scrap", "🔩");
  await h.handleAdminUpsertJunkInfo(db, ADMIN, "j1", "Scrap", "🔧");
  await h.handleAdminDeleteJunkInfo(db, ADMIN, "j1", "test cleanup", "j1");
  const rows = audits(db);
  assert.deepEqual(rows.map((r) => r.event_type), ["ADMIN_JUNK_INFO_UPSERT", "ADMIN_JUNK_INFO_UPSERT", "ADMIN_JUNK_INFO_DELETE"]);
  assert.deepEqual(rows[1].meta.changedKeys, ["icon"]);
  assert.equal(rows[2].meta.before.icon, "🔧");
  assert.equal(rows[2].meta.after, null);
});

test("injected audit failure leaves every one of the 8 mutations unapplied", async () => {
  const db = createDb();
  db.raw.prepare("INSERT INTO game_config VALUES ('keep','1','t0')").run();
  db.raw.prepare("INSERT INTO recipes VALUES ('r1','{}','{}','admin','t0')").run();
  db.raw.prepare("INSERT INTO monster_loot (entry_id, monster_id, kind) VALUES ('e1','slime','junk')").run();
  db.raw.prepare("INSERT INTO junk_info (junk_id, name) VALUES ('j1','Scrap')").run();
  failAudit(db);
  const calls = [
    () => h.handleAdminSaveGameConfig(db, ADMIN, { keep: 2, other: 1 }),
    () => h.handleAdminSetGameConfigItem(db, ADMIN, "keep", 3),
    () => h.handleAdminUpsertRecipe(db, ADMIN, "r2", "sword", "N", "azure", 5, { a: 1 }),
    () => h.handleAdminDeleteRecipe(db, ADMIN, "r1", "test cleanup", "r1"),
    () => h.handleAdminUpsertMonsterLootEntry(db, ADMIN, { entryId: "e2", monsterId: "m", kind: "junk", junkId: "j1" }),
    () => h.handleAdminDeleteMonsterLootEntry(db, ADMIN, "e1", "test cleanup", "e1"),
    () => h.handleAdminUpsertJunkInfo(db, ADMIN, "j2", "New", "x"),
    () => h.handleAdminDeleteJunkInfo(db, ADMIN, "j1", "test cleanup", "j1"),
  ];
  const origError = console.error; console.error = () => {};
  try {
    for (const call of calls) {
      const res = await j(await call());
      assert.equal(res.status, 500);
      assert.equal(res.error, "admin_audit_failed");
    }
  } finally { console.error = origError; }
  assert.equal(db.raw.prepare("SELECT value_json FROM game_config WHERE key='keep'").get().value_json, "1");
  assert.equal(db.raw.prepare("SELECT COUNT(*) c FROM game_config").get().c, 1);
  assert.deepEqual(db.raw.prepare("SELECT recipe_id FROM recipes").all().map((r) => r.recipe_id), ["r1"]);
  assert.deepEqual(db.raw.prepare("SELECT entry_id FROM monster_loot").all().map((r) => r.entry_id), ["e1"]);
  assert.deepEqual(db.raw.prepare("SELECT junk_id FROM junk_info").all().map((r) => r.junk_id), ["j1"]);
  assert.equal(audits(db).length, 0);
});

test("secret-looking keys are redacted before they reach the audit row", async () => {
  const db = createDb();
  await h.handleAdminSetGameConfigItem(db, ADMIN, "cfg", { adminPassword: "hunter2", nested: { apiToken: "abc", ok: 1 }, recovery_code: "zzz", sessionHash: "h" });
  const raw = db.raw.prepare("SELECT metadata_json FROM admin_audit_log").get().metadata_json;
  assert.doesNotMatch(raw, /hunter2|"abc"|zzz|"h"/);
  const after = JSON.parse(raw).after.value;
  assert.equal(after.adminPassword, "[redacted]");
  assert.equal(after.nested.apiToken, "[redacted]");
  assert.equal(after.nested.ok, 1);
});

test("oversized metadata is capped at 16 KB and marked truncated", async () => {
  const db = createDb();
  await h.handleAdminSetGameConfigItem(db, ADMIN, "big", { blob: "x".repeat(40000), other: 1 });
  const row = audits(db)[0];
  assert.ok(Buffer.byteLength(row.metadata_json) <= 16 * 1024);
  assert.equal(row.meta.truncated, true);
  assert.deepEqual(row.meta.changedKeys, ["big"]);
  assert.ok(row.meta.fields.includes("value"));
  // the mutation itself still applied in full
  assert.equal(JSON.parse(db.raw.prepare("SELECT value_json FROM game_config WHERE key='big'").get().value_json).blob.length, 40000);
});

test("validation rejections and unauthenticated calls write no audit row", async () => {
  const db = createDb();
  assert.equal((await j(await h.handleAdminSetGameConfigItem(db, ADMIN, "", 1))).error, "missing_fields");
  assert.equal((await j(await h.handleAdminUpsertMonsterLootEntry(db, ADMIN, { monsterId: "m", kind: "gear" }))).error, "missing_fields");
  assert.equal((await j(await h.handleAdminDeleteRecipe(db, { error: "admin_session_invalid" }, "r1"))).status, 401);
  assert.equal(audits(db).length, 0);
});

test("routed through worker.fetch: Admin Bearer session is the audit actor", async () => {
  const db = createDb();
  db.raw.prepare("INSERT INTO admin_users (player_id, role, enabled, created_at, updated_at) VALUES ('Admin_1','admin',1,'n','n')").run();
  const token = "tok-" + nodeCrypto.randomBytes(8).toString("hex");
  const tokenHash = nodeCrypto.createHash("sha256").update(token).digest("base64url");
  db.raw.prepare("INSERT INTO admin_sessions VALUES ('s1','Admin_1',?,?,?,NULL,NULL)").run(tokenHash, new Date().toISOString(), new Date(Date.now() + 3600e3).toISOString());
  const res = await worker.fetch(new Request("https://api.example.test/", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "adminUpsertJunkInfo", junkId: "j9", name: "Gear", icon: "⚙️" }),
  }), { DB: db });
  assert.equal((await res.json()).ok, true);
  const rows = audits(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].event_type, "ADMIN_JUNK_INFO_UPSERT");
  assert.equal(rows[0].player_id, "Admin_1");
});

test("worker source keeps Admin mutations on the shared atomic audit helper", () => {
  const src = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  const start = src.indexOf("async function handleAdminSaveGameConfig");
  const end = src.indexOf("// ---------- request boundary hardening");
  const block = src.slice(start, end);
  assert.equal((block.match(/runAdminMutationWithAudit\(/g) || []).length, 8);
  assert.doesNotMatch(block, /\.run\(\)/);
});
