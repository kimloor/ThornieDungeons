// Ordered, context-owned persistence for idempotent full-snapshot saves.
// Transactional POSTs (Craft/Raid/Arena/Mail/etc.) intentionally do not enter this queue.
(function (root) {
  const TRANSIENT_ERRORS = new Set(["network_error", "server_error", "timeout"]);

  function makePersistenceContext({ url, accountId, characterId, credential, sessionGeneration }) {
    if (!url || !accountId || !characterId) return null;
    const generation = Number(sessionGeneration) || 0;
    return Object.freeze({
      key: `${String(url)}::${String(accountId)}::${String(characterId)}::${generation}`,
      url,
      accountId: String(accountId),
      characterId: String(characterId),
      credential: Object.freeze({ ...(credential || {}) }),
      sessionGeneration: generation
    });
  }

  function persistenceError(result) {
    if (!result || result.error) {
      const error = new Error(result?.error || "invalid_response");
      error.code = result?.error || "invalid_response";
      error.status = result?.status;
      error.transient = TRANSIENT_ERRORS.has(error.code) || Number(error.status) >= 500;
      return error;
    }
    return null;
  }

  function createPersistenceManager({ onStatusChange, retries = 2, baseDelayMs = 300, delay } = {}) {
    const contexts = new Map();
    const sleep = delay || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    let activeKey = null;
    let globalSequence = 0;

    function stateFor(context) {
      if (!context?.key) throw new Error("Persistence context is required");
      let state = contexts.get(context.key);
      if (!state) {
        state = { context, domains: new Map(), running: false, invalid: false, listeners: [] };
        contexts.set(context.key, state);
      }
      return state;
    }

    function statusOf(state) {
      if (!state || state.invalid) return "saved";
      const slots = Array.from(state.domains.values());
      if (slots.some(slot => slot.failed)) return "failed";
      if (state.running || slots.some(slot => slot.dirty || slot.inFlight)) return "saving";
      return "saved";
    }

    function notify(state) {
      const status = statusOf(state);
      if (state.context.key === activeKey && onStatusChange) {
        const failed = Array.from(state.domains.values()).find(slot => slot.failed);
        onStatusChange(status, { context: state.context, error: failed?.failed || null });
      }
      const listeners = state.listeners.splice(0);
      listeners.forEach(resolve => resolve(status));
    }

    async function executeWithRetry(slot, context, snapshot) {
      let result;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          result = await slot.write(snapshot, context);
        } catch (caught) {
          result = { error: "network_error", cause: caught };
        }
        const error = persistenceError(result);
        if (!error) return result;
        if (!error.transient || attempt === retries) throw error;
        await sleep(baseDelayMs * Math.pow(2, attempt));
      }
      return result;
    }

    async function drain(state) {
      if (state.running || state.invalid) return;
      state.running = true;
      notify(state);
      try {
        while (!state.invalid) {
          if (Array.from(state.domains.values()).some(slot => slot.failed)) break;
          const slot = Array.from(state.domains.values())
            .filter(candidate => candidate.dirty && !candidate.inFlight)
            .sort((a, b) => a.sequence - b.sequence)[0];
          if (!slot) break;
          const sequence = slot.sequence;
          const snapshot = slot.snapshot;
          slot.inFlight = true;
          slot.dirty = false;
          notify(state);
          try {
            await executeWithRetry(slot, state.context, snapshot);
            slot.failed = null;
            if (slot.sequence === sequence) {
              const waiters = slot.waiters.splice(0);
              waiters.forEach(waiter => waiter.resolve(true));
            }
          } catch (error) {
            // A newer full snapshot safely supersedes the failed attempt. Otherwise retain the
            // latest snapshot as dirty/failed until manual Save, reconnect, or a new mutation.
            if (slot.sequence === sequence) slot.failed = error;
          } finally {
            slot.inFlight = false;
            if (slot.sequence !== sequence) slot.dirty = true;
            else if (slot.failed) slot.dirty = true;
            notify(state);
          }
        }
      } finally {
        state.running = false;
        notify(state);
      }
    }

    function enqueue(context, domain, snapshot, write) {
      const state = stateFor(context);
      if (state.invalid) return Promise.resolve(false);
      let slot = state.domains.get(domain);
      if (!slot) {
        slot = { domain, snapshot: null, write, sequence: 0, dirty: false, inFlight: false, failed: null, waiters: [] };
        state.domains.set(domain, slot);
      }
      slot.snapshot = snapshot;
      slot.write = write;
      slot.sequence = ++globalSequence;
      slot.dirty = true;
      slot.failed = null;
      const promise = new Promise((resolve, reject) => slot.waiters.push({ resolve, reject }));
      notify(state);
      void drain(state);
      return promise;
    }

    async function flush(context, { retryFailed = true, transientOnly = true } = {}) {
      if (!context?.key) return false;
      const state = stateFor(context);
      if (state.invalid) return false;
      if (retryFailed) {
        state.domains.forEach(slot => {
          if (slot.failed && (!transientOnly || slot.failed.transient)) {
            slot.failed = null;
            slot.dirty = true;
          }
        });
      }
      void drain(state);
      while (state.running || Array.from(state.domains.values()).some(slot => slot.inFlight)) {
        await new Promise(resolve => state.listeners.push(resolve));
      }
      return statusOf(state) === "saved";
    }

    function setActiveContext(context) {
      activeKey = context?.key || null;
      if (context) notify(stateFor(context));
      else if (onStatusChange) onStatusChange("saved", { context: null, error: null });
    }

    function retry(context) {
      return flush(context, { retryFailed: true });
    }

    function invalidate(context) {
      if (!context?.key) return;
      const state = contexts.get(context.key);
      if (!state) return;
      state.invalid = true;
      state.domains.forEach(slot => {
        const waiters = slot.waiters.splice(0);
        waiters.forEach(waiter => waiter.resolve(false));
      });
      if (activeKey === context.key) setActiveContext(null);
      notify(state);
    }

    return { enqueue, flush, retry, invalidate, setActiveContext, status: context => statusOf(contexts.get(context?.key)) };
  }

  root.makePersistenceContext = makePersistenceContext;
  root.createPersistenceManager = createPersistenceManager;
  root.persistenceError = persistenceError;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { makePersistenceContext, createPersistenceManager, persistenceError };
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
