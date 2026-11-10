const test = require("node:test");
const assert = require("node:assert/strict");
const skills = require("../src/systems/heroSkillsV1.js");

test("Hero V1 has three complete branches and centralized provisional values", () => {
  assert.deepEqual(new Set(skills.HERO_SKILLS_V1.map(skill => skill.branch)), new Set(["assault", "guard", "tactic"]));
  assert.equal(skills.HERO_SKILLS_V1_BY_ID.stunning_blow.ranks[2].mult, 1.85);
  assert.equal(skills.HERO_SKILLS_V1_BY_ID.silent_edge.ranks[2].mult, 1.9);
  assert.equal(skills.HERO_SKILL_V1_PLAYTEST.globalStatusProcCap, 90);
});

test("level budget, tier gates, prerequisites and keystone cost are enforced", () => {
  assert.equal(skills.heroSkillPointBudget(99), 98);
  assert.equal(skills.canSpendHeroSkillPoint(14, {}, "heavy_blow").reason, "level_gate");
  const tactic = { toxic_strike: 3, exploit_weakness: 3, debilitating_edge: 2 };
  assert.equal(skills.heroSkillBranchPoints(tactic, "tactic"), 8);
  assert.equal(skills.canSpendHeroSkillPoint(15, tactic, "stunning_blow").ok, true);
  const noPrereq = { ...tactic, stunning_blow: 3, spirit_drain: 5, toxic_mastery: 4, quick_recovery: 5, skill_efficiency: 5, master_tactician: 5, silent_edge: 0 };
  assert.equal(skills.canSpendHeroSkillPoint(60, noPrereq, "disruption").reason, "prerequisite");
  const guard = { toughness: 5, iron_body: 5, guard: 3, shield_wall: 3, recovery: 5, last_stand: 5, counter: 3, battle_hardened: 5, second_wind: 5, fortress: 1 };
  assert.equal(skills.heroSkillBranchPoints(guard, "guard"), 40);
  assert.deepEqual(skills.canSpendHeroSkillPoint(99, guard, "thorned_aegis"), { ok: true, cost: 2 });
});
