const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const scene = fs.readFileSync(path.join(root, "src/phaser/scenes/BattleScene.js"), "utf8");
const host = fs.readFileSync(path.join(root, "src/phaser/runtime/BattlefieldHost.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/phaser/ui/PhaserBattlefield.js"), "utf8");

test("W7B Enhance presentation consumes server-confirmed mutation result", () => {
  assert.match(app, /const result = res\.mutation \|\| \{\}/);
  assert.match(app, /ตีบวกสำเร็จ![^\n]*result \}/);
  assert.match(components, /if \(res\?\.result\)/);
  assert.match(components, /setEnhancePresentation\(current => \(\{ token: current\.token \+ 1, result: res\.result \}\)\)/);
});

test("W7B Enhance presentation does not re-resolve RNG, costs, downgrade or protection", () => {
  const enhanceStart = scene.indexOf("function createEnhancePresentationScene");
  assert.ok(enhanceStart >= 0);
  const enhanceScene = scene.slice(enhanceStart);
  assert.doesNotMatch(enhanceScene, /enhanceSuccessRate|resolveEnhanceAttempt|secureRandom|Math\.random|goldCost|iron|manaOre/i);
  assert.doesNotMatch(enhanceScene, /protectionConsumed\s*=|downgraded\s*=/);
  assert.match(enhanceScene, /result\.protectionConsumed === true/);
  assert.match(enhanceScene, /result\.downgraded === true/);
});

test("W7B Enhance scene uses shared presentation queue and VFX boundary", () => {
  assert.match(scene, /function createEnhancePresentationScene/);
  assert.match(scene, /this\.presentationQueue = createPresentationQueue/);
  assert.match(scene, /this\.vfxManager = createVfxManager\(this\)/);
  assert.match(scene, /this\.presentationQueue\.enqueue/);
  assert.match(host, /function createEnhancePresentationHost/);
  assert.match(ui, /function PhaserEnhanceResult/);
});

test("Blacksmith retains DOM fallback until Enhance Phaser presentation is ready", () => {
  assert.match(components, /enhancePhaserStatus !== "ready"/);
  assert.match(components, /md-blacksmith-icon/);
  assert.match(components, /onStatus: status => setEnhancePhaserStatus\(status\)/);
});

test("Enhance presentation token advances only after an authoritative result exists", () => {
  const enhanceStart = components.indexOf("const doEnhance = async");
  const empowerStart = components.indexOf("const doEmpower", enhanceStart);
  const block = components.slice(enhanceStart, empowerStart);
  const resultGuard = block.indexOf("if (res?.result)");
  const tokenUpdate = block.indexOf("setEnhancePresentation");
  assert.ok(resultGuard >= 0);
  assert.ok(tokenUpdate > resultGuard);
});
