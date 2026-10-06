const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const worker = fs.readFileSync(path.join(ROOT, "workers/thornie-dungeons-api.js"), "utf8");
const shop = fs.readFileSync(path.join(ROOT, "src/systems/shop.js"), "utf8");
const enhancement = fs.readFileSync(path.join(ROOT, "src/systems/enhancement.js"), "utf8");

const POTION_SELL = {
  hp_small: 4, mp_small: 4,
  hp_medium: 9, mp_medium: 9,
  hp_high: 18, mp_high: 18,
  hp_full: 33, mp_full: 33
};
const JUNK_SELL = { stone: 1, grass: 1, wood: 2, iron: 4, manaOre: 6 };

test("Phase 3 client/server potion sell prices stay in parity", () => {
  for (const [id, price] of Object.entries(POTION_SELL)) {
    assert.match(worker, new RegExp(id + ": " + price + "\\b"));
    assert.match(enhancement, new RegExp(id + ": " + price + "\\b"));
  }
});

test("Phase 3 client/server junk sell prices stay in parity", () => {
  for (const [id, price] of Object.entries(JUNK_SELL)) {
    assert.match(worker, new RegExp(id + ": " + price + "\\b"));
    assert.match(enhancement, new RegExp(id + ": " + price + "\\b"));
  }
});

test("Phase 3 client sellPrice is total from authoritative-preview unit price", () => {
  assert.match(shop, /function sellUnitPrice\(it\)/);
  assert.match(shop, /return sellUnitPrice\(it\) \* Math\.max\(1, Number\(it\?\.quantity\) \|\| 1\)/);
});

test("Phase 3 removes duplicate replay reads from Shop purchase and Sell handlers", () => {
  const purchase = worker.slice(worker.indexOf("async function handlePurchaseCharacterResource"), worker.indexOf("const W45_SHOP_PRICES"));
  const sell = worker.slice(worker.indexOf("async function handleSellCharacterItem"), worker.indexOf("async function handleSalvageItem"));
  assert.equal((purchase.match(/characterOperationReplay\(/g) || []).length, 0);
  assert.equal((sell.match(/characterOperationReplay\(/g) || []).length, 0);
  assert.match(purchase, /return runCharacterReceiptMutation\(db, \{/);
  assert.match(sell, /return runCharacterReceiptMutation\(db, \{/);
});

test("Phase 3 keeps equipment/wing sell formula unchanged between client preview and server authority", () => {
  assert.match(worker, /Number\(row\.atk\) \|\| 0\) \* 3 \+ \(Number\(row\.def\) \|\| 0\) \* 3/);
  assert.match(shop, /\(it\.atk \|\| 0\) \* 3 \+ \(it\.def \|\| 0\) \* 3/);
  assert.match(worker, /Math\.round\(value \* rarityMult \* \.9\)/);
  assert.match(shop, /Math\.round\(itemValueScore\(it\) \* \(RARITY_MULT\[it\.rarity\] \|\| 1\) \* 0\.9\)/);
});
