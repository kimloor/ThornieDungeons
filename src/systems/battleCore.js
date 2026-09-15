// ---------- Battle Core V1 ----------
// Generic, pure and serializable combat resolver. Dungeon, future Arena/Raid
// adapters, UI, Auto and Skip must call this core instead of forking skill logic.
(function battleCoreFactory(root) {
  const STATUS_PROC_CAP = 90;
  const STATUS_KEYS = new Set(["poison", "stun", "silence", "armor_break", "def_up"]);
  const HARMFUL = new Set(["poison", "stun", "silence", "armor_break"]);
  const STEALABLE_BLOCKLIST = new Set(["fury", "aegis", "scheme", "phase", "immunity", "boss_mechanic"]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const pct = value => clamp(value, 0, 100) / 100;
  const copy = value => JSON.parse(JSON.stringify(value));
  const living = unit => unit && !unit.dead && unit.hp > 0;
  const hpPct = unit => unit && unit.maxHp ? unit.hp / unit.maxHp * 100 : 0;
  const status = (unit, key) => unit.statuses && unit.statuses[key];
  const rank = (unit, id) => Math.max(0, Math.floor(Number(unit.skills && unit.skills[id]) || 0));
  const unitName = unit => String(unit && (unit.name || unit.id) || "Unknown");
  const title = id => String(id || "skill").split("_").map(word => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
  const attackActionName = (spec, context) => spec.actionName
    || (spec.actionType === "active" ? title(spec.id || context.usedSkillId) : spec.actionType === "counter" ? "counter attack" : "basic attack");
  const freshResources = () => ({ fury: 0, aegis: 0, scheme: 0, schemeConsumed: 0, nextActiveDebuffBonus: 0 });

  // Mode adapters own entry rules only. Damage, status, skills, cooldowns and
  // turn resolution remain shared below for every mode.
  const BATTLE_MODE_ADAPTERS = Object.freeze({
    dungeon: Object.freeze({ controlledSide: "ally", allowFlee: true, bossControlStatusConversion: true }),
    arena: Object.freeze({ controlledSide: "team_a", allowFlee: false, bossControlStatusConversion: true }),
    raid: Object.freeze({ controlledSide: "ally", allowFlee: false, bossControlStatusConversion: true })
  });

  function nextRandom(state) {
    let x = (state.rngState >>> 0) || 0x6d2b79f5;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rngState = x >>> 0;
    return state.rngState / 4294967296;
  }
  function chance(state, percent) { return nextRandom(state) * 100 < clamp(percent, 0, 100); }
  function choose(state, list) { return list.length ? list[Math.floor(nextRandom(state) * list.length)] : null; }
  function chooseWeighted(state, list, weightFor) {
    const total = list.reduce((sum, item) => sum + Math.max(0, Number(weightFor(item)) || 0), 0);
    if (!list.length || total <= 0) return null;
    let roll = nextRandom(state) * total;
    for (const item of list) {
      roll -= Math.max(0, Number(weightFor(item)) || 0);
      if (roll <= 0) return item;
    }
    return list[list.length - 1];
  }
  function log(state, type, text, data = {}) {
    state.log.push({ seq: ++state.logSeq, round: state.round, type, text, ...data });
    if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
  }

  function normalizeUnit(raw, index, defaultSide) {
    const unit = copy(raw || {});
    unit.id = String(unit.id || `unit-${index}`);
    unit.kind = unit.kind || "monster";
    unit.side = String(defaultSide || unit.side || (unit.kind === "monster" || unit.kind === "boss" || unit.kind === "raid_boss" ? "enemy" : "ally"));
    unit.maxHp = Math.max(1, Math.round(Number(unit.maxHp) || Number(unit.hp) || 1));
    unit.hp = clamp(Math.round(Number(unit.hp == null ? unit.maxHp : unit.hp)), 0, unit.maxHp);
    unit.maxSp = Math.max(0, Math.round(Number(unit.maxSp) || 0));
    unit.sp = clamp(Math.round(Number(unit.sp == null ? unit.maxSp : unit.sp)), 0, unit.maxSp);
    unit.atk = Math.max(1, Number(unit.atk) || 1);
    unit.def = Math.max(0, Number(unit.def) || 0);
    unit.speed = Math.max(0, Number(unit.speed) || 0);
    unit.accuracy = clamp(unit.accuracy == null ? unit.hitRate == null ? 95 : unit.hitRate : unit.accuracy, 0, 99);
    unit.dodge = clamp(unit.dodge == null ? unit.evasion || 0 : unit.dodge, 0, 95);
    unit.crit = clamp(unit.crit == null ? unit.critChance || 0 : unit.crit, 0, 100);
    unit.critDamage = Math.max(1, Number(unit.critDamage) || 1.5);
    unit.statusResist = clamp(unit.statusResist || 0, 0, 100);
    unit.statuses = copy(unit.statuses || {});
    unit.cooldowns = copy(unit.cooldowns || {});
    unit.skills = copy(unit.skills || {});
    unit.activeSkills = Array.isArray(unit.activeSkills) ? unit.activeSkills.slice(0, 4) : [];
    unit.ai = copy(unit.ai || {});
    unit.flags = copy(unit.flags || {});
    unit.tieOrder = Number.isFinite(unit.tieOrder) ? unit.tieOrder : index;
    unit.dead = unit.hp <= 0 || !!unit.dead;
    return unit;
  }

  function buildHeroUnit(raw = {}, index = 0, side) { return normalizeUnit({ ...raw, kind: "hero" }, index, side || raw.side || "ally"); }
  function buildPetUnit(raw = {}, index = 1, side) { return normalizeUnit({ ...raw, kind: "pet" }, index, side || raw.side || "ally"); }
  function buildMonsterUnit(raw = {}, index = 0, side) {
    const kind = raw.kind === "boss" || raw.kind === "raid_boss" ? raw.kind : "monster";
    return normalizeUnit({ ...raw, kind }, index + 2, side || raw.side || "enemy");
  }

  // The team/side model is the reusable boundary: exactly two sides, each with
  // any supported unit kinds. Legacy Dungeon ids remain compatibility aliases.
  function teamUnits(state, side) {
    return Object.values(state.units || {}).filter(unit => unit.side === side);
  }
  function livingTeamUnits(state, side) { return teamUnits(state, side).filter(living); }
  function opposingUnits(state, actorOrSide) {
    const side = typeof actorOrSide === "string" ? actorOrSide : actorOrSide && actorOrSide.side;
    return Object.values(state.units || {}).filter(unit => living(unit) && unit.side !== side);
  }
  function heroForSide(state, side) { return teamUnits(state, side).find(unit => unit.kind === "hero") || null; }
  function petForSide(state, side) { return teamUnits(state, side).find(unit => unit.kind === "pet") || null; }
  function resourcesFor(state, actorOrSide) {
    const side = typeof actorOrSide === "string" ? actorOrSide : actorOrSide && actorOrSide.side;
    if (side === state.controlledSide) return state.resources;
    state.teamResources = state.teamResources || {};
    state.teamResources[side] = state.teamResources[side] || freshResources();
    return state.teamResources[side];
  }
  function resetBattleResources(state) {
    for (const side of state.teamIds || []) Object.assign(resourcesFor(state, side), freshResources());
  }
  function ensureTeamModel(state) {
    const sides = Array.from(new Set(Object.values(state.units || {}).map(unit => unit.side)));
    state.teamIds = Array.isArray(state.teamIds) && state.teamIds.length ? state.teamIds : sides;
    state.controlledSide = state.controlledSide || (state.heroId && state.units[state.heroId] && state.units[state.heroId].side) || state.teamIds[0];
    state.teams = state.teams || Object.fromEntries(state.teamIds.map(side => [side, { id: side, unitIds: teamUnits(state, side).map(unit => unit.id) }]));
    state.teamResources = state.teamResources || {};
    state.resources = state.resources || state.teamResources[state.controlledSide] || freshResources();
    state.teamResources[state.controlledSide] = state.resources;
    for (const side of state.teamIds) state.teamResources[side] = state.teamResources[side] || freshResources();
    state.selectedTargetIds = state.selectedTargetIds || {};
    for (const side of state.teamIds) {
      if (!state.selectedTargetIds[side]) state.selectedTargetIds[side] = opposingUnits(state, side)[0]?.id || null;
    }
    state.selectedTargetId = state.selectedTargetId || state.selectedTargetIds[state.controlledSide] || null;
    state.selectedTargetIds[state.controlledSide] = state.selectedTargetId;
    state.heroTurnCounts = state.heroTurnCounts || (state.heroId ? { [state.heroId]: Number(state.heroTurnCount) || 0 } : {});
    return state;
  }

  function createBattleState(options, input, adapter) {
    const units = {};
    input.forEach(unit => {
      if (units[unit.id]) throw new Error("battle_duplicate_unit_id");
      units[unit.id] = unit;
    });
    const teamIds = Array.from(new Set(input.map(unit => unit.side)));
    if (teamIds.length !== 2 || teamIds.some(side => !input.some(unit => unit.side === side))) throw new Error("battle_requires_two_teams");
    const controlledSide = String(options.controlledSide || adapter.controlledSide || teamIds[0]);
    if (!teamIds.includes(controlledSide)) throw new Error("battle_invalid_controlled_side");
    const controlledUnits = input.filter(unit => unit.side === controlledSide);
    const hero = controlledUnits.find(unit => unit.kind === "hero") || null;
    const pet = controlledUnits.find(unit => unit.kind === "pet") || null;
    const enemies = input.filter(unit => unit.side !== controlledSide);
    const teamResources = Object.fromEntries(teamIds.map(side => [side, freshResources()]));
    const state = {
      version: 1,
      battleId: String(options.battleId || `battle-${Date.now()}`),
      mode: options.mode || "dungeon",
      floor: Math.max(1, Math.floor(Number(options.floor) || 1)),
      round: 0, queue: [], queueIndex: 0, speedSnapshot: {},
      teamIds,
      teams: Object.fromEntries(teamIds.map(side => [side, { id: side, unitIds: input.filter(unit => unit.side === side).map(unit => unit.id) }])),
      controlledSide,
      teamResources,
      units, heroId: hero ? hero.id : null, petId: pet ? pet.id : null, enemyIds: enemies.map(unit => unit.id),
      selectedTargetId: enemies[0].id,
      selectedTargetIds: Object.fromEntries(teamIds.map(side => [side, input.find(unit => unit.side !== side)?.id || null])),
      heroTurnCount: 0, heroTurnCounts: {},
      resources: teamResources[controlledSide],
      flags: { auto: false, skipResolving: false, heroReviveNextFloor: false, fled: false },
      result: null, safeActionSeq: 0, logSeq: 0,
      rngState: (Number(options.seed) >>> 0) || 0x12345678, log: [],
      rules: {
        allowFlee: options.allowFlee == null ? adapter.allowFlee : options.allowFlee !== false,
        bossControlStatusConversion: adapter.bossControlStatusConversion !== false,
        ...(options.rules || {})
      }
    };
    rebuildQueue(state);
    log(state, "battle_start", "Battle started");
    return state;
  }
  function createTeamBattle(options = {}) {
    const mode = options.mode || "arena";
    const adapter = BATTLE_MODE_ADAPTERS[mode] || BATTLE_MODE_ADAPTERS.arena;
    const teams = Array.isArray(options.teams) ? options.teams : [];
    const input = teams.flatMap((team, teamIndex) => (team.units || []).map((raw, unitIndex) => {
      const index = teamIndex * 100 + unitIndex;
      const side = String(team.id || `team_${teamIndex + 1}`);
      if (raw.kind === "hero") return buildHeroUnit(raw, index, side);
      if (raw.kind === "pet") return buildPetUnit(raw, index, side);
      return buildMonsterUnit(raw, index, side);
    }));
    return createBattleState({ ...options, mode }, input, adapter);
  }
  function createBattle(options = {}) {
    if (Array.isArray(options.teams)) return createTeamBattle(options);
    const input = [
      options.hero && buildHeroUnit(options.hero, 0, "ally"),
      options.pet && buildPetUnit(options.pet, 1, "ally"),
      ...(options.enemies || []).map((enemy, index) => buildMonsterUnit(enemy, index, "enemy"))
    ].filter(Boolean);
    const hero = input.find(unit => unit.kind === "hero" && unit.side === "ally");
    const enemies = input.filter(unit => unit.side === "enemy");
    if (!hero || !enemies.length) throw new Error("battle_requires_hero_and_enemy");
    const modeAdapter = BATTLE_MODE_ADAPTERS[options.mode] || BATTLE_MODE_ADAPTERS.dungeon;
    return createBattleState({ ...options, mode: options.mode || "dungeon" }, input, { ...modeAdapter, controlledSide: "ally" });
  }
  function createDungeonBattle(options = {}) {
    return createBattle({ ...options, mode: "dungeon", allowFlee: true });
  }
  function createArenaBattle(options = {}) {
    return createTeamBattle({ ...options, mode: "arena", controlledSide: options.controlledSide || "team_a", teams: [
      { id: "team_a", units: [options.teamA?.hero && { ...options.teamA.hero, kind: "hero" }, options.teamA?.pet && { ...options.teamA.pet, kind: "pet" }, ...(options.teamA?.units || [])].filter(Boolean) },
      { id: "team_b", units: [options.teamB?.hero && { ...options.teamB.hero, kind: "hero" }, options.teamB?.pet && { ...options.teamB.pet, kind: "pet" }, ...(options.teamB?.units || [])].filter(Boolean) }
    ] });
  }
  function createRaidBattle(options = {}) {
    const boss = options.raidBoss || options.boss || (options.enemies || [])[0];
    return createBattle({ ...options, mode: "raid", allowFlee: false, enemies: boss ? [{ ...boss, kind: "raid_boss" }] : [] });
  }

  function rebuildQueue(state) {
    state.round += 1;
    const candidates = Object.values(state.units).filter(living);
    state.speedSnapshot = Object.fromEntries(candidates.map(unit => [unit.id, Number(unit.speed) || 0]));
    state.queue = candidates.sort((a, b) => state.speedSnapshot[b.id] - state.speedSnapshot[a.id] || a.tieOrder - b.tieOrder || a.id.localeCompare(b.id)).map(unit => unit.id);
    state.queueIndex = 0;
    log(state, "round", `Round ${state.round}`);
  }

  function currentUnit(state) {
    while (state.queueIndex < state.queue.length && !living(state.units[state.queue[state.queueIndex]])) state.queueIndex += 1;
    if (state.queueIndex >= state.queue.length && !state.result) rebuildQueue(state);
    return state.units[state.queue[state.queueIndex]] || null;
  }

  function upcomingActions(state, count = 4) {
    if (state.result) return [];
    const visible = state.queue.slice(state.queueIndex).filter(id => living(state.units[id]));
    if (visible.length >= count) return visible.slice(0, count);
    const next = Object.values(state.units).filter(living).sort((a, b) => Number(b.speed) - Number(a.speed) || a.tieOrder - b.tieOrder || a.id.localeCompare(b.id)).map(unit => unit.id);
    return visible.concat(next).slice(0, count);
  }

  function hasDebuff(unit) { return Object.keys(unit.statuses || {}).some(key => HARMFUL.has(key)); }
  function effectiveDef(unit) {
    let value = unit.def;
    if (status(unit, "armor_break")) value *= 0.85;
    if (status(unit, "fortress")) value *= 1 + pct(status(unit, "fortress").defPct);
    return Math.max(0, value);
  }
  function activeBuffDamageMultiplier(unit) {
    let mult = 1;
    if (status(unit, "rampage")) mult *= 1 + pct(status(unit, "rampage").damagePct);
    if (status(unit, "shield_wall")) mult *= 1 - pct(status(unit, "shield_wall").damagePenaltyPct);
    if (status(unit, "fortress")) mult *= 1 - pct(status(unit, "fortress").damagePenaltyPct);
    return mult;
  }
  function heroPassiveDamageMultiplier(state, actor, target) {
    if (actor.kind !== "hero") return 1;
    const resources = resourcesFor(state, actor);
    let bonus = 0;
    const wm = skillData(actor, "weapon_mastery"); if (wm) bonus += wm.damagePct;
    const bloodlust = skillData(actor, "bloodlust"); if (bloodlust && hpPct(actor) <= 40) bonus += bloodlust.damagePct;
    const finish = skillData(actor, "finishing_blow"); if (finish && hpPct(target) <= 40) bonus += finish.damagePct;
    const exploit = skillData(actor, "exploit_weakness"); if (exploit && hasDebuff(target)) bonus += exploit.damagePct;
    const furyRank = rank(actor, "relentless_fury");
    if (furyRank) {
      bonus += resources.fury * 3;
      if (furyRank >= 2 && hpPct(actor) <= 40) bonus += 5;
      if (furyRank >= 4 && hpPct(actor) <= 40) bonus += 5;
    }
    return 1 + pct(bonus);
  }
  function skillData(unit, id) {
    const catalog = root.HERO_SKILLS_V1_BY_ID || (typeof HERO_SKILLS_V1_BY_ID !== "undefined" ? HERO_SKILLS_V1_BY_ID : {});
    const skill = catalog[id];
    const learned = rank(unit, id);
    return skill && learned ? skill.ranks[learned - 1] : null;
  }
  function petSkillData(unit) {
    const catalog = root.PET_COMBAT_SKILLS_V2 || (typeof PET_COMBAT_SKILLS_V2 !== "undefined" ? PET_COMBAT_SKILLS_V2 : {});
    const defined = catalog[unit.petDefId] || {};
    return {
      active: { ...(defined.active || {}), ...(unit.active || {}) },
      passive: { ...(defined.passive || {}), ...(unit.passive || {}) },
      extra: { ...(defined.extra || {}), ...(unit.extra || {}) }
    };
  }
  const chancePercent = value => Math.abs(Number(value) || 0) <= 1 ? (Number(value) || 0) * 100 : Number(value) || 0;

  function procChance(state, actor, target, base, type, options = {}) {
    let value = Number(base) || 0;
    if (!options.fixed && actor.kind === "hero") {
      const resources = resourcesFor(state, actor);
      const edge = skillData(actor, "debilitating_edge"); if (edge) value += edge.procBonus;
      if (type === "armor_break") { const mastery = skillData(actor, "armor_break_mastery"); if (mastery) value += mastery.procBonus; }
      value += resources.scheme * 3;
      if (options.active) value += Number(options.activeDebuffBonus) || Number(resources.nextActiveDebuffBonus) || 0;
    }
    if (!HARMFUL.has(type)) return clamp(value, 0, 100);
    return Math.max(0, Math.min(STATUS_PROC_CAP, value) - (Number(target.statusResist) || 0));
  }

  function applyStatus(state, actor, target, key, spec = {}, context = {}) {
    ensureTeamModel(state);
    if (!STATUS_KEYS.has(key) || !living(target)) return { applied: false };
    const finalChance = procChance(state, actor, target, spec.chance == null ? 100 : spec.chance, key, context);
    if (!chance(state, finalChance)) return { applied: false, resisted: true };
    if (state.rules?.bossControlStatusConversion !== false && (target.kind === "boss" || target.kind === "raid_boss") && (key === "stun" || key === "silence")) {
      const conversion = key === "stun" ? "critical" : "armor_pierce";
      log(state, "boss_conversion", `${key === "stun" ? "Stun" : "Silence"} converted to ${conversion === "critical" ? "Critical Hit" : "30% Armor Pierce"}`, { actorId: actor.id, targetId: target.id, status: key, conversion });
      return { applied: false, converted: conversion };
    }
    const duration = Math.max(1, Math.floor(Number(spec.duration) || (key === "armor_break" ? 2 : 1)));
    if (key === "stun" && target.statuses.stun) return { applied: false, unchanged: true };
    if (key === "poison") {
      const existing = target.statuses.poison;
      target.statuses.poison = { key, duration, damage: Math.max(Number(existing && existing.damage) || 0, Number(spec.damage) || 1), sourceId: actor.id, harmful: true };
    } else {
      target.statuses[key] = { ...(target.statuses[key] || {}), ...copy(spec), key, duration, harmful: HARMFUL.has(key) };
    }
    context.appliedStatuses && context.appliedStatuses.add(`${target.id}:${key}`);
    log(state, "status", `${target.name || target.id} gained ${key}`, { actorId: actor.id, targetId: target.id, status: key });
    return { applied: true };
  }

  function heal(state, target, amount, source, label = "Heal") {
    if (!living(target)) return 0;
    const recovery = target.kind === "hero" ? skillData(target, "recovery") : null;
    const actual = Math.min(target.maxHp - target.hp, Math.max(0, Math.round(amount * (1 + pct(recovery ? recovery.receivedPct : 0)))));
    target.hp += actual;
    if (actual) log(state, "heal", `${unitName(source)} use ${label} to ${unitName(target)} heal ${actual}.`, { actorId: source && source.id, targetId: target.id, amount: actual, actionName: label });
    return actual;
  }

  function restoreSp(state, target, amount, source, label = "SP") {
    if (!living(target) || !target.maxSp) return 0;
    const recovery = target.kind === "hero" ? skillData(target, "recovery") : null;
    const actual = Math.min(target.maxSp - target.sp, Math.max(0, Math.round(amount * (1 + pct(recovery ? recovery.receivedPct : 0)))));
    target.sp += actual;
    if (actual) log(state, "sp", `${label} +${actual}`, { actorId: source && source.id, targetId: target.id, amount: actual });
    return actual;
  }

  function markDead(state, target) {
    if (target.hp > 0 || target.dead) return;
    target.hp = 0; target.dead = true;
    log(state, "death", `${unitName(target)} defeated.`, { targetId: target.id });
  }

  function receiveDamage(state, actor, target, rawDamage, context = {}) {
    let amount = Math.max(0, Math.round(rawDamage));
    const directHit = !!context.direct;
    const pet = petForSide(state, target.side);
    const guardian = pet && petSkillData(pet).extra;
    if (directHit && target.kind === "hero" && actor.side !== target.side && pet && living(pet) && guardian.type === "heroBlock" && chance(state, chancePercent(guardian.pct))) {
      log(state, "block", "Guardian Scale blocked direct damage", { actorId: actor.id, targetId: target.id });
      amount = 0;
    }
    if (status(target, "def_up")) amount = Math.round(amount * 0.7);
    if (status(target, "rampage")) amount = Math.round(amount * (1 + pct(status(target, "rampage").takenPct)));
    if (directHit && target.kind === "hero") {
      const survival = skillData(target, "survival_instinct");
      const threshold = target.maxHp * 0.25;
      if (survival && amount > threshold) amount = Math.round(threshold + (amount - threshold) * (1 - pct(survival.excessReductionPct)));
    }
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    if (directHit && target.kind === "hero" && target.hp <= 0 && rank(target, "thorned_aegis") >= 2 && !target.flags.aegisLethalUsed) {
      const resources = resourcesFor(state, target);
      const priorAegis = resources.aegis;
      target.hp = 1; target.flags.aegisLethalUsed = true; resources.aegis = 3;
      log(state, "survive", "Thorned Aegis prevented lethal damage", { targetId: target.id });
      if (rank(target, "thorned_aegis") >= 3 && priorAegis === 3) {
        performCounter(state, target, actor, context); resources.aegis = 0;
      } else if (rank(target, "thorned_aegis") >= 4 && priorAegis < 3 && living(actor)) {
        performCounter(state, target, actor, context);
      }
    }
    if (target.kind === "hero" && target.hp > 0 && amount > 0) {
      const secondWind = skillData(target, "second_wind");
      if (secondWind && hpPct(target) <= 40 && !target.flags.secondWindUsed) {
        heal(state, target, target.maxHp * pct(secondWind.healMaxHpPct), target, "Second Wind");
        target.flags.secondWindUsed = true;
      }
      const lastStand = directHit ? skillData(target, "last_stand") : null;
      if (lastStand && hpPct(target) <= 40 && !(target.flags.lastStandCooldown > 0) && chance(state, lastStand.chance)) {
        target.statuses.def_up = { key: "def_up", duration: 2, harmful: false };
        target.flags.lastStandCooldown = lastStand.internalCooldown;
        log(state, "status", "Last Stand granted DEF Up", { targetId: target.id });
      }
    }
    if (amount) {
      const dealt = before - target.hp;
      const text = context.direct
        ? `${unitName(actor)} ${context.actionName === "basic attack" || context.actionName === "counter attack" ? context.actionName : `use ${context.actionName || "skill"}`} to ${unitName(target)} damage ${dealt}.`
        : `${unitName(target)} took ${dealt}.`;
      log(state, "damage", text, { actorId: actor.id, targetId: target.id, amount: dealt, crit: !!context.crit, actionName: context.actionName || null });
    }
    if (directHit && target.kind === "hero" && actor.side !== target.side && before > target.hp && !context.indirect) {
      const survival = skillData(target, "survival_instinct");
      if (survival && living(actor)) {
        const playtest = root.HERO_SKILL_V1_PLAYTEST || (typeof HERO_SKILL_V1_PLAYTEST !== "undefined" ? HERO_SKILL_V1_PLAYTEST : {});
        const reflectCap = target.maxHp * pct(Number(playtest.survivalReflectCapMaxHpPct) || 10);
        const reflected = Math.max(1, Math.round(Math.min((before - target.hp) * pct(survival.reflectPct), reflectCap)));
        receiveDamage(state, target, actor, reflected, { ...context, indirect: true });
        log(state, "reflect", `Reflected ${reflected} damage`, { actorId: target.id, targetId: actor.id });
      }
    }
    markDead(state, target);
    return before - target.hp;
  }

  function attackHit(state, actor, target, spec, actionContext) {
    if (!living(actor) || !living(target)) return { hit: false, damage: 0 };
    if (!chance(state, clamp(actor.accuracy - target.dodge, 5, 99))) {
      log(state, "miss", `${unitName(actor)} missed.`, { actorId: actor.id, targetId: target.id, actionName: attackActionName(spec, actionContext) });
      return { hit: false, damage: 0 };
    }
    // Proc rolls must be known before damage for Boss conversion, but a newly
    // applied Armor Break affects subsequent hits/actions rather than the hit
    // that created it. Snapshot DEF before applying this hit's statuses.
    const targetDefAtHitStart = effectiveDef(target);
    const conversions = [];
    for (const statusSpec of spec.statuses || []) {
      const result = applyStatus(state, actor, target, statusSpec.key, statusSpec, { ...actionContext, active: spec.actionType === "active", fixed: !!statusSpec.fixed });
      if (result.converted) conversions.push(result.converted);
      if (result.applied) actionContext.debuffApplied = actionContext.debuffApplied || HARMFUL.has(statusSpec.key);
    }
    let critChance = actor.crit + (Number(spec.critBonus) || 0);
    if (actor.kind === "hero") {
      const killer = skillData(actor, "killer_instinct"); if (killer && hpPct(target) < 50) critChance += killer.critPct;
      const bloodlust = skillData(actor, "bloodlust"); if (bloodlust && hpPct(actor) <= 40) critChance += bloodlust.critPct || 0;
      if (status(actor, "rampage")) critChance += Number(status(actor, "rampage").critPct) || 0;
    }
    if (target.kind === "hero") critChance -= resourcesFor(state, target).aegis * 5;
    const crit = conversions.includes("critical") || !!spec.guaranteedCrit || chance(state, critChance);
    const pierce = Math.max(Number(spec.defPierce) || 0, conversions.includes("armor_pierce") ? 0.3 : 0);
    const attackPower = actor.atk * (Number(spec.mult) || 1) * activeBuffDamageMultiplier(actor) * heroPassiveDamageMultiplier(state, actor, target);
    const critMult = crit ? actor.critDamage + pct(Number(spec.critDamageBonus) || 0) + pct((skillData(actor, "critical_mastery") || {}).critDamagePct || 0) : 1;
    const damage = Math.max(1, Math.round((attackPower - targetDefAtHitStart * (1 - pierce)) * critMult));
    const dealt = receiveDamage(state, actor, target, damage, { ...actionContext, actionName: attackActionName(spec, actionContext), crit, direct: true });
    actionContext.totalDamage += dealt;
    actionContext.hitAny = true;
    if (target.kind === "hero" && dealt > 0) {
      actionContext.heroStruck = true;
      actionContext.struckHeroIds.add(target.id);
    }
    if (target.dead) actionContext.killed = true;
    return { hit: true, crit, damage: dealt };
  }

  function basicTarget(state, actor, requestedId) {
    const targets = opposingUnits(state, actor);
    const requested = requestedId && state.units[requestedId];
    if (living(requested) && requested.side !== actor.side) return requested;
    return targets.sort((a, b) => a.hp - b.hp || a.tieOrder - b.tieOrder)[0] || null;
  }
  function tickCooldowns(unit, justUsedId) {
    for (const key of Object.keys(unit.cooldowns)) if (key !== justUsedId) unit.cooldowns[key] = Math.max(0, Number(unit.cooldowns[key]) - 1);
  }
  function tickStatuses(unit, appliedStatuses) {
    for (const [key, value] of Object.entries(unit.statuses || {})) {
      if (key === "poison" || appliedStatuses.has(`${unit.id}:${key}`)) continue;
      value.duration -= 1;
      if (value.duration <= 0) delete unit.statuses[key];
    }
  }
  function reduceOneCooldown(unit, excludedId, state) {
    const candidates = Object.entries(unit.cooldowns).filter(([id, cd]) => id !== excludedId && Number(cd) > 0);
    if (!candidates.length) return false;
    const selected = state ? choose(state, candidates) : candidates.sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))[0];
    unit.cooldowns[selected[0]] -= 1;
    return true;
  }
  function reduceAllCooldowns(unit, excludedId) {
    let changed = false;
    for (const [id, cooldown] of Object.entries(unit.cooldowns)) {
      if (id !== excludedId && Number(cooldown) > 0) { unit.cooldowns[id] -= 1; changed = true; }
    }
    return changed;
  }

  function performCounter(state, hero, enemy, actionContext) {
    if (!living(hero) || !living(enemy)) return;
    const data = skillData(hero, "counter") || { counterMult: 1 };
    const statuses = data.armorBreakChance ? [{ key: "armor_break", chance: data.armorBreakChance, duration: 2 }] : [];
    const result = attackHit(state, hero, enemy, { mult: data.counterMult, actionType: "counter", statuses }, actionContext);
    if (rank(hero, "thorned_aegis") >= 5 && result.hit) {
      const playtest = root.HERO_SKILL_V1_PLAYTEST || (typeof HERO_SKILL_V1_PLAYTEST !== "undefined" ? HERO_SKILL_V1_PLAYTEST : {});
      const stun = applyStatus(state, hero, enemy, "stun", { chance: Number(playtest.aegisCounterStunChance) || 35, duration: 1 }, actionContext);
      if (stun.applied) {
        const resources = resourcesFor(state, hero);
        resources.aegis = Math.max(0, resources.aegis - 1);
      }
    }
    log(state, "counter", "Hero countered", { actorId: hero.id, targetId: enemy.id });
  }

  function heroActiveSpec(state, actor, id) {
    const data = skillData(actor, id);
    if (!data) return null;
    const base = { id, actionType: "active", mult: data.mult || 0, hits: data.hits || 1, statuses: [], ...data };
    if (id === "heavy_blow") base.statuses.push({ key: "armor_break", chance: data.armorBreakChance, duration: 2 });
    if (id === "toxic_strike") base.statuses.push({ key: "poison", chance: data.poisonChance, duration: 3 + ((skillData(actor, "toxic_mastery") || {}).durationBonus || 0), damage: Math.max(1, Math.round(actor.atk * 0.2 * (1 + pct((skillData(actor, "toxic_mastery") || {}).poisonDamagePct || 0)))) });
    if (id === "stunning_blow") base.statuses.push({ key: "stun", chance: data.stunChance, duration: 1 });
    if (id === "silent_edge") base.statuses.push({ key: "silence", chance: data.silenceChance, duration: 2 });
    if (id === "guard") base.statuses = [];
    return base;
  }

  function consumeScheme(state, actor, target, context) {
    const resources = resourcesFor(state, actor);
    if (rank(actor, "usurper") < 3 || resources.scheme < 3) return false;
    const buffKey = Object.keys(target.statuses || {}).find(key => !HARMFUL.has(key) && !STEALABLE_BLOCKLIST.has(key) && target.statuses[key].stealable !== false);
    if (buffKey) {
      actor.statuses[buffKey] = copy(target.statuses[buffKey]); delete target.statuses[buffKey];
      log(state, "scheme", `Stole ${buffKey}`, { actorId: actor.id, targetId: target.id });
    } else {
      const extendable = Object.keys(target.statuses || {}).filter(key => HARMFUL.has(key) && key !== "stun");
      const key = choose(state, extendable);
      if (!key) return false;
      target.statuses[key].duration += 1;
      log(state, "scheme", `Extended ${key}`, { actorId: actor.id, targetId: target.id });
    }
    resources.scheme -= 1; resources.schemeConsumed += 1;
    context.schemeConsumed = true;
    if (rank(actor, "usurper") >= 4) resources.nextActiveDebuffBonus = 10;
    if (rank(actor, "usurper") >= 5 && resources.schemeConsumed >= 3) {
      if (!context.cdrUsed && reduceAllCooldowns(actor, context.usedSkillId)) context.cdrUsed = true;
      resources.schemeConsumed = 0;
    }
    return true;
  }

  function resolveHeroAction(state, actor, command, context) {
    const resources = resourcesFor(state, actor);
    const type = command.type || "basic";
    if (type === "flee") {
      if (!state.rules.allowFlee) { log(state, "flee", "Flee is not allowed"); return; }
      if (chance(state, Math.min(99, 50 + (Number(actor.agi) || 0) * 0.5))) { state.flags.fled = true; state.result = "fled"; log(state, "flee", "Escaped successfully"); }
      else log(state, "flee", "Escape Failed!");
      return;
    }
    if (type === "potion") {
      if ((Number(command.count) || 0) <= 0) { log(state, "invalid", "No potion available"); return; }
      heal(state, actor, Number(command.heal) || actor.maxHp * 0.35, actor, "Potion");
      if (command.restoreSp) restoreSp(state, actor, Number(command.restoreSp), actor, "Potion SP");
      context.consumePotion = true; return;
    }
    const target = basicTarget(state, actor, command.targetId || state.selectedTargetIds?.[actor.side] || state.selectedTargetId);
    if (!target) return;
    context.targetHadDebuff = hasDebuff(target);
    if (type === "active") {
      const id = command.skillId;
      const spec = heroActiveSpec(state, actor, id);
      if (!spec || !actor.activeSkills.includes(id) || (actor.cooldowns[id] || 0) > 0 || status(actor, "silence")) { log(state, "invalid", "Active skill unavailable"); return; }
      const efficiency = skillData(actor, "skill_efficiency");
      const cost = Math.max(0, Math.ceil(spec.sp * (1 - pct(efficiency ? efficiency.spReductionPct : 0))));
      if (actor.sp < cost) { log(state, "invalid", "Not enough SP"); return; }
      actor.sp -= cost; context.usedSkillId = id; context.wasActive = true;
      context.attackAction = Number(spec.mult) > 0;
      const schemeEligible = context.attackAction || id === "disruption";
      context.activeDebuffBonus = schemeEligible ? resources.nextActiveDebuffBonus : 0;
      if (schemeEligible) resources.nextActiveDebuffBonus = 0;
      if (id === "rampage") { actor.statuses.rampage = { key: "rampage", duration: spec.duration, damagePct: spec.damagePct, critPct: spec.critPct || 0, takenPct: spec.takenPct, stealable: false }; context.appliedStatuses.add(`${actor.id}:rampage`); }
      else if (id === "shield_wall") {
        actor.statuses.shield_wall = { key: "shield_wall", duration: spec.duration, damagePenaltyPct: spec.damagePenaltyPct, stealable: false };
        actor.statuses.def_up = { key: "def_up", duration: spec.duration, harmful: false };
        context.appliedStatuses.add(`${actor.id}:shield_wall`); context.appliedStatuses.add(`${actor.id}:def_up`);
      }
      else if (id === "fortress") { actor.statuses.fortress = { key: "fortress", duration: spec.duration, defPct: spec.defPct, damagePenaltyPct: spec.damagePenaltyPct, stealable: false }; context.appliedStatuses.add(`${actor.id}:fortress`); }
      else if (id === "counter") { actor.statuses.counter = { key: "counter", duration: 1, counterMult: spec.counterMult, stealable: false }; context.appliedStatuses.add(`${actor.id}:counter`); }
      else if (id === "disruption") {
        const pool = ["poison", "armor_break", "silence", "stun"];
        const picked = [];
        while (picked.length < spec.count && pool.length) {
          const key = chooseWeighted(state, pool, candidate => candidate === "stun" && spec.count < 4 ? spec.stunWeight : 1);
          picked.push(key); pool.splice(pool.indexOf(key), 1);
        }
        for (const key of picked) {
          const applied = applyStatus(state, actor, target, key, { chance: spec.procChance, duration: key === "stun" ? 1 : key === "armor_break" ? 2 : 3, damage: key === "poison" ? Math.round(actor.atk * 0.2) : undefined }, { ...context, active: true });
          if (applied.applied) context.debuffApplied = true;
        }
      } else {
        const distributedTargets = id === "blade_storm"
          ? [target, ...opposingUnits(state, actor).filter(unit => unit.id !== target.id)]
          : [target];
        for (let hit = 0; hit < spec.hits; hit++) {
          let hitTarget = distributedTargets[hit % distributedTargets.length];
          if (!living(hitTarget)) hitTarget = distributedTargets.find(living) || basicTarget(state, actor, null);
          if (!hitTarget) break;
          const hitSpec = { ...spec, statuses: spec.statuses.slice() };
          if (hit === 0 && rank(actor, "relentless_fury") >= 3 && resources.fury === 3) hitSpec.statuses.push({ key: "stun", chance: 5, duration: 1, fixed: true });
          if (id === "blade_storm" && spec.stunChancePerHit) hitSpec.statuses.push({ key: "stun", chance: spec.stunChancePerHit, duration: 1, fixed: true });
          attackHit(state, actor, hitTarget, hitSpec, context);
        }
        if (id === "guard") { actor.statuses.def_up = { key: "def_up", duration: spec.duration, harmful: false }; context.appliedStatuses.add(`${actor.id}:def_up`); }
      }
      actor.cooldowns[id] = Number(spec.cooldown) || 0;
      if (schemeEligible) consumeScheme(state, actor, target, context);
    } else {
      context.attackAction = true;
      const statuses = rank(actor, "relentless_fury") >= 3 && resources.fury === 3 ? [{ key: "stun", chance: 5, duration: 1, fixed: true }] : [];
      const hit = attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses }, context);
      const drain = skillData(actor, "life_drain");
      if (hit.damage && drain) heal(state, actor, Math.min(hit.damage * pct(drain.drainPct), actor.maxHp * 0.10), actor, "Life Drain");
      const spirit = skillData(actor, "spirit_drain"); if (hit.hit && spirit) restoreSp(state, actor, spirit.spRestore, actor, "Spirit Drain");
    }
    if (context.attackAction) {
      const furyRank = rank(actor, "relentless_fury"); if (furyRank) resources.fury = Math.min(3, resources.fury + 1);
      const quick = skillData(actor, "quick_recovery");
      if (quick && context.targetHadDebuff && !context.cdrUsed && chance(state, quick.chance + (rank(actor, "usurper") >= 2 ? resources.scheme * 2 : 0)) && reduceOneCooldown(actor, context.usedSkillId, state)) context.cdrUsed = true;
    }
    if (context.debuffApplied && rank(actor, "usurper")) resources.scheme = Math.min(3, resources.scheme + 1);
    const tactician = skillData(actor, "master_tactician");
    if (tactician && context.targetHadDebuff && chance(state, tactician.chance)) {
      const extendable = Object.keys(target.statuses || {}).filter(key => HARMFUL.has(key) && key !== "stun");
      const key = choose(state, extendable);
      if (key) { target.statuses[key].duration += 1; log(state, "status", `Master Tactician extended ${key}`, { actorId: actor.id, targetId: target.id }); }
    }
    if (context.killed && rank(actor, "relentless_fury") >= 5 && resources.fury > 0 && !context.cdrUsed && reduceOneCooldown(actor, context.usedSkillId, state)) { resources.fury -= 1; context.cdrUsed = true; }
  }

  function resolvePetAction(state, actor, context) {
    const hero = heroForSide(state, actor.side);
    const target = basicTarget(state, actor, state.selectedTargetIds?.[actor.side] || state.selectedTargetId);
    if (!target) return;
    const { active } = petSkillData(actor);
    const activeReady = (actor.cooldowns.pet_active || 0) === 0;
    const activeName = active.name || "Pet Active";
    const isSupport = active.type === "regen" || active.type === "groupHeal";
    const needsHeal = living(hero) && (hpPct(hero) <= 60 || (active.type === "groupHeal" && hpPct(actor) <= 60));
    if (isSupport && activeReady && needsHeal) {
      log(state, "pet_active", `${unitName(actor)} use ${activeName}.`, { actorId: actor.id, skillName: activeName });
      const amount = actor.maxHp * (Number(active.healPetHpPct) || 0) + (Number(actor.vit) || 0) * (Number(active.vitScale) || 0);
      if (active.type === "regen") hero.statuses.pet_regrowth = { key: "pet_regrowth", duration: Math.max(1, Number(active.regenTurns) || 1), heal: Math.round(amount), sourceId: actor.id, stealable: false };
      else { heal(state, hero, amount, actor, "Moonlight Heal"); heal(state, actor, amount, actor, "Moonlight Heal"); }
      actor.cooldowns.pet_active = Number(active.cooldown) || 0; context.usedSkillId = "pet_active"; return;
    }
    if (!activeReady) { attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses: [] }, context); return; }
    if (active.type !== "damage" && active.type !== "aoe") { attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses: [] }, context); return; }
    const spec = { mult: Number(active.mult) || 1, actionType: "active", actionName: activeName, statuses: [] };
    if (active.stunChance) spec.statuses.push({ key: "stun", chance: chancePercent(active.stunChance), duration: 1 });
    if (active.armorBreakChance) spec.statuses.push({ key: "armor_break", chance: chancePercent(active.armorBreakChance), duration: 2 });
    if (active.poisonChance) spec.statuses.push({ key: "poison", chance: chancePercent(active.poisonChance), duration: Math.max(1, Number(active.poisonTurns) || 1), damage: Math.round(actor.atk * (Number(active.poisonPct) || 0)) });
    if (active.silenceChance) spec.statuses.push({ key: "silence", chance: chancePercent(active.silenceChance), duration: 2 });
    const targets = active.type === "aoe" ? opposingUnits(state, actor).slice(0, 3) : [target];
    log(state, "pet_active", `${unitName(actor)} use ${activeName}.`, { actorId: actor.id, skillName: activeName });
    targets.forEach(unit => attackHit(state, actor, unit, spec, context));
    if (living(hero) && active.defUpChance && chance(state, chancePercent(active.defUpChance))) applyStatus(state, actor, hero, "def_up", { chance: 100, duration: Math.max(1, Number(active.defUpTurns) || 1) }, context);
    actor.cooldowns.pet_active = Number(active.cooldown) || 0; context.usedSkillId = "pet_active";
  }

  function resolveEnemyAction(state, actor, context) {
    const targets = opposingUnits(state, actor);
    if (!targets.length) return;
    const target = choose(state, targets);
    const hits = Math.max(1, Math.floor(Number(actor.ai.hits) || 1));
    for (let hit = 0; hit < hits && living(target); hit++) attackHit(state, actor, target, { mult: Number(actor.ai.mult) || 1, actionType: "enemy", statuses: actor.ai.statuses || [] }, context);
  }

  function startEffects(state, actor, context) {
    const poison = status(actor, "poison");
    if (poison) {
      const source = state.units[poison.sourceId] || { id: poison.sourceId || "poison", side: state.teamIds.find(side => side !== actor.side) };
      receiveDamage(state, source, actor, poison.damage, context);
      poison.duration -= 1; if (poison.duration <= 0) delete actor.statuses.poison;
    }
    const regen = status(actor, "pet_regrowth"); if (regen) heal(state, actor, regen.heal, state.units[regen.sourceId], "Regrowth");
  }

  function resolveHeroReactionsAfterAction(state, actor, context) {
    for (const heroId of context.struckHeroIds) {
      const hero = state.units[heroId];
      if (!living(hero) || hero.side === actor.side) continue;
      if (status(hero, "counter") && living(actor)) { performCounter(state, hero, actor, context); delete hero.statuses.counter; }
      if (!rank(hero, "thorned_aegis")) continue;
      hero.flags.hitSinceLastHeroAction = true;
      if (status(hero, "def_up")) {
        const resources = resourcesFor(state, hero);
        const before = resources.aegis; resources.aegis = Math.min(3, before + 1);
        if (rank(hero, "thorned_aegis") >= 4 && before < 3 && resources.aegis === 3 && living(actor)) performCounter(state, hero, actor, context);
      }
    }
  }

  function checkBattleEnd(state) {
    const aliveSides = state.teamIds.filter(side => livingTeamUnits(state, side).length);
    if (aliveSides.length > 1) return;
    state.winnerSide = aliveSides[0] || null;
    state.result = state.winnerSide === state.controlledSide ? "victory" : "defeat";
    state.flags.auto = false;
    const hero = heroForSide(state, state.controlledSide);
    const pet = petForSide(state, state.controlledSide);
    if (state.mode === "dungeon" && !living(hero) && living(pet) && state.result === "victory") state.flags.heroReviveNextFloor = true;
    resetBattleResources(state);
    log(state, "battle_end", state.result === "victory" ? "Victory" : "Defeat");
  }

  function validateHeroCommand(state, actor, command) {
    const type = command && command.type || "basic";
    if (type === "basic") return null;
    if (type === "potion") return (Number(command.count) || 0) > 0 ? null : "No potion available";
    if (type === "flee") return state.rules.allowFlee ? null : "Flee is not allowed";
    if (type !== "active") return "Unknown Hero action";
    const id = command.skillId;
    const spec = heroActiveSpec(state, actor, id);
    if (!spec || !actor.activeSkills.includes(id) || (actor.cooldowns[id] || 0) > 0 || status(actor, "silence")) return "Active skill unavailable";
    const efficiency = skillData(actor, "skill_efficiency");
    const cost = Math.max(0, Math.ceil(spec.sp * (1 - pct(efficiency ? efficiency.spReductionPct : 0))));
    return actor.sp >= cost ? null : "Not enough SP";
  }

  function battleStep(inputState, command) {
    // Presentation only observes the returned state/log. Animation timing, UI
    // speed and VFX must never decide queue order or gameplay resolution here.
    const state = ensureTeamModel(copy(inputState));
    if (state.result) return { state, waiting: false, completedAction: false };
    const actor = currentUnit(state);
    if (!actor) { checkBattleEnd(state); return { state, waiting: false, completedAction: false }; }
    const manualActor = actor.kind === "hero" && actor.side === state.controlledSide;
    if (manualActor && !command && !state.flags.auto && !state.flags.skipResolving) return { state, waiting: true, completedAction: false };
    if (manualActor && command) {
      const invalid = validateHeroCommand(state, actor, command);
      if (invalid) {
        log(state, "invalid", invalid);
        return { state, waiting: true, completedAction: false, error: invalid };
      }
    }
    const context = { appliedStatuses: new Set(), struckHeroIds: new Set(), totalDamage: 0, hitAny: false, heroStruck: false, killed: false, debuffApplied: false, cdrUsed: false, usedSkillId: null, schemeConsumed: false, activeDebuffBonus: 0, attackAction: false, targetHadDebuff: false };
    startEffects(state, actor, context);
    if (living(actor)) {
      if (status(actor, "stun")) { delete actor.statuses.stun; log(state, "stun", `${actor.name || actor.id} lost the Action`); }
      else if (actor.kind === "hero") {
        state.heroTurnCounts[actor.id] = (Number(state.heroTurnCounts[actor.id]) || 0) + 1;
        if (actor.id === state.heroId) state.heroTurnCount += 1;
        resolveHeroAction(state, actor, manualActor && command ? command : { type: "basic" }, context);
      } else if (actor.kind === "pet") resolvePetAction(state, actor, context);
      else resolveEnemyAction(state, actor, context);
    }
    resolveHeroReactionsAfterAction(state, actor, context);
    const pet = petForSide(state, actor.side);
    const petCdr = pet && petSkillData(pet).extra;
    if (context.debuffApplied && (actor.kind === "hero" || actor.kind === "pet") && pet && living(pet) && petCdr.type === "petCdrOnDebuff" && !context.cdrUsed && !(actor.id === pet.id && context.usedSkillId === "pet_active") && Number(pet.cooldowns.pet_active) > 0 && chance(state, chancePercent(petCdr.pct))) {
      pet.cooldowns.pet_active -= 1; context.cdrUsed = true;
      log(state, "cooldown", "Thunder Judgment reduced Pet Active cooldown", { actorId: actor.id, targetId: pet.id });
    }
    tickCooldowns(actor, context.usedSkillId);
    tickStatuses(actor, context.appliedStatuses);
    if (actor.kind === "hero") {
      const resources = resourcesFor(state, actor);
      actor.flags.lastStandCooldown = Math.max(0, Number(actor.flags.lastStandCooldown) - 1);
      if (!actor.flags.hitSinceLastHeroAction && resources.aegis > 0) resources.aegis -= 1;
      actor.flags.hitSinceLastHeroAction = false;
    }
    checkBattleEnd(state);
    state.queueIndex += 1; state.safeActionSeq += 1;
    return { state, waiting: false, completedAction: true, consumePotion: !!context.consumePotion };
  }

  function simulateBattle(inputState, maxActions = 10000) {
    let state = copy(inputState); state.flags.skipResolving = true; state.flags.auto = false;
    let actions = 0;
    while (!state.result && actions < maxActions) { const result = battleStep(state, { type: "basic" }); state = result.state; actions += result.completedAction ? 1 : 0; }
    state.flags.skipResolving = false;
    if (!state.result) { state.result = "invalid"; log(state, "error", "Simulation action limit reached"); }
    return state;
  }

  function serializeCheckpoint(state) {
    if (!state || state.version !== 1 || !state.battleId || state.result) throw new Error("invalid_checkpoint_state");
    const checkpoint = ensureTeamModel(copy(state));
    return JSON.stringify({ ...checkpoint, flags: { ...checkpoint.flags, auto: false, skipResolving: false } });
  }
  function restoreCheckpoint(raw) {
    const state = typeof raw === "string" ? JSON.parse(raw) : copy(raw);
    if (!state || state.version !== 1 || !state.battleId || !state.units || (!state.heroId && !Array.isArray(state.teamIds)) || !Array.isArray(state.queue)) throw new Error("corrupt_checkpoint");
    ensureTeamModel(state);
    state.flags = { ...(state.flags || {}), auto: false, skipResolving: false };
    return state;
  }

  const api = {
    BATTLE_MODE_ADAPTERS,
    buildHeroUnit, buildPetUnit, buildMonsterUnit,
    createBattle, createTeamBattle, createDungeonBattle, createArenaBattle, createRaidBattle,
    rebuildQueue, currentUnit, upcomingActions, applyStatus, battleStep, simulateBattle,
    serializeCheckpoint, restoreCheckpoint
  };
  Object.assign(root, { BATTLE_CORE_V1: api });
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
