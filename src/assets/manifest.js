// ---------- R2 Asset Manifest ----------
let ASSETS = {};

async function loadAssetManifest() {
  const manifest = await loadAssetJSON("manifest.json");

  ASSETS = manifest.assets || {};

  console.log("Asset Manifest loaded:", manifest);

  return ASSETS;
}

function asset(key) {
  const path = key
    .split(".")
    .reduce((obj, part) => obj?.[part], ASSETS);

  if (!path) {
    console.warn(`Asset not found in manifest: ${key}`);
    return "";
  }

  return assetUrl(path);
}

function listAssets(obj = ASSETS, prefix = "") {
  const result = {};

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      result[fullKey] = value;
    } else if (value && typeof value === "object") {
      Object.assign(result, listAssets(value, fullKey));
    }
  }

  return result;
}

// ---------- modular ("paperdoll") character compositor — anchor/rig based ----------
// Base layer: hero001.core.neutral (used as a graceful fallback — see useHeroRig below).
//
// The individual body-part PNGs are tightly cropped, so they can't just be stacked at
// top:0/left:0 like before (that was the earlier, wrong approach). A rig file (e.g.
// hero001_rig_v1.json) supplies, per character: a "master canvas" size the PNGs were
// authored against, a set of named "joints" (skeleton points in master-pixel coordinates),
// and per-layer entries mapping each PNG filename to a joint + a "localPivot" (the point
// *within that PNG's own pixel space* that should land exactly on the joint).
//
// Placement: prefer each layer's precomputed "offset" (its authored top-left position in
// master-pixel space); a few layers carry a small deliberate hand-tuned nudge a few px off
// from the raw joint-localPivot formula (confirmed by testing — e.g. wrist bracers, skirt
// plates), so trusting the given offset is more faithful to the actual art than recomputing it.
// joint + localPivot is kept as a fallback for any layer that doesn't specify an offset, and
// remains useful groundwork if joints ever need to move for future animation — see
// resolveLayerPlacement below.
// The whole composed stack is then uniformly scaled once (never per-layer) to fit whatever
// on-screen canvas size it's rendered at — see HeroModularComposer.

const RIG_CACHE = {}; // characterId -> rig object, or null if no usable rig was found (cached either way)

function rigPathCandidates(characterId) {
  // Confirmed: hero001_rig_v1.json sits at the asset root, alongside manifest.json and the
  // sprite/ folder (not nested under sprite/characters/...). Kept as a small ordered list
  // (rather than a single hardcoded path) so adding another character's rig later, or moving
  // this one, only means adding/reordering an entry here — nothing else needs to change.
  return [`${characterId}_rig_v1.json`, `sprite/characters/${characterId}/modular/${characterId}_rig_v1.json`, `sprite/characters/${characterId}/${characterId}_rig_v1.json`];
}

async function loadHeroRig(characterId) {
  if (RIG_CACHE[characterId] !== undefined) return RIG_CACHE[characterId];
  for (const path of rigPathCandidates(characterId)) {
    try {
      const rig = await loadAssetJSON(path);
      if (rig && rig.joints && rig.layers && rig.masterCanvas) {
        console.log(`[HeroRig] Loaded ${characterId} rig from /assets/${path}`);
        RIG_CACHE[characterId] = rig;
        return rig;
      }
    } catch (e) {
      // 404 or bad JSON — try the next candidate path.
    }
  }
  console.warn(`[HeroRig] No usable rig found for "${characterId}" (tried: ${rigPathCandidates(characterId).join(", ")}). ` + "Falling back to the flat core.neutral image — check the actual R2 path and add it to rigPathCandidates() if needed.");
  RIG_CACHE[characterId] = null;
  return null;
}

function getHeroBaseUrl(characterId = "hero001") {
  const path = `${characterId}.core.neutral`.split(".").reduce((obj, part) => obj?.[part], ASSETS);
  return path ? assetUrl(path) : "";
}

// Every manifest asset path ends in the exact same filename the rig uses as its layer key
// (e.g. manifest "sprite/characters/hero001/modular/head_back_hair.png" -> rig key
// "head_back_hair.png"), so a single filename->URL map built from the manifest works for
// body parts, equipment, weapons, and accessories alike — no separate mapping table needed.
function buildFilenameUrlMap(characterId) {
  const charAssets = ASSETS[characterId];
  if (!charAssets) return {};
  const map = {};
  Object.values(listAssets(charAssets)).forEach(path => {
    map[String(path).split("/").pop()] = assetUrl(path);
  });
  return map;
}

// Prefers the rig's own precomputed "offset" field when present (verified: for most layers
// this equals joint - localPivot exactly, but a handful — e.g. wrist bracers, skirt plates —
// carry a small deliberate hand-tuned adjustment a few px off from the raw formula, so trusting
// the authored value is more faithful to the actual art than recomputing it). Falls back to the
// joint - localPivot formula for any layer that doesn't specify an explicit offset.
function resolveLayerPlacement(rig, layerFilename) {
  const layerDef = rig.layers[layerFilename];
  if (!layerDef) return null;
  if (layerDef.offset) return {
    x: layerDef.offset.x,
    y: layerDef.offset.y
  };
  const joint = rig.joints[layerDef.joint];
  if (!joint || !layerDef.localPivot) return null;
  return {
    x: joint.x - layerDef.localPivot.x,
    y: joint.y - layerDef.localPivot.y
  };
}

// Uniform scale to fit the master canvas into an arbitrary on-screen box — same idea as CSS
// object-fit:contain, kept uniform (no stretching) per the rig's runtime.uniformScale policy.
function heroUniformScale(rig, canvasWidth, canvasHeight) {
  return Math.min(canvasWidth / rig.masterCanvas.width, canvasHeight / rig.masterCanvas.height);
}

// z-order back-to-front for the base body.
// DEBUG STEP 1: render only the two torso/body layers. All other body parts are intentionally
// disabled for this test so we can validate torso + hips placement before touching head, arms,
// legs, equipment, or weapons.
const HERO_BODY_LAYER_ORDER = ["hips.png", "torso_base.png"];

// React hook: loads (and caches) a character's rig once, exposing {ready, rig}. `ready` flips
// true once we've either found a usable rig or exhausted every candidate path — callers should
// wait for ready before deciding whether to fall back to the flat image, so the sprite doesn't
// flash the fallback for one frame before the rig finishes loading.
function useHeroRig(characterId) {
  const [state, setState] = useState(() => RIG_CACHE[characterId] !== undefined ? {
    ready: true,
    rig: RIG_CACHE[characterId]
  } : {
    ready: false,
    rig: null
  });
  useEffect(() => {
    let alive = true;
    loadHeroRig(characterId).then(rig => {
      if (alive) setState({
        ready: true,
        rig
      });
    });
    return () => {
      alive = false;
    };
  }, [characterId]);
  return state;
}

// Pure presentational compositor: given an already-loaded rig, an ordered list of layer
// filenames, and a filename->URL map, renders them anchored on the rig's master canvas and
// uniformly scaled to fit canvasWidth x canvasHeight. Equipment/weapon layers use the *exact
// same* anchor formula as body layers — weaponKey is a separate prop purely so call sites read
// clearly ("this is the equipped weapon, drawn on top"), the math underneath doesn't differ.
function HeroModularComposer({
  rig,
  layerOrder,
  filenameToUrl,
  canvasWidth,
  canvasHeight,
  weaponKey,
  equipmentKeys,
  anim = ""
}) {
  if (!rig) return null;
  const cw = canvasWidth || rig.runtime?.defaultCanvas?.width || 96;
  const ch = canvasHeight || rig.runtime?.defaultCanvas?.height || 96;
  const scale = heroUniformScale(rig, cw, ch);
  const allFilenames = [...layerOrder, ...(equipmentKeys || []), ...(weaponKey ? [weaponKey] : [])];
  const layers = allFilenames.map(filename => {
    const pos = resolveLayerPlacement(rig, filename);
    const url = filenameToUrl[filename];
    return pos && url ? {
      filename,
      url,
      pos
    } : null;
  }).filter(Boolean);
  if (!layers.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: `md-hero-rig-canvas ${anim}`,
    style: {
      width: cw,
      height: ch
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hero-rig-master",
    style: {
      width: rig.masterCanvas.width,
      height: rig.masterCanvas.height,
      transform: `scale(${scale})`
    }
  }, layers.map(l => /*#__PURE__*/React.createElement("img", {
    key: l.filename,
    className: "md-hero-rig-layer",
    src: l.url,
    alt: "",
    draggable: false,
    style: {
      left: l.pos.x,
      top: l.pos.y
    }
  }))));
}