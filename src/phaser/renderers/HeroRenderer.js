// ---------- W6 Shared Hero Renderer ----------
// Renders the currently approved Hero V3 layer contract only.
// Equipment/V5 resolution is intentionally outside this renderer and belongs to
// the future EquipmentVisualResolver boundary.
class HeroRenderer {
  constructor(scene, {
    root = null,
    data = {},
    displaySize = 150,
    textureKey = null
  } = {}) {
    this.scene = scene;
    this.root = root || scene.add.container(0, 0);
    this.ownsRoot = !root;
    this.data = data || {};
    this.displaySizeSource = displaySize;
    this.textureKeySource = textureKey;
    this.layerImages = [];
  }

  setData(data) {
    this.data = data || {};
    return this;
  }

  displaySize() {
    const value = typeof this.displaySizeSource === "function"
      ? this.displaySizeSource()
      : this.displaySizeSource;
    return Math.max(1, Number(value) || 1);
  }

  textureKey(reference) {
    if (typeof this.textureKeySource === "function") return this.textureKeySource(reference);
    if (typeof this.scene?.assetKey === "function") return this.scene.assetKey(reference);
    if (typeof this.scene?.textureRegistry?.keyFor === "function") return this.scene.textureRegistry.keyFor(reference);
    return "";
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
        const key = this.textureKey(layer.url);
        if (!key || !this.scene?.textures?.exists(key)) return;
        const image = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
        // resolveHeroV3Layers already returns the DOM bottom-to-top contract.
        this.root.addAt(image, Math.min(index, this.root.list?.length || 0));
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
      const key = this.textureKey(layer.url);
      if (key && this.scene?.textures?.exists(key) && entry.image.texture.key !== key) entry.image.setTexture(key);
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

  destroy() {
    this.layerImages.forEach(entry => entry.image?.destroy());
    this.layerImages = [];
    if (this.ownsRoot) this.root?.destroy(true);
    this.root = null;
    this.scene = null;
  }
}
