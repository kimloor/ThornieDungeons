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

test("Battle UI keeps four quick slots and replaces speed with Skip after five turns", () => {
  assert.match(components, /\[0, 1, 2, 3\]\.map/);
  assert.match(components, /const skipUnlocked = \(combatTurnCount \|\| 0\) >= 5/);
  assert.match(components, /let headerBattleAction/);
  assert.match(components, /if \(skipUnlocked\) \{/);
  assert.match(components, /className: `md-combat-header-action skip \$\{showSkipArt \? "has-art" : ""\}`/);
  assert.match(components, /className: "md-combat-skip-art"/);
  assert.match(components, /onClick: \(\) => onAction\("skip"\)/);
  assert.match(components, /\} else \{[\s\S]{0,500}className: `md-combat-header-action speed/);
  assert.match(components, /className: "md-combat-speed-art"/);
  assert.match(components, /className: "md-combat-top-actions"[\s\S]{0,100}headerBattleAction/);
  assert.match(components, /player\.battleStatuses\?\.silence/);
  assert.match(components, /onAction\("flee"\)/);
  assert.match(components, /setAutoRun\(a => !a\)/);
});

test("game-wide runtime errors use one central diagnostic boundary", () => {
  assert.match(components, /class GlobalGameErrorBoundary extends React\.Component/);
  assert.match(components, /componentDidCatch\(error, info\)/);
  assert.match(components, /__thornieReportRuntimeError/);
  assert.match(components, /title: "Game Runtime Error"/);
  assert.match(components, /document\.body/);
  const tail = read("tail.html");
  assert.match(tail, /React\.createElement\(GlobalGameErrorBoundary/);
  assert.match(tail, /root\.render\(React\.createElement\(GlobalGameErrorBoundary/);
  assert.doesNotMatch(build, /showBootError\(/);
});

test("monster status presentation reads authoritative Battle Core unit state", () => {
  assert.match(components, /const statusSource = battleUnit\?\.statuses \|\| enemy\.battleStatuses \|\| \{\}/);
  assert.match(components, /battleUnit: battleState\?\.units\?\.\[m\.uid\]/);
  assert.match(components, /statusSource\.def_up/);
  assert.match(components, /className: "def-up"/);
  assert.match(styles, /\.md-unit-status \.def-up/);
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
  assert.match(app, /DUNGEON_V2\.simulateDungeonV2Battle\(state, BATTLE_CORE_V1\)/);
  assert.doesNotMatch(app, /Legacy source-contract marker/);
  assert.doesNotMatch(app, /function (processQueue|doPetAction|doMonsterAction|enemyTurn)/);
});

test("CombatScreen shows the engine round and current queued unit", () => {
  assert.match(components, /find\(item => item\.key === activeTurnKey\)/);
  assert.match(components, /activeTurn\.kind === "player" \? heroName/);
  assert.match(components, /label: heroName/);
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
  const coords = [0, 1, 2].map(slot => {
    const match = styles.match(new RegExp(`\\.md-monster-count-3 \\.md-monster-slot-${slot} \\{ left: (\\d+)%; top: (\\d+)%`));
    assert.ok(match, `missing three-monster slot ${slot}`);
    return { left: Number(match[1]), top: Number(match[2]) };
  });
  assert.equal(coords[0].left - coords[1].left, coords[1].left - coords[2].left);
  assert.equal(coords[0].top - coords[1].top, coords[1].top - coords[2].top);
  assert.ok(coords[0].top - coords[1].top >= 18, "three-monster lanes keep a readable vertical gap");
});

test("inactive Hero and Pet status rows stay hidden while active resources remain visible", () => {
  assert.match(components, /const hasHeroStatus = Boolean\(/);
  assert.match(components, /Number\(battleResources\[key\]\) > 0/);
  assert.match(components, /activeBattleResources\.map/);
  assert.doesNotMatch(components, /\|\| player\.battleResources\)/);
  assert.match(components, /const hasVisibleStatus = Boolean\(/);
  assert.match(components, /hasVisibleStatus &&[\s\S]{0,100}className: "md-unit-status pet"/);
  assert.doesNotMatch(components, /: "READY"/);
});

test("Pet combat sprites use a larger manifest-size presentation envelope", () => {
  assert.match(components, /const PET_COMBAT_VISUAL_SIZES = \{/);
  assert.match(components, /small: \{ height: 78, maxWidth: 114 \}/);
  assert.match(components, /medium: \{ height: 94, maxWidth: 136 \}/);
  assert.match(components, /return \{ sizeClass, anchorType, \.\.\.PET_COMBAT_VISUAL_SIZES\[sizeClass\] \}/);
});

test("Skip artwork replaces the speed control in the same envelope without changing resolver wiring", () => {
  assert.match(styles, /\.md-combat-speed-art \{[^}]*max-height:56px/);
  assert.match(styles, /\.md-combat-skip-art \{[^}]*max-height:56px/);
  assert.match(components, /onClick: \(\) => onAction\("skip"\)/);
  assert.match(components, /if \(skipUnlocked\) \{/);
  assert.doesNotMatch(styles, /\.md-combat-header-action\.speed \+ \.md-combat-header-action\.skip/);
});

test("Turn Order remains a clipped single-row four-slot window", () => {
  assert.match(components, /Array\.from\(\{ length: 4 \}/);
  assert.match(components, /const snapshotKey = `\$\{Number\(round\) \|\| 0\}/);
  assert.match(components, /seenKeys\.has\(item\.key\)/);
  assert.match(styles, /grid-template-rows: minmax\(0, 1fr\)/);
  assert.match(styles, /overflow: hidden; white-space: nowrap; contain: layout paint/);
  assert.equal((styles.match(/\.md-turn-queue\s*\{/g) || []).length, 1);
});

test("Battle dock enlarges controls while retaining the compact 380px layout", () => {
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\) 90px 100px/);
  assert.match(styles, /grid-template-rows: 42px 42px/);
  assert.match(styles, /\.md-battle-dock \.md-dock-attack \{ width: 100px; height: 100px/);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*grid-template-columns: minmax\(0, 1fr\) 88px 96px/);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*\.md-battle-dock \.md-dock-attack \{ width: 96px; height: 96px/);
});

test("combat viewport, log and BEGIN presentation stay bounded", () => {
  assert.match(app, /phase !== "combat"/);
  assert.match(app, /bodyStyle\.overscrollBehavior = "none"/);
  assert.match(styles, /\.md-root-combat \{ height:100svh; min-height:100svh; max-height:100svh; overflow:hidden/);
  assert.match(styles, /\.md-scene\.battle-bg \.md-log \{ height:50px; min-height:50px; max-height:50px; overflow-y:auto/);
  assert.match(components, /showBattleIntro &&/);
  assert.match(components, /"BEGIN!"/);
});

test("current-battle log expands without persisting readable history to D1", () => {
  assert.match(components, /function BattleLogPanel/);
  assert.match(components, /lines\.slice\(0, 3\)/);
  assert.match(components, /className: "md-battle-log-scroll"/);
  assert.match(components, /onClick: \(\) => setExpanded\(false\)/);
  assert.match(app, /setLogState\(\[\]\)/);
  assert.match(app, /battleLog: finishedBattleLog/);
  assert.match(app, /function battleCheckpointWithoutLog/);
  assert.match(app, /return checkpoint \? \{ \.\.\.checkpoint, log: \[\] \}/);
  assert.match(styles, /\.md-battle-log-scroll[^}]*overflow-y: auto/s);
});

test("normal background persistence is silent while failures remain visible", () => {
  assert.doesNotMatch(app, /persistenceStatus !== "saved" &&/);
  assert.doesNotMatch(app, /persistenceStatus === "failed" &&/);
  assert.match(app, /persistenceDiagnostic &&/);
  assert.match(app, /React\.createElement\(PersistenceDiagnosticOverlay/);
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

test("Flee and Settings retain manifest artwork after legacy button CSS", () => {
  assert.match(components, /battleUiStyle\("buttons\.flee"\)/);
  assert.match(components, /battleUiStyle\("buttons\.settings"\)/);
  assert.match(styles, /\.md-dock-mini\.md-battle-art,[\s\S]*background-image: var\(--battle-ui-image\)/);
});

test("battle completion confirms the last safe checkpoint before the receipt", () => {
  const start = app.indexOf("async function finishCoreBattle(next, options = {})");
  const end = app.indexOf("function driveCoreBattle", start);
  const completion = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(completion, /const completionPromise = commitBattleCompletionWithRetry\(next\)/);
  assert.ok(completion.indexOf("const completionPromise = commitBattleCompletionWithRetry(next)") < completion.indexOf("playTerminalBattlePresentation(next.result)"));
  assert.match(completion, /setBattleFinishing\(true\)/);
  assert.match(completion, /setBusy\(true\)/);
  assert.match(components, /className: "md-battle-finishing"/);
});

test("battle presentation resets Hero to idle at completion and before stage entry", () => {
  const finishStart = app.indexOf("async function finishCoreBattle(next, options = {})");
  const finishEnd = app.indexOf("function driveCoreBattle", finishStart);
  const enterStart = app.indexOf("function enterStage(");
  const enterEnd = app.indexOf("function buildPetCombatUnit", enterStart);
  assert.match(app.slice(finishStart, finishEnd), /setHeroAnim\(""\)/);
  assert.match(app.slice(enterStart, enterEnd), /setHeroAnim\(""\)/);
});

test("Dungeon battle entry obtains server authorization before creating or checkpointing combat", () => {
  const enterStart = app.indexOf("function enterStage(");
  const enterEnd = app.indexOf("function buildPetCombatUnit", enterStart);
  const entry = app.slice(enterStart, enterEnd);
  assert.ok(entry.indexOf("cloudStartDungeonBattle(") < entry.indexOf("BATTLE_CORE_V1.createDungeonBattle("));
  assert.ok(entry.indexOf("cloudStartDungeonBattle(") < entry.indexOf("pushBattleCheckpoint(initialBattle)"));
  assert.match(entry, /battleId: battleAuthorization\.battleId/);
  assert.match(entry, /seed: battleAuthorization\.context\.encounterSeed/);
});

test("Quick-slot skill changes update the live Battle Core Hero immediately", () => {
  assert.match(app, /Quick-slot edits made during Battle must update the live Battle Core Hero/);
  assert.match(app, /activeSkills = next[\s\S]{0,300}slot\?\.kind === "skill"/);
  assert.match(app, /applyCoreBattleState\(liveBattle, false\)/);
  assert.match(app, /pushBattleCheckpoint\(liveBattle\)/);
});

test("Hero Skill V1 rows open full detail sheets and upgrades use a confirmation-style draft", () => {
  assert.match(components, /md-floor-detail-sheet md-skill-detail-sheet/);
  assert.match(components, /full rank progression|Rank \/ Level/);
  assert.match(components, /Prerequisite:/);
  assert.match(components, /＋ ทดลองอัป/);
  assert.match(components, /ยืนยันการอัปสกิล/);
  assert.match(components, /const \[draft, setDraft\] = useState\(\{\}\)/);
  assert.match(components, /onLearnSkill\(draft\)/);
});

test("battle completion classifies session and non-retryable errors without leaving the terminal lock path", () => {
  assert.match(app, /const BATTLE_SESSION_ERRORS = new Set\(\["invalid_session", "session_expired", "session_revoked", "session_replaced"\]\)/);
  assert.match(app, /const BATTLE_NON_RETRYABLE_ERRORS = new Set\(\["invalid_reward_plan", "battle_not_authorized"\]\)/);
  const start = app.indexOf("async function commitBattleCompletionWithRetry(next)");
  const end = app.indexOf("async function finalizeTerminalOutcome", start);
  const completion = app.slice(start, end);
  assert.match(completion, /^\s*async function commitBattleCompletionWithRetry\(next\) \{\n\s*try \{/);
  assert.match(completion, /return \{ ok: false, completionReceipt: lastReceipt, errorCode: classification\.code, errorKind: classification\.kind \}/);
  assert.match(completion, /catch \(error\)/);
  assert.match(app, /AUTH_SESSION\.handleApiResult\(\{ error: completionError\.code \}\)/);
  assert.match(app, /ยืนยันผลการต่อสู้ไม่ได้ เนื่องจากข้อมูลการต่อสู้ไม่ตรงกับ Server/);
});
 
test("Battle Potion starts the local Hero Action immediately while server consumption stays authoritative", () => {
  assert.match(app, /const pendingPotionRef = useRef\(null\)/);
  assert.match(app, /const promise = cloudConsumePotion\(/);
  assert.match(app, /Resolve the full Potion Action immediately/);
  assert.match(app, /driveCoreBattle\(state, \{ type: "potion"/);
  assert.match(app, /Server rejected the inventory mutation/);
  assert.match(app, /applyCoreBattleState\(pendingPotion\.preState, false\)/);
});
