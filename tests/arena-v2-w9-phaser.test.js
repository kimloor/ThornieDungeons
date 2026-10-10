const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const source = file => fs.readFileSync(path.join(ROOT, file), "utf8");

test("W9.2 shared actor model normalizes facing without changing Dungeon defaults", () => {
  const model = source("src/phaser/presentation/ActorPresentationModel.js");
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${model}; this.result = {
    hero: createActorPresentationModel({ id: "h", kind: "hero", hp: 10, maxHp: 10 }).facing,
    pet: createActorPresentationModel({ id: "p", kind: "pet", hp: 10, maxHp: 10 }).facing,
    monster: createActorPresentationModel({ id: "m", kind: "monster", hp: 10, maxHp: 10 }).facing,
    explicit: createActorPresentationModel({ id: "x", kind: "hero", hp: 10, maxHp: 10, facing: "left" }).facing
  };`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.result)), {
    hero: "right",
    pet: "right",
    monster: "left",
    explicit: "left"
  });
});

test("W9.2 mirrors the whole visual root and drives motion from facing", () => {
  const actor = source("src/phaser/actors/ActorBase.js");
  assert.match(actor, /this\.visualRoot\.setScale\(this\.facingSign\(\), 1\)/);
  assert.match(actor, /x: this\.facingSign\(\) \* 10/);
  assert.match(actor, /x: -this\.facingSign\(\) \* 6/);
  assert.doesNotMatch(actor, /sprite\.setFlipX|image\.setFlipX/);
});

test("W9.2 target selection is shared by Hero, Pet and Monster actors", () => {
  const actor = source("src/phaser/actors/ActorBase.js");
  const hero = source("src/phaser/actors/HeroActor.js");
  const pet = source("src/phaser/actors/PetActor.js");
  const monster = source("src/phaser/actors/MonsterActor.js");

  assert.match(actor, /createTargetingPresentation\(\)/);
  assert.match(actor, /this\.scene\.add\.zone/);
  assert.match(actor, /this\.targetRing = this\.scene\.add\.ellipse/);
  assert.match(actor, /setSelected\(selected\)/);
  assert.match(hero, /constructor\(scene, data, options = \{\}\)/);
  assert.match(pet, /constructor\(scene, data, options = \{\}\)/);
  assert.match(hero, /\.\.\.options/);
  assert.match(pet, /\.\.\.options/);
  assert.match(monster, /onSelect/);
  assert.doesNotMatch(monster, /this\.targetRing =/);
});

test("W9.2 Arena layout mirrors current Dungeon Hero/Pet baseline", () => {
  const shared = source("src/phaser/layout/ResponsiveSceneLayout.js");
  const anchors = source("src/phaser/layout/ResponsiveAnchors.js");
  const context = { console };
  vm.createContext(context);
  vm.runInContext(`${shared}\n${anchors}; this.result = responsiveArenaBattlefieldLayout(390, 520);`, context);
  const result = JSON.parse(JSON.stringify(context.result));
  assert.equal(result.actorScale, 1);
  assert.deepEqual(result.normalized.attackerHero, { x: 0.20, y: 0.50 });
  assert.deepEqual(result.normalized.attackerPet, { x: 0.22, y: 0.84 });
  assert.deepEqual(result.normalized.defenderHero, { x: 0.80, y: 0.50 });
  assert.deepEqual(result.normalized.defenderPet, { x: 0.78, y: 0.84 });
  assert.deepEqual(result.pixels.attackerHero, { x: 78, y: 260 });
  assert.deepEqual(result.pixels.attackerPet, { x: 86, y: 437 });
  assert.deepEqual(result.pixels.defenderHero, { x: 312, y: 260 });
  assert.deepEqual(result.pixels.defenderPet, { x: 304, y: 437 });
});

test("W9.2 Arena snapshot supports mirrored Hero+Pet teams and shared assets", () => {
  const model = source("src/phaser/presentation/ActorPresentationModel.js");
  const adapter = source("src/phaser/presentation/EventBridge.js");
  const context = {
    SHARED_PHASER_ASSET_RESOLVER: {
      resolve: value => value ? `/assets/${String(value).replace(/^\/+/, "")}` : "",
      resolveAll: values => (values || []).filter(Boolean).map(value => `/assets/${String(value).replace(/^\/+/, "")}`),
      manifest: key => key === "arenaUi.background" ? "/assets/ui/arena/arena_background.webp" : "/assets/ui/battle/battle_background.webp"
    },
    SHARED_EQUIPMENT_VISUAL_RESOLVER: {
      resolveHeroSelection: () => ({}),
      resolveHeroV5Selection: () => ({})
    },
    getHeroV3Config: () => ({
      canvas: { width: 1254, height: 1254 },
      base: { attack: [] },
      attackFrameMs: 140
    }),
    resolveHeroV3Layers: () => [{ name: "base", url: "hero/base.png", x: 0, y: 0, scale: 1, rotation: 0 }],
    getPetSpriteConfig: () => ({ animations: { idle: ["pet/idle.png"], attack: ["pet/attack.png"], death: ["pet/death.png"] } }),
    isHeroV5RuntimeEnabled: () => false
  };
  vm.createContext(context);
  vm.runInContext(`${model}\n${adapter}; this.snapshot = buildArenaBattlefieldSnapshot({
    battleState: {
      battleId: "arena-1",
      safeActionSeq: 7,
      controlledSide: "team_a",
      teamIds: ["team_a", "team_b"],
      teams: {
        team_a: { unitIds: ["hero-a", "pet-a"] },
        team_b: { unitIds: ["hero-b", "pet-b"] }
      },
      selectedTargetIds: { team_a: "pet-b" },
      units: {
        "hero-a": { id: "hero-a", kind: "hero", side: "team_a", hp: 100, maxHp: 100 },
        "pet-a": { id: "pet-a", kind: "pet", side: "team_a", hp: 50, maxHp: 50, defId: "flamekit" },
        "hero-b": { id: "hero-b", kind: "hero", side: "team_b", hp: 100, maxHp: 100 },
        "pet-b": { id: "pet-b", kind: "pet", side: "team_b", hp: 50, maxHp: 50, defId: "flamekit" }
      }
    },
    combatSpeed: 2,
    heroV5: false
  });`, context);

  const snapshot = JSON.parse(JSON.stringify(context.snapshot));
  assert.equal(snapshot.mode, "arena");
  assert.equal(snapshot.selectedTargetId, "pet-b");
  assert.equal(snapshot.combatSpeed, 2);
  assert.equal(snapshot.backgroundUrl, "/assets/ui/arena/arena_background.webp");
  assert.equal(snapshot.teams[0].role, "attacker");
  assert.equal(snapshot.teams[0].hero.facing, "right");
  assert.equal(snapshot.teams[0].pet.facing, "right");
  assert.equal(snapshot.teams[1].role, "defender");
  assert.equal(snapshot.teams[1].hero.facing, "left");
  assert.equal(snapshot.teams[1].pet.facing, "left");
  assert.equal(snapshot.teams[1].hero.visualMode, "v3");
  assert.deepEqual(snapshot.teams[1].pet.frames.idle, ["/assets/pet/idle.png"]);
  assert.equal(Object.prototype.hasOwnProperty.call(snapshot, "skip"), false);
});

test("W9.2 Arena snapshot supports Hero-only teams", () => {
  const model = source("src/phaser/presentation/ActorPresentationModel.js");
  const adapter = source("src/phaser/presentation/EventBridge.js");
  const context = {
    SHARED_PHASER_ASSET_RESOLVER: {
      resolve: value => value || "",
      resolveAll: values => values || [],
      manifest: () => ""
    },
    SHARED_EQUIPMENT_VISUAL_RESOLVER: {
      resolveHeroSelection: () => ({}),
      resolveHeroV5Selection: () => ({})
    },
    getHeroV3Config: () => ({ canvas: { width: 1, height: 1 }, base: { attack: [] } }),
    resolveHeroV3Layers: () => [],
    getPetSpriteConfig: () => null,
    isHeroV5RuntimeEnabled: () => false
  };
  vm.createContext(context);
  vm.runInContext(`${model}\n${adapter}; this.snapshot = buildArenaBattlefieldSnapshot({
    battleState: {
      controlledSide: "a",
      teamIds: ["a", "b"],
      teams: { a: { unitIds: ["ha"] }, b: { unitIds: ["hb"] } },
      units: {
        ha: { id: "ha", kind: "hero", side: "a", hp: 1, maxHp: 1 },
        hb: { id: "hb", kind: "hero", side: "b", hp: 1, maxHp: 1 }
      }
    },
    heroV5: false
  });`, context);
  const snapshot = JSON.parse(JSON.stringify(context.snapshot));
  assert.equal(snapshot.teams[0].pet, null);
  assert.equal(snapshot.teams[1].pet, null);
  assert.equal(snapshot.selectedTargetId, "hb");
});

test("W9.10 Arena snapshot carries authoritative action cues in log order", () => {
  const model = source("src/phaser/presentation/ActorPresentationModel.js");
  const adapter = source("src/phaser/presentation/EventBridge.js");
  const context = {
    SHARED_PHASER_ASSET_RESOLVER: {
      resolve: value => value || "",
      resolveAll: values => values || [],
      manifest: () => ""
    },
    SHARED_EQUIPMENT_VISUAL_RESOLVER: {
      resolveHeroSelection: () => ({}),
      resolveHeroV5Selection: () => ({})
    },
    getHeroV3Config: () => ({ canvas: { width: 1, height: 1 }, base: { attack: [] } }),
    resolveHeroV3Layers: () => [],
    getPetSpriteConfig: () => ({ animations: { idle: [], attack: [], death: [] } }),
    isHeroV5RuntimeEnabled: () => false
  };
  vm.createContext(context);
  vm.runInContext(`${model}\n${adapter}; this.snapshot = buildArenaBattlefieldSnapshot({ battleState: {
    battleId: "arena-cues", actionSeq: 4, controlledSide: "team_a", teamIds: ["team_a", "team_b"],
    teams: { team_a: { unitIds: ["team_a_hero", "team_a_pet"] }, team_b: { unitIds: ["team_b_hero", "team_b_pet"] } },
    units: {
      team_a_hero: { id: "team_a_hero", side: "team_a", kind: "hero", hp: 100, maxHp: 100 },
      team_a_pet: { id: "team_a_pet", side: "team_a", kind: "pet", hp: 50, maxHp: 50 },
      team_b_hero: { id: "team_b_hero", side: "team_b", kind: "hero", hp: 100, maxHp: 100 },
      team_b_pet: { id: "team_b_pet", side: "team_b", kind: "pet", hp: 50, maxHp: 50 }
    },
    log: [
      { seq: 8, type: "damage", actorId: "team_a_hero", targetId: "team_b_hero" },
      { seq: 9, type: "damage", actorId: "team_b_pet", targetId: "team_a_hero" },
      { seq: 10, type: "round", actorId: null }
    ]
  }, heroV5: false });`, context);
  const cues = JSON.parse(JSON.stringify(context.snapshot.animationCues));
  assert.deepEqual(cues.map(cue => [cue.seq, cue.actorId, cue.animation]), [
    [8, "team_a_hero", "attack"],
    [9, "team_b_pet", "attack"]
  ]);
});

test("W9.2 BattleScene uses shared Hero/Pet actors for defender targeting without resolver authority", () => {
  const scene = source("src/phaser/scenes/BattleScene.js");
  assert.match(scene, /responsiveArenaBattlefieldLayout\(width, height\)/);
  assert.match(scene, /this\.createArenaActor\(defender\?\.hero, true\)/);
  assert.match(scene, /this\.createArenaActor\(defender\?\.pet, true\)/);
  assert.match(scene, /actor\.setSelected\(role === "defender"/);
  assert.match(scene, /new HeroActor\(this, data, options\)/);
  assert.match(scene, /new PetActor\(this, data, options\)/);
  assert.doesNotMatch(scene, /battleStep|simulateBattle|BATTLE_CORE_V1|rating|reward/i);
  assert.match(scene, /lastArenaCueSeq/);
  assert.match(scene, /arenaActorById/);
  assert.match(scene, /playVisualState\(cue\.animation.*force: true/);
});

test("W9.2 existing Dungeon anchors and presentation contract remain unchanged", () => {
  const anchors = source("src/phaser/layout/ResponsiveAnchors.js");
  assert.match(anchors, /HERO: Object\.freeze\(\{ x: 0\.20, y: 0\.50 \}\)/);
  assert.match(anchors, /PET: Object\.freeze\(\{ x: 0\.22, y: 0\.84 \}\)/);
  assert.match(anchors, /MONSTER_SINGLE: Object\.freeze\(\{ x: 0\.80, y: 0\.61 \}\)/);

  const adapter = source("src/phaser/presentation/EventBridge.js");
  assert.match(adapter, /backgroundUrl: SHARED_PHASER_ASSET_RESOLVER\.manifest\("battleUi\.background"\)/);
  assert.match(adapter, /backgroundUrl: SHARED_PHASER_ASSET_RESOLVER\.manifest\("arenaUi\.background"\)/);
});


test("W9.2 Arena first resolved snapshot presents its damage feedback instead of baselining it away", () => {
  const scene = source("src/phaser/scenes/BattleScene.js");
  const firstSnapshot = scene.indexOf("if (isFirstSnapshot) {", scene.indexOf("syncArena(snapshot)"));
  const firstFeedback = scene.indexOf("damageFeedbackEvents = feedback.slice().sort", firstSnapshot);
  const firstBaseline = scene.indexOf("this.lastArenaDamageFeedbackSeq = feedback.reduce", firstSnapshot);
  assert.ok(firstSnapshot >= 0 && firstFeedback > firstSnapshot && firstBaseline > firstFeedback);
  assert.match(scene, /if \(isArenaPresentationSnapshot\(this\.snapshot\)\) return this\.arenaActorById\(key\)/);
});
