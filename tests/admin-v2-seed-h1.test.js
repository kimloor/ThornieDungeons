// W2-H H1 (ADMIN-V2-W2H-QA-SEED-DRAFT.md §9): Admin QA Seed framework + `gold` canary operation.
// Ships disabled; preview is read-only; apply is atomic with its audit row and idempotent.
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
source += `\nglobalThis.__h = { handleAdminSeedLookup, handleAdminSeedPreview, handleAdminSeedApply, ADMIN_SEED_OPS };\n`;
const sandbox = { console, Response, Headers, Request, URL, URLSearchParams, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout, Date };
vm.createContext(sandbox); vm.runInContext(source, sandbox);
const h = sandbox.__h;

const ADMIN = { ok: true, playerId: "Admin_1", role: "admin" };
const OLD = "2026-10-01T00:00:00.000Z";

function createDb({ enabled = true } = {}) {
  const db = new Db();
  db.raw.exec(`
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL DEFAULT '', diamonds INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT 'now');
    CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, slot_index INTEGER NOT NULL DEFAULT 0, name TEXT NOT NULL DEFAULT '', level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, stat_points INTEGER NOT NULL DEFAULT 0, gold INTEGER NOT NULL DEFAULT 0, unlocked_floor INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '', last_active_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE game_config (key TEXT PRIMARY KEY, value_json TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
    CREATE TABLE character_run_state (character_id TEXT PRIMARY KEY, floor INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);
    CREATE TABLE character_operation_receipts (character_id TEXT NOT NULL, operation TEXT NOT NULL, request_id TEXT NOT NULL, operation_token TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, result_json TEXT NOT NULL DEFAULT 'pending');
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0022_admin_v2_auth.sql"), "utf8").replace(/ALTER TABLE players[^;]*;/g, ""));
  db.raw.prepare("INSERT INTO players (id, password, diamonds) VALUES ('Admin_1','',0), ('P1','secret-hash',7), ('P2','',0)").run();
  const ins = db.raw.prepare("INSERT INTO characters (character_id, player_id, slot_index, name, level, gold, unlocked_floor, created_at, updated_at, last_active_at) VALUES (?,?,?,?,?,?,?,?,?,?)");
  ins.run("c1", "P1", 0, "Alpha", 1, 100, 1, OLD, OLD, "");
  ins.run("c1b", "P1", 1, "Beta", 20, 5, 3, OLD, OLD, new Date().toISOString());
  ins.run("c2", "P2", 0, "Other", 1, 50, 1, OLD, OLD, "");
  if (enabled) db.raw.prepare("INSERT INTO game_config VALUES ('admin_seed_enabled','true','t')").run();
  return db;
}
const j = async (r) => ({ status: r.status, ...(await r.json()) });
const q = (o) => new URLSearchParams(o);
const lookup = async (db, username = "P1", auth = ADMIN) => j(await h.handleAdminSeedLookup(db, auth, q({ username })));
const preview = async (db, over = {}) => j(await h.handleAdminSeedPreview(db, ADMIN, { playerId: "P1", characterId: "c1", ops: { gold: { amount: 500 } }, ...over }));
let n = 0;
const apply = async (db, over = {}) => {
  const body = { playerId: "P1", characterId: "c1", ops: { gold: { amount: 500 } }, reason: "QA baseline for testing", requestId: `req-${++n}-abcdefgh`, ...over };
  if (!("previewHash" in over)) { const pv = await preview(db, { playerId: body.playerId, characterId: body.characterId, ops: body.ops }); body.previewHash = pv.previewHash; }
  return j(await h.handleAdminSeedApply(db, ADMIN, body));
};
const gold = (db, id = "c1") => db.raw.prepare("SELECT gold FROM characters WHERE character_id=?").get(id).gold;
const audits = (db) => db.raw.prepare("SELECT * FROM admin_audit_log WHERE event_type='ADMIN_SEED'").all();

test("ships disabled: absent or non-true flag blocks lookup, preview and apply (403 feature_disabled)", async () => {
  for (const setup of [(db) => db.raw.exec("DELETE FROM game_config"), (db) => db.raw.exec("UPDATE game_config SET value_json='false'"), (db) => db.raw.exec("UPDATE game_config SET value_json='\"true\"'")]) {
    const db = createDb(); setup(db);
    assert.equal((await lookup(db)).error, "feature_disabled");
    assert.equal((await preview(db)).error, "feature_disabled");
    const r = await j(await h.handleAdminSeedApply(db, ADMIN, { playerId: "P1", characterId: "c1", ops: { gold: { amount: 5 } }, reason: "valid reason", requestId: "req-flag-abcdefgh", previewHash: "0".repeat(64) }));
    assert.equal(r.status, 403); assert.equal(r.error, "feature_disabled");
    assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
  }
});

test("requires an admin session on every entry point", async () => {
  const db = createDb();
  const bad = { ok: false, error: "admin_session_invalid" };
  assert.equal((await lookup(db, "P1", bad)).status, 401);
  assert.equal((await j(await h.handleAdminSeedPreview(db, bad, {}))).status, 401);
  assert.equal((await j(await h.handleAdminSeedApply(db, bad, {}))).status, 401);
});

test("lookup lists every character of the username with account diamonds, blocks and warnings", async () => {
  const db = createDb();
  db.raw.prepare("INSERT INTO character_run_state VALUES ('c1', 1, ?)").run(new Date().toISOString());
  const r = await lookup(db);
  assert.equal(r.status, 200);
  assert.deepEqual(r.account, { playerId: "P1", diamonds: 7 });
  assert.deepEqual(r.characters.map((c) => c.name), ["Alpha", "Beta"]);
  assert.equal(r.characters[0].blocked, "character_in_run");
  assert.equal(r.characters[1].blocked, null);
  assert.deepEqual(r.characters[1].warnings.sort(), ["high_level", "recently_active"]);
  assert.deepEqual(r.operations, ["gold"]);
  assert.ok(!JSON.stringify(r).includes("secret-hash"));
  assert.equal((await lookup(db, "nobody")).status, 404);
  assert.equal((await lookup(db, "  ")).error, "missing_fields");
});

test("preview is read-only and returns before/after plus a 64-hex hash", async () => {
  const db = createDb();
  const pv = await preview(db);
  assert.equal(pv.status, 200);
  assert.deepEqual(pv.changes, [{ op: "gold", label: "Gold", before: 100, after: 600, amount: 500 }]);
  assert.equal(pv.target.name, "Alpha");
  assert.match(pv.previewHash, /^[0-9a-f]{64}$/);
  assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
  assert.equal((await preview(db)).previewHash, pv.previewHash);
});

test("preview rejects bad amounts, unknown ops, empty ops and foreign characters", async () => {
  const db = createDb();
  for (const amount of [0, -1, 100001, 1.5, "10", null, undefined]) {
    const r = await preview(db, { ops: { gold: { amount } } });
    assert.equal(r.status, 400); assert.equal(r.error, "invalid_seed_amount");
  }
  assert.equal((await preview(db, { ops: { gold: { amount: 100000 } } })).status, 200);
  assert.equal((await preview(db, { ops: { diamonds: { amount: 5 } } })).error, "unknown_seed_op");
  assert.equal((await preview(db, { ops: { constructor: {} } })).error, "unknown_seed_op");
  assert.equal((await preview(db, { ops: {} })).error, "no_seed_ops");
  assert.equal((await preview(db, { ops: [] })).error, "no_seed_ops");
  assert.equal((await preview(db, { characterId: "c2" })).error, "character_not_found");
  assert.equal((await preview(db, { playerId: "" })).error, "missing_fields");
});

test("pending operation or a run touched within 30 minutes blocks preview and apply; an old run does not", async () => {
  let db = createDb();
  db.raw.prepare("INSERT INTO character_operation_receipts (character_id, operation, request_id, operation_token, payload_json, result_json) VALUES ('c1','buy','r','t','{}','pending')").run();
  assert.equal((await preview(db)).error, "operation_pending");
  db = createDb();
  db.raw.prepare("INSERT INTO character_run_state VALUES ('c1', 1, ?)").run(new Date().toISOString());
  assert.equal((await preview(db)).error, "character_in_run");
  db = createDb();
  db.raw.prepare("INSERT INTO character_run_state VALUES ('c1', 1, ?)").run(new Date(Date.now() - 31 * 60 * 1000).toISOString());
  const ok = await apply(db);
  assert.equal(ok.status, 200); assert.equal(gold(db), 600);
});

test("apply adds gold, writes exactly one ADMIN_SEED audit row and touches no other character", async () => {
  const db = createDb();
  const r = await apply(db);
  assert.equal(r.status, 200); assert.equal(r.ok, true);
  assert.equal(gold(db), 600); assert.equal(gold(db, "c1b"), 5); assert.equal(gold(db, "c2"), 50);
  assert.notEqual(db.raw.prepare("SELECT updated_at FROM characters WHERE character_id='c1'").get().updated_at, OLD);
  const rows = audits(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].target_type, "character"); assert.equal(rows[0].target_id, "c1"); assert.equal(rows[0].player_id, "Admin_1");
  const meta = JSON.parse(rows[0].metadata_json);
  assert.equal(meta.reason, "QA baseline for testing");
  assert.deepEqual(meta.before, { playerId: "P1", characterId: "c1", characterName: "Alpha", gold: 100 });
  assert.deepEqual(meta.after, { gold: 600 });
  assert.deepEqual(meta.changedKeys, ["gold"]);
  assert.ok(!rows[0].metadata_json.includes("secret-hash"));
});

test("apply is idempotent per requestId and refuses a requestId reused for another character", async () => {
  const db = createDb();
  const first = await apply(db, { requestId: "req-idem-abcdefgh" });
  assert.equal(first.status, 200);
  const replay = await apply(db, { requestId: "req-idem-abcdefgh" });
  assert.equal(replay.status, 200); assert.equal(replay.already_applied, true);
  assert.equal(gold(db), 600); assert.equal(audits(db).length, 1);
  const other = await j(await h.handleAdminSeedApply(db, ADMIN, { playerId: "P1", characterId: "c1b", ops: { gold: { amount: 1 } }, reason: "valid reason", requestId: "req-idem-abcdefgh", previewHash: "0".repeat(64) }));
  assert.equal(other.status, 409); assert.equal(other.error, "request_id_conflict");
  assert.equal(gold(db, "c1b"), 5);
});

test("apply validates reason, requestId and previewHash before touching data", async () => {
  const db = createDb();
  assert.equal((await apply(db, { reason: "" })).error, "reason_required");
  assert.equal((await apply(db, { reason: "   " })).error, "reason_required");
  assert.equal((await apply(db, { reason: "abcd" })).error, "invalid_reason");
  assert.equal((await apply(db, { reason: "x".repeat(301) })).error, "invalid_reason");
  assert.equal((await apply(db, { requestId: "short" })).error, "invalid_request_id");
  assert.equal((await apply(db, { requestId: "has space in id" })).error, "invalid_request_id");
  assert.equal((await apply(db, { previewHash: undefined })).error, "preview_required");
  assert.equal((await apply(db, { previewHash: "nothex" })).error, "preview_required");
  assert.equal((await apply(db, { previewHash: "0".repeat(64) })).error, "preview_changed");
  assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
});

test("a preview goes stale when the character changes before apply (409 preview_changed)", async () => {
  const db = createDb();
  const pv = await preview(db);
  db.raw.prepare("UPDATE characters SET gold = 999, updated_at = ? WHERE character_id='c1'").run(new Date().toISOString());
  const r = await apply(db, { previewHash: pv.previewHash });
  assert.equal(r.status, 409); assert.equal(r.error, "preview_changed");
  assert.equal(gold(db), 999); assert.equal(audits(db).length, 0);
});

test("audit failure rolls the whole batch back (500 admin_audit_failed, gold unchanged)", async () => {
  const db = createDb();
  const pv = await preview(db);
  db.raw.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_log BEGIN SELECT RAISE(ABORT, 'boom'); END");
  const r = await j(await h.handleAdminSeedApply(db, ADMIN, { playerId: "P1", characterId: "c1", ops: { gold: { amount: 500 } }, reason: "valid reason", requestId: "req-fail-abcdefgh", previewHash: pv.previewHash }));
  assert.equal(r.status, 500); assert.equal(r.error, "admin_audit_failed");
  assert.equal(gold(db), 100);
});

test("the mutation is gated on the audit row: a state change after planning applies nothing", async () => {
  const db = createDb();
  const ctx = { characterId: "c1", playerId: "P1", now: new Date().toISOString(), auditId: "adm-seed-never-inserted" };
  const planned = h.ADMIN_SEED_OPS.gold.plan({ gold: 100 }, { amount: 500 });
  const res = await planned.mutate(db, ctx).run();
  assert.equal(res.meta.changes, 0);
  assert.equal(gold(db), 100);
});
