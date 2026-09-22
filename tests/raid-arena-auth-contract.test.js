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

test("Arena battle presentation is decomposed while orchestration stays in ArenaScreen", () => {
  const presentation = screenSource("ArenaBattleHud", "ArenaScreen");
  const controller = screenSource("ArenaScreen", "MailboxScreen");

  for (const componentName of [
    "ArenaBattleHud",
    "ArenaBattleStage",
    "ArenaActionPanel",
    "ArenaBattleLog",
    "ArenaResult",
    "ArenaBattle"
  ]) {
    assert.match(presentation, new RegExp(`function ${componentName}\\b`));
  }

  assert.doesNotMatch(presentation, /cloud(?:Get|Start|Submit)Arena/);
  assert.match(controller, /const stageTimeouts = React\.useRef\(\[\]\)/);
  assert.match(controller, /const playStageSequence = \(log\) =>/);
  assert.match(controller, /const startFight = \(opponentCharacterId, useDiamonds\) =>/);
  assert.match(controller, /const submitTurn = \(actionType, skillKey\) =>/);
  assert.match(controller, /playStageSequence\(res\.log\)/);
  assert.match(controller, /React\.createElement\(ArenaBattle,[\s\S]*onSubmitTurn: submitTurn[\s\S]*onExitResult: \(\) => setMatch\(null\)[\s\S]*onBack/);

  assert.match(presentation, /onSubmitTurn\("basic"\)/);
  assert.match(presentation, /onSubmitTurn\("active", s\.key\)/);
  assert.match(presentation, /pvpFormatLogEntry\(entry, unitNames\)/);
  assert.match(presentation, /label: "← Back \(การต่อสู้จะค้างไว้\)"/);
});
