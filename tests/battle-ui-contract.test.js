const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const components = read("src/ui/components.js");
const app = read("src/ui/App.js");
const styles = read("src/data/styles.js");
const manifest = read("src/assets/manifest.js");
const build = read("build.js");

test("Battle UI keeps four quick slots, independent speed/Skip controls and Silence rules", () => {
  assert.match(components, /\[0, 1, 2, 3\]\.map/);
  assert.match(components, /className: "md-combat-header-action speed"/);
  assert.match(components, /className: "md-combat-header-action skip md-battle-art"/);
  assert.match(components, /player\.battleStatuses\?\.silence/);
  assert.match(components, /onAction\("flee"\)/);
  assert.match(components, /setAutoRun\(a => !a\)/);
});

test("Battlefield uses stable presentation classes and mobile safe-area/control separation", () => {
  for (const size of ["small", "medium", "large", "elite"]) {
    assert.match(components, new RegExp(`${size}: \\{ height:`));
    assert.match(styles, new RegExp(`\\.md-monster-unit\\.size-${size}`));
  }
  assert.match(components, /anchorType === "flying"/);
  assert.match(styles, /\.md-monster-slot\.flying/);
  assert.match(styles, /safe-area-inset-bottom/);
  assert.match(styles, /\.md-scene\.battle-bg \.md-arena[^\n]*overflow: hidden/);
  assert.match(styles, /\.md-scene\.battle-bg > \.md-panel/);
});

test("Battle rendering preserves manifest resolvers and App has one gameplay resolver", () => {
  assert.match(manifest, /function battleEncounterSources/);
  assert.match(manifest, /getPetSpriteConfig/);
  assert.match(manifest, /getMonsterSpriteConfig/);
  assert.match(app, /BATTLE_CORE_V1\.battleStep/);
  assert.match(app, /BATTLE_CORE_V1\.simulateBattle/);
  assert.doesNotMatch(app, /function (processQueue|doPetAction|doMonsterAction|enemyTurn)/);
});

test("CombatScreen shows the engine round and current queued unit", () => {
  assert.match(components, /find\(item => item\.key === activeTurnKey\)/);
  assert.match(components, /activeTurn\.kind === "player" \? "You"/);
  assert.match(app, /battleRound: battleState\?\.round/);
  assert.match(components, /"Round ", Math\.max\(1, Number\(battleRound\) \|\| 1\), " · Turn: ", activeTurnName/);
  assert.doesNotMatch(components, /แตะศัตรูเพื่อเลือกเป้าหมาย/);
});

test("monster formation reserves the centre slot for solo units and Bosses", () => {
  assert.match(components, /function buildMonsterFormation\(monsters\)/);
  assert.match(components, /monster\.isBoss \|\| monster\.isEliteBoss/);
  assert.match(components, /\{ monster: boss, slotIndex: 1 \}/);
  assert.match(components, /count === 2 \? \[0, 2\] : \[0, 1, 2\]/);
  assert.match(styles, /\.md-monster-count-1 \.md-monster-slot-1/);
  assert.match(styles, /\.md-monster-count-3 \.md-monster-slot-1/);
});

test("Turn Order remains a clipped single-row four-slot window", () => {
  assert.match(components, /Array\.from\(\{ length: 4 \}/);
  assert.match(styles, /grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(styles, /overflow: hidden; flex-wrap: nowrap; white-space: nowrap/);
});

test("selected target marker and Battle background use manifest art without changing hitboxes", () => {
  assert.match(components, /battleUiStyle\("targetSelectedMarker"\)/);
  assert.match(components, /selected && !dead/);
  assert.doesNotMatch(components, /outline: selected/);
  assert.match(components, /battleUiStyle\("background"\)/);
  assert.match(styles, /\.md-target-selected-marker[^}]*pointer-events: none/s);
  assert.match(styles, /\.md-monster-unit\.anchor-flying > \.md-target-selected-marker/);
  assert.match(styles, /\.md-scene\.battle-bg\.md-battle-background-art/);
});

test("Battle critical preload includes every released GUI image directly", () => {
  for (const key of ["background", "turnOrderSlot", "targetSelectedMarker", "buttons.skip"]) {
    assert.match(manifest, new RegExp(`"${key.replace(".", "\\.")}"`));
  }
  assert.doesNotMatch(build, /battleGuiCompletionPatch/);
});
