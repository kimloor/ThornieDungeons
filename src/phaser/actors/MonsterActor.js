// ---------- W5 Monster Actor ----------
class MonsterActor extends PhaserBattleActor {
  constructor(scene, data, onSelect) {
    super(scene, data, {
      baseSize: 106,
      depth: 5,
      onSelect,
      targetRingWidth: 84,
      targetRingHeight: 28
    });
  }

  // Production monster artwork is authored facing left. Keep logical facing
  // for attack/recoil motion, but invert only the visual mirror baseline.
  applyFacing() {
    if (!this.visualRoot) return;
    this.visualRoot.setScale(this.facing() === "left" ? 1 : -1, 1);
  }
}


class RaidBossActor extends MonsterActor {
  hurtVisualState() {
    return this.data?.frames?.hurt?.length ? "hurt" : "idle";
  }

  frameUrlsForState(state) {
    if (state === "hurt" && this.data?.frames?.hurt?.length) return this.data.frames.hurt;
    return super.frameUrlsForState(state);
  }

  async playVisualState(state, speed = 1) {
    if (state !== "hurt" || !this.data?.frames?.hurt?.length) return super.playVisualState(state, speed, arguments[2]);
    this.stopAnimationPlayback();
    this.visualState = "hurt";
    const frameCount = this.visualFrameCount("hurt");
    const delay = Math.max(60, Math.round(105 / Math.max(1, Number(speed) || 1)));
    for (let index = 0; index < frameCount; index += 1) {
      this.applyVisualFrame("hurt", index);
      if (index < frameCount - 1) {
        await new Promise(resolve => this.scene.time.delayedCall(delay, resolve));
      }
    }
    return super.playVisualState("idle", speed, { force: true });
  }
}
