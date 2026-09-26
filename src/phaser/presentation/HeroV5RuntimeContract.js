// ---------- W7 Hero V5 G2 Runtime Contract ----------
const HERO_V5_RUNTIME_CONTRACT = Object.freeze({
  version: 1,
  characterId: "hero001",
  variant: "g2",
  canvas: Object.freeze({ width: 768, height: 768 }),
  animationFrames: Object.freeze({
    idle: Object.freeze(["idle_01", "idle_02", "idle_03"]),
    attack: Object.freeze(["attack_01", "attack_02", "attack_03"]),
    death: Object.freeze(["death_01", "death_02"])
  }),
  layerOrder: Object.freeze(["wing_far", "base", "wing_near"])
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

function heroV5FrameLayers(config, frameId, includeWings) {
  const basePath = config?.base?.frames?.[frameId];
  if (!basePath) return null;

  const wingFrame = includeWings ? config?.wingTemplate?.frames?.[frameId] : null;
  if (includeWings && (!wingFrame?.wing_far || !wingFrame?.wing_near)) return null;

  const layers = [];
  if (includeWings) layers.push({
    name: "wing_far", path: wingFrame.wing_far, x: 0, y: 0, scale: 1, rotation: 0
  });
  layers.push({
    name: "base", path: basePath, x: 0, y: 0, scale: 1, rotation: 0
  });
  if (includeWings) layers.push({
    name: "wing_near", path: wingFrame.wing_near, x: 0, y: 0, scale: 1, rotation: 0
  });
  return layers;
}

function resolveHeroV5BaseWingContract({ characterId = "hero001", includeWings = false } = {}) {
  const config = getHeroV5RuntimeConfig(characterId);
  if (!config) return null;

  const resolved = {};
  for (const [state, frameIds] of Object.entries(HERO_V5_RUNTIME_CONTRACT.animationFrames)) {
    const frames = frameIds.map(frameId => heroV5FrameLayers(config, frameId, includeWings));
    if (frames.some(frame => !Array.isArray(frame) || !frame.length)) return null;
    resolved[state] = frames;
  }

  return Object.freeze({
    mode: "v5-g2",
    canvas: {
      width: HERO_V5_RUNTIME_CONTRACT.canvas.width,
      height: HERO_V5_RUNTIME_CONTRACT.canvas.height
    },
    idle: resolved.idle,
    attack: resolved.attack,
    death: resolved.death,
    frameMs: {
      idle: 220,
      attack: 150,
      death: 180
    }
  });
}
