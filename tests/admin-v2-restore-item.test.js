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

test("round trip: delete then restore returns the identical row (id, enhance, empower, stats), by a different admin", async () => {
  const db = createDb();
  const original = rowOf(db, "gear1");
  const auditId = await del(db, "gear1");
  assert.equal(rowOf(db, "gear1"), undefined);
  const r = await restore(db, auditId);
  assert.equal(r.ok, true); assert.equal(r.mode, "insert"); assert.equal(r.overflow, false); assert.equal(r.itemId, "gear1");
  const back = rowOf(db, "gear1");
  for (const k of ["item_id", "player_id", "character_id", "slot_type", "name", "rarity", "enhance_level", "item_level", "atk", "def", "hp", "mp", "bound", "created_at"]) assert.equal(back[k], original[k], k);
  assert.deepEqual(JSON.parse(back.extra_json), JSON.parse(original.extra_json));
  assert.equal(back.equipped, 0);
  const a = db.raw.prepare("SELECT * FROM admin_audit_log WHERE event_type='ADMIN_ITEM_RESTORE'").get();
  assert.equal(a.player_id, "Admin_2"); assert.equal(a.audit_id, `adm-res-${auditId}`); assert.equal(a.target_id, "gear1");
  const meta = JSON.parse(a.metadata_json);
  assert.equal(meta.reason, "restoring by owner request"); assert.equal(meta.before.deleteAuditId, auditId);
  const ev = db.raw.prepare("SELECT * FROM item_ownership_events WHERE event_type='admin_restored'").get();
  assert.equal(ev.to_player_id, "P1"); assert.equal(JSON.parse(ev.context_json).restoredFromAuditId, auditId);
});

test("full carried inventory: restored into overflow (flag set, row otherwise intact)", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  fill(db, 30);
  const r = await restore(db, auditId);
  assert.equal(r.overflow, true);
  assert.equal(JSON.parse(rowOf(db, "gear1").extra_json).overflow, true);
  assert.equal(rowOf(db, "gear1").enhance_level, 7);
});

test("overflow rows and equipped rows do not count toward the 30 carried slots", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  fill(db, 28); // + the junk1 stack = 29 carried; one slot left
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, created_at, updated_at, extra_json) VALUES ('eq','P1','c1','armor',1,'t','t','{}'), ('ov','P1','c1','armor',0,'t','t','{\"overflow\":true}')").run();
  assert.equal((await restore(db, auditId)).overflow, false);
});

test("original item_id taken: restored under a deterministic new id, link kept in audit", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, created_at, updated_at) VALUES ('gear1','P1','c1','weapon','t','t')").run();
  const r = await restore(db, auditId);
  assert.equal(r.ok, true); assert.equal(r.idChanged, true); assert.notEqual(r.itemId, "gear1"); assert.match(r.itemId, /^adm-res-[0-9a-f]{20}$/);
  assert.equal(rowOf(db, r.itemId).enhance_level, 7);
  assert.equal(JSON.parse(db.raw.prepare("SELECT metadata_json FROM admin_audit_log WHERE event_type='ADMIN_ITEM_RESTORE'").get().metadata_json).after.originalItemId, "gear1");
});

test("partial stack: deleted quantity is added back to the remaining row; whole quantity restored", async () => {
  const db = createDb();
  const auditId = await del(db, "junk1", 3);
  assert.equal(JSON.parse(rowOf(db, "junk1").extra_json).quantity, 4);
  const r = await restore(db, auditId, { confirmText: "junk1" });
  assert.equal(r.mode, "merge"); assert.equal(r.resultingQuantity, 7);
  assert.equal(JSON.parse(rowOf(db, "junk1").extra_json).quantity, 7);
});

test("stack row gone since the partial delete: re-created with exactly the deleted quantity", async () => {
  const db = createDb();
  const auditId = await del(db, "junk1", 3);
  db.raw.prepare("DELETE FROM items WHERE item_id='junk1'").run();
  const r = await restore(db, auditId, { confirmText: "junk1" });
  assert.equal(r.mode, "insert");
  assert.equal(JSON.parse(rowOf(db, "junk1").extra_json).quantity, 3);
});

test("stack merge that would exceed 99 becomes a separate restored row", async () => {
  const db = createDb();
  const auditId = await del(db, "junk1", 3);
  db.raw.prepare("UPDATE items SET extra_json='{\"junkId\":\"scrap\",\"quantity\":98,\"overflow\":false}' WHERE item_id='junk1'").run();
  const r = await restore(db, auditId, { confirmText: "junk1" });
  assert.equal(r.mode, "insert"); assert.equal(r.idChanged, true);
  assert.equal(JSON.parse(rowOf(db, r.itemId).extra_json).quantity, 3);
  assert.equal(JSON.parse(rowOf(db, "junk1").extra_json).quantity, 98);
});

test("a delete can be restored only once; repeat returns already_applied and changes nothing", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  assert.equal((await restore(db, auditId)).ok, true);
  const again = await restore(db, auditId);
  assert.equal(again.already_applied, true);
  assert.equal(count(db, "items", "item_id='gear1'"), 1);
  assert.equal(count(db, "admin_audit_log", "event_type='ADMIN_ITEM_RESTORE'"), 1);
  assert.equal((await j(await h.handleAdminPreviewItemRestore(db, ADMIN, q({ auditId })))).alreadyRestored, true);
});

test("preview reports the plan without writing", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  fill(db, 30);
  const before = count(db, "admin_audit_log");
  const p = await j(await h.handleAdminPreviewItemRestore(db, ADMIN, q({ auditId })));
  assert.equal(p.ok, true); assert.equal(p.overflow, true); assert.equal(p.mode, "insert"); assert.equal(p.item.name, "Sword");
  assert.equal(count(db, "admin_audit_log"), before); assert.equal(rowOf(db, "gear1"), undefined);
});

test("not restorable: unknown audit, wrong event type, truncated or redacted snapshot", async () => {
  const db = createDb();
  assert.equal((await restore(db, "adm-del-doesnotexist1")).status, 404);
  db.raw.prepare("INSERT INTO admin_audit_log VALUES ('adm-del-trunc00001','Admin_1','ADMIN_ITEM_DELETE','item','x','{\"truncated\":true,\"fields\":[]}','t')").run();
  assert.equal((await restore(db, "adm-del-trunc00001")).error, "audit_not_restorable");
  const red = { before: { playerId: "P1", characterId: "c1", quantityRequested: 1, item: { item_id: "x", slot_type: "weapon", extra_json: { passive: "[redacted]" } } } };
  db.raw.prepare("INSERT INTO admin_audit_log VALUES ('adm-del-redact0001','Admin_1','ADMIN_ITEM_DELETE','item','x',?,'t')").run(JSON.stringify(red));
  assert.equal((await restore(db, "adm-del-redact0001")).error, "audit_not_restorable");
  db.raw.prepare("INSERT INTO admin_audit_log VALUES ('adm-del-wrongtype01','Admin_1','ADMIN_RECIPE_DELETE','recipe','x','{}','t')").run();
  assert.equal((await restore(db, "adm-del-wrongtype01")).status, 404);
  assert.equal(count(db, "items"), 2);
});

test("character deleted since: character_not_found, nothing written", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  db.raw.prepare("DELETE FROM characters").run();
  const r = await restore(db, auditId);
  assert.equal(r.status, 404); assert.equal(r.error, "character_not_found");
  assert.equal(count(db, "admin_audit_log", "event_type='ADMIN_ITEM_RESTORE'"), 0);
});

test("disabled by the kill switch; 401 without session; validation of reason and confirmText", async () => {
  const off = createDb({ enabled: false });
  assert.equal((await restore(off, "adm-del-whatever001")).error, "feature_disabled");
  const db = createDb();
  const auditId = await del(db, "gear1");
  assert.equal((await restore(db, auditId, {}, { error: "admin_session_invalid" })).status, 401);
  assert.equal((await restore(db, auditId, { reason: undefined })).error, "reason_required");
  assert.equal((await restore(db, auditId, { reason: "abcd" })).error, "invalid_reason");
  assert.equal((await restore(db, auditId, { confirmText: "GEAR1" })).error, "confirm_mismatch");
  assert.equal((await restore(db, "bad")).error, "missing_fields");
  assert.equal(rowOf(db, "gear1"), undefined);
});

test("injected audit failure rolls back: no item, no ownership event", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  db.raw.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_log WHEN NEW.event_type='ADMIN_ITEM_RESTORE' BEGIN SELECT RAISE(ABORT,'down'); END;`);
  const orig = console.error; console.error = () => {};
  try { const r = await restore(db, auditId); assert.equal(r.status, 500); assert.equal(r.error, "admin_audit_failed"); } finally { console.error = orig; }
  assert.equal(rowOf(db, "gear1"), undefined);
  assert.equal(count(db, "item_ownership_events", "event_type='admin_restored'"), 0);
});

test("state changes between planning and batch: guarded statements write nothing (409)", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  const realBatch = db.batch.bind(db);
  db.batch = async (list) => { db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, created_at, updated_at) VALUES ('gear1','P1','c1','weapon','t','t')").run(); return realBatch(list); };
  const r = await restore(db, auditId);
  assert.equal(r.status, 409); assert.equal(r.error, "item_state_changed");
  assert.equal(count(db, "admin_audit_log", "event_type='ADMIN_ITEM_RESTORE'"), 0);
  assert.equal(count(db, "item_ownership_events", "event_type='admin_restored'"), 0);
});

test("audit list marks deletes as restored once restored", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  const list = async () => (await j(await h.handleAdminListAuditLog(db, ADMIN, q({ eventType: "ADMIN_ITEM_DELETE" })))).entries;
  assert.equal((await list())[0].restored, false);
  await restore(db, auditId);
  assert.equal((await list())[0].restored, true);
});

test("source: restore is routed through Admin auth, restore audit ids derive from the delete audit id, UI has one restore action", () => {
  const src = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  assert.match(src, /case "adminRestoreItem": return await handleAdminRestoreItem\(db, adminAuth, body\)/);
  assert.match(src, /const restoreAuditId = `adm-res-\$\{auditId\}`/);
  const ui = fs.readFileSync(path.join(__dirname, "../admin-app.js"), "utf8");
  assert.equal((ui.match(/action: "adminRestoreItem"/g) || []).length, 1);
  assert.doesNotMatch(ui, /\.innerHTML/);
});


// ---- W2-F/W2-G hardening (Project Lead review of main ca84ae56, findings B1 / B2 / C) ----
const IDENT = (db, id) => db.raw.prepare("SELECT * FROM items WHERE item_id=?").get(id);
const settle = (db, sql) => db.raw.exec(sql);

test("B1: same id but a DIFFERENT stack (other junkId) is never merged into: safe insert under a new id", async () => {
  const db = createDb();
  const auditId = await del(db, "junk1", 3);
  db.raw.prepare("UPDATE items SET name='Other', extra_json='{\"junkId\":\"cloth\",\"quantity\":4,\"overflow\":false}' WHERE item_id='junk1'").run();
  const r = await restore(db, auditId, { confirmText: "junk1" });
  assert.equal(r.ok, true); assert.equal(r.mode, "insert"); assert.equal(r.idChanged, true);
  assert.equal(JSON.parse(IDENT(db, "junk1").extra_json).quantity, 4);
  assert.equal(JSON.parse(IDENT(db, "junk1").extra_json).junkId, "cloth");
  const restored = IDENT(db, r.itemId);
  assert.equal(JSON.parse(restored.extra_json).junkId, "scrap"); assert.equal(JSON.parse(restored.extra_json).quantity, 3); assert.equal(restored.name, "Scrap");
});

test("B1: identity fields must match to merge (slot_type, template, rarity, name, levels, bound, stats, extra other than quantity/overflow)", async () => {
  for (const change of ["slot_type='potion'", "item_template_id='tpl-x'", "rarity='rare'", "name='Renamed'", "item_level=9", "enhance_level=2", "bound=1", "atk=5", "extra_json='{\"junkId\":\"scrap\",\"quantity\":4,\"overflow\":false,\"tag\":\"x\"}'"]) {
    const db = createDb();
    const auditId = await del(db, "junk1", 3);
    db.raw.prepare(`UPDATE items SET ${change} WHERE item_id='junk1'`).run();
    const r = await restore(db, auditId, { confirmText: "junk1" });
    assert.equal(r.ok, true, change); assert.equal(r.mode, "insert", change); assert.equal(r.idChanged, true, change);
    assert.equal(count(db, "items", "item_id LIKE 'adm-res-%'"), 1, change);
  }
});

test("B1: quantity/overflow differences alone do not block a merge (same item, different amount)", async () => {
  const db = createDb();
  const auditId = await del(db, "junk1", 3);
  db.raw.prepare("UPDATE items SET extra_json='{\"junkId\":\"scrap\",\"quantity\":10,\"overflow\":true}' WHERE item_id='junk1'").run();
  const r = await restore(db, auditId, { confirmText: "junk1" });
  assert.equal(r.mode, "merge"); assert.equal(JSON.parse(IDENT(db, "junk1").extra_json).quantity, 13);
});

test("B1: merge is also refused when the id now belongs to another player or character (collision), data goes to a new id", async () => {
  const db = createDb();
  const auditId = await del(db, "junk1"); // whole stack gone, so the id is free to be reused by someone else
  db.raw.prepare("INSERT INTO players (id) VALUES ('P9')").run();
  db.raw.prepare("INSERT INTO characters VALUES ('c9','P9')").run();
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, created_at, updated_at, extra_json) VALUES ('junk1','P9','c9','junk','t','t','{\"junkId\":\"scrap\",\"quantity\":1}')").run();
  const r = await restore(db, auditId, { confirmText: "junk1" });
  assert.equal(r.mode, "insert"); assert.equal(r.idChanged, true);
  assert.equal(IDENT(db, r.itemId).player_id, "P1");
  assert.equal(JSON.parse(IDENT(db, "junk1").extra_json).quantity, 1);
});

test("B1: merge guard also holds at the mutation: the stack changes identity between planning and batch -> 409, nothing added", async () => {
  const db = createDb();
  const auditId = await del(db, "junk1", 3);
  const realBatch = db.batch.bind(db);
  db.batch = async (list) => { db.raw.prepare("UPDATE items SET extra_json='{\"junkId\":\"cloth\",\"quantity\":4}', updated_at='2026-10-30T00:00:00Z' WHERE item_id='junk1'").run(); return realBatch(list); };
  const r = await restore(db, auditId, { confirmText: "junk1" });
  assert.equal(r.status, 409); assert.equal(r.error, "item_state_changed");
  assert.equal(JSON.parse(IDENT(db, "junk1").extra_json).quantity, 4);
  assert.equal(count(db, "admin_audit_log", "event_type='ADMIN_ITEM_RESTORE'"), 0);
});

test("C: snapshot integrity is checked before restore (fail closed, no guessing)", async () => {
  const db = createDb();
  const good = JSON.parse(db.raw.prepare("SELECT 1").get() ? "{}" : "{}");
  const mk = (id, mutate) => {
    const row = { item_id: "gx", player_id: "P1", character_id: "c1", slot_type: "weapon", equipped: 0, inventory_slot: "", item_template_id: "t", rarity: "rare", name: "N", item_level: 1, enhance_level: 0, bound: 0, quantity: 1, atk: 1, def: 0, hp: 0, mp: 0, extra_json: {}, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" };
    const before = { playerId: "P1", characterId: "c1", itemId: "gx", quantityRequested: 1, item: row };
    mutate(before);
    db.raw.prepare("INSERT INTO admin_audit_log VALUES (?,?,?,?,?,?,?)").run(id, "Admin_1", "ADMIN_ITEM_DELETE", "item", "gx", JSON.stringify({ outcome: "ok", before, after: null, changedKeys: ["deleted"], reason: "x" }), "t");
  };
  mk("adm-del-ok0000001", () => {});
  mk("adm-del-nocol00001", (b) => { delete b.item.created_at; });
  mk("adm-del-owner00001", (b) => { b.item.player_id = "P2"; });
  mk("adm-del-char000001", (b) => { b.item.character_id = "cX"; });
  mk("adm-del-qty0000001", (b) => { b.quantityRequested = 2; });
  mk("adm-del-badtype001", (b) => { b.item.atk = "many"; });
  mk("adm-del-extrabad01", (b) => { b.item.extra_json = 5; });
  assert.equal((await restore(db, "adm-del-ok0000001", { confirmText: "gx" })).ok, true);
  for (const id of ["adm-del-nocol00001", "adm-del-owner00001", "adm-del-char000001", "adm-del-qty0000001", "adm-del-badtype001", "adm-del-extrabad01"]) {
    const r = await restore(db, id, { confirmText: "gx" });
    assert.equal(r.status, 409, id); assert.equal(r.error, "audit_not_restorable", id);
  }
  assert.equal(count(db, "admin_audit_log", "event_type='ADMIN_ITEM_RESTORE'"), 1);
  assert.ok(good);
});

test("C: delete writes a snapshot that covers every items column, ownership and provenance (round trip uses only the snapshot)", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  const meta = JSON.parse(db.raw.prepare("SELECT metadata_json FROM admin_audit_log WHERE audit_id=?").get(auditId).metadata_json);
  const cols = db.raw.prepare("SELECT name FROM pragma_table_info('items')").all().map((c) => c.name);
  for (const c of cols) assert.ok(c in meta.before.item, `snapshot is missing items.${c}`);
  assert.equal(meta.before.playerId, "P1"); assert.equal(meta.before.characterId, "c1"); assert.equal(meta.before.quantityRequested, 1);
  assert.equal(meta.before.provenance.origin_type, "drop");
});

test("B2: a pending operation blocks restore (preflight and at the mutation)", async () => {
  let db = createDb();
  let auditId = await del(db, "gear1");
  db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','r1','tok1','{}','pending','t')").run();
  let r = await restore(db, auditId);
  assert.equal(r.status, 409); assert.equal(r.error, "operation_pending");
  assert.equal(IDENT(db, "gear1"), undefined);
  assert.equal((await j(await h.handleAdminPreviewItemRestore(db, ADMIN, q({ auditId })))).error, "operation_pending");

  db = createDb();
  auditId = await del(db, "gear1");
  const realBatch = db.batch.bind(db);
  db.batch = async (list) => { db.raw.prepare("INSERT INTO character_operation_receipts VALUES ('c1','sell','r2','tok2','{}','pending','t')").run(); return realBatch(list); };
  r = await restore(db, auditId);
  assert.equal(r.status, 409); assert.equal(r.error, "operation_pending");
  assert.equal(IDENT(db, "gear1"), undefined);
  assert.equal(count(db, "admin_audit_log", "event_type='ADMIN_ITEM_RESTORE'"), 0);
  assert.equal(count(db, "item_ownership_events", "event_type='admin_restored'"), 0);
});

test("B2: capacity is guarded at the mutation: the last carried slot is taken after planning -> 409, no 31st carried item", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  fill(db, 28); // + junk1 = 29 carried at planning time
  const realBatch = db.batch.bind(db);
  let once = false;
  db.batch = async (list) => { if (!once) { once = true; fill2(db); } return realBatch(list); };
  const fill2 = (d) => d.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, created_at, updated_at, extra_json) VALUES ('late1','P1','c1','weapon','t','t','{\"overflow\":false}')").run();
  const r = await restore(db, auditId);
  assert.equal(r.status, 409); assert.equal(r.error, "item_state_changed");
  assert.equal(IDENT(db, "gear1"), undefined);
  assert.equal(db.raw.prepare("SELECT COUNT(*) c FROM items WHERE character_id='c1' AND equipped=0 AND COALESCE(json_extract(extra_json,'$.overflow'),0) NOT IN (1,'1','true')").get().c, 30);
  // retry plans overflow and succeeds
  const again = await restore(db, auditId);
  assert.equal(again.ok, true); assert.equal(again.overflow, true);
});

test("B2: overflow restore never needs a free carried slot and is unaffected by later capacity changes", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  fill(db, 30);
  const realBatch = db.batch.bind(db);
  db.batch = async (list) => { db.raw.exec("DELETE FROM items WHERE item_id LIKE 'pad%'"); return realBatch(list); };
  const r = await restore(db, auditId);
  assert.equal(r.ok, true); assert.equal(r.overflow, true);
  assert.equal(JSON.parse(IDENT(db, "gear1").extra_json).overflow, true);
});

test("B2: concurrent restore of the same delete: exactly one wins, the other is already_applied, no duplicate item or quantity", async () => {
  for (const [itemId, qty, itemCount, quantityAfter] of [["gear1", undefined, 1, null], ["junk1", 3, 1, 7]]) {
    const db = createDb();
    const auditId = await del(db, itemId, qty);
    const realBatch = db.batch.bind(db);
    let first = true;
    db.batch = async (list) => { if (first) { first = false; await realBatch(list); } return realBatch(list); }; // winner lands, loser re-runs the same statements
    const r = await restore(db, auditId, { confirmText: itemId });
    assert.equal(r.ok, true, itemId); assert.equal(r.already_applied, true, itemId);
    assert.equal(count(db, "items", `item_id = '${itemId}'`), itemCount);
    if (quantityAfter) assert.equal(JSON.parse(IDENT(db, itemId).extra_json).quantity, quantityAfter);
    assert.equal(count(db, "admin_audit_log", "event_type='ADMIN_ITEM_RESTORE'"), 1);
    assert.equal(count(db, "item_ownership_events", "event_type='admin_restored'"), 1);
  }
});

test("B2: restore does not duplicate an item when the original is already back (e.g. restored by hand): safe new id, single audit", async () => {
  const db = createDb();
  const auditId = await del(db, "gear1");
  db.raw.prepare("INSERT INTO items (item_id, player_id, character_id, slot_type, name, created_at, updated_at) VALUES ('gear1','P1','c1','weapon','Manual','t','t')").run();
  const r = await restore(db, auditId);
  assert.equal(r.ok, true); assert.equal(r.idChanged, true);
  assert.equal(IDENT(db, "gear1").name, "Manual");
  assert.equal(count(db, "items", "item_id LIKE 'adm-res-%'"), 1);
});
