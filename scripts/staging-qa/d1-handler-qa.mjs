// W2-F/W2-G + W2-H H1 Actual D1 Full Handler QA (33 scenarios). STAGING ONLY.
// Drives the deployed Worker over HTTP and inspects/seeds the staging D1 with `wrangler d1 execute`.
// Never prints or stores passwords / session tokens. Evidence -> $QA_OUT_DIR/{evidence.json,summary.md}.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const PROD_DB_ID = "2f6d52b4-3de7-4e78-98d4-fc143a4d29e2";
const STAGING_DB_NAME = "thornie-dungeons-staging";
const STAGING_DB_ID = "c16e0b11-cf83-468c-a533-0ecbf522082f";
const env = process.env;
const BASE = String(env.QA_BASE_URL || "").replace(/\/+$/, "");
const MODE = env.QA_SQL_MODE === "local" ? "local" : "remote";
const CONFIG = env.QA_WRANGLER_CONFIG || ".wrangler.staging.runtime.jsonc";
const OUT = env.QA_OUT_DIR || "qa-artifacts";
const SHA = env.QA_COMMIT_SHA || "unknown";
const WORKER_VERSION = env.QA_WORKER_VERSION || "unknown";
const RACE_N = Number(env.QA_RACE_ITERATIONS || 20);
const EXPECTED_SCENARIOS = 35;

// ---- safety gates -------------------------------------------------------
function abort(msg) { console.error("BLOCKED: " + msg); console.log("::error::BLOCKED: " + String(msg).slice(0, 400)); process.exit(2); }
if (!BASE) abort("QA_BASE_URL missing");
if ([BASE, CONFIG, env.QA_DB_ID || "", env.QA_DB_NAME || ""].join(" ").includes(PROD_DB_ID)) abort("production database id detected");
if (env.QA_DB_ID && env.QA_DB_ID !== STAGING_DB_ID) abort("QA_DB_ID is not the staging database id");
if (env.QA_DB_NAME && env.QA_DB_NAME !== STAGING_DB_NAME) abort("QA_DB_NAME is not the staging database");
const host = new URL(BASE).hostname;
const isLocalHost = ["127.0.0.1", "localhost"].includes(host);
if (MODE === "local" ? !isLocalHost : !/staging/.test(host)) abort("base URL host must be the staging worker (or localhost in local mode)");
if (/^thornie-dungeons-api\./.test(host)) abort("production worker host refused");

// ---- helpers --------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sqlRun(sql) {
  const args = ["wrangler", "d1", "execute", STAGING_DB_NAME, MODE === "local" ? "--local" : "--remote", "--config", CONFIG, "--json", "--command", sql];
  if (MODE === "local" && env.QA_PERSIST_DIR) args.push("--persist-to", env.QA_PERSIST_DIR);
  const out = execFileSync("npx", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const start = out.indexOf("["); const parsed = JSON.parse(out.slice(start));
  return parsed.flatMap((p) => p.results || []);
}
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const SECRET_KEYS = /token|password|recovery|secret|authorization/i;
function redact(v) {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET_KEYS.test(k) ? "[redacted]" : redact(x)]));
  return v;
}
async function call(method, body, token, params) {
  const url = new URL(BASE + "/");
  if (params) for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  // Transport errors (no HTTP response) are retried: admin delete/restore are idempotent by requestId/auditId; auth actions are not retried.
  const retriable = !["register", "adminLogin", "login", "createCharacter"].includes(body?.action);
  let res;
  for (let attempt = 0; ; attempt++) {
    try { res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); break; }
    catch (e) { if (!retriable || attempt >= 3) throw e; await sleep(500 * (attempt + 1)); }
  }
  let json = null; try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, body: json };
}

const NOW = "2026-10-01T00:00:00Z";
const state = { admin: null, token: null, pid: null, cid: null };
const results = [];
const REASON = "QA staging verification of W2-F/W2-G";

async function bootstrap() {
  const prior = sqlRun(`SELECT value_json FROM game_config WHERE key='admin_item_delete_enabled'`);
  state.priorFlag = prior.length ? prior[0].value_json : null;
  const priorSeed = sqlRun(`SELECT value_json FROM game_config WHERE key='admin_seed_enabled'`);
  state.priorSeedFlag = priorSeed.length ? priorSeed[0].value_json : null;
  const suffix = randomBytes(3).toString("hex");
  const adminId = `QAADMIN${suffix}`, playerId = `QAP1${suffix}`;
  const pw = randomBytes(9).toString("hex"); // alnum, never logged
  for (const id of [adminId, playerId]) {
    const r = await call("POST", { action: "register", id, password: pw, confirmPassword: pw });
    if (r.status !== 200 || !r.body?.ok) abort(`register failed (${r.status} ${r.body?.error || ""}); register rate limit is 3/hour/IP`);
    if (id === playerId) state.playerSession = r.body.sessionToken;
  }
  const c = await call("POST", { action: "createCharacter", id: playerId, slotIndex: 0, name: `QA${suffix}` }, state.playerSession);
  if (!c.body?.ok) abort("createCharacter failed: " + (c.body?.error || c.status));
  state.cid = c.body.character.character_id; state.pid = playerId; state.admin = adminId;
  sqlRun(`INSERT INTO admin_users (player_id, role, enabled, created_at, updated_at) VALUES (${q(adminId)}, 'admin', 1, datetime('now'), datetime('now'))`);
  const l = await call("POST", { action: "adminLogin", id: adminId, password: pw });
  if (!l.body?.adminSessionToken) abort("adminLogin failed: " + (l.body?.error || l.status));
  state.token = l.body.adminSessionToken;
}

function flag(v) { sqlRun(`INSERT OR REPLACE INTO game_config (key, value_json, updated_at) VALUES ('admin_item_delete_enabled', ${q(v)}, datetime('now'))`); }
function reset() {
  const { cid, pid } = state;
  sqlRun(`DROP TRIGGER IF EXISTS qa_fail_delete`); sqlRun(`DROP TRIGGER IF EXISTS qa_fail_restore`);
  sqlRun(`DELETE FROM items WHERE player_id=${q(pid)}`);
  sqlRun(`DELETE FROM item_provenance WHERE original_player_id=${q(pid)}`);
  sqlRun(`DELETE FROM item_ownership_events WHERE event_type IN ('admin_deleted','admin_restored') AND (from_player_id=${q(pid)} OR to_player_id=${q(pid)})`);
  sqlRun(`DELETE FROM admin_audit_log WHERE event_type LIKE 'ADMIN_ITEM_%' AND player_id=${q(state.admin)}`);
  sqlRun(`DROP TRIGGER IF EXISTS qa_seed_ignore_gold`); sqlRun(`DROP TRIGGER IF EXISTS qa_seed_fail_audit`);
  sqlRun(`DELETE FROM admin_audit_log WHERE event_type='ADMIN_SEED' AND player_id=${q(state.admin)}`);
  sqlRun(`DELETE FROM game_config WHERE key='admin_seed_enabled'`);
  sqlRun(`UPDATE characters SET gold=100, updated_at=datetime('now') WHERE character_id=${q(cid)}`);
  sqlRun(`DELETE FROM character_operation_receipts WHERE character_id=${q(cid)}`);
  sqlRun(`DELETE FROM character_run_state WHERE character_id=${q(cid)}`);
  flag("true");
}
function seedGear(id = "qa-gear-1", extra = {}) {
  const { pid, cid } = state;
  sqlRun(`INSERT INTO items (item_id,player_id,character_id,slot_type,name,rarity,enhance_level,atk,extra_json,created_at,updated_at) VALUES (${q(id)},${q(pid)},${q(cid)},'weapon','QA Sword','mythic',7,120,${q(JSON.stringify({ empowerSlots: [null, "fire"], overflow: false, ...extra }))},${q(NOW)},${q(NOW)})`);
  sqlRun(`INSERT OR IGNORE INTO item_provenance (item_id,original_player_id,original_character_id,origin_type,created_at,acquired_at) VALUES (${q(id)},${q(pid)},${q(cid)},'drop','t','t')`);
}
function seedJunk(id = "qa-junk-1", qty = 7) {
  const { pid, cid } = state;
  sqlRun(`INSERT INTO items (item_id,player_id,character_id,slot_type,name,rarity,extra_json,created_at,updated_at) VALUES (${q(id)},${q(pid)},${q(cid)},'junk','QA Scrap','common',${q(JSON.stringify({ junkId: "scrap", quantity: qty, overflow: false }))},${q(NOW)},${q(NOW)})`);
}
function seedEquipped() {
  const { pid, cid } = state;
  sqlRun(`INSERT INTO items (item_id,player_id,character_id,slot_type,name,rarity,equipped,extra_json,created_at,updated_at) VALUES ('qa-gear-eq',${q(pid)},${q(cid)},'armor','QA Worn','rare',1,'{}',${q(NOW)},${q(NOW)})`);
}
const preview = (itemId, quantity) => call("GET", null, state.token, { action: "adminPreviewItemDelete", playerId: state.pid, characterId: state.cid, itemId, ...(quantity ? { quantity: String(quantity) } : {}) });
let reqSeq = 0;
const newReq = () => `qa-req-${Date.now().toString(36)}${(reqSeq++).toString(36).padStart(3, "0")}`;
async function del(itemId, { quantity, requestId = newReq(), snapshotHash, reason = REASON, confirmText = itemId } = {}) {
  let hash = snapshotHash;
  if (hash === undefined) { const p = await preview(itemId, quantity); hash = p.body?.snapshotHash; if (!hash) return { ...p, requestId }; }
  const r = await call("POST", { action: "adminDeleteItem", playerId: state.pid, characterId: state.cid, itemId, ...(quantity ? { quantity } : {}), reason, confirmText, snapshotHash: hash, requestId }, state.token);
  return { ...r, requestId };
}
const restore = (requestId, originalId, reason = REASON) => call("POST", { action: "adminRestoreItem", auditId: `adm-del-${requestId}`, reason, confirmText: originalId }, state.token);
const items = () => sqlRun(`SELECT item_id, equipped, enhance_level, atk, extra_json, updated_at FROM items WHERE player_id=${q(state.pid)} ORDER BY item_id`);
const audits = () => sqlRun(`SELECT audit_id, event_type, target_id, created_at FROM admin_audit_log WHERE event_type LIKE 'ADMIN_ITEM_%' AND player_id=${q(state.admin)} ORDER BY created_at, audit_id`);
const events = () => sqlRun(`SELECT event_id, item_id, event_type FROM item_ownership_events WHERE event_type IN ('admin_deleted','admin_restored') AND (from_player_id=${q(state.pid)} OR to_player_id=${q(state.pid)}) ORDER BY occurred_at, event_id`);
const snap = () => ({ items: items(), audits: audits(), events: events() });
const count = (rows, pred) => rows.filter(pred).length;


// ---- W2-H H1 helpers ---------------------------------------------------------
const seedFlag = (v) => (v === null ? sqlRun(`DELETE FROM game_config WHERE key='admin_seed_enabled'`) : sqlRun(`INSERT OR REPLACE INTO game_config (key, value_json, updated_at) VALUES ('admin_seed_enabled', ${q(v)}, datetime('now'))`));
const sLookup = (username = state.pid, token = state.token) => call("GET", null, token, { action: "adminSeedLookup", username });
const sPreview = (ops, over = {}, token = state.token) => call("POST", { action: "adminSeedPreview", playerId: state.pid, characterId: state.cid, ops, ...over }, token);
let sSeq = 0;
const newSeedReq = () => `qa-seed-${Date.now().toString(36)}${(sSeq++).toString(36).padStart(3, "0")}x`;
async function sApply(ops, { requestId = newSeedReq(), previewHash, reason = "QA staging verification of W2-H H1", token = state.token, ...over } = {}) {
  let hash = previewHash;
  if (hash === undefined) { const p = await sPreview(ops, over); hash = p.body?.previewHash; if (!hash) return { ...p, requestId }; }
  const r = await call("POST", { action: "adminSeedApply", playerId: state.pid, characterId: state.cid, ops, previewHash: hash, reason, requestId, ...over }, token);
  return { ...r, requestId, previewHash: hash };
}
const goldNow = () => Number(sqlRun(`SELECT gold FROM characters WHERE character_id=${q(state.cid)}`)[0].gold);
const seedAudits = () => sqlRun(`SELECT audit_id, target_id, metadata_json FROM admin_audit_log WHERE event_type='ADMIN_SEED' AND player_id=${q(state.admin)}`);
const setGoldSql = (n, bump = true) => sqlRun(`UPDATE characters SET gold=${n}${bump ? ", updated_at=datetime('now')" : ""} WHERE character_id=${q(state.cid)}`);
const G = (amount) => ({ gold: { amount } });

async function scenario(n, name, fn) {
  if (env.QA_ONLY && !env.QA_ONLY.split(",").includes(String(n))) return;
  const t0 = Date.now(); let rec = { n, name, status: "FAIL", http: [], checks: [] };
  try {
    reset();
    const ctx = { http: [], checks: [], before: null };
    ctx.rec = (label, r) => { ctx.http.push({ label, status: r.status, body: redact(r.body) }); return r; };
    ctx.expect = (label, cond, detail) => { ctx.checks.push({ label, ok: !!cond, detail: cond ? undefined : detail }); };
    ctx.before = snap();
    await fn(ctx);
    ctx.after = snap();
    const ok = ctx.checks.length > 0 && ctx.checks.every((c) => c.ok);
    rec = { n, name, status: ok ? "PASS" : "FAIL", http: ctx.http, checks: ctx.checks, before: ctx.before, after: ctx.after, ms: Date.now() - t0 };
  } catch (e) { rec.error = String(e && e.message || e).slice(0, 500); }
  results.push(rec); console.log(`#${n} ${rec.status} ${name}`);
}

async function main() {
  await bootstrap();
  const S = state;

  await scenario(1, "Delete normal gear", async (c) => {
    seedGear(); const r = c.rec("delete", await del("qa-gear-1")); const s = snap();
    c.expect("200 ok", r.status === 200 && r.body?.ok && !r.body?.already_applied, r.body);
    c.expect("item gone", !s.items.some((i) => i.item_id === "qa-gear-1"));
    c.expect("1 delete audit", count(s.audits, (a) => a.event_type === "ADMIN_ITEM_DELETE") === 1);
    c.expect("1 admin_deleted event", count(s.events, (e) => e.event_type === "admin_deleted") === 1);
  });
  await scenario(2, "Restore gear", async (c) => {
    seedGear(); const before = items().find((i) => i.item_id === "qa-gear-1"); const d = await del("qa-gear-1"); c.rec("delete", d);
    const r = c.rec("restore", await restore(d.requestId, "qa-gear-1")); const s = snap(); const back = s.items.find((i) => i.item_id === "qa-gear-1");
    c.expect("200 ok", r.status === 200 && r.body?.ok, r.body);
    c.expect("row back identical", back && back.enhance_level === before.enhance_level && back.atk === before.atk && JSON.parse(back.extra_json).empowerSlots?.[1] === "fire", back);
    c.expect("restore audit + event", count(s.audits, (a) => a.event_type === "ADMIN_ITEM_RESTORE") === 1 && count(s.events, (e) => e.event_type === "admin_restored") === 1);
  });
  await scenario(3, "Duplicate restore / idempotency", async (c) => {
    seedGear(); const d = await del("qa-gear-1"); await restore(d.requestId, "qa-gear-1");
    const r = c.rec("restore again", await restore(d.requestId, "qa-gear-1")); const s = snap();
    c.expect("200 already_applied", r.status === 200 && r.body?.already_applied === true, r.body);
    c.expect("no duplicate rows/audit/event", count(s.items, (i) => i.item_id.startsWith("qa-gear") || i.item_id.startsWith("adm-res-")) === 1 && count(s.audits, (a) => a.event_type === "ADMIN_ITEM_RESTORE") === 1 && count(s.events, (e) => e.event_type === "admin_restored") === 1);
  });
  await scenario(4, "Partial stack delete and restore", async (c) => {
    seedJunk(); const d = c.rec("delete 3", await del("qa-junk-1", { quantity: 3 }));
    c.expect("qty 4 after delete", JSON.parse(items().find((i) => i.item_id === "qa-junk-1")?.extra_json || "{}").quantity === 4);
    const r = c.rec("restore", await restore(d.requestId, "qa-junk-1"));
    c.expect("qty 7 after restore", r.status === 200 && JSON.parse(items().find((i) => i.item_id === "qa-junk-1")?.extra_json || "{}").quantity === 7, r.body);
    const r2 = c.rec("restore replay", await restore(d.requestId, "qa-junk-1"));
    c.expect("replay does not add", r2.body?.already_applied === true && JSON.parse(items().find((i) => i.item_id === "qa-junk-1")?.extra_json || "{}").quantity === 7);
  });
  await scenario(5, "Equipped item rejection", async (c) => {
    seedEquipped(); const r = c.rec("delete", await del("qa-gear-eq", { snapshotHash: "0".repeat(64) })); const s = snap();
    c.expect("409 item_equipped", r.status === 409 && r.body?.error === "item_equipped", r.body);
    c.expect("nothing written", s.audits.length === 0 && s.items.some((i) => i.item_id === "qa-gear-eq"));
  });
  await scenario(6, "Pending operation blocks delete/restore", async (c) => {
    seedGear(); const d0 = await del("qa-gear-1"); seedGear("qa-gear-2"); const h = (await preview("qa-gear-2")).body.snapshotHash;
    sqlRun(`INSERT INTO character_operation_receipts VALUES (${q(S.cid)},'sell','qa1','qa-tok','{}','pending',datetime('now'))`);
    const rd = c.rec("delete", await del("qa-gear-2", { snapshotHash: h })); const rr = c.rec("restore", await restore(d0.requestId, "qa-gear-1")); const s = snap();
    c.expect("delete 409 operation_pending", rd.status === 409 && rd.body?.error === "operation_pending", rd.body);
    c.expect("restore 409 operation_pending", rr.status === 409 && rr.body?.error === "operation_pending", rr.body);
    c.expect("nothing written", s.items.some((i) => i.item_id === "qa-gear-2") && !s.items.some((i) => i.item_id === "qa-gear-1") && count(s.audits, (a) => a.event_type === "ADMIN_ITEM_RESTORE") === 0);
  });
  const runCase = async (c, ts, expectBlocked) => {
    seedGear(); const d0 = await del("qa-gear-1"); seedGear("qa-gear-2"); const h = (await preview("qa-gear-2")).body.snapshotHash;
    sqlRun(`INSERT INTO character_run_state (character_id, updated_at) VALUES (${q(S.cid)}, ${ts === "NOW" ? "strftime('%Y-%m-%dT%H:%M:%fZ','now')" : q(ts)})`);
    const rd = c.rec("delete", await del("qa-gear-2", { snapshotHash: h })); const rr = c.rec("restore", await restore(d0.requestId, "qa-gear-1"));
    if (expectBlocked) {
      c.expect("delete 409 character_in_run", rd.status === 409 && rd.body?.error === "character_in_run", rd.body);
      c.expect("restore 409 character_in_run", rr.status === 409 && rr.body?.error === "character_in_run", rr.body);
      const s = snap(); c.expect("nothing written", s.items.some((i) => i.item_id === "qa-gear-2") && !s.items.some((i) => i.item_id === "qa-gear-1"));
    } else {
      c.expect("delete 200", rd.status === 200 && rd.body?.ok, rd.body); c.expect("restore 200", rr.status === 200 && rr.body?.ok, rr.body);
    }
  };
  await scenario(7, "Active run blocks delete/restore", (c) => runCase(c, "NOW", true));
  await scenario(8, "Stale run permits operation", (c) => runCase(c, "2026-09-29T14:55:14.765Z", false));
  await scenario(9, "Invalid run timestamp blocks operation", (c) => runCase(c, "not-a-date", true));
  await scenario(10, "Stale snapshot hash rejection", async (c) => {
    seedGear(); const h = (await preview("qa-gear-1")).body.snapshotHash;
    sqlRun(`UPDATE items SET updated_at='2026-10-02T00:00:00Z' WHERE item_id='qa-gear-1'`);
    const r = c.rec("delete", await del("qa-gear-1", { snapshotHash: h })); const s = snap();
    c.expect("409 item_state_changed", r.status === 409 && r.body?.error === "item_state_changed", r.body);
    c.expect("nothing written", s.audits.length === 0 && s.items.length === 1);
  });
  await scenario(11, "Inventory capacity and overflow", async (c) => {
    seedGear(); const d = await del("qa-gear-1");
    for (let i = 0; i < 30; i++) sqlRun(`INSERT INTO items (item_id,player_id,character_id,slot_type,created_at,updated_at,extra_json) VALUES ('qa-pad-${i}',${q(S.pid)},${q(S.cid)},'weapon',${q(NOW)},${q(NOW)},'{"overflow":false}')`);
    const r = c.rec("restore", await restore(d.requestId, "qa-gear-1")); const row = items().find((i) => i.item_id === "qa-gear-1");
    c.expect("200 ok", r.status === 200 && r.body?.ok, r.body);
    c.expect("restored into overflow", row && JSON.parse(row.extra_json).overflow === true, row);
    c.expect("carried count stays 30", sqlRun(`SELECT COUNT(*) c FROM items WHERE character_id=${q(S.cid)} AND equipped=0 AND COALESCE(json_extract(extra_json,'$.overflow'),0) NOT IN (1,'1','true')`)[0].c === 30);
  });
  await scenario(12, "Item ID collision", async (c) => {
    seedGear(); const d = await del("qa-gear-1"); seedGear("qa-gear-1", { overflow: false, note: "collider" });
    const collider = items().find((i) => i.item_id === "qa-gear-1");
    const r = c.rec("restore", await restore(d.requestId, "qa-gear-1")); const s = snap();
    c.expect("200 with new adm-res id", r.status === 200 && r.body?.ok, r.body);
    c.expect("new adm-res-<20hex> row", s.items.some((i) => /^adm-res-[0-9a-f]{20}$/.test(i.item_id)), s.items.map((i) => i.item_id));
    c.expect("existing row untouched", JSON.stringify(s.items.find((i) => i.item_id === "qa-gear-1")) === JSON.stringify(collider));
  });
  await scenario(13, "Different stack identity", async (c) => {
    seedJunk(); const d = c.rec("delete 3", await del("qa-junk-1", { quantity: 3 }));
    sqlRun(`UPDATE items SET extra_json='{"junkId":"cloth","quantity":4,"overflow":false}' WHERE item_id='qa-junk-1'`);
    const r = c.rec("restore", await restore(d.requestId, "qa-junk-1")); const s = snap();
    const orig = s.items.find((i) => i.item_id === "qa-junk-1"); const fresh = s.items.find((i) => i.item_id !== "qa-junk-1");
    c.expect("200 ok", r.status === 200 && r.body?.ok, r.body);
    c.expect("existing stack unchanged", orig && JSON.parse(orig.extra_json).junkId === "cloth" && JSON.parse(orig.extra_json).quantity === 4, orig);
    c.expect("new row with original junkId qty 3", fresh && JSON.parse(fresh.extra_json).junkId === "scrap" && JSON.parse(fresh.extra_json).quantity === 3, fresh);
  });
  await scenario(14, "Malformed audit snapshot rejection", async (c) => {
    const mk = (id, qtyRaw, extraRaw) => {
      const item = `{"item_id":"gx","player_id":${JSON.stringify(S.pid)},"character_id":${JSON.stringify(S.cid)},"slot_type":"weapon","equipped":0,"inventory_slot":"","item_template_id":"t","rarity":"rare","name":"N","item_level":1,"enhance_level":0,"bound":0,"quantity":1,"atk":1,"def":0,"hp":0,"mp":0,"extra_json":${extraRaw},"created_at":"2026-10-01T00:00:00Z","updated_at":"2026-10-01T00:00:00Z"}`;
      const meta = `{"outcome":"ok","before":{"playerId":${JSON.stringify(S.pid)},"characterId":${JSON.stringify(S.cid)},"itemId":"gx","quantityRequested":${qtyRaw},"item":${item}},"after":null,"changedKeys":["deleted"],"reason":"x"}`;
      sqlRun(`INSERT INTO admin_audit_log (audit_id,player_id,event_type,target_type,target_id,metadata_json,created_at) VALUES (${q(id)},${q(S.admin)},'ADMIN_ITEM_DELETE','item','gx',${q(meta)},'2026-10-01T00:00:00Z')`);
    };
    const cases = [["adm-del-qa-malformed-q19", "1.9", "{}"], ["adm-del-qa-malformed-qstr", '"1"', "{}"], ["adm-del-qa-malformed-qnull", "null", "{}"], ["adm-del-qa-malformed-xarr", "1", "[]"], ["adm-del-qa-malformed-xnull", "1", "null"], ["adm-del-qa-malformed-xbad", "1", '"{bad"']];
    for (const [id, qr, xr] of cases) mk(id, qr, xr);
    for (const [id] of cases) { const r = c.rec(id, await call("POST", { action: "adminRestoreItem", auditId: id, reason: REASON, confirmText: "gx" }, S.token)); c.expect(`${id} -> 409 audit_not_restorable`, r.status === 409 && r.body?.error === "audit_not_restorable", r.body); }
    c.expect("nothing created", items().length === 0 && count(audits(), (a) => a.event_type === "ADMIN_ITEM_RESTORE") === 0);
  });
  await scenario(15, "Feature flag disabled rejection", async (c) => {
    seedGear(); const p = await preview("qa-gear-1"); const d = await del("qa-gear-1"); flag("false");
    const a = c.rec("preview", await preview("qa-gear-1")); const b = c.rec("delete", await call("POST", { action: "adminDeleteItem", playerId: S.pid, characterId: S.cid, itemId: "qa-gear-1", reason: REASON, confirmText: "qa-gear-1", snapshotHash: p.body.snapshotHash, requestId: newReq() }, S.token));
    const r = c.rec("restore", await restore(d.requestId, "qa-gear-1"));
    for (const [l, x] of [["preview", a], ["delete", b], ["restore", r]]) c.expect(`${l} 403 feature_disabled`, x.status === 403 && x.body?.error === "feature_disabled", x.body);
    flag("true");
  });
  await scenario(16, "Concurrent duplicate delete (real D1)", async (c) => {
    seedJunk(); const h = (await preview("qa-junk-1", 3)).body.snapshotHash; const requestId = newReq();
    const rs = await Promise.all([1, 2, 3, 4].map(() => del("qa-junk-1", { quantity: 3, requestId, snapshotHash: h })));
    rs.forEach((r, i) => c.rec(`parallel ${i}`, r)); const s = snap();
    c.expect("exactly one applied, others already_applied", count(rs, (r) => r.status === 200 && r.body?.ok && !r.body?.already_applied) === 1 && count(rs, (r) => r.status === 200 && r.body?.already_applied) === 3, rs.map((r) => [r.status, r.body]));
    c.expect("exactly one audit row", count(s.audits, (a) => a.event_type === "ADMIN_ITEM_DELETE") === 1);
    c.expect("quantity reduced once (4)", JSON.parse(s.items.find((i) => i.item_id === "qa-junk-1").extra_json).quantity === 4);
  });
  await scenario(17, "Concurrent duplicate restore (real D1)", async (c) => {
    seedJunk(); const d = await del("qa-junk-1", { quantity: 3 });
    const rs = await Promise.all([1, 2, 3, 4].map(() => restore(d.requestId, "qa-junk-1"))); rs.forEach((r, i) => c.rec(`parallel ${i}`, r)); const s = snap();
    c.expect("one applied, rest already_applied", count(rs, (r) => r.status === 200 && r.body?.ok && !r.body?.already_applied) === 1 && count(rs, (r) => r.status === 200 && r.body?.already_applied) === 3, rs.map((r) => [r.status, r.body]));
    c.expect("no duplicate item, quantity added once (7)", s.items.length === 1 && JSON.parse(s.items[0].extra_json).quantity === 7, s.items);
    c.expect("one restore audit/event", count(s.audits, (a) => a.event_type === "ADMIN_ITEM_RESTORE") === 1 && count(s.events, (e) => e.event_type === "admin_restored") === 1);
  });
  await scenario(18, "Pending-operation race during mutation (real D1)", async (c) => {
    const tally = { deleted: 0, blocked: 0, other: 0, inconsistent: 0 };
    for (let i = 0; i < RACE_N; i++) {
      sqlRun(`DELETE FROM items WHERE player_id=${q(S.pid)}`); sqlRun(`DELETE FROM admin_audit_log WHERE event_type='ADMIN_ITEM_DELETE' AND player_id=${q(S.admin)}`); sqlRun(`DELETE FROM item_ownership_events WHERE event_type='admin_deleted' AND (from_player_id=${q(S.pid)} OR to_player_id=${q(S.pid)})`); sqlRun(`DELETE FROM character_operation_receipts WHERE character_id=${q(S.cid)}`);
      seedGear(`qa-race-${i}`); const h = (await preview(`qa-race-${i}`)).body.snapshotHash;
      const [r] = await Promise.all([del(`qa-race-${i}`, { snapshotHash: h }), (async () => { await sleep(Math.floor(Math.random() * 150)); sqlRun(`INSERT INTO character_operation_receipts VALUES (${q(S.cid)},'sell',${q("race" + i)},${q("race-tok-" + i + "-" + Date.now())},'{}','pending',datetime('now'))`); })()]);
      const s = snap(); const present = s.items.some((x) => x.item_id === `qa-race-${i}`); const aud = count(s.audits, (a) => a.event_type === "ADMIN_ITEM_DELETE"); const ev = count(s.events, (e) => e.event_type === "admin_deleted");
      if (r.status === 200 && r.body?.ok) { tally.deleted++; if (present || aud !== 1 || ev !== 1) tally.inconsistent++; }
      else if (r.status === 409 && r.body?.error === "operation_pending") { tally.blocked++; if (!present || aud !== 0 || ev !== 0) tally.inconsistent++; }
      else { tally.other++; c.http.push({ label: `iter ${i}`, status: r.status, body: redact(r.body) }); }
    }
    c.http.push({ label: "tally", status: 0, body: tally });
    c.expect(`no partial/inconsistent mutation over ${RACE_N} iterations`, tally.inconsistent === 0 && tally.other === 0, tally);
    c.expect("both outcomes legitimate (delete won OR pending blocked)", tally.deleted + tally.blocked === RACE_N, tally);
  });
  await scenario(19, "Forced audit failure and atomic rollback (real D1)", async (c) => {
    seedGear(); const p = await preview("qa-gear-1"); const d0 = await del("qa-gear-1"); // 1 delete to restore later
    seedGear("qa-gear-2"); const h = (await preview("qa-gear-2")).body.snapshotHash;
    sqlRun(`CREATE TRIGGER qa_fail_delete BEFORE INSERT ON admin_audit_log WHEN NEW.event_type='ADMIN_ITEM_DELETE' BEGIN SELECT RAISE(ABORT,'qa'); END`);
    const r = c.rec("delete w/ forced failure", await del("qa-gear-2", { snapshotHash: h })); let s = snap();
    c.expect("500 admin_audit_failed", r.status === 500 && r.body?.error === "admin_audit_failed", r.body);
    c.expect("item still present, no delete event for it", s.items.some((i) => i.item_id === "qa-gear-2") && count(s.events, (e) => e.event_type === "admin_deleted") === 1);
    sqlRun(`DROP TRIGGER qa_fail_delete`);
    sqlRun(`CREATE TRIGGER qa_fail_restore BEFORE INSERT ON admin_audit_log WHEN NEW.event_type='ADMIN_ITEM_RESTORE' BEGIN SELECT RAISE(ABORT,'qa'); END`);
    const rr = c.rec("restore w/ forced failure", await restore(d0.requestId, "qa-gear-1")); s = snap();
    c.expect("restore 500 admin_audit_failed", rr.status === 500 && rr.body?.error === "admin_audit_failed", rr.body);
    c.expect("no restored row/event", !s.items.some((i) => i.item_id === "qa-gear-1") && count(s.events, (e) => e.event_type === "admin_restored") === 0);
    sqlRun(`DROP TRIGGER qa_fail_restore`);
  });

  await scenario(20, "W2F-1: requestId bound to the exact delete request", async (c) => {
    seedGear(); seedJunk();
    const R = newReq();
    const a = c.rec("delete gear", await del("qa-gear-1", { requestId: R }));
    c.expect("first delete ok", a.status === 200 && a.body?.ok && !a.body?.already_applied, a.body);
    const b = c.rec("reuse requestId for the junk stack", await del("qa-junk-1", { requestId: R }));
    c.expect("409 request_id_conflict", b.status === 409 && b.body?.error === "request_id_conflict", b.body);
    c.expect("junk untouched", JSON.parse(items().find((i) => i.item_id === "qa-junk-1")?.extra_json || "{}").quantity === 7);
    const again = c.rec("identical replay", await del("qa-gear-1", { requestId: R, snapshotHash: "0".repeat(64) }));
    c.expect("identical replay is already_applied or state-changed-safe", (again.status === 200 && again.body?.already_applied === true) || again.status === 409, again.body);
    const s = snap();
    c.expect("exactly one delete audit and one event", count(s.audits, (x) => x.event_type === "ADMIN_ITEM_DELETE") === 1 && count(s.events, (e) => e.event_type === "admin_deleted") === 1);
  });

  // ============================ W2-H H1 Admin QA Seed (Gold canary) ============================
  await scenario(21, "H1: flag absent blocks lookup/preview/apply (403); invalid token is 401", async (c) => {
    const a = c.rec("lookup", await sLookup()); const b = c.rec("preview", await sPreview(G(500)));
    const d = c.rec("apply", await call("POST", { action: "adminSeedApply", playerId: state.pid, characterId: state.cid, ops: G(500), previewHash: "0".repeat(64), reason: "QA flag off check", requestId: newSeedReq() }, state.token));
    const u = c.rec("lookup bad token", await sLookup(state.pid, "not-a-token"));
    c.expect("lookup/preview/apply 403 feature_disabled", [a, b, d].every((r) => r.status === 403 && r.body?.error === "feature_disabled"), [a.body, b.body, d.body]);
    c.expect("bad token 401", u.status === 401, u.body);
    c.expect("no mutation, no audit", goldNow() === 100 && seedAudits().length === 0);
  });
  await scenario(22, "H1: lookup returns all characters of the username with diamonds", async (c) => {
    seedFlag("true"); const r = c.rec("lookup", await sLookup());
    c.expect("200 + account + character", r.status === 200 && r.body?.account?.playerId === state.pid && Number.isFinite(r.body?.account?.diamonds) && r.body?.characters?.some((x) => x.characterId === state.cid), r.body);
    c.expect("operations = [gold]", JSON.stringify(r.body?.operations) === '["gold"]', r.body?.operations);
    c.expect("no secrets in payload", !/password|token|recovery/i.test(JSON.stringify(r.body)));
    const nf = c.rec("unknown username", await sLookup("QA-NO-SUCH-PLAYER")); c.expect("404 player_not_found", nf.status === 404 && nf.body?.error === "player_not_found", nf.body);
  });
  await scenario(23, "H1: preview is read-only; apply adds Gold with one audit row (readback)", async (c) => {
    seedFlag("true"); const before = goldNow();
    const pv = c.rec("preview", await sPreview(G(500)));
    c.expect("preview 200 with before/after + 64-hex hash", pv.status === 200 && pv.body?.changes?.[0]?.before === 100 && pv.body?.changes?.[0]?.after === 600 && /^[0-9a-f]{64}$/.test(pv.body?.previewHash || ""), pv.body);
    c.expect("preview wrote nothing", goldNow() === before && seedAudits().length === 0);
    const r = c.rec("apply", await sApply(G(500), { previewHash: pv.body.previewHash }));
    c.expect("apply 200 ok", r.status === 200 && r.body?.ok && !r.body?.already_applied, r.body);
    const a = seedAudits(); const meta = a[0] ? JSON.parse(a[0].metadata_json) : {};
    c.expect("gold 100 -> 600", goldNow() === 600);
    c.expect("one ADMIN_SEED audit with reason, before/after, requestHash, target", a.length === 1 && a[0].target_id === state.cid && meta.after?.gold === 600 && meta.before?.gold === 100 && /^[0-9a-f]{64}$/.test(meta.requestHash || "") && !!meta.reason, meta);
  });
  await scenario(24, "H1: requestId replay / payload binding", async (c) => {
    seedFlag("true"); const R = newSeedReq();
    const a = c.rec("apply", await sApply(G(500), { requestId: R }));
    const b = c.rec("identical replay", await sApply(G(500), { requestId: R, previewHash: a.previewHash }));
    const d = c.rec("different amount", await sApply(G(501), { requestId: R, previewHash: a.previewHash }));
    const e = c.rec("different character (unknown)", await call("POST", { action: "adminSeedApply", playerId: state.pid, characterId: "qa-other-character", ops: G(500), previewHash: a.previewHash, reason: "QA binding check", requestId: R }, state.token));
    c.expect("first applied", a.status === 200 && !a.body?.already_applied, a.body);
    c.expect("identical replay already_applied", b.status === 200 && b.body?.already_applied === true, b.body);
    c.expect("different amount -> 409 request_id_conflict", d.status === 409 && d.body?.error === "request_id_conflict", d.body);
    c.expect("different character -> 409 request_id_conflict", e.status === 409 && e.body?.error === "request_id_conflict", e.body);
    c.expect("gold +500 exactly once, one audit", goldNow() === 600 && seedAudits().length === 1);
  });
  await scenario(25, "H1: stale preview (Gold changed without touching updated_at) is refused", async (c) => {
    seedFlag("true"); const pv = c.rec("preview", await sPreview(G(500)));
    setGoldSql(777, false);
    const r = c.rec("apply with stale hash", await sApply(G(500), { previewHash: pv.body.previewHash }));
    c.expect("409 preview_changed", r.status === 409 && r.body?.error === "preview_changed", r.body);
    c.expect("gold untouched by the seed, no audit", goldNow() === 777 && seedAudits().length === 0);
  });
  await scenario(26, "H1: pending operation and recent run block; old run does not", async (c) => {
    seedFlag("true");
    sqlRun(`INSERT INTO character_operation_receipts (character_id, operation, request_id, operation_token, payload_json, result_json, created_at) VALUES (${q(state.cid)}, 'qa-op', 'qa-r', 'qa-tok-${randomBytes(3).toString("hex")}', '{}', 'pending', datetime('now'))`);
    const a = c.rec("pending", await sApply(G(5))); c.expect("operation_pending", a.status === 409 && a.body?.error === "operation_pending", a.body);
    sqlRun(`DELETE FROM character_operation_receipts WHERE character_id=${q(state.cid)}`);
    sqlRun(`INSERT OR REPLACE INTO character_run_state (character_id, updated_at) VALUES (${q(state.cid)}, ${q(new Date().toISOString())})`);
    const b = c.rec("recent run", await sApply(G(5))); c.expect("character_in_run", b.status === 409 && b.body?.error === "character_in_run", b.body);
    sqlRun(`UPDATE character_run_state SET updated_at=${q("not-a-timestamp")} WHERE character_id=${q(state.cid)}`);
    const u = c.rec("unparseable run timestamp", await sApply(G(5))); c.expect("treated as active", u.status === 409 && u.body?.error === "character_in_run", u.body);
    sqlRun(`UPDATE character_run_state SET updated_at=${q(new Date(Date.now() - 31 * 60 * 1000).toISOString())} WHERE character_id=${q(state.cid)}`);
    const d = c.rec("old run (31 min)", await sApply(G(5))); c.expect("applies", d.status === 200 && d.body?.ok, d.body);
    c.expect("blocked attempts wrote nothing; final gold 105; one audit", goldNow() === 105 && seedAudits().length === 1);
  });
  await scenario(27, "H1 P1-C: row-count assertion fires on real D1 and rolls the whole batch back", async (c) => {
    seedFlag("true"); const R = newSeedReq();
    const pv = c.rec("preview", await sPreview(G(500)));
    sqlRun(`CREATE TRIGGER qa_seed_ignore_gold BEFORE UPDATE OF gold ON characters WHEN NEW.character_id=${q(state.cid)} BEGIN SELECT RAISE(IGNORE); END`);
    const r = c.rec("apply while the UPDATE is silently ignored (0 rows)", await sApply(G(500), { requestId: R, previewHash: pv.body.previewHash }));
    c.expect("500 seed_mutation_failed", r.status === 500 && r.body?.error === "seed_mutation_failed", r.body);
    c.expect("audit INSERT rolled back with the batch (no ADMIN_SEED row)", seedAudits().length === 0, seedAudits());
    c.expect("gold unchanged", goldNow() === 100);
    sqlRun(`DROP TRIGGER qa_seed_ignore_gold`);
    const ok = c.rec("same requestId after the fault is removed", await sApply(G(500), { requestId: R, previewHash: pv.body.previewHash }));
    c.expect("positive control: assertion passes when exactly 1 row changes", ok.status === 200 && ok.body?.ok && !ok.body?.already_applied, ok.body);
    c.expect("gold 600, exactly one audit", goldNow() === 600 && seedAudits().length === 1);
  });
  await scenario(28, "H1: forced audit failure rolls back; retry applies exactly once", async (c) => {
    seedFlag("true"); const R = newSeedReq(); const pv = c.rec("preview", await sPreview(G(500)));
    sqlRun(`CREATE TRIGGER qa_seed_fail_audit BEFORE INSERT ON admin_audit_log WHEN NEW.event_type='ADMIN_SEED' BEGIN SELECT RAISE(ABORT,'qa'); END`);
    const r = c.rec("apply with failing audit insert", await sApply(G(500), { requestId: R, previewHash: pv.body.previewHash }));
    c.expect("500 admin_audit_failed", r.status === 500 && r.body?.error === "admin_audit_failed", r.body);
    c.expect("gold unchanged, no audit", goldNow() === 100 && seedAudits().length === 0);
    sqlRun(`DROP TRIGGER qa_seed_fail_audit`);
    const ok = c.rec("retry same requestId", await sApply(G(500), { requestId: R, previewHash: pv.body.previewHash }));
    const again = c.rec("retry again", await sApply(G(500), { requestId: R, previewHash: pv.body.previewHash }));
    c.expect("retry applies once, then already_applied", ok.status === 200 && !ok.body?.already_applied && again.body?.already_applied === true, [ok.body, again.body]);
    c.expect("gold 600, one audit", goldNow() === 600 && seedAudits().length === 1);
  });
  await scenario(29, "H1: concurrent identical requests (same requestId) mutate once", async (c) => {
    seedFlag("true"); const R = newSeedReq(); const pv = c.rec("preview", await sPreview(G(500)));
    const rs = await Promise.all(Array.from({ length: 6 }, () => sApply(G(500), { requestId: R, previewHash: pv.body.previewHash })));
    rs.forEach((r, i) => c.http.push({ label: `concurrent ${i}`, status: r.status, body: redact(r.body) }));
    const applied = rs.filter((r) => r.status === 200 && r.body?.ok && !r.body?.already_applied).length;
    const dup = rs.filter((r) => r.status === 200 && r.body?.already_applied === true).length;
    c.expect("exactly one applied, the rest already_applied", applied === 1 && dup === rs.length - 1, rs.map((r) => [r.status, r.body?.error, r.body?.already_applied]));
    c.expect("gold +500 once, one audit", goldNow() === 600 && seedAudits().length === 1);
  });
  await scenario(30, "H1: concurrent different requestIds on one preview: one wins, the rest refused", async (c) => {
    seedFlag("true"); const pv = c.rec("preview", await sPreview(G(500)));
    const rs = await Promise.all(Array.from({ length: 6 }, () => sApply(G(500), { requestId: newSeedReq(), previewHash: pv.body.previewHash })));
    rs.forEach((r, i) => c.http.push({ label: `concurrent ${i}`, status: r.status, body: redact(r.body) }));
    const applied = rs.filter((r) => r.status === 200 && r.body?.ok && !r.body?.already_applied).length;
    const refused = rs.filter((r) => r.status === 409 && ["preview_changed", "character_state_changed", "operation_pending", "character_in_run"].includes(r.body?.error)).length;
    c.expect("exactly one applied, others 409", applied === 1 && refused === rs.length - 1, rs.map((r) => [r.status, r.body?.error]));
    c.expect("gold +500 once, one audit", goldNow() === 600 && seedAudits().length === 1);
  });
  await scenario(31, "H1: input validation and identity checks", async (c) => {
    seedFlag("true");
    for (const amount of [0, -5, 100001, 1.5, "9", null]) { const r = c.rec(`amount ${JSON.stringify(amount)}`, await sPreview({ gold: { amount } })); c.expect(`invalid amount ${JSON.stringify(amount)} -> 400`, r.status === 400 && r.body?.error === "invalid_seed_amount", r.body); }
    const u = c.rec("unknown op", await sPreview({ diamonds: { amount: 5 } })); c.expect("unknown_seed_op", u.status === 400 && u.body?.error === "unknown_seed_op", u.body);
    const e = c.rec("empty ops", await sPreview({})); c.expect("no_seed_ops", e.status === 400 && e.body?.error === "no_seed_ops", e.body);
    const w = c.rec("wrong player for character", await sPreview(G(5), { playerId: "QA-NOT-THE-OWNER" })); c.expect("404 character_not_found", w.status === 404 && w.body?.error === "character_not_found", w.body);
    const p = await sPreview(G(5));
    const rs = c.rec("reason too short", await sApply(G(5), { previewHash: p.body.previewHash, reason: "abcd" })); c.expect("invalid_reason", rs.status === 400 && rs.body?.error === "invalid_reason", rs.body);
    const rn = c.rec("no previewHash", await call("POST", { action: "adminSeedApply", playerId: state.pid, characterId: state.cid, ops: G(5), reason: "valid reason", requestId: newSeedReq() }, state.token)); c.expect("preview_required", rn.status === 400 && rn.body?.error === "preview_required", rn.body);
    const ri = c.rec("bad requestId", await sApply(G(5), { previewHash: p.body.previewHash, requestId: "short" })); c.expect("invalid_request_id", ri.status === 400 && ri.body?.error === "invalid_request_id", ri.body);
    const na = c.rec("no auth", await sPreview(G(5), {}, null)); c.expect("401 without session", na.status === 401, na.body);
    c.expect("nothing written", goldNow() === 100 && seedAudits().length === 0);
  });
  await scenario(32, "H1: flags are independent (seed vs item delete)", async (c) => {
    flag("false"); seedFlag("true");
    const a = c.rec("seed lookup with delete flag OFF", await sLookup()); const b = c.rec("delete preview with delete flag OFF", await preview("qa-none"));
    c.expect("seed works, delete preview 403", a.status === 200 && b.status === 403, [a.status, b.status]);
    flag("true"); seedFlag(null);
    const d = c.rec("seed lookup with seed flag OFF", await sLookup()); seedGear(); const e = c.rec("delete preview with delete flag ON", await preview("qa-gear-1"));
    c.expect("seed 403, delete preview 200", d.status === 403 && e.status === 200, [d.status, e.status]);
  });
  await scenario(33, "H1: any-player target accepted; audit actor is the Admin, target is the character", async (c) => {
    seedFlag("true"); const r = c.rec("apply", await sApply(G(10)));
    const a = seedAudits();
    c.expect("applied", r.status === 200 && r.body?.ok, r.body);
    c.expect("audit actor is the admin session player (player_id column), target is the character", a.length === 1 && a[0].target_id === state.cid);
    const who = sqlRun(`SELECT player_id FROM admin_audit_log WHERE event_type='ADMIN_SEED' AND player_id=${q(state.admin)}`);
    c.expect("actor recorded", who.length === 1);
  });

  await scenario(34, "W2F-1 legacy audit replay (no requestHash) on real D1: fail-closed, no re-delete, no new audit", async (c) => {
    seedJunk("qa-junk-1", 7); // stack of 7
    const S34 = state;
    const legacy = (rid, before) => sqlRun(`INSERT INTO admin_audit_log (audit_id, player_id, event_type, target_type, target_id, metadata_json, created_at) VALUES (${q("adm-del-" + rid)}, ${q(S34.admin)}, 'ADMIN_ITEM_DELETE', 'item', 'qa-junk-1', ${q(JSON.stringify({ outcome: "ok", before, changedKeys: ["quantity"] }))}, datetime('now'))`);
    const B = (over = {}) => ({ playerId: S34.pid, characterId: S34.cid, itemId: "qa-junk-1", quantityRequested: 2, item: { item_id: "qa-junk-1", slot_type: "junk", extra_json: { junkId: "scrap", quantity: 7 } }, ...over });
    const raw = async (rid, over = {}) => ({ ...(await call("POST", { action: "adminDeleteItem", playerId: S34.pid, characterId: S34.cid, itemId: "qa-junk-1", reason: REASON, confirmText: "qa-junk-1", snapshotHash: "0".repeat(64), requestId: rid, ...over }, S34.token)) });
    const A = newReq(), W = newReq(), E = newReq(), N = newReq();
    legacy(A, B()); legacy(W, B({ quantityRequested: 7 })); sqlRun(`INSERT INTO admin_audit_log (audit_id, player_id, event_type, target_type, target_id, metadata_json, created_at) VALUES (${q("adm-del-" + E)}, ${q(S34.admin)}, 'ADMIN_ITEM_DELETE', 'item', 'qa-junk-1', '{}', datetime('now'))`);
    const nb = B(); delete nb.quantityRequested; legacy(N, nb);
    const a0 = count(audits(), (x) => x.event_type === "ADMIN_ITEM_DELETE");
    const expectConflict = (label, r) => c.expect(label + " -> 409 request_id_conflict", r.status === 409 && r.body?.error === "request_id_conflict", r.body);
    const r1 = c.rec("1 match (qty 2)", await raw(A, { quantity: 2 }));
    c.expect("1 match -> 200 already_applied", r1.status === 200 && r1.body?.already_applied === true, r1.body);
    expectConflict("2 quantity differs (3 vs recorded 2)", c.rec("2 qty differs", await raw(A, { quantity: 3 })));
    expectConflict("3 player differs", c.rec("3 player differs", await raw(A, { quantity: 2, playerId: "qa-other-player" })));
    expectConflict("4 character differs", c.rec("4 character differs", await raw(A, { quantity: 2, characterId: "qa-other-char" })));
    expectConflict("5a null quantity vs recorded 2 of 7 (null is not a wildcard)", c.rec("5a null vs partial", await raw(A)));
    const r5b = c.rec("5b null quantity vs recorded whole stack 7", await raw(W));
    c.expect("5b null quantity vs recorded whole stack -> already_applied", r5b.status === 200 && r5b.body?.already_applied === true, r5b.body);
    expectConflict("5c metadata {} (nothing recorded)", c.rec("5c empty metadata", await raw(E, { quantity: 2 })));
    expectConflict("5d quantityRequested not recorded", c.rec("5d no quantityRequested", await raw(N, { quantity: 2 })));
    const left = JSON.parse(items().find((i) => i.item_id === "qa-junk-1")?.extra_json || "{}").quantity;
    c.expect("6 replays never deleted anything (stack still 7)", left === 7, left);
    c.expect("7 replays created no audit row and no ownership event", count(audits(), (x) => x.event_type === "ADMIN_ITEM_DELETE") === a0 && count(events(), (e) => e.event_type === "admin_deleted") === 0, { a0, now: count(audits(), (x) => x.event_type === "ADMIN_ITEM_DELETE") });
  });

  await scenario(35, "W2F-1 legacy P2: whole-stack resolved like adminItemStackInfo (column fallback, non-stackable, malformed, missing itemId)", async (c) => {
    seedJunk("qa-junk-1", 7);
    const S35 = state;
    const base = (over = {}) => ({ playerId: S35.pid, characterId: S35.cid, itemId: "qa-junk-1", quantityRequested: 2, ...over });
    const a0 = count(audits(), (x) => x.event_type === "ADMIN_ITEM_DELETE");
    let added = 0;
    const run = async (label, before, expect, over = {}) => {
      const rid = newReq();
      sqlRun(`INSERT INTO admin_audit_log (audit_id, player_id, event_type, target_type, target_id, metadata_json, created_at) VALUES (${q("adm-del-" + rid)}, ${q(S35.admin)}, 'ADMIN_ITEM_DELETE', 'item', 'qa-junk-1', ${q(JSON.stringify({ outcome: "ok", before, changedKeys: ["quantity"] }))}, datetime('now'))`);
      added++;
      const r = c.rec(label, await call("POST", { action: "adminDeleteItem", playerId: S35.pid, characterId: S35.cid, itemId: "qa-junk-1", reason: REASON, confirmText: "qa-junk-1", snapshotHash: "0".repeat(64), requestId: rid, ...over }, S35.token));
      const ok = expect === "ok" ? (r.status === 200 && r.body?.already_applied === true) : (r.status === 409 && r.body?.error === "request_id_conflict");
      c.expect(`${label} -> ${expect === "ok" ? "200 already_applied" : "409 request_id_conflict"}`, ok, r.body);
    };
    const it = (over) => ({ item_id: "qa-junk-1", slot_type: "junk", ...over });
    await run("stackable extra_json.quantity=7 (column 1), recorded 7, no quantity", base({ quantityRequested: 7, item: it({ extra_json: { quantity: 7 }, quantity: 1 }) }), "ok");
    await run("stackable extra_json.quantity=7 (column 1), recorded 1, no quantity", base({ quantityRequested: 1, item: it({ extra_json: { quantity: 7 }, quantity: 1 }) }), "conflict");
    await run("stackable quantity column only (5), recorded 5, no quantity", base({ quantityRequested: 5, item: it({ extra_json: {}, quantity: 5 }) }), "ok");
    await run("stackable quantity column only (5), recorded 2 (partial), no quantity", base({ quantityRequested: 2, item: it({ extra_json: {}, quantity: 5 }) }), "conflict");
    await run("stackable column only, explicit quantity equals record", base({ quantityRequested: 2, item: it({ extra_json: {}, quantity: 5 }) }), "ok", { quantity: 2 });
    await run("stackable column only, explicit quantity differs from record", base({ quantityRequested: 2, item: it({ extra_json: {}, quantity: 5 }) }), "conflict", { quantity: 3 });
    await run("non-stackable (extra_json.quantity=9 ignored), recorded 1, no quantity", base({ quantityRequested: 1, item: it({ slot_type: "weapon", extra_json: { quantity: 9 }, quantity: 1 }) }), "ok");
    await run("non-stackable (extra_json.quantity=9 ignored), recorded 9, no quantity", base({ quantityRequested: 9, item: it({ slot_type: "weapon", extra_json: { quantity: 9 }, quantity: 1 }) }), "conflict");
    await run("malformed column quantity 'abc'", base({ quantityRequested: 3, item: it({ extra_json: {}, quantity: "abc" }) }), "conflict");
    await run("malformed column quantity 0", base({ quantityRequested: 3, item: it({ extra_json: {}, quantity: 0 }) }), "conflict");
    await run("malformed extra_json.quantity 'x'", base({ quantityRequested: 3, item: it({ extra_json: { quantity: "x" }, quantity: 3 }) }), "conflict");
    await run("no quantity source at all (stackable)", base({ quantityRequested: 3, item: it({ extra_json: {} }) }), "conflict");
    await run("no item snapshot, no request quantity", base({ quantityRequested: 3 }), "conflict");
    await run("missing before.itemId (explicit quantity)", base({ itemId: undefined, item: it({ extra_json: { quantity: 7 } }) }), "conflict", { quantity: 2 });
    await run("missing before.playerId (explicit quantity)", base({ playerId: undefined }), "conflict", { quantity: 2 });
    await run("missing before.characterId (explicit quantity)", base({ characterId: undefined }), "conflict", { quantity: 2 });
    await run("missing quantityRequested (explicit quantity)", base({ quantityRequested: undefined }), "conflict", { quantity: 2 });
    const left = JSON.parse(items().find((i) => i.item_id === "qa-junk-1")?.extra_json || "{}").quantity;
    c.expect("replays never deleted anything (stack still 7)", left === 7, left);
    c.expect("replays created no audit row beyond the legacy rows inserted", count(audits(), (x) => x.event_type === "ADMIN_ITEM_DELETE") === a0 + added && count(events(), (e) => e.event_type === "admin_deleted") === 0, { a0, added, now: count(audits(), (x) => x.event_type === "ADMIN_ITEM_DELETE") });
  });

  reset(); // QA rows only; shared staging D1 -> put the flags back exactly as found
  if (state.priorSeedFlag !== null) seedFlag(state.priorSeedFlag);
  if (state.priorFlag === null) sqlRun(`DELETE FROM game_config WHERE key='admin_item_delete_enabled'`); else flag(state.priorFlag);
  const pass = results.filter((r) => r.status === "PASS").length;
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/evidence.json`, JSON.stringify({ commit: SHA, workerVersion: WORKER_VERSION, baseUrl: BASE, mode: MODE, stagingDb: STAGING_DB_ID, at: new Date().toISOString(), pass, total: results.length, results }, null, 2));
  const md = [`# W2-F/G Actual D1 handler QA`, `commit: ${SHA}  worker version: ${WORKER_VERSION}  mode: ${MODE}  staging D1: ${STAGING_DB_ID}`, `**${pass}/${results.length} PASS**`, "", "| # | Scenario | Result |", "|---|---|---|", ...results.map((r) => `| ${r.n} | ${r.name} | ${r.status}${r.error ? " (" + r.error + ")" : ""} |`)].join("\n");
  writeFileSync(`${OUT}/summary.md`, md); console.log(md);
  const lines = results.map((r) => `#${r.n} ${r.status} ${r.name}` + (r.error ? ` ERR:${r.error.slice(0, 160)}` : "") + (r.checks || []).filter((c) => !c.ok).slice(0, 3).map((c) => ` | FAILED:${c.label} ${JSON.stringify(c.detail ?? "").slice(0, 160)}`).join(""));
  console.log(`::error::QA ${pass}/${results.length} PASS%0A` + lines.join("%0A").replace(/\n/g, " "));
  process.exit(pass === results.length && (results.length === EXPECTED_SCENARIOS || !!env.QA_ONLY) ? 0 : 1);
}
main().catch((e) => { const m = String(e && e.message || e).slice(0, 600); console.error("QA crashed:", m); console.log("::error::QA crashed: " + m.replace(/\n/g, " ")); process.exit(3); });
