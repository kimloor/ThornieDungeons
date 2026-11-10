// Battle VFX observes completed Battle Core output. It never resolves hits,
// statuses, damage, cooldowns or turns; future modes should reuse this bridge.
const BATTLE_VFX_PRESENTATION = (() => {
  const OPTIONAL_BASIC_EFFECT_KEY = "slash_normal";
  const SKILL_EFFECTS = Object.freeze({
    power_strike: { effectKey: "slash_basic", kind: "single", placement: "anchor" },
    heavy_blow: { effectKey: "slash_heavy", kind: "single", placement: "anchor" },
    toxic_strike: { effectKey: "slash_status.toxic", kind: "single", placement: "anchor", status: "poison", statusEffectKey: "poison_hit" },
    silent_edge: { effectKey: "slash_status.silence", kind: "single", placement: "anchor", status: "silence", statusEffectKey: "silence_hit" },
    guard: { effectKey: "buff_aura", kind: "aura", placement: "target", self: true },
    blade_storm: { effectKey: "blade_storm", kind: "aoe", placement: "arena" }
  });
  const STATUS_CONFIRMATIONS = Object.freeze({
    poison: "poison_hit",
    silence: "silence_hit"
  });

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function actorAnchor(actor) {
    if (actor?.kind === "hero") return "hero";
    if (actor?.kind === "pet") return "pet";
    return "monster";
  }

  function actionTargets(next, actor, logs) {
    return unique(logs
      .filter(entry => entry.actorId === actor.id && (entry.type === "damage" || entry.type === "miss" || entry.type === "block"))
      .map(entry => entry.targetId)
      .filter(targetId => next?.units?.[targetId]?.side !== actor.side));
  }

  function targetConfirmations(logs, actor, skillId, statuses = Object.keys(STATUS_CONFIRMATIONS)) {
    const allowed = new Set(statuses);
    return logs
      .filter(entry => entry.type === "status" && entry.actorId === actor.id && allowed.has(entry.status) && STATUS_CONFIRMATIONS[entry.status])
      .map(entry => ({
        effectKey: STATUS_CONFIRMATIONS[entry.status],
        kind: "status",
        placement: "target",
        anchor: "target",
        targetId: entry.targetId,
        skillId
      }));
  }

  function petActiveSkill(actor) {
    const catalog = typeof globalThis !== "undefined" ? globalThis.PET_COMBAT_SKILLS_V2 : null;
    return { ...(catalog?.[actor?.petDefId]?.active || {}), ...(actor?.active || {}) };
  }

  function heroEvents(previous, next, actor, command, logs, options) {
    const targets = actionTargets(next, actor, logs);
    const requestedBasic = !command || command.type === "basic";
    const resolvedBasic = requestedBasic && logs.some(entry =>
      entry.actorId === actor.id && (
        ((entry.type === "damage" || entry.type === "miss") && entry.actionName === "basic attack") || entry.type === "block"
      )
    );
    const skillId = command?.type === "active" ? command.skillId : resolvedBasic ? "basic_attack" : null;
    const mapping = skillId === "basic_attack"
      ? (options.basicEffectKey ? { effectKey: options.basicEffectKey, kind: "single", placement: "anchor" } : null)
      : SKILL_EFFECTS[skillId];
    if (!mapping) return [];

    const beforeActor = previous?.units?.[actor.id];
    const nextActor = next?.units?.[actor.id];
    const cooldownAdvanced = skillId !== "basic_attack" && Number(nextActor?.cooldowns?.[skillId] || 0) > Number(beforeActor?.cooldowns?.[skillId] || 0);
    const spentSp = Number(nextActor?.sp || 0) < Number(beforeActor?.sp || 0);
    // A start-of-Action status can defeat the actor before the command executes.
    if (!targets.length && !cooldownAdvanced && !spentSp) return [];

    const fallbackTarget = command?.targetId && next?.units?.[command.targetId]?.side !== actor.side
      ? command.targetId
      : next?.selectedTargetIds?.[actor.side] || next?.selectedTargetId;
    const targetIds = mapping.self ? [actor.id] : (targets.length ? targets : [fallbackTarget]);
    const events = mapping.placement === "arena"
      ? [{ effectKey: mapping.effectKey, kind: mapping.kind, placement: "arena", anchor: "arena", targetId: null, targetIds: unique(targetIds), skillId }]
      : mapping.placement === "target"
        ? unique(targetIds).map(targetId => ({ effectKey: mapping.effectKey, kind: mapping.kind, placement: "target", anchor: "target", targetId, skillId }))
        : [{ effectKey: mapping.effectKey, kind: mapping.kind, placement: "anchor", anchor: actorAnchor(actor), targetId: null, targetIds: unique(targetIds), skillId }];

    if (mapping.status) events.push(...targetConfirmations(logs, actor, skillId, [mapping.status]));
    return events;
  }

  function petEvents(next, actor, logs, options) {
    const activeLog = logs.find(entry => entry.type === "pet_active" && entry.actorId === actor.id);
    const targets = actionTargets(next, actor, logs);
    const resolvedBasic = !activeLog && logs.some(entry =>
      entry.actorId === actor.id && (
        ((entry.type === "damage" || entry.type === "miss") && entry.actionName === "basic attack") || entry.type === "block"
      )
    );
    if (resolvedBasic) {
      if (!options.basicEffectKey) return [];
      return [{ effectKey: options.basicEffectKey, kind: "single", placement: "anchor", anchor: "pet", targetId: null, targetIds: targets, skillId: "basic_attack" }];
    }
    if (!activeLog) return [];

    const active = petActiveSkill(actor);
    const skillId = "pet_active";
    const isSupport = active.type === "regen" || active.type === "groupHeal";
    const isAoe = active.type === "aoe";
    let mainEffect = null;
    if (isSupport) mainEffect = { effectKey: "buff_aura", kind: "aura", placement: "target", anchor: "target", targetId: actor.id, skillId };
    else if (isAoe) mainEffect = { effectKey: "blade_storm", kind: "aoe", placement: "arena", anchor: "arena", targetId: null, targetIds: targets, skillId };
    else if (active.poisonChance) mainEffect = { effectKey: "slash_status.toxic", kind: "single", placement: "anchor", anchor: "pet", targetId: null, targetIds: targets, skillId };
    else if (active.silenceChance) mainEffect = { effectKey: "slash_status.silence", kind: "single", placement: "anchor", anchor: "pet", targetId: null, targetIds: targets, skillId };
    else if (active.type === "damage") mainEffect = { effectKey: "slash_basic", kind: "single", placement: "anchor", anchor: "pet", targetId: null, targetIds: targets, skillId };

    const events = mainEffect ? [mainEffect] : [];
    events.push(...targetConfirmations(logs, actor, skillId));
    logs
      .filter(entry => entry.type === "status" && entry.actorId === actor.id && entry.status === "def_up")
      .forEach(entry => events.push({ effectKey: "buff_aura", kind: "aura", placement: "target", anchor: "target", targetId: entry.targetId, skillId }));
    return events;
  }

  function monsterEvents(next, actor, logs, options) {
    const targets = actionTargets(next, actor, logs);
    const resolvedAttack = logs.some(entry => entry.actorId === actor.id && (
      entry.type === "block" || ((entry.type === "damage" || entry.type === "miss") && entry.actionName === "basic attack")
    ));
    if (!resolvedAttack) return [];
    const events = options.basicEffectKey
      ? [{ effectKey: options.basicEffectKey, kind: "single", placement: "anchor", anchor: "monster", targetId: null, targetIds: targets, skillId: "basic_attack" }]
      : [];
    events.push(...targetConfirmations(logs, actor, "basic_attack"));
    return events;
  }

  function resolvedEvents(previous, next, actor, command, completedAction = true, options = {}) {
    if (!completedAction || !actor) return [];
    const logs = (next?.log || []).filter(entry => Number(entry.seq) > Number(previous?.logSeq || 0));
    if (actor.kind === "hero") return heroEvents(previous, next, actor, command, logs, options);
    if (actor.kind === "pet") return petEvents(next, actor, logs, options);
    if (actor.kind === "monster" || actor.kind === "boss" || actor.kind === "raid_boss") return monsterEvents(next, actor, logs, options);
    return [];
  }

  return Object.freeze({ OPTIONAL_BASIC_EFFECT_KEY, SKILL_EFFECTS, resolvedEvents });
})();

if (typeof module !== "undefined" && module.exports) module.exports = BATTLE_VFX_PRESENTATION;
