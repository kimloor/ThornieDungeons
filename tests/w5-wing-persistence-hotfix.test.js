const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const source = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

test("W5 Wing family metadata overrides legacy Angel fallback", () => {
  const context = { heroVisualSelectionFromEquipment: () => ({ wings: "angel" }) };
  vm.createContext(context);
  vm.runInContext(source("src/phaser/presentation/EquipmentVisualResolver.js"), context);
  const resolved = vm.runInContext(`SHARED_EQUIPMENT_VISUAL_RESOLVER.resolveHeroV5Selection({
    wings: { id: "raid-wing-robot", type: "wings", wingFamily: "robot", name: "Robot Wings" }
  })`, context);
  assert.equal(resolved.wings, "robot");
});

test("Cloud persistence diagnostics preserve response status and stale item identity", () => {
  const { persistenceError } = require("../src/state/persistence.js");
  const error = persistenceError({
    error: "item_not_owned",
    status: 403,
    action: "syncItems",
    itemId: "stale-item-123"
  });
  assert.equal(error.code, "item_not_owned");
  assert.equal(error.status, 403);
  assert.equal(error.response.action, "syncItems");
  assert.equal(error.response.itemId, "stale-item-123");
});

test("Cloud persistence failures render diagnostic popup instead of top save-state banner", () => {
  const app = source("src/ui/App.js");
  const components = source("src/ui/components.js");
  assert.match(app, /PersistenceDiagnosticOverlay/);
  assert.match(app, /setPersistenceDiagnostic\(\{/);
  assert.doesNotMatch(app, /className: `md-save-state md-save-state-\$\{persistenceStatus\}`/);
  assert.match(components, /function PersistenceDiagnosticOverlay/);
  assert.match(components, /Code: \$\{diagnostic\.code/);
  assert.match(components, /Item: \$\{diagnostic\.itemId/);
  assert.match(components, /\[redacted\]/);
});
