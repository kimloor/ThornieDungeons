const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

test("Battle rendering preserves manifest resolvers and delegates gameplay resolution to the Worker", () => {
  assert.match(manifest, /function battleEncounterSources/);
  assert.match(manifest, /getPetSpriteConfig/);
  assert.match(manifest, /getMonsterSpriteConfig/);
  assert.match(app, /cloudSubmitDungeonBattleAction/);
  assert.doesNotMatch(app, /const result = BATTLE_CORE_V1\.battleStep/);
  assert.doesNotMatch(app, /DUNGEON_V2\.simulateDungeonV2Battle\(state, BATTLE_CORE_V1\)/);
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
  const finishBody = app.slice(finishStart, finishEnd);
  const finalizeStart = app.indexOf("async function finalizeTerminalOutcome");
  const finalizeEnd = app.indexOf("async function finishCoreBattle", finalizeStart);
  assert.equal(finishBody.includes('setHeroAnim("");'), false);
  assert.match(app.slice(finalizeStart, finalizeEnd), /resetTerminalPresentation\(\)/);
  assert.equal(app.slice(enterStart, enterEnd).includes('setHeroAnim("");'), true);
});

test("Dungeon battle entry uses server-created state before checkpointing combat", () => {
  const enterStart = app.indexOf("function enterStage(");
  const enterEnd = app.indexOf("function buildPetCombatUnit", enterStart);
  const entry = app.slice(enterStart, enterEnd);
  assert.ok(entry.indexOf("cloudStartDungeonBattle(") < entry.indexOf("pushBattleCheckpoint(initialBattle)"));
  assert.match(entry, /initialBattle = battleAuthorization\.state/);
  assert.match(entry, /dungeon_authority_state_missing/);
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
 
test("battle completion error matrix keeps retry, session, non-retryable, and terminal unlock contracts", () => {
  const start = app.indexOf("async function commitBattleCompletionWithRetry(next)");
  const end = app.indexOf("async function finalizeTerminalOutcome", start);
  const completion = app.slice(start, end);
  assert.match(completion, /const rewardPlan = next\.result === "victory" \? buildDungeonRewardPlan\(next\.battleId\) : null/);
  assert.match(completion, /for \(let attempt = 0; attempt < 3; attempt \+= 1\)/);
  assert.match(completion, /if \(!classification\.retryable\)[\s\S]*return \{ ok: false/);
  assert.match(completion, /catch \(error\)/);
  for (const code of ["invalid_session", "session_expired", "session_revoked", "session_replaced"]) {
    assert.match(app, new RegExp(`"${code}"`));
  }
  for (const code of ["invalid_reward_plan", "battle_not_authorized"]) {
    assert.match(app, new RegExp(`"${code}"`));
  }
  assert.match(app, /AUTH_SESSION\.handleApiResult\(\{ error: completionError\.code \}\)/);
  assert.match(app, /ยืนยันผลการต่อสู้ไม่ได้ เนื่องจากข้อมูลการต่อสู้ไม่ตรงกับ Server/);
  assert.match(app, /ยืนยันผลไม่สำเร็จ ผลการต่อสู้ยังไม่หาย/);
  const finishStart = app.indexOf("async function finishCoreBattle(next, options = {})");
  const finishEnd = app.indexOf("function driveCoreBattle", finishStart);
  const finish = app.slice(finishStart, finishEnd);
  assert.match(finish, /completionOutcome = await completionPromise/);
  assert.match(finish, /if \(!completionOutcome\.ok\)[\s\S]*setBusy\(false\)[\s\S]*setBattleFinishing\(true\)/);
});

test("Battle Potion submits one atomic authoritative action without a separate pre-consume request", () => {
  const start = app.indexOf("async function consumeBattlePotion");
  const end = app.indexOf("function playerTurn", start);
  const body = app.slice(start, end);
  assert.doesNotMatch(body, /cloudConsumePotion/);
  assert.match(body, /await driveCoreBattle\(state, \{ type: "potion", potionId, requestId \}\)/);
  const driveStart = app.indexOf("function driveCoreBattle");
  const driveEnd = app.indexOf("async function consumeBattlePotion", driveStart);
  const drive = app.slice(driveStart, driveEnd);
  assert.match(drive, /heroCommand\?\.type === "potion"/);
  assert.match(drive, /hydrateAuthoritativeBlacksmithSnapshot\(receipt, save\.characterId\)/);
  assert.match(drive, /potionRequestIdsRef\.current\.delete/);
});

test("Potion and Attack use the shared switchable Battle error catcher with safe diagnostics", () => {
  const catcherSource = read("src/systems/battleErrorCatcher.js");
  assert.match(read("build.js"), /systems\/battleErrorCatcher\.js/);
  assert.match(app, /BATTLE_ERROR_CATCHER\?\.capture/);
  assert.match(app, /\["potion", "basic"\]\.includes\(command\?\.type\)/);
  const warnings = [];
  const sandbox = { console: { warn: (...args) => warnings.push(args) } };
  vm.createContext(sandbox);
  vm.runInContext(catcherSource, sandbox);
  const captured = sandbox.BATTLE_ERROR_CATCHER.capture({
    response: { error: "battle_revision_conflict", status: 409, message: "do-not-log-this" },
    action: "basic", battleId: "battle-123", authorityRev: 4, safeActionSeq: 3, requestId: "request-123"
  });
  assert.equal(captured.reason, "battle_revision_conflict");
  assert.equal(captured.status, 409);
  assert.doesNotMatch(JSON.stringify(warnings), /do-not-log-this/);
  sandbox.BATTLE_ERROR_CATCHER.setEnabled(false);
  assert.equal(sandbox.BATTLE_ERROR_CATCHER.capture({ response: { error: "potion_not_owned" } }), null);
  sandbox.BATTLE_ERROR_CATCHER.setEnabled(true);
  assert.equal(sandbox.BATTLE_ERROR_CATCHER.isEnabled(), true);
});

test("Dungeon Hub presents one shared Resume/Discard checkpoint recovery flow", () => {
  assert.match(app, /phase === "map" && checkpointPromptOpen && resumeBattle\?\.battleId/);
  assert.match(app, /async function resumePendingBattle/);
  assert.match(app, /cloudGetBattleState\(cred\.url, save\.characterId\)/);
  assert.match(app, /checkpointOverride: payload/);
  assert.match(app, /async function discardPendingBattle/);
  assert.match(app, /cloudClearBattleCheckpoint\(cred\.url, save\.characterId, resumeBattle\.battleId\)/);
  assert.match(app, /md-checkpoint-recovery-resume/);
  assert.match(app, /md-checkpoint-recovery-discard/);
  assert.match(app, /checkpointCandidate = options\.checkpointOverride \|\| resumeBattle/);
});

test("Checkpoint recovery effect declares its state before evaluating hook dependencies", () => {
  const stateDeclaration = app.indexOf('const [resumeBattle, setResumeBattle] = useState(null)');
  const recoveryEffect = app.indexOf('if (phase === "map" && resumeBattle?.battleId)');
  assert.ok(stateDeclaration >= 0, "resumeBattle state declaration exists");
  assert.ok(recoveryEffect > stateDeclaration, "resumeBattle must be initialized before the effect dependency array is evaluated");
});


// Regression guard for the production invalid_target case after an enemy dies mid-queue.
test("Dungeon single-target actions retarget a dead selection to the living enemy with lowest HP", () => {
  const action = app.slice(app.indexOf("async function driveCoreBattle"));
  assert.match(action, /BATTLE_CORE_V1\.getActionMetadata\(state, actor, command\)/);
  assert.match(action, /targeting\.requiresEnemyTarget && !targeting\.legalTargetIds\.includes\(String\(command\.targetId \|\| ""\)\)/);
  assert.match(action, /\.sort\(\(a, b\) => Number\(a\.hp\) - Number\(b\.hp\) \|\| Number\(a\.tieOrder\) - Number\(b\.tieOrder\)\)/);
  assert.match(action, /command = \{ \.\.\.command, targetId: nextTarget\.id \}/);
  assert.match(action, /setTargetUid\(nextTarget\.id\)/);
});
