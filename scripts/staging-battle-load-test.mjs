#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const STAGING_ORIGIN = "https://thornie-dungeons-api-staging.ekqtjl.workers.dev";
const ALLOWED_HOST = "thornie-dungeons-api-staging.ekqtjl.workers.dev";
const PRODUCTION_HOSTS = new Set([
  "thornie-dungeons-api.ekqtjl.workers.dev",
  "thorniedungeons.ekqtjl.workers.dev"
]);

export function validateTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("invalid_target_url"); }
  if (url.protocol !== "https:") throw new Error("https_required");
  if (url.username || url.password || url.search || url.hash || !["", "/"].includes(url.pathname)) throw new Error("target_url_not_allowed");
  if (PRODUCTION_HOSTS.has(url.hostname)) throw new Error("production_target_forbidden");
  if (url.hostname !== ALLOWED_HOST) throw new Error("host_not_allowlisted");
  return url.origin;
}

export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.max(0, Math.ceil(p / 100 * sorted.length) - 1)].toFixed(2));
}

export function summarize(samples) {
  const times = samples.map(x => x.ms).filter(Number.isFinite);
  const errors = samples.filter(x => !x.ok).length;
  return {
    requests: samples.length,
    errors,
    errorRatePct: samples.length ? Number((errors / samples.length * 100).toFixed(4)) : 0,
    latencyMs: { p50: percentile(times, 50), p95: percentile(times, 95), p99: percentile(times, 99) },
    statuses: Object.fromEntries([...new Set(samples.map(x => x.status))].map(s => [s, samples.filter(x => x.status === s).length]))
  };
}

async function post(origin, body, token) {
  const response = await fetch(origin, {
    method: "POST",
    redirect: "error",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const payload = await response.json();
  return { ok: response.ok && payload.ok !== false, status: response.status, payload };
}

function credentials(raw, count) {
  let list;
  try { list = JSON.parse(raw || ""); } catch { throw new Error("test_accounts_json_invalid"); }
  if (!Array.isArray(list) || list.length < count) throw new Error("insufficient_precreated_test_accounts");
  const ids = new Set();
  for (const item of list.slice(0, count)) {
    if (!item?.playerId || !item?.password || !item?.characterId) throw new Error("account_requires_playerId_password_characterId");
    const key = item.playerId + ":" + item.characterId;
    if (ids.has(key)) throw new Error("duplicate_test_identity");
    ids.add(key);
  }
  return list.slice(0, count);
}

async function playerRun(account, index, origin, floor, intervalMs, samples) {
  const timed = async (name, fn) => {
    const start = performance.now();
    try {
      const result = await fn();
      samples.push({ action: name, ok: result.ok, status: result.status, ms: performance.now() - start });
      return result;
    } catch (error) {
      samples.push({ action: name, ok: false, status: 0, ms: performance.now() - start });
      throw error;
    }
  };
  const login = await timed("login", () => post(origin, { action: "login", id: account.playerId, password: account.password, rememberLogin: false }));
  if (!login.ok) throw new Error("login_failed_" + login.status);
  const token = login.payload.sessionToken || login.payload.token;
  if (!token) throw new Error("login_token_missing");
  const character = (login.payload.characters || []).find(c => String(c.character_id || c.characterId) === account.characterId);
  if (!character) throw new Error("configured_character_missing");
  if (Number(character.unlocked_floor || 1) < floor) throw new Error("floor_locked");

  const started = await timed("startDungeonBattle", () => post(origin, { action: "startDungeonBattle", characterId: account.characterId, floor }, token));
  if (!started.ok || !started.payload.state || !started.payload.battleId) throw new Error("battle_start_failed_" + started.status);
  let state = started.payload.state;
  let revision = Number(started.payload.stateRev ?? state.authorityRev ?? 0);
  let count = 0;
  while (!state.result && count < 400) {
    const actor = globalThis.BATTLE_CORE_V1.currentUnit(state);
    if (!actor) throw new Error("battle_actor_missing");
    const command = actor.kind === "hero"
      ? { type: "basic", ...(state.selectedTargetId ? { targetId: state.selectedTargetId } : {}) }
      : { type: "advance" };
    const action = await timed("submitDungeonBattleAction", () => post(origin, {
      action: "submitDungeonBattleAction", characterId: account.characterId, battleId: started.payload.battleId,
      actionKey: `stgload-${index}-${Date.now().toString(36)}-${count}`, expectedRev: revision, command
    }, token));
    if (!action.ok) throw new Error("battle_action_failed_" + action.status);
    state = action.payload.state || action.payload.result?.state;
    if (!state) throw new Error("battle_state_missing");
    revision = Number(action.payload.stateRev ?? action.payload.authorityRev ?? state.authorityRev ?? revision + 1);
    count++;
    if (intervalMs) await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  if (!state.result) throw new Error("battle_action_limit_reached");
  const completed = await timed("completeBattle", () => post(origin, {
    action: "completeBattle", characterId: account.characterId, battleId: started.payload.battleId, result: { result: state.result }
  }, token));
  if (!completed.ok) throw new Error("battle_completion_failed_" + completed.status);
  return { virtualPlayer: index + 1, actions: count, outcome: state.result };
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const origin = validateTarget(env.STAGING_API_URL || STAGING_ORIGIN);
  const concurrency = Number(env.CONCURRENCY || 1);
  const floor = Number(env.FLOOR || 1);
  const intervalMs = Number(env.ACTION_INTERVAL_MS ?? 750);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100) throw new Error("concurrency_out_of_range");
  if (!Number.isInteger(floor) || floor < 1) throw new Error("floor_invalid");
  if (!Number.isInteger(intervalMs) || intervalMs < 0 || intervalMs > 30000) throw new Error("interval_out_of_range");
  if (!args.includes("--execute")) return { mode: "dry-run", target: origin, concurrency, floor, intervalMs, networkRequests: 0 };
  if (!args.includes("--confirm-staging-load") || env.ALLOW_STAGING_LOAD_TEST !== "YES" || env.NODE_ENV === "production") throw new Error("explicit_staging_confirmation_required");
  const accounts = credentials(env.STAGING_BATTLE_TEST_ACCOUNTS, concurrency);
  const { createRequire } = await import("node:module");
  createRequire(import.meta.url)("../src/systems/battleCore.js");
  const samples = [];
  let next = 0;
  const results = [];
  const run = async () => {
    while (next < accounts.length) {
      const index = next++;
      try { results[index] = await playerRun(accounts[index], index, origin, floor, intervalMs, samples); }
      catch { results[index] = { virtualPlayer: index + 1, error: "player_run_failed" }; }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, run));
  return {
    generatedAt: new Date().toISOString(), target: origin, concurrency, floor, intervalMs,
    metrics: summarize(samples), players: results,
    integrity: "D1 receipt/reward verification requires separate read-only Staging inspection"
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(report => process.stdout.write(JSON.stringify(report, null, 2) + "\n"))
    .catch(error => { process.stderr.write("staging-load-harness: " + error.message + "\n"); process.exitCode = 1; });
}
