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

test("accessory utility selects exactly one approved stat with Tier/Rarity multipliers", () => {
  const accessory = reward.dungeonV2EquipmentItem({ floor: 31, type: "accessory", rarity: "unique", utilityKey: "critChance" });
  assert.deepEqual(Object.keys(accessory).filter(key => ["critChance", "dodgeChance", "critDamage"].includes(key)), ["critChance"]);
  assert.equal(accessory.utilityStat, "critChance");
  assert.equal(accessory.critChance, 3.7);
  assert.equal(accessory.empowerSlots.length, 2);
  for (const utilityKey of Object.keys(reward.ACCESSORY_BASE)) {
    const selected = reward.dungeonV2EquipmentItem({ floor: 1, type: "accessory", rarity: "rare", utilityKey });
    assert.equal(Object.keys(selected).filter(key => Object.hasOwn(reward.ACCESSORY_BASE, key)).length, 1);
    assert.equal(selected.utilityStat, utilityKey);
  }
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
  assert.equal(reward.dungeonV2FirstClearEligible({ floor: 10, encounterType: "chapter_boss", unlockedNext: true, firstClearAccessoryClaims: { 10: true } }), false);
  assert.deepEqual(reward.dungeonV2ClaimFirstClear({}, 10), { 10: true });
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

test("legacy rarity constants stay isolated from V2 multipliers", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/data/gameConfig.js"), "utf8");
  assert.match(source, /cfg\.rarityMult/);
  assert.match(source, /RARITY_MULT\[k\]/);
  assert.equal(reward.dungeonV2RarityMultiplier("unique"), 1.15);
  assert.equal(reward.dungeonV2RarityMultiplier("elite"), 1.3);
  const petsSource = fs.readFileSync(path.join(__dirname, "../src/systems/pets.js"), "utf8");
  assert.match(petsSource, /unique:\s*1\.9/);
  assert.match(petsSource, /elite:\s*3\.2/);
  assert.match(petsSource, /mythic:\s*5\.4/);
  assert.match(petsSource, /unique:\s*3,\s*elite:\s*5/);
});

test("existing item persistence remains additive and round-trips V2 metadata", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/state/serialize.js"), "utf8");
  const sandbox = {
    safeJsonParse: (value, fallback) => { try { return JSON.parse(value); } catch (e) { return fallback; } },
    emptyEquipped: () => ({ weapon: null, helmet: null, chest: null, gloves: null, boots: null, accessory: null, wings: null }),
    normalizeEquipmentNameForLoad: (type, name, gearTier) => ({ name, gearTier: Number(gearTier) || 0, migrated: false }),
    numOr: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    RARITY_STARS: { rare: 1, unique: 3, elite: 5, mythic: 7, azure: 5 },
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
  assert.equal(loaded.empowerSlotCapacity, 2);
  assert.equal(loaded.sourceFloor, 31);
  assert.equal(loaded.sourceIdentity, "jelly_slime");
});

test("W3 routes both V2 and legacy blacksmith mutations to the authoritative API", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "../src/ui/App.js"), "utf8");
  assert.match(appSource, /cloudMutateV2Blacksmith/);
  assert.match(appSource, /cloudMutateLegacyBlacksmith/);
  for (const action of ["enhance", "empower_open", "empower_reroll", "empower_lock"]) assert.match(appSource, new RegExp(`type: \\"${action}\\"`));
  assert.match(appSource, /ENHANCEMENT_V2\.isV2Item/);
  assert.doesNotMatch(appSource, /Math\.random\(\) \* 100 < enhanceSuccessRate\(level\)/);
  assert.doesNotMatch(appSource, /rollEmpowerBonus\(it\.rarity\)/);
  const workerSource = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  assert.match(workerSource, /function handleMutateLegacyBlacksmith/);
  const rewardSource = fs.readFileSync(path.join(__dirname, "../src/systems/rewardV2.js"), "utf8");
  assert.match(rewardSource, /itemModelVersion\) === 2/);
  assert.match(rewardSource, /rewardVersion\) === 2/);
});

test("permanent first-clear claims are not stored in the rolling battle receipt", () => {
  const saveSource = fs.readFileSync(path.join(__dirname, "../src/state/save.js"), "utf8");
  const workerSource = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  assert.match(saveSource, /firstClearAccessoryClaims/);
  assert.match(saveSource, /battleRewardReceipts/);
  assert.match(workerSource, /envelope\.firstClearAccessoryClaims = nextClaims/);
  assert.match(workerSource, /battleReceipts = \[\.\.\.new Set/);
  assert.match(workerSource, /db\.batch\(\[completionStmt, characterStmt, playerStmt/);
  assert.match(workerSource, /AND changes\(\) > 0/);
});

test("legacy item fallback slots and sell values remain unchanged", () => {
  const serializeSource = fs.readFileSync(path.join(__dirname, "../src/state/serialize.js"), "utf8");
  const sandbox = {
    safeJsonParse: (value, fallback) => { try { return JSON.parse(value); } catch (e) { return fallback; } },
    emptyEquipped: () => ({ weapon: null, helmet: null, chest: null, gloves: null, boots: null, accessory: null, wings: null }),
    normalizeEquipmentNameForLoad: (type, name, gearTier) => ({ name, gearTier: Number(gearTier) || 0, migrated: false }),
    numOr: (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback,
    RARITY_STARS: { rare: 1, unique: 3, elite: 5, mythic: 7, azure: 5 },
    JUNK_INFO: {}, getPotionDef: () => null, console
  };
  vm.createContext(sandbox);
  vm.runInContext(`${serializeSource}\nthis.itemsFromServerList = itemsFromServerList;`, sandbox);
  const rows = ["rare", "unique", "elite", "mythic", "azure"].map((rarity, index) => ({
    item_id: `legacy-${rarity}`, slot_type: "weapon", equipped: 0, rarity, name: "Old Weapon", atk: 10,
    def: 0, hp: 0, mp: 0, enhance_level: 0, item_level: 0, extra_json: "{}", inventory_slot: index
  }));
  assert.deepEqual(Array.from(sandbox.itemsFromServerList(rows).inventory, item => item.empowerSlots.length), [1, 3, 5, 7, 5]);

  const shopSource = fs.readFileSync(path.join(__dirname, "../src/systems/shop.js"), "utf8");
  const shopSandbox = { RARITY_MULT: { rare: 1, unique: 1.9, elite: 3.2, mythic: 5.4, azure: 5.4 }, JUNK_SELL_VALUE: {} };
  vm.createContext(shopSandbox);
  vm.runInContext(`${shopSource}\nthis.sellPrice = sellPrice;`, shopSandbox);
  assert.equal(shopSandbox.sellPrice({ type: "weapon", rarity: "unique", atk: 10 }), 51);
  assert.equal(shopSandbox.sellPrice({ type: "weapon", rarity: "mythic", atk: 10 }), 146);
});
