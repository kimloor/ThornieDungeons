// ---------- materials, enhancement (ตีบวก) & empowerment (เสริมพลัง) ----------
const MATERIAL_INFO = {
  iron: {
    name: "เหล็ก",
    icon: "🔩"
  },
  silver: {
    name: "เงิน",
    icon: "🥈"
  },
  manaOre: {
    name: "แร่มานา",
    icon: "🔮"
  }
};
const ENHANCE_MAX = 10;
const ENHANCE_RATE_TABLE = [95, 90, 82, 72, 60, 48, 36, 25, 16, 10];
function enhanceSuccessRate(level) {
  return ENHANCE_RATE_TABLE[Math.min(level, ENHANCE_RATE_TABLE.length - 1)];
}
function enhanceCost(level) {
  return {
    iron: 3 + level * 3,
    silver: 2 + level * 2,
    gold: 20 + level * 25
  };
}
const ENHANCE_STAT_PCT = 0.06; // each successful +1 adds 6% of the item's base stat
const EMPOWER_POOL = [{
  key: "atkPct",
  label: "ATK",
  icon: "⚔️",
  unit: 0.03
}, {
  key: "defPct",
  label: "DEF",
  icon: "🛡️",
  unit: 0.03
}, {
  key: "critChance",
  label: "Crit",
  icon: "💥",
  unit: 1.2
}, {
  key: "accuracy",
  label: "Accuracy",
  icon: "🎯",
  unit: 1.2
}, {
  key: "dodgeChance",
  label: "Dodge",
  icon: "💨",
  unit: 1
}, {
  key: "hp",
  label: "HP",
  icon: "❤️",
  unit: 6
}, {
  key: "mp",
  label: "MP",
  icon: "💧",
  unit: 4
}, {
  key: "dropBonus",
  label: "Drop",
  icon: "🎁",
  unit: 1.5
}];
function empowerCost(slotIndex) {
  return 5 + slotIndex * 6;
}
function rollEmpowerBonus(rarity) {
  const def = EMPOWER_POOL[Math.floor(Math.random() * EMPOWER_POOL.length)];
  const mult = RARITY_MULT[rarity] || 1;
  const variance = 0.8 + Math.random() * 0.4;
  const value = Math.round(def.unit * mult * variance * 10) / 10;
  return {
    key: def.key,
    label: def.label,
    icon: def.icon,
    value
  };
}
function rollChestRarity(isEliteBoss, pity = 0) {
  const r = Math.random();
  if (isEliteBoss) {
    if (pity >= CHEST_PITY_ELITE) return "mythic";
    return r < 0.45 ? "mythic" : "elite";
  }
  if (pity >= CHEST_PITY_ELITE) return "elite";
  if (pity >= CHEST_PITY_UNIQUE) {
    if (r < 0.08) return "mythic";
    if (r < 0.5) return "elite";
    return "unique";
  }
  if (r < 0.05) return "mythic";
  if (r < 0.35) return "elite";
  if (r < 0.8) return "unique";
  return "rare";
}
function rollMaterialDrop(floor, modifier) {
  const r = Math.random();
  const manaWeight = modifier?.rarityBoost ? 0.42 : 0.22;
  let type;
  if (r < manaWeight) type = "manaOre";else if (r < manaWeight + 0.4) type = "iron";else type = "silver";
  const amount = 1 + Math.floor(floor / 12) + (Math.random() < 0.25 ? 1 : 0);
  return {
    type,
    amount
  };
}
