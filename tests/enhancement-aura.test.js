const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  enhancementAuraItemLevel,
  enhancementAuraStage,
  resolveEnhancementAura,
  EnhancementAuraRenderer,
  ENHANCEMENT_AURA_STYLES,
  resolveEnhancementAuraStyle
} = require("../src/phaser/presentation/EnhancementAura.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("Enhancement Aura thresholds map exactly to the approved four stages", () => {
  assert.deepEqual([0, 1, 3, 4, 5, 6, 7, 8, 9, 10].map(enhancementAuraStage), [0, 0, 0, 1, 1, 2, 2, 3, 3, 4]);
  assert.equal(enhancementAuraStage(11), 4);
  assert.equal(enhancementAuraStage(-2), 0);
});

test("Enhancement Aura reads only the equipped weapon enhancement level", () => {
  assert.equal(enhancementAuraItemLevel(null), 0);
  assert.equal(enhancementAuraItemLevel({ enhanceLevel: 8.9 }), 8);
  assert.equal(enhancementAuraItemLevel({ enhanceLevel: "invalid" }), 0);
  assert.deepEqual(resolveEnhancementAura({ weapon: { enhanceLevel: 10 } }), {
    weaponLevel: 10, weaponStage: 4, characterLevel: 0, characterStage: 0
  });
  assert.equal(resolveEnhancementAura({ weapon: null }).weaponStage, 0);
});

test("Character Aura uses the minimum of all four defensive slots only", () => {
  const equipped = {
    helmet: { enhanceLevel: 10 },
    chest: { enhanceLevel: 10 },
    gloves: { enhanceLevel: 8 },
    boots: { enhanceLevel: 10 },
    weapon: { enhanceLevel: 10 },
    wings: { enhanceLevel: 10 },
    accessory: { enhanceLevel: 10 }
  };
  const aura = resolveEnhancementAura(equipped);
  assert.equal(aura.characterLevel, 8);
  assert.equal(aura.characterStage, 3);
  assert.equal(aura.weaponStage, 4);
  assert.equal(resolveEnhancementAura({ ...equipped, boots: null }).characterStage, 0);
  assert.equal(resolveEnhancementAura({ ...equipped, gloves: { enhanceLevel: 3 } }).characterStage, 0);
  assert.equal(resolveEnhancementAura({
    helmet: { enhanceLevel: 10 }, chest: { enhanceLevel: 10 },
    gloves: { enhanceLevel: 10 }, boots: { enhanceLevel: 10 },
    weapon: { enhanceLevel: 0 }, wings: null, accessory: null
  }).characterStage, 4);
});

test("Battlefield snapshots apply Aura to Dungeon Hero and controlled Arena attacker only", () => {
  const bridge = read("src/phaser/presentation/EventBridge.js");
  assert.match(bridge, /enhancementAura: resolveEnhancementAura\(equipped\)/);
  assert.match(bridge, /enhancementAura: role === "attacker" \? resolveEnhancementAura\(equipped\) : null/);
  assert.match(bridge, /const attackerSide = String\(state\.controlledSide/);
});

test("Aura follows the verified V3/V5 weapon layers and cleans up with HeroActor", () => {
  const renderer = read("src/phaser/presentation/EnhancementAura.js");
  const heroRenderer = read("src/phaser/renderers/HeroRenderer.js");
  const heroActor = read("src/phaser/actors/HeroActor.js");
  assert.match(renderer, /"sword" : "weapon"/);
  assert.match(renderer, /currentLayer\.crop/);
  assert.match(renderer, /weaponImage\.displayWidth/);
  assert.match(renderer, /weaponImage\.angle/);
  assert.match(renderer, /Aura is intentionally the outermost presentation layer/);
  assert.match(renderer, /root\.moveTo\(this\.characterRoot, root\.list\.length - 1\)/);
  assert.match(renderer, /root\.moveTo\(halo, root\.list\.length - 1\)/);
  assert.match(renderer, /this\.stopTweens\(this\.characterTweens\)/);
  assert.match(renderer, /this\.stopTweens\(this\.weaponTweens\)/);
  assert.match(heroRenderer, /this\.currentLayers = layers/);
  assert.match(heroActor, /new EnhancementAuraRenderer/);
  assert.match(heroActor, /this\.enhancementAuraRenderer\?\.update/);
  assert.match(heroActor, /this\.enhancementAuraRenderer\?\.destroy/);
});


test("Inventory Hero preview snapshot derives Aura from its current preview loadout", () => {
  const bridge = read("src/phaser/presentation/EventBridge.js");
  assert.match(bridge, /function buildHeroPreviewSnapshot\(\{ heroName = "Hero", equipped = \{\}, heroV5 = true \} = \{\}\)/);
  const preview = bridge.slice(bridge.indexOf("function buildHeroPreviewSnapshot"), bridge.indexOf("function buildBattlefieldSnapshot"));
  assert.match(preview, /enhancementAura: resolveEnhancementAura\(equipped\)/);
  assert.match(preview, /layerFrames: heroFrames/);
});

test("Inventory HeroPreviewScene reuses EnhancementAuraRenderer, refreshes per preview frame, and cleans it up", () => {
  const scene = read("src/phaser/scenes/HeroPreviewScene.js");
  assert.match(scene, /new EnhancementAuraRenderer\(this, this\.heroRoot, \(\) => this\.displaySize\(\)\)/);
  assert.match(scene, /update\(this\.snapshot\?\.hero\?\.enhancementAura, this\.heroRenderer\)/);
  assert.match(scene, /this\.applyHeroFrame\("idle", this\.frameIndex\)/);
  assert.match(scene, /this\.enhancementAuraRenderer\?\.destroy\(\)/);
});


test("Aura failures route through shared catcher with bounded context", () => {
  const catcherSource = read("src/systems/battleErrorCatcher.js");
  const actor = read("src/phaser/actors/HeroActor.js");
  const preview = read("src/phaser/scenes/HeroPreviewScene.js");
  assert.match(catcherSource, /capturePresentation/);
  assert.match(catcherSource, /enhancement_aura_failed/);
  assert.match(actor, /phase: "create"/);
  assert.match(actor, /phase: "update"/);
  assert.match(preview, /capturePresentation/);
});

test("Shared catcher logs sanitized Aura failures and obeys its switch", () => {
  delete globalThis.BATTLE_ERROR_CATCHER;
  require("../src/systems/battleErrorCatcher.js");
  const catcher = globalThis.BATTLE_ERROR_CATCHER;
  const originalWarn = console.warn;
  const messages = [];
  console.warn = (...args) => messages.push(args);
  try {
    catcher.capturePresentation({ thrown: Object.assign(new Error("private detail"), { code: "AURA_RENDER_FAILED" }), surface: "inventory", phase: "update" });
    assert.equal(messages.length, 1);
    const payload = JSON.parse(messages[0][1]);
    assert.deepEqual(payload, { event: "enhancement_aura_failed", system: "phaser_presentation", component: "enhancement_aura", reason: "aura_render_failed", version: "1.1.56", surface: "inventory", phase: "update" });
    assert.equal(JSON.stringify(payload).includes("private detail"), false);
    catcher.setEnabled(false);
    catcher.capturePresentation({ thrown: new Error("hidden"), surface: "dungeon", phase: "create" });
    assert.equal(messages.length, 1);
  } finally { catcher.setEnabled(true); console.warn = originalWarn; }
});


test("Weapon Aura emits bounded diagnostics when the selected weapon layer is unavailable", () => {
  const renderer = read("src/phaser/presentation/EnhancementAura.js");
  assert.match(renderer, /weapon_aura_diagnostic/);
  assert.match(renderer, /weapon_layer_missing/);
  assert.match(renderer, /availableLayers: layerNames\.slice\(0, 24\)/);
  assert.match(renderer, /weaponImage\.displayWidth/);
});


test("Weapon Aura diagnostic is visible in the Hero preview for mobile QA", () => {
  const renderer = read("src/phaser/presentation/EnhancementAura.js");
  assert.match(renderer, /Weapon Aura: \$\{reason\}/);
  assert.match(renderer, /weaponDiagnosticText\?\.setVisible\?\.\(true\)/);
  assert.match(renderer, /weaponDiagnosticText\?\.destroy/);
});

test("Golden Power is a replaceable style profile with four distinct stage colors", () => {
  const style = resolveEnhancementAuraStyle("goldenPower");
  assert.equal(style.id, "goldenPower");
  assert.deepEqual(Object.keys(style.palette), ["1", "2", "3", "4"]);
  assert.equal(new Set(Object.values(style.palette)).size, 4);
  assert.equal(resolveEnhancementAuraStyle("future-style"), ENHANCEMENT_AURA_STYLES.goldenPower);
});

test("Golden Power effect intensity is fixed and stages only select colors", () => {
  const source = read("src/phaser/presentation/EnhancementAura.js");
  assert.match(source, /this\.style\.palette\[stage\]/);
  assert.match(source, /const ringCount = intensity\.ringCount/);
  assert.match(source, /const particleCount = intensity\.particleCount/);
  assert.match(source, /const count = intensity\.weaponHaloCount/);
  assert.doesNotMatch(source, /forceVisible = true/);
  const intensity = ENHANCEMENT_AURA_STYLES.goldenPower.intensity;
  assert.equal(intensity.ringCount, 3);
  assert.equal(intensity.particleCount, 10);
  assert.equal(intensity.weaponHaloCount, 3);
});

// ---------- Ver 1.1.56: visibility + on-screen diagnostic regression ----------
function fakeAuraScene({ rootWorldY = 241, canvasHeight = 280 } = {}) {
  const made = [];
  const chain = obj => new Proxy(obj, { get: (t, k) => (k in t ? t[k] : (...a) => { t.calls.push([k, ...a]); if (k === "setText") t.text = a[0]; if (k === "setPosition") { t.x = a[0]; t.y = a[1]; } if (k === "setVisible") t.visible = a[0]; if (k === "setBlendMode") t.blend = a[0]; return t.self; }) });
  const mk = type => { const o = { type, calls: [], visible: true }; o.self = chain(o); made.push(o); return o.self; };
  const scene = {
    add: { container: () => mk("container"), graphics: () => mk("graphics"), text: () => mk("text"), circle: () => mk("circle"), image: () => mk("image") },
    tweens: { add: () => ({ stop() {} }) }
  };
  const root = { list: [], add(o) { this.list.push(o); }, remove() {}, moveTo() {},
    getWorldTransformMatrix: () => ({ ty: rootWorldY, scaleY: 1 }) };
  return { scene, root, made, canvasHeight };
}

test("Weapon diagnostic label is pinned inside the visible stage with a real newline", () => {
  const { scene, root, canvasHeight } = fakeAuraScene();
  const renderer = new EnhancementAuraRenderer(scene, root, () => 202);
  renderer.update({ characterStage: 0, weaponStage: 0 }, { data: { visualMode: "v3" }, layerImages: [], currentLayers: [] });
  const label = renderer.weaponDiagnosticText;
  assert.ok(label.visible, "label shows even when the stage is disabled");
  assert.match(label.text, /^Weapon Aura: stage_disabled\nW0 C0 /);
  assert.equal(label.text.includes("\\n"), false);
  const screenY = label.y + 241;
  assert.ok(screenY >= 0 && screenY < canvasHeight * 0.25, `label screen Y ${screenY} must be inside the canvas`);
});

test("Character Aura sits on the ground reference, additive, with stage-independent intensity", () => {
  const { scene, root, made } = fakeAuraScene();
  const renderer = new EnhancementAuraRenderer(scene, root, () => 200);
  const counts = [];
  let strokeSeen = 0;
  [1, 2, 3, 4].forEach(stage => {
    renderer.characterStage = -1;
    renderer.update({ characterStage: stage, weaponStage: 0 }, { data: {}, layerImages: [], currentLayers: [] });
    const g = made.find(o => o.type === "graphics");
    const total = g.calls.filter(c => c[0] === "strokeEllipse").length;
    counts.push([renderer.characterParticles.length, total - strokeSeen]);
    strokeSeen = total;
  });
  assert.deepEqual(new Set(counts.map(c => c.join(","))).size, 1);
  const style = ENHANCEMENT_AURA_STYLES.goldenPower.intensity;
  assert.ok(style.groundY <= 0 && style.groundY > -0.1, "ring centre stays at the feet, not at the head");
  assert.ok(style.ringAlpha >= 0.6 && style.weaponHaloAlpha >= 0.4, "effects are strong enough to read on mobile");
  assert.ok(made.find(o => o.type === "graphics").blend === 1, "additive blend is applied to the ground glow");
});

test("Weapon halos are same-origin additive copies and release the WebGL glow safely", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "src/phaser/presentation/EnhancementAura.js"), "utf8");
  assert.match(source, /halo\.setBlendMode\?\.\(enhancementAuraBlendAdd\(\)\)/);
  assert.match(source, /weaponHaloGrowth/);
  assert.doesNotMatch(source, /1\.055 \+ index/);
  assert.match(source, /applyWeaponGlow\(halo, color, intensity\.weaponGlowStrength\)/);
});
