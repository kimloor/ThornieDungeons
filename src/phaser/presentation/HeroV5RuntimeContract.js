// ---------- W7 Hero V5 G2 Runtime Contract ----------
const HERO_V5_RUNTIME_CONTRACT = Object.freeze({
  version: 1,
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

function heroV5AzureLayersForSelection(selection = {}) {
  const azure = selection?.azure || {};
  const requested = [];
  // The underlay is a whole-body seam closer. Only use it when the three
  // body-coverage slots are present; otherwise the neutral Base must remain
  // visible in unequipped areas (for example bare Base legs without Azure boots).
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

function heroV5HairLayers(config, frameId) {
  const hairId = config?.defaultHair || "topknot";
  const hairConfig = config?.hair?.[hairId];
  if (!hairConfig || hairConfig.approval !== "approved") return [];
  const frame = hairConfig.frames?.[frameId];
  if (!frame?.hair_back || !frame?.hair_front) return [];
  return [
    heroV5FrameLayer("hair_back", frame.hair_back),
    heroV5FrameLayer("hair_front", frame.hair_front)
  ];
}

function heroV5FrameLayers(config, frameId, { includeWings = false, equipmentSelection = {} } = {}) {
  const basePath = config?.base?.frames?.[frameId];
  if (!basePath) return null;

  const wingFrame = includeWings ? config?.wingTemplate?.frames?.[frameId] : null;
  if (includeWings && (!wingFrame?.wing_far || !wingFrame?.wing_near)) return null;

  const azureLayerNames = heroV5AzureLayersForSelection(equipmentSelection);
  const azureConfig = config?.equipment?.azure;
  if (azureLayerNames.length && azureConfig?.approval !== "approved") return null;
  const azureFrame = azureLayerNames.length ? azureConfig?.frames?.[frameId] : null;
  if (azureLayerNames.some(name => !azureFrame?.[name])) return null;

  const layers = [];
  if (includeWings) layers.push(heroV5FrameLayer("wing_far", wingFrame.wing_far));
  layers.push(heroV5FrameLayer("base", basePath));
  layers.push(...heroV5HairLayers(config, frameId));
  azureLayerNames.forEach(name => {
    layers.push(heroV5FrameLayer(name, azureFrame[name]));
  });
  if (includeWings) layers.push(heroV5FrameLayer("wing_near", wingFrame.wing_near));
  return layers;
}

function resolveHeroV5BaseWingContract({ characterId = "hero001", includeWings = false, equipmentSelection = {} } = {}) {
  const config = getHeroV5RuntimeConfig(characterId);
  if (!config) return null;

  const resolved = {};
  for (const [state, frameIds] of Object.entries(HERO_V5_RUNTIME_CONTRACT.animationFrames)) {
    const frames = frameIds.map(frameId => heroV5FrameLayers(config, frameId, {
      includeWings,
      equipmentSelection
    }));
    if (frames.some(frame => !Array.isArray(frame) || !frame.length)) return null;
    resolved[state] = frames;
  }

  const hasAzureEquipment = heroV5AzureLayersForSelection(equipmentSelection).length > 0;
  return Object.freeze({
    mode: hasAzureEquipment ? "v5-g2-azure" : "v5-g2",
    canvas: {
      width: HERO_V5_RUNTIME_CONTRACT.canvas.width,
      height: HERO_V5_RUNTIME_CONTRACT.canvas.height
    },
    idle: resolved.idle,
    attack: resolved.attack,
    death: resolved.death,
    frameMs: {
      idle: 440,
      attack: 300,
      death: 360
    }
  });
}
