import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import worker from "../workers/thornie-dungeons-api.js";

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

test("purchase has no per-request authority DDL and sell defers receipt lookup until item_not_owned", () => {
  const purchase = api.slice(api.indexOf("async function handlePurchaseCharacterResource"), api.indexOf("const W45_SHOP_PRICES"));
  const sell = api.slice(api.indexOf("async function handleSellCharacterItem"), api.indexOf("async function handleSalvageItem"));
  assert.equal((api.match(/ensureItemAuthorityTables\(/g) || []).length, 0);
  assert.equal((purchase.match(/characterOperationReplay\(/g) || []).length, 0);
  const rowIndex = sell.indexOf("const row = await db.prepare");
  const receiptIndex = sell.indexOf("character_operation_receipts");
  const missingIndex = sell.indexOf('return json({ error: "item_not_owned" }, 403);');
  assert.ok(rowIndex >= 0 && receiptIndex > rowIndex);
  assert.ok(receiptIndex < missingIndex);
  assert.match(sell, /if \(!row\) \{[\s\S]*character_operation_receipts[\s\S]*item_not_owned/);
});

test("completeBattle reward pre-reads are folded into one batch and final writes/readback stay batched", () => {
  const fn = api.slice(api.indexOf("async function handleCompleteBattle"), api.indexOf("async function handleSaveQuickSlots"));
  assert.match(fn, /const preRead = await db\.batch\(\[/);
  assert.match(fn, /session\?\.__characterAuth\?\.auth/);
  assert.match(fn, /session\?\.__characterAuth\?\.owned/);
  assert.match(fn, /const finalBatch = await db\.batch\(finalStatements\)/);
  assert.match(api, /rewardReadBatch = await db\.batch\(\[/);
  for (const token of ["battle_identity_conflict", "battle_checkpoint_missing", "battle_result_not_after_checkpoint", "invalid_battle_context", "commitDungeonRewardInBattleTransaction"]) {
    assert.match(fn, new RegExp(token));
  }
});


function createSqliteD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE players (id TEXT PRIMARY KEY, diamonds INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, gold INTEGER NOT NULL DEFAULT 0,
      protection_stones INTEGER NOT NULL DEFAULT 0, pets_json TEXT NOT NULL DEFAULT '{}', updated_at TEXT
    );
    CREATE TABLE auth_sessions (
      session_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL, revoked_at TEXT, revoke_reason TEXT, remember_login INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, character_id TEXT NOT NULL,
      slot_type TEXT NOT NULL, equipped INTEGER NOT NULL DEFAULT 0, inventory_slot TEXT NOT NULL DEFAULT '',
      item_template_id TEXT NOT NULL DEFAULT '', rarity TEXT NOT NULL DEFAULT 'common', name TEXT NOT NULL,
      item_level INTEGER NOT NULL DEFAULT 0, enhance_level INTEGER NOT NULL DEFAULT 0, bound INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1, atk INTEGER NOT NULL DEFAULT 0, def INTEGER NOT NULL DEFAULT 0,
      hp INTEGER NOT NULL DEFAULT 0, mp INTEGER NOT NULL DEFAULT 0, extra_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE character_operation_receipts (
      character_id TEXT NOT NULL, operation TEXT NOT NULL, request_id TEXT NOT NULL,
      operation_token TEXT, payload_json TEXT, result_json TEXT, created_at TEXT,
      UNIQUE(character_id, operation, request_id)
    );
    CREATE TABLE item_provenance (
      item_id TEXT PRIMARY KEY, original_player_id TEXT, original_character_id TEXT, origin_type TEXT,
      origin_source_id TEXT, origin_context_json TEXT, created_at TEXT, acquired_at TEXT,
      tradeable INTEGER DEFAULT 0, bound INTEGER DEFAULT 0
    );
    CREATE TABLE item_ownership_events (
      event_id TEXT PRIMARY KEY, item_id TEXT NOT NULL, from_player_id TEXT, from_character_id TEXT,
      to_player_id TEXT, to_character_id TEXT, event_type TEXT, context_json TEXT, occurred_at TEXT
    );
    CREATE TABLE battle_completions (
      battle_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, result_json TEXT NOT NULL, completed_at TEXT NOT NULL
    );
    CREATE TABLE battle_checkpoints (
      battle_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, checkpoint_seq INTEGER NOT NULL,
      payload_json TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT
    );
  `);
  let calls = 0;
  const wrap = (statement, boundArgs = null, sql = "") => {
    const args = Array.isArray(boundArgs) ? boundArgs : [];
    const isQuery = /^\\s*(SELECT|WITH)\\b/i.test(sql);
    return {
      bind(...nextArgs) { return wrap(statement, nextArgs, sql); },
      first: async () => { calls += 1; return statement.get(...args) || null; },
      all: async () => { calls += 1; return { results: statement.all(...args) }; },
      run: async () => {
        calls += 1;
        if (isQuery) return { results: statement.all(...args) };
        const result = statement.run(...args);
        return { meta: { changes: Number(result.changes || 0), last_row_id: Number(result.lastInsertRowid || 0) } };
      }
    };
  };
  return {
    prepare(sql) { return wrap(sqlite.prepare(sql), null, sql); },
    async batch(statements) {
      calls += 1;
      sqlite.exec("BEGIN");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    resetCount() { calls = 0; },
    count() { return calls; },
    raw: sqlite
  };
}

async function sha256ForLatency(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  let binary = "";
  new Uint8Array(digest).forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

async function latencyHarnessRequest(db, token, body) {
  return worker.fetch(new Request("https://thornie.test/api", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }), { DB: db });
}

async function measureD1Budgets() {
  const db = createSqliteD1();
  const token = "latency-test-token";
  const playerId = "player-latency";
  const characterId = "char-latency";
  db.raw.prepare("INSERT INTO players (id, diamonds) VALUES (?, ?)").run(playerId, 500);
  db.raw.prepare("INSERT INTO characters (character_id, player_id, gold, protection_stones, pets_json) VALUES (?, ?, ?, ?, ?)").run(
    characterId, playerId, 5000, 0, "{}"
  );
  db.raw.prepare("INSERT INTO auth_sessions (session_id, player_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").run(
    "session-latency", playerId, await sha256ForLatency(token), new Date(Date.now() + 3600000).toISOString()
  );

  db.resetCount();
  const purchase = await latencyHarnessRequest(db, token, {
    action: "purchaseCharacterResource", characterId,
    resource: { kind: "material", id: "iron" }, quantity: 1, requestId: "purchase-latency-01"
  });
  if (purchase.status !== 200) {
    console.log("purchase debug receipts:", JSON.stringify(db.raw.prepare("SELECT * FROM character_operation_receipts").all()));
    console.log("purchase debug character:", JSON.stringify(db.raw.prepare("SELECT * FROM characters").all()));
    console.log("purchase debug items:", JSON.stringify(db.raw.prepare("SELECT * FROM items").all()));
  }
  assert.equal(purchase.status, 200, `purchase failed: ${JSON.stringify(await purchase.clone().json())}`);
  const purchaseCharacterResource = db.count();

  db.raw.prepare(`INSERT INTO items
    (item_id, player_id, character_id, slot_type, rarity, name, quantity, extra_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "sell-latency-item", playerId, characterId, "junk", "common", "Iron", 1,
      JSON.stringify({ junkId: "iron", quantity: 1 })
  );
  db.resetCount();
  const sell = await latencyHarnessRequest(db, token, {
    action: "sellCharacterItem", characterId, itemId: "sell-latency-item", requestId: "sell-latency-01"
  });
  assert.equal(sell.status, 200, `sell failed: ${JSON.stringify(await sell.clone().json())}`);
  const sellCharacterItem = db.count();

  db.raw.prepare(`INSERT INTO battle_checkpoints
    (battle_id, character_id, checkpoint_seq, payload_json, state)
    VALUES (?, ?, ?, ?, 'active')`).run(
      "battle-latency-01", characterId, 1, JSON.stringify({ authorizationOnly: false })
  );
  db.resetCount();
  const complete = await latencyHarnessRequest(db, token, {
    action: "completeBattle", characterId, battleId: "battle-latency-01",
    result: { result: "defeat", safeActionSeq: 2 }
  });
  assert.equal(complete.status, 200, `complete failed: ${JSON.stringify(await complete.clone().json())}`);
  const completeBattle = db.count();

  db.resetCount();
  const replay = await latencyHarnessRequest(db, token, {
    action: "completeBattle", characterId, battleId: "battle-latency-01",
    result: { result: "defeat", safeActionSeq: 2 }
  });
  assert.equal(replay.status, 200, `replay failed: ${JSON.stringify(await replay.clone().json())}`);
  const completeBattleReplay = db.count();

  const counts = { purchaseCharacterResource, sellCharacterItem, completeBattle, completeBattleReplay };
  console.log("D1 measured calls:", JSON.stringify(counts));
  return counts;
}

const D1_MEASURED = await measureD1Budgets();

test("D1 sequential round-trip budgets are enforced by the measured Worker harness", () => {
  // Measured by the real Worker + SQLite harness below. Keep only the production
  // ceilings here; do not hard-code before/after implementation counts.
  assert.ok(D1_MEASURED.purchaseCharacterResource <= 4);
  assert.ok(D1_MEASURED.sellCharacterItem <= 4);
  assert.ok(D1_MEASURED.completeBattle <= 4);
  assert.ok(D1_MEASURED.completeBattleReplay <= 2);
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
