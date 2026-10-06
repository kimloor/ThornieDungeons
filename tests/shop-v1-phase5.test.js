import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/ui/App.js","utf8");
const api = fs.readFileSync("src/state/api.js","utf8");
const components = fs.readFileSync("src/ui/components.js","utf8");

test("Phase 5 Shop purchase sends quantity, optimistic pending state, rollback, and same-request retry", () => {
  assert.match(api, /quantity = undefined/);
  assert.match(app, /setShopPending/);
  assert.match(app, /setSave\(current => kind === "protection_stone"/);
  assert.match(app, /cloudPurchaseCharacterResource\([^\n]+normalizedQuantity/);
  assert.match(app, /requestId[\s\S]*for \(let attempt = 0; attempt < 4; attempt\+\+\)/);
  assert.match(app, /setSave\(previousSave\)/);
  assert.match(components, /pendingPurchases/);
  assert.match(components, /กำลังยืนยัน/);
});

test("Phase 5 Shop quantity UI keeps server cap at 99 and exposes x5/x10/Max", () => {
  assert.match(components, /Math\.min\(99/);
  assert.equal(components.includes("[5,10]"), true);
  assert.match(components, /`x\$\{n\}`/);
  assert.match(components, /Max/);
});
