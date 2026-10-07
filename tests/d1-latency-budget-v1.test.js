import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../workers/thornie-dungeons-api.js";

function createSqliteD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(`
    CREATE TABLE players (id TEXT PRIMARY KEY, diamonds INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      gold INTEGER NOT NULL DEFAULT 0,
      protection_stones INTEGER NOT NULL DEFAULT 0,
      pets_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT
    );
    CREATE TABLE auth_sessions (
      session_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      revoke_reason TEXT,
      remember_login INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, character_id TEXT NOT NULL,
      slot_type TEXT NOT NULL, equipped INTEGER NOT NULL DEFAULT 0,
      inventory_slot TEXT NOT NULL DEFAULT '', item_template_id TEXT NOT NULL DEFAULT '',
      rarity TEXT NOT NULL DEFAULT 'common', name TEXT NOT NULL, item_level INTEGER NOT NULL DEFAULT 0,
      enhance_level INTEGER NOT NULL DEFAULT 0, bound INTEGER NOT NULL DEFAULT 0,
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
      item_id TEXT PRIMARY KEY, original_player_id TEXT, original_character_id TEXT,
      origin_type TEXT, origin_source_id TEXT, origin_context_json TEXT,
      created_at TEXT, acquired_at TEXT, tradeable INTEGER DEFAULT 0, bound INTEGER DEFAULT 0
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
  const wrap = statement => ({
    bind(...args) {
      const bound = statement.bind(...args);
      return {
        first: async () => { calls += 1; return bound.get() || null; },
        all: async () => { calls += 1; return { results: bound.all() }; },
        run: async () => {
          calls += 1;
          const result = bound.run();
          return { meta: { changes: Number(result.changes || 0), last_row_id: Number(result.lastInsertRowid || 0) } };
        }
      };
    }
  });
  const db = {
    prepare(sql) { return wrap(sqlite.prepare(sql)); },
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
  return db;
}

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

async function seedHarness(db) {
  const token = "latency-test-token";
  const playerId = "player-latency";
  const characterId = "char-latency";
  db.raw.prepare("INSERT INTO players (id, diamonds) VALUES (?, ?)").run(playerId, 500);
  db.raw.prepare("INSERT INTO characters (character_id, player_id, gold, protection_stones, pets_json) VALUES (?, ?, ?, ?, ?)").run(
    characterId, playerId, 5000, 0, "{}"
  );
  db.raw.prepare("INSERT INTO auth_sessions (session_id, player_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").run(
    "session-latency", playerId, await sha256(token), new Date(Date.now() + 3600000).toISOString()
  );
  return { token, characterId };
}

async function callWorker(db, token, body) {
  return worker.fetch(new Request("https://thornie.test/api", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }), { DB: db });
}

test("real Worker + SQLite D1 harness measures purchase/sell/completeBattle round trips", async () => {
  const db = createSqliteD1();
  const { token, characterId } = await seedHarness(db);

  db.resetCount();
  const purchase = await callWorker(db, token, {
    action: "purchaseCharacterResource", characterId,
    resource: { kind: "material", id: "iron" }, quantity: 1, requestId: "purchase-latency-01"
  });
  assert.equal(purchase.status, 200);
  const purchaseCount = db.count();

  db.raw.prepare(`INSERT INTO items
    (item_id, player_id, character_id, slot_type, rarity, name, quantity, extra_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      "sell-latency-item", "player-latency", characterId, "junk", "common", "Iron", 1,
      JSON.stringify({ junkId: "iron", quantity: 1 })
  );

  db.resetCount();
  const sell = await callWorker(db, token, {
    action: "sellCharacterItem", characterId, itemId: "sell-latency-item", requestId: "sell-latency-01"
  });
  assert.equal(sell.status, 200);
  const sellCount = db.count();

  db.raw.prepare(`INSERT INTO battle_checkpoints
    (battle_id, character_id, checkpoint_seq, payload_json, state)
    VALUES (?, ?, ?, ?, 'active')`).run(
      "battle-latency-01", characterId, 1, JSON.stringify({ authorizationOnly: false })
  );

  db.resetCount();
  const completion = await callWorker(db, token, {
    action: "completeBattle", characterId, battleId: "battle-latency-01",
    result: { result: "defeat", safeActionSeq: 2 }
  });
  assert.equal(completion.status, 200);
  const completeNormalCount = db.count();

  db.resetCount();
  const replay = await callWorker(db, token, {
    action: "completeBattle", characterId, battleId: "battle-latency-01",
    result: { result: "defeat", safeActionSeq: 2 }
  });
  assert.equal(replay.status, 200);
  const completeReplayCount = db.count();

  const counts = {
    purchaseCharacterResource: purchaseCount,
    sellCharacterItem: sellCount,
    completeBattle: completeNormalCount,
    completeBattleReplay: completeReplayCount
  };
  console.log("D1 measured calls:", JSON.stringify(counts));
  assert.ok(purchaseCount <= 4);
  assert.ok(sellCount <= 4);
  assert.ok(completeNormalCount <= 4);
  assert.ok(completeReplayCount <= 2);
});
