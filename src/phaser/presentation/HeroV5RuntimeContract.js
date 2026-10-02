// ---------- W8 Hero V5 G2 Runtime Contract ----------
const HERO_V5_RUNTIME_CONTRACT = Object.freeze({
  version: 3,
  characterId: "hero001",
  variant: "g2",
  canvas: Object.freeze({ width: 768, height: 768 }),
  runtimeOffsetY: 84,
  animationFrames: Object.freeze({
    idle: Object.freeze(["idle_01", "idle_02", "idle_03"]),
    attack: Object.freeze(["attack_01", "attack_02", "attack_03"]),
    death: Object.freeze(["death_01", "death_02"])
  }),
  layerOrder: Object.freeze(["wing_far", "base", "wing_near"]),
  azureLayerOrder: Object.freeze([
    "coverage_underlay",
    "torso_armor",
    "legs_boots",
    "arm_rear",
    "helmet",
    "sword",
    "arm_front"
  ])
});

const HERO_V5_AZURE_SLOT_LAYERS = Object.freeze({
  helmet: Object.freeze(["helmet"]),
  chest: Object.freeze(["torso_armor"]),
  gloves: Object.freeze(["arm_rear", "arm_front"]),
  boots: Object.freeze(["legs_boots"]),
  weapon: Object.freeze(["sword"])
});
const HERO_V5_SET_FAMILIES = Object.freeze(["azure", "robot", "skeleton"]);

function isHeroV5RuntimeEnabled() {
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_HERO_V5__ === true) return true;
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_HERO_V5__ === false) return false;
  try {
    const value = new URLSearchParams(globalThis.location?.search || "").get("heroV5");
    return value !== "0";
  } catch (_) {
    return true;
  }
}

function getHeroV5RuntimeConfig(characterId = HERO_V5_RUNTIME_CONTRACT.characterId) {
  const config = typeof ASSETS === "object" && ASSETS
    ? ASSETS?.[characterId]?.v5?.[HERO_V5_RUNTIME_CONTRACT.variant]
    : null;
  if (!config || config.approval !== "approved" || config.base?.approval !== "approved") return null;
  const canvasWidth = Number(config.canvas?.width) || 0;
  const canvasHeight = Number(config.canvas?.height) || 0;
  if (canvasWidth !== HERO_V5_RUNTIME_CONTRACT.canvas.width || canvasHeight !== HERO_V5_RUNTIME_CONTRACT.canvas.height) return null;
  return config;
}

function heroV5AllFrameIds() {
  return Object.values(HERO_V5_RUNTIME_CONTRACT.animationFrames).flat();
}

function heroV5BaseBundleComplete(config) {
  return heroV5AllFrameIds().every(frameId => !!config?.base?.frames?.[frameId]);
}

function heroV5HairBundleComplete(config) {
  const hairId = config?.defaultHair || "topknot";
  const hairConfig = config?.hair?.[hairId];
  if (!hairConfig || hairConfig.approval !== "approved") return false;
  return heroV5AllFrameIds().every(frameId => {
    const frame = hairConfig.frames?.[frameId];
    return !!(frame?.hair_back && frame?.hair_front);
  });
}

function heroV5WingBundleComplete(config, family = "azure") {
  const wingConfig = family === "azure" ? { frames: config?.wingTemplate?.frames, approval: "approved" } : config?.wings?.[family];
  if (wingConfig?.approval && wingConfig.approval !== "approved") return false;
  return heroV5AllFrameIds().every(frameId => {
    const frame = wingConfig?.frames?.[frameId];
    return !!(frame?.wing_far && frame?.wing_near);
  });
}

function heroV5EquipmentSlotBundleComplete(config, family, slot) {
  const equipmentConfig = config?.equipment?.[family];
  const layers = HERO_V5_AZURE_SLOT_LAYERS[slot] || [];
  if (!HERO_V5_SET_FAMILIES.includes(family) || !layers.length || equipmentConfig?.approval !== "approved") return false;
  return heroV5AllFrameIds().every(frameId => {
    const frame = equipmentConfig.frames?.[frameId];
    return layers.every(layer => !!frame?.[layer]);
  });
}

function heroV5BossWeaponBundleComplete(config, visualId) {
  const weapon = config?.equipment?.[visualId];
  return !!weapon && weapon.approval === "approved" && heroV5AllFrameIds().every(frameId => !!weapon.frames?.[frameId]?.sword);
}

function heroV5SanitizeEquipmentSelection(config, selection = {}) {
  const requestedEquipment = selection?.equipment || Object.fromEntries(Object.entries(selection?.azure || {}).map(([slot, enabled]) => [slot, enabled ? "azure" : null]));
  const equipment = {};
  const azure = {};
  const fallbackSlots = [];
  Object.keys(HERO_V5_AZURE_SLOT_LAYERS).forEach(slot => {
    const requested = requestedEquipment[slot];
    const supported = requested && heroV5EquipmentSlotBundleComplete(config, requested, slot) ? requested : null;
    equipment[slot] = supported;
    azure[slot] = supported === "azure";
    if (requested && !supported) fallbackSlots.push(slot);
  });
  const requestedBossWeapon = selection?.bossWeapon || null;
  const bossWeapon = requestedBossWeapon && heroV5BossWeaponBundleComplete(config, requestedBossWeapon) ? requestedBossWeapon : null;
  if (requestedBossWeapon && !bossWeapon && !fallbackSlots.includes("weapon")) fallbackSlots.push("weapon");
  const requestedWings = ["angel", "azure", "robot", "skeleton"].includes(selection?.wings) ? selection.wings : null;
  const wings = requestedWings && heroV5WingBundleComplete(config, requestedWings === "angel" ? "azure" : requestedWings) ? requestedWings : null;
  if (requestedWings && !wings) fallbackSlots.push("wings");
  return {
    wings,
    equipment,
    bossWeapon,
    azure,
    fallbackSlots
  };
}

function heroV5EquipmentLayersForSelection(selection = {}) {
  const equipment = selection?.equipment || Object.fromEntries(Object.entries(selection?.azure || {}).map(([slot, enabled]) => [slot, enabled ? "azure" : null]));
  const requested = [];
  // The underlay is a whole-body seam closer. Only use it when the three
  // body-coverage slots are present; otherwise the neutral Base must remain
  // visible in unequipped areas.
  if (equipment.chest && equipment.chest === equipment.gloves && equipment.chest === equipment.boots) requested.push("coverage_underlay");
  if (equipment.chest) requested.push("torso_armor");
  if (equipment.boots) requested.push("legs_boots");
  if (equipment.gloves) requested.push("arm_rear");
  if (equipment.helmet) requested.push("helmet");
  if (selection.bossWeapon || equipment.weapon) requested.push("sword");
  if (equipment.gloves) requested.push("arm_front");
  return HERO_V5_RUNTIME_CONTRACT.azureLayerOrder.filter(name => requested.includes(name));
}

function heroV5AzureLayersForSelection(selection = {}) { return heroV5EquipmentLayersForSelection(selection); }

function heroV5FrameLayer(name, path) {
  return {
    name,
    path,
    x: 0,
    y: HERO_V5_RUNTIME_CONTRACT.runtimeOffsetY,
    scale: 1,
    rotation: 0
  };
}

function heroV5HairLayers(config, frameId, includeHair = true) {
  if (!includeHair) return [];
  const hairId = config?.defaultHair || "topknot";
  const hairConfig = config?.hair?.[hairId];
  const frame = hairConfig?.frames?.[frameId];
  if (!frame?.hair_back || !frame?.hair_front) return [];
  return [
    heroV5FrameLayer("hair_back", frame.hair_back),
    heroV5FrameLayer("hair_front", frame.hair_front)
  ];
}

function heroV5FrameLayers(config, frameId, {
  includeWings = false,
  includeHair = true,
  equipmentSelection = {}
} = {}) {
  const basePath = config?.base?.frames?.[frameId];
  if (!basePath) return null;

  const wingFamily = equipmentSelection?.wings === "robot" || equipmentSelection?.wings === "skeleton" ? equipmentSelection.wings : "azure";
  const wingConfig = wingFamily === "azure" ? config?.wingTemplate : config?.wings?.[wingFamily];
  const wingFrame = includeWings ? wingConfig?.frames?.[frameId] : null;
  const equipmentLayerNames = heroV5EquipmentLayersForSelection(equipmentSelection);

  const layers = [];
  if (includeWings && wingFrame?.wing_far) layers.push(heroV5FrameLayer("wing_far", wingFrame.wing_far));
  layers.push(heroV5FrameLayer("base", basePath));
  // Suppress hair only when a complete full-face helmet is actually selected.
  const helmetFamily = equipmentSelection?.equipment?.helmet;
  const helmetFrame = helmetFamily ? config?.equipment?.[helmetFamily]?.frames?.[frameId] : null;
  const fullFaceHelmet = equipmentLayerNames.includes("helmet") && !!helmetFrame?.helmet
    && config?.equipment?.[helmetFamily]?.fullFaceHelmet === true;
  layers.push(...heroV5HairLayers(config, frameId, includeHair && !fullFaceHelmet));
  equipmentLayerNames.forEach(name => {
    const slot = name === "torso_armor" || name === "coverage_underlay" ? "chest" : name === "legs_boots" ? "boots" : name === "arm_rear" || name === "arm_front" ? "gloves" : name === "helmet" ? "helmet" : "weapon";
    const family = slot === "weapon" && equipmentSelection?.bossWeapon ? equipmentSelection.bossWeapon : equipmentSelection?.equipment?.[slot];
    const path = family ? config?.equipment?.[family]?.frames?.[frameId]?.[name] : null;
    if (path) layers.push(heroV5FrameLayer(name, path));
  });
  if (includeWings && wingFrame?.wing_near) layers.push(heroV5FrameLayer("wing_near", wingFrame.wing_near));
  return layers;
}

function resolveHeroV5BaseWingContract({ characterId = "hero001", includeWings = false, equipmentSelection = {} } = {}) {
  const config = getHeroV5RuntimeConfig(characterId);
  if (!config || !heroV5BaseBundleComplete(config)) return null;

  const requestedSelection = {
    ...(equipmentSelection || {}),
    wings: equipmentSelection?.wings || (includeWings ? "angel" : null)
  };
  const sanitizedSelection = heroV5SanitizeEquipmentSelection(config, requestedSelection);
  const requestedWings = !!sanitizedSelection.wings;
  const renderWings = requestedWings;
  const includeHair = heroV5HairBundleComplete(config);
  const fallbackSlots = [...sanitizedSelection.fallbackSlots];
  if (requestedWings && !renderWings && !fallbackSlots.includes("wings")) fallbackSlots.push("wings");

  const resolved = {};
  for (const [state, frameIds] of Object.entries(HERO_V5_RUNTIME_CONTRACT.animationFrames)) {
    const frames = frameIds.map(frameId => heroV5FrameLayers(config, frameId, {
      includeWings: renderWings,
      includeHair,
      equipmentSelection: sanitizedSelection
    }));
    if (frames.some(frame => !Array.isArray(frame) || !frame.length)) return null;
    resolved[state] = frames;
  }

  const hasEquipment = heroV5EquipmentLayersForSelection(sanitizedSelection).length > 0;
  const families = Object.values(sanitizedSelection.equipment || {}).filter(Boolean);
  const familyMode = sanitizedSelection.bossWeapon || (families.length && families.every(value => value === families[0]) ? families[0] : "mixed");
  return Object.freeze({
    mode: hasEquipment ? `v5-g2-${familyMode || "equipment"}` : "v5-g2",
    canvas: {
      width: HERO_V5_RUNTIME_CONTRACT.canvas.width,
      height: HERO_V5_RUNTIME_CONTRACT.canvas.height
    },
    idle: resolved.idle,
    attack: resolved.attack,
    death: resolved.death,
    visualFallbacks: Object.freeze(fallbackSlots),
    frameMs: {
      idle: 440,
      attack: 300,
      death: 360
    }
  });
}
