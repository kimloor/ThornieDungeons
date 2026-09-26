// ---------- W5 Read-only Presentation Bridge ----------
function presentationStatusData(unit) {
  return Object.entries(unit?.statuses || {}).map(([key, value]) => ({
    key,
    duration: Math.max(0, Number(value?.duration) || 0)
  })).filter(status => status.duration > 0);
}

function presentationUnit(raw, fallback = {}) {
  const unit = { ...(fallback || {}), ...(raw || {}) };
  return {
    id: String(unit.id || fallback.id || "unit"),
    name: String(unit.name || unit.id || fallback.name || "Unit"),
    kind: String(unit.kind || fallback.kind || "monster"),
    hp: Math.max(0, Number(unit.hp) || 0),
    maxHp: Math.max(1, Number(unit.maxHp) || Number(unit.hp) || 1),
    alive: Number(unit.hp) > 0 && !unit.dead,
    statuses: presentationStatusData(unit),
    defId: unit.defId || fallback.defId || unit.monsterDefId || unit.id,
    isBoss: !!(unit.isBoss || fallback.isBoss),
    isEliteBoss: !!(unit.isEliteBoss || fallback.isEliteBoss),
    sizeClass: unit.sizeClass || fallback.sizeClass || "medium",
    anchorType: unit.anchorType || fallback.anchorType || "ground",
    icon: unit.icon || fallback.icon || "◆"
  };
}

function presentationAnimationConfig(config) {
  const urls = name => SHARED_PHASER_ASSET_RESOLVER.resolveAll(config?.animations?.[name] || []);
  return {
    idle: urls("idle"),
    attack: urls("attack"),
    death: urls("death")
  };
}

function normalizePresentationAnim(value, alive = true) {
  if (!alive) return "death";
  if (value === "attack") return "attack";
  if (value === "hurt") return "hurt";
  if (value === "death") return "death";
  return "idle";
}

function heroPresentationLayerFrames(selection = {}) {
  const config = typeof getHeroV3Config === "function" ? getHeroV3Config("hero001") : null;
  const normalize = layers => (layers || []).map(layer => ({
    name: layer.name,
    url: SHARED_PHASER_ASSET_RESOLVER.resolve(layer.url || layer.path),
    x: Number(layer.x) || 0,
    y: Number(layer.y) || 0,
    scale: Number(layer.scale ?? 1),
    rotation: Number(layer.rotation) || 0
  })).filter(layer => layer.url);
  const idle = normalize(typeof resolveHeroV3Layers === "function"
    ? resolveHeroV3Layers("hero001", selection, "idle", 0)
    : []);
  const attackCount = Array.isArray(config?.base?.attack) ? config.base.attack.length : 0;
  const attack = Array.from({ length: attackCount }, (_, index) =>
    normalize(resolveHeroV3Layers("hero001", selection, "attack", index) || idle)
  );
  return {
    canvas: {
      width: Math.max(1, Number(config?.canvas?.width) || 1254),
      height: Math.max(1, Number(config?.canvas?.height) || 1254)
    },
    idle: [idle],
    attack: attack.length ? attack : [idle],
    death: [idle],
    frameMs: {
      idle: 220,
      attack: Math.max(80, Number(config?.attackFrameMs) || 140),
      death: 180
    }
  };
}

function buildBattlefieldSnapshot({ battleState, heroName = "Hero", equipped = {}, petCombat = null, monsters = [], targetUid = null, heroAnim = "", petAnim = "", enemyAnims = {}, combatSpeed = 1 } = {}) {
  const state = battleState || {};
  const units = state.units || {};
  const hero = presentationUnit(units[state.heroId], {
    id: state.heroId || "hero",
    kind: "hero",
    name: heroName,
    hp: 0,
    maxHp: 1
  });
  const pet = state.petId && units[state.petId]
    ? presentationUnit(units[state.petId], petCombat || {})
    : petCombat ? presentationUnit(petCombat, { id: petCombat.instId || "pet", kind: "pet" }) : null;
  const enemyIds = Array.isArray(state.enemyIds) && state.enemyIds.length ? state.enemyIds : monsters.map(monster => monster.uid || monster.id);
  const enemyById = new Map((monsters || []).map(monster => [String(monster.uid || monster.id), monster]));
  const enemyList = enemyIds.map(id => presentationUnit(units[id], enemyById.get(String(id)) || { id, kind: "monster" }));
  const heroSelection = typeof heroVisualSelectionFromEquipment === "function" ? heroVisualSelectionFromEquipment(equipped) : {};
  const heroFrames = heroPresentationLayerFrames(heroSelection);
  const heroLayers = heroFrames.idle[0] || [];
  const petConfig = pet && typeof getPetSpriteConfig === "function" ? getPetSpriteConfig(pet.defId) : null;
  const monsterConfigs = enemyList.map(enemy => typeof getMonsterSpriteConfig === "function" ? getMonsterSpriteConfig(enemy) : null);
  return Object.freeze({
    battleId: String(state.battleId || "battle-preview"),
    seq: Number(state.safeActionSeq || state.logSeq || 0),
    selectedTargetId: String(targetUid || state.selectedTargetId || enemyList.find(enemy => enemy.alive)?.id || ""),
    combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
    hero: {
      ...hero,
      anim: normalizePresentationAnim(heroAnim, hero.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      layers: heroLayers,
      layerFrames: heroFrames
    },
    pet: pet ? {
      ...pet,
      anim: normalizePresentationAnim(petAnim, pet.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      frames: presentationAnimationConfig(petConfig)
    } : null,
    monsters: enemyList.map((enemy, index) => ({
      ...enemy,
      slotIndex: index,
      anim: normalizePresentationAnim(enemyAnims?.[enemy.id], enemy.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      frames: presentationAnimationConfig(monsterConfigs[index])
    })),
    backgroundUrl: SHARED_PHASER_ASSET_RESOLVER.manifest("battleUi.background")
  });
}

function createPresentationEventBridge({ onEvent, onStatus } = {}) {
  let currentBattleId = null;
  let latestSeq = -1;
  const emit = (event, allowStale = false) => {
    if (!event || (!allowStale && currentBattleId && event.battleId && event.battleId !== currentBattleId)) return false;
    if (!allowStale && Number.isFinite(Number(event.seq)) && Number(event.seq) < latestSeq) return false;
    if (event.battleId) currentBattleId = String(event.battleId);
    if (Number.isFinite(Number(event.seq))) latestSeq = Math.max(latestSeq, Number(event.seq));
    onEvent?.(Object.freeze({ ...event, battleId: currentBattleId, seq: latestSeq }));
    return true;
  };
  return Object.freeze({
    sync(snapshot) { return emit({ type: "BATTLEFIELD_SYNC", battleId: snapshot?.battleId, seq: snapshot?.seq, snapshot }, true); },
    targetSelected(targetId) { return onEvent?.({ type: "TARGET_SELECTED", battleId: currentBattleId, targetId }); },
    status(statusValue, detail) { onStatus?.(statusValue, detail); },
    reset() { currentBattleId = null; latestSeq = -1; }
  });
}
