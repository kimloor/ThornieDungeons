const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const vfx = require("../src/ui/battleVfx.js");
global.HERO_SKILLS_V1_BY_ID = require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1_BY_ID;
global.PET_COMBAT_SKILLS_V2 = require("../src/systems/pets.js").PET_COMBAT_SKILLS_V2;
const battle = require("../src/systems/battleCore.js");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function battleState({ log = [], logSeq = 0, heroSp = 100, cooldown = 0 } = {}) {
  return {
    log,
    logSeq,
    heroId: "hero",
    petId: "pet",
    selectedTargetId: "m1",
    selectedTargetIds: { ally: "m1" },
    units: {
      hero: { id: "hero", kind: "hero", side: "ally", sp: heroSp, cooldowns: { toxic_strike: cooldown, silent_edge: cooldown, guard: cooldown, blade_storm: cooldown } },
      pet: { id: "pet", kind: "pet", side: "ally" },
      m1: { id: "m1", kind: "monster", side: "enemy" },
      m2: { id: "m2", kind: "monster", side: "enemy" }
    }
  };
}

test("Pack 01 uses the approved skill map and excludes Stunning Blow", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(vfx.SKILL_EFFECTS).map(([key, value]) => [key, value.effectKey])), {
    power_strike: "slash_basic",
    heavy_blow: "slash_heavy",
    toxic_strike: "slash_status.toxic",
    silent_edge: "slash_status.silence",
    guard: "buff_aura",
    blade_storm: "blade_storm"
  });
  assert.equal(vfx.SKILL_EFFECTS.stunning_blow, undefined);
});

test("resolved hit, miss and crit logs all keep the attack-attempt VFX", () => {
  const previous = battleState();
  for (const entry of [
    { seq: 1, type: "damage", actorId: "hero", targetId: "m1", crit: false },
    { seq: 1, type: "miss", actorId: "hero", targetId: "m1" },
    { seq: 1, type: "damage", actorId: "hero", targetId: "m1", crit: true }
  ]) {
    const next = battleState({ log: [entry], logSeq: 1, heroSp: 90 });
    assert.deepEqual(vfx.resolvedEvents(previous, next, previous.units.hero, { type: "active", skillId: "power_strike", targetId: "m1" }), [
      { effectKey: "slash_basic", kind: "single", targetId: "m1", skillId: "power_strike" }
    ]);
  }
});

test("status confirmation appears only for an actual resolved application", () => {
  const previous = battleState();
  const damage = { seq: 1, type: "damage", actorId: "hero", targetId: "m1" };
  const applied = battleState({ log: [damage, { seq: 2, type: "status", actorId: "hero", targetId: "m1", status: "poison" }], logSeq: 2, heroSp: 90 });
  const failed = battleState({ log: [damage], logSeq: 1, heroSp: 90 });
  const converted = battleState({ log: [damage, { seq: 2, type: "boss_conversion", actorId: "hero", targetId: "m1", status: "silence", conversion: "armor_pierce" }], logSeq: 2, heroSp: 90 });

  assert.deepEqual(vfx.resolvedEvents(previous, applied, previous.units.hero, { type: "active", skillId: "toxic_strike", targetId: "m1" }).map(event => event.effectKey), ["slash_status.toxic", "poison_hit"]);
  assert.deepEqual(vfx.resolvedEvents(previous, failed, previous.units.hero, { type: "active", skillId: "toxic_strike", targetId: "m1" }).map(event => event.effectKey), ["slash_status.toxic"]);
  assert.deepEqual(vfx.resolvedEvents(previous, converted, previous.units.hero, { type: "active", skillId: "silent_edge", targetId: "m1" }).map(event => event.effectKey), ["slash_status.silence"]);
});

test("Guard targets Hero and Blade Storm presents each resolved target once", () => {
  const previous = battleState();
  const guardNext = battleState({ logSeq: 0, heroSp: 90, cooldown: 2 });
  assert.deepEqual(vfx.resolvedEvents(previous, guardNext, previous.units.hero, { type: "active", skillId: "guard", targetId: "m1" }), [
    { effectKey: "buff_aura", kind: "aura", targetId: "hero", skillId: "guard" }
  ]);

  const bladeNext = battleState({
    heroSp: 80,
    logSeq: 3,
    log: [
      { seq: 1, type: "damage", actorId: "hero", targetId: "m1" },
      { seq: 2, type: "damage", actorId: "hero", targetId: "m2" },
      { seq: 3, type: "damage", actorId: "hero", targetId: "m1" }
    ]
  });
  assert.deepEqual(vfx.resolvedEvents(previous, bladeNext, previous.units.hero, { type: "active", skillId: "blade_storm", targetId: "m1" }).map(event => event.targetId), ["m1", "m2"]);
});

test("invalid/unexecuted commands, Auto basics and Skip create no Pack 01 VFX", () => {
  const previous = battleState();
  assert.deepEqual(vfx.resolvedEvents(previous, battleState(), previous.units.hero, { type: "active", skillId: "guard", targetId: "m1" }), []);
  assert.deepEqual(vfx.resolvedEvents(previous, battleState(), previous.units.hero, { type: "basic", targetId: "m1" }), []);
  assert.deepEqual(vfx.resolvedEvents(previous, battleState(), previous.units.hero, { type: "skip_battle" }), []);
});

test("manifest assets, speed artwork and safe presentation layer are wired", () => {
  const manifest = JSON.parse(read("r2-upload/manifest.json"));
  const expected = ["slash_basic", "slash_heavy", "poison_hit", "silence_hit", "buff_aura", "blade_storm"];
  expected.forEach(key => assert.equal(manifest.assets.battleVfx[key].length, 3));
  assert.equal(manifest.assets.battleVfx.slash_status.toxic.length, 3);
  assert.equal(manifest.assets.battleVfx.slash_status.silence.length, 3);
  assert.ok(manifest.assets.battleUi.buttons.speedX1);
  assert.ok(manifest.assets.battleUi.buttons.speedX2);

  const components = read("src/ui/components.js");
  const styles = read("src/data/styles.js");
  const app = read("src/ui/App.js");
  assert.match(components, /battleUiStyle\(combatSpeed === 2 \? "buttons\.speedX2" : "buttons\.speedX1"\)/);
  assert.match(components, /onError: \(\) => setFailedSources/);
  assert.match(styles, /\.md-battle-vfx[\s\S]*z-index: 4[\s\S]*pointer-events: none/);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*\.md-battle-vfx/);
  assert.match(app, /if \(heroCommand\?\.type === "skip_battle"\) \{\s*setBattleVfx\(\[\]\);\s*const resolved = BATTLE_CORE_V1\.simulateBattle/);
  assert.doesNotMatch(read("src/systems/battleCore.js"), /battleVfx|slash_basic|buff_aura/);
});

test("real Battle Core outcomes drive Toxic success/fail and Silence boss conversion", () => {
  const hero = skillId => ({
    id: "hero", kind: "hero", side: "ally", name: "Hero",
    hp: 500, maxHp: 500, sp: 100, maxSp: 100, atk: 45, def: 8,
    speed: 200, accuracy: 99, dodge: 0, crit: 0,
    activeSkills: [skillId], skills: { [skillId]: 1 }
  });
  const foe = (kind = "monster") => ({
    id: "m1", kind, side: "enemy", name: "Target",
    hp: 1000, maxHp: 1000, atk: 1, def: 3, speed: 10,
    accuracy: 99, dodge: 0, crit: 0, statusResist: 0
  });
  const resolve = (seed, skillId, kind = "monster") => {
    const state = battle.createBattle({ seed, hero: hero(skillId), enemies: [foe(kind)] });
    const command = { type: "active", skillId, targetId: "m1" };
    const result = battle.battleStep(state, command);
    return { state, result, events: vfx.resolvedEvents(state, result.state, state.units.hero, command, result.completedAction) };
  };

  const toxicRuns = Array.from({ length: 200 }, (_, index) => resolve(index + 1, "toxic_strike"));
  const toxicSuccess = toxicRuns.find(run => run.result.state.log.some(entry => entry.type === "status" && entry.status === "poison"));
  const toxicFail = toxicRuns.find(run => !run.result.state.log.some(entry => entry.type === "status" && entry.status === "poison"));
  assert.ok(toxicSuccess && toxicFail);
  assert.equal(toxicSuccess.events.some(event => event.effectKey === "poison_hit"), true);
  assert.equal(toxicFail.events.some(event => event.effectKey === "poison_hit"), false);

  const silentBoss = Array.from({ length: 200 }, (_, index) => resolve(index + 1, "silent_edge", "boss"))
    .find(run => run.result.state.log.some(entry => entry.type === "boss_conversion" && entry.status === "silence"));
  assert.ok(silentBoss);
  assert.equal(silentBoss.events.some(event => event.effectKey === "slash_status.silence"), true);
  assert.equal(silentBoss.events.some(event => event.effectKey === "silence_hit"), false);
});
