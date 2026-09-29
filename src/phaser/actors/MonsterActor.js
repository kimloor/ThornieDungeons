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
}
