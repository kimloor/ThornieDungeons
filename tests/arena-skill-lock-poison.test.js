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
const components = fs.readFileSync(path.join(ROOT, 'src/ui/components.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');

const stats = (over = {}) => ({ maxHp: 600, maxMp: 100, atk: 40, def: 10, accuracy: 99, dodgeChance: 0, critChance: 0, critDamage: 50, agi: 10, ...over });
const side = (name, over = {}, skillSlots = [null, null, null, null], skillLevels = {}) => ({
  type: 'player', name, level: 30, rating: 1000, stats: stats(over), equipment: [], pet: null, skillSlots, skillLevels,
});
const freshState = () => arena.arenaCombatAdvance(arena.arenaCombatState({
  version: 1, seed: 7, combatRules: { petContinues: true },
  attacker: side('Atk', { agi: 99 }, ['power_strike', null, null, null], { power_strike: 1 }), defender: side('Def'),
}, 'm-skill'));

test('public action metadata reports why an active skill is locked, with turns of cooldown left', () => {
  const state = freshState();
  const ready = arena.arenaCombatPublicState(state).action.activeSkills[0];
  assert.equal(ready.skillId, 'power_strike');
  assert.equal(ready.usable, true);
  assert.equal(ready.cooldownRemaining, 0);
  state.units.team_a_hero.cooldowns.power_strike = 2;
  const locked = arena.arenaCombatPublicState(state).action.activeSkills[0];
  assert.equal(locked.usable, false);
  assert.equal(locked.cooldownRemaining, 2);
  state.units.team_a_hero.cooldowns.power_strike = 0;
  state.units.team_a_hero.sp = 0;
  const noSp = arena.arenaCombatPublicState(state).action.activeSkills[0];
  assert.equal(noSp.usable, false);
  assert.match(noSp.reason, /SP/);
  assert.equal(noSp.cooldownRemaining, 0);
});

test('Arena skill buttons are disabled while locked and show why (CD / No SP / Silenced)', () => {
  assert.match(components, /const skillLocked = !!skillMeta && skillMeta\.usable === false;/);
  assert.match(components, /disabled: busy \|\| !skill \|\| skillLocked,/);
  assert.match(components, /`CD \$\{cooldownLeft\}`/);
  assert.match(components, /"No SP"/);
  assert.match(components, /"Silenced"/);
  assert.match(styles, /\.md-arena-skill-control\.locked \{[^}]*opacity/);
});

test('poison ticks are tagged with cause "poison", survive the public log, and render purple as poison damage', () => {
  let state = freshState();
  state.units.team_a_hero.statuses.poison = { key: 'poison', duration: 2, damage: 5, sourceId: 'team_b_hero', harmful: true };
  const target = 'team_b_hero';
  state = arena.arenaCombatAdvance(arena.arenaCombatStep(state, { type: 'basic', targetId: target }).state);
  const entry = state.log.find((item) => item.cause === 'poison');
  assert.ok(entry, 'poison tick logged with cause');
  assert.equal(entry.targetId, 'team_a_hero');
  const publicEntry = arena.arenaCombatPublicState(state).log.find((item) => item.cause === 'poison');
  assert.equal(publicEntry.cause, 'poison');

  const start = components.indexOf('// ---- Arena battle log presentation');
  const end = components.indexOf('function ArenaPlayerCardOverlay(');
  const ui = { React: { createElement: (type, props, ...children) => ({ type, props, children }) } };
  vm.createContext(ui);
  vm.runInContext(`${components.slice(start, end)}\nglobalThis.__log = { arenaLogSegments };`, ui);
  const units = { a: { id: 'a', side: 'team_a', kind: 'hero', name: 'asdfghjtk' } };
  const segments = ui.__log.arenaLogSegments({ type: 'damage', text: 'asdfghjtk took 12.', cause: 'poison', actorId: 'b', targetId: 'a' }, units);
  assert.equal(segments.map((segment) => segment.text).join(''), 'asdfghjtk took 12 poison damage.');
  assert.equal(segments.find((segment) => segment.text === '12').cls, 'md-alog-dmg poison');
  assert.equal(segments.find((segment) => segment.text === 'poison damage').cls, 'md-alog-status');
  assert.match(styles, /\.md-alog-dmg\.poison \{ color:#c79bff;/);
});

test('the bottom Target buttons are gone', () => {
  assert.doesNotMatch(components, /md-arena-target-row/);
  assert.doesNotMatch(styles, /md-arena-target-row/);
});
