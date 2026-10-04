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
    },
    azure: {
      weapon: "equipment/azure_sword.png",
      helmet: "equipment/azure_helmet.png",
      chest: "equipment/azure_armor.png",
      gloves: "equipment/azure_gauntlets.png",
      boots: "equipment/azure_boots.png",
      accessory: "equipment/azure_ring.png"
    },
    robot: {
      weapon: "equipment/robot_sword.png",
      helmet: "equipment/robot_helmet.png",
      chest: "equipment/robot_armor.png",
      gloves: "equipment/robot_gauntlets.png",
      boots: "equipment/robot_boots.png",
      accessory: "equipment/robot_ring.png"
    },
    skeleton: {
      weapon: "equipment/skeleton_sword.png",
      helmet: "equipment/skeleton_helmet.png",
      chest: "equipment/skeleton_armor.png",
      gloves: "equipment/skeleton_gauntlets.png",
      boots: "equipment/skeleton_boots.png",
      accessory: "equipment/skeleton_ring.png"
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
  const expectedNames = { weapon: "sword", helmet: "helmet", chest: "armor", gloves: "gauntlets", boots: "boots", accessory: "ring" };
  for (const family of ["azure", "robot", "skeleton"]) {
    for (const [slot, name] of Object.entries(expectedNames)) {
      assert.equal(resolve({ type: slot, setId: family.toUpperCase() }), `equipment/${family}_${name}.png`);
    }
  }
  assert.equal(resolve({ type: "wings", star: 5 }), "");
  assert.equal(resolve({ type: "junk", junkId: "recipe_unknown_helmet" }), "");
});

test("G10.5 + G11 manifest publishes all 18 set-slot icons within the equipment budget", () => {
  const manifest = JSON.parse(read("r2-upload/manifest.json"));
  const slots = ["weapon", "helmet", "chest", "gloves", "boots", "accessory"];
  for (const family of ["azure", "robot", "skeleton"]) {
    for (const slot of slots) {
      const value = manifest.assets.itemIcons[family][slot];
      const revision = family === "azure" && slot === "weapon" ? "r2" : "r1";
      assert.match(value, new RegExp(`^ui/equipment-icons/${family}/.+\\.png\\?v=g10_5_g11_${revision}$`));
      const file = path.join(ROOT, "r2-upload", value.split("?", 1)[0]);
      assert.ok(fs.existsSync(file), `${family}/${slot} production PNG exists`);
      assert.ok(fs.statSync(file).size <= 250000, `${family}/${slot} remains within the 250 KB hard limit`);
    }
  }
  assert.match(manifest.assets.itemIcons.wings.angel, /^ui\/equipment-icons\/wings\/angel_wings\.png\?v=g10_5_g11_r1$/);
  for (const key of ["arenaRank1", "arenaRank2", "arenaRank3"]) {
    assert.match(manifest.assets.profileFrames[key], /^ui\/profile-frames\/arena_rank_[123]\.png\?v=g10_5_g11_r1$/);
  }
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
