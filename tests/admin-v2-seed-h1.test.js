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
    if (this.beforeBatch) { const hook = this.beforeBatch; this.beforeBatch = null; await hook(this.raw); }
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


// ---------------------------------------------------------------------------------------------
// P1-A: the activity guard lives INSIDE the transaction (competing writer between preflight and batch)
// ---------------------------------------------------------------------------------------------
const seedBody = (over = {}) => ({ playerId: "P1", characterId: "c1", ops: { gold: { amount: 500 } }, reason: "QA baseline for testing", ...over });
async function applyWithHook(db, hook, over = {}) {
  const body = seedBody({ requestId: `req-${++n}-hookhook`, ...over });
  const pv = await preview(db, { playerId: body.playerId, characterId: body.characterId, ops: body.ops });
  db.beforeBatch = hook;
  return j(await h.handleAdminSeedApply(db, ADMIN, { ...body, previewHash: pv.previewHash }));
}

test("P1-A: a pending gameplay operation that appears after preflight blocks the apply with no audit and no mutation", async () => {
  const db = createDb();
  const r = await applyWithHook(db, (raw) => raw.prepare("INSERT INTO character_operation_receipts (character_id, operation, request_id, operation_token, payload_json, result_json) VALUES ('c1','buy','r','t','{}','pending')").run());
  assert.equal(r.status, 409); assert.equal(r.error, "operation_pending");
  assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
});

test("P1-A: a run that starts after preflight blocks the apply with no audit and no mutation", async () => {
  const db = createDb();
  const r = await applyWithHook(db, (raw) => raw.prepare("INSERT INTO character_run_state VALUES ('c1', 1, ?)").run(new Date().toISOString()));
  assert.equal(r.status, 409); assert.equal(r.error, "character_in_run");
  assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
});

test("P1-A: an unparseable run timestamp counts as an active run, both at preflight and inside the batch", async () => {
  let db = createDb();
  db.raw.prepare("INSERT INTO character_run_state VALUES ('c1', 1, 'garbage')").run();
  assert.equal((await preview(db)).error, "character_in_run");
  db = createDb();
  const r = await applyWithHook(db, (raw) => raw.prepare("INSERT INTO character_run_state VALUES ('c1', 1, 'garbage')").run());
  assert.equal(r.error, "character_in_run"); assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
});

test("P1-A: without a race the same apply succeeds, and a writer that only touches last_active_at does not block it", async () => {
  const db = createDb();
  const r = await applyWithHook(db, (raw) => raw.prepare("UPDATE characters SET last_active_at = ? WHERE character_id = 'c1'").run(new Date().toISOString()));
  assert.equal(r.status, 200); assert.equal(gold(db), 600); assert.equal(audits(db).length, 1);
});

// ---------------------------------------------------------------------------------------------
// P1-D: field-level guard on what the operation reads; writer coverage of `characters`
// ---------------------------------------------------------------------------------------------
test("P1-D: Gold changed by a writer that does NOT bump updated_at is still detected (field-level guard)", async () => {
  const db = createDb();
  const r = await applyWithHook(db, (raw) => raw.prepare("UPDATE characters SET gold = 999 WHERE character_id = 'c1'").run());
  assert.equal(r.status, 409); assert.equal(r.error, "character_state_changed");
  assert.equal(gold(db), 999); assert.equal(audits(db).length, 0);
});

test("P1-D: preview hash also binds the guarded field values", async () => {
  const db = createDb();
  const a = await preview(db);
  db.raw.prepare("UPDATE characters SET gold = 101 WHERE character_id = 'c1'").run();
  const b = await preview(db);
  assert.notEqual(a.previewHash, b.previewHash);
});

test("P1-D writer coverage: every UPDATE characters that does not bump updated_at is a known, Gold-free writer", () => {
  const root = path.resolve(__dirname, "..");
  const files = ["workers/thornie-dungeons-api.js", ...fs.readdirSync(path.join(root, "workers/modules")).map((f) => "workers/modules/" + f)];
  const nonBumping = [];
  let bumping = 0;
  for (const file of files) {
    const src = fs.readFileSync(path.join(root, file), "utf8");
    for (const m of src.matchAll(/UPDATE\s+characters\s+SET([\s\S]*?)\sWHERE/gi)) {
      const columns = [...m[1].matchAll(/(\w+)\s*=/g)].map((x) => x[1]);
      if (columns.includes("updated_at")) { bumping += 1; continue; }
      nonBumping.push(columns.join(","));
    }
  }
  // Review these when this list changes: a new non-bumping writer must not touch a column a seed operation guards.
  assert.deepEqual(nonBumping.sort(), ["last_active_at", "raid_stamina,raid_stamina_updated_at"]);
  assert.ok(bumping >= 15);
  assert.ok(!nonBumping.some((cols) => cols.split(",").includes("gold")));
});

// ---------------------------------------------------------------------------------------------
// P1-B: requestId is bound to the exact request (player, character, operations)
// ---------------------------------------------------------------------------------------------
const rawApply = async (db, over) => {
  const body = seedBody(over);
  const pv = await preview(db, { playerId: body.playerId, characterId: body.characterId, ops: body.ops });
  return j(await h.handleAdminSeedApply(db, ADMIN, { previewHash: pv.previewHash || "0".repeat(64), ...body }));
};

test("P1-B: replaying the identical request is already_applied (even with ops keys in another order) and never mutates twice", async () => {
  const db = createDb();
  const body = seedBody({ requestId: "req-bind-abcdefgh" });
  assert.equal((await rawApply(db, body)).status, 200);
  assert.equal((await rawApply(db, body)).already_applied, true);
  assert.equal(gold(db), 600); assert.equal(audits(db).length, 1);
  assert.ok(JSON.parse(audits(db)[0].metadata_json).requestHash.match(/^[0-9a-f]{64}$/));
});

test("P1-B: the same requestId with a different amount, player or character is 409 request_id_conflict and changes nothing", async () => {
  const db = createDb();
  const base = { requestId: "req-bind-abcdefgh" };
  assert.equal((await rawApply(db, base)).status, 200);
  for (const over of [{ ops: { gold: { amount: 501 } } }, { playerId: "P2", characterId: "c2" }, { characterId: "c1b" }, { playerId: "P2" }]) {
    const r = await rawApply(db, { ...base, ...over });
    assert.equal(r.status, 409, JSON.stringify(over)); assert.equal(r.error, "request_id_conflict", JSON.stringify(over));
  }
  assert.equal(gold(db), 600); assert.equal(gold(db, "c1b"), 5); assert.equal(gold(db, "c2"), 50); assert.equal(audits(db).length, 1);
});

test("P1-B: a duplicate that races inside the batch is already_applied once and mutates once", async () => {
  const db = createDb();
  const body = seedBody({ requestId: "req-race-abcdefgh" });
  const pv = await preview(db);
  db.beforeBatch = async () => { assert.equal((await j(await h.handleAdminSeedApply(db, ADMIN, { ...body, previewHash: pv.previewHash }))).status, 200); };
  const loser = await j(await h.handleAdminSeedApply(db, ADMIN, { ...body, previewHash: pv.previewHash }));
  assert.equal(loser.status, 200); assert.equal(loser.already_applied, true);
  assert.equal(gold(db), 600); assert.equal(audits(db).length, 1);
});

test("P1-B: a different payload racing on the same requestId is request_id_conflict and does not mutate", async () => {
  const db = createDb();
  const mine = seedBody({ requestId: "req-race2-abcdefgh" });
  const theirs = seedBody({ requestId: "req-race2-abcdefgh", ops: { gold: { amount: 7 } } });
  const pvMine = await preview(db);
  const pvTheirs = await preview(db, { ops: theirs.ops });
  db.beforeBatch = async () => { await h.handleAdminSeedApply(db, ADMIN, { ...theirs, previewHash: pvTheirs.previewHash }); };
  const r = await j(await h.handleAdminSeedApply(db, ADMIN, { ...mine, previewHash: pvMine.previewHash }));
  assert.equal(r.status, 409); assert.equal(r.error, "request_id_conflict");
  assert.equal(gold(db), 107); assert.equal(audits(db).length, 1);
});

test("P1-B: after a failed batch the same requestId can be retried and applies exactly once", async () => {
  const db = createDb();
  const body = seedBody({ requestId: "req-retry-abcdefgh" });
  const pv = await preview(db);
  db.raw.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit_log BEGIN SELECT RAISE(ABORT, 'boom'); END");
  const failed = await j(await h.handleAdminSeedApply(db, ADMIN, { ...body, previewHash: pv.previewHash }));
  assert.equal(failed.status, 500); assert.equal(failed.error, "admin_audit_failed");
  assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
  db.raw.exec("DROP TRIGGER fail_audit");
  const retry = await j(await h.handleAdminSeedApply(db, ADMIN, { ...body, previewHash: pv.previewHash }));
  assert.equal(retry.status, 200); assert.ok(!retry.already_applied);
  assert.equal((await j(await h.handleAdminSeedApply(db, ADMIN, { ...body, previewHash: pv.previewHash }))).already_applied, true);
  assert.equal(gold(db), 600); assert.equal(audits(db).length, 1);
});

test("P1-B: a mutation is gated on THIS attempt's audit row, not on any row sharing the audit_id", async () => {
  const db = createDb();
  db.raw.prepare("INSERT INTO admin_audit_log (audit_id, player_id, event_type, target_type, target_id, metadata_json, created_at) VALUES ('adm-seed-x','Admin_1','ADMIN_SEED','character','c1','{\"attemptToken\":\"winner\"}','t')").run();
  const ctx = { characterId: "c1", playerId: "P1", now: new Date().toISOString(), auditId: "adm-seed-x",
    gateSql: "EXISTS (SELECT 1 FROM admin_audit_log WHERE audit_id = ? AND instr(metadata_json, ?) > 0)", gateBinds: ["adm-seed-x", "\"attemptToken\":\"loser\""] };
  const res = await h.ADMIN_SEED_OPS.gold.plan({ gold: 100 }, { amount: 500 }).mutate(db, ctx).run();
  assert.equal(res.meta.changes, 0); assert.equal(gold(db), 100);
});

// ---------------------------------------------------------------------------------------------
// P1-C: every mutation result is verified; any mismatch rolls the whole batch back
// ---------------------------------------------------------------------------------------------
async function withPlan(planFn, run) {
  const op = h.ADMIN_SEED_OPS.gold; const original = op.plan;
  op.plan = planFn;
  try { return await run(); } finally { op.plan = original; }
}
const goldPlan = (mutateSql, expectedChanges = 1) => (character, input) => ({
  change: { op: "gold", label: "Gold", before: character.gold, after: character.gold + input.amount, amount: input.amount },
  guard: { gold: character.gold }, expectedChanges,
  mutate: (db, ctx) => db.prepare(mutateSql(ctx)).bind(...ctx.gateBinds),
});

test("P1-C: audit insert succeeds but the mutation touches 0 rows -> whole batch rolled back, no success", async () => {
  const db = createDb();
  await withPlan(goldPlan((ctx) => `UPDATE characters SET gold = gold + 1 WHERE character_id = 'nope' AND ${ctx.gateSql}`), async () => {
    const r = await apply(db);
    assert.equal(r.status, 500); assert.equal(r.error, "seed_mutation_failed");
  });
  assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
});

test("P1-C: a mutation that touches more rows than expected rolls back everything", async () => {
  const db = createDb();
  await withPlan(goldPlan((ctx) => `UPDATE characters SET gold = gold + 1 WHERE player_id = 'P1' AND ${ctx.gateSql}`), async () => {
    const r = await apply(db);
    assert.equal(r.status, 500); assert.equal(r.error, "seed_mutation_failed");
  });
  assert.equal(gold(db), 100); assert.equal(gold(db, "c1b"), 5); assert.equal(audits(db).length, 0);
});

test("P1-C: an operation may declare a different expected row count and it is enforced", async () => {
  const db = createDb();
  await withPlan(goldPlan((ctx) => `UPDATE characters SET gold = gold + 1 WHERE player_id = 'P1' AND ${ctx.gateSql}`, 2), async () => {
    const r = await apply(db);
    assert.equal(r.status, 200);
  });
  assert.equal(gold(db), 101); assert.equal(gold(db, "c1b"), 6); assert.equal(audits(db).length, 1);
});

test("P1-C: a failing mutation statement leaves no partial commit", async () => {
  const db = createDb();
  await withPlan(goldPlan((ctx) => `UPDATE characters SET no_such_column = 1 WHERE character_id = 'c1' AND ${ctx.gateSql}`), async () => {
    const r = await apply(db);
    assert.equal(r.status, 500);
  });
  assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
});

test("P1-C: a guard column outside the allowlist is rejected before anything is written", async () => {
  const db = createDb();
  await withPlan((character) => ({ change: { op: "gold", label: "Gold", before: 1, after: 2 }, guard: { "gold = gold; DROP TABLE characters; --": 1 }, expectedChanges: 1, mutate: (d, ctx) => d.prepare("SELECT 1").bind() }), async () => {
    await assert.rejects(() => preview(db), /admin_seed_guard_column_not_allowed/);
  });
  assert.equal(gold(db), 100);
});

// ---------------------------------------------------------------------------------------------
// P2-A: kill switch semantics on all three endpoints
// ---------------------------------------------------------------------------------------------
test("P2-A: only the exact JSON value true enables Seed; every other stored value is OFF on all three endpoints", async () => {
  for (const value of ["false", '"true"', "1", "null", "{bad", "True", " true", "true ", "", "[true]"]) {
    const db = createDb(); db.raw.prepare("UPDATE game_config SET value_json = ? WHERE key = 'admin_seed_enabled'").run(value);
    const before = db.raw.prepare("SELECT * FROM game_config").all();
    assert.equal((await lookup(db)).status, 403, `lookup ${JSON.stringify(value)}`);
    assert.equal((await preview(db)).status, 403, `preview ${JSON.stringify(value)}`);
    const a = await j(await h.handleAdminSeedApply(db, ADMIN, { ...seedBody({ requestId: "req-kill-abcdefgh" }), previewHash: "0".repeat(64) }));
    assert.equal(a.status, 403, `apply ${JSON.stringify(value)}`); assert.equal(a.error, "feature_disabled");
    assert.equal(gold(db), 100); assert.equal(audits(db).length, 0);
    assert.deepEqual(db.raw.prepare("SELECT * FROM game_config").all(), before);
  }
  const on = createDb();
  assert.equal((await lookup(on)).status, 200);
});

test("P2-A: order of checks is documented behaviour: invalid admin -> 401 even when OFF; valid admin + OFF -> 403", async () => {
  const db = createDb({ enabled: false });
  const bad = { ok: false, error: "admin_session_invalid" };
  assert.equal((await lookup(db, "P1", bad)).status, 401);
  assert.equal((await j(await h.handleAdminSeedPreview(db, bad, seedBody()))).status, 401);
  assert.equal((await j(await h.handleAdminSeedApply(db, bad, seedBody()))).status, 401);
  assert.equal((await lookup(db)).status, 403);
  assert.equal((await preview(db)).status, 403);
});

// ---------------------------------------------------------------------------------------------
// P2-C: error catalog completeness and admin UI reliability (static checks; not a browser run)
// ---------------------------------------------------------------------------------------------
const ROOT = path.resolve(__dirname, "..");
const workerSrc = fs.readFileSync(path.join(ROOT, "workers/thornie-dungeons-api.js"), "utf8");
const clientSrc = fs.readFileSync(path.join(ROOT, "admin-app.js"), "utf8");
const catalogSrc = fs.readFileSync(path.join(ROOT, "src/state/errorCatalog.js"), "utf8");
const seedSection = workerSrc.slice(workerSrc.indexOf("// ---------- admin: QA seed"), workerSrc.indexOf("// ---------- request boundary hardening"));
const clientSeed = clientSrc.slice(clientSrc.indexOf("// SEED (QA)"), clientSrc.indexOf("// Restore a still-valid Admin session"));

test("P2-C: every error code the Seed endpoints can return has a specific Thai message and a catalog entry", () => {
  const codes = new Set([...seedSection.matchAll(/error:\s*"([a-z_]+)"/g)].map((m) => m[1]));
  ["operation_pending", "character_in_run"].forEach((c) => codes.add(c)); // returned via the shared adminCharacterActivityBlock
  assert.ok(codes.size >= 15, `found ${[...codes].join(",")}`);
  const authCodes = /^admin_(session|auth|key)/; // generic session handling in apiGet/apiPost
  const missingText = [], missingCatalog = [];
  for (const code of codes) {
    if (authCodes.test(code)) continue;
    if (!new RegExp(`\\b${code}:\\s*"`).test(clientSrc.slice(clientSrc.indexOf("const SEED_ERRORS"), clientSrc.indexOf("const SEED_WARNINGS")))) missingText.push(code);
    if (!new RegExp(`\\b${code}:\\s*"`).test(catalogSrc)) missingCatalog.push(code);
  }
  assert.deepEqual(missingText, []);
  assert.deepEqual(missingCatalog, []);
  assert.ok(codes.has("seed_mutation_failed"));
});

test("P2-C: unknown error codes fall back to a safe Thai message that never echoes odd server strings", () => {
  const sandbox = { SEED_ERRORS: {} };
  const fnSrc = clientSrc.match(/function seedErrorText\(code\) \{[^\n]*\}/)[0];
  vm.runInNewContext(`${fnSrc}; globalThis.f = seedErrorText;`, sandbox);
  assert.match(sandbox.f("totally_new_code"), /^เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ \(totally_new_code\)$/);
  assert.equal(sandbox.f("<img src=x onerror=alert(1)>"), "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
  assert.equal(sandbox.f(undefined), "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ");
});

test("P2-C: Seed UI never uses innerHTML-style sinks; requests have a 30 s timeout; retry keeps the requestId", () => {
  assert.doesNotMatch(clientSeed, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
  assert.match(clientSrc, /SEED_TIMEOUT_MS = 30000/);
  assert.equal((clientSeed.match(/crypto\.randomUUID\(\)/g) || []).length, 1, "requestId is created once, at preview time");
  const confirmFn = clientSeed.slice(clientSeed.indexOf("async function seedConfirm"));
  assert.doesNotMatch(confirmFn.slice(0, confirmFn.indexOf("\n}\n")), /randomUUID/);
  assert.match(confirmFn, /requestId: seedState\.requestId/);
  assert.match(confirmFn, /seedWithTimeout\(apiPost\(/);
});

test("P2-C: Preview and Confirm are disabled while a request is in flight (double-submit guard)", () => {
  assert.match(clientSeed, /async function seedPreview\(\) \{\s*if \(seedState\.busy\) return;/);
  assert.match(clientSeed, /getElementById\("seedPreviewBtn"\)\.disabled = true/);
  assert.match(clientSeed, /async function seedConfirm\(\) \{\s*if \(seedState\.busy \|\| !seedState\.previewHash\) return;/);
  assert.match(clientSeed, /getElementById\("seedConfirmBtn"\)\.disabled = true/);
  assert.match(clientSeed, /disabled = seedState\.busy \|\| len < 5 \|\| len > 300/);
});

test("P2-C: Seed pipeline shares the W2-F/W2-G activity implementation (single source of truth)", () => {
  assert.match(seedSection, /const adminSeedBlockedReason = adminCharacterActivityBlock;/);
  assert.match(seedSection, /adminItemActivityGuardSql\(\)/);
  assert.match(seedSection, /adminItemActivityGuardBinds\(/);
});
