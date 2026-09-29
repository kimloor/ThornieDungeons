const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.join(__dirname, '..');
const worker = fs.readFileSync(path.join(ROOT, 'workers/thornie-dungeons-api.js'), 'utf8');
const playerCard = fs.readFileSync(path.join(ROOT, 'src/ui/playerCard.js'), 'utf8');
const migration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0024_arena_w98_rewards.sql'), 'utf8');

test('W9.8 mailbox migration adds deterministic source and claim receipt identities', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0, junk_json TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '', claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT '')`);
  db.exec(migration);
  db.prepare("INSERT INTO mailbox (mail_id, character_id, source_key, created_at) VALUES ('m1', 'c1', 'arena:season-reward:s1:c1', 'now')").run();
  assert.throws(() => db.prepare("INSERT INTO mailbox (mail_id, character_id, source_key, created_at) VALUES ('m2', 'c1', 'arena:season-reward:s1:c1', 'now')").run());
  db.prepare("INSERT INTO mailbox_claim_receipts (receipt_key, character_id, reward_json, created_at) VALUES ('mailbox:claim-all:c1:r1', 'c1', '{}', 'now')").run();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM mailbox_claim_receipts WHERE character_id = 'c1'").get().n, 1);
  db.close();
});

test('W9.8/W9.9 uses deterministic frame assets, rank history and V2 routes', () => {
  assert.match(worker, /arena-frame:\$\{current\.season_id\}:\$\{player\.character_id\}:\$\{rank\}/);
  assert.match(worker, /arena_rank_1/);
  assert.match(playerCard, /profileFrames\.arenaRank1/);
  assert.match(worker, /handleGetArenaV2History/);
  assert.match(worker, /handleGetArenaV2Ranking/);
  assert.match(worker, /claim-all:\$\{characterId\}/);
  assert.match(worker, /character_id = \? AND claimed = 0/);
});
