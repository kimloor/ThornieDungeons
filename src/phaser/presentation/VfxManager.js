// ---------- W6 Shared Phaser VFX Manager ----------
// Consumes already-resolved presentation effects only. It never decides hits,
// damage, status application, turn order or any other gameplay outcome.
class VfxManager {
  constructor(scene, {
    assetResolver = SHARED_PHASER_ASSET_RESOLVER,
    textureRegistry = scene?.textureRegistry || null,
    frameResolver = null,
    positionResolver = null
  } = {}) {
    this.scene = scene;
    this.assetResolver = assetResolver;
    this.textureRegistry = textureRegistry;
    this.frameResolver = frameResolver || (effectKey =>
      typeof battleVfxFrames === "function" ? battleVfxFrames(effectKey) : []
    );
    this.positionResolver = positionResolver;
    this.active = new Set();
  }

  framesFor(effectKey) {
    const rawFrames = this.frameResolver?.(effectKey) || [];
    return (rawFrames || [])
      .map(frame => this.assetResolver.resolve(frame))
      .filter(Boolean);
  }

  collectFrames(effectKeys) {
    return [...new Set((effectKeys || []).flatMap(effectKey => this.framesFor(effectKey)))];
  }

  queueAssets(effectKeys) {
    if (!this.textureRegistry) return [];
    return this.textureRegistry.queue(this.scene, this.collectFrames(effectKeys));
  }

  resolvePosition(effect) {
    if (typeof this.positionResolver === "function") {
      const resolved = this.positionResolver(effect);
      if (resolved) return resolved;
    }
    return effect?.position || {
      x: Number(effect?.x) || 0,
      y: Number(effect?.y) || 0
    };
  }

  wait(ms) {
    if (!(ms > 0) || !this.scene?.time?.delayedCall) return Promise.resolve();
    return new Promise(resolve => this.scene.time.delayedCall(ms, resolve));
  }

  async play(effect, { speed = 1 } = {}) {
    const effectKey = effect?.effectKey || effect?.key;
    const frames = this.framesFor(effectKey);
    if (!frames.length || !this.textureRegistry || !this.scene?.add?.image) return false;

    const position = this.resolvePosition(effect);
    const firstKey = this.textureRegistry.keyFor(frames[0]);
    if (!firstKey || !this.scene?.textures?.exists(firstKey)) return false;

    const image = this.scene.add.image(Number(position?.x) || 0, Number(position?.y) || 0, firstKey);
    image.setOrigin?.(0.5, 0.5);
    image.setDepth?.(Number(effect?.depth) || 20);
    if (Number(effect?.displaySize) > 0) image.setDisplaySize?.(Number(effect.displaySize), Number(effect.displaySize));
    if (Number.isFinite(Number(effect?.alpha))) image.setAlpha?.(Number(effect.alpha));
    this.active.add(image);

    const frameMs = Math.max(16, Number(effect?.frameMs) || 70);
    const playbackSpeed = Math.max(1, Number(speed) || 1);
    try {
      for (let index = 0; index < frames.length; index += 1) {
        const key = this.textureRegistry.keyFor(frames[index]);
        if (key && this.scene?.textures?.exists(key) && image.texture?.key !== key) image.setTexture?.(key);
        if (index < frames.length - 1) await this.wait(Math.round(frameMs / playbackSpeed));
      }
      return true;
    } finally {
      this.active.delete(image);
      image.destroy?.();
    }
  }

  clear() {
    this.active.forEach(image => image?.destroy?.());
    this.active.clear();
  }

  destroy() {
    this.clear();
    this.scene = null;
    this.textureRegistry = null;
  }
}

function createVfxManager(scene, options = {}) {
  return new VfxManager(scene, options);
}
