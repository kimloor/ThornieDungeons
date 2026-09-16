const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "r2-upload/manifest.json"), "utf8"));
const r2Catalog = fs.readFileSync(path.join(root, "src/data/r2-manifest.json"), "utf8");
const assets = fs.readFileSync(path.join(root, "src/assets/manifest.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/data/styles.js"), "utf8");

test("Hero uses the real idle overlay and an explicit visible idle loop", () => {
  const idlePath = manifest.assets.hero001.v3.base.idle.path;
  assert.equal(idlePath, "sprite/characters/hero001/base/hero_base.png");
  assert.match(r2Catalog, /"key": "sprite\/characters\/hero001\/base\/hero_base\.png"/);
  assert.match(components, /function HeroSprite[\s\S]*anim: anim \|\| "idle"/s);
  assert.match(assets, /anim !== "attack"[\s\S]*fallbackPath: idleLayer\.path/s);
  assert.match(styles, /\.md-hero-v3-canvas\.idle\s*\{[^}]*animation:\s*md-hero-idle-breathe[^}]*infinite/s);
  assert.match(styles, /@keyframes md-hero-idle-breathe \{ 0%,100% \{ transform: translateY\(0\) scale\(1\); \} 50% \{ transform: translateY\(-7px\) scale\(1\.025\); \} \}/);
  assert.match(app, /setHeroAnim\(""\); setPetAnim\(""\)/);
});

test("combat pacing and frame playback are presentation-only and slightly slower", () => {
  assert.match(app, /combatDelay\(actor\.kind === "hero" \? 420 : 520\)/);
  assert.match(components, /attackFrameMs: 150 \/ combatSpeed/g);
  assert.match(components, /Math\.round\(650 \/ \(combatSpeed \|\| 1\)\)/);
  assert.match(assets, /Number\(config\?\.attackFrameMs \|\| 105\) \* 1\.15 \/ Math\.max\(1, playbackRate\)/);
});

test("battle Pet grows from its ground edge and remains restrained on mobile", () => {
  assert.match(styles, /\.md-pet-img\s*\{[^}]*scale\(1\.15\)[^}]*transform-origin:\s*center bottom/s);
  assert.match(styles, /\.md-pet-img\.death\s*\{[^}]*scale\(1\.15\)[^}]*animation:\s*none/s);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*\.md-pet-img\.attack\s*\{[^}]*scale\(1\.1\)/s);
  assert.match(styles, /\.md-pet-slot\s*\{[^}]*left:clamp\(54px,18%,90px\)[^}]*top:73%/s);
});

test("Pet artwork zones and ACTIVE title plate use the tuned offsets", () => {
  assert.match(styles, /\.md-pet-role\s*\{[^}]*top:\s*56\.8%/s);
  assert.match(styles, /\.md-pet-stars\s*\{[^}]*top:\s*59\.4%/s);
  assert.match(styles, /\.md-pet-exp-bar\s*\{[^}]*top:\s*65\.9%/s);
  assert.match(styles, /\.md-pet-skill-title\s*\{[^}]*left:\s*7px[^}]*top:\s*6px[^}]*width:\s*82px[^}]*height:\s*33px/s);
});
