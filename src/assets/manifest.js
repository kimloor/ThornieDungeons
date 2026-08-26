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

