const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
const app = fs.readFileSync(path.join(ROOT, "src/ui/App.js"), "utf8");
const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");

function between(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(start, -1, startNeedle);
  assert.notEqual(end, -1, endNeedle);
  return source.slice(start, end);
}

test("Character Skills renders with the busy/reset lifecycle declared", () => {
  const source = between(components, "function HeroSkillV1Screen", "// ---------- Phase 2/3/5");
  const sandbox = {
    useState: initial => [initial, () => {}],
    React: { createElement: () => ({}) },
    HERO_SKILLS_V1: [{ id: "power_strike", branch: "assault", tier: 1, kind: "active", maxRank: 5 }],
    heroSkillSpentPoints: () => 0,
    heroSkillPointBudget: () => 1,
    heroSkillRank: () => 0,
    canSpendHeroSkillPoint: () => ({ ok: true, cost: 1 }),
    CharacterPageHeader() {}, CharacterTabs() {}, HeroSkillIcon() {}, CharacterPageDock() {}, PaidResetConfirm() {}
  };
  vm.createContext(sandbox);
  vm.runInContext(`${source}; globalThis.renderSkills = HeroSkillV1Screen;`, sandbox);
  assert.doesNotThrow(() => sandbox.renderSkills({
    save: { character: { level: 10, skillLevels: {} }, diamonds: 0 },
    cp: 1,
    onLearnSkill: async () => true,
    onResetSkills: async () => true
  }));
  assert.match(source, /const \[skillsBusy, setSkillsBusy\] = useState\(false\)/);
  assert.match(source, /const doPaidReset = async \(\) =>/);
});

test("shared runtime popup sanitizes secrets and never retains raw persistence payloads", () => {
  const source = between(components, "function sanitizedRuntimeDetail", "function runtimeDiagnosticText");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${source}; globalThis.clean = sanitizedRuntimeDetail;`, sandbox);
  const cleaned = sandbox.clean("https://example.test/x?token=secret&code=private Authorization: Bearer abc.def password=hunter2");
  assert.doesNotMatch(cleaned, /secret|private|abc\.def|hunter2/);
  assert.match(cleaned, /\[redacted\]/);
  assert.match(components, /function RuntimeDiagnosticOverlay/);
  assert.match(components, /event: "cloud_persistence_failure"/);
  assert.match(components, /event: "arena_presentation_failure"/);
  assert.doesNotMatch(app, /setPersistenceDiagnostic\(\{[\s\S]{0,700}\bcharacterId:/);
  assert.doesNotMatch(app, /setPersistenceDiagnostic\(\{[\s\S]{0,700}\bresponse,/);
  assert.doesNotMatch(app, /setPersistenceDiagnostic\(\{[\s\S]{0,700}\bstack:/);
});

test("Arena history uses viewer direction and Defense-safe revenge semantics", () => {
  const helper = between(components, "function arenaHistoryPresentation", "function arenaSetupPetIcon");
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${helper}; globalThis.present = arenaHistoryPresentation;`, sandbox);
  const attack = sandbox.present("attack", { result: "win", defenderName: "Rival", attackerRatingChange: 12, arenaCoinEarned: 25 });
  const defense = sandbox.present("defense", { result: "win", attackerName: "Raider", defenderRatingChange: -9, arenaCoinEarned: 25 });
  assert.deepEqual({ result: attack.result, direction: attack.direction, rating: attack.ratingChange, coin: attack.coin }, { result: "WIN", direction: "You attacked Rival", rating: 12, coin: 25 });
  assert.deepEqual({ result: defense.result, direction: defense.direction, rating: defense.ratingChange, coin: defense.coin }, { result: "LOSS", direction: "Raider attacked you", rating: -9, coin: null });
  const arena = between(components, "function ArenaV2Screen", "// Turns a mail");
  assert.match(arena, /kind === "defense" && row\.attackerCharacterId/);
  assert.doesNotMatch(arena, /kind === "attack" && row\.defenderCharacterId[\s\S]{0,240}>REVENGE/);
});

test("Arena setup, cooldown, milestones, currencies, and dock use the shared mobile-safe UI", () => {
  const arena = between(components, "function ArenaV2Screen", "// Turns a mail");
  const setup = between(arena, 'tab === "setup"', 'tab === "ranking"');
  assert.doesNotMatch(setup, /React\.createElement\("select"/);
  assert.match(setup, /md-arena-setup-picker/);
  assert.match(setup, /HeroSkillIcon/);
  assert.match(setup, /arenaSetupPetIcon/);
  assert.match(setup, /md-arena-loadout/);
  assert.match(arena, /`REFRESH · \$\{refreshSeconds\}s`/);
  assert.doesNotMatch(arena, /md-arena-refresh-cooldown/);
  assert.match(components, /`\$\{progress\.count\}\/\$\{progress\.next\.threshold\}`/);
  assert.match(components, /function GlobalCurrencyBar[\s\S]{0,5000}md-currency-overlay/);
  assert.match(styles, /\.md-arena-v2 > \.md-hub-dock \{ position:fixed; left:50%; right:auto; bottom:0;/);
  assert.match(styles, /\.md-arena-skill-setup-slot > \.md-arena-setup-options \{ left:0; right:auto; width:min\(78vw,290px\);/);
  assert.match(styles, /nth-child\(even\) > \.md-arena-setup-options \{ left:auto; right:0; \}/);
  assert.match(styles, /\.md-currency-card \{ box-sizing:border-box;/);
  assert.match(styles, /\.md-arena-page-header \{[^}]*grid-template-columns:44px 42px minmax\(0,1fr\)/);
  assert.match(styles, /\.md-arena-progress-fill \{[^}]*width:0;[^}]*background-color:#2f8dff/);
  assert.doesNotMatch(styles, /clip-path:inset\(0 calc\(100% - var\(--arena-progress\)\)/);
  assert.match(components, /ARENA_SETUP_EQUIPMENT_SLOT_ORDER/);
  assert.match(arena, /arenaSetupEquipmentSlots\(status\.equipment\)/);
  assert.match(styles, /grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
  assert.doesNotMatch(components, /CURRENCY INFO/);
});

