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

test("Ver 1.1.68: visible badge, meta and roadmap are in sync", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  assert.match(read("src/data/styles.js"), /content: "Ver 1\.1\.68"/);
  assert.match(read("head.html"), /name="application-version" content="1\.1\.68"/);
  // Generated index.html is checked after node build.js by the Frontend Production workflow.
  // The main-branch build job commits that generated output before Battle Core parity runs.
  // Keep this source/version assertion aligned with the production build marker.
  assert.match(read("docs/ACTIVE-DEVELOPMENT-ROADMAP-V3.md"), /Visible game version\s+Ver 1\.1\.68/);
});


test("Blacksmith Wave 3.1 uses a dedicated page and preserves existing operation handlers", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const page = read("src/ui/blacksmith.js");
  const app = read("src/ui/App.js");
  const styles = read("src/data/styles.js");
  assert.match(page, /className:"md-blacksmith-page"/);
  assert.doesNotMatch(page, /md-blacksmith-inventory/);
  assert.doesNotMatch(page, /md-equip-overlay|md-equip-sheet/);
  assert.match(page, /SLOT_ORDER\.filter\(s=>!!equipped\[s\]\)/);
  assert.match(page, /onClick:openSlot\?doEmpower:doReroll/);
  assert.match(page, /React\.createElement\(GameDock/);
  assert.match(app, /phase === "town" && !blacksmithOpen/);
  assert.match(app, /utilityDockProps\(phase\)/);
  assert.match(styles, /\.md-blacksmith-gear-grid \{ display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /Blacksmith mobile fit/);
  assert.match(styles, /md-blacksmith-detail\.expanded \{ max-height/);
  assert.match(styles, /md-blacksmith-heading \{ min-height:58px/);
});

test("Blacksmith V2.1 matches the reference layout: Enchant left / Refine right, always-visible actions, empty-state detail", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const page = read("src/ui/blacksmith.js");
  const styles = read("src/data/styles.js");
  // Enchant (left) comes before Refine (right) and the action bar is not gated on a selection.
  assert.ok(page.indexOf("md-blacksmith-action-enchant") > 0 && page.indexOf("md-blacksmith-action-enchant") < page.indexOf("md-blacksmith-action-refine"));
  assert.doesNotMatch(page, /detailTarget&&\s*\/\*#__PURE__\*\/React\.createElement\("section",\{className:"md-blacksmith-actions"/);
  assert.match(page, /disabled:busy\|\|!detailTarget\|\|\(openSlot\?!enchantCost:!canReroll\|\|!rerollCostValue\)/);
  // Detail starts expanded and shows three placeholder option rows until gear is selected.
  assert.match(page, /\[detailExpanded,setDetailExpanded\]=useState\(true\)/);
  assert.match(page, /renderPlaceholderOptions=\(\)=>[\s\S]*?\[0,1,2,3\]\.map/);
  assert.match(page, /Select equipped equipment/);
  // Header: single title, no kicker/subtitle; the gear cell no longer prints the slot label.
  assert.doesNotMatch(page, /md-blacksmith-kicker|THE ROYAL FORGE|md-blacksmith-gear-slot/);
  assert.match(page, /md-blacksmith-header-art/);
  // Presentation-only: handlers and server-authoritative callbacks are untouched.
  for (const h of ["onEnhance(detailTarget.id,useProtectionStone)", "onEmpower(detailTarget.id)", "onReroll(detailTarget.id)", "onToggleLock(it.id,i)"]) assert.ok(page.includes(h), h);
  // CSS: Forge ~62% / Gear ~38%, art hooks for future assets, square gear cells.
  assert.match(styles, /\.md-blacksmith-workbench \{ grid-template-columns:minmax\(0,1\.6fr\) minmax\(0,1fr\)/);
  assert.match(styles, /--bs-forge-art:none; --bs-header-art:none/);
  assert.match(styles, /\.md-blacksmith-gear-cell \{ aspect-ratio:1\/1/);
});

test("Blacksmith V2.2: global back button, separate scroll region, wireframe detail panel and result popup", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const page = read("src/ui/blacksmith.js");
  const styles = read("src/data/styles.js");
  // Back button reuses the shared overlay back button style.
  assert.match(page, /className:"md-shared-overlay-back md-blacksmith-back"/);
  assert.doesNotMatch(styles, /\.md-blacksmith-back[,\s]*\{/);
  // Gear + detail scroll together; actions and dock are outside the scroll region.
  const scrollAt = page.indexOf("md-blacksmith-scroll"), actionsAt = page.indexOf('className:"md-blacksmith-actions"'), dockAt = page.indexOf("GameDock,Object.assign");
  assert.ok(scrollAt > 0 && scrollAt < page.indexOf("md-blacksmith-workbench") && page.indexOf("md-blacksmith-detail ") < actionsAt && actionsAt < dockAt);
  assert.match(styles, /\.md-blacksmith-page \{ overflow:hidden; \}/);
  assert.match(styles, /\.md-blacksmith-scroll \{ flex:1 1 auto; min-height:0;[^}]*overflow-y:auto/);
  // Detail panel: large icon at the left, name + level, option rows, unique detail row.
  for (const c of ["md-blacksmith-detail-layout", "md-blacksmith-detail-icon", "md-blacksmith-detail-name", "md-blacksmith-detail-rows", "md-blacksmith-unique"]) assert.ok(page.includes(c), c);
  assert.match(page, /MYTHIC_V2\.signatureText\(detailTarget\)/);
  // Results are popups, not an inline message.
  assert.doesNotMatch(page, /md-blacksmith-message|setActionMsg|actionMsg/);
  assert.match(page, /md-inv2-modal-layer md-blacksmith-result-layer/);
  assert.match(page, /showResult\("enhance",res\)/);
  assert.match(page, /REFINE สำเร็จ/);
  assert.match(page, /REFINE ล้มเหลว/);
  // Gear icons were reduced.
  assert.match(styles, /\.md-blacksmith-gear-icon img \{ width:min\(100%,34px\)/);
});
