// ---------- game data ----------
const MAX_LEVEL = 99;
const STAT_POINTS_PER_LEVEL = 5;
const STAT_INFO = [{
  key: "str",
  label: "STR",
  icon: "💪",
  desc: "+3 ATK ต่อแต้ม"
}, {
  key: "vit",
  label: "VIT",
  icon: "❤️",
  desc: "+12 HP สูงสุด, +DEF เล็กน้อย"
}, {
  key: "agi",
  label: "AGI",
  icon: "🌀",
  desc: "เพิ่ม Speed (ลำดับการออกอาวุธ) และ Evasion"
}, {
  key: "dex",
  label: "DEX",
  icon: "🎯",
  desc: "+ATK เล็กน้อย, เพิ่มโอกาสโจมตีโดน (Hit Rate)"
}, {
  key: "luk",
  label: "LUK",
  icon: "🍀",
  desc: "เพิ่มโอกาสคริติคอล และไอเทมดรอป"
}];
// Base speed value before AGI is applied — shared by player, pets, and monsters.
const BASE_SPEED = 10;

