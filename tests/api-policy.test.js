const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { API_POLICY, API_POLICY_DEFAULTS, apiPolicyFor } = require("../src/state/apiPolicy.js");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const apiSource = read("src/state/api.js");

// action -> { method, fn, usesId } for every cloud* wrapper in api.js
function declaredActions() {
  const found = new Map();
  apiSource.split(/\n(?=(?:async )?function )/).forEach(block => {
    const head = block.match(/^(?:async )?function (cloud\w+)\(([^)]*)\)/);
    if (!head || ["cloudGet", "cloudPost", "cloudAuthGet", "cloudAuthPost", "cloudAuthHeaders", "cloudResetInFlight"].includes(head[1])) return;
    const calls = Array.from(block.matchAll(/\b(cloudAuthGet|cloudAuthPost|cloudGet|cloudPost)\(/g)).map(m => m[1]);
    const action = (block.match(/action:\s*"([A-Za-z0-9_]+)"/) || [])[1];
    assert.ok(action, `${head[1]} must use a literal action string`);
    const method = calls.some(c => c.endsWith("Get")) ? "GET" : "POST";
    const usesId = /requestId|operationId|actionKey/.test(block);
    if (!found.has(action)) found.set(action, { method, fn: head[1], usesId });
  });
  return found;
}

test("API policy: every client action has a policy entry with the right method and there are no dead entries", () => {
  const actions = declaredActions();
  assert.ok(actions.size > 90);
  const missing = [];
  const wrongMethod = [];
  actions.forEach((info, action) => {
    if (!Object.prototype.hasOwnProperty.call(API_POLICY, action)) missing.push(action);
    else if (API_POLICY[action].method !== info.method) wrongMethod.push(`${action}: ${API_POLICY[action].method} vs ${info.method}`);
  });
  assert.deepEqual(missing, [], "add to src/state/apiPolicy.js: " + missing.join(", "));
  assert.deepEqual(wrongMethod, []);
  const dead = Object.keys(API_POLICY).filter(action => !actions.has(action));
  assert.deepEqual(dead, [], "policy entries without a client function: " + dead.join(", "));
});

test("API policy: POST timeouts exist only for receipt-protected actions that carry an id and exist on the Worker", () => {
  const actions = declaredActions();
  const worker = read("workers/thornie-dungeons-api.js");
  Object.entries(API_POLICY).forEach(([action, policy]) => {
    if (policy.method === "POST" && policy.timeoutMs > 0) {
      assert.equal(policy.idempotency, "receipt", `${action}: only receipt-protected POSTs may time out`);
      assert.ok(actions.get(action).usesId, `${action}: client must send requestId/operationId/actionKey`);
      assert.ok(worker.includes(`case "${action}":`), `${action}: Worker route missing`);
      assert.ok(policy.timeoutMs >= 20000 && policy.timeoutMs < 30000, `${action}: must surface before the 30s global-loading failsafe`);
    }
    if (policy.idempotency === "receipt") assert.ok(policy.timeoutMs > 0, action);
    if (policy.method === "POST") assert.equal(policy.retries, 0, `${action}: POST auto-retry belongs to PR-A (reused requestId)`);
  });
});

test("API policy: reads keep the previous behavior (15 s, 2 retries) and polling/autosave are marked background", () => {
  Object.entries(API_POLICY).filter(([, p]) => p.method === "GET").forEach(([action, p]) => {
    assert.equal(p.timeoutMs, 15000, action);
    assert.equal(p.retries, 2, action);
  });
  const background = Object.entries(API_POLICY).filter(([, p]) => p.background).map(([a]) => a).sort();
  assert.deepEqual(background, ["getDirectConversations", "getDirectMessages", "getGlobalChat", "getGuildChat", "getGuildChatStatus", "getHalloweenEventStatus", "markConversationRead", "markGuildChatRead", "saveBattleCheckpoint", "syncItems"]);
  assert.equal(apiPolicyFor("unknown_action", "GET"), API_POLICY_DEFAULTS.GET);
  assert.equal(apiPolicyFor("unknown_action", "POST").timeoutMs, 0, "unknown POST actions stay conservative");
  assert.equal(apiPolicyFor("craftItem", "GET"), API_POLICY_DEFAULTS.GET, "method mismatch falls back to defaults");
  assert.equal(apiPolicyFor("__proto__"), API_POLICY_DEFAULTS.POST);
});

function loadApi({ fetchImpl, timerScale = {} }) {
  const calls = [];
  const sandbox = {
    console, JSON, URLSearchParams, AbortController, Promise,
    setTimeout: (fn, ms) => setTimeout(fn, timerScale[ms] ?? ms),
    clearTimeout,
    fetch: (url, init = {}) => { calls.push({ url, init }); return fetchImpl(url, init); }
  };
  vm.createContext(sandbox);
  vm.runInContext(read("src/state/apiPolicy.js") + "\n" + apiSource + "\n;globalThis.__api = { cloudGet, cloudPost };", sandbox);
  return { api: sandbox.__api, calls };
}

const hang = (url, init) => new Promise((resolve, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
const ok = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });

test("API client: receipt-protected POST times out into network_error with timedOut, using the policy default", async () => {
  const { api, calls } = loadApi({ fetchImpl: hang, timerScale: { 25000: 20 } });
  const result = await api.cloudPost("https://x.test", { action: "craftItem", requestId: "req-12345678" });
  assert.deepEqual({ ...result }, { error: "network_error", timedOut: true });
  assert.ok(calls[0].init.signal, "an abort signal must be attached");
  assert.equal(calls.length, 1, "POSTs are never auto-retried");
});

test("API client: non-idempotent POSTs and keepalive flushes never get a timeout signal", async () => {
  const first = loadApi({ fetchImpl: ok });
  await first.api.cloudPost("https://x.test", { action: "login", id: "a", password: "b" });
  assert.equal(first.calls[0].init.signal, undefined, "login has no client timeout");
  await first.api.cloudPost("https://x.test", { action: "completeBattle", battleId: "b1" });
  assert.equal(first.calls[1].init.signal, undefined);
  const second = loadApi({ fetchImpl: ok });
  await second.api.cloudPost("https://x.test", { action: "craftItem", requestId: "req-12345678" }, { keepalive: true });
  assert.equal(second.calls[0].init.signal, undefined, "keepalive must not be aborted");
});

test("API client: reads retry per policy, explicit options override it, and a hung read reports timedOut", async () => {
  const fail = () => Promise.reject(new Error("offline"));
  const policyRun = loadApi({ fetchImpl: fail });
  const r1 = await policyRun.api.cloudGet("https://x.test", { action: "getLeaderboard" });
  assert.equal(r1.error, "network_error");
  assert.equal(policyRun.calls.length, 3, "1 attempt + 2 retries from policy");
  const overrideRun = loadApi({ fetchImpl: fail });
  await overrideRun.api.cloudGet("https://x.test", { action: "getLeaderboard" }, { retries: 0 });
  assert.equal(overrideRun.calls.length, 1);
  const hung = loadApi({ fetchImpl: hang, timerScale: { 15000: 20 } });
  const r2 = await hung.api.cloudGet("https://x.test", { action: "getMailbox" }, { retries: 0 });
  assert.deepEqual({ ...r2 }, { error: "network_error", timedOut: true });
});

test("API policy: module is wired before api.js and the bundle carries it", () => {
  const build = read("build.js");
  assert.ok(build.indexOf('"state/apiPolicy.js"') > -1 && build.indexOf('"state/apiPolicy.js"') < build.indexOf('"state/api.js"'));
  assert.match(read("index.html"), /const API_POLICY = Object\.freeze\(/);
});
