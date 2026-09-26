const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

test("W5 Phaser foundation keeps runtime isolated and resolver-free", () => {
  const files = [
    "src/phaser/runtime/PhaserRuntime.js",
    "src/phaser/runtime/BattlefieldHost.js",
    "src/phaser/assets/AssetResolver.js",
    "src/phaser/assets/TextureRegistry.js",
    "src/phaser/layout/ResponsiveSceneLayout.js",
    "src/phaser/layout/ResponsiveAnchors.js",
    "src/phaser/presentation/ActorPresentationModel.js",
    "src/phaser/presentation/EquipmentVisualResolver.js",
    "src/phaser/presentation/PresentationEventBridge.js",
    "src/phaser/presentation/EventBridge.js",
    "src/phaser/presentation/PresentationQueue.js",
    "src/phaser/presentation/VfxManager.js",
    "src/phaser/renderers/HeroRenderer.js",
    "src/phaser/actors/HeroActor.js",
    "src/phaser/scenes/BattleScene.js",
    "src/phaser/ui/PhaserBattlefield.js"
  ];
  files.forEach(file => {
    const source = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.doesNotMatch(source, /battleCore|BATTLE_CORE_V1|battleStep|simulateBattle|createDungeonBattle/);
  });
});

test("locked W5 anchors resolve all supported formation sizes", () => {
  const source = [
    fs.readFileSync(path.join(ROOT, "src/phaser/layout/ResponsiveSceneLayout.js"), "utf8"),
    fs.readFileSync(path.join(ROOT, "src/phaser/layout/ResponsiveAnchors.js"), "utf8")
  ].join("\n");
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${source}; this.result = { one: monsterAnchorsForCount(1), two: monsterAnchorsForCount(2), three: monsterAnchorsForCount(3), hero: RESPONSIVE_ANCHORS.HERO, pet: RESPONSIVE_ANCHORS.PET };`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.deepEqual(result.hero, { x: 0.20, y: 0.50 });
  assert.deepEqual(result.pet, { x: 0.22, y: 0.84 });
  assert.deepEqual(result.one, [{ x: 0.80, y: 0.61 }]);
  assert.deepEqual(result.two, [{ x: 0.74, y: 0.38 }, { x: 0.85, y: 0.80 }]);
  assert.deepEqual(result.three, [{ x: 0.71, y: 0.29 }, { x: 0.80, y: 0.58 }, { x: 0.87, y: 0.87 }]);
});

test("Phaser runtime is pinned and loaded through one reusable promise", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/phaser/runtime/PhaserRuntime.js"), "utf8");
  assert.match(source, /THORNIE_PHASER_VERSION = "3\.90\.0"/);
  assert.match(source, /if \(promise\) return promise/);
  assert.match(source, /data-thornie-phaser-runtime/);
});


test("Phaser battlefield propagates ready state to parent DOM gate", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/phaser/ui/PhaserBattlefield.js"), "utf8");
  assert.match(source, /props\.onStatus\?\.\("loading"\)/);
  assert.match(source, /props\.onStatus\?\.\("ready"\)/);
  assert.match(source, /props\.onStatus\?\.\("error", error\)/);
});


test("Phaser surface does not preload battle background and stays transparent", () => {
  const scene = fs.readFileSync(path.join(ROOT, "src/phaser/scenes/BattleScene.js"), "utf8");
  const host = fs.readFileSync(path.join(ROOT, "src/phaser/runtime/BattlefieldHost.js"), "utf8");
  assert.doesNotMatch(scene, /assets\.push\(snapshot\.backgroundUrl\)/);
  assert.match(host, /transparent:\s*true/);
  assert.match(host, /backgroundColor:\s*"rgba\(0,0,0,0\)"/);
});


test("Hero layer order matches DOM composition through shared renderer", () => {
  const source = fs.readFileSync(path.join(ROOT, "src/phaser/renderers/HeroRenderer.js"), "utf8");
  assert.match(source, /this\.root\.addAt\(image, Math\.min\(index/);
  assert.doesNotMatch(source, /addAt\(image, 0\)/);
});

test("Phaser HP HUD stays below feet and behind actor sprites", () => {
  const actor = fs.readFileSync(path.join(ROOT, "src/phaser/actors/ActorBase.js"), "utf8");
  assert.match(actor, /const barY = 14/);
  assert.match(actor, /scene\.add\.graphics\(\)\.setDepth\(2\)/);
  assert.match(actor, /setOrigin\(0\.5, 0\)\.setDepth\(3\)/);
});


test("static actor sizing keeps Hero and Monsters inside mobile battlefield", () => {
  const hero = fs.readFileSync(path.join(ROOT, "src/phaser/actors/HeroActor.js"), "utf8");
  const monster = fs.readFileSync(path.join(ROOT, "src/phaser/actors/MonsterActor.js"), "utf8");
  assert.match(hero, /baseSize: 150/);
  assert.match(monster, /baseSize: 106/);
});

test("HP bars render below actor feet through the shared actor HUD", () => {
  const actor = fs.readFileSync(path.join(ROOT, "src/phaser/actors/ActorBase.js"), "utf8");
  const hero = fs.readFileSync(path.join(ROOT, "src/phaser/actors/HeroActor.js"), "utf8");
  assert.match(actor, /const barY = 14/);
  assert.match(actor, /nameText\.setPosition\(0, 34\)/);
  assert.match(hero, /class HeroActor extends PhaserBattleActor/);
  assert.doesNotMatch(hero, /const barY = 14/);
});


test("W5.2 animation bridge stays presentation-only and carries resolved UI animation state", () => {
  const bridge = fs.readFileSync(path.join(ROOT, "src/phaser/presentation/EventBridge.js"), "utf8");
  const scene = fs.readFileSync(path.join(ROOT, "src/phaser/scenes/BattleScene.js"), "utf8");
  const actor = fs.readFileSync(path.join(ROOT, "src/phaser/actors/ActorBase.js"), "utf8");
  assert.match(bridge, /heroAnim = ""/);
  assert.match(bridge, /petAnim = ""/);
  assert.match(bridge, /enemyAnims = \{\}/);
  assert.match(bridge, /attack: urls\("attack"\)/);
  assert.match(scene, /createPresentationQueue\(\)/);
  assert.match(scene, /presentationQueue\.enqueue/);
  assert.match(actor, /playVisualState\(state, speed = 1\)/);
  assert.doesNotMatch(scene, /battleStep|simulateBattle|BATTLE_CORE_V1/);
});

test("Ver 1.0.6 mobile battle layout reserves fixed log space", () => {
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  assert.match(styles, /content: "Ver 1\.0\.8"/);
  assert.match(styles, /W5\.2 mobile combat fit/);
  assert.match(styles, /flex:0 0 42px/);
  assert.match(styles, /height:32px/);
});


test("responsive actor scale follows actual Phaser battlefield size", () => {
  const source = [
    fs.readFileSync(path.join(ROOT, "src/phaser/layout/ResponsiveSceneLayout.js"), "utf8"),
    fs.readFileSync(path.join(ROOT, "src/phaser/layout/ResponsiveAnchors.js"), "utf8")
  ].join("\n");
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${source}; this.result = {
    small: responsiveActorScale(300, 400),
    phone: responsiveActorScale(390, 520),
    tablet: responsiveActorScale(768, 800)
  };`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.equal(result.small, 0.82);
  assert.equal(result.phone, 1);
  assert.equal(result.tablet, 1.15);
});

test("actor display size consumes shared responsive scene scale", () => {
  const actor = fs.readFileSync(path.join(ROOT, "src/phaser/actors/ActorBase.js"), "utf8");
  const scene = fs.readFileSync(path.join(ROOT, "src/phaser/scenes/BattleScene.js"), "utf8");
  assert.match(actor, /this\.scene\?\.presentationScale/);
  assert.match(scene, /this\.presentationScale = layout\.actorScale/);
  assert.match(scene, /actor\.refresh\(actor\.data, \{ animate: false \}\)/);
});

test("Ver 1.0.7 centers the dungeon modifier pill", () => {
  const styles = fs.readFileSync(path.join(ROOT, "src/data/styles.js"), "utf8");
  assert.match(styles, /content: "Ver 1\.0\.8"/);
  assert.match(styles, /\.md-modifier-chip \{/);
  assert.match(styles, /margin:2px auto 4px/);
  assert.match(styles, /border-radius:999px/);
});

test("Ver 1.0.8 Phaser HUD text uses capped device-pixel resolution", () => {
  const actor = fs.readFileSync(path.join(ROOT, "src/phaser/actors/ActorBase.js"), "utf8");
  assert.match(actor, /function phaserTextResolution\(\)/);
  assert.equal((actor.match(/\.setResolution\(textResolution\)/g) || []).length, 3);

  const context = { devicePixelRatio: 3 };
  vm.createContext(context);
  vm.runInContext(`${actor}; this.result = phaserTextResolution();`, context);
  assert.equal(context.result, 3);

  const capped = { devicePixelRatio: 4 };
  vm.createContext(capped);
  vm.runInContext(`${actor}; this.result = phaserTextResolution();`, capped);
  assert.equal(capped.result, 3);

  const standard = { devicePixelRatio: 1 };
  vm.createContext(standard);
  vm.runInContext(`${actor}; this.result = phaserTextResolution();`, standard);
  assert.equal(standard.result, 1);
});

