const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");
const { loadWorkerSource } = require("./helpers/worker-source");

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
  async batch(statements) {
    const results = [];
    this.raw.exec("BEGIN");
    try {
      for (const statement of statements) results.push(await statement.run());
      this.raw.exec("COMMIT");
      return results;
    } catch (error) {
      this.raw.exec("ROLLBACK");
      throw error;
    }
  }
}

function loadWorkerInternals() {
  let source = loadWorkerSource(path.resolve(__dirname, ".."));
  source = source.replace("export default {", "const workerDefault = {");
  source += `
globalThis.__worker = workerDefault;
globalThis.__admin = {
  handleAdminLogin,
  handleAdminValidateSession,
  handleAdminLogout,
  verifyAdminSession,
  verifyAdminAccess
};
globalThis.__auth = { handleRegister, handleLogin, verifySession, handleChangePassword, handleCreateRecoveryCode, handleForgotPassword };
`;
  const sandbox = { console, Response, Headers, Request, URL, TextEncoder, Uint8Array, crypto, atob, btoa, setTimeout, clearTimeout };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { admin: sandbox.__admin, auth: sandbox.__auth, worker: sandbox.__worker };
}
const { admin, auth, worker } = loadWorkerInternals();

function createDb() {
  const db = new D1Database();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      diamonds INTEGER DEFAULT 0,
      active_slot INTEGER
    );
    CREATE TABLE characters (
      character_id TEXT PRIMARY KEY,
      player_id TEXT NOT NULL,
      slot_index INTEGER NOT NULL,
      name TEXT DEFAULT '',
      level INTEGER DEFAULT 1,
      xp INTEGER DEFAULT 0,
      stat_points INTEGER DEFAULT 0,
      str INTEGER DEFAULT 0,
      vit INTEGER DEFAULT 0,
      agi INTEGER DEFAULT 0,
      dex INTEGER DEFAULT 0,
      luk INTEGER DEFAULT 0,
      gold INTEGER DEFAULT 0,
      unlocked_floor INTEGER DEFAULT 1,
      potions INTEGER DEFAULT 2,
      protection_stones INTEGER DEFAULT 0,
      chest_pity INTEGER DEFAULT 0,
      pets_json TEXT DEFAULT '[]',
      active_pet_id TEXT DEFAULT '',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE items (
      item_id TEXT PRIMARY KEY,
      player_id TEXT,
      character_id TEXT,
      slot_type TEXT,
      equipped INTEGER DEFAULT 0,
      inventory_slot TEXT,
      item_template_id TEXT,
      rarity TEXT,
      name TEXT,
      item_level INTEGER DEFAULT 0,
      enhance_level INTEGER DEFAULT 0,
      bound INTEGER DEFAULT 0,
      quantity INTEGER DEFAULT 1,
      atk INTEGER DEFAULT 0,
      def INTEGER DEFAULT 0,
      hp INTEGER DEFAULT 0,
      mp INTEGER DEFAULT 0,
      extra_json TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE run_state (
      character_id TEXT PRIMARY KEY,
      floor INTEGER,
      level INTEGER,
      xp INTEGER,
      hp INTEGER,
      mp INTEGER,
      base_atk INTEGER,
      base_def INTEGER,
      base_max_hp INTEGER,
      base_max_mp INTEGER,
      run_gold INTEGER,
      potions INTEGER,
      updated_at TEXT
    );
    CREATE TABLE progress (
      player_id TEXT PRIMARY KEY,
      bank_gold INTEGER,
      diamonds INTEGER,
      best_floor INTEGER,
      potions INTEGER,
      char_level INTEGER,
      char_xp INTEGER,
      char_points INTEGER,
      char_str INTEGER,
      char_vit INTEGER,
      char_dex INTEGER,
      char_luk INTEGER,
      pets_json TEXT,
      active_pet_id TEXT,
      updated_at TEXT
    );
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "fixtures/auth-v2-schema.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0022_admin_v2_auth.sql"), "utf8"));
  return db;
}
async function body(response) { return response.json(); }

async function createAccount(db, id = "Admin_1", password = "pass") {
  const registered = await body(await auth.handleRegister(db, id, password, password, false, "register-ip"));
  assert.equal(registered.ok, true);
  return registered;
}
function allowAdmin(db, id, role = "owner") {
  db.raw.prepare(`
    INSERT INTO admin_users (player_id, role, enabled, created_at, updated_at)
    VALUES (?, ?, 1, 'now', 'now')
  `).run(id, role);
}

test("Admin V2 migration is additive and provisions the approved admin owner when the account exists", () => {
  const db = new D1Database();
  db.raw.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE players (
      id TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      created_at TEXT NOT NULL,
      diamonds INTEGER DEFAULT 0,
      active_slot INTEGER
    );
    INSERT INTO players (id, password, created_at) VALUES ('admin', '', 'now');
  `);
  db.raw.exec(fs.readFileSync(path.join(__dirname, "fixtures/auth-v2-schema.sql"), "utf8"));
  db.raw.exec(fs.readFileSync(path.join(__dirname, "../migrations/auto/0022_admin_v2_auth.sql"), "utf8"));

  const tables = db.raw.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'admin_%' ORDER BY name`).all().map(row => row.name);
  assert.deepEqual(tables, ["admin_audit_log", "admin_sessions", "admin_users"]);

  const owner = db.raw.prepare("SELECT player_id, role, enabled FROM admin_users WHERE player_id='admin'").get();
  assert.equal(owner.player_id, "admin");
  assert.equal(owner.role, "owner");
  assert.equal(owner.enabled, 1);
});

test("allowlisted Auth V2 credentials issue a dedicated 8-hour Admin session only", async () => {
  const db = createDb();
  const player = await createAccount(db);
  allowAdmin(db, "Admin_1");

  const gameplayBefore = db.raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions WHERE player_id='Admin_1' AND revoked_at IS NULL").get().c;
  assert.equal(gameplayBefore, 1);

  const result = await body(await admin.handleAdminLogin(db, "admin_1", "pass", "admin-ip"));
  assert.equal(result.ok, true);
  assert.equal(result.admin.playerId, "Admin_1");
  assert.equal(result.admin.role, "owner");
  assert.ok(result.adminSessionToken);

  const hours = (Date.parse(result.expiresAt) - Date.now()) / 3600000;
  assert.ok(hours > 7.9 && hours <= 8.1);

  const stored = db.raw.prepare("SELECT * FROM admin_sessions WHERE player_id='Admin_1'").get();
  assert.notEqual(stored.token_hash, result.adminSessionToken);

  const gameplayAfter = db.raw.prepare("SELECT COUNT(*) AS c FROM auth_sessions WHERE player_id='Admin_1' AND revoked_at IS NULL").get().c;
  assert.equal(gameplayAfter, 1);
  assert.equal((await auth.verifySession(db, player.sessionToken)).ok, true);
});

test("non-admin and wrong-password attempts return the same generic Admin failure", async () => {
  const db = createDb();
  await createAccount(db, "Player_1", "pass");
  const nonAdmin = await body(await admin.handleAdminLogin(db, "Player_1", "pass", "ip-a"));
  assert.equal(nonAdmin.error, "admin_auth_failed");

  allowAdmin(db, "Player_1");
  const wrong = await body(await admin.handleAdminLogin(db, "Player_1", "nope", "ip-b"));
  assert.equal(wrong.error, "admin_auth_failed");
});

test("gameplay and Admin session tokens are not interchangeable", async () => {
  const db = createDb();
  const player = await createAccount(db);
  allowAdmin(db, "Admin_1");
  const adminLogin = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-admin"));

  assert.equal((await admin.verifyAdminSession(db, player.sessionToken)).error, "admin_session_invalid");
  assert.equal((await auth.verifySession(db, adminLogin.adminSessionToken)).error, "invalid_session");
});

test("second Admin login revokes the previous Admin session and audits the replacement", async () => {
  const db = createDb();
  await createAccount(db);
  allowAdmin(db, "Admin_1");

  const first = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-1"));
  const second = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-2"));

  assert.equal((await admin.verifyAdminSession(db, first.adminSessionToken)).error, "admin_session_revoked");
  const active = await admin.verifyAdminSession(db, second.adminSessionToken);
  assert.equal(active.ok, true);

  const replacementAudit = db.raw.prepare(
    "SELECT metadata_json FROM admin_audit_log WHERE player_id='Admin_1' AND event_type='ADMIN_SESSION_REVOKED' ORDER BY rowid DESC LIMIT 1"
  ).get();
  assert.ok(replacementAudit);
  assert.equal(JSON.parse(replacementAudit.metadata_json).reason, "replaced");

  assert.equal((await body(await admin.handleAdminLogout(db, active))).ok, true);
  assert.equal((await admin.verifyAdminSession(db, second.adminSessionToken)).error, "admin_session_revoked");
});

test("disabled Admin allowlist blocks login and invalidates an existing Admin session", async () => {
  const db = createDb();
  await createAccount(db);
  allowAdmin(db, "Admin_1");
  const login = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-1"));

  db.raw.prepare("UPDATE admin_users SET enabled=0 WHERE player_id='Admin_1'").run();
  assert.equal((await admin.verifyAdminSession(db, login.adminSessionToken)).error, "admin_session_revoked");
  assert.equal((await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-2"))).error, "admin_auth_failed");
});

test("Admin login has an independent brute-force rate limit", async () => {
  const db = createDb();
  await createAccount(db);
  allowAdmin(db, "Admin_1");

  for (let i = 0; i < 5; i++) {
    assert.equal((await body(await admin.handleAdminLogin(db, "Admin_1", "bad1", "same-ip"))).error, "admin_auth_failed");
  }
  const limited = await body(await admin.handleAdminLogin(db, "Admin_1", "bad1", "same-ip"));
  assert.equal(limited.error, "admin_rate_limited");
  assert.ok(Number(limited.retryAfter) >= 1);
});

test("Admin Bearer session authorizes existing Admin reads without adminKey", async () => {
  const db = createDb();
  await createAccount(db);
  allowAdmin(db, "Admin_1");
  const login = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-admin"));

  const env = { DB: db, ADMIN_API_KEY: "legacy-only" };
  const req = new Request("https://api.example.test/?action=getSheet&sheet=players", {
    headers: { Authorization: `Bearer ${login.adminSessionToken}` }
  });
  const result = await body(await worker.fetch(req, env));
  assert.equal(result.ok, true);
  assert.equal(result.sheet, "players");
  assert.equal(result.rows.length, 1);
  assert.equal(Object.hasOwn(result.rows[0], "password"), false);
  assert.equal(Object.hasOwn(result.rows[0], "password_hash"), false);
  assert.equal(Object.hasOwn(result.rows[0], "recovery_code_hash"), false);
});

test("Admin Phase 1 player search/viewer is server-side, sanitized, audited, and session-only", async () => {
  const db = createDb();
  await createAccount(db, "Admin_1");
  allowAdmin(db, "Admin_1");
  const target = await createAccount(db, "Target_1");
  db.raw.prepare(`
    INSERT INTO characters
      (character_id, player_id, slot_index, name, level, unlocked_floor, gold, created_at, updated_at)
    VALUES ('char-target', 'Target_1', 0, 'Hero Alpha', 12, 18, 345, 'now', 'now')
  `).run();
  db.raw.prepare(`
    INSERT INTO items
      (item_id, player_id, character_id, slot_type, equipped, inventory_slot, rarity, name, enhance_level, extra_json, created_at, updated_at)
    VALUES ('item-target', 'Target_1', 'char-target', 'weapon', 1, '', 'mythic', 'Audit Sword', 4, '{}', 'now', 'now')
  `).run();

  const login = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-admin"));
  const env = { DB: db, ADMIN_API_KEY: "legacy-only" };
  const adminHeaders = { Authorization: `Bearer ${login.adminSessionToken}` };

  const searchResponse = await worker.fetch(
    new Request("https://api.example.test/?action=adminSearchPlayers&query=hero&limit=50", { headers: adminHeaders }),
    env
  );
  const search = await body(searchResponse);
  assert.equal(searchResponse.status, 200);
  assert.equal(search.ok, true);
  assert.equal(search.results.length, 1);
  assert.deepEqual({ ...search.results[0] }, {
    playerId: "Target_1",
    characterCount: 1,
    maxLevel: 12,
    maxFloor: 18,
    characterNames: "Hero Alpha"
  });
  assert.doesNotMatch(JSON.stringify(search), /password|token_hash|recovery_code_hash/i);

  const wildcard = await body(await worker.fetch(
    new Request("https://api.example.test/?action=adminSearchPlayers&query=%25", { headers: adminHeaders }),
    env
  ));
  assert.equal(wildcard.ok, true);
  assert.equal(wildcard.results.length, 0);

  const viewerResponse = await worker.fetch(
    new Request("https://api.example.test/?action=getPlayer&id=Target_1", { headers: adminHeaders }),
    env
  );
  const viewer = await body(viewerResponse);
  assert.equal(viewerResponse.status, 200);
  assert.equal(viewer.ok, true);
  assert.equal(viewer.player.id, "Target_1");
  assert.equal(Object.hasOwn(viewer.player, "password"), false);
  assert.equal(Object.hasOwn(viewer.player, "password_hash"), false);
  assert.equal(Object.hasOwn(viewer.player, "recovery_code_hash"), false);
  assert.equal(viewer.characters.length, 1);
  assert.equal(viewer.items.length, 1);

  const auditRows = db.raw.prepare(`
    SELECT event_type, target_type, target_id, metadata_json
    FROM admin_audit_log
    WHERE event_type IN ('ADMIN_PLAYER_SEARCH', 'ADMIN_PLAYER_VIEW')
    ORDER BY rowid
  `).all();
  assert.equal(auditRows.length, 3);
  assert.equal(auditRows[0].event_type, "ADMIN_PLAYER_SEARCH");
  assert.equal(JSON.parse(auditRows[0].metadata_json).queryLength, 4);
  assert.equal(auditRows[2].event_type, "ADMIN_PLAYER_VIEW");
  assert.equal(auditRows[2].target_type, "player");
  assert.equal(auditRows[2].target_id, "Target_1");
  assert.doesNotMatch(JSON.stringify(auditRows), /Hero Alpha|adminSessionToken|password/i);

  const deniedResponse = await worker.fetch(
    new Request("https://api.example.test/?action=adminSearchPlayers&query=Target", {
      headers: { Authorization: `Bearer ${target.sessionToken}` }
    }),
    env
  );
  const denied = await body(deniedResponse);
  assert.equal(deniedResponse.status, 401);
  assert.equal(denied.error, "admin_session_invalid");
});

test("Admin Phase 1 UI exposes dashboard/search/viewer without player mutation controls", () => {
  const html = fs.readFileSync(path.join(__dirname, "../admin.html"), "utf8");
  assert.match(html, /data-tab="dashboard"/);
  assert.match(html, /data-tab="players"/);
  assert.match(html, /action:\s*"getGameStats"/);
  assert.match(html, /action:\s*"adminSearchPlayers"/);
  assert.match(html, /action:\s*"getPlayer"/);
  assert.match(html, /Player Viewer/);
  assert.match(html, /read-only/);
  assert.doesNotMatch(html, /adminDeletePlayer|adminDeleteItem|setPlayerGold|setPlayerDiamonds|playerMutation/i);
});

test("legacy ADMIN_API_KEY compatibility is retired while Admin V2 UI remains session-only", async () => {
  const db = createDb();
  await createAccount(db);
  const env = { DB: db, ADMIN_API_KEY: "legacy-key" };

  const legacyResponse = await worker.fetch(
    new Request("https://api.example.test/?action=getSheet&sheet=players&adminKey=legacy-key"),
    env
  );
  const legacy = await body(legacyResponse);
  assert.equal(legacyResponse.status, 401);
  assert.equal(legacy.error, "admin_session_required");

  const html = fs.readFileSync(path.join(__dirname, "../admin.html"), "utf8");
  assert.doesNotMatch(html, /thornie-admin-key/);
  assert.doesNotMatch(html, /adminKey\s*:/);
  assert.doesNotMatch(html, /localStorage/);
  assert.match(html, /sessionStorage/);
  assert.match(html, /action:\s*"adminLogin"/);
  assert.match(html, /action:\s*"adminLogout"/);
  assert.match(html, /adminValidateSession/);
});

test("player password change and recovery reset revoke active Admin sessions", async () => {
  const db = createDb();
  const registered = await createAccount(db);
  allowAdmin(db, "Admin_1");

  const firstAdmin = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-admin-1"));
  const playerAuth = await auth.verifySession(db, registered.sessionToken);
  assert.equal(playerAuth.ok, true);

  const changed = await body(await auth.handleChangePassword(db, playerAuth, "pass", "new1", "new1"));
  assert.equal(changed.ok, true);
  assert.equal((await admin.verifyAdminSession(db, firstAdmin.adminSessionToken)).error, "admin_session_revoked");

  const relogin = await body(await auth.handleLogin(db, "Admin_1", "new1", false, "player-relogin"));
  const reloginAuth = await auth.verifySession(db, relogin.sessionToken);
  const recovery = await body(await auth.handleCreateRecoveryCode(db, reloginAuth, "new1"));
  assert.equal(recovery.ok, true);

  const secondAdmin = await body(await admin.handleAdminLogin(db, "Admin_1", "new1", "ip-admin-2"));
  const reset = await body(await auth.handleForgotPassword(db, "Admin_1", recovery.recoveryCode, "next1", "next1", "recovery-ip"));
  assert.equal(reset.ok, true);
  assert.equal((await admin.verifyAdminSession(db, secondAdmin.adminSessionToken)).error, "admin_session_revoked");

  const revokeAudits = db.raw.prepare(
    "SELECT metadata_json FROM admin_audit_log WHERE player_id='Admin_1' AND event_type='ADMIN_SESSION_REVOKED' ORDER BY rowid"
  ).all().map(row => JSON.parse(row.metadata_json).reason);
  assert.ok(revokeAudits.includes("password_changed"));
  assert.ok(revokeAudits.includes("password_reset"));
});

test("Admin audit records auth events without raw password/session token fields", async () => {
  const db = createDb();
  await createAccount(db);
  allowAdmin(db, "Admin_1");
  const login = await body(await admin.handleAdminLogin(db, "Admin_1", "pass", "ip-admin"));
  const authCtx = await admin.verifyAdminSession(db, login.adminSessionToken);
  await admin.handleAdminLogout(db, authCtx);

  const rows = db.raw.prepare("SELECT event_type, metadata_json FROM admin_audit_log ORDER BY created_at, rowid").all();
  assert.ok(rows.some(row => row.event_type === "ADMIN_LOGIN_SUCCESS"));
  assert.ok(rows.some(row => row.event_type === "ADMIN_LOGOUT"));
  const serialized = JSON.stringify(rows);
  assert.doesNotMatch(serialized, /adminSessionToken|token_hash|password_hash|"pass"/);
});
