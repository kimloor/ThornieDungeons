const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "r2-upload/manifest.json"), "utf8"));
const assetSource = fs.readFileSync(path.join(root, "src/assets/manifest.js"), "utf8");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");

for (const petId of ["flamekit", "sparkpup"]) {
  test(`${petId} battle sprite contract uses the real manifest frames`, () => {
    const config = manifest.assets.pets[petId];
    const metadata = manifest.metadata[petId];
    assert.ok(config);
    assert.deepEqual(Object.keys(config.animations), ["idle", "attack", "death"]);
    assert.equal(config.animations.idle.length, 3);
    assert.equal(config.animations.attack.length, 3);
    assert.equal(config.animations.death.length, 1);
    for (const [animation, frames] of Object.entries(config.animations)) {
      frames.forEach((framePath, index) => {
        assert.equal(framePath, `sprite/pet/${petId}/animations/${petId}_${animation}_${index}.png`);
        assert.equal(fs.existsSync(path.join(root, "r2-upload", framePath)), true, framePath);
      });
    }
    assert.equal(config.presentation.sizeClass, "small");
    assert.equal(config.presentation.anchorType, "ground");
    assert.equal(metadata.orientation, "right");
    assert.equal(metadata.animationMode, "frame_sequence");
    assert.deepEqual(metadata.animations, { idle: 3, attack: 3, death: 1 });
  });
}

test("battle pet animation wiring preserves Sprout and supports safe frame fallback", () => {
  assert.match(assetSource, /sprout:\s*"sprout001"/);
  assert.match(assetSource, /const assetId = PET_ASSET_ALIASES\[raw\] \|\| raw/);
  assert.match(assetSource, /ASSETS\?\.pets\?\.\[assetId\] \|\| null/);
  assert.match(assetSource, /const playableFrames = frames\.filter\(src => !failedSources\.includes\(src\)\)/);
  assert.match(assetSource, /onError: handleFrameError/);
  assert.match(components, /function PetCombatSprite[\s\S]*const dead = pet\.hp <= 0[\s\S]*anim: anim \|\| ""[\s\S]*dead,[\s\S]*fallback: pet\.icon/s);
  assert.match(app, /actor\.kind === "pet"\) setPetAnim\("attack"\)/);
  assert.match(app, /setHeroAnim\(""\); setPetAnim\(""\)/);
});
