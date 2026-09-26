const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

function source(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

test("W6.1 AssetResolver owns Phaser path and manifest resolution", () => {
  const resolver = source("src/phaser/assets/AssetResolver.js");
  const context = {
    assetUrl: value => `/assets/${String(value).replace(/^\/+/, "")}`,
    optionalAsset: key => key === "battleUi.background" ? "/assets/ui/battle/background.png" : ""
  };
  vm.createContext(context);
  vm.runInContext(`${resolver}; this.result = {
    relative: SHARED_PHASER_ASSET_RESOLVER.resolve("pets/sprout/idle_01.png"),
    resolved: SHARED_PHASER_ASSET_RESOLVER.resolve("/assets/pets/sprout/idle_01.png"),
    external: SHARED_PHASER_ASSET_RESOLVER.resolve("https://cdn.example.test/a.png"),
    manifest: SHARED_PHASER_ASSET_RESOLVER.manifest("battleUi.background"),
    unique: SHARED_PHASER_ASSET_RESOLVER.resolveAll(["a.png", "a.png", "b.png"])
  };`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.equal(result.relative, "/assets/pets/sprout/idle_01.png");
  assert.equal(result.resolved, "/assets/pets/sprout/idle_01.png");
  assert.equal(result.external, "https://cdn.example.test/a.png");
  assert.equal(result.manifest, "/assets/ui/battle/background.png");
  assert.deepEqual(result.unique, ["/assets/a.png", "/assets/b.png"]);
});

test("W6.1 TextureRegistry reuses deterministic Phaser texture keys", () => {
  const resolver = source("src/phaser/assets/AssetResolver.js");
  const registry = source("src/phaser/assets/TextureRegistry.js");
  const queued = [];
  const context = { assetUrl: value => `/assets/${value}`, optionalAsset: () => "" };
  vm.createContext(context);
  vm.runInContext(`${resolver}\n${registry}; this.registry = createPhaserTextureRegistry();`, context);
  const textureRegistry = context.registry;
  const scene = {
    textures: { exists: () => false },
    load: { image: (key, url) => queued.push({ key, url }) }
  };
  const first = textureRegistry.keyFor("monsters/slime/idle_01.png");
  const second = textureRegistry.keyFor("/assets/monsters/slime/idle_01.png");
  assert.equal(first, second);
  const queuedEntries = textureRegistry.queue(scene, ["a.png", "a.png", "b.png"]);
  assert.equal(queued.length, 2);
  assert.equal(queuedEntries.length, 2);
  assert.equal(textureRegistry.urlFor(first), "/assets/monsters/slime/idle_01.png");
  textureRegistry.forget(first);
  assert.equal(textureRegistry.urlFor(first), "");
});

test("W6.1 BattleScene delegates texture ownership to shared registry", () => {
  const scene = source("src/phaser/scenes/BattleScene.js");
  assert.doesNotMatch(scene, /function phaserAssetKey/);
  assert.match(scene, /createPhaserTextureRegistry\(\{ resolver: this\.assetResolver \}\)/);
  assert.match(scene, /this\.textureRegistry\.keyFor\(reference\)/);
  assert.match(scene, /this\.textureRegistry\.queue\(this, assets\)/);
  assert.match(scene, /this\.textureRegistry\.forget\(file\.key\)/);
});

test("W6.1 EventBridge resolves presentation assets through shared resolver", () => {
  const bridge = source("src/phaser/presentation/EventBridge.js");
  assert.match(bridge, /SHARED_PHASER_ASSET_RESOLVER\.resolveAll/);
  assert.match(bridge, /SHARED_PHASER_ASSET_RESOLVER\.resolve\(layer\.url \|\| layer\.path\)/);
  assert.match(bridge, /SHARED_PHASER_ASSET_RESOLVER\.manifest\("battleUi\.background"\)/);
  assert.doesNotMatch(bridge, /map\(path => assetUrl\(path\)\)/);
});

test("W6.1 shared asset modules load before Phaser presentation consumers", () => {
  const build = source("build.js");
  const resolverIndex = build.indexOf('"phaser/assets/AssetResolver.js"');
  const registryIndex = build.indexOf('"phaser/assets/TextureRegistry.js"');
  const bridgeIndex = build.indexOf('"phaser/presentation/EventBridge.js"');
  const sceneIndex = build.indexOf('"phaser/scenes/BattleScene.js"');
  assert.ok(resolverIndex > 0);
  assert.ok(registryIndex > resolverIndex);
  assert.ok(bridgeIndex > registryIndex);
  assert.ok(sceneIndex > registryIndex);
});

test("W6.2 ActorPresentationModel preserves W5 actor normalization contract", () => {
  const model = source("src/phaser/presentation/ActorPresentationModel.js");
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${model}; this.result = {
    actor: createActorPresentationModel({
      id: "m1",
      name: "Slime",
      kind: "monster",
      hp: 25,
      maxHp: 40,
      statuses: { poison: { duration: 2 }, expired: { duration: 0 } },
      monsterDefId: "slime_01"
    }),
    attack: normalizeActorPresentationAnim("attack", true),
    dead: normalizeActorPresentationAnim("idle", false)
  };`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.deepEqual(result.actor, {
    id: "m1",
    name: "Slime",
    kind: "monster",
    hp: 25,
    maxHp: 40,
    alive: true,
    statuses: [{ key: "poison", duration: 2 }],
    defId: "slime_01",
    isBoss: false,
    isEliteBoss: false,
    sizeClass: "medium",
    anchorType: "ground",
    icon: "◆"
  });
  assert.equal(result.attack, "attack");
  assert.equal(result.dead, "death");
});

test("W6.2 PresentationEventBridge is stream-generic while preserving battlefield events", () => {
  const bridgeSource = source("src/phaser/presentation/PresentationEventBridge.js");
  const events = [];
  const context = { console, events };
  vm.createContext(context);
  vm.runInContext(`${bridgeSource}; this.bridge = createPresentationEventBridge({
    syncType: "BATTLEFIELD_SYNC",
    streamKey: "battleId",
    onEvent: event => events.push(event)
  });`, context);
  const bridge = context.bridge;
  assert.equal(bridge.sync({ battleId: "b1", seq: 3, hero: {} }), true);
  bridge.targetSelected("m1");
  const normalized = JSON.parse(JSON.stringify(events));
  assert.equal(normalized[0].type, "BATTLEFIELD_SYNC");
  assert.equal(normalized[0].battleId, "b1");
  assert.equal(normalized[0].seq, 3);
  assert.equal(normalized[1].type, "TARGET_SELECTED");
  assert.equal(normalized[1].battleId, "b1");
  assert.equal(normalized[1].targetId, "m1");
  assert.deepEqual(JSON.parse(JSON.stringify(bridge.getState())), {
    streamKey: "battleId",
    streamId: "b1",
    latestSeq: 3
  });
});

test("W6.2 Battle snapshot adapter consumes shared actor model and no longer owns bridge state", () => {
  const adapter = source("src/phaser/presentation/EventBridge.js");
  const host = source("src/phaser/runtime/BattlefieldHost.js");
  assert.match(adapter, /createActorPresentationModel\(/);
  assert.match(adapter, /normalizeActorPresentationAnim\(/);
  assert.doesNotMatch(adapter, /function presentationUnit/);
  assert.doesNotMatch(adapter, /function createPresentationEventBridge/);
  assert.match(host, /syncType: "BATTLEFIELD_SYNC"/);
  assert.match(host, /streamKey: "battleId"/);
});

test("W6.2 shared presentation modules load before battle snapshot adapter and host", () => {
  const build = source("build.js");
  const modelIndex = build.indexOf('"phaser/presentation/ActorPresentationModel.js"');
  const bridgeIndex = build.indexOf('"phaser/presentation/PresentationEventBridge.js"');
  const adapterIndex = build.indexOf('"phaser/presentation/EventBridge.js"');
  const hostIndex = build.indexOf('"phaser/runtime/BattlefieldHost.js"');
  assert.ok(modelIndex > 0);
  assert.ok(bridgeIndex > modelIndex);
  assert.ok(adapterIndex > bridgeIndex);
  assert.ok(hostIndex > adapterIndex);
});

test("W6.3 HeroActor delegates V3 visual composition to one shared HeroRenderer", () => {
  const actor = source("src/phaser/actors/HeroActor.js");
  const renderer = source("src/phaser/renderers/HeroRenderer.js");
  assert.match(actor, /new HeroRenderer\(scene/);
  assert.match(actor, /this\.heroRenderer\.setData\(this\.data\)\.visualFrameCount/);
  assert.match(actor, /this\.heroRenderer\?\.setData\(this\.data\)\.applyVisualFrame/);
  assert.doesNotMatch(actor, /layerImages/);
  assert.doesNotMatch(actor, /layerSetForState/);
  assert.match(renderer, /class HeroRenderer/);
  assert.match(renderer, /resolveHeroV3Layers already returns the DOM bottom-to-top contract/);
  assert.doesNotMatch(renderer, /heroVisualSelectionFromEquipment/);
  assert.doesNotMatch(renderer, /V5_G2|Hero V5 Runtime|coverage_underlay/);
});

test("W6.3 HeroRenderer preserves W5 layer ordering and placement math", () => {
  const renderer = source("src/phaser/renderers/HeroRenderer.js");
  const images = [];
  const root = {
    list: [],
    addAt(image, index) {
      this.list.splice(index, 0, image);
    }
  };
  const makeImage = key => ({
    texture: { key },
    visible: true,
    setOrigin() { return this; },
    setDisplaySize(width, height) { this.width = width; this.height = height; return this; },
    setVisible(value) { this.visible = value; return this; },
    setTexture(next) { this.texture.key = next; return this; },
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setAngle(angle) { this.angle = angle; return this; },
    destroy() { this.destroyed = true; }
  });
  const scene = {
    textures: { exists: () => true },
    add: {
      container: () => root,
      image: (_x, _y, key) => {
        const image = makeImage(key);
        images.push(image);
        return image;
      }
    }
  };
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${renderer}; this.HeroRenderer = HeroRenderer;`, context);
  const instance = new context.HeroRenderer(scene, {
    root,
    displaySize: 150,
    textureKey: url => `key:${url}`,
    data: {
      layerFrames: {
        canvas: { width: 300, height: 300 },
        idle: [[
          { name: "wings", url: "wings.png", x: 30, y: 60, scale: 1, rotation: 0 },
          { name: "base", url: "base.png", x: 0, y: 0, scale: 1, rotation: 0 }
        ]]
      }
    }
  });
  instance.applyVisualFrame("idle", 0);
  assert.deepEqual(Array.from(instance.layerImages, entry => entry.name), ["wings", "base"]);
  assert.equal(root.list[0], images[0]);
  assert.equal(root.list[1], images[1]);
  assert.equal(images[0].width, 150);
  assert.equal(images[0].x, 15);
  assert.equal(images[0].y, 30);
});

test("W6.3 shared HeroRenderer loads before HeroActor", () => {
  const build = source("build.js");
  const rendererIndex = build.indexOf('"phaser/renderers/HeroRenderer.js"');
  const actorIndex = build.indexOf('"phaser/actors/HeroActor.js"');
  assert.ok(rendererIndex > 0);
  assert.ok(actorIndex > rendererIndex);
});

test("W6.4 PresentationQueue accepts only resolved visual tasks and preserves speed boundary", async () => {
  const queueSource = source("src/phaser/presentation/PresentationQueue.js");
  const calls = [];
  const context = { calls };
  vm.createContext(context);
  vm.runInContext(`${queueSource}; this.queue = createPresentationQueue();`, context);
  const queue = context.queue;
  queue.setSpeed(9);
  assert.equal(queue.getSpeed(), 2);
  await queue.enqueue(speed => { calls.push(speed); });
  await queue.whenDrained();
  assert.deepEqual(calls, [2]);
  assert.equal(queue.isBusy(), false);
  assert.doesNotMatch(queueSource, /battleCore|BATTLE_CORE_V1|battleStep|simulateBattle|applyCoreBattleState|saveRunState|createDungeonBattle/);
});

test("W6.4 VfxManager is a shared renderer for already-resolved effect events", async () => {
  const managerSource = source("src/phaser/presentation/VfxManager.js");
  const queued = [];
  const created = [];
  const textureRegistry = {
    keyFor: url => `key:${url}`,
    queue: (_scene, urls) => {
      queued.push(...urls);
      return urls;
    }
  };
  const scene = {
    textureRegistry,
    textures: { exists: () => true },
    add: {
      image: (x, y, key) => {
        const image = {
          x, y,
          texture: { key },
          setOrigin() { return this; },
          setDepth() { return this; },
          setDisplaySize() { return this; },
          setAlpha() { return this; },
          setTexture(next) { this.texture.key = next; return this; },
          destroy() { this.destroyed = true; }
        };
        created.push(image);
        return image;
      }
    }
  };
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${managerSource}; this.createVfxManager = createVfxManager;`, context);
  const manager = context.createVfxManager(scene, {
    assetResolver: { resolve: value => `/assets/${value}` },
    textureRegistry,
    frameResolver: key => key === "slash" ? ["vfx/a.png", "vfx/b.png"] : [],
    positionResolver: () => ({ x: 12, y: 34 })
  });
  assert.deepEqual(Array.from(manager.framesFor("slash")), ["/assets/vfx/a.png", "/assets/vfx/b.png"]);
  manager.queueAssets(["slash"]);
  assert.deepEqual(queued, ["/assets/vfx/a.png", "/assets/vfx/b.png"]);
  await manager.play({ effectKey: "slash" }, { speed: 2 });
  assert.equal(created[0].x, 12);
  assert.equal(created[0].y, 34);
  assert.equal(created[0].texture.key, "key:/assets/vfx/b.png");
  assert.equal(created[0].destroyed, true);
  assert.doesNotMatch(managerSource, /battleStep|simulateBattle|damage\s*=|cooldown|proc|reward|checkpoint/);
});

test("W6.4 BattleScene owns one shared VfxManager without resolving gameplay", () => {
  const scene = source("src/phaser/scenes/BattleScene.js");
  assert.match(scene, /this\.vfxManager = createVfxManager\(this/);
  assert.match(scene, /this\.vfxManager\?\.destroy\(\)/);
  assert.equal((scene.match(/createVfxManager\(/g) || []).length, 1);
  assert.doesNotMatch(scene, /BATTLE_VFX_PRESENTATION|resolvedEvents\(/);
});

test("W6.4 shared queue and VFX manager load before BattleScene", () => {
  const build = source("build.js");
  const queueIndex = build.indexOf('"phaser/presentation/PresentationQueue.js"');
  const vfxIndex = build.indexOf('"phaser/presentation/VfxManager.js"');
  const sceneIndex = build.indexOf('"phaser/scenes/BattleScene.js"');
  assert.ok(queueIndex > 0);
  assert.ok(vfxIndex > queueIndex);
  assert.ok(sceneIndex > vfxIndex);
});
test("W6.5 ResponsiveSceneLayout converts normalized anchors without owning combat positions", () => {
  const shared = source("src/phaser/layout/ResponsiveSceneLayout.js");
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${shared}; this.result = createResponsiveSceneLayout({
    width: 390,
    height: 520,
    anchors: {
      lead: { x: 0.20, y: 0.50 },
      row: [{ x: 0.25, y: 0.25 }, { x: 0.75, y: 0.75 }]
    }
  });`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.equal(result.scale, 1);
  assert.deepEqual(result.pixels.lead, { x: 78, y: 260 });
  assert.deepEqual(result.pixels.row, [{ x: 98, y: 130 }, { x: 293, y: 390 }]);
  assert.doesNotMatch(shared, /MONSTER_SINGLE|MONSTER_TWO|MONSTER_THREE|VFX_HERO/);
});

test("W6.5 locked Combat anchors remain byte-for-value equivalent to W5", () => {
  const shared = source("src/phaser/layout/ResponsiveSceneLayout.js");
  const anchors = source("src/phaser/layout/ResponsiveAnchors.js");
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${shared}\n${anchors}; this.result = responsiveBattlefieldLayout(390, 520, 3);`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.equal(result.actorScale, 1);
  assert.deepEqual(result.normalized.hero, { x: 0.20, y: 0.50 });
  assert.deepEqual(result.normalized.pet, { x: 0.22, y: 0.84 });
  assert.deepEqual(result.normalized.monsters, [
    { x: 0.71, y: 0.29 },
    { x: 0.80, y: 0.58 },
    { x: 0.87, y: 0.87 }
  ]);
  assert.deepEqual(result.pixels.hero, { x: 78, y: 260 });
  assert.deepEqual(result.pixels.pet, { x: 86, y: 437 });
});

test("W6.5 shared layout utility loads before locked Combat anchors", () => {
  const build = source("build.js");
  const sharedIndex = build.indexOf('"phaser/layout/ResponsiveSceneLayout.js"');
  const anchorsIndex = build.indexOf('"phaser/layout/ResponsiveAnchors.js"');
  assert.ok(sharedIndex > 0);
  assert.ok(anchorsIndex > sharedIndex);
});
test("W6.6 EquipmentVisualResolver preserves current V3 selection without owning equipment state", () => {
  const resolverSource = source("src/phaser/presentation/EquipmentVisualResolver.js");
  const context = {
    heroVisualSelectionFromEquipment: equipped => ({
      weapon: equipped.weapon?.visual || null,
      wings: equipped.wings ? "angel" : null
    })
  };
  vm.createContext(context);
  vm.runInContext(`${resolverSource}; this.result = SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroSelection({
    weapon: { visual: "azureSword" },
    wings: { id: "wing01" }
  });`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), {
    weapon: "azureSword",
    wings: "angel"
  });
  assert.match(resolverSource, /currentHeroMode: "v3"/);
  assert.doesNotMatch(resolverSource, /save\.|battleState|inventoryState|fetch\(|apiRequest/);
});

test("W6.6 battle snapshot consumes equipment visuals only through shared resolver boundary", () => {
  const adapter = source("src/phaser/presentation/EventBridge.js");
  assert.match(adapter, /SHARED_EQUIPMENT_VISUAL_RESOLVER\.resolveHeroSelection\(equipped\)/);
  assert.doesNotMatch(adapter, /heroVisualSelectionFromEquipment\(equipped\)/);
});

test("W6.6 DOM default and Phaser opt-in query contract remain unchanged", () => {
  const ui = source("src/phaser/ui/PhaserBattlefield.js");
  assert.match(ui, /get\("phaserBattle"\) === "1"/);
  assert.match(ui, /catch \(_\) \{ return false; \}/);
  assert.match(ui, /if \(!enabled\) return null/);
});

test("W6.6 architecture contains no Hero V5 runtime asset contract", () => {
  const files = [
    "src/phaser/presentation/EquipmentVisualResolver.js",
    "src/phaser/presentation/EventBridge.js",
    "src/phaser/renderers/HeroRenderer.js",
    "src/phaser/scenes/BattleScene.js"
  ];
  files.forEach(file => {
    const text = source(file);
    assert.doesNotMatch(text, /coverage_underlay|torso_armor|legs_boots|arm_rear|arm_front|AZURE_SWORD_UPRIGHT|getHeroV5Config|resolveHeroV5Layers/);
  });
});

test("W6.6 EquipmentVisualResolver loads before battle snapshot adapter", () => {
  const build = source("build.js");
  const resolverIndex = build.indexOf('"phaser/presentation/EquipmentVisualResolver.js"');
  const adapterIndex = build.indexOf('"phaser/presentation/EventBridge.js"');
  assert.ok(resolverIndex > 0);
  assert.ok(adapterIndex > resolverIndex);
});
