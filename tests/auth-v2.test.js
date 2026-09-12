const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");

class D1Statement {
  constructor(database, sql, values = []) { this.database = database; this.sql = sql; this.values = values; }
  bind(...values) { return new D1Statement(this.database, this.sql, values); }
  async first() { return this.database.prepare(this.sql).get(...this.values) || null; }
  async all() { return { results: this.database.prepare(this.sql).all(...this.values) }; }
  async run() { const result = this.database.prepare(this.sql).run(...this.values); return { meta: { changes: Number(result.changes) } }; }
}
class D1Database {
  constructor() { this.raw = new DatabaseSync(":memory:"); }
  prepare(sql) { return new D1Statement(this.raw, sql); }
  async batch(statements) { const results = []; for (const statement of statements) results.push(await statement.run()); return results; }
}

function loadWorkerInternals() {
  let source = fs.readFileSync(path.join(__dirname, "../workers/thornie-dungeons-api.js"), "utf8");
  source = source.replace("export default {", "const workerDefault = {");
  source += `\nglobalThis.__worker = workerDefault; globalThis.__auth = { validPlayerId, validPassword, hashPassword, verifyPasswordHash, handleRegister, handleLogin, handleValidateSession, handleLogout, handleCreateRecoveryCode, handleForgotPassword, handleChangePassword, verifySession, verifyOwnedCharacter };`;
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { auth: sandbox.__auth, worker: sandbox.__worker };
}
const { auth, worker } = loadWorkerInternals();

function createDb() {
  const db = new D1Database();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (id TEXT PRIMARY KEY, password TEXT NOT NULL, created_at TEXT NOT NULL, diamonds INTEGER DEFAULT 0, active_slot INTEGER);
    CREATE TABLE characters (character_id TEXT PRIMARY KEY, player_id TEXT NOT NULL, slot_index INTEGER NOT NULL, name TEXT DEFAULT '', level INTEGER DEFAULT 1, xp INTEGER DEFAULT 0, stat_points INTEGER DEFAULT 0, str INTEGER DEFAULT 0, vit INTEGER DEFAULT 0, agi INTEGER DEFAULT 0, dex INTEGER DEFAULT 0, luk INTEGER DEFAULT 0, gold INTEGER DEFAULT 0, unlocked_floor INTEGER DEFAULT 1, potions INTEGER DEFAULT 2, protection_stones INTEGER DEFAULT 0, chest_pity INTEGER DEFAULT 0, pets_json TEXT DEFAULT '[]', active_pet_id TEXT DEFAULT '', created_at TEXT, updated_at TEXT);
    CREATE TABLE items (item_id TEXT PRIMARY KEY, player_id TEXT, character_id TEXT, slot_type TEXT, equipped INTEGER DEFAULT 0, inventory_slot TEXT, item_template_id TEXT, rarity TEXT, name TEXT, item_level INTEGER DEFAULT 0, enhance_level INTEGER DEFAULT 0, bound INTEGER DEFAULT 0, quantity INTEGER DEFAULT 1, atk INTEGER DEFAULT 0, def INTEGER DEFAULT 0, hp INTEGER DEFAULT 0, mp INTEGER DEFAULT 0, extra_json TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE run_state (character_id TEXT PRIMARY KEY, floor INTEGER, level INTEGER, xp INTEGER, hp INTEGER, mp INTEGER, base_atk INTEGER, base_def INTEGER, base_max_hp INTEGER, base_max_mp INTEGER, run_gold INTEGER, potions INTEGER, updated_at TEXT);
    CREATE TABLE progress (player_id TEXT PRIMARY KEY, bank_gold INTEGER, diamonds INTEGER, best_floor INTEGER, potions INTEGER, char_level INTEGER, char_xp INTEGER, char_points INTEGER, char_str INTEGER, char_vit INTEGER, char_dex INTEGER, char_luk INTEGER, pets_json TEXT, active_pet_id TEXT, updated_at TEXT);
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/migration_v11_auth_v2.sql"), "utf8"));
  return db;
}
async function body(response) { return response.json(); }

test("migration is additive and preserves an existing player's data", () => {
  const db = createDb();
  db.raw.prepare(`INSERT INTO players (id,password,created_at,diamonds,active_slot) VALUES ('Legacy','oldpass','now',77,0)`).run();
  db.raw.prepare(`INSERT INTO characters (character_id,player_id,slot_index,name,level,gold) VALUES ('c1','Legacy',0,'Hero',12,345)`).run();
  db.raw.prepare(`INSERT INTO items (item_id,player_id,character_id,name) VALUES ('i1','Legacy','c1','Sword')`).run();
  assert.equal(db.raw.prepare(`SELECT diamonds FROM players WHERE id='Legacy'`).get().diamonds, 77);
  assert.equal(db.raw.prepare(`SELECT level,gold FROM characters WHERE character_id='c1'`).get().level, 12);
  assert.equal(db.raw.prepare(`SELECT name FROM items WHERE item_id='i1'`).get().name, "Sword");
  assert.equal(db.raw.prepare(`SELECT auth_version FROM players WHERE id='Legacy'`).get().auth_version, 0);
});

test("ID/password policy and secure password hash boundaries", async () => {
  assert.equal(auth.validPlayerId("Ab_1"), true);
  assert.equal(auth.validPlayerId("abc"), false);
  assert.equal(auth.validPlayerId("has space"), false);
  assert.equal(auth.validPassword("1234"), true);
  assert.equal(auth.validPassword("x".repeat(32)), true);
  assert.equal(auth.validPassword("123"), false);
  assert.equal(auth.validPassword("x".repeat(33)), false);
  const encoded = await auth.hashPassword("1234");
  assert.match(encoded, /^pbkdf2_sha256\$210000\$/);
  assert.equal(await auth.verifyPasswordHash("1234", encoded), true);
  assert.equal(await auth.verifyPasswordHash("nope", encoded), false);
});

test("new registration stores hashes only and issues 24h/30d opaque sessions", async () => {
  const db = createDb();
  const normal = await body(await auth.handleRegister(db, "New_One", "1234", "1234", false, "ip-1"));
  assert.equal(normal.ok, true);
  assert.ok(normal.recoveryCode.startsWith("TD-"));
  const row = db.raw.prepare(`SELECT * FROM players WHERE id='New_One'`).get();
  assert.equal(row.password, "");
  assert.ok(row.password_hash);
  assert.notEqual(row.recovery_code_hash, normal.recoveryCode);
  const stored = db.raw.prepare(`SELECT * FROM auth_sessions WHERE player_id='New_One'`).get();
  assert.notEqual(stored.token_hash, normal.sessionToken);
  const normalHours = (Date.parse(normal.expiresAt) - Date.now()) / 3600000;
  assert.ok(normalHours > 23.9 && normalHours <= 24.1);

  const remembered = await body(await auth.handleLogin(db, "new_one", "1234", true, "ip-2"));
  const rememberedDays = (Date.parse(remembered.expiresAt) - Date.now()) / 86400000;
  assert.ok(rememberedDays > 29.9 && rememberedDays <= 30.1);
});

test("legacy login lazily migrates hash and preserves progression/items/run state", async () => {
  const db = createDb();
  db.raw.prepare(`INSERT INTO players (id,password,created_at,diamonds,active_slot) VALUES ('Legacy','pass','now',99,0)`).run();
  db.raw.prepare(`INSERT INTO characters (character_id,player_id,slot_index,name,level,gold,pets_json) VALUES ('c1','Legacy',0,'Hero',20,777,'[{"instId":"p1"}]')`).run();
  db.raw.prepare(`INSERT INTO items (item_id,player_id,character_id,name) VALUES ('i1','Legacy','c1','Blade')`).run();
  db.raw.prepare(`INSERT INTO run_state (character_id,floor,hp,mp) VALUES ('c1',8,44,12)`).run();
  const result = await body(await auth.handleLogin(db, "legacy", "pass", false, "ip-legacy"));
  assert.equal(result.ok, true);
  assert.equal(result.legacyMigrated, true);
  const player = db.raw.prepare(`SELECT * FROM players WHERE id='Legacy'`).get();
  assert.ok(player.password_hash);
  assert.equal(player.password, "pass");
  assert.equal(player.diamonds, 99);
  assert.equal(db.raw.prepare(`SELECT level,gold FROM characters WHERE character_id='c1'`).get().level, 20);
  assert.equal(db.raw.prepare(`SELECT name FROM items WHERE item_id='i1'`).get().name, "Blade");
  assert.equal(db.raw.prepare(`SELECT floor,hp FROM run_state WHERE character_id='c1'`).get().floor, 8);
});

test("new login replaces old session, logout revokes, and ownership remains enforced", async () => {
  const db = createDb();
  const registered = await body(await auth.handleRegister(db, "Player_1", "abcd", "abcd", false, "ip-a"));
  db.raw.prepare(`INSERT INTO characters (character_id,player_id,slot_index,name) VALUES ('own','Player_1',0,'Mine'),('other','SomeoneElse',0,'Other')`).run();
  const loggedIn = await body(await auth.handleLogin(db, "player_1", "abcd", false, "ip-b"));
  assert.equal((await auth.verifySession(db, registered.sessionToken)).error, "session_replaced");
  const active = await auth.verifySession(db, loggedIn.sessionToken);
  assert.equal(active.ok, true);
  assert.equal((await auth.verifyOwnedCharacter(db, active.row.id, "own")).ok, true);
  assert.equal((await auth.verifyOwnedCharacter(db, active.row.id, "other")).error, "forbidden");
  await auth.handleLogout(db, active);
  assert.equal((await auth.verifySession(db, loggedIn.sessionToken)).error, "session_revoked");
});

test("recovery regeneration invalidates old code; reset rotates code and sessions", async () => {
  const db = createDb();
  const registered = await body(await auth.handleRegister(db, "Recover_1", "old1", "old1", false, "ip-r1"));
  const session = await auth.verifySession(db, registered.sessionToken);
  const regenerated = await body(await auth.handleCreateRecoveryCode(db, session, "old1"));
  assert.equal(regenerated.ok, true);
  const oldAttempt = await body(await auth.handleForgotPassword(db, "Recover_1", registered.recoveryCode, "new1", "new1", "ip-r2"));
  assert.equal(oldAttempt.error, "invalid_recovery");
  const reset = await body(await auth.handleForgotPassword(db, "Recover_1", regenerated.recoveryCode, "new1", "new1", "ip-r3"));
  assert.equal(reset.ok, true);
  assert.notEqual(reset.recoveryCode, regenerated.recoveryCode);
  assert.equal((await auth.verifySession(db, registered.sessionToken)).error, "session_revoked");
  const reused = await body(await auth.handleForgotPassword(db, "Recover_1", regenerated.recoveryCode, "next", "next", "ip-r4"));
  assert.equal(reused.error, "invalid_recovery");
  assert.equal((await body(await auth.handleLogin(db, "Recover_1", "new1", false, "ip-r5"))).ok, true);
});

test("password change revokes all sessions and requires the new password", async () => {
  const db = createDb();
  const registered = await body(await auth.handleRegister(db, "Change_1", "old1", "old1", false, "ip-c1"));
  const session = await auth.verifySession(db, registered.sessionToken);
  const changed = await body(await auth.handleChangePassword(db, session, "old1", "new1", "new1"));
  assert.equal(changed.ok, true);
  assert.equal((await auth.verifySession(db, registered.sessionToken)).error, "session_revoked");
  assert.equal((await body(await auth.handleLogin(db, "Change_1", "old1", false, "ip-c2"))).error, "invalid_credentials");
  assert.equal((await body(await auth.handleLogin(db, "Change_1", "new1", false, "ip-c3"))).ok, true);
});

test("login and registration rate limits use generic short-lived failures", async () => {
  const loginDb = createDb();
  await body(await auth.handleRegister(loginDb, "Rate_User", "pass", "pass", false, "register-ip"));
  assert.equal((await body(await auth.handleLogin(loginDb, "missing", "bad1", false, "login-ip"))).error, "invalid_credentials");
  for (let attempt = 0; attempt < 4; attempt++) {
    assert.equal((await body(await auth.handleLogin(loginDb, "Rate_User", "bad1", false, "login-ip"))).error, "invalid_credentials");
  }
  assert.equal((await body(await auth.handleLogin(loginDb, "Rate_User", "bad1", false, "login-ip"))).error, "invalid_credentials");
  assert.equal((await body(await auth.handleLogin(loginDb, "Rate_User", "bad1", false, "login-ip"))).error, "rate_limited");

  const registerDb = createDb();
  for (let account = 0; account < 3; account++) {
    assert.equal((await body(await auth.handleRegister(registerDb, `User_${account}`, "pass", "pass", false, "same-ip"))).ok, true);
  }
  assert.equal((await body(await auth.handleRegister(registerDb, "User_3", "pass", "pass", false, "same-ip"))).error, "rate_limited");
});

test("frontend login is POST-only and authenticated gameplay uses bearer auth", async () => {
  const apiSource = fs.readFileSync(path.join(__dirname, "../src/state/api.js"), "utf8");
  const requests = [];
  const sandbox = {
    URLSearchParams,
    setTimeout: callback => callback(),
    AUTH_SESSION: { getToken: () => "raw-token", getGeneration: () => 1, handleApiResult: result => result },
    fetch: async (url, options = {}) => { requests.push({ url, options }); return { status: 200, json: async () => ({ ok: true }) }; }
  };
  vm.createContext(sandbox);
  vm.runInContext(apiSource, sandbox);
  await sandbox.cloudLogin("https://api.test", "Player", "secret", false);
  await sandbox.cloudGetRaidStatus("https://api.test", "char-1");
  await sandbox.cloudCraftItem("https://api.test", "char-1", "recipe-1");
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].url.includes("password"), false);
  assert.equal(requests[1].options.headers.Authorization, "Bearer raw-token");
  assert.equal(requests[2].options.headers.Authorization, "Bearer raw-token");
  assert.equal(requests.slice(1).some(request => /password|raw-token/.test(request.options.body || "")), false);
});

test("worker router derives ownership from bearer session and rejects GET login", async () => {
  const db = createDb();
  const env = { DB: db };
  const getLogin = await worker.fetch(new Request("https://api.test?action=login&id=Route_1&password=pass"), env);
  assert.equal(getLogin.status, 401);
  assert.equal((await body(getLogin)).error, "invalid_session");

  const registerRequest = new Request("https://api.test", {
    method: "POST",
    headers: { "Content-Type": "application/json", "CF-Connecting-IP": "route-ip" },
    body: JSON.stringify({ action: "register", id: "Route_1", password: "pass", confirmPassword: "pass" })
  });
  const registered = await body(await worker.fetch(registerRequest, env));
  const createRequest = new Request("https://api.test", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${registered.sessionToken}` },
    body: JSON.stringify({ action: "createCharacter", id: "SomeoneElse", slotIndex: 0, name: "Owned" })
  });
  assert.equal((await body(await worker.fetch(createRequest, env))).ok, true);
  assert.equal(db.raw.prepare(`SELECT player_id FROM characters WHERE name='Owned'`).get().player_id, "Route_1");
});
