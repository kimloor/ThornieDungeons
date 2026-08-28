// ---------- HTTP helpers: retry + in-flight de-duplication ----------
// Any transient network hiccup here previously just resolved to {error:"network_error"} and got
// silently swallowed by the caller's write queue — with no retry, a single dropped packet during
// a burst of Salvage/Enhance clicks permanently desyncs the client from the server. withRetry()
// gives transient failures a couple of quick chances to recover before giving up for real.
async function withRetry(fn, { retries = 2, baseDelayMs = 300 } = {}) {
  let lastResult;
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await fn();
    if (!lastResult || !lastResult.error) return lastResult;
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  return lastResult;
}

// If an identical request (same URL + body) is already in flight, piggyback on that same
// promise instead of firing a second one — this is what actually prevents duplicate network
// requests when a handler somehow gets invoked twice in quick succession (double-tap, retry
// logic elsewhere, etc), independent of any UI-level lock.
const _inFlight = new Map();
function dedupeKey(url, body) {
  return url + "::" + JSON.stringify(body);
}
function withDedupe(key, fn) {
  if (_inFlight.has(key)) return _inFlight.get(key);
  const p = fn().finally(() => _inFlight.delete(key));
  _inFlight.set(key, p);
  return p;
}

async function cloudGet(url, params) {
  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${url}?${qs}`;
  return withDedupe(fullUrl, () => withRetry(async () => {
    try {
      const res = await fetch(fullUrl);
      return await res.json();
    } catch (e) {
      return {
        error: "network_error"
      };
    }
  }));
}
async function cloudPost(url, body) {
  return withDedupe(dedupeKey(url, body), () => withRetry(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      return {
        error: "network_error"
      };
    }
  }));
}

// ---------- debounced writes for high-frequency actions ----------
// Salvage/Enhance/Empower/Reroll (and every other inventory tweak) each trigger a full-state
// saveProgress/syncItems POST. During a rapid burst (e.g. mashing Enhance) there's no need to
// send every intermediate state — only the *latest* one matters. debouncedCall() coalesces
// same-key calls made within `waitMs` of each other into a single request carrying the most
// recent arguments, while every caller in the burst still gets a promise that resolves with
// that single request's result (so nobody hangs waiting on a request that never fires).
const _debounceTimers = new Map();
const _debounceWaiters = new Map();
function debouncedCall(key, waitMs, run) {
  return new Promise((resolve, reject) => {
    if (!_debounceWaiters.has(key)) _debounceWaiters.set(key, []);
    _debounceWaiters.get(key).push({
      resolve,
      reject
    });
    if (_debounceTimers.has(key)) clearTimeout(_debounceTimers.get(key));
    _debounceTimers.set(key, setTimeout(() => {
      _debounceTimers.delete(key);
      const waiters = _debounceWaiters.get(key) || [];
      _debounceWaiters.delete(key);
      run().then(result => waiters.forEach(w => w.resolve(result)), err => waiters.forEach(w => w.reject(err)));
    }, waitMs));
  });
}

function cloudLogin(url, id, password) {
  return cloudGet(url, {
    action: "login",
    id,
    password
  });
}
function cloudRegister(url, id, password) {
  return cloudPost(url, {
    action: "register",
    id,
    password
  });
}
// Debounced (250ms trailing) — coalesces bursts from rapid Salvage/Enhance/etc into one write
// of the latest state instead of one request per click.
function cloudSaveProgress(url, id, password, progress) {
  return debouncedCall(`saveProgress:${id}`, 250, () => cloudPost(url, {
    action: "saveProgress",
    id,
    password,
    progress
  }));
}
function cloudSyncItems(url, id, password, items) {
  return debouncedCall(`syncItems:${id}`, 250, () => cloudPost(url, {
    action: "syncItems",
    id,
    password,
    items
  }));
}
function cloudSaveRunState(url, id, password, runState) {
  return debouncedCall(`saveRunState:${id}`, 250, () => cloudPost(url, {
    action: "saveRunState",
    id,
    password,
    runState
  }));
}
function cloudGetConfig(url) {
  return cloudGet(url, {
    action: "getGameConfig"
  });
}
