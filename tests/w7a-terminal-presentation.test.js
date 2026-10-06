const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");
const host = fs.readFileSync(path.join(root, "src/phaser/runtime/BattlefieldHost.js"), "utf8");
const scene = fs.readFileSync(path.join(root, "src/phaser/scenes/BattleScene.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/phaser/ui/PhaserBattlefield.js"), "utf8");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");

test("W7A terminal presentation stays downstream of authoritative battle completion", () => {
  const finishStart = app.indexOf("async function finishCoreBattle(next, options = {})");
  assert.ok(finishStart >= 0);
  const finishBody = app.slice(finishStart, app.indexOf("function driveCoreBattle", finishStart));

  const completionStart = finishBody.indexOf("const completionPromise = commitBattleCompletionWithRetry(next)");
  const presentIndex = finishBody.indexOf("playTerminalBattlePresentation(next.result)");
  const resultIndex = finishBody.indexOf('setPhase("result")');

  assert.ok(completionStart >= 0);
  assert.ok(presentIndex > completionStart);
  assert.ok(presentIndex > completionStart);
  const finalizeStart = app.indexOf("async function finalizeTerminalOutcome");
  const finalizeEnd = app.indexOf("async function finishCoreBattle", finalizeStart);
  assert.ok(finalizeEnd > finalizeStart);
  assert.ok(app.slice(finalizeStart, finalizeEnd).indexOf('setPhase("result")') >= 0);
  assert.match(finishBody, /completionOutcome = await completionPromise/);
  assert.match(finishBody, /if \(!completionOutcome\.ok\)[\s\S]*return;/);
});

test("W7A terminal presentation has a non-authoritative timeout fallback", () => {
  assert.match(app, /Promise\.race\(\[/);
  assert.match(app, /controller\.presentTerminal\?\.\(result\)/);
  assert.match(app, /controller\.whenPresentationDrained\?\.\(\)/);
  assert.match(app, /setTimeout\(resolve, fallbackMs\)/);
  assert.match(app, /Presentation is non-authoritative/);
});

test("shared Phaser host exposes terminal queue and drain without gameplay authority", () => {
  assert.match(host, /function presentTerminal\(result\)/);
  assert.match(host, /scene\.presentTerminal\(result\)/);
  assert.match(host, /function whenPresentationDrained\(\)/);
  assert.match(host, /scene\.presentationQueue\.whenDrained\(\)/);

  assert.match(scene, /presentTerminal\(result\)/);
  assert.match(scene, /this\.presentationQueue\.enqueue/);
  assert.match(scene, /\["victory", "defeat"\]/);
  assert.match(scene, /cameras\?\.main\?\.flash/);
  assert.match(scene, /cameras\?\.main\?\.fade/);

  assert.match(ui, /props\.onPresentationController\?\.\(handle\)/);
  assert.match(ui, /props\.onPresentationController\?\.\(null\)/);
  assert.match(components, /onPresentationController: onPresentationController/);
});


test("W7A terminal action does not clear presentation synchronously and reset occurs only on exit", () => {
  const driveStart = app.indexOf("function driveCoreBattle");
  const driveBody = app.slice(driveStart, app.indexOf("function consumeBattlePotion", driveStart));
  const terminalCall = driveBody.indexOf('if (next.result) { finishCoreBattle(next, { actorKind: actor.kind }); return; }');
  assert.ok(terminalCall >= 0);
  const terminalBranch = driveBody.slice(terminalCall, terminalCall + 180);
  assert.equal(terminalBranch.includes('setHeroAnim("");'), false);
  assert.equal(terminalBranch.includes('setPetAnim("");'), false);
  assert.equal(terminalBranch.includes("setEnemyAnims({});"), false);
  assert.equal(terminalBranch.includes("setBattleVfx([]);"), false);
  const finalize = app.slice(app.indexOf("async function finalizeTerminalOutcome"), app.indexOf("async function finishCoreBattle"));
  assert.ok(finalize.indexOf("resetTerminalPresentation();") >= 0);
});

test("W7A confirmation pill is hidden during presentation and retry reuses the same battleId", () => {
  assert.match(components, /battleFinishing && battleFinishStatus === "confirming"/);
  assert.equal(
    components.includes('battleFinishing && /*#__PURE__*/React.createElement("div", {\n    className: "md-battle-finishing"'),
    false
  );
  assert.match(app, /finishCoreBattle\(next, \{ retry: true \}\)/);
  assert.match(app, /terminalFinishRef\.current\?\.next\?\.battleId !== next\.battleId/);
  assert.match(app, /const completionError = classifyBattleCompletionError/);
  assert.match(app, /ยืนยันผลการต่อสู้ไม่ได้/);
});

test("W7A replay result preserves stored gold/xp and labels it as already applied", () => {
  assert.match(app, /firstCompletion === false/);
  assert.match(app, /storedReward && Number\.isFinite\(Number\(storedReward\.gold\)\)/);
  assert.match(app, /alreadyApplied: true/);
  assert.match(components, /บันทึกไว้แล้ว/);
});
