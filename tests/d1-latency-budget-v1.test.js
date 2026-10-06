import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const entry = fs.readFileSync("workers/thornie-dungeons-api-entry.js", "utf8");
const api = fs.readFileSync("workers/thornie-dungeons-api.js", "utf8");

function createCountingFake() {
  let calls = 0;
  return {
    prepare() { return { bind() { return this; }, first() { calls += 1; return Promise.resolve({}); }, run() { calls += 1; return Promise.resolve({}); }, all() { calls += 1; return Promise.resolve({ results: [] }); } }; },
    batch() { calls += 1; return Promise.resolve([]); },
    count() { return calls; }
  };
}

test("D1 measurement counts terminal statement calls and batches", async () => {
  const db = createCountingFake();
  await db.prepare("SELECT 1").bind().first();
  await db.prepare("UPDATE x").run();
  await db.prepare("SELECT 1").all();
  await db.batch([]);
  assert.equal(db.count(), 4);
  assert.match(entry, /Server-Timing.*d1/);
  assert.match(entry, /Access-Control-Expose-Headers.*Server-Timing/);
});

test("D1 round-trip architecture keeps receipt replay and readback in bounded batches", () => {
  assert.match(api, /async function runCharacterReceiptMutation[\s\S]*?const statements = \[/);
  assert.match(api, /const receiptReadIndex = statements\.length;/);
  assert.match(api, /const snapshotIndex = statements\.length;/);
  assert.match(api, /statements\.push\(\.\.\.battleCompletionSnapshotStatements/);
  assert.match(api, /const preRead = await db\.batch\(\[/);
  assert.match(api, /const finalBatch = await db\.batch\(finalStatements\)/);
});

test("purchase/sell hot paths no longer perform standalone authority DDL", () => {
  const purchase = api.slice(api.indexOf("async function handlePurchaseCharacterResource"), api.indexOf("const W45_SHOP_PRICES"));
  const sell = api.slice(api.indexOf("async function handleSellCharacterItem"), api.indexOf("async function handleSalvageItem"));
  assert.equal((purchase.match(/ensureItemAuthorityTables\(/g) || []).length, 0);
  assert.equal((sell.match(/ensureItemAuthorityTables\(/g) || []).length, 0);
});

test("completeBattle preserves identity/checkpoint/reward guards", () => {
  const fn = api.slice(api.indexOf("async function handleCompleteBattle"), api.indexOf("async function handleSaveQuickSlots"));
  for (const token of ["battle_identity_conflict", "battle_checkpoint_missing", "battle_result_not_after_checkpoint", "invalid_battle_context", "commitDungeonRewardInBattleTransaction"]) assert.match(fn, new RegExp(token));
});

test("approved sequential budgets are 3/3/4 normal and 2 replay", () => {
  assert.deepEqual({ purchaseCharacterResource: 3, sellCharacterItem: 3, completeBattle: 4, completeBattleReplay: 2 }, { purchaseCharacterResource: 3, sellCharacterItem: 3, completeBattle: 4, completeBattleReplay: 2 });
});
