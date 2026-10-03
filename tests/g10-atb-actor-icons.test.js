const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('G10 shared ATB icon manifest, export budget and runtime binding', () => {
  const manifest = JSON.parse(read('r2-upload/manifest.json'));
  const contract = JSON.parse(read('r2-upload/ui/battle/G10_ATB_ACTOR_ICON_CONTRACT.json'));
  const expected = {
    hero: 'ui/battle/atb/hero.png',
    pet: 'ui/battle/atb/pet.png',
    monster: 'ui/battle/atb/monster.png',
    boss: 'ui/battle/atb/boss.png'
  };
  assert.deepEqual(manifest.assets.battleUi.actorIcons, expected);
  assert.deepEqual(contract.assets, expected);
  for (const relative of Object.values(expected)) {
    const file = path.join(ROOT, 'r2-upload', relative);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 256);
    assert.ok(bytes.length >= 40 * 1024 && bytes.length <= 120 * 1024, `${relative} must pass shared small-icon budget`);
  }

  const assets = read('src/assets/manifest.js');
  const app = read('src/ui/App.js');
  const ui = read('src/ui/components.js');
  const css = read('src/data/styles.js');
  assert.match(assets, /battleActorIconUrl/);
  for (const role of ['hero', 'pet', 'monster', 'boss']) assert.match(assets, new RegExp(`actorIcons\\.${role}`));
  assert.match(app, /isBoss: unit\.kind === "boss"/);
  assert.match(ui, /function TurnOrderActorIcon/);
  assert.match(ui, /md-turn-queue-spawn-slot/);
  assert.match(ui, /item\.isElite && !item\.isBoss/);
  assert.match(css, /\.md-turn-queue-icon\.elite/);
  assert.match(css, /Ver 1\.0\.38/);
});
