const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const crypto = require("node:crypto").webcrypto;
const { loadWorkerSource } = require("./helpers/worker-source");
const { applyRequiredAutoMigrations } = require("./helpers/auto-migrations");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const enhancement = require("../src/systems/enhancementV2.js");

class Statement {
  constructor(raw, sql, values = []) { this.raw = raw; this.sql = sql; this.values = values; }
  bind(...values) { return new Statement(this.raw, this.sql, values); }
  async first() { return this.raw.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.raw.prepare(this.sql).all(...this.values) }; }
  async run() {
    const normalized = this.sql.trim().toUpperCase();
    if (/^(SELECT|PRAGMA)\b/.test(normalized)) return { results: this.raw.prepare(this.sql).all(...this.values) };
    const result = this.raw.prepare(this.sql).run(...this.values);
    return { meta: { changes: Number(result.changes) } };
  }
}
class D1 {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new Statement(this.raw, sql); }
  async batch(statements) {
    const out = [];
    for (const statement of statements) out.push(await statement.run());
    return out;
  }
}

function workerHarness() {
  const source = loadWorkerSource(root).replace("export default {", "const workerDefault = {")
    + "\nglobalThis.__worker = workerDefault; globalThis.__raidTest = { raidDateKey, handleClaimRaidMilestones, settleRaidRank };";
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, Uint32Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { api: sandbox.__worker, raid: sandbox.__raidTest };
}
const harness = workerHarness();

function database() {
  const db = new D1();
  db.raw.exec([
    "PRAGMA foreign_keys=ON;",
    "CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL, diamonds INTEGER DEFAULT 0, active_slot INTEGER, created_at TEXT NOT NULL);",
    "CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, slot_index INTEGER NOT NULL, name TEXT DEFAULT '', level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, stat_points INTEGER DEFAULT 0, str INTEGER DEFAULT 0, vit INTEGER DEFAULT 0, agi INTEGER DEFAULT 0, dex INTEGER DEFAULT 0, luk INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, unlocked_floor INTEGER DEFAULT 1, potions INTEGER DEFAULT 2, protection_stones INTEGER DEFAULT 0, chest_pity INTEGER DEFAULT 0, pets_json TEXT DEFAULT '[]', active_pet_id TEXT DEFAULT '', created_at TEXT, updated_at TEXT, last_active_at TEXT NOT NULL DEFAULT '');",
    "CREATE TABLE items (item_id TEXT PRIMARY KEY, player_id TEXT, character_id TEXT, slot_type TEXT, equipped INTEGER DEFAULT 0, inventory_slot TEXT, item_template_id TEXT, rarity TEXT, name TEXT, item_level INTEGER DEFAULT 0, enhance_level INTEGER DEFAULT 0, bound INTEGER DEFAULT 0, quantity INTEGER DEFAULT 1, atk INTEGER DEFAULT 0, def INTEGER DEFAULT 0, hp INTEGER DEFAULT 0, mp INTEGER DEFAULT 0, extra_json TEXT, created_at TEXT, updated_at TEXT);",
    "CREATE TABLE run_state (player_id TEXT PRIMARY KEY, floor INTEGER, level INTEGER, xp INTEGER, hp INTEGER, mp INTEGER, base_atk INTEGER, base_def INTEGER, base_max_hp INTEGER, base_max_mp INTEGER, run_gold INTEGER, potions INTEGER, updated_at TEXT, character_id TEXT);",
    "CREATE TABLE progress (player_id TEXT PRIMARY KEY, bank_gold INTEGER, diamonds INTEGER, best_floor INTEGER, potions INTEGER, char_level INTEGER, char_xp INTEGER, char_points INTEGER, char_str INTEGER, char_vit INTEGER, char_dex INTEGER, char_luk INTEGER, pets_json TEXT, active_pet_id TEXT, updated_at TEXT);",
    "CREATE TABLE mailbox (mail_id TEXT PRIMARY KEY, character_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '', gold INTEGER NOT NULL DEFAULT 0, diamonds INTEGER NOT NULL DEFAULT 0, junk_json TEXT NOT NULL DEFAULT '', items_json TEXT NOT NULL DEFAULT '', claimed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, claimed_at TEXT NOT NULL DEFAULT '', source_key TEXT NOT NULL DEFAULT '');",
    "CREATE UNIQUE INDEX idx_test_mail_source_key ON mailbox(source_key) WHERE source_key <> '';",
    "CREATE TABLE daily_login_claims (character_id TEXT PRIMARY KEY, login_streak INTEGER NOT NULL DEFAULT 0, last_claim_date TEXT NOT NULL DEFAULT '', total_claims INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT '');",
    "CREATE TABLE daily_login_claim_receipts (character_id TEXT NOT NULL, claim_date TEXT NOT NULL, claim_token TEXT NOT NULL UNIQUE, reward_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(character_id, claim_date));",
    "CREATE TABLE character_operation_receipts (character_id TEXT NOT NULL, operation TEXT NOT NULL, request_id TEXT NOT NULL, operation_token TEXT NOT NULL UNIQUE, payload_json TEXT NOT NULL, result_json TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY(character_id, operation, request_id));",
    "CREATE TABLE character_shop_offers (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, floor INTEGER NOT NULL, offers_json TEXT NOT NULL, updated_at TEXT NOT NULL);",
    "CREATE TABLE raid_boss_state (raid_id TEXT PRIMARY KEY, date TEXT NOT NULL, boss_def_id TEXT NOT NULL, boss_hp_max INTEGER NOT NULL, boss_hp_current INTEGER NOT NULL, settled_at TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT '');",
    "CREATE TABLE raid_participants (raid_id TEXT NOT NULL, character_id TEXT NOT NULL, total_contribution INTEGER NOT NULL DEFAULT 0, milestone_claimed TEXT NOT NULL DEFAULT '', PRIMARY KEY(raid_id, character_id));",
    "CREATE TABLE raid_milestone_snapshots (raid_id TEXT NOT NULL, character_id TEXT NOT NULL, p99_json TEXT, PRIMARY KEY(raid_id, character_id));"
  ].join("\n"));
  db.raw.exec(read("tests/fixtures/auth-v2-schema.sql"));
  applyRequiredAutoMigrations(db, root);
  return db;
}

async function post(db, token, body) {
  const response = await harness.api.fetch(new Request("https://api.test", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    body: JSON.stringify(body)
  }), { DB: db });
  return { status: response.status, body: await response.json() };
}
async function setup() {
  const db = database();
  const registration = await post(db, "", { action: "register", id: "WINGQA_" + Math.random().toString(36).slice(2, 9), password: "pass", confirmPassword: "pass" });
  assert.ok(registration.body.sessionToken, "test account registration should succeed");
  const created = await post(db, registration.body.sessionToken, { action: "createCharacter", slotIndex: 0, name: "Wing QA" });
  assert.ok(created.body.character?.character_id, "test character creation should succeed");
  return { db, token: registration.body.sessionToken, playerId: registration.body.playerId, characterId: created.body.character.character_id };
}
function seedRaid(db, raidId, contributions, hpMax = 1000) {
  db.raw.prepare("INSERT INTO raid_boss_state (raid_id, date, boss_def_id, boss_hp_max, boss_hp_current, settled_at, created_at, updated_at) VALUES (?, ?, 'azure_angel', ?, ?, '', '2026-10-09T00:00:00.000Z', '')")
    .run(raidId, harness.raid.raidDateKey(), hpMax, hpMax);
  const insert = db.raw.prepare("INSERT INTO raid_participants (raid_id, character_id, total_contribution, milestone_claimed) VALUES (?, ?, ?, '')");
  for (const row of contributions) insert.run(raidId, row.characterId, row.contribution);
}
function parseWing(mail) {
  const items = JSON.parse(mail.items_json || "[]");
  assert.equal(items.length, 1, "Wing reward mail should contain exactly one item");
  return items[0];
}
const capacityByRarity = { rare: 1, unique: 2, elite: 3, mythic: 4 };
function assertValidWingOptions(item, rarity) {
  const capacity = capacityByRarity[rarity];
  assert.equal(item.type, "wings");
  assert.equal(item.rarity, rarity);
  assert.equal(item.empowerSlotCapacity, capacity);
  assert.equal(item.empowerSlotCount, capacity);
  assert.equal(item.empowerSlots.length, capacity);
  for (const [index, option] of item.empowerSlots.entries()) {
    assert.ok(option && typeof option === "object", rarity + " slot " + index + " must be pre-rolled");
    assert.equal(typeof option.key, "string");
    assert.ok(option.key.length > 0);
    assert.equal(typeof option.value, "number");
    assert.ok(Number.isFinite(option.value));
    assert.equal(enhancement.isValidEmpowerOption("wings", option), true, "slot option must be valid for Wings");
  }
}
async function claimMailAndVerifyWing(context, mail, expectedItem) {
  const result = await post(context.db, context.token, { action: "claimMail", characterId: context.characterId, mailId: mail.mail_id });
  assert.equal(result.body.ok, true, "real claimMail endpoint should accept the Raid Wing mail");
  const row = context.db.raw.prepare("SELECT * FROM items WHERE character_id = ? AND slot_type = 'wings' ORDER BY created_at DESC LIMIT 1").get(context.characterId);
  assert.ok(row, "claimed Wing should exist in inventory");
  const extra = JSON.parse(row.extra_json || "{}");
  assert.deepEqual(extra.empowerSlots, expectedItem.empowerSlots, "claimed inventory item must preserve every server-issued option");
  assert.equal(extra.empowerSlotCapacity, expectedItem.empowerSlotCapacity);
  assertValidWingOptions({ ...expectedItem, empowerSlots: extra.empowerSlots, empowerSlotCapacity: extra.empowerSlotCapacity }, expectedItem.rarity);
}

test("W5 Raid family mapping and reward matrix are server-owned", () => {
  const worker = read("workers/thornie-dungeons-api.js");
  for (const [boss, family] of [["azure_angel", "azure"], ["robo_phoenix", "robot"], ["dark_dragonlord", "skeleton"]]) {
    assert.match(worker, new RegExp("id: \\\"" + boss + "\\\"[^}]*family: \\\"" + family + "\\\""));
  }
  assert.match(worker, /wingRarity: "mythic"/);
  assert.match(worker, /wingRarity: "elite"/);
  assert.match(worker, /wingRarity: "unique"/);
  assert.match(worker, /randomSetRecipeJunkId\\(family\\)/);
  assert.match(worker, /raidAccessoryRewardDesc\\(floor, Math\\.random\\(\\) < 0\\.8 \\? "unique" : "elite"\\)/);
  assert.match(worker, /raidSetItemRewardDesc\\(family, Number\\(character\\.unlocked_floor\\)/);
  assert.match(worker, /raid_milestone_snapshots/);
});

test("W5 wings remain tierless and rarity controls Empower capacity", () => {
  assert.deepEqual(
    Object.fromEntries(["rare", "unique", "elite", "mythic"].map(rarity => [rarity, enhancement.EMPOWER_CAPACITY[rarity]])),
    capacityByRarity
  );
  assert.match(read("src/systems/enhancementV2.js"), /WING_PRIMARY_STAT = Object\\.freeze\\(\\{ azure: "agi", robot: "vit", skeleton: "str" \\}\\)/);
});

test("Raid milestone sends pre-rolled rare Wing options and claimed inventory preserves them", async () => {
  const context = await setup();
  const raidId = "raid-wing-milestone-qa";
  seedRaid(context.db, raidId, [{ characterId: context.characterId, contribution: 250 }], 1000);
  const response = await harness.raid.handleClaimRaidMilestones(context.db, context.playerId, { ok: true, row: { id: context.playerId } }, context.characterId);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).ok, true);
  const mail = context.db.raw.prepare("SELECT * FROM mailbox WHERE character_id = ? AND source_key LIKE ? ORDER BY created_at DESC LIMIT 1")
    .get(context.characterId, "raid-milestone:" + raidId + ":%");
  assert.ok(mail, "milestone handler should write its real mailbox payload");
  const wing = parseWing(mail);
  assertValidWingOptions(wing, "rare");
  await claimMailAndVerifyWing(context, mail, wing);
});

test("Raid rank mails pre-roll unique, elite, and mythic Wing options", async () => {
  const context = await setup();
  const raidId = "raid-wing-rank-qa";
  const participants = [
    { characterId: context.characterId, contribution: 400 },
    { characterId: "rank-two-character", contribution: 300 },
    { characterId: "rank-three-character", contribution: 200 },
    { characterId: "rank-four-character", contribution: 100 }
  ];
  seedRaid(context.db, raidId, participants, 1000);
  await harness.raid.settleRaidRank(context.db, raidId);
  const rows = context.db.raw.prepare("SELECT * FROM mailbox WHERE source_key LIKE ? ORDER BY body").all("raid:rank:" + raidId + ":%");
  const rewardByCharacter = new Map(rows.map(mail => [mail.character_id, mail]));
  const expected = [
    { characterId: context.characterId, rarity: "mythic" },
    { characterId: "rank-two-character", rarity: "elite" },
    { characterId: "rank-three-character", rarity: "unique" }
  ];
  for (const entry of expected) {
    const mail = rewardByCharacter.get(entry.characterId);
    assert.ok(mail, "settleRaidRank should write a real rank mail for " + entry.rarity);
    const wing = parseWing(mail);
    assertValidWingOptions(wing, entry.rarity);
    if (entry.characterId === context.characterId) await claimMailAndVerifyWing(context, mail, wing);
  }
});

test("W5 visual resolver binds all approved Wing families without weakening V4 authority", () => {
  const resolver = read("src/phaser/presentation/EquipmentVisualResolver.js");
  assert.match(resolver, /identities\\.includes\\("azure"\\)/);
  assert.match(resolver, /identities\\.includes\\("robot"\\)/);
  assert.match(resolver, /identities\\.includes\\("skeleton"\\)/);
  assert.match(read("workers/thornie-dungeons-api.js"), /character_operation_receipts/);
  assert.match(read("workers/thornie-dungeons-api.js"), /saveCharacterProgress/);
  assert.match(read("workers/thornie-dungeons-api.js"), /character_progress_requires_authoritative_operation/);
});
