const test = require("node:test");
const assert = require("node:assert/strict");

global.HERO_SKILLS_V1_BY_ID = require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1_BY_ID;
global.PET_COMBAT_SKILLS_V2 = require("../src/systems/pets.js").PET_COMBAT_SKILLS_V2;
const battle = require("../src/systems/battleCore.js");
const { hero, pet, monster } = require("./fixtures/arena-v2-w9.js");

test("W9 baseline: Arena adapter keeps explicit targetId routing", () => {
  let state = battle.createArenaBattle({
    seed: 1,
    teamA: {
      hero: hero("hero-a", { speed: 200 }),
      pet: pet("pet-a", { speed: 20 })
    },
    teamB: {
      hero: hero("hero-b", { speed: 100 }),
      pet: pet("pet-b", { speed: 90 })
    }
  });

  const waiting = battle.battleStep(state);
  assert.equal(waiting.waiting, true);

  state = battle.battleStep(state, { type: "basic", targetId: "pet-b" }).state;
  assert.equal(state.units["hero-b"].hp, 200);
  assert.ok(state.units["pet-b"].hp < 80);
});

test("W9 baseline: Dungeon Pet-clutch semantics remain protected", () => {
  let state = battle.createDungeonBattle({
    seed: 8,
    hero: hero("hero", { hp: 0, dead: true }),
    pet: pet("pet", { atk: 200, speed: 200 }),
    enemies: [monster("m", { hp: 5, maxHp: 5 })]
  });

  state = battle.simulateBattle(state);
  assert.equal(state.result, "victory");
  assert.equal(state.flags.heroReviveNextFloor, true);
});
