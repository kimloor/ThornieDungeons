// ---------- W5 Phaser Actor Helpers ----------
function phaserActorSizeClass(sizeClass) {
  return { small: 0.82, medium: 1, large: 1.18, elite: 1.38 }[sizeClass] || 1;
}

function phaserTextResolution() {
  const ratio = typeof globalThis !== "undefined"
    ? Number(globalThis.devicePixelRatio) || 1
    : 1;
  return Math.max(1, Math.min(3, ratio));
}

function phaserActorFacing(data = {}) {
  if (data.facing === "left" || data.facing === "right") return data.facing;
  return ["monster", "boss", "raid_boss"].includes(String(data.kind || "")) ? "left" : "right";
}

class PhaserBattleActor {
  constructor(scene, data, options = {}) {
    this.scene = scene;
    this.data = data || {};
    this.options = options;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(options.depth || 5);
    this.visualRoot = scene.add.container(0, 0);
    this.container.add(this.visualRoot);
    this.sprite = null;
    this.hpBar = scene.add.graphics().setDepth(2);
    const textResolution = phaserTextResolution();
    this.statusText = scene.add.text(0, 0, "", {
      color: "#ffffff", fontFamily: "Arial", fontSize: "10px", fontStyle: "bold",
      stroke: "#071126", strokeThickness: 2, align: "center"
    }).setOrigin(0.5, 1).setDepth((options.depth || 5) + 3).setResolution(textResolution);
    // HP is intentionally behind every actor sprite. The label stays readable when
    // no sprite occupies the same ground lane but never paints over a character.
    this.hpText = scene.add.text(0, 0, "", {
      color: "#ffffff", fontFamily: "Arial", fontSize: "9px", fontStyle: "bold",
      stroke: "#071126", strokeThickness: 2, align: "center"
    }).setOrigin(0.5, 0).setDepth(3).setResolution(textResolution);
    this.nameText = scene.add.text(0, 0, String(this.data.name || "Unit"), {
      color: "#fff1ad", fontFamily: "Arial", fontSize: "10px", fontStyle: "bold",
      stroke: "#071126", strokeThickness: 2, align: "center"
    }).setOrigin(0.5, 0).setDepth((options.depth || 5) + 3).setResolution(textResolution);
    this.statusText.setVisible(false);
    this.statusIcons = scene.add.container(0, 0).setDepth((options.depth || 5) + 3);
    this.container.add(this.statusIcons);
    this.container.add(this.statusText);
    this.container.add(this.nameText);
    this.targetRing = null;
    this.hitArea = null;
    this.selected = false;
    this.visualState = "";
    this.frameIndex = 0;
    this.frameTimer = null;
    this.motionTween = null;
    this.idleTween = null;
    this.destroyed = false;
    this.createTargetingPresentation();
    this.applyFacing();
    this.handleSceneShutdown = () => this.destroy();
    scene.events.once("shutdown", this.handleSceneShutdown);
  }

  displaySize() {
    const sizeClassScale = phaserActorSizeClass(this.data.sizeClass);
    const responsiveScale = Math.max(0.82, Math.min(1.15, Number(this.scene?.presentationScale) || 1));
    const base = this.options.baseSize || 128;
    return Math.round(base * sizeClassScale * responsiveScale);
  }

  facing() {
    return phaserActorFacing(this.data);
  }

  facingSign() {
    return this.facing() === "left" ? -1 : 1;
  }

  applyFacing() {
    if (!this.visualRoot) return;
    this.visualRoot.setScale(this.facingSign(), 1);
  }

  createTargetingPresentation() {
    if (typeof this.options.onSelect !== "function") return;
    const depth = Number(this.options.depth) || 5;
    this.targetRing = this.scene.add.ellipse(0, 0, 84, 28, 0x8ee0ff, 0.08)
      .setStrokeStyle(2, 0xffd166, 0.95)
      .setDepth(Math.max(0, depth - 1))
      .setVisible(false);
    this.hitArea = this.scene.add.zone(0, 0, 1, 1)
      .setOrigin(0.5, 1)
      .setDepth(depth + 4)
      .setInteractive({ useHandCursor: true });
    this.hitArea.on("pointerup", () => {
      if (this.data?.alive !== false && Number(this.data?.hp) > 0) this.options.onSelect(this.data.id);
    });
  }

  refreshTargetingPresentation() {
    if (!this.targetRing && !this.hitArea) return;
    const size = this.displaySize();
    const alive = this.data.alive !== false && Number(this.data.hp) > 0;
    const responsiveScale = Math.max(0.82, Math.min(1.15, Number(this.scene?.presentationScale) || 1));
    const ringWidth = (Number(this.options.targetRingWidth) || Math.max(72, Math.min(112, size * 0.64))) * responsiveScale;
    const ringHeight = (Number(this.options.targetRingHeight) || 28) * responsiveScale;
    const x = this.position?.x || 0;
    const y = this.position?.y || 0;
    this.targetRing
      ?.setDisplaySize(ringWidth, ringHeight)
      .setPosition(x, y + 4)
      .setVisible(Boolean(this.selected && alive));
    this.hitArea
      ?.setPosition(x, y)
      .setSize(Math.max(54, size * 0.78), Math.max(64, size * 0.96))
      .setVisible(alive);
  }

  setSelected(selected) {
    this.selected = !!selected;
    this.refreshTargetingPresentation();
  }

  desiredVisualState(data = this.data) {
    const alive = data?.alive !== false && Number(data?.hp) > 0;
    if (!alive || data?.anim === "death") return "death";
    if (data?.anim === "attack") return "attack";
    if (data?.anim === "hurt") return "hurt";
    return "idle";
  }

  hurtVisualState() {
    return "idle";
  }

  frameDelayForState(state) {
    if (state === "idle") return 220;
    if (state === "attack") return 150;
    return 180;
  }

  frameUrlsForState(state) {
    if (state === "death" && this.data.frames?.death?.length) return this.data.frames.death;
    if (state === "attack" && this.data.frames?.attack?.length) return this.data.frames.attack;
    return this.data.frames?.idle || [];
  }

  visualFrameCount(state) {
    return Math.max(1, this.frameUrlsForState(state).length || 1);
  }

  applyVisualFrame(state, index = 0) {
    const frames = this.frameUrlsForState(state);
    const url = frames[Math.min(Math.max(0, index), Math.max(0, frames.length - 1))] || frames[0] || "";
    const key = url ? this.scene.assetKey(url) : "";
    if (!key || !this.scene.textures.exists(key)) return;
    const size = this.displaySize();
    if (!this.sprite) {
      this.sprite = this.scene.add.image(0, 0, key).setOrigin(0.5, 1);
      this.visualRoot.add(this.sprite);
    } else if (this.sprite.texture.key !== key) {
      this.sprite.setTexture(key);
    }
    this.sprite.setDisplaySize(size, size);
  }

  setVisualAlpha(value) {
    this.visualRoot?.setAlpha(value);
  }

  stopAnimationPlayback() {
    this.frameTimer?.remove(false);
    this.frameTimer = null;
    this.motionTween?.stop();
    this.motionTween = null;
    this.idleTween?.stop();
    this.idleTween = null;
    if (this.visualRoot) {
      this.visualRoot.x = 0;
      this.visualRoot.y = 0;
      this.visualRoot.setAlpha(1);
      this.applyFacing();
    }
  }

  startIdleFallback(speed = 1) {
    if (!this.visualRoot || this.visualFrameCount("idle") > 1) return;
    this.idleTween = this.scene.tweens.add({
      targets: this.visualRoot,
      y: -3,
      duration: Math.max(280, Math.round(700 / Math.max(1, speed))),
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  playVisualState(state, speed = 1) {
    const force = arguments[2]?.force === true;
    const nextState = state || "idle";
    if (!force && nextState === this.visualState) {
      if (nextState === "idle" && !this.frameTimer && !this.idleTween) this.startIdleFallback(speed);
      return Promise.resolve();
    }

    this.stopAnimationPlayback();
    this.visualState = nextState;
    this.frameIndex = 0;
    const effectiveFrameState = nextState === "hurt" ? this.hurtVisualState() : nextState;
    const frameCount = this.visualFrameCount(effectiveFrameState);
    this.applyVisualFrame(effectiveFrameState, 0);

    if (nextState === "hurt") {
      const duration = Math.max(55, Math.round(90 / Math.max(1, speed)));
      return new Promise(resolve => {
        this.setVisualAlpha(0.62);
        this.motionTween = this.scene.tweens.add({
          targets: this.visualRoot,
          x: -this.facingSign() * 6,
          duration,
          yoyo: true,
          repeat: 1,
          ease: "Sine.easeInOut",
          onComplete: () => {
            this.visualRoot.x = 0;
            this.setVisualAlpha(1);
            resolve();
          }
        });
      });
    }

    if (nextState === "idle") {
      if (frameCount > 1) {
        const delay = Math.max(80, Math.round(this.frameDelayForState("idle") / Math.max(1, speed)));
        this.frameTimer = this.scene.time.addEvent({
          delay,
          loop: true,
          callback: () => {
            this.frameIndex = (this.frameIndex + 1) % frameCount;
            this.applyVisualFrame("idle", this.frameIndex);
          }
        });
      } else {
        this.startIdleFallback(speed);
      }
      return Promise.resolve();
    }

    const frameDelay = Math.max(
      70,
      Math.round(this.frameDelayForState(nextState) / Math.max(1, speed))
    );

    if (nextState === "attack") {
      this.motionTween = this.scene.tweens.add({
        targets: this.visualRoot,
        x: this.facingSign() * 10,
        duration: Math.max(55, Math.round(95 / Math.max(1, speed))),
        yoyo: true,
        ease: "Quad.easeOut"
      });
    }

    if (nextState === "death") this.setVisualAlpha(0.72);
    if (frameCount <= 1) return Promise.resolve();

    return new Promise(resolve => {
      let completed = false;
      this.frameTimer = this.scene.time.addEvent({
        delay: frameDelay,
        repeat: frameCount - 2,
        callback: () => {
          this.frameIndex = Math.min(frameCount - 1, this.frameIndex + 1);
          this.applyVisualFrame(effectiveFrameState, this.frameIndex);
          if (this.frameIndex >= frameCount - 1 && !completed) {
            completed = true;
            resolve();
          }
        }
      });
    });
  }

  refreshHud() {
    const size = this.displaySize();
    const alive = this.data.alive !== false && Number(this.data.hp) > 0;
    this.nameText.setText(String(this.data.name || this.data.id || "Unit")).setVisible(true);
    this.statusText.setVisible(false);
    this.statusIcons.removeAll(true);
    const statusIconMap = {
      atk_up: "ui/skill-icons/hero/power_strike.png",
      def_up: "ui/skill-icons/hero/guard.png",
      armor_break: "ui/skill-icons/hero/armor_break_mastery.png",
      pet_regrowth: "ui/skill-icons/hero/recovery.png",
      regen: "ui/skill-icons/hero/recovery.png",
      poison: "ui/skill-icons/hero/toxic_strike.png",
      stun: "ui/skill-icons/hero/stunning_blow.png",
      silence: "ui/skill-icons/hero/silent_edge.png"
    };
    const visibleStatuses = (this.data.statuses || [])
      .filter(status => statusIconMap[status?.key] && Number(status?.duration) > 0);
    visibleStatuses.forEach((status, index) => {
      const iconKey = this.scene.assetKey(statusIconMap[status.key]);
      const item = this.scene.add.container(0, 0);
      if (iconKey && this.scene.textures.exists(iconKey)) {
        item.add(this.scene.add.image(0, 0, iconKey).setDisplaySize(22, 22).setOrigin(0.5));
      } else {
        const fallback = this.scene.add.graphics();
        fallback.fillStyle(status.key === "armor_break" ? 0xc76a6a : status.key === "pet_regrowth" ? 0x55d68b : 0x6fb9ff, 1);
        fallback.fillCircle(0, 0, 9);
        item.add(fallback);
      }
      const duration = this.scene.add.text(8, 8, String(Math.max(0, Number(status.duration) || 0)), {
        color: "#ffffff", fontFamily: "Arial", fontSize: "8px", fontStyle: "bold",
        stroke: "#071126", strokeThickness: 2, align: "center"
      }).setOrigin(0.5).setResolution(phaserTextResolution());
      item.add(duration);
      item.x = (index - (visibleStatuses.length - 1) / 2) * 26;
      this.statusIcons.add(item);
    });

    this.hpBar.clear();
    const maxHp = Math.max(1, Number(this.data.maxHp) || 1);
    const hp = Math.max(0, Math.min(maxHp, Number(this.data.hp) || 0));
    const hpPct = hp / maxHp;
    const barWidth = Math.max(54, Math.min(112, size * 0.78));
    const barY = this.data.kind === "pet" ? 2 : 14;
    this.hpBar.fillStyle(0x071126, 0.82).fillRoundedRect(-barWidth / 2, barY, barWidth, 8, 4);
    this.hpBar.fillStyle(alive ? 0x55d68b : 0x8c93a3, 1)
      .fillRoundedRect(-barWidth / 2 + 1, barY + 1, Math.max(0, (barWidth - 2) * hpPct), 6, 3);
    this.hpBar.lineStyle(1, 0xffffff, 0.35).strokeRoundedRect(-barWidth / 2, barY, barWidth, 8, 4);

    this.statusIcons.setPosition(0, -Math.round(size * 0.72) - 4);
    this.hpTextOffsetY = barY + 10;
    this.hpText.setText(`${hp}/${maxHp}`).setVisible(true);
    const nameY = this.data.kind === "pet" ? 22 : 34;
    this.nameText.setPosition(0, nameY);
    this.refreshTargetingPresentation();
  }

  refresh(data, { animate = true } = {}) {
    this.data = { ...this.data, ...(data || {}) };
    this.applyFacing();
    const state = this.desiredVisualState();
    const displayedState = animate || !this.visualState ? state : this.visualState;
    this.applyVisualFrame(displayedState === "hurt" ? "idle" : displayedState, this.frameIndex);
    this.setVisualAlpha(displayedState === "death" ? 0.72 : 1);
    this.refreshHud();
    this.reposition(this.position || { x: 0, y: 0 });
    if (animate) return this.playVisualState(state, this.data.combatSpeed || 1);
    return Promise.resolve();
  }

  reposition(position) {
    this.position = position || this.position || { x: 0, y: 0 };
    this.container.setPosition(this.position.x, this.position.y);
    this.hpBar.setPosition(this.position.x, this.position.y);
    this.hpText?.setPosition(this.position.x, this.position.y + (this.hpTextOffsetY || 0));
    this.refreshTargetingPresentation();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopAnimationPlayback();
    this.scene?.events?.off("shutdown", this.handleSceneShutdown);

    // statusText/nameText/visualRoot/sprite are children of container and are
    // destroyed by container.destroy(true). Destroying them again can throw
    // inside Phaser during scene teardown.
    const container = this.container;
    const hpBar = this.hpBar;
    const hpText = this.hpText;
    const targetRing = this.targetRing;
    const hitArea = this.hitArea;

    this.container = null;
    this.visualRoot = null;
    this.sprite = null;
    this.hpBar = null;
    this.statusText = null;
    this.statusIcons = null;
    this.nameText = null;
    this.hpText = null;
    this.targetRing = null;
    this.hitArea = null;
    this.handleSceneShutdown = null;

    container?.destroy(true);
    hpBar?.destroy();
    hpText?.destroy();
    targetRing?.destroy();
    hitArea?.destroy();
    this.scene = null;
  }
}
