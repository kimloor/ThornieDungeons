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
// IMPORTANT:
// The modular PNGs in R2 are tightly cropped individual parts. They do NOT retain the
// original 96x96 canvas coordinates, so blindly stacking every PNG at top:0/left:0 causes
// visible overlap/misalignment. The runtime therefore uses the complete core.neutral image
// as the stable base character. Equipment/accessory layers are opt-in and can later receive
// explicit anchor metadata without changing the core character.
//
// Base layer: hero001.core.neutral
// Modular body pieces remain available through asset()/listAssets() for future rigging.
// Do not auto-stack head/arms/legs/body crops until their anchor metadata exists.

const HERO_BASE_ASSET = "hero001.core.neutral";

function getHeroBaseUrl(characterId = "hero001") {
  const path = `${characterId}.core.neutral`
    .split(".")
    .reduce((obj, part) => obj?.[part], ASSETS);
  return path ? assetUrl(path) : "";
}

// Equipment compositor hook. When manifest metadata later contains explicit anchors,
// this can return positioned layers without changing HeroSprite's public API.
function composeEquipmentLayers(characterId, equipmentKeys = []) {
  const result = [];
  for (const key of equipmentKeys) {
    const path = `${characterId}.${key}`
      .split(".")
      .reduce((obj, part) => obj?.[part], ASSETS);
    if (path) result.push({ key, url: assetUrl(path), x: 0, y: 0, scale: 1 });
  }
  return result;
}
