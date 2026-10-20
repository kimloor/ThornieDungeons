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
const POTION_SELL_VALUE = Object.freeze({
  hp_small: 4, mp_small: 4,
  hp_medium: 9, mp_medium: 9,
  hp_high: 18, mp_high: 18,
  hp_full: 33, mp_full: 33
});
function sellUnitPrice(it) {
  if (it?.type === "junk") return Math.max(1, JUNK_SELL_VALUE[it.junkId] || 1);
  if (it?.type === "potion") return POTION_SELL_VALUE[it.potionId] || 0;
  return Math.max(3, Math.round(itemValueScore(it) * (RARITY_MULT[it.rarity] || 1) * 0.9));
}
function sellPrice(it) {
  return sellUnitPrice(it) * Math.max(1, Number(it?.quantity) || 1);
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
