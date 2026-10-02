const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const {
  createPersistenceManager,
  makePersistenceContext
} = require("../src/state/persistence.js");

const immediateDelay = () => Promise.resolve();
const context = (accountId = "account-a", characterId = "char-a", generation = 1) =>
  makePersistenceContext({
    url: "https://example.test/api",
    accountId,
    characterId,
    credential: { kind: "session_token" },
    sessionGeneration: generation
  });

test("normal snapshot save moves saving -> saved", async () => {
  const statuses = [];
  const manager = createPersistenceManager({ onStatusChange: status => statuses.push(status), delay: immediateDelay });
  const owner = context();
  manager.setActiveContext(owner);
  await manager.enqueue(owner, "character_progress", { level: 2 }, async snapshot => ({ ok: snapshot.level === 2 }));
  assert.equal(await manager.flush(owner), true);
  assert.equal(manager.status(owner), "saved");
  assert.ok(statuses.includes("saving"));
  assert.equal(statuses.at(-1), "saved");
});

test("rapid saves preserve order and coalesce superseded snapshots to latest", async () => {
  const calls = [];
  let releaseFirst;
  const firstGate = new Promise(resolve => { releaseFirst = resolve; });
  const manager = createPersistenceManager({ delay: immediateDelay });
  const owner = context();
  const write = async snapshot => {
    calls.push(snapshot.revision);
    if (snapshot.revision === 1) await firstGate;
    return { ok: true };
  };
  const first = manager.enqueue(owner, "items", { revision: 1 }, write);
  const second = manager.enqueue(owner, "items", { revision: 2 }, write);
  const third = manager.enqueue(owner, "items", { revision: 3 }, write);
  releaseFirst();
  assert.equal(await manager.flush(owner), true);
  await Promise.all([first, second, third]);
  assert.deepEqual(calls, [1, 3]);
});

test("terminal failure stays failed/dirty and manual retry sends the latest snapshot", async () => {
  const calls = [];
  let online = false;
  const manager = createPersistenceManager({ retries: 2, delay: immediateDelay });
  const owner = context();
  const write = async snapshot => {
    calls.push(snapshot.revision);
    return online ? { ok: true } : { error: "network_error" };
  };
  const original = manager.enqueue(owner, "character_progress", { revision: 1 }, write);
  assert.equal(await manager.flush(owner, { retryFailed: false }), false);
  assert.equal(manager.status(owner), "failed");
  const latest = manager.enqueue(owner, "character_progress", { revision: 2 }, write);
  assert.equal(await manager.flush(owner, { retryFailed: false }), false);
  assert.equal(manager.status(owner), "failed");
  online = true;
  assert.equal(await manager.retry(owner), true);
  await Promise.all([original, latest]);
  assert.equal(calls.at(-1), 2);
  assert.equal(manager.status(owner), "saved");
});

test("auth/validation errors are not automatically retried", async () => {
  let attempts = 0;
  const manager = createPersistenceManager({ retries: 5, delay: immediateDelay });
  const owner = context();
  manager.enqueue(owner, "items", [], async () => {
    attempts += 1;
    return { error: "forbidden" };
  });
  assert.equal(await manager.flush(owner, { retryFailed: false }), false);
  assert.equal(attempts, 1);
  assert.equal(await manager.retry(owner), false);
  assert.equal(attempts, 1);
});

test("character and session generations own independent queues", async () => {
  const writes = [];
  const manager = createPersistenceManager({ delay: immediateDelay });
  const charA = context("account-a", "char-a", 4);
  const charB = context("account-a", "char-b", 4);
  const nextSessionA = context("account-a", "char-a", 5);
  const write = async (snapshot, owner) => {
    writes.push([owner.characterId, owner.sessionGeneration, snapshot.value]);
    return { ok: true };
  };
  await Promise.all([
    manager.enqueue(charA, "items", { value: "a" }, write),
    manager.enqueue(charB, "items", { value: "b" }, write),
    manager.enqueue(nextSessionA, "items", { value: "new-session" }, write)
  ]);
  assert.deepEqual(new Set(writes.map(row => `${row[0]}:${row[1]}:${row[2]}`)), new Set([
    "char-a:4:a", "char-b:4:b", "char-a:5:new-session"
  ]));
  manager.invalidate(charA);
  assert.equal(await manager.enqueue(charA, "items", { value: "stale" }, write), false);
  assert.equal(writes.some(row => row[2] === "stale"), false);
});

test("generic POST does not replay a non-idempotent transaction", async () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "../src/state/api.js"), "utf8");
  let fetchCount = 0;
  const sandbox = {
    URLSearchParams,
    setTimeout: callback => callback(),
    fetch: async () => {
      fetchCount += 1;
      throw new Error("offline");
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(apiSource, sandbox);
  const result = await sandbox.cloudPost("https://example.test/api", { action: "craftItem" });
  assert.equal(result.error, "network_error");
  assert.equal(fetchCount, 1);
});

test("central snapshot API uses bearer token and never sends password/player id", async () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "../src/state/api.js"), "utf8");
  const bodies = [];
  const headers = [];
  const sandbox = {
    URLSearchParams,
    setTimeout: callback => callback(),
    AUTH_SESSION: {
      getToken: () => "token-1",
      getGeneration: () => 2,
      handleApiResult: result => result
    },
    fetch: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      headers.push(options.headers);
      return { status: 200, json: async () => ({ ok: true }) };
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(apiSource, sandbox);
  const tokenContext = makePersistenceContext({
    url: "https://example.test/api",
    accountId: "account-a",
    characterId: "char-a",
    credential: { kind: "session_token" },
    sessionGeneration: 2
  });
  await sandbox.cloudSaveSnapshot(tokenContext, "run_state", { floor: 4, hp: 20 });
  assert.equal(headers[0].Authorization, "Bearer token-1");
  assert.equal("password" in bodies[0], false);
  assert.equal("id" in bodies[0], false);
  assert.equal("sessionToken" in bodies[0], false);
});

test("existing character and inventory shapes remain compatible without a generic progress serializer", () => {
  const sandbox = {
    console,
    kvGet: async () => null,
    kvSet: async () => {},
    emptyEquipped: () => ({ weapon: null, armor: null }),
    JUNK_INFO: { iron: { icon: "iron" } },
    getPotionDef: () => null,
    RARITY_STARS: { common: 1 }
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/state/save.js"), "utf8"), sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../src/state/serialize.js"), "utf8"), sandbox);
  assert.equal(typeof sandbox.characterProgressToServer, "undefined");

  const account = sandbox.accountFromLoginResponse({
    player: { diamonds: 12, activeSlot: 0 },
    characters: [{
      character_id: "char-legacy", slot_index: 0, name: "Legacy", level: 9, xp: 40,
      stat_points: 2, str: 3, vit: 4, agi: 5, dex: 6, luk: 7, gold: 88,
      unlocked_floor: 6, potions: 0, protection_stones: 1, chest_pity: 2,
      pets_json: JSON.stringify([{ instId: "pet-old" }]), active_pet_id: "pet-old"
    }]
  });
  const flat = sandbox.flattenCharacterForRuntime(account, 0);
  assert.equal(flat.character.level, 9);
  assert.deepEqual(Array.from(flat.pets, pet => pet.instId), ["pet-old"]);

  const equipped = { weapon: { id: "w1", type: "weapon", rarity: "common", name: "Sword", atk: 3 }, armor: null };
  const inventory = [{ id: "j1", type: "junk", junkId: "iron", rarity: "common", name: "Iron", quantity: 4 }];
  const overflow = [{ id: "o1", type: "weapon", rarity: "rare", name: "Overflow Sword", atk: 9, favorite: true }];
  const list = sandbox.itemsToServerList(inventory, equipped, overflow);
  const rows = list.map(item => ({
    item_id: item.itemId, slot_type: item.slotType, equipped: item.equipped ? 1 : 0,
    rarity: item.rarity, name: item.name, atk: item.atk, def: item.def, hp: item.hp, mp: item.mp,
    enhance_level: item.enhanceLevel, extra_json: JSON.stringify(item.extra)
  }));
  const restored = sandbox.itemsFromServerList(rows);
  assert.equal(restored.equipped.weapon.id, "w1");
  assert.equal(restored.inventory[0].quantity, 4);
  assert.equal(restored.overflow[0].id, "o1");
  assert.equal(restored.overflow[0].favorite, true);

  const legacyRows = [
    { item_id: "old-w1", slot_type: "weapon", equipped: 0, rarity: "common", name: "Wooden Sword", atk: 3, def: 0, hp: 0, mp: 0, item_level: 0, enhance_level: 0, extra_json: "{}" },
    { item_id: "old-c2", slot_type: "chest", equipped: 0, rarity: "common", name: "Leather Vest", atk: 0, def: 4, hp: 0, mp: 0, item_level: 0, enhance_level: 0, extra_json: "{}" },
    { item_id: "old-b2", slot_type: "boots", equipped: 0, rarity: "common", name: "Leather Boots", atk: 0, def: 2, hp: 0, mp: 0, item_level: 0, enhance_level: 0, extra_json: "{}" }
  ];
  const migrated = sandbox.itemsFromServerList(legacyRows);
  assert.equal(migrated.legacyEquipmentMigrated, true);
  assert.deepEqual(Array.from(migrated.inventory, item => [item.name, item.gearTier]), [
    ["Beginner Sword", 1],
    ["Bronze Armor", 2],
    ["Bronze Greaves", 2]
  ]);
  const migratedPersisted = sandbox.itemsToServerList(migrated.inventory, migrated.equipped, migrated.overflow);
  assert.deepEqual(Array.from(migratedPersisted, item => item.extra.gearTier), [1, 2, 2]);

  const newLeatherVest = sandbox.itemsFromServerList([{
    item_id: "new-c1", slot_type: "chest", equipped: 0, rarity: "common", name: "Leather Vest",
    atk: 0, def: 1, hp: 0, mp: 0, item_level: 0, enhance_level: 0,
    extra_json: JSON.stringify({ gearTier: 1 })
  }]);
  assert.equal(newLeatherVest.legacyEquipmentMigrated, false);
  assert.equal(newLeatherVest.inventory[0].name, "Leather Vest");
  assert.equal(newLeatherVest.inventory[0].gearTier, 1);
});

test("standard equipment name pools match the locked T1-T5 progression", () => {
  const pets = fs.readFileSync(path.join(__dirname, "../src/systems/pets.js"), "utf8");
  const stats = fs.readFileSync(path.join(__dirname, "../src/systems/stats.js"), "utf8");
  assert.match(pets, /WEAPON_NAMES = \["Beginner Sword", "Copper Blade", "Steel Greatsword", "Platinum Greatsword", "Dragon Slayer Sword"\]/);
  assert.match(pets, /HELMET_NAMES = \["Leather Cap", "Bronze Guard Helm", "Steel Helm", "Platinum Helm", "Dragon Scale Helm"\]/);
  assert.match(pets, /CHEST_NAMES = \["Leather Vest", "Bronze Armor", "Chain Armor", "Platinum Plate Armor", "Dragon Scale Armor"\]/);
  assert.match(pets, /GLOVES_NAMES = \["Leather Gloves", "Bronze Gauntlets", "Chain Gloves", "Platinum Gauntlets", "Dragonhide Gloves"\]/);
  assert.match(pets, /BOOTS_NAMES = \["Leather Boots", "Bronze Greaves", "Chain Boots", "Platinum Sabatons", "Dragonhide Boots"\]/);
  assert.match(stats, /gearTier: gearTierForFloor\(floor\)/);
});
