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

async function loadAssetText(path) {
  const response = await fetchAsset(path);
  return response.text();
}

async function loadAssetJSON(path) {
  const response = await fetchAsset(path);
  return response.json();
}

function preloadAsset(path) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => {
      reject(new Error(`Failed to load image asset: ${path}`));
    };

    img.src = assetUrl(path);
  });
}
