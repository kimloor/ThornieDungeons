// ---------- W6 Battle-to-Presentation Snapshot Adapter ----------
function presentationAnimationConfig(config) {
  const urls = name => SHARED_PHASER_ASSET_RESOLVER.resolveAll(config?.animations?.[name] || []);
  return {
    idle: urls("idle"),
    attack: urls("attack"),
    hurt: urls("hurt"),
    death: urls("death")
  };
}

function heroV3PresentationLayerFrames(selection = {}) {
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
    mode: "v3",
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

function heroPresentationLayerFrames(selection = {}, { preferV5 = false, v5Selection = {} } = {}) {
  if (preferV5 && typeof resolveHeroV5BaseWingContract === "function") {
    const v5 = resolveHeroV5BaseWingContract({
      characterId: "hero001",
      includeWings: v5Selection?.wings === "angel",
      equipmentSelection: v5Selection
    });
    if (v5) {
      const normalize = layers => (layers || []).map(layer => ({
        name: layer.name,
        url: SHARED_PHASER_ASSET_RESOLVER.resolve(layer.url || layer.path),
        x: Number(layer.x) || 0,
        y: Number(layer.y) || 0,
        scale: Number(layer.scale ?? 1),
        rotation: Number(layer.rotation) || 0
      })).filter(layer => layer.url);
      return {
        ...v5,
        idle: v5.idle.map(normalize),
        attack: v5.attack.map(normalize),
        death: v5.death.map(normalize)
      };
    }
  }
  return heroV3PresentationLayerFrames(selection);
}

function buildHeroPreviewSnapshot({ heroName = "Hero", equipped = {}, heroV5 = true } = {}) {
  const heroSelection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroSelection(equipped);
  const heroV5Selection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroV5Selection(equipped);
  const heroFrames = heroPresentationLayerFrames(heroSelection, {
    preferV5: heroV5 === true,
    v5Selection: heroV5Selection
  });
  return Object.freeze({
    previewId: "hero-preview",
    hero: {
      id: "hero-preview",
      kind: "hero",
      name: String(heroName || "Hero"),
      hp: 1,
      maxHp: 1,
      alive: true,
      statuses: [],
      anim: "idle",
      facing: "right",
      visualMode: heroFrames.mode || "v3",
      layers: heroFrames.idle?.[0] || [],
      layerFrames: heroFrames
    }
  });
}

function buildBattlefieldSnapshot({ battleState, heroName = "Hero", equipped = {}, petCombat = null, monsters = [], targetUid = null, heroAnim = "", petAnim = "", enemyAnims = {}, combatSpeed = 1, heroV5 = undefined } = {}) {
  const state = battleState || {};
  const units = state.units || {};
  const hero = createActorPresentationModel(units[state.heroId], {
    id: state.heroId || "hero",
    kind: "hero",
    name: heroName,
    hp: 0,
    maxHp: 1,
    facing: "right"
  });
  const pet = state.petId && units[state.petId]
    ? createActorPresentationModel(units[state.petId], { ...(petCombat || {}), facing: "right" })
    : petCombat ? createActorPresentationModel(petCombat, { id: petCombat.instId || "pet", kind: "pet", facing: "right" }) : null;
  const enemyIds = Array.isArray(state.enemyIds) && state.enemyIds.length ? state.enemyIds : monsters.map(monster => monster.uid || monster.id);
  const enemyById = new Map((monsters || []).map(monster => [String(monster.uid || monster.id), monster]));
  const enemyList = enemyIds.map(id => createActorPresentationModel(units[id], { ...(enemyById.get(String(id)) || { id, kind: "monster" }), facing: "left" }));
  const heroSelection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroSelection(equipped);
  const heroV5Selection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroV5Selection(equipped);
  const preferHeroV5 = heroV5 === undefined
    ? (typeof isHeroV5RuntimeEnabled === "function" && isHeroV5RuntimeEnabled())
    : heroV5 === true;
  const heroFrames = heroPresentationLayerFrames(heroSelection, {
    preferV5: preferHeroV5,
    v5Selection: heroV5Selection
  });
  const heroLayers = heroFrames.idle[0] || [];
  const petConfig = pet && typeof getPetSpriteConfig === "function" ? getPetSpriteConfig(pet.defId) : null;
  const monsterConfigs = enemyList.map(enemy => typeof getMonsterSpriteConfig === "function" ? getMonsterSpriteConfig(enemy) : null);
  return Object.freeze({
    battleId: String(state.battleId || "battle-preview"),
    seq: Number(state.safeActionSeq || state.logSeq || 0),
    selectedTargetId: String(targetUid || state.selectedTargetId || enemyList.find(enemy => enemy.alive)?.id || ""),
    damageFeedbackEvents: battleDamageFeedbackEvents(state),
    combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
    hero: {
      ...hero,
      facing: "right",
      anim: normalizeActorPresentationAnim(heroAnim, hero.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      visualMode: heroFrames.mode || "v3",
      layers: heroLayers,
      layerFrames: heroFrames
    },
    pet: pet ? {
      ...pet,
      facing: "right",
      anim: normalizeActorPresentationAnim(petAnim, pet.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      frames: presentationAnimationConfig(petConfig)
    } : null,
    monsters: enemyList.map((enemy, index) => ({
      ...enemy,
      facing: "left",
      slotIndex: index,
      anim: normalizeActorPresentationAnim(enemyAnims?.[enemy.id], enemy.alive),
      combatSpeed: Math.max(1, Math.min(2, Number(combatSpeed) || 1)),
      frames: presentationAnimationConfig(monsterConfigs[index])
    })),
    backgroundUrl: SHARED_PHASER_ASSET_RESOLVER.manifest("battleUi.background")
  });
}

function arenaPresentationTeamConfig(configBySide, side, role) {
  return configBySide?.[side] || configBySide?.[role] || {};
}

function arenaPreparedEquipmentMap(equipment) {
  const mapped = {};
  (Array.isArray(equipment) ? equipment : []).forEach(item => {
    if (!item || typeof item !== "object") return;
    const slot = String(item.slotType || item.type || "").trim().toLowerCase();
    if (!slot) return;
    mapped[slot] = {
      ...item,
      id: item.itemId || item.id || item.itemTemplateId || "",
      type: slot
    };
  });
  return mapped;
}

function arenaPreparedPresentationContext(preparedSnapshot) {
  const attacker = preparedSnapshot?.attacker;
  const defender = preparedSnapshot?.defender;
  if (!attacker || !defender) return null;

  const makeTeam = (member, side, role) => {
    const heroMaxHp = Math.max(1, Number(member?.stats?.maxHp) || 1);
    const hero = {
      id: `${side}_hero`,
      side,
      kind: "hero",
      name: String(member?.name || (role === "attacker" ? "Hero" : "Opponent")),
      icon: role === "attacker" ? "⚔️" : "🛡️",
      hp: heroMaxHp,
      maxHp: heroMaxHp,
      dead: false,
      statuses: {}
    };
    const petSource = member?.pet && typeof member.pet === "object" ? member.pet : null;
    const petMaxHp = Math.max(1, Number(petSource?.maxHp || petSource?.hp) || 1);
    const pet = petSource ? {
      ...petSource,
      id: `${side}_pet`,
      side,
      kind: "pet",
      name: String(petSource.name || petSource.defId || "Pet"),
      defId: petSource.defId || petSource.id || "",
      icon: String(petSource.icon || "🐾"),
      hp: petMaxHp,
      maxHp: petMaxHp,
      dead: false,
      statuses: {}
    } : null;
    return {
      unitIds: [hero.id, pet?.id].filter(Boolean),
      units: [hero, pet].filter(Boolean),
      config: {
        heroName: hero.name,
        equipped: arenaPreparedEquipmentMap(member?.equipment),
        petCombat: petSource
      }
    };
  };

  const teamA = makeTeam(attacker, "team_a", "attacker");
  const teamB = makeTeam(defender, "team_b", "defender");
  const units = {};
  [...teamA.units, ...teamB.units].forEach(unit => { units[unit.id] = unit; });
  return {
    state: {
      mode: "arena",
      battleId: `arena-preload-${preparedSnapshot.seed || preparedSnapshot.preparedAt || "prepared"}`,
      controlledSide: "team_a",
      teamIds: ["team_a", "team_b"],
      teams: {
        team_a: { unitIds: teamA.unitIds },
        team_b: { unitIds: teamB.unitIds }
      },
      units
    },
    teams: {
      team_a: teamA.config,
      attacker: teamA.config,
      team_b: teamB.config,
      defender: teamB.config
    }
  };
}

function battleDamageFeedbackEvents(state) {
  return (Array.isArray(state?.log) ? state.log : [])
    .filter(entry => entry && Number.isFinite(Number(entry.seq))
      && ["damage", "heal", "miss", "block"].includes(String(entry.type || "")))
    .map(entry => ({
      seq: Number(entry.seq),
      type: String(entry.type),
      actorId: String(entry.actorId || ""),
      targetId: String(entry.targetId || ""),
      amount: Math.max(0, Number(entry.displayAmount ?? entry.amount) || 0),
      crit: entry.type === "damage" && entry.crit === true
    }))
    .filter(entry => entry.targetId && (
      (entry.type === "damage" || entry.type === "heal") ? entry.amount > 0 : true
    ));
}

function arenaPresentationAnimationCues(state) {
  const attackTypes = new Set(["damage", "miss", "pet_active", "counter"]);
  return (Array.isArray(state?.log) ? state.log : [])
    .filter(entry => entry && entry.actorId && attackTypes.has(String(entry.type || "")))
    .map(entry => ({
      key: `arena-cue-${Number(entry.seq) || 0}-${String(entry.actorId)}`,
      seq: Number(entry.seq) || 0,
      actorId: String(entry.actorId),
      animation: "attack"
    }));
}

function arenaPresentationUnit(state, side, kind) {
  const rawUnits = state?.units || {};
  const unitList = Array.isArray(rawUnits) ? rawUnits : Object.values(rawUnits);
  const unitsById = new Map(unitList.filter(Boolean).map(unit => [String(unit.id), unit]));
  const declared = state?.teams?.[side]?.unitIds;
  const ids = Array.isArray(declared)
    ? declared
    : unitList.filter(unit => unit?.side === side).map(unit => unit.id);
  return ids.map(id => unitsById.get(String(id))).find(unit => unit?.kind === kind) || null;
}

function buildArenaBattlefieldSnapshot({
  battleState,
  preparedSnapshot = null,
  teams = {},
  targetUid = null,
  combatSpeed = 1,
  heroV5 = undefined
} = {}) {
  const prepared = arenaPreparedPresentationContext(preparedSnapshot);
  const hasBattleUnits = Object.values(battleState?.units || {}).length > 0;
  const state = hasBattleUnits ? battleState : (prepared?.state || battleState || {});
  const presentationTeams = { ...(prepared?.teams || {}), ...(teams || {}) };
  const units = state.units || {};
  const stateSides = Array.isArray(state.teamIds) && state.teamIds.length
    ? state.teamIds.map(String)
    : Array.from(new Set(Object.values(units).map(unit => String(unit?.side || "")).filter(Boolean)));
  const attackerSide = String(state.controlledSide || stateSides[0] || "team_a");
  const defenderSide = String(stateSides.find(side => side !== attackerSide) || "team_b");
  const speed = Math.max(1, Math.min(2, Number(combatSpeed) || 1));

  const buildTeam = (side, role, facing) => {
    const config = arenaPresentationTeamConfig(presentationTeams, side, role);
    const rawHero = arenaPresentationUnit(state, side, "hero");
    const rawPet = arenaPresentationUnit(state, side, "pet");
    const hero = rawHero ? createActorPresentationModel(rawHero, {
      id: rawHero.id,
      kind: "hero",
      name: config.heroName || rawHero.name || "Hero",
      icon: config.heroIcon || (side === "team_b" ? "🛡️" : "⚔️"),
      facing
    }) : null;
    const pet = rawPet ? createActorPresentationModel(rawPet, {
      ...(config.petCombat || {}),
      id: rawPet.id,
      kind: "pet",
      icon: config.petCombat?.icon || "🐾",
      facing
    }) : null;

    const equipped = config.equipped || {};
    const heroSelection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroSelection(equipped);
    const heroV5Selection = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroV5Selection(equipped);
    const preferHeroV5 = config.heroV5 === undefined
      ? (heroV5 === undefined
          ? (typeof isHeroV5RuntimeEnabled === "function" && isHeroV5RuntimeEnabled())
          : heroV5 === true)
      : config.heroV5 === true;
    const heroFrames = heroPresentationLayerFrames(heroSelection, {
      preferV5: preferHeroV5,
      v5Selection: heroV5Selection
    });
    const petConfig = pet && typeof getPetSpriteConfig === "function" ? getPetSpriteConfig(pet.defId) : null;

    return {
      side,
      role,
      facing,
      hero: hero ? {
        ...hero,
        facing,
        anim: normalizeActorPresentationAnim(config.heroAnim, hero.alive),
        combatSpeed: speed,
        visualMode: heroFrames.mode || "v3",
        layers: heroFrames.idle?.[0] || [],
        layerFrames: heroFrames
      } : null,
      pet: pet ? {
        ...pet,
        facing,
        anim: normalizeActorPresentationAnim(config.petAnim, pet.alive),
        combatSpeed: speed,
        frames: presentationAnimationConfig(petConfig)
      } : null
    };
  };

  const attacker = buildTeam(attackerSide, "attacker", "right");
  const defender = buildTeam(defenderSide, "defender", "left");
  const selectedTargetId = String(
    targetUid
    || state.selectedTargetIds?.[attackerSide]
    || state.selectedTargetId
    || (defender.hero?.alive ? defender.hero.id : "")
    || (defender.pet?.alive ? defender.pet.id : "")
    || ""
  );

  return Object.freeze({
    mode: "arena",
    battleId: String(state.battleId || "arena-preview"),
    seq: Number(state.safeActionSeq ?? state.actionSeq ?? state.logSeq ?? 0),
    selectedTargetId,
    combatSpeed: speed,
    teams: [attacker, defender],
    animationCues: arenaPresentationAnimationCues(state),
    damageFeedbackEvents: battleDamageFeedbackEvents(state),
    suppressDamageFeedback: state.presentationSkip === true,
    backgroundUrl: SHARED_PHASER_ASSET_RESOLVER.manifest("arenaUi.background")
  });
}


function buildRaidBossPresentationSnapshot({ boss = {}, config = null, hurtToken = 0 } = {}) {
  return Object.freeze({
    mode: "raid",
    raidBossId: String(boss.defId || boss.id || "raid-boss"),
    hurtToken: Math.max(0, Number(hurtToken) || 0),
    boss: {
      id: String(boss.defId || boss.id || "raid-boss"),
      kind: "raid_boss",
      name: String(boss.name || "Raid Boss"),
      hp: Math.max(0, Number(boss.hpCurrent) || 0),
      maxHp: Math.max(1, Number(boss.hpMax) || 1),
      alive: Number(boss.hpCurrent) > 0,
      facing: "left",
      sizeClass: "elite",
      frames: presentationAnimationConfig(config)
    }
  });
}

if (typeof module !== "undefined" && module.exports) module.exports = { battleDamageFeedbackEvents };
