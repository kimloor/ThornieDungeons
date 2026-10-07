const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const battleScene = fs.readFileSync(path.join(ROOT, "src/phaser/scenes/BattleScene.js"), "utf8");
const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");

test("Dungeon Boss Enrage uses actor-only presentation without camera flash/shake", () => {
  const start = battleScene.indexOf("const newlyEnraged = [];");
  const end = battleScene.indexOf("enqueueAnimations(animationJobs)", start);
  const cue = battleScene.slice(start, end);
  assert.doesNotMatch(cue, /cameras\?\.main\?\.flash/);
  assert.doesNotMatch(cue, /cameras\?\.main\?\.shake/);
  assert.match(cue, /actor\.visualRoot/);
});

test("Inventory item detail/compare fits the mobile viewport without an internal scroll", () => {
  assert.match(styles, /\.md-inv2-detail-layer \{[\s\S]*align-items:center;/);
  assert.match(styles, /\.md-inv2-detail-layer \.md-inv2-detail \{[\s\S]*max-height:calc\(100dvh - 16px/);
  assert.match(styles, /\.md-inv2-detail-layer \.md-inv2-detail \{[\s\S]*overflow:hidden;/);
  assert.match(styles, /\.md-inv2-stat-list \{[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /\.md-inv2-compare-row \{[\s\S]*min-height:24px/);
  assert.match(styles, /content: "Ver 1\.0\.52";/);
});
