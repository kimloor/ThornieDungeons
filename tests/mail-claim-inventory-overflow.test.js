const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");

const ROOT = path.resolve(__dirname, "..");

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
  const source = loadWorkerSource(ROOT).replace("export default {", "const workerDefault = {") + "\nglobalThis.__worker = workerDefault;";
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, Uint32Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__worker;
}

const api = workerHarness();

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

async function post(db, token, body) {
  const response = await api.fetch(new Request("https://api.test", {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body)
  }), { DB: db });
  return { status: response.status, body: await response.json() };
}

async function setup() {
  const db = database();
  const registration = await post(db, "", { action: "register", id: `MAIL_${Math.random().toString(36).slice(2, 9)}`, password: "pass", confirmPassword: "pass" });
  const token = registration.body.sessionToken;
  const created = await post(db, token, { action: "createCharacter", slotIndex: 0, name: "Mail QA" });
  return { db, token, playerId: registration.body.playerId, characterId: created.body.character.character_id };
}

function insertItem(context, itemId, type, extra = {}, options = {}) {
  const rowExtra = { ...extra };
  context.db.raw.prepare(`INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, inventory_slot, rarity, name, quantity, extra_json)
    VALUES (?, ?, ?, ?, ?, '', ?, ?, 1, ?)`).run(
    itemId, context.playerId, context.characterId, type, options.equipped ? 1 : 0, options.rarity || "common", options.name || itemId, JSON.stringify(rowExtra)
  );
}

function seedGear(context, count, prefix = "gear", start = 0, options = {}) {
  for (let i = 0; i < count; i++) insertItem(context, `${prefix}-${start + i}`, "weapon", {}, options);
}

function seedMail(context, mailId, { junk = [], items = [] } = {}) {
  context.db.raw.prepare(`INSERT INTO mailbox (mail_id, character_id, title, junk_json, items_json, created_at)
    VALUES (?, ?, 'Reward', ?, ?, '2026-10-03T00:00:00.000Z')`).run(context.mailId || mailId, context.characterId, JSON.stringify(junk), JSON.stringify(items));
}

function rows(context) {
  return context.db.raw.prepare("SELECT * FROM items WHERE character_id = ? ORDER BY item_id").all(context.characterId).map(row => ({
    ...row, extra: JSON.parse(row.extra_json || "{}")
  }));
}
function carried(context) { return rows(context).filter(row => !row.equipped && !row.extra.overflow); }
function overflow(context) { return rows(context).filter(row => !row.equipped && row.extra.overflow); }
async function claim(context, mailId) { return post(context.db, context.token, { action: "claimMail", characterId: context.characterId, mailId }); }
function equipment(name) { return { type: "weapon", rarity: "rare", name, atk: 10, empowerSlotCount: 2 }; }

test("Mail reproduction: 21 carried plus 8 non-stackable rewards uses carried capacity first", async () => {
  const context = await setup(); seedGear(context, 21); seedMail(context, "mail-case-1", { items: Array.from({ length: 8 }, (_, i) => equipment(`Reward ${i}`)) });
  const result = await claim(context, "mail-case-1");
  assert.equal(result.body.ok, true); assert.equal(carried(context).length, 29); assert.equal(overflow(context).length, 0);
});

test("Mail partial fit: 29 carried plus 8 rewards leaves only 7 in Overflow", async () => {
  const context = await setup(); seedGear(context, 29); seedMail(context, "mail-case-2", { items: Array.from({ length: 8 }, (_, i) => equipment(`Reward ${i}`)) });
  await claim(context, "mail-case-2");
  assert.equal(carried(context).length, 30); assert.equal(overflow(context).length, 7);
});

test("Mail full inventory routes every non-fitting equipment reward to Overflow", async () => {
  const context = await setup(); seedGear(context, 30); seedMail(context, "mail-case-3", { items: [equipment("Reward")] });
  await claim(context, "mail-case-3");
  assert.equal(carried(context).length, 30); assert.equal(overflow(context).length, 1);
});

test("Mail stack merge works even when all 30 carried slots are occupied", async () => {
  const context = await setup();
  insertItem(context, "iron-stack", "junk", { junkId: "iron", quantity: 50 }); seedGear(context, 29);
  seedMail(context, "mail-case-4", { junk: [{ junkId: "iron", quantity: 20 }] });
  await claim(context, "mail-case-4");
  const iron = rows(context).find(row => row.item_id === "iron-stack");
  assert.equal(carried(context).length, 30); assert.equal(overflow(context).length, 0); assert.equal(iron.extra.quantity, 70);
});

test("Mail stack boundary caps at 99 and routes the remainder normally", async () => {
  const context = await setup();
  insertItem(context, "iron-stack", "junk", { junkId: "iron", quantity: 95 }); seedGear(context, 29);
  seedMail(context, "mail-case-5", { junk: [{ junkId: "iron", quantity: 10 }] });
  await claim(context, "mail-case-5");
  const iron = rows(context).find(row => row.item_id === "iron-stack");
  assert.equal(iron.extra.quantity, 99); assert.equal(overflow(context).reduce((sum, row) => sum + (row.extra.quantity || 0), 0), 6);
});

test("Mail claim reconciles fitting existing Overflow rows without changing their identity", async () => {
  const context = await setup(); seedGear(context, 21);
  for (let i = 0; i < 8; i++) insertItem(context, `overflow-${i}`, "weapon", { overflow: true, sourceType: "legacy-test", empowerSlots: [null, { key: "atkPct", value: 4 }], favorite: true }, { rarity: "elite", name: `Overflow ${i}` });
  const before = rows(context).filter(row => row.extra.overflow).map(row => ({ id: row.item_id, extra: row.extra }));
  seedMail(context, "mail-case-6"); await claim(context, "mail-case-6");
  assert.equal(carried(context).length, 29); assert.equal(overflow(context).length, 0);
  for (const item of before) {
    const after = rows(context).find(row => row.item_id === item.id);
    assert.equal(after.extra.overflow, false); assert.equal(after.extra.sourceType, item.extra.sourceType);
    assert.deepEqual(after.extra.empowerSlots, item.extra.empowerSlots); assert.equal(after.extra.favorite, true);
  }
});

test("Equipped rows do not consume carried Mail capacity", async () => {
  const context = await setup();
  seedGear(context, 29); insertItem(context, "equipped-weapon", "weapon", {}, { equipped: true });
  seedMail(context, "mail-case-7", { items: [equipment("Reward")] }); await claim(context, "mail-case-7");
  assert.equal(carried(context).length, 30); assert.equal(overflow(context).length, 0); assert.equal(rows(context).find(row => row.item_id === "equipped-weapon").equipped, 1);
});

test("Mail claim retry does not duplicate merged or newly inserted rewards", async () => {
  const context = await setup(); seedGear(context, 21); seedMail(context, "mail-case-8", { items: [equipment("Once")] });
  const first = await claim(context, "mail-case-8"); const second = await claim(context, "mail-case-8");
  assert.equal(first.body.replayed, false); assert.equal(second.body.replayed, true); assert.equal(rows(context).filter(row => row.name === "Once").length, 1);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS n FROM item_provenance WHERE item_id LIKE 'mail-item-%'").get().n, 1);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS n FROM item_ownership_events WHERE item_id LIKE 'mail-item-%'").get().n, 1);
});

test("Concurrent duplicate Mail claims settle the reward exactly once", async () => {
  const context = await setup(); seedMail(context, "mail-case-8-concurrent", { items: [equipment("Concurrent")] });
  const [first, second] = await Promise.all([claim(context, "mail-case-8-concurrent"), claim(context, "mail-case-8-concurrent")]);
  assert.equal(Number(first.body.replayed) + Number(second.body.replayed), 1);
  assert.equal(rows(context).filter(row => row.name === "Concurrent").length, 1);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS n FROM item_provenance WHERE item_id LIKE 'mail-item-%'").get().n, 1);
});

test("Mail claim enforces character/account ownership isolation", async () => {
  const owner = await setup(); seedMail(owner, "mail-case-9", { items: [equipment("Private")] });
  const otherRegistration = await post(owner.db, "", { action: "register", id: `OTHER_${Math.random().toString(36).slice(2, 9)}`, password: "pass", confirmPassword: "pass" });
  const otherCharacter = await post(owner.db, otherRegistration.body.sessionToken, { action: "createCharacter", slotIndex: 0, name: "Other" });
  const response = await post(owner.db, otherRegistration.body.sessionToken, { action: "claimMail", characterId: owner.characterId, mailId: "mail-case-9" });
  assert.equal(response.body.error, "forbidden"); assert.equal(owner.db.raw.prepare("SELECT claimed FROM mailbox WHERE mail_id = 'mail-case-9'").get().claimed, 0);
  assert.ok(otherCharacter.body.character.character_id);
});

test("Mixed Mail resources merge material and potion before consuming a slot", async () => {
  const context = await setup(); insertItem(context, "iron-stack", "junk", { junkId: "iron", quantity: 50 }); seedGear(context, 28);
  seedMail(context, "mail-case-10", { junk: [{ junkId: "iron", quantity: 20 }, { potionId: "hp_small", quantity: 3 }], items: [equipment("Mixed Gear")] });
  await claim(context, "mail-case-10");
  const current = rows(context); const iron = current.find(row => row.item_id === "iron-stack"); const potion = current.find(row => row.extra.potionId === "hp_small");
  assert.equal(iron.extra.quantity, 70); assert.equal(potion.extra.quantity, 3); assert.equal(carried(context).length, 30); assert.equal(overflow(context).length, 1);
});

test("Mail Overflow reconciliation preserves V2 metadata and provenance identity", async () => {
  const context = await setup();
  insertItem(context, "v2-overflow", "weapon", { overflow: true, rewardVersion: 2, itemModelVersion: 2, gearTier: 5, rarity: "mythic", sourceType: "boss_reward", sourceFloor: 30, sourceIdentity: "moss-king", empowerSlots: [{ key: "critDamage", value: 12 }], bound: true }, { rarity: "mythic", name: "Spirit Greatsword" });
  seedGear(context, 29); seedMail(context, "mail-case-11");
  await claim(context, "mail-case-11");
  const after = rows(context).find(row => row.item_id === "v2-overflow");
  assert.equal(after.extra.overflow, false); assert.equal(after.extra.rewardVersion, 2); assert.equal(after.extra.gearTier, 5); assert.equal(after.extra.sourceIdentity, "moss-king");
  assert.deepEqual(after.extra.empowerSlots, [{ key: "critDamage", value: 12 }]);
  assert.equal(context.db.raw.prepare("SELECT COUNT(*) AS n FROM item_provenance WHERE item_id = 'v2-overflow'").get().n, 0);
});

test("W5.5 invalid inventory slot remains rejected while Mail settlement stays server-authoritative", async () => {
  const context = await setup(); seedMail(context, "mail-case-12", { items: [equipment("Protected")] });
  const invalid = await post(context.db, context.token, { action: "syncItems", characterId: context.characterId, items: [{ itemId: "missing", equipped: false, inventorySlot: 99999 }] });
  assert.equal(invalid.status, 403); await claim(context, "mail-case-12"); assert.equal(carried(context).length, 1);
});
