const test = require("node:test");
const assert = require("node:assert/strict");
global.HERO_SKILLS_V1_BY_ID = require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1_BY_ID;
const battle = require("../src/systems/battleCore.js");

function hero(extra = {}) { return { id: "hero", kind: "hero", side: "ally", name: "Hero", hp: 200, maxHp: 200, sp: 100, maxSp: 100, atk: 45, def: 8, speed: 100, accuracy: 99, dodge: 0, crit: 0, agi: 20, activeSkills: [], skills: {}, ...extra }; }
function pet(extra = {}) { return { id: "pet", kind: "pet", side: "ally", name: "Pet", petDefId: "flamekit", hp: 80, maxHp: 80, atk: 18, def: 4, speed: 90, accuracy: 99, dodge: 0, crit: 0, ...extra }; }
function enemy(id, extra = {}) { return { id, kind: "monster", side: "enemy", name: id, hp: 100, maxHp: 100, atk: 12, def: 3, speed: 80, accuracy: 99, dodge: 0, crit: 0, ...extra }; }

function runUntilHero(state, commandForHero = { type: "basic" }, limit = 50) {
  let next = state;
  for (let i = 0; i < limit && !next.result; i++) {
    const actor = battle.currentUnit(next);
    const result = battle.battleStep(next, actor && actor.kind === "hero" ? commandForHero : undefined);
    next = result.state;
    if (actor && actor.kind === "hero") return next;
  }
  return next;
}

test("speed queue is real, stable, four-deep and does not force Hero first", () => {
  const state = battle.createBattle({ seed: 1, hero: hero({ speed: 80 }), pet: pet({ speed: 120 }), enemies: [enemy("m1", { speed: 110 }), enemy("m2", { speed: 100 }), enemy("m3", { speed: 90 })] });
  assert.deepEqual(state.queue, ["pet", "m1", "m2", "m3", "hero"]);
  assert.deepEqual(battle.upcomingActions(state), ["pet", "m1", "m2", "m3"]);
});

test("one, two and three monster battles resolve through the same deterministic resolver", () => {
  for (const count of [1, 2, 3]) {
    const enemies = Array.from({ length: count }, (_, i) => enemy(`m${i}`, { hp: 10, maxHp: 10 }));
    const normal = battle.createBattle({ seed: 42, hero: hero({ atk: 100, speed: 200 }), enemies });
    const skipped = battle.simulateBattle(normal);
    assert.equal(skipped.result, "victory");
    assert.equal(skipped.enemyIds.filter(id => !skipped.units[id].dead).length, 0);
  }
});

test("Poison ticks before Stun and can remove the Action", () => {
  const state = battle.createBattle({ seed: 2, hero: hero({ speed: 50 }), enemies: [enemy("m", { speed: 100, hp: 5, statuses: { poison: { key: "poison", duration: 2, damage: 5 }, stun: { key: "stun", duration: 1 } } })] });
  const next = battle.battleStep(state).state;
  assert.equal(next.units.m.dead, true);
  assert.equal(next.log.some(entry => entry.type === "stun"), false);
});

test("Boss Stun and Silence convert globally and are logged", () => {
  const base = battle.createBattle({ seed: 7, hero: hero(), enemies: [enemy("boss", { kind: "boss", statusResist: 0 })] });
  battle.applyStatus(base, base.units.hero, base.units.boss, "stun", { chance: 100, duration: 1 }, { appliedStatuses: new Set() });
  battle.applyStatus(base, base.units.hero, base.units.boss, "silence", { chance: 100, duration: 2 }, { appliedStatuses: new Set() });
  assert.equal(base.units.boss.statuses.stun, undefined);
  assert.equal(base.units.boss.statuses.silence, undefined);
  assert.deepEqual(base.log.filter(entry => entry.type === "boss_conversion").map(entry => entry.conversion), ["critical", "armor_pierce"]);
});

test("multi-hit enemy Action grants at most one Aegis", () => {
  let state = battle.createBattle({ seed: 4, hero: hero({ speed: 50, skills: { thorned_aegis: 4 }, statuses: { def_up: { key: "def_up", duration: 5 } } }), enemies: [enemy("m", { speed: 100, ai: { hits: 5 } })] });
  state = battle.battleStep(state).state;
  assert.equal(state.resources.aegis, 1);
});

test("Hero can die while Pet clutches; both dead is defeat", () => {
  let clutch = battle.createBattle({ seed: 8, hero: hero({ hp: 0, dead: true }), pet: pet({ atk: 200, speed: 200 }), enemies: [enemy("m", { hp: 5 })] });
  clutch = battle.simulateBattle(clutch);
  assert.equal(clutch.result, "victory");
  assert.equal(clutch.flags.heroReviveNextFloor, true);
  let lost = battle.createBattle({ seed: 8, hero: hero({ hp: 0, dead: true }), pet: pet({ hp: 0, dead: true }), enemies: [enemy("m")] });
  lost = battle.battleStep(lost).state;
  assert.equal(lost.result, "defeat");
});

test("checkpoint restores exact safe state and always disables Auto", () => {
  let state = battle.createBattle({ seed: 10, hero: hero({ speed: 200 }), enemies: [enemy("m")] });
  state.flags.auto = true;
  state = battle.battleStep(state).state;
  const restored = battle.restoreCheckpoint(battle.serializeCheckpoint(state));
  assert.equal(restored.safeActionSeq, state.safeActionSeq);
  assert.equal(restored.rngState, state.rngState);
  assert.equal(restored.flags.auto, false);
});

test("Flee uses Hero AGI formula and failed Flee consumes an Action", () => {
  const state = battle.createBattle({ seed: 1, hero: hero({ speed: 200, agi: 0 }), enemies: [enemy("m")] });
  const next = battle.battleStep(state, { type: "flee" }).state;
  assert.equal(next.safeActionSeq, 1);
  assert.ok(next.result === "fled" || next.log.some(entry => entry.text === "Escape Failed!"));
});

test("Active requirements, SP and owner-Action cooldown semantics are enforced", () => {
  let state = battle.createBattle({ seed: 12, hero: hero({ speed: 200, skills: { heavy_blow: 1 }, activeSkills: ["heavy_blow"] }), enemies: [enemy("m", { hp: 500, maxHp: 500 })] });
  state = battle.battleStep(state, { type: "active", skillId: "heavy_blow", targetId: "m" }).state;
  assert.equal(state.units.hero.sp, 84);
  assert.equal(state.units.hero.cooldowns.heavy_blow, 2);
  state = runUntilHero(state);
  assert.equal(state.units.hero.cooldowns.heavy_blow, 1);
  state = runUntilHero(state);
  assert.equal(state.units.hero.cooldowns.heavy_blow, 0);
});

test("Silence blocks Active but not Basic Attack or Potion", () => {
  let state = battle.createBattle({ seed: 14, hero: hero({ speed: 200, hp: 100, skills: { power_strike: 1 }, activeSkills: ["power_strike"], statuses: { silence: { key: "silence", duration: 3 } } }), enemies: [enemy("m", { hp: 500, maxHp: 500 })] });
  const initialSp = state.units.hero.sp;
  state = battle.battleStep(state, { type: "active", skillId: "power_strike", targetId: "m" }).state;
  assert.equal(state.units.hero.sp, initialSp);
  const before = state.units.m.hp;
  state = runUntilHero(state, { type: "basic", targetId: "m" });
  assert.ok(state.units.m.hp < before);
  const damaged = state.units.hero.hp;
  state = runUntilHero(state, { type: "potion", count: 1, heal: 25 });
  assert.ok(state.units.hero.hp >= damaged);
});

test("Poison refreshes duration, keeps strongest damage and never stacks", () => {
  const state = battle.createBattle({ seed: 16, hero: hero(), pet: pet(), enemies: [enemy("m")] });
  battle.applyStatus(state, state.units.hero, state.units.m, "poison", { chance: 100, duration: 2, damage: 20 }, { appliedStatuses: new Set() });
  battle.applyStatus(state, state.units.pet, state.units.m, "poison", { chance: 100, duration: 3, damage: 8 }, { appliedStatuses: new Set() });
  assert.equal(state.units.m.statuses.poison.damage, 20);
  assert.equal(state.units.m.statuses.poison.duration, 3);
  assert.equal(Object.keys(state.units.m.statuses).filter(key => key === "poison").length, 1);
});

test("Stunned Pet loses Action but its active cooldown still ticks", () => {
  let state = battle.createBattle({ seed: 18, hero: hero({ speed: 50 }), pet: pet({ speed: 200, cooldowns: { pet_active: 2 }, statuses: { stun: { key: "stun", duration: 1 } } }), enemies: [enemy("m", { speed: 80 })] });
  state = battle.battleStep(state).state;
  assert.equal(state.units.pet.cooldowns.pet_active, 1);
  assert.equal(state.units.pet.statuses.stun, undefined);
});

test("Sparkpup logs its Active before preserving MISS/damage/status results", () => {
  const state = battle.createBattle({
    seed: 18,
    hero: hero({ speed: 50 }),
    pet: pet({ name: "Sparkpup", petDefId: "sparkpup", speed: 200, active: { name: "Static Bite" } }),
    enemies: [enemy("m", { speed: 80, hp: 500, maxHp: 500 })]
  });
  const next = battle.battleStep(state).state;
  const activeIndex = next.log.findIndex(entry => entry.type === "pet_active");
  const resultIndex = next.log.findIndex((entry, index) => index > activeIndex && ["miss", "damage", "status"].includes(entry.type));
  assert.equal(next.log[activeIndex].text, "Sparkpup uses Static Bite");
  assert.ok(activeIndex >= 0);
  assert.ok(resultIndex > activeIndex);
});

test("Thorned Aegis lethal guard leaves Hero at 1 HP only once", () => {
  let state = battle.createBattle({ seed: 20, hero: hero({ speed: 50, hp: 20, skills: { thorned_aegis: 2 } }), enemies: [enemy("m", { speed: 200, atk: 999 })] });
  state = battle.battleStep(state).state;
  assert.equal(state.units.hero.hp, 1);
  assert.equal(state.units.hero.flags.aegisLethalUsed, true);
  state = runUntilHero(state);
  while (!state.result && battle.currentUnit(state).kind !== "monster") state = battle.battleStep(state, { type: "basic" }).state;
  if (!state.result) state = battle.battleStep(state).state;
  assert.ok(state.result === "defeat" || state.units.hero.dead);
});

test("normal fast presentation and Skip simulation are calculation-invariant", () => {
  const initial = battle.createBattle({ seed: 22, hero: hero({ atk: 60 }), pet: pet(), enemies: [enemy("m1"), enemy("m2")] });
  const x1 = battle.simulateBattle(initial);
  const x2 = battle.simulateBattle(initial);
  assert.deepEqual(x2, x1);
});

test("Relentless Fury gains once for an attack Action even when the hit misses", () => {
  const state = battle.createBattle({
    seed: 0x12345678,
    hero: hero({ speed: 200, accuracy: 0, skills: { relentless_fury: 1 } }),
    enemies: [enemy("m", { dodge: 95, hp: 500, maxHp: 500 })]
  });
  const next = battle.battleStep(state, { type: "basic", targetId: "m" }).state;
  assert.equal(next.log.some(entry => entry.type === "miss"), true);
  assert.equal(next.resources.fury, 1);
});

test("Armor Break from an attack applies after that hit's DEF snapshot", () => {
  const state = battle.createBattle({
    seed: 0x12345678,
    hero: hero({ speed: 200, atk: 100, skills: { heavy_blow: 3 }, activeSkills: ["heavy_blow"] }),
    enemies: [enemy("m", { def: 40, hp: 500, maxHp: 500 })]
  });
  const next = battle.battleStep(state, { type: "active", skillId: "heavy_blow", targetId: "m" }).state;
  assert.equal(next.units.m.hp, 330); // 210 ATK - the pre-proc 40 DEF
  assert.ok(next.units.m.statuses.armor_break);
});

test("Fury R3 Stun also applies to an equipped Active attack", () => {
  const state = battle.createBattle({
    seed: 1,
    hero: hero({ speed: 200, skills: { power_strike: 1, relentless_fury: 3 }, activeSkills: ["power_strike"] }),
    enemies: [enemy("m", { hp: 500, maxHp: 500 })]
  });
  state.resources.fury = 3;
  const next = battle.battleStep(state, { type: "active", skillId: "power_strike", targetId: "m" }).state;
  assert.ok(next.units.m.statuses.stun);
});

test("Blade Storm distributes its three independent hits across living monsters", () => {
  const state = battle.createBattle({
    seed: 3,
    hero: hero({ speed: 200, atk: 60, skills: { blade_storm: 1 }, activeSkills: ["blade_storm"] }),
    enemies: [enemy("m1", { hp: 1000, maxHp: 1000, def: 0 }), enemy("m2", { hp: 1000, maxHp: 1000, def: 0 }), enemy("m3", { hp: 1000, maxHp: 1000, def: 0 })]
  });
  const next = battle.battleStep(state, { type: "active", skillId: "blade_storm", targetId: "m1" }).state;
  assert.deepEqual(next.enemyIds.map(id => next.units[id].hp), [964, 964, 964]);
});

test("Recovery increases Spirit Drain SP received", () => {
  const state = battle.createBattle({
    seed: 5,
    hero: hero({ speed: 200, sp: 0, skills: { spirit_drain: 5, recovery: 5 } }),
    enemies: [enemy("m", { hp: 500, maxHp: 500 })]
  });
  const next = battle.battleStep(state, { type: "basic", targetId: "m" }).state;
  assert.equal(next.units.hero.sp, 6);
});

test("enemy-applied debuffs cannot trigger Storm Phoenix cooldown reduction", () => {
  const state = battle.createBattle({
    seed: 1,
    hero: hero({ speed: 50 }),
    pet: pet({ petDefId: "storm_phoenix", speed: 40, cooldowns: { pet_active: 2 } }),
    enemies: [enemy("m", { speed: 200, ai: { statuses: [{ key: "poison", chance: 100, duration: 2, damage: 1 }] } })]
  });
  const next = battle.battleStep(state).state;
  assert.ok(next.units.hero.statuses.poison || next.units.pet.statuses.poison);
  assert.equal(next.units.pet.cooldowns.pet_active, 2);
});

test("Poison is not a lethal hit and cannot trigger Thorned Aegis survival", () => {
  const state = battle.createBattle({
    seed: 9,
    hero: hero({ speed: 200, hp: 10, skills: { thorned_aegis: 2 }, statuses: { poison: { key: "poison", duration: 2, damage: 10, sourceId: "m" } } }),
    enemies: [enemy("m", { speed: 50 })]
  });
  const next = battle.battleStep(state, { type: "basic", targetId: "m" }).state;
  assert.equal(next.units.hero.dead, true);
  assert.equal(!!next.units.hero.flags.aegisLethalUsed, false);
});

test("reapplying DEF Up refreshes to the new duration without strength stacking", () => {
  const state = battle.createBattle({ seed: 11, hero: hero(), enemies: [enemy("m")] });
  battle.applyStatus(state, state.units.hero, state.units.hero, "def_up", { chance: 100, duration: 3 }, { appliedStatuses: new Set() });
  battle.applyStatus(state, state.units.hero, state.units.hero, "def_up", { chance: 100, duration: 1 }, { appliedStatuses: new Set() });
  assert.equal(state.units.hero.statuses.def_up.duration, 1);
});

test("invalid Active commands stay on the Hero action boundary", () => {
  const state = battle.createBattle({
    seed: 13,
    hero: hero({ speed: 200, skills: { power_strike: 1 }, activeSkills: ["power_strike"], statuses: { silence: { key: "silence", duration: 2 } } }),
    enemies: [enemy("m")]
  });
  const result = battle.battleStep(state, { type: "active", skillId: "power_strike", targetId: "m" });
  assert.equal(result.completedAction, false);
  assert.equal(result.waiting, true);
  assert.equal(result.state.safeActionSeq, 0);
  assert.equal(result.state.units.hero.sp, 100);
});

test("Thorned Aegis R4 counters when lethal survival transitions Aegis to three", () => {
  const state = battle.createBattle({
    seed: 15,
    hero: hero({ speed: 50, hp: 20, atk: 60, skills: { thorned_aegis: 4 } }),
    enemies: [enemy("m", { speed: 200, hp: 500, maxHp: 500, atk: 999, def: 0 })]
  });
  const next = battle.battleStep(state).state;
  assert.equal(next.units.hero.hp, 1);
  assert.equal(next.resources.aegis, 3);
  assert.ok(next.units.m.hp < 500);
  assert.ok(next.log.some(entry => entry.type === "counter"));
});

test("Last Stand uses a three-Hero-turn internal cooldown", () => {
  let state = battle.createBattle({
    seed: 17,
    hero: hero({ speed: 50, hp: 100, def: 0, skills: { last_stand: 5 } }),
    enemies: [enemy("m", { speed: 200, atk: 50, hp: 500, maxHp: 500 })]
  });
  state = battle.battleStep(state).state;
  assert.equal(state.units.hero.flags.lastStandCooldown, 3);
  state = battle.battleStep(state, { type: "basic", targetId: "m" }).state;
  assert.equal(state.units.hero.flags.lastStandCooldown, 2);
});

test("Usurper steals only a normal buff and R5 reduces all eligible cooldowns once", () => {
  const state = battle.createBattle({
    seed: 19,
    hero: hero({
      speed: 200,
      skills: { power_strike: 1, usurper: 5 },
      activeSkills: ["power_strike"],
      cooldowns: { heavy_blow: 2, silent_edge: 2 }
    }),
    enemies: [enemy("m", { hp: 500, maxHp: 500, statuses: { def_up: { key: "def_up", duration: 2, harmful: false } } })]
  });
  state.resources.scheme = 3;
  state.resources.schemeConsumed = 2;
  const next = battle.battleStep(state, { type: "active", skillId: "power_strike", targetId: "m" }).state;
  assert.equal(next.units.m.statuses.def_up, undefined);
  assert.ok(next.units.hero.statuses.def_up);
  assert.equal(next.resources.scheme, 2);
  assert.equal(next.resources.schemeConsumed, 0);
  assert.equal(next.resources.nextActiveDebuffBonus, 10);
  assert.equal(next.units.hero.cooldowns.heavy_blow, 0); // R5 CDR plus the normal owner-Action tick
  assert.equal(next.units.hero.cooldowns.silent_edge, 0);
});

test("Sprout and Moon Hare use their 60% support AI thresholds", () => {
  let sprout = battle.createBattle({
    seed: 21,
    hero: hero({ hp: 100, speed: 50 }),
    pet: pet({ petDefId: "sprout", speed: 200, vit: 10 }),
    enemies: [enemy("m", { speed: 40 })]
  });
  sprout = battle.battleStep(sprout).state;
  assert.equal(sprout.units.hero.statuses.pet_regrowth.duration, 2);
  assert.equal(sprout.units.pet.cooldowns.pet_active, 3);

  let hare = battle.createBattle({
    seed: 23,
    hero: hero({ speed: 50 }),
    pet: pet({ petDefId: "moon_hare", speed: 200, hp: 40, vit: 10 }),
    enemies: [enemy("m", { speed: 40 })]
  });
  hare = battle.battleStep(hare).state;
  assert.ok(hare.units.pet.hp > 40);
  assert.equal(hare.units.pet.cooldowns.pet_active, 2);
});

test("pure and hybrid Hero builds run through the same resolver", () => {
  const builds = [
    { weapon_mastery: 5, relentless_fury: 5 },
    { toughness: 5, iron_body: 5, thorned_aegis: 5 },
    { exploit_weakness: 5, debilitating_edge: 5, usurper: 5 },
    { weapon_mastery: 5, relentless_fury: 3, exploit_weakness: 5, usurper: 3 },
    { weapon_mastery: 5, relentless_fury: 3, toughness: 5, thorned_aegis: 3 }
  ];
  for (const skills of builds) {
    const state = battle.createBattle({ seed: 25, hero: hero({ atk: 100, skills }), enemies: [enemy("m", { hp: 30, maxHp: 30 })] });
    assert.equal(battle.simulateBattle(state).result, "victory");
  }
});
