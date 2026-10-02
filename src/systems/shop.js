// ---------- shop & selling ----------
function itemValueScore(it) {
  let score = (it.atk || 0) * 3 + (it.def || 0) * 3 + (it.hp || 0) * 0.6 + (it.mp || 0) * 0.6 + (it.dodgeChance || 0) * 4 + (it.critChance || 0) * 4 + (it.critDamage || 0) * 2.5;
  if (String(it.type || "").toLowerCase() === "wings") {
    const family = String(it.wingFamily || it.wingId || it.wingsId || it.setId || "").toLowerCase();
    const primary = { azure: "agi", robot: "vit", skeleton: "str" }[family];
    score += (Number(it.enhanceLevel) || 0) * 3;
    (it.empowerSlots || []).filter(Boolean).forEach(slot => {
      const key = String(slot.key || "");
      score += Number(slot.value) || 0;
      if (key === primary) score += Number(slot.value) || 0;
    });
  }
  return score;
}
function sellPrice(it) {
  if (it.type === "junk") return Math.max(1, (JUNK_SELL_VALUE[it.junkId] || 1) * (it.quantity || 1));
  return Math.max(3, Math.round(itemValueScore(it) * (RARITY_MULT[it.rarity] || 1) * 0.9));
}
function shopBuyPrice(it) {
  if (it?.rewardVersion === 2 && typeof DUNGEON_REWARD_V2 !== "undefined") {
    return DUNGEON_REWARD_V2.dungeonV2ShopPrice(it.gearTier, it.rarity);
  }
  return Math.max(10, Math.round(itemValueScore(it) * (RARITY_MULT[it.rarity] || 1) * 2.2));
}

// TEMPORARY SPRITE QA ONLY — expose the complete Azure set in the normal shop so
// each equipment overlay can be bought/equipped during visual testing. Remove
// AZURE_TEST_SHOP_ITEMS and its spread in generateShopStock() after sprite QA passes.
const AZURE_TEST_SHOP_ITEMS = [
  { type: "helmet", name: "หมวก Azure [TEST]", def: 60 },
  { type: "chest", name: "เสื้อ Azure [TEST]", def: 90 },
  { type: "gloves", name: "ถุงมือ Azure [TEST]", atk: 40 },
  { type: "boots", name: "รองเท้า Azure [TEST]", def: 45 },
  { type: "weapon", name: "อาวุธ Azure [TEST]", atk: 120 },
  { type: "accessory", name: "แหวน Azure [TEST]", dodgeChance: 15 }
];

function makeAzureTestShopItems() {
  const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return AZURE_TEST_SHOP_ITEMS.map((item, index) => ({
    id: `azure-test-${batchId}-${index}`,
    ...item,
    rarity: "azure",
    setId: "azure",
    enhanceLevel: 0,
    empowerSlots: Array(5).fill(null),
    price: 1
  }));
}

function generateShopStock(floor) {
  const items = [];
  const eligibleFloor = Math.max(1, Number(floor) || 1);
  const eligibleTier = typeof DUNGEON_REWARD_V2 !== "undefined" ? DUNGEON_REWARD_V2.dungeonV2ShopTier(eligibleFloor) : gearTierForFloor(eligibleFloor);
  const tierFloor = [1, 31, 51, 71, 91][eligibleTier - 1] || 1;
  for (let i = 0; i < 3; i++) {
    // No Elite cadence existed in the pre-V2 shop. Keep the stock rotation
    // infrastructure, but make its regular pool R/U only until a cadence is
    // explicitly contracted; never make Mythic a normal-shop result.
    const rarity = Math.random() < 0.18 ? "unique" : "rare";
    const drop = generateDrop(tierFloor, {
      forceRarity: rarity,
      sourceType: "shop_normal",
      sourceIdentity: `normal-shop-tier-${eligibleTier}`
    });
    drop.sourceFloor = eligibleFloor;
    items.push({
      ...drop,
      price: typeof DUNGEON_REWARD_V2 !== "undefined"
        ? DUNGEON_REWARD_V2.dungeonV2ShopPrice(eligibleTier, drop.rarity)
        : shopBuyPrice(drop)
    });
  }
  return {
    // Potion tiers are a fixed catalog (not randomized like gear rolls) — always all 8 in stock.
    potions: POTION_DEFS,
    items: [...makeAzureTestShopItems(), ...items]
  };
}
const emptyEquipped = () => ({
  weapon: null,
  helmet: null,
  chest: null,
  gloves: null,
  boots: null,
  accessory: null,
  wings: null
});
