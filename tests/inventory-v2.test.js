const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
  assert.match(styles, /--safe-top:\s*var\(--safe-top-eff\)/);
  assert.match(styles, /@media \(min-width:431px\) and \(max-width:700px\)/);
});

test("Equipment comparison renders real current/candidate data with compact metadata", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  assert.ok(compare.includes("item: selected || {}"));
  assert.match(compare, /currentEquipped/);
  assert.match(compare, /currentDetail/);
  assert.equal((compare.match(/React\.createElement\(GameIcon/g) || []).length, 1);
  assert.ok(compare.includes("rarityLabel(selected)"));
  assert.match(compare, /SLOT_LABEL\[type\]/);
  assert.match(compare, /Refine/);
  assert.match(compare, /Enchant/);
  assert.match(compare, /md-inv2-compare-selected-icon-frame/);
  assert.match(compare, /md-inv2-compare-selected-title/);
});

test("Inventory V2 uses the standard authenticated shell and icon-only tools", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const inventory = components.slice(components.indexOf("function EquipmentStage"), components.indexOf("function InventoryOverlay({"));
  assert.match(inventory, /React\.createElement\(SharedOverlayShell/);
  assert.doesNotMatch(inventory, /React\.createElement\(StatusBar/);
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
  assert.match(components, /function inventoryEnchantStats\(item\)/);
  assert.doesNotMatch(compareFn, /itemBonus\(currentItem\)|itemBonus\(nextItem\)/);
  assert.doesNotMatch(compareFn, /getStats|combatPower|freshPlayerFromSave/);
  assert.match(compareFn, /\(Base\)/);
  assert.match(compareFn, /\(Refine\)/);
  assert.match(compareFn, /\(Enchant\)/);
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  assert.match(compare, /md-inv2-compare-one-screen/);
  assert.match(compare, /md-inv2-compare-delta/);
  assert.match(compare, /nextClass/);
  assert.doesNotMatch(compare, /ADDED|REMOVED/);
  assert.match(compare, /renderPanel\("base", "BASE STATS"/);
  assert.match(compare, /renderPanel\("enchant", "ENCHANT"/);
  assert.doesNotMatch(compare, /are shown separately; missing stats/);
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
  const inventory = components.slice(components.indexOf("function ItemDetailModal"), components.indexOf("function InventoryOverlay({"));
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
    "SharedOverlayShell", "EquipmentStage", "EquipmentSlot", "InventoryToolbar",
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

test("Inventory compare modal keeps bounded internal scrolling and compact mobile layout", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  const detailStart = components.indexOf("function ItemDetailModal");
  const detailEnd = components.indexOf("function InventoryOverlayV2", detailStart);
  const detail = components.slice(detailStart, detailEnd);
  assert.match(detail, /!compareRows\.length && .*md-inv2-detail-head/);
  assert.match(detail, /!compareRows\.length && .*ItemStats/);
  assert.match(styles, /\\.md-inv2-detail \\{[^}]*overflow-y:auto/);
  assert.match(styles, /\\.md-inv2-detail-layer \\.md-inv2-detail \\{[^}]*max-height:[^;]+;/);
  assert.match(styles, /\\.md-inv2-detail-layer \\.md-inv2-detail-actions \\{[^}]*padding-bottom:/);
  assert.match(styles, /\.md-inv2-detail-layer \{ align-items:center/);
  assert.match(styles, /\.md-inv2-compare-one-screen/);
  assert.match(styles, /@media \(max-width:430px\)/);
  assert.doesNotMatch(styles, /\.md-inv2-detail-layer \{ align-items:flex-end/);
});



test("Enchant comparison is stat-name based, shows differences and keeps percentage stats distinct", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const compareFn = components.slice(components.indexOf("function inventoryComparisonRows"), components.indexOf("function InventoryHeader"));
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  assert.match(compareFn, /inventoryEnchantComparisonEntries/);
  assert.match(compareFn, /normalizedKey \+ '#' \+ entry\.occurrence/);
  assert.match(compareFn, /occurrenceLabel/);
  assert.match(compareFn, /statKey: entry\.key/);
  assert.match(compare, /md-inv2-compare-selected-icon-frame/);
  assert.match(compare, /md-inv2-compare-selected-title/);
  assert.doesNotMatch(compare, /"DIFFERENCE"/);
  assert.match(compare, /inventoryComparisonFormatValue/);
  assert.match(components, /critChance: "Crit",\s*critDamage: "Crit DMG"/);
});

test("Enchant comparison preserves four slots, duplicate names and malformed-slot safety", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const entries = components.slice(components.indexOf("function inventoryEnchantComparisonEntries"), components.indexOf("function inventoryComparisonFormatValue"));
  const rows = components.slice(components.indexOf("function inventoryComparisonRows"), components.indexOf("function InventoryHeader"));
  assert.match(entries, /Array\.isArray\(item\?\.empowerSlots\)/);
  assert.match(entries, /Number\.isFinite\(value\)/);
  assert.match(entries, /occurrence/);
  assert.match(rows, /currentEnchant/);
  assert.match(rows, /nextEnchant/);
  assert.match(rows, /Math\.max\(currentCounts\.get/);
  assert.match(rows, /group: 'enchant'/);
  assert.match(rows, /pushGroup\("base", "\(Base\)"\)/);
  assert.match(rows, /pushGroup\("refine", "\(Refine\)"\)/);
  assert.doesNotMatch(rows, /pushGroup\("enchant"/);
});

test("Equipment compare has three responsive columns and does not combine Base, Refine and Enchant", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  assert.match(compare, /md-inv2-compare-selected-icon-frame/);
  assert.match(compare, /renderPanel\("base", "BASE STATS"/);
  assert.match(compare, /renderPanel\("enchant", "ENCHANT"/);
  assert.doesNotMatch(compare, /are shown separately; missing stats/);
  assert.match(styles, /grid-template-columns:minmax\(0,1\.15fr\) minmax\(0,\.72fr\) minmax\(0,1fr\)/);
  assert.match(styles, /@media \(max-width:430px\)/);
  assert.match(styles, /max-height:650px/);
  assert.ok(styles.includes("border:1.5px solid rgba(221,176,65"));
  assert.ok(styles.includes(".md-inv2-compare-selected-icon-frame .md-game-icon"));
});

test("Enchant comparison pairs by stat name and validates real row values", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const start = components.indexOf("function inventoryEnchantComparisonEntries");
  const end = components.indexOf("const INVENTORY_SLOT_POSITIONS", start);
  assert.ok(start >= 0 && end > start, "comparison helpers must remain available in source");
  const sandbox = {
    SLOT_ORDER: ["weapon", "wings", "helmet"],
    INVENTORY_STAT_LABELS: {
      hp: "HP", str: "STR", agi: "AGI", dex: "DEX", luk: "LUK",
      critChance: "Crit", critDamage: "Crit DMG"
    },
    inventoryRawBaseStats: item => item && item.baseStats ? item.baseStats : {},
    inventoryRefineStats: item => item && item.refineStats ? item.refineStats : {}
  };
  const api = vm.runInNewContext(components.slice(start, end) + "\n;({ inventoryComparisonRows, inventoryComparisonFormatValue })", sandbox);
  const current = {
    type: "weapon",
    baseStats: { hp: 10 },
    refineStats: { hp: 1 },
    empowerSlots: [
      { key: "agi", value: 1 }, { key: "str", value: 1 },
      { key: "luk", value: 1 }, { key: "critChance", value: 3 }
    ]
  };
  const next = {
    type: "weapon",
    baseStats: { hp: 12 },
    refineStats: { hp: 2 },
    empowerSlots: [
      { key: "str", value: 2 }, { key: "luk", value: 2 },
      { key: "critDamage", value: 5 }, { key: "dex", value: 2 }
    ]
  };
  const rows = api.inventoryComparisonRows(current, next);
  const enchant = rows.filter(row => row.group === "enchant");
  const rowFor = key => enchant.find(row => row.statKey === key);
  assert.equal(enchant.length, 6, "four slots on each item must preserve the union of all six stat names");
  assert.deepEqual(
    JSON.parse(JSON.stringify([rowFor("str").current, rowFor("str").next])),
    [1, 2],
    "same stat name must compare values regardless of slot position"
  );
  assert.deepEqual(JSON.parse(JSON.stringify([rowFor("agi").current, rowFor("agi").next])), [1, 0], "current-only stat is retained");
  assert.deepEqual(JSON.parse(JSON.stringify([rowFor("dex").current, rowFor("dex").next])), [0, 2], "new-only stat is retained");
  assert.ok(rowFor("critChance") && rowFor("critDamage"), "Crit and Crit DMG must remain distinct stats");
  assert.equal(api.inventoryComparisonFormatValue("critChance", 3), "3%");
  assert.equal(api.inventoryComparisonFormatValue("critDamage", 5, true), "+5%");
  assert.ok(rows.some(row => row.group === "base" && row.statKey === "hp"));
  assert.ok(rows.some(row => row.group === "refine" && row.statKey === "hp"));
  assert.equal(api.inventoryComparisonRows(null, next).filter(row => row.group === "enchant").length, 4, "empty current equipment must be supported");
  assert.deepEqual(JSON.parse(JSON.stringify(api.inventoryComparisonRows(current, { type: "junk", empowerSlots: [] }))), [], "non-equipment items do not compare");
});

test("Enchant comparison preserves duplicate stat occurrences and ignores malformed slots safely", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const start = components.indexOf("function inventoryEnchantComparisonEntries");
  const end = components.indexOf("function InventoryHeader", start);
  const sandbox = {
    SLOT_ORDER: ["weapon"],
    INVENTORY_STAT_LABELS: { str: "STR", critChance: "Crit" },
    inventoryRawBaseStats: item => item && item.baseStats ? item.baseStats : {},
    inventoryRefineStats: item => item && item.refineStats ? item.refineStats : {}
  };
  const api = vm.runInNewContext(components.slice(start, end) + "\n;({ inventoryComparisonRows })", sandbox);
  const current = {
    type: "weapon",
    empowerSlots: [
      { key: "str", value: 1 }, { key: "str", value: 2 },
      null, {}, { key: "critChance", value: "bad" }, "invalid"
    ]
  };
  const next = { type: "weapon", empowerSlots: [{ key: "str", value: 3 }, null, { key: "", value: 4 }] };
  const rows = api.inventoryComparisonRows(current, next).filter(row => row.group === "enchant");
  assert.equal(rows.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(rows.map(row => [row.label, row.current, row.next]))), [
    ["STR (1) (Enchant)", 1, 3],
    ["STR (2) (Enchant)", 2, 0]
  ]);
  assert.doesNotThrow(() => api.inventoryComparisonRows({ type: "weapon", empowerSlots: null }, next));
  assert.doesNotThrow(() => api.inventoryComparisonRows({ type: "weapon", empowerSlots: [{ key: "str", value: NaN }] }, next));
});


test("Inventory compare has exactly three aligned columns and puts signed delta inside New", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  const headings = compare.match(/React\.createElement\("span", null, "(?:STAT|CURRENT|NEW|DIFFERENCE)"\)/g) || [];
  assert.deepEqual(headings.map(x => x.match(/"(STAT|CURRENT|NEW|DIFFERENCE)"\)/)[1]), ["STAT", "CURRENT", "NEW"]);
  assert.doesNotMatch(compare, /"DIFFERENCE"/);
  assert.match(compare, /md-inv2-compare-new-value/);
  assert.match(compare, /"\(" \+ \(delta === 0/);
  assert.match(styles, /grid-template-columns:minmax\(0,1\.15fr\) minmax\(0,\.72fr\) minmax\(0,1fr\)/);
  assert.match(styles, /@media \(max-width:430px\)/);
});


test("Inventory compare uses a gold framed panel and a large selected-item icon in the upper-left header", () => {
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  assert.ok(compare.includes("currentDetail || currentEquipped"));
  assert.match(compare, /md-inv2-compare-selected-icon-frame/);
  assert.match(compare, /md-game-icon md-inv2-compare-icon/);
  assert.match(compare, /md-inv2-compare-selected-title/);
  assert.match(compare, /"CURRENT"/);
  assert.match(compare, /"NEW"/);
  assert.ok(styles.includes("border:1.5px solid rgba(221,176,65"));
  assert.ok(styles.includes("grid-template-columns:112px minmax(0,1fr)"));
  assert.ok(styles.includes("grid-template-columns:84px minmax(0,1fr)"));
  assert.ok(styles.includes("@media (max-width:430px)"));
});

function renderItemComparisonTree(compareRows, selected, equipped) {
  const vm = require("node:vm");
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  const slice = (from, to) => components.slice(components.indexOf(from), components.indexOf(to));
  const element = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity).filter(child => child !== null && child !== false && child !== undefined) });
  const sandbox = {
    React: { createElement: element },
    GameIcon: "GameIcon",
    SLOT_LABEL: { wings: "Wings" },
    SLOT_ICON: {},
    itemDisplayName: item => item.name,
    inventoryRarityKey: item => item?.rarity || "common",
    inventoryItemType: item => item?.type || "wings",
    MYTHIC_V2: require(path.join(ROOT, "src/systems/mythicV2.js")),
  };
  vm.createContext(sandbox);
  vm.runInContext(`${slice("function inventoryComparisonFormatValue", "function inventoryComparisonRows")}\n${slice("function ItemComparison", "function ItemActions")}\nthis.ItemComparison = ItemComparison;`, sandbox);
  return sandbox.ItemComparison({ currentEquipped: equipped, currentDetail: selected, compareRows });
}
function collectNodes(node, predicate, found = []) {
  if (!node || typeof node !== "object") return found;
  if (predicate(node)) found.push(node);
  (node.children || []).forEach(child => collectNodes(child, predicate, found));
  return found;
}
function textOf(node) {
  return typeof node === "string" || typeof node === "number" ? String(node) : (node.children || []).map(textOf).join("");
}

test("Inventory compare display: Base/Refine and Enchant are separate panels; same stats share a row, one-sided stats get their own tagged row", () => {
  const rows = [
    { key: "refine:agi", statKey: "agi", label: "AGI (Refine)", current: 3, next: 0, group: "refine" },
    { key: "enchant:critchance#1", statKey: "critChance", label: "Crit (1) (Enchant)", current: 0, next: 5, group: "enchant" },
    { key: "enchant:critchance#2", statKey: "critChance", label: "Crit (2) (Enchant)", current: 0, next: 3, group: "enchant" },
    { key: "enchant:hppct#1", statKey: "hpPct", label: "HP% (Enchant)", current: 4, next: 6, group: "enchant" },
    { key: "enchant:mppct#1", statKey: "mpPct", label: "MP% (Enchant)", current: 7, next: 7, group: "enchant" },
    { key: "enchant:dodgechance#1", statKey: "dodgeChance", label: "Dodge (Enchant)", current: 8, next: 5, group: "enchant" },
  ];
  const selected = { name: "Robot Wings", rarity: "mythic", type: "wings", level: 1, enhanceLevel: 0, empowerSlots: [{}, {}, {}, {}] };
  const equipped = { name: "Azure Wings +3", rarity: "mythic", type: "wings" };
  const tree = renderItemComparisonTree(rows, selected, equipped);
  const panels = collectNodes(tree, node => /md-inv2-compare-panel/.test(node.props?.className || ""));
  assert.deepEqual(panels.map(panel => panel.props.className.replace("md-inv2-compare-panel ", "")), ["base", "enchant"]);
  const rowsOf = panel => collectNodes(panel, node => node.props?.className === "md-inv2-compare-row");
  const cells = row => ({ stat: textOf(row.children[0]), current: textOf(row.children[1]), currentClass: row.children[1].props.className, next: textOf(row.children[2].children[0]), nextClass: row.children[2].children[0].props.className, delta: row.children[2].children[1] ? textOf(row.children[2].children[1]) : "", kind: row.props["data-kind"] });
  const base = rowsOf(panels[0]).map(cells);
  const enchant = rowsOf(panels[1]).map(cells);
  assert.equal(base.length, 1);
  assert.equal(enchant.length, 5, "repeated stats are never merged");
  assert.match(base[0].stat, /^AGI/); // label has no "(Refine)" suffix, the REFINE tag marks the group
  assert.doesNotMatch(base[0].stat, /\(Refine\)/);
  // A stat that only exists on the current item: its own row, missing side is a red 0, no REMOVED word.
  assert.deepEqual([base[0].current, base[0].next, base[0].delta, base[0].kind], ["3", "0", "", "removed"]);
  assert.match(base[0].nextClass, /negative/);
  // A stat that only exists on the new item: ADDED. Two Crit enchants stay two separate rows.
  assert.deepEqual(enchant.slice(0, 2).map(row => [row.stat, row.current, row.next, row.delta, row.kind]), [["Crit (1)", "0%", "5%", "", "added"], ["Crit (2)", "0%", "3%", "", "added"]]);
  assert.match(enchant[0].currentClass, /negative/);
  assert.match(enchant[0].nextClass, /positive/);
  // The same stat on both items: current, new and the signed change share one row.
  assert.deepEqual(enchant.slice(2).map(row => [row.stat, row.current, row.next, row.delta, row.kind]), [["HP%", "4%", "6%", "(+2%)", "both"], ["MP%", "7%", "7%", "(0)", "both"], ["Dodge", "8%", "5%", "(-3%)", "both"]]);
  // Only the clicked item's icon is shown; no legend/status text at the bottom.
  assert.equal(collectNodes(tree, node => node.type === "GameIcon").length, 1);
  assert.equal(collectNodes(tree, node => node.type === "GameIcon")[0].props.alt, "Robot Wings");
  assert.doesNotMatch(textOf(tree), /are shown separately|missing stats/);
  // Each panel has its own visible CURRENT / NEW headings.
  for (const panel of panels) assert.deepEqual(collectNodes(panel, node => node.props?.className === "md-inv2-compare-columns")[0].children.map(textOf), ["STAT", "CURRENT", "NEW"]);
});

test("Inventory compare display: a panel without rows is omitted and the comparison rows themselves are untouched", () => {
  const enchantOnly = [{ key: "enchant:spd#1", statKey: "spd", label: "SPD (Enchant)", current: 0, next: 12, group: "enchant" }];
  const tree = renderItemComparisonTree(enchantOnly, { name: "Robot Wings", rarity: "mythic", type: "wings", enhanceLevel: 0, empowerSlots: [{}] }, null);
  const panels = collectNodes(tree, node => /md-inv2-compare-panel/.test(node.props?.className || ""));
  assert.equal(panels.length, 1);
  assert.match(panels[0].props.className, /enchant/);
  assert.equal(renderItemComparisonTree([], { name: "x" }, null), null);
  // Display-only change: the comparison builder still does the pairing (stat name + occurrence) and keeps the same signature.
  const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  assert.match(components, /function inventoryComparisonRows\(currentItem, nextItem\)/);
  assert.doesNotMatch(components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions")), /inventoryComparisonRows|inventoryEnchantComparisonEntries/);
});

test("Inventory compare shows the boss weapon unique effect (signature), plus the equipped one when it differs", () => {
  const rows = [{ key: "base:atk", statKey: "atk", label: "ATK (Base)", current: 10, next: 21, group: "base" }];
  const lavalon = { name: "Lavalon Sword", rarity: "mythic", type: "weapon", signatureId: "lavalon_extra_basic", empowerSlots: [] };
  const icicle = { name: "Frost Blade", rarity: "mythic", type: "weapon", signatureId: "icicle_counter" };
  const plain = { name: "Iron Sword", rarity: "rare", type: "weapon" };
  const lines = tree => collectNodes(tree, node => /md-inv2-compare-signature/.test(node.props?.className || "")).map(textOf);
  assert.deepEqual(lines(renderItemComparisonTree(rows, lavalon, plain)).map(t => t.includes("10%/Hit")), [true]);
  const both = lines(renderItemComparisonTree(rows, lavalon, icicle));
  assert.equal(both.length, 2);
  assert.match(both[0], /^NEW/);
  assert.match(both[1], /^CURRENT/);
  assert.deepEqual(lines(renderItemComparisonTree(rows, plain, plain)), []);
});
