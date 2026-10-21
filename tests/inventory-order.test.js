const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { applyInventoryOrder, loadInventoryOrder, saveInventoryOrder, sortInventoryDeterministic } = require("../src/systems/inventory.js");

const items = ids => ids.map(id => ({ id, type: "weapon", name: id, rarity: "rare" }));

test("Inventory order: saved Sort order survives the server returning items in another order", () => {
  const sortedIds = ["c", "a", "d", "b"];
  const serverOrder = items(["a", "b", "c", "d"]);
  assert.deepEqual(applyInventoryOrder(serverOrder, sortedIds).map(i => i.id), sortedIds);
});

test("Inventory order: sold items drop out and new/unequipped items are appended in their current order", () => {
  const saved = ["c", "a", "d", "b"];
  const afterSellAndUnequip = items(["b", "x", "a", "y", "c"]); // d sold; x unequipped; y new drop
  assert.deepEqual(applyInventoryOrder(afterSellAndUnequip, saved).map(i => i.id), ["c", "a", "b", "x", "y"]);
});

test("Inventory order: without a saved order the list is returned untouched", () => {
  const list = items(["a", "b"]);
  assert.equal(applyInventoryOrder(list, []), list);
  assert.equal(applyInventoryOrder(list, null), list);
  assert.deepEqual(applyInventoryOrder(null, ["a"]), []);
});

test("Inventory order: storage round-trips per character and tolerates bad data / missing storage", () => {
  const store = new Map();
  global.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  try {
    saveInventoryOrder("char-1", ["b", "a", 7, null]);
    assert.deepEqual(loadInventoryOrder("char-1"), ["b", "a"], "non-string ids are dropped");
    assert.deepEqual(loadInventoryOrder("char-2"), [], "other characters are independent");
    store.set("thornie.inventoryOrder.v1.char-3", "{not json");
    assert.deepEqual(loadInventoryOrder("char-3"), []);
    store.set("thornie.inventoryOrder.v1.char-4", JSON.stringify({ a: 1 }));
    assert.deepEqual(loadInventoryOrder("char-4"), []);
    assert.deepEqual(loadInventoryOrder(""), []);
  } finally {
    delete global.localStorage;
  }
  assert.doesNotThrow(() => saveInventoryOrder("char-1", ["a"]));
  assert.deepEqual(loadInventoryOrder("char-1"), []);
});

test("Inventory order: Sort stores the sorted ids and the overlay receives the ordered list", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src/ui/App.js"), "utf8");
  const sort = app.slice(app.indexOf("function sortInventoryNow()"), app.indexOf("function claimOverflowOne"));
  assert.match(sort, /saveInventoryOrder\(save && save\.characterId, sortedIds\)/);
  assert.match(sort, /setInventoryOrder\(sortedIds\)/);
  assert.match(app, /loadInventoryOrder\(save && save\.characterId\)/);
  assert.match(app, /React\.createElement\(InventoryOverlayV2, \{\s*equipped: equipped,\s*inventory: displayInventory,/);
  const sorted = sortInventoryDeterministic(items(["b", "a"]));
  assert.equal(applyInventoryOrder(items(["a", "b"]), sorted.map(i => i.id)).length, 2);
});

test("Ver 1.1.2: visible badge, meta and roadmap are in sync", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  assert.match(read("src/data/styles.js"), /content: "Ver 1\.1\.2"/);
  assert.match(read("head.html"), /name="application-version" content="1\.1\.2"/);
  assert.match(read("index.html"), /name="application-version" content="1\.1\.2"/);
  assert.match(read("docs/ACTIVE-DEVELOPMENT-ROADMAP-V3.md"), /Visible game version\s+Ver 1\.1\.2/);
});
