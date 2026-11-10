export function createSocialHandlers(deps) {
  const {
    json, nowIso, getRow, randomToken, verifyPlayer, verifyOwnedCharacter,
  } = deps;

// ---------- Social Foundation V1 (docs/SOCIAL-SYSTEM-V1.md) ----------
// Phase 1 shared foundation only — no Friend/Chat/Guild feature endpoints yet.
// See docs/PROJECT-INDEX.md "Documentation gaps" note: Arena and Shop/Crafting/
// Summoning still lack ACTIVE docs; guilds/guild_members/chat_messages tables already
// exist in production D1 (all empty) — created by migrations/migration_v3.sql (applied
// 2026-09-04, before migrations/auto/ existed), not untracked. Known/legacy schema, left
// untouched here; future Social phases must evolve these tables with new forward-only
// migrations under migrations/auto/ — never recreate or replay migration_v3.sql.

// Composes verifyPlayer + verifyOwnedCharacter into the one call every future Social
// endpoint needs (§1: "authenticated session -> verify character ownership -> social
// action"). Deliberately thin — it reuses the exact same two primitives every existing
// gameplay handler already calls, so Social endpoints get identical session+ownership
// guarantees without a parallel identity system (§1: "reuse the production character
// key... do not create a parallel social user identity layer").
async function verifySocialActor(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return auth;
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return owned;
  return { ok: true, playerRow: auth.row, character: owned.row };
}

// Shared presence source (§4). Friend V1 "Online" = activity within this window;
// Guild V1 succession uses its own separate 36h/24h thresholds (GUILD-SYSTEM-V1.md §15)
// and must not reuse this constant. Not wired to any endpoint yet — no Friend UI exists
// to read it in Phase 1 — but last_active_at is already being written (see
// handleEnterCharacter/handleSaveCharacterProgress) so it has real data once needed.
const PRESENCE_ONLINE_WINDOW_MS = 5 * 60 * 1000;
function isRecentlyActive(lastActiveAtIso) {
  const t = Date.parse(lastActiveAtIso || "");
  return Number.isFinite(t) && Date.now() - t <= PRESENCE_ONLINE_WINDOW_MS;
}

// Shared directional block primitive (§5). Character-scoped on both sides.
//
// Reusable idempotency pattern this establishes for later high-risk Social mutations
// (dev prompt §7): a natural composite-PK constraint + `ON CONFLICT DO NOTHING` is
// enough for simple set-membership mutations like this one (also fits future Guild
// join). A mutation with a payout/side-effect that must never double-apply (Guild
// Donation, Chat send dedup) should instead follow the existing `battle_completions`
// pattern — a dedicated receipt row keyed by a client-supplied idempotency id, checked
// before the effect runs. Two established patterns already in this codebase; future
// Social endpoints should pick whichever fits instead of inventing a third.
async function isBlockedEitherDirection(db, a, b) {
  if (!a || !b) return false;
  const row = await db.prepare(
    `SELECT 1 FROM character_blocks
     WHERE (blocker_character_id = ? AND blocked_character_id = ?)
        OR (blocker_character_id = ? AND blocked_character_id = ?)
     LIMIT 1`
  ).bind(a, b, b, a).first();
  return !!row;
}
async function blockCharacter(db, actorCharacterId, targetCharacterId) {
  if (!actorCharacterId || !targetCharacterId) return { error: "missing_fields" };
  if (String(actorCharacterId) === String(targetCharacterId)) return { error: "cannot_block_self" };
  await db.prepare(
    `INSERT INTO character_blocks (blocker_character_id, blocked_character_id, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT(blocker_character_id, blocked_character_id) DO NOTHING`
  ).bind(actorCharacterId, targetCharacterId, nowIso()).run();
  return { ok: true };
}
// Unblock is intentionally idempotent — deleting a relation that no longer exists is
// still success (§9: "Idempotency and duplicate input... must not duplicate social
// mutations", same principle applied to removal).
async function unblockCharacter(db, actorCharacterId, targetCharacterId) {
  if (!actorCharacterId || !targetCharacterId) return { error: "missing_fields" };
  await db.prepare(
    `DELETE FROM character_blocks WHERE blocker_character_id = ? AND blocked_character_id = ?`
  ).bind(actorCharacterId, targetCharacterId).run();
  return { ok: true };
}

// ---------- Friend System V1 (docs/FRIEND-SYSTEM-V1.md) — Phase 2 ----------
// Built on Social Foundation V1 above: verifySocialActor for auth, isBlockedEitherDirection
// for block checks, character_blocks/last_active_at untouched by anything below.
const FRIEND_CAP = 50; // §2 — defined once so a future cap change isn't a grep-and-replace
const FRIEND_OUTGOING_PENDING_CAP = 20; // §4
const FRIEND_REQUEST_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // §4

// friendships stores one row per pair with character_id_a < character_id_b (migration
// 0015's CHECK constraint enforces this) — normalize before every read/write so lookups
// never have to try both column orders.
function normalizeFriendPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

// Phase 3 Chat contract hook (§15) — DM send must verify this at send time. Exact name
// kept close to isBlockedEitherDirection's naming above for consistency.
async function areFriends(db, characterIdA, characterIdB) {
  if (!characterIdA || !characterIdB || characterIdA === characterIdB) return false;
  const [a, b] = normalizeFriendPair(characterIdA, characterIdB);
  const row = await db.prepare(`SELECT 1 FROM friendships WHERE character_id_a = ? AND character_id_b = ? LIMIT 1`).bind(a, b).first();
  return !!row;
}

async function handleSearchCharacters(db, id, session, characterId, query) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const q = String(query || "").trim();
  if (!q) return json({ ok: true, results: [] });
  // Escape LIKE wildcards in the user's own search text so a literal % or _ in what they
  // typed can't act as a wildcard against the index (migration 0015: idx_characters_name_lower).
  const escaped = q.replace(/[\\%_]/g, (m) => "\\" + m);
  const rows = await db.prepare(
    `SELECT character_id, name, level, last_active_at FROM characters
     WHERE LOWER(name) LIKE LOWER(?) || '%' ESCAPE '\\' AND character_id != ?
     ORDER BY name LIMIT 20`
  ).bind(escaped, characterId).all();
  const results = rows.results || [];
  if (!results.length) return json({ ok: true, results: [] });
  const [friendRows, reqRows, blockRows] = await Promise.all([
    db.prepare(`SELECT character_id_a, character_id_b FROM friendships WHERE character_id_a = ? OR character_id_b = ?`).bind(characterId, characterId).all(),
    db.prepare(`SELECT request_id, sender_character_id, receiver_character_id FROM friend_requests WHERE status = 'pending' AND (sender_character_id = ? OR receiver_character_id = ?)`).bind(characterId, characterId).all(),
    db.prepare(`SELECT blocker_character_id, blocked_character_id FROM character_blocks WHERE blocker_character_id = ? OR blocked_character_id = ?`).bind(characterId, characterId).all(),
  ]);
  const friendSet = new Set((friendRows.results || []).map((r) => (r.character_id_a === characterId ? r.character_id_b : r.character_id_a)));
  const outgoingMap = new Map();
  const incomingMap = new Map();
  (reqRows.results || []).forEach((r) => {
    if (r.sender_character_id === characterId) outgoingMap.set(r.receiver_character_id, r.request_id);
    else incomingMap.set(r.sender_character_id, r.request_id);
  });
  const blockedByMe = new Set();
  const blockingMe = new Set();
  (blockRows.results || []).forEach((r) => {
    if (r.blocker_character_id === characterId) blockedByMe.add(r.blocked_character_id);
    else blockingMe.add(r.blocker_character_id);
  });
  return json({
    ok: true,
    results: results.map((r) => ({
      characterId: r.character_id,
      name: r.name,
      level: r.level,
      guildName: null, // Guild V1 not implemented yet — §3/FRIEND-SYSTEM-V1.md §3 "otherwise null/omit"
      online: isRecentlyActive(r.last_active_at),
      relationship: friendSet.has(r.character_id) ? "friend"
        : blockedByMe.has(r.character_id) ? "blocked_by_me"
        : blockingMe.has(r.character_id) ? "blocking_me"
        : outgoingMap.has(r.character_id) ? "outgoing_pending"
        : incomingMap.has(r.character_id) ? "incoming_pending"
        : "none",
      requestId: outgoingMap.get(r.character_id) || incomingMap.get(r.character_id) || null,
    })),
  });
}

// ---------- Public Player Card / Profile V1 ----------
// This read-only surface intentionally returns character-facing fields only. It reuses the
// existing social relationship tables without changing Friend/Chat mutation rules.
async function handleGetPublicProfile(db, id, session, characterId, targetCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!targetCharacterId) return json({ error: "missing_fields" });

  const target = await db.prepare(
    `SELECT character_id, name, level, str, vit, agi, dex, luk
     FROM characters WHERE character_id = ? LIMIT 1`
  ).bind(targetCharacterId).first();
  if (!target) return json({ error: "character_not_found" });

  const [equippedRows, guildRow, friendRow, requestRow, blockRow, profileFrameKey] = await Promise.all([
    db.prepare(`SELECT atk, def, hp, mp, enhance_level, extra_json FROM items WHERE character_id = ? AND equipped = 1`)
      .bind(targetCharacterId).all(),
    db.prepare(
      `SELECT g.guild_id, g.name, g.level
       FROM guild_members gm JOIN guilds g ON g.guild_id = gm.guild_id
       WHERE gm.character_id = ? LIMIT 1`
    ).bind(targetCharacterId).first(),
    db.prepare(
      `SELECT 1 FROM friendships
       WHERE (character_id_a = ? AND character_id_b = ?) OR (character_id_a = ? AND character_id_b = ?)
       LIMIT 1`
    ).bind(characterId, targetCharacterId, targetCharacterId, characterId).first(),
    db.prepare(
      `SELECT sender_character_id, receiver_character_id FROM friend_requests
       WHERE status = 'pending' AND expires_at > ?
       AND ((sender_character_id = ? AND receiver_character_id = ?) OR (sender_character_id = ? AND receiver_character_id = ?))
       LIMIT 1`
    ).bind(nowIso(), characterId, targetCharacterId, targetCharacterId, characterId).first(),
    db.prepare(
      `SELECT blocker_character_id, blocked_character_id FROM character_blocks
       WHERE (blocker_character_id = ? AND blocked_character_id = ?) OR (blocker_character_id = ? AND blocked_character_id = ?)
       LIMIT 1`
    ).bind(characterId, targetCharacterId, targetCharacterId, characterId).first(),
    arenaValidProfileFrame(db, targetCharacterId),
  ]);

  let relationship = "none";
  if (String(characterId) === String(targetCharacterId)) relationship = "self";
  else if (blockRow) relationship = String(blockRow.blocker_character_id) === String(characterId) ? "blocked_by_me" : "blocking_me";
  else if (friendRow) relationship = "friend";
  else if (requestRow) relationship = String(requestRow.sender_character_id) === String(characterId) ? "outgoing_pending" : "incoming_pending";

  return json({
    ok: true,
    profile: {
      name: target.name,
      level: Number(target.level) || 1,
      cp: combatPowerFromCharacter(target, equippedRows.results || []),
      guild: guildRow ? { guildId: guildRow.guild_id, name: guildRow.name, level: Number(guildRow.level) || 1 } : null,
      relationship,
      // Public default is head-only placeholder. Future public cosmetics can provide ordered
      // asset keys here without exposing equipment, inventory, or save data.
      profileFrameKey: profileFrameKey || null,
      avatar: { mode: "head", layers: [] },
    },
  });
}

async function handleGetFriendList(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const rows = await db.prepare(
    `SELECT c.character_id AS other_id, c.name, c.level, c.last_active_at
     FROM friendships f
     JOIN characters c ON c.character_id = CASE WHEN f.character_id_a = ? THEN f.character_id_b ELSE f.character_id_a END
     WHERE f.character_id_a = ? OR f.character_id_b = ?`
  ).bind(characterId, characterId, characterId).all();
  const friends = (rows.results || []).map((r) => ({
    characterId: r.other_id,
    name: r.name,
    level: r.level,
    guildName: null,
    online: isRecentlyActive(r.last_active_at),
  }));
  // §7 — Online first, stable name-ordering secondary.
  friends.sort((a, b) => (b.online - a.online) || String(a.name).localeCompare(String(b.name)));
  return json({ ok: true, friends, cap: FRIEND_CAP });
}

async function handleGetFriendRequests(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const now = nowIso();
  const [incomingRows, outgoingRows] = await Promise.all([
    db.prepare(
      `SELECT r.request_id, r.created_at, r.expires_at, c.character_id, c.name, c.level, c.last_active_at
       FROM friend_requests r JOIN characters c ON c.character_id = r.sender_character_id
       WHERE r.receiver_character_id = ? AND r.status = 'pending' AND r.expires_at > ?
       ORDER BY r.created_at DESC`
    ).bind(characterId, now).all(),
    db.prepare(
      `SELECT r.request_id, r.created_at, r.expires_at, c.character_id, c.name, c.level, c.last_active_at
       FROM friend_requests r JOIN characters c ON c.character_id = r.receiver_character_id
       WHERE r.sender_character_id = ? AND r.status = 'pending' AND r.expires_at > ?
       ORDER BY r.created_at DESC`
    ).bind(characterId, now).all(),
  ]);
  const shape = (r) => ({ requestId: r.request_id, characterId: r.character_id, name: r.name, level: r.level, online: isRecentlyActive(r.last_active_at), createdAt: r.created_at, expiresAt: r.expires_at });
  return json({
    ok: true,
    incoming: (incomingRows.results || []).map(shape),
    outgoing: (outgoingRows.results || []).map(shape),
    outgoingCap: FRIEND_OUTGOING_PENDING_CAP,
  });
}

async function handleGetBlockedList(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const rows = await db.prepare(
    `SELECT cb.blocked_character_id, cb.created_at, c.name, c.level
     FROM character_blocks cb JOIN characters c ON c.character_id = cb.blocked_character_id
     WHERE cb.blocker_character_id = ? ORDER BY cb.created_at DESC`
  ).bind(characterId).all();
  return json({ ok: true, blocked: (rows.results || []).map((r) => ({ characterId: r.blocked_character_id, name: r.name, level: r.level })) });
}

async function handleSendFriendRequest(db, id, session, characterId, targetCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!targetCharacterId) return json({ error: "missing_fields" });
  if (targetCharacterId === characterId) return json({ error: "cannot_request_self" });

  const target = await getRow(db, "characters", "character_id", targetCharacterId);
  if (!target) return json({ error: "character_not_found" });
  if (await isBlockedEitherDirection(db, characterId, targetCharacterId)) return json({ error: "blocked_relationship" });
  if (await areFriends(db, characterId, targetCharacterId)) return json({ error: "already_friends" });

  const now = nowIso();
  // Cross-request handling (§4): a pending request already existing in EITHER direction
  // must not create a second row — report what exists so the UI can Accept/Reject the
  // reverse-direction request instead, or just show "already sent" for the same direction.
  const existing = await db.prepare(
    `SELECT request_id, sender_character_id FROM friend_requests
     WHERE status = 'pending' AND ((sender_character_id = ? AND receiver_character_id = ?) OR (sender_character_id = ? AND receiver_character_id = ?))
     LIMIT 1`
  ).bind(characterId, targetCharacterId, targetCharacterId, characterId).first();
  if (existing) {
    return json({
      error: "request_already_exists",
      existingRequestId: existing.request_id,
      reverseDirection: existing.sender_character_id === targetCharacterId,
    });
  }

  const outgoingCount = await db.prepare(
    `SELECT COUNT(*) AS c FROM friend_requests WHERE sender_character_id = ? AND status = 'pending' AND expires_at > ?`
  ).bind(characterId, now).first();
  if (Number(outgoingCount?.c || 0) >= FRIEND_OUTGOING_PENDING_CAP) return json({ error: "outgoing_request_cap_reached" });

  const requestId = `freq-${randomToken(16)}`;
  const expiresAt = new Date(Date.now() + FRIEND_REQUEST_EXPIRY_MS).toISOString();
  try {
    await db.prepare(
      `INSERT INTO friend_requests (request_id, sender_character_id, receiver_character_id, status, created_at, expires_at) VALUES (?, ?, ?, 'pending', ?, ?)`
    ).bind(requestId, characterId, targetCharacterId, now, expiresAt).run();
  } catch (e) {
    // Belt-and-suspenders: migration 0015's partial unique index catches a genuine race
    // between two near-simultaneous sends that both passed the pre-check above.
    if (String((e && e.message) || e).includes("UNIQUE constraint failed")) return json({ error: "request_already_exists" });
    throw e;
  }
  return json({ ok: true, requestId, expiresAt });
}

async function handleAcceptFriendRequest(db, id, session, characterId, requestId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!requestId) return json({ error: "missing_fields" });

  const request = await getRow(db, "friend_requests", "request_id", requestId);
  if (!request) return json({ error: "request_not_found" });
  if (String(request.receiver_character_id) !== String(characterId)) return json({ error: "forbidden" });
  if (request.status !== "pending") return json({ error: "request_not_pending" });
  if (Date.parse(request.expires_at) <= Date.now()) return json({ error: "request_expired" });

  const senderId = request.sender_character_id;
  if (await isBlockedEitherDirection(db, characterId, senderId)) return json({ error: "blocked_relationship" });

  const now = nowIso();
  // Single atomic statement carries the whole Accept transaction (§5/§6/§13): it
  // re-verifies the request is still pending+unexpired, enforces both friend caps, and
  // creates exactly one normalized friendship row — all inside one INSERT...SELECT, so a
  // concurrent double-Accept or a capacity race can't land between a read and a later
  // write. ON CONFLICT DO NOTHING also turns an already-existing friendship into a clean
  // no-op instead of a thrown constraint error.
  const [a, b] = normalizeFriendPair(characterId, senderId);
  const created = await db.prepare(
    `INSERT INTO friendships (character_id_a, character_id_b, created_at)
     SELECT ?, ?, ?
     WHERE EXISTS (SELECT 1 FROM friend_requests WHERE request_id = ? AND status = 'pending' AND expires_at > ?)
       AND (SELECT COUNT(*) FROM friendships WHERE character_id_a = ? OR character_id_b = ?) < ?
       AND (SELECT COUNT(*) FROM friendships WHERE character_id_a = ? OR character_id_b = ?) < ?
     ON CONFLICT(character_id_a, character_id_b) DO NOTHING`
  ).bind(a, b, now, requestId, now, characterId, characterId, FRIEND_CAP, senderId, senderId, FRIEND_CAP).run();

  if (!created.meta || !created.meta.changes) {
    // Disambiguate only on this rare failure path — one extra read so the client gets a
    // specific, actionable error instead of a generic one. The request is left exactly as
    // it was (still pending, unless it was independently resolved elsewhere) — §2 requires
    // it to remain pending when the failure is capacity.
    const [stillPending, alreadyFriends, myCount, senderCount] = await Promise.all([
      db.prepare(`SELECT 1 FROM friend_requests WHERE request_id = ? AND status = 'pending' AND expires_at > ?`).bind(requestId, nowIso()).first(),
      db.prepare(`SELECT 1 FROM friendships WHERE character_id_a = ? AND character_id_b = ?`).bind(a, b).first(),
      db.prepare(`SELECT COUNT(*) AS c FROM friendships WHERE character_id_a = ? OR character_id_b = ?`).bind(characterId, characterId).first(),
      db.prepare(`SELECT COUNT(*) AS c FROM friendships WHERE character_id_a = ? OR character_id_b = ?`).bind(senderId, senderId).first(),
    ]);
    if (alreadyFriends) return json({ error: "already_friends" });
    if (!stillPending) return json({ error: "request_not_pending" });
    if (Number(myCount?.c || 0) >= FRIEND_CAP || Number(senderCount?.c || 0) >= FRIEND_CAP) return json({ error: "friend_limit_reached" });
    return json({ error: "friend_limit_reached" });
  }

  // Friendship now exists — resolve the request. Guarded by status='pending' as a second
  // layer of defense, even though the INSERT above already re-verified this the instant before.
  await db.prepare(`UPDATE friend_requests SET status = 'accepted', resolved_at = ? WHERE request_id = ? AND status = 'pending'`).bind(now, requestId).run();
  return json({ ok: true, characterId: senderId });
}

async function handleRejectFriendRequest(db, id, session, characterId, requestId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!requestId) return json({ error: "missing_fields" });
  const updated = await db.prepare(
    `UPDATE friend_requests SET status = 'rejected', resolved_at = ? WHERE request_id = ? AND receiver_character_id = ? AND status = 'pending'`
  ).bind(nowIso(), requestId, characterId).run();
  if (!updated.meta || !updated.meta.changes) return json({ error: "request_not_pending" });
  return json({ ok: true });
}

async function handleCancelFriendRequest(db, id, session, characterId, requestId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!requestId) return json({ error: "missing_fields" });
  const updated = await db.prepare(
    `UPDATE friend_requests SET status = 'cancelled', resolved_at = ? WHERE request_id = ? AND sender_character_id = ? AND status = 'pending'`
  ).bind(nowIso(), requestId, characterId).run();
  if (!updated.meta || !updated.meta.changes) return json({ error: "request_not_pending" });
  return json({ ok: true });
}

async function handleRemoveFriend(db, id, session, characterId, targetCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!targetCharacterId) return json({ error: "missing_fields" });
  const [a, b] = normalizeFriendPair(characterId, targetCharacterId);
  await db.prepare(`DELETE FROM friendships WHERE character_id_a = ? AND character_id_b = ?`).bind(a, b).run();
  return json({ ok: true }); // idempotent — succeeds even with no existing friendship (§7)
}

// Friend-facing block: reuses the Phase 1 character_blocks primitive but additionally
// removes any active friendship and cancels pending requests in BOTH directions (§8/§9),
// all as one atomic batch so a request can never be left pointing at a now-blocked pair.
async function handleBlockCharacter(db, id, session, characterId, targetCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!targetCharacterId) return json({ error: "missing_fields" });
  if (targetCharacterId === characterId) return json({ error: "cannot_block_self" });
  const [a, b] = normalizeFriendPair(characterId, targetCharacterId);
  const now = nowIso();
  await db.batch([
    db.prepare(`DELETE FROM friendships WHERE character_id_a = ? AND character_id_b = ?`).bind(a, b),
    db.prepare(
      `UPDATE friend_requests SET status = 'cancelled', resolved_at = ? WHERE status = 'pending' AND ((sender_character_id = ? AND receiver_character_id = ?) OR (sender_character_id = ? AND receiver_character_id = ?))`
    ).bind(now, characterId, targetCharacterId, targetCharacterId, characterId),
    db.prepare(
      `INSERT INTO character_blocks (blocker_character_id, blocked_character_id, created_at) VALUES (?, ?, ?) ON CONFLICT(blocker_character_id, blocked_character_id) DO NOTHING`
    ).bind(characterId, targetCharacterId, now),
  ]);
  return json({ ok: true });
}
async function handleUnblockCharacter(db, id, session, characterId, targetCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const result = await unblockCharacter(db, characterId, targetCharacterId);
  if (result.error) return json(result);
  return json({ ok: true }); // does not restore friendship or resend a request (§8)
}

// ---------- Chat System V1 (docs/CHAT-SYSTEM-V1.md) — Phase 3 ----------
// Global, Guild and Direct share this engine; stickers remain a placeholder. Reuses the legacy chat_messages table from
// migration_v3.sql (channel/from_character_id/to_character_id/message/created_at) via
// migration 0016's additive conversation_key column + chat_read_state table, rather than
// a separate chat_channels/chat_channel_members architecture — avoids duplicate storage
// for a table that already covers the 'world'/'whisper' channels V1 needs.
const CHAT_GLOBAL_MAX_LEN = 200; // §8
const CHAT_DIRECT_MAX_LEN = 300; // §8
const CHAT_GLOBAL_RATE_MS = 3000; // §9 "~1 send / 3s"
const CHAT_DIRECT_RATE_MS = 1500; // §9 "~1 send / 1-2s"
const CHAT_GLOBAL_RETENTION_DAYS = 7; // §7
const CHAT_DIRECT_RETENTION_DAYS = 30; // §7
const CHAT_GUILD_MAX_LEN = 300;
const CHAT_GUILD_RETENTION_DAYS = 14;
const CHAT_GUILD_RATE_MS = CHAT_DIRECT_RATE_MS;
const CHAT_POLL_PAGE_SIZE = 50; // §6 "initial latest ~50 messages"

// Same normalization convention as friendships.character_id_a/b: always the
// lexicographically-smaller id first, so a conversation has exactly one key regardless
// of who's asking or who sent which message.
function normalizeConversationKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

// §8 sanitation: no trusted HTML (plain text only — nothing here interprets markup),
// normalize/collapse whitespace, strip unsafe control characters, bound newlines.
// Returns "" for anything that sanitizes down to nothing — caller treats that as
// message_empty. Length is checked separately by the caller against the channel's own
// max (Global 200 / Direct 300) so the error is message_too_long, not a silent truncation.
function sanitizeChatMessage(raw) {
  if (typeof raw !== "string") return "";
  let s = raw.replace(/\r\n?/g, "\n");
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""); // strip control chars, keep \n
  s = s.replace(/[ \t]+/g, " "); // collapse horizontal whitespace runs
  s = s.replace(/\n{2,}/g, "\n"); // bound consecutive newlines to one
  s = s.split("\n").map((line) => line.trim()).join("\n").trim();
  return s;
}

async function getBlockedCharacterIds(db, characterId) {
  const rows = await db.prepare(`SELECT blocked_character_id FROM character_blocks WHERE blocker_character_id = ?`).bind(characterId).all();
  return (rows.results || []).map((r) => r.blocked_character_id);
}

function shapeChatRow(m) {
  return { id: m.id, characterId: m.from_character_id, name: m.from_name, text: m.message, createdAt: m.created_at };
}

async function handleGetGlobalChat(db, id, session, characterId, afterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const after = Number(afterId) || 0;
  const blockedIds = await getBlockedCharacterIds(db, characterId);
  // §2 fix — filter blocked senders in SQL BEFORE LIMIT, not after fetching. Filtering
  // in JS after the LIMIT let an entire page get consumed by a blocked sender's
  // messages, leaving the client with an empty visible batch and no way to advance its
  // polling cursor past that blocked range — it would re-fetch the same stuck window
  // forever. Every row this query returns is now guaranteed visible, so its max id is
  // always safe to advance the cursor to.
  const blockedClause = blockedIds.length ? ` AND from_character_id NOT IN (${blockedIds.map(() => "?").join(",")})` : "";
  const rows = after > 0
    ? await db.prepare(`SELECT id, from_character_id, from_name, message, created_at FROM chat_messages WHERE channel='world' AND id > ?${blockedClause} ORDER BY id ASC LIMIT 200`).bind(after, ...blockedIds).all()
    : await db.prepare(`SELECT id, from_character_id, from_name, message, created_at FROM chat_messages WHERE channel='world'${blockedClause} ORDER BY id DESC LIMIT ?`).bind(...blockedIds, CHAT_POLL_PAGE_SIZE).all();
  let results = rows.results || [];
  if (!after) results = results.reverse(); // oldest -> newest for initial load; incremental is already ASC
  return json({ ok: true, messages: results.map(shapeChatRow) });
}

async function handleSendGlobalMessage(db, id, session, characterId, text, nonce) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  // §3 — idempotency check first, before any validation, so a genuine retry of an
  // already-successful send is never rejected by that send's own rate-limit footprint.
  if (nonce) {
    const existing = await db.prepare(`SELECT id, created_at FROM chat_messages WHERE channel='world' AND from_character_id=? AND client_nonce=?`).bind(characterId, nonce).first();
    if (existing) return json({ ok: true, id: existing.id, createdAt: existing.created_at, replay: true });
  }
  const clean = sanitizeChatMessage(text);
  if (!clean) return json({ error: "message_empty" });
  if (clean.length > CHAT_GLOBAL_MAX_LEN) return json({ error: "message_too_long" });
  const last = await db.prepare(`SELECT created_at FROM chat_messages WHERE channel='world' AND from_character_id=? ORDER BY id DESC LIMIT 1`).bind(characterId).first();
  if (last && Date.now() - Date.parse(last.created_at) < CHAT_GLOBAL_RATE_MS) return json({ error: "chat_rate_limited" });
  const now = nowIso();
  try {
    const result = await db.prepare(
      `INSERT INTO chat_messages (channel, from_character_id, from_name, message, created_at, client_nonce) VALUES ('world', ?, ?, ?, ?, ?)`
    ).bind(characterId, auth.character.name, clean, now, nonce || null).run();
    return json({ ok: true, id: result.meta.last_row_id, createdAt: now });
  } catch (e) {
    // Belt-and-suspenders: migration 0018's partial unique index catches a genuine race
    // between two near-simultaneous retries that both passed the pre-check above.
    if (nonce && String((e && e.message) || e).includes("UNIQUE constraint failed")) {
      const existing = await db.prepare(`SELECT id, created_at FROM chat_messages WHERE channel='world' AND from_character_id=? AND client_nonce=?`).bind(characterId, nonce).first();
      if (existing) return json({ ok: true, id: existing.id, createdAt: existing.created_at, replay: true });
    }
    throw e;
  }
}

async function getCurrentGuildMembership(db, characterId) {
  return db.prepare(
    `SELECT gm.guild_id, gm.role, g.name FROM guild_members gm JOIN guilds g ON g.guild_id = gm.guild_id WHERE gm.character_id = ?`
  ).bind(characterId).first();
}

function guildChatKey(guildId) { return `guild:${guildId}`; }

async function guildChatStatus(db, characterId, membership) {
  const key = guildChatKey(membership.guild_id);
  let read = await db.prepare(`SELECT last_read_message_id FROM chat_read_state WHERE character_id = ? AND conversation_key = ?`).bind(characterId, key).first();
  if (!read) {
    // Existing members entering W3 for the first time receive a baseline too; retained
    // pre-launch history must not become surprise unread.
    await initializeGuildChatBaseline(db, characterId, membership.guild_id);
    read = await db.prepare(`SELECT last_read_message_id FROM chat_read_state WHERE character_id = ? AND conversation_key = ?`).bind(characterId, key).first();
  }
  const blockedIds = await getBlockedCharacterIds(db, characterId);
  const blockedClause = blockedIds.length ? ` AND from_character_id NOT IN (${blockedIds.map(() => "?").join(",")})` : "";
  const cutoff = new Date(Date.now() - CHAT_GUILD_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const unread = await db.prepare(
    `SELECT 1 AS has_unread FROM chat_messages WHERE channel='guild' AND guild_id=? AND created_at>=? AND id>? AND from_character_id!=?${blockedClause} LIMIT 1`
  ).bind(membership.guild_id, cutoff, Number((read && read.last_read_message_id) || 0), characterId, ...blockedIds).first();
  return { guildId: membership.guild_id, name: membership.name, unread: !!unread };
}

async function handleGetGuildChat(db, id, session, characterId, afterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const membership = await getCurrentGuildMembership(db, characterId);
  if (!membership) return json({ error: "not_guild_member" });
  const after = Number(afterId) || 0;
  const blockedIds = await getBlockedCharacterIds(db, characterId);
  const blockedClause = blockedIds.length ? ` AND from_character_id NOT IN (${blockedIds.map(() => "?").join(",")})` : "";
  const cutoff = new Date(Date.now() - CHAT_GUILD_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const rows = after > 0
    ? await db.prepare(`SELECT id, from_character_id, from_name, message, created_at FROM chat_messages WHERE channel='guild' AND guild_id=? AND created_at>=? AND id>?${blockedClause} ORDER BY id ASC LIMIT 200`).bind(membership.guild_id, cutoff, after, ...blockedIds).all()
    : await db.prepare(`SELECT id, from_character_id, from_name, message, created_at FROM chat_messages WHERE channel='guild' AND guild_id=? AND created_at>=?${blockedClause} ORDER BY id DESC LIMIT ?`).bind(membership.guild_id, cutoff, ...blockedIds, CHAT_POLL_PAGE_SIZE).all();
  let results = rows.results || [];
  if (!after) results = results.reverse();
  const latest = await db.prepare(`SELECT MAX(id) AS max_id FROM chat_messages WHERE channel='guild' AND guild_id=? AND created_at>=?`).bind(membership.guild_id, cutoff).first();
  const pageLimit = after > 0 ? 200 : CHAT_POLL_PAGE_SIZE;
  const cursor = results.length >= pageLimit ? Number(results[results.length - 1].id) : Number((latest && latest.max_id) || (results.length ? results[results.length - 1].id : after));
  return json({ ok: true, guild: { guildId: membership.guild_id, name: membership.name }, messages: results.map(shapeChatRow), cursor });
}

async function handleGetGuildChatStatus(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const membership = await getCurrentGuildMembership(db, characterId);
  if (!membership) return json({ ok: true, guild: null, unread: false });
  return json({ ok: true, guild: await guildChatStatus(db, characterId, membership) });
}

async function handleSendGuildMessage(db, id, session, characterId, text, nonce) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (typeof nonce !== "string" || nonce.length < 8 || nonce.length > 128) return json({ error: "missing_fields" });
  const membership = await getCurrentGuildMembership(db, characterId);
  if (!membership) return json({ error: "not_guild_member" });
  // Check current membership before replay lookup so a leave/kick immediately revokes
  // send access. A nonce only replays within the same current Guild.
  const existing = await db.prepare(`SELECT id, created_at, channel, guild_id FROM chat_messages WHERE from_character_id=? AND client_nonce=?`).bind(characterId, nonce).first();
  if (existing) {
    if (existing.channel !== "guild" || existing.guild_id !== membership.guild_id) return json({ error: "idempotency_conflict" });
    return json({ ok: true, id: existing.id, createdAt: existing.created_at, replay: true });
  }
  const clean = sanitizeChatMessage(text);
  if (!clean) return json({ error: "message_empty" });
  if (clean.length > CHAT_GUILD_MAX_LEN) return json({ error: "message_too_long" });
  const last = await db.prepare(`SELECT created_at FROM chat_messages WHERE channel='guild' AND from_character_id=? ORDER BY id DESC LIMIT 1`).bind(characterId).first();
  if (last && Date.now() - Date.parse(last.created_at) < CHAT_GUILD_RATE_MS) return json({ error: "rate_limited" });
  const now = nowIso();
  try {
    const result = await db.prepare(
      `INSERT INTO chat_messages (channel, guild_id, from_character_id, from_name, message, created_at, client_nonce) VALUES ('guild', ?, ?, ?, ?, ?, ?)`
    ).bind(membership.guild_id, characterId, auth.character.name, clean, now, nonce).run();
    return json({ ok: true, id: result.meta.last_row_id, createdAt: now, replay: false });
  } catch (e) {
    if (String((e && e.message) || e).includes("UNIQUE constraint failed")) {
      const retry = await db.prepare(`SELECT id, created_at, channel, guild_id FROM chat_messages WHERE from_character_id=? AND client_nonce=?`).bind(characterId, nonce).first();
      if (retry && retry.channel === "guild" && retry.guild_id === membership.guild_id) return json({ ok: true, id: retry.id, createdAt: retry.created_at, replay: true });
      if (retry) return json({ error: "idempotency_conflict" });
    }
    throw e;
  }
}

async function handleMarkGuildChatRead(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const membership = await getCurrentGuildMembership(db, characterId);
  if (!membership) return json({ error: "not_guild_member" });
  const key = guildChatKey(membership.guild_id);
  const latest = await db.prepare(`SELECT MAX(id) AS max_id FROM chat_messages WHERE channel='guild' AND guild_id=?`).bind(membership.guild_id).first();
  const maxId = Number((latest && latest.max_id) || 0);
  await db.prepare(
    `INSERT INTO chat_read_state (character_id, conversation_key, last_read_message_id, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(character_id, conversation_key) DO UPDATE SET last_read_message_id = MAX(last_read_message_id, excluded.last_read_message_id), updated_at = excluded.updated_at`
  ).bind(characterId, key, maxId, nowIso()).run();
  return json({ ok: true, lastReadMessageId: maxId, unread: false });
}

async function handleGetDirectMessages(db, id, session, characterId, withCharacterId, afterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!withCharacterId) return json({ error: "missing_fields" });
  const convKey = normalizeConversationKey(characterId, withCharacterId);
  const after = Number(afterId) || 0;
  const rows = after > 0
    ? await db.prepare(`SELECT id, from_character_id, from_name, message, created_at FROM chat_messages WHERE channel='whisper' AND conversation_key=? AND id > ? ORDER BY id ASC LIMIT 200`).bind(convKey, after).all()
    : await db.prepare(`SELECT id, from_character_id, from_name, message, created_at FROM chat_messages WHERE channel='whisper' AND conversation_key=? ORDER BY id DESC LIMIT ?`).bind(convKey, CHAT_POLL_PAGE_SIZE).all();
  let results = rows.results || [];
  if (!after) results = results.reverse();
  // canSend told to the client up front so the thread UI can disable the composer
  // without a separate round trip — mirrors exactly what handleSendDirectMessage itself
  // enforces server-side at send time (§3: unfriend keeps history but disables send;
  // either-direction block denies send).
  const canSend = (await areFriends(db, characterId, withCharacterId)) && !(await isBlockedEitherDirection(db, characterId, withCharacterId));
  return json({ ok: true, messages: results.map(shapeChatRow), canSend });
}

async function handleSendDirectMessage(db, id, session, characterId, toCharacterId, text, nonce) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!toCharacterId || toCharacterId === characterId) return json({ error: "invalid_recipient" });
  // §3 — idempotency check first, same reasoning as handleSendGlobalMessage above.
  if (nonce) {
    const existing = await db.prepare(`SELECT id, created_at, conversation_key FROM chat_messages WHERE channel='whisper' AND from_character_id=? AND client_nonce=?`).bind(characterId, nonce).first();
    if (existing) return json({ ok: true, id: existing.id, createdAt: existing.created_at, conversationKey: existing.conversation_key, replay: true });
  }
  const target = await getRow(db, "characters", "character_id", toCharacterId);
  if (!target) return json({ error: "character_not_found" });
  if (!(await areFriends(db, characterId, toCharacterId))) return json({ error: "not_friends" }); // §3 — DM is friend-only
  if (await isBlockedEitherDirection(db, characterId, toCharacterId)) return json({ error: "blocked_relationship" });
  const clean = sanitizeChatMessage(text);
  if (!clean) return json({ error: "message_empty" });
  if (clean.length > CHAT_DIRECT_MAX_LEN) return json({ error: "message_too_long" });
  const last = await db.prepare(`SELECT created_at FROM chat_messages WHERE channel='whisper' AND from_character_id=? ORDER BY id DESC LIMIT 1`).bind(characterId).first();
  if (last && Date.now() - Date.parse(last.created_at) < CHAT_DIRECT_RATE_MS) return json({ error: "chat_rate_limited" });
  const convKey = normalizeConversationKey(characterId, toCharacterId);
  const now = nowIso();
  try {
    const result = await db.prepare(
      `INSERT INTO chat_messages (channel, from_character_id, from_name, to_character_id, conversation_key, message, created_at, client_nonce) VALUES ('whisper', ?, ?, ?, ?, ?, ?, ?)`
    ).bind(characterId, auth.character.name, toCharacterId, convKey, clean, now, nonce || null).run();
    return json({ ok: true, id: result.meta.last_row_id, createdAt: now, conversationKey: convKey });
  } catch (e) {
    if (nonce && String((e && e.message) || e).includes("UNIQUE constraint failed")) {
      const existing = await db.prepare(`SELECT id, created_at, conversation_key FROM chat_messages WHERE channel='whisper' AND from_character_id=? AND client_nonce=?`).bind(characterId, nonce).first();
      if (existing) return json({ ok: true, id: existing.id, createdAt: existing.created_at, conversationKey: existing.conversation_key, replay: true });
    }
    throw e;
  }
}

async function handleGetDirectConversations(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const rows = await db.prepare(
    `SELECT conversation_key,
            MAX(id) AS last_id,
            MAX(CASE WHEN from_character_id != ? THEN id END) AS last_incoming_id,
            (SELECT message FROM chat_messages m2 WHERE m2.conversation_key = m.conversation_key AND m2.channel='whisper' ORDER BY m2.id DESC LIMIT 1) AS last_message,
            (SELECT created_at FROM chat_messages m3 WHERE m3.conversation_key = m.conversation_key AND m3.channel='whisper' ORDER BY m3.id DESC LIMIT 1) AS last_created_at,
            (SELECT from_character_id FROM chat_messages m4 WHERE m4.conversation_key = m.conversation_key AND m4.channel='whisper' ORDER BY m4.id DESC LIMIT 1) AS last_sender
     FROM chat_messages m
     WHERE channel='whisper' AND (from_character_id = ? OR to_character_id = ?)
     GROUP BY conversation_key`
  ).bind(characterId, characterId, characterId).all();
  const conversations = rows.results || [];
  if (!conversations.length) return json({ ok: true, conversations: [] });

  // conversation_key is "smaller_id:larger_id" — neither half is guaranteed to be
  // `characterId` positionally, so split and take whichever half isn't me.
  const otherIds = conversations.map((c) => {
    const [a, b] = c.conversation_key.split(":");
    return a === characterId ? b : a;
  });
  const uniqueOtherIds = [...new Set(otherIds)];
  const placeholders = uniqueOtherIds.map(() => "?").join(",");
  const charRows = uniqueOtherIds.length
    ? await db.prepare(`SELECT character_id, name, level, last_active_at FROM characters WHERE character_id IN (${placeholders})`).bind(...uniqueOtherIds).all()
    : { results: [] };
  const charMap = new Map((charRows.results || []).map((c) => [c.character_id, c]));

  const readRows = await db.prepare(`SELECT conversation_key, last_read_message_id FROM chat_read_state WHERE character_id = ?`).bind(characterId).all();
  const readMap = new Map((readRows.results || []).map((r) => [r.conversation_key, r.last_read_message_id]));

  const result = [];
  for (let i = 0; i < conversations.length; i++) {
    const c = conversations[i];
    const otherId = otherIds[i];
    const other = charMap.get(otherId);
    if (!other) continue; // other character deleted — skip rather than crash the list (§11: no cascade-delete of history, but nothing left to show a name for)
    const lastRead = readMap.get(c.conversation_key) || 0;
    result.push({
      characterId: otherId,
      name: other.name,
      level: other.level,
      online: isRecentlyActive(other.last_active_at),
      lastMessage: c.last_message,
      lastMessageAt: c.last_created_at,
      lastSenderIsMe: c.last_sender === characterId,
      // §1 fix — unread must only count messages FROM the other character, never my own
      // sent messages (last_incoming_id excludes rows where from_character_id = me).
      unread: c.last_incoming_id != null && Number(c.last_incoming_id) > Number(lastRead),
    });
  }
  result.sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : a.lastMessageAt > b.lastMessageAt ? -1 : 0));
  return json({ ok: true, conversations: result });
}

async function handleMarkConversationRead(db, id, session, characterId, withCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!withCharacterId) return json({ error: "missing_fields" });
  const convKey = normalizeConversationKey(characterId, withCharacterId);
  const latest = await db.prepare(`SELECT MAX(id) AS max_id FROM chat_messages WHERE channel='whisper' AND conversation_key=?`).bind(convKey).first();
  const maxId = Number((latest && latest.max_id) || 0);
  await db.prepare(
    `INSERT INTO chat_read_state (character_id, conversation_key, last_read_message_id, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(character_id, conversation_key) DO UPDATE SET last_read_message_id = MAX(last_read_message_id, excluded.last_read_message_id), updated_at = excluded.updated_at`
  ).bind(characterId, convKey, maxId, nowIso()).run();
  return json({ ok: true, lastReadMessageId: maxId });
}

// §7 retention. Piggybacks on the existing nightly cron (see scheduled() at the bottom of
// this file, alongside runLeaderboardSnapshot/closeOutExpiredRaids) rather than adding a
// new trigger. AUTOINCREMENT ids are never reused after deletion, so purging old rows
// never invalidates an in-flight polling cursor (afterId) for newer messages.
async function runChatRetentionCleanup(db) {
  const globalCutoff = new Date(Date.now() - CHAT_GLOBAL_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const directCutoff = new Date(Date.now() - CHAT_DIRECT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const guildCutoff = new Date(Date.now() - CHAT_GUILD_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const globalResult = await db.prepare(`DELETE FROM chat_messages WHERE channel = 'world' AND created_at < ?`).bind(globalCutoff).run();
  const directResult = await db.prepare(`DELETE FROM chat_messages WHERE channel = 'whisper' AND created_at < ?`).bind(directCutoff).run();
  const guildResult = await db.prepare(`DELETE FROM chat_messages WHERE channel = 'guild' AND created_at < ?`).bind(guildCutoff).run();
  // Keep active guild cursors, and Direct cursors with retained history. Remove orphan
  // Guild state after leave/kick/disband and expired Direct cursors without messages.
  await db.prepare(
    `DELETE FROM chat_read_state AS rs
     WHERE (rs.conversation_key LIKE 'guild:%' AND NOT EXISTS (
       SELECT 1 FROM guild_members gm JOIN guilds g ON g.guild_id=gm.guild_id
       WHERE gm.character_id=rs.character_id AND rs.conversation_key=('guild:' || gm.guild_id)
     ))
     OR (rs.conversation_key NOT LIKE 'guild:%' AND NOT EXISTS (
       SELECT 1 FROM chat_messages m WHERE m.channel='whisper' AND m.conversation_key=rs.conversation_key
     ))`
  ).run();
  return { globalDeleted: (globalResult.meta && globalResult.meta.changes) || 0, guildDeleted: (guildResult.meta && guildResult.meta.changes) || 0, directDeleted: (directResult.meta && directResult.meta.changes) || 0 };
}

// ---------- Guild System V1 Core (docs/GUILD-SYSTEM-V1.md) — Phase 4 ----------
// Core includes create/search/profile, membership lifecycle, donation and Guild Chat;
// rename remains out of scope. Extends the legacy guilds/guild_members tables from
// migration_v3.sql via migration 0017 rather than recreating them.
const GUILD_LEVEL_CAP = 10; // §6
const GUILD_NAME_MIN_LEN = 3; // §3
const GUILD_NAME_MAX_LEN = 20; // §3
const GUILD_CREATE_MIN_LEVEL = 30; // §3
const GUILD_APPLICATION_MAX_PENDING = 5; // §5
const GUILD_LEADER_INACTIVE_HOURS = 36; // §15
const GUILD_SUCCESSION_ACTIVE_HOURS = 24; // §15
// §6 — index 0 unused (levels are 1-based); one central table, never scattered literals.
const GUILD_MEMBER_CAP_BY_LEVEL = [0, 10, 15, 20, 25, 30, 35, 40, 40, 40, 40];
function guildMemberCap(level) {
  const lv = Math.max(1, Math.min(GUILD_LEVEL_CAP, Number(level) || 1));
  return GUILD_MEMBER_CAP_BY_LEVEL[lv];
}

function normalizeGuildName(raw) {
  return String(raw || "").trim().toLowerCase();
}
// §3 — 3-20 chars, trimmed, no control characters. Returns the trimmed display name (not
// normalized) or null if invalid; caller normalizes separately for the uniqueness check.
function validateGuildName(raw) {
  const trimmed = String(raw || "").trim();
  if (trimmed.length < GUILD_NAME_MIN_LEN || trimmed.length > GUILD_NAME_MAX_LEN) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return null;
  return trimmed;
}

// §5 — called after any successful join (open or application-accept) so no other
// pending application for that character can be accepted afterward.
function guildChatBaselineStatement(db, characterId, guildId, now = nowIso()) {
  const key = guildChatKey(guildId);
  return db.prepare(
    `INSERT INTO chat_read_state (character_id, conversation_key, last_read_message_id, updated_at)
     SELECT ?, ?, COALESCE((SELECT MAX(id) FROM chat_messages WHERE channel='guild' AND guild_id=?), 0), ?
     WHERE EXISTS (SELECT 1 FROM guild_members WHERE character_id=? AND guild_id=?)
     ON CONFLICT(character_id, conversation_key) DO UPDATE SET last_read_message_id=excluded.last_read_message_id, updated_at=excluded.updated_at`
  ).bind(characterId, key, guildId, now, characterId, guildId);
}

async function initializeGuildChatBaseline(db, characterId, guildId, now = nowIso()) {
  await guildChatBaselineStatement(db, characterId, guildId, now).run();
}

async function cancelOtherPendingApplications(db, characterId, now) {
  await db.prepare(
    `UPDATE guild_applications SET status = 'cancelled', resolved_at = ? WHERE character_id = ? AND status = 'pending'`
  ).bind(now, characterId).run();
}

// Shared cleanup for both explicit Disband and "sole leader leaves" (§14). Explicit
// deletes rather than relying on the tables' declared ON DELETE CASCADE, matching this
// codebase's established convention elsewhere (e.g. handleDeleteCharacter).
async function disbandGuildInternal(db, guildId) {
  const now = nowIso();
  await db.batch([
    db.prepare(`DELETE FROM guild_members WHERE guild_id = ?`).bind(guildId),
    db.prepare(`DELETE FROM chat_read_state WHERE conversation_key = ?`).bind(guildChatKey(guildId)),
    db.prepare(`UPDATE guild_applications SET status = 'cancelled', resolved_at = ? WHERE guild_id = ? AND status = 'pending'`).bind(now, guildId),
    db.prepare(`DELETE FROM guilds WHERE guild_id = ?`).bind(guildId),
  ]);
}

async function verifyGuildLeader(db, characterId, guildId) {
  const membership = await db.prepare(`SELECT role FROM guild_members WHERE guild_id = ? AND character_id = ?`).bind(guildId, characterId).first();
  if (!membership) return { error: "not_guild_member" };
  if (membership.role !== "leader") return { error: "not_guild_leader" };
  return { ok: true };
}

// §15-16 — single shared succession check, called lazily from guild-viewing endpoints
// (getMyGuild/getGuildProfile) rather than a scheduled job. Race-safe: the leader-update
// is a guarded CAS (WHERE leader_character_id = the leader we just read), so if
// leadership already changed between the read and this write, the role updates below
// are skipped instead of clobbering a newer transfer.
// §6 fix — atomic leader+role transfer. All three writes run inside one D1 batch (a
// single transaction): the guilds.leader_character_id update is the CAS guard, and both
// guild_members role flips independently re-verify (via EXISTS against
// guilds.leader_character_id, which the first statement in this same transaction just
// set) that the leader swap actually took effect before touching any role. This closes
// the old race where a lost/late guilds update and an unconditional guild_members update
// could diverge — if the first statement's guard fails, the EXISTS check in the other
// two correctly evaluates false and they no-op too, atomically, as one unit. Shared by
// both manual transfer and auto succession so the two paths can't drift.
async function transferGuildLeadershipAtomic(db, guildId, fromCharacterId, toCharacterId) {
  const results = await db.batch([
    db.prepare(`UPDATE guilds SET leader_character_id = ? WHERE guild_id = ? AND leader_character_id = ?`).bind(toCharacterId, guildId, fromCharacterId),
    db.prepare(
      `UPDATE guild_members SET role = 'member' WHERE guild_id = ? AND character_id = ? AND EXISTS (SELECT 1 FROM guilds WHERE guild_id = ? AND leader_character_id = ?)`
    ).bind(guildId, fromCharacterId, guildId, toCharacterId),
    db.prepare(
      `UPDATE guild_members SET role = 'leader' WHERE guild_id = ? AND character_id = ? AND EXISTS (SELECT 1 FROM guilds WHERE guild_id = ? AND leader_character_id = ?)`
    ).bind(guildId, toCharacterId, guildId, toCharacterId),
  ]);
  return !!(results && results[0] && results[0].meta && results[0].meta.changes);
}

async function evaluateGuildSuccession(db, guildId) {
  const guild = await db.prepare(`SELECT guild_id, leader_character_id FROM guilds WHERE guild_id = ?`).bind(guildId).first();
  if (!guild) return;
  const leader = await db.prepare(`SELECT last_active_at FROM characters WHERE character_id = ?`).bind(guild.leader_character_id).first();
  if (!leader) return;
  const inactiveMs = GUILD_LEADER_INACTIVE_HOURS * 60 * 60 * 1000;
  if (Date.now() - Date.parse(leader.last_active_at || "") < inactiveMs) return;
  const activeCutoff = new Date(Date.now() - GUILD_SUCCESSION_ACTIVE_HOURS * 60 * 60 * 1000).toISOString();
  const candidates = await db.prepare(
    `SELECT gm.character_id, gm.joined_at, c.level, c.last_active_at
     FROM guild_members gm JOIN characters c ON c.character_id = gm.character_id
     WHERE gm.guild_id = ? AND gm.character_id != ? AND gm.role = 'member' AND c.last_active_at >= ?
     ORDER BY c.level DESC, c.last_active_at DESC, gm.joined_at ASC, gm.character_id ASC
     LIMIT 1`
  ).bind(guildId, guild.leader_character_id, activeCutoff).all();
  const winner = (candidates.results || [])[0];
  if (!winner) return; // no eligible member — try again next time this is evaluated
  await transferGuildLeadershipAtomic(db, guildId, guild.leader_character_id, winner.character_id);
}

// Shared shaping for both getMyGuild and getGuildProfile.
async function buildGuildProfileResponse(db, guildId, viewerCharacterId) {
  const guild = await getRow(db, "guilds", "guild_id", guildId);
  if (!guild) return json({ error: "guild_not_found" });
  const guildProgression = await db.prepare(`SELECT level, cumulative_exp FROM guild_donation_progression ORDER BY level`).all();
  const progressionRows = guildProgression.results || [];
  const currentThreshold = progressionRows.find(row => Number(row.level) === Number(guild.level));
  const nextThreshold = progressionRows.find(row => Number(row.level) === Number(guild.level) + 1);
  const memberRows = await db.prepare(
    `SELECT gm.character_id, gm.role, gm.joined_at, gm.contribution, c.name, c.level, c.last_active_at
     FROM guild_members gm JOIN characters c ON c.character_id = gm.character_id
     WHERE gm.guild_id = ? ORDER BY (gm.role = 'leader') DESC, gm.contribution DESC, gm.joined_at ASC`
  ).bind(guildId).all();
  const members = (memberRows.results || []).map((m) => ({
    characterId: m.character_id, name: m.name, level: m.level, role: m.role,
    online: isRecentlyActive(m.last_active_at), contribution: m.contribution, joinedAt: m.joined_at,
  }));
  const viewerMembership = viewerCharacterId ? members.find((m) => m.characterId === viewerCharacterId) : null;
  return json({
    ok: true,
    guild: {
      guildId: guild.guild_id, name: guild.name, description: guild.description,
      level: guild.level, exp: guild.exp, joinPolicy: guild.join_policy,
      expToNext: nextThreshold ? Math.max(0, Number(nextThreshold.cumulative_exp) - Number(guild.exp)) : 0,
      expProgress: currentThreshold ? Math.max(0, Number(guild.exp) - Number(currentThreshold.cumulative_exp)) : Number(guild.exp),
      expRequired: nextThreshold && currentThreshold ? Number(nextThreshold.cumulative_exp) - Number(currentThreshold.cumulative_exp) : 0,
      atCap: !nextThreshold,
      leaderCharacterId: guild.leader_character_id,
      memberCount: members.length, memberCap: guildMemberCap(guild.level),
      members,
      viewerRole: viewerMembership ? viewerMembership.role : null,
    },
  });
}

function guildDonationErrorFromDb(error) {
  const message = String((error && error.message) || error || "");
  for (const code of ["invalid_quantity", "donation_item_not_allowed", "not_guild_member", "insufficient_donation_items", "donation_conflict"]) {
    if (message.includes(code)) return code;
  }
  return "donation_conflict";
}

async function shapeGuildDonation(db, receipt, replay) {
  const guild = await db.prepare(`SELECT level, exp FROM guilds WHERE guild_id = ?`).bind(receipt.guild_id).first();
  const member = await db.prepare(`SELECT contribution FROM guild_members WHERE guild_id = ? AND character_id = ?`)
    .bind(receipt.guild_id, receipt.character_id).first();
  const thresholds = await db.prepare(`SELECT level, cumulative_exp FROM guild_donation_progression ORDER BY level`).all();
  const rows = thresholds.results || [];
  const capRow = rows[rows.length - 1] || { cumulative_exp: 0 };
  const exp = guild ? Number(guild.exp) : Number(receipt.guild_exp_after);
  const level = guild ? Number(guild.level) : Number(receipt.guild_level_after);
  const currentThreshold = rows.find(r => Number(r.level) === level);
  const nextThreshold = rows.find(r => Number(r.level) === level + 1);
  const remaining = await db.prepare(
    `SELECT COALESCE(SUM(CAST(json_extract(extra_json, '$.quantity') AS INTEGER)), 0) AS quantity
     FROM items WHERE character_id = ? AND slot_type = 'junk' AND json_extract(extra_json, '$.junkId') = ?
       AND equipped = 0 AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1`
  ).bind(receipt.character_id, receipt.junk_id).first();
  return {
    ok: true, replay: !!replay, donationId: receipt.donation_id, junkId: receipt.junk_id,
    quantity: Number(receipt.quantity), guildExpGranted: Number(receipt.guild_exp_granted),
    contributionGranted: Number(receipt.contribution_granted),
    guild: { level, exp, expToNext: nextThreshold ? Math.max(0, Number(nextThreshold.cumulative_exp) - exp) : 0,
      expProgress: currentThreshold ? Math.max(0, exp - Number(currentThreshold.cumulative_exp)) : exp,
      expRequired: nextThreshold ? Number(nextThreshold.cumulative_exp) - Number(currentThreshold.cumulative_exp) : 0,
      atCap: !nextThreshold, memberCap: guildMemberCap(level) },
    member: { contribution: member ? Number(member.contribution) : Number(receipt.contribution_granted) },
    remainingQuantity: Number((remaining && remaining.quantity) || 0),
  };
}

async function handleDonateGuildItem(db, id, session, characterId, junkId, quantityInput, donationId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json({ error: auth.error });
  const config = await db.prepare(`SELECT whitelist_json, guild_exp_per_item, contribution_per_item, min_quantity, max_quantity, level_cap FROM guild_donation_config WHERE config_id = 1`).first();
  if (!config) return json({ error: "donation_conflict" });
  let whitelist = [];
  try { whitelist = JSON.parse(config.whitelist_json || "[]"); } catch (_) { whitelist = []; }
  const quantity = Number(quantityInput);
  if (!Number.isInteger(quantity) || quantity < Number(config.min_quantity) || quantity > Number(config.max_quantity)) return json({ error: "invalid_quantity" });
  if (!donationId || String(donationId).length > 128) return json({ error: "missing_fields" });

  const prior = await db.prepare(`SELECT * FROM guild_donations WHERE donation_id = ?`).bind(String(donationId)).first();
  if (prior) return prior.character_id === characterId
    ? json(await shapeGuildDonation(db, prior, true)) : json({ error: "donation_conflict" });
  if (!whitelist.includes(String(junkId || ""))) return json({ error: "donation_item_not_allowed" });

  const membership = await db.prepare(`SELECT guild_id FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership) return json({ error: "not_guild_member" });
  const stacks = await db.prepare(
    `SELECT item_id, equipped, COALESCE(json_extract(extra_json, '$.favorite'), 0) AS favorite,
       CAST(json_extract(extra_json, '$.quantity') AS INTEGER) AS quantity
     FROM items WHERE character_id = ? AND slot_type = 'junk' AND json_extract(extra_json, '$.junkId') = ?`
  ).bind(characterId, junkId).all();
  const stackRows = stacks.results || [];
  if (!stackRows.length) return json({ error: "item_not_found" });
  const total = rows => rows.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
  const eligible = stackRows.filter(row => Number(row.equipped) === 0 && Number(row.favorite) !== 1);
  if (total(eligible) < quantity) {
    if (total(stackRows.filter(row => Number(row.equipped) === 0)) >= quantity) return json({ error: "item_locked" });
    if (total(stackRows) >= quantity) return json({ error: "item_equipped" });
    return json({ error: "insufficient_quantity" });
  }
  const guild = await db.prepare(`SELECT level, exp FROM guilds WHERE guild_id = ?`).bind(membership.guild_id).first();
  if (!guild) return json({ error: "donation_conflict" });
  const progression = await db.prepare(`SELECT level, cumulative_exp FROM guild_donation_progression ORDER BY level`).all();
  const levels = progression.results || [];
  const cap = Number(levels[levels.length - 1]?.cumulative_exp || 0);
  const expBefore = Number(guild.exp || 0);
  const expAfter = Math.min(cap, expBefore + quantity * Number(config.guild_exp_per_item));
  const levelAfter = Math.min(Number(config.level_cap), Math.max(1, ...levels.filter(row => Number(row.cumulative_exp) <= expAfter).map(row => Number(row.level))));
  const now = nowIso();
  const receiptValues = {
    donation_id: String(donationId), guild_id: membership.guild_id, character_id: characterId,
    junk_id: junkId, quantity, guild_exp_granted: expAfter - expBefore,
    contribution_granted: quantity * Number(config.contribution_per_item), guild_level_before: Number(guild.level), guild_level_after: levelAfter,
    guild_exp_before: expBefore, guild_exp_after: expAfter, created_at: now,
  };
  // D1 remote migrations currently reject CREATE TRIGGER...BEGIN blocks in our migration lane.
  // Keep the same transaction guarantees inside one D1 batch instead. A per-donation
  // lock row in guild_donation_stack_snapshot makes only one concurrent request the
  // mutating owner; every later statement is guarded by that lock + this receipt's
  // created_at, so a nonce replay can never consume items or add contribution twice.
  const operationToken = Math.floor(Math.random() * 0x7fffffff) + 1;
  try {
    const batch = await db.batch([
      db.prepare(
        `INSERT OR IGNORE INTO guild_donation_stack_snapshot
         (donation_id, item_id, stack_position, quantity) VALUES (?, '__lock__', -1, ?)`
      ).bind(receiptValues.donation_id, operationToken),
      db.prepare(
        `INSERT INTO guild_donations
         (donation_id, guild_id, character_id, junk_id, quantity, guild_exp_granted, contribution_granted,
          guild_level_before, guild_level_after, guild_exp_before, guild_exp_after, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM guild_donation_stack_snapshot
           WHERE donation_id=? AND item_id='__lock__' AND quantity=?
         )
         AND EXISTS (
           SELECT 1 FROM guild_members WHERE guild_id=? AND character_id=?
         )
         AND EXISTS (
           SELECT 1 FROM guilds WHERE guild_id=? AND exp=? AND level=?
         )
         AND COALESCE((
           SELECT SUM(CAST(json_extract(extra_json, '$.quantity') AS INTEGER))
           FROM items
           WHERE character_id=? AND slot_type='junk' AND json_extract(extra_json, '$.junkId')=?
             AND equipped=0 AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
         ), 0) >= ?
         ON CONFLICT(donation_id) DO NOTHING`
      ).bind(
        receiptValues.donation_id, receiptValues.guild_id, receiptValues.character_id, receiptValues.junk_id,
        receiptValues.quantity, receiptValues.guild_exp_granted, receiptValues.contribution_granted,
        receiptValues.guild_level_before, receiptValues.guild_level_after, receiptValues.guild_exp_before,
        receiptValues.guild_exp_after, receiptValues.created_at,
        receiptValues.donation_id, operationToken,
        receiptValues.guild_id, receiptValues.character_id,
        receiptValues.guild_id, receiptValues.guild_exp_before, receiptValues.guild_level_before,
        receiptValues.character_id, receiptValues.junk_id, receiptValues.quantity
      ),
      db.prepare(
        `INSERT OR IGNORE INTO guild_donation_stack_snapshot(donation_id, item_id, stack_position, quantity)
         SELECT ?, item_id, ROW_NUMBER() OVER (ORDER BY rowid),
           CAST(json_extract(extra_json, '$.quantity') AS INTEGER)
         FROM items
         WHERE character_id=? AND slot_type='junk' AND json_extract(extra_json, '$.junkId')=?
           AND equipped=0 AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
           AND CAST(json_extract(extra_json, '$.quantity') AS INTEGER) > 0
           AND EXISTS (
             SELECT 1 FROM guild_donations
             WHERE donation_id=? AND character_id=? AND created_at=?
           )
           AND EXISTS (
             SELECT 1 FROM guild_donation_stack_snapshot
             WHERE donation_id=? AND item_id='__lock__' AND quantity=?
           )`
      ).bind(
        receiptValues.donation_id, receiptValues.character_id, receiptValues.junk_id,
        receiptValues.donation_id, receiptValues.character_id, receiptValues.created_at,
        receiptValues.donation_id, operationToken
      ),
      db.prepare(
        `UPDATE items SET extra_json = json_set(extra_json, '$.quantity', (
           SELECT snapshot.quantity - MIN(snapshot.quantity, MAX(0, ? - COALESCE((
             SELECT SUM(prior.quantity) FROM guild_donation_stack_snapshot prior
             WHERE prior.donation_id=? AND prior.stack_position >= 0
               AND prior.stack_position < snapshot.stack_position
           ), 0)))
           FROM guild_donation_stack_snapshot snapshot
           WHERE snapshot.donation_id=? AND snapshot.item_id=items.item_id
         ))
         WHERE item_id IN (
           SELECT item_id FROM guild_donation_stack_snapshot
           WHERE donation_id=? AND stack_position >= 0
         )
         AND EXISTS (
           SELECT 1 FROM guild_donations
           WHERE donation_id=? AND character_id=? AND created_at=?
         )
         AND EXISTS (
           SELECT 1 FROM guild_donation_stack_snapshot
           WHERE donation_id=? AND item_id='__lock__' AND quantity=?
         )`
      ).bind(
        receiptValues.quantity, receiptValues.donation_id, receiptValues.donation_id, receiptValues.donation_id,
        receiptValues.donation_id, receiptValues.character_id, receiptValues.created_at,
        receiptValues.donation_id, operationToken
      ),
      // The lock row uses operationToken as its quantity and must never be included in
      // the consumed stack total. If the update did not consume exactly the requested
      // quantity, deliberately hit the existing lock-row primary key so D1 rolls back
      // the receipt, inventory, Guild EXP, and Contribution together.
      db.prepare(
        `INSERT INTO guild_donation_stack_snapshot(donation_id, item_id, stack_position, quantity)
         SELECT ?, '__lock__', -1, ?
         WHERE changes() = 0
            OR COALESCE((
              SELECT SUM(CAST(json_extract(i.extra_json, '$.quantity') AS INTEGER))
              FROM items i
              JOIN guild_donation_stack_snapshot s
                ON s.donation_id=? AND s.item_id=i.item_id AND s.stack_position >= 0
            ), 0) != COALESCE((
              SELECT SUM(quantity) FROM guild_donation_stack_snapshot
              WHERE donation_id=? AND stack_position >= 0
            ), 0) - ?`
      ).bind(
        receiptValues.donation_id, operationToken,
        receiptValues.donation_id, receiptValues.donation_id, receiptValues.quantity
      ),
      db.prepare(
        `DELETE FROM items
         WHERE character_id=? AND slot_type='junk' AND equipped=0
           AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
           AND json_extract(extra_json, '$.junkId')=?
           AND CAST(json_extract(extra_json, '$.quantity') AS INTEGER) <= 0
           AND EXISTS (
             SELECT 1 FROM guild_donations
             WHERE donation_id=? AND character_id=? AND created_at=?
           )
           AND EXISTS (
             SELECT 1 FROM guild_donation_stack_snapshot
             WHERE donation_id=? AND item_id='__lock__' AND quantity=?
           )`
      ).bind(
        receiptValues.character_id, receiptValues.junk_id,
        receiptValues.donation_id, receiptValues.character_id, receiptValues.created_at,
        receiptValues.donation_id, operationToken
      ),
      db.prepare(
        `UPDATE guilds SET exp=?, level=?
         WHERE guild_id=?
           AND EXISTS (
             SELECT 1 FROM guild_donations
             WHERE donation_id=? AND character_id=? AND created_at=?
           )
           AND EXISTS (
             SELECT 1 FROM guild_donation_stack_snapshot
             WHERE donation_id=? AND item_id='__lock__' AND quantity=?
           )`
      ).bind(
        receiptValues.guild_exp_after, receiptValues.guild_level_after, receiptValues.guild_id,
        receiptValues.donation_id, receiptValues.character_id, receiptValues.created_at,
        receiptValues.donation_id, operationToken
      ),
      db.prepare(
        `UPDATE guild_members SET contribution=contribution+?
         WHERE guild_id=? AND character_id=?
           AND EXISTS (
             SELECT 1 FROM guild_donations
             WHERE donation_id=? AND character_id=? AND created_at=?
           )
           AND EXISTS (
             SELECT 1 FROM guild_donation_stack_snapshot
             WHERE donation_id=? AND item_id='__lock__' AND quantity=?
           )`
      ).bind(
        receiptValues.contribution_granted, receiptValues.guild_id, receiptValues.character_id,
        receiptValues.donation_id, receiptValues.character_id, receiptValues.created_at,
        receiptValues.donation_id, operationToken
      ),
      db.prepare(
        `DELETE FROM guild_donation_stack_snapshot
         WHERE donation_id=?
           AND EXISTS (
             SELECT 1 FROM guild_donation_stack_snapshot lock_row
             WHERE lock_row.donation_id=? AND lock_row.item_id='__lock__' AND lock_row.quantity=?
           )`
      ).bind(receiptValues.donation_id, receiptValues.donation_id, operationToken),
    ]);

    const receiptInsert = batch && batch[1];
    if (!receiptInsert?.meta?.changes) {
      const committed = await db.prepare(`SELECT * FROM guild_donations WHERE donation_id = ?`).bind(String(donationId)).first();
      if (committed && committed.character_id === characterId) return json(await shapeGuildDonation(db, committed, true));
      return json({ error: "donation_conflict" });
    }
  } catch (error) {
    const committed = await db.prepare(`SELECT * FROM guild_donations WHERE donation_id = ?`).bind(String(donationId)).first();
    if (committed && committed.character_id === characterId) return json(await shapeGuildDonation(db, committed, true));
    return json({ error: guildDonationErrorFromDb(error) });
  }
  const committed = await db.prepare(`SELECT * FROM guild_donations WHERE donation_id = ?`).bind(String(donationId)).first();
  return json(await shapeGuildDonation(db, committed || receiptValues, false));
}

async function handleGetGuildDonationHistory(db, id, session, characterId, limitInput) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json({ error: auth.error });
  const membership = await db.prepare(`SELECT guild_id FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership) return json({ error: "not_guild_member" });
  const limit = Math.min(50, Math.max(1, Number(limitInput) || 20));
  const result = await db.prepare(
    `SELECT donation_id AS donationId, guild_id AS guildId, character_id AS characterId, junk_id AS junkId,
       quantity, guild_exp_granted AS guildExpGranted, contribution_granted AS contributionGranted, created_at AS createdAt
     FROM guild_donations WHERE guild_id = ? AND character_id = ? ORDER BY created_at DESC LIMIT ?`
  ).bind(membership.guild_id, characterId, limit).all();
  return json({ ok: true, donations: result.results || [] });
}

async function handleSearchGuilds(db, id, session, characterId, query) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const q = String(query || "").trim();
  const rows = q
    ? await db.prepare(
        `SELECT guild_id, name, level, join_policy FROM guilds WHERE normalized_name LIKE ? || '%' ESCAPE '\\' ORDER BY name LIMIT 20`
      ).bind(normalizeGuildName(q).replace(/[\\%_]/g, (m) => "\\" + m)).all()
    : await db.prepare(`SELECT guild_id, name, level, join_policy FROM guilds ORDER BY level DESC, name ASC LIMIT 20`).all();
  const list = rows.results || [];
  if (!list.length) return json({ ok: true, guilds: [] });
  const ids = list.map((g) => g.guild_id);
  const placeholders = ids.map(() => "?").join(",");
  const countRows = await db.prepare(`SELECT guild_id, COUNT(*) AS c FROM guild_members WHERE guild_id IN (${placeholders}) GROUP BY guild_id`).bind(...ids).all();
  const countMap = new Map((countRows.results || []).map((r) => [r.guild_id, r.c]));
  return json({
    ok: true,
    guilds: list.map((g) => ({
      guildId: g.guild_id, name: g.name, level: g.level, joinPolicy: g.join_policy,
      memberCount: countMap.get(g.guild_id) || 0, memberCap: guildMemberCap(g.level),
    })),
  });
}

async function handleGetMyGuild(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const membership = await db.prepare(`SELECT guild_id FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership) return json({ ok: true, guild: null });
  await evaluateGuildSuccession(db, membership.guild_id);
  return await buildGuildProfileResponse(db, membership.guild_id, characterId);
}

async function handleGetGuildProfile(db, id, session, characterId, guildId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!guildId) return json({ error: "missing_fields" });
  await evaluateGuildSuccession(db, guildId);
  return await buildGuildProfileResponse(db, guildId, characterId);
}

// Public Guild Profile boundary. Unlike the management profile above, this response
// intentionally excludes member rows, contribution, joinedAt, and all identity IDs
// except the public guild target needed by the existing join/apply mutation.
async function handleGetPublicGuildProfile(db, id, session, characterId, guildId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!guildId) return json({ error: "missing_fields" });
  await evaluateGuildSuccession(db, guildId);
  const guild = await getRow(db, "guilds", "guild_id", guildId);
  if (!guild) return json({ error: "guild_not_found" });

  const [progression, memberCountRow, leaderRow, membership, anyMembership, pendingApplication, pendingCountRow] = await Promise.all([
    db.prepare(`SELECT level, cumulative_exp FROM guild_donation_progression ORDER BY level`).all(),
    db.prepare(`SELECT COUNT(*) AS c FROM guild_members WHERE guild_id = ?`).bind(guildId).first(),
    db.prepare(`SELECT name FROM characters WHERE character_id = ?`).bind(guild.leader_character_id).first(),
    db.prepare(`SELECT role FROM guild_members WHERE guild_id = ? AND character_id = ?`).bind(guildId, characterId).first(),
    db.prepare(`SELECT guild_id FROM guild_members WHERE character_id = ?`).bind(characterId).first(),
    db.prepare(`SELECT 1 FROM guild_applications WHERE guild_id = ? AND character_id = ? AND status = 'pending'`).bind(guildId, characterId).first(),
    db.prepare(`SELECT COUNT(*) AS c FROM guild_applications WHERE character_id = ? AND status = 'pending'`).bind(characterId).first(),
  ]);
  const rows = progression.results || [];
  const currentThreshold = rows.find(row => Number(row.level) === Number(guild.level));
  const nextThreshold = rows.find(row => Number(row.level) === Number(guild.level) + 1);
  const memberCount = Number(memberCountRow?.c || 0);
  const memberCap = guildMemberCap(guild.level);
  const full = memberCount >= memberCap;
  const pending = !!pendingApplication;
  const applicationLimitReached = Number(pendingCountRow?.c || 0) >= GUILD_APPLICATION_MAX_PENDING;
  let viewerState = "eligible_join";
  if (membership) viewerState = "member";
  else if (anyMembership) viewerState = "already_in_guild";
  else if (pending) viewerState = "pending";
  else if (guild.join_policy === "closed") viewerState = "closed";
  else if (guild.join_policy === "open" && full) viewerState = "full";
  else if (guild.join_policy === "application" && applicationLimitReached) viewerState = "application_limit_reached";
  else if (guild.join_policy === "application") viewerState = "eligible_apply";
  const canJoin = viewerState === "eligible_join" && guild.join_policy === "open" && !full;
  const canApply = viewerState === "eligible_apply" && guild.join_policy === "application";
  return json({
    ok: true,
    profile: {
      guildId: guild.guild_id,
      name: guild.name,
      level: guild.level,
      exp: guild.exp,
      expProgress: currentThreshold ? Math.max(0, Number(guild.exp) - Number(currentThreshold.cumulative_exp)) : Number(guild.exp),
      expRequired: nextThreshold && currentThreshold ? Number(nextThreshold.cumulative_exp) - Number(currentThreshold.cumulative_exp) : 0,
      atCap: !nextThreshold,
      memberCount,
      memberCap,
      capacityState: full ? "full" : "available",
      joinPolicy: guild.join_policy,
      joinPolicyLabel: guild.join_policy === "open" ? "เปิดรับ" : guild.join_policy === "application" ? "ต้องสมัคร" : "ปิดรับ",
      leaderName: leaderRow?.name || "ไม่ระบุ",
      viewerState,
      canJoin,
      canApply,
    },
  });
}

async function handleGetMyApplications(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const rows = await db.prepare(
    `SELECT a.application_id, a.guild_id, a.created_at, g.name, g.level
     FROM guild_applications a JOIN guilds g ON g.guild_id = a.guild_id
     WHERE a.character_id = ? AND a.status = 'pending' ORDER BY a.created_at DESC`
  ).bind(characterId).all();
  return json({
    ok: true,
    applications: (rows.results || []).map((r) => ({
      applicationId: r.application_id, guildId: r.guild_id, guildName: r.name, guildLevel: r.level, createdAt: r.created_at,
    })),
  });
}

async function handleGetGuildApplications(db, id, session, characterId, guildId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!guildId) return json({ error: "missing_fields" });
  const leaderCheck = await verifyGuildLeader(db, characterId, guildId);
  if (leaderCheck.error) return json(leaderCheck);
  const rows = await db.prepare(
    `SELECT a.application_id, a.character_id, a.created_at, c.name, c.level, c.last_active_at
     FROM guild_applications a JOIN characters c ON c.character_id = a.character_id
     WHERE a.guild_id = ? AND a.status = 'pending' ORDER BY a.created_at ASC`
  ).bind(guildId).all();
  return json({
    ok: true,
    applications: (rows.results || []).map((r) => ({
      applicationId: r.application_id, characterId: r.character_id, name: r.name, level: r.level, online: isRecentlyActive(r.last_active_at), createdAt: r.created_at,
    })),
  });
}

async function handleCreateGuild(db, id, session, characterId, name, description) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (Number(auth.character.level || 0) < GUILD_CREATE_MIN_LEVEL) return json({ error: "guild_create_level_too_low" });
  const validName = validateGuildName(name);
  if (!validName) return json({ error: "invalid_guild_name" });
  const normalized = normalizeGuildName(validName);
  const existing = await db.prepare(`SELECT 1 FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (existing) return json({ error: "already_in_guild" });
  const desc = String(description || "").trim().slice(0, 200);
  const guildId = `guild-${randomToken(16)}`;
  const now = nowIso();
  try {
    await db.prepare(
      `INSERT INTO guilds (guild_id, name, normalized_name, leader_character_id, created_at, description, join_policy, level, exp) VALUES (?, ?, ?, ?, ?, ?, 'open', 1, 0)`
    ).bind(guildId, validName, normalized, characterId, now, desc).run();
  } catch (e) {
    if (String((e && e.message) || e).includes("UNIQUE constraint failed")) return json({ error: "guild_name_taken" });
    throw e;
  }
  const memberInsert = await db.prepare(
    `INSERT INTO guild_members (guild_id, character_id, role, joined_at, contribution) VALUES (?, ?, 'leader', ?, 0) ON CONFLICT(character_id) DO NOTHING`
  ).bind(guildId, characterId, now).run();
  if (!memberInsert.meta || !memberInsert.meta.changes) {
    // Extremely rare double-tap/concurrent race: character joined another Guild between
    // the pre-check above and this insert. Roll back the just-created (now orphaned,
    // leaderless) Guild rather than leaving it behind.
    await db.prepare(`DELETE FROM guilds WHERE guild_id = ?`).bind(guildId).run();
    return json({ error: "already_in_guild" });
  }
  return json({ ok: true, guildId });
}

async function handleRequestGuildJoin(db, id, session, characterId, guildId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!guildId) return json({ error: "missing_fields" });
  const existing = await db.prepare(`SELECT 1 FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (existing) return json({ error: "already_in_guild" });
  const guild = await getRow(db, "guilds", "guild_id", guildId);
  if (!guild) return json({ error: "guild_not_found" });
  if (guild.join_policy === "closed") return json({ error: "guild_closed" });

  const now = nowIso();
  if (guild.join_policy === "open") {
    const cap = guildMemberCap(guild.level);
    // §13 — one atomic INSERT...SELECT enforces capacity AND the one-character-one-guild
    // rule (via ON CONFLICT on guild_members' legacy character_id unique index) together,
    // so a concurrent double-join attempt or a last-slot race can't both succeed.
    const joined = await db.batch([
      db.prepare(
        `INSERT INTO guild_members (guild_id, character_id, role, joined_at, contribution)
         SELECT ?, ?, 'member', ?, 0
         WHERE (SELECT COUNT(*) FROM guild_members WHERE guild_id = ?) < ?
         ON CONFLICT(character_id) DO NOTHING`
      ).bind(guildId, characterId, now, guildId, cap),
      guildChatBaselineStatement(db, characterId, guildId, now),
      db.prepare(`UPDATE guild_applications SET status='cancelled', resolved_at=? WHERE character_id=? AND status='pending' AND EXISTS (SELECT 1 FROM guild_members WHERE character_id=? AND guild_id=?)`).bind(now, characterId, characterId, guildId),
    ]);
    if (!joined[0].meta || !joined[0].meta.changes) {
      const stillFree = await db.prepare(`SELECT 1 FROM guild_members WHERE character_id = ?`).bind(characterId).first();
      return json({ error: stillFree ? "already_in_guild" : "guild_full" });
    }
    return json({ ok: true, status: "joined", guildId });
  }

  // 'application' — §5 fix: the cap check is now inside the INSERT itself (guarded by
  // the same subquery-in-WHERE pattern as the open-join path above), not a separate
  // COUNT-then-INSERT — a COUNT read followed by an unguarded INSERT left a real race
  // window where two concurrent applies to different Guilds could both read count=4 and
  // both insert, landing at 6. ON CONFLICT still covers the duplicate-pending-pair case
  // (migration 0017's partial unique index needs its WHERE clause repeated here to
  // target it, since it's a partial index).
  const applicationId = `gapp-${randomToken(16)}`;
  const insert = await db.prepare(
    `INSERT INTO guild_applications (application_id, guild_id, character_id, status, created_at)
     SELECT ?, ?, ?, 'pending', ?
     WHERE (SELECT COUNT(*) FROM guild_applications WHERE character_id = ? AND status = 'pending') < ?
     ON CONFLICT(guild_id, character_id) WHERE status = 'pending' DO NOTHING`
  ).bind(applicationId, guildId, characterId, now, characterId, GUILD_APPLICATION_MAX_PENDING).run();
  if (!insert.meta || !insert.meta.changes) {
    const dup = await db.prepare(`SELECT 1 FROM guild_applications WHERE guild_id = ? AND character_id = ? AND status = 'pending'`).bind(guildId, characterId).first();
    return json({ error: dup ? "application_already_exists" : "application_limit_reached" });
  }
  return json({ ok: true, status: "pending", applicationId });
}

async function handleCancelGuildApplication(db, id, session, characterId, applicationId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!applicationId) return json({ error: "missing_fields" });
  const updated = await db.prepare(
    `UPDATE guild_applications SET status = 'cancelled', resolved_at = ? WHERE application_id = ? AND character_id = ? AND status = 'pending'`
  ).bind(nowIso(), applicationId, characterId).run();
  if (!updated.meta || !updated.meta.changes) return json({ error: "application_not_pending" });
  return json({ ok: true });
}

async function handleAcceptGuildApplication(db, id, session, characterId, applicationId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!applicationId) return json({ error: "missing_fields" });
  const application = await getRow(db, "guild_applications", "application_id", applicationId);
  if (!application) return json({ error: "application_not_found" });
  const leaderCheck = await verifyGuildLeader(db, characterId, application.guild_id);
  if (leaderCheck.error) return json(leaderCheck);
  if (application.status !== "pending") return json({ error: "application_not_pending" });

  const guild = await getRow(db, "guilds", "guild_id", application.guild_id);
  if (!guild) return json({ error: "guild_not_found" });
  const cap = guildMemberCap(guild.level);
  const now = nowIso();
  // Same atomic pattern as handleRequestGuildJoin/Friend's Accept: re-verify the
  // application is still pending AND enforce capacity AND the one-guild rule, all inside
  // one statement, so this can't land between a read and a later write.
  const joined = await db.batch([
    db.prepare(
      `INSERT INTO guild_members (guild_id, character_id, role, joined_at, contribution)
       SELECT ?, ?, 'member', ?, 0
       WHERE EXISTS (SELECT 1 FROM guild_applications WHERE application_id = ? AND status = 'pending')
         AND (SELECT COUNT(*) FROM guild_members WHERE guild_id = ?) < ?
       ON CONFLICT(character_id) DO NOTHING`
    ).bind(application.guild_id, application.character_id, now, applicationId, application.guild_id, cap),
    guildChatBaselineStatement(db, application.character_id, application.guild_id, now),
    db.prepare(`UPDATE guild_applications SET status='accepted', resolved_at=? WHERE application_id=? AND status='pending' AND EXISTS (SELECT 1 FROM guild_members WHERE character_id=? AND guild_id=?)`).bind(now, applicationId, application.character_id, application.guild_id),
    db.prepare(`UPDATE guild_applications SET status='cancelled', resolved_at=? WHERE character_id=? AND status='pending' AND EXISTS (SELECT 1 FROM guild_members WHERE character_id=? AND guild_id=?)`).bind(now, application.character_id, application.character_id, application.guild_id),
  ]);

  if (!joined[0].meta || !joined[0].meta.changes) {
    // §5 — application remains pending on guild_full; §13 — stale concurrent acceptance
    // (character joined elsewhere first) fails already_in_guild, also leaving it pending.
    const alreadyInGuild = await db.prepare(`SELECT 1 FROM guild_members WHERE character_id = ?`).bind(application.character_id).first();
    return json({ error: alreadyInGuild ? "already_in_guild" : "guild_full" });
  }

  return json({ ok: true, characterId: application.character_id });
}

async function handleRejectGuildApplication(db, id, session, characterId, applicationId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!applicationId) return json({ error: "missing_fields" });
  const application = await getRow(db, "guild_applications", "application_id", applicationId);
  if (!application) return json({ error: "application_not_found" });
  const leaderCheck = await verifyGuildLeader(db, characterId, application.guild_id);
  if (leaderCheck.error) return json(leaderCheck);
  const updated = await db.prepare(
    `UPDATE guild_applications SET status = 'rejected', resolved_at = ? WHERE application_id = ? AND status = 'pending'`
  ).bind(nowIso(), applicationId).run();
  if (!updated.meta || !updated.meta.changes) return json({ error: "application_not_pending" });
  return json({ ok: true });
}

async function handleLeaveGuild(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const membership = await db.prepare(`SELECT guild_id, role FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership) return json({ error: "not_guild_member" });
  if (membership.role === "leader") {
    const memberCount = await db.prepare(`SELECT COUNT(*) AS c FROM guild_members WHERE guild_id = ?`).bind(membership.guild_id).first();
    if (Number((memberCount && memberCount.c) || 0) > 1) return json({ error: "leader_must_transfer_first" }); // §14
    await disbandGuildInternal(db, membership.guild_id); // sole leader leaving IS disbanding (§14)
    return json({ ok: true, disbanded: true });
  }
  await db.batch([
    db.prepare(`DELETE FROM guild_members WHERE guild_id = ? AND character_id = ?`).bind(membership.guild_id, characterId),
    db.prepare(`DELETE FROM chat_read_state WHERE character_id = ? AND conversation_key = ?`).bind(characterId, guildChatKey(membership.guild_id)),
  ]);
  return json({ ok: true });
}

async function handleKickGuildMember(db, id, session, characterId, targetCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!targetCharacterId || targetCharacterId === characterId) return json({ error: "invalid_target" });
  const membership = await db.prepare(`SELECT guild_id, role FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership || membership.role !== "leader") return json({ error: "not_guild_leader" });
  const target = await db.prepare(`SELECT 1 FROM guild_members WHERE guild_id = ? AND character_id = ? AND role != 'leader'`).bind(membership.guild_id, targetCharacterId).first();
  if (!target) return json({ error: "not_guild_member" });
  await db.batch([
    db.prepare(`DELETE FROM guild_members WHERE guild_id = ? AND character_id = ? AND role != 'leader'`).bind(membership.guild_id, targetCharacterId),
    db.prepare(`DELETE FROM chat_read_state WHERE character_id = ? AND conversation_key = ?`).bind(targetCharacterId, guildChatKey(membership.guild_id)),
  ]);
  return json({ ok: true });
}

async function handleTransferGuildLeadership(db, id, session, characterId, targetCharacterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  if (!targetCharacterId || targetCharacterId === characterId) return json({ error: "invalid_target" });
  const membership = await db.prepare(`SELECT guild_id, role FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership || membership.role !== "leader") return json({ error: "not_guild_leader" });
  const target = await db.prepare(`SELECT role FROM guild_members WHERE guild_id = ? AND character_id = ?`).bind(membership.guild_id, targetCharacterId).first();
  if (!target) return json({ error: "target_not_guild_member" });
  const ok = await transferGuildLeadershipAtomic(db, membership.guild_id, characterId, targetCharacterId);
  if (!ok) return json({ error: "not_guild_leader" }); // raced out of leadership since the read above
  return json({ ok: true }); // old Leader remains a Member (§14) — no row removed
}

async function handleDisbandGuild(db, id, session, characterId) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const membership = await db.prepare(`SELECT guild_id, role FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership) return json({ error: "not_guild_member" });
  if (membership.role !== "leader") return json({ error: "not_guild_leader" });
  await disbandGuildInternal(db, membership.guild_id);
  return json({ ok: true });
}

const GUILD_JOIN_POLICIES = ["open", "application", "closed"]; // §4 — no rename, description+policy only
// §4 — Leader-only settings: description and join policy. Server-authoritative; the
// client cannot set either field on any other action (createGuild fixes join_policy to
// 'open' and takes description once at creation — this is the only place either can
// change afterward). This is also what makes the APPLICATION join policy reachable
// during normal gameplay, since createGuild alone can never produce it.
async function handleUpdateGuildSettings(db, id, session, characterId, description, joinPolicy) {
  const auth = await verifySocialActor(db, id, session, characterId);
  if (auth.error) return json(auth);
  const membership = await db.prepare(`SELECT guild_id, role FROM guild_members WHERE character_id = ?`).bind(characterId).first();
  if (!membership) return json({ error: "not_guild_member" });
  if (membership.role !== "leader") return json({ error: "not_guild_leader" });
  if (!GUILD_JOIN_POLICIES.includes(joinPolicy)) return json({ error: "invalid_join_policy" });
  const desc = String(description || "").trim().slice(0, 200);
  await db.prepare(`UPDATE guilds SET description = ?, join_policy = ? WHERE guild_id = ?`).bind(desc, joinPolicy, membership.guild_id).run();
  return json({ ok: true, description: desc, joinPolicy });
}



  return {
    verifySocialActor,
    PRESENCE_ONLINE_WINDOW_MS,
    isRecentlyActive,
    isBlockedEitherDirection,
    blockCharacter,
    unblockCharacter,
    FRIEND_CAP,
    FRIEND_OUTGOING_PENDING_CAP,
    FRIEND_REQUEST_EXPIRY_MS,
    normalizeFriendPair,
    areFriends,
    handleSearchCharacters,
    handleGetPublicProfile,
    handleGetFriendList,
    handleGetFriendRequests,
    handleGetBlockedList,
    handleSendFriendRequest,
    handleAcceptFriendRequest,
    handleRejectFriendRequest,
    handleCancelFriendRequest,
    handleRemoveFriend,
    handleBlockCharacter,
    handleUnblockCharacter,
    CHAT_GLOBAL_MAX_LEN,
    CHAT_DIRECT_MAX_LEN,
    CHAT_GLOBAL_RATE_MS,
    CHAT_DIRECT_RATE_MS,
    CHAT_GLOBAL_RETENTION_DAYS,
    CHAT_DIRECT_RETENTION_DAYS,
    CHAT_GUILD_MAX_LEN,
    CHAT_GUILD_RETENTION_DAYS,
    CHAT_GUILD_RATE_MS,
    CHAT_POLL_PAGE_SIZE,
    normalizeConversationKey,
    sanitizeChatMessage,
    getBlockedCharacterIds,
    shapeChatRow,
    handleGetGlobalChat,
    handleSendGlobalMessage,
    getCurrentGuildMembership,
    guildChatKey,
    guildChatStatus,
    handleGetGuildChat,
    handleGetGuildChatStatus,
    handleSendGuildMessage,
    handleMarkGuildChatRead,
    handleGetDirectMessages,
    handleSendDirectMessage,
    handleGetDirectConversations,
    handleMarkConversationRead,
    runChatRetentionCleanup,
    GUILD_LEVEL_CAP,
    GUILD_NAME_MIN_LEN,
    GUILD_NAME_MAX_LEN,
    GUILD_CREATE_MIN_LEVEL,
    GUILD_APPLICATION_MAX_PENDING,
    GUILD_LEADER_INACTIVE_HOURS,
    GUILD_SUCCESSION_ACTIVE_HOURS,
    GUILD_MEMBER_CAP_BY_LEVEL,
    guildMemberCap,
    normalizeGuildName,
    validateGuildName,
    guildChatBaselineStatement,
    initializeGuildChatBaseline,
    cancelOtherPendingApplications,
    disbandGuildInternal,
    verifyGuildLeader,
    transferGuildLeadershipAtomic,
    evaluateGuildSuccession,
    buildGuildProfileResponse,
    guildDonationErrorFromDb,
    shapeGuildDonation,
    handleDonateGuildItem,
    handleGetGuildDonationHistory,
    handleSearchGuilds,
    handleGetMyGuild,
    handleGetGuildProfile,
    handleGetPublicGuildProfile,
    handleGetMyApplications,
    handleGetGuildApplications,
    handleCreateGuild,
    handleRequestGuildJoin,
    handleCancelGuildApplication,
    handleAcceptGuildApplication,
    handleRejectGuildApplication,
    handleLeaveGuild,
    handleKickGuildMember,
    handleTransferGuildLeadership,
    handleDisbandGuild,
    GUILD_JOIN_POLICIES,
    handleUpdateGuildSettings
  };
}

