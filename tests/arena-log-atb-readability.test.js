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
  const entry = { type: 'damage', text: "BOT Poison's Moon Hare use Stunning Blow to asdfghjtk damage 148.", actionName: 'Stunning Blow', actorId: 'b_pet' };
  const segments = arenaLogSegments(entry, units);
  const cls = (text) => segments.find((segment) => segment.text === text)?.cls;
  assert.equal(cls("BOT Poison's Moon Hare"), 'md-alog-name enemy pet');
  assert.equal(cls('asdfghjtk'), 'md-alog-name ally hero');
  assert.equal(cls('Stunning Blow'), 'md-alog-skill');
  assert.equal(cls('148'), 'md-alog-dmg enemy');
  assert.equal(segments.map((segment) => segment.text).join(''), entry.text, 'text is preserved exactly');
  assert.equal(arenaLogSegments({ text: 'a use Heal to b heal 20.' }, {}).find((segment) => segment.text === '20').cls, 'md-alog-heal');
});

test('enemy Pet uses the same red as the enemy Hero', () => {
  assert.match(styles, /\.md-alog-name\.enemy\.hero \{ color:(#[0-9a-f]+);/i);
  const hero = styles.match(/\.md-alog-name\.enemy\.hero \{ color:(#[0-9a-f]+);/i)[1];
  assert.match(styles, new RegExp(`\\.md-alog-name\\.enemy\\.pet \\{ color:${hero};`, 'i'));
});

test('every attack reads "use"; Round is displayed as Turn; basic attacks are not highlighted', () => {
  const basic = { type: 'damage', text: "asdfghjtk's Sprout basic attack to BOT Warrior damage 1.", actorId: 'a_pet', actionName: 'basic attack' };
  const segs = arenaLogSegments(basic, units);
  assert.equal(segs.map((segment) => segment.text).join(''), "asdfghjtk's Sprout use basic attack to BOT Warrior damage 1.");
  assert.equal(segs.some((segment) => segment.cls === 'md-alog-skill'), false);
  const counter = arenaLogSegments({ type: 'damage', text: 'asdfghjtk counter attack to BOT Warrior damage 3.', actorId: 'a_hero', actionName: 'counter attack' }, units);
  assert.match(counter.map((segment) => segment.text).join(''), /asdfghjtk use counter attack to/);
  const skill = arenaLogSegments({ type: 'damage', text: 'BOT Warrior use Guard to asdfghjtk damage 25.', actorId: 'b_hero', actionName: 'Guard' }, units);
  assert.equal(skill.find((segment) => segment.text === 'Guard').cls, 'md-alog-skill');
  assert.equal(arenaLogSegments({ type: 'round', text: 'Round 2' }, units).map((segment) => segment.text).join(''), 'Turn 2');
  assert.match(components, /`Turn \$\{match\.state\?\.round \|\| 0\} \/ 20`/);
});

test('damage colour follows the side that dealt it; crits use the darker shade', () => {
  const dmg = (actorId, crit) => arenaLogSegments({ type: 'damage', text: 'x use Y to z damage 9.', actorId, crit, actionName: 'Y' }, units).find((segment) => segment.text === '9').cls;
  assert.equal(dmg('a_hero', false), 'md-alog-dmg ally');
  assert.equal(dmg('a_pet', true), 'md-alog-dmg ally crit');
  assert.equal(dmg('b_hero', false), 'md-alog-dmg enemy');
  assert.equal(dmg('b_pet', true), 'md-alog-dmg enemy crit');
  assert.match(styles, /\.md-alog-dmg\.ally \{ color:#5cc8ff; \}/);
  assert.match(styles, /\.md-alog-dmg\.ally\.crit \{ color:#2b7fff;/);
  assert.match(styles, /\.md-alog-dmg\.enemy \{ color:#ffb347; \}/);
  assert.match(styles, /\.md-alog-dmg\.enemy\.crit \{ color:#ff7a18;/);
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
