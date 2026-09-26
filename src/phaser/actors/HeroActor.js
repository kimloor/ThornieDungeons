// ---------- W5 Hero Actor ----------
class HeroActor extends PhaserBattleActor {
  constructor(scene, data) {
    super(scene, data, { baseSize: 150, depth: 7 });
    this.layerImages = [];
  }

  layerSetForState(state) {
    const sets = this.data.layerFrames || {};
    if (state === "attack" && Array.isArray(sets.attack) && sets.attack.length) return sets.attack;
    if (state === "death" && Array.isArray(sets.death) && sets.death.length) return sets.death;
    return Array.isArray(sets.idle) && sets.idle.length ? sets.idle : [this.data.layers || []];
  }

  visualFrameCount(state) {
    return Math.max(1, this.layerSetForState(state).length || 1);
  }

  ensureLayerImages(layers) {
    const size = this.displaySize();
    (layers || []).forEach((layer, index) => {
      let entry = this.layerImages.find(item => item.name === layer.name);
      if (!entry) {
        const key = this.scene.assetKey(layer.url);
        if (!key || !this.scene.textures.exists(key)) return;
        const image = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
        // resolveHeroV3Layers already returns the DOM bottom-to-top contract.
        this.visualRoot.addAt(image, Math.min(index, this.visualRoot.list?.length || 0));
        entry = { name: layer.name, image };
        this.layerImages.push(entry);
      }
      entry.image.setDisplaySize(size, size);
    });
  }

  applyVisualFrame(state, index = 0) {
    const frames = this.layerSetForState(state);
    const layers = frames[Math.min(Math.max(0, index), Math.max(0, frames.length - 1))] || this.data.layers || [];
    this.ensureLayerImages(layers);
    const size = this.displaySize();
    const canvasWidth = Math.max(1, Number(this.data.layerFrames?.canvas?.width) || 1254);
    const canvasHeight = Math.max(1, Number(this.data.layerFrames?.canvas?.height) || 1254);

    this.layerImages.forEach(entry => {
      const layer = layers.find(candidate => candidate.name === entry.name);
      if (!layer) {
        entry.image.setVisible(false);
        return;
      }
      const key = this.scene.assetKey(layer.url);
      if (key && this.scene.textures.exists(key) && entry.image.texture.key !== key) entry.image.setTexture(key);
      const scale = Number(layer.scale ?? 1);
      entry.image
        .setVisible(true)
        .setDisplaySize(size * scale, size * scale)
        .setPosition(
          (Number(layer.x) || 0) * size / canvasWidth,
          (Number(layer.y) || 0) * size / canvasHeight
        )
        .setAngle(Number(layer.rotation) || 0);
    });
  }

  refresh(data, { animate = true } = {}) {
    this.data = { ...this.data, ...(data || {}) };
    const state = this.desiredVisualState();
    const displayedState = animate || !this.visualState ? state : this.visualState;
    this.applyVisualFrame(displayedState === "hurt" ? "idle" : displayedState, this.frameIndex);
    this.setVisualAlpha(displayedState === "death" ? 0.72 : 1);
    this.refreshHud();
    this.reposition(this.position || { x: 0, y: 0 });
    if (animate) return this.playVisualState(state, this.data.combatSpeed || 1);
    return Promise.resolve();
  }
}
