const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const source = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const FRAME_IDS = ["idle_01","idle_02","idle_03","attack_01","attack_02","attack_03","death_01","death_02"];

function v5Config() {
  const frames = Object.fromEntries(FRAME_IDS.map(id => [id, {
    coverage_underlay:`azure/${id}/coverage_underlay.png`,
    torso_armor:`azure/${id}/torso_armor.png`,
    legs_boots:`azure/${id}/legs_boots.png`,
    arm_rear:`azure/${id}/arm_rear.png`,
    helmet:`azure/${id}/helmet.png`,
    sword:`azure/${id}/sword.png`,
    arm_front:`azure/${id}/arm_front.png`
  }]));
  return {
    approval:"approved",
    canvas:{ width:768, height:768 },
    base:{
      approval:"approved",
      frames:Object.fromEntries(FRAME_IDS.map(id => [id,`base/${id}.png`]))
    },
    defaultHair:"topknot",
    hair:{
      topknot:{
        approval:"approved",
        frames:Object.fromEntries(FRAME_IDS.map(id => [id,{
          hair_back:`hair/${id}/back.png`,
          hair_front:`hair/${id}/front.png`
        }]))
      }
    },
    wingTemplate:{
      frames:Object.fromEntries(FRAME_IDS.map(id => [id,{
        wing_far:`wings/${id}/far.png`,
        wing_near:`wings/${id}/near.png`
      }]))
    },
    equipment:{ azure:{ approval:"approved", frames } }
  };
}

function runContract(config, expression) {
  const context = { ASSETS:{ hero001:{ v5:{ g2:config } } } };
  vm.createContext(context);
  vm.runInContext(source("src/phaser/presentation/HeroV5RuntimeContract.js"), context);
  return vm.runInContext(expression, context);
}

test("Azure full-face helmet hides hair in all frames and restores it on removal or bundle fallback", () => {
  const config = v5Config();
  config.equipment.azure.fullFaceHelmet = true;
  const resolve = equipped => runContract(config, `resolveHeroV5BaseWingContract({equipmentSelection:{azure:{helmet:${equipped}}}})`);
  const assertHair = (result, visible) => {
    for (const state of ["idle", "attack", "death"]) {
      for (const frame of result[state]) {
        const names = Array.from(frame, layer => layer.name);
        assert.equal(names.includes("hair_back"), visible);
        assert.equal(names.includes("hair_front"), visible);
      }
    }
  };
  assertHair(resolve(true), false);
  assertHair(resolve(false), true);
  config.equipment.azure.fullFaceHelmet = false;
  assertHair(resolve(true), true);
  config.equipment.azure.fullFaceHelmet = true;
  delete config.equipment.azure.frames.death_01.helmet;
  const fallback = resolve(true);
  assert.ok(Array.from(fallback.visualFallbacks).includes("helmet"));
  assertHair(fallback, true);
});

test("W8 incomplete equipment bundle falls back only that slot while Hero V5 stays active", () => {
  const config = v5Config();
  delete config.equipment.azure.frames.attack_02.sword;
  const result = runContract(config, `resolveHeroV5BaseWingContract({
    equipmentSelection:{ wings:null, azure:{ helmet:true, chest:false, gloves:false, boots:false, weapon:true } }
  })`);
  assert.ok(result);
  assert.equal(result.mode, "v5-g2-azure");
  assert.ok(Array.from(result.visualFallbacks).includes("weapon"));
  for (const state of ["idle","attack","death"]) {
    for (const frame of result[state]) {
      const names = Array.from(frame, layer => layer.name);
      assert.ok(names.includes("base"));
      assert.ok(names.includes("helmet"));
      assert.ok(!names.includes("sword"));
    }
  }
});

test("W8 incomplete wing bundle becomes no-wings without whole-actor fallback", () => {
  const config = v5Config();
  delete config.wingTemplate.frames.death_02.wing_near;
  const result = runContract(config, `resolveHeroV5BaseWingContract({
    includeWings:true,
    equipmentSelection:{ wings:"angel", azure:{} }
  })`);
  assert.ok(result);
  assert.equal(result.mode, "v5-g2");
  assert.ok(Array.from(result.visualFallbacks).includes("wings"));
  for (const state of ["idle","attack","death"]) {
    for (const frame of result[state]) {
      const names = Array.from(frame, layer => layer.name);
      assert.ok(names.includes("base"));
      assert.ok(!names.includes("wing_far"));
      assert.ok(!names.includes("wing_near"));
    }
  }
});

test("W8 missing Hero V5 core frame still triggers whole-actor fallback boundary", () => {
  const config = v5Config();
  delete config.base.frames.attack_02;
  const result = runContract(config, `resolveHeroV5BaseWingContract({
    equipmentSelection:{ wings:null, azure:{ helmet:true } }
  })`);
  assert.equal(result, null);
});

test("W8 preview state is derived from authoritative equipment without replacing slot UI authority", () => {
  const components = source("src/ui/components.js");
  const inventory = components.slice(components.indexOf("function InventoryOverlayV2"), components.indexOf("function InventoryOverlay({"));
  const stage = components.slice(components.indexOf("function EquipmentStage"), components.indexOf("function InventoryToolbar"));
  assert.match(inventory, /const previewEquipped = previewSlot \? \{ \.\.\.equipped, \[previewSlot\]: currentDetail \} : equipped/);
  assert.match(inventory, /EquipmentStage, \{ equipped, previewEquipped/);
  assert.match(stage, /item: equipped\[slot\]/);
  assert.match(stage, /equipped:previewEquipped/);
  assert.match(stage, /PhaserHeroPreview/);
});

test("W8 Compare remains DOM, keeps the Hero stage visible, and excludes Character Status", () => {
  const components = source("src/ui/components.js");
  const styles = source("src/data/styles.js");
  const compare = components.slice(components.indexOf("function ItemComparison"), components.indexOf("function ItemActions"));
  const detail = components.slice(components.indexOf("function ItemDetailModal"), components.indexOf("function InventoryOverlayV2"));
  const status = components.slice(components.indexOf("function StatusScreen"), components.indexOf("function SkillScreen"));
  assert.match(compare, /md-inv2-compare/);
  assert.doesNotMatch(compare, /Phaser/);
  assert.match(detail, /md-inv2-modal-layer md-inv2-detail-layer/);
  assert.match(styles, /\.md-inv2-detail-layer \{[^}]*align-items:flex-end/);
  assert.match(styles, /\.md-inv2-detail-layer \.md-inv2-detail \{[^}]*max-height:min\(54dvh,540px\)/);
  assert.doesNotMatch(status, /isPhaserHeroPreviewEnabled\(\)|PhaserHeroPreview/);
});

test("W8 Inventory Phaser host fills the equipment stage while equip slots remain above it", () => {
  const styles = source("src/data/styles.js");
  assert.match(styles, /\.md-inv2-hero \{[^}]*z-index:1;[^}]*inset:0;[^}]*width:100%;[^}]*height:100%/);
  assert.match(styles, /\.md-inv2-slots \{[^}]*z-index:2/);
  const narrow = styles.slice(styles.indexOf("@media (max-width:380px)"), styles.indexOf("/* ---- manifest-backed item icons ---- */"));
  assert.match(narrow, /\.md-inv2-hero \{[^}]*inset:0;[^}]*width:100%;[^}]*height:100%;[^}]*transform:none/);
  assert.doesNotMatch(narrow, /\.md-inv2-hero \{[^}]*width:140px/);
});

test("W8 production Hero V5 manifest includes complete idle wings for the Inventory preview", () => {
  const manifest = JSON.parse(source("r2-upload/manifest.json"));
  const context = { ASSETS: manifest.assets };
  vm.createContext(context);
  vm.runInContext(source("src/phaser/presentation/HeroV5RuntimeContract.js"), context);
  const result = vm.runInContext(`resolveHeroV5BaseWingContract({
    includeWings:true,
    equipmentSelection:{ wings:"angel", azure:{} }
  })`, context);
  assert.ok(result);
  assert.equal(result.visualFallbacks.includes("wings"), false);
  assert.equal(result.idle.length, 3);
  result.idle.forEach(frame => {
    const names = Array.from(frame, layer => layer.name);
    assert.ok(names.includes("wing_far"));
    assert.ok(names.includes("wing_near"));
  });
});

test("W8 Hero preview host waits for a real DOM size before creating Phaser", () => {
  const host = source("src/phaser/runtime/HeroPreviewHost.js");
  assert.match(host, /async function waitForHostSize\(\)/);
  assert.match(host, /measured\.width >= 32 && measured\.height >= 32/);
  assert.match(host, /const \{ width, height \} = await waitForHostSize\(\)/);
  assert.match(host, /scene\?\.handleResize\?\.\(\{ width, height \}\)/);
});

test("W8 Inventory uses the final 55.8% horizontal Hero anchor without changing the shared default", () => {
  const scene = source("src/phaser/scenes/HeroPreviewScene.js");
  const host = source("src/phaser/runtime/HeroPreviewHost.js");
  const ui = source("src/phaser/ui/PhaserHeroPreview.js");
  const components = source("src/ui/components.js");
  assert.match(scene, /anchorX = 0\.5/);
  assert.match(scene, /width \* this\.anchorX/);
  assert.match(host, /anchorX = 0\.5/);
  assert.match(ui, /anchorX = 0\.5/);
  const stage = components.slice(components.indexOf("function EquipmentStage"), components.indexOf("function InventoryToolbar"));
  assert.match(stage, /anchorX:0\.558/);
});

test("Arena Hub R1 integration bumps the production preview version badge", () => {
  const styles = source("src/data/styles.js");
  assert.match(styles, /content: "Ver 1\.0\.37"/);
});

test("W8 Inventory Hero preview is production-default with an explicit opt-out", () => {
  const ui = source("src/phaser/ui/PhaserHeroPreview.js");
  const build = source("build.js");
  assert.match(ui, /get\("phaserPreview"\)/);
  assert.match(ui, /return value !== "0"/);
  assert.match(ui, /return true;/);
  assert.match(ui, /buildHeroPreviewSnapshot\(\{ heroName, equipped, heroV5: true \}\)/);
  const sceneIndex = build.indexOf('"phaser/scenes/HeroPreviewScene.js"');
  const hostIndex = build.indexOf('"phaser/runtime/HeroPreviewHost.js"');
  const uiIndex = build.indexOf('"phaser/ui/PhaserHeroPreview.js"');
  const appIndex = build.indexOf('"ui/App.js"');
  assert.ok(sceneIndex > 0 && hostIndex > sceneIndex && uiIndex > hostIndex && appIndex > uiIndex);
});

test("W8 wing preview reuses the canonical production equipment visual selection", () => {
  const resolver = source("src/phaser/presentation/EquipmentVisualResolver.js");
  const context = { heroVisualSelectionFromEquipment: equipped => ({ wings: equipped?.wings ? "angel" : null }) };
  vm.createContext(context);
  vm.runInContext(`${resolver};
    this.equippedWing = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroV5Selection({
      wings: { id:"runtime-wing-item", type:"wings" }
    });
    this.noWing = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroV5Selection({ wings:null });`, context);
  assert.equal(context.equippedWing.wings, "angel");
  assert.equal(context.noWing.wings, null);
  assert.match(resolver, /legacySelection\?\.wings === "angel" \? "angel"/);
  assert.doesNotMatch(resolver, /equipped\?\.wings \? "angel" : null/);
});

test("W8 preview scene keeps optional texture failures presentation-local", () => {
  const scene = source("src/phaser/scenes/HeroPreviewScene.js");
  assert.match(scene, /failedLayerNames/);
  assert.match(scene, /heroPreviewFallbackLayerNames/);
  assert.match(scene, /if \(failedLayerNames\.has\("base"\)\) return null/);
  assert.match(scene, /this\.failedUrls\.has\(url\)/);
});
