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

// ---------- modular ("paperdoll") character compositor ----------
// Characters like hero001 are shipped as a stack of separate same-canvas-size transparent
// PNGs (body, hair, torso, arms, legs, ...) instead of one flat sprite, so they render as a
// stack of absolutely-positioned <img> layers (see .md-modular-sprite / .md-modular-layer in
// styles.js) rather than a single <img src>.
//
// HERO_LAYER_ORDER lists which manifest sub-paths make up the *base* body, back-to-front.
// There's no equip->asset mapping yet (equipped weapons/armor are procedurally-named, not
// tied to a specific PNG in the manifest), so this only composes skin+hair+torso+arms+legs —
// no weapon/armor/accessory layers are drawn on top yet. If the stacking order looks wrong
// once real art is in place, this is the only list that needs to change.
const HERO_LAYER_ORDER = [
  "core.neutral",
  "head.backHair",
  "legs.leftUpper", "legs.leftLower", "legs.leftFoot",
  "legs.rightUpper", "legs.rightLower", "legs.rightFoot",
  "arms.leftUpper", "arms.leftLower", "arms.leftHand",
  "torso.hips", "torso.base",
  "arms.rightUpper", "arms.rightLower", "arms.rightHand",
  "head.face", "head.ears", "head.frontHair"
];

// Resolves each `${characterId}.${part}` key in `layerOrder` against the manifest and returns
// the URLs that actually exist, in order. Missing individual parts are silently skipped (so a
// partially-filled character doesn't break); if NONE resolve (manifest not loaded yet, or this
// characterId isn't in it at all), returns [] so the caller can fall back to a CSS placeholder.
function composeCharacterLayers(characterId, layerOrder) {
  const urls = [];
  layerOrder.forEach(part => {
    const path = `${characterId}.${part}`.split(".").reduce((obj, k) => obj?.[k], ASSETS);
    if (path) urls.push(assetUrl(path));
  });
  return urls;
}

