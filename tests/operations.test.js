const test = require("node:test");
const assert = require("node:assert/strict");
const { createOperationManager, isTransientOperationResult, revertOperationFields, OPERATIONS_DEFAULTS } = require("../src/state/operations.js");
const { apiPolicyFor } = require("../src/state/apiPolicy.js");
const { errorMessage } = require("../src/state/errorCatalog.js");

function make(extra = {}) {
  const sleeps = [];
  let clock = 0;
  const mgr = createOperationManager({
    policyFor: apiPolicyFor,
    errorMessage,
    sleep: async ms => { sleeps.push(ms); clock += ms; },
    now: () => clock,
    random: () => 0.5, // zero jitter
    ...extra
  });
  return { mgr, sleeps, advance: ms => { clock += ms; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const netFail = { ok: false, error: "network_error", timedOut: true };

test("retry reuses the same requestId and stops on success", async () => {
  const { mgr, sleeps } = make();
  const ids = [];
  const res = await mgr.run({ key: "shop.buy:1", action: "purchaseShopEquipment" }, async id => {
    ids.push(id);
    return ids.length < 3 ? netFail : { ok: true };
  });
  assert.equal(res.ok, true);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 1);
  assert.deepEqual(sleeps, [1000, 2000]);
});

test("retries at most 3 times then returns the transient error", async () => {
  const { mgr, sleeps } = make();
  let calls = 0;
  const res = await mgr.run({ key: "k", action: "sellCharacterItem" }, async () => { calls++; return { ok: false, error: "server_error" }; });
  assert.equal(calls, 4);
  assert.deepEqual(sleeps, [1000, 2000, 4000]);
  assert.equal(res.ok, false);
  assert.equal(res.error, "server_error");
});

test("no retry for business errors", async () => {
  const { mgr } = make();
  let calls = 0;
  const res = await mgr.run({ key: "k", action: "purchaseShopEquipment" }, async () => { calls++; return { ok: false, error: "insufficient_funds" }; });
  assert.equal(calls, 1);
  assert.equal(res.error, "insufficient_funds");
});

test("no retry when the policy is not receipt (state / none) or action is missing", async () => {
  for (const action of ["acceptFriendRequest", "completeBattle", "unknownAction", undefined]) {
    const { mgr } = make();
    let calls = 0;
    await mgr.run({ key: "k", action }, async () => { calls++; return netFail; });
    assert.equal(calls, 1, `action ${action} must not auto-retry`);
  }
});

test("retry:false opts a receipt action out", async () => {
  const { mgr } = make();
  let calls = 0;
  await mgr.run({ key: "k", action: "craftItem", retry: false }, async () => { calls++; return netFail; });
  assert.equal(calls, 1);
});

test("total time budget stops further retries", async () => {
  const { mgr, sleeps, advance } = make({ config: { budgetMs: 2500 } });
  let calls = 0;
  await mgr.run({ key: "k", action: "salvageItem" }, async () => { calls++; advance(1000); return netFail; });
  // attempt1 (t=1000) +1000 wait ok -> attempt2 (t=3000) next wait 2000 would pass 2500 -> stop
  assert.equal(calls, 2);
  assert.deepEqual(sleeps, [1000]);
});

test("a thrown task becomes network_error and is retried for receipt actions", async () => {
  const { mgr } = make();
  let calls = 0;
  const res = await mgr.run({ key: "k", action: "consumePotion" }, async () => { calls++; if (calls < 2) throw new Error("boom"); return { ok: true }; });
  assert.equal(res.ok, true);
  assert.equal(calls, 2);
});

test("double tap on the same key is rejected, not queued", async () => {
  const { mgr } = make();
  let release;
  const first = mgr.run({ key: "same", group: "inventory", characterId: "c1" }, () => new Promise(r => { release = () => r({ ok: true }); }));
  const second = await mgr.run({ key: "same", group: "inventory", characterId: "c1" }, async () => ({ ok: true }));
  assert.equal(second.ok, false);
  assert.equal(second.error, "operation_busy");
  assert.ok(second.message);
  await tick();
  release();
  assert.equal((await first).ok, true);
  assert.equal(mgr.isPending("same"), false);
});

test("different keys in one character group run one at a time, in order", async () => {
  const { mgr } = make();
  const log = [];
  let releaseA;
  const a = mgr.run({ key: "a", group: "inventory", characterId: "c1" }, async () => { log.push("a:start"); await new Promise(r => { releaseA = r; }); log.push("a:end"); return { ok: true }; });
  const b = mgr.run({ key: "b", group: "inventory", characterId: "c1" }, async () => { log.push("b:start"); return { ok: true }; });
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(log, ["a:start"]);
  releaseA();
  await Promise.all([a, b]);
  assert.deepEqual(log, ["a:start", "a:end", "b:start"]);
});

test("different characters or groups do not block each other", async () => {
  const { mgr } = make();
  let releaseA;
  const a = mgr.run({ key: "a", group: "inventory", characterId: "c1" }, () => new Promise(r => { releaseA = () => r({ ok: true }); }));
  const other = await mgr.run({ key: "b", group: "inventory", characterId: "c2" }, async () => ({ ok: true }));
  const otherGroup = await mgr.run({ key: "c", group: "pet", characterId: "c1" }, async () => ({ ok: true }));
  assert.equal(other.ok, true);
  assert.equal(otherGroup.ok, true);
  releaseA();
  await a;
});

test("conflict:'reject' refuses while the group is busy", async () => {
  const { mgr } = make();
  let release;
  const a = mgr.run({ key: "a", group: "inventory", characterId: "c1" }, () => new Promise(r => { release = () => r({ ok: true }); }));
  const b = await mgr.run({ key: "b", group: "inventory", characterId: "c1", conflict: "reject" }, async () => ({ ok: true }));
  assert.equal(b.error, "operation_busy");
  await tick();
  release();
  await a;
  const c = await mgr.run({ key: "c", group: "inventory", characterId: "c1", conflict: "reject" }, async () => ({ ok: true }));
  assert.equal(c.ok, true);
});

test("a failing operation does not break the queue behind it", async () => {
  const { mgr } = make();
  const a = mgr.run({ key: "a", group: "g", characterId: "c" }, async () => { throw new Error("x"); });
  const b = mgr.run({ key: "b", group: "g", characterId: "c" }, async () => ({ ok: true }));
  assert.equal((await a).error, "network_error");
  assert.equal((await b).ok, true);
});

test("pending registry drives isPending / isGroupPending and notifies subscribers", async () => {
  const { mgr } = make();
  const seen = [];
  const off = mgr.subscribe(() => seen.push(mgr.isPending("k")));
  let release;
  const p = mgr.run({ key: "k", group: "shop", characterId: "c1" }, () => new Promise(r => { release = () => r({ ok: true }); }));
  assert.equal(mgr.isPending("k"), true);
  assert.equal(mgr.isGroupPending("shop", "c1"), true);
  assert.equal(mgr.isGroupPending("shop", "c2"), false);
  await tick();
  release();
  await p;
  await Promise.resolve();
  assert.equal(mgr.isPending("k"), false);
  assert.equal(mgr.isGroupPending("shop", "c1"), false);
  assert.ok(seen.includes(true) && seen[seen.length - 1] === false);
  off();
});

test("ui:'overlay' owns the Global Loading token once per intent (not per retry); inline/none never do", async () => {
  const runs = [];
  const loading = { run: async (spec, task) => { runs.push(spec); return task(); } };
  const { mgr } = make({ loading });
  let calls = 0;
  await mgr.run({ key: "shop.refresh", action: "refreshCharacterShopStock", ui: "overlay", label: "x" }, async () => { calls++; return calls < 3 ? netFail : { ok: true }; });
  assert.equal(calls, 3);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].key, "shop.refresh");
  await mgr.run({ key: "i", ui: "inline" }, async () => ({ ok: true }));
  await mgr.run({ key: "n", ui: "none" }, async () => ({ ok: true }));
  assert.equal(runs.length, 1, "inline and none must not open the overlay");
});

test("rollback runs on failure with the apply context, never on success", async () => {
  const { mgr } = make();
  const events = [];
  const spec = { key: "k", apply: () => { events.push("apply"); return { token: 7 }; }, rollback: (ctx, res) => events.push(`rollback:${ctx.token}:${res.error}`) };
  await mgr.run(spec, async () => ({ ok: false, error: "insufficient_funds" }));
  await mgr.run({ ...spec, key: "k2" }, async () => ({ ok: true }));
  assert.deepEqual(events, ["apply", "rollback:7:insufficient_funds", "apply"]);
});

test("rollback also runs after transient retries are exhausted", async () => {
  const { mgr } = make();
  let rolled = 0;
  await mgr.run({ key: "k", action: "sellCharacterItem", apply: () => 1, rollback: () => { rolled++; } }, async () => netFail);
  assert.equal(rolled, 1);
});

test("revertOperationFields only reverts fields nobody else changed", () => {
  const previous = { gold: 1000, items: ["a"], diamonds: 5 };
  const applied = { gold: 700, items: ["a", "b"], diamonds: 5 };
  // a reward arrived while waiting: gold moved on its own, items stayed as applied
  const current = { gold: 1200, items: applied.items, diamonds: 5 };
  const reverted = revertOperationFields(current, applied, previous, ["gold", "items"]);
  assert.equal(reverted.gold, 1200, "foreign change to gold must survive");
  assert.deepEqual(reverted.items, ["a"]);
  assert.equal(current.gold, 1200, "input is not mutated");
});

test("failed results get catalog text; explicit message and overrides win", async () => {
  const { mgr } = make();
  const net = await mgr.run({ key: "a" }, async () => ({ ok: false, error: "session_replaced" }));
  assert.ok(net.message && net.message.length > 3);
  const own = await mgr.run({ key: "b" }, async () => ({ ok: false, error: "session_replaced", message: "mine" }));
  assert.equal(own.message, "mine");
  const over = await mgr.run({ key: "c", errorOverrides: { item_not_found: "gone" } }, async () => ({ ok: false, error: "item_not_found" }));
  assert.equal(over.message, "gone");
  const none = await mgr.run({ key: "d" }, async () => ({ ok: false, error: "some_unknown_code" }));
  assert.equal(none.message, undefined);
});

test("isTransientOperationResult", () => {
  assert.equal(isTransientOperationResult({ error: "network_error" }), true);
  assert.equal(isTransientOperationResult({ error: "server_error" }), true);
  assert.equal(isTransientOperationResult({ status: 503 }), true);
  assert.equal(isTransientOperationResult({ ok: false, error: "insufficient_funds" }), false);
  assert.equal(isTransientOperationResult(null), false);
});

test("defaults match the approved plan (3 retries, 1/2/4 s, 45 s budget)", () => {
  assert.equal(OPERATIONS_DEFAULTS.maxRetries, 3);
  assert.deepEqual(Array.from(OPERATIONS_DEFAULTS.backoffMs), [1000, 2000, 4000]);
  assert.equal(OPERATIONS_DEFAULTS.budgetMs, 45000);
});
