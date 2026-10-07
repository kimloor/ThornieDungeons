const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const inventorySystem = require(path.join(ROOT, "src/systems/inventory.js"));

function gear(index) {
  return { id: `gear-${index}`, type: "weapon", name: `Gear ${index}`, rarity: "common" };
}

test("Inventory V2 enforces 30 real carried slots and persists excess in Overflow", () => {
  const full = Array.from({ length: 30 }, (_, index) => gear(index));
  const result = inventorySystem.insertInventoryItems(full, [], [gear(31)]);
  assert.equal(result.inventory.length, 30);
  assert.equal(result.overflow.length, 1);
  assert.equal(result.overflow[0].id, "gear-31");
});

test("stack merges do not consume a slot and partial claims remain safe", () => {
  const almostFull = [
    { id: "iron", type: "junk", junkId: "iron", quantity: 95 },
    ...Array.from({ length: 29 }, (_, index) => gear(index))
  ];
  const inserted = inventorySystem.insertInventoryItems(almostFull, [], [{ id: "reward", type: "junk", junkId: "iron", quantity: 10 }]);
  assert.equal(inserted.inventory.length, 30);
  assert.equal(inserted.inventory[0].quantity, 99);
  assert.equal(inserted.overflow[0].quantity, 6);
  const claimed = inventorySystem.claimOverflowItem(inserted.inventory, inserted.overflow, inserted.overflow[0].id);
  assert.equal(claimed.claimed, 0);
  assert.equal(claimed.overflow[0].quantity, 6);
});

test("deterministic sort and Mythic display normalization follow V2 contract", () => {
  const sorted = inventorySystem.sortInventoryDeterministic([
    { id:"b", type:"junk", junkId:"iron", rarity:"common" },
    { id:"a", type:"weapon", rarity:"rare", enhanceLevel:2 },
    { id:"c", type:"helmet", rarity:"azure", enhanceLevel:0 }
  ]);
  assert.deepEqual(sorted.map(item => item.id), ["c", "a", "b"]);
  assert.equal(inventorySystem.inventoryRarityKey(sorted[0]), "mythic");
});

test("Inventory V2 wiring removes duplicate inventory chrome and prewires optional art", () => {
  const app = fs.readFileSync(path.join(ROOT, "src/ui/App.js"), "utf8");
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const manifest = fs.readFileSync(path.join(ROOT, "src/assets/manifest.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  assert.match(app, /React\.createElement\(InventoryOverlayV2/);
  assert.match(components, /const visibleCount = expanded \? INVENTORY_CAPACITY : 10/);
  assert.doesNotMatch(components.slice(components.indexOf("function InventoryOverlayV2"), components.indexOf("function InventoryOverlay({")), /Quick Slots|gold|diamonds|protectionStones/);
  assert.match(manifest, /optionalAsset\(`inventoryUi\.\$\{key\}`\)/);
  assert.match(styles, /--safe-top:\s*env\(safe-area-inset-top/);
  assert.match(styles, /@media \(min-width:431px\) and \(max-width:700px\)/);
});

test("Equipment comparison renders real current/candidate data with compact metadata", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  assert.match(compare, /item: item \|\| \{\}/);
  assert.match(compare, /currentEquipped/);
  assert.match(compare, /currentDetail/);
  assert.equal((compare.match(/React\.createElement\(GameIcon/g) || []).length, 1);
  assert.match(compare, /rarityLabel\(item\)/);
  assert.match(compare, /SLOT_LABEL\[type\]/);
  assert.match(compare, /Refine/);
  assert.match(compare, /Enchant/);
  assert.match(compare, /Equipped/);
  assert.match(compare, /Candidate/);
});

test("Inventory V2 uses the standard authenticated shell and icon-only tools", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const inventory = components.slice(components.indexOf("function InventoryHeader"), components.indexOf("function InventoryOverlay({"));
  assert.match(inventory, /React\.createElement\(StatusBar/);
  assert.match(inventory, /React\.createElement\(GameDock/);
  assert.match(inventory, /activeKey:"inventory"/);
  assert.match(inventory, /aria-label":"Filter"/);
  assert.match(inventory, /aria-label":"Sort"/);
  assert.doesNotMatch(inventory, />Filter</);
  assert.doesNotMatch(inventory, />Sort</);
  assert.equal((inventory.match(/\$\{inventoryCount\}\/\$\{INVENTORY_CAPACITY\}/g) || []).length, 1);
  assert.doesNotMatch(inventory, /md-inv2-lock/);
  assert.match(inventory, /md-inv2-favorite-toggle/);
});

test("Inventory compare separates Base, Refine and Enchant rows in the one-screen grid", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const compareFn = components.slice(components.indexOf("function inventoryComparisonRows"), components.indexOf("function InventoryOverlayV2"));
  assert.match(compareFn, /inventoryRawBaseStats\(item\)/);
  assert.match(compareFn, /inventoryRefineStats\(item\)/);
  assert.match(compareFn, /inventoryEnchantStats\(item\)/);
  assert.doesNotMatch(compareFn, /itemBonus\(currentItem\)|itemBonus\(nextItem\)/);
  assert.doesNotMatch(compareFn, /getStats|combatPower|freshPlayerFromSave/);
  assert.match(compareFn, /\(Base\)/);
  assert.match(compareFn, /\(Refine\)/);
  assert.match(compareFn, /\(Enchant\)/);
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  assert.match(compare, /md-inv2-compare-one-screen/);
  assert.match(compare, /md-inv2-compare-delta/);
  assert.match(compare, /deltaClass/);
  assert.match(compare, /Base, Refine and Enchant are shown separately/);
});

test("Inventory detail shows Mythic boss-weapon signature and separated stat sections", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const detail = components.slice(components.indexOf("function ItemDetailModal"), components.indexOf("function InventoryOverlayV2"));
  assert.match(detail, /MYTHIC_V2\.signatureText\(currentDetail\)/);
  assert.match(components, /\["base", "BASE STATS"\]/);
  assert.match(components, /\["refine", "REFINE"\]/);
  assert.match(components, /ENCHANT OPTIONS/);
});

test("Inventory detail keeps corner controls separate and previews salvage yield from the shared table", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  const inventory = components.slice(components.indexOf("function InventoryHeader"), components.indexOf("function InventoryOverlay({"));
  assert.match(styles, /\.md-inv2-popup-close \{ position:absolute !important; right:10px; top:10px/);
  assert.match(styles, /\.md-inv2-favorite-toggle[^}]*top:10px; left:10px/);
  assert.match(inventory, /const salvagePreview = [\s\S]*inventorySalvagePreview\(currentDetail\)/);
  assert.match(components, /MYTHIC_V2\.setSalvage/);
  assert.match(inventory, /className:"md-inv2-salvage-preview"/);
  assert.match(components, /function inventorySalvagePreview\(item\)/);
  assert.match(components, /salvageYield\(item\.rarity, item\)/);
  assert.match(inventory, /ได้รับ \$\{yieldText\}/);
});

test("Inventory W1 decomposes InventoryOverlayV2 and exposes read-only item helpers", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  [
    "InventoryHeader", "EquipmentStage", "EquipmentSlot", "InventoryToolbar",
    "InventoryGrid", "InventoryCell", "InventoryFilterModal", "OverflowModal",
    "ItemDetailModal", "ItemStats", "ItemComparison", "ItemActions"
  ].forEach(name => assert.match(components, new RegExp(`function ${name}\\(`)));

  const gearItem = { id:"runtime-1", item_id:"backend-1", type:"weapon", quantity:3, favorite:true };
  const equipped = { weapon:gearItem };
  assert.equal(inventorySystem.inventoryItemRuntimeId(gearItem), "runtime-1");
  assert.equal(inventorySystem.inventoryItemBackendId(gearItem), "backend-1");
  assert.equal(inventorySystem.inventoryItemType(gearItem), "weapon");
  assert.equal(inventorySystem.inventoryItemQuantity(gearItem), 3);
  assert.equal(inventorySystem.inventoryItemLocked(gearItem), true);
  assert.equal(inventorySystem.inventoryItemEquippedSlot(gearItem, equipped), "weapon");
  assert.equal(inventorySystem.isInventoryItemEquipped(gearItem, equipped), true);
  assert.deepEqual(inventorySystem.inventoryItemLocation(gearItem, equipped), { equipped:true, location:"equipped", slot:"weapon" });
  assert.equal(inventorySystem.inventoryItemJunkId({ type:"junk", junkId:"iron" }), "iron");
  assert.equal(inventorySystem.inventoryItemPotionId({ type:"potion", potionId:"small_hp" }), "small_hp");
});

test("Inventory compare modal avoids nested scrolling and uses compact mobile layout", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  const detailStart = components.indexOf("function ItemDetailModal");
  const detailEnd = components.indexOf("function InventoryOverlayV2", detailStart);
  const detail = components.slice(detailStart, detailEnd);
  assert.match(detail, /!compareRows\.length && .*md-inv2-detail-head/);
  assert.match(detail, /!compareRows\.length && .*ItemStats/);
  assert.match(styles, /\.md-inv2-detail \{[^}]*overflow:hidden/);
  assert.match(styles, /\.md-inv2-detail-layer \{ align-items:center/);
  assert.match(styles, /\.md-inv2-compare-one-screen/);
  assert.match(styles, /@media \(max-width:430px\)/);
  assert.doesNotMatch(styles, /\.md-inv2-detail-layer \{ align-items:flex-end/);
});


