// ---------- W6 Battle-to-Presentation Snapshot Adapter ----------
function presentationAnimationConfig(config) {
  const urls = name => SHARED_PHASER_ASSET_RESOLVER.resolveAll(config?.animations?.[name] || []);
  return {
    idle: urls("idle"),
    attack: urls("attack"),
    death: urls("death")
  };
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
  const hero = createActorPresentationModel(units[state.heroId], {
    id: state.heroId || "hero",
    kind: "hero",
    name: heroName,
    hp: 0,
    maxHp: 1
  });
  const pet = state.petId && units[state.petId]
    ? createActorPresentationModel(units[state.petId], petCombat || {})
    : petCombat ? createActorPresentationModel(petCombat, { id: petCombat.instId || "pet", kind: "pet" }) : null;
  const enemyIds = Array.isArray(state.enemyIds) && state.enemyIds.length ? state.enemyIds : monsters.map(monster => monster.uid || monster.id);
  const enemyById = new Map((monsters || []).map(monster => [String(monster.uid || monster.id), monster]));
  const enemyList = enemyIds.map(id => createActorPresentationModel(units[id], enemyById.get(String(id)) || { id, kind: "monster" }));
  const heroSelection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroSelection(equipped);
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
      anim: normalizeActorPresentationAnim(heroAnim, hero.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      layers: heroLayers,
      layerFrames: heroFrames
    },
    pet: pet ? {
      ...pet,
      anim: normalizeActorPresentationAnim(petAnim, pet.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      frames: presentationAnimationConfig(petConfig)
    } : null,
    monsters: enemyList.map((enemy, index) => ({
      ...enemy,
      slotIndex: index,
      anim: normalizeActorPresentationAnim(enemyAnims?.[enemy.id], enemy.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      frames: presentationAnimationConfig(monsterConfigs[index])
    })),
    backgroundUrl: SHARED_PHASER_ASSET_RESOLVER.manifest("battleUi.background")
  });
}
