// ---------- floor modifiers & elite boss ----------
const FLOOR_MODIFIERS = [{
  id: "elite_pack",
  name: "Elite Monster",
  icon: "💀",
  color: "#ff5566",
  hpMult: 1.6,
  atkMult: 1.35,
  goldMult: 1.5,
  xpMult: 1.5,
  dropBonusFlat: 15,
  desc: "ศัตรูแข็งแกร่งขึ้นมาก แต่รางวัลคุ้มกว่าเดิม"
}, {
  id: "golden",
  name: "Golden Floor",
  icon: "💰",
  color: "#ffd166",
  goldMult: 2.2,
  desc: "ชั้นนี้ทองหล่นเยอะเป็นพิเศษ"
}, {
  id: "arcane",
  name: "Arcane Surge",
  icon: "✨",
  color: "#8b6ae8",
  xpMult: 2,
  desc: "ได้รับ EXP เพิ่มขึ้นเป็นพิเศษ"
}, {
  id: "treasure",
  name: "Treasure Trove",
  icon: "🎁",
  color: "#4ecb71",
  dropBonusFlat: 35,
  rarityBoost: true,
  desc: "โอกาสดรอปไอเทมสูงขึ้น และมีโอกาสได้ของหายาก"
}, {
  id: "cursed",
  name: "Cursed Mist",
  icon: "☠️",
  color: "#9c9ca8",
  atkMult: 1.55,
  hpMult: 0.8,
  goldMult: 1.35,
  desc: "ศัตรูดุร้ายขึ้นมาก เลือดน้อยลง แต่ให้รางวัลดีขึ้น"
}];
function rollFloorModifier() {
  if (Math.random() >= 0.4) return null; // 60% of normal floors stay plain
  return FLOOR_MODIFIERS[Math.floor(Math.random() * FLOOR_MODIFIERS.length)];
}
const SLOT_ICON = {
  weapon: "⚔️",
  helmet: "🪖",
  chest: "👕",
  gloves: "🧤",
  boots: "🥾",
  accessory: "💍",
  wings: "🪽"
};
const SLOT_LABEL = {
  weapon: "Weapon",
  helmet: "Helmet",
  chest: "Armor",
  gloves: "Gloves",
  boots: "Boots",
  accessory: "Accessory",
  wings: "Wings"
};
// "wings" (ปีก/เครื่องสวมใส่ด้านหลัง) is the 7th equipment slot. Themed around
// evasion/crit utility (rolls from WING_STAT_POOL in stats.js), reusing the existing
// dodgeChance/critChance/critDamage stat keys so itemBonus()/getEquipBonus() need no changes.
// D1 `items.slot_type` is a plain TEXT column (no CHECK constraint), so "wings" values
// are already accepted by the API worker with no schema change needed.
const SLOT_ORDER = ["weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"];
