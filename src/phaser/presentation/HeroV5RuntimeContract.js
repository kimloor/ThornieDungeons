// ---------- W8 Hero V5 G2 Runtime Contract ----------
const HERO_V5_RUNTIME_CONTRACT = Object.freeze({
  version: 2,
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

function isHeroV5RuntimeEnabled() {
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_HERO_V5__ === true) return true;
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_HERO_V5__ === false) return false;
  try {
    return new URLSearchParams(globalThis.location?.search || "").get("heroV5") === "1";
  } catch (_) {
    return false;
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

function heroV5WingBundleComplete(config) {
  return heroV5AllFrameIds().every(frameId => {
    const frame = config?.wingTemplate?.frames?.[frameId];
    return !!(frame?.wing_far && frame?.wing_near);
  });
}

function heroV5AzureSlotBundleComplete(config, slot) {
  const azureConfig = config?.equipment?.azure;
  const layers = HERO_V5_AZURE_SLOT_LAYERS[slot] || [];
  if (!layers.length || azureConfig?.approval !== "approved") return false;
  return heroV5AllFrameIds().every(frameId => {
    const frame = azureConfig.frames?.[frameId];
    return layers.every(layer => !!frame?.[layer]);
  });
}

function heroV5SanitizeEquipmentSelection(config, selection = {}) {
  const requestedAzure = selection?.azure || {};
  const azure = {};
  const fallbackSlots = [];
  Object.keys(HERO_V5_AZURE_SLOT_LAYERS).forEach(slot => {
    const requested = !!requestedAzure[slot];
    const supported = requested && heroV5AzureSlotBundleComplete(config, slot);
    azure[slot] = supported;
    if (requested && !supported) fallbackSlots.push(slot);
  });
  const requestedWings = selection?.wings === "angel";
  const wings = requestedWings && heroV5WingBundleComplete(config) ? "angel" : null;
  if (requestedWings && !wings) fallbackSlots.push("wings");
  return {
    wings,
    azure,
    fallbackSlots
  };
}

function heroV5AzureLayersForSelection(selection = {}) {
  const azure = selection?.azure || {};
  const requested = [];
  // The underlay is a whole-body seam closer. Only use it when the three
  // body-coverage slots are present; otherwise the neutral Base must remain
  // visible in unequipped areas.
  if (azure.chest && azure.gloves && azure.boots) requested.push("coverage_underlay");
  if (azure.chest) requested.push("torso_armor");
  if (azure.boots) requested.push("legs_boots");
  if (azure.gloves) requested.push("arm_rear");
  if (azure.helmet) requested.push("helmet");
  if (azure.weapon) requested.push("sword");
  if (azure.gloves) requested.push("arm_front");
  return HERO_V5_RUNTIME_CONTRACT.azureLayerOrder.filter(name => requested.includes(name));
}

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

  const wingFrame = includeWings ? config?.wingTemplate?.frames?.[frameId] : null;
  const azureLayerNames = heroV5AzureLayersForSelection(equipmentSelection);
  const azureFrame = azureLayerNames.length ? config?.equipment?.azure?.frames?.[frameId] : null;

  const layers = [];
  if (includeWings && wingFrame?.wing_far) layers.push(heroV5FrameLayer("wing_far", wingFrame.wing_far));
  layers.push(heroV5FrameLayer("base", basePath));
  layers.push(...heroV5HairLayers(config, frameId, includeHair));
  azureLayerNames.forEach(name => {
    const path = azureFrame?.[name];
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
    wings: equipmentSelection?.wings === "angel" || includeWings ? "angel" : null
  };
  const sanitizedSelection = heroV5SanitizeEquipmentSelection(config, requestedSelection);
  const requestedWings = requestedSelection.wings === "angel";
  const renderWings = requestedWings && sanitizedSelection.wings === "angel";
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

  const hasAzureEquipment = heroV5AzureLayersForSelection(sanitizedSelection).length > 0;
  return Object.freeze({
    mode: hasAzureEquipment ? "v5-g2-azure" : "v5-g2",
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
