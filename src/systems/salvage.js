// ---------- salvage, protection stone, empower reroll/lock, chest pity, material shop ----------
const SALVAGE_TABLE = {
  rare: {
    iron: 3,
    silver: 2,
    manaOre: 0
  },
  unique: {
    iron: 6,
    silver: 4,
    manaOre: 2
  },
  elite: {
    iron: 10,
    silver: 7,
    manaOre: 5
  },
  mythic: {
    iron: 15,
    silver: 10,
    manaOre: 9
  }
};
function salvageYield(rarity) {
  return SALVAGE_TABLE[rarity] || SALVAGE_TABLE.rare;
}
const PROTECTION_STONE_PRICE = 40; // diamonds
const ENHANCE_DOWNGRADE_LEVEL = 6; // failing at +7 attempt (current level >= 6) risks a downgrade
function rerollCost(filledCount, lockedCount) {
  return Math.round((15 + filledCount * 8) * (1 + lockedCount * 0.6));
}
const MATERIAL_SHOP_PRICE = {
  iron: 6,
  silver: 10,
  manaOre: 22
};
const CHEST_PITY_UNIQUE = 5;
const CHEST_PITY_ELITE = 10;
