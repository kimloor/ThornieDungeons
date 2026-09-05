// ---------- R2 Asset Manifest ----------
let ASSETS = {};

async function loadAssetManifest() {
  const manifest = await loadAssetJSON("manifest.json");
  ASSETS = manifest.assets || {};
  console.log("Asset Manifest loaded:", manifest);
  return ASSETS;
}

function asset(key) {
  const path = key.split(".").reduce((obj, part) => obj?.[part], ASSETS);
  if (!path || typeof path !== "string") {
    console.warn(`Asset not found in manifest: ${key}`);
    return "";
  }
  return assetUrl(path);
}

function listAssets(obj = ASSETS, prefix = "") {
  const result = {};
  for (const [key, value] of Object.entries(obj || {})) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[fullKey] = value;
    else if (value && typeof value === "object") Object.assign(result, listAssets(value, fullKey));
  }
  return result;
}


// ---------- Pet / Monster frame-sequence sprites ----------
// The R2 manifest is the source of truth. Pet/monster art is optional:
// entities without a matching manifest entry keep the legacy fallback renderer.
const PET_ASSET_ALIASES = {
  sprout: "sprout001",
  sprout001: "sprout001"
};

const MONSTER_ASSET_ALIASES = {
  poring: "poring001",
  poring001: "poring001",
  jelly_slime: "poring001",
  orc: "orc001",
  orc001: "orc001",
  tusky_boar: "orc001"
};

function normalizeAssetLookupKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s*\((?:elite\s+)?boss\)\s*/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getPetSpriteConfig(defId) {
  const raw = normalizeAssetLookupKey(defId);
  const assetId = PET_ASSET_ALIASES[raw] || raw;
  return ASSETS?.pets?.[assetId] || null;
}

function getMonsterSpriteConfig(enemy) {
  if (!enemy) return null;
  const idKey = normalizeAssetLookupKey(enemy.id);
  const nameKey = normalizeAssetLookupKey(enemy.name);

  const candidates = [
    MONSTER_ASSET_ALIASES[idKey],
    idKey,
    MONSTER_ASSET_ALIASES[nameKey],
    nameKey
  ].filter(Boolean);

  for (const assetId of candidates) {
    const config = ASSETS?.monsters?.[assetId];
    if (config) return config;
  }
  return null;
}

function getSpriteAnimationFrames(config, requestedAnim, dead = false) {
  if (!config?.animations) return [];
  const animName = dead ? "death" : requestedAnim === "attack" ? "attack" : "idle";
  const frames = config.animations[animName];
  if (!Array.isArray(frames) || !frames.length) return [];
  return frames.filter(Boolean).map(assetUrl);
}

function AnimatedFrameSprite({
  config,
  anim = "",
  dead = false,
  className = "",
  alt = "",
  idleFrameMs = 220,
  attackFrameMs = 80
}) {
  const effectiveAnim = dead ? "death" : anim === "attack" ? "attack" : "idle";
  const frames = getSpriteAnimationFrames(config, effectiveAnim, dead);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const frameKey = frames.join("|");

  React.useEffect(() => {
    setFrameIndex(0);
    if (frames.length <= 1) return undefined;

    const loop = effectiveAnim === "idle";
    const delay = effectiveAnim === "attack" ? attackFrameMs : idleFrameMs;
    const timer = setInterval(() => {
      setFrameIndex(i => loop ? (i + 1) % frames.length : Math.min(i + 1, frames.length - 1));
    }, delay);

    return () => clearInterval(timer);
  }, [effectiveAnim, frameKey, idleFrameMs, attackFrameMs]);

  if (!frames.length) return null;

  return /*#__PURE__*/React.createElement("img", {
    className,
    src: frames[Math.min(frameIndex, frames.length - 1)],
    alt,
    draggable: false
  });
}

// ---------- Hero V3: flat base + overlay layers ----------
// The old skeletal/rig composer was intentionally removed.
// Hero V3 uses one approved full-body base image and optional transparent overlays.
// All placement data belongs in runtime manifest.json so art can be tuned without code changes.

const HERO_V3_LAYER_ORDER = [
  "wings",
  "base",
  "hair",
  "outfit",
  "shoes",
  "arms",
  "hat",
  "weapon"
];

function getHeroV3Config(characterId = "hero001") {
  return ASSETS?.[characterId]?.v3 || null;
}

function normalizeHeroV3Layer(def, fallback = {}) {
  if (!def) return null;
  if (typeof def === "string") {
    return {
      path: def,
      x: fallback.x || 0,
      y: fallback.y || 0,
      scale: fallback.scale ?? 1,
      rotation: fallback.rotation || 0
    };
  }
  if (typeof def !== "object" || !def.path) return null;
  return {
    path: def.path,
    x: Number(def.x ?? fallback.x ?? 0),
    y: Number(def.y ?? fallback.y ?? 0),
    scale: Number(def.scale ?? fallback.scale ?? 1),
    rotation: Number(def.rotation ?? fallback.rotation ?? 0)
  };
}

function resolveHeroV3Selection(config, selection = {}) {
  return {
    ...(config?.defaults || {}),
    ...(selection || {})
  };
}

function resolveHeroV3Layers(characterId = "hero001", selection = {}) {
  const config = getHeroV3Config(characterId);
  if (!config) return null;

  const selected = resolveHeroV3Selection(config, selection);
  const baseDef = normalizeHeroV3Layer(config.base?.idle || config.base);

  const lookup = {
    wings: normalizeHeroV3Layer(config.wings?.[selected.wings]),
    base: baseDef,
    hair: normalizeHeroV3Layer(config.hair?.[selected.hair]),
    outfit: normalizeHeroV3Layer(config.equipment?.outfit?.[selected.outfit]),
    shoes: normalizeHeroV3Layer(config.equipment?.shoes?.[selected.shoes]),
    arms: normalizeHeroV3Layer(config.equipment?.arms?.[selected.arms]),
    hat: normalizeHeroV3Layer(config.equipment?.hat?.[selected.hat]),
    weapon: normalizeHeroV3Layer(config.weapon?.[selected.weapon])
  };

  return HERO_V3_LAYER_ORDER
    .map(name => {
      const layer = lookup[name];
      return layer ? { name, ...layer, url: assetUrl(layer.path) } : null;
    })
    .filter(Boolean);
}

function HeroOverlayComposer({
  characterId = "hero001",
  selection = {},
  canvasWidth = 96,
  canvasHeight = 96,
  anim = ""
}) {
  const config = getHeroV3Config(characterId);
  const layers = resolveHeroV3Layers(characterId, selection);
  if (!config || !layers?.some(layer => layer.name === "base")) return null;

  const masterWidth = Number(config.canvas?.width || 1254);
  const masterHeight = Number(config.canvas?.height || 1254);
  const scale = Math.min(canvasWidth / masterWidth, canvasHeight / masterHeight);

  return /*#__PURE__*/React.createElement(
    "div",
    {
      className: `md-hero-v3-canvas ${anim || ""}`,
      style: { width: canvasWidth, height: canvasHeight }
    },
    /*#__PURE__*/React.createElement(
      "div",
      {
        className: "md-hero-v3-master",
        style: {
          width: masterWidth,
          height: masterHeight,
          transform: `scale(${scale})`
        }
      },
      layers.map(layer => /*#__PURE__*/React.createElement("img", {
        key: layer.name,
        className: `md-hero-v3-layer layer-${layer.name}`,
        src: layer.url,
        alt: "",
        draggable: false,
        style: {
          left: layer.x,
          top: layer.y,
          transform: `scale(${layer.scale}) rotate(${layer.rotation}deg)`
        }
      }))
    )
  );
}
