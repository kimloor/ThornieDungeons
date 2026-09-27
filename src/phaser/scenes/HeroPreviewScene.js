// ---------- W8 Shared Hero Preview Scene ----------
function heroPreviewFallbackLayerNames(name) {
  if (name === "wing_far" || name === "wing_near") return ["wing_far", "wing_near"];
  if (name === "arm_rear" || name === "arm_front") return ["arm_rear", "arm_front", "coverage_underlay"];
  if (name === "torso_armor") return ["torso_armor", "coverage_underlay"];
  if (name === "legs_boots") return ["legs_boots", "coverage_underlay"];
  return name ? [name] : [];
}

function createHeroPreviewScene(Phaser, { initialSnapshot, anchorX = 0.5, onReady, onError } = {}) {
  return class HeroPreviewScene extends Phaser.Scene {
    constructor() {
      super({ key: "HeroPreviewScene" });
      this.initialSnapshot = initialSnapshot || null;
      this.snapshot = null;
      this.pendingSnapshot = null;
      this.assetResolver = SHARED_PHASER_ASSET_RESOLVER;
      this.textureRegistry = createPhaserTextureRegistry({ resolver: this.assetResolver });
      this.heroRoot = null;
      this.heroRenderer = null;
      this.frameTimer = null;
      this.frameIndex = 0;
      this.failedUrls = new Set();
      this.dynamicLoading = false;
      this.coreLoadFailed = false;
      this.readyNotified = false;
      this.anchorX = Math.max(0, Math.min(1, Number(anchorX) || 0.5));
      this.handleResize = this.handleResize.bind(this);
      this.handleLoadError = this.handleLoadError.bind(this);
    }

    assetKey(reference) {
      return this.textureRegistry.keyFor(reference);
    }

    collectAssets(snapshot) {
      const frames = snapshot?.hero?.layerFrames?.idle || [];
      return this.assetResolver.resolveAll(
        frames.flatMap(frame => (frame || []).map(layer => layer?.url).filter(Boolean))
      );
    }

    coreUrls(snapshot) {
      const frames = snapshot?.hero?.layerFrames?.idle || [];
      return new Set(frames.flatMap(frame => (frame || [])
        .filter(layer => layer?.name === "base")
        .map(layer => this.assetResolver.resolve(layer?.url))
        .filter(Boolean)));
    }

    preload() {
      this.load.on("loaderror", this.handleLoadError);
      this.textureRegistry.queue(this, this.collectAssets(this.initialSnapshot));
    }

    handleLoadError(file) {
      const resolved = this.textureRegistry.urlFor(file?.key) || this.assetResolver.resolve(file?.url || "");
      if (resolved) {
        this.failedUrls.add(resolved);
        if (this.coreUrls(this.pendingSnapshot || this.snapshot || this.initialSnapshot).has(resolved)) {
          this.coreLoadFailed = true;
        }
      }
      if (file?.key) this.textureRegistry.forget(file.key);
    }

    sanitizeSnapshot(snapshot) {
      if (!snapshot?.hero) return snapshot;
      const layerFrames = snapshot.hero.layerFrames || {};
      const failedLayerNames = new Set();
      Object.values(layerFrames).forEach(value => {
        if (!Array.isArray(value)) return;
        value.forEach(frame => (frame || []).forEach(layer => {
          const url = this.assetResolver.resolve(layer?.url);
          if (url && this.failedUrls.has(url)) {
            heroPreviewFallbackLayerNames(layer?.name).forEach(name => failedLayerNames.add(name));
          }
        }));
      });
      if (failedLayerNames.has("base")) return null;
      if (!failedLayerNames.size) return snapshot;

      const nextFrames = { ...layerFrames };
      ["idle", "attack", "death"].forEach(state => {
        if (!Array.isArray(layerFrames[state])) return;
        nextFrames[state] = layerFrames[state].map(frame =>
          (frame || []).filter(layer => !failedLayerNames.has(layer?.name))
        );
      });
      return {
        ...snapshot,
        hero: {
          ...snapshot.hero,
          layers: (snapshot.hero.layers || []).filter(layer => !failedLayerNames.has(layer?.name)),
          layerFrames: nextFrames
        }
      };
    }

    create() {
      this.scale.on("resize", this.handleResize, this);
      if (this.coreLoadFailed) {
        onError?.(new Error("Hero V5 core preview asset failed to load"));
        return;
      }
      this.heroRoot = this.add.container(0, 0);
      this.heroRenderer = new HeroRenderer(this, {
        root: this.heroRoot,
        data: this.initialSnapshot?.hero || {},
        displaySize: () => this.displaySize(),
        textureKey: reference => this.assetKey(reference)
      });
      this.applySnapshot(this.initialSnapshot);
      this.readyNotified = true;
      onReady?.({ scene: this });
    }

    displaySize() {
      const width = Math.max(1, Number(this.scale.width) || 1);
      const height = Math.max(1, Number(this.scale.height) || 1);
      return Math.max(96, Math.round(Math.min(width * 0.92, height * 1.06)));
    }

    layoutHero() {
      if (!this.heroRoot) return;
      const width = Math.max(1, Number(this.scale.width) || 1);
      const height = Math.max(1, Number(this.scale.height) || 1);
      this.heroRoot.setPosition(Math.round(width * this.anchorX), Math.round(height * 0.86));
    }

    stopIdle() {
      this.frameTimer?.remove(false);
      this.frameTimer = null;
    }

    startIdle() {
      this.stopIdle();
      if (!this.heroRenderer || !this.snapshot?.hero) return;
      this.frameIndex = 0;
      this.heroRenderer.setData(this.snapshot.hero).applyVisualFrame("idle", 0);
      const frameCount = this.heroRenderer.visualFrameCount("idle");
      if (frameCount <= 1) return;
      const delay = Math.max(80, Number(this.snapshot.hero.layerFrames?.frameMs?.idle) || 220);
      this.frameTimer = this.time.addEvent({
        delay,
        loop: true,
        callback: () => {
          this.frameIndex = (this.frameIndex + 1) % frameCount;
          this.heroRenderer?.setData(this.snapshot.hero).applyVisualFrame("idle", this.frameIndex);
        }
      });
    }

    applySnapshot(snapshot) {
      if (!snapshot?.hero || !this.heroRenderer) return;
      const sanitized = this.sanitizeSnapshot(snapshot);
      if (!sanitized?.hero) {
        this.coreLoadFailed = true;
        this.stopIdle();
        onError?.(new Error("Hero V5 core preview contract is unavailable"));
        return;
      }
      this.snapshot = sanitized;
      this.heroRenderer.setData(this.snapshot.hero);
      this.layoutHero();
      this.startIdle();
    }

    queueDynamicAssets(snapshot) {
      let queued = 0;
      this.collectAssets(snapshot).forEach(url => {
        if (!url || this.failedUrls.has(url)) return;
        const key = this.textureRegistry.keyFor(url);
        if (!key || this.textures.exists(key)) return;
        this.load.image(key, url);
        queued += 1;
      });
      return queued;
    }

    sync(snapshot) {
      if (!snapshot?.hero || this.coreLoadFailed) return;
      this.pendingSnapshot = snapshot;
      if (this.dynamicLoading) return;
      const queued = this.queueDynamicAssets(snapshot);
      if (!queued) {
        this.pendingSnapshot = null;
        this.applySnapshot(snapshot);
        return;
      }
      this.dynamicLoading = true;
      this.load.once("complete", () => {
        this.dynamicLoading = false;
        const latest = this.pendingSnapshot;
        this.pendingSnapshot = null;
        if (latest) this.sync(latest);
      });
      this.load.start();
    }

    handleResize() {
      this.layoutHero();
      if (this.snapshot?.hero) {
        this.heroRenderer?.setData(this.snapshot.hero).applyVisualFrame("idle", this.frameIndex);
      }
    }

    shutdown() {
      this.scale.off("resize", this.handleResize, this);
      this.load.off("loaderror", this.handleLoadError);
      this.stopIdle();
      this.heroRenderer?.destroy();
      this.heroRenderer = null;
      this.heroRoot?.destroy(true);
      this.heroRoot = null;
      this.snapshot = null;
      this.pendingSnapshot = null;
      if (this.readyNotified) onReady?.({ scene: null, destroyed: true });
    }
  };
}
