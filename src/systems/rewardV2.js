// ---------- Dungeon V2 reward, item, and economy foundation ----------
// Pure contract helpers for WAVE 2.  Combat remains owned by Battle Core and this
// module deliberately contains no persistence or UI code.
(function dungeonRewardV2Factory(root) {
  const TIERS = Object.freeze({
    1: Object.freeze({ minFloor: 1, maxFloor: 30, multiplier: 1 }),
    2: Object.freeze({ minFloor: 31, maxFloor: 50, multiplier: 1.3 }),
    3: Object.freeze({ minFloor: 51, maxFloor: 70, multiplier: 1.69 }),
    4: Object.freeze({ minFloor: 71, maxFloor: 90, multiplier: 2.197 }),
    5: Object.freeze({ minFloor: 91, maxFloor: Infinity, multiplier: 2.856 })
  });
  const RARITIES = Object.freeze({
    rare: Object.freeze({ multiplier: 1, empowerSlots: 1 }),
    unique: Object.freeze({ multiplier: 1.15, empowerSlots: 2 }),
    elite: Object.freeze({ multiplier: 1.3, empowerSlots: 3 }),
    mythic: Object.freeze({ multiplier: 1.5, empowerSlots: 4 })
  });
  const BASE_STATS = Object.freeze({
    weapon: Object.freeze([14, 18, 24, 31, 40]),
    gloves: Object.freeze([6, 8, 10, 13, 17]),
    chest: Object.freeze([9, 12, 15, 20, 26]),
    helmet: Object.freeze([6, 8, 10, 13, 17]),
    boots: Object.freeze([5, 6, 9, 11, 14])
  });
  const ACCESSORY_BASE_HP = Object.freeze([40, 52, 68, 88, 114]);
  const GENERIC_SLOTS = Object.freeze(["weapon", "helmet", "chest", "gloves", "boots"]);
  const RARITY_BANDS = Object.freeze([
    Object.freeze({ minFloor: 1, maxFloor: 10, weights: Object.freeze({ rare: 82.5, unique: 15, elite: 2.5 }) }),
    Object.freeze({ minFloor: 11, maxFloor: 20, weights: Object.freeze({ rare: 78, unique: 18, elite: 4 }) }),
    Object.freeze({ minFloor: 21, maxFloor: 30, weights: Object.freeze({ rare: 73, unique: 21, elite: 6 }) }),
    Object.freeze({ minFloor: 31, maxFloor: 50, weights: Object.freeze({ rare: 69, unique: 24, elite: 7 }) }),
    Object.freeze({ minFloor: 51, maxFloor: 70, weights: Object.freeze({ rare: 64, unique: 28, elite: 8 }) }),
    Object.freeze({ minFloor: 71, maxFloor: 90, weights: Object.freeze({ rare: 60, unique: 30, elite: 10 }) }),
    Object.freeze({ minFloor: 91, maxFloor: Infinity, weights: Object.freeze({ rare: 55, unique: 33, elite: 12 }) })
  ]);
  const FIRST_CLEAR_ACCESSORIES = Object.freeze({
    10: Object.freeze({ gearTier: 1, rarity: "elite" }),
    20: Object.freeze({ gearTier: 1, rarity: "elite" }),
    30: Object.freeze({ gearTier: 1, rarity: "elite" }),
    40: Object.freeze({ gearTier: 2, rarity: "elite" }),
    50: Object.freeze({ gearTier: 2, rarity: "elite" }),
    60: Object.freeze({ gearTier: 3, rarity: "elite" }),
    70: Object.freeze({ gearTier: 3, rarity: "elite" }),
    80: Object.freeze({ gearTier: 4, rarity: "elite" }),
    90: Object.freeze({ gearTier: 4, rarity: "elite" }),
    100: Object.freeze({ gearTier: 5, rarity: "elite" }),
    110: Object.freeze({ gearTier: 5, rarity: "elite" })
  });
  const PACK_REWARD_MULTIPLIERS = Object.freeze({ 1: 1, 2: 1.35, 3: 1.65 });
  const SHOP_PRICES = Object.freeze({
    1: Object.freeze({ rare: 800, unique: 1300, elite: 2300 }),
    2: Object.freeze({ rare: 1900, unique: 3200, elite: 5500 }),
    3: Object.freeze({ rare: 3100, unique: 5200, elite: 9000 }),
    4: Object.freeze({ rare: 4600, unique: 7700, elite: 13500 }),
    5: Object.freeze({ rare: 6900, unique: 11500, elite: 20000 })
  });
  const TYPE_NAMES = Object.freeze({
    weapon: Object.freeze(["Beginner Sword", "Copper Blade", "Steel Greatsword", "Platinum Greatsword", "Dragon Slayer Sword"]),
    helmet: Object.freeze(["Leather Cap", "Bronze Guard Helm", "Steel Helm", "Platinum Helm", "Dragon Scale Helm"]),
    chest: Object.freeze(["Leather Vest", "Bronze Armor", "Chain Armor", "Platinum Plate Armor", "Dragon Scale Armor"]),
    gloves: Object.freeze(["Leather Gloves", "Bronze Gauntlets", "Chain Gloves", "Platinum Gauntlets", "Dragonhide Gloves"]),
    boots: Object.freeze(["Leather Boots", "Bronze Greaves", "Chain Boots", "Platinum Sabatons", "Dragonhide Boots"]),
    accessory: Object.freeze(["Adventurer Charm", "Bronze Amulet", "Enchanted Amulet", "Platinum Talisman", "Dragonheart Amulet"])
  });
  const VALID_GENERIC_RARITIES = Object.freeze(["rare", "unique", "elite"]);
  const VALID_GENERIC_TYPES = new Set(GENERIC_SLOTS);

  function floorNumber(floor) { return Math.max(1, Math.floor(Number(floor) || 1)); }
  function roundStat(value) { return Math.max(1, Math.round(Number(value) || 0)); }
  function roundUtility(value) { return Math.round((Number(value) || 0) * 10) / 10; }
  function dungeonV2GearTierForFloor(floor) {
    const f = floorNumber(floor);
    return f <= 30 ? 1 : f <= 50 ? 2 : f <= 70 ? 3 : f <= 90 ? 4 : 5;
  }
  function dungeonV2TierMultiplier(tierOrFloor) {
    const tier = Number(tierOrFloor) > 5 ? dungeonV2GearTierForFloor(tierOrFloor) : Math.max(1, Math.min(5, Math.floor(Number(tierOrFloor) || 1)));
    return TIERS[tier].multiplier;
  }
  function dungeonV2RarityMultiplier(rarity) { return RARITIES[rarity]?.multiplier || 0; }
  function dungeonV2EmpowerSlots(rarity) { return RARITIES[rarity]?.empowerSlots || 0; }
  function dungeonV2RarityWeights(floor) {
    const f = floorNumber(floor);
    return (RARITY_BANDS.find(band => f >= band.minFloor && f <= band.maxFloor) || RARITY_BANDS.at(-1)).weights;
  }
  function dungeonV2RollRarity(floor, rng = Math.random) {
    const weights = dungeonV2RarityWeights(floor);
    const roll = Math.max(0, Math.min(99.999999, Number(rng()) * 100));
    if (roll < weights.rare) return "rare";
    if (roll < weights.rare + weights.unique) return "unique";
    return "elite";
  }
  function dungeonV2RewardRole(encounterType) {
    if (encounterType === "chapter_boss") return "chapter_boss";
    if (encounterType === "elite") return "elite";
    return "normal";
  }
  function dungeonV2PackMultiplier(packCount) { return PACK_REWARD_MULTIPLIERS[Math.max(1, Math.min(3, Number(packCount) || 1))] || 1; }
  function dungeonV2RewardExp(floor, encounterType = "normal", packCount = 1) {
    const base = Math.round(6 + floorNumber(floor) * 2.4);
    const encounter = encounterType === "chapter_boss" ? 2 : encounterType === "elite" ? 1.5 : 1;
    const pack = encounterType === "normal" ? dungeonV2PackMultiplier(packCount) : 1;
    return Math.round(base * encounter * pack);
  }
  function dungeonV2RewardGold(floor, encounterType = "normal", packCount = 1) {
    const f = floorNumber(floor);
    const base = f <= 30 ? 20 + 3 * f : f <= 50 ? 120 + 4 * (f - 31) : f <= 70 ? 210 + 5 * (f - 51) : f <= 90 ? 320 + 7 * (f - 71) : 480 + 10 * (f - 91);
    const encounter = encounterType === "chapter_boss" ? 2 : encounterType === "elite" ? 1.5 : 1;
    const pack = encounterType === "normal" ? dungeonV2PackMultiplier(packCount) : 1;
    return Math.round(base * encounter * pack);
  }
  function dungeonV2AccessoryDropChance(encounterType = "normal") {
    if (encounterType === "elite") return 0.02;
    return 0;
  }
  function dungeonV2GenericEquipmentChance(encounterType = "normal", dropBonus = 0) {
    if (encounterType === "chapter_boss") return 0;
    if (encounterType === "elite") return 0.08;
    return 0.04 * (1 + Math.max(0, Number(dropBonus) || 0) / 100);
  }
  function dungeonV2FirstClearAccessory(floor) {
    const f = floorNumber(floor);
    return FIRST_CLEAR_ACCESSORIES[f] ? { ...FIRST_CLEAR_ACCESSORIES[f] } : null;
  }
  function dungeonV2ShopTier(floor) { return dungeonV2GearTierForFloor(floor); }
  function dungeonV2ShopPrice(tier, rarity) { return SHOP_PRICES[Math.max(1, Math.min(5, Number(tier) || 1))]?.[rarity] || 0; }
  function dungeonV2SalvageYield(rarity, item = {}) {
    if (rarity === "mythic" || rarity === "azure" || item.sourceType === "raid" || item.sourceType === "boss_weapon") return null;
    if (rarity === "elite") return { iron: 8, manaOre: 3 };
    if (rarity === "unique") return { iron: 4, manaOre: 1 };
    if (rarity === "rare") return { iron: 2, manaOre: 0 };
    return null;
  }
  function dungeonV2RewardReceiptKey(battleId) { return battleId ? `battle:${String(battleId)}` : ""; }
  function dungeonV2FirstClearReceiptKey(floor) { return `first-clear-accessory:${floorNumber(floor)}`; }
  function dungeonV2HasReceipt(receipts, key) { return !!key && Array.isArray(receipts) && receipts.includes(key); }
  function dungeonV2IsV2Item(item) {
    return Number(item?.rewardVersion) === 2 || Number(item?.itemModelVersion) === 2;
  }
  function dungeonV2FirstClearClaimsFromReceipts(receipts) {
    const claims = {};
    (Array.isArray(receipts) ? receipts : []).forEach(key => {
      const match = String(key).match(/^first-clear-accessory:(\d+)$/);
      if (match) claims[match[1]] = true;
    });
    return claims;
  }
  function dungeonV2HasFirstClearClaim(claims, floor, receipts = []) {
    const key = String(floorNumber(floor));
    return !!(claims && typeof claims === "object" && claims[key])
      || dungeonV2HasReceipt(receipts, dungeonV2FirstClearReceiptKey(floor));
  }
  function dungeonV2ClaimFirstClear(claims, floor) {
    return { ...(claims && typeof claims === "object" ? claims : {}), [String(floorNumber(floor))]: true };
  }
  function dungeonV2AppendReceipts(receipts, keys, max = 128) {
    const merged = [...(Array.isArray(receipts) ? receipts : []), ...(Array.isArray(keys) ? keys : [keys])].filter(Boolean);
    return [...new Set(merged)].slice(-Math.max(1, max));
  }
  function dungeonV2CustomLootChoice(table, rng = Math.random) {
    const rows = Array.isArray(table?.gear) ? table.gear.filter(row => VALID_GENERIC_TYPES.has(row?.itemType) && (!row.rarity || VALID_GENERIC_RARITIES.includes(row.rarity)) && Number(row.weight ?? 1) > 0) : [];
    if (!rows.length) return null;
    const total = rows.reduce((sum, row) => sum + Number(row.weight ?? 1), 0);
    let cursor = Math.max(0, Number(rng()) || 0) * total;
    for (const row of rows) {
      cursor -= Number(row.weight ?? 1);
      if (cursor < 0) return { itemType: row.itemType, rarity: row.rarity || null };
    }
    const last = rows.at(-1);
    return { itemType: last.itemType, rarity: last.rarity || null };
  }
  function dungeonV2EquipmentItem({ floor, type, rarity, sourceType = "dungeon_normal", specialSource = null, sourceIdentity = null, utilityKey = null, rng = Math.random } = {}) {
    const resolvedFloor = floorNumber(floor);
    const gearTier = dungeonV2GearTierForFloor(resolvedFloor);
    const resolvedType = VALID_GENERIC_TYPES.has(type) || type === "accessory" ? type : GENERIC_SLOTS[Math.floor(Math.max(0, Math.min(0.999999, Number(rng()) || 0)) * GENERIC_SLOTS.length)];
    const resolvedRarity = RARITIES[rarity] ? rarity : "rare";
    const multiplier = dungeonV2RarityMultiplier(resolvedRarity);
    const id = `v2-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item = {
      id, type: resolvedType, rarity: resolvedRarity,
      name: (TYPE_NAMES[resolvedType] || TYPE_NAMES.weapon)[gearTier - 1],
      gearTier, rewardVersion: 2, itemModelVersion: 2,
      sourceType, sourceFloor: resolvedFloor,
      specialSource: specialSource || undefined,
      sourceIdentity: sourceIdentity || undefined,
      setId: undefined,
      enhanceLevel: 0,
      empowerSlotCapacity: dungeonV2EmpowerSlots(resolvedRarity),
      empowerSlots: (typeof root.ENHANCEMENT_V2 !== "undefined" && root.ENHANCEMENT_V2.fillEmpowerSlots)
        ? root.ENHANCEMENT_V2.fillEmpowerSlots(resolvedType, resolvedRarity, rng)
        : Array(dungeonV2EmpowerSlots(resolvedRarity)).fill(null)
    };
    if (resolvedType === "accessory") {
      item.name = TYPE_NAMES.accessory[gearTier - 1];
      item.hp = roundStat(ACCESSORY_BASE_HP[gearTier - 1] * multiplier);
    } else {
      const base = BASE_STATS[resolvedType][gearTier - 1];
      item[resolvedType === "weapon" || resolvedType === "gloves" ? "atk" : "def"] = roundStat(base * multiplier);
    }
    return item;
  }
  function dungeonV2GenerateEquipment({ floor, type, rarity, sourceType, specialSource, sourceIdentity, lootTable, allowMythic = false, rng = Math.random } = {}) {
    const custom = dungeonV2CustomLootChoice(lootTable, rng);
    const requestedRarity = custom?.rarity || rarity || dungeonV2RollRarity(floor, rng);
    return dungeonV2EquipmentItem({
      floor, type: custom?.itemType || type,
      rarity: requestedRarity === "mythic" && !allowMythic ? "elite" : requestedRarity,
      sourceType, specialSource, sourceIdentity, rng
    });
  }
  function dungeonV2FirstClearEligible({ floor, encounterType, unlockedNext, receipts, firstClearAccessoryClaims }) {
    return encounterType === "chapter_boss" && !!dungeonV2FirstClearAccessory(floor) && !!unlockedNext
      && !dungeonV2HasFirstClearClaim(firstClearAccessoryClaims, floor, receipts);
  }

  const api = {
    TIERS, RARITIES, BASE_STATS, ACCESSORY_BASE_HP, GENERIC_SLOTS, RARITY_BANDS, FIRST_CLEAR_ACCESSORIES, PACK_REWARD_MULTIPLIERS, SHOP_PRICES,
    dungeonV2GearTierForFloor, dungeonV2TierMultiplier, dungeonV2RarityMultiplier, dungeonV2EmpowerSlots,
    dungeonV2RarityWeights, dungeonV2RollRarity, dungeonV2RewardRole, dungeonV2PackMultiplier, dungeonV2RewardExp,
    dungeonV2RewardGold, dungeonV2AccessoryDropChance, dungeonV2GenericEquipmentChance, dungeonV2FirstClearAccessory, dungeonV2ShopTier,
    dungeonV2ShopPrice, dungeonV2SalvageYield, dungeonV2RewardReceiptKey, dungeonV2FirstClearReceiptKey,
    dungeonV2HasReceipt, dungeonV2IsV2Item, dungeonV2FirstClearClaimsFromReceipts, dungeonV2HasFirstClearClaim,
    dungeonV2ClaimFirstClear, dungeonV2AppendReceipts, dungeonV2CustomLootChoice, dungeonV2EquipmentItem,
    dungeonV2GenerateEquipment, dungeonV2FirstClearEligible
  };
  root.DUNGEON_REWARD_V2 = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
