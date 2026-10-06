import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const api = fs.readFileSync("src/state/api.js","utf8");
const app = fs.readFileSync("src/ui/App.js","utf8");
const worker = fs.readFileSync("workers/thornie-dungeons-api.js","utf8");

test("Phase 7 Shop/Sell integration keeps quantity on both client API boundaries", () => {
  assert.match(api, /purchaseCharacterResource.*quantity/);
  assert.match(api, /sellCharacterItem.*quantity/);
  assert.match(app, /buyCharacterResource\([^\n]+quantity = 1/);
  assert.match(app, /sellItem\(item, quantity = undefined\)/);
});

test("Phase 7 server remains authoritative for quantity validation and sell result", () => {
  assert.match(worker, /invalid_shop_quantity/);
  assert.match(worker, /invalid_sell_quantity/);
  assert.match(worker, /goldGained/);
  assert.match(worker, /operation_request_conflict/);
});
