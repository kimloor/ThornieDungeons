const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const arenaUi = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
const worker = fs.readFileSync(path.join(ROOT, "workers/thornie-dungeons-api.js"), "utf8");

function arenaSection(source) {
  const start = source.indexOf("function ArenaV2Screen");
  const end = source.indexOf("\n}\n\n// Turns a mail", start);
  return source.slice(start, end);
}

test("W9 6A.2 Auto submits one deterministic Hero decision and continues safely", () => {
  const section = arenaSection(arenaUi);
  assert.match(section, /const submitArenaAction = React\.useCallback/);
  assert.match(section, /arena-auto-\$\{currentMatch\.matchId\}-\$\{currentSeq \+ 1\}/);
  assert.match(section, /autoActionInFlightRef\.current/);
  assert.match(arenaUi, /arenaPublicUnitById\(currentMatch\?\.state, currentMatch\?\.state\?\.currentActorId\)/);
  assert.match(section, /setAuto\(next\.result \? false/);
  assert.match(worker, /function arenaCombatAdvance\(state\)/);
  assert.doesNotMatch(worker, /arenaCombatAdvance\(state, !!state\.flags\.auto\)/);
  assert.doesNotMatch(worker, /arenaCombatAdvance\(combatState, false\)/);
});

test("W9 6A.3 public Arena units Array resolves the current attacker Hero", () => {
  const start = arenaUi.indexOf("function arenaPublicUnitById");
  const end = arenaUi.indexOf("\n\nfunction arenaPlayerCardEquipmentLabels", start);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${arenaUi.slice(start, end)}\nglobalThis.lookup = arenaPublicUnitById;`, sandbox);
  const actor = sandbox.lookup({ currentActorId: "team_a_hero", units: [
    { id: "team_a_pet", side: "team_a", kind: "pet" },
    { id: "team_a_hero", side: "team_a", kind: "hero" }
  ] }, "team_a_hero");
  assert.equal(actor.id, "team_a_hero");
  assert.equal(actor.kind, "hero");
  assert.match(arenaSection(arenaUi), /submitArenaAction\(\{ autoMode: true \}\)/);
});

test("W9 6A.2 Auto OFF and reload retain authoritative boundary semantics", () => {
  const section = arenaSection(arenaUi);
  assert.match(section, /requestInFlightRef\.current = true/);
  assert.match(section, /const enabled = !auto/);
  assert.match(section, /setAuto\(!!next\.state\?\.auto \|\| !!next\.state\?\.flags\?\.auto\)/);
  assert.match(section, /adoptArenaMatch\((?:latest|resumed)\.match\)/);
  assert.match(section, /setAuto\(!!nextMatch\.state\?\.auto \|\| !!nextMatch\.state\?\.flags\?\.auto\)/);
});

test("W9 6A.2 Revenge opens Player Card before the Ticket boundary", () => {
  const section = arenaSection(arenaUi);
  assert.match(section, /const openPlayerCard = async \(opponentKey, source = "matchmaking"\)/);
  assert.match(section, /openPlayerCard\(`history:\$\{row\.matchId\}`, "revenge"\)/);
  assert.match(section, /start\(playerCard\.opponentKey \|\| playerCard\.characterId, playerCardSource\)/);
  assert.match(section, /cloudPrepareArenaV2Match\(url, characterId, opponentKey, source\)/);
});

test("W9 6A.2 Arena x1/x2 is presentation-only and Arena has no Skip control", () => {
  const section = arenaSection(arenaUi);
  assert.match(section, /const \[combatSpeed, setCombatSpeed\] = React\.useState\(1\)/);
  assert.match(section, /className: "md-btn small md-arena-speed-toggle"/);
  assert.match(section, /setCombatSpeed\(value => value === 1 \? 2 : 1\)/);
  assert.match(section, /mode: "arena", battleState, preparedSnapshot: match\.snapshot, combatSpeed/);
  assert.doesNotMatch(section, /Skip/);
});
