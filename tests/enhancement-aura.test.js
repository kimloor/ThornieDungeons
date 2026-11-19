const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  enhancementAuraItemLevel,
  enhancementAuraStage,
  enhancementAuraBladeGeometry,
  enhancementAuraOrientBlade,
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

test("Battlefield snapshots apply Aura to the Dungeon Hero and to BOTH Arena sides (attacker and opponent)", () => {
  const bridge = read("src/phaser/presentation/EventBridge.js");
  assert.match(bridge, /enhancementAura: resolveEnhancementAura\(equipped\)/);
  assert.doesNotMatch(bridge, /enhancementAura: role === /);
  assert.equal((bridge.match(/enhancementAura: resolveEnhancementAura\(equipped\)/g) || []).length, 3, "inventory, dungeon and arena (both roles share one builder)");
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
  assert.match(renderer, /Weapon Aura \(halos \+ blade flames\) stays the outermost presentation layer/);
  assert.match(renderer, /root\.moveTo\(this\.characterRoot, 0\)/);
  assert.match(renderer, /root\.moveTo\(this\.weaponFlameRoot, root\.list\.length - 1\)/);
  assert.match(renderer, /root\.moveTo\(halo, root\.list\.length - 1\)/);
  assert.match(renderer, /this\.flickerDriver\?\.stop\?\.\(\)/);
  assert.match(renderer, /this\.weaponFlameRoot\?\.destroy\?\.\(true\)/);
  assert.match(renderer, /this\.characterRoot\?\.destroy\?\.\(true\)/);
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
    assert.deepEqual(payload, { event: "enhancement_aura_failed", system: "phaser_presentation", component: "enhancement_aura", reason: "aura_render_failed", version: "1.1.60", surface: "inventory", phase: "update" });
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

test("Weapon diagnostic is OFF by default and creates no label or console record", () => {
  delete globalThis.THORNIE_AURA_DIAGNOSTIC;
  const { scene, root, made } = fakeAuraScene();
  const infoCalls = [];
  const originalInfo = console.info;
  console.info = (...a) => infoCalls.push(a);
  try {
    const renderer = new EnhancementAuraRenderer(scene, root, () => 202);
    renderer.update({ characterStage: 2, weaponStage: 2 }, { data: { visualMode: "v3" }, layerImages: [], currentLayers: [] });
    assert.equal(renderer.weaponDiagnosticText, null);
    assert.equal(made.some(o => o.type === "text"), false);
    assert.equal(infoCalls.length, 0);
  } finally { console.info = originalInfo; }
});

test("Weapon diagnostic label is pinned inside the visible stage with a real newline (opt-in)", () => {
  globalThis.THORNIE_AURA_DIAGNOSTIC = true;
  const { scene, root, canvasHeight } = fakeAuraScene();
  const renderer = new EnhancementAuraRenderer(scene, root, () => 202);
  delete globalThis.THORNIE_AURA_DIAGNOSTIC;
  renderer.update({ characterStage: 0, weaponStage: 0 }, { data: { visualMode: "v3" }, layerImages: [], currentLayers: [] });
  const label = renderer.weaponDiagnosticText;
  assert.ok(label.visible, "label shows even when the stage is disabled");
  assert.match(label.text, /^Weapon Aura: stage_disabled\nW0 C0 /);
  assert.equal(label.text.includes("\\n"), false);
  const screenY = label.y + 241;
  assert.ok(screenY >= 0 && screenY < canvasHeight * 0.25, `label screen Y ${screenY} must be inside the canvas`);
});

// ---------- Ver 1.1.60: Power Flame style (flame rays, new palette, blade-following weapon Aura) ----------
function fakeFlameScene({ rendererType, glow = false } = {}) {
  const made = [];
  const textures = new Map();
  const chain = obj => new Proxy(obj, { get: (t, k) => (k in t ? t[k] : (...a) => {
    t.calls.push([k, ...a]);
    if (k === "setPosition") { t.x = a[0]; t.y = a[1]; }
    if (k === "setScale") { t.scaleX = a[0]; t.scaleY = a[1]; }
    if (k === "setAlpha") t.alpha = a[0];
    if (k === "setAngle") t.angle = a[0];
    if (k === "setVisible") t.visible = a[0];
    if (k === "setTexture") t.key = a[0];
    return t.self;
  }) });
  const mk = (type, extra = {}) => { const o = { type, calls: [], visible: true, ...extra }; o.self = chain(o); made.push(o); return o.self; };
  const ctx = new Proxy({}, { get: (t, k) => (k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {}), set: () => true });
  const scene = {
    sys: rendererType === undefined ? undefined : { game: { renderer: { type: rendererType } } },
    add: { container: () => mk("container"), image: (x, y, key) => mk("image", { key }), text: () => mk("text"),
      graphics: () => mk("graphics", glow ? { postFX: { glowCalls: [], clear() {}, addGlow(...args) { this.glowCalls.push(args); } } } : {}) },
    textures: {
      exists: key => textures.has(key),
      createCanvas: key => { textures.set(key, true); return { context: ctx, refresh() {} }; }
    },
    tweens: { add: cfg => { const tween = { cfg, stopped: false, stop() { this.stopped = true; } }; made.push({ type: "tween", tween }); return tween; } }
  };
  const root = { list: [], add(o) { this.list.push(o); }, remove() {}, moveTo(o, i) { this.moved = [...(this.moved || []), [o, i]]; } };
  return { scene, root, made, textures };
}
const flameImages = made => made.filter(o => o.type === "image" && String(o.key).startsWith("enhancement-aura-"));
const NO_HERO = { data: { visualMode: "v3" }, layerImages: [], currentLayers: [] };

test("Power Flame is the default replaceable style with the approved green/purple/pink/gold stage colours", () => {
  const style = resolveEnhancementAuraStyle("powerFlame");
  assert.equal(style.id, "powerFlame");
  assert.deepEqual(style.palette, { 1: 0x3dff7a, 2: 0xb15cff, 3: 0xff4fd8, 4: 0xffd23a });
  assert.equal(resolveEnhancementAuraStyle("future-style"), ENHANCEMENT_AURA_STYLES.powerFlame);
  assert.equal(resolveEnhancementAuraStyle(), ENHANCEMENT_AURA_STYLES.powerFlame);
  assert.equal(Object.isFrozen(style.intensity), true);
});

test("Blade geometry follows the sprite's own silhouette and picks a sensible tip direction", () => {
  const W = 120;
  const H = 120;
  const draw = predicate => {
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (predicate(x, y)) rgba[(y * W + x) * 4 + 3] = 255;
    return rgba;
  };
  const tilted = enhancementAuraBladeGeometry(draw((x, y) => y > 10 && y < 100 && Math.abs(x - (60 + (100 - y) * 0.35)) < 3), W, H);
  assert.ok(tilted.uy < -0.9, "steep blade: the tip points up");
  assert.ok(tilted.ux > 0.25 && tilted.ux < 0.45, "lean to the right is detected from the pixels");
  assert.ok(tilted.tmax - tilted.tmin > 80);
  const flat = enhancementAuraBladeGeometry(draw((x, y) => x > 20 && x < 100 && Math.abs(y - 60) < 3), W, H);
  assert.ok(flat.ux > 0.95, "horizontal blade: the tip points forward (+x)");
  assert.equal(enhancementAuraBladeGeometry(draw(() => false), W, H), null);
});

function stubBladeDom(rgba, size) {
  globalThis.document = { createElement: () => ({ width: size, height: size, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: rgba }) }) }) };
}
function fakeWeaponHero(weaponImage) {
  return { data: { visualMode: "v3" }, layerImages: [{ name: "weapon", image: weaponImage }], currentLayers: [{ name: "weapon", crop: null }] };
}
function fakeWeaponImage(overrides = {}) {
  return { visible: true, texture: { key: "weapon-frame-1" }, x: 12, y: -6, angle: 15, originX: 0.5, originY: 1,
    displayWidth: 240, displayHeight: 240, width: 480, height: 480,
    frame: { name: "__BASE", cutX: 0, cutY: 0, cutWidth: 480, cutHeight: 480, source: { image: {} } }, ...overrides };
}

test("Weapon flames sit on the blade axis and the container follows the weapon image", () => {
  const size = 160;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 20; y < 140; y += 1) for (let x = 0; x < size; x += 1) if (Math.abs(x - (60 + (140 - y) * 0.25)) < 2) rgba[(y * size + x) * 4 + 3] = 255;
  stubBladeDom(rgba, size);
  try {
    const { scene, root, made } = fakeFlameScene({ rendererType: 2 });
    const renderer = new EnhancementAuraRenderer(scene, root, () => 240);
    const weaponImage = fakeWeaponImage();
    renderer.update({ characterStage: 0, weaponStage: 2 }, fakeWeaponHero(weaponImage));
    const intensity = ENHANCEMENT_AURA_STYLES.powerFlame.intensity;
    assert.equal(renderer.weaponFlames.length, (intensity.weaponFlameCount + 1) * 2);
    const geometry = [...renderer.bladeCache.values()][0];
    assert.ok(geometry && geometry.frameW === 480);
    const tip = renderer.weaponFlameParts.find(f => f.tip).outer;
    const tipX = tip.obj.x + 0.5 * 480;
    const tipY = tip.obj.y + 1 * 480;
    const expectedX = geometry.mx + geometry.ux * geometry.tmax;
    const expectedY = geometry.my + geometry.uy * geometry.tmax;
    assert.ok(Math.abs(tipX - expectedX) < 0.5 && Math.abs(tipY - expectedY) < 0.5, "tip flame is at the blade tip");
    const container = renderer.weaponFlameRoot;
    assert.equal(container.visible, true);
    assert.deepEqual(container.calls.find(c => c[0] === "setPosition").slice(1), [12, -6]);
    assert.equal(container.calls.find(c => c[0] === "setAngle")[1], 15);
    assert.deepEqual(container.calls.find(c => c[0] === "setScale").slice(1), [0.5, 0.5]);
    weaponImage.x = 40;
    weaponImage.angle = -20;
    renderer.update({ characterStage: 0, weaponStage: 2 }, fakeWeaponHero(weaponImage));
    assert.equal(renderer.weaponFlames.length, (intensity.weaponFlameCount + 1) * 2, "flames are reused, not duplicated");
    const lastPosition = container.calls.filter(c => c[0] === "setPosition").pop();
    assert.equal(lastPosition[1], 40);
    renderer.update({ characterStage: 0, weaponStage: 0 }, fakeWeaponHero(weaponImage));
    assert.equal(renderer.weaponFlames.length, 0);
    assert.equal(made.filter(o => o.type === "tween").length, 1);
  } finally { delete globalThis.document; }
});

test("Weapon Aura hides when the weapon layer is missing/hidden or its pixels cannot be read", () => {
  const { scene, root } = fakeFlameScene({ rendererType: 2 });
  const renderer = new EnhancementAuraRenderer(scene, root, () => 240);
  renderer.update({ characterStage: 0, weaponStage: 3 }, NO_HERO);
  assert.equal(renderer.weaponFlameRoot.visible, false);
  const hidden = fakeWeaponImage({ visible: false });
  renderer.update({ characterStage: 0, weaponStage: 3 }, fakeWeaponHero(hidden));
  assert.equal(renderer.weaponFlameRoot.visible, false);
  renderer.update({ characterStage: 0, weaponStage: 3 }, fakeWeaponHero(fakeWeaponImage()));
  assert.equal(renderer.weaponFlameRoot.visible, false, "no DOM / unreadable pixels: no flames, no exception");
});

test("Tint-based silhouette halos are WebGL-only; Canvas relies on the baked flame textures", () => {
  globalThis.Phaser = { CANVAS: 1, WEBGL: 2, BlendModes: { ADD: 1 } };
  try {
    const run = rendererType => {
      const { scene, root, made } = fakeFlameScene({ rendererType });
      const renderer = new EnhancementAuraRenderer(scene, root, () => 240);
      renderer.update({ characterStage: 0, weaponStage: 4 }, fakeWeaponHero(fakeWeaponImage()));
      return made.filter(o => o.type === "image" && o.key === "weapon-frame-1");
    };
    assert.equal(run(1).length, 0, "Canvas: no tinted halos");
    assert.equal(run(2).length, ENHANCEMENT_AURA_STYLES.powerFlame.intensity.weaponHaloCount, "WebGL: halos plus glow");
  } finally { delete globalThis.Phaser; }
});

// ---------- Ver 1.1.66: left shift, longer top, back layer, blade tip at the far end, Arena opponent, Inventory baseline ----------
test("Blade tip is the axis end FARTHEST from the Hero body (hilt stays near the body)", () => {
  const geometry = { mx: 200, my: 250, ux: 0.6, uy: -0.8, tmin: -100, tmax: 100, frameW: 400, frameH: 400 };
  const image = { x: 0, y: 0, angle: 0, originX: 0.5, originY: 1, displayWidth: 400, displayHeight: 400 };
  // axis points up-right; the body is up-right too => the lower-left end is the far one => flip
  const flipped = enhancementAuraOrientBlade(geometry, image, { x: 60, y: -300 });
  assert.equal(flipped.flipped, true);
  assert.ok(Math.abs(flipped.ux + 0.6) < 1e-9 && Math.abs(flipped.uy - 0.8) < 1e-9, "axis now points toward the real tip");
  assert.deepEqual([flipped.tmin, flipped.tmax], [-100, 100]);
  // body at the lower-left => the existing direction is already right
  assert.equal(enhancementAuraOrientBlade(geometry, image, { x: -200, y: 100 }), geometry);
  // the decision is made in the Hero root space, so the weapon image angle matters
  const rotated = enhancementAuraOrientBlade(geometry, { ...image, angle: 180 }, { x: 60, y: -300 });
  assert.notEqual(rotated.flipped, true);
});

test("Weapon tip flare is placed at the far end (away from the hilt) and shortened near the canvas bottom", () => {
  const size = 160;
  const rgba = new Uint8ClampedArray(size * size * 4);
  // blade from the upper-left (hilt) to the lower-right (tip), like the Owner's sword
  for (let y = 20; y < 150; y += 1) for (let x = 0; x < size; x += 1) if (Math.abs(x - (30 + (y - 20) * 0.9)) < 2.5) rgba[(y * size + x) * 4 + 3] = 255;
  stubBladeDom(rgba, size);
  try {
    const run = canvasHeight => {
      const { scene, root } = fakeFlameScene({ rendererType: 2 });
      scene.scale = { height: canvasHeight };
      root.getWorldTransformMatrix = () => ({ ty: 400, scaleY: 1 });
      const renderer = new EnhancementAuraRenderer(scene, root, () => 452);
      const weaponImage = fakeWeaponImage({ x: 0, y: 0, angle: 0 });
      renderer.update({ characterStage: 0, weaponStage: 3 }, fakeWeaponHero(weaponImage));
      const geometry = enhancementAuraOrientBlade([...renderer.bladeCache.values()][0], weaponImage, { x: -0.073 * 452, y: -0.425 * 452 });
      return { geometry, tip: renderer.weaponFlameParts.find(f => f.tip).outer };
    };
    const roomy = run(2000);
    assert.ok(roomy.geometry.uy > 0 && roomy.geometry.ux > 0, "the axis points down-right, away from the hilt");
    const radians = (roomy.tip.rot * Math.PI) / 180;
    assert.ok(Math.sin(radians) > 0 && Math.cos(radians) < 0, "the flare rotation points to the lower right");
    const natural = roomy.tip.sy * 256;
    const cramped = run(430);
    assert.ok(cramped.tip.sy * 256 < natural * 0.9, "flare is shortened when the canvas ends just below the tip");
    assert.ok(cramped.tip.sy * 256 >= natural * 0.2 - 1e-6, "but never collapses completely");
  } finally { delete globalThis.document; }
});

test("Arena opponent equipment (Worker snapshot shape) resolves an Aura with the same rules as the attacker", () => {
  const mapEquipment = equipment => {
    const mapped = {};
    equipment.forEach(item => { mapped[item.slotType] = { ...item, id: item.itemId, type: item.slotType }; });
    return mapped;
  };
  const gear = level => ["helmet", "chest", "gloves", "boots"].map(slotType => ({ itemId: slotType, slotType, enhanceLevel: level }));
  const opponent = mapEquipment([...gear(6), { itemId: "w", slotType: "weapon", enhanceLevel: 8 }]);
  assert.deepEqual(resolveEnhancementAura(opponent), { weaponLevel: 8, weaponStage: 3, characterLevel: 6, characterStage: 2 });
  assert.deepEqual(resolveEnhancementAura(mapEquipment(gear(3))), { weaponLevel: 0, weaponStage: 0, characterLevel: 3, characterStage: 0 });
  assert.equal(resolveEnhancementAura(mapEquipment([])).characterStage, 0, "bots/opponents without enhancement show no Aura");
});

test("Inventory preview places the Hero lower through an opt-in baseline; other surfaces keep 86%", () => {
  const scene = read("src/phaser/scenes/HeroPreviewScene.js");
  assert.match(scene, /baselineY = 0\.86/);
  assert.match(scene, /Math\.round\(height \* this\.baselineY\)/);
  assert.match(read("src/phaser/runtime/HeroPreviewHost.js"), /baselineY = 0\.86[\s\S]*baselineY,/);
  assert.match(read("src/phaser/ui/PhaserHeroPreview.js"), /baselineY = 0\.86[\s\S]*baselineY,[\s\S]*\[enabled, anchorX, baselineY\]/);
  assert.match(read("src/ui/components.js"), /anchorX:0\.558,\s*baselineY:0\.93/);
});

// ---------- Ver 1.1.66: Character Aura style C (jagged sheet + fill + glow + lightning), weapon lean ----------
const SIZE_C = 452;
function characterSheetRun(stage, options = {}) {
  const { scene, root, made } = fakeFlameScene(options);
  const renderer = new EnhancementAuraRenderer(scene, root, () => SIZE_C);
  renderer.update({ characterStage: stage, weaponStage: 0 }, NO_HERO);
  const graphics = made.filter(o => o.type === "graphics");
  return { renderer, root, made, sheet: graphics[0], bolts: graphics[1] };
}
const callsOf = (graphics, name) => graphics.calls.filter(c => c[0] === name);
const K = () => ENHANCEMENT_AURA_STYLES.powerFlame.intensity;
const ellipseValue = (x, y, rx, ry) => ((x - K().characterCenterX * SIZE_C) / (rx * SIZE_C)) ** 2 + ((y - K().characterCenterY * SIZE_C) / (ry * SIZE_C)) ** 2;

test("Character Aura is one jagged sheet with a background fill over the clear ellipse, nothing below the ground line", () => {
  const { sheet, bolts, made, root, renderer } = characterSheetRun(2);
  assert.ok(sheet && bolts, "one Graphics for the sheet and one for the lightning");
  assert.equal(made.filter(o => o.type === "image").length, 0, "no flame images for the Character Aura any more");
  const k = K();
  const fills = callsOf(sheet, "fillPoints");
  assert.ok(fills.length > 150, `sheet is built from many quads (${fills.length})`);
  const ground = k.characterGroundY * SIZE_C;
  const top = k.characterTopLimit * SIZE_C;

  // 1) first fill = the whole clear ellipse (background), never below the ground line
  const background = fills[0][1];
  const xs = background.map(p => p.x);
  assert.ok(Math.min(...xs) <= (k.characterCenterX - k.characterRadiusX) * SIZE_C + 1 && Math.max(...xs) >= (k.characterCenterX + k.characterRadiusX) * SIZE_C - 1, "fill spans the full width of the ellipse");
  background.forEach(p => assert.ok(ellipseValue(p.x, p.y, k.characterRadiusX, k.characterRadiusY) <= 1.02 || p.y === ground));

  // 2) every point of the sheet: not below the ground, not above the top limit, inside the outer limit
  fills.forEach(([, points]) => points.forEach(p => {
    assert.ok(p.y <= ground + 0.001, "nothing below the ground line");
    assert.ok(p.y >= top - 0.001, "nothing above the top limit");
    const outerRy = p.y < k.characterCenterY * SIZE_C ? k.characterOuterRadiusYTop : k.characterOuterRadiusY;
    assert.ok(ellipseValue(p.x, p.y, k.characterOuterRadiusX, outerRy) <= 1.001 || p.y === ground, "inside the outer limit");
  }));

  // 3) jagged layers (everything after the background) never enter the clear ellipse
  // (fill style #1 = background, #2 = rim band inside the ellipse, #3+ = the jagged layers outside it)
  let styleIndex = 0;
  const jaggedQuads = [];
  sheet.calls.forEach(c => { if (c[0] === "fillStyle") styleIndex += 1; else if (c[0] === "fillPoints" && styleIndex >= 3) jaggedQuads.push(c[1]); });
  assert.equal(styleIndex, 2 + k.characterLayers.length, "background, rim band and every jagged layer");
  const perLayer = fills[1] ? (K().characterSamples) : 0;
  assert.equal(jaggedQuads.length, k.characterLayers.length * perLayer, "every layer covers the full ring of samples (nothing skipped, the ellipse bottom is filled too)");
  const cx = k.characterCenterX * SIZE_C;
  const cy = k.characterCenterY * SIZE_C;
  k.characterLayers.forEach((layer, layerIndex) => {
    jaggedQuads.slice(layerIndex * perLayer, (layerIndex + 1) * perLayer).forEach(quad => {
      // quad = [start A, tip A, tip B, start B]; the start lies `layer.start` of the way from the centre to the ellipse edge
      [quad[0], quad[3]].forEach(point => {
        if (point.y >= ground - 0.001) return;
        assert.ok(Math.abs(ellipseValue(point.x, point.y, k.characterRadiusX, k.characterRadiusY) - layer.start ** 2) < 0.02, `layer ${layerIndex} starts at ${layer.start} of the ellipse radius`);
      });
      [quad[1], quad[2]].forEach(point => assert.ok(ellipseValue(point.x, point.y, k.characterRadiusX, k.characterRadiusY) >= 0.97 || point.y === ground, "tips reach the ellipse edge or beyond"));
    });
  });
  assert.equal(k.characterLayers[0].start, 0, "the largest layer starts at the centre: the Aura fills the whole clear ellipse");
  assert.ok(k.characterLayers.every((layer, i, list) => i === 0 || layer.start > list[i - 1].start), "inner layers start further out (dimmer middle, brighter rim)");
  assert.ok(Math.abs(jaggedQuads[0][0].x - cx) < 0.001 && Math.abs(jaggedQuads[0][0].y - cy) < 0.001, "first quad starts exactly at the ellipse centre");
  const tipTop = Math.min(...fills.flatMap(([, pts]) => pts.map(p => p.y))) / SIZE_C;
  assert.ok(tipTop < -0.86 && tipTop >= k.characterTopLimit - 0.002, `top ${tipTop.toFixed(3)} is taller than the 1.1.60 limit and inside the new one`);
  assert.ok(Math.abs((k.characterCenterX - -0.055) * 452 + 8) < 3, "about 8px left of the 1.1.60 position");

  // 4) bright outline with tips only; layer order = very back
  assert.ok(callsOf(sheet, "strokePoints").length >= 1);
  const last = root.moved[root.moved.length - 1];
  assert.equal(last[0], renderer.characterRoot);
  assert.equal(last[1], 0, "Character Aura stays behind every Hero layer");
});

test("Sheet shape and effect strength are identical for every stage; only the colours change", () => {
  const signatures = [];
  const colours = [];
  [1, 2, 3, 4].forEach(stage => {
    const { sheet } = characterSheetRun(stage);
    signatures.push(JSON.stringify(callsOf(sheet, "fillPoints").map(c => c[1].map(p => [Math.round(p.x), Math.round(p.y)]))));
    colours.push(callsOf(sheet, "fillStyle").map(c => c[1]).filter((v, i, a) => a.indexOf(v) === i).sort().join(","));
  });
  assert.equal(new Set(signatures).size, 1, "geometry never depends on the stage");
  assert.equal(new Set(colours).size, 4, "each stage has its own colours");
  const style = ENHANCEMENT_AURA_STYLES.powerFlame;
  [1, 2, 3, 4].forEach((stage, index) => assert.ok(colours[index].split(",").includes(String(style.palette[stage]))));
  assert.doesNotMatch(read("src/phaser/presentation/EnhancementAura.js"), /intensity\.\w+\[stage\]/);
});

test("WebGL glow is applied once per stage on the sheet and is optional (no postFX on Canvas)", () => {
  const withGlow = characterSheetRun(3, { glow: true });
  const glowCalls = withGlow.sheet.postFX.glowCalls;
  assert.equal(glowCalls.length, 1);
  assert.equal(glowCalls[0][0], ENHANCEMENT_AURA_STYLES.powerFlame.palette[3]);
  assert.equal(glowCalls[0][1], K().characterGlowStrength, "glow uses an absolute strength (not scaled by the body intensity)");
  withGlow.renderer.update({ characterStage: 3, weaponStage: 0 }, NO_HERO);
  assert.equal(glowCalls.length, 1, "unchanged stage does not add the effect again");
  withGlow.renderer.update({ characterStage: 4, weaponStage: 0 }, NO_HERO);
  assert.equal(glowCalls.length, 2);
  const withoutGlow = characterSheetRun(3, { glow: false });
  assert.ok(callsOf(withoutGlow.sheet, "fillPoints").length > 150, "still drawn without postFX");
});

test("Lightning is short, deterministic per step, re-rolled over time and stays above the ground line", () => {
  const { renderer, bolts } = characterSheetRun(4);
  const k = K();
  const ground = k.characterGroundY * SIZE_C;
  const top = k.characterTopLimit * SIZE_C;
  const signature = () => JSON.stringify(callsOf(bolts, "strokePoints").map(c => c[1].map(p => [Math.round(p.x), Math.round(p.y)])));
  const first = signature();
  const strokes = callsOf(bolts, "strokePoints");
  assert.ok(strokes.length >= 2 && strokes.length <= k.characterBoltCount * 2);
  strokes.forEach(([, points]) => {
    assert.ok(points.length >= 3 && points.length <= k.characterBoltSegments + 1);
    points.forEach(p => assert.ok(p.y <= ground && p.y >= top, "bolt stays between the top limit and the ground line"));
    assert.ok(ellipseValue(points[0].x, points[0].y, k.characterRadiusX, k.characterRadiusY) >= 0.97, "bolts start outside the clear ellipse");
  });
  renderer.flickerState.t = 2.4;
  renderer.animateFlames();
  assert.notEqual(signature(), first, "a later step draws different bolts");
  renderer.flickerState.t = 2.45;
  const again = signature();
  renderer.animateFlames();
  assert.equal(signature(), again, "within one step the bolts are not redrawn");
});

test("Sheet redraw is throttled by phase, loops seamlessly, and cleans up", () => {
  const { renderer, sheet, root } = characterSheetRun(1);
  const clears = () => callsOf(sheet, "clear").length;
  const start = clears();
  renderer.flickerState.t = renderer.lastSheetPhase + 0.05;
  renderer.animateFlames();
  assert.equal(clears(), start, "small phase change: no redraw");
  renderer.flickerState.t = renderer.lastSheetPhase + 0.2;
  renderer.animateFlames();
  assert.equal(clears(), start + 1, "a full step redraws once");
  const wrap = renderer.characterTooth(renderer.characterGeom.samples[0], 0);
  const wrapEnd = renderer.characterTooth(renderer.characterGeom.samples[renderer.characterGeom.samples.length - 1], 0);
  assert.ok(Math.abs(wrap - wrapEnd) < 1e-9, "no seam where the outline closes");
  assert.ok(Math.abs(renderer.characterTooth(renderer.characterGeom.samples[10], 0) - renderer.characterTooth(renderer.characterGeom.samples[10], Math.PI * 2)) < 1e-9, "the animation loops seamlessly");
  renderer.update({ characterStage: 0, weaponStage: 0 }, NO_HERO);
  assert.equal(renderer.characterRoot.visible, false);
  assert.equal(renderer.characterGeom, null);
  const rootRef = renderer.characterRoot;
  renderer.destroy();
  assert.equal(rootRef.calls.some(c => c[0] === "destroy"), true);
  assert.equal(renderer.characterSheet, null);
  assert.equal(renderer.characterBolts, null);
  renderer.update({ characterStage: 4, weaponStage: 0 }, NO_HERO);
});

test("Weapon: side flames lean back toward the hilt while the tip flare points away from the tip", () => {
  const size = 160;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 20; y < 150; y += 1) for (let x = 0; x < size; x += 1) if (Math.abs(x - (30 + (y - 20) * 0.9)) < 2.5) rgba[(y * size + x) * 4 + 3] = 255;
  stubBladeDom(rgba, size);
  try {
    const { scene, root } = fakeFlameScene({ rendererType: 2 });
    const renderer = new EnhancementAuraRenderer(scene, root, () => 452);
    const weaponImage = fakeWeaponImage({ x: 0, y: 0, angle: 0 });
    renderer.update({ characterStage: 0, weaponStage: 3 }, fakeWeaponHero(weaponImage));
    const axis = enhancementAuraOrientBlade([...renderer.bladeCache.values()][0], weaponImage, { x: -0.073 * 452, y: -0.425 * 452 });
    assert.ok(axis.ux > 0 && axis.uy > 0, "the tip is the lower-right end, away from the body");
    const direction = flame => ({ x: Math.sin((flame.outer.rot * Math.PI) / 180), y: -Math.cos((flame.outer.rot * Math.PI) / 180) });
    const dot = flame => direction(flame).x * axis.ux + direction(flame).y * axis.uy;
    const parts = renderer.weaponFlameParts;
    const side = parts.filter(f => !f.tip);
    assert.ok(side.length >= 8);
    side.forEach(f => assert.ok(dot(f) < -0.2, `side flame leans toward the hilt (dot ${dot(f).toFixed(2)})`));
    assert.ok(dot(parts.find(f => f.tip)) > 0.95, "the tip flare points straight out of the blade tip");
  } finally { delete globalThis.document; }
});

// ---------- Ver 1.1.66: Character Aura at half strength ----------
test("Character Aura body strength is one calibrated knob; outline, lightning and glow use absolute values", () => {
  const k = K();
  assert.equal(k.characterIntensity, 0.2, "calibrated against the Owner's phone screenshot (true additive blend, Ver 1.1.66)");
  const { sheet, bolts } = characterSheetRun(3, { glow: true });
  const alphas = callsOf(sheet, "fillStyle").map(c => c[2]);
  const expected = [k.characterFillAlpha, k.characterFillEdgeAlpha, ...k.characterLayers.map(layer => layer.alpha)].map(value => value * k.characterIntensity);
  assert.equal(alphas.length, expected.length);
  expected.forEach((value, index) => assert.ok(Math.abs(alphas[index] - value) < 1e-9, `body fill #${index + 1} alpha ${alphas[index]} = ${value}`));
  assert.equal(callsOf(sheet, "lineStyle")[0][3], k.characterOutlineAlpha, "outline alpha is absolute");
  const boltAlphas = callsOf(bolts, "lineStyle").map(c => c[3]);
  assert.ok(boltAlphas.length >= 2);
  boltAlphas.forEach((alpha, index) => assert.equal(alpha, index % 2 === 0 ? k.characterBoltAlpha : k.characterBoltCoreAlpha, "lightning alphas are absolute"));
  assert.equal(sheet.postFX.glowCalls[0][1], k.characterGlowStrength, "glow strength is absolute");
});


// ---------- Ver 1.1.66: true additive blend on transparent canvases ----------
test("Aura uses a registered (ONE, ONE) additive blend because Phaser's ADD is (ONE, DST_ALPHA)", () => {
  const registered = [];
  const gl = { ONE: 1, FUNC_ADD: 32774 };
  const renderer = { gl, addBlendMode(func, equation) { registered.push([func, equation]); return 28 + registered.length - 1; } };
  const { scene, root, made } = fakeFlameScene({ glow: true });
  scene.sys = { game: { renderer } };
  const renderer1 = new EnhancementAuraRenderer(scene, root, () => SIZE_C);
  renderer1.update({ characterStage: 2, weaponStage: 0 }, NO_HERO);
  assert.equal(registered.length, 1, "registered once per renderer, not per object");
  assert.deepEqual(registered[0], [[1, 1], 32774]);
  const blends = made.filter(o => o.type === "graphics").map(o => o.calls.find(c => c[0] === "setBlendMode")[1]);
  assert.deepEqual(blends, [28, 28], "sheet and lightning use the registered mode");
  // a second Aura renderer on the same game reuses it
  const second = new EnhancementAuraRenderer(scene, root, () => SIZE_C);
  second.update({ characterStage: 3, weaponStage: 0 }, NO_HERO);
  assert.equal(registered.length, 1);
  // flames and halos use it too
  const size = 160;
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let y = 20; y < 150; y += 1) for (let x = 0; x < size; x += 1) if (Math.abs(x - (30 + (y - 20) * 0.9)) < 2.5) rgba[(y * size + x) * 4 + 3] = 255;
  stubBladeDom(rgba, size);
  try {
    const weapon = fakeFlameScene({ rendererType: 2 });
    weapon.scene.sys.game.renderer.gl = gl;
    weapon.scene.sys.game.renderer.addBlendMode = () => 28;
    const weaponRenderer = new EnhancementAuraRenderer(weapon.scene, weapon.root, () => 452);
    weaponRenderer.update({ characterStage: 0, weaponStage: 3 }, fakeWeaponHero(fakeWeaponImage()));
    const images = weapon.made.filter(o => o.type === "image" && (String(o.key).startsWith("enhancement-aura-flame") || o.key === "weapon-frame-1"));
    assert.ok(images.length >= 20);
    images.forEach(o => assert.equal(o.calls.find(c => c[0] === "setBlendMode")[1], 28, `${o.key} uses the true additive blend`));
  } finally { delete globalThis.document; }
});

test("Without a WebGL renderer the built-in additive mode is used (Canvas 'lighter' is already correct)", () => {
  const { scene, root, made } = fakeFlameScene();
  const renderer = new EnhancementAuraRenderer(scene, root, () => SIZE_C);
  renderer.update({ characterStage: 2, weaponStage: 0 }, NO_HERO);
  made.filter(o => o.type === "graphics").forEach(o => assert.equal(o.calls.find(c => c[0] === "setBlendMode")[1], 1));
  assert.match(read("src/phaser/presentation/EnhancementAura.js"), /blendFunc\(ONE, DST_ALPHA\)/, "the reason is documented next to the helper");
});
