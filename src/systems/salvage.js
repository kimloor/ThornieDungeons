// ---------- salvage, protection stone, empower reroll/lock, chest pity, material shop ----------
// Salvaging gear now yields junk items (iron / mana stone) directly into the inventory.
const SALVAGE_TABLE = {
  rare: {
    iron: 3,
    manaOre: 0
  },
  unique: {
    iron: 6,
    manaOre: 2
  },
  elite: {
    iron: 10,
    manaOre: 5
  },
  mythic: {
    iron: 15,
    manaOre: 9
  }
};
function salvageYield(rarity) {
  return SALVAGE_TABLE[rarity] || SALVAGE_TABLE.rare;
}
const PROTECTION_STONE_PRICE = 40; // diamonds
const ENHANCE_DOWNGRADE_LEVEL = 6; // failing at +7 attempt (current level >= 6) risks a downgrade
// Rerolling empower options now always costs exactly 1 mana stone plus a gold fee that scales with complexity.
function rerollCost(filledCount, lockedCount) {
  return {
    manaOre: 1,
    gold: Math.round((25 + filledCount * 15) * (1 + lockedCount * 0.6))
  };
}
const MATERIAL_SHOP_PRICE = {
  iron: 6,
  manaOre: 22
};
const CHEST_PITY_UNIQUE = 5;
const CHEST_PITY_ELITE = 10;
