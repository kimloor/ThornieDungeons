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

async function cloudGet(url, params) {
  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${url}?${qs}`;
  return withDedupe(fullUrl, () => withRetry(async () => {
    try {
      const res = await fetch(fullUrl);
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
async function cloudPost(url, body, { retries = 0, baseDelayMs = 300 } = {}) {
  return withDedupe(dedupeKey(url, body), () => withRetry(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

// Central authenticated boundary for safe persistence snapshots. Auth V2 can replace the
// credential supplied by makePersistenceContext() without teaching UI/gameplay code about token
// fields. The current worker still receives the legacy id+password shape in this release.
function cloudSaveSnapshot(context, domain, snapshot) {
  if (!context || !context.credential) return Promise.resolve({ error: "missing_auth_context" });
  const auth = context.credential.kind === "session_token"
    ? { sessionToken: context.credential.sessionToken }
    : { id: context.accountId, password: context.credential.password };
  if (domain === "character_progress") {
    return cloudPost(context.url, {
      action: "saveCharacterProgress",
      ...auth,
      characterId: context.characterId,
      diamonds: snapshot.diamonds,
      progress: snapshot.progress
    });
  }
  if (domain === "items") {
    return cloudPost(context.url, {
      action: "syncItems",
      ...auth,
      characterId: context.characterId,
      items: snapshot
    });
  }
  if (domain === "run_state") {
    return cloudPost(context.url, {
      action: "saveRunState",
      ...auth,
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
function cloudGetRaidStatus(url, id, password, characterId) {
  return cloudGet(url, {
    action: "getRaidStatus",
    id,
    password,
    characterId
  });
}
function cloudAttackRaidBoss(url, id, password, characterId, paidDiamonds) {
  return cloudPost(url, {
    action: "attackRaidBoss",
    id,
    password,
    characterId,
    paidDiamonds: !!paidDiamonds
  });
}
function cloudClaimRaidMilestones(url, id, password, characterId) {
  return cloudPost(url, {
    action: "claimRaidMilestones",
    id,
    password,
    characterId
  });
}
// Phase 3.1 — Mailbox (reward delivery queue; client applies gold/diamonds/junk locally
// after claiming, then the normal autosave persists it — see worker comment for why).
function cloudGetMailbox(url, id, password, characterId) {
  return cloudGet(url, {
    action: "getMailbox",
    id,
    password,
    characterId
  });
}
function cloudClaimMail(url, id, password, characterId, mailId) {
  return cloudPost(url, {
    action: "claimMail",
    id,
    password,
    characterId,
    mailId
  });
}
function cloudClaimAllMail(url, id, password, characterId) {
  return cloudPost(url, {
    action: "claimAllMail",
    id,
    password,
    characterId
  });
}
function cloudDeleteMail(url, id, password, characterId, mailId) {
  return cloudPost(url, {
    action: "deleteMail",
    id,
    password,
    characterId,
    mailId
  });
}
function cloudDeleteMails(url, id, password, characterId, mailIds) {
  return cloudPost(url, {
    action: "deleteMails",
    id,
    password,
    characterId,
    mailIds
  });
}
function cloudDeleteAllClaimedMail(url, id, password, characterId) {
  return cloudPost(url, {
    action: "deleteAllClaimedMail",
    id,
    password,
    characterId
  });
}
// Phase 4 — Crafting. Server checks materials/gold against its own items/characters rows
// (never trusts the client), consumes them, and returns the crafted item as a plain
// descriptor — same shape as a mail item reward — for materializeMailItem() to turn into
// a real local item. See worker's handleCraftItem for the authoritative logic.
function cloudCraftItem(url, id, password, characterId, recipeId) {
  return cloudPost(url, {
    action: "craftItem",
    id,
    password,
    characterId,
    recipeId
  });
}
// Phase 5 — PvP Arena. Turn-based: startArenaMatch() opens a session, then
// submitArenaTurn() is called once per player action (attack or skill) — the worker
// resolves that whole round (both pets + the bot) and returns the updated state.
function cloudGetArenaStatus(url, id, password, characterId) {
  return cloudGet(url, {
    action: "getArenaStatus",
    id,
    password,
    characterId
  });
}
function cloudGetArenaOpponents(url, id, password, characterId) {
  return cloudGet(url, {
    action: "getArenaOpponents",
    id,
    password,
    characterId
  });
}
function cloudStartArenaMatch(url, id, password, characterId, opponentCharacterId, paidDiamonds) {
  return cloudPost(url, {
    action: "startArenaMatch",
    id,
    password,
    characterId,
    opponentCharacterId,
    paidDiamonds: !!paidDiamonds
  });
}
function cloudSubmitArenaTurn(url, id, password, characterId, matchId, actionType, skillKey) {
  return cloudPost(url, {
    action: "submitArenaTurn",
    id,
    password,
    characterId,
    matchId,
    actionType,
    skillKey
  });
}
