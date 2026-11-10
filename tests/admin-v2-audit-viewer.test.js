// W2-E (ADMIN-V2.md 22.6): read-only Audit Viewer.
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
  async batch(list) { for (const s of list) await s.run(); return []; }
}
let source = loadWorkerSource(path.resolve(__dirname, "..")).replace("export default {", "const workerDefault = {");
source += `\nglobalThis.__h = { handleAdminListAuditLog };\n`;
const sandbox = { console, Response, Headers, Request, URL, URLSearchParams, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const { handleAdminListAuditLog } = sandbox.__h;

function createDb() {
  const db = new Db();
  db.raw.exec(`PRAGMA foreign_keys=ON; CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT 'now');`);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0022_admin_v2_auth.sql"), "utf8").replace(/ALTER TABLE players[^;]*;/g, ""));
  db.raw.prepare("INSERT INTO players (id) VALUES ('Admin_1'), ('Admin_2')").run();
  return db;
}
const ADMIN = { ok: true, playerId: "Admin_1", role: "admin" };
const put = (db, id, at, event = "ADMIN_RECIPE_UPSERT", actor = "Admin_1", tt = "recipe", tid = "r1", meta = {}) =>
  db.raw.prepare("INSERT INTO admin_audit_log VALUES (?,?,?,?,?,?,?)").run(id, actor, event, tt, tid, JSON.stringify(meta), at);
const call = async (db, qs = "") => {
  const r = await handleAdminListAuditLog(db, ADMIN, new URLSearchParams(qs));
  return { status: r.status, ...(await r.json()) };
};
const viewRows = (db) => db.raw.prepare("SELECT * FROM admin_audit_log WHERE event_type='ADMIN_AUDIT_VIEW' ORDER BY rowid").all();

test("requires an Admin session", async () => {
  const r = await handleAdminListAuditLog(createDb(), { error: "admin_session_invalid" }, new URLSearchParams());
  assert.equal(r.status, 401);
});

test("default page is 25, max is 50, newest first", async () => {
  const db = createDb();
  for (let i = 0; i < 60; i++) put(db, `a${String(i).padStart(3, "0")}`, `2026-10-01T00:00:${String(i).padStart(2, "0")}.000Z`);
  const d = await call(db);
  assert.equal(d.entries.length, 25);
  assert.equal(d.entries[0].auditId, "a059");
  assert.ok(d.nextCursor);
  assert.equal((await call(db, "limit=999")).entries.length, 50);
  assert.equal((await call(db, "limit=0")).entries.length, 25);
  assert.equal((await call(db, "limit=3")).entries.length, 3);
});

test("cursor pagination on (created_at, audit_id) has no gaps or duplicates, including identical timestamps", async () => {
  const db = createDb();
  for (let i = 0; i < 23; i++) put(db, `t${String(i).padStart(2, "0")}`, i % 4 === 0 ? "2026-10-01T00:00:00.000Z" : "2026-10-01T00:00:0" + (i % 4) + ".000Z");
  const seen = [];
  let cursor = "";
  for (let guard = 0; guard < 20; guard++) {
    const d = await call(db, `limit=5${cursor ? "&cursor=" + cursor : ""}`);
    seen.push(...d.entries.map((e) => e.auditId));
    if (!d.nextCursor) break;
    cursor = d.nextCursor;
  }
  const ids = Array.from({ length: 23 }, (_, i) => `t${String(i).padStart(2, "0")}`);
  assert.equal(new Set(seen).size, 23);
  assert.deepEqual([...seen].sort(), ids);
  // ordering: created_at DESC then audit_id DESC
  const ordered = [...ids].sort((a, b) => {
    const ca = db.raw.prepare("SELECT created_at c FROM admin_audit_log WHERE audit_id=?").get(a).c;
    const cb = db.raw.prepare("SELECT created_at c FROM admin_audit_log WHERE audit_id=?").get(b).c;
    return cb.localeCompare(ca) || b.localeCompare(a);
  });
  assert.deepEqual(seen, ordered);
});

test("filters: event_type, actor, target_type, target_id, date range (combinable)", async () => {
  const db = createDb();
  put(db, "x1", "2026-10-01T00:00:00.000Z", "ADMIN_RECIPE_DELETE", "Admin_1", "recipe", "r1");
  put(db, "x2", "2026-10-02T00:00:00.000Z", "ADMIN_JUNK_INFO_UPSERT", "Admin_2", "junk_info", "j1");
  put(db, "x3", "2026-10-03T00:00:00.000Z", "ADMIN_RECIPE_DELETE", "Admin_2", "recipe", "r2");
  const ids = async (qs) => (await call(db, qs)).entries.map((e) => e.auditId);
  assert.deepEqual(await ids("eventType=ADMIN_RECIPE_DELETE"), ["x3", "x1"]);
  assert.deepEqual(await ids("actor=Admin_2"), ["x3", "x2"]);
  assert.deepEqual(await ids("targetType=junk_info"), ["x2"]);
  assert.deepEqual(await ids("targetId=r2"), ["x3"]);
  assert.deepEqual(await ids("from=2026-10-02T00:00:00Z&to=2026-10-02T23:59:59Z"), ["x2"]);
  assert.deepEqual(await ids("eventType=ADMIN_RECIPE_DELETE&actor=Admin_2"), ["x3"]);
  assert.deepEqual(await ids("eventType=%27%20OR%201%3D1--"), []);
});

test("invalid dates or cursors are rejected with invalid_filter (400)", async () => {
  const db = createDb();
  for (const qs of ["from=not-a-date", "to=zzz", "cursor=%25%25%25", "cursor=" + btoa("not json")]) {
    const d = await call(db, qs);
    assert.equal(d.status, 400, qs); assert.equal(d.error, "invalid_filter");
  }
  assert.equal(viewRows(db).length, 0);
});

test("output is re-sanitized with the denylist so old rows cannot leak secrets", async () => {
  const db = createDb();
  put(db, "old1", "2026-10-01T00:00:00.000Z", "LEGACY", "Admin_1", "x", "y", { adminPassword: "hunter2", nested: { sessionToken: "tok123", ok: 1 }, recovery_code: "zzz" });
  db.raw.prepare("INSERT INTO admin_audit_log VALUES ('old2','Admin_1','LEGACY','x','y','{not valid json','2026-10-01T00:00:01.000Z')").run();
  const d = await call(db);
  const text = JSON.stringify(d);
  assert.doesNotMatch(text, /hunter2|tok123|zzz/);
  const e = d.entries.find((x) => x.auditId === "old1");
  assert.equal(e.metadata.adminPassword, "[redacted]");
  assert.equal(e.metadata.nested.sessionToken, "[redacted]");
  assert.equal(e.metadata.nested.ok, 1);
  assert.equal(d.entries.find((x) => x.auditId === "old2").metadata, "{not valid json");
});

test("viewing is audited with filter names and counts only, never filter values", async () => {
  const db = createDb();
  put(db, "v1", "2026-10-01T00:00:00.000Z", "ADMIN_RECIPE_DELETE", "Admin_1", "recipe", "secret-target-name");
  await call(db, "eventType=ADMIN_RECIPE_DELETE&targetId=secret-target-name&limit=10");
  const rows = viewRows(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].player_id, "Admin_1");
  assert.equal(rows[0].target_type, "audit_log");
  const meta = JSON.parse(rows[0].metadata_json);
  assert.deepEqual(meta, { filters: ["eventType", "targetId"], paged: false, limit: 10, resultCount: 1 });
  assert.doesNotMatch(rows[0].metadata_json, /secret-target-name|ADMIN_RECIPE_DELETE/);
});

test("audit failure on the view write fails closed", async () => {
  const db = createDb();
  put(db, "v1", "2026-10-01T00:00:00.000Z");
  db.raw.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_log WHEN NEW.event_type='ADMIN_AUDIT_VIEW' BEGIN SELECT RAISE(ABORT,'down'); END;`);
  const orig = console.error; console.error = () => {};
  try { const d = await call(db); assert.equal(d.status, 500); assert.equal(d.error, "admin_audit_failed"); assert.equal(d.entries, undefined); }
  finally { console.error = orig; }
});

test("read-only: only the one GET action is routed and the UI has no edit/delete controls", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  assert.match(worker, /"adminSearchPlayers", "adminListAuditLog"/);
  assert.doesNotMatch(worker, /\["[^\]]*adminListAuditLog[^\]]*"\]\.includes\(body\.action\)/);
  const start = worker.indexOf("async function handleAdminListAuditLog");
  const end = worker.indexOf("// ---------- admin: delete player item (W2-F");
  const block = worker.slice(start, end);
  assert.doesNotMatch(block, /\b(DELETE|UPDATE|DROP|ALTER)\b/);
  assert.equal((block.match(/INSERT/g) || []).length, 0);
  const html = fs.readFileSync(path.join(__dirname, "../admin.html"), "utf8");
  const section = html.slice(html.indexOf('<section id="tab-audit">'), html.indexOf('<section id="tab-junk">'));
  assert.deepEqual((section.match(/<button[^>]*id="([^"]+)"/g) || []).map((b) => b.match(/id="([^"]+)"/)[1]), ["auditSearchBtn", "auditMoreBtn"]);
  const ui = fs.readFileSync(path.join(__dirname, "../admin-app.js"), "utf8");
  const uiBlock = ui.slice(ui.indexOf("// AUDIT LOG TAB"), ui.indexOf("// JUNK INFO TAB"));
  assert.doesNotMatch(uiBlock, /apiPost|adminDelete|adminUpsert|setGameConfig/);
});
