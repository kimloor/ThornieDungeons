const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { loadWorkerSource } = require("./helpers/worker-source");

global.DUNGEON_REWARD_V2 = require("../src/systems/rewardV2.js");
global.ENHANCEMENT_V2 = require("../src/systems/enhancementV2.js");
global.HERO_SKILLS_V1_BY_ID = require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1_BY_ID;
global.PET_COMBAT_SKILLS_V2 = require("../src/systems/pets.js").PET_COMBAT_SKILLS_V2;
const mythic = require("../src/systems/mythicV2.js");
const battle = require("../src/systems/battleCore.js");

const hero = (extra = {}) => ({ id: "hero", kind: "hero", side: "ally", name: "Hero", hp: 200, maxHp: 200, sp: 100, maxSp: 100, atk: 45, def: 8, speed: 200, accuracy: 99, dodge: 0, crit: 0, critDamage: 1.5, activeSkills: [], skills: {}, ...extra });
const enemy = (extra = {}) => ({ id: "enemy", kind: "monster", side: "enemy", name: "Enemy", hp: 1000, maxHp: 1000, atk: 40, def: 3, speed: 50, accuracy: 99, dodge: 0, crit: 0, ...extra });
const setPiece = (setId, type) => ({ setId, type, rarity: "mythic", itemModelVersion: 2 });

test("W4 canonical Boss Weapons share Tier budget and preserve exact identities", () => {
  const ids = ["spirit_greatsword", "lavalon_sword", "icicle_longsword"];
  const items = ids.map(id => mythic.createMythicItem(mythic.bossWeaponRecipe(id, 20), 20, () => 0));
  assert.deepEqual(items.map(item => item.name), ["Spirit Greatsword", "Lavalon Sword", "Icicle Longsword"]);
  assert.deepEqual(items.map(item => item.atk), [21, 21, 21]);
  assert.ok(items.every(item => item.rarity === "mythic" && item.gearTier === 1 && item.empowerSlotCapacity === 4));
  assert.deepEqual(items.map(item => item.signatureId), ["spirit_restore", "lavalon_extra_basic", "icicle_counter"]);
});

test("W4 Boss Weapon and set crafting costs follow locked Tier economy", () => {
  assert.deepEqual(mythic.bossWeaponRecipe("spirit_greatsword", 10).materials, { earthStone: 5, gold: 2500 });
  assert.deepEqual(mythic.bossWeaponRecipe("lavalon_sword", 91).materials, { fireStone: 5, gold: 22500 });
  assert.deepEqual(mythic.setRecipe("robot", "weapon", 31).materials, { recipe_robot_weapon: 1, bossHorn: 8, bossHide: 8, gold: 1125 });
  assert.equal(mythic.allRecipes(1).length, 21);
});

test("Earth Fire Water Stone mapping is canonical", () => {
  assert.equal(mythic.bossStoneForEnemy("moss_king").junkId, "earthStone");
  assert.equal(mythic.bossStoneForEnemy("ember_drake").junkId, "fireStone");
  assert.equal(mythic.bossStoneForEnemy("frost_warden").junkId, "waterStone");
});

test("set detection is metadata-based, cumulative, mixed, and excludes Wings", () => {
  const equipped = {
    weapon: setPiece("azure", "weapon"), helmet: setPiece("azure", "helmet"),
    chest: setPiece("robot", "chest"), gloves: setPiece("robot", "gloves"),
    boots: setPiece("skeleton", "boots"), accessory: setPiece("skeleton", "accessory"),
    wings: setPiece("azure", "wings")
  };
  assert.deepEqual(mythic.setCounts(equipped), { azure: 2, robot: 2, skeleton: 2 });
  assert.deepEqual({ agi: mythic.setEffects(equipped).agi, vit: mythic.setEffects(equipped).vit, str: mythic.setEffects(equipped).str }, { agi: 5, vit: 5, str: 5 });
  equipped.weapon = { ...equipped.weapon, setId: "forged" };
  assert.equal(mythic.setCounts(equipped).azure, 1);
});

test("full set effects and salvage are exact and recomputation does not stack", () => {
  for (const family of mythic.SET_IDS) {
    const equipped = Object.fromEntries(mythic.SET_SLOTS.map(slot => [slot, setPiece(family, slot)]));
    assert.deepEqual(mythic.setEffects(equipped), mythic.setEffects(equipped));
  }
  const item = mythic.createMythicItem(mythic.setRecipe("skeleton", "weapon", 1), 1, () => 0);
  assert.deepEqual(mythic.setSalvage(item), [{ junkId: "bossHorn", qty: 4 }, { junkId: "bossHide", qty: 4 }]);
  assert.equal(mythic.setSalvage(mythic.createMythicItem(mythic.bossWeaponRecipe("spirit_greatsword", 1), 1, () => 0)), null);
});

test("Azure 4pc halves active MP after Skill Efficiency boundary", () => {
  const state = battle.createBattle({ seed: 1, hero: hero({ skills: { heavy_blow: 1 }, activeSkills: ["heavy_blow"], equipmentEffects: { activeSkillMpMultiplier: 0.5 } }), enemies: [enemy()] });
  assert.equal(battle.getActionMetadata(state, "hero", { type: "active", skillId: "heavy_blow", targetId: "enemy" }).spCost, 8);
  const next = battle.battleStep(state, { type: "active", skillId: "heavy_blow", targetId: "enemy" }).state;
  assert.equal(next.units.hero.sp, 92);
});

test("Azure 6pc rolls once per action and keeps Boss control conversion", () => {
  let observed = null;
  for (let seed = 1; seed < 200 && !observed; seed++) {
    const state = battle.createBattle({ seed, hero: hero({ equipmentEffects: { azureControlProc: true } }), enemies: [enemy({ kind: "boss" })] });
    const next = battle.battleStep(state, { type: "basic", targetId: "enemy" }).state;
    if (next.log.some(entry => entry.type === "boss_conversion")) observed = next;
  }
  assert.ok(observed);
  assert.equal(observed.log.filter(entry => entry.type === "boss_conversion").length, 1);
});

test("Robot 4pc resists hard control without reducing Poison", () => {
  const firstRoll = seed => {
    let value = seed >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
  let seed = 1;
  while (seed < 1_000_000 && !(firstRoll(seed) >= 0.8 && firstRoll(seed) < 0.9)) seed++;
  assert.ok(seed < 1_000_000);
  const plain = battle.createBattle({ seed, hero: hero(), enemies: [enemy()] });
  const robot = battle.createBattle({ seed, hero: hero({ equipmentEffects: { ccResist: 10 } }), enemies: [enemy()] });
  const plainStun = battle.applyStatus(plain, plain.units.enemy, plain.units.hero, "stun", { chance: 100, duration: 1 }, { appliedStatuses: new Set() });
  const robotStun = battle.applyStatus(robot, robot.units.enemy, robot.units.hero, "stun", { chance: 100, duration: 1 }, { appliedStatuses: new Set() });
  assert.equal(plainStun.applied, true);
  assert.equal(robotStun.applied, false);
  const poison = battle.createBattle({ seed: 1, hero: hero({ equipmentEffects: { ccResist: 100 } }), enemies: [enemy()] });
  assert.equal(battle.applyStatus(poison, poison.units.enemy, poison.units.hero, "poison", { chance: 100, duration: 2, damage: 3 }, { appliedStatuses: new Set() }).applied, true);
});

test("Skeleton 6pc applies post-hit Armor Break through status resistance", () => {
  const state = battle.createBattle({ seed: 1, hero: hero({ crit: 100, equipmentEffects: { skeletonCritArmorBreak: true } }), enemies: [enemy({ statusResist: 100 })] });
  const next = battle.battleStep(state, { type: "basic", targetId: "enemy" }).state;
  assert.equal(next.units.enemy.statuses.armor_break.duration, 2);
  assert.equal(next.log.find(entry => entry.type === "damage").amount, 63);
});

test("Robot 6pc triggers DEF Up only on a fresh 50 percent crossing", () => {
  let state = battle.createBattle({ seed: 1, hero: hero({ hp: 120, maxHp: 200, speed: 20, equipmentEffects: { robotThresholdDefUp: true } }), enemies: [enemy({ atk: 80, speed: 200 })] });
  state = battle.battleStep(state).state;
  assert.equal(state.units.hero.statuses.def_up.duration, 2);
  const logs = state.log.filter(entry => entry.text === "Robot Set granted DEF Up").length;
  state = battle.battleStep(state, { type: "basic", targetId: "enemy" }).state;
  assert.equal(state.log.filter(entry => entry.text === "Robot Set granted DEF Up").length, logs);
});

test("Spirit signature rolls once per successful action and is checkpoint-safe", () => {
  let found = null;
  for (let seed = 1; seed < 100 && !found; seed++) {
    const state = battle.createBattle({ seed, hero: hero({ hp: 100, equipmentEffects: { bossWeaponSignature: "spirit_restore" } }), enemies: [enemy()] });
    const next = battle.battleStep(state, { type: "basic", targetId: "enemy" }).state;
    if (next.units.hero.hp > 100) found = next;
  }
  assert.ok(found);
  assert.equal(found.units.hero.hp, 120);
  const restored = battle.restoreCheckpoint(battle.serializeCheckpoint(found));
  assert.deepEqual(restored.units.hero.equipmentEffects, found.units.hero.equipmentEffects);
});

test("Lavalon per-hit extras are bounded and never consume another action", () => {
  let observed = null;
  for (let seed = 1; seed < 1000 && !observed; seed++) {
    const state = battle.createBattle({ seed, hero: hero({ skills: { blade_storm: 1 }, activeSkills: ["blade_storm"], equipmentEffects: { bossWeaponSignature: "lavalon_extra_basic" } }), enemies: [enemy()] });
    const next = battle.battleStep(state, { type: "active", skillId: "blade_storm", targetId: "enemy" }).state;
    const extras = next.log.filter(entry => entry.actionName === "Lavalon extra attack").length;
    if (extras) observed = { next, extras };
  }
  assert.ok(observed);
  assert.ok(observed.extras <= 3);
  assert.equal(observed.next.safeActionSeq, 1);
});

test("Icicle counter rolls once per enemy action and cannot chain", () => {
  let observed = null;
  for (let seed = 1; seed < 100 && !observed; seed++) {
    const state = battle.createBattle({ seed, hero: hero({ speed: 20, equipmentEffects: { bossWeaponSignature: "icicle_counter" } }), enemies: [enemy({ speed: 200, ai: { hits: 3 } })] });
    const next = battle.battleStep(state).state;
    if (next.log.some(entry => entry.text === "Icicle Longsword countered")) observed = next;
  }
  assert.ok(observed);
  assert.equal(observed.log.filter(entry => entry.text === "Icicle Longsword countered").length, 1);
  assert.equal(observed.safeActionSeq, 1);
});

test("W4 visual resolver binds Robot Skeleton and all Boss Weapon masters", () => {
  const root = path.join(__dirname, "..");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "r2-upload/manifest.json"), "utf8"));
  const context = { ASSETS: manifest.assets, console };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(root, "src/phaser/presentation/EquipmentVisualResolver.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(root, "src/phaser/presentation/HeroV5RuntimeContract.js"), "utf8"), context);
  const selection = vm.runInContext(`resolveHeroV5EquipmentSelection({ helmet:{setId:"robot"}, chest:{setId:"skeleton"}, weapon:{bossWeaponId:"spirit_greatsword"} }, {})`, context);
  assert.equal(selection.equipment.helmet, "robot");
  assert.equal(selection.equipment.chest, "skeleton");
  assert.equal(selection.bossWeapon, "spiritGreatsword");
  const resolved = vm.runInContext(`resolveHeroV5BaseWingContract({equipmentSelection:${JSON.stringify(selection)}})`, context);
  assert.ok(resolved.idle.every(frame => frame.some(layer => layer.path.includes("spirit_greatsword"))));
  for (const family of ["azure", "robot", "skeleton"]) {
    const equipped = Object.fromEntries(["helmet", "chest", "gloves", "boots", "weapon", "accessory"].map(type => [type, { type, setId: family }]));
    const familySelection = vm.runInContext(`resolveHeroV5EquipmentSelection(${JSON.stringify(equipped)}, {})`, context);
    const familyResolved = vm.runInContext(`resolveHeroV5BaseWingContract({equipmentSelection:${JSON.stringify(familySelection)}})`, context);
    for (const state of ["idle", "attack", "death"]) {
      assert.ok(familyResolved[state].every(frame => frame.some(layer => layer.path.includes(`/equipment/${family}/`))));
    }
  }
  for (const [bossWeaponId, pathId] of [["spirit_greatsword", "spirit_greatsword"], ["lavalon_sword", "lavalon_sword"], ["icicle_longsword", "icicle_longsword"]]) {
    const weaponSelection = vm.runInContext(`resolveHeroV5EquipmentSelection({weapon:{bossWeaponId:"${bossWeaponId}"}}, {})`, context);
    const weaponResolved = vm.runInContext(`resolveHeroV5BaseWingContract({equipmentSelection:${JSON.stringify(weaponSelection)}})`, context);
    for (const state of ["idle", "attack", "death"]) {
      assert.ok(weaponResolved[state].every(frame => frame.some(layer => layer.path.includes(`/weapons/${pathId}/`))));
    }
  }
});

test("legacy Raid stat adapter receives W4 static Mythic set stats without a parallel signature resolver", () => {
  const root = path.join(__dirname, "..");
  const source = loadWorkerSource(root).replace("export default {", "const workerDefault = {")
    + "\nglobalThis.__raidCombatStats = raidCombatStats;";
  const context = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(source, context);
  const character = { level: 1, str: 0, vit: 0, agi: 0, dex: 0, luk: 0 };
  const rows = ["helmet", "chest", "gloves", "boots"].map(slot => ({
    slot_type: slot, rarity: "mythic", name: `Skeleton ${slot}`, atk: 0, def: 0, hp: 0, mp: 0, enhance_level: 0,
    extra_json: JSON.stringify({ itemModelVersion: 2, rewardVersion: 2, setId: "skeleton", empowerSlots: [] })
  }));
  const base = context.__raidCombatStats(character, []);
  const twoPiece = context.__raidCombatStats(character, rows.slice(0, 2));
  const fourPiece = context.__raidCombatStats(character, rows);
  assert.equal(twoPiece.atk, base.atk + 15);
  assert.equal(fourPiece.critDamage, base.critDamage + 30);
  assert.doesNotMatch(source.slice(source.indexOf("function simulateRaidAttack"), source.indexOf("async function settleRaidRank")), /bossWeaponSignature|azureControlProc|robotThresholdDefUp/);
});

test("Worker W4 trust boundary derives crafting and stones server-side", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  assert.match(worker, /MYTHIC_V2\.recipeById\(recipeId, floor\)/);
  assert.match(worker, /MYTHIC_V2\.createMythicItem\(canonicalRecipe, floor/);
  assert.match(worker, /bossStoneForEnemy\(bossId\)/);
  assert.match(worker, /craftPendingToken/);
  assert.doesNotMatch(worker, /rarity:\s*"azure"[\s\S]{0,160}craftRecipeId/);
});
