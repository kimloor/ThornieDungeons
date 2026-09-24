const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

test("Guild donation endpoint is authenticated, idempotent, and uses shared inventory selectors", () => {
  const worker = fs.readFileSync(path.join(ROOT, "workers/thornie-dungeons-api.js"), "utf8");
  const ui = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
  assert.match(worker, /verifySocialActor\(db, id, session, characterId\)/);
  assert.match(worker, /case "donateGuildItem":\s*return await handleDonateGuildItem/);
  assert.match(worker, /guild_donation_config WHERE config_id = 1/);
  assert.match(worker, /JSON\.parse\(config\.whitelist_json/);
  assert.match(worker, /donation_id TEXT PRIMARY KEY|guild_donations WHERE donation_id/);
  assert.match(ui, /inventoryItemJunkId\(item\)/);
  assert.match(ui, /inventoryItemLocked\(item\)/);
  assert.match(ui, /cloudDonateGuildItem\(url, characterId, donateJunkId, quantity, donationId\)/);
  const app = fs.readFileSync(path.join(ROOT, "src/ui/App.js"), "utf8");
  assert.match(app, /async function flushInventoryForDonation\(characterId\)/);
  assert.match(app, /persistItems\(inventoryRef\.current, equippedRef\.current, inventoryOverflowRef\.current\);[\s\S]*persistenceRef\.current\.flush\(context/);
  assert.match(app, /onBeforeDonate: flushInventoryForDonation/);
  assert.match(app, /activeCharacterIdRef\.current !== characterId/);
  const barrierIndex = ui.indexOf("await onBeforeDonate(characterId)");
  const donateIndex = ui.indexOf("cloudDonateGuildItem(url, characterId, donateJunkId, quantity, donationId)");
  assert.ok(barrierIndex >= 0 && donateIndex > barrierIndex, "persistence barrier must complete before donation POST");
});

test("Guild donation migration applies stack consumption, level cap, audit, and rollback atomically", () => {
  const migration = fs.readFileSync(path.join(ROOT, "migrations/auto/0019_guild_donation_v1.sql"), "utf8");
  const script = String.raw`
import sqlite3, json, pathlib
c = sqlite3.connect(':memory:')
c.executescript('''CREATE TABLE guilds(guild_id TEXT PRIMARY KEY, level INTEGER, exp INTEGER);
CREATE TABLE guild_members(guild_id TEXT, character_id TEXT, contribution INTEGER);
CREATE TABLE items(item_id TEXT PRIMARY KEY, character_id TEXT, slot_type TEXT, equipped INTEGER, extra_json TEXT);''')
c.execute("INSERT INTO guilds VALUES ('g1',1,0)")
c.execute("INSERT INTO guild_members VALUES ('g1','c1',0)")
c.execute("INSERT INTO guilds VALUES ('g2',2,200)")
c.execute("INSERT INTO guild_members VALUES ('g2','c2',11)")
c.executemany("INSERT INTO items VALUES (?,?,?,?,?)", [
 ('a','c1','junk',0,json.dumps({'junkId':'stone','quantity':5,'favorite':False})),
 ('b','c1','junk',0,json.dumps({'junkId':'stone','quantity':5,'favorite':False})),
 ('other-character','c2','junk',0,json.dumps({'junkId':'stone','quantity':50,'favorite':False}))])
c.executescript(pathlib.Path(r'''${path.join(ROOT, "migrations/auto/0019_guild_donation_v1.sql")}''').read_text())
def donate(did, qty, before_exp, before_level, after_exp, after_level, grant, junk='stone', character='c1', guild='g1'):
 c.execute('INSERT INTO guild_donations VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  (did,guild,character,junk,qty,grant,qty,before_level,after_level,before_exp,after_exp,'2026-01-01'))
def must_fail(did, qty, exp, level, after_exp, after_level, grant, error, junk='stone', character='c1', guild='g1'):
 try:
  donate(did,qty,exp,level,after_exp,after_level,grant,junk,character,guild)
  raise AssertionError('expected ' + error)
 except sqlite3.IntegrityError as exc:
  assert error in str(exc), str(exc)
donate('d1',8,0,1,8,1,8)
remaining = sum(json.loads(row[0])['quantity'] for row in c.execute("SELECT extra_json FROM items WHERE character_id='c1'"))
assert remaining == 2, remaining
assert c.execute("SELECT exp,level FROM guilds").fetchone() == (8,1)
assert c.execute("SELECT contribution FROM guild_members").fetchone() == (8,)
assert json.loads(c.execute("SELECT extra_json FROM items WHERE item_id='other-character'").fetchone()[0])['quantity'] == 50
assert c.execute("SELECT exp,level FROM guilds WHERE guild_id='g2'").fetchone() == (200,2)
assert c.execute("SELECT contribution FROM guild_members WHERE character_id='c2'").fetchone() == (11,)
assert c.execute("SELECT COUNT(*) FROM guild_donations").fetchone() == (1,)
try:
 donate('d1',8,0,1,8,1,8) # the same id cannot apply a second mutation
 raise AssertionError('expected duplicate-id rejection')
except sqlite3.IntegrityError:
 pass
assert sum(json.loads(row[0])['quantity'] for row in c.execute("SELECT extra_json FROM items WHERE character_id='c1'")) == 2
assert c.execute("SELECT contribution FROM guild_members WHERE character_id='c1'").fetchone() == (8,)
try:
 donate('bad',1,8,1,10,1,2) # wrong grant must abort the receipt and every trigger write
 raise AssertionError('expected rollback')
except sqlite3.IntegrityError:
 pass
assert c.execute("SELECT COUNT(*) FROM guild_donations").fetchone() == (1,)
assert sum(json.loads(row[0])['quantity'] for row in c.execute("SELECT extra_json FROM items WHERE character_id='c1'")) == 2
must_fail('qty-zero',0,8,1,8,1,0,'invalid_quantity')
must_fail('qty-over',1000,8,1,8,1,0,'invalid_quantity')
must_fail('not-whitelisted',1,8,1,9,1,1,'donation_item_not_allowed','iron')
must_fail('not-member',1,0,1,1,1,1,'not_guild_member',character='c3',guild='g1')
c.execute("INSERT INTO items VALUES ('locked','c1','junk',0,?)", (json.dumps({'junkId':'stone','quantity':20,'favorite':True}),))
c.execute("INSERT INTO items VALUES ('equipped','c1','junk',1,?)", (json.dumps({'junkId':'stone','quantity':20}),))
must_fail('locked-or-equipped',3,8,1,11,1,3,'insufficient_donation_items')
assert c.execute("SELECT COUNT(*) FROM guild_donations").fetchone() == (1,)
assert json.loads(c.execute("SELECT extra_json FROM items WHERE item_id='locked'").fetchone()[0])['quantity'] == 20
assert json.loads(c.execute("SELECT extra_json FROM items WHERE item_id='equipped'").fetchone()[0])['quantity'] == 20
c.execute("INSERT INTO items VALUES ('c','c1','junk',0,?)", (json.dumps({'junkId':'stone','quantity':1000}),))
donate('d-level-jump',700,8,1,708,3,700)
assert c.execute("SELECT exp,level FROM guilds").fetchone() == (708,3)
donate('d-one',1,708,3,709,3,1)
assert c.execute("SELECT exp,level FROM guilds").fetchone() == (709,3)
c.execute("INSERT INTO items VALUES ('max-stack','c1','junk',0,?)", (json.dumps({'junkId':'stone','quantity':999}),))
donate('d-999',999,709,3,1708,4,999)
assert c.execute("SELECT exp,level FROM guilds").fetchone() == (1708,4)
c.execute("UPDATE guilds SET level=10,exp=15300 WHERE guild_id='g1'")
donate('d2',2,15300,10,15300,10,0)
assert c.execute("SELECT exp,level FROM guilds").fetchone() == (15300,10)
assert c.execute("SELECT contribution FROM guild_members WHERE character_id='c1'").fetchone() == (1710,)
assert c.execute("SELECT guild_exp_granted,contribution_granted FROM guild_donations WHERE donation_id='d2'").fetchone() == (0,2)
for junk in ('grass','wood'):
 c.execute("INSERT INTO items VALUES (?, 'c1','junk',0,?)", (junk,json.dumps({'junkId':junk,'quantity':1})))
 donate('d-'+junk,1,15300,10,15300,10,0,junk)
assert c.execute("SELECT contribution FROM guild_members WHERE character_id='c1'").fetchone() == (1712,)
`;
  const result = spawnSync("python3", ["-c", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});


test("Guild donation persistence barrier drains an older inventory snapshot before transaction", async () => {
  const { makePersistenceContext, createPersistenceManager } = require("../src/state/persistence.js");
  const context = makePersistenceContext({
    url: "https://example.test",
    accountId: "player-1",
    characterId: "char-1",
    credential: {},
    sessionGeneration: 1,
  });
  let releaseWrite;
  const writeGate = new Promise(resolve => { releaseWrite = resolve; });
  const order = [];
  const manager = createPersistenceManager({ retries: 0 });
  manager.setActiveContext(context);
  manager.enqueue(context, "items", { quantity: 10 }, async snapshot => {
    order.push(`sync-start:${snapshot.quantity}`);
    await writeGate;
    order.push(`sync-done:${snapshot.quantity}`);
    return { ok: true };
  });

  let donationStarted = false;
  const barrier = (async () => {
    const ok = await manager.flush(context, { retryFailed: true });
    assert.equal(ok, true);
    donationStarted = true;
    order.push("donation");
  })();

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(donationStarted, false, "donation must wait while an older items snapshot is in flight");
  releaseWrite();
  await barrier;
  assert.deepEqual(order, ["sync-start:10", "sync-done:10", "donation"]);
});

test("Guild donation persistence barrier reports failed flush and must block transaction", async () => {
  const { makePersistenceContext, createPersistenceManager } = require("../src/state/persistence.js");
  const context = makePersistenceContext({
    url: "https://example.test",
    accountId: "player-1",
    characterId: "char-1",
    credential: {},
    sessionGeneration: 1,
  });
  const manager = createPersistenceManager({ retries: 0 });
  manager.setActiveContext(context);
  manager.enqueue(context, "items", { quantity: 10 }, async () => ({ error: "server_error" }));
  const ok = await manager.flush(context, { retryFailed: true });
  assert.equal(ok, false);
});
