// ---------- Reward V2 Enhance / Empower contract ----------
// Pure, deterministic helpers shared by the browser bundle and API Worker. The Worker owns
// gameplay RNG and persistence; the browser uses these helpers only for previews/stat math.
(function enhancementV2Factory(root) {
  const ENHANCE_MAX = 10;
  const ENHANCE_STAT_PCT = 0.06;
  const ENHANCE_RATES = Object.freeze([95, 90, 82, 72, 60, 50, 40, 30, 20, 15]);
  const TIER_ECONOMY = Object.freeze({ 1: 1, 2: 2.25, 3: 3.75, 4: 5.75, 5: 8.5 });
  const EMPOWER_CAPACITY = Object.freeze({ rare: 1, unique: 2, elite: 3, mythic: 4 });
  const EMPOWER_OPEN_BASE_GOLD = Object.freeze([30, 75, 120, 165]);
  const WING_PRIMARY_STAT = Object.freeze({ azure: "agi", robot: "vit", skeleton: "str" });

  const OPTION_DEFS = Object.freeze({
    atkPct: Object.freeze({ label: "ATK", icon: "⚔️", values: Object.freeze([4, 5, 6, 7, 8]), weights: Object.freeze([25, 25, 25, 15, 10]) }),
    defPct: Object.freeze({ label: "DEF", icon: "🛡️", values: Object.freeze([3, 4, 5, 6]), weights: Object.freeze([35, 35, 20, 10]) }),
    hpPct: Object.freeze({ label: "HP", icon: "❤️", values: Object.freeze([1, 2, 3]), weights: Object.freeze([50, 35, 15]) }),
    mpPct: Object.freeze({ label: "MP", icon: "💧", values: Object.freeze([2, 3, 4]), weights: Object.freeze([50, 35, 15]) }),
    critChance: Object.freeze({ label: "Crit", icon: "💥", values: Object.freeze([1, 2]), weights: Object.freeze([75, 25]) }),
    critDamage: Object.freeze({ label: "Crit Dmg", icon: "✨", values: Object.freeze([2, 3, 4]), weights: Object.freeze([50, 35, 15]) }),
    str: Object.freeze({ label: "STR", icon: "💪", values: Object.freeze([1]), weights: Object.freeze([100]) }),
    vit: Object.freeze({ label: "VIT", icon: "🫀", values: Object.freeze([1]), weights: Object.freeze([100]) }),
    agi: Object.freeze({ label: "AGI", icon: "⚡", values: Object.freeze([1]), weights: Object.freeze([100]) }),
    dex: Object.freeze({ label: "DEX", icon: "🎯", values: Object.freeze([1]), weights: Object.freeze([100]) }),
    luk: Object.freeze({ label: "LUK", icon: "🍀", values: Object.freeze([1]), weights: Object.freeze([100]) })
  });
  const SLOT_POOLS = Object.freeze({
    weapon: Object.freeze(["atkPct", "critChance", "critDamage", "str", "dex"]),
    gloves: Object.freeze(["atkPct", "critChance", "critDamage", "str", "agi", "dex"]),
    helmet: Object.freeze(["defPct", "hpPct", "mpPct", "vit", "agi", "dex", "luk"]),
    chest: Object.freeze(["defPct", "hpPct", "vit", "agi", "luk"]),
    boots: Object.freeze(["defPct", "hpPct", "vit", "agi", "luk"]),
    accessory: Object.freeze(["hpPct", "mpPct", "critChance", "critDamage", "str", "vit", "agi", "dex", "luk"]),
    wings: Object.freeze(["hpPct", "mpPct", "critChance", "critDamage"])
  });

  function isV2Item(item) {
    return Number(item?.itemModelVersion) === 2 || Number(item?.rewardVersion) === 2;
  }
  function normalizeUnitRoll(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(0.999999999999, n));
  }
  function enhanceSuccessRate(level) {
    const current = Math.floor(Number(level));
    return current >= 0 && current < ENHANCE_MAX ? ENHANCE_RATES[current] : 0;
  }
  function itemTier(item) {
    if (String(item?.type || "").toLowerCase() === "wings") return null;
    const tier = Math.floor(Number(item?.gearTier));
    return TIER_ECONOMY[tier] ? tier : null;
  }
  function wingFamily(item) {
    if (String(item?.type || "").toLowerCase() !== "wings") return null;
    const raw = String(item?.wingFamily || item?.wingId || item?.wingsId || item?.setId || "").toLowerCase();
    return WING_PRIMARY_STAT[raw] ? raw : null;
  }
  function enhanceEconomyMultiplier(item) {
    if (String(item?.type || "").toLowerCase() === "wings") return wingFamily(item) ? TIER_ECONOMY[5] : null;
    const tier = itemTier(item);
    return tier ? TIER_ECONOMY[tier] : null;
  }
  function empowerEconomyMultiplier(item) {
    // Wings are intentionally tierless in W5. Their Empower economy is a
    // fixed, rarity-independent resource cost; rarity only controls capacity.
    if (String(item?.type || "").toLowerCase() === "wings") return wingFamily(item) ? 1 : null;
    const tier = itemTier(item);
    return tier ? TIER_ECONOMY[tier] : null;
  }
  function enhanceCost(item, level = item?.enhanceLevel) {
    const current = Math.floor(Number(level));
    const multiplier = enhanceEconomyMultiplier(item);
    if (!isV2Item(item) || current < 0 || current >= ENHANCE_MAX || !multiplier) return null;
    return Object.freeze({ iron: 1, gold: Math.round((25 + current * 35) * multiplier) });
  }
  function empowerCapacity(item) {
    if (!isV2Item(item)) return 0;
    const canonical = EMPOWER_CAPACITY[String(item?.rarity || "").toLowerCase()] || 0;
    const stored = Math.floor(Number(item?.empowerSlotCapacity));
    return stored === canonical ? canonical : 0;
  }
  function empowerOpenCost(item, slotIndex) {
    const index = Math.floor(Number(slotIndex));
    const multiplier = empowerEconomyMultiplier(item);
    if (!multiplier || index < 0 || index >= empowerCapacity(item) || index >= EMPOWER_OPEN_BASE_GOLD.length) return null;
    return Object.freeze({ manaOre: 1, gold: Math.round(EMPOWER_OPEN_BASE_GOLD[index] * multiplier) });
  }
  function empowerRerollCost(item, filledCount, lockedCount) {
    const filled = Math.floor(Number(filledCount));
    const locked = Math.floor(Number(lockedCount));
    const multiplier = empowerEconomyMultiplier(item);
    if (!multiplier || filled <= 0 || locked < 0 || locked >= filled) return null;
    return Object.freeze({ manaOre: 1, gold: Math.round((25 + filled * 15) * (1 + locked * 0.6) * multiplier) });
  }
  function validEmpowerPool(type) {
    return SLOT_POOLS[String(type || "").toLowerCase()] || Object.freeze([]);
  }
  function weightedValue(def, roll) {
    let cursor = normalizeUnitRoll(roll) * 100;
    for (let index = 0; index < def.values.length; index += 1) {
      cursor -= def.weights[index];
      if (cursor < 0) return def.values[index];
    }
    return def.values[def.values.length - 1];
  }
  function optionQuality(def, value) {
    if (def.values.length === 1) return "fixed";
    if (value === def.values[def.values.length - 1]) return "max";
    if (value === def.values[0]) return "low";
    return "normal";
  }
  function rollEmpowerOption(type, typeRoll, valueRoll) {
    const pool = validEmpowerPool(type);
    if (!pool.length) return null;
    const key = pool[Math.floor(normalizeUnitRoll(typeRoll) * pool.length)];
    const def = OPTION_DEFS[key];
    const value = weightedValue(def, valueRoll);
    return Object.freeze({ key, label: def.label, icon: def.icon, value, locked: false, quality: optionQuality(def, value), modelVersion: 2 });
  }
  function resolveEnhanceAttempt({ level, successRoll, downgradeRoll, protectionRequested, protectionStones }) {
    const current = Math.max(0, Math.min(ENHANCE_MAX, Math.floor(Number(level) || 0)));
    if (current >= ENHANCE_MAX) return Object.freeze({ ok: false, error: "enhance_max" });
    const success = normalizeUnitRoll(successRoll) * 100 < enhanceSuccessRate(current);
    if (success) return Object.freeze({ ok: true, success: true, levelBefore: current, levelAfter: current + 1, downgraded: false, protectionConsumed: false });
    const downgradeTriggered = current >= 6 && normalizeUnitRoll(downgradeRoll) < 0.5;
    const protectionConsumed = downgradeTriggered && protectionRequested === true && Math.floor(Number(protectionStones) || 0) > 0;
    return Object.freeze({
      ok: true,
      success: false,
      levelBefore: current,
      levelAfter: downgradeTriggered && !protectionConsumed ? Math.max(0, current - 1) : current,
      downgradeTriggered,
      downgraded: downgradeTriggered && !protectionConsumed,
      protectionConsumed
    });
  }
  function isValidEmpowerOption(type, option) {
    if (!option || !validEmpowerPool(type).includes(option.key)) return false;
    const def = OPTION_DEFS[option.key];
    return def.values.includes(Number(option.value)) && typeof option.locked === "boolean";
  }

  const api = Object.freeze({
    ENHANCE_MAX, ENHANCE_STAT_PCT, ENHANCE_RATES, TIER_ECONOMY, EMPOWER_CAPACITY,
    EMPOWER_OPEN_BASE_GOLD, WING_PRIMARY_STAT, OPTION_DEFS, SLOT_POOLS,
    isV2Item, enhanceSuccessRate, itemTier, wingFamily, enhanceEconomyMultiplier,
    empowerEconomyMultiplier, enhanceCost, empowerCapacity, empowerOpenCost,
    empowerRerollCost, validEmpowerPool, rollEmpowerOption, resolveEnhanceAttempt,
    isValidEmpowerOption
  });
  root.ENHANCEMENT_V2 = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
