// ---------- R2 Asset Manifest ----------
let ASSETS = {};
async function loadAssetManifest() { const manifest = await loadAssetJSON("manifest.json"); ASSETS = manifest.assets || {}; console.log("Asset Manifest loaded:", manifest); return ASSETS; }
function asset(key) { const path = key.split(".").reduce((obj, part) => obj?.[part], ASSETS); if (!path) { console.warn(`Asset not found in manifest: ${key}`); return ""; } return assetUrl(path); }
function listAssets(obj = ASSETS, prefix = "") { const result = {}; for (const [key, value] of Object.entries(obj)) { const fullKey = prefix ? `${prefix}.${key}` : key; if (typeof value === "string") result[fullKey] = value; else if (value && typeof value === "object") Object.assign(result, listAssets(value, fullKey)); } return result; }
const RIG_CACHE = {};
function rigPathCandidates(characterId) { return [`${characterId}_rig_v1.json`, `sprite/characters/${characterId}/modular/${characterId}_rig_v1.json`, `sprite/characters/${characterId}/${characterId}_rig_v1.json`]; }
async function loadHeroRig(characterId) { if (RIG_CACHE[characterId] !== undefined) return RIG_CACHE[characterId]; for (const path of rigPathCandidates(characterId)) { try { const rig = await loadAssetJSON(path); if (rig && rig.joints && rig.layers && rig.masterCanvas) { console.log(`[HeroRig] Loaded ${characterId} rig from /assets/${path}`); RIG_CACHE[characterId] = rig; return rig; } } catch (e) {} } RIG_CACHE[characterId] = null; return null; }
function getHeroBaseUrl(characterId = "hero001") { const path = `${characterId}.core.neutral`.split(".").reduce((obj, part) => obj?.[part], ASSETS); return path ? assetUrl(path) : ""; }
function buildFilenameUrlMap(characterId) { const charAssets = ASSETS[characterId]; if (!charAssets) return {}; const map = {}; Object.values(listAssets(charAssets)).forEach(path => { map[String(path).split("/").pop()] = assetUrl(path); }); return map; }
function resolveLayerPlacement(rig, layerFilename) { const layerDef = rig.layers[layerFilename]; if (!layerDef) return null; if (layerDef.offset) return { x: layerDef.offset.x, y: layerDef.offset.y }; const joint = rig.joints[layerDef.joint]; if (!joint || !layerDef.localPivot) return null; return { x: joint.x - layerDef.localPivot.x, y: joint.y - layerDef.localPivot.y }; }
function heroUniformScale(rig, canvasWidth, canvasHeight) { return Math.min(canvasWidth / rig.masterCanvas.width, canvasHeight / rig.masterCanvas.height); }

// DEBUG STEP 3B: lock the head/hair, swap upper-arm sides per current art alignment,
// and disable lower-arm + hand layers. Hands are omitted because the current modular
// head/body assets are being validated as the minimal silhouette first.
const HERO_BODY_LAYER_ORDER = [
  "hips.png", "torso_base.png", "head_face.png",
  "head_back_hair.png", "head_front_hair.png",
  "l_arm_upper.png", "r_arm_upper.png"
];

function useHeroRig(characterId) { const [state, setState] = useState(() => RIG_CACHE[characterId] !== undefined ? { ready: true, rig: RIG_CACHE[characterId] } : { ready: false, rig: null }); useEffect(() => { let alive = true; loadHeroRig(characterId).then(rig => { if (alive) setState({ ready: true, rig }); }); return () => { alive = false; }; }, [characterId]); return state; }
function HeroModularComposer({ rig, layerOrder, filenameToUrl, canvasWidth, canvasHeight, weaponKey, equipmentKeys, anim = "" }) { if (!rig) return null; const cw = canvasWidth || rig.runtime?.defaultCanvas?.width || 96; const ch = canvasHeight || rig.runtime?.defaultCanvas?.height || 96; const scale = heroUniformScale(rig, cw, ch); const allFilenames = [...layerOrder, ...(equipmentKeys || []), ...(weaponKey ? [weaponKey] : [])]; const layers = allFilenames.map(filename => { const pos = resolveLayerPlacement(rig, filename); const url = filenameToUrl[filename]; return pos && url ? { filename, url, pos } : null; }).filter(Boolean); if (!layers.length) return null; return /*#__PURE__*/React.createElement("div", { className: `md-hero-rig-canvas ${anim}`, style: { width: cw, height: ch } }, /*#__PURE__*/React.createElement("div", { className: "md-hero-rig-master", style: { width: rig.masterCanvas.width, height: rig.masterCanvas.height, transform: `scale(${scale})` } }, layers.map(l => /*#__PURE__*/React.createElement("img", { key: l.filename, className: "md-hero-rig-layer", src: l.url, alt: "", draggable: false, style: { left: l.pos.x, top: l.pos.y } })))); }