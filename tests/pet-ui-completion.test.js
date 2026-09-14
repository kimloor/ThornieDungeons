const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "r2-upload/manifest.json"), "utf8"));
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");

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
});

test("result feedback consumes derived Pet progress and never invokes the EXP grant", () => {
  const resultStart = components.indexOf("function ResultScreen");
  const resultSource = components.slice(resultStart);
  assert.match(resultSource, /Pet EXP \+.*rewards\.petProgress\.xpGained/s);
  assert.match(resultSource, /startLevel.*endLevel/s);
  assert.doesNotMatch(resultSource, /grantActivePetBattleXp/);
  assert.match(app, /petProgressChange\(save\.pets, newPets, save\.activePetId\)/);
});

