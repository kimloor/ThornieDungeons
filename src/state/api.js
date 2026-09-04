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

// ---------- calls ----------
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
function cloudCreateCharacter(url, id, password, slotIndex, name) {
  return cloudPost(url, {
    action: "createCharacter",
    id,
    password,
    slotIndex,
    name
  });
}
function cloudDeleteCharacter(url, id, password, slotIndex) {
  return cloudPost(url, {
    action: "deleteCharacter",
    id,
    password,
    slotIndex
  });
}
function cloudEnterCharacter(url, id, password, slotIndex) {
  return cloudPost(url, {
    action: "enterCharacter",
    id,
    password,
    slotIndex
  });
}
function cloudSaveCharacterProgress(url, id, password, characterId, diamonds, progress) {
  return cloudPost(url, {
    action: "saveCharacterProgress",
    id,
    password,
    characterId,
    diamonds,
    progress
  });
}
function cloudSyncItems(url, id, password, characterId, items) {
  return cloudPost(url, {
    action: "syncItems",
    id,
    password,
    characterId,
    items
  });
}
function cloudSaveRunState(url, id, password, characterId, runState) {
  return cloudPost(url, {
    action: "saveRunState",
    id,
    password,
    characterId,
    runState
  });
}
function cloudGetConfig(url) {
  return cloudGet(url, {
    action: "getGameConfig"
  });
}
function cloudGetDailyLogin(url, id, password, characterId) {
  return cloudGet(url, {
    action: "getDailyLogin",
    id,
    password,
    characterId
  });
}
function cloudClaimDailyLogin(url, id, password, characterId) {
  return cloudPost(url, {
    action: "claimDailyLogin",
    id,
    password,
    characterId
  });
}
