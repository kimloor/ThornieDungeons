const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  createGlobalLoadingManager,
  normalizeGlobalLoadingProgress,
  sanitizeGlobalLoadingLabel
} = require("../src/state/globalLoading.js");

function harness(options = {}) {
  let time = 0;
  let seq = 1;
  const timers = new Map();
  const stale = [];
  const manager = createGlobalLoadingManager({
    now: () => time,
    setTimeout: (fn, ms) => { const id = seq++; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimeout: id => timers.delete(id),
    onStale: info => stale.push(info),
    ...options
  });
  function advance(ms) {
    const target = time + ms;
    for (;;) {
      const due = Array.from(timers.entries()).filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      time = due[1].at;
      timers.delete(due[0]);
      due[1].fn();
    }
    time = target;
  }
  return { manager, advance, stale, timers: () => timers.size };
}

test("Global Loading: fast operation never shows the overlay", () => {
  const { manager, advance } = harness();
  const token = manager.begin({ key: "fast" });
  advance(100);
  assert.equal(manager.getSnapshot().visible, false);
  token.release();
  advance(1000);
  assert.equal(manager.getSnapshot().visible, false);
});

test("Global Loading: shows after the delay and honors minimum visible time", () => {
  const { manager, advance } = harness();
  const token = manager.begin({ key: "slow", label: "กำลังโหลด" });
  advance(149);
  assert.equal(manager.getSnapshot().visible, false);
  advance(1);
  assert.equal(manager.getSnapshot().visible, true);
  advance(50);
  token.release();
  assert.equal(manager.getSnapshot().visible, true, "must stay visible for the minimum duration");
  advance(249);
  assert.equal(manager.getSnapshot().visible, true);
  advance(1);
  assert.equal(manager.getSnapshot().visible, false);
});

test("Global Loading: overlay hides immediately when minimum visible time already elapsed", () => {
  const { manager, advance } = harness();
  const token = manager.begin({ key: "long" });
  advance(150 + 1000);
  assert.equal(manager.getSnapshot().visible, true);
  token.release();
  assert.equal(manager.getSnapshot().visible, false);
});

test("Global Loading: concurrent tokens keep the overlay until the last owner releases", () => {
  const { manager, advance } = harness();
  const a = manager.begin({ key: "a", label: "A" });
  const b = manager.begin({ key: "b", label: "B" });
  advance(150 + 1000);
  assert.equal(manager.getSnapshot().blockingCount, 2);
  assert.equal(manager.getSnapshot().label, "B");
  b.release();
  assert.equal(manager.getSnapshot().visible, true);
  assert.equal(manager.getSnapshot().label, "A");
  a.release();
  assert.equal(manager.getSnapshot().visible, false);
});

test("Global Loading: double release is idempotent and cannot dismiss another owner", () => {
  const { manager, advance } = harness();
  const a = manager.begin({ key: "a" });
  const b = manager.begin({ key: "b" });
  advance(1500);
  a.release();
  a.release();
  assert.equal(manager.getSnapshot().blockingCount, 1);
  assert.equal(manager.getSnapshot().visible, true);
  b.release();
  assert.equal(manager.getSnapshot().visible, false);
});

test("Global Loading: non-blocking owners never show the overlay", () => {
  const { manager, advance } = harness();
  const bg = manager.begin({ key: "autosave", blocking: false });
  advance(5000);
  assert.equal(manager.getSnapshot().visible, false);
  assert.equal(manager.getSnapshot().activeCount, 1);
  assert.equal(manager.hasBlockingOwner(), false);
  bg.release();
});

test("Global Loading: progress is determinate only for real counts and never time-derived", () => {
  assert.equal(normalizeGlobalLoadingProgress(undefined, undefined), null);
  assert.equal(normalizeGlobalLoadingProgress(3, 0), null);
  assert.equal(normalizeGlobalLoadingProgress(-1, 10), null);
  assert.equal(normalizeGlobalLoadingProgress("x", 10), null);
  assert.deepEqual(normalizeGlobalLoadingProgress(12, 10), { current: 10, total: 10 });
  const { manager, advance } = harness();
  const token = manager.begin({ key: "preload" });
  advance(5000);
  assert.equal(manager.getSnapshot().mode, "indeterminate");
  token.update({ current: 3, total: 12 });
  assert.equal(manager.getSnapshot().mode, "determinate");
  assert.equal(manager.getSnapshot().percent, 25);
  token.release();
});

test("Global Loading: run() releases on success, rethrows failures untouched, releases before caller error UI", async () => {
  const { manager } = harness();
  assert.equal(await manager.run({ key: "ok" }, async () => 42), 42);
  assert.equal(manager.getSnapshot().activeCount, 0);
  const boom = new Error("boom");
  let ownersDuringCatch = -1;
  await manager.run({ key: "bad" }, async () => { throw boom; }).catch(error => {
    ownersDuringCatch = manager.getSnapshot().activeCount;
    assert.equal(error, boom);
  });
  assert.equal(ownersDuringCatch, 0, "ownership must be released before the caller handles the error");
});

test("Global Loading: stale owner failsafe auto-dismisses, shows a transient notice, never reports success", () => {
  const { manager, advance, stale } = harness();
  manager.begin({ key: "forgotten", label: "x" });
  advance(29999);
  assert.equal(manager.getSnapshot().blockingCount, 1);
  assert.equal(manager.getSnapshot().staleNotice, null);
  advance(1);
  assert.equal(manager.getSnapshot().blockingCount, 0);
  assert.equal(manager.getSnapshot().visible, false, "overlay must not stay after the failsafe (min-visible already elapsed)");
  assert.equal(stale.length, 1);
  assert.equal(stale[0].key, "forgotten");
  assert.equal(manager.getSnapshot().staleNotice.key, "forgotten");
  advance(5000);
  assert.equal(manager.getSnapshot().staleNotice, null, "notice clears itself");
});

test("Global Loading: per-owner maxMs overrides the default and late release after stale is a no-op", () => {
  const { manager, advance } = harness();
  const token = manager.begin({ key: "quick-fail", maxMs: 5000 });
  advance(5000);
  assert.equal(manager.getSnapshot().blockingCount, 0);
  assert.equal(token.isActive(), false);
  token.release();
  assert.equal(manager.getSnapshot().blockingCount, 0);
});

test("Global Loading: releasing before show delay leaves no pending timers", () => {
  const { manager, timers } = harness();
  manager.begin({ key: "x" }).release();
  assert.equal(timers(), 0);
});

test("Global Loading: labels are bounded, plain text and fall back safely", () => {
  assert.equal(sanitizeGlobalLoadingLabel("  a \n  b  ", 80, "fb"), "a b");
  assert.equal(sanitizeGlobalLoadingLabel({ stack: "secret" }, 80, "fb"), "fb");
  assert.equal(sanitizeGlobalLoadingLabel("", 80, "fb"), "fb");
  assert.equal(sanitizeGlobalLoadingLabel("x".repeat(200), 20, "fb").length, 20);
});

test("Global Loading: subscribers are notified only on real snapshot changes and can unsubscribe", () => {
  const { manager, advance } = harness();
  const seen = [];
  const off = manager.subscribe(s => seen.push(s.visible));
  const token = manager.begin({ key: "n" });
  advance(150);
  token.release();
  advance(400);
  off();
  manager.begin({ key: "after" });
  advance(1000);
  assert.deepEqual(seen.filter((v, i, a) => i === 0 || v !== a[i - 1]), [false, true, false]);
});

test("Global Loading: build wiring, overlay accessibility, mount and Character Select integration", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const build = read("build.js");
  assert.ok(build.indexOf('"state/globalLoading.js"') > build.indexOf('"state/auth.js"'));
  assert.ok(build.indexOf('"ui/GlobalLoadingOverlay.js"') < build.indexOf('"ui/App.js"'));
  const overlay = read("src/ui/GlobalLoadingOverlay.js");
  assert.match(overlay, /role: "status"/);
  assert.match(overlay, /"aria-busy": "true"/);
  assert.match(overlay, /role: "progressbar"/);
  assert.match(overlay, /safe-area-inset-top/);
  assert.match(overlay, /prefers-reduced-motion: reduce/);
  assert.match(read("tail.html"), /React\.createElement\(GlobalLoadingOverlay, null\)/);
  const app = read("src/ui/App.js");
  assert.match(app, /GLOBAL_LOADING\.begin\(\{ key: "character\.enter"/);
  assert.match(app, /finally \{\s*enterLoading\.release\(\);\s*\}\s*if \(res\.error\)/, "release must precede the existing error handling");
});

test("Global Loading V2: every wired target begins a token and releases on all exits", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const app = read("src/ui/App.js");
  const comp = read("src/ui/components.js");
  const manifest = read("src/assets/manifest.js");
  // App-level flows
  assert.match(app, /GLOBAL_LOADING\.begin\(\{ key: "app\.bootstrap"/);
  assert.match(app, /\} finally \{\s*bootLoading\.release\(\);\s*\}/);
  assert.match(app, /GLOBAL_LOADING\.run\(\{ key: "character\.create"/);
  assert.match(app, /GLOBAL_LOADING\.run\(\{ key: "character\.delete"/);
  assert.match(app, /GLOBAL_LOADING\.run\(\{ key: "character\.switch"[^)]*\)[^;]*flushCurrentCharacter/);
  // logout: token released before any alert
  const logout = app.slice(app.indexOf("async function logout()"), app.indexOf("async function requireLoginAfterSecurityChange"));
  assert.ok(logout.indexOf("logoutLoading.release()") > -1 && logout.indexOf("logoutLoading.release()") < logout.indexOf("window.alert"));
  // dungeon entry: released on success, failure, and resume-restore fallback
  const stage = app.slice(app.indexOf("function enterStage("), app.indexOf("function buildPetCombatUnit("));
  assert.match(stage, /GLOBAL_LOADING\.begin\(\{ key: "dungeon\.enter"/);
  assert.equal((stage.match(/stageLoading\.release\(\)/g) || []).length, 4);
  assert.match(stage, /\.catch\(error => \{\s*stageLoading\.release\(\);/);
  assert.match(stage, /preloadBattleCriticalAssets\(battleAssets, \(current, total\) => stageLoading\.update/);
  // the build patch for the combat-entry handler must keep matching
  assert.match(stage, /criticalAssets\.ready\.finally\(\(\) => \{\s*setPhase\("combat"\);/);
  // real preload counts only
  assert.match(manifest, /onProgress\(done, unique\.length\)/);
  // screen-level initial loads
  ["friends.load", "guild.load", "leaderboard.load", "raid.load", "mailbox.load"].forEach(key => {
    assert.ok(comp.includes(`useGlobalLoadingToken(`) && comp.includes(`"${key}"`), key);
  });
  ["arena.hub", "arena.history", "arena.ranking", "arena.prepare"].forEach(key => assert.ok(comp.includes(`key: "${key}"`), key));
  // arena match: released before the error state is set and again in finally
  const arena = comp.slice(comp.indexOf("const matchLoading = GLOBAL_LOADING.begin"), comp.indexOf("const syncArenaMatch"));
  assert.ok(arena.indexOf("matchLoading.release()") < arena.indexOf("setError(error?.message"));
  assert.equal((arena.match(/matchLoading\.release\(\)/g) || []).length, 2);
});

test("Global Loading V2: hooks that read state are declared after that state (no TDZ at render)", () => {
  const comp = fs.readFileSync(path.join(__dirname, "..", "src/ui/components.js"), "utf8");
  const friends = comp.indexOf('useGlobalLoadingToken(friends === null && !loadError');
  assert.ok(friends > comp.indexOf("const [loadError, setLoadError] = useState(\"\")"));
  assert.ok(friends > comp.indexOf("const [friends, setFriends] = useState(null)"));
  const raid = comp.indexOf('useGlobalLoadingToken(!status && !error, "raid.load"');
  assert.ok(raid > comp.indexOf("const [status, setStatus] = useState(null);"));
  const lb = comp.indexOf('useGlobalLoadingToken(rows === null, "leaderboard.load"');
  assert.ok(lb > comp.indexOf("const [rows, setRows] = useState(null);"));
});
