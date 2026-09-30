// ---------- W6 Shared-asset Dungeon/Arena Combat Scene Shell ----------
function isArenaPresentationSnapshot(snapshot) {
  return snapshot?.mode === "arena" && Array.isArray(snapshot?.teams);
}

function createBattleScene(Phaser, { initialSnapshot, onReady, onError, onTargetSelected } = {}) {
  return class BattleScene extends Phaser.Scene {
    constructor() {
      super({ key: "BattleScene" });
      this.initialSnapshot = initialSnapshot || null;
      this.snapshot = null;
      this.actors = { hero: null, pet: null, monsters: [] };
      this.arenaActors = {
        attacker: { hero: null, pet: null },
        defender: { hero: null, pet: null }
      };
      this.assetResolver = SHARED_PHASER_ASSET_RESOLVER;
      this.textureRegistry = createPhaserTextureRegistry({ resolver: this.assetResolver });
      this.readyNotified = false;
      this.presentationQueue = createPresentationQueue({ onError });
      this.vfxManager = createVfxManager(this, {
        assetResolver: this.assetResolver,
        textureRegistry: this.textureRegistry
      });
      this.presentationScale = 1;
      this.lastArenaCueSeq = -1;
      this.lastArenaBattleId = null;
      this.handleResize = this.handleResize.bind(this);
    }

    assetKey(reference) {
      // Compatibility surface for W5 actors; key ownership now lives in the
      // shared registry and can be reused by future scenes/renderers.
      return this.textureRegistry.keyFor(reference);
    }

    collectHeroAssets(hero, assets) {
      (hero?.layers || []).forEach(layer => assets.push(layer.url));
      const heroSets = hero?.layerFrames || {};
      ["idle", "attack", "death"].forEach(anim => {
        (heroSets?.[anim] || []).forEach(frameLayers => {
          (frameLayers || []).forEach(layer => assets.push(layer.url));
        });
      });
    }

    collectUnitAssets(unit, assets) {
      if (!unit) return;
      assets.push(
        ...(unit.frames?.idle || []),
        ...(unit.frames?.attack || []),
        ...(unit.frames?.death || [])
      );
    }

    collectAssets(snapshot) {
      const assets = [];
      if (isArenaPresentationSnapshot(snapshot)) {
        (snapshot.teams || []).forEach(team => {
          this.collectHeroAssets(team?.hero, assets);
          this.collectUnitAssets(team?.pet, assets);
        });
      } else {
        this.collectHeroAssets(snapshot?.hero, assets);
        [snapshot?.pet, ...(snapshot?.monsters || [])].filter(Boolean).forEach(unit => {
          this.collectUnitAssets(unit, assets);
        });
      }
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
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
      this.scale.on("resize", this.handleResize, this);
      this.snapshot = this.initialSnapshot;
      try {
        this.createActors();
        this.sync(this.snapshot);
        this.readyNotified = true;
        onReady?.({ scene: this });
      } catch (error) {
        onError?.(error);
      }
    }

    createActors() {
      if (!this.snapshot) return;
      if (isArenaPresentationSnapshot(this.snapshot)) {
        this.createArenaActors();
        return;
      }
      this.actors.hero = new HeroActor(this, this.snapshot.hero || {});
      if (this.snapshot.pet) this.actors.pet = new PetActor(this, this.snapshot.pet);
      this.actors.monsters = (this.snapshot.monsters || []).map(monster => new MonsterActor(this, monster, id => onTargetSelected?.(id)));
    }

    arenaTeam(role) {
      return (this.snapshot?.teams || []).find(team => team?.role === role)
        || (role === "attacker" ? this.snapshot?.teams?.[0] : this.snapshot?.teams?.[1])
        || null;
    }

    createArenaActor(data, selectable = false) {
      if (!data) return null;
      const options = selectable ? { onSelect: id => onTargetSelected?.(id) } : {};
      return data.kind === "pet"
        ? new PetActor(this, data, options)
        : new HeroActor(this, data, options);
    }

    createArenaActors() {
      const attacker = this.arenaTeam("attacker");
      const defender = this.arenaTeam("defender");
      this.arenaActors.attacker.hero = this.createArenaActor(attacker?.hero, false);
      this.arenaActors.attacker.pet = this.createArenaActor(attacker?.pet, false);
      this.arenaActors.defender.hero = this.createArenaActor(defender?.hero, true);
      this.arenaActors.defender.pet = this.createArenaActor(defender?.pet, true);
    }

    consume(event) {
      if (!event || event.type !== "BATTLEFIELD_SYNC") return;
      try {
        this.sync(event.snapshot);
      } catch (error) {
        onError?.(error);
      }
    }

    queueActorAnimation(actor, data, animationJobs) {
      if (!actor || !data) return;
      actor.refresh(data, { animate: false });
      const state = actor.desiredVisualState();
      if (state !== actor.visualState) animationJobs.push([actor, state]);
    }

    syncArenaActor(role, kind, data, animationJobs) {
      let actor = this.arenaActors[role][kind];
      if (data && !actor) {
        actor = this.createArenaActor(data, role === "defender");
        this.arenaActors[role][kind] = actor;
      }
      if (!data && actor) {
        actor.destroy();
        this.arenaActors[role][kind] = null;
        return;
      }
      if (!actor || !data) return;
      this.queueActorAnimation(actor, data, animationJobs);
      actor.setSelected(role === "defender" && data.id === this.snapshot.selectedTargetId);
    }

    syncArena(snapshot) {
      this.presentationQueue.setSpeed(snapshot.combatSpeed || 1);
      const animationJobs = [];
      if (this.lastArenaBattleId !== snapshot.battleId) {
        this.lastArenaBattleId = snapshot.battleId;
        this.lastArenaCueSeq = -1;
      }
      const cues = (Array.isArray(snapshot.animationCues) ? snapshot.animationCues : [])
        .filter(cue => Number(cue?.seq) > this.lastArenaCueSeq);
      if (cues.length) this.lastArenaCueSeq = Math.max(...cues.map(cue => Number(cue.seq) || 0));
      const attacker = this.arenaTeam("attacker");
      const defender = this.arenaTeam("defender");
      this.syncArenaActor("attacker", "hero", attacker?.hero, animationJobs);
      this.syncArenaActor("attacker", "pet", attacker?.pet, animationJobs);
      this.syncArenaActor("defender", "hero", defender?.hero, animationJobs);
      this.syncArenaActor("defender", "pet", defender?.pet, animationJobs);
      this.layoutArenaActors();
      this.enqueueArenaAnimations(animationJobs, cues);
    }

    sync(snapshot) {
      if (!snapshot) return;
      this.snapshot = snapshot;
      if (isArenaPresentationSnapshot(snapshot)) {
        this.syncArena(snapshot);
        return;
      }

      const monsterCount = Math.max(1, Math.min(3, snapshot.monsters?.length || 1));
      this.presentationQueue.setSpeed(snapshot.combatSpeed || 1);
      if (!this.actors.hero) this.createActors();

      const animationJobs = [];
      const heroData = snapshot.hero || {};
      this.queueActorAnimation(this.actors.hero, heroData, animationJobs);

      if (snapshot.pet && !this.actors.pet) this.actors.pet = new PetActor(this, snapshot.pet);
      if (!snapshot.pet && this.actors.pet) { this.actors.pet.destroy(); this.actors.pet = null; }
      this.queueActorAnimation(this.actors.pet, snapshot.pet || null, animationJobs);

      (snapshot.monsters || []).forEach((monster, index) => {
        let actor = this.actors.monsters[index];
        if (!actor) {
          actor = new MonsterActor(this, monster, id => onTargetSelected?.(id));
          this.actors.monsters[index] = actor;
        }
        this.queueActorAnimation(actor, monster, animationJobs);
        actor.setSelected(monster.id === snapshot.selectedTargetId);
      });

      this.actors.monsters.slice(snapshot.monsters?.length || 0).forEach(actor => actor.destroy());
      this.actors.monsters.length = snapshot.monsters?.length || 0;
      this.layoutActors(monsterCount);
      this.enqueueAnimations(animationJobs);
    }

    enqueueAnimations(animationJobs) {
      if (!animationJobs.length) return;
      void this.presentationQueue.enqueue({
        run: speed => Promise.all(animationJobs.map(([actor, state]) =>
          actor.playVisualState(state, speed)
        ))
      });
    }

    arenaActorById(actorId) {
      const key = String(actorId || "");
      return Object.values(this.arenaActors)
        .flatMap(team => Object.values(team))
        .find(actor => String(actor?.data?.id || "") === key) || null;
    }

    enqueueArenaAnimations(animationJobs, cues) {
      if (!animationJobs.length && !cues.length) return;
      void this.presentationQueue.enqueue({
        run: async speed => {
          // The authoritative log is already in speed-queue order. Keep that order
          // for presentation without allowing Phaser to resolve or reorder combat.
          for (const cue of cues) {
            const actor = this.arenaActorById(cue.actorId);
            if (actor) await actor.playVisualState(cue.animation || "attack", speed, { force: true });
          }
          for (const [actor, state] of animationJobs) {
            if (actor) await actor.playVisualState(state, speed);
          }
        }
      });
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

    layoutArenaActors() {
      const width = Math.max(1, this.scale.width || this.game.config.width || 1);
      const height = Math.max(1, this.scale.height || this.game.config.height || 1);
      const layout = responsiveArenaBattlefieldLayout(width, height);
      this.presentationScale = layout.actorScale;
      const actors = [
        this.arenaActors.attacker.hero,
        this.arenaActors.attacker.pet,
        this.arenaActors.defender.hero,
        this.arenaActors.defender.pet
      ].filter(Boolean);
      actors.forEach(actor => actor.refresh(actor.data, { animate: false }));
      this.arenaActors.attacker.hero?.reposition(layout.pixels.attackerHero);
      this.arenaActors.attacker.pet?.reposition(layout.pixels.attackerPet);
      this.arenaActors.defender.hero?.reposition(layout.pixels.defenderHero);
      this.arenaActors.defender.pet?.reposition(layout.pixels.defenderPet);
    }

    handleResize(gameSize) {
      const width = Math.max(1, gameSize?.width || this.scale.width || 1);
      const height = Math.max(1, gameSize?.height || this.scale.height || 1);
      if (isArenaPresentationSnapshot(this.snapshot)) {
        this.layoutArenaActors(width, height);
        return;
      }
      this.layoutActors(this.snapshot?.monsters?.length || 1);
    }

    shutdown() {
      this.scale.off("resize", this.handleResize, this);
      this.presentationQueue?.clear();
      this.vfxManager?.destroy();
      this.vfxManager = null;
      Object.values(this.actors).flatMap(value => Array.isArray(value) ? value : [value]).filter(Boolean).forEach(actor => actor.destroy());
      Object.values(this.arenaActors).flatMap(team => Object.values(team)).filter(Boolean).forEach(actor => actor.destroy());
      this.actors = { hero: null, pet: null, monsters: [] };
      this.arenaActors = {
        attacker: { hero: null, pet: null },
        defender: { hero: null, pet: null }
      };
      if (this.readyNotified) onReady?.({ scene: null, destroyed: true });
    }
  };
}
