const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const source = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const FRAME_IDS = ["idle_01", "idle_02", "idle_03", "attack_01", "attack_02", "attack_03", "death_01", "death_02"];
const LAYERS = ["coverage_underlay", "torso_armor", "legs_boots", "arm_rear", "helmet", "sword", "arm_front"];
const G16_EXPORT = "docs/g16-leather-g2/exports/idle_01";

function framesFor(family, actualG16 = false) {
  return Object.fromEntries(FRAME_IDS.map(frameId => [frameId,
    Object.fromEntries(LAYERS.map(layer => [layer, actualG16
      ? `${G16_EXPORT}/${layer}.png`
      : `hero/v5/g2/equipment/${family}/${frameId}/${layer}.png`
    ]))
  ]));
}

function config() {
  const equipment = {};
  for (const family of ["azure", "robot", "skeleton"]) {
    equipment[family] = { approval: "approved", fullFaceHelmet: true, frames: framesFor(family) };
  }
  equipment.leather = {
    approval: "approved",
    compositionProfile: "leather_overlap_v1",
    hairMode: "hidden_full_cover",
    frames: framesFor("leather", true),
    handOcclusion: {
      sourceLayer: "arm_rear",
      after: "sword",
      frames: { idle_01: { crop: [0, 493, 768, 42] } }
    }
  };
  equipment.spiritGreatsword = {
    approval: "approved",
    frames: Object.fromEntries(FRAME_IDS.map(id => [id, { sword: `weapons/spirit_greatsword/${id}/sword.png` }]))
  };
  return {
    approval: "approved",
    canvas: { width: 768, height: 768 },
    base: {
      approval: "approved",
      frames: Object.fromEntries(FRAME_IDS.map(id => [id, `r2-upload/hero/v5/g2/base/${id}.png`]))
    },
    defaultHair: "topknot",
    hair: {
      topknot: {
        approval: "approved",
        frames: Object.fromEntries(FRAME_IDS.map(id => [id, {
          hair_back: `r2-upload/hero/v5/g2/hair/topknot/${id}/hair_back.png`,
          hair_front: `r2-upload/hero/v5/g2/hair/topknot/${id}/hair_front.png`
        }]))
      }
    },
    wingTemplate: {
      frames: Object.fromEntries(FRAME_IDS.map(id => [id, {
        wing_far: `wings/${id}/wing_far.png`,
        wing_near: `wings/${id}/wing_near.png`
      }]))
    },
    equipment
  };
}

function runtime(customConfig = config()) {
  const context = { ASSETS: { hero001: { v5: { g2: customConfig } } } };
  vm.createContext(context);
  vm.runInContext(source("src/phaser/presentation/EquipmentVisualResolver.js"), context);
  vm.runInContext(source("src/phaser/presentation/HeroV5RuntimeContract.js"), context);
  return context;
}

function resolve(context, equipmentSelection) {
  context.__selection = equipmentSelection;
  const result = vm.runInContext("resolveHeroV5BaseWingContract({ equipmentSelection: __selection })", context);
  delete context.__selection;
  return result;
}

function layerNames(result, state = "idle", index = 0) {
  return Array.from(result[state][index], layer => layer.name);
}

test("G16 Leather uses pairwise overlap order without requiring the third body slot", () => {
  const context = runtime();
  const chestGloves = resolve(context, { equipment: { chest: "leather", gloves: "leather" } });
  assert.deepEqual(layerNames(chestGloves), ["base", "hair_back", "hair_front", "arm_rear", "arm_front", "torso_armor"]);
  const chestBoots = resolve(context, { equipment: { chest: "leather", boots: "leather" } });
  assert.deepEqual(layerNames(chestBoots), ["base", "hair_back", "hair_front", "legs_boots", "torso_armor"]);
});

test("G16 full Leather order preserves underlay, slots, sword, and the scoped hand pass", () => {
  const context = runtime();
  const result = resolve(context, { equipment: {
    helmet: "leather", chest: "leather", gloves: "leather", boots: "leather", weapon: "leather"
  } });
  assert.deepEqual(layerNames(result), [
    "base", "coverage_underlay", "legs_boots", "arm_rear", "arm_front",
    "torso_armor", "helmet", "sword", "right_hand_occlusion"
  ]);
  const hand = result.idle[0].find(layer => layer.name === "right_hand_occlusion");
  assert.equal(hand.path, `${G16_EXPORT}/arm_rear.png`);
  assert.deepEqual(Array.from(hand.crop), [0, 493, 768, 42]);
  assert.ok(!layerNames(result).includes("hair_back"));
  assert.ok(!layerNames(result).includes("hair_front"));
});

test("Leather helmet hair modes are explicit and legacy fullFaceHelmet remains compatible", () => {
  const leatherContext = runtime();
  const leather = resolve(leatherContext, { equipment: { helmet: "leather" } });
  assert.ok(!layerNames(leather).includes("hair_back"));
  const bare = resolve(leatherContext, { equipment: {} });
  assert.ok(layerNames(bare).includes("hair_back"));
  assert.ok(layerNames(bare).includes("hair_front"));

  for (const mode of ["baked_into_helmet", "default"]) {
    const next = config();
    next.equipment.leather.hairMode = mode;
    const names = layerNames(resolve(runtime(next), { equipment: { helmet: "leather" } }));
    assert.equal(names.includes("hair_back"), mode === "default");
    assert.equal(names.includes("hair_front"), mode === "default");
  }
  const azure = resolve(leatherContext, { equipment: { helmet: "azure" } });
  assert.ok(!layerNames(azure).includes("hair_back"));
});

test("an incomplete helmet slot falls back locally and restores default hair", () => {
  const next = config();
  delete next.equipment.leather.frames.attack_02.helmet;
  const result = resolve(runtime(next), { equipment: { helmet: "leather" } });
  assert.ok(Array.from(result.visualFallbacks).includes("helmet"));
  assert.ok(layerNames(result).includes("hair_back"));
  assert.ok(!layerNames(result).includes("helmet"));
});

test("Leather hand pass requires Leather gloves and a resolved weapon, including boss override", () => {
  const context = runtime();
  const withoutWeapon = resolve(context, { equipment: { gloves: "leather" } });
  assert.ok(!layerNames(withoutWeapon).includes("right_hand_occlusion"));
  const withoutLeatherGloves = resolve(context, { equipment: { gloves: "azure", weapon: "leather" } });
  assert.ok(!layerNames(withoutLeatherGloves).includes("right_hand_occlusion"));
  const boss = resolve(context, {
    equipment: { gloves: "leather", weapon: null }, bossWeapon: "spiritGreatsword"
  });
  const names = layerNames(boss);
  assert.ok(names.indexOf("sword") < names.indexOf("right_hand_occlusion"));
  assert.match(boss.idle[0].find(layer => layer.name === "sword").path, /spirit_greatsword/);
});

test("Azure Robot and Skeleton retain the locked legacy order", () => {
  const context = runtime();
  const expected = [
    "base", "coverage_underlay", "torso_armor", "legs_boots",
    "arm_rear", "helmet", "sword", "arm_front"
  ];
  for (const family of ["azure", "robot", "skeleton"]) {
    const result = resolve(context, { equipment: {
      helmet: family, chest: family, gloves: family, boots: family, weapon: family
    } });
    assert.deepEqual(layerNames(result), expected);
    assert.ok(!layerNames(result).includes("right_hand_occlusion"));
  }
});

test("mixed families retain legacy relative order and transparent underlay stays full-set-only", () => {
  const context = runtime();
  const mixed = resolve(context, { equipment: { chest: "leather", gloves: "azure", boots: "leather" } });
  assert.deepEqual(layerNames(mixed), ["base", "hair_back", "hair_front", "legs_boots", "torso_armor", "arm_rear", "arm_front"]);
  assert.ok(!layerNames(mixed).includes("coverage_underlay"));
  const full = resolve(context, { equipment: { chest: "leather", gloves: "leather", boots: "leather" } });
  assert.ok(layerNames(full).includes("coverage_underlay"));
});

test("generic Tier 1 maps to Leather while explicit setId has priority and Accessory stays out", () => {
  const context = runtime();
  context.__equipped = {
    helmet: { type: "helmet", gearTier: 1 },
    chest: { type: "chest", gearTier: 1, setId: "azure" },
    gloves: { type: "gloves", gearTier: 2 },
    boots: { type: "boots", gearTier: 1, setId: "unsupported" },
    weapon: { type: "weapon", gearTier: 1 },
    accessory: { type: "accessory", gearTier: 1 }
  };
  const selection = vm.runInContext("resolveHeroV5EquipmentSelection(__equipped, {})", context);
  assert.deepEqual(JSON.parse(JSON.stringify(selection.equipment)), {
    helmet: "leather", chest: "azure", gloves: null, boots: null, weapon: "leather"
  });
  assert.equal(Object.hasOwn(selection.equipment, "accessory"), false);
});

test("implemented Idle_01 composite is pixel-identical to the Owner-approved preview", () => {
  const result = resolve(runtime(), { equipment: {
    helmet: "leather", chest: "leather", gloves: "leather", boots: "leather", weapon: "leather"
  } });
  const payload = JSON.stringify({
    root: ROOT,
    layers: Array.from(result.idle[0], layer => JSON.parse(JSON.stringify(layer))),
    approved: "docs/g16-leather-g2/qa/reassembled_preview.png",
    current: "docs/g16-leather-g2/qa/current_contract_order.png",
    visual: process.env.G16_WRITE_VISUAL === "1" ? "docs/g16-leather-g2/qa/RUNTIME_IMPLEMENTED_COMPARISON.png" : null
  });
  const python = String.raw`
import json,sys
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw
p=json.load(sys.stdin); root=Path(p['root']); out=None
for layer in p['layers']:
    path=root/str(layer['path']).split('?',1)[0]
    image=Image.open(path).convert('RGBA')
    crop=layer.get('crop')
    if crop:
        x,y,w,h=map(int,crop); clipped=Image.new('RGBA',image.size,(0,0,0,0))
        clipped.alpha_composite(image.crop((x,y,x+w,y+h)),(x,y)); image=clipped
    if out is None: out=image.copy()
    else: out.alpha_composite(image)
approved=Image.open(root/p['approved']).convert('RGBA')
if ImageChops.difference(out,approved).getbbox() is not None: sys.exit(2)
underlay=Image.open(root/'docs/g16-leather-g2/exports/idle_01/coverage_underlay.png').convert('RGBA')
if underlay.getchannel('A').getbbox() is not None: sys.exit(3)
if p.get('visual'):
    current=Image.open(root/p['current']).convert('RGBA')
    canvas=Image.new('RGB',(2304,820),'#d9dfe6'); draw=ImageDraw.Draw(canvas)
    for i,(title,image) in enumerate([('Current runtime',current),('Owner approved',approved),('Implemented runtime',out)]):
        panel=Image.new('RGBA',(768,768),'#d9dfe6'); panel.alpha_composite(image)
        canvas.paste(panel.convert('RGB'),(i*768,0)); draw.text((i*768+24,786),title,fill='#172033')
    canvas.save(root/p['visual'])
print('pixel-identical')
`;
  const check = spawnSync("python3", ["-c", python], { cwd: ROOT, input: payload, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /pixel-identical/);
});

test("snapshot and renderer preserve and apply crop metadata without duplicating the full arm", () => {
  const bridge = source("src/phaser/presentation/EventBridge.js");
  assert.match(bridge, /crop: Array\.isArray\(layer\.crop\)/);
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${source("src/phaser/renderers/HeroRenderer.js")}; this.HeroRenderer = HeroRenderer;`, context);
  const cropCalls = [];
  const image = {
    texture: { key: "arm" }, setOrigin(){ return this; }, setDisplaySize(){ return this; },
    setVisible(){ return this; }, setPosition(){ return this; }, setAngle(){ return this; },
    setTexture(){ return this; }, setCrop(...args){ cropCalls.push(args); return this; }
  };
  const root = { list: [], addAt(value){ this.list.push(value); }, moveTo(){ } };
  const scene = { textures: { exists: () => true }, add: { image: () => image } };
  const renderer = new context.HeroRenderer(scene, {
    root, textureKey: () => "arm", data: {
      layerFrames: { canvas: { width:768, height:768 }, idle: [[{
        name:"right_hand_occlusion", url:"arm.png", crop:[0,493,768,42]
      }]] }
    }
  });
  renderer.applyVisualFrame("idle", 0);
  assert.deepEqual(cropCalls.at(-1), [0,493,768,42]);
  renderer.setData({ layerFrames: { canvas:{width:768,height:768}, idle:[[{ name:"right_hand_occlusion", url:"arm.png" }]] } });
  renderer.applyVisualFrame("idle", 0);
  assert.deepEqual(cropCalls.at(-1), []);
});
