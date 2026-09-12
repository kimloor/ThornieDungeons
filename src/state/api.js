// ---------- HTTP helpers: retry + in-flight de-duplication ----------
// Reads are safe to retry. POSTs default to one attempt because this API also contains
// non-idempotent transactions (Craft/Raid/Arena/Mail); safe snapshot writes are retried by the
// persistence boundary instead, where account/character/domain ownership is known.
async function withRetry(fn, { retries = 2, baseDelayMs = 300 } = {}) {
  let lastResult;
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await fn();
    if (!isTransientApiResult(lastResult)) return lastResult;
    if (attempt < retries) {
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  return lastResult;
}

function isTransientApiResult(result) {
  return !!result && (result.error === "network_error" || result.error === "server_error" || Number(result.status) >= 500);
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

async function cloudGet(url, params, { headers = {} } = {}) {
  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${url}?${qs}`;
  return withDedupe(dedupeKey(fullUrl, headers), () => withRetry(async () => {
    try {
      const res = await fetch(fullUrl, { headers });
      const data = await res.json();
      if (res.status >= 500) return { ...data, error: data.error || "server_error", status: res.status };
      return data;
    } catch (e) {
      return {
        error: "network_error"
      };
    }
  }));
}
async function cloudPost(url, body, { retries = 0, baseDelayMs = 300, headers = {} } = {}) {
  return withDedupe(dedupeKey(url, { body, headers }), () => withRetry(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.status >= 500) return { ...data, error: data.error || "server_error", status: res.status };
      return data;
    } catch (e) {
      return {
        error: "network_error"
      };
    }
  }, { retries, baseDelayMs }));
}

// ---------- central player-session API boundary ----------
function cloudLogin(url, id, password, rememberLogin) {
  return cloudPost(url, {
    action: "login",
    id,
    password,
    rememberLogin: !!rememberLogin
  });
}
function cloudRegister(url, id, password, confirmPassword, rememberLogin) {
  return cloudPost(url, {
    action: "register",
    id,
    password,
    confirmPassword,
    rememberLogin: !!rememberLogin
  });
}
function cloudForgotPassword(url, id, recoveryCode, newPassword, confirmPassword) {
  return cloudPost(url, { action: "forgotPassword", id, recoveryCode, newPassword, confirmPassword });
}
function cloudAuthHeaders(token = AUTH_SESSION.getToken()) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function cloudAuthGet(url, params) {
  const token = AUTH_SESSION.getToken();
  const generation = AUTH_SESSION.getGeneration();
  if (!token) return AUTH_SESSION.handleApiResult({ error: "invalid_session" }, generation);
  const result = await cloudGet(url, params, { headers: cloudAuthHeaders(token) });
  return AUTH_SESSION.handleApiResult(result, generation);
}
async function cloudAuthPost(url, body) {
  const token = AUTH_SESSION.getToken();
  const generation = AUTH_SESSION.getGeneration();
  if (!token) return AUTH_SESSION.handleApiResult({ error: "invalid_session" }, generation);
  const result = await cloudPost(url, body, { headers: cloudAuthHeaders(token) });
  return AUTH_SESSION.handleApiResult(result, generation);
}
function cloudValidateSession(url) {
  return cloudAuthGet(url, { action: "validateSession" });
}
function cloudLogout(url) {
  return cloudAuthPost(url, { action: "logout" });
}
function cloudGetRecoveryStatus(url) {
  return cloudAuthGet(url, { action: "getRecoveryStatus" });
}
function cloudCreateRecoveryCode(url, currentPassword) {
  return cloudAuthPost(url, { action: "createRecoveryCode", currentPassword });
}
function cloudChangePassword(url, currentPassword, newPassword, confirmPassword) {
  return cloudAuthPost(url, { action: "changePassword", currentPassword, newPassword, confirmPassword });
}
function cloudCreateCharacter(url, slotIndex, name) {
  return cloudAuthPost(url, {
    action: "createCharacter",
    slotIndex,
    name
  });
}
function cloudDeleteCharacter(url, slotIndex) {
  return cloudAuthPost(url, {
    action: "deleteCharacter",
    slotIndex
  });
}
function cloudEnterCharacter(url, slotIndex) {
  return cloudAuthPost(url, {
    action: "enterCharacter",
    slotIndex
  });
}
function cloudSaveCharacterProgress(url, characterId, diamonds, progress) {
  return cloudAuthPost(url, {
    action: "saveCharacterProgress",
    characterId,
    diamonds,
    progress
  });
}
function cloudSyncItems(url, characterId, items) {
  return cloudAuthPost(url, {
    action: "syncItems",
    characterId,
    items
  });
}
function cloudSaveRunState(url, characterId, runState) {
  return cloudAuthPost(url, {
    action: "saveRunState",
    characterId,
    runState
  });
}

// Central authenticated boundary for safe persistence snapshots. The persistence context owns
// only a session generation; the raw token remains inside AUTH_SESSION and is never copied into
// gameplay state or snapshot payloads.
function cloudSaveSnapshot(context, domain, snapshot) {
  if (!context || context.sessionGeneration !== AUTH_SESSION.getGeneration()) return Promise.resolve({ error: "invalid_session" });
  if (domain === "character_progress") {
    return cloudAuthPost(context.url, {
      action: "saveCharacterProgress",
      characterId: context.characterId,
      diamonds: snapshot.diamonds,
      progress: snapshot.progress
    });
  }
  if (domain === "items") {
    return cloudAuthPost(context.url, {
      action: "syncItems",
      characterId: context.characterId,
      items: snapshot
    });
  }
  if (domain === "run_state") {
    return cloudAuthPost(context.url, {
      action: "saveRunState",
      characterId: context.characterId,
      runState: snapshot
    });
  }
  return Promise.resolve({ error: "unknown_persistence_domain" });
}
function cloudGetConfig(url) {
  return cloudGet(url, {
    action: "getGameConfig"
  });
}
// Phase 4 refactor — recipes now live purely in D1 (see handleGetRecipes on the worker),
// fetched on load same as getGameConfig, so new crafted sets go live via a D1 insert alone.
function cloudGetRecipes(url) {
  return cloudGet(url, {
    action: "getRecipes"
  });
}
// Per-monster loot tables — same public/cached/fetch-on-load shape as getRecipes.
function cloudGetMonsterLoot(url) {
  return cloudGet(url, {
    action: "getMonsterLoot"
  });
}
function cloudGetJunkInfo(url) {
  return cloudGet(url, {
    action: "getJunkInfo"
  });
}
function cloudGetDailyLogin(url, characterId) {
  return cloudAuthGet(url, {
    action: "getDailyLogin",
    characterId
  });
}
function cloudClaimDailyLogin(url, characterId) {
  return cloudAuthPost(url, {
    action: "claimDailyLogin",
    characterId
  });
}
// Phase 2/3 — public, no auth needed (board is one of "floor" | "cp" | "pet_cp" | "raid").
function cloudGetLeaderboard(url, board) {
  return cloudGet(url, {
    action: "getLeaderboard",
    board
  });
}
// Phase 2.1 — up to the last 7 days; omit date for today.
function cloudGetLeaderboardHistory(url, board, date) {
  const params = { action: "getLeaderboardHistory", board };
  if (date) params.date = date;
  return cloudGet(url, params);
}
// Phase 3 — Raid Boss
function cloudGetRaidStatus(url, characterId) {
  return cloudAuthGet(url, {
    action: "getRaidStatus",
    characterId
  });
}
function cloudAttackRaidBoss(url, characterId, paidDiamonds) {
  return cloudAuthPost(url, {
    action: "attackRaidBoss",
    characterId,
    paidDiamonds: !!paidDiamonds
  });
}
function cloudClaimRaidMilestones(url, characterId) {
  return cloudAuthPost(url, {
    action: "claimRaidMilestones",
    characterId
  });
}
// Phase 3.1 — Mailbox (reward delivery queue; client applies gold/diamonds/junk locally
// after claiming, then the normal autosave persists it — see worker comment for why).
function cloudGetMailbox(url, characterId) {
  return cloudAuthGet(url, {
    action: "getMailbox",
    characterId
  });
}
function cloudClaimMail(url, characterId, mailId) {
  return cloudAuthPost(url, {
    action: "claimMail",
    characterId,
    mailId
  });
}
function cloudClaimAllMail(url, characterId) {
  return cloudAuthPost(url, {
    action: "claimAllMail",
    characterId
  });
}
function cloudDeleteMail(url, characterId, mailId) {
  return cloudAuthPost(url, {
    action: "deleteMail",
    characterId,
    mailId
  });
}
function cloudDeleteMails(url, characterId, mailIds) {
  return cloudAuthPost(url, {
    action: "deleteMails",
    characterId,
    mailIds
  });
}
function cloudDeleteAllClaimedMail(url, characterId) {
  return cloudAuthPost(url, {
    action: "deleteAllClaimedMail",
    characterId
  });
}
// Phase 4 — Crafting. Server checks materials/gold against its own items/characters rows
// (never trusts the client), consumes them, and returns the crafted item as a plain
// descriptor — same shape as a mail item reward — for materializeMailItem() to turn into
// a real local item. See worker's handleCraftItem for the authoritative logic.
function cloudCraftItem(url, characterId, recipeId) {
  return cloudAuthPost(url, {
    action: "craftItem",
    characterId,
    recipeId
  });
}
// Phase 5 — PvP Arena. Turn-based: startArenaMatch() opens a session, then
// submitArenaTurn() is called once per player action (attack or skill) — the worker
// resolves that whole round (both pets + the bot) and returns the updated state.
function cloudGetArenaStatus(url, characterId) {
  return cloudAuthGet(url, {
    action: "getArenaStatus",
    characterId
  });
}
function cloudGetArenaOpponents(url, characterId) {
  return cloudAuthGet(url, {
    action: "getArenaOpponents",
    characterId
  });
}
function cloudStartArenaMatch(url, characterId, opponentCharacterId, paidDiamonds) {
  return cloudAuthPost(url, {
    action: "startArenaMatch",
    characterId,
    opponentCharacterId,
    paidDiamonds: !!paidDiamonds
  });
}
function cloudSubmitArenaTurn(url, characterId, matchId, actionType, skillKey) {
  return cloudAuthPost(url, {
    action: "submitArenaTurn",
    characterId,
    matchId,
    actionType,
    skillKey
  });
}
