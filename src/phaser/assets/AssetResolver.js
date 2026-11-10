// ---------- W6 Shared Phaser Asset Resolver ----------
// Presentation code resolves manifest-relative paths here so scenes/renderers never
// construct R2 URLs independently. Existing resolved URLs are preserved verbatim.
const PHASER_ASSET_ROOT = "/assets/";

function isResolvedPhaserAssetUrl(value) {
  const source = String(value || "").trim();
  return /^(?:https?:)?\/\//i.test(source)
    || /^(?:data:|blob:)/i.test(source)
    || source.startsWith("/");
}

function resolvePhaserAsset(reference) {
  const raw = reference && typeof reference === "object"
    ? (reference.url || reference.path || "")
    : reference;
  const source = String(raw || "").trim();
  if (!source) return "";
  if (isResolvedPhaserAssetUrl(source)) return source;
  if (typeof assetUrl === "function") return assetUrl(source);
  return PHASER_ASSET_ROOT + source.replace(/^\/+/, "");
}

function resolvePhaserAssets(references) {
  return [...new Set((references || []).map(resolvePhaserAsset).filter(Boolean))];
}

function resolvePhaserManifestAsset(key) {
  if (!key) return "";
  if (typeof optionalAsset === "function") return resolvePhaserAsset(optionalAsset(key));
  const root = typeof ASSETS === "object" && ASSETS ? ASSETS : {};
  const path = String(key).split(".").reduce((obj, part) => obj?.[part], root);
  return resolvePhaserAsset(path);
}

const SHARED_PHASER_ASSET_RESOLVER = Object.freeze({
  resolve: resolvePhaserAsset,
  resolveAll: resolvePhaserAssets,
  manifest: resolvePhaserManifestAsset
});
