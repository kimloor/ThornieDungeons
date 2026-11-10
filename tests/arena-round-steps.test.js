const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const components = fs.readFileSync(path.join(__dirname, '..', 'src/ui/components.js'), 'utf8');
const start = components.indexOf('// ---- Arena multi-round presentation');
const end = components.indexOf('function arenaTerminalMatchFromResponse(');
assert.ok(start > 0 && end > start);
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(`${components.slice(start, end)}\nglobalThis.arenaRoundSteps = arenaRoundSteps;`, sandbox);
const arenaRoundSteps = sandbox.arenaRoundSteps;

const unit = (id, hp, maxHp = 100, side = 'team_a', kind = 'hero') => ({ id, hp, maxHp, side, kind, dead: hp <= 0 });
let seq = 0;
const e = (type, text, extra = {}) => ({ seq: ++seq, type, text, ...extra });
// Our Hero (team_a_hero) is already dead; the Pets fight for three more rounds in one response.
const previous = { phase: 'player', log: [{ seq: 1, type: 'round', text: 'Round 1' }, { seq: 2, type: 'damage', text: 'x', actorId: 'team_b_hero', targetId: 'team_a_hero', amount: 40 }] };
seq = 2;
const log = [
  ...previous.log,
  e('round', 'Round 2'),
  e('damage', 'a', { actorId: 'team_a_pet', targetId: 'team_b_pet', amount: 20 }),
  e('damage', 'b', { actorId: 'team_b_pet', targetId: 'team_a_pet', amount: 10 }),
  e('round', 'Round 3'),
  e('damage', 'c', { actorId: 'team_a_pet', targetId: 'team_b_pet', amount: 30 }),
  e('damage', 'd', { actorId: 'team_b_pet', targetId: 'team_a_pet', amount: 15 }),
  e('round', 'Round 4'),
  e('damage', 'e', { actorId: 'team_a_pet', targetId: 'team_b_pet', amount: 50 }),
];
const next = {
  phase: 'done', round: 4, result: { result: 'victory' }, action: null, log,
  units: [unit('team_a_hero', 0), unit('team_a_pet', 75), unit('team_b_hero', 100, 100, 'team_b'), unit('team_b_pet', 0, 100, 'team_b', 'pet')],
};

test('a multi-round batch is split into round-end steps with HP rebuilt from the log', () => {
  const steps = arenaRoundSteps(previous, next);
  assert.equal(steps.length, 2, 'rounds 2 and 3 are played before the final state (round 4 + result)');
  const hp = (step, id) => step.units.find((u) => u.id === id).hp;
  // End of round 2: before rounds 3 (our pet took 15, enemy pet took 30) and 4 (enemy pet took 50) were applied.
  assert.equal(hp(steps[0], 'team_b_pet'), 100 - 20);
  assert.equal(hp(steps[0], 'team_a_pet'), 90);
  assert.equal(steps[0].round, 2);
  assert.equal(hp(steps[1], 'team_b_pet'), 100 - 20 - 30);
  assert.equal(hp(steps[1], 'team_a_pet'), 75);
  assert.equal(steps[1].round, 3);
  for (const step of steps) {
    assert.equal(step.result, null, 'result stays hidden while stepping');
    assert.equal(step.action, null);
    assert.notEqual(step.phase, 'done');
    assert.ok(step.log.length < log.length);
  }
  assert.equal(steps[0].attackCues, 2, 'round 2 chunk holds two attacks (the round marker is not an attack)');
});

test('normal responses (at most one round marker) and first snapshots are not stepped', () => {
  const single = { ...next, log: [...previous.log, e('round', 'Round 2'), e('damage', 'z', { actorId: 'a', targetId: 'b', amount: 5 })] };
  assert.equal(arenaRoundSteps(previous, single).length, 0);
  assert.equal(arenaRoundSteps(null, next).length, 0);
  assert.equal(arenaRoundSteps(previous, { ...next, log: [] }).length, 0);
});

test('object-shaped units keep their shape and the action handler plays the steps before the result', () => {
  const asObject = { ...next, units: Object.fromEntries(next.units.map((u) => [u.id, u])) };
  const steps = arenaRoundSteps(previous, asObject);
  assert.equal(Array.isArray(steps[0].units), false);
  assert.equal(steps[0].units.team_b_pet.hp, 80);
  assert.match(components, /for \(const step of arenaRoundSteps\(currentMatch\.state, next\.state\)\)/);
  assert.match(components, /setMatch\(\{ \.\.\.next, result: null, resultViewModel: undefined, state: step \}\);/);
  assert.match(components, /matchRef\.current\?\.matchId !== currentMatch\.matchId\) return true;/);
});
