// Global Loading System V1 (docs/GLOBAL-LOADING-SYSTEM-V1.md)
// Presentation/orchestration only: this manager never resolves gameplay, saves, rewards or API
// results. Callers own their own success/failure handling and must release their token on every
// exit path (use run() or try/finally) BEFORE surfacing any error UI.
const GLOBAL_LOADING_DEFAULTS = Object.freeze({
  showDelayMs: 150,      // fast work never flashes the overlay
  minVisibleMs: 300,     // once shown, stay visible long enough to read
  staleOwnerMs: 60000,   // failsafe: a forgotten token cannot trap the player forever
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

  const owners = new Map();
  const listeners = new Set();
  let nextId = 1;
  let visible = false;
  let shownAt = 0;
  let showTimer = null;
  let hideTimer = null;
  let snapshot = null;

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
      label: latest ? latest.label : cfg.defaultLabel,
      mode: progress ? "determinate" : "indeterminate",
      current: progress ? progress.current : 0,
      total: progress ? progress.total : 0,
      percent: progress ? Math.round((progress.current / progress.total) * 100) : 0
    });
  }

  function sameSnapshot(a, b) {
    return !!a && a.visible === b.visible && a.activeCount === b.activeCount && a.blockingCount === b.blockingCount
      && a.label === b.label && a.mode === b.mode && a.current === b.current && a.total === b.total
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

  function release(id, reason) {
    const owner = owners.get(id);
    if (!owner) return false; // idempotent: double release is safe
    owners.delete(id);
    if (owner.staleTimer !== null) clearTimer(owner.staleTimer);
    if (reason === "stale" && onStale) {
      try { onStale({ key: owner.key, label: owner.label, ageMs: now() - owner.startedAt }); } catch (_) { /* ignore */ }
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
      staleTimer: null
    };
    if (cfg.staleOwnerMs > 0) owner.staleTimer = setTimer(() => release(id, "stale"), cfg.staleOwnerMs);
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
    // True as soon as a blocking owner exists, even before the overlay's show delay elapses,
    // so callers can guard duplicate input without waiting for the visual.
    hasBlockingOwner: key => blockingOwners().some(o => key === undefined || o.key === key)
  };
}

const GLOBAL_LOADING = createGlobalLoadingManager();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createGlobalLoadingManager, normalizeGlobalLoadingProgress, sanitizeGlobalLoadingLabel, GLOBAL_LOADING_DEFAULTS };
}
