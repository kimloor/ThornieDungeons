// Battle VFX observes completed Battle Core output. It never resolves hits,
// statuses, damage, cooldowns or turns; future modes should reuse this bridge.
const BATTLE_VFX_PRESENTATION = (() => {
  const SKILL_EFFECTS = Object.freeze({
    power_strike: { effectKey: "slash_basic", kind: "single" },
    heavy_blow: { effectKey: "slash_heavy", kind: "single" },
    toxic_strike: { effectKey: "slash_status.toxic", kind: "single", status: "poison", statusEffectKey: "poison_hit" },
    silent_edge: { effectKey: "slash_status.silence", kind: "single", status: "silence", statusEffectKey: "silence_hit" },
    guard: { effectKey: "buff_aura", kind: "aura", self: true },
    blade_storm: { effectKey: "blade_storm", kind: "aoe" }
  });

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function resolvedEvents(previous, next, actor, command, completedAction = true) {
    const skillId = command?.type === "active" ? command.skillId : null;
    const mapping = SKILL_EFFECTS[skillId];
    if (!completedAction || actor?.kind !== "hero" || !mapping) return [];

    const newLogs = (next?.log || []).filter(entry => Number(entry.seq) > Number(previous?.logSeq || 0));
    const actionTargets = unique(newLogs
      .filter(entry => entry.actorId === actor.id && (entry.type === "damage" || entry.type === "miss"))
      .map(entry => entry.targetId)
      .filter(targetId => next?.units?.[targetId]?.side !== actor.side));
    const beforeActor = previous?.units?.[actor.id];
    const nextActor = next?.units?.[actor.id];
    const cooldownAdvanced = Number(nextActor?.cooldowns?.[skillId] || 0) > Number(beforeActor?.cooldowns?.[skillId] || 0);
    const spentSp = Number(nextActor?.sp || 0) < Number(beforeActor?.sp || 0);

    // A start-of-Action status can defeat the actor before the command executes.
    // In that case completedAction is true, but no skill VFX should be invented.
    if (!actionTargets.length && !cooldownAdvanced && !spentSp) return [];

    const fallbackTarget = command?.targetId && next?.units?.[command.targetId]?.side !== actor.side
      ? command.targetId
      : next?.selectedTargetIds?.[actor.side] || next?.selectedTargetId;
    const targetIds = mapping.self ? [actor.id] : (actionTargets.length ? actionTargets : [fallbackTarget]);
    const events = unique(targetIds).map(targetId => ({ effectKey: mapping.effectKey, kind: mapping.kind, targetId, skillId }));

    if (mapping.status) {
      const appliedTargets = unique(newLogs
        .filter(entry => entry.type === "status" && entry.actorId === actor.id && entry.status === mapping.status)
        .map(entry => entry.targetId));
      appliedTargets.forEach(targetId => events.push({ effectKey: mapping.statusEffectKey, kind: "status", targetId, skillId }));
    }
    return events;
  }

  return Object.freeze({ SKILL_EFFECTS, resolvedEvents });
})();

if (typeof module !== "undefined" && module.exports) module.exports = BATTLE_VFX_PRESENTATION;
