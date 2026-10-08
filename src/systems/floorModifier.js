// ---------- Dungeon V2 Event modifiers ----------
// Locked contract: Normal-only Event roll, 25% chance, exactly seven uniform Event IDs.
// Boss/Elite floors must never consume an Event roll.
const FLOOR_EVENT_CHANCE = 0.25;
const FLOOR_MODIFIERS = Object.freeze([
  { id: "golden", name: "Golden Floor", icon: "💰", color: "#ffd166", goldMult: 2.2, desc: "ชั้นนี้ทองหล่นเยอะเป็นพิเศษ" },
  { id: "arcane", name: "Arcane Surge", icon: "✨", color: "#8b6ae8", xpMult: 2, desc: "ได้รับ EXP เพิ่มขึ้นเป็นพิเศษ" },
  { id: "treasure", name: "Treasure Trove", icon: "🎁", color: "#4ecb71", dropBonusFlat: 35, rarityBoost: true, desc: "โอกาสดรอปไอเทมสูงขึ้น และมีโอกาสได้ของหายาก" },
  { id: "rage", name: "Rage", icon: "☠️", color: "#9c9ca8", atkMult: 1.55, hpMult: 0.8, goldMult: 1.35, desc: "ศัตรูโจมตีแรงขึ้น แต่มีพลังชีวิตลดลงและให้ทองเพิ่ม" },
  { id: "rush", name: "Rush", icon: "💨", color: "#5bb7ff", speedMult: 2, desc: "Monster Speed ×2" },
  { id: "oasis", name: "Oasis", icon: "💧", color: "#3fd0c9", turnHealPct: 0.05, desc: "ทุก Turn ฟื้น HP 5% ของ Max HP" },
  { id: "toxic", name: "Toxic", icon: "☣️", color: "#8fd14f", poisonDamagePct: 0.05, poisonDuration: 3, desc: "Hero ติด Poison 5% Max HP ต่อ Tick" }
]);
const FLOOR_EVENT_IDS = Object.freeze(FLOOR_MODIFIERS.map(entry => entry.id));
function floorModifierById(id) { return FLOOR_MODIFIERS.find(entry => entry.id === String(id || "")) || null; }
function floorModifierSpeed(baseSpeed, modifier) {
  const mult = Number(modifier?.speedMult);
  return Math.max(0, Number(baseSpeed) || 0) * (Number.isFinite(mult) && mult > 0 ? mult : 1);
}
function applyFloorModifierMultiplier(value, modifier, key) {
  const mult = Number(modifier?.[key]);
  return Math.round((Number(value) || 0) * (Number.isFinite(mult) && mult > 0 ? mult : 1));
}
function rollFloorModifier(rng = Math.random) {
  const chanceRoll = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
  if (chanceRoll >= FLOOR_EVENT_CHANCE) return null;
  const pickRoll = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
  return FLOOR_MODIFIERS[Math.min(FLOOR_MODIFIERS.length - 1, Math.floor(pickRoll * FLOOR_MODIFIERS.length))] || null;
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
