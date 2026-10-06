const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const source = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("Dungeon end fixes: Elite sprite lookup resolves by defId/profile and strips (Elite)", () => {
  const manifest = source("src/assets/manifest.js");
  assert.match(manifest, /defIdKey = normalizeAssetLookupKey/);
  assert.match(manifest, /enemy\.defId \|\| enemy\.monsterDefId \|\| enemy\.dungeonV2ProfileId/);
  assert.match(manifest, /MONSTER_ASSET_ALIASES\[defIdKey\]/);
  assert.ok(manifest.includes('.replace(/\\s*\\((?:(?:elite\\s+)?boss|elite)\\)\\s*/g, "")'));
});

test("Dungeon end fixes: Phaser host stops its loop before async Game.destroy", () => {
  const host = source("src/phaser/runtime/BattlefieldHost.js");
  assert.match(host, /Phaser\.Game\.destroy\(\) is asynchronous/);
  assert.match(host, /gameToDestroy\?\.loop\?\.stop\?\.\(\)/);
  assert.match(host, /gameToDestroy\?\.destroy\(true\)/);
});

test("Dungeon end fixes: first Sprout grant auto-equips server-authoritatively", () => {
  const worker = source("workers/thornie-dungeons-api.js");
  assert.match(worker, /active_pet_id = CASE WHEN \(active_pet_id IS NULL OR active_pet_id = ''\) AND \? != '' THEN \? ELSE active_pet_id END/);
  assert.match(worker, /starterGrant\?\.instance\?\.instId \|\| ""/);
});

test("Dungeon end fixes: visible version matches the current production preview", () => {
  const styles = source("src/data/styles.js");
  assert.match(styles, /content: "Ver 1\.0\.51"/);
});
