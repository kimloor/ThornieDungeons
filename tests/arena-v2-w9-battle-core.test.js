const test = require("node:test");
const assert = require("node:assert/strict");

global.HERO_SKILLS_V1_BY_ID = require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1_BY_ID;
global.PET_COMBAT_SKILLS_V2 = require("../src/systems/pets.js").PET_COMBAT_SKILLS_V2;
const battle = require("../src/systems/battleCore.js");
const { hero, pet, monster } = require("./fixtures/arena-v2-w9.js");

function arena(overrides = {}) {
  return battle.createArenaBattle({
    battleId: "w9-1-test",
    seed: 7,
    teamA: { hero: hero("hero-a", { speed: 200 }), ...(overrides.teamA || {}) },
    teamB: { hero: hero("hero-b", { speed: 100 }), ...(overrides.teamB || {}) },
    ...overrides
  });
}

function round20Draw() {
  const durableHero = id => hero(id, { hp: 9999, maxHp: 9999, atk: 1, def: 999, speed: id === "hero-a" ? 100 : 90 });
  let state = battle.createArenaBattle({
    battleId: "w9-1-draw",
    seed: 11,
    teamA: { hero: durableHero("hero-a") },
    teamB: { hero: durableHero("hero-b") }
  });
  return battle.simulateBattle(state);
}

test("Arena basic targetId routes to the requested enemy Hero", () => {
  const state = arena({ teamA: { hero: hero("hero-a", { speed: 200 }) }, teamB: { hero: hero("hero-b", { speed: 100 }), pet: pet("pet-b") } });
  const next = battle.battleStep(state, { type: "basic", targetId: "hero-b" }).state;
  assert.ok(next.units["hero-b"].hp < 200);
  assert.equal(next.units["pet-b"].hp, 80);
});

test("Arena basic targetId routes to the requested enemy Pet", () => {
  const state = arena({ teamA: { hero: hero("hero-a", { speed: 200 }) }, teamB: { hero: hero("hero-b", { speed: 100 }), pet: pet("pet-b") } });
  const next = battle.battleStep(state, { type: "basic", targetId: "pet-b" }).state;
  assert.equal(next.units["hero-b"].hp, 200);
  assert.ok(next.units["pet-b"].hp < 80);
});

test("Arena strict targeting rejects dead, friendly and nonexistent targets without action resources", () => {
  for (const targetId of ["pet-b", "hero-a", "missing-target"]) {
    const state = arena({
      teamA: { hero: hero("hero-a", { speed: 200, skills: { heavy_blow: 1 }, activeSkills: ["heavy_blow"] }) },
      teamB: { hero: hero("hero-b", { speed: 100 }), pet: pet("pet-b", { hp: 0, dead: true }) }
    });
    const before = { rngState: state.rngState, queueIndex: state.queueIndex, safeActionSeq: state.safeActionSeq, sp: state.units["hero-a"].sp, cooldowns: { ...state.units["hero-a"].cooldowns } };
    const result = battle.battleStep(state, { type: "active", skillId: "heavy_blow", targetId });
    assert.equal(result.completedAction, false);
    assert.equal(result.waiting, true);
    assert.equal(result.error, "Invalid target");
    assert.deepEqual({ rngState: result.state.rngState, queueIndex: result.state.queueIndex, safeActionSeq: result.state.safeActionSeq, sp: result.state.units["hero-a"].sp, cooldowns: result.state.units["hero-a"].cooldowns }, before);
  }
});

test("Arena metadata exposes legal targets and target requirements", () => {
  const state = arena({
    teamA: { hero: hero("hero-a", { speed: 200, skills: { power_strike: 1, rampage: 1, blade_storm: 1, disruption: 1 }, activeSkills: ["power_strike", "rampage", "blade_storm", "disruption"] }) },
    teamB: { hero: hero("hero-b", { speed: 100 }), pet: pet("pet-b") }
  });
  const basic = battle.getActionMetadata(state, "hero-a", { type: "basic" });
  assert.equal(basic.usable, true);
  assert.equal(basic.requiresEnemyTarget, true);
  assert.deepEqual(basic.legalTargetIds, ["hero-b", "pet-b"]);
  assert.equal(battle.isActionUsable(state, "hero-a", { type: "basic", targetId: "hero-b" }), true);
  assert.equal(battle.isActionUsable(state, "hero-a", { type: "basic", targetId: "hero-a" }), false);

  const self = battle.getActionMetadata(state, "hero-a", { type: "active", skillId: "rampage" });
  assert.equal(self.requiresEnemyTarget, false);
  assert.equal(self.isSelfTarget, true);
  assert.equal(self.isSupport, true);
  const aoe = battle.getActionMetadata(state, "hero-a", { type: "active", skillId: "blade_storm" });
  assert.equal(aoe.requiresEnemyTarget, false);
  assert.equal(aoe.isAoE, true);

  const debuff = battle.getActionMetadata(state, "hero-a", { type: "active", skillId: "disruption" });
  assert.equal(debuff.requiresEnemyTarget, true);
});

test("Arena self-buff and non-target AoE do not require a manual enemy target", () => {
  let state = arena({
    teamA: { hero: hero("hero-a", { speed: 200, skills: { rampage: 1 }, activeSkills: ["rampage"] }) },
    teamB: { hero: hero("hero-b", { speed: 100 }), pet: pet("pet-b") }
  });
  let result = battle.battleStep(state, { type: "active", skillId: "rampage" });
  assert.equal(result.completedAction, true);
  assert.ok(result.state.units["hero-a"].statuses.rampage);

  state = arena({
    teamA: { hero: hero("hero-a", { speed: 200, skills: { blade_storm: 1 }, activeSkills: ["blade_storm"] }) },
    teamB: { hero: hero("hero-b", { speed: 100 }), pet: pet("pet-b") }
  });
  result = battle.battleStep(state, { type: "active", skillId: "blade_storm" });
  assert.equal(result.completedAction, true);
  assert.ok(result.state.units["hero-b"].hp < 200);
  assert.ok(result.state.units["pet-b"].hp < 80);
});

test("Arena valid single-target Active uses the requested target", () => {
  const state = arena({
    teamA: { hero: hero("hero-a", { speed: 200, skills: { power_strike: 1 }, activeSkills: ["power_strike"] }) },
    teamB: { hero: hero("hero-b", { speed: 100 }), pet: pet("pet-b") }
  });
  const next = battle.battleStep(state, { type: "active", skillId: "power_strike", targetId: "pet-b" }).state;
  assert.equal(next.units["hero-b"].hp, 200);
  assert.ok(next.units["pet-b"].hp < 80);
  assert.equal(next.units["hero-a"].sp, 90);
});

test("Dungeon explicit invalid target keeps legacy automatic fallback", () => {
  const state = battle.createDungeonBattle({
    seed: 5,
    hero: hero("hero", { speed: 200 }),
    enemies: [monster("m1", { hp: 0, dead: true }), monster("m2", { speed: 100 })]
  });
  const next = battle.battleStep(state, { type: "basic", targetId: "m1" }).state;
  assert.ok(next.units.m2.hp < 100);
});

test("Arena Hero death is terminal even when the same side Pet survives", () => {
  const state = battle.createArenaBattle({
    seed: 1,
    teamA: { hero: hero("hero-a", { hp: 0, dead: true }), pet: pet("pet-a", { speed: 200 }) },
    teamB: { hero: hero("hero-b") }
  });
  assert.equal(state.result, "defeat");
  assert.equal(state.winnerSide, "team_b");
});

test("Arena defender Hero death is an immediate attacker win despite surviving defender Pet", () => {
  const state = battle.createArenaBattle({
    seed: 1,
    teamA: { hero: hero("hero-a") },
    teamB: { hero: hero("hero-b", { hp: 0, dead: true }), pet: pet("pet-b", { speed: 200 }) }
  });
  assert.equal(state.result, "victory");
  assert.equal(state.winnerSide, "team_a");
});

test("Arena Pet death alone is non-terminal while both Heroes remain alive", () => {
  const state = battle.createArenaBattle({
    seed: 1,
    teamA: { hero: hero("hero-a") },
    teamB: { hero: hero("hero-b"), pet: pet("pet-b", { hp: 0, dead: true }) }
  });
  assert.equal(state.result, null);
});

test("Dungeon Hero-dead Pet clutch and both-dead defeat remain unchanged", () => {
  let clutch = battle.createDungeonBattle({ hero: hero("hero", { hp: 0, dead: true }), pet: pet("pet", { atk: 200, speed: 200 }), enemies: [monster("m", { hp: 5, maxHp: 5 })] });
  clutch = battle.simulateBattle(clutch);
  assert.equal(clutch.result, "victory");
  assert.equal(clutch.flags.heroReviveNextFloor, true);

  const defeated = battle.createDungeonBattle({ hero: hero("hero", { hp: 0, dead: true }), pet: pet("pet", { hp: 0, dead: true }), enemies: [monster("m")] });
  assert.equal(defeated.result, "defeat");
});

test("Arena completes all Round-20 actions, then returns Draw without Round 21", () => {
  const state = round20Draw();
  assert.equal(state.result, "draw");
  assert.equal(state.round, 20);
  assert.equal(state.safeActionSeq, 40);
  assert.equal(state.log.filter(entry => ["damage", "miss"].includes(entry.type)).length, 40);
  assert.equal(state.log.some(entry => entry.text === "Round 21"), false);
});

test("Hero death during Round 20 takes precedence over Draw", () => {
  let state = arena({ teamA: { hero: hero("hero-a", { speed: 200, atk: 999 }) }, teamB: { hero: hero("hero-b", { speed: 100, hp: 1, maxHp: 1 }) } });
  state.round = 20;
  const result = battle.battleStep(state, { type: "basic", targetId: "hero-b" });
  assert.equal(result.state.result, "victory");
  assert.notEqual(result.state.result, "draw");
});

test("Pet death during Round 20 does not force a terminal result", () => {
  let state = arena({
    teamA: { hero: hero("hero-a", { speed: 200, atk: 999 }) },
    teamB: { hero: hero("hero-b", { speed: 50 }), pet: pet("pet-b", { speed: 100, hp: 1, maxHp: 1 }) }
  });
  state.round = 20;
  state.queue = ["hero-a", "pet-b", "hero-b"];
  state.queueIndex = 0;
  state = battle.battleStep(state, { type: "basic", targetId: "pet-b" }).state;
  assert.equal(state.result, null);
  assert.equal(state.units["pet-b"].dead, true);
});

test("Arena Draw survives serialization and restore", () => {
  const draw = round20Draw();
  const restored = battle.restoreCheckpoint(battle.serializeCheckpoint(draw));
  assert.equal(restored.result, "draw");
  assert.equal(restored.round, 20);
  assert.equal(restored.safeActionSeq, draw.safeActionSeq);
  assert.deepEqual(restored.units, draw.units);
});

test("same Arena seed and commands produce identical result and state", () => {
  const first = round20Draw();
  const second = round20Draw();
  assert.deepEqual(second, first);
});

test("rejected invalid target does not advance RNG or diverge the next valid action", () => {
  const initial = arena({ teamA: { hero: hero("hero-a", { speed: 200 }) }, teamB: { hero: hero("hero-b", { speed: 100 }) } });
  const untouched = JSON.parse(JSON.stringify(initial));
  const rejected = battle.battleStep(initial, { type: "basic", targetId: "missing" });
  assert.equal(rejected.state.rngState, untouched.rngState);
  assert.equal(rejected.state.safeActionSeq, untouched.safeActionSeq);
  const afterRejected = battle.battleStep(rejected.state, { type: "basic", targetId: "hero-b" }).state;
  const afterUntouched = battle.battleStep(untouched, { type: "basic", targetId: "hero-b" }).state;
  assert.equal(afterRejected.rngState, afterUntouched.rngState);
  assert.deepEqual(afterRejected.units, afterUntouched.units);
  assert.equal(afterRejected.safeActionSeq, afterUntouched.safeActionSeq);
});
