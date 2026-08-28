// ---------- junk materials, enhancement (ตีบวก) & empowerment (เสริมพลัง) ----------
// Junk items are plain stackable drops that live in the normal inventory (type: "junk"),
// not in a separate save.materials pool, so they persist through the same item sync as gear.
// Uses roundTo()/roundInt()/formatNumber() from stats.js (same concatenated bundle, no import
// needed) for the same floating-point-safety reasons documented there.
const JUNK_INFO = {
  stone: {
    name: "หิน",
    icon: "🪨"
  },
  grass: {
    name: "หญ้า",
    icon: "🌿"
  },
  wood: {
    name: "ไม้",
    icon: "🪵"
  },
  iron: {
    name: "เหล็ก",
    icon: "🔩"
  },
  manaOre: {
    name: "หินมานา",
    icon: "🔮"
  }
};
const JUNK_STACK_MAX = 99;
const JUNK_SELL_VALUE = {
  stone: 1,
  grass: 1,
  wood: 2,
  iron: 4,
  manaOre: 6
};
function makeJunkItem(junkId, quantity) {
  const info = JUNK_INFO[junkId];
  return {
    id: `junk-${junkId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: "junk",
    junkId,
    name: info.name,
    icon: info.icon,
    rarity: "common",
    quantity: Math.max(1, Math.min(JUNK_STACK_MAX, quantity))
  };
}
// Sums every stack of a given junk type currently sitting in the inventory.
function junkTotal(inventory, junkId) {
  return inventory.reduce((sum, it) => it.type === "junk" && it.junkId === junkId ? sum + (it.quantity || 0) : sum, 0);
}
// Adds `amount` of a junk type into existing (non-full) stacks first, then creates new
// 99-cap stacks for any remainder, so a slot never holds more than JUNK_STACK_MAX.
function addJunkToInventory(inventory, junkId, amount) {
  if (!amount || amount <= 0) return inventory;
  let remaining = amount;
  const next = inventory.map(it => {
    if (remaining > 0 && it.type === "junk" && it.junkId === junkId && it.quantity < JUNK_STACK_MAX) {
      const space = JUNK_STACK_MAX - it.quantity;
      const add = Math.min(space, remaining);
      remaining -= add;
      return {
        ...it,
        quantity: it.quantity + add
      };
    }
    return it;
  });
  while (remaining > 0) {
    const chunk = Math.min(JUNK_STACK_MAX, remaining);
    next.push(makeJunkItem(junkId, chunk));
    remaining -= chunk;
  }
  return next;
}
// Removes `amount` of a junk type, draining partially-filled/emptied stacks first.
// Returns null if the player doesn't have enough (no partial spend).
function removeJunkFromInventory(inventory, junkId, amount) {
  if (!amount || amount <= 0) return inventory;
  if (junkTotal(inventory, junkId) < amount) return null;
  let remaining = amount;
  const next = [];
  inventory.forEach(it => {
    if (remaining > 0 && it.type === "junk" && it.junkId === junkId) {
      const take = Math.min(it.quantity, remaining);
      remaining -= take;
      const leftover = it.quantity - take;
      if (leftover > 0) next.push({
        ...it,
        quantity: leftover
      });
    } else {
      next.push(it);
    }
  });
  return next;
}
// Regular (non-boss) monsters drop one stack of a random junk material.
function rollJunkDrop(floor, modifier) {
  const keys = Object.keys(JUNK_INFO);
  const manaWeight = modifier?.rarityBoost ? 0.3 : 0.14;
  const ironWeight = 0.22;
  const r = Math.random();
  let junkId;
  if (r < manaWeight) junkId = "manaOre";else if (r < manaWeight + ironWeight) junkId = "iron";else junkId = keys[Math.floor(Math.random() * 3)]; // stone / grass / wood
  const amount = 1 + Math.floor(floor / 12) + (Math.random() < 0.25 ? 1 : 0);
  return {
    type: junkId,
    amount
  };
}
const ENHANCE_MAX = 10;
const ENHANCE_RATE_TABLE = [95, 90, 82, 72, 60, 48, 36, 25, 16, 10];
function enhanceSuccessRate(level) {
  return ENHANCE_RATE_TABLE[Math.min(level, ENHANCE_RATE_TABLE.length - 1)];
}
// Enhance now always costs exactly 1 iron plus a gold fee that scales with level.
function enhanceCost(level) {
  return {
    iron: 1,
    gold: 25 + level * 35
  };
}
const ENHANCE_STAT_PCT = 0.06; // each successful +1 adds 6% of the item's base stat
const EMPOWER_POOL = [{
  key: "atkPct",
  label: "ATK",
  icon: "⚔️",
  unit: 0.03
}, {
  key: "defPct",
  label: "DEF",
  icon: "🛡️",
  unit: 0.03
}, {
  key: "critChance",
  label: "Crit",
  icon: "💥",
  unit: 1.2
}, {
  key: "accuracy",
  label: "Accuracy",
  icon: "🎯",
  unit: 1.2
}, {
  key: "dodgeChance",
  label: "Dodge",
  icon: "💨",
  unit: 1
}, {
  key: "hp",
  label: "HP",
  icon: "❤️",
  unit: 6
}, {
  key: "mp",
  label: "MP",
  icon: "💧",
  unit: 4
}, {
  key: "dropBonus",
  label: "Drop",
  icon: "🎁",
  unit: 1.5
}];
// Empowering a new slot now always costs exactly 1 mana stone plus a gold fee that scales with slot index.
function empowerCost(slotIndex) {
  return {
    manaOre: 1,
    gold: 30 + slotIndex * 45
  };
}
function rollEmpowerBonus(rarity) {
  const def = EMPOWER_POOL[Math.floor(Math.random() * EMPOWER_POOL.length)];
  const mult = RARITY_MULT[rarity] || 1;
  const variance = 0.8 + Math.random() * 0.4;
  const raw = def.unit * mult * variance;
  // HP/MP are whole points, not fractional (a tooltip reading "+7.4 HP" doesn't make sense and
  // risks leaving maxHp non-integer downstream); every other empowered stat here is a %-style
  // value so it keeps 1 decimal of precision, safely rounded via roundTo() to avoid float drift.
  const value = def.key === "hp" || def.key === "mp" ? roundInt(raw) : roundTo(raw, 1);
  return {
    key: def.key,
    label: def.label,
    icon: def.icon,
    value
  };
}
function rollChestRarity(isEliteBoss, pity = 0) {
  const r = Math.random();
  if (isEliteBoss) {
    if (pity >= CHEST_PITY_ELITE) return "mythic";
    return r < 0.45 ? "mythic" : "elite";
  }
  if (pity >= CHEST_PITY_ELITE) return "elite";
  if (pity >= CHEST_PITY_UNIQUE) {
    if (r < 0.08) return "mythic";
    if (r < 0.5) return "elite";
    return "unique";
  }
  if (r < 0.05) return "mythic";
  if (r < 0.35) return "elite";
  if (r < 0.8) return "unique";
  return "rare";
}
