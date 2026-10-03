// ---------- R2 Asset Loader ----------
const ASSET_BASE = "/assets/";

function assetUrl(path) {
  if (!path) return "";
  return ASSET_BASE + String(path).replace(/^\/+/, "");
}

async function fetchAsset(path, options = {}) {
  const response = await fetch(assetUrl(path), options);

  if (!response.ok) {
    throw new Error(
      `Asset request failed: ${response.status} ${response.statusText}: ${path}`
    );
  }

  return response;
}

async function loadAssetJSON(path, options = {}) {
  const response = await fetchAsset(path, options);
  return response.json();
}

