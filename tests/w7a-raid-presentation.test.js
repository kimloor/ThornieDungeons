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

test("Raid Boss card uses the approved frame sprite only, without Phaser stage or standalone HP bar", () => {
  const start = components.indexOf("function RaidBossCard");
  const end = components.indexOf("function RaidAttackActions", start);
  assert.ok(start >= 0 && end > start);
  const card = components.slice(start, end);
  assert.doesNotMatch(card, /PhaserRaidBoss/);
  assert.doesNotMatch(card, /md-bar-track/);
  assert.match(card, /RaidBossFrameSprite/);
});

test("W7A Raid presentation reuses shared actor, queue, VFX and resolver infrastructure", () => {
  assert.match(actor, /class RaidBossActor extends MonsterActor/);
  assert.match(scene, /new RaidBossActor/);
  assert.match(scene, /createPresentationQueue/);
  assert.match(scene, /createVfxManager/);
  assert.match(scene, /createPhaserTextureRegistry/);
  assert.match(scene, /SHARED_PHASER_ASSET_RESOLVER/);
  assert.match(scene, /assetKey\(reference\)/);
  assert.match(scene, /return this\.textureRegistry\.keyFor\(reference\)/);
});

test("W7A Raid presentation supports only approved idle and hurt animation contract", () => {
  assert.match(event, /hurt:\s*urls\("hurt"\)/);
  assert.match(actor, /this\.data\?\.frames\?\.hurt/);
  assert.doesNotMatch(event, /raid.*attack/i);
  assert.doesNotMatch(event, /raid.*death/i);
});

test("Raid hurt presentation is triggered only by the React/server success token", () => {
  assert.match(scene, /if \(token <= this\.lastHurtToken\) return/);
  assert.match(scene, /this\.lastHurtToken = token/);
  assert.match(scene, /onHurtComplete\?\.\(token\)/);
  assert.match(components, /setHurtToken\(token => token \+ 1\)/);
  assert.match(components, /A successful server-side hit is the only trigger for hurt/);
});

test("Raid mechanics and settlement remain outside Phaser", () => {
  assert.doesNotMatch(scene, /cloudAttackRaidBoss|stamina|contribution|milestone|diamonds/i);
  assert.doesNotMatch(host, /cloudAttackRaidBoss|stamina|contribution|milestone|diamonds/i);
  assert.match(components, /cloudAttackRaidBoss/);
  assert.match(components, /cloudClaimRaidMilestones/);
});

test("Raid Boss card stays frame-only while shared Phaser infrastructure remains available", () => {
  const start = components.indexOf("function RaidBossCard");
  const end = components.indexOf("function RaidAttackActions", start);
  const card = components.slice(start, end);
  assert.match(ui, /function PhaserRaidBoss/);
  assert.doesNotMatch(card, /PhaserRaidBoss/);
  assert.match(card, /RaidBossFrameSprite/);
  assert.doesNotMatch(card, /phaserStatus|onStatus/);
});

test("Arena skill dropdowns use a document portal and block duplicate skills", () => {
  assert.match(components, /function ArenaSkillDropdown/);
  assert.match(components, /ReactDOM\.createPortal/);
  assert.match(components, /document\.body/);
  assert.match(components, /usedByOtherSlots/);
  assert.match(components, /"aria-disabled": duplicate/);
  assert.match(styles, /\.md-arena-setup-options-portal \{ position:fixed !important; z-index:2147483647 !important;/);
});

test("Arena dock follows the same flow-footer pattern as Inventory", () => {
  assert.match(styles, /\.md-arena-v2 \{ display:flex; flex-direction:column;/);
  assert.match(styles, /\.md-arena-scroll \{ flex:1 1 auto;/);
  assert.match(styles, /\.md-arena-v2 > \.md-hub-dock \{ position:static; flex:0 0 auto;/);
  assert.match(styles, /margin:0 max\(var\(--md-page-pad\),var\(--safe-right\)\) max\(var\(--md-page-pad\),var\(--safe-bottom\)/);
  assert.match(styles, /\.md-inv2-overlay > \.md-hub-dock \{ flex:0 0 auto;/);
  assert.match(styles, /content: "Ver 1\.0\.49";/);
});

test("Arena server setup rejects duplicate skill slots and Dungeon reward persists level progression", () => {
  const worker = fs.readFileSync(path.join(root, "workers/thornie-dungeons-api.js"), "utf8");
  assert.match(worker, /const seenSkills = new Set\(\);/);
  assert.match(worker, /if \(typeof key !== "string" \|\| !learned\.has\(key\) \|\| seenSkills\.has\(key\)\) return null;/);
  assert.match(worker, /function dungeonV2CharacterXpToNext\(level\)/);
  assert.match(worker, /while \(nextLevel < DUNGEON_CHARACTER_MAX_LEVEL && nextXp >= dungeonV2CharacterXpToNext\(nextLevel\)/);
  assert.match(worker, /level = \?, xp = \?, stat_points = \?/);
});
