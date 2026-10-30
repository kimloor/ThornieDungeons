const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const source = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");
const FRAME_IDS = ["idle_01", "idle_02", "idle_03", "attack_01", "attack_02", "attack_03", "death_01", "death_02"];

function workerApi() {
  const { loadWorkerSource } = require("./helpers/worker-source");
  let code = loadWorkerSource(ROOT).replace("export default {", "const workerDefault = {");
  code += `\nglobalThis.__h01={
    bangkokCalendarMonthEnd,halloweenEventWindow,halloweenServerSkillCycle,
    dungeonV2ServerNormalizeContext,dungeonV2ServerRng,dungeonV2ServerGold,
    dungeonV2ServerExp,dungeonV2ServerTierForFloor,dungeonV2ServerBossForFloor
  };`;
  const context = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, Uint32Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.__h01;
}

function eventDb(config) {
  return {
    prepare() {
      return {
        bind() { return this; },
        async first() { return config == null ? null : { value_json: JSON.stringify(config) }; }
      };
    }
  };
}

test("H01 calendar window is one Bangkok calendar month, start-inclusive and end-exclusive", async () => {
  const api = workerApi();
  const start = Date.parse("2027-01-30T17:30:00.000Z"); // Jan 31 00:30 in Bangkok
  const end = api.bangkokCalendarMonthEnd(start);
  assert.equal(new Date(end).toISOString(), "2027-02-27T17:30:00.000Z");
  const config = { enabled: true, activationAt: new Date(start).toISOString() };
  assert.equal((await api.halloweenEventWindow(eventDb(config), start - 1)).state, "scheduled");
  assert.equal((await api.halloweenEventWindow(eventDb(config), start)).active, true);
  assert.equal((await api.halloweenEventWindow(eventDb(config), end - 1)).active, true);
  const expired = await api.halloweenEventWindow(eventDb(config), end);
  assert.equal(expired.active, false);
  assert.equal(expired.state, "expired");
  assert.equal((await api.halloweenEventWindow(eventDb({ enabled: false }), start)).state, "inactive");
});

test("H01 server-issued boss cycle alternates Normal/Skill and never repeats a skill", () => {
  const api = workerApi();
  const allowed = {
    nightmare_stun: { mult: .9, key: "stun", chance: 25, duration: 1 },
    nightmare_silence: { mult: 1.5, key: "silence", chance: 25, duration: 2 },
    nightmare_poison: { mult: .9, key: "poison", chance: 40, duration: 3, damagePct: .12 }
  };
  const firstSkills = new Set();
  let sampledSeed = 0x9e3779b9;
  for (let sample = 0; sample < 384; sample += 1) {
    sampledSeed = (Math.imul(sampledSeed, 1664525) + 1013904223) >>> 0;
    const seed = sampledSeed || 1;
    const cycle = api.halloweenServerSkillCycle(seed);
    assert.equal(cycle.length, 64);
    let previous = null;
    for (let index = 0; index < cycle.length; index += 2) {
      assert.equal(cycle[index].id, "basic_attack");
      const skill = cycle[index + 1];
      const expected = allowed[skill.id];
      assert.ok(expected, skill.id);
      assert.equal(skill.mult, expected.mult);
      assert.deepEqual(JSON.parse(JSON.stringify(skill.statuses[0])), {
        key: expected.key, chance: expected.chance, duration: expected.duration,
        ...(expected.damagePct ? { damagePct: expected.damagePct } : {})
      });
      assert.notEqual(skill.id, previous);
      previous = skill.id;
      if (index === 0) firstSkills.add(skill.id);
    }
  }
  assert.deepEqual([...firstSkills].sort(), Object.keys(allowed).sort());
});

test("H01 context snapshots progress into the next chapter-boss profile and rejects tampering", () => {
  const api = workerApi();
  for (const [progressFloor, referenceFloor] of [[1, 10], [9, 10], [10, 10], [11, 20], [99, 100]]) {
    const seed = 123456 + progressFloor;
    const context = {
      version: 3, mode: "dungeon", eventId: "halloween_v1", floor: referenceFloor,
      referenceFloor, progressFloor, role: "chapter_boss", packCount: 1,
      encounterSeed: seed, rewardSeed: seed + 1,
      startedAt: "2027-10-01T00:00:00.000Z", eventEndsAt: "2027-11-01T00:00:00.000Z",
      enemies: [{ id: "haloween_nightmare", instanceId: `h01-${seed}`, modifierId: null,
        statProfileId: api.dungeonV2ServerBossForFloor(referenceFloor), skillCycle: api.halloweenServerSkillCycle(seed) }]
    };
    const normalized = api.dungeonV2ServerNormalizeContext(context);
    assert.ok(normalized);
    assert.equal(normalized.referenceFloor, referenceFloor);
    assert.equal(normalized.enemies[0].id, "haloween_nightmare");
    assert.equal(normalized.enemies[0].statProfileId, api.dungeonV2ServerBossForFloor(referenceFloor));
    const tampered = structuredClone(context);
    tampered.enemies[0].skillCycle[1].mult = 99;
    assert.equal(api.dungeonV2ServerNormalizeContext(tampered), null);
  }
});

test("H01 reward contract is one exclusive roll with fixed 5% threshold and chapter-boss XP", () => {
  const worker = source("workers/thornie-dungeons-api.js");
  assert.match(worker, /if \(context\.eventId === HALLOWEEN_EVENT_ID\) \{\s*const weaponDrop = rng\(\) < \.05;/);
  assert.match(worker, /gold: weaponDrop \? 0 : dungeonV2ServerGold\(context\.referenceFloor, "chapter_boss", 1\)/);
  assert.match(worker, /xp: dungeonV2ServerExp\(context\.referenceFloor, "chapter_boss", 1\)/);
  assert.match(worker, /rarity: "mythic"[\s\S]*?empowerSlotCapacity: 4[\s\S]*?bossWeaponId: "excaliburnt"/);
  assert.match(worker, /unlockedNext: false[\s\S]*?firstClear: false/);
  const api = workerApi();
  let drops = 0;
  let sampledSeed = 0x243f6a88;
  for (let sample = 0; sample < 20000; sample += 1) {
    sampledSeed = (Math.imul(sampledSeed, 1664525) + 1013904223) >>> 0;
    if (api.dungeonV2ServerRng(sampledSeed || 1)() < .05) drops += 1;
  }
  assert.ok(drops > 900 && drops < 1100, `deterministic sample was ${drops}/20000`);
  assert.ok(api.dungeonV2ServerGold(10, "chapter_boss", 1) > 0);
  assert.ok(api.dungeonV2ServerExp(10, "chapter_boss", 1) > 0);
});

function runtime() {
  const manifest = JSON.parse(source("r2-upload/manifest.json"));
  const context = { ASSETS: manifest.assets };
  vm.createContext(context);
  vm.runInContext(source("src/phaser/presentation/EquipmentVisualResolver.js"), context);
  vm.runInContext(source("src/phaser/presentation/HeroV5RuntimeContract.js"), context);
  return context;
}

function resolve(context, equipment) {
  context.__equipped = equipment;
  const selection = vm.runInContext("resolveHeroV5EquipmentSelection(__equipped)", context);
  context.__selection = selection;
  const result = vm.runInContext("resolveHeroV5BaseWingContract({ equipmentSelection: __selection })", context);
  delete context.__equipped;
  delete context.__selection;
  return { selection, result };
}

const EQUIPMENT_STATES = {
  bare: {},
  azure: { helmet: { setId: "azure" }, chest: { setId: "azure" }, gloves: { setId: "azure" }, boots: { setId: "azure" } },
  azure_no_gloves: { helmet: { setId: "azure" }, chest: { setId: "azure" }, boots: { setId: "azure" } },
  leather: { helmet: { gearTier: 1 }, chest: { gearTier: 1 }, gloves: { gearTier: 1 }, boots: { gearTier: 1 } },
  leather_no_gloves: { helmet: { gearTier: 1 }, chest: { gearTier: 1 }, boots: { gearTier: 1 } },
  mixed: { helmet: { setId: "azure" }, chest: { gearTier: 1 }, gloves: { setId: "azure" }, boots: { gearTier: 1 } },
  mixed_leather_gloves: { helmet: { setId: "azure" }, chest: { setId: "azure" }, gloves: { gearTier: 1 }, boots: { setId: "azure" } }
};

test("H01 approved assets are exact staged copies and all manifest paths resolve", () => {
  const manifest = JSON.parse(source("r2-upload/manifest.json"));
  const docRoot = path.join(ROOT, "docs/h01-halloween-production/assets");
  const stagedPairs = [
    ["ui/dungeon-select/dungeon-gate-halloween-v1.webp", "r2-upload/ui/dungeon-select/dungeon-gate-halloween-v1.webp"],
    ["ui/equipment-icons/event/excaliburnt.png", "r2-upload/ui/equipment-icons/event/excaliburnt.png"],
    ...[["idle_01", "idle_0"], ["idle_02", "idle_1"], ["idle_03", "idle_2"],
      ["attack_01", "attack_0"], ["attack_02", "attack_1"], ["attack_03", "attack_2"], ["death_01", "death_0"]].map(([sourceId, runtimeId]) =>
      [`monsters/haloween_nightmare/${sourceId}.png`, `r2-upload/sprite/enemy/haloween_nightmare/animations/haloween_nightmare_${runtimeId}.png`]),
    ...FRAME_IDS.map(id => [`hero/v5/g2/weapons/excaliburnt/${id}.png`, `r2-upload/hero/v5/g2/weapons/excaliburnt/${id}/sword.png`])
  ];
  for (const [approved, staged] of stagedPairs) {
    assert.deepEqual(fs.readFileSync(path.join(docRoot, approved)), fs.readFileSync(path.join(ROOT, staged)), staged);
  }
  const event = manifest.assets.hero001.v5.g2.equipment.excaliburnt;
  for (const frameId of FRAME_IDS) {
    const rel = event.frames[frameId].sword.split("?")[0];
    assert.ok(fs.existsSync(path.join(ROOT, "r2-upload", rel)), rel);
  }
  assert.equal(manifest.assets.monsters.haloween_nightmare.animations.idle.length, 3);
  assert.equal(manifest.assets.monsters.haloween_nightmare.animations.attack.length, 3);
  assert.equal(manifest.assets.monsters.haloween_nightmare.animations.death.length, 1);
});

test("H01 Excaliburnt runtime contract covers 7 equipment states x 8 frames", () => {
  const context = runtime();
  let cases = 0;
  for (const [stateName, state] of Object.entries(EQUIPMENT_STATES)) {
    const weapon = { type: "weapon", rarity: "mythic", bossWeaponId: "excaliburnt", specialSource: "excaliburnt" };
    const { selection, result } = resolve(context, { ...state, weapon });
    assert.equal(selection.bossWeapon, "excaliburnt", stateName);
    for (const [animation, frames] of Object.entries(result)) {
      if (!Array.isArray(frames) || !["idle", "attack", "death"].includes(animation)) continue;
      frames.forEach((frame, index) => {
        cases += 1;
        const swordIndex = frame.findIndex(layer => layer.name === "sword");
        assert.ok(swordIndex >= 0, `${stateName} ${animation}_${index + 1}`);
        assert.match(frame[swordIndex].path, /weapons\/excaliburnt\//);
        const handIndex = frame.findIndex(layer => layer.name === "right_hand_occlusion");
        if (animation === "death") {
          assert.equal(handIndex, -1, `${stateName} death keeps approved transparent weapon frame`);
        } else {
          assert.ok(handIndex > swordIndex, `${stateName} ${animation}_${index + 1}`);
          const hand = frame[handIndex];
          assert.equal(hand.crop.length, 4);
          if (state.gloves) assert.match(hand.path, new RegExp(`/equipment/${state.gloves.setId || "leather"}/`));
          else assert.match(hand.path, /\/base\//);
        }
      });
    }
  }
  assert.equal(cases, 56);
});

test("H01 UI polling is cleaned up and event placement is scoped", () => {
  const app = source("src/ui/App.js");
  const components = source("src/ui/components.js");
  const styles = source("src/data/styles.js");
  assert.match(app, /setInterval\(refresh, 60000\)/);
  assert.match(app, /return \(\) => \{\s*cancelled = true;\s*clearInterval\(timer\);\s*\};/);
  assert.match(components, /setInterval\(\(\) => setWorldEventIndex/);
  assert.match(components, /return \(\) => clearInterval\(timer\)/);
  assert.match(components, /className: "md-dungeon-floor-node md-halloween-gate current"/);
  assert.match(components, /left: "31%", top: "13%"/);
  assert.match(styles, /\.md-dungeon-floor-node\.md-halloween-gate/);
  assert.doesNotMatch(styles, /\.md-dungeon-floor-node\s*\{[^}]*left\s*:/s);
});
