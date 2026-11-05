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
    dungeonV2ServerExp,dungeonV2ServerTierForFloor,dungeonV2ServerBossForFloor,
    handleStartHalloweenBattle,dungeonAuthorityCarryState
  };`;
  const context = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, Uint32Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(code, context);
  return Object.assign(context.__h01, { context });
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

test("H01 carry validator accepts only the latest settled Fled Battle", async () => {
  const api = workerApi();
  const state = {
    serverContext: {
      version: 3, mode: "dungeon", eventId: "halloween_v1", floor: 10, referenceFloor: 10,
      progressFloor: 9, role: "chapter_boss", packCount: 1, encounterSeed: 1, rewardSeed: 2,
      startedAt: "2026-11-04T00:00:00.000Z", eventEndsAt: "2026-12-04T00:00:00.000Z",
      enemies: [{ id: "haloween_nightmare", instanceId: "enemy-1", modifierId: null,
        statProfileId: api.dungeonV2ServerBossForFloor(10), skillCycle: api.halloweenServerSkillCycle(1), kind: "boss", isBoss: true }]
    },
    heroId: "hero", petId: "pet", units: { hero: { hp: 37, sp: 6 }, pet: { hp: 12, instId: "pet-instance" } }
  };
  const db = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() {
          return sql.includes("FROM battle_completions")
            ? { battle_id: "latest-settled", result_json: JSON.stringify({ result: "fled", floor: 10 }), state_json: JSON.stringify(state), outcome: "fled", settled_at: "2026-11-04T00:00:00.000Z" }
            : null;
        }
      };
    }
  };
  const carry = await api.dungeonAuthorityCarryState(db, "char-1", "latest-settled", 20);
  assert.deepEqual(JSON.parse(JSON.stringify(carry)), { heroHp: 37, heroSp: 6, petHp: 12, petInstId: "pet-instance", outcome: "fled" });
  assert.equal(await api.dungeonAuthorityCarryState(db, "char-1", "older-id", 20), null);
  assert.match(source("workers/thornie-dungeons-api.js"), /handleStartHalloweenBattle\(db, id, auth, body\.characterId, body\.previousBattleId \|\| null\)/);
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


test("H01 Halloween checkpoints are isolated from normal Dungeon floor previews", () => {
  const api = source("workers/thornie-dungeons-api.js");
  const components = source("src/ui/components.js");
  const app = source("src/ui/App.js");
  assert.match(api, /context\.mode === "dungeon" && context\.eventId !== HALLOWEEN_EVENT_ID/);
  assert.match(api, /!context\.enemies\.some\(enemy => enemy\.id === "haloween_nightmare"\)/);
  assert.match(components, /const openHalloweenPreview = \(\) =>/);
  assert.match(components, /onClick: openHalloweenPreview/);
  assert.match(components, /detail\.kind === "halloween" \? "HALLOWEEN EVENT"/);
  assert.match(components, /detail\.kind === "halloween" \? "Haloween nightmare"/);
  assert.match(components, /if \(detail\.kind === "halloween"\) \{\s*onSelectHalloween\(\);/);
  assert.match(components, /detail\.kind !== "halloween" && detail\.floor > unlockedFloor/);
  assert.match(components, /bossWeaponId: "excaliburnt"[\s\S]*?alt: "Excaliburnt"/);
  assert.match(components, /iconKey: "gold"[\s\S]*?alt: "Gold"/);
  assert.match(app, /halloween: true/);
});


function halloweenStartHarness({ checkpoint = null, authority = null, active = true, raceWinner = null } = {}) {
  const character = { character_id: "char-h01", player_id: "player-h01", unlocked_floor: 12, name: "QA Hero", agi: 5 };
  let activeCheckpoint = checkpoint ? { ...checkpoint } : null;
  let authorityRow = authority ? { ...authority } : null;
  const executed = [];
  const db = {
    prepare(sql) {
      let values = [];
      return {
        sql,
        bind(...args) { values = args; this.values = values; return this; },
        async first() {
          if (sql.includes("SELECT * FROM characters")) return character;
          if (sql.includes("SELECT battle_id, payload_json FROM battle_checkpoints")) return activeCheckpoint?.state === "active" ? activeCheckpoint : null;
          if (sql.includes("SELECT state_rev, state_json, outcome, settled_at FROM battle_authority")) return authorityRow;
          return null;
        },
        async run() {
          executed.push({ sql, values });
          if (sql.includes("UPDATE battle_checkpoints SET state = 'closed'")) {
            if (activeCheckpoint && activeCheckpoint.battle_id === values[1]) activeCheckpoint = { ...activeCheckpoint, state: "closed" };
          } else if (sql.includes("INSERT OR IGNORE INTO battle_authority") && !authorityRow) {
            authorityRow = { state_rev: 0, state_json: values[3], outcome: "", settled_at: "" };
          }
          return { success: true, meta: { changes: 1 } };
        }
      };
    },
    async batch(statements) {
      executed.push(...statements.map(statement => ({ sql: statement.sql, values: statement.values })));
      const checkpointStatement = statements.find(statement => statement.sql.includes("INSERT INTO battle_checkpoints"));
      const authorityStatement = statements.find(statement => statement.sql.includes("INSERT INTO battle_authority"));
      assert.ok(checkpointStatement, "checkpoint insert is part of D1 batch");
      assert.ok(authorityStatement, "authority insert is part of D1 batch");
      if (raceWinner) {
        activeCheckpoint = { ...raceWinner.checkpoint };
        authorityRow = { ...raceWinner.authority };
        throw new Error("simulated concurrent entry won");
      }
      if (activeCheckpoint?.state === "active") throw new Error("active checkpoint uniqueness conflict");
      activeCheckpoint = {
        battle_id: checkpointStatement.values[0],
        payload_json: checkpointStatement.values[2],
        state: "active"
      };
      authorityRow = {
        state_rev: 0,
        state_json: authorityStatement.values[3],
        outcome: "",
        settled_at: ""
      };
      return [{ success: true }, { success: true }];
    }
  };

  const api = workerApi();
  const context = api.context;
  context.halloweenEventWindow = async () => ({ active, endsAt: "2026-12-01T00:00:00.000Z" });
  context.dungeonV2ServerNormalizeContext = value => value;
  context.dungeonV2ServerContextFromStoredCheckpoint = payload => payload?.serverContext || null;
  context.dungeonAuthorityInitialState = async (_db, _character, serverContext, battleId) => ({
    battleId, mode: "dungeon", floor: serverContext.floor, heroId: "hero",
    units: { hero: { id: "hero", hp: 100, maxHp: 100, sp: 20, maxSp: 20 } }, log: []
  });
  context.dungeonV2ServerBossForFloor = () => "boss-profile";
  context.halloweenServerSkillCycle = () => [];
  const eventContext = {
    version: 3, mode: "dungeon", eventId: "halloween_v1", floor: 20,
    referenceFloor: 20, progressFloor: 12, role: "chapter_boss", packCount: 1,
    encounterSeed: 101, rewardSeed: 202, startedAt: "2026-11-03T00:00:00.000Z",
    eventEndsAt: "2026-12-01T00:00:00.000Z",
    enemies: [{ id: "haloween_nightmare", instanceId: "halloween-test", modifierId: null, statProfileId: "boss-profile", skillCycle: [], kind: "boss", isBoss: true }]
  };
  return {
    api, db, executed, character, eventContext,
    start: async () => {
      const response = await api.handleStartHalloweenBattle(
        db, "player-h01", { ok: true, row: { id: "player-h01" } }, character.character_id
      );
      return { status: response.status, body: await response.json() };
    },
    get checkpoint() { return activeCheckpoint; },
    get authority() { return authorityRow; }
  };
}

test("H01 new Event Entry atomically creates checkpoint + Battle Authority and returns initial state", async () => {
  const harness = halloweenStartHarness();
  const result = await harness.start();
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.authoritative, true);
  assert.equal(result.body.stateRev, 0);
  assert.equal(result.body.state.battleId, result.body.battleId);
  assert.equal(result.body.context.eventId, "halloween_v1");
  assert.match(result.body.battleId, /^halloween-/);
  assert.ok(harness.checkpoint, "active checkpoint persisted");
  assert.ok(harness.authority, "authority row persisted");
  assert.equal(harness.executed.filter(entry => entry.sql.includes("INSERT INTO battle_checkpoints") || entry.sql.includes("INSERT INTO battle_authority")).length, 2);
});

test("H01 retry repairs a legacy Halloween checkpoint missing authority without changing battle identity", async () => {
  const sourceHarness = halloweenStartHarness();
  const legacyContext = { ...sourceHarness.eventContext };
  const harness = halloweenStartHarness({
    checkpoint: {
      battle_id: "halloween-legacy-1",
      payload_json: JSON.stringify({ authorizationOnly: true, serverContext: legacyContext }),
      state: "active"
    }
  });
  const result = await harness.start();
  assert.equal(result.status, 200);
  assert.equal(result.body.battleId, "halloween-legacy-1");
  assert.equal(result.body.context.eventId, "halloween_v1");
  assert.equal(result.body.authoritative, true);
  assert.equal(result.body.state.battleId, "halloween-legacy-1");
  assert.ok(harness.authority, "missing authority was reconstructed");
  assert.ok(harness.executed.some(entry => entry.sql.includes("INSERT OR IGNORE INTO battle_authority")));
  assert.equal(harness.executed.some(entry => entry.sql.includes("INSERT INTO battle_checkpoints")), false);
});

test("H01 retry returns existing authoritative state without creating a duplicate battle", async () => {
  const sourceHarness = halloweenStartHarness();
  const context = { ...sourceHarness.eventContext };
  const existingState = { battleId: "halloween-live-1", mode: "dungeon", units: { hero: { hp: 71 } }, log: [] };
  const harness = halloweenStartHarness({
    checkpoint: {
      battle_id: "halloween-live-1",
      payload_json: JSON.stringify({ authorizationOnly: true, serverContext: context }),
      state: "active"
    },
    authority: { state_rev: 4, state_json: JSON.stringify(existingState), outcome: "", settled_at: "" }
  });
  const result = await harness.start();
  assert.equal(result.status, 200);
  assert.equal(result.body.battleId, "halloween-live-1");
  assert.equal(result.body.stateRev, 4);
  assert.equal(result.body.state.units.hero.hp, 71);
  assert.equal(harness.executed.length, 0);
});

test("H01 simultaneous Event Entry reuses the winning battle instead of creating a duplicate", async () => {
  const sourceHarness = halloweenStartHarness();
  const winnerContext = { ...sourceHarness.eventContext };
  const winnerState = { battleId: "halloween-race-winner", mode: "dungeon", units: { hero: { hp: 90 } }, log: [] };
  const harness = halloweenStartHarness({
    raceWinner: {
      checkpoint: {
        battle_id: "halloween-race-winner",
        payload_json: JSON.stringify({ authorizationOnly: true, serverContext: winnerContext }),
        state: "active"
      },
      authority: { state_rev: 0, state_json: JSON.stringify(winnerState), outcome: "", settled_at: "" }
    }
  });
  const result = await harness.start();
  assert.equal(result.status, 200);
  assert.equal(result.body.battleId, "halloween-race-winner");
  assert.equal(result.body.state.units.hero.hp, 90);
});

test("H01 Event Entry remains closed when the event is inactive", async () => {
  const harness = halloweenStartHarness({ active: false });
  const result = await harness.start();
  assert.equal(result.status, 403);
  assert.equal(result.body.error, "halloween_event_inactive");
  assert.equal(harness.executed.length, 0);
});
