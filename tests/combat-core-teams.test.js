const test = require("node:test");
const assert = require("node:assert/strict");

global.HERO_SKILLS_V1_BY_ID = require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1_BY_ID;
global.PET_COMBAT_SKILLS_V2 = require("../src/systems/pets.js").PET_COMBAT_SKILLS_V2;
const battle = require("../src/systems/battleCore.js");
const petSkills = global.PET_COMBAT_SKILLS_V2;

function hero(id, extra = {}) {
  return {
    id, kind: "hero", name: id, hp: 200, maxHp: 200, sp: 100, maxSp: 100,
    atk: 45, def: 8, speed: 100, accuracy: 99, dodge: 0, crit: 0, agi: 20,
    activeSkills: [], skills: {}, ...extra
  };
}
function pet(id, extra = {}) {
  return {
    id, kind: "pet", name: id, petDefId: "flamekit", hp: 80, maxHp: 80,
    atk: 18, def: 4, speed: 90, accuracy: 99, dodge: 0, crit: 0,
    active: { name: "Flame Claw" }, ...extra
  };
}
function monster(id, extra = {}) {
  return {
    id, kind: "monster", name: id, hp: 100, maxHp: 100, atk: 12, def: 3,
    speed: 80, accuracy: 99, dodge: 0, crit: 0, ...extra
  };
}

test("legacy Dungeon API keeps its aliases while exposing the generic two-team model", () => {
  const state = battle.createDungeonBattle({
    seed: 1,
    hero: hero("hero"),
    pet: pet("pet"),
    enemies: [monster("m1"), monster("m2")]
  });
  assert.deepEqual(state.teamIds, ["ally", "enemy"]);
  assert.deepEqual(state.teams.ally.unitIds, ["hero", "pet"]);
  assert.deepEqual(state.teams.enemy.unitIds, ["m1", "m2"]);
  assert.equal(state.controlledSide, "ally");
  assert.equal(state.heroId, "hero");
  assert.equal(state.petId, "pet");
  assert.deepEqual(state.enemyIds, ["m1", "m2"]);
  assert.equal(state.resources, state.teamResources.ally);
});

test("Hero and Pet combat values come from their shared catalogs", () => {
  assert.equal(battle.BATTLE_MODE_ADAPTERS.dungeon.allowFlee, true);
  assert.equal(battle.BATTLE_MODE_ADAPTERS.arena.allowFlee, false);
  assert.equal(battle.BATTLE_MODE_ADAPTERS.raid.allowFlee, false);
  assert.equal(petSkills.flamekit.active.mult, 1.35);
  assert.equal(petSkills.storm_phoenix.active.cooldown, 3);
  assert.equal(petSkills.inferno_drake.extra.type, "heroBlock");
});

test("Arena adapter resolves Hero skills on both sides through one catalog and resolver", () => {
  let state = battle.createArenaBattle({
    seed: 1,
    teamA: {
      hero: hero("hero-a", { speed: 200, skills: { power_strike: 1, relentless_fury: 1 }, activeSkills: ["power_strike"] }),
      pet: pet("pet-a", { speed: 80 })
    },
    teamB: {
      hero: hero("hero-b", { speed: 150, skills: { relentless_fury: 1 } }),
      pet: pet("pet-b", { speed: 70 })
    }
  });
  assert.equal(state.mode, "arena");
  assert.equal(state.rules.allowFlee, false);
  assert.equal(battle.battleStep(state).waiting, true);

  state = battle.battleStep(state, { type: "active", skillId: "power_strike", targetId: "hero-b" }).state;
  assert.ok(state.units["hero-b"].hp < 200);
  assert.equal(state.teamResources.team_a.fury, 1);
  assert.equal(state.teamResources.team_b.fury, 0);

  const before = state.units["hero-a"].hp + state.units["pet-a"].hp;
  const opponentTurn = battle.battleStep(state);
  state = opponentTurn.state;
  assert.equal(opponentTurn.waiting, false);
  assert.equal(opponentTurn.completedAction, true);
  assert.ok(state.units["hero-a"].hp + state.units["pet-a"].hp < before);
  assert.equal(state.teamResources.team_b.fury, 1);
});

test("generic battle outcome is relative to the controlled side", () => {
  const initial = battle.createTeamBattle({
    mode: "arena",
    seed: 3,
    controlledSide: "blue",
    teams: [
      { id: "blue", units: [hero("blue-hero", { atk: 300, speed: 200 })] },
      { id: "red", units: [hero("red-hero", { hp: 20, maxHp: 20, speed: 10 })] }
    ]
  });
  const finished = battle.simulateBattle(initial);
  assert.equal(finished.result, "victory");
  assert.equal(finished.winnerSide, "blue");
  assert.equal(finished.units["red-hero"].dead, true);
});

test("Pet AI heals and attacks relative to its own side", () => {
  let support = battle.createArenaBattle({
    seed: 21,
    teamA: { hero: hero("hero-a", { speed: 10, hp: 100 }), pet: pet("pet-a", { speed: 5 }) },
    teamB: {
      hero: hero("hero-b", { speed: 20, hp: 100 }),
      pet: pet("sprout-b", { petDefId: "sprout", name: "Sprout", speed: 200, maxHp: 200, hp: 200, vit: 10, active: { name: "Regrowth" } })
    }
  });
  support = battle.battleStep(support).state;
  assert.ok(support.units["hero-b"].statuses.pet_regrowth);
  assert.equal(support.units["hero-a"].statuses.pet_regrowth, undefined);

  let aoe = battle.createArenaBattle({
    seed: 23,
    teamA: { hero: hero("hero-a", { speed: 10 }), pet: pet("pet-a", { speed: 5 }) },
    teamB: {
      hero: hero("hero-b", { speed: 20 }),
      pet: pet("phoenix-b", { petDefId: "storm_phoenix", name: "Storm Phoenix", speed: 200, active: { name: "Tempest Strike" } })
    }
  });
  aoe = battle.battleStep(aoe).state;
  assert.ok(aoe.units["hero-a"].hp < 200);
  assert.ok(aoe.units["pet-a"].hp < 80);
  assert.equal(aoe.units["hero-b"].hp, 200);
});

test("Raid adapter reuses shared boss conversion and disallows Flee", () => {
  const state = battle.createRaidBattle({
    seed: 7,
    hero: hero("hero"),
    pet: pet("pet"),
    raidBoss: monster("raid", { name: "Raid Boss", hp: 1000, maxHp: 1000 })
  });
  assert.equal(state.mode, "raid");
  assert.equal(state.rules.allowFlee, false);
  assert.equal(state.units.raid.kind, "raid_boss");
  const converted = battle.applyStatus(state, state.units.hero, state.units.raid, "stun", { chance: 100 }, { appliedStatuses: new Set() });
  assert.equal(converted.converted, "critical");
  assert.equal(state.units.raid.statuses.stun, undefined);
});

test("old V1 checkpoints gain team metadata without changing their combat aliases", () => {
  const legacy = battle.createBattle({ seed: 9, hero: hero("hero"), pet: pet("pet"), enemies: [monster("m")] });
  delete legacy.teamIds;
  delete legacy.teams;
  delete legacy.controlledSide;
  delete legacy.teamResources;
  delete legacy.selectedTargetIds;
  delete legacy.heroTurnCounts;
  const restored = battle.restoreCheckpoint(legacy);
  assert.deepEqual(restored.teamIds, ["ally", "enemy"]);
  assert.equal(restored.heroId, "hero");
  assert.equal(restored.petId, "pet");
  assert.deepEqual(restored.enemyIds, ["m"]);
  assert.equal(restored.resources, restored.teamResources.ally);
});
