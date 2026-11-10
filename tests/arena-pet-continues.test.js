const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadWorkerSource } = require('./helpers/worker-source');

const ROOT = path.join(__dirname, '..');
const source = loadWorkerSource(ROOT).replace('export default {', 'const workerDefault = {') + `
globalThis.__arena = { arenaCombatState, arenaCombatAdvance, arenaCombatStep, arenaCombatPublicState };`;
const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, Uint32Array, crypto, atob, btoa, setTimeout, clearTimeout };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const arena = sandbox.__arena;

const stats = (over = {}) => ({ maxHp: 300, maxMp: 100, atk: 40, def: 10, accuracy: 95, dodgeChance: 0, critChance: 0, critDamage: 50, agi: 10, ...over });
const side = (name, over = {}, pet = { instId: `${name}-pet`, defId: 'sprout', level: 30, star: 1 }) => ({
  type: 'player', name, level: 30, rating: 1000, stats: stats(over), equipment: [], pet, skillSlots: [null, null, null, null], skillLevels: {},
});
const snapshot = (rules, attackerOver, defenderOver) => ({
  version: 1, seed: 4242, attacker: side('Atk', attackerOver), defender: side('Def', defenderOver),
  ...(rules ? { combatRules: { petContinues: true } } : {}),
});
// Plays the whole match: the controlled Hero uses basic attacks while alive; everything else is automatic.
function playOut(state) {
  let guard = 0;
  state = arena.arenaCombatAdvance(state);
  while (!state.result && guard++ < 200) {
    const current = sandbox.BATTLE_CORE_V1.currentUnit(state);
    if (current && current.kind === 'hero' && current.side === 'team_a') {
      const target = Object.values(state.units).find((unit) => unit.side === 'team_b' && !unit.dead && unit.hp > 0);
      state = arena.arenaCombatAdvance(arena.arenaCombatStep(state, { type: 'basic', targetId: target.id }).state);
    }
    else state = arena.arenaCombatAdvance(state);
  }
  return state;
}
const kill = (state, id) => { state.units[id].hp = 0; state.units[id].dead = true; };

test('new rules: a downed Hero does not end the match while its Pet lives; the Pet keeps fighting automatically', () => {
  let state = arena.arenaCombatState(snapshot(true), 'm-new');
  assert.equal(state.rules.arenaPetContinues, true);
  kill(state, 'team_a_hero');
  state.units.team_a_pet.atk = 400; // strong Pet so the outcome is decided by the Pet alone
  state = playOut(state);
  assert.equal(state.result, 'victory');
  assert.equal(state.units.team_a_hero.hp, 0);
  assert.ok(state.log.some((entry) => entry.actorId === 'team_a_pet' && entry.type === 'damage'), 'our Pet acted after the Hero died');
});

test('new rules: defeat only when the Hero AND the Pet are both down', () => {
  let state = arena.arenaCombatState(snapshot(true), 'm-lose');
  kill(state, 'team_a_hero');
  state.units.team_b_hero.atk = 600;
  state.units.team_b_pet.atk = 600;
  state = playOut(state);
  assert.equal(state.result, 'defeat');
  assert.equal(state.units.team_a_pet.hp, 0, 'defeat is decided only after the Pet fell');
});

test('new rules: an enemy Hero going down does not win while the enemy Pet is alive', () => {
  let state = arena.arenaCombatState(snapshot(true), 'm-enemy');
  kill(state, 'team_b_hero');
  const first = arena.arenaCombatAdvance(state);
  assert.equal(first.result, null);
  const done = playOut(first);
  assert.equal(done.result, 'victory');
  assert.equal(done.units.team_b_pet.hp, 0);
});

test('legacy snapshots (no combatRules) keep Hero-death-ends-match so old Replays re-simulate identically', () => {
  let state = arena.arenaCombatState(snapshot(false), 'm-old');
  assert.notEqual(state.rules.arenaPetContinues, true);
  kill(state, 'team_a_hero');
  state = playOut(state);
  assert.equal(state.result, 'defeat');
  assert.ok(state.units.team_a_pet.hp > 0, 'Pet was still alive when the old rule ended the match');
});

test('the Arena client moves the target cursor to a living enemy when the selected one dies', () => {
  const components = fs.readFileSync(path.join(ROOT, 'src/ui/components.js'), 'utf8');
  assert.match(components, /const livingEnemyIds = enemyUnits\.filter\(u => u\.alive\)\.map\(u => u\.id\);/);
  assert.match(components, /const selected = \(selectedTarget && livingEnemyIds\.includes\(selectedTarget\)\) \? selectedTarget : \(livingEnemyIds\[0\]/);
});
