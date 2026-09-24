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

test("Guild donation uses a guarded single D1 batch and trigger migrations are no-op recovery markers", () => {
  const worker = fs.readFileSync(path.join(ROOT, "workers/thornie-dungeons-api.js"), "utf8");
  const m20 = fs.readFileSync(path.join(ROOT, "migrations/auto/0020_guild_donation_validate_trigger.sql"), "utf8");
  const m21 = fs.readFileSync(path.join(ROOT, "migrations/auto/0021_guild_donation_apply_trigger.sql"), "utf8");

  assert.doesNotMatch(m20, /CREATE\s+TRIGGER/i);
  assert.doesNotMatch(m21, /CREATE\s+TRIGGER/i);
  assert.match(worker, /const operationToken = Math\.floor\(Math\.random\(\) \* 0x7fffffff\) \+ 1/);
  assert.match(worker, /await db\.batch\(\[/);
  assert.match(worker, /INSERT OR IGNORE INTO guild_donation_stack_snapshot[\s\S]*'__lock__'/);
  assert.match(worker, /INSERT INTO guild_donations[\s\S]*ON CONFLICT\(donation_id\) DO NOTHING/);
  assert.match(worker, /SELECT SUM\(CAST\(json_extract\(extra_json, '\$\.quantity'\) AS INTEGER\)\)/);
  assert.match(worker, /UPDATE items SET extra_json = json_set\(extra_json, '\$\.quantity'/);
  assert.match(worker, /UPDATE guilds SET exp=\?, level=\?/);
  assert.match(worker, /UPDATE guild_members SET contribution=contribution\+\?/);
  assert.match(worker, /receiptInsert\?\.meta\?\.changes/);
  assert.match(worker, /committed && committed\.character_id === characterId/);

  const lockIndex = worker.indexOf("INSERT OR IGNORE INTO guild_donation_stack_snapshot", worker.indexOf("async function handleDonateGuildItem"));
  const receiptIndex = worker.indexOf("INSERT INTO guild_donations", lockIndex);
  const consumeIndex = worker.indexOf("UPDATE items SET extra_json", receiptIndex);
  const guildIndex = worker.indexOf("UPDATE guilds SET exp=", consumeIndex);
  const contributionIndex = worker.indexOf("UPDATE guild_members SET contribution=", guildIndex);
  const cleanupIndex = worker.indexOf("DELETE FROM guild_donation_stack_snapshot", contributionIndex);
  assert.ok(lockIndex >= 0 && receiptIndex > lockIndex && consumeIndex > receiptIndex && guildIndex > consumeIndex && contributionIndex > guildIndex && cleanupIndex > contributionIndex);
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
