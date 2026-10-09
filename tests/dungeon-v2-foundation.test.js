const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dungeon = require("../src/systems/dungeonV2.js");
const battle = require("../src/systems/battleCore.js");

const appSource = fs.readFileSync(path.join(__dirname, "../src/ui/App.js"), "utf8");
const componentsSource = fs.readFileSync(path.join(__dirname, "../src/ui/components.js"), "utf8");
const apiSource = fs.readFileSync(path.join(__dirname, "../src/state/api.js"), "utf8");
const workerSource = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");

test("Dungeon preview and battle entry share the authoritative server encounter context", () => {
  assert.match(apiSource, /function cloudGetDungeonEncounterPreview/);
  assert.match(apiSource, /action: "getDungeonEncounterPreview"/);
  assert.match(apiSource, /previewContext: previewContext \|\| undefined/);
  assert.match(workerSource, /async function handleGetDungeonEncounterPreview/);
  assert.match(workerSource, /dungeonV2ServerEncounterContext\(characterId, floor, ordinal\)/);
  assert.match(workerSource, /dungeon_preview_stale/);
  assert.match(workerSource, /dungeonV2ServerContextsMatch\(suppliedContext, context\)/);
  assert.match(componentsSource, /cloudGetDungeonEncounterPreview\(serverUrl, save\.characterId, floor\)/);
  assert.match(componentsSource, /makeEncounter\(floor, \{ serverContext: preview\.context \}\)/);
  assert.match(componentsSource, /onSelectFloor\(detail\.floor, detail\.monsters, detail\.previewContext\)/);
  assert.doesNotMatch(componentsSource, /encounterCache\.current\.set\(floor, makeEncounter\(floor\)\)/);
  assert.match(appSource, /cloudStartDungeonBattle\(cred\.url, save\.characterId, floorNum, options\.previewContext \|\| null\)/);
  assert.match(appSource, /started\?\.error === "dungeon_preview_stale"/);
});

test("Dungeon preview remains readable while a real battle checkpoint is active", () => {
  const start = workerSource.indexOf("async function handleGetDungeonEncounterPreview");
  const end = workerSource.indexOf("async function handleStartDungeonBattle", start);
  assert.ok(start >= 0 && end > start);
  const previewHandler = workerSource.slice(start, end);
  assert.doesNotMatch(previewHandler, /active_battle_conflict/);
  assert.match(previewHandler, /dungeonV2ServerContextFromStoredCheckpoint/);
  assert.match(previewHandler, /dungeonV2ServerEncounterContext\(characterId, floor, ordinal\)/);
});

test("Dungeon preview never falls back to the legacy random encounter path", () => {
  const mapStart = componentsSource.indexOf("function MapScreen");
  const mapEnd = componentsSource.indexOf("function ShopOverlay", mapStart);
  assert.ok(mapStart >= 0 && mapEnd > mapStart);
  const map = componentsSource.slice(mapStart, mapEnd);
  assert.doesNotMatch(map, /makeEncounter\(floor\)/);
  assert.match(map, /serverUrl/);
  assert.match(map, /previewContext/);
});


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

test("Dungeon V2 enemy integration preserves authoritative Dodge at the Battle Core boundary", () => {
  assert.equal(dungeon.toDungeonV2BattleEnemy({ id: "spore_cap", uid: "spore", dodge: 2, maxHp: 10 }).dodge, 2);
  assert.equal(dungeon.toDungeonV2BattleEnemy({ id: "bramble_bat", uid: "bat", dodge: 12, maxHp: 10 }).dodge, 12);
  assert.equal(dungeon.toDungeonV2BattleEnemy({ id: "jelly_slime", uid: "slime", dodge: 0, maxHp: 10 }).dodge, 0);
});

test("F5 starter Pet entitlement follows the V2 Elite encounter exactly once", () => {
  const elite = [{ floor: 5, encounterType: dungeon.ENCOUNTER_TYPES.ELITE }];
  assert.equal(dungeon.isDungeonV2StarterPetEligible({ floor: 5, monsters: elite, unlockedNext: true, alreadyHasStarter: false }), true);
  assert.equal(dungeon.classifyDungeonEncounter(5), dungeon.ENCOUNTER_TYPES.ELITE);
  assert.equal(dungeon.isDungeonV2StarterPetEligible({ floor: 5, monsters: elite, unlockedNext: true, alreadyHasStarter: true }), false);
  assert.equal(dungeon.isDungeonV2StarterPetEligible({ floor: 5, monsters: elite, unlockedNext: false, alreadyHasStarter: false }), false);
  assert.equal(dungeon.isDungeonV2StarterPetEligible({ floor: 5, monsters: elite, unlockedNext: true, alreadyHasStarter: false }), true);
  assert.equal(dungeon.isDungeonV2StarterPetEligible({ floor: 10, monsters: [{ floor: 10, encounterType: dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS }], unlockedNext: true, alreadyHasStarter: false }), false);
  assert.equal(dungeon.isDungeonV2StarterPetEligible({ floor: 4, monsters: [{ floor: 4, encounterType: dungeon.ENCOUNTER_TYPES.NORMAL }], unlockedNext: true, alreadyHasStarter: false }), false);
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
  assert.equal(state.units.boss.atk, 100, "Enrage does not reinterpret damage as ATK");
  assert.equal(state.units.boss.damageMultiplier, 1.2);
  assert.equal(state.units.boss.flags.dungeonV2Enraged, true);
  assert.equal(state.log.length, 1);
  assert.deepEqual(state.log[0], {
    seq: 1, round: 0, type: "boss_enrage", text: "boss เข้าสู่โหมดคลั่ง!", actorId: "boss"
  });
  assert.equal(state.logSeq, 1);
  state.units.boss.hp = 100;
  dungeon.applyDungeonV2BossEnrage(state);
  assert.equal(state.units.boss.damageMultiplier, 1.2, "threshold crossing cannot stack the multiplier");
  assert.equal(state.log.filter(entry => entry.type === "boss_enrage").length, 1, "a boss emits the Enrage log once");
  assert.equal(state.logSeq, 1);
});

test("Boss Enrage flag and damage multiplier survive checkpoint serialization/reload", () => {
  const state = { version: 1, battleId: "dungeon-test", units: {
    boss: { id: "boss", kind: "boss", hp: 400, maxHp: 1000, atk: 100, damageMultiplier: 1.2, flags: { dungeonV2Enraged: true, dungeonV2EnrageDamageMultiplier: 1.2 } }
  } };
  const restored = JSON.parse(JSON.stringify(state));
  dungeon.applyDungeonV2BossEnrage(restored);
  assert.equal(restored.units.boss.atk, 100);
  assert.equal(restored.units.boss.damageMultiplier, 1.2);
  assert.equal(restored.units.boss.flags.dungeonV2Enraged, true);
});

function makeEnrageBattle(extraBoss = {}) {
  return battle.createDungeonBattle({
    seed: 22,
    hero: { id: "hero", kind: "hero", hp: 1000, maxHp: 1000, atk: 1, def: 20, speed: 1, accuracy: 99, dodge: 0, crit: 0, activeSkills: [], skills: {} },
    enemies: [{ id: "boss", kind: "boss", hp: 1000, maxHp: 1000, atk: 100, def: 0, speed: 100, accuracy: 99, dodge: 0, crit: 0, ...extraBoss }]
  });
}

test("Boss Enrage applies exact +20% resolved damage in normal play and multi-hit actions", () => {
  const normal = makeEnrageBattle();
  normal.units.boss.hp = 499;
  dungeon.applyDungeonV2BossEnrage(normal);
  const next = battle.battleStep(normal).state;
  assert.equal(next.units.hero.hp, 904, "80 base damage becomes 96 after Enrage");

  const multi = makeEnrageBattle({ ai: { hits: 3 } });
  multi.units.boss.hp = 499;
  dungeon.applyDungeonV2BossEnrage(multi);
  const multiNext = battle.battleStep(multi).state;
  assert.equal(multiNext.units.hero.hp, 712, "each multi-hit resolves at +20%; the modifier does not stack per hit");
});

test("Dungeon V2 Skip uses the same Enrage damage modifier and preserves it through resume", () => {
  const initial = makeEnrageBattle();
  initial.units.boss.hp = 499;
  dungeon.applyDungeonV2BossEnrage(initial);
  const resumed = battle.restoreCheckpoint(battle.serializeCheckpoint(initial));
  dungeon.applyDungeonV2BossEnrage(resumed);
  assert.equal(resumed.units.boss.damageMultiplier, 1.2);
  assert.equal(resumed.log.filter(entry => entry.type === "boss_enrage").length, 1, "restoring a checkpoint retains the historical log");
  dungeon.applyDungeonV2BossEnrage(resumed);
  assert.equal(resumed.log.filter(entry => entry.type === "boss_enrage").length, 1, "resume must not emit a duplicate Enrage line");
  const skipped = dungeon.simulateDungeonV2Battle(resumed, battle, 1);
  assert.equal(skipped.units.hero.hp, 904);
  assert.equal(skipped.units.boss.damageMultiplier, 1.2);
  assert.equal(skipped.units.boss.flags.dungeonV2Enraged, true);
  assert.equal(skipped.log.filter(entry => entry.type === "boss_enrage").length, 1);
  const manual = makeEnrageBattle();
  manual.units.boss.hp = 499;
  dungeon.applyDungeonV2BossEnrage(manual);
  const auto = battle.restoreCheckpoint(battle.serializeCheckpoint(manual));
  auto.flags.auto = true;
  const autoNext = dungeon.applyDungeonV2BossEnrage(battle.battleStep(auto).state);
  const manualNext = battle.battleStep(battle.restoreCheckpoint(battle.serializeCheckpoint(manual))).state;
  assert.deepEqual(
    [manualNext, autoNext, skipped].map(state => state.log.filter(entry => entry.type === "boss_enrage").map(({seq, round, type, text, actorId}) => ({seq, round, type, text, actorId}))),
    Array.from({length: 3}, () => [{seq: 2, round: 0, type: "boss_enrage", text: "boss เข้าสู่โหมดคลั่ง!", actorId: "boss"}]),
    "Manual, Auto, and Skip preserve the same single Enrage log line"
  );
});

test("Battle Core remains default-neutral for actors without a Dungeon V2 modifier", () => {
  const plain = makeEnrageBattle();
  const explicitNeutral = makeEnrageBattle({ damageMultiplier: 1 });
  const plainNext = battle.battleStep(plain).state;
  const neutralNext = battle.battleStep(explicitNeutral).state;
  assert.equal(plainNext.units.hero.hp, neutralNext.units.hero.hp);
  assert.equal(plainNext.units.boss.hp, neutralNext.units.boss.hp);
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
