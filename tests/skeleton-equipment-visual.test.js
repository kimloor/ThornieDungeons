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

test("mixed Inventory pants use revised Leather/Azure URLs and retain the hand-only crop", () => {
  const { context } = runtimeContext();
  for (const file of ["src/assets/loader.js", "src/phaser/assets/AssetResolver.js", "src/phaser/presentation/EventBridge.js", "src/phaser/assets/TextureRegistry.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), "utf8"), context);
  }
  for (const boots of [{gearTier:1}, {setId:"azure"}]) {
    context.boots = boots;
    const snapshot = vm.runInContext('buildHeroPreviewSnapshot({equipped:{chest:{setId:"skeleton"},boots,weapon:{gearTier:1}}})', context);
    snapshot.hero.layerFrames.idle.forEach(layers => {
      const legs = layers.find(layer => layer.name === "legs_boots");
      assert.ok(legs.url.endsWith("?v=idle_equipment_20261029_r2"));
      const hand = layers.find(layer => layer.name === "right_hand_occlusion");
      assert.deepEqual(Array.from(hand.crop).filter((_,i)=>i===0||i===2), [244,48]);
      const keys = vm.runInContext(`[
        phaserTextureKeyForUrl(${JSON.stringify(legs.url.split("?")[0])}),
        phaserTextureKeyForUrl(${JSON.stringify(legs.url)})
      ]`, context);
      assert.notEqual(keys[0], keys[1]);
    });
  }
});

test("Owner mixed Azure boots / Skeleton chest and gloves include the missing upper pants", () => {
  const {context}=runtimeContext();
  for(const file of ["src/assets/loader.js","src/phaser/assets/AssetResolver.js","src/phaser/presentation/EventBridge.js"]){
    vm.runInContext(fs.readFileSync(path.join(ROOT,file),"utf8"),context);
  }
  const snapshot=vm.runInContext('buildHeroPreviewSnapshot({equipped:{helmet:{setId:"azure"},chest:{setId:"skeleton"},gloves:{setId:"skeleton"},boots:{setId:"azure"},weapon:{gearTier:1}}})',context);
  const frames=snapshot.hero.layerFrames.idle;
  frames.forEach((layers,i)=>{
    const waist=layers.find(l=>l.name==="legs_waist");
    assert.match(waist.url,/\/azure\/idle_0[123]\/torso_armor.png$/);
    assert.deepEqual(Array.from(waist.crop),[0,[490,478,486][i],768,32]);
    assert.ok(layers.indexOf(waist)<layers.findIndex(l=>l.name==="torso_armor"));
    assert.ok(!layers.some(l=>l.name==="right_hand_occlusion"));
  });
  const {spawnSync}=require("node:child_process");
  const check=spawnSync("python3",["-c",String.raw`
import sys,json
from PIL import Image
p=json.load(sys.stdin)
for i,layers in enumerate(p['frames']):
    out=Image.new('RGBA',(768,768)); old=out.copy()
    for l in layers:
        im=Image.open(p['root']+'/r2-upload/'+l['url'].removeprefix('/assets/').split('?')[0]).convert('RGBA')
        if l.get('crop'):
            x,y,w,h=l['crop']; clipped=Image.new('RGBA',im.size);clipped.paste(im.crop((x,y,x+w,y+h)),(x,y));im=clipped
        out=Image.alpha_composite(out,im)
        if l['name']!='legs_waist':old=Image.alpha_composite(old,im)
    point=(350,[500,488,496][i])
    base=Image.open(p['root']+'/r2-upload/hero/v5/g2/base/idle_0'+str(i+1)+'.png').convert('RGBA')
    azure=Image.open(p['root']+'/r2-upload/hero/v5/g2/equipment/azure/idle_0'+str(i+1)+'/torso_armor.png').convert('RGBA')
    assert old.getpixel(point)==base.getpixel(point),('reproduce gray Base',i)
    assert out.getpixel(point)==azure.getpixel(point),('upper pants supplied',i)
    assert out.getpixel(point)!=old.getpixel(point)
print('Owner screenshot reproduced and corrected: 3/3')
`],{input:JSON.stringify({root:ROOT,frames}),encoding:"utf8"});
  assert.equal(check.status,0,check.stderr||check.stdout);
  for(const boots of ["leather","skeleton","robot"]){
    const result=vm.runInContext(`resolveHeroV5BaseWingContract({equipmentSelection:{equipment:{chest:"skeleton",boots:"${boots}"}}})`,context);
    assert.ok(result.idle.every(layers=>!layers.some(l=>l.name==="legs_waist")));
  }
  const azure=vm.runInContext('resolveHeroV5BaseWingContract({equipmentSelection:{equipment:{chest:"azure",boots:"azure"}}})',context);
  assert.ok(azure.idle.every(layers=>!layers.some(l=>l.name==="legs_waist")));
  for(const state of ['attack','death'])assert.ok(snapshot.hero.layerFrames[state].every(layers=>!layers.some(l=>l.name==="legs_waist")));
});
