const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const FRAME_IDS = ["idle_01", "idle_02", "idle_03", "attack_01", "attack_02", "attack_03", "death_01", "death_02"];
const LAYERS = ["coverage_underlay", "torso_armor", "legs_boots", "arm_rear", "helmet", "sword", "arm_front"];

function runtimeContext() {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "r2-upload/manifest.json"), "utf8"));
  const context = { ASSETS: manifest.assets, console };
  vm.createContext(context);
  for (const file of ["EquipmentVisualResolver.js", "HeroV5RuntimeContract.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, "src/phaser/presentation", file), "utf8"), context);
  }
  return { context, manifest };
}

function pngHeader(buffer) {
  assert.deepEqual(Array.from(buffer.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer[25]
  };
}

test("Skeleton production bundle is complete, RGBA 768, and hash-exact", () => {
  const { manifest } = runtimeContext();
  const skeleton = manifest.assets.hero001.v5.g2.equipment.skeleton;
  const validation = JSON.parse(fs.readFileSync(path.join(ROOT, "r2-upload/hero/v5/g2/equipment/skeleton/SOURCE_VALIDATION.json"), "utf8"));
  assert.equal(skeleton.approval, "approved");
  assert.equal(skeleton.runtimeIntegrated, true);
  assert.equal(skeleton.itemBinding, "setId:skeleton");
  assert.equal(Object.keys(validation.sha256).filter(assetPath => /\/(?:idle|attack|death)_\d{2}\//.test(assetPath)).length, 56);

  for (const frameId of FRAME_IDS) {
    assert.deepEqual(Object.keys(skeleton.frames[frameId]), LAYERS);
    for (const layer of LAYERS) {
      const assetPath = skeleton.frames[frameId][layer].split("?")[0];
      const bytes = fs.readFileSync(path.join(ROOT, "r2-upload", assetPath));
      assert.deepEqual(pngHeader(bytes), { width: 768, height: 768, colorType: 6 });
      assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), validation.sha256[assetPath]);
    }
  }
});

test("mixed equipment renders only the visual family actually equipped in each slot", () => {
  const { context } = runtimeContext();
  const selection = vm.runInContext(`resolveHeroV5EquipmentSelection({
    helmet:{setId:"azure"}, chest:{setId:"skeleton"},
    gloves:{setId:"common"}, boots:{},
    weapon:{bossWeaponId:"lavalon_sword"}, wings:{id:"angel_wings"}
  }, {})`, context);
  const resolved = vm.runInContext(`resolveHeroV5BaseWingContract({equipmentSelection:${JSON.stringify(selection)}})`, context);
  const paths = Array.from(resolved.idle[0], layer => String(layer.path));

  assert.equal(resolved.mode, "v5-g2-lavalonSword");
  assert.ok(paths.some(value => value.includes("/equipment/skeleton/") && value.split("?")[0].endsWith("/torso_armor.png")));
  assert.ok(paths.some(value => value.includes("/equipment/azure/") && value.includes("helmet.png")));
  assert.ok(paths.some(value => value.includes("/weapons/lavalon_sword/")));
  assert.ok(paths.some(value => value.includes("/wings/")));
  assert.ok(!paths.some(value => value.includes("/equipment/skeleton/") && /(?:arm_|legs_boots)/.test(value)));
  assert.ok(!paths.some(value => value.includes("coverage_underlay")));
});

test("a complete Skeleton set resolves all seven ordered layers without fallback", () => {
  const { context } = runtimeContext();
  const selection = vm.runInContext(`resolveHeroV5EquipmentSelection({
    helmet:{setId:"skeleton"}, chest:{setId:"skeleton"}, gloves:{setId:"skeleton"},
    boots:{setId:"skeleton"}, weapon:{setId:"skeleton"}
  }, {})`, context);
  const resolved = vm.runInContext(`resolveHeroV5BaseWingContract({equipmentSelection:${JSON.stringify(selection)}})`, context);
  assert.equal(resolved.mode, "v5-g2-skeleton");
  assert.deepEqual(Array.from(resolved.visualFallbacks), []);
  for (const state of ["idle", "attack", "death"]) {
    for (const frame of resolved[state]) {
      const skeletonLayers = Array.from(frame)
        .filter(layer => String(layer.path).includes("/equipment/skeleton/"))
        .map(layer => layer.name);
      assert.deepEqual(skeletonLayers, LAYERS);
    }
  }
});

test("Inventory preview preserves revised Skeleton idle URLs through the asset resolver", () => {
  const { context } = runtimeContext();
  for (const file of ["src/assets/loader.js", "src/phaser/assets/AssetResolver.js", "src/phaser/presentation/EventBridge.js", "src/phaser/assets/TextureRegistry.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context);
  }
  const snapshot = vm.runInContext(`buildHeroPreviewSnapshot({equipped:{
    helmet:{setId:"azure"},chest:{setId:"skeleton"},gloves:{setId:"common"},boots:{}
  }})`, context);
  snapshot.hero.layerFrames.idle.forEach((layers, index) => {
    const chest = layers.find(layer => layer.name === "torso_armor");
    assert.equal(chest.url, `/assets/hero/v5/g2/equipment/skeleton/idle_0${index + 1}/torso_armor.png?v=skeleton_idle_r07_20261029`);
    assert.ok(!layers.some(layer => ["coverage_underlay", "legs_boots", "arm_rear", "arm_front"].includes(layer.name)));
    const oldUrl = chest.url.split("?")[0];
    const keys = vm.runInContext(`[
      phaserTextureKeyForUrl(${JSON.stringify(oldUrl)}),
      phaserTextureKeyForUrl(${JSON.stringify(chest.url)})
    ]`, context);
    assert.notEqual(keys[0], keys[1]);
  });
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "r2-upload/manifest.json"))).assets.hero001.v5.g2.equipment.skeleton;
  for (const frameId of FRAME_IDS) for (const layer of LAYERS) {
    const revised = frameId.startsWith("idle_") && ["helmet", "torso_armor", "arm_rear", "legs_boots"].includes(layer);
    assert.equal(config.frames[frameId][layer].includes("?v=skeleton_idle_r07_20261029"), revised);
  }
});
