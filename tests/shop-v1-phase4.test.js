const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ROOT = path.resolve(__dirname, "..");
const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");

test("Phase 4 Shop uses pinned header and scrollable body", () => {
  assert.match(components, /className: "md-shop-header"/);
  assert.match(components, /className: "md-shop-body"/);
  assert.match(styles, /\.md-shop-sheet\s*\{[^}]*display:flex; flex-direction:column; min-height:0/);
  assert.match(styles, /\.md-shop-body\s*\{[^}]*overflow-y:auto/);
  assert.match(styles, /overscroll-behavior:contain/);
  assert.match(styles, /-webkit-overflow-scrolling:touch/);
});

test("Phase 4 Shop has exactly four requested tabs and no Sell tab", () => {
  assert.match(components, /\["equipment", "อุปกรณ์"\]/);
  assert.match(components, /\["hp", "ยา HP"\]/);
  assert.match(components, /\["sp", "ยา SP"\]/);
  assert.match(components, /\["other", "อื่นๆ"\]/);
  assert.equal(components.includes('["sell",'), false);
});

test("Phase 4 tab switching resets body scroll only", () => {
  assert.equal(components.includes("bodyRef.current.scrollTop=0"), true);
  assert.match(components, /md-shop-tab/);
});

test("Phase 4 preserves existing Shop callbacks and resource groups", () => {
  for (const token of ["onBuyItem", "onBuyPotionTier", "onBuyProtectionStone", "onBuyMaterial"]) assert.match(components, new RegExp(token));
  assert.equal(components.includes("hpPotions=potions.filter"), true);
  assert.equal(components.includes("spPotions=potions.filter"), true);
  assert.equal(components.includes('resourceRow("iron"'), true);
  assert.equal(components.includes('resourceRow("manaOre"'), true);
});