// W2-F (ADMIN-V2.md 22.7): guarded Admin item delete. Schema mirrors production (items,
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
source += `\nglobalThis.__h = { handleAdminGetItemDetail, handleAdminPreviewItemDelete, handleAdminDeleteItem };\n`;
const sandbox = { console, Response, Headers, Request, URL, URLSearchParams, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout, Date };
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const h = sandbox.__h;

const ADMIN = { ok: true, playerId: "Admin_1", role: "admin" };
const NOW = () => new Date().toISOString();

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
  db.raw.prepare("INSERT INTO players (id) VALUES ('Admin_1'), ('P1'), ('P2')").run();
  db.raw.prepare("INSERT INTO characters VALUES ('c1','P1'), ('c2','P2')").run();
  const ins = db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, name, extra_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)");
  ins.run("gear1", "P1", "c1", "weapon", 0, "Sword", '{"atk":5}', "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  ins.run("worn1", "P1", "c1", "armor", 1, "Worn", "{}", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  ins.run("junk1", "P1", "c1", "junk", 0, "Scrap", '{"junkId":"scrap","quantity":7}', "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  ins.run("other1", "P2", "c2", "weapon", 0, "Theirs", "{}", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  db.raw.prepare("INSERT INTO item_provenance (item_id, original_player_id, original_character_id, origin_type, created_at, acquired_at) VALUES ('gear1','P1','c1','drop','t','t')").run();
  db.raw.prepare("INSERT INTO item_ownership_events (event_id,item_id,to_player_id,to_character_id,event_type,occurred_at) VALUES ('acquire-gear1','gear1','P1','c1','acquire','t')").run();
  if (enabled) db.raw.prepare("INSERT INTO game_config VALUES ('admin_item_delete_enabled','true','t')").run();
  return db;
}
const j = async (r) => ({ status: r.status, ...(await r.json()) });
const q = (o) => new URLSearchParams(o);
const preview = async (db, itemId = "gear1", extra = {}) => j(await h.handleAdminPreviewItemDelete(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId, ...extra })));
let n = 0;
const del = async (db, over = {}) => {
  const itemId = over.itemId || "gear1";
  const pv = over.snapshotHash ? null : await preview(db, itemId, over.quantity ? { quantity: String(over.quantity) } : {});
  return j(await h.handleAdminDeleteItem(db, ADMIN, {
    playerId: "P1", characterId: "c1", itemId, reason: "player requested removal", confirmText: itemId,
    snapshotHash: pv ? pv.snapshotHash : over.snapshotHash, requestId: `req-${++n}-abcdefgh`, ...over,
  }));
};
const count = (db, t, w = "1=1") => db.raw.prepare(`SELECT COUNT(*) c FROM ${t} WHERE ${w}`).get().c;
const audits = (db) => db.raw.prepare("SELECT * FROM admin_audit_log WHERE event_type='ADMIN_ITEM_DELETE'").all();

test("ships disabled: absent or non-true flag blocks preview and delete (403 feature_disabled)", async () => {
  for (const setup of [(db) => db.raw.exec("DELETE FROM game_config"), (db) => db.raw.exec("UPDATE game_config SET value_json='false'"), (db) => db.raw.exec("UPDATE game_config SET value_json='\"true\"'")]) {
    const db = createDb(); setup(db);
    const pv = await preview(db);
    assert.equal(pv.status, 403); assert.equal(pv.error, "feature_disabled");
    const r = await j(await h.handleAdminDeleteItem(db, ADMIN, { playerId: "P1", characterId: "c1", itemId: "gear1", reason: "valid reason", confirmText: "gear1", snapshotHash: "0".repeat(64), requestId: "req-flag-abcdefgh" }));
    assert.equal(r.status, 403); assert.equal(r.error, "feature_disabled");
    assert.equal(count(db, "items"), 4); assert.equal(audits(db).length, 0);
  }
});

test("detail is read-only and reports provenance, events and the deletable verdict", async () => {
  const db = createDb({ enabled: false });
  const d = await j(await h.handleAdminGetItemDetail(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId: "gear1" })));
  assert.equal(d.ok, true); assert.equal(d.enabled, false); assert.equal(d.deletable, true); assert.equal(d.blockedReason, null);
  assert.equal(d.provenance.origin_type, "drop"); assert.equal(d.events[0].event_type, "acquire");
  const w = await j(await h.handleAdminGetItemDetail(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId: "worn1" })));
  assert.equal(w.deletable, false); assert.equal(w.blockedReason, "item_equipped");
  assert.equal(count(db, "items"), 4); assert.equal(audits(db).length, 0);
});

test("success: row deleted, audit row with full snapshot, admin_deleted ownership event", async () => {
  const db = createDb();
  const r = await del(db);
  assert.equal(r.ok, true); assert.equal(r.deleted, true);
  assert.equal(count(db, "items", "item_id='gear1'"), 0);
  const [a] = audits(db);
  assert.equal(a.player_id, "Admin_1"); assert.equal(a.target_type, "item"); assert.equal(a.target_id, "gear1");
  assert.match(a.audit_id, /^adm-del-req-/);
  const meta = JSON.parse(a.metadata_json);
  assert.equal(meta.reason, "player requested removal"); assert.deepEqual(meta.changedKeys, ["deleted"]);
  assert.equal(meta.before.item.name, "Sword"); assert.equal(meta.before.provenance.origin_type, "drop");
  assert.equal(meta.before.recentEvents[0].event_type, "acquire");
  const ev = db.raw.prepare("SELECT * FROM item_ownership_events WHERE event_type='admin_deleted'").get();
  assert.equal(ev.from_player_id, "P1"); assert.equal(ev.from_character_id, "c1"); assert.equal(ev.to_player_id, null);
  assert.equal(JSON.parse(ev.context_json).auditId, a.audit_id);
  assert.equal(count(db, "items", "item_id IN ('worn1','junk1','other1')"), 3);
});

test("stale snapshot hash: 409 item_state_changed, nothing written", async () => {
  const db = createDb();
  const pv = await preview(db);
  db.raw.prepare("UPDATE items SET updated_at='2026-10-02T00:00:00Z' WHERE item_id='gear1'").run();
  let r = await del(db, { snapshotHash: pv.snapshotHash });
  assert.equal(r.status, 409); assert.equal(r.error, "item_state_changed");
  r = await del(db, { snapshotHash: "nothex" });
  assert.equal(r.error, "item_state_changed");
  assert.equal(count(db, "items", "item_id='gear1'"), 1); assert.equal(audits(db).length, 0);
  assert.equal(count(db, "item_ownership_events", "event_type='admin_deleted'"), 0);
});

test("state changed between re-read and batch: guarded statements write nothing (409)", async () => {
  const db = createDb();
  const pv = await preview(db);
  const realBatch = db.batch.bind(db);
  db.batch = async (list) => { db.raw.prepare("UPDATE items SET extra_json='{\"atk\":99}' WHERE item_id='gear1'").run(); return realBatch(list); };
  const r = await del(db, { snapshotHash: pv.snapshotHash });
  assert.equal(r.status, 409); assert.equal(r.error, "item_state_changed");
  assert.equal(count(db, "items", "item_id='gear1'"), 1);
  assert.equal(audits(db).length, 0); assert.equal(count(db, "item_ownership_events", "event_type='admin_deleted'"), 0);
});

test("blocked: equipped, pending operation, recent run (stale run rows do not block)", async () => {
  let db = createDb();
  let r = await del(db, { itemId: "worn1", snapshotHash: "a".repeat(64) });
  assert.equal(r.status, 409); assert.equal(r.error, "item_equipped");
  db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','r1','tok','{}','pending','t')").run();
  r = await j(await h.handleAdminPreviewItemDelete(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId: "gear1" })));
  assert.equal(r.error, "operation_pending");
  db = createDb();
  db.raw.prepare("INSERT INTO character_run_state VALUES ('c1',3,?)").run(NOW());
  assert.equal((await preview(db)).error, "character_in_run");
  db.raw.prepare("UPDATE character_run_state SET updated_at='2026-09-29T14:55:14.765Z'").run();
  assert.equal((await preview(db)).ok, true);
  assert.equal(count(db, "items"), 4); assert.equal(audits(db).length, 0);
});

test("wrong owner / wrong character / unknown item: item_not_found, nothing written", async () => {
  const db = createDb();
  for (const t of [{ playerId: "P2", characterId: "c1", itemId: "gear1" }, { playerId: "P1", characterId: "c2", itemId: "gear1" }, { playerId: "P1", characterId: "c1", itemId: "other1" }, { playerId: "P1", characterId: "c1", itemId: "nope" }]) {
    const r = await j(await h.handleAdminPreviewItemDelete(db, ADMIN, q(t)));
    assert.equal(r.status, 404, JSON.stringify(t)); assert.equal(r.error, "item_not_found");
    const d = await j(await h.handleAdminDeleteItem(db, ADMIN, { ...t, reason: "valid reason", confirmText: t.itemId, snapshotHash: "a".repeat(64), requestId: `req-wo-${++n}-abcdef` }));
    assert.equal(d.status, 404);
  }
  assert.equal(count(db, "items"), 4); assert.equal(audits(db).length, 0);
});

test("partial stack decrements quantity; full quantity deletes; invalid quantities rejected", async () => {
  const db = createDb();
  assert.equal((await preview(db, "junk1", { quantity: "8" })).error, "invalid_quantity");
  assert.equal((await preview(db, "junk1", { quantity: "0" })).error, "invalid_quantity");
  assert.equal((await preview(db, "gear1", { quantity: "2" })).error, "invalid_quantity");
  let r = await del(db, { itemId: "junk1", quantity: 3 });
  assert.equal(r.ok, true); assert.equal(r.deleted, false); assert.equal(r.remaining, 4);
  const row = db.raw.prepare("SELECT extra_json FROM items WHERE item_id='junk1'").get();
  assert.deepEqual(JSON.parse(row.extra_json), { junkId: "scrap", quantity: 4 });
  const meta = JSON.parse(audits(db)[0].metadata_json);
  assert.deepEqual(meta.changedKeys, ["quantity"]); assert.deepEqual(meta.after, { quantityRemaining: 4 });
  r = await del(db, { itemId: "junk1", quantity: 4 });
  assert.equal(r.deleted, true); assert.equal(count(db, "items", "item_id='junk1'"), 0);
});

test("replay with the same requestId returns already_applied and never deletes twice", async () => {
  const db = createDb();
  const pv = await preview(db, "junk1", { quantity: "2" });
  const body = { playerId: "P1", characterId: "c1", itemId: "junk1", quantity: 2, reason: "duplicate stack", confirmText: "junk1", snapshotHash: pv.snapshotHash, requestId: "req-replay-abcdefgh" };
  assert.equal((await j(await h.handleAdminDeleteItem(db, ADMIN, body))).ok, true);
  const again = await j(await h.handleAdminDeleteItem(db, ADMIN, body));
  assert.equal(again.already_applied, true);
  assert.equal(JSON.parse(db.raw.prepare("SELECT extra_json FROM items WHERE item_id='junk1'").get().extra_json).quantity, 5);
  assert.equal(audits(db).length, 1);
});

test("injected audit failure rolls back: item intact, no ownership event, admin_audit_failed", async () => {
  const db = createDb();
  const pv = await preview(db);
  db.raw.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_log WHEN NEW.event_type='ADMIN_ITEM_DELETE' BEGIN SELECT RAISE(ABORT,'down'); END;`);
  const orig = console.error; console.error = () => {};
  try {
    const r = await del(db, { snapshotHash: pv.snapshotHash });
    assert.equal(r.status, 500); assert.equal(r.error, "admin_audit_failed");
  } finally { console.error = orig; }
  assert.equal(count(db, "items", "item_id='gear1'"), 1);
  assert.equal(count(db, "item_ownership_events", "event_type='admin_deleted'"), 0);
});

test("validation: reason, confirmText, requestId and ids are required; 401 without a session", async () => {
  const db = createDb();
  const pv = await preview(db);
  const base = { playerId: "P1", characterId: "c1", itemId: "gear1", reason: "valid reason", confirmText: "gear1", snapshotHash: pv.snapshotHash, requestId: "req-val-abcdefgh" };
  const call = async (o) => j(await h.handleAdminDeleteItem(db, ADMIN, { ...base, ...o }));
  assert.equal((await call({ reason: undefined })).error, "reason_required");
  assert.equal((await call({ reason: "abcd" })).error, "invalid_reason");
  assert.equal((await call({ confirmText: "GEAR1" })).error, "confirm_mismatch");
  assert.equal((await call({ requestId: "short" })).error, "invalid_request_id");
  assert.equal((await call({ playerId: "" })).error, "missing_fields");
  assert.equal((await j(await h.handleAdminDeleteItem(db, { error: "admin_session_invalid" }, base))).status, 401);
  assert.equal(count(db, "items"), 4); assert.equal(audits(db).length, 0);
});

test("no per-Admin delete rate limit (Owner decision): 25 consecutive deletes all succeed", async () => {
  const db = createDb();
  const ins = db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, created_at, updated_at) VALUES (?,?,?,?,?,?)");
  for (let i = 0; i < 25; i++) ins.run(`bulk${i}`, "P1", "c1", "weapon", "t", "t");
  for (let i = 0; i < 25; i++) assert.equal((await del(db, { itemId: `bulk${i}` })).ok, true, `delete ${i}`);
  assert.equal(audits(db).length, 25);
});

test("worker source: single-target guarded statements, no bulk or generic SQL, routed through Admin auth", () => {
  const src = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  const block = src.slice(src.indexOf("async function handleAdminDeleteItem"), src.indexOf("// ---------- admin: restore a deleted item (W2-G)"));
  assert.doesNotMatch(block, /DELETE FROM items WHERE (?!item_id = \?)/);
  assert.doesNotMatch(block, /\bIN \(|LIKE/);
  assert.match(src, /case "adminDeleteItem": return await handleAdminDeleteItem\(db, adminAuth, body\)/);
  assert.match(src, /"adminGetItemDetail", "adminPreviewItemDelete"/);
});

// ---- W2-F/W2-G hardening (Project Lead review of main ca84ae56, finding A1) ----
// The activity checks must hold at the mutation, not only in the preflight read: a pending
// operation or a fresh run that starts between the preflight and db.batch must stop the delete.
for (const [label, startActivity, expected] of [
  ["a pending operation starts", (db) => db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','race1','tok-race','{}','pending','t')").run(), "operation_pending"],
  ["a run starts (fresh character_run_state row)", (db) => db.raw.prepare("INSERT INTO character_run_state VALUES ('c1',2,?)").run(NOW()), "character_in_run"],
  ["a stale run row is refreshed", (db) => { db.raw.prepare("INSERT OR REPLACE INTO character_run_state VALUES ('c1',2,?)").run(NOW()); }, "character_in_run"],
]) {
  test(`A1 race: ${label} after the preflight -> nothing deleted, no success audit, no ownership event`, async () => {
    const db = createDb();
    if (label.startsWith("a stale")) db.raw.prepare("INSERT INTO character_run_state VALUES ('c1',1,'2026-09-29T14:55:14.765Z')").run();
    const pv = await preview(db);
    assert.equal(pv.ok, true);
    const realBatch = db.batch.bind(db);
    db.batch = async (list) => { startActivity(db); return realBatch(list); };
    const r = await del(db, { snapshotHash: pv.snapshotHash });
    assert.equal(r.status, 409); assert.equal(r.error, expected);
    assert.equal(count(db, "items", "item_id='gear1'"), 1);
    assert.equal(audits(db).length, 0);
    assert.equal(count(db, "item_ownership_events", "event_type='admin_deleted'"), 0);
  });
}

test("A1: a run row older than 30 minutes (including unparseable timestamps handled as active) is judged at the SQL guard too", async () => {
  const db = createDb();
  const pv = await preview(db);
  db.raw.prepare("INSERT INTO character_run_state VALUES ('c1',1,'not-a-date')").run();
  const r = await del(db, { snapshotHash: pv.snapshotHash });
  assert.equal(r.status, 409); assert.equal(r.error, "character_in_run");
  assert.equal(count(db, "items", "item_id='gear1'"), 1);
});

test("A1: stale run (>30 min) and settled receipts still allow the delete via the guarded batch", async () => {
  const db = createDb();
  db.raw.prepare("INSERT INTO character_run_state VALUES ('c1',1,'2026-09-29T14:55:14.765Z')").run();
  db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','done1','tok-done','{}','{\"ok\":true}','t')").run();
  const r = await del(db);
  assert.equal(r.ok, true); assert.equal(count(db, "items", "item_id='gear1'"), 0);
});

test("A1: every item mutation moves updated_at (optimistic-concurrency contract): partial stack delete", async () => {
  const db = createDb();
  const before = db.raw.prepare("SELECT updated_at FROM items WHERE item_id='junk1'").get().updated_at;
  const r = await del(db, { itemId: "junk1", quantity: 2 });
  assert.equal(r.ok, true);
  const after = db.raw.prepare("SELECT updated_at FROM items WHERE item_id='junk1'").get().updated_at;
  assert.notEqual(after, before);
});

test("A1: a concurrent duplicate request (same requestId) cannot delete twice: loser is already_applied, one audit row", async () => {
  const db = createDb();
  const pv = await preview(db, "junk1", { quantity: "2" });
  const body = { playerId: "P1", characterId: "c1", itemId: "junk1", quantity: 2, reason: "duplicate race", confirmText: "junk1", snapshotHash: pv.snapshotHash, requestId: "req-dup-race-abcdefgh" };
  const realBatch = db.batch.bind(db);
  let injected = false;
  db.batch = async (list) => {
    if (!injected) { injected = true; await realBatch(list); } // the "other" request lands first
    return realBatch(list); // ours now hits the audit primary key and rolls back
  };
  const r = await j(await h.handleAdminDeleteItem(db, ADMIN, body));
  assert.equal(r.ok, true); assert.equal(r.already_applied, true);
  assert.equal(JSON.parse(db.raw.prepare("SELECT extra_json FROM items WHERE item_id='junk1'").get().extra_json).quantity, 5);
  assert.equal(audits(db).length, 1);
});
