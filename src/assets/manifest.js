// ---------- R2 Asset Manifest ----------
let ASSETS = {};

async function loadAssetManifest() {
  // R2 serves assets with a long max-age. A unique query plus no-store prevents
  // Safari and Cloudflare edge caches from keeping an older manifest after the
  // object is replaced under the same key.
  const manifest = await loadAssetJSON(`manifest.json?v=${Date.now()}`, { cache: "no-store" });
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

function getRaidBossSpriteConfig(defId) {
  const assetId = normalizeAssetLookupKey(defId);
  return assetId ? ASSETS?.raidBosses?.[assetId] || null : null;
}

function getRaidBossAnimationFrames(config, anim) {
  const animName = anim === "hurt" ? "hurt" : "idle";
  const frames = config?.animations?.[animName];
  if (!Array.isArray(frames) || !frames.length) return [];
  return frames.filter(Boolean).map(assetUrl);
}

function RaidBossFrameSprite({
  config,
  hurtToken = 0,
  className = "",
  alt = "Raid Boss",
  idleFrameMs = 220,
  hurtFrameMs = 110,
  onHurtComplete
}) {
  const [anim, setAnim] = React.useState("idle");
  const [frameIndex, setFrameIndex] = React.useState(0);
  const [imageFailed, setImageFailed] = React.useState(false);
  const completionRef = React.useRef(onHurtComplete);
  completionRef.current = onHurtComplete;

  const frames = getRaidBossAnimationFrames(config, anim);
  const frameKey = frames.join("|");
  const preloadSources = [
    ...getRaidBossAnimationFrames(config, "idle"),
    ...getRaidBossAnimationFrames(config, "hurt")
  ];
  const preloadKey = preloadSources.join("|");

  React.useEffect(() => {
    setImageFailed(false);
    preloadSources.forEach(src => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, [preloadKey]);

  React.useEffect(() => {
    if (hurtToken > 0) setAnim("hurt");
  }, [hurtToken]);

  React.useEffect(() => {
    setFrameIndex(0);
    if (anim === "hurt") {
      const stepTimer = frames.length > 1 ? setInterval(() => {
        setFrameIndex(i => Math.min(i + 1, frames.length - 1));
      }, hurtFrameMs) : null;
      // Keep the final hurt frame visible for one complete frame interval, then
      // return to idle. Missing hurt art follows the same short timing so the
      // parent can safely refresh without leaving its controls locked.
      const completionTimer = setTimeout(() => {
        if (stepTimer) clearInterval(stepTimer);
        setAnim("idle");
        if (completionRef.current) completionRef.current();
      }, Math.max(1, frames.length || 3) * hurtFrameMs);
      return () => {
        if (stepTimer) clearInterval(stepTimer);
        clearTimeout(completionTimer);
      };
    }

    if (frames.length <= 1) return undefined;
    const idleTimer = setInterval(() => {
      setFrameIndex(i => (i + 1) % frames.length);
    }, idleFrameMs);
    return () => clearInterval(idleTimer);
  }, [anim, frameKey, idleFrameMs, hurtFrameMs]);

  if (!frames.length || imageFailed) {
    return /*#__PURE__*/React.createElement("div", {
      className: `${className} md-raid-boss-fallback`,
      role: "img",
      "aria-label": alt
    }, "RAID");
  }

  return /*#__PURE__*/React.createElement("img", {
    className,
    src: frames[Math.min(frameIndex, frames.length - 1)],
    alt,
    draggable: false,
    onError: () => setImageFailed(true)
  });
}

function getSpriteAnimationFrames(config, requestedAnim, dead = false) {
  if (!config?.animations) return [];
  const animName = dead ? "death" : requestedAnim === "attack" ? "attack" : "idle";
  const frames = config.animations[animName];
  if (!Array.isArray(frames) || !frames.length) return [];
  return frames.filter(Boolean).map(assetUrl);
}

// Transparent sprite sheets share a canvas size, but the painted character can
// occupy a very different percentage of that canvas. Measure the union of the
// visible pixels within the current animation once, then reuse it so changing
// frames never changes scale or makes the character jump. Keeping animations
// separate also prevents a long attack pose from shrinking the idle character.
const SPRITE_OPAQUE_BOUNDS_CACHE = new Map();
function measureOpaqueFrame(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = -1;
        let maxY = -1;
        // Ignore near-invisible antialiasing/glow pixels that would otherwise
        // make the empty canvas count as part of the monster.
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            if (pixels[(y * canvas.width + x) * 4 + 3] < 16) continue;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
        if (maxX < minX || maxY < minY) return resolve(null);
        resolve({
          left: minX / canvas.width,
          top: minY / canvas.height,
          right: (maxX + 1) / canvas.width,
          bottom: (maxY + 1) / canvas.height,
          canvasAspect: canvas.width / canvas.height
        });
      } catch (error) {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
function measureSpriteOpaqueBounds(sources) {
  const key = sources.join("|");
  if (!SPRITE_OPAQUE_BOUNDS_CACHE.has(key)) {
    SPRITE_OPAQUE_BOUNDS_CACHE.set(key, Promise.all(sources.map(measureOpaqueFrame)).then(results => {
      const valid = results.filter(Boolean);
      if (!valid.length) return null;
      const left = Math.min(...valid.map(r => r.left));
      const top = Math.min(...valid.map(r => r.top));
      const right = Math.max(...valid.map(r => r.right));
      const bottom = Math.max(...valid.map(r => r.bottom));
      const canvasAspect = valid[0].canvasAspect;
      return {
        left,
        top,
        width: Math.max(0.001, right - left),
        height: Math.max(0.001, bottom - top),
        canvasAspect,
        contentAspect: canvasAspect * (right - left) / Math.max(0.001, bottom - top)
      };
    }));
  }
  return SPRITE_OPAQUE_BOUNDS_CACHE.get(key);
}

function AnimatedFrameSprite({
  config,
  anim = "",
  dead = false,
  className = "",
  alt = "",
  idleFrameMs = 220,
  attackFrameMs = 80,
  cropTransparent = false,
  visualHeight = 64,
  maxVisualWidth = 104
}) {
  const effectiveAnim = dead ? "death" : anim === "attack" ? "attack" : "idle";
  const frames = getSpriteAnimationFrames(config, effectiveAnim, dead);
  const [frameIndex, setFrameIndex] = React.useState(0);
  const frameKey = frames.join("|");
  const preloadSources = Object.values(config?.animations || {})
    .flat()
    .filter(Boolean)
    .map(assetUrl);
  const preloadKey = preloadSources.join("|");
  const [opaqueBounds, setOpaqueBounds] = React.useState(null);

  React.useEffect(() => {
    // Idle is normally the only sequence requested when the encounter mounts.
    // Warm the attack/death frames here as well so the first combat transition
    // cannot finish before its images arrive from R2.
    preloadSources.forEach(src => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
    });
  }, [preloadKey]);

  React.useEffect(() => {
    if (!cropTransparent || !frames.length) {
      setOpaqueBounds(null);
      return undefined;
    }
    let cancelled = false;
    measureSpriteOpaqueBounds(frames).then(bounds => {
      if (!cancelled) setOpaqueBounds(bounds);
    });
    return () => {
      cancelled = true;
    };
  }, [cropTransparent, frameKey]);

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

  const currentSrc = frames[Math.min(frameIndex, frames.length - 1)];
  if (cropTransparent && opaqueBounds) {
    let contentHeight = visualHeight;
    let contentWidth = contentHeight * opaqueBounds.contentAspect;
    if (contentWidth > maxVisualWidth) {
      contentHeight *= maxVisualWidth / contentWidth;
      contentWidth = maxVisualWidth;
    }
    const imageHeight = contentHeight / opaqueBounds.height;
    const imageWidth = imageHeight * opaqueBounds.canvasAspect;
    return /*#__PURE__*/React.createElement("span", {
      className: `${className} md-cropped-sprite-stage`,
      style: { width: contentWidth, height: contentHeight }
    }, /*#__PURE__*/React.createElement("img", {
      className: "md-cropped-sprite-image",
      src: currentSrc,
      alt,
      draggable: false,
      style: {
        width: imageWidth,
        height: imageHeight,
        left: -opaqueBounds.left * imageWidth,
        top: -opaqueBounds.top * imageHeight
      }
    }));
  }

  return /*#__PURE__*/React.createElement("img", {
    className,
    src: currentSrc,
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
  "weapon",
  "base",
  "hair",
  "outfit",
  "shoes",
  "arms",
  "hat"
];

function heroVisualSelectionFromEquipment(equipped = {}) {
  const isAzure = slot => {
    const item = equipped?.[slot];
    return !!item && (item.setId === "azure" || String(item.name || "").toLowerCase().includes("azure"));
  };

  return {
    hair: "topknot",
    hat: isAzure("helmet") ? "azure_helmet" : null,
    outfit: isAzure("chest") ? "azure" : null,
    arms: isAzure("gloves") ? "azure" : null,
    shoes: isAzure("boots") ? "azure" : null,
    weapon: isAzure("weapon") ? "azureSword" : null,
    wings: equipped?.wings ? "angel" : null
  };
}

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

function resolveHeroV3AnimatedLayer(def, anim = "", frameIndex = 0) {
  const idleLayer = normalizeHeroV3Layer(def);
  if (!idleLayer) return null;

  if (anim !== "attack" || !Array.isArray(def?.attack) || !def.attack.length) {
    return { ...idleLayer, fallbackPath: idleLayer.path };
  }

  const frameDef = def.attack[Math.min(frameIndex, def.attack.length - 1)];
  const attackLayer = normalizeHeroV3Layer(frameDef, idleLayer);
  return attackLayer
    ? { ...attackLayer, fallbackPath: idleLayer.path }
    : { ...idleLayer, fallbackPath: idleLayer.path };
}

function resolveHeroV3Layers(characterId = "hero001", selection = {}, anim = "", frameIndex = 0) {
  const config = getHeroV3Config(characterId);
  if (!config) return null;

  const selected = resolveHeroV3Selection(config, selection);
  const baseIdleDef = config.base?.idle || config.base;
  const baseDef = anim === "attack" && Array.isArray(config.base?.attack)
    ? resolveHeroV3AnimatedLayer({ ...baseIdleDef, attack: config.base.attack }, anim, frameIndex)
    : resolveHeroV3AnimatedLayer(baseIdleDef);

  const lookup = {
    wings: resolveHeroV3AnimatedLayer(config.wings?.[selected.wings], anim, frameIndex),
    base: baseDef,
    hair: resolveHeroV3AnimatedLayer(config.hair?.[selected.hair], anim, frameIndex),
    outfit: resolveHeroV3AnimatedLayer(config.equipment?.outfit?.[selected.outfit], anim, frameIndex),
    shoes: resolveHeroV3AnimatedLayer(config.equipment?.shoes?.[selected.shoes], anim, frameIndex),
    arms: resolveHeroV3AnimatedLayer(config.equipment?.arms?.[selected.arms], anim, frameIndex),
    hat: resolveHeroV3AnimatedLayer(config.equipment?.hat?.[selected.hat], anim, frameIndex),
    weapon: resolveHeroV3AnimatedLayer(config.weapon?.[selected.weapon], anim, frameIndex)
  };

  return HERO_V3_LAYER_ORDER
    .map(name => {
      const layer = lookup[name];
      return layer ? {
        name,
        ...layer,
        url: assetUrl(layer.path),
        fallbackUrl: assetUrl(layer.fallbackPath)
      } : null;
    })
    .filter(Boolean);
}

function HeroOverlayComposer({
  characterId = "hero001",
  selection = {},
  canvasWidth = 96,
  canvasHeight = 96,
  anim = "",
  playbackRate = 1
}) {
  const config = getHeroV3Config(characterId);
  const [attackFrameIndex, setAttackFrameIndex] = React.useState(0);
  const attackFrameCount = Array.isArray(config?.base?.attack) ? config.base.attack.length : 0;
  const selectionKey = Object.keys(selection || {})
    .sort()
    .map(key => `${key}:${selection[key] || ""}`)
    .join("|");

  React.useEffect(() => {
    if (!config || attackFrameCount < 1 || typeof Image === "undefined") return;

    const sources = new Set();
    for (let frameIndex = 0; frameIndex < attackFrameCount; frameIndex += 1) {
      const frameLayers = resolveHeroV3Layers(characterId, selection, "attack", frameIndex) || [];
      frameLayers.forEach(layer => sources.add(layer.url));
    }
    sources.forEach(src => {
      const image = new Image();
      image.src = src;
    });
  }, [characterId, selectionKey, attackFrameCount]);

  React.useEffect(() => {
    setAttackFrameIndex(0);
    if (anim !== "attack" || attackFrameCount < 2) return undefined;

    let nextFrame = 0;
    const timer = setInterval(() => {
      nextFrame += 1;
      setAttackFrameIndex(Math.min(nextFrame, attackFrameCount - 1));
      if (nextFrame >= attackFrameCount - 1) clearInterval(timer);
    }, Math.max(40, Number(config?.attackFrameMs || 105) / Math.max(1, playbackRate)));

    return () => clearInterval(timer);
  }, [anim, attackFrameCount, config?.attackFrameMs, playbackRate]);

  const layers = resolveHeroV3Layers(characterId, selection, anim, attackFrameIndex);
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
        onError: event => {
          if (layer.fallbackUrl && event.currentTarget.src !== layer.fallbackUrl) {
            event.currentTarget.src = layer.fallbackUrl;
          }
        },
        style: {
          left: layer.x,
          top: layer.y,
          transform: `scale(${layer.scale}) rotate(${layer.rotation}deg)`
        }
      }))
    )
  );
}
