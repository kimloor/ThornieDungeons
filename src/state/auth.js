const AUTH_REMEMBERED_SESSION_KEY = "thornie-auth-session-v2";
const AUTH_TAB_SESSION_KEY = "thornie-auth-tab-session-v2";
const SESSION_LIFECYCLE_ERRORS = new Set(["session_expired", "session_replaced", "session_revoked", "invalid_session"]);

function createAuthSessionStore() {
  let current = null;
  let generation = 0;
  const invalidListeners = new Set();

  async function load() {
    let raw = await kvGet(AUTH_REMEMBERED_SESSION_KEY);
    if (!raw) {
      try { raw = window.sessionStorage?.getItem(AUTH_TAB_SESSION_KEY); } catch (e) {}
    }
    try {
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.sessionToken && parsed?.playerId) {
        current = parsed;
        generation += 1;
        return current;
      }
    } catch (e) {}
    await clearStored();
    return null;
  }

  async function clearStored() {
    await kvRemove(AUTH_REMEMBERED_SESSION_KEY);
    try { window.sessionStorage?.removeItem(AUTH_TAB_SESSION_KEY); } catch (e) {}
  }

  async function setSession(session, rememberLogin) {
    current = {
      sessionToken: session.sessionToken,
      playerId: session.playerId,
      expiresAt: session.expiresAt,
      rememberLogin: !!rememberLogin,
      recoveryConfigured: !!session.recoveryConfigured
    };
    generation += 1;
    const serialized = JSON.stringify(current);
    if (rememberLogin) {
      await kvSet(AUTH_REMEMBERED_SESSION_KEY, serialized);
      try { window.sessionStorage?.removeItem(AUTH_TAB_SESSION_KEY); } catch (e) {}
    } else {
      await kvRemove(AUTH_REMEMBERED_SESSION_KEY);
      try { window.sessionStorage?.setItem(AUTH_TAB_SESSION_KEY, serialized); } catch (e) {}
    }
    return current;
  }

  async function clear(reason = "logout", notify = false) {
    const previous = current;
    current = null;
    generation += 1;
    await clearStored();
    if (notify && previous) invalidListeners.forEach(listener => listener(reason, previous));
  }

  function handleApiResult(result, expectedGeneration = generation) {
    // A response from an old/replaced session must never clear a newer session that was
    // installed while the request was in flight.
    if (expectedGeneration !== generation) return { error: "stale_session_response" };
    if (result?.error && SESSION_LIFECYCLE_ERRORS.has(result.error)) {
      void clear(result.error, true);
    }
    return result;
  }

  return {
    load,
    setSession,
    clear,
    getSession: () => current,
    getToken: () => current?.sessionToken || "",
    getPlayerId: () => current?.playerId || "",
    getGeneration: () => generation,
    handleApiResult,
    onInvalid(listener) {
      invalidListeners.add(listener);
      return () => invalidListeners.delete(listener);
    }
  };
}

const AUTH_SESSION = createAuthSessionStore();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { createAuthSessionStore, SESSION_LIFECYCLE_ERRORS };
}
