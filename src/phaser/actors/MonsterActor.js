// ---------- W5 Monster Actor ----------
class MonsterActor extends PhaserBattleActor {
  constructor(scene, data, onSelect) {
    super(scene, data, { baseSize: 106, depth: 5, onSelect });
    this.targetRing = scene.add.ellipse(0, 0, 84, 28, 0x8ee0ff, 0.08).setStrokeStyle(2, 0xffd166, 0.95).setDepth(4);
    scene.events.once("shutdown", () => this.targetRing?.destroy());
  }

  refresh(data, options = {}) {
    super.refresh(data, options);
    this.targetRing.setVisible(Boolean(this.selected && this.data.alive));
    const responsiveScale = Math.max(0.82, Math.min(1.15, Number(this.scene?.presentationScale) || 1));
    this.targetRing.setDisplaySize(84 * responsiveScale, 28 * responsiveScale);
    this.targetRing.setPosition(this.position?.x || 0, (this.position?.y || 0) + 4);
  }

  setSelected(selected) {
    this.selected = !!selected;
    this.targetRing?.setVisible(this.selected && this.data.alive);
  }

  destroy() {
    this.targetRing?.destroy();
    super.destroy();
  }
}
