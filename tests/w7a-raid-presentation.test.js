const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const actor = fs.readFileSync(path.join(root, "src/phaser/actors/MonsterActor.js"), "utf8");
const event = fs.readFileSync(path.join(root, "src/phaser/presentation/EventBridge.js"), "utf8");
const scene = fs.readFileSync(path.join(root, "src/phaser/scenes/BattleScene.js"), "utf8");
const host = fs.readFileSync(path.join(root, "src/phaser/runtime/BattlefieldHost.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "src/phaser/ui/PhaserBattlefield.js"), "utf8");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/data/styles.js"), "utf8");

test("W7A Raid shared Phaser infrastructure remains intact outside the Raid Boss card", () => {
  assert.match(actor, /class RaidBossActor extends MonsterActor/);
  assert.match(scene, /new RaidBossActor/);
  assert.match(scene, /createPresentationQueue/);
  assert.match(scene, /createVfxManager/);
  assert.match(scene, /createPhaserTextureRegistry/);
  assert.match(scene, /SHARED_PHASER_ASSET_RESOLVER/);
  assert.match(host, /PhaserBattlefield/);
  assert.match(ui, /function PhaserRaidBoss/);
});

test("RaidBossCard is frame-sprite presentation only and has one HP bar", () => {
  const start = components.indexOf("function RaidBossCard");
  const end = components.indexOf("function RaidAttackActions", start);
  assert.ok(start >= 0 && end > start, "RaidBossCard boundaries must exist");
  const card = components.slice(start, end);
  assert.match(card, /RaidBossCard/);
  assert.match(card, /React\.createElement\(RaidBossFrameSprite/);
  assert.doesNotMatch(card, /React\.createElement\(PhaserRaidBoss/);
  assert.doesNotMatch(card, /phaserStatus/);
  assert.equal((card.match(/md-bar-track/g) || []).length, 1);
  assert.equal((card.match(/md-bar-label/g) || []).length, 1);
});

test("Raid mechanics remain outside Phaser presentation", () => {
  assert.match(components, /cloudAttackRaidBoss/);
  assert.match(components, /cloudClaimRaidMilestones/);
  assert.doesNotMatch(host, /cloudAttackRaidBoss|stamina|contribution|milestone|diamonds/i);
});

test("Arena setup uses one document-level portal dropdown implementation", () => {
  const dropdownStart = components.indexOf("function ArenaSetupDropdown");
  const dropdownEnd = components.indexOf("function ArenaV2Screen", dropdownStart);
  const dropdown = components.slice(dropdownStart, dropdownEnd);
  assert.ok(dropdownStart >= 0 && dropdownEnd > dropdownStart, "ArenaSetupDropdown boundaries must exist");
  assert.match(dropdown, /ReactDOM\.createPortal/);
  assert.match(dropdown, /document\.body/);
  assert.match(components, /className: "md-arena-pet-picker"/);
  assert.match(components, /className: `md-arena-skill-setup-slot\${selectedSkillId/);
  assert.doesNotMatch(components, /md-arena-skill-setup-slot[^\n]*onToggle/);
});

test("Arena setup dropdown is viewport anchored and dock uses the Arena bottom anchor", () => {
  assert.match(styles, /\.md-arena-setup-options \{ position:fixed; z-index:10000;/);
  assert.match(styles, /\.md-arena-v2 > \.md-hub-dock \{ position:absolute; left:0; right:0; bottom:0;/);
  assert.match(components, /align: i % 2 === 0 \? "left" : "right"/);
  assert.doesNotMatch(components, /--arena-dd-top|--arena-dd-left/);
});

test("Raid hurt presentation still uses the approved server success token", () => {
  assert.match(scene, /if \(token <= this\.lastHurtToken\) return/);
  assert.match(scene, /this\.lastHurtToken = token/);
  assert.match(scene, /onHurtComplete\?\.\(token\)/);
  assert.match(components, /setHurtToken\(token => token \+ 1\)/);
  assert.match(components, /A successful server-side hit is the only trigger for hurt/);
});
