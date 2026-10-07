const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("W5 Raid family mapping and reward matrix are server-owned", () => {
  const worker = read("workers/thornie-dungeons-api.js");
  for (const [boss, family] of [["azure_angel", "azure"], ["robo_phoenix", "robot"], ["dark_dragonlord", "skeleton"]]) {
    assert.match(worker, new RegExp(`id: "${boss}"[^}]*family: "${family}"`));
  }
  assert.match(worker, /wingRarity: "mythic"/);
  assert.match(worker, /wingRarity: "elite"/);
  assert.match(worker, /wingRarity: "unique"/);
  assert.match(worker, /randomSetRecipeJunkId\(family\)/);
  assert.match(worker, /raidAccessoryRewardDesc\(floor, Math\.random\(\) < 0\.8 \? "unique" : "elite"\)/);
  assert.match(worker, /raidSetItemRewardDesc\(family, Number\(character\.unlocked_floor\)/);
  assert.match(worker, /raid_milestone_snapshots/);
});

test("W5 wings remain tierless and rarity controls Empower capacity only", () => {
  const enhancement = read("src/systems/enhancementV2.js");
  const worker = read("workers/thornie-dungeons-api.js");
  assert.match(enhancement, /WING_PRIMARY_STAT = Object\.freeze\(\{ azure: "agi", robot: "vit", skeleton: "str" \}\)/);
  assert.match(enhancement, /if \(String\(item\?\.type.*wings.*\) return wingFamily\(item\) \? 1 : null/);
  assert.match(worker, /type: "wings", rarity: r, name:/);
  assert.match(worker, /rewardVersion: 2, itemModelVersion: 2/);
  assert.match(worker, /wingFamily: f/);
  assert.match(worker, /empowerSlots: globalThis\.ENHANCEMENT_V2_RULES\?\.fillEmpowerSlots/);
});

test("Raid Wing mail rewards preserve server-generated Enchant options when claimed", () => {
  const worker = read("workers/thornie-dungeons-api.js");
  const components = read("src/ui/components.js");
  assert.match(worker, /empowerSlots: globalThis\.ENHANCEMENT_V2_RULES\?\.fillEmpowerSlots/);
  assert.match(components, /Array\.isArray\(desc\.empowerSlots\)/);
  assert.match(components, /desc\.empowerSlots\.map\(option => option \? \{ \.\.\.option \} : null\)/);
  assert.doesNotMatch(components.slice(components.indexOf("function materializeMailItem"), components.indexOf("function formatMailDate")), /empowerSlots: Array\(.*\)\.fill\(null\)/);
});

test("W5 visual resolver binds all approved Wing families without weakening V4 authority", () => {
  const resolver = read("src/phaser/presentation/EquipmentVisualResolver.js");
  assert.match(resolver, /identities\.includes\("azure"\)/);
  assert.match(resolver, /identities\.includes\("robot"\)/);
  assert.match(resolver, /identities\.includes\("skeleton"\)/);
  assert.match(read("workers/thornie-dungeons-api.js"), /character_operation_receipts/);
  assert.match(read("workers/thornie-dungeons-api.js"), /saveCharacterProgress/);
  assert.match(read("workers/thornie-dungeons-api.js"), /character_progress_requires_authoritative_operation/);
});
