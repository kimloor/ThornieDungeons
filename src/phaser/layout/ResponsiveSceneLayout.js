// ---------- W6 Shared Responsive Scene Layout ----------
const RESPONSIVE_SCENE_LAYOUT_DEFAULTS = Object.freeze({
  referenceWidth: 390,
  referenceHeight: 520,
  minScale: 0.82,
  maxScale: 1.15
});

function responsiveSceneScale(width, height, options = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  const referenceWidth = Math.max(1, Number(options.referenceWidth) || RESPONSIVE_SCENE_LAYOUT_DEFAULTS.referenceWidth);
  const referenceHeight = Math.max(1, Number(options.referenceHeight) || RESPONSIVE_SCENE_LAYOUT_DEFAULTS.referenceHeight);
  const minScale = Number.isFinite(Number(options.minScale)) ? Number(options.minScale) : RESPONSIVE_SCENE_LAYOUT_DEFAULTS.minScale;
  const maxScale = Number.isFinite(Number(options.maxScale)) ? Number(options.maxScale) : RESPONSIVE_SCENE_LAYOUT_DEFAULTS.maxScale;
  const widthScale = safeWidth / referenceWidth;
  const heightScale = safeHeight / referenceHeight;
  return Math.max(minScale, Math.min(maxScale, Math.min(widthScale, heightScale)));
}

function responsiveScenePoint(anchor, width, height) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  return {
    x: Math.round(Number(anchor?.x || 0) * safeWidth),
    y: Math.round(Number(anchor?.y || 0) * safeHeight)
  };
}

function responsiveScenePixels(value, width, height) {
  if (Array.isArray(value)) return value.map(entry => responsiveScenePixels(entry, width, height));
  if (!value || typeof value !== "object") return value;
  if (Object.prototype.hasOwnProperty.call(value, "x") && Object.prototype.hasOwnProperty.call(value, "y")) {
    return responsiveScenePoint(value, width, height);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, responsiveScenePixels(entry, width, height)])
  );
}

function createResponsiveSceneLayout({ width, height, anchors = {}, scale = {} } = {}) {
  const safeWidth = Math.max(1, Number(width) || 1);
  const safeHeight = Math.max(1, Number(height) || 1);
  return {
    width: safeWidth,
    height: safeHeight,
    scale: responsiveSceneScale(safeWidth, safeHeight, scale),
    normalized: anchors,
    pixels: responsiveScenePixels(anchors, safeWidth, safeHeight)
  };
}
