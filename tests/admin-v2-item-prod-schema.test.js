// Runs the real delete/restore handlers against the EXACT production DDL (foreign keys ON), as the
// closest stand-in for D1 that can run inside CI. It is NOT a real-D1 handler test: see the PR evidence.
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
  constructor() { this.raw = new DatabaseSync(":memory:"); this.recorded = []; }
  prepare(sql) { return new Stmt(this.raw, sql); }
  async batch(list) {
    this.recorded.push(list.map((s) => ({ sql: s.sql, values: s.v })));
    const out = [];
    this.raw.exec("BEGIN");
    try { for (const s of list) out.push(await s.run()); this.raw.exec("COMMIT"); return out; }
    catch (e) { this.raw.exec("ROLLBACK"); throw e; }
  }
}
let source = loadWorkerSource(path.resolve(__dirname, "..")).replace("export default {", "const workerDefault = {");
source += `\nglobalThis.__h = { handleAdminPreviewItemDelete, handleAdminDeleteItem, handleAdminPreviewItemRestore, handleAdminRestoreItem };\n`;
const sandbox = { console, Response, Headers, Request, URL, URLSearchParams, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout, Date };
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const h = sandbox.__h;
const ADMIN = { ok: true, playerId: "Admin_1", role: "admin" };

function createDb() {
  const db = new Db();
  db.raw.exec("PRAGMA foreign_keys=ON;");
  db.raw.exec(fs.readFileSync(path.join(__dirname, "helpers/prod-schema.sql"), "utf8"));
  db.raw.prepare("INSERT INTO players (id, password, created_at) VALUES ('Admin_1','x','t'), ('P1','x','t')").run();
  db.raw.prepare("INSERT INTO characters (character_id, player_id, slot_index) VALUES ('c1','P1',0)").run();
  const ins = db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, name, rarity, enhance_level, atk, extra_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  ins.run("gear1", "P1", "c1", "weapon", "Sword", "mythic", 7, 120, '{"empowerSlots":[null,"fire"],"overflow":false}', "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  ins.run("junk1", "P1", "c1", "junk", "Scrap", "common", 0, 0, '{"junkId":"scrap","quantity":7,"overflow":false}', "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z");
  db.raw.prepare("INSERT INTO item_provenance (item_id, original_player_id, original_character_id, origin_type, created_at, acquired_at) VALUES ('gear1','P1','c1','drop','t','t')").run();
  db.raw.prepare("INSERT INTO game_config VALUES ('admin_item_delete_enabled','true','t')").run();
  return db;
}
const j = async (r) => ({ status: r.status, ...(await r.json()) });
const q = (o) => new URLSearchParams(o);
let n = 0;
async function del(db, itemId, quantity) {
  const pv = await j(await h.handleAdminPreviewItemDelete(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId, ...(quantity ? { quantity: String(quantity) } : {}) })));
  return j(await h.handleAdminDeleteItem(db, ADMIN, { playerId: "P1", characterId: "c1", itemId, quantity: pv.quantity, reason: "prod schema test", confirmText: itemId, snapshotHash: pv.snapshotHash, requestId: `req-ps-${++n}-abcdefgh` }));
}
const restore = async (db, auditId, confirmText) => j(await h.handleAdminRestoreItem(db, ADMIN, { auditId, reason: "prod schema restore", confirmText }));
const rows = (db, sql) => db.raw.prepare(sql).all();

test("prod DDL (FK on): delete -> restore round trip restores the identical row and writes audit + events", async () => {
  const db = createDb();
  const original = db.raw.prepare("SELECT * FROM items WHERE item_id='gear1'").get();
  const d = await del(db, "gear1");
  assert.equal(d.ok, true);
  assert.equal(rows(db, "SELECT 1 FROM items WHERE item_id='gear1'").length, 0);
  const r = await restore(db, d.auditId, "gear1");
  assert.equal(r.ok, true);
  const back = db.raw.prepare("SELECT * FROM items WHERE item_id='gear1'").get();
  for (const k of Object.keys(original)) if (!["inventory_slot", "updated_at", "extra_json"].includes(k)) assert.equal(back[k], original[k], k);
  assert.deepEqual(JSON.parse(back.extra_json), JSON.parse(original.extra_json));
  assert.deepEqual(rows(db, "SELECT event_type FROM item_ownership_events ORDER BY event_type").map((e) => e.event_type), ["admin_deleted", "admin_restored"]);
  assert.deepEqual(rows(db, "SELECT event_type FROM admin_audit_log ORDER BY event_type").map((e) => e.event_type), ["ADMIN_ITEM_DELETE", "ADMIN_ITEM_RESTORE"]);
  assert.equal(rows(db, "SELECT 1 FROM item_provenance WHERE item_id='gear1'").length, 1);
});

test("prod DDL: activity guards run inside the batch (pending receipt / fresh run after preflight)", async () => {
  for (const start of [(db) => db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','r1','tok','{}','pending','t')").run(), (db) => db.raw.prepare("INSERT INTO character_run_state (character_id, updated_at) VALUES ('c1', ?)").run(new Date().toISOString())]) {
    const db = createDb();
    const pv = await j(await h.handleAdminPreviewItemDelete(db, ADMIN, q({ playerId: "P1", characterId: "c1", itemId: "gear1" })));
    const real = db.batch.bind(db);
    db.batch = async (list) => { start(db); return real(list); };
    const r = await j(await h.handleAdminDeleteItem(db, ADMIN, { playerId: "P1", characterId: "c1", itemId: "gear1", reason: "race on prod ddl", confirmText: "gear1", snapshotHash: pv.snapshotHash, requestId: `req-ps-race-${++n}-abcd` }));
    assert.equal(r.status, 409);
    assert.equal(rows(db, "SELECT 1 FROM items WHERE item_id='gear1'").length, 1);
    assert.equal(rows(db, "SELECT 1 FROM admin_audit_log WHERE event_type='ADMIN_ITEM_DELETE'").length, 0);
  }
});

test("prod DDL: partial stack delete then restore returns the stack to its original quantity; replay does not double-add", async () => {
  const db = createDb();
  const d = await del(db, "junk1", 3);
  assert.equal(JSON.parse(db.raw.prepare("SELECT extra_json FROM items WHERE item_id='junk1'").get().extra_json).quantity, 4);
  assert.equal((await restore(db, d.auditId, "junk1")).ok, true);
  assert.equal((await restore(db, d.auditId, "junk1")).already_applied, true);
  assert.equal(JSON.parse(db.raw.prepare("SELECT extra_json FROM items WHERE item_id='junk1'").get().extra_json).quantity, 7);
});

test("S1 on prod DDL: restore is blocked by a run or pending operation that starts after the preflight, and by a stale run that is refreshed", async () => {
  const starts = [
    ["fresh run", (db) => db.raw.prepare("INSERT INTO character_run_state (character_id, updated_at) VALUES ('c1', ?)").run(new Date().toISOString()), "character_in_run", null],
    ["refreshed stale run", (db) => db.raw.prepare("UPDATE character_run_state SET updated_at = ? WHERE character_id = 'c1'").run(new Date().toISOString()), "character_in_run", (db) => db.raw.prepare("INSERT INTO character_run_state (character_id, updated_at) VALUES ('c1','2026-09-29T14:55:14.765Z')").run()],
    ["unparseable run timestamp", (db) => db.raw.prepare("INSERT INTO character_run_state (character_id, updated_at) VALUES ('c1', 'not-a-date')").run(), "character_in_run", null],
    ["pending operation", (db) => db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','rr1','tok-rr','{}','pending','t')").run(), "operation_pending", null],
  ];
  for (const [label, start, expected, prepare] of starts) {
    const db = createDb();
    const d = await del(db, "gear1");
    if (prepare) prepare(db);
    const real = db.batch.bind(db);
    db.batch = async (list) => { start(db); return real(list); };
    const r = await restore(db, d.auditId, "gear1");
    assert.equal(r.status, 409, label); assert.equal(r.error, expected, label);
    assert.equal(rows(db, "SELECT 1 FROM items WHERE item_id='gear1'").length, 0, label);
    assert.equal(rows(db, "SELECT 1 FROM admin_audit_log WHERE event_type='ADMIN_ITEM_RESTORE'").length, 0, label);
    assert.equal(rows(db, "SELECT 1 FROM item_ownership_events WHERE event_type='admin_restored'").length, 0, label);
  }
});

test("S2/S3 on prod DDL: malformed quantity or extra_json snapshots fail closed and create nothing", async () => {
  const db = createDb();
  const mk = (id, qtyRaw, extra) => {
    const item = { item_id: "gz", player_id: "P1", character_id: "c1", slot_type: "weapon", equipped: 0, inventory_slot: "", item_template_id: "", rarity: "", name: "Z", item_level: 0, enhance_level: 0, bound: 0, quantity: 1, atk: 0, def: 0, hp: 0, mp: 0, extra_json: extra, created_at: "t", updated_at: "t" };
    db.raw.prepare("INSERT INTO admin_audit_log VALUES (?,?,?,?,?,?,?)").run(id, "Admin_1", "ADMIN_ITEM_DELETE", "item", "gz", `{"before":{"playerId":"P1","characterId":"c1","itemId":"gz","quantityRequested":${qtyRaw},"item":${JSON.stringify(item)}}}`, "t");
  };
  mk("adm-del-ps-frac0001", "1.9", {});
  mk("adm-del-ps-str00001", '"1"', {});
  mk("adm-del-ps-arr00001", "1", []);
  mk("adm-del-ps-null0001", "1", null);
  mk("adm-del-ps-bad00001", "1", "{bad");
  for (const id of ["adm-del-ps-frac0001", "adm-del-ps-str00001", "adm-del-ps-arr00001", "adm-del-ps-null0001", "adm-del-ps-bad00001"]) {
    const r = await restore(db, id, "gz");
    assert.equal(r.status, 409, id); assert.equal(r.error, "audit_not_restorable", id);
  }
  assert.equal(rows(db, "SELECT 1 FROM items WHERE item_id='gz'").length, 0);
  assert.equal(rows(db, "SELECT 1 FROM admin_audit_log WHERE event_type='ADMIN_ITEM_RESTORE'").length, 0);
});
