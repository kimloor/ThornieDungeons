// Server Operation Manager (docs/CLIENT-SYSTEMS-V1.md section 11)
// Standard lifecycle for state-changing server actions: one requestId per player intent,
// automatic retry of receipt-protected actions, per-character queue, pending registry for
// disabling controls, optimistic apply + scoped rollback, errors via the catalog.
// It never resolves gameplay: the Worker stays authoritative; callers keep their own result handling.
const OPERATIONS_DEFAULTS = Object.freeze({
  maxRetries: 3,              // retries after the first attempt (receipt actions only)
  backoffMs: [1000, 2000, 4000],
  jitter: 0.2,                // +/-20% so devices do not retry in lockstep
  budgetMs: 45000,            // stop retrying once an intent has taken this long in total
  busyMessage: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e17\u0e33\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e01\u0e48\u0e2d\u0e19\u0e2b\u0e19\u0e49\u0e32 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e23\u0e2d\u0e2a\u0e31\u0e01\u0e04\u0e23\u0e39\u0e48"
});

function newOperationRequestId(prefix) {
  const rand = (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function")
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix || "op"}-${rand}`;
}

// Transient = the request may not have reached (or finished on) the server. Business errors
// (insufficient_funds, item_not_found, ...) are final and never retried.
function isTransientOperationResult(result) {
  if (!result || typeof result !== "object") return false;
  return result.error === "network_error" || result.error === "server_error" ||
    result.timedOut === true || Number(result.status) >= 500;
}

// Reverts only the keys this operation changed, and only when nobody else has changed them since.
// current: live state, applied: state right after the optimistic apply, previous: state before it.
// Anything that moved on its own (e.g. a reward that arrived while waiting) is left untouched.
function revertOperationFields(current, applied, previous, keys) {
  const next = { ...current };
  (keys || Object.keys(applied || {})).forEach(key => {
    if (Object.is(current[key], applied[key])) next[key] = previous[key];
  });
  return next;
}

function createOperationManager(options = {}) {
  const cfg = { ...OPERATIONS_DEFAULTS, ...(options.config || {}) };
  const sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const now = options.now || (() => Date.now());
  const random = options.random || Math.random;
  const policyFor = options.policyFor || null;     // (action, "POST") => { idempotency }
  const loading = options.loading || null;         // GLOBAL_LOADING-like { run(spec, task) }
  const explain = options.errorMessage || null;    // errorMessage(code, { overrides, fallback })
  const beforeRetry = typeof options.beforeRetry === "function" ? options.beforeRetry : null;

  const pending = new Map();      // key -> count (inline pending registry)
  const queues = new Map();       // `${characterId}:${group}` -> tail promise
  const listeners = new Set();
  let version = 0;

  function notify() {
    version += 1;
    listeners.forEach(fn => { try { fn(version); } catch (_) { /* ignore */ } });
  }
  function mark(key, delta) {
    const count = (pending.get(key) || 0) + delta;
    if (count > 0) pending.set(key, count); else pending.delete(key);
    notify();
  }

  function canRetry(spec) {
    if (spec.retry === false) return false;
    if (!spec.action || !policyFor) return false;
    const policy = policyFor(spec.action, "POST");
    return !!policy && policy.idempotency === "receipt";
  }

  function backoffDelay(retryIndex) {
    const base = cfg.backoffMs[Math.min(retryIndex, cfg.backoffMs.length - 1)];
    const spread = (random() * 2 - 1) * cfg.jitter;
    return Math.max(0, Math.round(base * (1 + spread)));
  }

  function finalize(spec, result) {
    const res = result && typeof result === "object" ? result : { ok: false, error: "network_error" };
    if (res.ok || res.message || !explain) return res;
    const text = explain(res.error, { overrides: spec.errorOverrides || null, fallback: "" });
    return text ? { ...res, message: text } : res;
  }

  async function attempts(spec, task) {
    const requestId = spec.requestId || newOperationRequestId(spec.action || spec.key);
    const retriable = canRetry(spec);
    const startedAt = now();
    let result;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await task(requestId, { attempt, retried: attempt > 0 });
      } catch (_) {
        result = { ok: false, error: "network_error" };
      }
      if (!retriable || !isTransientOperationResult(result) || attempt >= cfg.maxRetries) break;
      const wait = backoffDelay(attempt);
      if (now() - startedAt + wait > cfg.budgetMs) break;
      await sleep(wait);
      if (beforeRetry) { try { beforeRetry(); } catch (_) { /* ignore */ } }
    }
    return { result, requestId };
  }

  async function execute(spec, task) {
    let ctx;
    let applied = false;
    if (typeof spec.apply === "function") { ctx = spec.apply(); applied = true; }
    let outcome;
    const work = () => attempts(spec, task);
    try {
      outcome = (spec.ui === "overlay" && loading)
        ? await loading.run({ key: spec.key, label: spec.label || "" }, work)
        : await work();
    } catch (error) {
      const failed = { ok: false, error: "network_error" };
      if (typeof spec.settle === "function") { try { spec.settle(failed); } catch (_) { /* ignore */ } }
      if (applied && typeof spec.rollback === "function") spec.rollback(ctx, failed);
      throw error;
    }
    const result = finalize(spec, outcome.result);
    // settle() runs once per intent on every exit path (success, failure, throw): clear local pending UI here.
    if (typeof spec.settle === "function") { try { spec.settle(result); } catch (_) { /* ignore */ } }
    if (!result.ok && applied && typeof spec.rollback === "function") spec.rollback(ctx, result);
    return result;
  }

  // spec: { key, group?, characterId?, action?, ui?: "inline"|"overlay"|"none", label?, apply?, rollback?,
  //         requestId?, retry?, conflict?: "queue"|"reject", errorOverrides?, settle?(result) }
  function run(spec, task) {
    const key = String(spec && spec.key || "");
    if (!key) throw new Error("OPERATIONS.run requires a key");
    const groupKey = spec.group ? `${spec.characterId || "-"}:${spec.group}` : null;
    // The same intent twice (double tap) is always rejected, never queued behind itself.
    if (pending.has(key)) return Promise.resolve({ ok: false, error: "operation_busy", message: cfg.busyMessage });
    const tail = groupKey ? queues.get(groupKey) : null;
    if (tail && spec.conflict === "reject") return Promise.resolve({ ok: false, error: "operation_busy", message: cfg.busyMessage });

    mark(key, 1);
    if (spec.ui !== "none") mark(`group:${groupKey || key}`, 1);
    // Cleanup runs BEFORE the caller's await resumes, so `await run(a); run(b)` never sees a stale lock.
    const cleanup = () => {
      mark(key, -1);
      if (spec.ui !== "none") mark(`group:${groupKey || key}`, -1);
      if (groupKey && queues.get(groupKey) === done) queues.delete(groupKey);
    };
    const start = async () => {
      try { return await execute(spec, task); } finally { cleanup(); }
    };
    const job = (tail || Promise.resolve()).then(start);
    const done = job.catch(() => {});
    if (groupKey) queues.set(groupKey, done);
    return job;
  }

  return {
    run,
    isPending: key => pending.has(String(key)),
    isGroupPending: (group, characterId) => pending.has(`group:${characterId || "-"}:${group}`),
    pendingKeys: () => Array.from(pending.keys()),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    getVersion: () => version,
    config: cfg
  };
}

const OPERATIONS = createOperationManager({
  policyFor: typeof apiPolicyFor === "function" ? apiPolicyFor : null,
  loading: typeof GLOBAL_LOADING !== "undefined" ? GLOBAL_LOADING : null,
  errorMessage: typeof errorMessage === "function" ? errorMessage : null,
  beforeRetry: () => { if (typeof cloudResetInFlight === "function") cloudResetInFlight(); }
});

// React hook: re-renders when pending state changes. Pass a key, or { group, characterId } for a whole queue.
function useOperationPending(target) {
  const [, setTick] = useState(0);
  useEffect(() => OPERATIONS.subscribe(v => setTick(v)), []);
  if (target && typeof target === "object") return OPERATIONS.isGroupPending(target.group, target.characterId);
  return OPERATIONS.isPending(target);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { OPERATIONS_DEFAULTS, createOperationManager, isTransientOperationResult, revertOperationFields, newOperationRequestId };
}
