const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  enhancementAuraItemLevel,
  enhancementAuraStage,
  enhancementAuraBladeGeometry,
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
function fakeFlameScene({ rendererType } = {}) {
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
    add: { container: () => mk("container"), image: (x, y, key) => mk("image", { key }), text: () => mk("text") },
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

test("Effect intensity is identical for every stage; only the baked colour texture changes", () => {
  const source = read("src/phaser/presentation/EnhancementAura.js");
  assert.doesNotMatch(source, /intensity\.\w+\[stage\]/);
  assert.match(source, /this\.style\.palette\[stage\]/);
  const { scene, root, made } = fakeFlameScene();
  const renderer = new EnhancementAuraRenderer(scene, root, () => 200);
  const perStage = [];
  [1, 2, 3, 4].forEach(stage => {
    renderer.update({ characterStage: stage, weaponStage: 0 }, NO_HERO);
    const flames = renderer.characterFlames;
    perStage.push({
      count: flames.length,
      shape: flames.map(f => [Math.round(f.sx * 1000), Math.round(f.sy * 1000), f.rot, f.alpha].join(":")).join("|"),
      keys: new Set(flameImages(made).slice(-flames.length).map(o => o.key))
    });
  });
  assert.equal(new Set(perStage.map(p => p.count)).size, 1);
  assert.equal(new Set(perStage.map(p => p.shape)).size, 1, "sizes, angles and alphas never depend on the stage");
  const allKeys = perStage.flatMap(p => [...p.keys]);
  assert.equal(new Set(allKeys).size, 8, "4 stages x (outer + core) distinct baked textures");
});

test("Character Aura is a flame ring OUTSIDE the clear Hero ellipse, with nothing below the ground line", () => {
  const { scene, root, made } = fakeFlameScene();
  const SIZE = 452;
  const renderer = new EnhancementAuraRenderer(scene, root, () => SIZE);
  renderer.update({ characterStage: 2, weaponStage: 0 }, NO_HERO);
  const k = ENHANCEMENT_AURA_STYLES.powerFlame.intensity;
  assert.equal(made.some(o => o.type === "graphics" || o.type === "circle"), false, "no rings, ground glow or orbit particles");
  assert.equal(renderer.characterRoot.visible, true);
  assert.equal(renderer.characterFlames.length % 2, 0);

  const outer = renderer.characterFlames.filter(f => String(f.obj.key).includes("-outer-"));
  assert.ok(outer.length >= 16 && outer.length <= k.characterFlameCount, `flame count ${outer.length}`);
  const cx = k.characterCenterX * SIZE;
  const cy = k.characterCenterY * SIZE;
  const ground = k.characterGroundY * SIZE;
  const inside = (x, y, rx, ry) => ((x - cx) / (rx * SIZE)) ** 2 + ((y - cy) / (ry * SIZE)) ** 2;
  outer.forEach(f => {
    const height = f.sy * 256;
    const radians = (f.rot * Math.PI) / 180;
    const base = { x: f.obj.x, y: f.obj.y };
    const tip = { x: base.x + Math.sin(radians) * height, y: base.y - Math.cos(radians) * height };
    assert.ok(inside(base.x, base.y, k.characterRadiusX, k.characterRadiusY) >= 0.98, "flame bases never enter the clear ellipse");
    assert.ok(inside(tip.x, tip.y, k.characterRadiusX, k.characterRadiusY) >= 1, "tips are outside the clear ellipse");
    assert.ok(inside(tip.x, tip.y, k.characterOuterRadiusX * 1.05, k.characterOuterRadiusY * 1.05) <= 1.001, "tips stay inside the outer limit");
    assert.ok(base.y <= ground && tip.y <= ground, "no Aura below the ground line");
    assert.ok(tip.y >= k.characterTopLimit * SIZE - 1, "tips stay inside the Hero preview canvas");
  });
  assert.ok(outer.some(f => f.obj.x < cx - 0.2 * SIZE) && outer.some(f => f.obj.x > cx + 0.2 * SIZE), "ring on both sides");
  assert.ok(outer.some(f => f.obj.y < cy - 0.3 * SIZE), "ring above the head");
  const last = root.moved[root.moved.length - 1][0];
  assert.equal(last, renderer.characterRoot, "Character Aura is raised to the very top after each frame");
  renderer.update({ characterStage: 0, weaponStage: 0 }, NO_HERO);
  assert.equal(renderer.characterFlames.length, 0);
  assert.equal(renderer.characterRoot.visible, false);
});

test("Flame colours are baked into textures, never applied with setTint (Canvas ignores tint)", () => {
  const { scene, root, made, textures } = fakeFlameScene();
  const renderer = new EnhancementAuraRenderer(scene, root, () => 200);
  renderer.update({ characterStage: 3, weaponStage: 0 }, NO_HERO);
  assert.equal(textures.size, 2, "outer and core textures");
  renderer.characterStage = -1;
  renderer.update({ characterStage: 3, weaponStage: 0 }, NO_HERO);
  assert.equal(textures.size, 2, "textures are reused, not recreated");
  flameImages(made).forEach(o => assert.equal(o.calls.some(c => c[0] === "setTint"), false));
});

test("Flame animation is one shared driver tween that is stopped on destroy", () => {
  const { scene, root, made } = fakeFlameScene();
  const renderer = new EnhancementAuraRenderer(scene, root, () => 200);
  renderer.update({ characterStage: 4, weaponStage: 0 }, NO_HERO);
  renderer.update({ characterStage: 4, weaponStage: 0 }, NO_HERO);
  const tweens = made.filter(o => o.type === "tween");
  assert.equal(tweens.length, 1, "one driver for all flames");
  const before = renderer.characterFlames[0].obj.calls.length;
  renderer.flickerState.t = 1.3;
  renderer.animateFlames();
  assert.ok(renderer.characterFlames[0].obj.calls.length > before);
  const rootRef = renderer.characterRoot;
  renderer.destroy();
  assert.equal(tweens[0].tween.stopped, true);
  assert.equal(rootRef.calls.some(c => c[0] === "destroy"), true);
  assert.equal(renderer.scene, null);
  renderer.update({ characterStage: 4, weaponStage: 0 }, NO_HERO);
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
