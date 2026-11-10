const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const components = fs.readFileSync(path.join(__dirname, '..', 'src/ui/components.js'), 'utf8');

test('the Arena target cursor moves to a living enemy when the selected one dies (no Invalid target)', () => {
  assert.match(components, /const livingEnemyIds = enemyUnits\.filter\(u => u\.alive\)\.map\(u => u\.id\);/);
  assert.match(components, /const selected = \(selectedTarget && livingEnemyIds\.includes\(selectedTarget\)\) \? selectedTarget : \(livingEnemyIds\[0\]/);
  // Attack and skill buttons submit the validated target, never the raw selectedTarget state.
  assert.match(components, /action\("active", skill, selected\)/);
});
