const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const components = fs.readFileSync(path.join(__dirname, "..", "src/ui/components.js"), "utf8");

function functionSource(name) {
  const start = components.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `missing ${name} source`);
  const next = components.indexOf("\nfunction ", start + 1);
  return components.slice(start, next > start ? next : components.length);
}

test("Raid uses the central session-token API signatures", () => {
  const source = functionSource("RaidScreen");
  assert.doesNotMatch(source, /\bcred\b|password/);
  assert.match(source, /cloudGetRaidStatus\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(source, /cloudClaimRaidMilestones\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(source, /cloudAttackRaidBoss\(serverUrl \|\| DEFAULT_SERVER_URL, characterId, pendingAttack\.paidDiamonds, pendingAttack\.requestId\)/);
  assert.match(source, /attackRequestIdRef/);
  const worker = fs.readFileSync(path.join(__dirname, "..", "workers/thornie-dungeons-api.js"), "utf8");
  assert.match(worker, /const operation = "raid_attack"/);
  assert.match(worker, /operation_in_progress/);
});

test("Arena V2 uses the central session-token API signatures", () => {
  const source = functionSource("ArenaV2Screen");
  assert.doesNotMatch(source, /\bcred\b|password/);
  assert.match(source, /cloudGetArenaV2Status\(url, characterId\)/);
  assert.match(source, /cloudGetArenaV2Opponents\(url, characterId\)/);
  assert.match(source, /cloudPrepareArenaV2Match\(url, characterId, opponentKey, source\)/);
  assert.match(source, /cloudActivateArenaV2Match\(url, characterId, matchId\)/);
  assert.match(source, /cloudGetArenaV2Match\(url, characterId/);
  assert.match(source, /cloudSetArenaV2Auto\(url, characterId, currentMatch\.matchId, enabled\)/);
  assert.match(source, /cloudSubmitArenaV2Action\(/);
  assert.doesNotMatch(source, /cloud(?:GetArenaStatus|GetArenaOpponents|StartArenaMatch|SubmitArenaTurn)\b/);
});

test("Arena V2 battle presentation remains Phaser-based while orchestration stays in ArenaV2Screen", () => {
  const source = functionSource("ArenaV2Screen");
  assert.match(source, /const submitArenaAction = React\.useCallback/);
  assert.match(source, /React\.createElement\(PhaserBattlefield/);
  assert.match(source, /mode: "arena"/);
  assert.match(source, /onTargetSelected: setSelectedTarget/);
  assert.match(source, /cloudSubmitArenaV2Action\(/);
  assert.match(source, /onClick: \(\) => action\("basic", null, selected\)/);
  assert.match(source, /onClick: \(\) => action\("surrender", null, selected\)/);
  assert.match(source, /SURRENDER \(10s\)/);
});
