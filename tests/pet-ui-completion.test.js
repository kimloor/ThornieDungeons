const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "r2-upload/manifest.json"), "utf8"));
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/data/styles.js"), "utf8");

test("Pet UI manifest keys resolve to committed Graphics files", () => {
  const ui = manifest.assets.petUi;
  const paths = [
    ui.mainFrame, ui.expBar.frame, ui.expBar.background, ui.expBar.fill,
    ui.roles.attack, ui.roles.support, ui.roles.tank, ui.roles.control,
    ui.starIcon, ui.skillInfoPanel, ui.skillTitlePlate,
    ui.starAuras.twoStar, ui.starAuras.threeStar
  ];
  assert.equal(paths.length, 13);
  paths.forEach(assetPath => assert.equal(fs.existsSync(path.join(root, "r2-upload", assetPath)), true, assetPath));
});

test("Pet page uses one-, two-, and three-star aura contract without battle aura wiring", () => {
  assert.match(components, /selectedStar === 3 \? petUiUrl\("starAuras\.threeStar"\)/);
  assert.match(components, /selectedStar === 2 \? petUiUrl\("starAuras\.twoStar"\) : ""/);
  assert.match(components, /className: "md-pet-star-aura"/);
  assert.doesNotMatch(components, /PetCombatSprite[\s\S]{0,1200}starAuras/);
  assert.match(styles, /\.md-pet-star-aura\s*\{[^}]*z-index:\s*1/s);
  assert.doesNotMatch(styles, /\.md-pet-star-aura\s*\{[^}]*z-index:\s*-/s);
  assert.match(styles, /\.md-pet-profile-sprite\s*\{[^}]*z-index:\s*2/s);
  assert.match(styles, /\.md-pet-profile\s*>\s*:not\(\.md-pet-showcase\)\s*\{[^}]*z-index:\s*3/s);
  assert.match(styles, /\.md-pet-star-aura\s*\{[^}]*pointer-events:\s*none/s);
});

test("Pet roster is the right-side secondary navigation and very narrow screens stack safely", () => {
  assert.match(styles, /\.md-pet-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+96px/s);
  assert.match(styles, /\.md-pet-roster\s*\{[^}]*grid-column:\s*2/s);
  assert.match(styles, /@media\s*\(max-width:\s*340px\)[\s\S]*\.md-pet-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/s);
});

test("Pet header does not duplicate the global diamond balance", () => {
  const petStart = components.indexOf("function PetScreen");
  const gachaStart = components.indexOf("function GachaScreen", petStart);
  const petSource = components.slice(petStart, gachaStart);
  assert.doesNotMatch(petSource, /iconKey:\s*"diamond"/);
  assert.doesNotMatch(petSource, /save\.diamonds/);
});

test("Pet profile labels, EXP, stats and skill descriptions remain centered and wrap on mobile", () => {
  assert.match(styles, /\.md-pet-name-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/s);
  assert.match(styles, /\.md-pet-exp-copy\s*\{[^}]*align-items:\s*center/s);
  assert.match(styles, /\.md-pet-primary-stats div\s*\{[^}]*align-items:\s*center[^}]*justify-content:\s*center/s);
  assert.match(styles, /\.md-pet-skill-copy p\s*\{[^}]*white-space:\s*normal[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*\.md-pet-exp-bar/s);
});

test("result feedback consumes derived Pet progress and never invokes the EXP grant", () => {
  const resultStart = components.indexOf("function ResultScreen");
  const resultSource = components.slice(resultStart);
  assert.match(resultSource, /Pet EXP \+.*rewards\.petProgress\.xpGained/s);
  assert.match(resultSource, /startLevel.*endLevel/s);
  assert.doesNotMatch(resultSource, /grantActivePetBattleXp/);
  assert.match(app, /petProgressChange\(save\.pets, newPets, save\.activePetId\)/);
});
