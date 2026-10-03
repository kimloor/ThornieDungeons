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
  const finishStart = app.indexOf("async function finishCoreBattle(next)");
  assert.ok(finishStart >= 0);
  const finishBody = app.slice(finishStart, app.indexOf("function driveCoreBattle", finishStart));

  const completeIndex = finishBody.indexOf("cloudCompleteBattle(");
  const presentIndex = finishBody.indexOf("await playTerminalBattlePresentation(next.result)");
  const resultIndex = finishBody.indexOf('setPhase("result")');

  assert.ok(completeIndex >= 0);
  assert.ok(presentIndex > completeIndex);
  assert.ok(resultIndex > presentIndex);
  assert.match(finishBody, /if \(!receipt\?\.ok\)[\s\S]*return;/);
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
