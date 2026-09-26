// ---------- W5 Pet Actor ----------
class PetActor extends PhaserBattleActor {
  constructor(scene, data) {
    // Pet stands in the foreground lane. Keep its sprite above the Hero HUD when
    // narrow screens make the two lanes overlap visually.
    super(scene, data, { baseSize: 118, depth: 8 });
  }
}
