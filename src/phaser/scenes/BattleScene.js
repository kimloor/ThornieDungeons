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
      this.lastArenaDamageFeedbackSeq = -1;
      this.lastArenaBattleId = null;
      this.lastDungeonBattleId = null;
      this.lastDungeonDamageFeedbackSeq = -1;
      this.activeDamagePopups = new Set();
      this.lastDungeonEnrageByActor = new Map();
      this.lastTerminalPresentationKey = "";
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
      [
        "ui/skill-icons/hero/power_strike.png",
        "ui/skill-icons/hero/guard.png",
        "ui/skill-icons/hero/armor_break_mastery.png",
        "ui/skill-icons/hero/recovery.png",
        "ui/skill-icons/hero/toxic_strike.png",
        "ui/skill-icons/hero/stunning_blow.png",
        "ui/skill-icons/hero/silent_edge.png"
      ].forEach(reference => assets.push(reference));
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
      const isFirstSnapshot = this.lastArenaBattleId !== snapshot.battleId;
      if (isFirstSnapshot) {
        this.lastArenaBattleId = snapshot.battleId;
      }
      const allCues = (Array.isArray(snapshot.animationCues) ? snapshot.animationCues : [])
        .filter(cue => Number.isFinite(Number(cue?.seq)));
      const cues = (isFirstSnapshot ? [] : allCues)
        .filter(cue => Number(cue?.seq) > this.lastArenaCueSeq);
      if (isFirstSnapshot) {
        // A first snapshot may include the authoritative historical log on
        // resume. Establish a baseline without replaying old presentation.
        this.lastArenaCueSeq = allCues.reduce((max, cue) => Math.max(max, Number(cue.seq)), -1);
      }
      if (cues.length) this.lastArenaCueSeq = Math.max(...cues.map(cue => Number(cue.seq) || 0));
      const feedback = (Array.isArray(snapshot.damageFeedbackEvents) ? snapshot.damageFeedbackEvents : [])
        .filter(event => Number.isFinite(Number(event?.seq)));
      let damageFeedbackEvents = [];
      if (isFirstSnapshot) {
        // Arena commonly resolves the full match before its first rendered snapshot.
        // Play that fresh match's log instead of treating it as resumed history.
        damageFeedbackEvents = feedback.slice().sort((a, b) => Number(a.seq) - Number(b.seq));
        this.lastArenaDamageFeedbackSeq = feedback.reduce((max, event) => Math.max(max, Number(event.seq)), -1);
      } else {
        damageFeedbackEvents = feedback
          .filter(event => Number(event.seq) > this.lastArenaDamageFeedbackSeq)
          .sort((a, b) => Number(a.seq) - Number(b.seq));
        if (damageFeedbackEvents.length) {
          this.lastArenaDamageFeedbackSeq = Math.max(...damageFeedbackEvents.map(event => Number(event.seq)));
        }
      }
      const attacker = this.arenaTeam("attacker");
      const defender = this.arenaTeam("defender");
      this.syncArenaActor("attacker", "hero", attacker?.hero, animationJobs);
      this.syncArenaActor("attacker", "pet", attacker?.pet, animationJobs);
      this.syncArenaActor("defender", "hero", defender?.hero, animationJobs);
      this.syncArenaActor("defender", "pet", defender?.pet, animationJobs);
      this.layoutArenaActors();
      this.enqueueArenaAnimations(animationJobs, cues);
      this.enqueueDamageFeedbackEvents(damageFeedbackEvents);
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

      const isFirstDungeonSnapshot = this.lastDungeonBattleId !== snapshot.battleId;
      if (isFirstDungeonSnapshot) {
        this.lastDungeonBattleId = snapshot.battleId;
        this.lastDungeonEnrageByActor.clear();
      }

      const feedback = (Array.isArray(snapshot.damageFeedbackEvents) ? snapshot.damageFeedbackEvents : [])
        .filter(event => Number.isFinite(Number(event?.seq)));
      let damageFeedbackEvents = [];
      if (isFirstDungeonSnapshot) {
        this.lastDungeonDamageFeedbackSeq = feedback.reduce((max, event) => Math.max(max, Number(event.seq)), -1);
      } else {
        damageFeedbackEvents = feedback
          .filter(event => Number(event.seq) > this.lastDungeonDamageFeedbackSeq)
          .sort((a, b) => Number(a.seq) - Number(b.seq));
        if (damageFeedbackEvents.length) {
          this.lastDungeonDamageFeedbackSeq = Math.max(...damageFeedbackEvents.map(event => Number(event.seq)));
        }
      }

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
      this.enqueueDungeonPresentationCues(snapshot, isFirstDungeonSnapshot);
      this.enqueueAnimations(animationJobs);
      this.enqueueDamageFeedbackEvents(damageFeedbackEvents);
    }

    actorById(actorId) {
      const key = String(actorId || "");
      if (isArenaPresentationSnapshot(this.snapshot)) return this.arenaActorById(key);
      const actors = [this.actors.hero, this.actors.pet, ...(this.actors.monsters || [])];
      return actors.find(actor => String(actor?.data?.id || "") === key) || null;
    }

    showDamagePopup(event, speed, offsetIndex = 0) {
      const actor = this.actorById(event?.targetId);
      if (!actor || !this.add?.container || !this.add?.text) return Promise.resolve(false);
      const type = String(event.type || "");
      const critical = type === "damage" && event.crit === true;
      const isHeal = type === "heal";
      const isMiss = type === "miss";
      const isBlock = type === "block";
      const amount = Math.max(0, Math.round(Number(event.amount) || 0));
      const label = isMiss ? "MISS" : isBlock ? "BLOCK" : (isHeal ? "+" : "") + amount.toLocaleString("en-US");
      const size = Math.max(18, Math.min(34, (critical ? 29 : 23) * (this.presentationScale || 1)));
      const position = actor.position || { x: 0, y: 0 };
      const actorSize = typeof actor.displaySize === "function" ? actor.displaySize() : 100;
      const x = Number(position.x) + ((offsetIndex % 3) - 1) * 19;
      const y = Number(position.y) - actorSize * 0.72 - Math.floor(offsetIndex / 3) * 12;
      const popup = this.add.container(x, y).setDepth(7);
      if (critical) {
        const burst = this.add.star(0, 0, 8, size * 0.76, size * 1.28, 0xff283b, 0.3)
          .setStrokeStyle(2, 0xff283b, 1);
        popup.add(burst);
      }
      const color = critical ? "#ff3548" : isHeal ? "#55f09a" : isMiss ? "#d4d8e2" : isBlock ? "#71d7ff" : "#ffffff";
      const stroke = critical ? "#650813" : "#071126";
      const text = this.add.text(0, 0, label, {
        color, fontFamily: "Arial", fontSize: String(Math.round(size)) + "px", fontStyle: "bold",
        stroke, strokeThickness: critical ? 5 : 4, align: "center"
      }).setOrigin(0.5).setResolution(phaserTextResolution());
      popup.add(text);
      if (critical) popup.setScale(0.78);
      this.activeDamagePopups.add(popup);
      // Give Critical and Heal extra reading time; normal feedback keeps its original lifetime.
      const baseDuration = critical || isHeal ? 1440 : 820;
      const duration = Math.max(350, Math.round(baseDuration / Math.max(1, Number(speed) || 1)));
      return new Promise(resolve => {
        if (!this.tweens?.add) {
          popup.destroy(true);
          this.activeDamagePopups.delete(popup);
          resolve(true);
          return;
        }
        this.tweens.add({
          targets: popup,
          y: y - Math.max(28, actorSize * 0.22),
          alpha: 0,
          scale: critical ? 1.12 : 1.04,
          duration,
          ease: "Cubic.easeOut",
          onComplete: () => {
            this.activeDamagePopups.delete(popup);
            popup.destroy(true);
            resolve(true);
          }
        });
      });
    }

    enqueueDamageFeedbackEvents(events) {
      if (!Array.isArray(events) || !events.length) return;
      // Feedback runs alongside the action animation; it must never occupy the
      // authoritative presentation queue or delay the next resolved turn.
      const speed = this.presentationQueue.getSpeed();
      void Promise.all(events.map((event, index) => this.showDamagePopup(event, speed, index)))
        .catch(error => onError?.(error));
    }

    enqueueDungeonPresentationCues(snapshot, isFirstDungeonSnapshot) {
      const bosses = (snapshot.monsters || [])
        .map((monster, index) => ({ monster, actor: this.actors.monsters[index] }))
        .filter(entry => entry.actor && (entry.monster?.kind === "boss" || entry.monster?.isBoss));

      if (isFirstDungeonSnapshot) {
        bosses.forEach(({ monster }) => {
          this.lastDungeonEnrageByActor.set(String(monster.id || ""), !!monster.enraged);
        });

        if (Number(snapshot.seq) <= 0 && bosses.length) {
          void this.presentationQueue.enqueue({
            run: speed => Promise.all(bosses.map(({ actor }) => new Promise(resolve => {
              const duration = Math.max(180, Math.round(420 / Math.max(1, Number(speed) || 1)));
              actor.setVisualAlpha?.(0);
              this.cameras?.main?.flash?.(Math.max(100, Math.round(duration * 0.45)));
              if (!this.tweens?.add || !actor.visualRoot) {
                actor.setVisualAlpha?.(1);
                resolve();
                return;
              }
              this.tweens.add({
                targets: actor.visualRoot,
                alpha: 1,
                duration,
                ease: "Quad.easeOut",
                onComplete: () => {
                  actor.setVisualAlpha?.(1);
                  resolve();
                }
              });
            })))
          });
        }
        return;
      }

      const newlyEnraged = [];
      bosses.forEach(({ monster, actor }) => {
        const key = String(monster.id || "");
        const previous = this.lastDungeonEnrageByActor.get(key) === true;
        const current = !!monster.enraged;
        if (!previous && current) newlyEnraged.push(actor);
        this.lastDungeonEnrageByActor.set(key, current);
      });

      if (!newlyEnraged.length) return;
      void this.presentationQueue.enqueue({
        run: speed => Promise.all(newlyEnraged.map(actor => new Promise(resolve => {
          const duration = Math.max(160, Math.round(360 / Math.max(1, Number(speed) || 1)));
          this.cameras?.main?.shake?.(duration, 0.004);
          if (!this.tweens?.add || !actor.visualRoot) {
            actor.setVisualAlpha?.(1);
            resolve();
            return;
          }
          this.tweens.add({
            targets: actor.visualRoot,
            alpha: 0.55,
            duration: Math.max(70, Math.round(duration / 2)),
            yoyo: true,
            repeat: 1,
            ease: "Sine.easeInOut",
            onComplete: () => {
              actor.setVisualAlpha?.(1);
              resolve();
            }
          });
        })))
      });
    }

    enqueueAnimations(animationJobs) {
      if (!animationJobs.length) return;
      void this.presentationQueue.enqueue({
        run: speed => Promise.all(animationJobs.map(([actor, state]) =>
          actor.playVisualState(state, speed)
        ))
      });
    }

    presentTerminal(result) {
      if (isArenaPresentationSnapshot(this.snapshot)) return Promise.resolve();
      const normalized = String(result || "");
      if (!["victory", "defeat"].includes(normalized)) return this.presentationQueue.whenDrained();
      const key = `${String(this.snapshot?.battleId || "")}:${normalized}`;
      if (this.lastTerminalPresentationKey === key) return this.presentationQueue.whenDrained();
      this.lastTerminalPresentationKey = key;
      return this.presentationQueue.enqueue({
        run: speed => new Promise(resolve => {
          const duration = Math.max(120, Math.round(240 / Math.max(1, Number(speed) || 1)));
          // Victory already has the actor/VFX terminal presentation. A full-camera white
          // flash here obscures the final frame immediately before the result confirmation UI.
          if (normalized === "defeat") this.cameras?.main?.fade?.(duration);
          this.time.delayedCall(duration, resolve);
        })
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
      this.lastDungeonBattleId = null;
      this.lastDungeonDamageFeedbackSeq = -1;
      this.lastArenaDamageFeedbackSeq = -1;
      this.lastDungeonEnrageByActor.clear();
      this.activeDamagePopups.forEach(popup => popup?.destroy?.(true));
      this.activeDamagePopups.clear();
      if (this.readyNotified) onReady?.({ scene: null, destroyed: true });
    }
  };
}


function createRaidBossScene(Phaser, { initialSnapshot, onReady, onError, onHurtComplete } = {}) {
  return class RaidBossScene extends Phaser.Scene {
    constructor() {
      super({ key: "RaidBossScene" });
      this.snapshot = initialSnapshot || null;
      this.actor = null;
      this.textureRegistry = createPhaserTextureRegistry({ resolver: SHARED_PHASER_ASSET_RESOLVER });
      this.presentationQueue = createPresentationQueue({ onError });
      this.vfxManager = createVfxManager(this, { assetResolver: SHARED_PHASER_ASSET_RESOLVER, textureRegistry: this.textureRegistry });
      this.lastHurtToken = Math.max(0, Number(initialSnapshot?.hurtToken) || 0);
      this.handleResize = this.handleResize.bind(this);
    }

    assetKey(reference) {
      // Raid reuses PhaserBattleActor, which resolves sprite frames through the
      // same scene compatibility surface as the shared BattleScene.
      return this.textureRegistry.keyFor(reference);
    }

    preload() {
      const frames = this.snapshot?.boss?.frames || {};
      this.textureRegistry.queue(this, SHARED_PHASER_ASSET_RESOLVER.resolveAll([
        ...(frames.idle || []), ...(frames.hurt || [])
      ]));
      this.load.on("loaderror", file => { if (file?.key) this.textureRegistry.forget(file.key); });
    }

    create() {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
      this.scale.on("resize", this.handleResize, this);
      try {
        this.actor = new RaidBossActor(this, this.snapshot?.boss || {});
        this.layout();
        void this.actor.playVisualState("idle", 1);
        onReady?.({ scene: this });
      } catch (error) { onError?.(error); }
    }

    layout() {
      if (!this.actor) return;
      const width = Math.max(1, this.scale.width || this.game.config.width || 1);
      const height = Math.max(1, this.scale.height || this.game.config.height || 1);
      this.presentationScale = Math.max(0.9, Math.min(1.2, width / 420));
      this.actor.refresh(this.actor.data, { animate: false });
      this.actor.reposition({ x: width * 0.5, y: height * 0.92 });
    }

    sync(snapshot) {
      if (!snapshot) return;
      this.snapshot = snapshot;
      this.actor?.refresh(snapshot.boss || {}, { animate: false });
      this.layout();
      const token = Math.max(0, Number(snapshot.hurtToken) || 0);
      if (token <= this.lastHurtToken) return;
      this.lastHurtToken = token;
      void this.presentationQueue.enqueue({
        run: async speed => {
          const duration = Math.max(90, Math.round(160 / Math.max(1, Number(speed) || 1)));
          this.cameras?.main?.shake?.(duration, 0.004);
          await this.actor?.playVisualState("hurt", speed, { force: true });
          onHurtComplete?.(token);
        }
      });
    }

    handleResize() { this.layout(); }

    shutdown() {
      this.scale.off("resize", this.handleResize, this);
      this.presentationQueue?.clear();
      this.vfxManager?.destroy();
      this.actor?.destroy();
      this.actor = null;
      onReady?.({ scene: null, destroyed: true });
    }
  };
}
