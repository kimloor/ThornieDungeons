// ---------- Enhancement Aura: presentation-only calculation and persistent renderer ----------
const ENHANCEMENT_AURA_THRESHOLDS = Object.freeze([
  Object.freeze({ min: 4, stage: 1 }),
  Object.freeze({ min: 6, stage: 2 }),
  Object.freeze({ min: 8, stage: 3 }),
  Object.freeze({ min: 10, stage: 4 })
]);
const ENHANCEMENT_AURA_PALETTE = Object.freeze({
  1: 0x72d7ff,
  2: 0x9c8aff,
  3: 0xffc56b,
  4: 0xff82cf
});

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
  constructor(scene, root, displaySize = () => 150) {
    this.scene = scene;
    this.root = root;
    this.displaySizeSource = displaySize;
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

    const color = ENHANCEMENT_AURA_PALETTE[stage];
    const ringCount = stage >= 4 ? 3 : stage >= 2 ? 2 : 1;
    for (let index = 0; index < ringCount; index += 1) {
      const width = size * (0.72 + index * 0.13);
      const height = size * (0.16 + index * 0.055);
      this.characterGraphics
        .lineStyle(1.25 + stage * 0.35, color, Math.max(0.16, 0.42 - index * 0.09))
        .strokeEllipse(0, size * (0.05 + index * 0.015), width, height);
    }

    const particleCount = Math.min(10, 2 + stage * 2);
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount;
      const particle = this.scene.add.circle(
        Math.cos(angle) * size * 0.39,
        size * 0.05 + Math.sin(angle) * size * 0.12,
        Math.max(1.5, size * (0.009 + stage * 0.0015)),
        color,
        0.82
      );
      this.characterRoot.add(particle);
      this.characterParticles.push(particle);
      const tween = this.scene.tweens?.add?.({
        targets: particle,
        alpha: 0.16,
        scale: 0.58,
        y: particle.y - size * 0.035,
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
      duration: Math.max(700, 1120 - stage * 70),
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
      this.root.add(halo);
      this.weaponHalos.push(halo);
      created.push(halo);
    }
    return created;
  }

  updateWeapon(stage, heroRenderer) {
    const layerName = String(heroRenderer?.data?.visualMode || "").startsWith("v5-g2") ? "sword" : "weapon";
    const entry = heroRenderer?.layerImages?.find(item => item.name === layerName);
    const weaponImage = entry?.image;
    const currentLayer = (heroRenderer?.currentLayers || []).find(layer => layer.name === layerName);
    const layerNames = (heroRenderer?.currentLayers || []).map(layer => String(layer?.name || "")).filter(Boolean);
    const reason = stage <= 0 ? "stage_disabled" : !currentLayer ? "weapon_layer_missing" : !weaponImage ? "weapon_image_missing" : !weaponImage.visible ? "weapon_image_hidden" : !weaponImage.texture?.key ? "weapon_texture_missing" : "weapon_layer_ready";
    const usable = reason === "weapon_layer_ready";
    const diagnostic = { event: "weapon_aura_diagnostic", reason, visualMode: String(heroRenderer?.data?.visualMode || "unknown").slice(0, 40), expectedLayer: layerName, availableLayers: layerNames.slice(0, 24), textureKey: String(weaponImage?.texture?.key || "").slice(0, 160), visible: !!weaponImage?.visible, x: Number.isFinite(Number(weaponImage?.x)) ? Number(weaponImage.x) : null, y: Number.isFinite(Number(weaponImage?.y)) ? Number(weaponImage.y) : null, displayWidth: Number.isFinite(Number(weaponImage?.displayWidth)) ? Number(weaponImage.displayWidth) : null, displayHeight: Number.isFinite(Number(weaponImage?.displayHeight)) ? Number(weaponImage.displayHeight) : null, originX: Number.isFinite(Number(weaponImage?.originX)) ? Number(weaponImage.originX) : null, originY: Number.isFinite(Number(weaponImage?.originY)) ? Number(weaponImage.originY) : null, angle: Number.isFinite(Number(weaponImage?.angle)) ? Number(weaponImage.angle) : null, crop: Array.isArray(currentLayer?.crop) ? currentLayer.crop.slice(0, 4) : null };
    const signature = JSON.stringify(diagnostic);
    if (signature !== this.weaponDiagnosticSignature) {
      this.weaponDiagnosticSignature = signature;
      const layerSummary = layerNames.slice(0, 5).join(",") || "none";
      this.weaponDiagnosticText?.setText?.(`Weapon Aura: ${reason}\\n${layerName} / ${layerSummary}`);
      this.weaponDiagnosticText?.setPosition?.(0, this.displaySize() * 0.66);
      this.weaponDiagnosticText?.setVisible?.(true);
      try { globalThis.console?.info?.("[weapon-aura-diagnostic]", JSON.stringify(diagnostic)); } catch (_) {}
    }
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
    const color = ENHANCEMENT_AURA_PALETTE[stage];
    const count = stage >= 4 ? 3 : stage >= 3 ? 2 : 1;
    const startPulse = stageChanged || created.length > 0 || this.weaponTweens.length === 0;
    if (startPulse) {
      this.stopTweens(this.weaponTweens);
      this.weaponHalos.forEach((halo, index) => {
        if (index >= count) {
          halo.setVisible(false);
          return;
        }
        halo.setTint(color).setAlpha(0.20 - index * 0.035);
        const tween = this.scene.tweens?.add?.({
          targets: halo,
          alpha: Math.max(0.035, 0.12 - index * 0.025),
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
          Math.max(1, weaponImage.displayWidth) * (1.055 + index * 0.045),
          Math.max(1, weaponImage.displayHeight) * (1.055 + index * 0.045)
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
    // TEMPORARY OWNER-REQUESTED VISIBILITY DIAGNOSTIC:
    // bypass enhancement/loadout stage gates so the renderer is visibly exercised
    // on Inventory preview and battlefield HeroActor. Remove after visual diagnosis.
    const forceVisible = true;
    const characterStage = forceVisible ? 4 : Math.max(0, Math.min(4, Math.floor(Number(aura?.characterStage) || 0)));
    const weaponStage = forceVisible ? 4 : Math.max(0, Math.min(4, Math.floor(Number(aura?.weaponStage) || 0)));
    this.updateCharacter(characterStage);
    this.updateWeapon(weaponStage, heroRenderer);
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
    ENHANCEMENT_AURA_PALETTE,
    enhancementAuraItemLevel,
    enhancementAuraStage,
    resolveEnhancementAura,
    EnhancementAuraRenderer
  };
}
