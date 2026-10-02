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

test("Tierless V2 Wings support T5 Enhance but do not invent Empower economy", async () => {
  const context = await setup();
  seedV2(context.db, context.playerId, context.characterId, { itemId: "wing", type: "wings", rarity: "rare", capacity: 1, extra: { gearTier: undefined, wingFamily: "azure" } });
  context.setRolls([0, 0]);
  const enhanced = await mutate(context, "wing-enhance", { type: "enhance" }, "wing");
  assert.equal(enhanced.body.mutation.cost.gold, 213);
  assert.equal(state(context, "wing").item.enhance_level, 1);
  const empower = await mutate(context, "wing-empower", { type: "empower_open" }, "wing");
  assert.equal(empower.body.error, "wing_empower_economy_unresolved");
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
