// ---------- Battle Core V1 ----------
// Pure, serializable combat engine. UI, Auto and Skip all call battleStep().
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

  function normalizeUnit(raw, index) {
    const unit = copy(raw || {});
    unit.id = String(unit.id || `unit-${index}`);
    unit.kind = unit.kind || "monster";
    unit.side = unit.side || (unit.kind === "monster" || unit.kind === "boss" || unit.kind === "raid_boss" ? "enemy" : "ally");
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

  function buildHeroUnit(raw = {}) { return normalizeUnit({ ...raw, kind: "hero", side: "ally" }, 0); }
  function buildPetUnit(raw = {}) { return normalizeUnit({ ...raw, kind: "pet", side: "ally" }, 1); }
  function buildMonsterUnit(raw = {}, index = 0) {
    const kind = raw.kind === "boss" || raw.kind === "raid_boss" ? raw.kind : "monster";
    return normalizeUnit({ ...raw, kind, side: "enemy" }, index + 2);
  }

  function createBattle(options = {}) {
    const input = [
      options.hero && buildHeroUnit(options.hero),
      options.pet && buildPetUnit(options.pet),
      ...(options.enemies || []).map((enemy, index) => buildMonsterUnit(enemy, index))
    ].filter(Boolean);
    const units = {};
    input.forEach(unit => { units[unit.id] = unit; });
    const hero = Object.values(units).find(unit => unit.kind === "hero");
    const pet = Object.values(units).find(unit => unit.kind === "pet");
    const enemies = Object.values(units).filter(unit => unit.side === "enemy");
    if (!hero || !enemies.length) throw new Error("battle_requires_hero_and_enemy");
    const state = {
      version: 1,
      battleId: String(options.battleId || `battle-${Date.now()}`),
      mode: options.mode || "dungeon",
      floor: Math.max(1, Math.floor(Number(options.floor) || 1)),
      round: 0, queue: [], queueIndex: 0, speedSnapshot: {},
      units, heroId: hero.id, petId: pet ? pet.id : null, enemyIds: enemies.map(unit => unit.id),
      selectedTargetId: enemies[0].id, heroTurnCount: 0,
      resources: { fury: 0, aegis: 0, scheme: 0, schemeConsumed: 0, nextActiveDebuffBonus: 0 },
      flags: { auto: false, skipResolving: false, heroReviveNextFloor: false, fled: false },
      result: null, safeActionSeq: 0, logSeq: 0,
      rngState: (Number(options.seed) >>> 0) || 0x12345678, log: [],
      rules: { allowFlee: options.allowFlee !== false }
    };
    rebuildQueue(state);
    log(state, "battle_start", `Battle ${state.battleId} started`);
    return state;
  }
  function createDungeonBattle(options = {}) {
    return createBattle({ ...options, mode: "dungeon", allowFlee: true });
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
    let bonus = 0;
    const wm = skillData(actor, "weapon_mastery"); if (wm) bonus += wm.damagePct;
    const bloodlust = skillData(actor, "bloodlust"); if (bloodlust && hpPct(actor) <= 40) bonus += bloodlust.damagePct;
    const finish = skillData(actor, "finishing_blow"); if (finish && hpPct(target) <= 40) bonus += finish.damagePct;
    const exploit = skillData(actor, "exploit_weakness"); if (exploit && hasDebuff(target)) bonus += exploit.damagePct;
    const furyRank = rank(actor, "relentless_fury");
    if (furyRank) {
      bonus += state.resources.fury * 3;
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

  function procChance(state, actor, target, base, type, options = {}) {
    let value = Number(base) || 0;
    if (!options.fixed && actor.kind === "hero") {
      const edge = skillData(actor, "debilitating_edge"); if (edge) value += edge.procBonus;
      if (type === "armor_break") { const mastery = skillData(actor, "armor_break_mastery"); if (mastery) value += mastery.procBonus; }
      value += state.resources.scheme * 3;
      if (options.active) value += Number(options.activeDebuffBonus) || Number(state.resources.nextActiveDebuffBonus) || 0;
    }
    if (!HARMFUL.has(type)) return clamp(value, 0, 100);
    return Math.max(0, Math.min(STATUS_PROC_CAP, value) - (Number(target.statusResist) || 0));
  }

  function applyStatus(state, actor, target, key, spec = {}, context = {}) {
    if (!STATUS_KEYS.has(key) || !living(target)) return { applied: false };
    const finalChance = procChance(state, actor, target, spec.chance == null ? 100 : spec.chance, key, context);
    if (!chance(state, finalChance)) return { applied: false, resisted: true };
    if ((target.kind === "boss" || target.kind === "raid_boss") && (key === "stun" || key === "silence")) {
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
    if (actual) log(state, "heal", `${label} +${actual}`, { actorId: source && source.id, targetId: target.id, amount: actual });
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
    log(state, "death", `${target.name || target.id} was defeated`, { targetId: target.id });
  }

  function receiveDamage(state, actor, target, rawDamage, context = {}) {
    let amount = Math.max(0, Math.round(rawDamage));
    const directHit = !!context.direct;
    const hero = state.units[state.heroId];
    const pet = state.petId && state.units[state.petId];
    if (directHit && target.kind === "hero" && actor.side === "enemy" && pet && living(pet) && pet.petDefId === "inferno_drake" && chance(state, 20)) {
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
      const priorAegis = state.resources.aegis;
      target.hp = 1; target.flags.aegisLethalUsed = true; state.resources.aegis = 3;
      log(state, "survive", "Thorned Aegis prevented lethal damage", { targetId: target.id });
      if (rank(target, "thorned_aegis") >= 3 && priorAegis === 3) {
        performCounter(state, target, actor, context); state.resources.aegis = 0;
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
    if (amount) log(state, "damage", `${target.name || target.id} took ${before - target.hp}`, { actorId: actor.id, targetId: target.id, amount: before - target.hp, crit: !!context.crit });
    if (directHit && target.kind === "hero" && actor.side === "enemy" && before > target.hp && !context.indirect) {
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
      log(state, "miss", `${actor.name || actor.id} missed`, { actorId: actor.id, targetId: target.id });
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
    if (target.kind === "hero") critChance -= state.resources.aegis * 5;
    const crit = conversions.includes("critical") || !!spec.guaranteedCrit || chance(state, critChance);
    const pierce = Math.max(Number(spec.defPierce) || 0, conversions.includes("armor_pierce") ? 0.3 : 0);
    const attackPower = actor.atk * (Number(spec.mult) || 1) * activeBuffDamageMultiplier(actor) * heroPassiveDamageMultiplier(state, actor, target);
    const critMult = crit ? actor.critDamage + pct(Number(spec.critDamageBonus) || 0) + pct((skillData(actor, "critical_mastery") || {}).critDamagePct || 0) : 1;
    const damage = Math.max(1, Math.round((attackPower - targetDefAtHitStart * (1 - pierce)) * critMult));
    const dealt = receiveDamage(state, actor, target, damage, { ...actionContext, crit, direct: true });
    actionContext.totalDamage += dealt;
    actionContext.hitAny = true;
    if (target.kind === "hero" && dealt > 0) actionContext.heroStruck = true;
    if (target.dead) actionContext.killed = true;
    return { hit: true, crit, damage: dealt };
  }

  function basicTarget(state, actor, requestedId) {
    const targets = Object.values(state.units).filter(unit => living(unit) && unit.side !== actor.side);
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
    const result = attackHit(state, hero, enemy, { mult: data.counterMult, statuses }, actionContext);
    if (rank(hero, "thorned_aegis") >= 5 && result.hit) {
      const playtest = root.HERO_SKILL_V1_PLAYTEST || (typeof HERO_SKILL_V1_PLAYTEST !== "undefined" ? HERO_SKILL_V1_PLAYTEST : {});
      const stun = applyStatus(state, hero, enemy, "stun", { chance: Number(playtest.aegisCounterStunChance) || 35, duration: 1 }, actionContext);
      if (stun.applied) state.resources.aegis = Math.max(0, state.resources.aegis - 1);
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
    if (rank(actor, "usurper") < 3 || state.resources.scheme < 3) return false;
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
    state.resources.scheme -= 1; state.resources.schemeConsumed += 1;
    context.schemeConsumed = true;
    if (rank(actor, "usurper") >= 4) state.resources.nextActiveDebuffBonus = 10;
    if (rank(actor, "usurper") >= 5 && state.resources.schemeConsumed >= 3) {
      if (!context.cdrUsed && reduceAllCooldowns(actor, context.usedSkillId)) context.cdrUsed = true;
      state.resources.schemeConsumed = 0;
    }
    return true;
  }

  function resolveHeroAction(state, actor, command, context) {
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
    const target = basicTarget(state, actor, command.targetId || state.selectedTargetId);
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
      context.activeDebuffBonus = schemeEligible ? state.resources.nextActiveDebuffBonus : 0;
      if (schemeEligible) state.resources.nextActiveDebuffBonus = 0;
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
          ? [target, ...state.enemyIds.map(enemyId => state.units[enemyId]).filter(unit => living(unit) && unit.id !== target.id)]
          : [target];
        for (let hit = 0; hit < spec.hits; hit++) {
          let hitTarget = distributedTargets[hit % distributedTargets.length];
          if (!living(hitTarget)) hitTarget = distributedTargets.find(living) || basicTarget(state, actor, null);
          if (!hitTarget) break;
          const hitSpec = { ...spec, statuses: spec.statuses.slice() };
          if (hit === 0 && rank(actor, "relentless_fury") >= 3 && state.resources.fury === 3) hitSpec.statuses.push({ key: "stun", chance: 5, duration: 1, fixed: true });
          if (id === "blade_storm" && spec.stunChancePerHit) hitSpec.statuses.push({ key: "stun", chance: spec.stunChancePerHit, duration: 1, fixed: true });
          attackHit(state, actor, hitTarget, hitSpec, context);
        }
        if (id === "guard") { actor.statuses.def_up = { key: "def_up", duration: spec.duration, harmful: false }; context.appliedStatuses.add(`${actor.id}:def_up`); }
      }
      actor.cooldowns[id] = Number(spec.cooldown) || 0;
      if (schemeEligible) consumeScheme(state, actor, target, context);
    } else {
      context.attackAction = true;
      const statuses = rank(actor, "relentless_fury") >= 3 && state.resources.fury === 3 ? [{ key: "stun", chance: 5, duration: 1, fixed: true }] : [];
      const hit = attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses }, context);
      const drain = skillData(actor, "life_drain");
      if (hit.damage && drain) heal(state, actor, Math.min(hit.damage * pct(drain.drainPct), actor.maxHp * 0.10), actor, "Life Drain");
      const spirit = skillData(actor, "spirit_drain"); if (hit.hit && spirit) restoreSp(state, actor, spirit.spRestore, actor, "Spirit Drain");
    }
    if (context.attackAction) {
      const furyRank = rank(actor, "relentless_fury"); if (furyRank) state.resources.fury = Math.min(3, state.resources.fury + 1);
      const quick = skillData(actor, "quick_recovery");
      if (quick && context.targetHadDebuff && !context.cdrUsed && chance(state, quick.chance + (rank(actor, "usurper") >= 2 ? state.resources.scheme * 2 : 0)) && reduceOneCooldown(actor, context.usedSkillId, state)) context.cdrUsed = true;
    }
    if (context.debuffApplied && rank(actor, "usurper")) state.resources.scheme = Math.min(3, state.resources.scheme + 1);
    const tactician = skillData(actor, "master_tactician");
    if (tactician && context.targetHadDebuff && chance(state, tactician.chance)) {
      const extendable = Object.keys(target.statuses || {}).filter(key => HARMFUL.has(key) && key !== "stun");
      const key = choose(state, extendable);
      if (key) { target.statuses[key].duration += 1; log(state, "status", `Master Tactician extended ${key}`, { actorId: actor.id, targetId: target.id }); }
    }
    if (context.killed && rank(actor, "relentless_fury") >= 5 && state.resources.fury > 0 && !context.cdrUsed && reduceOneCooldown(actor, context.usedSkillId, state)) { state.resources.fury -= 1; context.cdrUsed = true; }
  }

  function resolvePetAction(state, actor, context) {
    const hero = state.units[state.heroId];
    const target = basicTarget(state, actor, state.selectedTargetId);
    if (!target) return;
    const id = actor.petDefId;
    const activeReady = (actor.cooldowns.pet_active || 0) === 0;
    const needsHeal = living(hero) && (hpPct(hero) <= 60 || (id === "moon_hare" && hpPct(actor) <= 60));
    if ((id === "sprout" || id === "moon_hare") && activeReady && needsHeal) {
      const amount = actor.maxHp * (id === "sprout" ? 0.12 : 0.10) + (Number(actor.vit) || 0) * (id === "sprout" ? 0.8 : 1);
      if (id === "sprout") hero.statuses.pet_regrowth = { key: "pet_regrowth", duration: 2, heal: Math.round(amount), sourceId: actor.id, stealable: false };
      else { heal(state, hero, amount, actor, "Moonlight Heal"); heal(state, actor, amount, actor, "Moonlight Heal"); }
      actor.cooldowns.pet_active = id === "sprout" ? 3 : 2; context.usedSkillId = "pet_active"; return;
    }
    if (!activeReady) { attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses: [] }, context); return; }
    let spec = { mult: 1, actionType: "active", statuses: [] }, targets = [target], cd = 2;
    if (id === "flamekit") spec.mult = 1.35;
    else if (id === "sparkpup") { spec.mult = 1; spec.statuses.push({ key: "stun", chance: 15, duration: 1 }); }
    else if (id === "ember_fox") spec.mult = 1.55;
    else if (id === "hell_wolf") {
      const playtest = root.PET_V2_PLAYTEST || (typeof PET_V2_PLAYTEST !== "undefined" ? PET_V2_PLAYTEST : {});
      const poisonPct = Number(playtest.hellWolfPoisonAtkPct) || 20;
      const poisonTurns = Number(playtest.hellWolfPoisonTurns) || 3;
      spec.mult = 1.10;
      spec.statuses.push({ key: "armor_break", chance: 40, duration: 2 }, { key: "poison", chance: 25, duration: poisonTurns, damage: Math.round(actor.atk * pct(poisonPct)) });
    }
    else if (id === "inferno_drake") { spec.mult = .75; targets = state.enemyIds.map(enemyId => state.units[enemyId]).filter(living).slice(0, 3); }
    else if (id === "storm_phoenix") { spec.mult = .70; spec.statuses.push({ key: "silence", chance: 30, duration: 2 }); targets = state.enemyIds.map(enemyId => state.units[enemyId]).filter(living).slice(0, 3); cd = 3; }
    else { attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses: [] }, context); return; }
    targets.forEach(unit => attackHit(state, actor, unit, spec, context));
    if (id === "inferno_drake" && chance(state, 35)) applyStatus(state, actor, hero, "def_up", { chance: 100, duration: 2 }, context);
    actor.cooldowns.pet_active = cd; context.usedSkillId = "pet_active";
  }

  function resolveEnemyAction(state, actor, context) {
    const targets = [state.units[state.heroId], state.petId && state.units[state.petId]].filter(living);
    if (!targets.length) return;
    const target = choose(state, targets);
    const hits = Math.max(1, Math.floor(Number(actor.ai.hits) || 1));
    for (let hit = 0; hit < hits && living(target); hit++) attackHit(state, actor, target, { mult: Number(actor.ai.mult) || 1, actionType: "enemy", statuses: actor.ai.statuses || [] }, context);
    const hero = state.units[state.heroId];
    if (context.heroStruck && status(hero, "counter")) { performCounter(state, hero, actor, context); delete hero.statuses.counter; }
  }

  function startEffects(state, actor, context) {
    const poison = status(actor, "poison");
    if (poison) {
      receiveDamage(state, { id: poison.sourceId || "poison", side: actor.side === "enemy" ? "ally" : "enemy" }, actor, poison.damage, context);
      poison.duration -= 1; if (poison.duration <= 0) delete actor.statuses.poison;
    }
    const regen = status(actor, "pet_regrowth"); if (regen) heal(state, actor, regen.heal, state.units[regen.sourceId], "Regrowth");
  }

  function resolveAegisAfterEnemyAction(state, actor, context) {
    const hero = state.units[state.heroId];
    if (!living(hero) || actor.side !== "enemy" || !rank(hero, "thorned_aegis")) return;
    if (context.heroStruck) hero.flags.hitSinceLastHeroAction = true;
    if (context.heroStruck && status(hero, "def_up")) {
      const before = state.resources.aegis; state.resources.aegis = Math.min(3, before + 1);
      if (rank(hero, "thorned_aegis") >= 4 && before < 3 && state.resources.aegis === 3 && living(actor)) performCounter(state, hero, actor, context);
    }
  }

  function checkBattleEnd(state) {
    const enemiesAlive = state.enemyIds.some(id => living(state.units[id]));
    const heroAlive = living(state.units[state.heroId]);
    const petAlive = state.petId && living(state.units[state.petId]);
    if (!enemiesAlive) {
      state.result = "victory"; state.flags.auto = false;
      if (!heroAlive && petAlive) state.flags.heroReviveNextFloor = true;
      state.resources.fury = 0; state.resources.aegis = 0; state.resources.scheme = 0;
      log(state, "battle_end", "Victory");
    } else if (!heroAlive && !petAlive) {
      state.result = "defeat"; state.flags.auto = false;
      state.resources.fury = 0; state.resources.aegis = 0; state.resources.scheme = 0;
      log(state, "battle_end", "Defeat");
    }
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
    const state = copy(inputState);
    if (state.result) return { state, waiting: false, completedAction: false };
    const actor = currentUnit(state);
    if (!actor) { checkBattleEnd(state); return { state, waiting: false, completedAction: false }; }
    if (actor.kind === "hero" && !command && !state.flags.auto && !state.flags.skipResolving) return { state, waiting: true, completedAction: false };
    if (actor.kind === "hero" && command) {
      const invalid = validateHeroCommand(state, actor, command);
      if (invalid) {
        log(state, "invalid", invalid);
        return { state, waiting: true, completedAction: false, error: invalid };
      }
    }
    const context = { appliedStatuses: new Set(), totalDamage: 0, hitAny: false, heroStruck: false, killed: false, debuffApplied: false, cdrUsed: false, usedSkillId: null, schemeConsumed: false, activeDebuffBonus: 0, attackAction: false, targetHadDebuff: false };
    startEffects(state, actor, context);
    if (living(actor)) {
      if (status(actor, "stun")) { delete actor.statuses.stun; log(state, "stun", `${actor.name || actor.id} lost the Action`); }
      else if (actor.kind === "hero") {
        state.heroTurnCount += 1;
        resolveHeroAction(state, actor, command || { type: "basic" }, context);
      } else if (actor.kind === "pet") resolvePetAction(state, actor, context);
      else resolveEnemyAction(state, actor, context);
    }
    const pet = state.petId && state.units[state.petId];
    if (context.debuffApplied && (actor.kind === "hero" || actor.kind === "pet") && pet && living(pet) && pet.petDefId === "storm_phoenix" && !context.cdrUsed && !(actor.id === pet.id && context.usedSkillId === "pet_active") && Number(pet.cooldowns.pet_active) > 0 && chance(state, 50)) {
      pet.cooldowns.pet_active -= 1; context.cdrUsed = true;
      log(state, "cooldown", "Thunder Judgment reduced Pet Active cooldown", { actorId: actor.id, targetId: pet.id });
    }
    tickCooldowns(actor, context.usedSkillId);
    tickStatuses(actor, context.appliedStatuses);
    if (actor.kind === "hero") {
      actor.flags.lastStandCooldown = Math.max(0, Number(actor.flags.lastStandCooldown) - 1);
      if (!actor.flags.hitSinceLastHeroAction && state.resources.aegis > 0) state.resources.aegis -= 1;
      actor.flags.hitSinceLastHeroAction = false;
    }
    resolveAegisAfterEnemyAction(state, actor, context);
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
    return JSON.stringify({ ...copy(state), flags: { ...state.flags, auto: false, skipResolving: false } });
  }
  function restoreCheckpoint(raw) {
    const state = typeof raw === "string" ? JSON.parse(raw) : copy(raw);
    if (!state || state.version !== 1 || !state.battleId || !state.units || !state.heroId || !Array.isArray(state.queue)) throw new Error("corrupt_checkpoint");
    state.flags = { ...(state.flags || {}), auto: false, skipResolving: false };
    return state;
  }

  const api = { buildHeroUnit, buildPetUnit, buildMonsterUnit, createBattle, createDungeonBattle, rebuildQueue, currentUnit, upcomingActions, applyStatus, battleStep, simulateBattle, serializeCheckpoint, restoreCheckpoint };
  Object.assign(root, { BATTLE_CORE_V1: api });
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
