const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const components = fs.readFileSync(path.join(ROOT, 'src/ui/components.js'), 'utf8');
const styles = fs.readFileSync(path.join(ROOT, 'src/data/styles.js'), 'utf8');
const start = components.indexOf('// ---- Arena battle log presentation');
const end = components.indexOf('function ArenaPlayerCardOverlay(');
assert.ok(start > 0 && end > start);
const sandbox = { React: { createElement: (type, props, ...children) => ({ type, props, children }) } };
vm.createContext(sandbox);
vm.runInContext(`${components.slice(start, end)}\nglobalThis.__log = { arenaLogDisplayOrder, arenaLogSegments, arenaLogLineElement };`, sandbox);
const { arenaLogDisplayOrder, arenaLogSegments, arenaLogLineElement } = sandbox.__log;

const units = {
  a_hero: { id: 'a_hero', side: 'team_a', kind: 'hero', name: 'asdfghjtk' },
  a_pet: { id: 'a_pet', side: 'team_a', kind: 'pet', name: "asdfghjtk's Sprout" },
  b_hero: { id: 'b_hero', side: 'team_b', kind: 'hero', name: 'BOT Poison' },
  b_pet: { id: 'b_pet', side: 'team_b', kind: 'pet', name: "BOT Poison's Moon Hare" },
};

test('status caused by a skill is shown under the skill line, not before it', () => {
  const log = [
    { type: 'battle_start', text: 'Battle started' },
    { type: 'status', text: 'asdfghjtk gained stun', actorId: 'b_hero', targetId: 'a_hero', status: 'stun' },
    { type: 'damage', text: 'BOT Poison use Stunning Blow to asdfghjtk damage 148.', actorId: 'b_hero', targetId: 'a_hero', amount: 148, actionName: 'Stunning Blow' },
    { type: 'damage', text: "BOT Poison's Moon Hare basic attack to asdfghjtk damage 12.", actorId: 'b_pet', targetId: 'a_hero', amount: 12 },
  ];
  const ordered = arenaLogDisplayOrder(log);
  assert.deepEqual(Array.from(ordered, (entry) => entry.type), ['battle_start', 'damage', 'status', 'damage']);
  assert.equal(log[1].type, 'status', 'source log is not mutated');
});

test('status entries that do not belong to the next action keep their order', () => {
  const log = [
    { type: 'damage', text: 'x damage 5.', actorId: 'b_hero', targetId: 'a_hero' },
    { type: 'status', text: 'y gained poison', actorId: 'b_hero', targetId: 'a_hero', status: 'poison' },
    { type: 'round', text: 'Round 2' },
    { type: 'damage', text: 'z damage 7.', actorId: 'b_hero', targetId: 'a_hero' },
  ];
  assert.deepEqual(Array.from(arenaLogDisplayOrder(log), (entry) => entry.type), ['damage', 'status', 'round', 'damage']);
  assert.equal(arenaLogDisplayOrder(undefined).length, 0);
});

test('names colour by side and hero/pet; longest unit name wins; numbers and skills are tagged', () => {
  const entry = { type: 'damage', text: "BOT Poison's Moon Hare use Stunning Blow to asdfghjtk damage 148.", actionName: 'Stunning Blow' };
  const segments = arenaLogSegments(entry, units);
  const cls = (text) => segments.find((segment) => segment.text === text)?.cls;
  assert.equal(cls("BOT Poison's Moon Hare"), 'md-alog-name enemy pet');
  assert.equal(cls('asdfghjtk'), 'md-alog-name ally hero');
  assert.equal(cls('Stunning Blow'), 'md-alog-skill');
  assert.equal(cls('148'), 'md-alog-dmg');
  assert.equal(segments.map((segment) => segment.text).join(''), entry.text, 'text is preserved exactly');
  assert.equal(arenaLogSegments({ text: 'a use Heal to b heal 20.' }, {}).find((segment) => segment.text === '20').cls, 'md-alog-heal');
});

test('names with regex characters and missing unit maps do not throw', () => {
  const odd = { x: { id: 'x', side: 'team_b', kind: 'hero', name: 'Bad (name)+' } };
  assert.equal(arenaLogSegments({ text: 'Bad (name)+ defeated.' }, odd)[0].cls, 'md-alog-name enemy hero');
  assert.doesNotThrow(() => arenaLogLineElement('plain string line', null, 0));
  const nested = arenaLogLineElement({ type: 'status', text: 'asdfghjtk gained stun', actorId: 'b_hero', status: 'stun' }, units, 1);
  assert.match(nested.props.className, /md-alog-nested/);
});

test('ATB bar colours our side green and enemy side red via side classes', () => {
  assert.match(components, /side: arenaSideById\[item\.id\]/);
  assert.match(components, /side-\$\{item\.side\}/);
  assert.match(styles, /\.md-turn-queue-item\.side-ally \.md-turn-queue-icon \{[^}]*#4ade80/);
  assert.match(styles, /\.md-turn-queue-item\.side-enemy \.md-turn-queue-icon \{[^}]*#ff5d6c/);
});
