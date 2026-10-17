const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { loadWorkerSource } = require('./helpers/worker-source');

const ROOT = path.join(__dirname, '..');
const source = loadWorkerSource(ROOT).replace('export default {', 'const workerDefault = {') + `
globalThis.__bot = { ARENA_BOT_DEFS, ARENA_BOT_LOADOUTS, ARENA_BOT_GEAR_SLOTS, arenaBotLoadout, arenaBotSnapshot, arenaBotBaseStats, arenaCombatBotUnit, arenaCombatState, arenaCombatAdvance, arenaNewBotLoadoutSeed, PET_DISPLAY_NAMES };`;
const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, Uint32Array, crypto, atob, btoa, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const bot = sandbox.__bot;

const opponentFor = (def, loadoutSeed) => ({ botId: def.id, name: def.name, level: def.level, rating: def.rating, archetype: def.archetype, slot: 'equal', ...(loadoutSeed === undefined ? {} : { loadoutSeed }) });
const TIER_GATE = { power_strike: 1, guard: 1, toxic_strike: 1, heavy_blow: 15, shield_wall: 15, stunning_blow: 15, counter: 30, silent_edge: 30, blade_storm: 30, rampage: 50, fortress: 50 };

test('loadout is deterministic per seed and differs across seeds', () => {
  for (const def of bot.ARENA_BOT_DEFS) {
    const a = JSON.stringify(bot.arenaBotLoadout(opponentFor(def, 12345)));
    assert.equal(a, JSON.stringify(bot.arenaBotLoadout(opponentFor(def, 12345))));
  }
  const def = bot.ARENA_BOT_DEFS.find((d) => d.archetype === 'pet_master');
  const variants = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(bot.arenaBotLoadout(opponentFor(def, 1000 + i)))));
  assert.ok(variants.size > 10, 'seeds should produce varied loadouts');
});

test('rows without loadoutSeed derive a stable fallback', () => {
  for (const def of bot.ARENA_BOT_DEFS) {
    assert.equal(JSON.stringify(bot.arenaBotLoadout(opponentFor(def))), JSON.stringify(bot.arenaBotLoadout(opponentFor(def))));
  }
});

test('every bot wears all six gear slots from its archetype rarity pool', () => {
  for (const def of bot.ARENA_BOT_DEFS) {
    for (let seed = 1; seed <= 20; seed++) {
      const { equipmentRows } = bot.arenaBotLoadout(opponentFor(def, seed));
      assert.deepEqual(Array.from(equipmentRows.map((r) => r.slot_type)), Array.from(bot.ARENA_BOT_GEAR_SLOTS));
      for (const row of equipmentRows) assert.ok(bot.ARENA_BOT_LOADOUTS[def.archetype].rarities.includes(row.rarity), `${def.id} ${row.rarity}`);
    }
  }
});

test('skills respect tier gates, fill priority order and use ranks in range', () => {
  for (const def of bot.ARENA_BOT_DEFS) {
    const cfg = bot.ARENA_BOT_LOADOUTS[def.archetype];
    for (let seed = 1; seed <= 50; seed++) {
      const { skillSlots, skillLevels } = bot.arenaBotLoadout(opponentFor(def, seed));
      const slots = Array.from(skillSlots).filter(Boolean);
      assert.ok(slots.length >= 2 && slots.length <= 4, `${def.id}: ${slots}`);
      assert.equal(new Set(slots).size, slots.length);
      for (const key of slots) {
        assert.ok(TIER_GATE[key] <= def.level, `${def.id} cannot use ${key} at Lv${def.level}`);
        assert.ok(skillLevels[key] >= cfg.skills.rank[0] && skillLevels[key] <= cfg.skills.rank[1]);
      }
      const order = slots.map((key) => cfg.skills.priority.indexOf(key));
      assert.deepEqual(order, [...order].sort((x, y) => x - y), 'slots follow priority order');
      for (const key of cfg.skills.fixed) assert.ok(slots.includes(key));
    }
  }
});

test('Lv10 Warrior always has sprout; Pet Master always has a 2-3 star pet at bot level', () => {
  const warrior = bot.ARENA_BOT_DEFS.find((d) => d.archetype === 'warrior');
  const master = bot.ARENA_BOT_DEFS.find((d) => d.archetype === 'pet_master');
  for (let seed = 1; seed <= 40; seed++) {
    assert.equal(bot.arenaBotLoadout(opponentFor(warrior, seed)).pet.defId, 'sprout');
    const pet = bot.arenaBotLoadout(opponentFor(master, seed)).pet;
    assert.ok(pet && pet.star >= 2 && pet.star <= 3 && pet.level === 50);
    assert.ok(bot.ARENA_BOT_LOADOUTS.pet_master.pet.pool.includes(pet.defId));
  }
});

test('gear stats are added on top of the base formula (never below it)', () => {
  for (const def of bot.ARENA_BOT_DEFS) {
    const opponent = opponentFor(def, 777);
    const base = bot.arenaBotBaseStats(opponent);
    const snap = bot.arenaBotSnapshot(opponent);
    assert.ok(snap.stats.atk >= Math.round(base.atk) && snap.stats.def >= Math.round(base.def) && snap.stats.maxHp >= Math.round(base.maxHp), def.id);
    assert.equal(snap.equipment.length, 6);
    assert.equal(snap.agi, undefined);
    assert.equal(snap.stats.agi, def.level);
  }
});

test('legacy bot snapshot (null skillSlots, no pet) still fights with power_strike only', () => {
  const legacy = { type: 'bot', botId: 'arena-warrior', name: 'BOT Warrior', level: 10, rating: 1000, archetype: 'warrior', equipment: [], pet: null, skillSlots: [null, null, null, null] };
  const unit = bot.arenaCombatBotUnit(legacy, 'team_b_hero', 'team_b');
  assert.deepEqual(Array.from(unit.activeSkills), ['power_strike']);
  assert.equal(unit.skills.power_strike, 1);
});

test('new bot snapshot drives hero skills and a Pet unit through the shared arena core', () => {
  const master = bot.ARENA_BOT_DEFS.find((d) => d.archetype === 'pet_master');
  const defender = bot.arenaBotSnapshot(opponentFor(master, 4242));
  const attacker = { type: 'player', name: 'Atk', level: 50, rating: 1500, stats: { maxHp: 400, maxMp: 100, atk: 100, def: 30, accuracy: 95, dodgeChance: 2, critChance: 3, critDamage: 50, agi: 20 }, equipment: [], pet: null, skillSlots: [null, null, null, null], skillLevels: {} };
  const state = bot.arenaCombatState({ seed: 99, attacker, defender }, 'm-test');
  assert.ok(state.units.team_b_pet, 'bot pet unit exists');
  assert.deepEqual(Array.from(state.units.team_b_hero.activeSkills), Array.from(defender.skillSlots).filter(Boolean));
});
