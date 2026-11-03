// W2-G: restore a deleted item from its audit snapshot. Schema mirrors production (items,
// character_run_state, character_operation_receipts) and migration 0028 provenance tables.
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
source += `\nglobalThis.__h = { handleAdminPreviewItemDelete, handleAdminDeleteItem, handleAdminPreviewItemRestore, handleAdminRestoreItem, handleAdminListAuditLog };\n`;
const sandbox = { console, Response, Headers, Request, URL, URLSearchParams, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout, Date };
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const h = sandbox.__h;

const ADMIN = { ok: true, playerId: "Admin_1", role: "admin" };
const ADMIN2 = { ok: true, playerId: "Admin_2", role: "admin" };

function createDb({ enabled = true } = {}) {
  const db = new Db();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL);
    CREATE TABLE game_config (key TEXT PRIMARY KEY, value_json TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
    CREATE TABLE items (item_id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE, slot_type TEXT NOT NULL DEFAULT '', equipped INTEGER NOT NULL DEFAULT 0, inventory_slot TEXT NOT NULL DEFAULT '', item_template_id TEXT NOT NULL DEFAULT '', rarity TEXT NOT NULL DEFAULT '', name TEXT NOT NULL DEFAULT '', item_level INTEGER NOT NULL DEFAULT 0, enhance_level INTEGER NOT NULL DEFAULT 0, bound INTEGER NOT NULL DEFAULT 0, quantity INTEGER NOT NULL DEFAULT 1, atk INTEGER NOT NULL DEFAULT 0, def INTEGER NOT NULL DEFAULT 0, hp INTEGER NOT NULL DEFAULT 0, mp INTEGER NOT NULL DEFAULT 0, extra_json TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, character_id TEXT);
    CREATE TABLE character_run_state (character_id TEXT PRIMARY KEY, floor INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
    CREATE TABLE character_operation_receipts (character_id TEXT NOT NULL, operation TEXT NOT NULL, request_id TEXT NOT NULL, operation_token TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (character_id, operation, request_id));
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0028_empower_v21_item_provenance.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0022_admin_v2_auth.sql"), "utf8").replace(/ALTER TABLE players[^;]*;/g, ""));
  db.raw.prepare("INSERT INTO players (id) VALUES ('Admin_1'), ('Admin_2'), ('P1')").run();
  db.raw.prepare("INSERT INTO characters VALUES ('c1','P1')").run();
  const ins = db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, name, rarity, enhance_level, item_level, atk, def, extra_json, inventory_slot, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
  ins.run("gear1", "P1", "c1", "weapon", 0, "Sword", "mythic", 7, 40, 120, 3, '{"empowerSlots":[null,"fire"],"setId":"azure","overflow":false}', "s4", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  ins.run("junk1", "P1", "c1", "junk", 0, "Scrap", "common", 0, 0, 0, 0, '{"junkId":"scrap","quantity":7,"overflow":false}', "", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  db.raw.prepare("INSERT INTO item_provenance (item_id, original_player_id, original_character_id, origin_type, created_at, acquired_at) VALUES ('gear1','P1','c1','drop','t','t')").run();
  db.raw.prepare("INSERT INTO item_ownership_events (event_id,item_id,to_player_id,to_character_id,event_type,occurred_at) VALUES ('acquire-gear1','gear1','P1','c1','acquire','t')").run();
  if (enabled) db.raw.prepare("INSERT INTO game_config VALUES ('admin_item_delete_enabled','true','t')").run();
  return db;
}
const j = async (r) => ({ status: r.status, ...(await r.json()) });
const q = (o) => new URLSearchParams(o);
const count = (db, t, w = "1=1") => db.raw.prepare(`SELECT COUNT(*) c FROM ${t} WHERE ${w}`).get().c;
let n = 0;
async function del(db, itemId, quantity) {
  const pv = await j(await h.handleAdminPreviewItemDelete(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId, ...(quantity ? { quantity: String(quantity) } : {}) })));
  const r = await j(await h.handleAdminDeleteItem(db, ADMIN, { playerId: "P1", characterId: "c1", itemId, quantity: pv.quantity, reason: "delete for test", confirmText: itemId, snapshotHash: pv.snapshotHash, requestId: `req-${++n}-abcdefgh` }));
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.auditId;
}
const restore = async (db, auditId, over = {}, who = ADMIN2) =>
  j(await h.handleAdminRestoreItem(db, who, { auditId, reason: "restoring by owner request", confirmText: over.confirmText || "gear1", ...over }));
const rowOf = (db, id) => db.raw.prepare("SELECT * FROM items WHERE item_id=?").get(id);
const fill = (db, k) => { const ins = db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, created_at, updated_at, extra_json) VALUES (?,?,?,?,?,?,?)"); for (let i = 0; i < k; i++) ins.run(`pad${i}`, "P1", "c1", "weapon", "t", "t", '{"overflow":false}'); };


// ---------------------------------------------------------------------------------------------
// A1 deterministic interleaving evidence (PR #182 final security QA follow-up).
// The admin handlers do: preflight reads -> ONE db.batch of guarded statements. Production D1
// serialises writes, so the only interleaving that can matter is "an activity row appears after the
// preflight reads and before the batch". These tests inject that row at exactly that boundary
// (a hook on db.batch) and assert the in-statement guard refuses the whole mutation.
// This is a deterministic integration test on the SQLite harness; it is NOT a reproduction on D1.
// ---------------------------------------------------------------------------------------------
function loadHandlers({ neutraliseGuard = false } = {}) {
  let src = loadWorkerSource(path.resolve(__dirname, "..")).replace("export default {", "const workerDefault = {");
  if (neutraliseGuard) {
    const before = src;
    src = src.replace(/function adminItemActivityGuardSql\(\) \{[\s\S]*?\n\}/, 'function adminItemActivityGuardSql() { return "1 = 1"; }')
             .replace(/function adminItemActivityGuardBinds\(characterId\) \{[\s\S]*?\n\}/, "function adminItemActivityGuardBinds(characterId) { return []; }");
    assert.notEqual(src, before, "mutation must change the worker source");
  }
  src += `\nglobalThis.__h = { handleAdminPreviewItemDelete, handleAdminDeleteItem, handleAdminPreviewItemRestore, handleAdminRestoreItem };\n`;
  const sb = { console, Response, Headers, Request, URL, URLSearchParams, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout, Date };
  vm.createContext(sb); vm.runInContext(src, sb);
  return sb.__h;
}
const hMut = loadHandlers({ neutraliseGuard: true });

const INJECT = {
  pending: { code: "operation_pending", run: (db) => db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','a1','tok-a1','{}','pending','t')").run() },
  activeRun: { code: "character_in_run", run: (db) => db.raw.prepare("INSERT INTO character_run_state (character_id, floor, updated_at) VALUES ('c1', 1, ?)").run(new Date().toISOString()) },
  invalidRunTimestamp: { code: "character_in_run", run: (db) => db.raw.prepare("INSERT INTO character_run_state (character_id, floor, updated_at) VALUES ('c1', 1, 'not-a-date')").run() },
};
const BENIGN = {
  settledReceipt: (db) => db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','a2','tok-a2','{}','{\"ok\":true}','t')").run(),
  staleRun: (db) => db.raw.prepare("INSERT INTO character_run_state (character_id, floor, updated_at) VALUES ('c1', 1, '2026-09-29T14:55:14.765Z')").run(),
};
const TABLES = ["items", "admin_audit_log", "item_ownership_events", "item_provenance"];
const snapshot = (db) => Object.fromEntries(TABLES.map((t) => [t, db.raw.prepare(`SELECT * FROM ${t} ORDER BY 1, 2`).all().map((r) => ({ ...r }))]));
const totalChanges = (db) => Number(db.raw.prepare("SELECT total_changes() AS t").get().t);

// Arms the boundary hook; returns evidence about WHERE the hook ran.
function arm(db, inject) {
  const ev = { readsBeforeBatch: 0, hookRuns: 0, changesAtArm: totalChanges(db), changesAtBatch: null, batchStatements: null };
  const realPrepare = db.prepare.bind(db);
  db.prepare = (sql) => { if (/^\s*SELECT/i.test(sql)) ev.readsBeforeBatch++; return realPrepare(sql); };
  const realBatch = db.batch.bind(db);
  db.batch = async (list) => {
    db.prepare = realPrepare;
    ev.changesAtBatch = totalChanges(db);   // nothing written by the handler before the batch
    ev.batchStatements = list.length;
    ev.hookRuns++; inject(db);              // the activity starts HERE: after preflight, before mutation
    return realBatch(list);
  };
  return ev;
}
async function runDelete(handlers, db, itemId, quantity, inject) {
  const pv = await j(await handlers.handleAdminPreviewItemDelete(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId, ...(quantity ? { quantity: String(quantity) } : {}) })));
  assert.ok(pv.snapshotHash, JSON.stringify(pv));
  const ev = arm(db, inject);
  const r = await j(await handlers.handleAdminDeleteItem(db, ADMIN, { playerId: "P1", characterId: "c1", itemId, quantity: pv.quantity, reason: "a1 deterministic race", confirmText: itemId, snapshotHash: pv.snapshotHash, requestId: `req-a1-${++n}-abcdefgh` }));
  return { r, ev };
}
async function runRestore(handlers, db, auditId, confirmText, inject) {
  const ev = arm(db, inject);
  const r = await j(await handlers.handleAdminRestoreItem(db, ADMIN2, { auditId, reason: "a1 deterministic race restore", confirmText }));
  return { r, ev };
}
const scenarios = [
  { name: "delete whole gear", prep: async () => { const db = createDb(); return { db, go: (hd, inj) => runDelete(hd, db, "gear1", 0, inj) }; } },
  { name: "delete partial stack (3 of 7)", prep: async () => { const db = createDb(); return { db, go: (hd, inj) => runDelete(hd, db, "junk1", 3, inj) }; } },
  { name: "restore whole gear", prep: async () => { const db = createDb(); const a = await del(db, "gear1"); return { db, go: (hd, inj) => runRestore(hd, db, a, "gear1", inj) }; } },
  { name: "restore partial stack into remaining row", prep: async () => { const db = createDb(); const a = await del(db, "junk1", 3); return { db, go: (hd, inj) => runRestore(hd, db, a, "junk1", inj) }; } },
];
const assertBoundary = (ev) => {
  assert.equal(ev.hookRuns, 1, "hook ran exactly once");
  assert.ok(ev.readsBeforeBatch >= 1, "preflight performed reads before the hook");
  assert.equal(ev.changesAtBatch, ev.changesAtArm, "handler wrote nothing before the batch (hook is strictly between preflight and mutation)");
  assert.ok(ev.batchStatements >= 3, "batch carries the guarded statements");
};

for (const sc of scenarios) {
  for (const [label, inj] of Object.entries(INJECT)) {
    test(`A1 deterministic: ${sc.name} + ${label} between preflight and batch -> 409 ${inj.code}, zero mutation`, async () => {
      const { db, go } = await sc.prep();
      const before = snapshot(db);
      const { r, ev } = await go(h, inj.run);
      assertBoundary(ev);
      assert.equal(r.status, 409, JSON.stringify(r));
      assert.equal(r.error, inj.code);
      assert.notEqual(r.ok, true); assert.notEqual(r.already_applied, true);
      assert.deepEqual(snapshot(db), before, "items, audit, ownership events and provenance are byte-identical");
    });
  }
  for (const [label, benign] of Object.entries(BENIGN)) {
    test(`A1 control: ${sc.name} + ${label} at the same boundary -> still allowed (proves the hook is active and the guard is selective)`, async () => {
      const { db, go } = await sc.prep();
      const before = snapshot(db);
      const { r, ev } = await go(h, benign);
      assertBoundary(ev);
      assert.equal(r.status, 200, JSON.stringify(r)); assert.equal(r.ok, true);
      assert.notDeepEqual(snapshot(db), before, "the mutation really happened");
    });
  }
  test(`A1 sensitivity: ${sc.name} with the in-statement guard removed WOULD mutate under a late pending operation (the test detects a missing guard)`, async () => {
    const { db, go } = await sc.prep();
    const before = snapshot(db);
    const { r, ev } = await go(hMut, INJECT.pending.run);
    assertBoundary(ev);
    assert.equal(r.status, 200, "without the guard the late pending operation is not stopped");
    assert.notDeepEqual(snapshot(db), before);
  });
}
