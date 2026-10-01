const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const reward = require("../src/systems/rewardV2.js");

test("Reward V2 tier boundaries are locked and do not drift within a tier", () => {
  assert.deepEqual([1, 30, 31, 50, 51, 70, 71, 90, 91, 110].map(reward.dungeonV2GearTierForFloor), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(reward.dungeonV2GearTierForFloor(999), 5);
  assert.equal(reward.dungeonV2TierMultiplier(1), 1);
  assert.equal(reward.dungeonV2TierMultiplier(5), 2.856);
});

test("fixed Rare equipment budgets match every locked Tier and slot", () => {
  const expected = reward.BASE_STATS;
  for (let tier = 1; tier <= 5; tier++) {
    for (const type of reward.GENERIC_SLOTS) {
      const first = reward.dungeonV2EquipmentItem({ floor: [1, 31, 51, 71, 91][tier - 1], type, rarity: "rare" });
      const second = reward.dungeonV2EquipmentItem({ floor: [30, 50, 70, 90, 110][tier - 1], type, rarity: "rare" });
      const key = type === "weapon" || type === "gloves" ? "atk" : "def";
      assert.equal(first[key], expected[type][tier - 1], `${type} T${tier}`);
      assert.equal(second[key], expected[type][tier - 1], `${type} T${tier} upper boundary`);
    }
  }
  assert.equal(reward.dungeonV2EquipmentItem({ floor: 1, type: "weapon", rarity: "unique" }).atk, 16);
  assert.equal(reward.dungeonV2EquipmentItem({ floor: 1, type: "weapon", rarity: "elite" }).atk, 18);
  assert.equal(reward.dungeonV2EquipmentItem({ floor: 1, type: "weapon", rarity: "mythic" }).atk, 21);
});

test("accessory utility uses only the approved three stats and Tier/Rarity multipliers", () => {
  const accessory = reward.dungeonV2EquipmentItem({ floor: 31, type: "accessory", rarity: "unique" });
  assert.deepEqual(Object.keys(accessory).filter(key => ["critChance", "dodgeChance", "critDamage"].includes(key)).sort(), ["critChance", "critDamage", "dodgeChance"]);
  assert.equal(accessory.critChance, 3.7);
  assert.equal(accessory.dodgeChance, 3);
  assert.equal(accessory.critDamage, 12);
  assert.equal(accessory.empowerSlots.length, 2);
});

test("normal drop chance is multiplicative, capped per encounter, and generic-only", () => {
  assert.equal(reward.dungeonV2GenericEquipmentChance("normal", 0), 0.04);
  assert.equal(reward.dungeonV2GenericEquipmentChance("normal", 20), 0.048);
  assert.equal(reward.dungeonV2GenericEquipmentChance("elite", 90), 0.08);
  assert.equal(reward.dungeonV2GenericEquipmentChance("chapter_boss", 100), 0);
  const drops = [1, 2, 3].map(() => reward.dungeonV2GenerateEquipment({ floor: 30, sourceType: "dungeon_normal", rng: () => 0.99 }));
  assert.ok(drops.every(item => reward.GENERIC_SLOTS.includes(item.type)));
  assert.ok(drops.every(item => item.rarity !== "mythic"));
});

test("rarity bands total 100 and deterministic boundaries never unlock Mythic", () => {
  for (const band of reward.RARITY_BANDS) {
    assert.equal(Object.values(band.weights).reduce((sum, value) => sum + value, 0), 100);
    assert.equal(reward.dungeonV2RollRarity(band.minFloor, () => 0), "rare");
    assert.equal(reward.dungeonV2RollRarity(band.minFloor, () => (band.weights.rare + band.weights.unique) / 100), "elite");
  }
});

test("Elite role is one capped roll and Boss role has no generic equipment", () => {
  assert.equal(reward.dungeonV2RewardExp(30, "elite", 3), 117);
  assert.equal(reward.dungeonV2RewardGold(30, "elite", 3), 165);
  assert.equal(reward.dungeonV2GenericEquipmentChance("elite"), 0.08);
  assert.equal(reward.dungeonV2GenericEquipmentChance("chapter_boss"), 0);
  assert.equal(reward.dungeonV2RewardExp(30, "chapter_boss", 1), 156);
  assert.equal(reward.dungeonV2RewardGold(30, "chapter_boss", 1), 220);
});

test("EXP and Gold references and normal pack multipliers match the contract", () => {
  assert.deepEqual([1, 10, 30, 50, 70, 90, 110].map(floor => reward.dungeonV2RewardExp(floor)), [8, 30, 78, 126, 174, 222, 270]);
  assert.equal(reward.dungeonV2RewardExp(30, "normal", 2), 105);
  assert.equal(reward.dungeonV2RewardExp(30, "normal", 3), 129);
  assert.equal(reward.dungeonV2RewardGold(1), 23);
  assert.equal(reward.dungeonV2RewardGold(30), 110);
  assert.equal(reward.dungeonV2RewardGold(31), 120);
  assert.equal(reward.dungeonV2RewardGold(51), 210);
  assert.equal(reward.dungeonV2RewardGold(71), 320);
  assert.equal(reward.dungeonV2RewardGold(91), 480);
  assert.equal(reward.dungeonV2RewardGold(30, "normal", 2), 149);
  assert.equal(reward.dungeonV2RewardGold(30, "normal", 3), 182);
});

test("First-Clear Accessory table, metadata, and exact-once receipts are deterministic", () => {
  assert.deepEqual(reward.dungeonV2FirstClearAccessory(10), { gearTier: 1, rarity: "rare" });
  assert.deepEqual(reward.dungeonV2FirstClearAccessory(110), { gearTier: 5, rarity: "elite" });
  assert.equal(reward.dungeonV2FirstClearAccessory(11), null);
  assert.equal(reward.dungeonV2FirstClearEligible({ floor: 10, encounterType: "chapter_boss", unlockedNext: true, receipts: [] }), true);
  assert.equal(reward.dungeonV2FirstClearEligible({ floor: 10, encounterType: "chapter_boss", unlockedNext: false, receipts: [] }), false);
  const key = reward.dungeonV2FirstClearReceiptKey(10);
  assert.equal(reward.dungeonV2FirstClearEligible({ floor: 10, encounterType: "chapter_boss", unlockedNext: true, receipts: [key] }), false);
  const item = reward.dungeonV2EquipmentItem({ floor: 10, type: "accessory", rarity: "rare", sourceType: "dungeon_boss_first_clear", specialSource: "first_clear_accessory", sourceIdentity: "moss_king" });
  assert.deepEqual({ sourceType: item.sourceType, sourceFloor: item.sourceFloor, gearTier: item.gearTier, rarity: item.rarity, type: item.type, specialSource: item.specialSource }, {
    sourceType: "dungeon_boss_first_clear", sourceFloor: 10, gearTier: 1, rarity: "rare", type: "accessory", specialSource: "first_clear_accessory"
  });
  assert.deepEqual(reward.dungeonV2AppendReceipts(["old"], ["old", key]), ["old", key]);
});

test("monster_loot custom rows use the V2 fallback architecture and cannot bypass caps", () => {
  const custom = { gear: [{ itemType: "weapon", rarity: "unique", weight: 1 }, { itemType: "accessory", rarity: "mythic", weight: 99 }] };
  assert.deepEqual(reward.dungeonV2CustomLootChoice(custom, () => 0), { itemType: "weapon", rarity: "unique" });
  assert.equal(reward.dungeonV2CustomLootChoice({ gear: [{ itemType: "accessory", rarity: "mythic", weight: 1 }] }, () => 0), null);
  const fallback = reward.dungeonV2GenerateEquipment({ floor: 1, lootTable: { gear: [] }, rng: () => 0 });
  assert.ok(reward.GENERIC_SLOTS.includes(fallback.type));
  assert.notEqual(fallback.rarity, "mythic");
});

test("normal R/U/E salvage is authoritative and Mythic cannot fall through", () => {
  assert.deepEqual(reward.dungeonV2SalvageYield("rare"), { iron: 2, manaOre: 0 });
  assert.deepEqual(reward.dungeonV2SalvageYield("unique"), { iron: 4, manaOre: 1 });
  assert.deepEqual(reward.dungeonV2SalvageYield("elite"), { iron: 8, manaOre: 3 });
  assert.equal(reward.dungeonV2SalvageYield("mythic"), null);
  assert.equal(reward.dungeonV2SalvageYield("rare", { sourceType: "boss_weapon" }), null);
});

test("Shop V2 prices follow eligible Tier and never expose Mythic as normal stock", () => {
  assert.deepEqual([1, 31, 51, 71, 91].map(reward.dungeonV2ShopTier), [1, 2, 3, 4, 5]);
  assert.equal(reward.dungeonV2ShopPrice(1, "rare"), 800);
  assert.equal(reward.dungeonV2ShopPrice(5, "elite"), 20000);
  assert.equal(reward.dungeonV2ShopPrice(3, "mythic"), 0);
  const shopSource = fs.readFileSync(path.join(__dirname, "../src/systems/salvage.js"), "utf8");
  assert.match(shopSource, /const PROTECTION_STONE_PRICE = 30/);
});

test("legacy remote rarity rows cannot override V2 multipliers", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/gameConfig.js"), "utf8");
  assert.doesNotMatch(source, /RARITY_MULT\s*=\s*\{/);
});

test("existing item persistence remains additive and round-trips V2 metadata", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/state/serialize.js"), "utf8");
  const sandbox = {
    safeJsonParse: (value, fallback) => { try { return JSON.parse(value); } catch (e) { return fallback; } },
    emptyEquipped: () => ({ weapon: null, helmet: null, chest: null, gloves: null, boots: null, accessory: null, wings: null }),
    normalizeEquipmentNameForLoad: (type, name, gearTier) => ({ name, gearTier: Number(gearTier) || 0, migrated: false }),
    numOr: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    RARITY_STARS: { rare: 1, unique: 2, elite: 3, mythic: 4 },
    JUNK_INFO: {},
    getPotionDef: () => null,
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}\nthis.itemsToServerList = itemsToServerList; this.itemsFromServerList = itemsFromServerList;`, sandbox);
  const item = reward.dungeonV2EquipmentItem({ floor: 31, type: "weapon", rarity: "unique", sourceType: "dungeon_normal", sourceIdentity: "jelly_slime" });
  const rows = sandbox.itemsToServerList([item], sandbox.emptyEquipped(), []);
  const loaded = sandbox.itemsFromServerList(rows.map(row => ({
    item_id: row.itemId, slot_type: row.slotType, equipped: row.equipped ? 1 : 0,
    rarity: row.rarity, name: row.name, atk: row.atk, def: row.def, hp: row.hp, mp: row.mp,
    enhance_level: row.enhanceLevel, item_level: row.itemLevel, extra_json: JSON.stringify(row.extra)
  }))).inventory[0];
  assert.equal(loaded.rewardVersion, 2);
  assert.equal(loaded.sourceFloor, 31);
  assert.equal(loaded.sourceIdentity, "jelly_slime");
});
