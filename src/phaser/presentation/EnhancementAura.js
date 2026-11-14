// ---------- Enhancement Aura: presentation-only calculation and persistent renderer ----------
const ENHANCEMENT_AURA_THRESHOLDS = Object.freeze([
  Object.freeze({ min: 4, stage: 1 }),
  Object.freeze({ min: 6, stage: 2 }),
  Object.freeze({ min: 8, stage: 3 }),
  Object.freeze({ min: 10, stage: 4 })
]);
// Replaceable appearance profiles; enhancement stage selects color only.
const ENHANCEMENT_AURA_STYLES = Object.freeze({
  goldenPower: Object.freeze({
    id: "goldenPower",
    name: "Golden Power",
    palette: Object.freeze({ 1: 0xfff0a6, 2: 0xffd447, 3: 0xffa52f, 4: 0xff7138 }),
    intensity: Object.freeze({
      ringCount: 3, ringLineWidth: 4, ringAlpha: 0.78, groundGlowAlpha: 0.24, groundY: -0.02,
      particleCount: 10, particleAlpha: 0.95, particleRadius: 0.017,
      particleOrbitX: 0.42, particleOrbitY: 0.1, particleRise: 0.14, pulseDuration: 1120,
      weaponHaloCount: 3, weaponHaloAlpha: 0.55, weaponHaloPulseAlpha: 0.28, weaponHaloGrowth: 0.015,
      weaponGlowStrength: 4
    })
  })
});
const DEFAULT_ENHANCEMENT_AURA_STYLE = "goldenPower";
function resolveEnhancementAuraStyle(styleId = DEFAULT_ENHANCEMENT_AURA_STYLE) {
  return ENHANCEMENT_AURA_STYLES[String(styleId)] || ENHANCEMENT_AURA_STYLES[DEFAULT_ENHANCEMENT_AURA_STYLE];
}

// Additive blending makes the cosmetic glow readable on any background.
function enhancementAuraBlendAdd() {
  return typeof Phaser !== "undefined" && Phaser.BlendModes ? Phaser.BlendModes.ADD : 1;
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

class EnhancementAuraRenderer {
  constructor(scene, root, displaySize = () => 150, styleId = DEFAULT_ENHANCEMENT_AURA_STYLE) {
    this.scene = scene;
    this.root = root;
    this.displaySizeSource = displaySize;
    this.style = resolveEnhancementAuraStyle(styleId);
    this.characterStage = -1;
    this.weaponStage = -1;
    this.characterRoot = scene.add.container(0, 0).setVisible(false);
    this.characterGraphics = scene.add.graphics();
    this.characterRoot.add(this.characterGraphics);
    this.characterParticles = [];
    this.characterTweens = [];
    this.characterSize = 0;
    this.weaponHalos = [];
    this.weaponTweens = [];
    this.weaponDiagnosticSignature = "";
    this.weaponDiagnosticText = typeof scene.add.text === "function"
      ? scene.add.text(0, 0, "", { fontFamily: "Arial, sans-serif", fontSize: "10px", color: "#ffffff", backgroundColor: "#21152f", padding: { x: 5, y: 3 }, align: "center" }).setOrigin(0.5, 0).setVisible(false)
      : null;
    if (this.weaponDiagnosticText) root?.add(this.weaponDiagnosticText);
    this.destroyed = false;
    root?.add(this.characterRoot);
  }

  displaySize() {
    return Math.max(1, Number(this.displaySizeSource?.()) || 150);
  }

  stopTweens(list) {
    list.forEach(tween => tween?.stop?.());
    list.length = 0;
  }

  clearCharacterParticles() {
    this.stopTweens(this.characterTweens);
    this.characterParticles.forEach(particle => {
      if (this.characterRoot?.remove) this.characterRoot.remove(particle, true);
      else particle?.destroy?.();
    });
    this.characterParticles = [];
  }

  updateCharacter(stage) {
    const size = this.displaySize();
    if (stage === this.characterStage && Math.abs(size - this.characterSize) < 1) return;
    this.characterStage = stage;
    this.characterSize = size;
    this.clearCharacterParticles();
    this.characterGraphics.clear();
    if (stage <= 0) {
      this.characterRoot.setVisible(false);
      return;
    }

    const color = this.style.palette[stage];
    const intensity = this.style.intensity;
    const ringCount = intensity.ringCount;
    const groundY = size * intensity.groundY;
    this.characterGraphics.setBlendMode?.(enhancementAuraBlendAdd());
    this.characterGraphics
      .fillStyle(color, intensity.groundGlowAlpha)
      .fillEllipse(0, groundY, size * 0.92, size * 0.22);
    for (let index = 0; index < ringCount; index += 1) {
      const width = size * (0.8 + index * 0.14);
      const height = size * (0.17 + index * 0.05);
      this.characterGraphics
        .lineStyle(intensity.ringLineWidth, color, Math.max(0.3, intensity.ringAlpha - index * 0.16))
        .strokeEllipse(0, groundY + size * index * 0.012, width, height);
    }

    const particleCount = intensity.particleCount;
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount;
      const particle = this.scene.add.circle(
        Math.cos(angle) * size * intensity.particleOrbitX,
        groundY + Math.sin(angle) * size * intensity.particleOrbitY,
        Math.max(2, size * intensity.particleRadius),
        color,
        intensity.particleAlpha
      );
      particle.setBlendMode?.(enhancementAuraBlendAdd());
      this.characterRoot.add(particle);
      this.characterParticles.push(particle);
      const tween = this.scene.tweens?.add?.({
        targets: particle,
        alpha: 0.2,
        scale: 0.55,
        y: particle.y - size * intensity.particleRise,
        duration: 720 + index * 55,
        delay: index * 65,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      if (tween) this.characterTweens.push(tween);
    }
    const pulse = this.scene.tweens?.add?.({
      targets: this.characterRoot,
      alpha: 0.62,
      duration: intensity.pulseDuration,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    if (pulse) this.characterTweens.push(pulse);
    this.characterRoot.setVisible(true).setAlpha(1);
  }

  ensureWeaponHalos(textureKey) {
    const created = [];
    if (!textureKey) return created;
    while (this.weaponHalos.length < 3) {
      const halo = this.scene.add.image(0, 0, textureKey);
      halo.setOrigin(0.5, 1).setVisible(false);
      halo.setBlendMode?.(enhancementAuraBlendAdd());
      this.root.add(halo);
      this.weaponHalos.push(halo);
      created.push(halo);
    }
    return created;
  }

  // WebGL-only soft outline; Canvas renderers simply keep the additive halo copies.
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

  updateWeapon(stage, heroRenderer, characterStage = 0) {
    const layerName = String(heroRenderer?.data?.visualMode || "").startsWith("v5-g2") ? "sword" : "weapon";
    const entry = heroRenderer?.layerImages?.find(item => item.name === layerName);
    const weaponImage = entry?.image;
    const currentLayer = (heroRenderer?.currentLayers || []).find(layer => layer.name === layerName);
    const layerNames = (heroRenderer?.currentLayers || []).map(layer => String(layer?.name || "")).filter(Boolean);
    const reason = stage <= 0 ? "stage_disabled" : !currentLayer ? "weapon_layer_missing" : !weaponImage ? "weapon_image_missing" : !weaponImage.visible ? "weapon_image_hidden" : !weaponImage.texture?.key ? "weapon_texture_missing" : "weapon_layer_ready";
    const usable = reason === "weapon_layer_ready";
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
    const stageChanged = stage !== this.weaponStage;
    if (stageChanged) {
      this.weaponStage = stage;
      this.stopTweens(this.weaponTweens);
      if (stage <= 0) this.weaponHalos.forEach(halo => halo.setVisible(false));
    }
    if (!usable) {
      this.weaponHalos.forEach(halo => halo.setVisible(false));
      this.stopTweens(this.weaponTweens);
      return;
    }

    const key = weaponImage.texture.key;
    const created = this.ensureWeaponHalos(key);
    const color = this.style.palette[stage];
    const intensity = this.style.intensity;
    const count = intensity.weaponHaloCount;
    const startPulse = stageChanged || created.length > 0 || this.weaponTweens.length === 0;
    if (startPulse) {
      this.stopTweens(this.weaponTweens);
      this.weaponHalos.forEach((halo, index) => {
        if (index >= count) {
          halo.setVisible(false);
          return;
        }
        halo.setTint(color).setAlpha(intensity.weaponHaloAlpha - index * 0.08);
        if (index === 0) this.applyWeaponGlow(halo, color, intensity.weaponGlowStrength);
        const tween = this.scene.tweens?.add?.({
          targets: halo,
          alpha: Math.max(0.06, intensity.weaponHaloPulseAlpha - index * 0.06),
          duration: 760 + index * 130,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
        if (tween) this.weaponTweens.push(tween);
      });
    }

    this.weaponHalos.forEach((halo, index) => {
      if (index >= count) {
        halo.setVisible(false);
        return;
      }
      if (halo.texture?.key !== key) halo.setTexture(key);
      halo
        .setTint(color)
        .setOrigin(weaponImage.originX, weaponImage.originY)
        .setPosition(weaponImage.x, weaponImage.y)
        .setAngle(weaponImage.angle || 0)
        .setDisplaySize(
          Math.max(1, weaponImage.displayWidth) * (1 + index * intensity.weaponHaloGrowth),
          Math.max(1, weaponImage.displayHeight) * (1 + index * intensity.weaponHaloGrowth)
        );
      if (Array.isArray(currentLayer.crop) && currentLayer.crop.length === 4) halo.setCrop(...currentLayer.crop);
      else halo.setCrop();
      halo.setVisible(true);
    });
  }

  reorder(heroRenderer) {
    const root = this.root;
    if (!root?.list || typeof root.moveTo !== "function") return;
    // Aura is intentionally the outermost presentation layer: raise it above
    // every Hero equipment/body layer after each frame is applied.
    if (root.list.includes(this.characterRoot)) root.moveTo(this.characterRoot, root.list.length - 1);
    this.weaponHalos.filter(halo => halo.visible && root.list.includes(halo)).forEach(halo => {
      root.moveTo(halo, root.list.length - 1);
    });
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
    this.stopTweens(this.characterTweens);
    this.stopTweens(this.weaponTweens);
    this.clearCharacterParticles();
    if (this.root?.remove) this.root.remove(this.characterRoot, false);
    this.characterRoot?.destroy?.(true);
    this.weaponHalos.forEach(halo => {
      if (this.root?.remove) this.root.remove(halo, false);
      halo?.destroy?.();
    });
    this.characterParticles = [];
    this.weaponHalos = [];
    this.weaponDiagnosticText?.destroy?.();
    this.weaponDiagnosticText = null;
    this.weaponDiagnosticSignature = "";
    this.characterRoot = null;
    this.characterGraphics = null;
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
    EnhancementAuraRenderer
  };
}
