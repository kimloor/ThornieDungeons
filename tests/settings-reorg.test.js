const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const comps = read("src/ui/components.js");
const app = read("src/ui/App.js");
const between = (source, from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));

test("More menu: only Settings and Friend remain (no Save, Chat, Guild, Main Hub duplicates)", () => {
  const dock = between(comps, "function GameDock", "// Renders the icon+amount chips");
  assert.match(dock, /openSettings/);
  assert.match(dock, /openFriend/);
  assert.doesNotMatch(dock, /openChat|openGuild|openMainHub|handleSave|saveFlash|onSave/);
});

test("Settings is a menu of sub-pages: sound, account & security, character & data, information; logout stays separate", () => {
  const overlay = between(comps, "function AccountSettingsOverlay(", "function GameDock(");
  ["sound", "account", "character"].forEach(key => assert.match(overlay, new RegExp(`goPage\\("${key}"\\)`), key));
  assert.match(overlay, /setInfoOpen\(true\)/);
  assert.match(overlay, /className: "md-settings-logout"/);
  assert.match(overlay, /page === "sound" \? soundPage : page === "account" \? accountPage : page === "character" \? characterPage : menuPage/);
  // sub-pages carry the previous sections unchanged
  assert.match(between(overlay, "const accountPage", "const characterPage"), /Recovery Code[\s\S]*Change Password/);
  assert.match(between(overlay, "const soundPage", "const accountPage"), /BGM[\s\S]*SFX/);
  // back arrow only on a sub-page; close always available
  assert.match(overlay, /page \? e\("button", \{ className: "md-btn info small md-settings-close", onClick: \(\) => goPage\(""\)/);
  assert.match(overlay, /onClick: onClose, "aria-label": "Close settings"/);
});

test("Sync status replaces the Save button: retry is only offered when a sync failed", () => {
  const overlay = between(comps, "function AccountSettingsOverlay(", "function GameDock(");
  assert.match(overlay, /syncStatus === "failed" \? e\("button"[\s\S]*retrySync/);
  assert.match(app, /syncStatus: persistenceStatus,\s*onRetrySync: manualSave/);
});

test("Autosave evidence: inventory commits enqueue immediately, failed syncs retry on reconnect/visibility, logout and switch flush", () => {
  assert.match(app, /const commitInventorySnapshot = useCallback\([\s\S]*?persistInventorySnapshot\(snapshot\.inventory, eq, snapshot\.overflow\)/);
  assert.match(app, /persistenceRef\.current\.enqueue\(context, "items"/);
  assert.match(app, /window\.addEventListener\("online", retryCurrent\)/);
  assert.match(app, /document\.addEventListener\("visibilitychange", retryCurrent\)/);
  assert.match(app, /flushedBeforeLogout = await flushCurrentCharacter\(\)/);
  assert.match(app, /key: "character\.switch"[\s\S]*flushCurrentCharacter\(\)/);
});
