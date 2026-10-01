const test = require("node:test");
const assert = require("node:assert/strict");

const dungeon = require("../src/systems/dungeonV2.js");
const battle = require("../src/systems/battleCore.js");

function hero(extra = {}) {
  return {
    id: "hero", kind: "hero", side: "ally", name: "Hero", hp: 10000, maxHp: 10000,
    atk: 1, def: 0, speed: 0, accuracy: 99, dodge: 0, crit: 0, activeSkills: [], skills: {}, ...extra
  };
}

function pet(extra = {}) {
  return {
    id: "pet", kind: "pet", side: "ally", name: "Pet", hp: 10000, maxHp: 10000,
    atk: 1, def: 0, speed: 0, accuracy: 99, dodge: 0, crit: 0, ...extra
  };
}

function skillBattle(monsterId, encounterType = dungeon.ENCOUNTER_TYPES.NORMAL, options = {}) {
  const config = dungeon.getDungeonV2SkillConfig(monsterId, encounterType);
  const kind = encounterType === dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS ? "boss" : "monster";
  const enemy = {
    id: "enemy", kind, side: "enemy", name: monsterId, hp: 10000, maxHp: 10000,
    atk: 100, def: 0, speed: 100, accuracy: 99, dodge: 0, crit: 0,
    dungeonV2SkillSetId: config.skillSetId,
    dungeonV2SkillCycle: config.cycle,
    dungeonV2SkillPhase2Cycle: config.phase2Cycle,
    dungeonV2PhaseAction: config.phaseAction,
    dungeonV2CycleIndex: 0,
    dungeonV2Phase: "base",
    dungeonV2PendingAction: null,
    dungeonV2OvergrowthQueued: false,
    dungeonV2OvergrowthUsed: false,
    ...options.enemy
  };
  return battle.createDungeonBattle({
    battleId: `skills-${monsterId}`,
    seed: options.seed || 17,
    hero: options.hero || hero(),
    pet: options.withPet === false ? null : options.pet === false ? null : options.pet || pet(),
    enemies: [enemy]
  });
}

function stepEnemy(state) {
  let next = state;
  for (let i = 0; i < 8; i++) {
    const actor = battle.currentUnit(next);
    const result = battle.battleStep(next, actor?.kind === "hero" ? { type: "basic" } : undefined);
    next = result.state;
    if (actor?.id === "enemy" && result.completedAction) return next;
  }
  assert.fail("enemy did not receive an Action");
}

function skillLog(state) {
  return state.log.filter(entry => entry.type === "enemy_skill").map(entry => entry.skillId);
}

test("all six Normal Monster cycles are deterministic and repeat", () => {
  const expected = {
    jelly_slime: ["basic_attack", "body_slam"],
    spore_cap: ["basic_attack", "toxic_spores", "basic_attack"],
    tusky_boar: ["basic_attack", "heavy_cleave"],
    bramble_bat: ["wing_flurry", "basic_attack", "basic_attack"],
    bone_rattler: ["basic_attack", "bone_bash", "basic_attack"],
    sandy_crab: ["basic_attack", "shell_guard", "basic_attack", "basic_attack"]
  };
  for (const [monsterId, cycle] of Object.entries(expected)) {
    let state = skillBattle(monsterId);
    for (let i = 0; i < cycle.length * 2; i++) state = stepEnemy(state);
    assert.deepEqual(skillLog(state), cycle.concat(cycle), monsterId);
    assert.equal(state.units.enemy.dungeonV2CycleIndex, 0, `${monsterId} cycle cursor repeats`);
  }
});

test("Normal and Elite skill definitions preserve exact locked values", () => {
  const expected = {
    jelly_slime: ["body_slam", 1.25, null],
    spore_cap: ["toxic_spores", 0.90, { key: "poison", chance: 35, duration: 2, damagePct: 0.10 }],
    tusky_boar: ["heavy_cleave", 1.40, { key: "armor_break", chance: 35, duration: 2 }],
    bramble_bat: ["wing_flurry", 0.65, null],
    bone_rattler: ["bone_bash", 1.15, { key: "stun", chance: 20, duration: 1 }],
    sandy_crab: ["shell_guard", null, null]
  };
  const elite = {
    jelly_slime: ["heavy_body_slam", 1.45],
    spore_cap: ["noxious_spores", 1.00],
    tusky_boar: ["brutal_cleave", 1.55],
    bramble_bat: ["razor_flurry", 0.50],
    bone_rattler: ["skull_crusher", 1.30],
    sandy_crab: ["iron_shell", null]
  };
  for (const [monsterId, [skillId, mult, status]] of Object.entries(expected)) {
    const config = dungeon.getDungeonV2SkillConfig(monsterId, dungeon.ENCOUNTER_TYPES.NORMAL);
    const skill = config.cycle.find(action => action.id === skillId);
    assert.ok(skill, `${monsterId} normal skill`);
    if (mult == null) assert.equal(skill.kind, "utility");
    else assert.equal(skill.mult, mult);
    assert.deepEqual(skill.statuses[0] || null, status, `${monsterId} status values`);

    const eliteConfig = dungeon.getDungeonV2SkillConfig(monsterId, dungeon.ENCOUNTER_TYPES.ELITE);
    const eliteSkill = eliteConfig.cycle.find(action => action.id === elite[monsterId][0]);
    assert.ok(eliteSkill, `${monsterId} elite substitution`);
    if (elite[monsterId][1] == null) assert.equal(eliteSkill.kind, "utility");
    else assert.equal(eliteSkill.mult, elite[monsterId][1]);
  }
  const noxious = dungeon.getDungeonV2SkillConfig("spore_cap", dungeon.ENCOUNTER_TYPES.ELITE).cycle.find(action => action.id === "noxious_spores");
  assert.deepEqual(noxious.statuses[0], { key: "poison", chance: 45, duration: 3, damagePct: 0.12 });
  const brutal = dungeon.getDungeonV2SkillConfig("tusky_boar", dungeon.ENCOUNTER_TYPES.ELITE).cycle.find(action => action.id === "brutal_cleave");
  assert.deepEqual(brutal.statuses[0], { key: "armor_break", chance: 45, duration: 2 });
  const skull = dungeon.getDungeonV2SkillConfig("bone_rattler", dungeon.ENCOUNTER_TYPES.ELITE).cycle.find(action => action.id === "skull_crusher");
  assert.deepEqual(skull.statuses[0], { key: "stun", chance: 25, duration: 1 });
  assert.equal(dungeon.getDungeonV2SkillConfig("sandy_crab", dungeon.ENCOUNTER_TYPES.ELITE).cycle.find(action => action.id === "iron_shell").selfStatus.duration, 3);
});

test("direct Monster and Boss skill multipliers resolve through Battle Core", () => {
  const cases = [
    ["jelly_slime", dungeon.ENCOUNTER_TYPES.NORMAL, "body_slam", 1.25, 1],
    ["spore_cap", dungeon.ENCOUNTER_TYPES.NORMAL, "toxic_spores", 0.90, 1],
    ["tusky_boar", dungeon.ENCOUNTER_TYPES.NORMAL, "heavy_cleave", 1.40, 1],
    ["bramble_bat", dungeon.ENCOUNTER_TYPES.NORMAL, "wing_flurry", 0.65, 2],
    ["bone_rattler", dungeon.ENCOUNTER_TYPES.NORMAL, "bone_bash", 1.15, 1],
    ["moss_king", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS, "vine_slam", 1.30, 1],
    ["ember_drake", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS, "flame_bite", 1.40, 1],
    ["frost_warden", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS, "frost_strike", 1.20, 1]
  ];
  for (const [monsterId, encounterType, skillId, mult, hits] of cases) {
    const config = dungeon.getDungeonV2SkillConfig(monsterId, encounterType);
    const index = config.cycle.findIndex(action => action.id === skillId);
    let state = skillBattle(monsterId, encounterType);
    state.units.enemy.dungeonV2CycleIndex = index;
    state = stepEnemy(state);
    assert.equal(state.units.hero.hp, 10000 - Math.round(100 * mult) * hits, `${monsterId} damage`);
  }
});

test("Wing Flurry and Razor Flurry are one Action with exact hit counts", () => {
  let state = skillBattle("bramble_bat");
  state = stepEnemy(state);
  assert.equal(state.log.filter(entry => entry.type === "damage" && entry.actionName === "Wing Flurry").length, 2);
  assert.equal(state.units.enemy.dungeonV2CycleIndex, 1);

  state = skillBattle("bramble_bat", dungeon.ENCOUNTER_TYPES.ELITE);
  state = stepEnemy(state);
  assert.equal(state.log.filter(entry => entry.type === "damage" && entry.actionName === "Razor Flurry").length, 3);
  assert.equal(state.units.enemy.dungeonV2CycleIndex, 1);
});

test("Shell Guard and Iron Shell consume an Action without a free attack", () => {
  for (const encounterType of [dungeon.ENCOUNTER_TYPES.NORMAL, dungeon.ENCOUNTER_TYPES.ELITE]) {
    let state = skillBattle("sandy_crab", encounterType);
    state = stepEnemy(state);
    state = stepEnemy(state);
    const guardName = encounterType === dungeon.ENCOUNTER_TYPES.NORMAL ? "Shell Guard" : "Iron Shell";
    assert.equal(state.log.filter(entry => entry.actionName === guardName).length, 1);
    assert.equal(state.log.filter(entry => entry.type === "damage" && entry.actorId === "enemy" && entry.actionName === guardName).length, 0);
    assert.equal(state.units.enemy.statuses.def_up.duration, encounterType === dungeon.ENCOUNTER_TYPES.NORMAL ? 2 : 3);
  }
});

test("cycle cursor and pending Moss King Overgrowth survive checkpoint restore", () => {
  let state = skillBattle("moss_king", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS);
  state = stepEnemy(state);
  assert.equal(state.units.enemy.dungeonV2CycleIndex, 1);
  const restored = battle.restoreCheckpoint(battle.serializeCheckpoint(state));
  assert.equal(restored.units.enemy.dungeonV2CycleIndex, 1);
  assert.deepEqual(skillLog(restored), ["vine_slam"]);

  restored.units.enemy.hp = 499;
  dungeon.applyDungeonV2BossEnrage(restored);
  assert.equal(restored.units.enemy.dungeonV2PendingAction.id, "overgrowth");
  const pendingRestored = battle.restoreCheckpoint(battle.serializeCheckpoint(restored));
  const afterOvergrowth = stepEnemy(pendingRestored);
  assert.equal(skillLog(afterOvergrowth).at(-1), "overgrowth");
  assert.equal(afterOvergrowth.units.enemy.dungeonV2OvergrowthUsed, true);
  assert.equal(afterOvergrowth.units.enemy.dungeonV2CycleIndex, 1, "replaced slot is retained");
  const resumedRotation = stepEnemy(afterOvergrowth);
  assert.equal(skillLog(resumedRotation).at(-1), "basic_attack");
  assert.equal(resumedRotation.units.enemy.dungeonV2CycleIndex, 2);
});

test("Moss King base rotation and one-time Overgrowth phase insertion are exact", () => {
  let state = skillBattle("moss_king", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS);
  for (let i = 0; i < 4; i++) state = stepEnemy(state);
  assert.deepEqual(skillLog(state), ["vine_slam", "basic_attack", "toxic_bloom", "basic_attack"]);
  state.units.enemy.hp = 499;
  dungeon.applyDungeonV2BossEnrage(state);
  state = stepEnemy(state);
  assert.equal(skillLog(state).at(-1), "overgrowth");
  state = stepEnemy(state);
  assert.equal(skillLog(state).at(-1), "vine_slam");
  assert.equal(state.units.enemy.dungeonV2OvergrowthUsed, true);
  dungeon.applyDungeonV2BossEnrage(state);
  assert.equal(state.units.enemy.dungeonV2PendingAction, null);
});

test("Ember Drake phase 2 preserves the current cursor and maps only the first Basic slot", () => {
  let state = skillBattle("ember_drake", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS);
  state = stepEnemy(state);
  assert.equal(skillLog(state).at(-1), "flame_bite");
  assert.equal(state.units.enemy.dungeonV2CycleIndex, 1);
  state.units.enemy.hp = 499;
  dungeon.applyDungeonV2BossEnrage(state);
  assert.equal(state.units.enemy.dungeonV2CycleIndex, 1);
  state = stepEnemy(state);
  assert.equal(skillLog(state).at(-1), "inferno_rush");
  state = stepEnemy(state);
  assert.equal(skillLog(state).at(-1), "flame_breath");
  state = stepEnemy(state);
  assert.equal(skillLog(state).at(-1), "basic_attack");
});

test("Flame Breath hits living Hero and Pet once, without redirecting dead Pet damage", () => {
  let state = skillBattle("ember_drake", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS);
  state.units.enemy.dungeonV2CycleIndex = 2;
  state.units.enemy.hp = 499;
  dungeon.applyDungeonV2BossEnrage(state);
  state = stepEnemy(state);
  const breathHits = state.log.filter(entry => entry.actionName === "Flame Breath" && entry.type === "damage");
  assert.equal(breathHits.length, 2);
  assert.equal(state.units.hero.hp, 9904);
  assert.equal(state.units.pet.hp, 9904);

  state = skillBattle("ember_drake", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS);
  state.units.pet.hp = 0;
  state.units.pet.dead = true;
  state.units.enemy.dungeonV2CycleIndex = 2;
  state.units.enemy.hp = 499;
  dungeon.applyDungeonV2BossEnrage(state);
  state = stepEnemy(state);
  assert.equal(state.log.filter(entry => entry.actionName === "Flame Breath" && entry.type === "damage").length, 1);
  assert.equal(state.units.hero.hp, 9904);
});

test("Frost Warden repeats Ice Fortress and refreshes shared DEF Up without stacking", () => {
  let state = skillBattle("frost_warden", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS);
  for (let i = 0; i < 8; i++) state = stepEnemy(state);
  assert.deepEqual(skillLog(state), [
    "frost_strike", "frozen_shackles", "basic_attack", "ice_fortress",
    "frost_strike", "frozen_shackles", "basic_attack", "ice_fortress"
  ]);
  assert.equal(state.units.enemy.statuses.def_up.duration, 2);
  assert.equal(Object.keys(state.units.enemy.statuses).filter(key => key === "def_up").length, 1);
  assert.equal(dungeon.getDungeonV2SkillConfig("frost_warden", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS).cycle.some(action => action.id === "freeze"), false);
});

test("Enrage direct damage applies to Boss skills but not Poison/DoT", () => {
  let state = skillBattle("moss_king", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS, { seed: 2 });
  state.units.enemy.dungeonV2CycleIndex = 0;
  state.units.enemy.dungeonV2OvergrowthUsed = true;
  state.units.enemy.hp = 499;
  dungeon.applyDungeonV2BossEnrage(state);
  state = stepEnemy(state);
  assert.equal(state.units.hero.hp, 9844, "Vine Slam 130 damage receives direct +20%");

  let poisonState;
  for (let seed = 1; seed <= 200 && !poisonState; seed++) {
    let candidate = skillBattle("moss_king", dungeon.ENCOUNTER_TYPES.CHAPTER_BOSS, { seed });
    candidate.units.enemy.dungeonV2CycleIndex = 2;
    candidate.units.enemy.dungeonV2OvergrowthUsed = true;
    candidate.units.enemy.hp = 499;
    dungeon.applyDungeonV2BossEnrage(candidate);
    candidate = stepEnemy(candidate);
    if (candidate.units.hero.statuses.poison) poisonState = candidate;
  }
  assert.ok(poisonState, "Toxic Bloom proc found in deterministic seed sweep");
  assert.equal(poisonState.units.hero.statuses.poison.damage, 12, "Poison remains 12% ATK and is not Enrage-multiplied");
});

test("Dungeon skill cycles are not inherited by Arena or Raid actors", () => {
  const config = dungeon.getDungeonV2SkillConfig("jelly_slime", dungeon.ENCOUNTER_TYPES.NORMAL);
  const arena = battle.createArenaBattle({
    seed: 4,
    teamA: { hero: hero({ id: "a", side: "team_a", speed: 100 }) },
    teamB: { units: [{ id: "b", kind: "monster", dungeonV2SkillCycle: config.cycle, atk: 10, def: 0, speed: 100, hp: 100, maxHp: 100, accuracy: 99, dodge: 0, crit: 0 }] }
  });
  assert.equal(arena.units.b.dungeonV2CycleIndex, undefined);
  const raid = battle.createRaidBattle({
    seed: 4,
    hero: hero({ speed: 1 }),
    raidBoss: { id: "raid", atk: 10, def: 0, speed: 100, hp: 100, maxHp: 100, accuracy: 99, dodge: 0, crit: 0, dungeonV2SkillCycle: config.cycle }
  });
  assert.equal(raid.units.raid.dungeonV2SkillCycle.length, config.cycle.length);
  assert.equal(raid.units.raid.dungeonV2CycleIndex, undefined);
});

test("normal, Auto and Skip keep the same deterministic enemy cycle", () => {
  const initial = skillBattle("spore_cap");
  const runNormal = () => {
    let state = JSON.parse(JSON.stringify(initial));
    state.flags.skipResolving = false;
    for (let i = 0; i < 6 && !state.result; i++) {
      const actor = battle.currentUnit(state);
      state = battle.battleStep(state, actor?.kind === "hero" ? { type: "basic" } : undefined).state;
    }
    return state;
  };
  const normal = runNormal();
  const auto = battle.simulateBattle(initial, 6);
  const skip = dungeon.simulateDungeonV2Battle(initial, battle, 6);
  assert.deepEqual(skillLog(auto), skillLog(normal));
  assert.deepEqual(skillLog(skip), skillLog(normal));
  assert.equal(auto.units.enemy.dungeonV2CycleIndex, normal.units.enemy.dungeonV2CycleIndex);
  assert.equal(skip.units.enemy.dungeonV2CycleIndex, normal.units.enemy.dungeonV2CycleIndex);
});
