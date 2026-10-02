const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");

class Statement {
  constructor(raw, sql, values = []) { this.raw = raw; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.raw, this.sql, values); }
  async first() { return this.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.values) }; }
  async run() { const result = this.raw.prepare(this.sql).run(...this.values); return { meta: { changes: Number(result.changes) } }; }
}
class D1 {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Statement(this.raw, sql); }
  async batch(statements) { const out = []; for (const statement of statements) out.push(await statement.run()); return out; }
}

function workerHarness() {
  let rolls = [];
  const cryptoFacade = {
    subtle: crypto.subtle,
    randomUUID: () => crypto.randomUUID(),
    getRandomValues(array) {
      if (array instanceof Uint32Array && rolls.length) {
        array[0] = Math.floor(Math.max(0, Math.min(.999999999999, rolls.shift())) * 0x100000000);
        return array;
      }
      return crypto.getRandomValues(array);
    }
  };
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, Uint32Array, crypto: cryptoFacade, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { api: sandbox.__worker, setRolls(next) { rolls = [...next]; } };
}

function database() {
  const db = new D1();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL, diamonds INTEGER DEFAULT 0, active_slot INTEGER, created_at TEXT NOT NULL);
    CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, slot_index INTEGER NOT NULL, name TEXT DEFAULT '', level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, stat_points INTEGER DEFAULT 0, str INTEGER DEFAULT 0, vit INTEGER DEFAULT 0, agi INTEGER DEFAULT 0, dex INTEGER DEFAULT 0, luk INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, unlocked_floor INTEGER DEFAULT 1, potions INTEGER DEFAULT 2, protection_stones INTEGER DEFAULT 0, chest_pity INTEGER DEFAULT 0, pets_json TEXT DEFAULT '[]', active_pet_id TEXT DEFAULT '', created_at TEXT, updated_at TEXT, last_active_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE items (item_id TEXT PRIMARY KEY, player_id TEXT, character_id TEXT, slot_type TEXT, equipped INTEGER DEFAULT 0, inventory_slot TEXT, item_template_id TEXT, rarity TEXT, name TEXT, item_level INTEGER DEFAULT 0, enhance_level INTEGER DEFAULT 0, bound INTEGER DEFAULT 0, quantity INTEGER DEFAULT 1, atk INTEGER DEFAULT 0, def INTEGER DEFAULT 0, hp INTEGER DEFAULT 0, mp INTEGER DEFAULT 0, extra_json TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE run_state (player_id TEXT PRIMARY KEY, floor INTEGER, level INTEGER, xp INTEGER, hp INTEGER, mp INTEGER, base_atk INTEGER, base_def INTEGER, base_max_hp INTEGER, base_max_mp INTEGER, run_gold INTEGER, potions INTEGER, updated_at TEXT, character_id TEXT);
    CREATE TABLE progress (player_id TEXT PRIMARY KEY, bank_gold INTEGER, diamonds INTEGER, best_floor INTEGER, potions INTEGER, char_level INTEGER, char_xp INTEGER, char_points INTEGER, char_str INTEGER, char_vit INTEGER, char_dex INTEGER, char_luk INTEGER, pets_json TEXT, active_pet_id TEXT, updated_at TEXT);
    CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0, junk_json TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '', claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE daily_login_claims (character_id TEXT PRIMARY KEY, login_streak INTEGER NOT NULL DEFAULT 0, last_claim_date TEXT NOT NULL DEFAULT '', total_claims INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE daily_login_claim_receipts (character_id TEXT NOT NULL, claim_date TEXT NOT NULL, claim_token TEXT NOT NULL UNIQUE, reward_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(character_id, claim_date));
    CREATE TABLE character_operation_receipts (character_id TEXT NOT NULL, operation TEXT NOT NULL, request_id TEXT NOT NULL, operation_token TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(character_id, operation, request_id));
    CREATE TABLE character_shop_offers (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, floor INTEGER NOT NULL, offers_json TEXT NOT NULL, updated_at TEXT NOT NULL);
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "fixtures/auth-v2-schema.sql"), "utf8"));
  return db;
}
async function post(api, db, token, body) {
  const response = await api.fetch(new Request("https://api.test", { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }), { DB: db });
  return { status: response.status, body: await response.json() };
}
async function setup() {
  const harness = workerHarness(), db = database();
  const registration = await post(harness.api, db, "", { action: "register", id: `W3_${Math.random().toString(36).slice(2, 9)}`, password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(harness.api, db, token, { action: "createCharacter", slotIndex: 0, name: "W3 QA" });
  const characterId = created.body.character.character_id;
  db.raw.prepare("UPDATE characters SET gold = 100000, protection_stones = 5 WHERE character_id = ?").run(characterId);
  return { ...harness, db, token, characterId, playerId: registration.body.playerId };
}
function seedV2(db, playerId, characterId, overrides = {}) {
  const capacity = overrides.capacity || 4;
  const extra = {
    rewardVersion: 2, itemModelVersion: 2, gearTier: overrides.gearTier || 1,
    empowerSlotCapacity: capacity, empowerSlots: overrides.empowerSlots || Array(capacity).fill(null),
    ...(overrides.extra || {})
  };
  db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, enhance_level, atk, def, extra_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(overrides.itemId || "v2-item", playerId, characterId, overrides.type || "weapon", overrides.rarity || "mythic", overrides.name || "V2 Item", overrides.enhanceLevel || 0, overrides.atk ?? 100, overrides.def ?? 0, JSON.stringify(extra));
  for (const [junkId, quantity] of Object.entries({ iron: 50, manaOre: 50, ...(overrides.materials || {}) })) {
    db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json) VALUES (?, ?, ?, 'junk', 'common', ?, ?)`)
      .run(`junk-${junkId}`, playerId, characterId, junkId, JSON.stringify({ junkId, quantity }));
  }
}
function mutate(context, requestId, mutation, itemId = "v2-item") {
  const row = context.db.raw.prepare("SELECT extra_json FROM items WHERE item_id = ?").get(itemId);
  const extra = row ? JSON.parse(row.extra_json || "{}") : {};
  const authoritativeMutation = mutation.expectedVersion === undefined
    ? { ...mutation, expectedVersion: Number(extra.blacksmithVersion) || 0 }
    : mutation;
  return post(context.api, context.db, context.token, { action: "mutateV2Blacksmith", characterId: context.characterId, itemId, mutation: authoritativeMutation, requestId });
}
function state(context, itemId = "v2-item") {
  const character = context.db.raw.prepare("SELECT gold, protection_stones FROM characters WHERE character_id = ?").get(context.characterId);
  const item = context.db.raw.prepare("SELECT * FROM items WHERE item_id = ?").get(itemId);
  const extra = JSON.parse(item.extra_json);
  const junk = Object.fromEntries(context.db.raw.prepare("SELECT extra_json FROM items WHERE character_id = ? AND slot_type = 'junk'").all(context.characterId).map(row => {
    const parsed = JSON.parse(row.extra_json); return [parsed.junkId, parsed.quantity];
  }));
  return { character, item, extra, junk };
}

test("Worker owns Enhance RNG/cost and retries cannot double-spend", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId);
  context.setRolls([0, 0]);
  const first = await mutate(context, "enhance-once", { type: "enhance", forgedSuccess: false, forgedCost: 0 });
  assert.equal(first.body.ok, true);
  assert.equal(first.body.mutation.success, true);
  let current = state(context);
  assert.deepEqual({ level: current.item.enhance_level, gold: current.character.gold, iron: current.junk.iron }, { level: 1, gold: 99975, iron: 49 });
  const replay = await mutate(context, "enhance-once", { type: "enhance" });
  assert.equal(replay.body.replayed, true);
  current = state(context);
  assert.deepEqual({ level: current.item.enhance_level, gold: current.character.gold, iron: current.junk.iron }, { level: 1, gold: 99975, iron: 49 });
  context.db.raw.prepare("UPDATE items SET extra_json = ? WHERE item_id = 'v2-item'").run(JSON.stringify({ ...current.extra, blacksmithReceipts: [] }));
  const oldAfterEviction = await mutate(context, "enhance-once", { type: "enhance", expectedVersion: 0 });
  assert.equal(oldAfterEviction.body.error, "blacksmith_version_conflict");
  assert.deepEqual({ level: state(context).item.enhance_level, gold: state(context).character.gold }, { level: 1, gold: 99975 });
});

test("Concurrent duplicate Enhance requests share one authoritative mutation", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId);
  context.setRolls([0, 0, 0, 0]);
  const request = { type: "enhance", expectedVersion: 0 };
  const [left, right] = await Promise.all([
    mutate(context, "enhance-concurrent", request),
    mutate(context, "enhance-concurrent", request)
  ]);
  assert.equal(left.body.ok, true);
  assert.equal(right.body.ok, true);
  assert.equal([left.body.replayed, right.body.replayed].filter(Boolean).length, 1);
  const current = state(context);
  assert.deepEqual({ level: current.item.enhance_level, gold: current.character.gold, iron: current.junk.iron }, { level: 1, gold: 99975, iron: 49 });
});

test("Worker enforces downgrade boundary and consumes Protection only when it blocks", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId, { enhanceLevel: 6 });
  context.setRolls([.99, 0]);
  const blocked = await mutate(context, "protected-down", { type: "enhance", useProtectionStone: true });
  assert.equal(blocked.body.mutation.protectionConsumed, true);
  let current = state(context);
  assert.deepEqual({ level: current.item.enhance_level, stones: current.character.protection_stones }, { level: 6, stones: 4 });
  context.setRolls([.99, .5]);
  const ordinaryFailure = await mutate(context, "protected-keep", { type: "enhance", useProtectionStone: true });
  assert.equal(ordinaryFailure.body.mutation.protectionConsumed, false);
  current = state(context);
  assert.deepEqual({ level: current.item.enhance_level, stones: current.character.protection_stones }, { level: 6, stones: 4 });
  context.setRolls([0, 0]);
  const success = await mutate(context, "protected-success", { type: "enhance", useProtectionStone: true });
  assert.equal(success.body.mutation.success, true);
  assert.equal(state(context).character.protection_stones, 4);
});

test("Worker opens, locks, and rerolls only eligible V2 Empower slots atomically", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId);
  context.setRolls([0, 0]);
  const opened0 = await mutate(context, "open-0", { type: "empower_open" });
  assert.deepEqual({ slot: opened0.body.mutation.slotIndex, key: opened0.body.mutation.option.key, value: opened0.body.mutation.option.value }, { slot: 0, key: "atkPct", value: 4 });
  context.setRolls([.21, .99]);
  await mutate(context, "open-1", { type: "empower_open" });
  let current = state(context);
  assert.equal(current.junk.manaOre, 48);
  assert.equal(current.character.gold, 99895);
  const locked = await mutate(context, "lock-0", { type: "empower_lock", slotIndex: 0 });
  assert.equal(locked.body.mutation.locked, true);
  const preserved = state(context).extra.empowerSlots[0];
  context.setRolls([.99, .99]);
  const rerolled = await mutate(context, "reroll", { type: "empower_reroll" });
  assert.equal(rerolled.body.mutation.cost.gold, 88);
  current = state(context);
  assert.deepEqual(current.extra.empowerSlots[0], preserved);
  assert.notDeepEqual(current.extra.empowerSlots[1], opened0.body.mutation.option);
  assert.equal(current.junk.manaOre, 47);
  const unlocked = await mutate(context, "unlock-0", { type: "empower_lock", slotIndex: 0 });
  assert.equal(unlocked.body.mutation.locked, false);
  assert.equal(state(context).extra.empowerSlots[0].locked, false);
});

test("Rejected V2 mutations and legacy items consume nothing", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId, { materials: { iron: 0, manaOre: 0 } });
  const before = state(context);
  const rejected = await mutate(context, "no-iron", { type: "enhance" });
  assert.equal(rejected.body.error, "insufficient_materials");
  const after = state(context);
  assert.deepEqual({ gold: after.character.gold, level: after.item.enhance_level }, { gold: before.character.gold, level: before.item.enhance_level });
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, atk, extra_json) VALUES ('legacy', ?, ?, 'weapon', 'rare', 'Legacy', 10, '{}')`).run(context.playerId, context.characterId);
  assert.equal((await mutate(context, "legacy", { type: "enhance" }, "legacy")).body.error, "not_v2_item");
});

test("Insufficient Gold or Mana Ore rejects without partial deduction", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId, { materials: { manaOre: 0 } });
  context.db.raw.prepare("UPDATE characters SET gold = 0 WHERE character_id = ?").run(context.characterId);
  const noGold = await mutate(context, "no-gold", { type: "enhance" });
  assert.equal(noGold.body.error, "insufficient_gold");
  assert.equal(state(context).junk.iron, 50);
  context.db.raw.prepare("UPDATE characters SET gold = 100000 WHERE character_id = ?").run(context.characterId);
  const noMana = await mutate(context, "no-mana", { type: "empower_open" });
  assert.equal(noMana.body.error, "insufficient_materials");
  assert.equal(state(context).character.gold, 100000);
  assert.equal(state(context).extra.empowerSlots.every(slot => slot === null), true);
});

test("Tierless V2 Wings support Enhance and server-owned Empower economy", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId, { itemId: "wing", type: "wings", rarity: "rare", capacity: 1, extra: { gearTier: undefined, wingFamily: "azure" } });
  context.setRolls([0, 0]);
  const enhanced = await mutate(context, "wing-enhance", { type: "enhance" }, "wing");
  assert.equal(enhanced.body.mutation.cost.gold, 213);
  assert.equal(state(context, "wing").item.enhance_level, 1);
  const empower = await mutate(context, "wing-empower", { type: "empower_open" }, "wing");
  assert.equal(empower.body.ok, true);
});

test("legacy full-item sync cannot overwrite authoritative V2 mutation fields", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId);
  context.setRolls([0, 0]);
  await mutate(context, "authoritative-enhance", { type: "enhance" });
  const rows = context.db.raw.prepare("SELECT * FROM items WHERE character_id = ? ORDER BY item_id").all(context.characterId);
  const payload = rows.map((row, index) => {
    const extra = JSON.parse(row.extra_json || "{}");
    if (row.item_id === "v2-item") {
      extra.empowerSlots = [{ key: "atkPct", value: 999999, locked: false }, null, null, null];
      extra.blacksmithVersion = 0;
    }
    return {
      itemId: row.item_id, slotType: row.slot_type, equipped: false, inventorySlot: index,
      itemTemplateId: row.item_template_id, rarity: row.rarity, name: row.name,
      itemLevel: row.item_level, enhanceLevel: row.item_id === "v2-item" ? 10 : row.enhance_level,
      bound: false, quantity: row.quantity, atk: 999999, def: 999999, hp: row.hp, mp: row.mp, extra
    };
  });
  const synced = await post(context.api, context.db, context.token, { action: "syncItems", characterId: context.characterId, items: payload });
  assert.equal(synced.body.ok, true);
  const current = state(context);
  assert.equal(current.item.enhance_level, 1);
  assert.equal(current.item.atk, 100);
  assert.equal(current.extra.blacksmithVersion, 1);
  assert.equal(current.extra.empowerSlots.every(slot => slot === null), true);
});

test("W4 Boss Weapon crafting is server-derived, exact-once, and W3-compatible", async () => {
  const context = await setup();
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json) VALUES ('earth-stack', ?, ?, 'junk', 'common', 'Earth Stone', ?)`)
    .run(context.playerId, context.characterId, JSON.stringify({ junkId: "earthStone", quantity: 10 }));
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json) VALUES ('w4-iron', ?, ?, 'junk', 'common', 'Iron', ?)`)
    .run(context.playerId, context.characterId, JSON.stringify({ junkId: "iron", quantity: 10 }));
  const body = { action: "craftItem", characterId: context.characterId, recipeId: "boss_weapon_spirit_greatsword", requestId: "w4-spirit-once" };
  const first = await post(context.api, context.db, context.token, body);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.character.gold, 97500);
  assert.equal(first.body.items.some(row => row.item_id === first.body.item.id), true);
  assert.deepEqual({ name: first.body.item.name, rarity: first.body.item.rarity, atk: first.body.item.atk, tier: first.body.item.gearTier, slots: first.body.item.empowerSlotCapacity },
    { name: "Spirit Greatsword", rarity: "mythic", atk: 21, tier: 1, slots: 4 });
  const afterFirst = context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId);
  const stoneAfterFirst = JSON.parse(context.db.raw.prepare("SELECT extra_json FROM items WHERE item_id = 'earth-stack'").get().extra_json).quantity;
  assert.deepEqual({ gold: afterFirst.gold, stones: stoneAfterFirst }, { gold: 97500, stones: 5 });
  const replay = await post(context.api, context.db, context.token, body);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.character.gold, 97500);
  assert.equal(replay.body.items.filter(row => row.item_id === first.body.item.id).length, 1);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE json_extract(extra_json, '$.bossWeaponId') = 'spirit_greatsword'").get().c, 1);
  assert.equal(context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId).gold, 97500);
  context.setRolls([0, 0]);
  const enhanced = await mutate(context, "w4-spirit-enhance", { type: "enhance" }, first.body.item.id);
  assert.equal(enhanced.body.ok, true);
});

test("W4 set crafting consumes canonical recipe/material cost and rejects forged identities", async () => {
  const context = await setup();
  context.db.raw.prepare("UPDATE characters SET unlocked_floor = 31 WHERE character_id = ?").run(context.characterId);
  for (const [id, qty] of [["recipe_robot_weapon", 1], ["bossHorn", 8], ["bossHide", 8]]) {
    context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json) VALUES (?, ?, ?, 'junk', 'common', ?, ?)`)
      .run(`w4-${id}`, context.playerId, context.characterId, id, JSON.stringify({ junkId: id, quantity: qty }));
  }
  const crafted = await post(context.api, context.db, context.token, { action: "craftItem", characterId: context.characterId, recipeId: "robot_weapon", requestId: "w4-robot-weapon" });
  assert.equal(crafted.body.ok, true);
  assert.deepEqual({ setId: crafted.body.item.setId, tier: crafted.body.item.gearTier, rarity: crafted.body.item.rarity, atk: crafted.body.item.atk },
    { setId: "robot", tier: 2, rarity: "mythic", atk: 27 });
  assert.equal(context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId).gold, 98875);
  const forged = await post(context.api, context.db, context.token, { action: "craftItem", characterId: context.characterId, recipeId: "forged_mythic", requestId: "w4-forged-item" });
  assert.equal(forged.body.error, "recipe_not_found");
});

test("full-item sync cannot create W4 V2 identity or convert a legacy item", async () => {
  const context = await setup();
  const payload = (itemId, extra) => ({
    itemId, slotType: "weapon", rarity: extra.rarity || "mythic", name: "Forged W4 Item",
    atk: 999999, def: 999999, hp: 0, mp: 0, enhanceLevel: 0, extra
  });
  const forged = payload("client-forged-w4", {
    rarity: "mythic", itemModelVersion: 2, rewardVersion: 2, setId: "skeleton",
    bossWeaponId: "spirit_greatsword", signatureId: "spirit_restore"
  });
  const create = await post(context.api, context.db, context.token, {
    action: "syncItems", characterId: context.characterId, items: [forged]
  });
  assert.equal(create.status, 403);
  assert.equal(create.body.error, "untrusted_v2_item");
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ?").get(context.characterId).c, 0);

  context.db.raw.prepare(`INSERT INTO items
    (item_id, player_id, character_id, slot_type, rarity, name, atk, def, hp, mp, extra_json)
    VALUES ('legacy-item', ?, ?, 'weapon', 'rare', 'Legacy Sword', 5, 0, 0, 0, '{}')`).run(context.playerId, context.characterId);
  const convert = await post(context.api, context.db, context.token, {
    action: "syncItems", characterId: context.characterId,
    items: [payload("legacy-item", { rarity: "mythic", itemModelVersion: 2, rewardVersion: 2, setId: "azure" })]
  });
  assert.equal(convert.status, 403);
  assert.equal(convert.body.error, "untrusted_v2_item");
  const legacy = context.db.raw.prepare("SELECT rarity, extra_json FROM items WHERE item_id = 'legacy-item'").get();
  assert.equal(legacy.rarity, "rare");
  assert.deepEqual(JSON.parse(legacy.extra_json), {});
});

test("presentation sync cannot create, delete, reparent, or mutate authoritative item data", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId, { materials: {} });
  const original = context.db.raw.prepare("SELECT * FROM items WHERE item_id = 'v2-item'").get();
  const synced = await post(context.api, context.db, context.token, {
    action: "syncItems", characterId: context.characterId,
    items: [{ itemId: "v2-item", slotType: "junk", rarity: "common", name: "forged", atk: 999999,
      enhanceLevel: 999, quantity: 999999, equipped: true,
      extra: { rewardVersion: 2, itemModelVersion: 2, setId: "forged", bossWeaponId: "forged", favorite: true,
        overflow: true, quantity: 999999, empowerSlots: [{ key: "atkPct", value: 999999 }] } }]
  });
  assert.equal(synced.body.ok, true);
  const after = context.db.raw.prepare("SELECT * FROM items WHERE item_id = 'v2-item'").get();
  assert.equal(after.player_id, original.player_id);
  assert.equal(after.character_id, original.character_id);
  assert.equal(after.slot_type, original.slot_type);
  assert.equal(after.rarity, original.rarity);
  assert.equal(after.name, original.name);
  assert.equal(after.atk, original.atk);
  assert.equal(after.enhance_level, original.enhance_level);
  assert.equal(after.quantity, original.quantity);
  assert.equal(after.equipped, 1);
  assert.equal(JSON.parse(after.extra_json).favorite, true);
  assert.equal(JSON.parse(after.extra_json).setId, undefined);
  assert.deepEqual(JSON.parse(after.extra_json).empowerSlots, JSON.parse(original.extra_json).empowerSlots);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id = 'junk-iron'").get().c, 1);

  const other = await post(context.api, context.db, "", { action: "register", id: `W3_${Math.random().toString(36).slice(2, 9)}`, password: "pass", confirmPassword: "pass" });
  const otherCharacter = await post(context.api, context.db, other.body.sessionToken, { action: "createCharacter", slotIndex: 0, name: "Other" });
  const crossAccount = await post(context.api, context.db, other.body.sessionToken, {
    action: "syncItems", characterId: otherCharacter.body.character.character_id,
    items: [{ itemId: "v2-item", equipped: true, extra: { favorite: false } }]
  });
  assert.equal(crossAccount.status, 403);
  const crossBlacksmith = await post(context.api, context.db, other.body.sessionToken, {
    action: "mutateV2Blacksmith", characterId: otherCharacter.body.character.character_id, itemId: "v2-item",
    mutation: { type: "enhance", expectedVersion: 0 }, requestId: "cross-account-blacksmith-01"
  });
  assert.equal(crossBlacksmith.status, 404);
  const crossSalvage = await post(context.api, context.db, other.body.sessionToken, {
    action: "salvageItem", characterId: otherCharacter.body.character.character_id, itemId: "v2-item", requestId: "cross-account-salvage-001"
  });
  assert.equal(crossSalvage.status, 403);
  assert.equal(context.db.raw.prepare("SELECT player_id FROM items WHERE item_id = 'v2-item'").get().player_id, context.playerId);
});

test("mail claim atomically credits server balances and items; retries do not double-credit", async () => {
  const context = await setup();
  context.db.raw.prepare("UPDATE players SET diamonds = 7 WHERE id = ?").run(context.playerId);
  context.db.raw.prepare(`INSERT INTO mailbox (mail_id, character_id, title, gold, diamonds, junk_json, items_json, created_at)
    VALUES ('mail-secure-1', ?, 'Reward', 125, 3, ?, ?, '2026-10-02T00:00:00.000Z')`).run(
    context.characterId,
    JSON.stringify([{ junkId: "bossHorn", quantity: 4 }]),
    JSON.stringify([{ type: "weapon", rarity: "rare", name: "Mail Sword", atk: 12, empowerSlotCount: 1 }])
  );
  const body = { action: "claimMail", characterId: context.characterId, mailId: "mail-secure-1" };
  const first = await post(context.api, context.db, context.token, body);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.character.gold, 100125);
  assert.equal(first.body.diamonds, 10);
  assert.equal(first.body.items.length, 2);
  assert.equal(first.body.items.find(item => item.name === "Mail Sword").name, "Mail Sword");
  assert.equal(JSON.parse(first.body.items.find(item => item.name === "Mail Sword").extra_json).overflow, false);
  assert.equal(context.db.raw.prepare("SELECT claimed FROM mailbox WHERE mail_id = 'mail-secure-1'").get().claimed, 1);
  assert.equal(JSON.parse(context.db.raw.prepare("SELECT extra_json FROM items WHERE slot_type = 'junk'").get().extra_json).quantity, 4);

  const replay = await post(context.api, context.db, context.token, body);
  assert.equal(replay.body.ok, true);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.character.gold, 100125);
  assert.equal(replay.body.diamonds, 10);
  assert.equal(replay.body.items.length, 2);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id LIKE 'mail-item-%'").get().c, 1);
});

test("claim-all mail commits each reward once and returns an authoritative snapshot on retry", async () => {
  const context = await setup();
  context.db.raw.prepare(`INSERT INTO mailbox (mail_id, character_id, title, gold, diamonds, junk_json, items_json, created_at)
    VALUES ('mail-all-a', ?, 'A', 20, 2, ?, '', '2026-10-02T00:00:00.000Z'),
           ('mail-all-b', ?, 'B', 30, 1, ?, '', '2026-10-02T00:01:00.000Z')`).run(
    context.characterId, JSON.stringify([{ junkId: "iron", quantity: 2 }]),
    context.characterId, JSON.stringify([{ junkId: "iron", quantity: 3 }])
  );
  const body = { action: "claimAllMail", characterId: context.characterId, requestId: "claim-all-test-1" };
  const first = await post(context.api, context.db, context.token, body);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.character.gold, 100050);
  assert.equal(first.body.diamonds, 3);
  assert.equal(first.body.mailIds.length, 2);
  assert.equal(first.body.items.length, 2);
  assert.deepEqual(first.body.items.map(item => JSON.parse(item.extra_json).quantity).sort(), [2, 3]);

  const retry = await post(context.api, context.db, context.token, body);
  assert.equal(retry.body.ok, true);
  assert.equal(retry.body.replayed, true);
  assert.equal(retry.body.character.gold, 100050);
  assert.equal(retry.body.diamonds, 3);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE slot_type = 'junk'").get().c, 2);
  assert.equal(context.db.raw.prepare("SELECT SUM(CAST(json_extract(extra_json, '$.quantity') AS INTEGER)) AS q FROM items WHERE slot_type = 'junk'").get().q, 5);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM mailbox WHERE claimed = 1").get().c, 2);
});

test("Daily Login credits on the server once and retries return the committed snapshot", async () => {
  const context = await setup();
  const body = { action: "claimDailyLogin", characterId: context.characterId };
  const [first, concurrent] = await Promise.all([
    post(context.api, context.db, context.token, body),
    post(context.api, context.db, context.token, body)
  ]);
  assert.equal(first.body.ok, true);
  assert.equal(concurrent.body.ok, true);
  assert.equal(first.body.character.gold, 105000);
  assert.equal(concurrent.body.character.gold, 105000);
  assert.equal(Number(first.body.replayed) + Number(concurrent.body.replayed), 1);
  assert.equal(context.db.raw.prepare("SELECT login_streak, total_claims FROM daily_login_claims WHERE character_id = ?").get(context.characterId).total_claims, 1);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM daily_login_claim_receipts WHERE character_id = ?").get(context.characterId).c, 1);
  const retry = await post(context.api, context.db, context.token, body);
  assert.equal(retry.body.ok, true);
  assert.equal(retry.body.replayed, true);
  assert.equal(retry.body.character.gold, 105000);
  assert.equal(context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId).gold, 105000);
});

test("stat allocation is server-derived, bounded, atomic, and request-idempotent", async () => {
  const context = await setup();
  context.db.raw.prepare("UPDATE characters SET stat_points = 10 WHERE character_id = ?").run(context.characterId);
  const body = { action: "allocateStats", characterId: context.characterId, allocations: { str: 3, vit: 2 }, requestId: "allocate-stats-0001" };
  const first = await post(context.api, context.db, context.token, body);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.character.str, 3);
  assert.equal(first.body.character.vit, 2);
  assert.equal(first.body.character.stat_points, 5);
  const replay = await post(context.api, context.db, context.token, body);
  assert.equal(replay.body.ok, true);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.character.str, 3);
  assert.equal(replay.body.character.stat_points, 5);

  const forgedStat = await post(context.api, context.db, context.token, {
    ...body, requestId: "allocate-stats-forged", allocations: { gold: 5000 }
  });
  assert.equal(forgedStat.body.error, "invalid_stat_allocation");
  const reused = await post(context.api, context.db, context.token, {
    ...body, allocations: { str: 2 }
  });
  assert.equal(reused.body.error, "operation_request_conflict");
  assert.equal(context.db.raw.prepare("SELECT str, vit, stat_points FROM characters WHERE character_id = ?").get(context.characterId).stat_points, 5);
});

test("hero skill allocation and paid stat/skill resets mutate server state exactly once", async () => {
  const context = await setup();
  context.db.raw.prepare("UPDATE players SET diamonds = 300 WHERE id = ?").run(context.playerId);
  context.db.raw.prepare("UPDATE characters SET level = 30, str = 4, vit = 2, stat_points = 1, pets_json = ? WHERE character_id = ?")
    .run(JSON.stringify({ list: [], dup: {}, skills: {}, skillVersion: 1 }), context.characterId);

  const skillBody = { action: "allocateHeroSkills", characterId: context.characterId, allocations: { power_strike: 2 }, requestId: "allocate-skills-0001" };
  const skill = await post(context.api, context.db, context.token, skillBody);
  assert.equal(skill.body.ok, true);
  assert.deepEqual(JSON.parse(skill.body.character.pets_json).skills, { power_strike: 2 });
  const skillReplay = await post(context.api, context.db, context.token, skillBody);
  assert.equal(skillReplay.body.ok, true);
  assert.equal(skillReplay.body.replayed, true);
  assert.deepEqual(JSON.parse(skillReplay.body.character.pets_json).skills, { power_strike: 2 });

  const statsBody = { action: "resetCharacterStats", characterId: context.characterId, requestId: "reset-stats-0001" };
  const stats = await post(context.api, context.db, context.token, statsBody);
  assert.equal(stats.body.ok, true);
  assert.equal(stats.body.character.str, 0);
  assert.equal(stats.body.character.vit, 0);
  assert.equal(stats.body.character.stat_points, 7);
  const statsReplay = await post(context.api, context.db, context.token, statsBody);
  assert.equal(statsReplay.body.replayed, true);
  assert.equal(context.db.raw.prepare("SELECT diamonds FROM players WHERE id = ?").get(context.playerId).diamonds, 200);

  const skillsResetBody = { action: "resetHeroSkills", characterId: context.characterId, requestId: "reset-skills-0001" };
  const skillsReset = await post(context.api, context.db, context.token, skillsResetBody);
  assert.equal(skillsReset.body.ok, true);
  assert.deepEqual(JSON.parse(skillsReset.body.character.pets_json).skills, {});
  const skillsResetReplay = await post(context.api, context.db, context.token, skillsResetBody);
  assert.equal(skillsResetReplay.body.replayed, true);
  assert.equal(context.db.raw.prepare("SELECT diamonds FROM players WHERE id = ?").get(context.playerId).diamonds, 100);
});

test("Pet gacha, star-up and active-pet selection are server-owned and exact-once", async () => {
  const context = await setup();
  context.db.raw.prepare("UPDATE players SET diamonds = 250 WHERE id = ?").run(context.playerId);
  context.db.raw.prepare("UPDATE characters SET pets_json = ?, active_pet_id = '' WHERE character_id = ?")
    .run(JSON.stringify({ list: [{ instId: "pet-owned-1", defId: "sprout", level: 1, xp: 0, star: 1, stats: { str: 3, vit: 5, agi: 4, dex: 4, luk: 4 } }], dup: { sprout: 1 }, skills: {}, skillVersion: 1 }), context.characterId);
  const gachaBody = { action: "petEconomyAction", petAction: "gacha", characterId: context.characterId, requestId: "pet-gacha-request-01" };
  const gacha = await post(context.api, context.db, context.token, gachaBody);
  assert.equal(gacha.body.ok, true);
  assert.equal(gacha.body.diamonds, 150);
  const gachaReplay = await post(context.api, context.db, context.token, gachaBody);
  assert.equal(gachaReplay.body.replayed, true);
  assert.deepEqual(gachaReplay.body.result, gacha.body.result);
  assert.equal(context.db.raw.prepare("SELECT diamonds FROM players WHERE id = ?").get(context.playerId).diamonds, 150);

  const duplicateBeforeStar = JSON.parse(context.db.raw.prepare("SELECT pets_json FROM characters WHERE character_id = ?").get(context.characterId).pets_json).dup.sprout;
  const starBody = { action: "petEconomyAction", petAction: "star_up", characterId: context.characterId, petInstId: "pet-owned-1", requestId: "pet-star-request-01" };
  const star = await post(context.api, context.db, context.token, starBody);
  assert.equal(star.body.ok, true);
  const stored = JSON.parse(context.db.raw.prepare("SELECT pets_json FROM characters WHERE character_id = ?").get(context.characterId).pets_json);
  assert.equal(stored.list[0].star, 2);
  assert.equal(stored.dup.sprout, duplicateBeforeStar - 1);
  const starReplay = await post(context.api, context.db, context.token, starBody);
  assert.equal(starReplay.body.replayed, true);
  assert.equal(JSON.parse(context.db.raw.prepare("SELECT pets_json FROM characters WHERE character_id = ?").get(context.characterId).pets_json).list[0].star, 2);

  const equip = await post(context.api, context.db, context.token, { action: "petEconomyAction", petAction: "equip", characterId: context.characterId, petInstId: "pet-owned-1" });
  assert.equal(equip.body.ok, true);
  assert.equal(equip.body.character.active_pet_id, "pet-owned-1");
  const other = await post(context.api, context.db, "", { action: "register", id: `W45_${Math.random().toString(36).slice(2, 9)}`, password: "pass", confirmPassword: "pass" });
  const otherCharacter = await post(context.api, context.db, other.body.sessionToken, { action: "createCharacter", slotIndex: 0, name: "Other" });
  const crossOwner = await post(context.api, context.db, other.body.sessionToken, { action: "petEconomyAction", petAction: "equip", characterId: otherCharacter.body.character.character_id, petInstId: "pet-owned-1" });
  assert.equal(crossOwner.status, 403);
});

test("potion stack consumption is server-side, request-idempotent and ownership-scoped", async () => {
  const context = await setup();
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, quantity, extra_json)
    VALUES ('potion-stack-a', ?, ?, 'potion', 'common', 'Small HP Potion', 1, ?)`)
    .run(context.playerId, context.characterId, JSON.stringify({ potionId: "hp_small", quantity: 2 }));
  const body = { action: "consumePotion", characterId: context.characterId, potionId: "hp_small", requestId: "potion-consume-001" };
  const first = await post(context.api, context.db, context.token, body);
  assert.equal(first.body.ok, true);
  assert.equal(JSON.parse(context.db.raw.prepare("SELECT extra_json FROM items WHERE item_id = 'potion-stack-a'").get().extra_json).quantity, 1);
  const replay = await post(context.api, context.db, context.token, body);
  assert.equal(replay.body.ok, true);
  assert.equal(replay.body.replayed, true);
  assert.equal(JSON.parse(context.db.raw.prepare("SELECT extra_json FROM items WHERE item_id = 'potion-stack-a'").get().extra_json).quantity, 1);

  const secondUse = await post(context.api, context.db, context.token, { ...body, requestId: "potion-consume-002" });
  assert.equal(secondUse.body.ok, true);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id = 'potion-stack-a'").get().c, 0);
  const noUnderflow = await post(context.api, context.db, context.token, { ...body, requestId: "potion-consume-003" });
  assert.equal(noUnderflow.body.error, "potion_not_owned");
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id = 'potion-stack-a'").get().c, 0);
});

test("material, potion and Protection Stone purchases use canonical costs and commit once", async () => {
  const context = await setup();
  context.db.raw.prepare("UPDATE players SET diamonds = 45 WHERE id = ?").run(context.playerId);
  const protectionBody = { action: "purchaseCharacterResource", characterId: context.characterId, resource: { kind: "protection_stone", price: 0, amount: 999 }, requestId: "buy-stone-request-01" };
  const stone = await post(context.api, context.db, context.token, protectionBody);
  assert.equal(stone.body.ok, true);
  assert.equal(stone.body.diamonds, 15);
  assert.equal(stone.body.character.protection_stones, 6);
  const stoneReplay = await post(context.api, context.db, context.token, protectionBody);
  assert.equal(stoneReplay.body.replayed, true);
  assert.equal(context.db.raw.prepare("SELECT diamonds FROM players WHERE id = ?").get(context.playerId).diamonds, 15);

  const materialBody = { action: "purchaseCharacterResource", characterId: context.characterId, resource: { kind: "material", id: "iron", price: 1 }, requestId: "buy-iron-request-01" };
  const material = await post(context.api, context.db, context.token, materialBody);
  assert.equal(material.body.ok, true);
  assert.equal(material.body.character.gold, 99994);
  assert.equal(material.body.items.filter(item => JSON.parse(item.extra_json).junkId === "iron").length, 1);
  const potion = await post(context.api, context.db, context.token, { action: "purchaseCharacterResource", characterId: context.characterId, resource: { kind: "potion", id: "hp_small", cost: 0 }, requestId: "buy-potion-request-01" });
  assert.equal(potion.body.ok, true);
  assert.equal(potion.body.character.gold, 99979);
  assert.equal(potion.body.items.filter(item => JSON.parse(item.extra_json).potionId === "hp_small").length, 1);
});

test("Shop stock and gear purchase are server-generated, offer-bound and exact-once", async () => {
  const context = await setup();
  const stock = await post(context.api, context.db, context.token, { action: "getCharacterShopStock", characterId: context.characterId, requestId: "shop-stock-request-001" });
  assert.equal(stock.body.ok, true);
  assert.equal(stock.body.result.items.length, 3);
  assert.ok(stock.body.result.items.every(item => item.offerId && item.rewardVersion === 2 && ["rare", "unique"].includes(item.rarity)));
  const selected = stock.body.result.items[0];
  const body = { action: "purchaseShopEquipment", characterId: context.characterId, offerId: selected.offerId, requestId: "shop-purchase-request-001", price: 0, item: { id: "forged", atk: 999999, rarity: "mythic" } };
  const purchase = await post(context.api, context.db, context.token, body);
  assert.equal(purchase.body.ok, true);
  assert.equal(purchase.body.character.gold, 100000 - selected.price);
  const created = purchase.body.items.find(item => item.item_id === purchase.body.result.itemId);
  assert.ok(created);
  assert.equal(created.atk, Number(selected.atk) || 0);
  assert.equal(created.rarity, selected.rarity);
  assert.notEqual(created.item_id, "forged");
  const replay = await post(context.api, context.db, context.token, body);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.character.gold, 100000 - selected.price);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE character_id = ? AND item_id = ?").get(context.characterId, created.item_id).c, 1);

  const fakeOffer = await post(context.api, context.db, context.token, { ...body, offerId: "offer-attacker-controlled", requestId: "shop-purchase-forged-001" });
  assert.equal(fakeOffer.body.error, "shop_offer_not_found");
  assert.equal(context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId).gold, 100000 - selected.price);
});

test("Mythic set salvage refunds server-recorded Horn/Hide exactly once; Boss Weapon returns no Stone", async () => {
  const context = await setup();
  const setExtra = { rewardVersion: 2, itemModelVersion: 2, setId: "robot", craftRecipeId: "robot_weapon", sourceFloor: 31,
    craftConsumed: [{ junkId: "recipe_robot_weapon", qty: 1 }, { junkId: "bossHorn", qty: 8 }, { junkId: "bossHide", qty: 8 }] };
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, atk, extra_json)
    VALUES ('mythic-set-salvage', ?, ?, 'weapon', 'mythic', 'Robot Weapon', 27, ?)`).run(context.playerId, context.characterId, JSON.stringify(setExtra));
  const body = { action: "salvageItem", characterId: context.characterId, itemId: "mythic-set-salvage", requestId: "salvage-set-0001" };
  const first = await post(context.api, context.db, context.token, body);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.salvage.kind, "mythic_set");
  assert.deepEqual(first.body.salvage.materials, [{ junkId: "bossHorn", quantity: 4 }, { junkId: "bossHide", quantity: 4 }]);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id = 'mythic-set-salvage'").get().c, 0);
  const retry = await post(context.api, context.db, context.token, body);
  assert.equal(retry.body.ok, true);
  assert.equal(retry.body.replayed, true);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id LIKE 'salvage-%'").get().c, 2);

  const bossExtra = { rewardVersion: 2, itemModelVersion: 2, bossWeaponId: "spirit_greatsword", sourceType: "boss_weapon", craftConsumed: [{ junkId: "earthStone", qty: 5 }] };
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, atk, extra_json)
    VALUES ('mythic-boss-salvage', ?, ?, 'weapon', 'mythic', 'Spirit Greatsword', 21, ?)`).run(context.playerId, context.characterId, JSON.stringify(bossExtra));
  const boss = await post(context.api, context.db, context.token, {
    action: "salvageItem", characterId: context.characterId, itemId: "mythic-boss-salvage", requestId: "salvage-boss-0001"
  });
  assert.equal(boss.body.ok, true);
  assert.equal(boss.body.salvage.kind, "mythic_boss_weapon");
  assert.deepEqual(boss.body.salvage.materials, []);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE json_extract(extra_json, '$.junkId') LIKE '%Stone'").get().c, 0);
});

test("server item sale consumes the owned row and credits authoritative Gold exactly once", async () => {
  const context = await setup();
  const itemId = "sale-item-owned";
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, atk, extra_json)
    VALUES (?, ?, ?, 'weapon', 'rare', 'Owned Sword', 10, '{}')`).run(itemId, context.playerId, context.characterId);
  const request = { action: "sellCharacterItem", characterId: context.characterId, itemId, requestId: "sale-request-001" };
  const first = await post(context.api, context.db, context.token, request);
  assert.equal(first.body.ok, true);
  assert.equal(first.body.result.goldGained, 27);
  const balanceAfter = context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId).gold;
  const retry = await post(context.api, context.db, context.token, request);
  assert.equal(retry.body.ok, true);
  assert.equal(retry.body.replayed, true);
  assert.equal(context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId).gold, balanceAfter);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id = ?").get(itemId).c, 0);
});

test("item sale rejects a different account and server-protected items", async () => {
  const owner = await setup();
  const otherRegistration = await post(owner.api, owner.db, "", { action: "register", id: `other_${Math.random().toString(36).slice(2, 8)}`, password: "pass", confirmPassword: "pass" });
  const otherCharacter = await post(owner.api, owner.db, otherRegistration.body.sessionToken, { action: "createCharacter", slotIndex: 0, name: "Other" });
  const itemId = "sale-owned-by-a";
  owner.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json)
    VALUES (?, ?, ?, 'weapon', 'rare', 'Locked', '{"favorite":true}')`).run(itemId, owner.playerId, owner.characterId);
  const forged = await post(owner.api, owner.db, otherRegistration.body.sessionToken, {
    action: "sellCharacterItem", characterId: otherCharacter.body.character.character_id, itemId, requestId: "cross-account-sale-01"
  });
  assert.equal(forged.status, 403);
  const favorite = await post(owner.api, owner.db, owner.token, {
    action: "sellCharacterItem", characterId: owner.characterId, itemId, requestId: "favorite-sale-001"
  });
  assert.equal(favorite.body.error, "item_favorited");
  assert.equal(owner.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE item_id = ?").get(itemId).c, 1);
});

test("generic character progress persistence rejects forged economy and progression fields", async () => {
  const context = await setup();
  context.db.raw.prepare(`UPDATE characters SET level = 4, xp = 12, stat_points = 2, str = 1, gold = 90, unlocked_floor = 3 WHERE character_id = ?`).run(context.characterId);
  context.db.raw.prepare(`UPDATE players SET diamonds = 25 WHERE id = ?`).run(context.playerId);
  const before = context.db.raw.prepare(`SELECT level, xp, stat_points, str, gold, unlocked_floor FROM characters WHERE character_id = ?`).get(context.characterId);
  const res = await post(context.api, context.db, context.token, {
    action: "saveCharacterProgress", characterId: context.characterId, diamonds: 999999,
    progress: { level: 99, xp: 999999, stat_points: 9999, str: 9999, gold: 999999, unlocked_floor: 9999 }
  });
  assert.equal(res.status, 410);
  assert.equal(res.body.error, "character_progress_requires_authoritative_operation");
  assert.deepEqual(context.db.raw.prepare(`SELECT level, xp, stat_points, str, gold, unlocked_floor FROM characters WHERE character_id = ?`).get(context.characterId), before);
  assert.equal(context.db.raw.prepare(`SELECT diamonds FROM players WHERE id = ?`).get(context.playerId).diamonds, 25);
});

test("legacy blacksmith mutations consume server-owned resources and commit item changes", async () => {
  const context = await setup();
  const extra = JSON.stringify({ empowerSlots: [null, null] });
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, enhance_level, extra_json)
    VALUES ('legacy-gear', ?, ?, 'weapon', 'rare', 'Legacy Sword', 0, ?)`).run(context.playerId, context.characterId, extra);
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json)
    VALUES ('legacy-iron', ?, ?, 'junk', 'common', 'iron', '{"junkId":"iron","quantity":1}')`).run(context.playerId, context.characterId);
  const result = await post(context.api, context.db, context.token, {
    action: "mutateLegacyBlacksmith", characterId: context.characterId, itemId: "legacy-gear",
    mutation: { type: "enhance" }, requestId: "legacy-enhance-001"
  });
  assert.equal(result.body.ok, true);
  assert.equal(result.body.character.gold, 99975);
  assert.equal(context.db.raw.prepare(`SELECT COUNT(*) AS c FROM items WHERE item_id = 'legacy-iron'`).get().c, 0);
  assert.ok([0, 1].includes(context.db.raw.prepare(`SELECT enhance_level FROM items WHERE item_id = 'legacy-gear'`).get().enhance_level));
});

test("W4 crafting marks the server-created result as Overflow when inventory is full", async () => {
  const context = await setup();
  for (let index = 0; index < 30; index++) {
    context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json)
      VALUES (?, ?, ?, 'junk', 'common', 'Filler', ?)`).run(`filler-${index}`, context.playerId, context.characterId, JSON.stringify({ junkId: `filler-${index}`, quantity: 1 }));
  }
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json)
    VALUES ('w4-fire-stack', ?, ?, 'junk', 'common', 'Fire Stone', ?)`).run(context.playerId, context.characterId, JSON.stringify({ junkId: 'fireStone', quantity: 5 }));
  const result = await post(context.api, context.db, context.token, {
    action: 'craftItem', characterId: context.characterId, recipeId: 'boss_weapon_lavalon_sword', requestId: 'w4-overflow-craft'
  });
  assert.equal(result.body.ok, true);
  const stored = context.db.raw.prepare("SELECT extra_json FROM items WHERE item_id = ?").get(result.body.item.id);
  assert.equal(JSON.parse(stored.extra_json).overflow, true);
});

test("concurrent duplicate W4 crafting spends materials and Gold exactly once", async () => {
  const context = await setup();
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, rarity, name, extra_json)
    VALUES ('w4-water-stack', ?, ?, 'junk', 'common', 'Water Stone', ?)`).run(context.playerId, context.characterId, JSON.stringify({ junkId: 'waterStone', quantity: 10 }));
  const request = { action: 'craftItem', characterId: context.characterId, recipeId: 'boss_weapon_icicle_longsword', requestId: 'w4-concurrent-craft' };
  const results = await Promise.all([
    post(context.api, context.db, context.token, request),
    post(context.api, context.db, context.token, request)
  ]);
  assert.equal(results.filter(result => result.body.ok).length >= 1, true);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS c FROM items WHERE json_extract(extra_json, '$.bossWeaponId') = 'icicle_longsword'").get().c, 1);
  assert.equal(context.db.raw.prepare("SELECT gold FROM characters WHERE character_id = ?").get(context.characterId).gold, 97500);
  assert.equal(JSON.parse(context.db.raw.prepare("SELECT extra_json FROM items WHERE item_id = 'w4-water-stack'").get().extra_json).quantity, 5);
});
