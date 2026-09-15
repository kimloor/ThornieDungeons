// ---------- Hero Skill System V1 ----------
// Shared skill catalog/data layer for Dungeon, Arena and Raid. Modes must import
// these ranks and values rather than freezing or duplicating their own copies.
// Battle values that were not locked in the source-of-truth documents live in
// one playtest object. They can be tuned later without changing resolver logic.
const HERO_SKILL_V1_PLAYTEST = Object.freeze({
  toxicStrike: { sp: 12, cooldown: 2 },
  stunningBlow: { sp: 16, cooldown: 3 },
  silentEdge: { sp: 18, cooldown: 3 },
  counter: { sp: 18, cooldown: 4 },
  disruption: { sp: 22, cooldown: 5, stunWeight: 0.5 },
  aegisCounterStunChance: 35,
  survivalReflectCapMaxHpPct: 10,
  globalStatusProcCap: 90
});

function heroSkill(id, branch, tier, kind, ranks, extra = {}) {
  return Object.freeze({ id, branch, tier, kind, maxRank: kind === "passive" ? 5 : kind === "keystone" ? 5 : 3, ranks, ...extra });
}

const HERO_SKILLS_V1 = Object.freeze([
  heroSkill("power_strike", "assault", 1, "active", [
    { mult: 1.45, sp: 10, cooldown: 0 }, { mult: 1.65, sp: 10, cooldown: 0 },
    { mult: 1.85, sp: 10, cooldown: 0, critDamageBonus: 15 }
  ]),
  heroSkill("weapon_mastery", "assault", 1, "passive", [2, 4, 6, 8, 10].map(damagePct => ({ damagePct }))),
  heroSkill("killer_instinct", "assault", 1, "passive", [2, 4, 6, 8, 10].map(critPct => ({ critPct, targetBelowPct: 50 }))),
  heroSkill("heavy_blow", "assault", 2, "active", [
    { mult: 1.7, armorBreakChance: 35 }, { mult: 1.9, armorBreakChance: 45 }, { mult: 2.1, armorBreakChance: 55 }
  ].map(rank => ({ ...rank, sp: 16, cooldown: 2 }))),
  heroSkill("bloodlust", "assault", 2, "passive", [4, 6, 8, 10, 12].map((damagePct, index) => ({ damagePct, hpAtMostPct: 40, critPct: index === 4 ? 5 : 0 }))),
  heroSkill("armor_break_mastery", "assault", 2, "passive", [5, 10, 15, 20, 25].map(procBonus => ({ procBonus }))),
  heroSkill("blade_storm", "assault", 3, "active", [
    { mult: 0.6 }, { mult: 0.7 }, { mult: 0.75, stunChancePerHit: 5 }
  ].map(rank => ({ ...rank, hits: 3, distribution: "living", sp: 24, cooldown: 3 }))),
  heroSkill("life_drain", "assault", 3, "passive", [1, 2, 3, 4, 5].map(drainPct => ({ drainPct, capMaxHpPct: 10 }))),
  heroSkill("finishing_blow", "assault", 3, "passive", [4, 7, 10, 13, 16].map(damagePct => ({ damagePct, targetAtMostPct: 40 }))),
  heroSkill("rampage", "assault", 4, "active", [
    { damagePct: 15, takenPct: 15 }, { damagePct: 18, critPct: 5, takenPct: 10 }, { damagePct: 20, critPct: 5, takenPct: 0 }
  ].map(rank => ({ ...rank, duration: 3, sp: 25, cooldown: 6, buff: "rampage" }))),
  heroSkill("critical_mastery", "assault", 4, "passive", [5, 10, 15, 20, 25].map(critDamagePct => ({ critDamagePct }))),
  heroSkill("relentless_fury", "assault", 5, "keystone", [1, 2, 3, 4, 5].map(rank => ({ rank }))),

  heroSkill("guard", "guard", 1, "active", [
    { mult: 1.05, duration: 1 }, { mult: 1.2, duration: 2 }, { mult: 1.35, duration: 2 }
  ].map(rank => ({ ...rank, sp: 10, cooldown: 2, status: "def_up" }))),
  heroSkill("toughness", "guard", 1, "passive", [3, 6, 9, 12, 15].map(maxHpPct => ({ maxHpPct }))),
  heroSkill("iron_body", "guard", 1, "passive", [2, 4, 6, 8, 10].map(defPct => ({ defPct }))),
  heroSkill("shield_wall", "guard", 2, "active", [
    { damagePenaltyPct: 20 }, { damagePenaltyPct: 10 }, { damagePenaltyPct: 0 }
  ].map(rank => ({ ...rank, sp: 18, cooldown: 4, duration: 3, status: "def_up" }))),
  heroSkill("recovery", "guard", 2, "passive", [4, 8, 12, 16, 20].map(receivedPct => ({ receivedPct }))),
  heroSkill("last_stand", "guard", 2, "passive", [20, 40, 60, 80, 100].map(chance => ({ chance, hpAtMostPct: 40, internalCooldown: 3 }))),
  heroSkill("counter", "guard", 3, "active", [
    { counterMult: 1 }, { counterMult: 1.3 }, { counterMult: 1.6, armorBreakChance: 35 }
  ].map(rank => ({ ...rank, sp: HERO_SKILL_V1_PLAYTEST.counter.sp, cooldown: HERO_SKILL_V1_PLAYTEST.counter.cooldown, duration: 1, buff: "counter" }))),
  heroSkill("battle_hardened", "guard", 3, "passive", [5, 10, 15, 20, 25].map(statusResist => ({ statusResist }))),
  heroSkill("second_wind", "guard", 3, "passive", [5, 7, 9, 11, 15].map(healMaxHpPct => ({ healMaxHpPct, oncePerBattle: true }))),
  heroSkill("fortress", "guard", 4, "active", [
    { defPct: 20, damagePenaltyPct: 20 }, { defPct: 25, damagePenaltyPct: 10 }, { defPct: 30, damagePenaltyPct: 0 }
  ].map(rank => ({ ...rank, sp: 28, cooldown: 7, duration: 2, buff: "fortress" }))),
  heroSkill("survival_instinct", "guard", 4, "passive", [
    [10, 5], [15, 7], [20, 9], [25, 12], [30, 15]
  ].map(([excessReductionPct, reflectPct]) => ({ thresholdMaxHpPct: 25, excessReductionPct, reflectPct }))),
  heroSkill("thorned_aegis", "guard", 5, "keystone", [1, 2, 3, 4, 5].map(rank => ({ rank }))),

  heroSkill("toxic_strike", "tactic", 1, "active", [
    { mult: 1.2, poisonChance: 30 }, { mult: 1.4, poisonChance: 40 }, { mult: 1.6, poisonChance: 50 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.toxicStrike }))),
  heroSkill("exploit_weakness", "tactic", 1, "passive", [2, 4, 6, 8, 10].map(damagePct => ({ damagePct }))),
  heroSkill("debilitating_edge", "tactic", 1, "passive", [3, 6, 9, 12, 15].map(procBonus => ({ procBonus }))),
  heroSkill("stunning_blow", "tactic", 2, "active", [
    { mult: 1.45, stunChance: 15 }, { mult: 1.65, stunChance: 25 }, { mult: 1.85, stunChance: 35 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.stunningBlow }))),
  heroSkill("spirit_drain", "tactic", 2, "passive", [1, 2, 3, 4, 5].map(spRestore => ({ spRestore }))),
  heroSkill("toxic_mastery", "tactic", 2, "passive", [5, 10, 15, 20, 25].map((poisonDamagePct, index) => ({ poisonDamagePct, durationBonus: index === 4 ? 1 : 0 }))),
  heroSkill("silent_edge", "tactic", 3, "active", [
    { mult: 1.5, silenceChance: 25 }, { mult: 1.7, silenceChance: 35 }, { mult: 1.9, silenceChance: 45 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.silentEdge }))),
  heroSkill("quick_recovery", "tactic", 3, "passive", [5, 8, 11, 14, 18].map(chance => ({ chance }))),
  heroSkill("skill_efficiency", "tactic", 3, "passive", [2, 4, 6, 8, 10].map(spReductionPct => ({ spReductionPct }))),
  heroSkill("disruption", "tactic", 4, "active", [
    { count: 2, procChance: 30 }, { count: 3, procChance: 35 }, { count: 4, procChance: 40 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.disruption, debuffOnly: true })), {
    prerequisites: { toxic_strike: 1, stunning_blow: 1, silent_edge: 1 }
  }),
  heroSkill("master_tactician", "tactic", 4, "passive", [5, 8, 11, 15, 20].map(chance => ({ chance })), {
    prerequisites: { skill_efficiency: 1 }
  }),
  heroSkill("usurper", "tactic", 5, "keystone", [1, 2, 3, 4, 5].map(rank => ({ rank })))
]);

const HERO_SKILLS_V1_BY_ID = Object.freeze(Object.fromEntries(HERO_SKILLS_V1.map(skill => [skill.id, skill])));
const HERO_SKILL_TIER_GATES = Object.freeze({ 1: { level: 1, points: 0 }, 2: { level: 15, points: 8 }, 3: { level: 30, points: 20 }, 4: { level: 50, points: 35 } });

function heroSkillPointBudget(level) { return Math.max(0, Math.min(98, Math.floor(Number(level) || 1) - 1)); }
function heroSkillRank(levels, id) { return Math.max(0, Math.floor(Number((levels || {})[id]) || 0)); }
function heroSkillBranchPoints(levels, branch) {
  return HERO_SKILLS_V1.filter(skill => skill.branch === branch).reduce((sum, skill) => sum + heroSkillRank(levels, skill.id) * (skill.kind === "keystone" ? 2 : 1), 0);
}
function heroSkillSpentPoints(levels) {
  return HERO_SKILLS_V1.reduce((sum, skill) => sum + heroSkillRank(levels, skill.id) * (skill.kind === "keystone" ? 2 : 1), 0);
}
function canSpendHeroSkillPoint(level, levels, id) {
  const skill = HERO_SKILLS_V1_BY_ID[id];
  if (!skill) return { ok: false, reason: "unknown_skill" };
  const rank = heroSkillRank(levels, id);
  if (rank >= skill.maxRank) return { ok: false, reason: "max_rank" };
  const cost = skill.kind === "keystone" ? 2 : 1;
  if (heroSkillSpentPoints(levels) + cost > heroSkillPointBudget(level)) return { ok: false, reason: "not_enough_sp" };
  const branchPoints = heroSkillBranchPoints(levels, skill.branch);
  if (skill.kind === "keystone") {
    if (branchPoints < 40) return { ok: false, reason: "keystone_points" };
    if (!HERO_SKILLS_V1.some(candidate => candidate.branch === skill.branch && candidate.tier === 4 && heroSkillRank(levels, candidate.id) > 0)) return { ok: false, reason: "keystone_t4" };
  } else {
    const gate = HERO_SKILL_TIER_GATES[skill.tier] || HERO_SKILL_TIER_GATES[1];
    if ((Number(level) || 1) < gate.level) return { ok: false, reason: "level_gate" };
    if (branchPoints < gate.points) return { ok: false, reason: "branch_points" };
  }
  for (const [requiredId, requiredRank] of Object.entries(skill.prerequisites || {})) {
    if (heroSkillRank(levels, requiredId) < requiredRank) return { ok: false, reason: "prerequisite", requiredId };
  }
  return { ok: true, cost };
}

function heroSkillRankData(levels, id) {
  const skill = HERO_SKILLS_V1_BY_ID[id];
  const rank = heroSkillRank(levels, id);
  return skill && rank ? skill.ranks[rank - 1] : null;
}
function heroActiveSkillList(levels) {
  const icons = { power_strike: "⚔️", heavy_blow: "🔨", blade_storm: "🌪️", rampage: "🔥", guard: "🛡️", shield_wall: "🏰", counter: "↩️", fortress: "🏯", toxic_strike: "☠️", stunning_blow: "💫", silent_edge: "🤫", disruption: "🎭" };
  return HERO_SKILLS_V1.filter(skill => skill.kind === "active" && heroSkillRank(levels, skill.id) > 0).map(skill => {
    const data = heroSkillRankData(levels, skill.id);
    return { key: skill.id, name: skill.id.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" "), icon: icons[skill.id] || "✨", mp: data.sp || 0, cooldown: data.cooldown || 0, desc: `${skill.branch} Rank ${heroSkillRank(levels, skill.id)}` };
  });
}

if (typeof module !== "undefined") module.exports = {
  HERO_SKILL_V1_PLAYTEST, HERO_SKILLS_V1, HERO_SKILLS_V1_BY_ID, HERO_SKILL_TIER_GATES,
  heroSkillPointBudget, heroSkillRank, heroSkillBranchPoints, heroSkillSpentPoints,
  canSpendHeroSkillPoint, heroSkillRankData, heroActiveSkillList
};
