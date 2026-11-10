const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  enhancementAuraItemLevel,
  enhancementAuraStage,
  resolveEnhancementAura
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


test("Aura runtime failures are routed to the shared diagnostic catcher with safe context", () => {
  const catcher = read("src/systems/battleErrorCatcher.js");
  const actor = read("src/phaser/actors/HeroActor.js");
  const preview = read("src/phaser/scenes/HeroPreviewScene.js");
  const bridge = read("src/phaser/presentation/EventBridge.js");
  assert.match(catcher, /captureAura\\(/);
  assert.match(catcher, /event: "enhancement_aura_failed"/);
  assert.match(catcher, /system: "phaser_presentation"/);
  assert.match(actor, /BATTLE_ERROR_CATCHER\\?\\.setEnabled\\(true\\)/);
  assert.match(actor, /phase: "renderer_update"/);
  assert.match(actor, /phase: "renderer_init"/);
  assert.match(preview, /surface: "inventory"/);
  assert.match(preview, /phase: "renderer_update"/);
  assert.match(bridge, /presentationSurface: "dungeon"/);
  assert.match(bridge, /presentationSurface: "arena"/);
  assert.match(bridge, /presentationSurface: "inventory"/);
});
