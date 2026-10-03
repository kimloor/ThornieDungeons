// ---------- W7B Shared Enhance / Craft Presentation Scene ----------
function createForgePresentationScene(Phaser, { initialEvent, onReady, onError } = {}) {
  return class ForgePresentationScene extends Phaser.Scene {
    constructor() {
      super({ key: "ForgePresentationScene" });
      this.initialEvent = initialEvent || null;
      this.lastToken = "";
      this.presentationQueue = createPresentationQueue({ onError });
      this.vfxManager = null;
      this.stage = null;
      this.hammer = null;
      this.title = null;
      this.detail = null;
    }

    create() {
      try {
        this.vfxManager = createVfxManager(this);
        const width = Math.max(1, this.scale.width || 1);
        const height = Math.max(1, this.scale.height || 1);
        this.stage = this.add.container(width / 2, height / 2);
        this.hammer = this.add.text(0, -8, "⚒️", { fontSize: "38px" }).setOrigin(0.5);
        this.title = this.add.text(0, 28, "", { fontFamily: "system-ui, sans-serif", fontSize: "16px", fontStyle: "bold", color: "#ffffff", align: "center" }).setOrigin(0.5);
        this.detail = this.add.text(0, 50, "", { fontFamily: "system-ui, sans-serif", fontSize: "11px", color: "#ffffff", align: "center" }).setOrigin(0.5);
        this.stage.add([this.hammer, this.title, this.detail]);
        this.scale.on("resize", this.handleResize, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
        onReady?.({ scene: this });
        if (this.initialEvent) this.present(this.initialEvent);
      } catch (error) { onError?.(error); }
    }

    handleResize(gameSize) {
      if (!this.stage) return;
      this.stage.setPosition(Math.max(1, gameSize?.width || this.scale.width || 1) / 2, Math.max(1, gameSize?.height || this.scale.height || 1) / 2);
    }

    present(event) {
      if (!event) return Promise.resolve();
      const token = String(event.token || "");
      if (token && token === this.lastToken) return this.presentationQueue.whenDrained();
      this.lastToken = token;
      return this.presentationQueue.enqueue({ run: speed => this.playResolvedEvent(event, speed) });
    }

    playResolvedEvent(event, speed = 1) {
      const kind = String(event.kind || "");
      const outcome = String(event.outcome || "");
      const duration = Math.max(180, Math.round(520 / Math.max(1, Number(speed) || 1)));
      const isCraft = kind === "craft";
      const title = isCraft ? (event.special ? "MYTHIC REVEAL" : "CRAFT COMPLETE") : outcome === "success" ? "ENHANCE SUCCESS" : outcome === "protected" ? "PROTECTED" : outcome === "downgrade" ? "DOWNGRADE" : "ENHANCE FAILED";
      const detail = isCraft ? String(event.itemName || "Crafted item") : String(Number(event.levelBefore) || 0) + " → " + String(Number(event.levelAfter) || 0);

      this.title?.setText(title);
      this.detail?.setText(detail);
      this.hammer?.setText(isCraft ? (event.special ? "✦" : "✨") : "⚒️");
      this.stage?.setAlpha(1);
      this.stage?.setScale(0.86);
      this.cameras?.main?.flash?.(Math.max(90, Math.round(duration * 0.28)));

      return new Promise(resolve => {
        if (!this.tweens?.add || !this.stage) {
          this.time?.delayedCall?.(duration, resolve) || setTimeout(resolve, duration);
          return;
        }
        this.tweens.add({
          targets: this.stage, scaleX: 1.06, scaleY: 1.06, duration: Math.max(90, Math.round(duration * 0.42)), ease: "Back.easeOut", yoyo: true,
          onComplete: () => {
            this.tweens.add({
              targets: this.stage, alpha: 0.72, duration: Math.max(80, Math.round(duration * 0.25)), yoyo: true,
              onComplete: () => { this.stage?.setAlpha(1); this.stage?.setScale(1); resolve(); }
            });
          }
        });
      });
    }

    shutdown() {
      this.scale.off("resize", this.handleResize, this);
      this.presentationQueue?.clear();
      this.vfxManager?.destroy?.();
      this.vfxManager = null;
      this.stage = null;
      this.hammer = null;
      this.title = null;
      this.detail = null;
    }
  };
}
