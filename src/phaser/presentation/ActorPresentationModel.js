// ---------- W6 Shared Actor Presentation Model ----------
const ACTOR_PRESENTATION_MODEL_VERSION = 1;

function actorPresentationStatusData(unit) {
  return Object.entries(unit?.statuses || {}).map(([key, value]) => ({
    key,
    duration: Math.max(0, Number(value?.duration) || 0)
  })).filter(status => status.duration > 0);
}

function normalizeActorPresentationAnim(value, alive = true) {
  if (!alive) return "death";
  if (value === "attack") return "attack";
  if (value === "hurt") return "hurt";
  if (value === "death") return "death";
  return "idle";
}

function createActorPresentationModel(raw, fallback = {}) {
  const unit = { ...(fallback || {}), ...(raw || {}) };
  return {
    id: String(unit.id || fallback.id || "unit"),
    name: String(unit.name || unit.id || fallback.name || "Unit"),
    kind: String(unit.kind || fallback.kind || "monster"),
    hp: Math.max(0, Number(unit.hp) || 0),
    maxHp: Math.max(1, Number(unit.maxHp) || Number(unit.hp) || 1),
    alive: Number(unit.hp) > 0 && !unit.dead,
    statuses: actorPresentationStatusData(unit),
    defId: unit.defId || fallback.defId || unit.monsterDefId || unit.id,
    isBoss: !!(unit.isBoss || fallback.isBoss),
    isEliteBoss: !!(unit.isEliteBoss || fallback.isEliteBoss),
    sizeClass: unit.sizeClass || fallback.sizeClass || "medium",
    anchorType: unit.anchorType || fallback.anchorType || "ground",
    icon: unit.icon || fallback.icon || "◆"
  };
}

const ACTOR_PRESENTATION_MODEL = Object.freeze({
  version: ACTOR_PRESENTATION_MODEL_VERSION,
  create: createActorPresentationModel,
  statuses: actorPresentationStatusData,
  normalizeAnim: normalizeActorPresentationAnim
});
