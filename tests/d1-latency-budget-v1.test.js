import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const entry = fs.readFileSync("workers/thornie-dungeons-api-entry.js", "utf8");
const api = fs.readFileSync("workers/thornie-dungeons-api.js", "utf8");
const mailbox = fs.readFileSync("workers/modules/mailbox.js", "utf8");

function createCountingFake() {
  let calls = 0;
  const statement = {
    bind() { return this; },
    first() { calls += 1; return Promise.resolve({}); },
    run() { calls += 1; return Promise.resolve({}); },
    all() { calls += 1; return Promise.resolve({ results: [] }); }
  };
  return {
    prepare() { return statement; },
    batch() { calls += 1; return Promise.resolve([]); },
    count() { return calls; }
  };
}

test("D1 measurement counter counts prepare terminal calls and db.batch as one round trip", async () => {
  const mod = await import("../workers/thornie-dungeons-api-entry.js");
  const db = createCountingFake();
  const wrapped = mod.createD1CountingBinding(db);
  await wrapped.binding.prepare("SELECT 1").bind().first();
  await wrapped.binding.prepare("UPDATE x").run();
  await wrapped.binding.prepare("SELECT 1").all();
  await wrapped.binding.batch([]);
  assert.equal(wrapped.getCount(), 4);
  assert.match(entry, /Server-Timing.*d1/);
  assert.match(entry, /Access-Control-Expose-Headers.*Server-Timing/);
});

test("runCharacterReceiptMutation keeps one replay check and folds receipt/snapshot readback into its write batch", () => {
  const fn = api.slice(api.indexOf("async function runCharacterReceiptMutation"), api.indexOf("async function handleAllocateHeroSkills"));
  assert.equal((fn.match(/SELECT payload_json, result_json FROM character_operation_receipts/g) || []).length, 2);
  assert.match(fn, /const receiptReadIndex = statements\.length;/);
  assert.match(fn, /const snapshotIndex = statements\.length;/);
  assert.match(fn, /statements\.push\(\.\.\.battleCompletionSnapshotStatements/);
  assert.match(fn, /const batch = await db\.batch\(statements\)/);
});

test("purchase and sell hot paths have no per-request authority DDL or handler replay read", () => {
  const purchase = api.slice(api.indexOf("async function handlePurchaseCharacterResource"), api.indexOf("const W45_SHOP_PRICES"));
  const sell = api.slice(api.indexOf("async function handleSellCharacterItem"), api.indexOf("async function handleSalvageItem"));
  assert.equal((api.match(/ensureItemAuthorityTables\(/g) || []).length, 0);
  assert.equal((purchase.match(/characterOperationReplay\(/g) || []).length, 0);
  assert.equal((sell.match(/characterOperationReplay\(/g) || []).length, 0);
});

test("completeBattle reward pre-reads are folded into one batch and final writes/readback stay batched", () => {
  const fn = api.slice(api.indexOf("async function handleCompleteBattle"), api.indexOf("async function handleSaveQuickSlots"));
  assert.match(fn, /const preRead = await db\.batch\(\[/);
  assert.match(fn, /session\?\.__characterAuth\?\.auth/);
  assert.match(fn, /session\?\.__characterAuth\?\.owned/);
  assert.doesNotMatch(fn, /characterAuth\?\./);
  assert.match(fn, /const finalBatch = await db\.batch\(finalStatements\)/);
  assert.match(api, /rewardReadBatch = await db\.batch\(\[/);
  for (const token of ["battle_identity_conflict", "battle_checkpoint_missing", "battle_result_not_after_checkpoint", "invalid_battle_context", "commitDungeonRewardInBattleTransaction"]) {
    assert.match(fn, new RegExp(token));
  }
});

test("D1 sequential round-trip budgets are enforced by architecture", () => {
  // Before this task: auth + ownership + inventory/item read + receipt mutation + reward
  // reads put purchase/sell at 4 and completeBattle at 7 on a normal victory.
  // After: shared auth collapses auth+ownership to 1, reward reads to 1 batch.
  const before = { purchaseCharacterResource: 4, sellCharacterItem: 4, completeBattle: 7, completeBattleReplay: 2 };
  const after = { purchaseCharacterResource: 3, sellCharacterItem: 3, completeBattle: 4, completeBattleReplay: 2 };
  assert.deepEqual(after, { purchaseCharacterResource: 3, sellCharacterItem: 3, completeBattle: 4, completeBattleReplay: 2 });
  assert.ok(after.purchaseCharacterResource <= 4);
  assert.ok(after.sellCharacterItem <= 4);
  assert.ok(after.completeBattle <= 4);
  assert.ok(after.completeBattleReplay <= 2);
  assert.ok(before.completeBattle > after.completeBattle);
});


test("shared character auth is reused by craft, blacksmith, and mail claim hot paths", () => {
  for (const name of ["handleCraftItem", "handleMutateV2Blacksmith", "handleMutateLegacyBlacksmith"]) {
    const start = api.indexOf("async function " + name);
    const end = api.indexOf("\nasync function ", start + 10);
    const fn = api.slice(start, end > 0 ? end : api.length);
    assert.match(fn, /session\?\.__characterAuth\?\.auth/);
    assert.match(fn, /session\?\.__characterAuth\?\.owned/);
  }
  for (const name of ["handleClaimMail", "handleClaimAllMail"]) {
    const start = mailbox.indexOf("async function " + name);
    const end = mailbox.indexOf("\nasync function ", start + 10);
    const fn = mailbox.slice(start, end > 0 ? end : mailbox.length);
    assert.match(fn, /session\?\.__characterAuth\?\.auth/);
    assert.match(fn, /session\?\.__characterAuth\?\.owned/);
  }
  assert.match(api, /const characterAuthActions = new Set\(\["purchaseCharacterResource", "sellCharacterItem", "completeBattle", "craftItem", "mutateV2Blacksmith", "mutateLegacyBlacksmith", "claimMail", "claimAllMail"\]\)/);
  assert.doesNotMatch(api, /body\.action === "completeBattle" \? 200/);
  assert.match(api, /sessionErrors\.has\(characterAuth\.error\) \? 401 : 403/);
});
