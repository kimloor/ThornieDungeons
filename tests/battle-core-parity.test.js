const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const {
  PORT_START,
  PORT_END,
  extractEmbeddedBattleCore,
  assertBattleCoreParity,
  syncBattleCoreText
} = require("../scripts/battle-core-port.js");

test("frontend and Worker Battle Core copies are byte-for-byte identical", () => {
  const source = fs.readFileSync(path.join(root, "src", "systems", "battleCore.js"), "utf8");
  const worker = fs.readFileSync(path.join(root, "workers", "thornie-dungeons-api.js"), "utf8");
  assert.equal(extractEmbeddedBattleCore(worker), source);
  assert.doesNotThrow(() => assertBattleCoreParity(source, worker));
});

test("parity guard rejects a one-character Battle Core drift", () => {
  const source = "alpha\nbeta\n";
  const worker = "prefix\n" + PORT_START + "alpha\nBETA\n" + PORT_END + "\nsuffix\n";
  assert.throws(
    () => assertBattleCoreParity(source, worker),
    /Battle Core parity check failed at line 2/
  );
});

test("sync replaces only the embedded Battle Core region", () => {
  const source = "new-core\n";
  const worker = "prefix\n" + PORT_START + "old-core\n" + PORT_END + "\nsuffix\n";
  const synced = syncBattleCoreText(source, worker);
  assert.equal(
    synced,
    "prefix\n" + PORT_START + "new-core\n" + PORT_END + "\nsuffix\n"
  );
  assert.doesNotThrow(() => assertBattleCoreParity(source, synced));
});
