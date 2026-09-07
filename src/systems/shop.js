// ---------- shop & selling ----------
function itemValueScore(it) {
  return (it.atk || 0) * 3 + (it.def || 0) * 3 + (it.hp || 0) * 0.6 + (it.mp || 0) * 0.6 + (it.dodgeChance || 0) * 4 + (it.critChance || 0) * 4 + (it.critDamage || 0) * 2.5;
}
function sellPrice(it) {
  if (it.type === "junk") return Math.max(1, (JUNK_SELL_VALUE[it.junkId] || 1) * (it.quantity || 1));
  return Math.max(3, Math.round(itemValueScore(it) * (RARITY_MULT[it.rarity] || 1) * 0.9));
}
function shopBuyPrice(it) {
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
  for (let i = 0; i < 3; i++) {
    const drop = generateDrop(Math.max(1, floor + Math.floor(Math.random() * 3) - 1));
    items.push({
      ...drop,
      price: shopBuyPrice(drop)
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
  accessory: null
});
