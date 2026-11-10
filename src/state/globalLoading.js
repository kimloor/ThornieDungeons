// Global Loading System V1 (docs/GLOBAL-LOADING-SYSTEM-V1.md)
// Presentation/orchestration only: this manager never resolves gameplay, saves, rewards or API
// results. Callers own their own success/failure handling and must release their token on every
// exit path (use run() or try/finally) BEFORE surfacing any error UI.
const GLOBAL_LOADING_DEFAULTS = Object.freeze({
  showDelayMs: 150,      // fast work never flashes the overlay
  minVisibleMs: 300,     // once shown, stay visible long enough to read
  staleOwnerMs: 30000,   // failsafe: a stuck/forgotten token auto-dismisses (callers may pass maxMs)
  staleNoticeMs: 30000,  // how long the "took too long" notice (with Retry) stays on screen
  maxLabelLength: 80,
  defaultLabel: "กำลังโหลด…"
});

function sanitizeGlobalLoadingLabel(value, maxLength, fallback) {
  // Status text is player-facing: plain, bounded, never an object/stack/secret dump.
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) return fallback;
  return text.length > maxLength ? text.slice(0, maxLength - 1) + "…" : text;
}

// Determinate progress is accepted only from real measurable counts. Anything else is
// indeterminate; progress is never derived from elapsed time.
function normalizeGlobalLoadingProgress(current, total) {
  const c = Number(current);
  const t = Number(total);
  if (current === null || current === undefined || total === null || total === undefined) return null;
  if (!Number.isFinite(c) || !Number.isFinite(t) || t <= 0 || c < 0) return null;
  return { current: Math.min(c, t), total: t };
}

function createGlobalLoadingManager(options = {}) {
  const cfg = { ...GLOBAL_LOADING_DEFAULTS, ...(options.config || {}) };
  const now = options.now || (() => Date.now());
  const setTimer = options.setTimeout || ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = options.clearTimeout || (id => clearTimeout(id));
  const onStale = typeof options.onStale === "function" ? options.onStale : null;
  const probe = typeof options.probe === "function" ? options.probe : null;      // async () => ({ ok, ms })
  const beforeRetry = typeof options.beforeRetry === "function" ? options.beforeRetry : null;

  const owners = new Map();
  const listeners = new Set();
  let nextId = 1;
  let visible = false;
  let shownAt = 0;
  let showTimer = null;
  let hideTimer = null;
  let snapshot = null;
  let staleNotice = null;
  let staleNoticeTimer = null;
  let staleSeq = 0;
  let staleRetry = null;

  function blockingOwners() {
    return Array.from(owners.values()).filter(o => o.blocking);
  }

  function buildSnapshot() {
    const blocking = blockingOwners();
    const latest = blocking[blocking.length - 1] || null;
    const progress = latest ? normalizeGlobalLoadingProgress(latest.current, latest.total) : null;
    return Object.freeze({
      visible,
      activeCount: owners.size,
      blockingCount: blocking.length,
      keys: Object.freeze(blocking.map(o => o.key)),
      staleNotice,
      label: latest ? latest.label : cfg.defaultLabel,
      mode: progress ? "determinate" : "indeterminate",
      current: progress ? progress.current : 0,
      total: progress ? progress.total : 0,
      percent: progress ? Math.round((progress.current / progress.total) * 100) : 0
    });
  }

  function sameSnapshot(a, b) {
    return !!a && a.visible === b.visible && a.activeCount === b.activeCount && a.blockingCount === b.blockingCount
      && a.staleNotice === b.staleNotice && a.label === b.label && a.mode === b.mode && a.current === b.current && a.total === b.total
      && a.keys.join("|") === b.keys.join("|");
  }

  function refresh() {
    const next = buildSnapshot();
    if (sameSnapshot(snapshot, next)) return;
    snapshot = next;
    Array.from(listeners).forEach(fn => { try { fn(snapshot); } catch (_) { /* a listener must never break release */ } });
  }

  function cancelShow() { if (showTimer !== null) { clearTimer(showTimer); showTimer = null; } }
  function cancelHide() { if (hideTimer !== null) { clearTimer(hideTimer); hideTimer = null; } }

  function evaluate() {
    if (blockingOwners().length > 0) {
      cancelHide();
      if (!visible && showTimer === null) {
        showTimer = setTimer(() => {
          showTimer = null;
          if (blockingOwners().length === 0) return;
          visible = true;
          shownAt = now();
          refresh();
        }, cfg.showDelayMs);
      }
    } else {
      cancelShow();
      if (visible && hideTimer === null) {
        const remaining = cfg.minVisibleMs - (now() - shownAt);
        if (remaining <= 0) {
          visible = false;
        } else {
          hideTimer = setTimer(() => {
            hideTimer = null;
            if (blockingOwners().length === 0) { visible = false; refresh(); }
          }, remaining);
        }
      }
    }
    refresh();
  }

  function runProbe(noticeId) {
    if (!probe) return;
    Promise.resolve()
      .then(() => probe())
      .then(result => ({ connection: result && result.ok ? "ok" : "down", ms: Math.max(0, Number(result && result.ms) || 0) }))
      .catch(() => ({ connection: "down", ms: 0 }))
      .then(result => {
        if (!staleNotice || staleNotice.id !== noticeId) return;
        staleNotice = Object.freeze({ ...staleNotice, ...result });
        refresh();
      });
  }

  function clearStaleNotice() {
    if (staleNoticeTimer !== null) { clearTimer(staleNoticeTimer); staleNoticeTimer = null; }
    staleNotice = null;
    staleRetry = null;
    refresh();
  }

  function release(id, reason) {
    const owner = owners.get(id);
    if (!owner) return false; // idempotent: double release is safe
    owners.delete(id);
    if (owner.staleTimer !== null) clearTimer(owner.staleTimer);
    if (reason === "stale") {
      // The work may still be running in the background; the player is simply no longer trapped.
      staleSeq += 1;
      const noticeId = staleSeq;
      staleRetry = owner.onRetry;
      staleNotice = Object.freeze({ id: noticeId, key: owner.key, label: owner.label, canRetry: !!staleRetry, connection: probe ? "checking" : "unknown", ms: 0 });
      if (staleNoticeTimer !== null) clearTimer(staleNoticeTimer);
      staleNoticeTimer = setTimer(() => { staleNoticeTimer = null; if (staleNotice && staleNotice.id === noticeId) { staleNotice = null; staleRetry = null; refresh(); } }, cfg.staleNoticeMs);
      if (probe) runProbe(noticeId);
      if (onStale) {
        try { onStale({ key: owner.key, label: owner.label, ageMs: now() - owner.startedAt }); } catch (_) { /* ignore */ }
      }
    }
    evaluate();
    return true;
  }

  function begin(spec = {}) {
    const id = nextId++;
    const owner = {
      id,
      key: sanitizeGlobalLoadingLabel(spec.key, 60, "unnamed"),
      label: sanitizeGlobalLoadingLabel(spec.label, cfg.maxLabelLength, cfg.defaultLabel),
      blocking: spec.blocking !== false,
      current: spec.current,
      total: spec.total,
      startedAt: now(),
      onRetry: typeof spec.onRetry === "function" ? spec.onRetry : null,
      staleTimer: null
    };
    const maxMs = Number.isFinite(spec.maxMs) && spec.maxMs > 0 ? spec.maxMs : cfg.staleOwnerMs;
    if (maxMs > 0) owner.staleTimer = setTimer(() => release(id, "stale"), maxMs);
    owners.set(id, owner);
    evaluate();
    return Object.freeze({
      id,
      key: owner.key,
      isActive: () => owners.has(id),
      update(patch = {}) {
        const live = owners.get(id);
        if (!live) return;
        if (patch.label !== undefined) live.label = sanitizeGlobalLoadingLabel(patch.label, cfg.maxLabelLength, cfg.defaultLabel);
        if ("current" in patch) live.current = patch.current;
        if ("total" in patch) live.total = patch.total;
        refresh();
      },
      release: () => release(id, "released")
    });
  }

  // Wraps an async task: token is always released (success, failure, throw) and the original
  // error is rethrown untouched so the caller shows its normal detailed error UI afterwards.
  async function run(spec, task) {
    const token = begin(spec);
    try {
      return await task(token);
    } finally {
      token.release();
    }
  }

  function releaseAll() {
    Array.from(owners.keys()).forEach(id => release(id, "released"));
  }

  snapshot = buildSnapshot();

  return {
    begin,
    run,
    releaseAll,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    // Retry is offered only for owners that declared an idempotent onRetry (reads/reloads).
    retryStale() {
      const fn = staleRetry;
      clearStaleNotice();
      if (beforeRetry) { try { beforeRetry(); } catch (_) { /* ignore */ } }
      if (fn) { try { fn(); } catch (_) { /* the retried flow owns its own error UI */ } }
    },
    // Hand-off: a flow that began a token can have another component release it by key when the
    // real end condition (e.g. Phaser stage ready) is reached.
    releaseKey(key) {
      Array.from(owners.values()).filter(o => o.key === key).forEach(o => release(o.id, "released"));
    },
    dismissStale: clearStaleNotice,
    recheckConnection() {
      if (!probe || !staleNotice) return;
      staleNotice = Object.freeze({ ...staleNotice, connection: "checking", ms: 0 });
      refresh();
      runProbe(staleNotice.id);
    },
    // True as soon as a blocking owner exists, even before the overlay's show delay elapses,
    // so callers can guard duplicate input without waiting for the visual.
    hasBlockingOwner: key => blockingOwners().some(o => key === undefined || o.key === key)
  };
}

// Lightweight reachability probe against the public config endpoint (bypasses the API client's
// de-duplication so a hung request cannot make the probe hang too). Any non-5xx HTTP answer
// within the timeout means the server is reachable.
async function defaultGlobalLoadingProbe(timeoutMs = 8000) {
  const base = typeof DEFAULT_SERVER_URL === "string" ? DEFAULT_SERVER_URL : "";
  if (!base || typeof fetch !== "function") return { ok: false, ms: 0 };
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const started = Date.now();
  try {
    const res = await fetch(`${base}?action=getGameConfig`, controller ? { cache: "no-store", signal: controller.signal } : { cache: "no-store" });
    return { ok: res.status < 500, ms: Date.now() - started };
  } catch (_) {
    return { ok: false, ms: Date.now() - started };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const GLOBAL_LOADING = createGlobalLoadingManager({
  probe: defaultGlobalLoadingProbe,
  // A retry must not piggyback on the hung request it is replacing.
  beforeRetry: () => { if (typeof cloudResetInFlight === "function") cloudResetInFlight(); }
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createGlobalLoadingManager, normalizeGlobalLoadingProgress, sanitizeGlobalLoadingLabel, GLOBAL_LOADING_DEFAULTS };
}
