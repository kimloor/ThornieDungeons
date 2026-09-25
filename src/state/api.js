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
async function cloudPost(url, body, { retries = 0, baseDelayMs = 300, headers = {}, keepalive = false } = {}) {
  return withDedupe(dedupeKey(url, { body, headers, keepalive }), () => withRetry(async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        keepalive: !!keepalive
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
async function cloudAuthPost(url, body, options = {}) {
  const token = AUTH_SESSION.getToken();
  const generation = AUTH_SESSION.getGeneration();
  if (!token) return AUTH_SESSION.handleApiResult({ error: "invalid_session" }, generation);
  const result = await cloudPost(url, body, { ...options, headers: cloudAuthHeaders(token) });
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
function cloudGetBattleState(url, characterId) {
  return cloudAuthGet(url, { action: "getBattleState", characterId });
}
function cloudSaveBattleCheckpoint(url, characterId, battleId, checkpointSeq, payload) {
  return cloudAuthPost(url, { action: "saveBattleCheckpoint", characterId, battleId, checkpointSeq, payload });
}
function cloudSaveBattleCheckpointOnClose(url, characterId, payload) {
  if (!payload?.battleId) return Promise.resolve({ error: "invalid_checkpoint" });
  return cloudAuthPost(url, {
    action: "saveBattleCheckpoint",
    characterId,
    battleId: payload.battleId,
    checkpointSeq: payload.safeActionSeq,
    payload
  }, { keepalive: true });
}
function cloudClearBattleCheckpoint(url, characterId, battleId) {
  return cloudAuthPost(url, { action: "clearBattleCheckpoint", characterId, battleId });
}
function cloudCompleteBattle(url, characterId, battleId, result) {
  return cloudAuthPost(url, { action: "completeBattle", characterId, battleId, result });
}
function cloudSaveQuickSlots(url, characterId, quickSlots) {
  return cloudAuthPost(url, { action: "saveQuickSlots", characterId, quickSlots });
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
  if (domain === "battle_checkpoint") {
    return cloudAuthPost(context.url, {
      action: "saveBattleCheckpoint",
      characterId: context.characterId,
      battleId: snapshot.battleId,
      checkpointSeq: snapshot.safeActionSeq,
      payload: snapshot
    });
  }
  if (domain === "quick_slots") {
    return cloudAuthPost(context.url, { action: "saveQuickSlots", characterId: context.characterId, quickSlots: snapshot });
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
// Phase 6.2 — Friend System V1. characterId is always the acting character; the target
// of an action (search result, request, existing friend/block) is identified by its own
// characterId/requestId param. See worker's Friend System V1 section for the
// authoritative logic (caps, cross-request handling, block side effects, etc).
function cloudSearchCharacters(url, characterId, query) {
  return cloudAuthGet(url, {
    action: "searchCharacters",
    characterId,
    query
  });
}
function cloudGetFriendList(url, characterId) {
  return cloudAuthGet(url, {
    action: "getFriendList",
    characterId
  });
}
function cloudGetFriendRequests(url, characterId) {
  return cloudAuthGet(url, {
    action: "getFriendRequests",
    characterId
  });
}
function cloudGetBlockedList(url, characterId) {
  return cloudAuthGet(url, {
    action: "getBlockedList",
    characterId
  });
}
function cloudSendFriendRequest(url, characterId, targetCharacterId) {
  return cloudAuthPost(url, {
    action: "sendFriendRequest",
    characterId,
    targetCharacterId
  });
}
function cloudAcceptFriendRequest(url, characterId, requestId) {
  return cloudAuthPost(url, {
    action: "acceptFriendRequest",
    characterId,
    requestId
  });
}
function cloudRejectFriendRequest(url, characterId, requestId) {
  return cloudAuthPost(url, {
    action: "rejectFriendRequest",
    characterId,
    requestId
  });
}
function cloudCancelFriendRequest(url, characterId, requestId) {
  return cloudAuthPost(url, {
    action: "cancelFriendRequest",
    characterId,
    requestId
  });
}
function cloudRemoveFriend(url, characterId, targetCharacterId) {
  return cloudAuthPost(url, {
    action: "removeFriend",
    characterId,
    targetCharacterId
  });
}
function cloudBlockCharacter(url, characterId, targetCharacterId) {
  return cloudAuthPost(url, {
    action: "blockCharacter",
    characterId,
    targetCharacterId
  });
}
function cloudUnblockCharacter(url, characterId, targetCharacterId) {
  return cloudAuthPost(url, {
    action: "unblockCharacter",
    characterId,
    targetCharacterId
  });
}
// Phase 6.3 — Chat System V1 (Global + Direct). afterId is omitted/0 for the initial
// latest-~50 load, then the highest id already seen for incremental polling — see the
// worker's Chat System V1 section for the authoritative logic (caps, retention, etc).
function cloudGetGlobalChat(url, characterId, afterId) {
  return cloudAuthGet(url, {
    action: "getGlobalChat",
    characterId,
    afterId: afterId || 0
  });
}
function cloudSendGlobalMessage(url, characterId, text, nonce) {
  return cloudAuthPost(url, {
    action: "sendGlobalMessage",
    characterId,
    text,
    nonce
  });
}
function cloudGetGuildChat(url, characterId, afterId) {
  return cloudAuthGet(url, { action: "getGuildChat", characterId, afterId: afterId || 0 });
}
function cloudGetGuildChatStatus(url, characterId) {
  return cloudAuthGet(url, { action: "getGuildChatStatus", characterId });
}
function cloudSendGuildMessage(url, characterId, text, nonce) {
  return cloudAuthPost(url, { action: "sendGuildMessage", characterId, text, nonce });
}
function cloudMarkGuildChatRead(url, characterId) {
  return cloudAuthPost(url, { action: "markGuildChatRead", characterId });
}
function cloudGetDirectMessages(url, characterId, withCharacterId, afterId) {
  return cloudAuthGet(url, {
    action: "getDirectMessages",
    characterId,
    withCharacterId,
    afterId: afterId || 0
  });
}
function cloudSendDirectMessage(url, characterId, toCharacterId, text, nonce) {
  return cloudAuthPost(url, {
    action: "sendDirectMessage",
    characterId,
    toCharacterId,
    text,
    nonce
  });
}
function cloudGetDirectConversations(url, characterId) {
  return cloudAuthGet(url, {
    action: "getDirectConversations",
    characterId
  });
}
function cloudMarkConversationRead(url, characterId, withCharacterId) {
  return cloudAuthPost(url, {
    action: "markConversationRead",
    characterId,
    withCharacterId
  });
}
// Phase 6.4 — Guild System V1 Core. See the worker's Guild System V1 Core section for
// the authoritative logic (caps, join policy, succession, etc).
function cloudSearchGuilds(url, characterId, query) {
  return cloudAuthGet(url, {
    action: "searchGuilds",
    characterId,
    query
  });
}
function cloudGetMyGuild(url, characterId) {
  return cloudAuthGet(url, {
    action: "getMyGuild",
    characterId
  });
}
function cloudGetInventory(url, characterId, requestNonce) {
  return cloudAuthGet(url, {
    action: "getInventory",
    characterId,
    page: 1,
    pageSize: 200,
    ...(requestNonce ? { requestNonce } : {})
  });
}
function cloudDonateGuildItem(url, characterId, junkId, quantity, donationId) {
  return cloudAuthPost(url, { action: "donateGuildItem", characterId, junkId, quantity, donationId });
}
function cloudGetGuildProfile(url, characterId, guildId) {
  return cloudAuthGet(url, {
    action: "getGuildProfile",
    characterId,
    guildId
  });
}
function cloudGetMyApplications(url, characterId) {
  return cloudAuthGet(url, {
    action: "getMyApplications",
    characterId
  });
}
function cloudGetGuildApplications(url, characterId, guildId) {
  return cloudAuthGet(url, {
    action: "getGuildApplications",
    characterId,
    guildId
  });
}
function cloudCreateGuild(url, characterId, name, description) {
  return cloudAuthPost(url, {
    action: "createGuild",
    characterId,
    name,
    description
  });
}
function cloudRequestGuildJoin(url, characterId, guildId) {
  return cloudAuthPost(url, {
    action: "requestGuildJoin",
    characterId,
    guildId
  });
}
function cloudCancelGuildApplication(url, characterId, applicationId) {
  return cloudAuthPost(url, {
    action: "cancelGuildApplication",
    characterId,
    applicationId
  });
}
function cloudAcceptGuildApplication(url, characterId, applicationId) {
  return cloudAuthPost(url, {
    action: "acceptGuildApplication",
    characterId,
    applicationId
  });
}
function cloudRejectGuildApplication(url, characterId, applicationId) {
  return cloudAuthPost(url, {
    action: "rejectGuildApplication",
    characterId,
    applicationId
  });
}
function cloudLeaveGuild(url, characterId) {
  return cloudAuthPost(url, {
    action: "leaveGuild",
    characterId
  });
}
function cloudKickGuildMember(url, characterId, targetCharacterId) {
  return cloudAuthPost(url, {
    action: "kickGuildMember",
    characterId,
    targetCharacterId
  });
}
function cloudTransferGuildLeadership(url, characterId, targetCharacterId) {
  return cloudAuthPost(url, {
    action: "transferGuildLeadership",
    characterId,
    targetCharacterId
  });
}
function cloudDisbandGuild(url, characterId) {
  return cloudAuthPost(url, {
    action: "disbandGuild",
    characterId
  });
}
function cloudUpdateGuildSettings(url, characterId, description, joinPolicy) {
  return cloudAuthPost(url, {
    action: "updateGuildSettings",
    characterId,
    description,
    joinPolicy
  });
}
