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

test("Equipment comparison renders GameIcon on current and new sides", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const compare = components.slice(components.indexOf("compareRows.length > 0"), components.indexOf("md-inv2-lock", components.indexOf("compareRows.length > 0")));
  assert.match(compare, /item:currentEquipped/);
  assert.match(compare, /item:currentDetail/);
  assert.equal((compare.match(/React\.createElement\(GameIcon/g) || []).length, 2);
  assert.match(compare, /currentEquipped \? itemDisplayName\(currentEquipped\) : "Empty Slot"/);
});
