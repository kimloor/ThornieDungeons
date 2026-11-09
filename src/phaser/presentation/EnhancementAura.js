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
    this.weaponHalos = [];
    this.weaponTweens = [];
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
    this.characterParticles.forEach(particle => particle?.destroy?.());
    this.characterParticles = [];
  }

  updateCharacter(stage) {
    if (stage === this.characterStage) return;
    this.characterStage = stage;
    this.clearCharacterParticles();
    this.characterGraphics.clear();
    if (stage <= 0) {
      this.characterRoot.setVisible(false);
      return;
    }

    const color = ENHANCEMENT_AURA_PALETTE[stage];
    const size = this.displaySize();
    const ringCount = stage >= 4 ? 3 : stage >= 2 ? 2 : 1;
    for (let index = 0; index < ringCount; index += 1) {
      const width = size * (0.72 + index * 0.13);
      const height = size * (0.16 + index * 0.055);
      this.characterGraphics
        .lineStyle(1.25 + stage * 0.35, color, Math.max(0.16, 0.42 - index * 0.09))
        .strokeEllipse(0, -size * (0.46 + index * 0.035), width, height);
    }

    const particleCount = Math.min(10, 2 + stage * 2);
    for (let index = 0; index < particleCount; index += 1) {
      const angle = (Math.PI * 2 * index) / particleCount;
      const particle = this.scene.add.circle(
        Math.cos(angle) * size * 0.39,
        -size * 0.49 + Math.sin(angle) * size * 0.28,
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

  ensureWeaponHalos() {
    while (this.weaponHalos.length < 3) {
      const halo = this.scene.add.image(0, 0, "__MISSING");
      halo.setOrigin(0.5, 1).setVisible(false);
      this.root.add(halo);
      this.weaponHalos.push(halo);
    }
  }

  updateWeapon(stage, heroRenderer) {
    const layerName = String(heroRenderer?.data?.visualMode || "").startsWith("v5-g2") ? "sword" : "weapon";
    const entry = heroRenderer?.layerImages?.find(item => item.name === layerName);
    const weaponImage = entry?.image;
    const currentLayer = (heroRenderer?.currentLayers || []).find(layer => layer.name === layerName);
    const usable = stage > 0 && weaponImage?.visible && weaponImage?.texture?.key && currentLayer;
    if (stage !== this.weaponStage) {
      this.weaponStage = stage;
      this.stopTweens(this.weaponTweens);
      if (stage > 0) {
        this.ensureWeaponHalos();
        const color = ENHANCEMENT_AURA_PALETTE[stage];
        const count = stage >= 4 ? 3 : stage >= 3 ? 2 : 1;
        this.weaponHalos.forEach((halo, index) => {
          halo.setTint(color).setVisible(index < count).setAlpha(0.20 - index * 0.035);
          if (index < count) {
            const tween = this.scene.tweens?.add?.({
              targets: halo,
              alpha: Math.max(0.035, 0.12 - index * 0.025),
              duration: 760 + index * 130,
              yoyo: true,
              repeat: -1,
              ease: "Sine.easeInOut"
            });
            if (tween) this.weaponTweens.push(tween);
          }
        });
      } else {
        this.weaponHalos.forEach(halo => halo.setVisible(false));
      }
    }

    if (!usable) {
      this.weaponHalos.forEach(halo => halo.setVisible(false));
      return;
    }

    this.ensureWeaponHalos();
    const color = ENHANCEMENT_AURA_PALETTE[stage];
    const count = stage >= 4 ? 3 : stage >= 3 ? 2 : 1;
    this.weaponHalos.forEach((halo, index) => {
      if (index >= count) {
        halo.setVisible(false);
        return;
      }
      const key = weaponImage.texture.key;
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
    if (root.list.includes(this.characterRoot)) root.moveTo(this.characterRoot, 0);
    const layerName = String(heroRenderer?.data?.visualMode || "").startsWith("v5-g2") ? "sword" : "weapon";
    const weaponImage = heroRenderer?.layerImages?.find(item => item.name === layerName)?.image;
    let targetIndex = weaponImage ? root.list.indexOf(weaponImage) : -1;
    if (targetIndex < 0) return;
    this.weaponHalos.filter(halo => halo.visible && root.list.includes(halo)).forEach(halo => {
      root.moveTo(halo, targetIndex);
      targetIndex += 1;
    });
  }

  update(aura, heroRenderer) {
    if (this.destroyed) return;
    const characterStage = Math.max(0, Math.min(4, Math.floor(Number(aura?.characterStage) || 0)));
    const weaponStage = Math.max(0, Math.min(4, Math.floor(Number(aura?.weaponStage) || 0)));
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
    this.characterGraphics?.destroy?.();
    this.characterRoot?.destroy?.(true);
    this.weaponHalos.forEach(halo => halo?.destroy?.());
    this.characterParticles = [];
    this.weaponHalos = [];
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
