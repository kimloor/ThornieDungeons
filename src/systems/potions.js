// ---------- potions (stackable consumables, live in normal inventory like junk) ----------
// Same pattern as JUNK_INFO/addJunkToInventory in enhancement.js: plain stackable items with
// type: "potion" that ride through the normal item sync (serialize.js) via extra_json, so no
// D1 schema migration is needed to support them.
const POTION_DEFS = [
  { id: "hp_small", kind: "hp", tier: 1, name: "Small HP Potion", icon: "🧪", healPct: 0.20, price: 15, desc: "ฟื้นฟู HP 20% ของ HP สูงสุด" },
  { id: "hp_medium", kind: "hp", tier: 2, name: "Medium HP Potion", icon: "🧪", healPct: 0.40, price: 32, desc: "ฟื้นฟู HP 40% ของ HP สูงสุด" },
  { id: "hp_high", kind: "hp", tier: 3, name: "High HP Potion", icon: "🧪", healPct: 0.70, price: 60, desc: "ฟื้นฟู HP 70% ของ HP สูงสุด" },
  { id: "hp_full", kind: "hp", tier: 4, name: "Full HP Potion", icon: "🧪", healPct: 1.0, price: 110, desc: "ฟื้นฟู HP เต็ม 100%" },
  { id: "mp_small", kind: "mp", tier: 1, name: "Small SP Potion", icon: "🧴", healPct: 0.20, price: 15, desc: "ฟื้นฟู SP 20% ของ SP สูงสุด" },
  { id: "mp_medium", kind: "mp", tier: 2, name: "Medium SP Potion", icon: "🧴", healPct: 0.40, price: 32, desc: "ฟื้นฟู SP 40% ของ SP สูงสุด" },
  { id: "mp_high", kind: "mp", tier: 3, name: "High SP Potion", icon: "🧴", healPct: 0.70, price: 60, desc: "ฟื้นฟู SP 70% ของ SP สูงสุด" },
  { id: "mp_full", kind: "mp", tier: 4, name: "Full SP Potion", icon: "🧴", healPct: 1.0, price: 110, desc: "ฟื้นฟู SP เต็ม 100%" }
];
const POTION_STACK_MAX = 99;
function getPotionDef(potionId) {
  return POTION_DEFS.find(p => p.id === potionId) || null;
}
function makePotionItem(potionId, quantity) {
  const def = getPotionDef(potionId);
  if (!def) return null;
  return {
    id: `potion-${potionId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "potion",
    potionId,
    name: def.name,
    icon: def.icon,
    rarity: "common",
    quantity: Math.max(1, Math.min(POTION_STACK_MAX, quantity))
  };
}
// Sums every stack of a given potion type currently sitting in the inventory.
function potionTotal(inventory, potionId) {
  return inventory.reduce((sum, it) => it.type === "potion" && it.potionId === potionId ? sum + (it.quantity || 0) : sum, 0);
}
// Every distinct potion type currently owned (qty > 0), one entry each, for list UIs.
function ownedPotionStacks(inventory) {
  const seen = {};
  const out = [];
  inventory.forEach(it => {
    if (it.type !== "potion" || !(it.quantity > 0)) return;
    if (seen[it.potionId]) return;
    seen[it.potionId] = true;
    const def = getPotionDef(it.potionId);
    if (def) out.push({ ...def, quantity: potionTotal(inventory, it.potionId) });
  });
  return out;
}
