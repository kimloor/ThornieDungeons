// ---------- W6 Combat Hero Actor Wrapper ----------
class HeroActor extends PhaserBattleActor {
  constructor(scene, data) {
    super(scene, data, { baseSize: 150, depth: 7 });
    this.heroRenderer = new HeroRenderer(scene, {
      root: this.visualRoot,
      data: this.data,
      displaySize: () => this.displaySize(),
      textureKey: reference => this.scene.assetKey(reference)
    });
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
  }

  destroy() {
    this.heroRenderer?.destroy();
    this.heroRenderer = null;
    super.destroy();
  }
}
