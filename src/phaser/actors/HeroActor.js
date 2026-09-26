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
