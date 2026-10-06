export function createAuthHandlers(deps) {
  const { json, nowIso, getRow } = deps;

const PASSWORD_MIN = 4;
const PASSWORD_MAX = 32;
// Cloudflare Workers Web Crypto rejects PBKDF2 counts above 100,000.
const PASSWORD_ITERATIONS = 100000;
const SESSION_24H_MS = 24 * 60 * 60 * 1000;
const SESSION_30D_MS = 30 * SESSION_24H_MS;
const AUTH_ERRORS = new Set(["invalid_session", "session_expired", "session_revoked", "session_replaced"]);

function bytesToBase64Url(bytes) {
  let binary = "";
  bytes.forEach((value) => { binary += String.fromCharCode(value); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlToBytes(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(value)));
  return bytesToBase64Url(new Uint8Array(digest));
}
async function hashPassword(password, saltValue) {
  const salt = saltValue ? base64UrlToBytes(saltValue) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(String(password)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: PASSWORD_ITERATIONS, hash: "SHA-256" }, key, 256);
  return `pbkdf2_sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}
async function verifyPasswordHash(password, encoded) {
  const parts = String(encoded || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256" || Number(parts[1]) !== PASSWORD_ITERATIONS) return false;
  const candidate = await hashPassword(password, parts[2]);
  const a = new TextEncoder().encode(candidate);
  const b = new TextEncoder().encode(String(encoded));
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function validPlayerId(id) {
  return /^[A-Za-z0-9_]{4,20}$/.test(String(id || ""));
}
function validPassword(password) {
  const value = String(password || "");
  return value.length >= PASSWORD_MIN
    && value.length <= PASSWORD_MAX
    && /^[A-Za-z0-9]+$/.test(value);
}
function passwordValidationError(password) {
  const value = String(password || "");
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) return "invalid_password_length";
  if (!/^[A-Za-z0-9]+$/.test(value)) return "invalid_password_characters";
  return "";
}
function normalizeRecoveryCode(code) {
  return String(code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function createRecoveryCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  let body = "";
  for (const value of random) body += alphabet[value % alphabet.length];
  return `TD-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}-${body.slice(12, 16)}`;
}
async function recoveryCodeHash(code) {
  return sha256(`thornie-recovery-v2:${normalizeRecoveryCode(code)}`);
}
function requestIp(request) {
  return request.headers.get("CF-Connecting-IP") || "unknown";
}
function rateKey(kind, ip, id = "") {
  return `${kind}:${String(ip)}:${String(id).trim().toLowerCase()}`;
}
async function checkRateLimit(db, key, limit, windowMs) {
  const row = await db.prepare(`SELECT * FROM auth_rate_limits WHERE rate_key = ?`).bind(key).first();
  const now = Date.now();
  if (!row) return { ok: true, attempts: 0 };
  const blockedUntil = Date.parse(row.blocked_until || "");
  if (Number.isFinite(blockedUntil) && blockedUntil > now) return { error: "rate_limited", retryAfter: Math.ceil((blockedUntil - now) / 1000) };
  const windowStart = Date.parse(row.window_started_at || "");
  if (!Number.isFinite(windowStart) || now - windowStart >= windowMs) return { ok: true, attempts: 0, reset: true };
  if (Number(row.attempts) >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - windowStart)) / 1000));
    return { error: "rate_limited", retryAfter };
  }
  return { ok: true, attempts: Number(row.attempts) || 0 };
}
async function recordRateAttempt(db, key, limit, windowMs, success = false) {
  if (success) {
    await db.prepare(`DELETE FROM auth_rate_limits WHERE rate_key = ?`).bind(key).run();
    return;
  }
  const current = await checkRateLimit(db, key, Number.MAX_SAFE_INTEGER, windowMs);
  const attempts = (current.reset ? 0 : current.attempts || 0) + 1;
  const cooldown = attempts < limit ? 0 : attempts === limit ? 30 : attempts === limit + 1 ? 120 : 300;
  const now = new Date();
  const blockedUntil = cooldown ? new Date(now.getTime() + cooldown * 1000).toISOString() : null;
  await db.prepare(
    `INSERT INTO auth_rate_limits (rate_key, attempts, window_started_at, blocked_until, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(rate_key) DO UPDATE SET attempts=excluded.attempts,
       window_started_at=CASE WHEN auth_rate_limits.window_started_at < ? THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END,
       blocked_until=excluded.blocked_until, updated_at=excluded.updated_at`
  ).bind(key, attempts, now.toISOString(), blockedUntil, now.toISOString(), new Date(now.getTime() - windowMs).toISOString()).run();
}
async function playerByLoginId(db, id) {
  return await db.prepare(`SELECT * FROM players WHERE LOWER(id) = LOWER(?) LIMIT 1`).bind(String(id || "").trim()).first() || null;
}
async function verifyPasswordCredentials(db, id, password) {
  if (!id || !password) return { error: "invalid_credentials" };
  const row = await playerByLoginId(db, id);
  if (!row) return { error: "invalid_credentials" };
  if (row.password_hash) {
    if (!(await verifyPasswordHash(password, row.password_hash))) return { error: "invalid_credentials" };
    return { ok: true, row, migrated: false };
  }
  if (String(row.password) !== String(password)) return { error: "invalid_credentials" };
  const passwordHash = await hashPassword(password);
  await db.prepare(`UPDATE players SET password_hash = ?, auth_version = 2 WHERE id = ? AND password_hash IS NULL`).bind(passwordHash, row.id).run();
  return { ok: true, row: { ...row, password_hash: passwordHash, auth_version: 2 }, migrated: true };
}
async function issueSession(db, playerId, rememberLogin) {
  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (rememberLogin ? SESSION_30D_MS : SESSION_24H_MS));
  const sessionId = `sess-${randomToken(18)}`;
  await db.batch([
    db.prepare(`UPDATE auth_sessions SET revoked_at = ?, revoke_reason = 'replaced' WHERE player_id = ? AND revoked_at IS NULL`).bind(now.toISOString(), playerId),
    db.prepare(`INSERT INTO auth_sessions (session_id, player_id, token_hash, created_at, expires_at, revoked_at, revoke_reason, remember_login) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`)
      .bind(sessionId, playerId, tokenHash, now.toISOString(), expiresAt.toISOString(), rememberLogin ? 1 : 0)
  ]);
  return { sessionToken: rawToken, expiresAt: expiresAt.toISOString(), rememberLogin: !!rememberLogin };
}
function bearerToken(request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("Authorization") || "");
  return match ? match[1].trim() : "";
}
async function verifySession(db, token) {
  if (!token) return { error: "invalid_session" };
  const tokenHash = await sha256(token);
  const session = await db.prepare(`SELECT * FROM auth_sessions WHERE token_hash = ? LIMIT 1`).bind(tokenHash).first();
  if (!session) return { error: "invalid_session" };
  if (session.revoked_at) return { error: session.revoke_reason === "replaced" ? "session_replaced" : "session_revoked" };
  if (Date.parse(session.expires_at) <= Date.now()) return { error: "session_expired" };
  const row = await getRow(db, "players", "id", session.player_id);
  if (!row) return { error: "invalid_session" };
  return { ok: true, row, session };
}
async function verifyPlayer(db, id, trustedSession) {
  if (!trustedSession?.ok || String(trustedSession.row?.id) !== String(id)) return { error: "invalid_session" };
  return { ok: true, row: trustedSession.row };
}

// Confirms `characterId` actually belongs to `playerId` before letting any write
// touch it — prevents one account's requests from ever reading/writing another
// account's character just by guessing/reusing a character_id.
async function verifyOwnedCharacter(db, playerId, characterId) {
  if (!characterId) return { error: "missing_fields" };
  const row = await getRow(db, "characters", "character_id", characterId);
  if (!row) return { error: "character_not_found" };
  if (String(row.player_id) !== String(playerId)) return { error: "forbidden" };
  return { ok: true, row };
}

async function authenticateCharacter(db, token, characterId) {
  if (!characterId) return { error: "missing_fields" };
  if (!token) return { error: "invalid_session" };
  const tokenHash = await sha256(token);
  const row = await db.prepare(`
    SELECT s.session_id AS __session_id, s.expires_at AS __session_expires_at,
           s.revoked_at AS __session_revoked_at, s.revoke_reason AS __session_revoke_reason,
           s.remember_login AS __session_remember_login,
           p.id AS __player_id,
           c.*
    FROM auth_sessions s
    JOIN players p ON p.id = s.player_id
    LEFT JOIN characters c ON c.character_id = ?
    WHERE s.token_hash = ?
    LIMIT 1
  `).bind(characterId, tokenHash).first();
  if (!row) return { error: "invalid_session" };
  if (row.__session_revoked_at) return { error: row.__session_revoke_reason === "replaced" ? "session_replaced" : "session_revoked" };
  if (Date.parse(row.__session_expires_at) <= Date.now()) return { error: "session_expired" };
  if (!row.__player_id) return { error: "invalid_session" };
  const auth = {
    ok: true,
    row: { id: row.__player_id },
    session: {
      session_id: row.__session_id,
      expires_at: row.__session_expires_at,
      revoked_at: row.__session_revoked_at,
      revoke_reason: row.__session_revoke_reason,
      remember_login: !!row.__session_remember_login
    }
  };
  if (!row.character_id) return { error: "character_not_found" };
  if (String(row.player_id) !== String(row.__player_id)) return { error: "forbidden" };
  const owned = { ok: true, row };
  return { ok: true, auth, owned };
}

function verifyAdminKey(env, adminKey) {
  const configured = env.ADMIN_API_KEY;
  if (!configured) return { error: "admin_key_not_configured" };
  if (!adminKey || String(adminKey) !== String(configured)) return { error: "forbidden" };
  return { ok: true };
}

const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const ADMIN_LOGIN_WINDOW_MS = 10 * 60 * 1000;

function adminAuditStatement(db, playerId, eventType, metadata = {}, targetType = null, targetId = null) {
  const auditId = `admin-audit-${randomToken(18)}`;
  return db.prepare(`
    INSERT INTO admin_audit_log
      (audit_id, player_id, event_type, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    auditId,
    playerId || null,
    eventType,
    targetType || null,
    targetId || null,
    JSON.stringify(metadata && typeof metadata === "object" ? metadata : {}),
    nowIso()
  );
}

async function writeAdminAudit(db, playerId, eventType, metadata = {}, targetType = null, targetId = null) {
  await adminAuditStatement(db, playerId, eventType, metadata, targetType, targetId).run();
}

async function issueAdminSession(db, playerId) {
  const rawToken = randomToken(32);
  const tokenHash = await sha256(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ADMIN_SESSION_MS);
  const sessionId = `admin-sess-${randomToken(18)}`;
  const previous = await db.prepare(`
    SELECT session_id
    FROM admin_sessions
    WHERE player_id = ? AND revoked_at IS NULL
    LIMIT 1
  `).bind(playerId).first();

  const statements = [
    db.prepare(`
      UPDATE admin_sessions
      SET revoked_at = ?, revoke_reason = 'replaced'
      WHERE player_id = ? AND revoked_at IS NULL
    `).bind(now.toISOString(), playerId),
    db.prepare(`
      INSERT INTO admin_sessions
        (session_id, player_id, token_hash, created_at, expires_at, revoked_at, revoke_reason)
      VALUES (?, ?, ?, ?, ?, NULL, NULL)
    `).bind(sessionId, playerId, tokenHash, now.toISOString(), expiresAt.toISOString())
  ];
  if (previous?.session_id) {
    statements.push(adminAuditStatement(
      db,
      playerId,
      "ADMIN_SESSION_REVOKED",
      { reason: "replaced", sessionId: previous.session_id }
    ));
  }
  await db.batch(statements);
  return { adminSessionToken: rawToken, expiresAt: expiresAt.toISOString() };
}

async function verifyAdminSession(db, token) {
  if (!token) return { error: "admin_session_invalid" };
  const tokenHash = await sha256(token);
  const session = await db.prepare(`
    SELECT s.*, u.role, u.enabled
    FROM admin_sessions s
    JOIN admin_users u ON u.player_id = s.player_id
    WHERE s.token_hash = ?
    LIMIT 1
  `).bind(tokenHash).first();
  if (!session) return { error: "admin_session_invalid" };
  if (session.revoked_at || Number(session.enabled) !== 1) return { error: "admin_session_revoked" };
  if (Date.parse(session.expires_at) <= Date.now()) return { error: "admin_session_expired" };
  return {
    ok: true,
    playerId: session.player_id,
    role: session.role || "admin",
    session
  };
}

async function handleAdminLogin(db, id, password, ip) {
  const loginKey = rateKey("admin_login", ip, id);
  const limited = await checkRateLimit(db, loginKey, 5, ADMIN_LOGIN_WINDOW_MS);
  if (limited.error) {
    return json({ error: "admin_rate_limited", retryAfter: limited.retryAfter }, 429);
  }

  const allowlisted = await db.prepare(`
    SELECT u.player_id, u.role, u.enabled
    FROM admin_users u
    JOIN players p ON p.id = u.player_id
    WHERE LOWER(p.id) = LOWER(?)
    LIMIT 1
  `).bind(String(id || "").trim()).first();

  if (!allowlisted || Number(allowlisted.enabled) !== 1) {
    await recordRateAttempt(db, loginKey, 5, ADMIN_LOGIN_WINDOW_MS);
    await writeAdminAudit(db, null, "ADMIN_LOGIN_FAILURE", { reason: "auth_failed" });
    return json({ error: "admin_auth_failed" }, 401);
  }

  const verified = await verifyPasswordCredentials(db, allowlisted.player_id, password);
  if (verified.error) {
    await recordRateAttempt(db, loginKey, 5, ADMIN_LOGIN_WINDOW_MS);
    await writeAdminAudit(db, allowlisted.player_id, "ADMIN_LOGIN_FAILURE", { reason: "auth_failed" });
    return json({ error: "admin_auth_failed" }, 401);
  }

  await recordRateAttempt(db, loginKey, 5, ADMIN_LOGIN_WINDOW_MS, true);
  const session = await issueAdminSession(db, allowlisted.player_id);
  await writeAdminAudit(db, allowlisted.player_id, "ADMIN_LOGIN_SUCCESS", { role: allowlisted.role || "admin" });
  return json({
    ok: true,
    admin: { playerId: allowlisted.player_id, role: allowlisted.role || "admin" },
    ...session
  });
}

async function handleAdminValidateSession(db, auth) {
  return json({
    ok: true,
    admin: { playerId: auth.playerId, role: auth.role || "admin" },
    expiresAt: auth.session.expires_at
  });
}

async function handleAdminLogout(db, auth) {
  await db.prepare(`
    UPDATE admin_sessions
    SET revoked_at = ?, revoke_reason = 'logout'
    WHERE session_id = ? AND revoked_at IS NULL
  `).bind(nowIso(), auth.session.session_id).run();
  await writeAdminAudit(db, auth.playerId, "ADMIN_LOGOUT");
  return json({ ok: true });
}

async function commitCredentialChange(db, baseStatements, playerId, reason) {
  let previous = null;
  try {
    previous = await db.prepare(`
      SELECT session_id
      FROM admin_sessions
      WHERE player_id = ? AND revoked_at IS NULL
      LIMIT 1
    `).bind(playerId).first();
  } catch (error) {
    // Compatibility only for test/rollback environments that predate Admin V2.
    // Production deploy applies the Admin migration before this Worker.
    if (/no such table:\s*admin_sessions/i.test(String(error?.message || error))) {
      await db.batch(baseStatements);
      return;
    }
    throw error;
  }

  const statements = [
    ...baseStatements,
    db.prepare(`
      UPDATE admin_sessions
      SET revoked_at = ?, revoke_reason = ?
      WHERE player_id = ? AND revoked_at IS NULL
    `).bind(nowIso(), reason, playerId)
  ];
  if (previous?.session_id) {
    statements.push(adminAuditStatement(
      db,
      playerId,
      "ADMIN_SESSION_REVOKED",
      { reason, sessionId: previous.session_id }
    ));
  }
  await db.batch(statements);
}

async function verifyAdminAccess(db, env, request, legacyAdminKey) {
  const token = bearerToken(request);
  // Admin V2 is now the only authoritative administrative boundary.  The old
  // query/body `adminKey` compatibility path was useful during the bootstrap
  // rollout, but it cannot provide session expiry, revocation, or audit identity.
  // Keep verifyAdminKey exported for migration tooling/tests that still import
  // the primitive, but never use it to authorize a live request.
  if (!token) return { error: "admin_session_required" };
  return await verifyAdminSession(db, token);
}



  return {
    PASSWORD_MIN,
    PASSWORD_MAX,
    PASSWORD_ITERATIONS,
    SESSION_24H_MS,
    SESSION_30D_MS,
    AUTH_ERRORS,
    bytesToBase64Url,
    base64UrlToBytes,
    randomToken,
    sha256,
    hashPassword,
    verifyPasswordHash,
    validPlayerId,
    validPassword,
    passwordValidationError,
    normalizeRecoveryCode,
    createRecoveryCode,
    recoveryCodeHash,
    requestIp,
    rateKey,
    checkRateLimit,
    recordRateAttempt,
    playerByLoginId,
    verifyPasswordCredentials,
    issueSession,
    bearerToken,
    verifySession,
    verifyPlayer,
    verifyOwnedCharacter,
    authenticateCharacter,
    verifyAdminKey,
    ADMIN_SESSION_MS,
    ADMIN_LOGIN_WINDOW_MS,
    adminAuditStatement,
    writeAdminAudit,
    issueAdminSession,
    verifyAdminSession,
    handleAdminLogin,
    handleAdminValidateSession,
    handleAdminLogout,
    commitCredentialChange,
    verifyAdminAccess
  };
}
