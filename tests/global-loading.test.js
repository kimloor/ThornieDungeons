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
  advance(30000);
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
  assert.doesNotMatch(app, /app\.bootstrap/, "Owner decision: no overlay on app bootstrap");
  assert.match(app, /label: "กำลังเข้าเกม โปรดรอสักครู่"/);
  assert.match(app, /GLOBAL_LOADING\.run\(\{ key: "character\.create"/);
  assert.match(app, /GLOBAL_LOADING\.run\(\{ key: "character\.delete"/);
  assert.match(app, /GLOBAL_LOADING\.run\(\{ key: "character\.switch"[^)]*\)[^;]*flushCurrentCharacter/);
  // logout: token released before any alert
  const logout = app.slice(app.indexOf("async function logout()"), app.indexOf("async function requireLoginAfterSecurityChange"));
  assert.ok(logout.indexOf("logoutLoading.release()") > -1 && logout.indexOf("logoutLoading.release()") < logout.indexOf("window.alert"));
  // dungeon entry: released on success, failure, and resume-restore fallback
  const stage = app.slice(app.indexOf("function enterStage("), app.indexOf("function buildPetCombatUnit("));
  assert.match(stage, /GLOBAL_LOADING\.begin\(\{ key: "dungeon\.enter"/);
  assert.equal((stage.match(/stageLoading\.release\(\)/g) || []).length, 2, "released only on error and resume fallback; success is handed to CombatScreen");
  assert.match(stage, /maxMs: 45000/);
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

test("Global Loading: Retry is offered only for owners that declare an idempotent onRetry, and runs beforeRetry first", async () => {
  const order = [];
  const { manager, advance } = harness({ beforeRetry: () => order.push("before"), probe: async () => ({ ok: true, ms: 42 }) });
  manager.begin({ key: "reload", onRetry: () => order.push("retry") });
  manager.begin({ key: "mutation" });
  advance(30000);
  assert.equal(manager.getSnapshot().staleNotice.canRetry === false || manager.getSnapshot().staleNotice.canRetry === true, true);
  // the last stale owner's notice wins; release order is by creation so "mutation" fired second
  assert.equal(manager.getSnapshot().staleNotice.key, "mutation");
  assert.equal(manager.getSnapshot().staleNotice.canRetry, false);
  manager.retryStale();
  assert.deepEqual(order, ["before"], "no onRetry for a non-idempotent owner: nothing is re-run");
  const second = harness({ beforeRetry: () => order.push("before2") });
  second.manager.begin({ key: "reload", onRetry: () => order.push("retry2") });
  second.advance(30000);
  assert.equal(second.manager.getSnapshot().staleNotice.canRetry, true);
  second.manager.retryStale();
  assert.deepEqual(order.slice(1), ["before2", "retry2"]);
  assert.equal(second.manager.getSnapshot().staleNotice, null);
});

test("Global Loading: stale notice probes the server and can re-check or be dismissed", async () => {
  let ok = false;
  const { manager, advance } = harness({ probe: async () => ({ ok, ms: 17 }) });
  manager.begin({ key: "slow" });
  advance(30000);
  assert.equal(manager.getSnapshot().staleNotice.connection, "checking");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(manager.getSnapshot().staleNotice.connection, "down");
  ok = true;
  manager.recheckConnection();
  assert.equal(manager.getSnapshot().staleNotice.connection, "checking");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(manager.getSnapshot().staleNotice.connection, "ok");
  assert.equal(manager.getSnapshot().staleNotice.ms, 17);
  manager.dismissStale();
  assert.equal(manager.getSnapshot().staleNotice, null);
});

test("Global Loading: a throwing probe is reported as down, never as success", async () => {
  const { manager, advance } = harness({ probe: async () => { throw new Error("x"); } });
  manager.begin({ key: "slow" });
  advance(30000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(manager.getSnapshot().staleNotice.connection, "down");
});

test("API client: GET times out into network_error and cloudResetInFlight lets a retry start fresh", async () => {
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "..", "src/state/api.js"), "utf8");
  let calls = 0;
  const sandbox = {
    console, setTimeout, clearTimeout, URLSearchParams, AbortController, JSON,
    fetch: (url, options = {}) => { calls += 1; return new Promise((resolve, reject) => { options.signal?.addEventListener("abort", () => reject(new Error("aborted"))); }); }
  };
  vm.createContext(sandbox);
  vm.runInContext(source + "\n;globalThis.__api = { cloudGet, cloudResetInFlight };", sandbox);
  const result = await sandbox.__api.cloudGet("https://x.test", { action: "a" }, { timeoutMs: 20 });
  assert.equal(result.error, "network_error");
  assert.ok(calls >= 1);
  assert.equal(typeof sandbox.__api.cloudResetInFlight, "function");
});

test("Global Loading: overlay notice exposes Retry / re-check / dismiss and idempotent screens declare onRetry", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const overlay = read("src/ui/GlobalLoadingOverlay.js");
  assert.match(overlay, /source\.retryStale\(\)/);
  assert.match(overlay, /source\.recheckConnection\(\)/);
  assert.match(overlay, /source\.dismissStale\(\)/);
  const comp = read("src/ui/components.js");
  ["loadAll", "loadMyGuild", "handleRefresh", "load"].forEach(name => assert.ok(comp.includes(`() => ${name}());`), name));
  assert.match(comp, /key: "arena\.hub"[^}]*onRetry/);
  const app = read("src/ui/App.js");
  // mutations must NOT declare a retry (double-create/consume risk)
  ["character.create", "character.delete", "dungeon.enter", "account.logout", "character.switch"].forEach(key => {
    const i = app.indexOf(`key: "${key}"`);
    assert.ok(i > -1 && !app.slice(i, i + 160).includes("onRetry"), key);
  });
  assert.doesNotMatch(comp.slice(comp.indexOf('key: "arena.prepare"'), comp.indexOf('key: "arena.prepare"') + 160), /onRetry/);
});

test("Global Loading V3: Dungeon overlay is held until the Phaser stage is ready, then released by key", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const comp = read("src/ui/components.js");
  assert.match(comp, /if \(phaserStatus === "ready" \|\| phaserStatus === "error"\) GLOBAL_LOADING\.releaseKey\("dungeon\.enter"\)/);
  const { createGlobalLoadingManager } = require("../src/state/globalLoading.js");
  let time = 0;
  const timers = new Map(); let seq = 1;
  const manager = createGlobalLoadingManager({
    now: () => time,
    setTimeout: (fn, ms) => { const id = seq++; timers.set(id, { fn, at: time + ms }); return id; },
    clearTimeout: id => timers.delete(id)
  });
  const token = manager.begin({ key: "dungeon.enter", maxMs: 45000 });
  manager.begin({ key: "other" });
  manager.releaseKey("dungeon.enter");
  assert.equal(token.isActive(), false);
  assert.equal(manager.getSnapshot().blockingCount, 1, "releaseKey must not touch other owners");
  manager.releaseKey("dungeon.enter");
  assert.equal(manager.getSnapshot().blockingCount, 1, "releaseKey is idempotent");
});

test("Global Loading V3: confirming the battle result (victory, defeat, flee) is covered and released before errors", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "src/ui/App.js"), "utf8");
  const finish = app.slice(app.indexOf("async function finishCoreBattle("), app.indexOf("function retryTerminalBattle()"));
  assert.match(finish, /GLOBAL_LOADING\.begin\(\{ key: "battle\.confirm", label: "กำลังยืนยันผลการต่อสู้…" \}\)/);
  assert.ok(finish.indexOf("confirmLoading.release()") < finish.indexOf('setBattleFinishStatus("error")'), "released before the error state");
  assert.match(finish, /finally \{\s*confirmLoading\.release\(\);\s*\}/);
  // "fled" ends through the same terminal flow
  assert.match(app, /next\.result === "fled"\) \{\s*backToMap\(\)/);
});

test("Global Loading V3: Arena history/ranking load once per hub visit and are invalidated by match/refresh", () => {
  const comp = fs.readFileSync(path.join(__dirname, "..", "src/ui/components.js"), "utf8");
  assert.match(comp, /const arenaTabCacheRef = React\.useRef\(\{ history: false, ranking: false \}\)/);
  assert.match(comp, /const loadTab = async \(next, force = false\)/);
  assert.match(comp, /next === "history" && \(force \|\| !cache\.history\)/);
  assert.match(comp, /next === "ranking" && \(force \|\| !cache\.ranking\)/);
  assert.match(comp, /onRetry: \(\) => loadTab\(next, true\)/);
  // cache is only marked after a successful response and is reset on refresh and on adopting a match
  assert.match(comp, /if \(!res\?\.error\) arenaTabCacheRef\.current\.history = true/);
  assert.ok((comp.match(/arenaTabCacheRef\.current = \{ history: false, ranking: false \}/g) || []).length >= 2);
});

test("Global Loading V4: mailbox delete, arena opponent refresh, shop refresh and pet gacha are covered", () => {
  const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const comp = read("src/ui/components.js");
  const app = read("src/ui/App.js");
  // all three mailbox delete paths (single, selected, all claimed)
  assert.equal((comp.match(/OPERATIONS\.run\(\{ key: "mailbox\.delete", group: "mailbox", characterId, ui: "overlay", label: "กำลังลบจดหมาย…", conflict: "reject" \}/g) || []).length, 3);
  assert.match(comp, /GLOBAL_LOADING\.run\(\{ key: "arena\.refresh", label: "กำลังรีเฟรชคู่ต่อสู้…" \}, \(\) => cloudRefreshArenaV2Opponents/);
  // shop: full-screen overlay (blocks every buy path) plus a defensive guard inside the sheet
  // PR-A: the operation manager owns the shop overlay (one token per intent); the component no longer opens its own
  assert.match(app, /key: "shop\.refresh", group: "shop", characterId, ui: "overlay"/);
  assert.doesNotMatch(comp, /GLOBAL_LOADING\.run\(\{key:"shop\.refresh"/);
  assert.match(comp, /const guardBuy=\(canAfford,action\)=>\{if\(disabled\|\|refreshing\)return;/);
  // PR-A: gacha overlay is owned by the operation manager
  assert.match(app, /key: "pet\.gacha", group: "pet", characterId, ui: "overlay"/);
  // these are mutations: none may declare a retry
  ["mailbox.delete", "arena.refresh", "shop.refresh", "pet.gacha"].forEach(key => {
    const source = key === "pet.gacha" || key === "shop.refresh" ? app : comp;
    const i = source.indexOf(key);
    assert.ok(i > -1 && !source.slice(i, i + 140).includes("onRetry"), key);
  });
});
