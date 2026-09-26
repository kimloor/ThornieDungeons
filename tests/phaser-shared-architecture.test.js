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
    assetUrl: value => `/assets/${String(value).replace(/^\\/+/, "")}`,
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
