const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const comps = read("src/ui/components.js");
const app = read("src/ui/App.js");
const between = (source, from, to) => source.slice(source.indexOf(from), source.indexOf(to, source.indexOf(from)));
const overlay = between(comps, "function AccountSettingsOverlay(", "function GameDock(");

test("More menu: Settings content is one tap away (sound, account, character, info) plus Friend; no Save/Chat/Guild/Main Hub duplicates", () => {
  const dock = between(comps, "function GameDock", "// Renders the icon+amount chips");
  ["sound", "account", "character", "info"].forEach(page => assert.match(dock, new RegExp(`openSettings\\("${page}"\\)`), page));
  assert.match(dock, /openFriend/);
  assert.doesNotMatch(dock, /createElement\("span", null, "Settings"\)/, "no separate Settings entry in More");
  assert.doesNotMatch(dock, /openChat|openGuild|openMainHub|handleSave|saveFlash|onSave/);
});

test("Opening a More entry goes straight to its page; the Settings menu stays as the fallback for other callers", () => {
  assert.match(app, /onSettings: page => setAccountSettingsOpen\(typeof page === "string" \? page : true\)/);
  assert.match(app, /initialPage: typeof accountSettingsOpen === "string" \? accountSettingsOpen : ""/);
  assert.match(overlay, /initialPage === "info"\) return e\(InfoCenterScreen, \{ onClose \}\)/);
  assert.match(overlay, /useState\(direct && initialPage !== "info" \? initialPage : ""\)/);
  assert.match(overlay, /page && !direct \? e\("button"/, "back arrow only when reached through the Settings menu");
  assert.match(overlay, /onClick: onClose, "aria-label": "Close settings"/);
  assert.match(overlay, /page === "sound" \? soundPage : page === "account" \? accountPage : page === "character" \? characterPage : menuPage/);
});

test("Sub-pages carry the previous sections; logout is on the character page and at the bottom of the menu", () => {
  assert.match(between(overlay, "const accountPage", "const characterPage"), /Recovery Code[\s\S]*Change Password/);
  assert.match(between(overlay, "const soundPage", "const accountPage"), /BGM[\s\S]*SFX/);
  assert.match(between(overlay, "const characterPage", "const menuPage"), /onSwitchCharacter[\s\S]*onLogout/);
  assert.match(overlay, /className: "md-settings-logout"/);
});

test("Sync status replaces the Save button: retry is only offered when a sync failed", () => {
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

test("Every entry point that feeds the More menu forwards the requested page (regression: Hub ignored it and always opened the menu)", () => {
  const lambdas = app.match(/(onSettings|onAccountSettings): [^\n]*setAccountSettingsOpen\([^\n]*\),/g) || [];
  assert.ok(lambdas.length >= 8, `found ${lambdas.length}`);
  lambdas.forEach(line => assert.match(line, /page => setAccountSettingsOpen\(typeof page === "string" \? page : true\)/, line));
  assert.doesNotMatch(app, /(onSettings|onAccountSettings): \(\) => setAccountSettingsOpen/);
  // screens hand the handler to GameDock without dropping the argument
  assert.match(comps, /onSettings: onAccountSettings,/);
});
