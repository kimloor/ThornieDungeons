// W2-D (ADMIN-V2.md 22.5): Admin deletes require a reason + exact confirmId and re-read the target.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");

class Stmt {
  constructor(d, sql, v = []) { this.d = d; this.sql = sql; this.v = v; }
  bind(...v) { return new Stmt(this.d, this.sql, v); }
  async first() { return this.d.prepare(this.sql).get(...this.v) || null; }
  async all() { return { results: this.d.prepare(this.sql).all(...this.v) }; }
  async run() { const r = this.d.prepare(this.sql).run(...this.v); return { meta: { changes: Number(r.changes) } }; }
}
class Db {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Stmt(this.raw, sql); }
  async batch(list) {
    const out = [];
    this.raw.exec("BEGIN");
    try { for (const s of list) out.push(await s.run()); this.raw.exec("COMMIT"); return out; }
    catch (e) { this.raw.exec("ROLLBACK"); throw e; }
  }
}
let source = loadWorkerSource(path.resolve(__dirname, "..")).replace("export default {", "const workerDefault = {");
source += `\nglobalThis.__h = { handleAdminDeleteRecipe, handleAdminDeleteMonsterLootEntry, handleAdminDeleteJunkInfo };\n`;
const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const h = sandbox.__h;

function createDb() {
  const db = new Db();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE recipes (recipe_id TEXT PRIMARY KEY, result_item_def TEXT NOT NULL, materials_json TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
    CREATE TABLE monster_loot (entry_id TEXT PRIMARY KEY, monster_id TEXT NOT NULL, kind TEXT NOT NULL, item_type TEXT, rarity TEXT, junk_id TEXT, qty_min INTEGER DEFAULT 1, qty_max INTEGER DEFAULT 1, weight REAL DEFAULT 1, drop_chance REAL DEFAULT 1.0, created_at TEXT, updated_at TEXT);
    CREATE TABLE junk_info (junk_id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '📦', created_at TEXT, updated_at TEXT);
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0022_admin_v2_auth.sql"), "utf8").replace(/ALTER TABLE players[^;]*;/g, ""));
  db.raw.prepare("INSERT INTO players (id) VALUES ('Admin_1')").run();
  db.raw.prepare("INSERT INTO recipes VALUES ('r1','{}','{}','admin','t0')").run();
  db.raw.prepare("INSERT INTO monster_loot (entry_id, monster_id, kind) VALUES ('e1','slime','junk')").run();
  db.raw.prepare("INSERT INTO junk_info (junk_id, name) VALUES ('j1','Scrap')").run();
  return db;
}
const ADMIN = { ok: true, playerId: "Admin_1", role: "admin" };
const j = async (r) => ({ status: r.status, ...(await r.json()) });
const count = (db, t) => db.raw.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
const auditCount = (db) => count(db, "admin_audit_log");

const CASES = [
  ["recipe", "handleAdminDeleteRecipe", "r1", "recipes", "ADMIN_RECIPE_DELETE"],
  ["monster loot", "handleAdminDeleteMonsterLootEntry", "e1", "monster_loot", "ADMIN_MONSTER_LOOT_DELETE"],
  ["junk info", "handleAdminDeleteJunkInfo", "j1", "junk_info", "ADMIN_JUNK_INFO_DELETE"],
];

for (const [label, fn, id, table, eventType] of CASES) {
  test(`${label} delete: old client without reason gets reason_required (400), nothing deleted`, async () => {
    const db = createDb();
    const res = await j(await h[fn](db, ADMIN, id));
    assert.equal(res.status, 400); assert.equal(res.error, "reason_required");
    assert.equal(count(db, table), 1); assert.equal(auditCount(db), 0);
  });

  test(`${label} delete: reason length 5-300 (trimmed) enforced`, async () => {
    const db = createDb();
    for (const bad of ["    ", "abcd", "  abcd  ", "x".repeat(301)]) {
      const res = await j(await h[fn](db, ADMIN, id, bad, id));
      assert.equal(res.status, 400);
      assert.ok(["reason_required", "invalid_reason"].includes(res.error), bad);
    }
    assert.equal(count(db, table), 1); assert.equal(auditCount(db), 0);
  });

  test(`${label} delete: confirmId must equal the target id exactly`, async () => {
    const db = createDb();
    for (const bad of [undefined, "", id.toUpperCase(), id + " ", "other", 7]) {
      const res = await j(await h[fn](db, ADMIN, id, "valid reason", bad));
      assert.equal(res.status, 400); assert.equal(res.error, "confirm_mismatch");
    }
    assert.equal(count(db, table), 1); assert.equal(auditCount(db), 0);
  });

  test(`${label} delete: missing target is rejected 404 and not audited`, async () => {
    const db = createDb();
    db.raw.exec(`DELETE FROM ${table}`);
    const res = await j(await h[fn](db, ADMIN, id, "valid reason", id));
    assert.equal(res.status, 404); assert.equal(res.error, "not_found");
    assert.equal(auditCount(db), 0);
  });

  test(`${label} delete: valid request deletes and stores the trimmed reason in the audit row`, async () => {
    const db = createDb();
    const res = await j(await h[fn](db, ADMIN, id, "  duplicate entry  ", id));
    assert.equal(res.ok, true);
    assert.equal(count(db, table), 0);
    const row = db.raw.prepare("SELECT * FROM admin_audit_log").get();
    assert.equal(row.event_type, eventType);
    const meta = JSON.parse(row.metadata_json);
    assert.equal(meta.reason, "duplicate entry");
    assert.deepEqual(meta.changedKeys, ["deleted"]);
    assert.ok(meta.before); assert.equal(meta.after, null);
  });
}

test("unauthenticated delete is 401 before any validation or read", async () => {
  const db = createDb();
  const res = await j(await h.handleAdminDeleteRecipe(db, { error: "admin_session_invalid" }, "r1", "valid reason", "r1"));
  assert.equal(res.status, 401);
  assert.equal(count(db, "recipes"), 1);
});

test("router passes reason and confirmId through; Admin UI never deletes without the dialog", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  assert.match(worker, /handleAdminDeleteRecipe\(db, adminAuth, body\.recipeId, body\.reason, body\.confirmId\)/);
  assert.match(worker, /handleAdminDeleteMonsterLootEntry\(db, adminAuth, body\.entryId, body\.reason, body\.confirmId\)/);
  assert.match(worker, /handleAdminDeleteJunkInfo\(db, adminAuth, body\.junkId, body\.reason, body\.confirmId\)/);
  const ui = fs.readFileSync(path.join(__dirname, "../admin-app.js"), "utf8");
  assert.doesNotMatch(ui, /\bconfirm\(/);
  for (const a of ["adminDeleteRecipe", "adminDeleteMonsterLootEntry", "adminDeleteJunkInfo"]) {
    assert.equal((ui.match(new RegExp(`action: "${a}"`, "g")) || []).length, 1);
  }
  assert.equal((ui.match(/await destructiveDelete\(\{/g) || []).length, 3);
  assert.match(ui, /DELETE_REASON_MIN = 5/); assert.match(ui, /DELETE_REASON_MAX = 300/);
  assert.match(ui, /confirmInput\.value === String\(targetId\)/);
});
