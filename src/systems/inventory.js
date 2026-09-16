// ---------- Inventory V2 capacity / overflow ----------
// All reward and purchase insertion must cross this boundary. It is intentionally
// presentation-agnostic so future Storage can reuse the same slot policy safely.
const INVENTORY_CAPACITY = 30;
const INVENTORY_STACK_MAX = 99;
const INVENTORY_EQUIPMENT_TYPES = ["weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"];

function inventoryStackKey(item) {
  if (!item) return "";
  if (item.type === "junk" && item.junkId) return `junk:${item.junkId}`;
  if (item.type === "potion" && item.potionId) return `potion:${item.potionId}`;
  return "";
}

function cloneInventoryItem(item, quantity, suffix = "") {
  const next = { ...item };
  if (quantity !== undefined) next.quantity = quantity;
  if (suffix) next.id = `${item.id || "item"}-${suffix}`;
  return next;
}

function mergeStackInto(list, incoming) {
  const key = inventoryStackKey(incoming);
  let remaining = Math.max(0, Number(incoming.quantity) || 0);
  if (!key || !remaining) return { list: list.slice(), remaining };
  const next = list.map(item => {
    if (!remaining || inventoryStackKey(item) !== key) return item;
    const quantity = Math.max(0, Number(item.quantity) || 0);
    const add = Math.min(INVENTORY_STACK_MAX - quantity, remaining);
    if (add <= 0) return item;
    remaining -= add;
    return { ...item, quantity: quantity + add };
  });
  return { list: next, remaining };
}

function appendToOverflow(overflow, item, quantity) {
  const initial = cloneInventoryItem(item, quantity);
  const merged = mergeStackInto(overflow, initial);
  const next = merged.list;
  let remaining = merged.remaining;
  if (!inventoryStackKey(item)) {
    next.push(cloneInventoryItem(item));
    return next;
  }
  let part = 0;
  while (remaining > 0) {
    const chunk = Math.min(INVENTORY_STACK_MAX, remaining);
    next.push(cloneInventoryItem(item, chunk, `overflow-${Date.now()}-${part++}`));
    remaining -= chunk;
  }
  return next;
}

function insertInventoryItems(inventory, overflow, items, capacity = INVENTORY_CAPACITY) {
  let nextInventory = (inventory || []).slice();
  let nextOverflow = (overflow || []).slice();
  let insertedCount = 0;
  let overflowedCount = 0;
  (Array.isArray(items) ? items : [items]).filter(Boolean).forEach((item, itemIndex) => {
    const stackKey = inventoryStackKey(item);
    if (!stackKey) {
      if (nextInventory.length < capacity) {
        nextInventory.push(cloneInventoryItem(item));
        insertedCount += 1;
      } else {
        nextOverflow = appendToOverflow(nextOverflow, item);
        overflowedCount += 1;
      }
      return;
    }
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const merged = mergeStackInto(nextInventory, { ...item, quantity });
    nextInventory = merged.list;
    let remaining = merged.remaining;
    insertedCount += quantity - remaining;
    let part = 0;
    while (remaining > 0 && nextInventory.length < capacity) {
      const chunk = Math.min(INVENTORY_STACK_MAX, remaining);
      nextInventory.push(cloneInventoryItem(item, chunk, `slot-${Date.now()}-${itemIndex}-${part++}`));
      remaining -= chunk;
      insertedCount += chunk;
    }
    if (remaining > 0) {
      nextOverflow = appendToOverflow(nextOverflow, item, remaining);
      overflowedCount += remaining;
    }
  });
  return { inventory: nextInventory, overflow: nextOverflow, insertedCount, overflowedCount };
}

function normalizeInventoryCapacity(inventory, overflow, capacity = INVENTORY_CAPACITY) {
  return insertInventoryItems([], overflow || [], inventory || [], capacity);
}

function claimOverflowItem(inventory, overflow, itemId, capacity = INVENTORY_CAPACITY) {
  const index = (overflow || []).findIndex(item => item.id === itemId);
  if (index < 0) return { inventory: (inventory || []).slice(), overflow: (overflow || []).slice(), claimed: 0 };
  const item = overflow[index];
  const without = overflow.filter((_, i) => i !== index);
  const result = insertInventoryItems(inventory, [], [item], capacity);
  let nextOverflow = without;
  if (result.overflow.length) nextOverflow.splice(index, 0, ...result.overflow);
  return { inventory: result.inventory, overflow: nextOverflow, claimed: result.insertedCount };
}

function claimAllOverflowThatFits(inventory, overflow, capacity = INVENTORY_CAPACITY) {
  let nextInventory = (inventory || []).slice();
  let remaining = [];
  let claimed = 0;
  (overflow || []).forEach(item => {
    const result = insertInventoryItems(nextInventory, [], [item], capacity);
    nextInventory = result.inventory;
    remaining.push(...result.overflow);
    claimed += result.insertedCount;
  });
  return { inventory: nextInventory, overflow: remaining, claimed };
}

function inventoryRarityKey(item) {
  const rarity = String(item?.rarity || "common").toLowerCase();
  return rarity === "azure" || rarity === "legendary" ? "mythic" : rarity;
}

function inventoryItemCategory(item) {
  if (INVENTORY_EQUIPMENT_TYPES.includes(item?.type)) return "equipment";
  return item?.type === "potion" ? "consumable" : item?.type === "junk" ? "material" : "other";
}

function isItemEnchanted(item) {
  return Array.isArray(item?.empowerSlots) && item.empowerSlots.some(Boolean);
}

function sortInventoryDeterministic(inventory) {
  const categories = { equipment: 0, consumable: 1, material: 2, other: 3 };
  const rarities = { mythic: 5, elite: 4, unique: 3, rare: 2, common: 1, junk: 0 };
  return (inventory || []).slice().sort((a, b) =>
    (categories[inventoryItemCategory(a)] ?? 9) - (categories[inventoryItemCategory(b)] ?? 9)
    || (rarities[inventoryRarityKey(b)] || 0) - (rarities[inventoryRarityKey(a)] || 0)
    || (Number(b.enhanceLevel) || 0) - (Number(a.enhanceLevel) || 0)
    || String(a.type || "").localeCompare(String(b.type || ""))
    || String(a.name || "").localeCompare(String(b.name || ""))
    || String(a.id || "").localeCompare(String(b.id || ""))
  );
}

if (typeof module !== "undefined" && module.exports) module.exports = {
  INVENTORY_CAPACITY, inventoryStackKey, insertInventoryItems, normalizeInventoryCapacity,
  claimOverflowItem, claimAllOverflowThatFits, inventoryRarityKey, inventoryItemCategory,
  isItemEnchanted, sortInventoryDeterministic
};
