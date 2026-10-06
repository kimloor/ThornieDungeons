const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const worker = fs.readFileSync(path.join(ROOT, "workers/thornie-dungeons-api.js"), "utf8");

test("Shop resource purchase accepts optional integer quantity 1..99 and preserves quantity=1 compatibility", () => {
  assert.match(worker, /function normalizeShopQuantity\(rawQuantity\)/);
  assert.match(worker, /if \(rawQuantity === undefined\) return 1/);
  assert.match(worker, /rawQuantity >= 1 && rawQuantity <= 99/);
  assert.match(worker, /invalid_shop_quantity/);
  assert.match(worker, /body\.resource, body\.quantity, body\.requestId/);
});

test("Shop resource purchase charges server-authoritative unit price times quantity", () => {
  assert.match(worker, /const totalCost = definition\.cost \* normalizedQuantity/);
  assert.match(worker, /gold >= \?/) ;
  assert.match(worker, /diamonds >= \?/) ;
  assert.match(worker, /bind\(totalCost, id, totalCost, token\)/);
  assert.match(worker, /bind\(totalCost, nowIso\(\), characterId, id, totalCost, token\)/);
  assert.match(worker, /unitPrice: definition\.cost/);
});

test("Shop resource purchase receipt payload includes quantity for replay/conflict semantics", () => {
  assert.match(worker, /JSON\.stringify\(\{ kind: actionId, quantity: normalizedQuantity \}\)/);
  assert.match(worker, /characterOperationReplay\(db, id, characterId, operation, key, payloadJson\)/);
  assert.match(worker, /operation_request_conflict/);
});

test("Shop resource purchase reuses inventory planner for merge/split and overflow settlement", () => {
  assert.match(worker, /inventoryPlanAddRow\(inventoryPlan/);
  assert.match(worker, /quantity: normalizedQuantity/);
  assert.match(worker, /originType: "shop_purchase"/);
  assert.match(worker, /reconcileMailOverflow\(inventoryPlan\)/);
});

test("Shop resource purchase blocks new resource purchases while existing Overflow is pending", () => {
  assert.match(worker, /json_extract\(extra_json, '\$\.overflow'\) = 1/);
  assert.match(worker, /NOT EXISTS \(\s*SELECT 1 FROM items/);
  assert.match(worker, /overflowGuardBinds/);
});

test("Protection Stone remains single-purchase", () => {
  assert.match(worker, /kind === "protection_stone" && normalizedQuantity !== 1/);
  assert.match(worker, /resource: kind, amount: 1, quantity: 1/);
});
