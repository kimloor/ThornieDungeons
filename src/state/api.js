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

// ---------- high-frequency write calls ----------
// NOTE: cloudSaveProgress/cloudSyncItems/cloudSaveRunState used to be routed through a
// debouncedCall() here (250ms trailing debounce, keyed by id). That was REMOVED after it
// caused a real regression: App.js's enqueueCloudWrite already serializes writes one-at-a-time
// (it awaits the previous cloudXxx call before starting the next), so the debounce added no
// protection that wasn't already there — but it DID add a real risk of data loss:
//   1. A save made right before the player reloads/logs out could still be sitting in the
//      250ms debounce window and never reach the server (confirmed: a stat point allocated
//      and checked via reload ~100ms later showed the OLD value).
//   2. Worse — under *continuous* activity (calls arriving faster than the debounce window),
//      the debounce timer keeps getting reset and the save can be postponed indefinitely,
//      never actually firing until the player stops entirely for 250ms+.
// withDedupe() + withRetry() below are what's actually safe to keep: they only collapse truly
// *identical* concurrent calls and retry *transient* failures — neither one delays or drops a
// unique write the way the debounce did.
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
function cloudSaveProgress(url, id, password, progress) {
  return cloudPost(url, {
    action: "saveProgress",
    id,
    password,
    progress
  });
}
function cloudSyncItems(url, id, password, items) {
  return cloudPost(url, {
    action: "syncItems",
    id,
    password,
    items
  });
}
function cloudSaveRunState(url, id, password, runState) {
  return cloudPost(url, {
    action: "saveRunState",
    id,
    password,
    runState
  });
}
function cloudGetConfig(url) {
  return cloudGet(url, {
    action: "getGameConfig"
  });
}
