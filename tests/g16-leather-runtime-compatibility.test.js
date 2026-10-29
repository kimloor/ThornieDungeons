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
const G4_VALIDATION = JSON.parse(source("docs/g16-leather-g2/g3/VALIDATION.json"));
const G4_FRAME_LAYERS = Object.fromEntries(FRAME_IDS.map(frameId => [frameId, Object.fromEntries(
  G4_VALIDATION.files.filter(file => file.frame === frameId).map(file => [file.layer, file.path])
)]));
const FULL_LEATHER = Object.freeze({
  helmet: "leather", chest: "leather", gloves: "leather", boots: "leather", weapon: "leather"
});

function framesFor(family, actualG16 = false) {
  return Object.fromEntries(FRAME_IDS.map(frameId => [frameId,
    Object.fromEntries(LAYERS.map(layer => [layer, actualG16
      ? G4_FRAME_LAYERS[frameId][layer]
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
    frameComposition: {
      attack_01: { foreground: ["arm_rear"] },
      attack_02: { foreground: ["arm_rear"] },
      attack_03: { foreground: ["arm_rear"] },
      death_02: { foreground: ["arm_rear"] }
    },
    handOcclusion: {
      sourceLayer: "arm_rear",
      after: "sword",
      frames: Object.fromEntries(FRAME_IDS.map(frameId => [frameId, {
        crop: G4_VALIDATION.handOcclusion[frameId]?.crop || null
      }]))
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

test("G16 full Leather uses the approved order in all eight final G4 frames", () => {
  const context = runtime();
  const result = resolve(context, { equipment: FULL_LEATHER });
  const expected = {
    idle_01: ["base", "coverage_underlay", "legs_boots", "arm_rear", "arm_front", "torso_armor", "helmet", "sword", "right_hand_occlusion"],
    idle_02: ["base", "coverage_underlay", "legs_boots", "arm_rear", "arm_front", "torso_armor", "helmet", "sword", "right_hand_occlusion"],
    idle_03: ["base", "coverage_underlay", "legs_boots", "arm_rear", "arm_front", "torso_armor", "helmet", "sword", "right_hand_occlusion"],
    attack_01: ["base", "coverage_underlay", "legs_boots", "arm_front", "torso_armor", "helmet", "sword", "arm_rear"],
    attack_02: ["base", "coverage_underlay", "legs_boots", "arm_front", "torso_armor", "helmet", "sword", "arm_rear"],
    attack_03: ["base", "coverage_underlay", "legs_boots", "arm_front", "torso_armor", "helmet", "sword", "arm_rear"],
    death_01: ["base", "coverage_underlay", "legs_boots", "arm_rear", "arm_front", "torso_armor", "helmet", "sword"],
    death_02: ["base", "coverage_underlay", "legs_boots", "arm_front", "torso_armor", "helmet", "sword", "arm_rear"]
  };
  for (const [state, frameIds] of Object.entries({ idle: FRAME_IDS.slice(0, 3), attack: FRAME_IDS.slice(3, 6), death: FRAME_IDS.slice(6) })) {
    frameIds.forEach((frameId, index) => assert.deepEqual(layerNames(result, state, index), expected[frameId], frameId));
  }
  const idleCrops = [[0,493,768,42], [0,481,768,42], [0,489,768,42]];
  result.idle.forEach((frame, index) => {
    const hand = frame.find(layer => layer.name === "right_hand_occlusion");
    assert.equal(hand.path, G4_FRAME_LAYERS[`idle_0${index + 1}`].arm_rear);
    assert.deepEqual(Array.from(hand.crop), idleCrops[index]);
  });
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

test("Leather hand pass is Idle-only and foreground arms suppress duplicate crops", () => {
  const context = runtime();
  const withoutWeapon = resolve(context, { equipment: { gloves: "leather" } });
  assert.ok(!layerNames(withoutWeapon).includes("right_hand_occlusion"));
  const withoutLeatherGloves = resolve(context, { equipment: { gloves: "azure", weapon: "leather" } });
  assert.ok(!layerNames(withoutLeatherGloves).includes("right_hand_occlusion"));
  const boss = resolve(context, {
    equipment: { gloves: "leather", weapon: null }, bossWeapon: "spiritGreatsword"
  });
  const names = layerNames(boss, "idle", 0);
  assert.ok(names.indexOf("sword") < names.indexOf("right_hand_occlusion"));
  assert.match(boss.idle[0].find(layer => layer.name === "sword").path, /spirit_greatsword/);
  for (let index = 0; index < 3; index += 1) {
    const attack = layerNames(boss, "attack", index);
    assert.ok(attack.indexOf("sword") < attack.indexOf("arm_rear"));
    assert.ok(!attack.includes("right_hand_occlusion"));
  }

  const defensive = config();
  defensive.equipment.leather.handOcclusion.frames.attack_02.crop = [0, 410, 768, 90];
  const defended = resolve(runtime(defensive), { equipment: FULL_LEATHER });
  assert.ok(!layerNames(defended, "attack", 1).includes("right_hand_occlusion"));
  assert.equal(layerNames(defended, "attack", 1).at(-1), "arm_rear");
});

test("Leather sword uses a scoped Base hand pass when gloves are unequipped", () => {
  const context = runtime();
  const result = resolve(context, { equipment: { weapon: "leather" } });
  const expectedCrops = {
    idle: [[244, 493, 48, 42], [244, 481, 48, 42], [244, 489, 48, 42]],
    attack: [[233, 277, 109, 185], [337, 417, 178, 65], [330, 431, 107, 144]]
  };
  for (const state of ["idle", "attack"]) {
    result[state].forEach((frame, index) => {
      const names = Array.from(frame, layer => layer.name);
      assert.ok(names.indexOf("sword") < names.indexOf("right_hand_occlusion"), `${state}_${index + 1}`);
      const hand = frame.find(layer => layer.name === "right_hand_occlusion");
      assert.match(hand.path, new RegExp(`/base/${state}_0${index + 1}\\.png$`));
      assert.deepEqual(Array.from(hand.crop), expectedCrops[state][index]);
    });
  }
  result.death.forEach(frame => assert.ok(!Array.from(frame, layer => layer.name).includes("right_hand_occlusion")));

  const unequipped = resolve(context, { equipment: {} });
  const legacySword = resolve(context, { equipment: { weapon: "azure" } });
  assert.ok(!layerNames(unequipped).includes("right_hand_occlusion"));
  assert.ok(!layerNames(legacySword).includes("right_hand_occlusion"));
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
    for (const [state, count] of [["idle", 3], ["attack", 3], ["death", 2]]) {
      for (let index = 0; index < count; index += 1) {
        assert.deepEqual(layerNames(result, state, index), expected, `${family} ${state} ${index}`);
        assert.ok(!layerNames(result, state, index).includes("right_hand_occlusion"));
      }
    }
  }
});

test("partial and mixed equipment move only the selected Leather foreground layer", () => {
  const context = runtime();
  const mixed = resolve(context, { equipment: { chest: "leather", gloves: "azure", boots: "leather" } });
  assert.deepEqual(layerNames(mixed), ["base", "hair_back", "hair_front", "legs_boots", "torso_armor", "arm_rear", "arm_front"]);
  assert.deepEqual(layerNames(mixed, "attack", 0), ["base", "hair_back", "hair_front", "legs_boots", "torso_armor", "arm_rear", "arm_front"]);
  assert.ok(!layerNames(mixed).includes("coverage_underlay"));
  const full = resolve(context, { equipment: { chest: "leather", gloves: "leather", boots: "leather" } });
  assert.ok(layerNames(full).includes("coverage_underlay"));

  const leatherGloves = resolve(context, { equipment: { chest: "azure", gloves: "leather", boots: "robot", helmet: "skeleton", weapon: "azure" } });
  assert.deepEqual(layerNames(leatherGloves), [
    "base", "torso_armor", "legs_boots", "arm_rear", "helmet", "sword", "arm_front", "right_hand_occlusion"
  ]);
  assert.deepEqual(layerNames(leatherGloves, "attack", 0), [
    "base", "torso_armor", "legs_boots", "helmet", "sword", "arm_front", "arm_rear"
  ]);
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

test("foreground metadata cannot move a layer owned by a non-Leather slot", () => {
  const next = config();
  next.equipment.leather.frameComposition.attack_01.foreground.push("torso_armor", "helmet", "unknown_layer");
  const mixed = resolve(runtime(next), { equipment: {
    chest: "azure", gloves: "leather", helmet: "robot", weapon: "skeleton"
  } });
  assert.deepEqual(layerNames(mixed, "attack", 0), [
    "base", "torso_armor", "helmet", "sword", "arm_front", "arm_rear"
  ]);
});

test("final G4 Death swords stay empty and never create a hand pass", () => {
  for (const frameId of ["death_01", "death_02"]) {
    const sword = G4_VALIDATION.files.find(file => file.frame === frameId && file.layer === "sword");
    assert.equal(sword.alphaNonzeroPixels, 0);
    assert.equal(sword.alphaBounds, null);
    assert.match(sword.emptyReason, /releases weapon/);
  }
  const result = resolve(runtime(), { equipment: FULL_LEATHER });
  result.death.forEach(frame => assert.ok(!Array.from(frame, layer => layer.name).includes("right_hand_occlusion")));
});

test("all eight implemented composites are pixel-identical to final G4 references", () => {
  const result = resolve(runtime(), { equipment: FULL_LEATHER });
  const payload = JSON.stringify({
    root: ROOT,
    frames: Object.fromEntries([
      ...result.idle.map((layers, index) => [`idle_0${index + 1}`, layers]),
      ...result.attack.map((layers, index) => [`attack_0${index + 1}`, layers]),
      ...result.death.map((layers, index) => [`death_0${index + 1}`, layers])
    ].map(([frameId, layers]) => [frameId, Array.from(layers, layer => JSON.parse(JSON.stringify(layer)))]))
  });
  const python = String.raw`
import json,sys
from pathlib import Path
from PIL import Image,ImageChops
p=json.load(sys.stdin); root=Path(p['root'])
for frame_id,layers in p['frames'].items():
    out=None
    for layer in layers:
        path=root/str(layer['path']).split('?',1)[0]
        image=Image.open(path).convert('RGBA')
        crop=layer.get('crop')
        if crop:
            x,y,w,h=map(int,crop); clipped=Image.new('RGBA',image.size,(0,0,0,0))
            clipped.alpha_composite(image.crop((x,y,x+w,y+h)),(x,y)); image=clipped
        out=image.copy() if out is None else Image.alpha_composite(out,image)
    approved=Image.open(root/f'docs/g16-leather-g2/g3/qa/{frame_id}_composite.png').convert('RGBA')
    if ImageChops.difference(out,approved).getbbox() is not None:
        print(frame_id,file=sys.stderr); sys.exit(2)
    underlay_path=next(layer['path'] for layer in layers if layer['name']=='coverage_underlay')
    underlay=Image.open(root/underlay_path).convert('RGBA')
    if underlay.getchannel('A').getbbox() is not None: sys.exit(3)
print('pixel-identical: 8/8')
`;
  const check = spawnSync("python3", ["-c", python], { cwd: ROOT, input: payload, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /pixel-identical: 8\/8/);
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


test("bare Leather sword never redraws Base pants over equipped legs in any idle frame", () => {
  for (const boots of ["leather", "azure", "skeleton", "robot"]) {
    const settings = config();
    const result = resolve(runtime(settings), { equipment: { weapon: "leather", boots, chest: "skeleton" } });
    result.idle.forEach((layers, index) => {
      assert.ok(layers.some(layer => layer.name === "legs_boots" && layer.path === settings.equipment[boots].frames[`idle_0${index + 1}`].legs_boots));
      const hand = layers.find(layer => layer.name === "right_hand_occlusion");
      // x >= 296 contains the Base trouser silhouette in the old full-width band.
      assert.ok(hand.crop[0] + hand.crop[2] <= 292, `pants must remain untouched: ${boots}/idle_${index + 1}`);
      assert.equal(hand.crop[1], [493, 481, 489][index]);
    });
  }
});
