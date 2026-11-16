// ---------- Enhancement Aura: presentation-only calculation and persistent renderer ----------
const ENHANCEMENT_AURA_THRESHOLDS = Object.freeze([
  Object.freeze({ min: 4, stage: 1 }),
  Object.freeze({ min: 6, stage: 2 }),
  Object.freeze({ min: 8, stage: 3 }),
  Object.freeze({ min: 10, stage: 4 })
]);
// Replaceable appearance profiles; enhancement stage selects colour only.
const ENHANCEMENT_AURA_STYLES = Object.freeze({
  powerFlame: Object.freeze({
    id: "powerFlame",
    name: "Power Flame",
    // Stage 1 green, 2 purple, 3 pink, 4 gold; one palette shared by Character and Weapon Aura.
    palette: Object.freeze({ 1: 0x3dff7a, 2: 0xb15cff, 3: 0xff4fd8, 4: 0xffd23a }),
    // Identical for every stage: only the palette colour changes with enhancement level.
    intensity: Object.freeze({
      // Character Aura = a ring of flames OUTSIDE a clear ellipse that is left empty for the Hero.
      // All values are fractions of displaySize measured from the Hero root (feet baseline), taken from
      // the Owner's sketch: clear ellipse centre/radii, outer limit of the flames, and a ground line
      // below which no Aura is drawn. Wings/sword sit left of the body, hence the negative centre X.
      characterFlameCount: 24, characterCenterX: -0.055, characterCenterY: -0.425,
      characterRadiusX: 0.27, characterRadiusY: 0.365, characterOuterRadiusX: 0.405, characterOuterRadiusY: 0.445,
      characterGroundY: -0.058, characterTopLimit: -0.86, characterFlameWidth: 0.125,
      characterFlameReach: 1.2, characterUpBias: 0.3, characterLowerUpBias: 0.3, characterFlameAlpha: 0.68,
      coreWidthRatio: 0.42, coreHeightRatio: 0.58, coreAlpha: 0.7, coreLighten: 0.55,
      flickerPeriod: 1600, flickerScale: 0.16, flickerAlpha: 0.25, swayDegrees: 5,
      weaponFlameCount: 9, weaponFlameWidth: 0.18, weaponFlameMinLength: 0.27, weaponFlameMaxLength: 0.47,
      weaponFlameOffset: 0.03, weaponTipWidth: 0.27, weaponTipLength: 0.59, weaponFlameAlpha: 0.7,
      weaponHaloCount: 2, weaponHaloAlpha: 0.35, weaponHaloGrowth: 0.015, weaponGlowStrength: 3
    })
  })
});
const DEFAULT_ENHANCEMENT_AURA_STYLE = "powerFlame";
function resolveEnhancementAuraStyle(styleId = DEFAULT_ENHANCEMENT_AURA_STYLE) {
  return ENHANCEMENT_AURA_STYLES[String(styleId)] || ENHANCEMENT_AURA_STYLES[DEFAULT_ENHANCEMENT_AURA_STYLE];
}

// Additive blending makes the cosmetic glow readable on any background.
function enhancementAuraBlendAdd() {
  return typeof Phaser !== "undefined" && Phaser.BlendModes ? Phaser.BlendModes.ADD : 1;
}

// Weapon Aura on-screen label + console record. Verified in production (Ver 1.1.56) and
// switched OFF by default; the code is kept intact for future debugging.
// Re-enable without a rebuild: set globalThis.THORNIE_AURA_DIAGNOSTIC = true before the
// Hero scene is created, or flip this constant to true.
const ENHANCEMENT_AURA_DIAGNOSTIC_DEFAULT = false;
function enhancementAuraDiagnosticEnabled() {
  return ENHANCEMENT_AURA_DIAGNOSTIC_DEFAULT === true || globalThis.THORNIE_AURA_DIAGNOSTIC === true;
}

function enhancementAuraItemLevel(item) {
  if (!item || typeof item !== "object") return 0;
  const level = Number(item.enhanceLevel);
  return Number.isFinite(level) ? Math.max(0, Math.min(10, Math.floor(level))) : 0;
}

function enhancementAuraStage(level) {
  const value = Number.isFinite(Number(level))
    ? Math.max(0, Math.min(10, Math.floor(Number(level))))
    : 0;
  let stage = 0;
  ENHANCEMENT_AURA_THRESHOLDS.forEach(threshold => {
    if (value >= threshold.min) stage = threshold.stage;
  });
  return stage;
}

function resolveEnhancementAura(equipped = {}) {
  const loadout = equipped && typeof equipped === "object" ? equipped : {};
  const weaponEquipped = !!(loadout.weapon && typeof loadout.weapon === "object");
  const weaponLevel = weaponEquipped ? enhancementAuraItemLevel(loadout.weapon) : 0;
  const defensiveSlots = ["helmet", "chest", "gloves", "boots"];
  const completeDefense = defensiveSlots.every(slot => !!(loadout[slot] && typeof loadout[slot] === "object"));
  const defensiveLevels = completeDefense ? defensiveSlots.map(slot => enhancementAuraItemLevel(loadout[slot])) : [];
  const characterLevel = completeDefense ? Math.min(...defensiveLevels) : 0;
  return Object.freeze({
    weaponLevel,
    weaponStage: weaponEquipped ? enhancementAuraStage(weaponLevel) : 0,
    characterLevel,
    characterStage: completeDefense ? enhancementAuraStage(characterLevel) : 0
  });
}

// Deterministic 0..1 values so every Hero gets the same flame silhouette (stable, testable).
function enhancementAuraHash(index, seed = 0) {
  const value = Math.sin((index + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function enhancementAuraLighten(color, amount) {
  const mix = channel => Math.round(channel + (255 - channel) * amount);
  return (mix((color >> 16) & 255) << 16) | (mix((color >> 8) & 255) << 8) | mix(color & 255);
}

// Flame colours are baked into small canvas textures instead of using setTint(), because the
// Phaser Canvas renderer ignores tint. This keeps the stage colours correct on both renderers.
function enhancementAuraFlameTextureKey(scene, color, kind, lighten = 0.6) {
  const shown = kind === "core" ? enhancementAuraLighten(color, lighten) : color;
  const key = `enhancement-aura-flame-${kind}-${shown.toString(16).padStart(6, "0")}`;
  try {
    if (scene.textures.exists(key)) return key;
    const canvasTexture = scene.textures.createCanvas(key, 64, 256);
    const ctx = canvasTexture?.context;
    if (!ctx) return null;
    const rgb = `${(shown >> 16) & 255},${(shown >> 8) & 255},${shown & 255}`;
    const gradient = ctx.createLinearGradient(0, 252, 0, 4);
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(0.55, `rgba(${rgb},0.7)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(8, 252);
    ctx.quadraticCurveTo(16, 120, 34, 4);
    ctx.quadraticCurveTo(52, 120, 60, 252);
    ctx.closePath();
    ctx.fill();
    canvasTexture.refresh();
    return key;
  } catch (_) {
    return null;
  }
}

// Blade axis from the weapon sprite's own opaque pixels (principal axis), so the flames follow
// the real silhouette rather than a bounding box. Pure function: easy to test without a browser.
function enhancementAuraBladeGeometry(rgba, width, height, threshold = 40) {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > threshold) { count += 1; sumX += x; sumY += y; }
    }
  }
  if (count < 12) return null;
  const mx = sumX / count;
  const my = sumY / count;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > threshold) {
        sxx += (x - mx) ** 2; sxy += (x - mx) * (y - my); syy += (y - my) ** 2;
      }
    }
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ux = Math.cos(angle);
  let uy = Math.sin(angle);
  // Tip points up when the blade is steep; forward (the Hero faces right) when near-horizontal.
  const steep = Math.abs(uy) > 0.3;
  if (steep ? uy > 0 : ux < 0) { ux = -ux; uy = -uy; }
  let tmin = Infinity;
  let tmax = -Infinity;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > threshold) {
        const t = (x - mx) * ux + (y - my) * uy;
        if (t < tmin) tmin = t;
        if (t > tmax) tmax = t;
      }
    }
  }
  return { mx, my, ux, uy, tmin, tmax, count };
}

// Reads a downscaled copy of the weapon frame once per texture; returns null when pixels cannot
// be read (no DOM, tainted image). Callers then simply skip the blade flames.
function enhancementAuraSampleBlade(weaponImage) {
  try {
    if (typeof document === "undefined") return null;
    const frame = weaponImage?.frame;
    const source = frame?.source?.image || weaponImage?.texture?.getSourceImage?.();
    const cutW = Number(frame?.cutWidth) || Number(weaponImage?.width) || Number(source?.width);
    const cutH = Number(frame?.cutHeight) || Number(weaponImage?.height) || Number(source?.height);
    if (!source || !(cutW > 0 && cutH > 0)) return null;
    const scale = Math.min(1, 160 / Math.max(cutW, cutH));
    const w = Math.max(1, Math.round(cutW * scale));
    const h = Math.max(1, Math.round(cutH * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(source, Number(frame?.cutX) || 0, Number(frame?.cutY) || 0, cutW, cutH, 0, 0, w, h);
    const geometry = enhancementAuraBladeGeometry(ctx.getImageData(0, 0, w, h).data, w, h);
    if (!geometry) return null;
    const back = 1 / scale;
    return {
      mx: geometry.mx * back, my: geometry.my * back, ux: geometry.ux, uy: geometry.uy,
      tmin: geometry.tmin * back, tmax: geometry.tmax * back, frameW: cutW, frameH: cutH
    };
  } catch (_) {
    return null;
  }
}

class EnhancementAuraRenderer {
  constructor(scene, root, displaySize = () => 150, styleId = DEFAULT_ENHANCEMENT_AURA_STYLE) {
    this.scene = scene;
    this.root = root;
    this.displaySizeSource = displaySize;
    this.style = resolveEnhancementAuraStyle(styleId);
    this.characterStage = -1;
    this.weaponStage = -1;
    this.characterRoot = scene.add.container(0, 0).setVisible(false);
    this.characterFlames = [];
    this.characterSize = 0;
    this.weaponFlameRoot = scene.add.container(0, 0).setVisible(false);
    this.weaponFlames = [];
    this.weaponFlameParts = [];
    this.weaponFlameStage = -1;
    this.weaponLayoutKey = "";
    this.bladeCache = new Map();
    this.flickerState = { t: 0 };
    this.flickerDriver = null;
    this.weaponHalos = [];
    this.weaponDiagnosticSignature = "";
    this.diagnosticEnabled = enhancementAuraDiagnosticEnabled();
    this.weaponDiagnosticText = this.diagnosticEnabled && typeof scene.add.text === "function"
      ? scene.add.text(0, 0, "", { fontFamily: "Arial, sans-serif", fontSize: "10px", color: "#ffffff", backgroundColor: "#21152f", padding: { x: 5, y: 3 }, align: "center" }).setOrigin(0.5, 0).setVisible(false)
      : null;
    if (this.weaponDiagnosticText) root?.add(this.weaponDiagnosticText);
    this.destroyed = false;
    root?.add(this.weaponFlameRoot);
    root?.add(this.characterRoot);
  }

  displaySize() {
    return Math.max(1, Number(this.displaySizeSource?.()) || 150);
  }

  // The Canvas renderer ignores tint, so tint-based silhouette halos are WebGL-only.
  supportsTint() {
    const type = this.scene?.sys?.game?.renderer?.type;
    return !(typeof Phaser !== "undefined" && type === Phaser.CANVAS);
  }

  ensureFlickerDriver() {
    if (this.flickerDriver || !this.scene?.tweens?.add) return;
    this.flickerDriver = this.scene.tweens.add({
      targets: this.flickerState,
      t: Math.PI * 2,
      duration: this.style.intensity.flickerPeriod,
      repeat: -1,
      onUpdate: () => this.animateFlames()
    });
  }

  // One shared clock drives every flame: scale, alpha and sway are pure functions of the phase,
  // so there is no per-flame tween to clean up and the loop is seamless.
  animateFlames() {
    if (this.destroyed) return;
    const t = this.flickerState.t;
    const intensity = this.style.intensity;
    const apply = flame => {
      if (!flame?.obj) return;
      const wave = Math.sin(t * flame.speed + flame.phase);
      const glow = 0.5 + 0.5 * Math.cos(t * flame.speed + flame.phase * 1.7);
      const strength = flame.flicker ?? 1;
      flame.obj.setScale(flame.sx, flame.sy * (1 + intensity.flickerScale * strength * wave));
      flame.obj.setAlpha(flame.alpha * (1 - intensity.flickerAlpha * strength * glow));
      if (flame.sway) flame.obj.setAngle(flame.rot + flame.sway * Math.sin(t * flame.speed + flame.phase * 0.6));
    };
    this.characterFlames.forEach(apply);
    this.weaponFlames.forEach(apply);
  }

  // Creates one flame (soft outer tongue + paler, shorter core) and registers it for animation.
  createFlame(container, keys, seed, sway) {
    const phase = enhancementAuraHash(seed, 11) * Math.PI * 2;
    const speed = 1 + Math.floor(enhancementAuraHash(seed, 12) * 3);
    const make = (key, alpha) => {
      const obj = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
      obj.setBlendMode?.(enhancementAuraBlendAdd());
      container.add(obj);
      return { obj, sx: 1, sy: 1, rot: 0, alpha, phase, speed, sway, flicker: 1 };
    };
    return { seed, outer: make(keys.outer, 0), core: make(keys.core, 0) };
  }

  placeFlame(flame, { x, y, width, height, rotation, alpha }) {
    const intensity = this.style.intensity;
    const set = (part, w, h, a) => {
      part.sx = w / 64;
      part.sy = h / 256;
      part.rot = rotation;
      part.alpha = a;
      part.obj.setPosition(x, y).setAngle(rotation);
    };
    set(flame.outer, width, height, alpha);
    set(flame.core, width * intensity.coreWidthRatio, height * intensity.coreHeightRatio, intensity.coreAlpha);
  }

  flameKeys(color) {
    const outer = enhancementAuraFlameTextureKey(this.scene, color, "outer");
    const core = enhancementAuraFlameTextureKey(this.scene, color, "core", this.style.intensity.coreLighten);
    return outer && core ? { outer, core } : null;
  }

  clearCharacterFlames() {
    this.characterFlames = [];
    this.characterRoot?.removeAll?.(true);
  }

  updateCharacter(stage) {
    const size = this.displaySize();
    if (stage === this.characterStage && Math.abs(size - this.characterSize) < 1) return;
    this.characterStage = stage;
    this.characterSize = size;
    this.clearCharacterFlames();
    if (stage <= 0) {
      this.characterRoot.setVisible(false);
      return;
    }

    const color = this.style.palette[stage];
    const intensity = this.style.intensity;
    const keys = this.flameKeys(color);
    if (!keys) {
      this.characterRoot.setVisible(false);
      return;
    }
    const centerX = size * intensity.characterCenterX;
    const centerY = size * intensity.characterCenterY;
    const radiusX = size * intensity.characterRadiusX;
    const radiusY = size * intensity.characterRadiusY;
    const ground = size * intensity.characterGroundY;
    const topLimit = size * intensity.characterTopLimit;
    const count = intensity.characterFlameCount;
    for (let index = 0; index < count; index += 1) {
      const theta = ((index + 0.5) / count) * Math.PI * 2; // 0 = top of the Hero, clockwise
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      const baseX = centerX + sin * radiusX;
      const baseY = centerY - cos * radiusY;
      // Nothing is drawn below the ground line, and the empty ellipse stays empty.
      if (baseY > ground - size * 0.012) continue;
      // Outward ellipse normal, tilted upward (stronger in the lower half) so the flames lick upward.
      const norm = Math.hypot(sin / radiusX, cos / radiusY) || 1;
      let dx = sin / radiusX / norm;
      let dy = -cos / radiusY / norm - (cos < 0 ? intensity.characterLowerUpBias : intensity.characterUpBias);
      if (cos < 0) dy = Math.min(dy, -0.1);
      const dirLength = Math.hypot(dx, dy) || 1;
      dx /= dirLength;
      dy /= dirLength;
      // Length = distance from the clear ellipse to the outer limit in this direction.
      const thickness = Math.hypot((intensity.characterOuterRadiusX - intensity.characterRadiusX) * sin, (intensity.characterOuterRadiusY - intensity.characterRadiusY) * cos) * size;
      let height = thickness * intensity.characterFlameReach * (0.85 + 0.3 * enhancementAuraHash(index, 1));
      if (dy < 0) height = Math.min(height, (baseY - topLimit) / -dy);
      if (dy > 0) height = Math.min(height, (ground - baseY) / dy);
      // Keep the tip inside the outer limit (a little slack for the flicker).
      const outerX = size * intensity.characterOuterRadiusX * 1.04;
      const outerY = size * intensity.characterOuterRadiusY * 1.04;
      for (let step = 0; step < 8; step += 1) {
        const tipX = baseX + dx * height - centerX;
        const tipY = baseY + dy * height - centerY;
        if ((tipX / outerX) ** 2 + (tipY / outerY) ** 2 <= 1) break;
        height *= 0.9;
      }
      if (!(height > size * 0.02)) continue;
      const flame = this.createFlame(this.characterRoot, keys, index, intensity.swayDegrees);
      this.placeFlame(flame, {
        x: baseX,
        y: baseY,
        width: size * intensity.characterFlameWidth * (0.9 + 0.2 * enhancementAuraHash(index, 2)),
        height,
        rotation: Math.atan2(dx, -dy) * 180 / Math.PI,
        alpha: intensity.characterFlameAlpha
      });
      this.characterFlames.push(flame.outer, flame.core);
    }
    this.characterRoot.setVisible(true).setAlpha(1);
    this.ensureFlickerDriver();
    this.animateFlames();
  }

  ensureWeaponHalos(textureKey) {
    const created = [];
    if (!textureKey) return created;
    while (this.weaponHalos.length < this.style.intensity.weaponHaloCount) {
      const halo = this.scene.add.image(0, 0, textureKey);
      halo.setOrigin(0.5, 1).setVisible(false);
      halo.setBlendMode?.(enhancementAuraBlendAdd());
      this.root.add(halo);
      this.weaponHalos.push(halo);
      created.push(halo);
    }
    return created;
  }

  // WebGL-only soft outline; Canvas renderers simply skip the silhouette halos.
  applyWeaponGlow(halo, color, strength) {
    try {
      const fx = halo?.postFX;
      if (!fx || typeof fx.addGlow !== "function") return;
      fx.clear?.();
      fx.addGlow(color, strength, 0, false, 0.1, 12);
    } catch (_) { /* optional glow must never break the Aura */ }
  }

  diagnosticPosition() {
    // Pin the label near the top edge of the visible stage, not below the feet
    // where the Hero preview canvas clips it.
    const size = this.displaySize();
    let y = -size * 0.92;
    try {
      const matrix = this.root?.getWorldTransformMatrix?.();
      const scaleY = Math.abs(Number(matrix?.scaleY)) || 1;
      const worldY = Number(matrix?.ty);
      if (Number.isFinite(worldY)) y = (4 - worldY) / scaleY;
    } catch (_) { /* fall back to the size-based position */ }
    return { x: 0, y };
  }

  clearWeaponFlames() {
    this.weaponFlames = [];
    this.weaponFlameParts = [];
    this.weaponFlameStage = -1;
    this.weaponLayoutKey = "";
    this.weaponFlameRoot?.removeAll?.(true);
    this.weaponFlameRoot?.setVisible?.(false);
  }

  buildWeaponFlames(stage) {
    this.clearWeaponFlames();
    const keys = this.flameKeys(this.style.palette[stage]);
    this.weaponFlameStage = stage;
    if (!keys) return;
    const count = this.style.intensity.weaponFlameCount;
    for (let index = 0; index <= count; index += 1) {
      const flame = this.createFlame(this.weaponFlameRoot, keys, 100 + index, 0);
      flame.tip = index === count;
      flame.index = index;
      this.weaponFlames.push(flame.outer, flame.core);
      this.weaponFlameParts.push(flame);
    }
  }

  // Flames sit along the blade axis in the weapon texture's own pixel space; the container then
  // follows the weapon image (position, angle, scale), so they track every animation frame.
  layoutWeaponFlames(geometry, weaponImage) {
    const intensity = this.style.intensity;
    const length = geometry.tmax - geometry.tmin;
    if (!(length > 4)) return false;
    const originX = Number.isFinite(Number(weaponImage.originX)) ? Number(weaponImage.originX) : 0.5;
    const originY = Number.isFinite(Number(weaponImage.originY)) ? Number(weaponImage.originY) : 1;
    const ox = -originX * geometry.frameW;
    const oy = -originY * geometry.frameH;
    const count = intensity.weaponFlameCount;
    (this.weaponFlameParts || []).forEach(flame => {
      if (flame.tip) {
        this.placeFlame(flame, {
          x: geometry.mx + geometry.ux * geometry.tmax + ox,
          y: geometry.my + geometry.uy * geometry.tmax + oy,
          width: length * intensity.weaponTipWidth,
          height: length * intensity.weaponTipLength,
          rotation: Math.atan2(geometry.ux, -geometry.uy) * 180 / Math.PI,
          alpha: intensity.weaponFlameAlpha
        });
        return;
      }
      const t = geometry.tmin + length * (0.1 + 0.85 * (flame.index / Math.max(1, count - 1)));
      const side = flame.index % 2 ? 1 : -1;
      const px = -geometry.uy * side;
      const py = geometry.ux * side;
      const dx = px * 0.55 + geometry.ux * 0.85;
      const dy = py * 0.55 + geometry.uy * 0.85;
      this.placeFlame(flame, {
        x: geometry.mx + geometry.ux * t + px * intensity.weaponFlameOffset * length + ox,
        y: geometry.my + geometry.uy * t + py * intensity.weaponFlameOffset * length + oy,
        width: length * intensity.weaponFlameWidth,
        height: length * (intensity.weaponFlameMinLength + (intensity.weaponFlameMaxLength - intensity.weaponFlameMinLength) * enhancementAuraHash(flame.index, 5)),
        rotation: Math.atan2(dx, -dy) * 180 / Math.PI,
        alpha: intensity.weaponFlameAlpha
      });
    });
    return true;
  }

  updateWeaponFlames(stage, weaponImage) {
    if (this.weaponFlameStage !== stage) {
      this.buildWeaponFlames(stage);
    }
    if (!this.weaponFlameParts?.length) return;
    const frameKey = `${weaponImage.texture?.key}:${weaponImage.frame?.name ?? ""}`;
    if (!this.bladeCache.has(frameKey)) {
      if (this.bladeCache.size > 64) this.bladeCache.clear();
      this.bladeCache.set(frameKey, enhancementAuraSampleBlade(weaponImage));
    }
    const geometry = this.bladeCache.get(frameKey);
    if (!geometry) {
      this.weaponFlameRoot.setVisible(false);
      return;
    }
    if (this.weaponLayoutKey !== frameKey) {
      if (!this.layoutWeaponFlames(geometry, weaponImage)) {
        this.weaponFlameRoot.setVisible(false);
        return;
      }
      this.weaponLayoutKey = frameKey;
      this.animateFlames();
    }
    this.weaponFlameRoot
      .setPosition(weaponImage.x, weaponImage.y)
      .setAngle(weaponImage.angle || 0)
      .setScale(
        Math.max(0.001, weaponImage.displayWidth / geometry.frameW),
        Math.max(0.001, weaponImage.displayHeight / geometry.frameH)
      )
      .setVisible(true);
    this.ensureFlickerDriver();
  }

  updateWeapon(stage, heroRenderer, characterStage = 0) {
    const layerName = String(heroRenderer?.data?.visualMode || "").startsWith("v5-g2") ? "sword" : "weapon";
    const entry = heroRenderer?.layerImages?.find(item => item.name === layerName);
    const weaponImage = entry?.image;
    const currentLayer = (heroRenderer?.currentLayers || []).find(layer => layer.name === layerName);
    const layerNames = (heroRenderer?.currentLayers || []).map(layer => String(layer?.name || "")).filter(Boolean);
    const reason = stage <= 0 ? "stage_disabled" : !currentLayer ? "weapon_layer_missing" : !weaponImage ? "weapon_image_missing" : !weaponImage.visible ? "weapon_image_hidden" : !weaponImage.texture?.key ? "weapon_texture_missing" : "weapon_layer_ready";
    const usable = reason === "weapon_layer_ready";
    if (this.diagnosticEnabled) {
    const diagnostic = { event: "weapon_aura_diagnostic", reason, weaponStage: stage, characterStage, visualMode: String(heroRenderer?.data?.visualMode || "unknown").slice(0, 40), expectedLayer: layerName, availableLayers: layerNames.slice(0, 24), textureKey: String(weaponImage?.texture?.key || "").slice(0, 160), visible: !!weaponImage?.visible, x: Number.isFinite(Number(weaponImage?.x)) ? Number(weaponImage.x) : null, y: Number.isFinite(Number(weaponImage?.y)) ? Number(weaponImage.y) : null, displayWidth: Number.isFinite(Number(weaponImage?.displayWidth)) ? Number(weaponImage.displayWidth) : null, displayHeight: Number.isFinite(Number(weaponImage?.displayHeight)) ? Number(weaponImage.displayHeight) : null, originX: Number.isFinite(Number(weaponImage?.originX)) ? Number(weaponImage.originX) : null, originY: Number.isFinite(Number(weaponImage?.originY)) ? Number(weaponImage.originY) : null, angle: Number.isFinite(Number(weaponImage?.angle)) ? Number(weaponImage.angle) : null, crop: Array.isArray(currentLayer?.crop) ? currentLayer.crop.slice(0, 4) : null };
    const signature = JSON.stringify(diagnostic);
    if (signature !== this.weaponDiagnosticSignature) {
      this.weaponDiagnosticSignature = signature;
      const layerSummary = layerNames.slice(0, 5).join(",") || "none";
      this.weaponDiagnosticText?.setText?.(`Weapon Aura: ${reason}\nW${stage} C${characterStage} ${layerName} / ${layerSummary}`);
      this.weaponDiagnosticText?.setVisible?.(true);
      try { globalThis.console?.info?.("[weapon-aura-diagnostic]", JSON.stringify(diagnostic)); } catch (_) {}
    }
    const labelPosition = this.diagnosticPosition();
    this.weaponDiagnosticText?.setPosition?.(labelPosition.x, labelPosition.y);
    }
    if (stage !== this.weaponStage) {
      this.weaponStage = stage;
      if (stage <= 0) {
        this.clearWeaponFlames();
        this.weaponHalos.forEach(halo => halo.setVisible(false));
      }
    }
    if (!usable) {
      this.weaponHalos.forEach(halo => halo.setVisible(false));
      this.weaponFlameRoot?.setVisible?.(false);
      return;
    }

    this.updateWeaponFlames(stage, weaponImage);

    // Optional WebGL silhouette glow around the real blade (skipped on Canvas, which cannot tint).
    if (!this.supportsTint()) return;
    const key = weaponImage.texture.key;
    const created = this.ensureWeaponHalos(key);
    const color = this.style.palette[stage];
    const intensity = this.style.intensity;
    const count = intensity.weaponHaloCount;
    this.weaponHalos.forEach((halo, index) => {
      if (index >= count) {
        halo.setVisible(false);
        return;
      }
      if (halo.texture?.key !== key) halo.setTexture(key);
      halo
        .setTint(color)
        .setAlpha(intensity.weaponHaloAlpha - index * 0.1)
        .setOrigin(weaponImage.originX, weaponImage.originY)
        .setPosition(weaponImage.x, weaponImage.y)
        .setAngle(weaponImage.angle || 0)
        .setDisplaySize(
          Math.max(1, weaponImage.displayWidth) * (1 + index * intensity.weaponHaloGrowth),
          Math.max(1, weaponImage.displayHeight) * (1 + index * intensity.weaponHaloGrowth)
        );
      if (index === 0 && (created.includes(halo) || halo.__auraGlowColor !== color)) {
        this.applyWeaponGlow(halo, color, intensity.weaponGlowStrength);
        halo.__auraGlowColor = color;
      }
      if (Array.isArray(currentLayer.crop) && currentLayer.crop.length === 4) halo.setCrop(...currentLayer.crop);
      else halo.setCrop();
      halo.setVisible(true);
    });
  }

  reorder(heroRenderer) {
    const root = this.root;
    if (!root?.list || typeof root.moveTo !== "function") return;
    // Aura is intentionally the outermost presentation layer: raise it above every Hero
    // equipment/body layer after each frame is applied (Character Aura on the very top).
    this.weaponHalos.filter(halo => halo.visible && root.list.includes(halo)).forEach(halo => {
      root.moveTo(halo, root.list.length - 1);
    });
    if (root.list.includes(this.weaponFlameRoot)) root.moveTo(this.weaponFlameRoot, root.list.length - 1);
    if (root.list.includes(this.characterRoot)) root.moveTo(this.characterRoot, root.list.length - 1);
    if (this.weaponDiagnosticText && root.list.includes(this.weaponDiagnosticText)) root.moveTo(this.weaponDiagnosticText, root.list.length - 1);
  }

  update(aura, heroRenderer) {
    if (this.destroyed) return;
    // Equipped enhancement stage selects palette only; style intensity stays constant.
    const characterStage = Math.max(0, Math.min(4, Math.floor(Number(aura?.characterStage) || 0)));
    const weaponStage = Math.max(0, Math.min(4, Math.floor(Number(aura?.weaponStage) || 0)));
    this.updateCharacter(characterStage);
    this.updateWeapon(weaponStage, heroRenderer, characterStage);
    this.reorder(heroRenderer);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.flickerDriver?.stop?.();
    this.flickerDriver = null;
    if (this.root?.remove) {
      this.root.remove(this.characterRoot, false);
      this.root.remove(this.weaponFlameRoot, false);
    }
    this.characterRoot?.destroy?.(true);
    this.weaponFlameRoot?.destroy?.(true);
    this.weaponHalos.forEach(halo => {
      if (this.root?.remove) this.root.remove(halo, false);
      halo?.destroy?.();
    });
    this.characterFlames = [];
    this.weaponFlames = [];
    this.weaponFlameParts = [];
    this.weaponHalos = [];
    this.bladeCache.clear();
    this.weaponDiagnosticText?.destroy?.();
    this.weaponDiagnosticText = null;
    this.weaponDiagnosticSignature = "";
    this.characterRoot = null;
    this.weaponFlameRoot = null;
    this.root = null;
    this.scene = null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ENHANCEMENT_AURA_THRESHOLDS,
    ENHANCEMENT_AURA_STYLES,
    DEFAULT_ENHANCEMENT_AURA_STYLE,
    resolveEnhancementAuraStyle,
    enhancementAuraItemLevel,
    enhancementAuraStage,
    resolveEnhancementAura,
    enhancementAuraBladeGeometry,
    EnhancementAuraRenderer
  };
}
