import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/ui/App.js","utf8");
const components = fs.readFileSync("src/ui/components.js","utf8");

function sliceFn(source, name, next) {
  const start = source.indexOf(name);
  const end = source.indexOf(next, start);
  assert.ok(start >= 0, name);
  return source.slice(start, end >= 0 ? end : source.length);
}

test("terminal action keeps animation/VFX state until finalization", () => {
  const fn = sliceFn(app, "async function finishCoreBattle", "function driveCoreBattle");
  assert.match(fn, /const completionPromise = commitBattleCompletionWithRetry\(next\)/);
  assert.ok(fn.indexOf("const completionPromise = commitBattleCompletionWithRetry(next)") < fn.indexOf("playTerminalBattlePresentation(next.result)"));
  const beforeFinalize = fn.slice(0, fn.indexOf("async function finalizeTerminalOutcome"));
  assert.doesNotMatch(beforeFinalize, /setHeroAnim\("")/);
  assert.doesNotMatch(beforeFinalize, /setPetAnim\("")/);
  assert.doesNotMatch(beforeFinalize, /setEnemyAnims\(\{\}\)/);
  assert.doesNotMatch(beforeFinalize, /setBattleVfx\(\[\]\)/);
});

test("terminal flow starts server confirmation in parallel and caps presentation hold", () => {
  assert.match(app, /actionHoldMs: Math\.min\(1800, Math\.round\(\(actorKind === "hero" \? 420 : 520\) \/ speed\)\)/);
  assert.match(app, /totalHoldCapMs: Math\.max\(500, Math\.round\(1800 \/ speed\)\)/);
  assert.match(app, /Promise\.all\(\[\s*new Promise\(resolve => setTimeout\(resolve, plan\.actionHoldMs\)\),\s*playTerminalBattlePresentation/);
});

test("completion failure keeps terminal scene and exposes Thai retry without re-running animation", () => {
  assert.match(app, /ยืนยันผลไม่สำเร็จ ผลการต่อสู้ยังไม่หาย/);
  assert.match(app, /function retryTerminalBattle\(\)/);
  assert.match(app, /finishCoreBattle\(next, \{ retry: true \}\)/);
  assert.match(app, /if \(plan\.retry\)[\s\S]*setBattleFinishStatus\("confirming"\)/);
  assert.match(components, /battleFinishStatus === "error"/);
  assert.match(components, /onRetryBattle/);
  assert.match(components, /ลองใหม่/);
});

test("double finish is locked by battleId and retry reuses the same battleId", () => {
  assert.match(app, /if \(!plan\.retry && finishingBattleIdRef\.current === next\.battleId\) return/);
  assert.match(app, /terminalFinishRef\.current = \{ next \}/);
  assert.match(app, /terminalFinishRef\.current\?\.next\?\.battleId !== next\.battleId/);
});

test("skip battle intentionally bypasses terminal presentation", () => {
  assert.match(app, /finishCoreBattle\(resolved, \{ skip: true \}\)/);
  assert.match(app, /runPresentation: !retry && !skip/);
});

test("replay path displays stored server gold/xp when available and labels old receipts", () => {
  assert.match(app, /const hasGold = storedReward && Number\.isFinite\(Number\(storedReward\.gold\)\)/);
  assert.match(app, /gold: hasGold \? Number\(storedReward\.gold\) : null/);
  assert.match(app, /xp: hasXp \? Number\(storedReward\.xp\) : null/);
  assert.match(components, /rewards\.alreadyApplied/);
  assert.match(components, /บันทึกไว้แล้ว/);
});

test("x2 speed uses scaled action hold and cap", () => {
  assert.match(app, /const speed = Math\.max\(1, Number\(combatSpeed\) \|\| 1\)/);
  assert.match(app, /\/ speed/);
});
