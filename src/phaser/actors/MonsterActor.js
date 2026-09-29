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
