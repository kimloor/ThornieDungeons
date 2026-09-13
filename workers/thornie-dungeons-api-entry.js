import worker from "./thornie-dungeons-api.js";

const COMPLETE_BATTLE_RETRY_DELAYS_MS = [80, 180, 360];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeBattleLog(event, detail) {
  const payload = {
    event,
    action: "completeBattle",
    battleId: detail?.battleId || null,
    characterId: detail?.characterId || null,
    safeActionSeq: Number(detail?.safeActionSeq) || 0,
    attempt: Number(detail?.attempt) || 0,
    status: Number(detail?.status) || 0,
    error: detail?.error || null,
    durationMs: Number(detail?.durationMs) || 0,
  };
  console.warn(`[battle-sync] ${JSON.stringify(payload)}`);
}

async function fetchWithBattleCompletionRaceGuard(request, env, ctx) {
  if (request.method !== "POST") return worker.fetch(request, env, ctx);

  let body;
  try {
    body = await request.clone().json();
  } catch (_) {
    return worker.fetch(request, env, ctx);
  }

  if (body?.action !== "completeBattle") return worker.fetch(request, env, ctx);

  const startedAt = Date.now();
  const detail = {
    battleId: String(body.battleId || ""),
    characterId: String(body.characterId || ""),
    safeActionSeq: body?.result?.safeActionSeq,
  };

  for (let attempt = 0; attempt <= COMPLETE_BATTLE_RETRY_DELAYS_MS.length; attempt++) {
    const response = await worker.fetch(request.clone(), env, ctx);
    if (response.status !== 409) {
      if (attempt > 0) {
        safeBattleLog("completion_recovered", {
          ...detail,
          attempt: attempt + 1,
          status: response.status,
          durationMs: Date.now() - startedAt,
        });
      }
      return response;
    }

    let data = null;
    try {
      data = await response.clone().json();
    } catch (_) {}

    if (data?.error !== "battle_checkpoint_missing") {
      safeBattleLog("completion_conflict", {
        ...detail,
        attempt: attempt + 1,
        status: response.status,
        error: data?.error || "unknown_conflict",
        durationMs: Date.now() - startedAt,
      });
      return response;
    }

    if (attempt >= COMPLETE_BATTLE_RETRY_DELAYS_MS.length) {
      safeBattleLog("checkpoint_missing_final", {
        ...detail,
        attempt: attempt + 1,
        status: response.status,
        error: data.error,
        durationMs: Date.now() - startedAt,
      });
      return response;
    }

    safeBattleLog("checkpoint_not_ready", {
      ...detail,
      attempt: attempt + 1,
      status: response.status,
      error: data.error,
      durationMs: Date.now() - startedAt,
    });
    await sleep(COMPLETE_BATTLE_RETRY_DELAYS_MS[attempt]);
  }

  return worker.fetch(request, env, ctx);
}

export default {
  fetch: fetchWithBattleCompletionRaceGuard,
  scheduled(event, env, ctx) {
    if (typeof worker.scheduled === "function") return worker.scheduled(event, env, ctx);
  },
};
