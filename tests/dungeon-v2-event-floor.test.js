const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
global.HERO_SKILLS_V1_BY_ID=require("../src/systems/heroSkillsV1.js").HERO_SKILLS_V1_BY_ID;
global.PET_COMBAT_SKILLS_V2=require("../src/systems/pets.js").PET_COMBAT_SKILLS_V2;
const loadFloor=()=>{const s=fs.readFileSync(path.join(__dirname,"../src/systems/floorModifier.js"),"utf8")+"\nthis.api={FLOOR_EVENT_CHANCE,FLOOR_EVENT_IDS,floorModifierById,floorModifierSpeed,applyFloorModifierMultiplier,rollFloorModifier};";const c={};vm.createContext(c);vm.runInContext(s,c);return c.api};
const floorApi=loadFloor();global.floorModifierById=floorApi.floorModifierById;
const battle=require("../src/systems/battleCore.js"),dungeon=require("../src/systems/dungeonV2.js"),rewards=require("../src/systems/rewardV2.js");
let workerCache;function workerApi(){if(workerCache)return workerCache;const {loadWorkerSource}=require("./helpers/worker-source");let s=loadWorkerSource(path.resolve(__dirname,"..")).replace("export default {","const workerDefault = {");s+="\nglobalThis.__eventApi={dungeonV2ServerEventModifier,dungeonV2ServerRollEventId,dungeonV2ServerApplyEventMultiplier,dungeonV2ServerNormalizeContext,dungeonV2ServerExpectedRole,dungeonV2ServerEncounterContext,dungeonV2ServerContextFromStoredCheckpoint,dungeonV2ServerContextsMatch};";const c={console,Response,Headers,Request,URL,TextEncoder,Uint8Array,crypto,atob,btoa,setTimeout,clearTimeout};vm.createContext(c);vm.runInContext(s,c);return workerCache=c.__eventApi}
const hero=(x={})=>({id:"hero",kind:"hero",side:"ally",name:"Hero",hp:200,maxHp:200,sp:100,maxSp:100,atk:1,def:8,speed:120,accuracy:99,dodge:0,crit:0,agi:20,activeSkills:[],skills:{},...x});
const pet=(x={})=>({id:"pet",kind:"pet",side:"ally",name:"Pet",hp:80,maxHp:80,atk:1,def:4,speed:90,accuracy:99,dodge:0,crit:0,...x});
const enemy=(id,x={})=>({id,kind:"monster",side:"enemy",name:id,hp:100,maxHp:100,atk:1,def:0,speed:60,accuracy:99,dodge:0,crit:0,...x});
test("Event table is seven uniform candidates and legacy IDs are gone",()=>{assert.equal(floorApi.FLOOR_EVENT_CHANCE,.25);assert.deepEqual(Array.from(floorApi.FLOOR_EVENT_IDS),["golden","arcane","treasure","rage","rush","oasis","toxic"]);assert.equal(floorApi.floorModifierById("elite_pack"),null);assert.equal(floorApi.floorModifierById("cursed"),null);for(let i=0;i<7;i++){const q=[.1,i===0?0:i/7+.000001];assert.equal(floorApi.rollFloorModifier(()=>q.shift()).id,floorApi.FLOOR_EVENT_IDS[i]);}});
test("25% threshold is deterministic",()=>{assert.ok(floorApi.rollFloorModifier(()=>.249999));assert.equal(floorApi.rollFloorModifier(()=>.25),null);});
test("Locked Event effect values are exact",()=>{assert.equal(floorApi.floorModifierById("golden").goldMult,2.2);assert.equal(floorApi.floorModifierById("arcane").xpMult,2);assert.equal(floorApi.floorModifierById("treasure").dropBonusFlat,35);assert.equal(floorApi.floorModifierById("treasure").rarityBoost,true);assert.deepEqual({atkMult:floorApi.floorModifierById("rage").atkMult,hpMult:floorApi.floorModifierById("rage").hpMult,goldMult:floorApi.floorModifierById("rage").goldMult},{atkMult:1.55,hpMult:.8,goldMult:1.35});assert.equal(floorApi.floorModifierById("rush").speedMult,2);assert.equal(floorApi.floorModifierById("oasis").turnHealPct,.05);assert.equal(floorApi.floorModifierById("toxic").poisonDamagePct,.05);});
test("Reward multipliers and Treasure rarity use locked behavior",()=>{assert.equal(floorApi.applyFloorModifierMultiplier(100,floorApi.floorModifierById("golden"),"goldMult"),220);assert.equal(floorApi.applyFloorModifierMultiplier(100,floorApi.floorModifierById("arcane"),"xpMult"),200);assert.equal(floorApi.applyFloorModifierMultiplier(100,floorApi.floorModifierById("rage"),"goldMult"),135);assert.equal(rewards.dungeonV2RollRarity(10,()=>.1,true),"unique");assert.equal(rewards.dungeonV2RollRarity(10,()=>.9,true),"rare");});
test("Rage applies locked ATK x1.55 and HP x0.80 multipliers",()=>{const rage=floorApi.floorModifierById("rage");assert.equal(floorApi.applyFloorModifierMultiplier(100,rage,"atkMult"),155);assert.equal(floorApi.applyFloorModifierMultiplier(100,rage,"hpMult"),80);});
test("Rush doubles Monster Speed without changing Hero/Pet inputs",()=>{assert.equal(floorApi.floorModifierSpeed(80,floorApi.floorModifierById("rush")),160);assert.equal(floorApi.floorModifierSpeed(100,null),100);});
test("Oasis heals all living units through existing Action start and caps",()=>{let s=battle.createBattle({seed:3,dungeonEventId:"oasis",hero:hero({hp:195,maxHp:200}),pet:pet({hp:79,maxHp:80}),enemies:[enemy("m",{hp:95,maxHp:100})]});s=battle.battleStep(s,{type:"basic",targetId:"m"}).state;assert.deepEqual(s.log.filter(e=>e.type==="heal"&&e.actionName==="Oasis").map(e=>e.amount).sort((a,b)=>a-b),[1,5,5]);assert.equal(s.units.hero.hp,200);assert.equal(s.units.pet.hp,80);assert.equal(s.units.m.hp,99);});
test("Toxic uses one shared Poison slot at 5% Max HP and does not stack",()=>{const s=battle.createBattle({seed:4,dungeonEventId:"toxic",hero:hero({statuses:{poison:{key:"poison",duration:6,damage:5,sourceId:"skill"}}}),enemies:[enemy("m")]});assert.equal(Object.keys(s.units.hero.statuses).filter(k=>k==="poison").length,1);assert.equal(s.units.hero.statuses.poison.damage,10);assert.equal(s.units.hero.statuses.poison.duration,3);const n=battle.battleStep(s,{type:"basic",targetId:"m"}).state;assert.equal(n.units.hero.hp,190);});
test("Worker enforces Boss/Elite priority and Normal-only Event",()=>{const a=workerApi();for(const f of [10,20,30]){assert.equal(a.dungeonV2ServerExpectedRole(f),"chapter_boss");assert.equal(a.dungeonV2ServerEncounterContext("event-qa",f,0).enemies[0].modifierId,null);}for(const f of [5,15,25]){assert.equal(a.dungeonV2ServerExpectedRole(f),"elite");assert.equal(a.dungeonV2ServerEncounterContext("event-qa",f,0).enemies[0].modifierId,null);}assert.equal(a.dungeonV2ServerNormalizeContext({mode:"dungeon",floor:10,role:"chapter_boss",packCount:1,enemies:[{id:"moss_king",instanceId:"b",modifierId:"golden"}],encounterSeed:1,rewardSeed:2}),null);});
test("Worker selects seven Event IDs uniformly and thresholds at 25%",()=>{const a=workerApi(),out=[];for(let i=0;i<7;i++){const q=[.1,i===0?0:i/7+.000001];out.push(a.dungeonV2ServerRollEventId(()=>q.shift()));}assert.deepEqual(out,["golden","arcane","treasure","rage","rush","oasis","toxic"]);assert.equal(a.dungeonV2ServerRollEventId(()=>.25),null);});
test("Worker applies one Event to the whole Normal pack without extra battle",()=>{const a=workerApi();let c=null;for(let i=0;i<100&&!c;i++){const x=a.dungeonV2ServerEncounterContext("event-pack-"+i,6,0);if(x.enemies.some(e=>e.modifierId))c=x;}assert.ok(c);assert.equal(new Set(c.enemies.map(e=>e.modifierId)).size,1);assert.equal(c.role,"normal");assert.ok(c.enemies.length>=1&&c.enemies.length<=3);});
test("Worker reward arithmetic is authoritative",()=>{const a=workerApi();assert.equal(a.dungeonV2ServerApplyEventMultiplier(100,a.dungeonV2ServerEventModifier("golden"),"goldMult"),220);assert.equal(a.dungeonV2ServerApplyEventMultiplier(100,a.dungeonV2ServerEventModifier("arcane"),"xpMult"),200);assert.equal(a.dungeonV2ServerApplyEventMultiplier(100,a.dungeonV2ServerEventModifier("rage"),"goldMult"),135);});
test("No legacy IDs or old 40% event roll remain in Event sources",()=>{const f=fs.readFileSync(path.join(__dirname,"../src/systems/floorModifier.js"),"utf8"),w=fs.readFileSync(path.join(__dirname,"../workers/thornie-dungeons-api.js"),"utf8");assert.doesNotMatch(f,/elite_pack|cursed/);assert.doesNotMatch(w,/elite_pack|cursed/);assert.doesNotMatch(w,/role === "normal"\s*&&\s*rng\(\)\s*<\s*0\.4/);});


const FLOOR_POOLS = [
  { min: 1, max: 5, ids: ["jelly_slime"] },
  { min: 6, max: 15, ids: ["jelly_slime", "spore_cap"] },
  { min: 16, max: 25, ids: ["jelly_slime", "spore_cap", "tusky_boar"] },
  { min: 26, max: 35, ids: ["jelly_slime", "spore_cap", "tusky_boar", "sandy_crab"] },
  { min: 36, max: 45, ids: ["jelly_slime", "spore_cap", "tusky_boar", "sandy_crab", "bramble_bat"] },
  { min: 46, max: Infinity, ids: ["jelly_slime", "spore_cap", "tusky_boar", "sandy_crab", "bramble_bat", "bone_rattler"] }
];
function expectedPool(floor) {
  return FLOOR_POOLS.find(band => floor >= band.min && floor <= band.max).ids;
}
function expectedBoss(floor) {
  return ["moss_king", "ember_drake", "frost_warden"][(floor / 10 - 1) % 3];
}
function generated(characterId, floor, ordinal = 1) {
  return workerApi().dungeonV2ServerEncounterContext(characterId, floor, ordinal);
}

test("new Worker encounters obey the approved cumulative pool at every band edge", () => {
  for (const floor of [1, 5, 6, 15, 16, 25, 26, 35, 36, 45, 46, 100]) {
    const context = generated("pool-edge-check", floor);
    assert.equal(context.version, 2, "new contexts must carry the floor-aware version");
    if (floor % 10 === 0) {
      assert.equal(context.enemies.length, 1);
      assert.equal(context.enemies[0].id, expectedBoss(floor), "Boss floors are not members of the Normal/Elite pool");
      assert.equal(context.enemies[0].modifierId, null);
      continue;
    }
    const pool = expectedPool(floor);
    assert.ok(context.enemies.length >= 1 && context.enemies.length <= 3);
    for (const enemy of context.enemies) assert.ok(pool.includes(enemy.id), "F" + floor + " emitted out-of-band monster " + enemy.id);
  }
});

test("every Normal/Elite pool member is reachable over many server-issued character encounters", () => {
  for (const floor of [1, 5, 6, 15, 16, 25, 26, 35, 36, 45, 46]) {
    const pool = expectedPool(floor);
    const seen = new Set();
    for (let i = 0; i < 600; i++) {
      const context = generated("pool-sampling-character-" + i, floor, 1 + (i % 7));
      assert.equal(context.role, floor % 10 === 5 ? "elite" : "normal");
      assert.equal(context.version, 2);
      for (const enemy of context.enemies) {
        assert.ok(pool.includes(enemy.id), "F" + floor + " emitted out-of-pool " + enemy.id);
        seen.add(enemy.id);
      }
    }
    assert.deepEqual([...seen].sort(), [...pool].sort(), "all F" + floor + " pool members should appear across characters");
  }
});

test("Boss floors F10 through F120 use the fixed repeating three-Boss cycle", () => {
  for (let floor = 10; floor <= 120; floor += 10) {
    const context = generated("fixed-boss-character-" + floor, floor);
    assert.equal(context.role, "chapter_boss");
    assert.equal(context.version, 2);
    assert.equal(context.enemies.length, 1);
    assert.equal(context.enemies[0].id, expectedBoss(floor), "wrong fixed Boss at F" + floor);
    assert.equal(context.enemies[0].kind, "boss");
    assert.equal(context.enemies[0].isBoss, true);
    assert.equal(context.enemies[0].modifierId, null);
  }
});

test("legacy v1 checkpoints keep already-issued out-of-pool monsters and random Boss IDs", () => {
  const api = workerApi();
  const oldMonsterContext = {
    version: 1, mode: "dungeon", floor: 24, role: "normal", packCount: 1,
    enemies: [{ id: "bone_rattler", instanceId: "issued-bone-24", modifierId: null }],
    encounterSeed: 12345, rewardSeed: 67890
  };
  const normalizedMonster = api.dungeonV2ServerNormalizeContext(oldMonsterContext);
  assert.ok(normalizedMonster, "old-style checkpoint must still validate");
  assert.equal(normalizedMonster.enemies[0].id, "bone_rattler");
  assert.equal(api.dungeonV2ServerContextFromStoredCheckpoint({ serverContext: oldMonsterContext }).enemies[0].id, "bone_rattler");
  assert.equal(api.dungeonV2ServerContextFromStoredCheckpoint({ serverContext: oldMonsterContext }).encounterSeed, 12345);

  const oldBossContext = {
    version: 1, mode: "dungeon", floor: 20, role: "chapter_boss", packCount: 1,
    enemies: [{ id: "moss_king", instanceId: "issued-random-boss-20", modifierId: null }],
    encounterSeed: 24680, rewardSeed: 13579
  };
  assert.ok(api.dungeonV2ServerNormalizeContext(oldBossContext), "old random Boss should remain resumable");
  assert.equal(api.dungeonV2ServerContextFromStoredCheckpoint({ serverContext: oldBossContext }).enemies[0].id, "moss_king");
  assert.equal(api.dungeonV2ServerContextFromStoredCheckpoint({ serverContext: oldBossContext }).enemies[0].instanceId, "issued-random-boss-20");
});

test("new v2 validation is floor-aware while old stored contexts are never regenerated", () => {
  const api = workerApi();
  const current = generated("new-start-v2", 24);
  assert.ok(api.dungeonV2ServerNormalizeContext(current));
  const invalidMonster = {
    ...current,
    enemies: current.enemies.map((enemy, index) => ({ ...enemy, id: "bone_rattler", instanceId: "invalid-bone-" + index }))
  };
  assert.equal(api.dungeonV2ServerNormalizeContext(invalidMonster), null, "new F24 context cannot contain F46+ Bone Rattler");
  const newBoss = generated("new-start-boss", 20);
  assert.equal(newBoss.enemies[0].id, "ember_drake");
  assert.equal(api.dungeonV2ServerNormalizeContext({ ...newBoss, enemies: [{ ...newBoss.enemies[0], id: "moss_king" }] }), null,
    "new F20 context cannot contain a random-cycle mismatch");
  const issued = {
    version: 1, mode: "dungeon", floor: 24, role: "normal", packCount: 1,
    enemies: [{ id: "bone_rattler", instanceId: "persisted-id-stays", modifierId: null }],
    encounterSeed: 987654, rewardSeed: 123456
  };
  const before = JSON.stringify(issued);
  const resumed = api.dungeonV2ServerContextFromStoredCheckpoint({ serverContext: issued });
  assert.ok(resumed);
  assert.equal(resumed.enemies[0].id, "bone_rattler");
  assert.equal(resumed.enemies[0].instanceId, "persisted-id-stays");
  assert.equal(resumed.encounterSeed, 987654);
  assert.equal(JSON.stringify(issued), before, "validation reads stored context; it does not rewrite/re-roll it");
  assert.equal(api.dungeonV2ServerContextsMatch(resumed, current), false, "legacy preview identity must not be silently treated as a different new encounter");
});

test("loot, Boss Stone, and first-clear accessory consumers remain keyed to canonical enemy IDs", () => {
  const worker = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  assert.ok(worker.includes("rowsByMonster[sourceIdentity]"), "loot rows remain selected by canonical monster id");
  assert.ok(worker.includes("globalThis.MYTHIC_V2.bossStoneForEnemy(bossId)"), "Boss Stone mapping remains keyed by the chosen Boss ID");
  assert.ok(worker.includes("sourceIdentity: boss.id"), "first-clear accessory provenance remains keyed by Boss ID");
});
