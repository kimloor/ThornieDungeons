const test = require('node:test');
const assert = require('node:assert/strict');
const enhancement = require('../src/systems/enhancementV2.js');
const reward = require('../src/systems/rewardV2.js');
const vm = require('node:vm');
const shopSource = require('node:fs').readFileSync(require('node:path').join(__dirname, '../src/systems/shop.js'), 'utf8');

test('Empower V2.1 fills every new rarity slot and reroll preserves option type', () => {
  for (const [rarity, count] of Object.entries(enhancement.EMPOWER_CAPACITY)) {
    const slots = enhancement.fillEmpowerSlots('wings', rarity, () => 0.21);
    assert.equal(slots.length, count);
    assert.equal(slots.every(Boolean), true);
  }
  const before = enhancement.rollEmpowerOption('wings', 0, 0);
  const after = enhancement.rerollEmpowerOptionValue('wings', before, 0.99);
  assert.equal(after.key, before.key);
  assert.notEqual(after.value, undefined);
  assert.equal(after.locked, false);
});

test('Wing family primary stat contributes to sell valuation', () => {
  const sandbox = { RARITY_MULT: { rare: 1 }, JUNK_SELL_VALUE: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(`${shopSource}\nthis.sellPrice = sellPrice;`, sandbox);
  const base = sandbox.sellPrice({ type: 'wings', rarity: 'rare', wingFamily: 'robot', enhanceLevel: 0, empowerSlots: [] });
  const enhanced = sandbox.sellPrice({ type: 'wings', rarity: 'rare', wingFamily: 'robot', enhanceLevel: 7, empowerSlots: [{ key: 'vit', value: 1, locked: false }] });
  assert.ok(enhanced > base);
  assert.ok(enhanced > 3);
});
