// ---------- HTTP helpers: retry + in-flight de-duplication ----------
// Any transient network hiccup here previously just resolved to {error:"network_error"} and got
// silently swallowed by the caller's write queue — with no retry, a single dropped packet during
// a burst of Salvage/Enhance clicks permanently desyncs the client from the server. withRetry()
// gives transient failures a couple of quick chances to recover before giving up for real.
// IMPORTANT: only "network_error" (thrown fetch/parse failures) is retried. Definitive
// server responses — wrong password, no_stamina, stamina_conflict, boss_already_dead, etc.
// — are real answers, not transient failures, and used to get retried too: that added up to
// ~900ms of pure wasted waiting (300ms + 600ms backoff) before the user ever saw the error,
// which felt worst exactly when double-tapping the Raid attack button.
async function withRetry(fn, { retries = 2, baseDelayMs = 300 } = {}) {
  let lastResult;
  for (let attempt = 0; attempt <= retries; attempt++) {
    lastResult = await fn();
    if (!lastResult || lastResult.error !== "network_error") return lastResult;
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
