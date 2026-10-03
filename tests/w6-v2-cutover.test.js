const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const root = path.join(__dirname, "..");
const migrationPath = path.join(root, "migrations/auto/0029_w6_legacy_special_item_cleanup.sql");
const workerPath = path.join(root, "workers/thornie-dungeons-api.js");
const sharedPath = path.join(root, "workers/modules/shared.js");
const shopPath = path.join(root, "src/systems/shop.js");

function row(id, slot, rarity, extra = "{}", equipped = 0) {
  return [id, "p1", "c1", slot, rarity, id, equipped, "", "", extra];
}

test("W6 migration deletes only exact pre-V2 special-item targets and audits them", () => {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY,
      player_id TEXT,
      character_id TEXT,
      slot_type TEXT,
      rarity TEXT,
      name TEXT,
      equipped INTEGER,
      inventory_slot TEXT,
      item_template_id TEXT,
      extra_json TEXT
    );
  `);
  const insert = db.prepare("INSERT INTO items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
  [
    row("legacy-wing", "wings", "raid", JSON.stringify({ star: 5 }), 1),
    row("legacy-azure", "weapon", "azure", JSON.stringify({ setId: "azure" })),
    row("legacy-invalid-json", "accessory", "azure", "{bad"),
    row("v2-marker-model", "weapon", "azure", JSON.stringify({ itemModelVersion: 2, setId: "azure" })),
    row("v2-marker-reward", "wings", "raid", JSON.stringify({ rewardVersion: 2, wingFamily: "azure" })),
    row("v2-mythic-set", "helmet", "mythic", JSON.stringify({ itemModelVersion: 2, rewardVersion: 2, setId: "azure" })),
    row("recipe", "junk", "azure", JSON.stringify({ junkId: "recipe_azure_helmet", quantity: 1 })),
    row("ordinary", "weapon", "rare", JSON.stringify({ itemModelVersion: 1 }))
  ].forEach(values => insert.run(...values));

  db.exec(fs.readFileSync(migrationPath, "utf8"));

  const remain = db.prepare("SELECT item_id FROM items ORDER BY item_id").all().map(r => r.item_id);
  assert.deepEqual(remain, ["ordinary", "recipe", "v2-marker-model", "v2-marker-reward", "v2-mythic-set"]);

  const audit = db.prepare("SELECT item_id, reason, equipped FROM w6_legacy_item_cleanup_audit ORDER BY item_id").all();
  assert.deepEqual(audit, [
    { item_id: "legacy-azure", reason: "legacy_azure_set", equipped: 0 },
    { item_id: "legacy-invalid-json", reason: "legacy_azure_set", equipped: 0 },
    { item_id: "legacy-wing", reason: "legacy_raid_wing", equipped: 1 }
  ]);
});

test("W6 closes legacy acquisition while preserving current V2 Raid rewards", () => {
  const worker = fs.readFileSync(workerPath, "utf8");
  const shared = fs.readFileSync(sharedPath, "utf8");
  const shop = fs.readFileSync(shopPath, "utf8");

  assert.doesNotMatch(worker, /randomAzureItemDesc|AZURE_SET_DEFS|azureRandom/);
  assert.match(shared, /mythicSetFamily:\s*"azure"/);
  assert.match(worker, /MYTHIC_V2\?\.setRecipe\(family, slot, floor\)/);
  assert.match(worker, /MYTHIC_V2\?\.createMythicItem\(recipe, floor, secureRandomUnit\)/);
  assert.match(worker, /sourceType:\s*"daily_login"/);
  assert.match(worker, /rewardVersion:\s*2[\s\S]{0,80}itemModelVersion:\s*2/);

  assert.doesNotMatch(shop, /AZURE_TEST_SHOP_ITEMS|makeAzureTestShopItems|azure-test-/);

  assert.match(worker, /function isW6RetiredLegacySpecialItem/);
  assert.match(worker, /if \(isW6RetiredLegacySpecialItem\(item\)\) return;/);

  assert.match(worker, /function raidWingItemDesc\(family, rarity\)/);
  assert.match(worker, /rewardVersion:\s*2, itemModelVersion:\s*2/);
  assert.match(worker, /raidSetItemRewardDesc/);
});
