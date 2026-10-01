const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dungeon = require("../src/systems/dungeonV2.js");

test("Dungeon V2 encounter classification uses midpoint Elite and chapter Boss boundaries", () => {
  assert.equal(dungeon.classifyDungeonEncounter(1), "normal");
  assert.equal(dungeon.classifyDungeonEncounter(4), "normal");
  assert.equal(dungeon.classifyDungeonEncounter(5), "elite");
  assert.equal(dungeon.classifyDungeonEncounter(9), "normal");
  assert.equal(dungeon.classifyDungeonEncounter(10), "chapter_boss");
  assert.equal(dungeon.classifyDungeonEncounter(15), "elite");
  assert.equal(dungeon.classifyDungeonEncounter(20), "chapter_boss");
  assert.equal(dungeon.classifyDungeonEncounter(105), "elite");
  assert.equal(dungeon.classifyDungeonEncounter(110), "chapter_boss");
});

test("Dungeon V2 chapter and source identity boundaries are deterministic", () => {
  assert.equal(dungeon.dungeonChapterForFloor(1), 1);
  assert.equal(dungeon.dungeonChapterForFloor(10), 1);
  assert.equal(dungeon.dungeonChapterForFloor(11), 2);
  assert.equal(dungeon.dungeonChapterFloor(20), 10);
  assert.equal(dungeon.dungeonChapterFloor(25), 5);
});

test("locked Normal Monster reference floors resolve exactly", () => {
  const expected = {
    1: { hp: 29, atk: 6, def: 1 },
    30: { hp: 328, atk: 64, def: 28 },
    71: { hp: 829, atk: 155, def: 70 },
    105: { hp: 1300, atk: 236, def: 109 }
  };
  for (const [floor, stats] of Object.entries(expected)) {
    assert.deepEqual(dungeon.dungeonV2NormalBaseStats(Number(floor)), stats, `F${floor}`);
  }
});

test("normal identity profiles remain distinct and pack modifiers affect only HP/ATK", () => {
  const jelly = dungeon.resolveDungeonV2NormalStats(30, "jelly_slime");
  const boar = dungeon.resolveDungeonV2NormalStats(30, "tusky_boar");
  const bat = dungeon.resolveDungeonV2NormalStats(30, "bramble_bat");
  assert.notDeepEqual(jelly, boar);
  assert.notDeepEqual(boar, bat);
  assert.equal(dungeon.resolveDungeonV2NormalStats(30, "jelly_slime", { packCount: 1 }).hp, 328);
  assert.equal(dungeon.resolveDungeonV2NormalStats(30, "jelly_slime", { packCount: 2 }).hp, Math.round(328 * 0.72));
  assert.equal(dungeon.resolveDungeonV2NormalStats(30, "jelly_slime", { packCount: 3 }).hp, Math.round(328 * 0.605));
  assert.equal(dungeon.resolveDungeonV2NormalStats(30, "jelly_slime", { packCount: 3 }).def, Math.round(28 * 0.9));
  assert.equal(dungeon.resolveDungeonV2NormalStats(30, "jelly_slime", { elite: true }).hp, Math.round(328 * 1 * 1.3));
  assert.equal(dungeon.resolveDungeonV2NormalStats(30, "jelly_slime", { elite: true }).atk, Math.round(64 * 0.9 * 1.1));
  assert.equal(dungeon.resolveDungeonV2NormalStats(30, "jelly_slime", { elite: true }).def, Math.round(28 * 0.9 * 1.05));
});

test("approved Chapter Boss profiles resolve without a generic extra Boss multiplier", () => {
  assert.deepEqual(dungeon.resolveDungeonV2BossStats(30, "moss_king"), {
    hp: Math.round(328 * 3), atk: Math.round(64 * 1.15), def: Math.round(28 * 1.35),
    statusResist: 10, profileId: "moss_king", identity: "Tank / sustain-pressure",
    encounterType: "chapter_boss", packCount: 1
  });
  assert.equal(dungeon.resolveDungeonV2BossStats(30, "ember_drake").statusResist, 15);
  assert.equal(dungeon.resolveDungeonV2BossStats(30, "frost_warden").statusResist, 20);
  assert.equal(dungeon.resolveDungeonV2BossStats(30, "frost_warden").hp, Math.round(328 * 3.6));
});

test("Boss Enrage triggers strictly below 50 percent and only once", () => {
  const state = { units: {
    boss: { id: "boss", kind: "boss", hp: 500, maxHp: 1000, atk: 100, flags: { dungeonV2BaseAtk: 100 } }
  } };
  dungeon.applyDungeonV2BossEnrage(state);
  assert.equal(state.units.boss.atk, 100, "exactly 50% does not enrage");
  state.units.boss.hp = 499;
  dungeon.applyDungeonV2BossEnrage(state);
  assert.equal(state.units.boss.atk, 120);
  assert.equal(state.units.boss.flags.dungeonV2Enraged, true);
  state.units.boss.hp = 100;
  dungeon.applyDungeonV2BossEnrage(state);
  assert.equal(state.units.boss.atk, 120, "threshold crossing cannot stack the multiplier");
});

test("Boss Enrage flag and adjusted ATK survive checkpoint serialization/reload", () => {
  const state = { version: 1, battleId: "dungeon-test", units: {
    boss: { id: "boss", kind: "boss", hp: 400, maxHp: 1000, atk: 120, flags: { dungeonV2BaseAtk: 100, dungeonV2Enraged: true } }
  } };
  const restored = JSON.parse(JSON.stringify(state));
  dungeon.applyDungeonV2BossEnrage(restored);
  assert.equal(restored.units.boss.atk, 120);
  assert.equal(restored.units.boss.flags.dungeonV2Enraged, true);
});

test("legacy remote monster role/stat fields cannot override canonical V2 profiles", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/gameConfig.js"), "utf8")
    + "\nthis.__api = { applyGameConfig };";
  const context = {
    DUNGEON_V2: dungeon,
    ENEMY_POOL: [{ id: "jelly_slime", name: "Jelly Slime" }],
    BOSS_POOL: [{ id: "moss_king", name: "Moss King" }],
    PET_POOL: [],
    RARITY_MULT: { rare: 1, unique: 1, elite: 1, mythic: 1, azure: 1 },
    SKILLS: []
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  context.__api.applyGameConfig({ monsters: [
    { id: "legacy_moss_row", name: "Moss King", isBoss: false, hpMult: 99, atkMult: 99 },
    { id: "legacy_jelly_row", name: "Jelly Slime", isBoss: true, hpMult: 99, atkMult: 99 }
  ] });
  assert.deepEqual(context.BOSS_POOL.map(monster => monster.dungeonV2Id), ["moss_king"]);
  assert.deepEqual(context.ENEMY_POOL.map(monster => monster.dungeonV2Id), ["jelly_slime"]);
  assert.equal(dungeon.resolveDungeonV2BossStats(30, "moss_king").hp, 984);
});
