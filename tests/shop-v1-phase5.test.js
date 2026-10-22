import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/ui/App.js","utf8");
const api = fs.readFileSync("src/state/api.js","utf8");
const components = fs.readFileSync("src/ui/components.js","utf8");

test("Phase 5 Shop purchase sends quantity, optimistic pending state, rollback, and same-request retry", () => {
  assert.match(api, /quantity = undefined/);
  assert.match(app, /setShopPending/);
  assert.match(app, /action: "purchaseCharacterResource"/);
  assert.match(app, /spendField = kind === "protection_stone" \? "diamonds" : "gold"/);
  assert.match(app, /cloudPurchaseCharacterResource\([^\n]+normalizedQuantity/);
  // same requestId across retries now lives in OPERATIONS.run (tests/operations.test.js)
  assert.match(app, /OPERATIONS\.run\(\{[\s\S]*?key: `shop\.resource:/);
  assert.doesNotMatch(app, /for \(let attempt = 0; attempt < 4; attempt\+\+\)/);
  assert.match(app, /rollback: \(\) => setSave\(current => \(\{ \.\.\.current, \[spendField\]/);
  assert.match(components, /pendingPurchases/);
  assert.match(components, /กำลังยืนยัน/);
});

test("Phase 5 Shop quantity UI keeps server cap at 99 and exposes x5/x10/Max", () => {
  assert.match(components, /Math\.min\(99/);
  assert.equal(components.includes("[5,10]"), true);
  assert.match(components, /`x\$\{n\}`/);
  assert.match(components, /Max/);
});
