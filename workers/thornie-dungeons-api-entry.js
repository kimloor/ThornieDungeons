import worker from "./thornie-dungeons-api.js";

const COMPLETE_BATTLE_RETRY_DELAYS_MS = [80, 180, 360];
const MAX_REQUEST_BODY_BYTES = 512 * 1024;

function createD1CountingBinding(db) {
  let calls = 0;
  const wrapStatement = statement => new Proxy(statement, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (["first", "run", "all"].includes(property) && typeof value === "function") {
        return (...args) => {
          calls += 1;
          return value.apply(target, args);
        };
      }
      if (property === "bind" && typeof value === "function") {
        return (...args) => wrapStatement(value.apply(target, args));
      }
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  const binding = new Proxy(db, {
    get(target, property, receiver) {
      if (property === "__d1RoundTrips") return () => calls;
      if (property === "prepare") return (...args) => wrapStatement(target.prepare(...args));
      if (property === "batch") return async (...args) => {
        calls += 1;
        return target.batch(...args);
      };
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
  return { binding, getCount: () => calls };
}

function corsOriginAllowed(request, env) {
  const defaults = [
    "https://thorniedungeons.ekqtjl.workers.dev",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ];
  const configured = String(env?.CORS_ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
  const origin = request.headers.get("Origin");
  return !origin || new Set([...defaults, ...configured]).has(origin);
}

async function withD1Timing(request, env, ctx, handler) {
  const startedAt = Date.now();
  const { binding, getCount } = createD1CountingBinding(env.DB);
  const wrappedEnv = { ...env, DB: binding };
  const response = await handler(request, wrappedEnv, ctx);
  const headers = new Headers(response.headers);
  headers.set("Server-Timing", `d1;desc="${getCount()} calls", app;dur=${Math.max(0, Date.now() - startedAt)}`);
  if (corsOriginAllowed(request, env)) headers.set("Access-Control-Expose-Headers", "Server-Timing");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

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

  // The deployed entrypoint performs a completion retry inspection before the
  // core router. Enforce the same boundary here so oversized bodies never reach
  // JSON parsing or retry orchestration.
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) return worker.fetch(request, env, ctx);
  if (request.body) {
    const bytes = await request.clone().arrayBuffer();
    if (bytes.byteLength > MAX_REQUEST_BODY_BYTES) return worker.fetch(request, env, ctx);
  }

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
  async fetch(request, env, ctx) {
    return withD1Timing(request, env, ctx, fetchWithBattleCompletionRaceGuard);
  },
  scheduled(event, env, ctx) {
    if (typeof worker.scheduled === "function") return worker.scheduled(event, env, ctx);
  },
};

export { createD1CountingBinding };
