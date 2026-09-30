const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(ROOT, file), "utf8");
const arenaUi = read("src/ui/components.js");

function loadLifecycleHelpers() {
  const start = arenaUi.indexOf("function arenaMatchLifecycleStatus");
  const end = arenaUi.indexOf("\nfunction arenaPlayerCardEquipmentLabels", start);
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${arenaUi.slice(start, end)}\nglobalThis.helpers = { arenaMatchLifecycleStatus, arenaMatchIsActive, arenaMatchIsPrepared, arenaHumanError };`, sandbox);
  return sandbox.helpers;
}

test("Batch 6A Arena lifecycle gates controls and activation at authoritative status", () => {
  const { arenaMatchLifecycleStatus, arenaMatchIsActive, arenaMatchIsPrepared } = loadLifecycleHelpers();
  const prepared = { status: "prepared", matchId: "m1", snapshot: { attacker: {}, defender: {} } };
  const active = { status: "active", state: { phase: "hero", units: { hero: { hp: 1 } } } };
  const done = { status: "done", state: { phase: "done" }, result: { result: "victory" } };
  assert.equal(arenaMatchLifecycleStatus(prepared), "prepared");
  assert.equal(arenaMatchIsPrepared(prepared), true);
  assert.equal(arenaMatchIsActive(prepared), false);
  assert.equal(arenaMatchIsActive(active), true);
  assert.equal(arenaMatchIsActive(done), false);
});

test("Batch 6A preserves API error code/reason without entering fatal recovery", () => {
  const { arenaHumanError } = loadLifecycleHelpers();
  const message = arenaHumanError("arena_action_illegal", "not_your_turn", "action failed");
  assert.match(message, /คำสั่ง Arena นี้ใช้ไม่ได้/);
  assert.match(message, /not your turn/);
  assert.match(message, /arena_action_illegal/);
  assert.match(arenaUi, /if \(\["arena_match_not_active", "arena_action_illegal"\]\.includes\(res\.error\)\) await syncArenaMatch\(\)/);
  assert.doesNotMatch(arenaUi, /reportArenaFatal\(detail \|\| new Error\("Arena Phaser presentation failed"\), \{\}, "phaser_error"\);\s*\}\s*else setError/);
});

test("Batch 6A retries the same prepared match and captures window diagnostics", () => {
  assert.match(arenaUi, /cloudActivateArenaV2Match\(url, characterId, matchId\)/);
  assert.match(arenaUi, /retrying presentation with this same ID cannot consume a second ticket/);
  assert.match(arenaUi, /window\.addEventListener\("error", windowError\)/);
  assert.match(arenaUi, /window\.addEventListener\("unhandledrejection", windowRejection\)/);
  assert.match(arenaUi, /globalThis\.hideBootError\?\.\(\)/);
  assert.match(arenaUi, /matchIsPrepared \? .*RETRY PRESENTATION/s);
});

