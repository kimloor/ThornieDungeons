const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const components = fs.readFileSync("src/ui/components.js", "utf8");
const styles = fs.readFileSync("src/data/styles.js", "utf8");

test("Inventory item comparison uses a compact no-scroll mobile sheet", () => {
  assert.match(components, /const compareMode = compareRows\.length > 0;/);
  assert.match(components, /md-inv2-detail-layer.*compare-mode/);
  assert.match(components, /md-inv2-detail.*compare-mode/);
  assert.match(styles, /\.md-inv2-detail-layer\.compare-mode \{[\s\S]*align-items:center;/);
  assert.match(styles, /\.md-inv2-detail-layer \.md-inv2-detail\.compare-mode \{[\s\S]*height:min\(88dvh,760px\); max-height:none; overflow:hidden;/);
  assert.match(styles, /\.md-inv2-detail\.compare-mode \.md-inv2-compare-row \{ min-height:22px;/);
});

 test("Inventory comparison keeps every calculated stat row visible", () => {
  const start = components.indexOf("function inventoryComparisonRows");
  const end = components.indexOf("function InventoryHeader", start);
  const fn = components.slice(start, end);
  assert.match(fn, /\["hp", "HP"\]/);
  assert.match(fn, /\["critDamage", "Crit DMG"\]/);
  assert.doesNotMatch(fn, /\.filter\(row => Math\.abs\(row\.current\)/);
});
