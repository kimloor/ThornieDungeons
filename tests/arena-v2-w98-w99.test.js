const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const worker = fs.readFileSync(path.join(ROOT, 'workers/thornie-dungeons-api.js'), 'utf8');
const playerCard = fs.readFileSync(path.join(ROOT, 'src/ui/playerCard.js'), 'utf8');
const arenaUi = fs.readFileSync(path.join(ROOT, 'src/ui/components.js'), 'utf8');
const arenaApi = fs.readFileSync(path.join(ROOT, 'src/state/api.js'), 'utf8');
const phaserUi = fs.readFileSync(path.join(ROOT, 'src/phaser/ui/PhaserBattlefield.js'), 'utf8');
const migration = fs.readFileSync(path.join(ROOT, 'migrations/auto/0024_arena_w98_rewards.sql'), 'utf8');

class D1Statement {
  constructor(db, sql, values = []) { this.db = db; this.sql = sql; this.values = values; }
  bind(...values) { return new D1Statement(this.db, this.sql, values); }
  async first() { return this.db.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.db.prepare(this.sql).all(...this.values) }; }
  async run() { const r = this.db.prepare(this.sql).run(...this.values); return { meta: { changes: Number(r.changes) } }; }
}
class D1TestDb {
  constructor() { this.raw = new DatabaseSync(':memory:'); }
  prepare(sql) { return new D1Statement(this.raw, sql); }
  async batch(statements) { return statements.map(s => { const r = this.raw.prepare(s.sql).run(...s.values); return { meta: { changes: Number(r.changes) } }; }); }
}
function loadMailboxFns() {
  const source = worker.replace('export default {', 'const workerDefault = {') + '\nglobalThis.__mailboxFns = { sendMail, handleClaimAllMail };';
  const sandbox = { console, Response, crypto, TextEncoder, Uint8Array };
  vm.createContext(sandbox); vm.runInContext(source, sandbox); return sandbox.__mailboxFns;
}
const mailboxFns = loadMailboxFns();

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

test('sendMail works against the real SQLite partial unique index and preserves legacy empty keys', async () => {
  const db = new D1TestDb();
  db.raw.exec(`CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0, junk_json TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '', claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT '')`);
  db.raw.exec(migration);
  await mailboxFns.sendMail(db, 'c1', 'A', 'B', { gold: 7 }, 'reward:s1:c1');
  await mailboxFns.sendMail(db, 'c1', 'A', 'B', { gold: 7 }, 'reward:s1:c1');
  await mailboxFns.sendMail(db, 'c1', 'legacy', 'B', { gold: 1 }, '');
  await mailboxFns.sendMail(db, 'c1', 'legacy', 'B', { gold: 1 }, '');
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM mailbox WHERE source_key = 'reward:s1:c1'").get().n, 1);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM mailbox WHERE source_key = ''").get().n, 2);
});

test('Claim All concurrent calls and lost-response replay return the same stored reward exactly once', async () => {
  const db = new D1TestDb();
  db.raw.exec(`CREATE TABLE players (id TEXT PRIMARY KEY); CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL); CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT, body TEXT, gold INTEGER, diamonds INTEGER, junk_json TEXT, items_json TEXT, claimed INTEGER, created_at TEXT, claimed_at TEXT DEFAULT '')`);
  db.raw.exec(migration);
  db.raw.prepare("INSERT INTO players VALUES ('p1')").run(); db.raw.prepare("INSERT INTO characters VALUES ('c1','p1')").run();
  db.raw.prepare("INSERT INTO mailbox (mail_id, character_id, gold, diamonds, junk_json, items_json, claimed, created_at) VALUES ('m1','c1',25,0,'','',0,'2026-01-01')").run();
  const session = { ok: true, row: { id: 'p1' } };
  const calls = await Promise.all([1, 2].map(() => mailboxFns.handleClaimAllMail(db, 'p1', session, 'c1', 'stable-request')));
  const payloads = await Promise.all(calls.map(r => r.json()));
  assert.deepEqual(payloads[0].mailIds, ['m1']);
  assert.deepEqual(payloads[1].mailIds, ['m1']);
  assert.equal(payloads[0].gold, 25); assert.equal(payloads[1].gold, 25);
  const replay = await (await mailboxFns.handleClaimAllMail(db, 'p1', session, 'c1', 'stable-request')).json();
  assert.deepEqual(replay, payloads[0]);
  assert.equal(db.raw.prepare("SELECT COUNT(*) AS n FROM mailbox WHERE claimed = 1").get().n, 1);
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

function loadPreloadGate() {
  const start = arenaUi.indexOf('function createArenaV2PreloadGate');
  const end = arenaUi.indexOf('\n\n// W9.8/W9.9 authoritative Arena V2 surface', start);
  const sandbox = { Promise, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(`${arenaUi.slice(start, end)}\nglobalThis.createArenaV2PreloadGate = createArenaV2PreloadGate;`, sandbox);
  return sandbox.createArenaV2PreloadGate;
}

test('Arena Phaser preload gate activates only after READY and rejects error/timeout', async () => {
  const createGate = loadPreloadGate();
  const readyGate = createGate(100);
  readyGate.ready();
  assert.equal(await readyGate.promise, undefined);

  const failedGate = createGate(100);
  failedGate.fail('preload_error');
  await assert.rejects(failedGate.promise, /preload_error/);

  const timeoutGate = createGate(5);
  await assert.rejects(timeoutGate.promise, /arena_preload_timeout/);
});

test('Arena V2 frontend contract uses default Phaser, Player Card and no animation-frame activation shortcut', () => {
  assert.match(phaserUi, /props\.mode === "arena" \? true : isPhaserBattleRendererEnabled\(\)/);
  assert.match(arenaApi, /function cloudGetArenaV2PlayerCard/);
  assert.match(arenaUi, /cloudGetArenaV2PlayerCard\(url, characterId, opponentKey\)/);
  assert.match(arenaUi, /preloadGateRef\.current\?\.ready\(\)/);
  assert.doesNotMatch(arenaUi.slice(arenaUi.indexOf('function ArenaV2Screen'), arenaUi.indexOf('\n}\n\n// Turns a mail')), /requestAnimationFrame/);
});
