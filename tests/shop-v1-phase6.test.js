import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("src/ui/App.js","utf8");
const api = fs.readFileSync("src/state/api.js","utf8");
const components = fs.readFileSync("src/ui/components.js","utf8");

test("Phase 6 sell sends explicit quantity and preserves old-client omission semantics", () => {
  assert.match(api, /function cloudSellCharacterItem\([^\n]+quantity = undefined/);
  assert.match(app, /async function sellItem\(item, quantity = undefined\)/);
  assert.match(app, /cloudSellCharacterItem\([^\n]+sellQuantity/);
  assert.match(components, /sellDialog/);
  assert.match(components, /ทั้งหมด \(\$\{sellDialog\.max\}\)/);
});

test("Phase 6 sell popup uses authoritative unit price for total preview", () => {
  assert.match(components, /sellUnitPrice\(sellDialog\.item\)/);
  assert.match(components, /sellUnitPrice\(sellDialog\.item\) \* sellQuantity/);
});
