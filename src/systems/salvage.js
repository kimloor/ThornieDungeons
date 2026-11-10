// ---------- salvage, protection stone, empower reroll/lock, chest pity, material shop ----------
// Salvaging gear now yields junk items (iron / mana stone) directly into the inventory.
const SALVAGE_TABLE = {
  rare: {
    iron: 2,
    manaOre: 0
  },
  unique: {
    iron: 4,
    manaOre: 1
  },
  elite: {
    iron: 8,
    manaOre: 3
  },
  mythic: {
    iron: 15,
    manaOre: 9
  },
  // Azure (crafted) had no entry here either — same silent "falls back to rare" bug as the
  // missing RARITY_MULT.azure. Pinned equal to mythic, consistent with that earlier call.
  azure: {
    iron: 15,
    manaOre: 9
  }
};
function salvageYield(rarity, item = {}) {
  if (typeof DUNGEON_REWARD_V2 !== "undefined") return DUNGEON_REWARD_V2.dungeonV2SalvageYield(rarity, item);
  if (rarity === "mythic") return null;
  return SALVAGE_TABLE[rarity] || null;
}
const PROTECTION_STONE_PRICE = 30; // diamonds — Diamond Shop only in Reward V2
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
