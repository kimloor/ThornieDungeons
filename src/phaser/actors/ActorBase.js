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
    this.container.add(this.statusText);
    this.container.add(this.nameText);
    this.selected = false;
    this.visualState = "";
    this.frameIndex = 0;
    this.frameTimer = null;
    this.motionTween = null;
    this.idleTween = null;
    scene.events.once("shutdown", () => this.destroy());
  }

  displaySize() {
    const sizeClassScale = phaserActorSizeClass(this.data.sizeClass);
    const responsiveScale = Math.max(0.82, Math.min(1.15, Number(this.scene?.presentationScale) || 1));
    const base = this.options.baseSize || 128;
    return Math.round(base * sizeClassScale * responsiveScale);
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
      this.sprite.setInteractive({ useHandCursor: !!this.options.onSelect });
      if (this.options.onSelect) this.sprite.on("pointerup", () => this.options.onSelect(this.data.id));
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
    const nextState = state || "idle";
    if (nextState === this.visualState) {
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
          x: this.data.kind === "hero" || this.data.kind === "pet" ? -6 : 6,
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
      const direction = this.data.kind === "monster" || this.data.kind === "boss" ? -10 : 10;
      this.motionTween = this.scene.tweens.add({
        targets: this.visualRoot,
        x: direction,
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
    this.statusText
      .setText((this.data.statuses || []).map(status => `${status.key}:${status.duration}`).join("  "))
      .setVisible(Boolean(this.data.statuses?.length));

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

    this.statusText.setPosition(0, -Math.round(size * 0.72) - 4);
    this.hpTextOffsetY = barY + 10;
    this.hpText.setText(`${hp}/${maxHp}`).setVisible(true);
    const nameY = this.data.kind === "pet" ? 22 : 34;
    this.nameText.setPosition(0, nameY);
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

  reposition(position) {
    this.position = position || this.position || { x: 0, y: 0 };
    this.container.setPosition(this.position.x, this.position.y);
    this.hpBar.setPosition(this.position.x, this.position.y);
    this.hpText?.setPosition(this.position.x, this.position.y + (this.hpTextOffsetY || 0));
  }

  destroy() {
    this.stopAnimationPlayback();
    this.container?.destroy(true);
    this.hpBar?.destroy();
    this.statusText?.destroy();
    this.nameText?.destroy();
    this.hpText?.destroy();
    this.container = null;
    this.visualRoot = null;
    this.sprite = null;
  }
}
