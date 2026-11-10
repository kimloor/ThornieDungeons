const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const v2 = require("../src/systems/enhancementV2.js");

function item(overrides = {}) {
  return {
    id: "v2-item",
    type: "weapon",
    rarity: "mythic",
    gearTier: 1,
    rewardVersion: 2,
    itemModelVersion: 2,
    empowerSlotCapacity: 4,
    enhanceLevel: 0,
    empowerSlots: [null, null, null, null],
    atk: 100,
    ...overrides
  };
}

test("Enhance V2 locks +0 through +10 rates and exact Tier economy", () => {
  assert.deepEqual(Array.from(v2.ENHANCE_RATES), [95, 90, 82, 72, 60, 50, 40, 30, 20, 15]);
  for (let level = 0; level < 10; level++) assert.equal(v2.enhanceSuccessRate(level), v2.ENHANCE_RATES[level]);
  for (let level = 0; level < 10; level++) {
    const result = v2.resolveEnhanceAttempt({ level, successRoll: 0, downgradeRoll: 0, protectionRequested: false, protectionStones: 0 });
    assert.deepEqual({ before: result.levelBefore, after: result.levelAfter }, { before: level, after: level + 1 });
  }
  assert.equal(v2.enhanceSuccessRate(10), 0);
  const expectedAtSix = { 1: 235, 2: 529, 3: 881, 4: 1351, 5: 1998 };
  for (let tier = 1; tier <= 5; tier++) {
    assert.deepEqual(v2.enhanceCost(item({ gearTier: tier }), 6), { iron: 1, gold: expectedAtSix[tier] });
  }
});

test("Enhance failure boundary, 50% downgrade, and Protection consumption are exact", () => {
  const early = v2.resolveEnhanceAttempt({ level: 5, successRoll: 0.99, downgradeRoll: 0, protectionRequested: true, protectionStones: 1 });
  assert.deepEqual({ level: early.levelAfter, downgrade: early.downgradeTriggered, consumed: early.protectionConsumed }, { level: 5, downgrade: false, consumed: false });
  const keep = v2.resolveEnhanceAttempt({ level: 6, successRoll: 0.99, downgradeRoll: 0.5, protectionRequested: false, protectionStones: 0 });
  assert.deepEqual({ level: keep.levelAfter, downgrade: keep.downgradeTriggered }, { level: 6, downgrade: false });
  const down = v2.resolveEnhanceAttempt({ level: 6, successRoll: 0.99, downgradeRoll: 0.499999, protectionRequested: false, protectionStones: 0 });
  assert.deepEqual({ level: down.levelAfter, downgraded: down.downgraded }, { level: 5, downgraded: true });
  const protectedResult = v2.resolveEnhanceAttempt({ level: 6, successRoll: 0.99, downgradeRoll: 0, protectionRequested: true, protectionStones: 1 });
  assert.deepEqual({ level: protectedResult.levelAfter, consumed: protectedResult.protectionConsumed }, { level: 6, consumed: true });
  const success = v2.resolveEnhanceAttempt({ level: 6, successRoll: 0, downgradeRoll: 0, protectionRequested: true, protectionStones: 1 });
  assert.deepEqual({ level: success.levelAfter, consumed: success.protectionConsumed }, { level: 7, consumed: false });
});

test("W5 Raid Wing Enhance uses tierless Empower cost and grants only its family Primary Stat", () => {
  for (const [family, primary] of Object.entries({ azure: "agi", robot: "vit", skeleton: "str" })) {
    const wing = item({ type: "wings", rarity: "rare", empowerSlotCapacity: 1, empowerSlots: [null], gearTier: undefined, wingFamily: family, enhanceLevel: 5 });
    assert.deepEqual(v2.enhanceCost(wing), { iron: 1, gold: Math.round((25 + 5 * 35) * 8.5) });
    assert.equal(v2.WING_PRIMARY_STAT[family], primary);
    assert.deepEqual(v2.empowerOpenCost(wing, 0), { manaOre: 1, gold: 30 });
  }
});

test("Empower capacity, slot filtering, ranges, and equal type weighting are locked", () => {
  for (const [rarity, capacity] of Object.entries({ rare: 1, unique: 2, elite: 3, mythic: 4 })) {
    assert.equal(v2.empowerCapacity(item({ rarity, empowerSlotCapacity: capacity, empowerSlots: Array(capacity).fill(null) })), capacity);
  }
  const all = new Set(Object.values(v2.SLOT_POOLS).flat());
  assert.deepEqual([...all].sort(), ["agi", "atkPct", "critChance", "critDamage", "defPct", "dex", "hpPct", "luk", "mpPct", "str", "vit"].sort());
  for (const blocked of ["accuracy", "dodgeChance", "dropBonus"]) assert.equal(all.has(blocked), false);
  assert.deepEqual(Array.from(v2.validEmpowerPool("wings")), ["hpPct", "mpPct", "critChance", "critDamage"]);
  for (const [type, pool] of Object.entries(v2.SLOT_POOLS)) {
    pool.forEach((key, index) => {
      const option = v2.rollEmpowerOption(type, (index + 0.1) / pool.length, 0);
      assert.equal(option.key, key);
      assert.equal(v2.isValidEmpowerOption(type, option), true);
    });
  }
});

test("Empower weighted value boundaries match every approved distribution", () => {
  const cases = {
    atkPct: [[0, 4], [.249999, 4], [.25, 5], [.50, 6], [.75, 7], [.90, 8]],
    defPct: [[0, 3], [.35, 4], [.70, 5], [.90, 6]],
    hpPct: [[0, 1], [.50, 2], [.85, 3]],
    mpPct: [[0, 2], [.50, 3], [.85, 4]],
    critChance: [[0, 1], [.75, 2]],
    critDamage: [[0, 2], [.50, 3], [.85, 4]]
  };
  for (const [key, boundaries] of Object.entries(cases)) {
    const type = Object.keys(v2.SLOT_POOLS).find(slot => v2.SLOT_POOLS[slot].includes(key));
    const index = v2.SLOT_POOLS[type].indexOf(key);
    const typeRoll = (index + 0.1) / v2.SLOT_POOLS[type].length;
    for (const [roll, expected] of boundaries) assert.equal(v2.rollEmpowerOption(type, typeRoll, roll).value, expected, `${key} @ ${roll}`);
  }
  for (const primary of ["str", "vit", "agi", "dex", "luk"]) {
    const type = Object.keys(v2.SLOT_POOLS).find(slot => v2.SLOT_POOLS[slot].includes(primary));
    const index = v2.SLOT_POOLS[type].indexOf(primary);
    assert.equal(v2.rollEmpowerOption(type, (index + 0.1) / v2.SLOT_POOLS[type].length, .99).value, 1);
  }
});

test("Empower opening and reroll Mana Ore/Gold costs are exact", () => {
  const expectedOpen = {
    1: [30, 75, 120, 165], 2: [68, 169, 270, 371], 3: [113, 281, 450, 619],
    4: [173, 431, 690, 949], 5: [255, 638, 1020, 1403]
  };
  for (let tier = 1; tier <= 5; tier++) {
    const current = item({ gearTier: tier });
    assert.deepEqual([0, 1, 2, 3].map(index => v2.empowerOpenCost(current, index).gold), expectedOpen[tier]);
    assert.equal(v2.empowerOpenCost(current, 0).manaOre, 1);
  }
  const t5 = item({ gearTier: 5 });
  assert.deepEqual([0, 1, 2, 3].map(locked => v2.empowerRerollCost(t5, 4, locked).gold), [723, 1156, 1590, 2023]);
  assert.equal(v2.empowerRerollCost(t5, 4, 3).manaOre, 1);
});

test("V2 stat pipeline is additive, non-compounding, item-aware, and reload-stable", () => {
  const enhancementSource = fs.readFileSync(path.join(__dirname, "../src/systems/enhancementV2.js"), "utf8");
  const statsSource = fs.readFileSync(path.join(__dirname, "../src/systems/stats.js"), "utf8");
  const sandbox = { console, module: { exports: {} }, BASE_SPEED: 100, ENHANCE_STAT_PCT: 0.06, RARITY_STARS: { rare: 1 }, DUNGEON_V2: {}, FLOOR_MODIFIERS: [], BOSS_POOL: [], ENEMY_POOL: [] };
  vm.createContext(sandbox);
  vm.runInContext(`${enhancementSource}\n${statsSource}\nthis.itemBonus=itemBonus;this.getStats=getStats;`, sandbox);
  const weapon = item({ enhanceLevel: 10, empowerSlots: [
    { key: "atkPct", value: 5, locked: false }, { key: "atkPct", value: 7, locked: false },
    { key: "str", value: 1, locked: false }, { key: "dex", value: 1, locked: false }
  ] });
  const bonus = sandbox.itemBonus(weapon);
  assert.equal(bonus.atk, 172, "100 base +60% Enhance +12% duplicate Empower");
  assert.deepEqual({ str: bonus.str, dex: bonus.dex }, { str: 1, dex: 1 });
  const helmet = item({ type: "helmet", rarity: "elite", empowerSlotCapacity: 3, empowerSlots: [
    { key: "hpPct", value: 3, locked: false }, { key: "hpPct", value: 2, locked: false }, { key: "mpPct", value: 4, locked: false }
  ], atk: 0, def: 20, enhanceLevel: 0 });
  const player = { baseAtk: 10, baseDef: 2, baseMaxHp: 100, baseMaxMp: 50, baseSpeed: 100, accuracy: 80, critChance: 0, critDamage: 50, dodgeChance: 0, dropBonus: 0, primaryStats: { str: 0, vit: 0, agi: 0, dex: 0, luk: 0 } };
  const result = sandbox.getStats(player, { weapon, helmet });
  assert.equal(result.maxHp, 105);
  assert.equal(result.maxMp, 52);
  assert.equal(sandbox.itemBonus(JSON.parse(JSON.stringify(weapon))).atk, 172, "save/reload cannot double-apply");
});
