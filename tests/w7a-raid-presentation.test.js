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

test("Raid Phaser stage keeps the existing sprite fallback until ready or on error", () => {
  assert.match(ui, /function PhaserRaidBoss/);
  assert.match(components, /phaserStatus !== "ready"/);
  assert.match(components, /RaidBossFrameSprite/);
  assert.match(components, /onStatus: status => setPhaserStatus\(status\)/);
});
