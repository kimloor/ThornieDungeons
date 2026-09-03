// ---------- skills (unlocked every 10 levels, up to level 90 — level cap is 99) ----------
let SKILLS = [{
  key: "power_strike",
  unlockLevel: 10,
  name: "Power Strike",
  icon: "⚔️",
  mp: 10,
  type: "damage",
  mult: 2.0,
  defPierce: 0,
  desc: "ดาเมจกายภาพ 2.0x ATK"
}, {
  key: "fireball",
  unlockLevel: 20,
  name: "Fireball",
  icon: "🔥",
  mp: 14,
  type: "damage",
  mult: 2.4,
  defPierce: 0.3,
  desc: "ดาเมจไฟ 2.4x ATK เจาะเกราะ 30%"
}, {
  key: "healing_light",
  unlockLevel: 30,
  name: "Healing Light",
  icon: "✨",
  mp: 16,
  type: "heal",
  healPct: 0.45,
  desc: "สกิลหมู่: ฟื้นฟู HP 45% ของ HP สูงสุด ให้ทั้งตัวคุณและสัตว์เลี้ยง"
}, {
  key: "war_cry",
  unlockLevel: 40,
  name: "Whirlwind Slash",
  icon: "🌪️",
  mp: 12,
  type: "aoe",
  mult: 1.1,
  defPierce: 0,
  desc: "โจมตีหมู่: ฟันรอบตัวใส่ศัตรูทุกตัว (สูงสุด 3) ดาเมจ 1.1x ATK ต่อเป้าหมาย"
}, {
  key: "ice_lance",
  unlockLevel: 50,
  name: "Ice Lance",
  icon: "❄️",
  mp: 18,
  type: "damage",
  mult: 2.2,
  freezeChance: 0.3,
  freezeTurns: 1,
  desc: "ดาเมจน้ำแข็ง 2.2x ATK · 30% แช่แข็งศัตรู 1 เทิร์น"
}, {
  key: "iron_skin",
  unlockLevel: 60,
  name: "Thunder Wave",
  icon: "⚡",
  mp: 14,
  type: "aoe",
  mult: 1.3,
  defPierce: 0.15,
  desc: "โจมตีหมู่: สายฟ้าใส่ศัตรูทุกตัว (สูงสุด 3) ดาเมจ 1.3x ATK เจาะเกราะ 15%"
}, {
  key: "venom_strike",
  unlockLevel: 70,
  name: "Venom Strike",
  icon: "☠️",
  mp: 16,
  type: "damage",
  mult: 1.6,
  poisonTurns: 3,
  poisonPct: 0.35,
  desc: "ดาเมจ 1.6x ATK + วางยาพิษ 3 เทิร์น"
}, {
  key: "meteor",
  unlockLevel: 80,
  name: "Meteor",
  icon: "☄️",
  mp: 26,
  type: "damage",
  mult: 3.2,
  defPierce: 0.5,
  desc: "ดาเมจมหาศาล 3.2x ATK เจาะเกราะ 50%"
}, {
  key: "dragons_wrath",
  unlockLevel: 90,
  name: "Dragon's Wrath",
  icon: "🐉",
  mp: 30,
  type: "damage",
  mult: 4.0,
  guaranteedCrit: true,
  desc: "ท่าไม้ตาย 4.0x ATK คริติคอลเสมอ"
}];
function unlockedSkills(level) {
  return SKILLS.filter(s => s.unlockLevel <= level);
}

