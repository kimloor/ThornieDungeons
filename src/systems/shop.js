// ---------- shop & selling ----------
function itemValueScore(it) {
  return (it.atk || 0) * 3 + (it.def || 0) * 3 + (it.hp || 0) * 0.6 + (it.mp || 0) * 0.6;
}
function sellPrice(it) {
  return Math.max(3, Math.round(itemValueScore(it) * (RARITY_MULT[it.rarity] || 1) * 0.9));
}
function shopBuyPrice(it) {
  return Math.max(10, Math.round(itemValueScore(it) * (RARITY_MULT[it.rarity] || 1) * 2.2));
}
function potionShopPrice(floor) {
  return 8 + Math.round(floor * 1.5);
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
    potionPrice: potionShopPrice(floor),
    items
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
