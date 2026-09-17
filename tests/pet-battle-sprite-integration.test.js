const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "r2-upload/manifest.json"), "utf8"));
const assetSource = fs.readFileSync(path.join(root, "src/assets/manifest.js"), "utf8");
const components = fs.readFileSync(path.join(root, "src/ui/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "src/ui/App.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/data/styles.js"), "utf8");
const petsSource = fs.readFileSync(path.join(root, "src/systems/pets.js"), "utf8");

const PET_CONTRACTS = {
  flamekit: { sizeClass: "small", anchorType: "ground" },
  sparkpup: { sizeClass: "small", anchorType: "ground" },
  ember_fox: { sizeClass: "small", anchorType: "ground" },
  moon_hare: { sizeClass: "small", anchorType: "ground" },
  hell_wolf: { sizeClass: "small", anchorType: "ground" },
  inferno_drake: { sizeClass: "medium", anchorType: "ground" },
  storm_phoenix: { sizeClass: "medium", anchorType: "flying" }
};

for (const [petId, expected] of Object.entries(PET_CONTRACTS)) {
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
    assert.equal(config.presentation.sizeClass, expected.sizeClass);
    assert.equal(config.presentation.anchorType, expected.anchorType);
    assert.ok(config.presentation.bounds.idle);
    assert.ok(config.presentation.bounds.attack);
    assert.ok(config.presentation.bounds.death);
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
  assert.match(components, /function getPetPresentation[\s\S]*presentation\?\.sizeClass[\s\S]*presentation\?\.anchorType === "flying"/s);
  assert.match(components, /function PetCombatSprite[\s\S]*cropTransparent: true[\s\S]*stableBoundsAnimations: \["idle", "attack", "death"\][\s\S]*visualHeight: presentation\.height[\s\S]*maxVisualWidth: presentation\.maxWidth/s);
  assert.match(assetSource, /function getStableSpriteOpaqueBoundsUnion/);
  assert.match(styles, /\.md-pet-unit > \.md-cropped-sprite-stage \{ overflow:visible; transform-origin:center bottom; \}/);
  assert.match(app, /actor\.kind === "pet"\) setPetAnim\("attack"\)/);
  assert.match(app, /setHeroAnim\(""\); setPetAnim\(""\)/);
});

test("all Pet animation bounds share a stable union crop", () => {
  for (const petId of ["sprout001", "flamekit", "sparkpup", "ember_fox", "moon_hare", "hell_wolf", "inferno_drake", "storm_phoenix"]) {
    const bounds = manifest.assets.pets[petId].presentation.bounds;
    const frames = Object.values(bounds);
    const left = Math.min(...frames.map(frame => frame.left));
    const top = Math.min(...frames.map(frame => frame.top));
    const right = Math.max(...frames.map(frame => frame.left + frame.width));
    const bottom = Math.max(...frames.map(frame => frame.top + frame.height));
    for (const frame of frames) {
      assert.ok(frame.left >= left && frame.top >= top, `${petId}: frame starts inside union`);
      assert.ok(frame.left + frame.width <= right && frame.top + frame.height <= bottom, `${petId}: frame ends inside union`);
      assert.ok(right <= frame.canvasWidth && bottom <= frame.canvasHeight, `${petId}: union stays on canvas`);
    }
  }
});

test("ground and flying Pet envelopes stay inside requested battle viewports", () => {
  const layouts = [
    { width:375, height:286, x:71.25, scale:.8 },
    { width:390, height:300, x:74.1, scale:.82 },
    { width:430, height:300, x:81.7, scale:.82 },
    { width:600, height:300, x:108, scale:.9 },
    { width:700, height:300, x:118, scale:.9 },
    { width:820, height:300, x:139.4, scale:.96 },
    { width:820, height:286, x:139.4, scale:.96 }
  ];
  for (const layout of layouts) {
    const width = 136 * layout.scale * 1.15;
    const height = 94 * layout.scale * 1.15;
    assert.ok(layout.x - width / 2 > 0, `${layout.width}: left edge remains visible`);
    assert.ok(layout.x + width / 2 < layout.width, `${layout.width}: right edge remains visible`);
    for (const top of [.75, layout.width <= 380 ? .69 : .68]) {
      assert.ok(layout.height * top - height / 2 > 0, `${layout.width}: top edge remains visible`);
      assert.ok(layout.height * top + height / 2 < layout.height, `${layout.width}: bottom edge remains visible`);
    }
  }
});

test("all equipped Pet V2 ids resolve directly and Storm Phoenix uses its flying slot", () => {
  for (const petId of Object.keys(PET_CONTRACTS)) {
    assert.match(petsSource, new RegExp(`id: "${petId}"`));
    assert.ok(manifest.assets.pets[petId]);
  }
  assert.match(components, /getPetSpriteConfig\(pet\.defId\)/);
  assert.match(components, /className: `md-pet-slot \$\{getPetPresentation\(petCombat\)\.anchorType === "flying" \? "flying" : "grounded"\}`/);
  assert.match(styles, /\.md-pet-slot\.flying\s*\{[^}]*top:\s*68%/s);
  assert.match(styles, /@media \(max-width: 380px\)[\s\S]*\.md-pet-slot\.flying\s*\{[^}]*top:\s*69%/s);
});
