const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const model = fs.readFileSync(path.join(root, "src/phaser/presentation/ActorPresentationModel.js"), "utf8");
const scene = fs.readFileSync(path.join(root, "src/phaser/scenes/BattleScene.js"), "utf8");
const dungeon = fs.readFileSync(path.join(root, "src/systems/dungeonV2.js"), "utf8");

test("W7A boss presentation consumes authoritative enrage state only", () => {
  assert.match(dungeon, /unit\.flags\.dungeonV2Enraged = true/);
  assert.match(model, /enraged:\s*!!\(unit\.flags\?\.dungeonV2Enraged/);
  assert.doesNotMatch(scene, /hp\s*[<>=]+\s*.*0\.5/);
  assert.doesNotMatch(scene, /dungeonV2Enraged\s*=/);
});

test("W7A boss entrance runs only for a fresh first snapshot", () => {
  assert.match(scene, /isFirstDungeonSnapshot/);
  assert.match(scene, /Number\(snapshot\.seq\) <= 0/);
  assert.match(scene, /entry\.monster\?\.kind === "boss" \|\| entry\.monster\?\.isBoss/);
  assert.match(scene, /lastDungeonBattleId/);
});

test("W7A enrage cue is edge-triggered and not replayed from resume baseline", () => {
  assert.match(scene, /lastDungeonEnrageByActor/);
  assert.match(scene, /const previous = this\.lastDungeonEnrageByActor\.get\(key\) === true/);
  assert.match(scene, /if \(!previous && current\) newlyEnraged\.push\(actor\)/);
  assert.match(scene, /this\.lastDungeonEnrageByActor\.set\(key, current\)/);
});

test("W7A boss/enrage effects are presentation-only queue work", () => {
  assert.match(scene, /enqueueDungeonPresentationCues/);
  assert.match(scene, /this\.presentationQueue\.enqueue/);
  assert.match(scene, /cameras\?\.main\?\.shake/);
  assert.match(scene, /cameras\?\.main\?\.flash/);
  assert.match(scene, /actor\.setVisualAlpha/);
});
