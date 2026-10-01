const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");

function loadItemIconResolver() {
  const source = read("src/assets/manifest.js");
  const start = source.indexOf("function resolveItemIconPath");
  const end = source.indexOf("\nfunction resolveUiIconPath", start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(`let ASSETS = { itemIcons: {
    materials: {
      bossHorn: "materials/boss_horn.png",
      bossHide: "materials/boss_hide.png",
      protectionStone: "materials/protection_stone.png"
    },
    recipes: {
      azure: "recipes/recipe_azure.png",
      robot: "recipes/recipe_robot.png",
      skeleton: "recipes/recipe_skeleton.png"
    },
    wings: {
      angel: "wings/angel_wings.png",
      azure: "wings/azure_wings.png",
      robot: "wings/robot_wings.png",
      skeleton: "wings/skeleton_wings.png"
    }
  }};\n${source.slice(start, end)}\nglobalThis.resolve = resolveItemIconPath;`, context);
  return context.resolve;
}

test("Batch 5 item icon resolver maps published materials, recipe families and explicit wing families", () => {
  const resolve = loadItemIconResolver();
  assert.equal(resolve({ type: "junk", junkId: "bossHorn" }), "materials/boss_horn.png");
  assert.equal(resolve({ type: "junk", junkId: "bossHide" }), "materials/boss_hide.png");
  assert.equal(resolve({ type: "junk", junkId: "protectionStone" }), "materials/protection_stone.png");
  assert.equal(resolve({ type: "junk", junkId: "recipe_azure_helmet" }), "recipes/recipe_azure.png");
  assert.equal(resolve({ type: "junk", junkId: "recipe_robot_weapon" }), "recipes/recipe_robot.png");
  assert.equal(resolve({ type: "junk", junkId: "recipe_skeleton_ring" }), "recipes/recipe_skeleton.png");
  assert.equal(resolve({ type: "wings", setId: "azure", star: 5 }), "wings/azure_wings.png");
  assert.equal(resolve({ type: "wings", wingId: "robot", star: 3 }), "wings/robot_wings.png");
  assert.equal(resolve({ type: "wings", wingsId: "skeleton", star: 2 }), "wings/skeleton_wings.png");
  assert.equal(resolve({ type: "wings", star: 5 }), "");
  assert.equal(resolve({ type: "junk", junkId: "recipe_unknown_helmet" }), "");
});

function loadTurnOrderAlive() {
  const source = read("src/ui/components.js");
  const start = source.indexOf("function turnOrderUnitAlive");
  const end = source.indexOf("\nfunction TurnOrderBar", start);
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source.slice(start, end)}\nglobalThis.resolve = turnOrderUnitAlive;`, context);
  return context.resolve;
}

test("Arena ATB visibility follows authoritative unit ids and alive state for both pets", () => {
  const alive = loadTurnOrderAlive();
  const queue = (id, kind) => ({ uid: id, kind });
  const units = {
    team_a_hero: { id: "team_a_hero", hp: 100, dead: false },
    team_a_pet: { id: "team_a_pet", hp: 80, dead: false },
    team_b_hero: { id: "team_b_hero", hp: 100, dead: false },
    team_b_pet: { id: "team_b_pet", hp: 70, dead: false }
  };
  assert.equal(alive(queue("team_a_pet", "pet"), units, [], null), true);
  assert.equal(alive(queue("team_b_pet", "pet"), units, [], null), true);

  const attackerNoPet = { team_a_hero: units.team_a_hero, team_b_hero: units.team_b_hero, team_b_pet: units.team_b_pet };
  assert.equal(alive(queue("team_b_pet", "pet"), attackerNoPet, [], null), true);

  const attackerPetDead = { ...units, team_a_pet: { ...units.team_a_pet, hp: 0, dead: true } };
  assert.equal(alive(queue("team_a_pet", "pet"), attackerPetDead, [], null), false);
  assert.equal(alive(queue("team_b_pet", "pet"), attackerPetDead, [], null), true);
  assert.equal(alive(queue("team_b_hero", "player"), { ...units, team_b_hero: { ...units.team_b_hero, hp: 0, dead: true } }, [], null), false);
});

test("Arena seq contract is narrow and initial Phaser snapshot establishes a no-replay baseline", () => {
  const worker = read("workers/thornie-dungeons-api.js");
  assert.match(worker, /pvpPublicLogEntry\(e, \{ includeSeq = false \} = \{\}\)/);
  assert.match(worker, /slice\(-40\)\.map\(\(entry\) => pvpPublicLogEntry\(entry, \{ includeSeq: true \}\)\)/);
  const scene = read("src/phaser/scenes/BattleScene.js");
  assert.match(scene, /const isFirstSnapshot = this\.lastArenaBattleId !== snapshot\.battleId/);
  assert.match(scene, /isFirstSnapshot \? \[\] : allCues/);
  assert.match(scene, /historical log on\s+\/\/ resume/);
});
