const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const components = fs.readFileSync(path.join(__dirname, "..", "src/ui/components.js"), "utf8");

function screenSource(name, nextName) {
  const start = components.indexOf(`function ${name}(`);
  const end = components.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `missing ${name} source`);
  return components.slice(start, end);
}

test("Raid uses the central session-token API signatures", () => {
  const source = screenSource("RaidScreen", "ArenaHpBar");
  assert.doesNotMatch(source, /\bcred\b|password/);
  assert.match(source, /cloudGetRaidStatus\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(source, /cloudClaimRaidMilestones\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(source, /cloudAttackRaidBoss\(serverUrl \|\| DEFAULT_SERVER_URL, characterId, useDiamonds\)/);
});

test("Arena uses the central session-token API signatures", () => {
  const source = screenSource("ArenaScreen", "MailboxScreen");
  assert.doesNotMatch(source, /\bcred\b|password/);
  assert.match(source, /cloudGetArenaStatus\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(source, /cloudGetArenaOpponents\(serverUrl \|\| DEFAULT_SERVER_URL, characterId\)/);
  assert.match(source, /cloudStartArenaMatch\(serverUrl \|\| DEFAULT_SERVER_URL, characterId,/);
  assert.match(source, /cloudSubmitArenaTurn\(serverUrl \|\| DEFAULT_SERVER_URL, characterId,/);
});
