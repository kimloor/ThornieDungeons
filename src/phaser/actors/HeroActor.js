// ---------- W6 Combat Hero Actor Wrapper ----------
class HeroActor extends PhaserBattleActor {
  constructor(scene, data, options = {}) {
    super(scene, data, { baseSize: 150, depth: 7, ...options });
    this.heroRenderer = new HeroRenderer(scene, {
      root: this.visualRoot,
      data: this.data,
      displaySize: () => this.displaySize(),
      textureKey: reference => this.scene.assetKey(reference)
    });
    globalThis.BATTLE_ERROR_CATCHER?.setEnabled(true);
    try {
      this.enhancementAuraRenderer = new EnhancementAuraRenderer(scene, this.visualRoot, () => this.displaySize());
    } catch (error) {
      globalThis.BATTLE_ERROR_CATCHER?.captureAura({ surface: this.data?.presentationSurface || "battle", phase: "renderer_init", error, characterStage: this.data?.enhancementAura?.characterStage, weaponStage: this.data?.enhancementAura?.weaponStage });
      this.enhancementAuraRenderer = null;
    }
  }

  isV5Presentation() {
    return String(this.data?.visualMode || "").startsWith("v5-g2");
  }

  displaySize() {
    const base = super.displaySize();
    return this.isV5Presentation() ? Math.round(base * 1.30) : base;
  }

  hurtVisualState() {
    return this.isV5Presentation() ? "death" : super.hurtVisualState();
  }

  frameDelayForState(state) {
    if (this.isV5Presentation()) {
      const configured = Number(this.data?.layerFrames?.frameMs?.[state]);
      if (Number.isFinite(configured) && configured > 0) return configured;
    }
    return super.frameDelayForState(state);
  }

  visualFrameCount(state) {
    return this.heroRenderer
      ? this.heroRenderer.setData(this.data).visualFrameCount(state)
      : 1;
  }

  applyVisualFrame(state, index = 0) {
    this.heroRenderer?.setData(this.data).applyVisualFrame(state, index);
    try {
      this.enhancementAuraRenderer?.update(this.data?.enhancementAura, this.heroRenderer);
    } catch (error) {
      globalThis.BATTLE_ERROR_CATCHER?.captureAura({ surface: this.data?.presentationSurface || "battle", phase: "renderer_update", error, characterStage: this.data?.enhancementAura?.characterStage, weaponStage: this.data?.enhancementAura?.weaponStage });
      try { this.enhancementAuraRenderer?.destroy(); } catch (teardownError) {
        globalThis.BATTLE_ERROR_CATCHER?.captureAura({ surface: this.data?.presentationSurface || "battle", phase: "renderer_recovery", error: teardownError });
      }
      this.enhancementAuraRenderer = null;
    }
  }

  destroy() {
    try { this.enhancementAuraRenderer?.destroy(); } catch (error) {
      globalThis.BATTLE_ERROR_CATCHER?.captureAura({ surface: this.data?.presentationSurface || "battle", phase: "renderer_destroy", error });
    }
    this.enhancementAuraRenderer = null;
    this.heroRenderer?.destroy();
    this.heroRenderer = null;
    super.destroy();
  }
}
