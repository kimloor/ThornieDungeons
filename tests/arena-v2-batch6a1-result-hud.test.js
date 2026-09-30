const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const arenaUi = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");

function loadResultHelpers() {
  const start = arenaUi.indexOf("function arenaResultViewModel");
  const end = arenaUi.indexOf("\nfunction arenaPlayerCardEquipmentLabels", start);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${arenaUi.slice(start, end)}\nglobalThis.helpers = { arenaResultViewModel, arenaMatchWithResultViewModel, arenaTerminalMatchFromResponse };`, sandbox);
  return sandbox.helpers;
}

test("W9 6A.1 normalizes W9 V2 settlement objects into scalar Result fields", () => {
  const { arenaResultViewModel } = loadResultHelpers();
  const view = arenaResultViewModel({
    result: "win",
    combatResult: "victory",
    attacker: { ratingChange: 12 },
    arenaCoin: { earned: 30, rewardSlot: "equal", result: "win" }
  });
  assert.deepEqual({ ...view }, {
    outcome: "win",
    combatResult: "victory",
    ratingChange: 12,
    arenaCoinEarned: 30,
    rewardSlot: "equal",
    resolution: "win",
    terminalReason: "victory"
  });
  for (const value of Object.values(view)) assert.notEqual(typeof value, "object");
});

test("W9 6A.1 keeps legacy scalar results and terminal meanings", () => {
  const { arenaResultViewModel, arenaTerminalMatchFromResponse } = loadResultHelpers();
  const legacy = arenaResultViewModel({
    result: "loss",
    ratingChange: -8,
    arenaCoinEarned: 5,
    rewardSlot: "base",
    resolution: "timeout"
  });
  assert.equal(legacy.outcome, "loss");
  assert.equal(legacy.ratingChange, -8);
  assert.equal(legacy.arenaCoinEarned, 5);
  assert.equal(legacy.resolution, "timeout");

  const draw = arenaResultViewModel({ result: "draw", combatResult: "draw", arenaCoin: 10 });
  assert.equal(draw.outcome, "draw");
  assert.equal(draw.arenaCoinEarned, 10);

  const surrender = arenaTerminalMatchFromResponse(
    { matchId: "m1", status: "active", state: { actionSeq: 4 } },
    { result: { result: "loss", combatResult: "surrender", arenaCoin: { earned: 0, result: "loss" } } }
  );
  assert.equal(surrender.resultViewModel.outcome, "loss");
  assert.equal(surrender.resultViewModel.combatResult, "surrender");
  assert.equal(surrender.resultViewModel.arenaCoinEarned, 0);
});

test("W9 6A.1 terminal response and Ticket HUD paths stay client-only and exact-once", () => {
  const resultSection = arenaUi.slice(arenaUi.indexOf("match.result ?"), arenaUi.indexOf("!match && /*#__PURE__*/React.createElement(GameDock", arenaUi.indexOf("match.result ?")));
  assert.match(arenaUi, /function arenaTerminalMatchFromResponse\(/);
  assert.match(arenaUi, /const next = arenaTerminalMatchFromResponse\(currentMatch, res\)/);
  assert.doesNotMatch(resultSection, /match\.result\.arenaCoin(?!Earned)/);
  assert.match(arenaUi, /await syncArenaStatus\(\);/);
  assert.match(arenaUi, /refresh\(\)\.catch\(\(\) => setError\("โหลด Arena status ไม่สำเร็จ"\)\)/);
  assert.equal((arenaUi.match(/cloudSubmitArenaV2Action\(/g) || []).length, 1);
});
