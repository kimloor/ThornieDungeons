const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(ROOT, "src/ui/App.js"), "utf8");
const components = fs.readFileSync(path.join(ROOT, "src/ui/components.js"), "utf8");
const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");

test("Hero skill upgrade commits the full draft object", () => {
  assert.match(app, /function commitSkillDraft\(draft\)/);
  assert.match(app, /function learnHeroSkill\(draft\) \{ return commitSkillDraft\(draft\); \}/);
  assert.doesNotMatch(app, /function learnHeroSkill\(id\) \{ return commitSkillDraft\(\{ \[id\]: 1 \}\); \}/);
});

test("Shop overlay uses a document portal and mobile-safe fixed sheet", () => {
  const shopStart = components.indexOf("function ShopOverlay");
  assert.ok(shopStart >= 0);
  const shopBody = components.slice(shopStart, components.indexOf("function PetRoster", shopStart));
  assert.match(shopBody, /ReactDOM\.createPortal/);
  assert.match(shopBody, /document\.body/);
  assert.match(styles, /\.md-shop-sheet-backdrop \{[\s\S]*position:fixed; inset:0; z-index:260;/);
  assert.match(styles, /\.md-shop-sheet \{[\s\S]*width:min\(430px,100vw\);/);
  assert.match(styles, /\.md-shop-body \{[\s\S]*overflow-y:auto;/);
});
