const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("src/phaser/scenes/BattleScene.js", "utf8");

test("Dungeon boss enrage presentation does not use the full-camera white flash", () => {
  const start = source.indexOf("const newlyEnraged");
  const end = source.indexOf("enqueueAnimations(animationJobs)", start);
  assert.ok(start >= 0 && end > start);
  const block = source.slice(start, end);
  assert.match(block, /cameras\?\.main\?\.shake/);
  assert.doesNotMatch(block, /cameras\?\.main\?\.flash/);
});
