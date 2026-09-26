// ---------- W6 Shared-asset Dungeon Combat Scene Shell ----------
function createBattleScene(Phaser, { initialSnapshot, onReady, onError, onTargetSelected } = {}) {
  return class BattleScene extends Phaser.Scene {
    constructor() {
      super({ key: "BattleScene" });
      this.initialSnapshot = initialSnapshot || null;
      this.snapshot = null;
      this.actors = { hero: null, pet: null, monsters: [] };
      this.assetResolver = SHARED_PHASER_ASSET_RESOLVER;
      this.textureRegistry = createPhaserTextureRegistry({ resolver: this.assetResolver });
      this.readyNotified = false;
      this.presentationQueue = createPresentationQueue();
      this.presentationScale = 1;
      this.handleResize = this.handleResize.bind(this);
    }

    assetKey(reference) {
      // Compatibility surface for W5 actors; key ownership now lives in the
      // shared registry and can be reused by future scenes/renderers.
      return this.textureRegistry.keyFor(reference);
    }

    collectAssets(snapshot) {
      const assets = [];
      (snapshot?.hero?.layers || []).forEach(layer => assets.push(layer.url));
      const heroSets = snapshot?.hero?.layerFrames || {};
      ["idle", "attack", "death"].forEach(anim => {
        (heroSets?.[anim] || []).forEach(frameLayers => {
          (frameLayers || []).forEach(layer => assets.push(layer.url));
        });
      });
      [snapshot?.pet, ...(snapshot?.monsters || [])].filter(Boolean).forEach(unit => {
        assets.push(
          ...(unit.frames?.idle || []),
          ...(unit.frames?.attack || []),
          ...(unit.frames?.death || [])
        );
      });
      return this.assetResolver.resolveAll(assets);
    }

    preload() {
      const assets = this.collectAssets(this.initialSnapshot);
      this.textureRegistry.queue(this, assets);
      this.load.on("loaderror", file => {
        // Optional art failure is presentation-local. Actors retain a readable
        // vector fallback and the DOM renderer remains available above us.
        if (file?.key) this.textureRegistry.forget(file.key);
      });
    }

    create() {
      this.scale.on("resize", this.handleResize, this);
      this.snapshot = this.initialSnapshot;
      this.createActors();
      this.sync(this.snapshot);
      this.readyNotified = true;
      onReady?.({ scene: this });
    }

    createActors() {
      if (!this.snapshot) return;
      this.actors.hero = new HeroActor(this, this.snapshot.hero || {});
      if (this.snapshot.pet) this.actors.pet = new PetActor(this, this.snapshot.pet);
      this.actors.monsters = (this.snapshot.monsters || []).map(monster => new MonsterActor(this, monster, id => onTargetSelected?.(id)));
    }

    consume(event) {
      if (!event || event.type !== "BATTLEFIELD_SYNC") return;
      this.sync(event.snapshot);
    }

    sync(snapshot) {
      if (!snapshot) return;
      this.snapshot = snapshot;
      const monsterCount = Math.max(1, Math.min(3, snapshot.monsters?.length || 1));
      this.presentationQueue.setSpeed(snapshot.combatSpeed || 1);
      if (!this.actors.hero) this.createActors();

      const animationJobs = [];
      const heroData = snapshot.hero || {};
      this.actors.hero?.refresh(heroData, { animate: false });
      if (this.actors.hero) {
        const state = this.actors.hero.desiredVisualState();
        if (state !== this.actors.hero.visualState) animationJobs.push([this.actors.hero, state]);
      }

      if (snapshot.pet && !this.actors.pet) this.actors.pet = new PetActor(this, snapshot.pet);
      if (!snapshot.pet && this.actors.pet) { this.actors.pet.destroy(); this.actors.pet = null; }
      this.actors.pet?.refresh(snapshot.pet || {}, { animate: false });
      if (this.actors.pet) {
        const state = this.actors.pet.desiredVisualState();
        if (state !== this.actors.pet.visualState) animationJobs.push([this.actors.pet, state]);
      }

      (snapshot.monsters || []).forEach((monster, index) => {
        let actor = this.actors.monsters[index];
        if (!actor) {
          actor = new MonsterActor(this, monster, id => onTargetSelected?.(id));
          this.actors.monsters[index] = actor;
        }
        actor.refresh(monster, { animate: false });
        actor.setSelected(monster.id === snapshot.selectedTargetId);
        const state = actor.desiredVisualState();
        if (state !== actor.visualState) animationJobs.push([actor, state]);
      });

      this.actors.monsters.slice(snapshot.monsters?.length || 0).forEach(actor => actor.destroy());
      this.actors.monsters.length = snapshot.monsters?.length || 0;
      this.layoutActors(monsterCount);

      if (animationJobs.length) {
        void this.presentationQueue.enqueue({
          run: speed => Promise.all(animationJobs.map(([actor, state]) =>
            actor.playVisualState(state, speed)
          ))
        });
      }
    }

    layoutActors(monsterCount) {
      const width = Math.max(1, this.scale.width || this.game.config.width || 1);
      const height = Math.max(1, this.scale.height || this.game.config.height || 1);
      const layout = responsiveBattlefieldLayout(width, height, monsterCount);
      this.presentationScale = layout.actorScale;
      const actors = [this.actors.hero, this.actors.pet, ...this.actors.monsters].filter(Boolean);
      actors.forEach(actor => actor.refresh(actor.data, { animate: false }));
      this.actors.hero?.reposition(layout.pixels.hero);
      this.actors.pet?.reposition(layout.pixels.pet);
      this.actors.monsters.forEach((actor, index) => actor.reposition(layout.pixels.monsters[index] || layout.pixels.monsters[0]));
    }

    handleResize(gameSize) {
      const width = Math.max(1, gameSize?.width || this.scale.width || 1);
      const height = Math.max(1, gameSize?.height || this.scale.height || 1);
      this.layoutActors(this.snapshot?.monsters?.length || 1);
    }

    shutdown() {
      this.scale.off("resize", this.handleResize, this);
      this.presentationQueue?.clear();
      Object.values(this.actors).flatMap(value => Array.isArray(value) ? value : [value]).filter(Boolean).forEach(actor => actor.destroy());
      this.actors = { hero: null, pet: null, monsters: [] };
      if (this.readyNotified) onReady?.({ scene: null, destroyed: true });
    }
  };
}
