/**
 * THORNIE DUNGEONS — Cloud Save Backend (Cloudflare Worker + D1) — schema v2 + daily login
 * ---------------------------------------------------------------
 * Repository source for the independently deployed gameplay API Worker. It includes the
 * existing character/game systems plus Login/Auth V2's central session boundary.
 *
 * Release path (see docs/DEPLOYMENT.md): merge an approved backend change to `main` ->
 * GitHub Actions applies pending migrations/auto/*.sql -> deploys the `thornie-dungeons-api`
 * Worker -> verification. Do not deploy this file manually or paste it into the Cloudflare
 * Dashboard editor; the automated pipeline is the only supported release path.
 *
 * v2 change (see migration_v2.sql — RUN THAT FIRST): each account can now have up to
 * MAX_CHARACTER_SLOTS independent characters, each with its own row in `characters`.
 * Items and run-state checkpoints are scoped by `character_id` and `player_id`; each
 * mutation validates the authenticated owner before committing.
 *
 * The v1 `progress` table is left in place untouched (harmless, no longer written
 * to) purely as a historical backfill source for the one-time migration.
 *
 * Auth V2 endpoints:
 *   POST { action: "login"|"register"|"forgotPassword", ...credentials }
 *   GET  ?action=validateSession          Authorization: Bearer <session token>
 *   POST { action: "logout"|"changePassword"|"createRecoveryCode", ... }
 * All character/gameplay endpoints below use the same Authorization header; player_id is
 * derived from the validated session and id/password are never accepted as ownership proof.
 * Public endpoints remain unauthenticated; Admin endpoints require the dedicated
 * Admin V2 Bearer session and never accept the historical static key:
 *   GET  ?action=getGameConfig
 *   GET  ?action=getRecipes                                                (NEW, Phase 4 refactor)
 *   GET  ?action=getMonsterLoot                                             (NEW, monster loot table)
 *   GET  ?action=getJunkInfo                                                (NEW, admin.html — material names/icons)
 *   POST { action: "adminUpsertJunkInfo", junkId, name, icon }                (NEW, Admin Bearer)
 *   POST { action: "adminDeleteJunkInfo", junkId }                            (NEW, Admin Bearer)
 *   GET  ?action=getLeaderboard&board=floor|cp|pet_cp|raid|pvp            (pvp = NEW)
 *   GET  ?action=getLeaderboardHistory&board=&date=YYYY-MM-DD             (NEW, Phase 2.1, last 7 days)
 *   GET  ?action=getPlayer&id=            (admin, Admin Bearer)
 *   GET  ?action=getAllPlayers=            (admin, Admin Bearer)
 *   GET  ?action=getPlayerItems&id=        (admin, Admin Bearer)
 *   GET  ?action=getGameStats=              (admin, Admin Bearer)
 *   GET  ?action=getSheet&sheet=           (admin, Admin Bearer)
 *   POST { action: "saveGameConfig", config } (Admin Bearer)
 *   POST { action: "setGameConfigItem", key, value } (Admin Bearer)
 *   POST { action: "adminUpsertRecipe", recipeId, type, name, setId, empowerSlotCount, materials } (Admin Bearer)
 *   POST { action: "adminDeleteRecipe", recipeId } (Admin Bearer)
 *   POST { action: "adminUpsertMonsterLootEntry", entry: {...} } (Admin Bearer)
 *   POST { action: "adminDeleteMonsterLootEntry", entryId } (Admin Bearer)
 *
 * Phase 2 (leaderboard, migration_v3.sql already applied — leaderboard_stats exists):
 *   - GET ?action=getLeaderboard&board=floor|cp|pet_cp returns top 50 rows, read-only,
 *     no auth needed (leaderboard is public within the game).
 *   - A `scheduled()` handler below runs on a Cron Trigger (added via Cloudflare
 *     Dashboard -> Workers -> thornie-dungeons-api -> Trigger Events -> Cron Trigger,
 *     since this worker has no wrangler.toml in the repo and is deployed by hand).
 *     Suggested cron: "0 17 * * *" (17:00 UTC = 00:00 ICT, i.e. Thai midnight).
 *     It snapshots every character's floor / combat power / active-pet combat power
 *     into leaderboard_stats. CP formulas are ported from src/systems/stats.js
 *     (characterBaseStats + getEquipBonus + combatPower) and src/systems/pets.js
 *     (petCombatStats) — keep these two in sync if those formulas change.
 * ---------------------------------------------------------------
 */

import {
  MAX_CHARACTER_SLOTS, TABLES, ENHANCE_STAT_PCT, BASE_SPEED,
  characterBaseStats, itemBonus, combatPowerFromCharacter,
  PET_BASE_STATS, PET_GROWTH_STATS, PET_STAR_MULT, petCombatPower,
  DAILY_LOGIN_REWARDS, json, nowIso, todayDateKey, yesterdayDateKey,
  dailyLoginReward, newCharacterId, getRow, getRows, upsertRow,
} from "./modules/shared.js";
import { createAuthHandlers } from "./modules/auth.js";
import { createSocialHandlers } from "./modules/social.js";
import { createMailboxHandlers } from "./modules/mailbox.js";
import { createLeaderboardHandlers } from "./modules/leaderboard.js";
import "../src/systems/enhancementV2.js";
import "../src/systems/rewardV2.js";
import "../src/systems/mythicV2.js";

const ENHANCEMENT_V2_RULES = globalThis.ENHANCEMENT_V2;

const {
  PASSWORD_MIN, PASSWORD_MAX, PASSWORD_ITERATIONS, SESSION_24H_MS, SESSION_30D_MS, AUTH_ERRORS,
  bytesToBase64Url, base64UrlToBytes, randomToken, sha256, hashPassword, verifyPasswordHash,
  validPlayerId, validPassword, passwordValidationError, normalizeRecoveryCode, createRecoveryCode,
  recoveryCodeHash, requestIp, rateKey, checkRateLimit, recordRateAttempt, playerByLoginId,
  verifyPasswordCredentials, issueSession, bearerToken, verifySession, verifyPlayer, verifyOwnedCharacter, authenticateCharacter,
  verifyAdminKey, ADMIN_SESSION_MS, ADMIN_LOGIN_WINDOW_MS, adminAuditStatement, writeAdminAudit,
  issueAdminSession, verifyAdminSession, handleAdminLogin, handleAdminValidateSession, handleAdminLogout,
  commitCredentialChange, verifyAdminAccess,
} = createAuthHandlers({ json, nowIso, getRow });

const {
  PRESENCE_ONLINE_WINDOW_MS, isRecentlyActive, isBlockedEitherDirection, blockCharacter,
  unblockCharacter, FRIEND_CAP, FRIEND_OUTGOING_PENDING_CAP, FRIEND_REQUEST_EXPIRY_MS,
  normalizeFriendPair, areFriends, handleSearchCharacters, handleGetPublicProfile,
  handleGetFriendList, handleGetFriendRequests, handleGetBlockedList, handleSendFriendRequest,
  handleAcceptFriendRequest, handleRejectFriendRequest, handleCancelFriendRequest, handleRemoveFriend,
  handleBlockCharacter, handleUnblockCharacter, CHAT_GLOBAL_MAX_LEN, CHAT_DIRECT_MAX_LEN,
  CHAT_GLOBAL_RATE_MS, CHAT_DIRECT_RATE_MS, CHAT_GLOBAL_RETENTION_DAYS, CHAT_DIRECT_RETENTION_DAYS,
  CHAT_GUILD_MAX_LEN, CHAT_GUILD_RETENTION_DAYS, CHAT_GUILD_RATE_MS, CHAT_POLL_PAGE_SIZE,
  normalizeConversationKey, sanitizeChatMessage, getBlockedCharacterIds, shapeChatRow,
  handleGetGlobalChat, handleSendGlobalMessage, getCurrentGuildMembership, guildChatKey,
  guildChatStatus, handleGetGuildChat, handleGetGuildChatStatus, handleSendGuildMessage,
  handleMarkGuildChatRead, handleGetDirectMessages, handleSendDirectMessage,
  handleGetDirectConversations, handleMarkConversationRead, runChatRetentionCleanup,
  GUILD_LEVEL_CAP, GUILD_NAME_MIN_LEN, GUILD_NAME_MAX_LEN, GUILD_CREATE_MIN_LEVEL,
  GUILD_APPLICATION_MAX_PENDING, GUILD_LEADER_INACTIVE_HOURS, GUILD_SUCCESSION_ACTIVE_HOURS,
  GUILD_MEMBER_CAP_BY_LEVEL, guildMemberCap, normalizeGuildName, validateGuildName,
  guildChatBaselineStatement, initializeGuildChatBaseline, cancelOtherPendingApplications,
  disbandGuildInternal, verifyGuildLeader, transferGuildLeadershipAtomic, evaluateGuildSuccession,
  buildGuildProfileResponse, guildDonationErrorFromDb, shapeGuildDonation, handleDonateGuildItem,
  handleGetGuildDonationHistory, handleSearchGuilds, handleGetMyGuild, handleGetGuildProfile,
  handleGetPublicGuildProfile, handleGetMyApplications, handleGetGuildApplications, handleCreateGuild,
  handleRequestGuildJoin, handleCancelGuildApplication, handleAcceptGuildApplication,
  handleRejectGuildApplication, handleLeaveGuild, handleKickGuildMember, handleTransferGuildLeadership,
  handleDisbandGuild, GUILD_JOIN_POLICIES, handleUpdateGuildSettings,
} = createSocialHandlers({ json, nowIso, getRow, randomToken, verifyPlayer, verifyOwnedCharacter });

const {
  newMailId, sendMail, handleGetMailbox, handleClaimMail, handleClaimAllMail,
  handleDeleteMail, handleDeleteMails, handleDeleteAllClaimedMail,
} = createMailboxHandlers({ json, nowIso, verifyPlayer, verifyOwnedCharacter, parseJsonColumn,
  buildRewardStatements: mailboxRewardStatements, getSnapshot: battleCompletionSnapshot });

const {
  runLeaderboardSnapshot,
  handleGetLeaderboard,
  handleGetLeaderboardHistory,
} = createLeaderboardHandlers({
  json,
  nowIso,
  combatPowerFromCharacter,
  petCombatPower,
  getOrCreateActiveRaid,
  raidBossDefById,
  raidDateKey,
});

// ---------- game config ----------
async function handleGetGameConfig(db) {
  const res = await db.prepare(`SELECT key, value_json FROM game_config`).all();
  const cfg = {};
  for (const r of res.results || []) {
    try { cfg[r.key] = JSON.parse(r.value_json || "null"); } catch (e) {}
  }
  return json(cfg);
}

// Public, unauthenticated — just game data, not user-specific (same trust level as
// getGameConfig above). Lets new crafted sets go live via a D1 insert alone, no worker
// redeploy and no client code change: the client fetches this list on load instead of
// hardcoding it (see CRAFTING_RECIPES in crafting.js, which now starts empty and gets
// filled in from this response, falling back to a cached copy if offline).
async function handleGetRecipes(db) {
  const res = await db.prepare(`SELECT recipe_id, result_item_def, materials_json FROM recipes`).all();
  const recipes = (res.results || []).map((r) => {
    let resultDef = {};
    let materials = {};
    try { resultDef = JSON.parse(r.result_item_def || "{}"); } catch (e) {}
    try { materials = JSON.parse(r.materials_json || "{}"); } catch (e) {}
    return { recipeId: r.recipe_id, type: resultDef.type, name: resultDef.name, materials };
  });
  return json({ recipes });
}

// Public, unauthenticated — same trust level as getGameConfig/getRecipes above. Per-monster
// loot tables (Phase: monster loot design doc) — grouped by monster_id so the client can do
// a single lookup per kill. Empty for any monster_id with no rows, which the client treats
// as "use the existing generic floor-based roll" (fully backward compatible; nothing
// changes for a monster until rows are added here).
async function handleGetMonsterLoot(db) {
  const res = await db.prepare(`SELECT monster_id, kind, item_type, rarity, junk_id, qty_min, qty_max, weight, drop_chance FROM monster_loot`).all();
  const byMonster = {};
  for (const r of res.results || []) {
    if (!byMonster[r.monster_id]) byMonster[r.monster_id] = { gear: [], junk: [] };
    if (r.kind === "gear") {
      byMonster[r.monster_id].gear.push({ itemType: r.item_type, rarity: r.rarity || null, weight: Number(r.weight) || 1 });
    } else if (r.kind === "junk") {
      byMonster[r.monster_id].junk.push({ junkId: r.junk_id, qtyMin: Number(r.qty_min) || 1, qtyMax: Number(r.qty_max) || 1, dropChance: Number(r.drop_chance) || 1 });
    }
  }
  return json({ monsterLoot: byMonster });
}

// Public, unauthenticated — same trust level as getRecipes/getMonsterLoot above. Client
// merges this INTO the built-in JUNK_INFO defaults (enhancement.js) rather than replacing
// it wholesale, so a material added here shows up without needing every existing one
// re-declared, and nothing breaks if this table is ever emptied.
async function handleGetJunkInfo(db) {
  const res = await db.prepare(`SELECT junk_id, name, icon FROM junk_info`).all();
  const junkInfo = {};
  for (const r of res.results || []) {
    junkInfo[r.junk_id] = { name: r.name, icon: r.icon || "📦" };
  }
  return json({ junkInfo });
}

// ---------- player / auth handlers ----------
async function handleRegister(db, id, password, confirmPassword, rememberLogin, ip) {
  const failedKey = rateKey("register_failed", ip);
  const successKey = rateKey("register_success", ip);
  const failedLimited = await checkRateLimit(db, failedKey, 3, 60 * 60 * 1000);
  if (failedLimited.error) return json(failedLimited, 429);
  const successLimited = await checkRateLimit(db, successKey, 3, 60 * 60 * 1000);
  if (successLimited.error) return json(successLimited, 429);

  const fail = async (payload, status = 400) => {
    await recordRateAttempt(db, failedKey, 3, 60 * 60 * 1000);
    return json(payload, status);
  };

  const cleanId = String(id || "").trim();
  if (!validPlayerId(cleanId)) return await fail({ error: "invalid_player_id" });
  const passwordError = passwordValidationError(password);
  if (passwordError) return await fail({ error: passwordError });
  if (String(password) !== String(confirmPassword)) return await fail({ error: "password_mismatch" });
  const existing = await playerByLoginId(db, cleanId);
  // Do not reveal whether a submitted Player ID already exists. Keep the
  // validation-specific errors above for actionable client correction, but use
  // one generic availability result for account-existence privacy.
  if (existing) return await fail({ error: "registration_unavailable" });

  const now = nowIso();
  const passwordHash = await hashPassword(password);
  const recoveryCode = createRecoveryCode();
  const recoveryHash = await recoveryCodeHash(recoveryCode);
  await db.prepare(
    `INSERT INTO players (id, password, password_hash, recovery_code_hash, auth_version, diamonds, active_slot, created_at)
     VALUES (?, '', ?, ?, 2, 0, NULL, ?)`
  ).bind(cleanId, passwordHash, recoveryHash, now).run();

  // A valid successful registration clears typo/validation failures, but successful
  // account creation still has its own per-IP hourly cap to prevent account spam.
  await recordRateAttempt(db, failedKey, 3, 60 * 60 * 1000, true);
  await recordRateAttempt(db, successKey, 3, 60 * 60 * 1000);

  const session = await issueSession(db, cleanId, !!rememberLogin);
  return json({ ok: true, playerId: cleanId, recoveryCode, recoveryConfigured: true, ...session });
}

// Safety-net migration for a single player: runs the same logic as migration_v2.sql's
// bulk backfill, in case that player's row was created/played between the bulk
// migration running and this deploy going live, or was otherwise missed.
async function migratePlayerIfNeeded(db, id) {
  const already = await getRow(db, "characters", "player_id", id);
  if (already) return;
  const legacy = await getRow(db, "progress", "player_id", id);
  if (!legacy) return;
  const now = nowIso();
  const characterId = `char-migrated-${id}`;
  await db
    .prepare(
      `INSERT INTO characters (character_id, player_id, slot_index, name, level, xp, stat_points,
        str, vit, agi, dex, luk, gold, unlocked_floor, potions, protection_stones, chest_pity,
        pets_json, active_pet_id, created_at, updated_at)
       VALUES (?, ?, 0, 'Character 1', ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)`
    )
    .bind(
      characterId, id,
      Number(legacy.char_level) || 1, Number(legacy.char_xp) || 0, Number(legacy.char_points) || 0,
      Number(legacy.char_str) || 0, Number(legacy.char_vit) || 0, Number(legacy.char_dex) || 0, Number(legacy.char_luk) || 0,
      Number(legacy.bank_gold) || 0, Number(legacy.best_floor) || 1, legacy.potions === undefined || legacy.potions === null ? 2 : Number(legacy.potions),
      legacy.pets_json || "[]", legacy.active_pet_id || "",
      now, now
    )
    .run();
  await db.prepare(`UPDATE players SET active_slot = 0, diamonds = ? WHERE id = ? AND active_slot IS NULL`).bind(Number(legacy.diamonds) || 0, id).run();
  await db.prepare(`UPDATE items SET character_id = ? WHERE player_id = ? AND character_id IS NULL`).bind(characterId, id).run();
  await db.prepare(`UPDATE run_state SET character_id = ? WHERE character_id IS NULL AND player_id = ?`).bind(characterId, id).run();
  await db.prepare(
    `INSERT OR IGNORE INTO character_run_state
      (character_id, floor, level, xp, hp, mp, base_atk, base_def, base_max_hp, base_max_mp, run_gold, potions, updated_at)
     SELECT character_id, floor, level, xp, hp, mp, base_atk, base_def, base_max_hp, base_max_mp, run_gold, potions, updated_at
     FROM run_state WHERE player_id = ? AND character_id = ?`
  ).bind(id, characterId).run();
}

async function accountPayload(db, id) {
  const player = await getRow(db, "players", "id", id);
  const characters = await getRows(db, "characters", "player_id", id);
  characters.sort((a, b) => a.slot_index - b.slot_index);
  return {
    player: { diamonds: Number(player.diamonds) || 0, activeSlot: player.active_slot === null || player.active_slot === undefined ? null : Number(player.active_slot) },
    characters,
    playerId: player.id,
    recoveryConfigured: !!player.recovery_code_hash
  };
}

async function handleLogin(db, id, password, rememberLogin, ip) {
  const loginKey = rateKey("login", ip, id);
  const limited = await checkRateLimit(db, loginKey, 5, 5 * 60 * 1000);
  if (limited.error) return json(limited, 429);
  const auth = await verifyPasswordCredentials(db, id, password);
  if (auth.error) {
    await recordRateAttempt(db, loginKey, 5, 5 * 60 * 1000);
    return json({ error: "invalid_credentials" });
  }
  await recordRateAttempt(db, loginKey, 5, 5 * 60 * 1000, true);
  const playerId = auth.row.id;
  await migratePlayerIfNeeded(db, playerId);
  const session = await issueSession(db, playerId, !!rememberLogin);
  return json({ ok: true, ...(await accountPayload(db, playerId)), ...session, legacyMigrated: auth.migrated });
}

async function handleValidateSession(db, auth) {
  return json({ ok: true, ...(await accountPayload(db, auth.row.id)), expiresAt: auth.session.expires_at, rememberLogin: !!auth.session.remember_login });
}

async function handleLogout(db, auth) {
  await db.prepare(`UPDATE auth_sessions SET revoked_at = ?, revoke_reason = 'logout' WHERE session_id = ? AND revoked_at IS NULL`)
    .bind(nowIso(), auth.session.session_id).run();
  return json({ ok: true });
}

async function handleRecoveryStatus(db, auth) {
  return json({ ok: true, playerId: auth.row.id, recoveryConfigured: !!auth.row.recovery_code_hash });
}

async function handleCreateRecoveryCode(db, auth, currentPassword) {
  const verified = await verifyPasswordCredentials(db, auth.row.id, currentPassword);
  if (verified.error) return json({ error: "invalid_credentials" });
  const recoveryCode = createRecoveryCode();
  await db.prepare(`UPDATE players SET recovery_code_hash = ? WHERE id = ?`).bind(await recoveryCodeHash(recoveryCode), auth.row.id).run();
  return json({ ok: true, recoveryCode, recoveryConfigured: true });
}

async function handleChangePassword(db, auth, currentPassword, newPassword, confirmPassword) {
  const passwordError = passwordValidationError(newPassword);
  if (passwordError) return json({ error: passwordError }, 400);
  if (String(newPassword) !== String(confirmPassword)) return json({ error: "password_mismatch" }, 400);
  const verified = await verifyPasswordCredentials(db, auth.row.id, currentPassword);
  if (verified.error) return json({ error: "invalid_credentials" });
  const now = nowIso();
  await commitCredentialChange(db, [
    db.prepare(`UPDATE players SET password_hash = ?, auth_version = 2 WHERE id = ?`).bind(await hashPassword(newPassword), auth.row.id),
    db.prepare(`UPDATE auth_sessions SET revoked_at = ?, revoke_reason = 'password_changed' WHERE player_id = ? AND revoked_at IS NULL`).bind(now, auth.row.id)
  ], auth.row.id, "password_changed");
  return json({ ok: true, requireLogin: true });
}

async function handleForgotPassword(db, id, recoveryCode, newPassword, confirmPassword, ip) {
  const recoveryKey = rateKey("recovery", ip, id);
  const limited = await checkRateLimit(db, recoveryKey, 5, 5 * 60 * 1000);
  if (limited.error) return json(limited, 429);
  const passwordError = passwordValidationError(newPassword);
  if (passwordError) return json({ error: passwordError }, 400);
  if (String(newPassword) !== String(confirmPassword)) return json({ error: "password_mismatch" }, 400);
  const player = await playerByLoginId(db, id);
  const suppliedHash = await recoveryCodeHash(recoveryCode);
  if (!player?.recovery_code_hash || String(player.recovery_code_hash) !== String(suppliedHash)) {
    await recordRateAttempt(db, recoveryKey, 5, 5 * 60 * 1000);
    return json({ error: "invalid_recovery" });
  }
  const nextRecoveryCode = createRecoveryCode();
  const now = nowIso();
  await commitCredentialChange(db, [
    db.prepare(`UPDATE players SET password_hash = ?, recovery_code_hash = ?, auth_version = 2 WHERE id = ?`)
      .bind(await hashPassword(newPassword), await recoveryCodeHash(nextRecoveryCode), player.id),
    db.prepare(`UPDATE auth_sessions SET revoked_at = ?, revoke_reason = 'password_reset' WHERE player_id = ? AND revoked_at IS NULL`).bind(now, player.id)
  ], player.id, "password_reset");
  await recordRateAttempt(db, recoveryKey, 5, 5 * 60 * 1000, true);
  return json({ ok: true, recoveryCode: nextRecoveryCode, requireLogin: true });
}

// ---------- character slot handlers ----------
async function handleCreateCharacter(db, id, session, slotIndex, name) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CHARACTER_SLOTS) return json({ error: "invalid_slot" });

  const existingInSlot = await db.prepare(`SELECT 1 FROM characters WHERE player_id = ? AND slot_index = ?`).bind(id, slot).first();
  if (existingInSlot) return json({ error: "slot_occupied" });

  const cleanName = String(name || "").trim().slice(0, 16) || `Character ${slot + 1}`;
  const dupe = await db
    .prepare(`SELECT 1 FROM characters WHERE player_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`)
    .bind(id, cleanName)
    .first();
  if (dupe) return json({ error: "name_taken" });

  const characterId = newCharacterId();
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO characters (character_id, player_id, slot_index, name, level, xp, stat_points,
        str, vit, agi, dex, luk, gold, unlocked_floor, potions, protection_stones, chest_pity,
        pets_json, active_pet_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 0, 0, '[]', '', ?, ?)`
    )
    .bind(characterId, id, slot, cleanName, now, now)
    .run();

  const character = await getRow(db, "characters", "character_id", characterId);
  return json({ ok: true, character });
}

async function handleDeleteCharacter(db, id, session, slotIndex) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CHARACTER_SLOTS) return json({ error: "invalid_slot" });

  const row = await db.prepare(`SELECT * FROM characters WHERE player_id = ? AND slot_index = ?`).bind(id, slot).first();
  if (!row) return json({ error: "character_not_found" });

  // Guild System V1 §17 — a Leader with other Guild members cannot delete the Leader
  // character without resolving leadership first (manual transfer, or disband if sole
  // member). This check must not wait for the 36h auto-succession window.
  const guildMembership = await db.prepare(`SELECT guild_id, role FROM guild_members WHERE character_id = ?`).bind(row.character_id).first();
  if (guildMembership && guildMembership.role === "leader") {
    const memberCount = await db.prepare(`SELECT COUNT(*) AS c FROM guild_members WHERE guild_id = ?`).bind(guildMembership.guild_id).first();
    if (Number((memberCount && memberCount.c) || 0) > 1) return json({ error: "guild_leader_must_transfer_first" });
    // Sole leader: deleting the character IS the exit path a sole leader would otherwise
    // take via explicit Disband (§14) — do it here so no guild is left pointing at a
    // character that's about to stop existing.
    await disbandGuildInternal(db, guildMembership.guild_id);
  }

  await db.batch([
    db.prepare(`DELETE FROM items WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM character_run_state WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM battle_checkpoints WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM battle_completions WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM character_settings WHERE character_id = ?`).bind(row.character_id),
    // NEW — clean up daily login state along with the rest of the character's data
    db.prepare(`DELETE FROM daily_login_claims WHERE character_id = ?`).bind(row.character_id),
    // Social Foundation V1 (§8 deletion lifecycle) — blocks have no audit/history value
    // the way Guild donation/chat records do, so plain removal (not anonymization) is
    // correct here.
    db.prepare(`DELETE FROM character_blocks WHERE blocker_character_id = ? OR blocked_character_id = ?`).bind(row.character_id, row.character_id),
    // Guild System V1 §17 — a normal Member deletion removes membership as part of safe
    // deletion cleanup (the sole-leader case was already fully resolved above, via
    // disbandGuildInternal, before this batch runs — this DELETE is then a harmless
    // no-op for that character). Also cancel their own pending applications so they
    // don't linger unreachable.
    db.prepare(`DELETE FROM guild_members WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`UPDATE guild_applications SET status = 'cancelled', resolved_at = ? WHERE character_id = ? AND status = 'pending'`).bind(nowIso(), row.character_id),
    db.prepare(`DELETE FROM characters WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`UPDATE players SET active_slot = NULL WHERE id = ? AND active_slot = ?`).bind(id, slot),
  ]);

  return json({ ok: true });
}

async function handleEnterCharacter(db, id, session, slotIndex) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CHARACTER_SLOTS) return json({ error: "invalid_slot" });

  const character = await db.prepare(`SELECT * FROM characters WHERE player_id = ? AND slot_index = ?`).bind(id, slot).first();
  if (!character) return json({ error: "character_not_found" });

  // Social Foundation V1 presence touch (§4) — batched with the existing active_slot
  // write so entering a character costs no extra round trip.
  await db.batch([
    db.prepare(`UPDATE players SET active_slot = ? WHERE id = ?`).bind(slot, id),
    db.prepare(`UPDATE characters SET last_active_at = ? WHERE character_id = ?`).bind(nowIso(), character.character_id),
  ]);

  const items = await getRows(db, "items", "character_id", character.character_id);
  let runState = await getRow(db, "run_state", "character_id", character.character_id);
  if (!runState) {
    const legacyRun = await db.prepare(
      `SELECT * FROM run_state
       WHERE character_id = ? OR (player_id = ? AND (character_id IS NULL OR TRIM(character_id) = ''))
       LIMIT 1`
    ).bind(character.character_id, id).first();
    if (legacyRun) {
      runState = normalizedRunState(character.character_id, legacyRun, character);
      await upsertRow(db, "run_state", "character_id", runState);
    }
  }

  return json({ ok: true, character, items, runState: runState || null });
}

// ---------- per-character progress / items / run-state ----------
function normalizedRunState(characterId, runState, authoritativeCharacter = null) {
  let petState = runState.pet_state_json ?? runState.petState ?? null;
  if (typeof petState === "string") {
    try { petState = JSON.parse(petState); } catch (e) { petState = null; }
  }
  const petId = String(petState?.activePetId || "").trim().slice(0, 128);
  const petHp = Number(petState?.currentHp);
  const safePetState = petId && Number.isFinite(petHp)
    ? { activePetId: petId, currentHp: Math.max(0, Math.round(petHp)), wasDead: petState?.wasDead === true || petHp <= 0 }
    : {};
  return {
    character_id: characterId,
    // This row is a resumable presentation/checkpoint cache. Progression and
    // economy remain sourced from the authoritative character row.
    // Floor is retained only as a resumable checkpoint hint.  Dungeon entry and
    // reward settlement re-authorize it from the character/battle rows; do not
    // rewrite this legacy presentation value on save or old clients lose their
    // resume point when unlocked_floor has not yet been migrated.
    floor: Math.max(1, Math.min(999, Math.floor(Number(runState.floor) || 1))),
    level: Math.max(1, Number(authoritativeCharacter?.level) || 1),
    xp: Math.max(0, Number(authoritativeCharacter?.xp) || 0),
    hp: Math.max(0, Number(runState.hp) || 0),
    mp: Math.max(0, Number(runState.mp) || 0),
    base_atk: Math.max(0, Number(runState.base_atk) || 0),
    base_def: Math.max(0, Number(runState.base_def) || 0),
    base_max_hp: Math.max(0, Number(runState.base_max_hp) || 0),
    base_max_mp: Math.max(0, Number(runState.base_max_mp) || 0),
    // Legacy columns remain readable for compatibility, but are never accepted
    // as authoritative currency/consumable writes from a client payload.
    run_gold: 0,
    potions: Math.max(0, Number(authoritativeCharacter?.potions) || 0),
    pet_state_json: JSON.stringify(safePetState),
    updated_at: runState.updated_at || nowIso()
  };
}

async function handleSaveCharacterProgress(db, id, session, characterId, diamonds, progress) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  return json({ error: "character_progress_requires_authoritative_operation" }, 410);
}

async function handleAllocateStats(db, id, session, characterId, allocations, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const validColumns = { str: "str", vit: "vit", agi: "agi", dex: "dex", luk: "luk" };
  const normalized = {};
  if (!allocations || typeof allocations !== "object" || Array.isArray(allocations)) return json({ error: "invalid_stat_allocation" }, 400);
  for (const [stat, raw] of Object.entries(allocations)) {
    if (!validColumns[stat]) return json({ error: "invalid_stat_allocation" }, 400);
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount < 0 || amount > 100) return json({ error: "invalid_stat_allocation" }, 400);
    if (amount) normalized[stat] = amount;
  }
  const total = Object.values(normalized).reduce((sum, amount) => sum + amount, 0);
  const operation = "allocate_stats";
  const key = String(requestId || "");
  if (!total || total > 500 || key.length < 8 || key.length > 128) return json({ error: "invalid_stat_allocation" }, 400);
  const payloadJson = JSON.stringify(Object.fromEntries(Object.keys(normalized).sort().map(stat => [stat, normalized[stat]])));
  const prior = await db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
    .bind(characterId, operation, key).first();
  if (prior) {
    if (prior.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
    if (prior.result_json === "pending") return json({ error: "operation_in_progress", retry: true }, 409);
    return json({ ok: true, replayed: true, allocation: parseJsonColumn(prior.result_json, {}), ...(await battleCompletionSnapshot(db, id, characterId)) });
  }
  const operationToken = crypto.randomUUID();
  const now = nowIso();
  const assignments = Object.entries(validColumns).map(([stat, column]) => `${column} = ${column} + ?`).join(", ");
  const values = Object.keys(validColumns).map(stat => Number(normalized[stat]) || 0);
  const result = { allocations: normalized, statPointsSpent: total };
  const statements = [db.prepare(
    `INSERT INTO character_operation_receipts (character_id, operation, request_id, operation_token, payload_json, result_json, created_at)
     SELECT ?, ?, ?, ?, ?, 'pending', ? WHERE EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND stat_points >= ?)
     ON CONFLICT(character_id, operation, request_id) DO NOTHING`
  ).bind(characterId, operation, key, operationToken, payloadJson, now, characterId, id, total)];
  statements.push(db.prepare(
    `UPDATE characters SET ${assignments}, stat_points = stat_points - ?, updated_at = ?
     WHERE character_id = ? AND player_id = ? AND stat_points >= ?
       AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`
  ).bind(...values, total, now, characterId, id, total, operationToken));
  statements.push(db.prepare(
    `UPDATE character_operation_receipts SET result_json = ? WHERE operation_token = ? AND result_json = 'pending' AND changes() = 1`
  ).bind(JSON.stringify(result), operationToken));
  statements.push(db.prepare(`DELETE FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending'`).bind(operationToken));
  const batchResults = await db.batch(statements);
  const receipt = await db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
    .bind(characterId, operation, key).first();
  if (!receipt) return json({ error: "insufficient_stat_points" }, 409);
  if (receipt.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
  return json({ ok: true, replayed: !(Number(batchResults?.[0]?.meta?.changes) > 0), allocation: parseJsonColumn(receipt.result_json, result), ...(await battleCompletionSnapshot(db, id, characterId)) });
}

function characterPetEnvelope(row) {
  const value = parseJsonColumn(row?.pets_json, []);
  if (Array.isArray(value)) return { list: value, dup: {}, skills: {}, skillVersion: 1 };
  return value && typeof value === "object" ? { ...value, list: Array.isArray(value.list) ? value.list : [], dup: value.dup || {}, skills: value.skills || {}, skillVersion: 1 } : { list: [], dup: {}, skills: {}, skillVersion: 1 };
}

async function characterOperationReplay(db, id, characterId, operation, requestId, payloadJson) {
  const batch = await db.batch([
    db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
      .bind(characterId, operation, requestId),
    ...battleCompletionSnapshotStatements(db, id, characterId)
  ]);
  const prior = batch?.[0]?.results?.[0] || null;
  if (!prior) return null;
  if (prior.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
  if (prior.result_json === "pending") return json({ error: "operation_in_progress", retry: true }, 409);
  return json({ ok: true, replayed: true, result: parseJsonColumn(prior.result_json, {}), ...battleCompletionSnapshotFromBatch(batch, 1) });
}

async function runCharacterReceiptMutation(db, { id, characterId, operation, requestId, payloadJson, guardSql, guardBinds, mutationStatements, result }) {
  const token = crypto.randomUUID();
  const now = nowIso();
  const statements = [
    db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
      .bind(characterId, operation, requestId),
    db.prepare(
      `INSERT INTO character_operation_receipts (character_id, operation, request_id, operation_token, payload_json, result_json, created_at)
       SELECT ?, ?, ?, ?, ?, 'pending', ? WHERE ${guardSql}
       ON CONFLICT(character_id, operation, request_id) DO NOTHING`
    ).bind(characterId, operation, requestId, token, payloadJson, now, ...guardBinds)
  ];
  statements.push(...mutationStatements(token, now));
  statements.push(db.prepare(
    `UPDATE character_operation_receipts SET result_json = ? WHERE operation_token = ? AND result_json = 'pending' AND changes() = 1`
  ).bind(JSON.stringify(result), token));
  statements.push(db.prepare(`DELETE FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending'`).bind(token));
  const receiptReadIndex = statements.length;
  statements.push(db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
    .bind(characterId, operation, requestId));
  const snapshotIndex = statements.length;
  statements.push(...battleCompletionSnapshotStatements(db, id, characterId));
  const batch = await db.batch(statements);
  const prior = batch?.[0]?.results?.[0] || null;
  if (prior) {
    if (prior.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
    if (prior.result_json === "pending") return json({ error: "operation_in_progress", retry: true }, 409);
    return json({ ok: true, replayed: true, result: parseJsonColumn(prior.result_json, {}), ...battleCompletionSnapshotFromBatch(batch, snapshotIndex) });
  }
  const receipt = batch?.[receiptReadIndex]?.results?.[0] || null;
  if (!receipt) return json({ error: "operation_conflict", retry: true }, 409);
  if (receipt.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
  const committed = Number(batch?.[1]?.meta?.changes) > 0;
  return json({ ok: true, replayed: !committed, result: parseJsonColumn(receipt.result_json, result), ...battleCompletionSnapshotFromBatch(batch, snapshotIndex) });
}

async function handleAllocateHeroSkills(db, id, session, characterId, allocations, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key) || !allocations || typeof allocations !== "object" || Array.isArray(allocations)) return json({ error: "invalid_skill_allocation" }, 400);
  const current = characterPetEnvelope(owned.row);
  const skills = { ...current.skills };
  const normalized = {};
  for (const [skillId, raw] of Object.entries(allocations)) {
    const amount = Number(raw);
    if (!HERO_SKILLS_V1_BY_ID[skillId] || !Number.isInteger(amount) || amount < 0 || amount > 5) return json({ error: "invalid_skill_allocation" }, 400);
    if (amount) normalized[skillId] = amount;
  }
  if (!Object.keys(normalized).length) return json({ error: "invalid_skill_allocation" }, 400);
  const payloadJson = JSON.stringify(Object.fromEntries(Object.keys(normalized).sort().map(keyName => [keyName, normalized[keyName]])));
  const replay = await characterOperationReplay(db, id, characterId, "allocate_skills", key, payloadJson);
  if (replay) return replay;
  for (const [skillId, amount] of Object.entries(normalized)) {
    for (let index = 0; index < amount; index++) {
      const gate = canSpendHeroSkillPoint(Number(owned.row.level) || 1, skills, skillId);
      if (!gate.ok) return json({ error: "skill_requirement", reason: gate.reason }, 409);
      skills[skillId] = heroSkillRank(skills, skillId) + 1;
    }
  }
  const nextJson = JSON.stringify({ ...current, skills, skillVersion: 1 });
  const result = { allocations: normalized, skills };
  return runCharacterReceiptMutation(db, {
    id, characterId, operation: "allocate_skills", requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND pets_json = ?)`,
    guardBinds: [characterId, id, owned.row.pets_json || ""],
    mutationStatements: token => [db.prepare(`UPDATE characters SET pets_json = ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND pets_json = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
      .bind(nextJson, nowIso(), characterId, id, owned.row.pets_json || "", token)],
    result
  });
}

async function handleResetCharacterStats(db, id, session, characterId, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "invalid_request_id" }, 400);
  const payloadJson = JSON.stringify({ cost: 100 });
  const replay = await characterOperationReplay(db, id, characterId, "reset_stats", key, payloadJson);
  if (replay) return replay;
  const stats = Object.fromEntries(["str", "vit", "agi", "dex", "luk"].map(field => [field, Math.max(0, Math.floor(Number(owned.row[field]) || 0))]));
  const refund = Object.values(stats).reduce((sum, points) => sum + points, 0);
  if (!refund) return json({ error: "no_stats_to_reset" }, 409);
  const result = { reset: true, statPointsRefunded: refund };
  return runCharacterReceiptMutation(db, {
    id, characterId, operation: "reset_stats", requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND str = ? AND vit = ? AND agi = ? AND dex = ? AND luk = ?)
      AND EXISTS (SELECT 1 FROM players WHERE id = ? AND diamonds >= 100)`,
    guardBinds: [characterId, id, ...Object.values(stats), id],
    mutationStatements: token => [
      db.prepare(`UPDATE players SET diamonds = diamonds - 100 WHERE id = ? AND diamonds >= 100 AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(id, token),
      db.prepare(`UPDATE characters SET str = 0, vit = 0, agi = 0, dex = 0, luk = 0, stat_points = stat_points + ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND str = ? AND vit = ? AND agi = ? AND dex = ? AND luk = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(refund, nowIso(), characterId, id, ...Object.values(stats), token)
    ], result
  });
}

async function handleResetHeroSkills(db, id, session, characterId, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "invalid_request_id" }, 400);
  const payloadJson = JSON.stringify({ cost: 100 });
  const replay = await characterOperationReplay(db, id, characterId, "reset_skills", key, payloadJson);
  if (replay) return replay;
  const current = characterPetEnvelope(owned.row);
  const spent = heroSkillSpentPoints(current.skills);
  if (!spent) return json({ error: "no_skills_to_reset" }, 409);
  const nextJson = JSON.stringify({ ...current, skills: {}, skillVersion: 1 });
  const result = { reset: true, skillPointsRefunded: spent };
  return runCharacterReceiptMutation(db, {
    id, characterId, operation: "reset_skills", requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND pets_json = ?)
      AND EXISTS (SELECT 1 FROM players WHERE id = ? AND diamonds >= 100)`,
    guardBinds: [characterId, id, owned.row.pets_json || "", id],
    mutationStatements: token => [
      db.prepare(`UPDATE players SET diamonds = diamonds - 100 WHERE id = ? AND diamonds >= 100 AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(id, token),
      db.prepare(`UPDATE characters SET pets_json = ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND pets_json = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(nextJson, nowIso(), characterId, id, owned.row.pets_json || "", token)
    ], result
  });
}

const W45_PET_GACHA_POOLS = Object.freeze({ r: ["sprout", "flamekit", "sparkpup"], sr: ["ember_fox", "moon_hare", "hell_wolf"], ssr: ["inferno_drake", "storm_phoenix"] });
function w45RollPetDefId() {
  const roll = secureRandomUnit();
  const rarity = roll < 0.05 ? "ssr" : roll < 0.30 ? "sr" : "r";
  const pool = W45_PET_GACHA_POOLS[rarity];
  return pool[Math.floor(secureRandomUnit() * pool.length)];
}
function w45NewPetInstance(defId, instId) {
  const base = PET_BASE_STATS[defId] || PET_BASE_STATS.sprout;
  return { instId, defId, level: 1, xp: 0, star: 1, stats: { str: base[0], vit: base[1], agi: base[2], dex: base[3], luk: base[4] } };
}
async function handlePetEconomyAction(db, id, session, characterId, action, petInstId, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const envelope = characterPetEnvelope(owned.row);
  if (action === "equip" || action === "unequip") {
    const nextId = action === "unequip" ? "" : String(petInstId || "");
    if (nextId && !envelope.list.some(pet => pet?.instId === nextId)) return json({ error: "pet_not_owned" }, 403);
    await db.prepare(`UPDATE characters SET active_pet_id = ?, updated_at = ? WHERE character_id = ? AND player_id = ?`)
      .bind(nextId, nowIso(), characterId, id).run();
    return json({ ok: true, ...(await battleCompletionSnapshot(db, id, characterId)) });
  }
  const key = String(requestId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "invalid_request_id" }, 400);
  if (action === "gacha") {
    const payloadJson = JSON.stringify({ cost: 100 });
    const replay = await characterOperationReplay(db, id, characterId, "pet_gacha", key, payloadJson);
    if (replay) return replay;
    const defId = w45RollPetDefId();
    const duplicate = envelope.list.some(pet => pet?.defId === defId);
    const nextEnvelope = { ...envelope };
    let result;
    if (duplicate) {
      nextEnvelope.dup = { ...(nextEnvelope.dup || {}), [defId]: (Number(nextEnvelope.dup?.[defId]) || 0) + 1 };
      result = { defId, duplicate: true };
    } else {
      const instance = w45NewPetInstance(defId, `pet-${randomToken(16)}`);
      nextEnvelope.list = [...envelope.list, instance];
      result = { defId, duplicate: false, instance };
    }
    const nextJson = JSON.stringify(nextEnvelope);
    return runCharacterReceiptMutation(db, {
      id, characterId, operation: "pet_gacha", requestId: key, payloadJson,
      guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND pets_json = ?)
        AND EXISTS (SELECT 1 FROM players WHERE id = ? AND diamonds >= 100)`,
      guardBinds: [characterId, id, owned.row.pets_json || "", id],
      mutationStatements: token => [
        db.prepare(`UPDATE players SET diamonds = diamonds - 100 WHERE id = ? AND diamonds >= 100 AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(id, token),
        db.prepare(`UPDATE characters SET pets_json = ?, active_pet_id = CASE WHEN active_pet_id = '' THEN ? ELSE active_pet_id END, updated_at = ? WHERE character_id = ? AND player_id = ? AND pets_json = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
          .bind(nextJson, result.instance?.instId || "", nowIso(), characterId, id, owned.row.pets_json || "", token)
      ], result
    });
  }
  if (action === "star_up") {
    const payloadJson = JSON.stringify({ petInstId: String(petInstId || "") });
    const replay = await characterOperationReplay(db, id, characterId, "pet_star_up", key, payloadJson);
    if (replay) return replay;
    const pet = envelope.list.find(candidate => candidate?.instId === String(petInstId || ""));
    if (!pet) return json({ error: "pet_not_owned" }, 404);
    const star = Math.max(1, Math.floor(Number(pet.star) || 1));
    const cost = star === 1 ? 1 : star === 2 ? 2 : 0;
    if (!cost) return json({ error: "pet_star_max" }, 409);
    const available = Math.max(0, Math.floor(Number(envelope.dup?.[pet.defId]) || 0));
    if (available < cost) return json({ error: "insufficient_pet_duplicates", need: cost, have: available }, 409);
    const nextEnvelope = {
      ...envelope,
      list: envelope.list.map(candidate => candidate?.instId === pet.instId ? { ...candidate, star: star + 1 } : candidate),
      dup: { ...(envelope.dup || {}), [pet.defId]: available - cost }
    };
    return runCharacterReceiptMutation(db, {
      id, characterId, operation: "pet_star_up", requestId: key, payloadJson,
      guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND pets_json = ?)`,
      guardBinds: [characterId, id, owned.row.pets_json || ""],
      mutationStatements: token => [db.prepare(`UPDATE characters SET pets_json = ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND pets_json = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(JSON.stringify(nextEnvelope), nowIso(), characterId, id, owned.row.pets_json || "", token)],
      result: { petInstId: pet.instId, star: star + 1, duplicatesSpent: cost }
    });
  }
  return json({ error: "invalid_pet_action" }, 400);
}

async function handleConsumePotion(db, id, session, characterId, potionId, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  const potion = String(potionId || "");
  const allowedPotions = new Set(["hp_small", "hp_medium", "hp_high", "hp_full", "mp_small", "mp_medium", "mp_high", "mp_full"]);
  if (!allowedPotions.has(potion) || !/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "invalid_potion_request" }, 400);
  const payloadJson = JSON.stringify({ potionId: potion });
  const replay = await characterOperationReplay(db, id, characterId, "consume_potion", key, payloadJson);
  if (replay) return replay;
  const rows = (await db.prepare(`SELECT item_id, extra_json FROM items WHERE character_id = ? AND player_id = ? AND slot_type = 'potion' AND json_extract(extra_json, '$.potionId') = ? ORDER BY rowid`)
    .bind(characterId, id, potion).all()).results || [];
  const stacks = rows.map(row => ({ ...row, extra: parseJsonColumn(row.extra_json, {}), quantity: Math.max(0, Math.floor(Number(parseJsonColumn(row.extra_json, {}).quantity) || 0)) }));
  if (stacks.reduce((sum, row) => sum + row.quantity, 0) < 1) return json({ error: "potion_not_owned" }, 409);
  let remaining = 1;
  const mutations = [];
  for (const row of stacks) {
    if (remaining <= 0) break;
    if (!row.quantity) continue;
    const nextQuantity = row.quantity - 1;
    remaining -= 1;
    if (nextQuantity) {
      mutations.push({ row, nextQuantity });
    } else {
      mutations.push({ row, nextQuantity: 0 });
    }
  }
  const result = { potionId: potion, consumed: 1 };
  return runCharacterReceiptMutation(db, {
    id, characterId, operation: "consume_potion", requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ?)
      AND (SELECT COALESCE(SUM(CAST(json_extract(extra_json, '$.quantity') AS INTEGER)), 0) FROM items WHERE character_id = ? AND player_id = ? AND slot_type = 'potion' AND json_extract(extra_json, '$.potionId') = ?) >= 1`,
    guardBinds: [characterId, id, characterId, id, potion],
    mutationStatements: token => mutations.map(({ row, nextQuantity }) => nextQuantity > 0
      ? db.prepare(`UPDATE items SET extra_json = ?, updated_at = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(JSON.stringify({ ...row.extra, quantity: nextQuantity }), nowIso(), row.item_id, id, characterId, row.extra_json || "", token)
      : db.prepare(`DELETE FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(row.item_id, id, characterId, row.extra_json || "", token)),
    result
  });
}

function normalizeShopQuantity(rawQuantity) {
  if (rawQuantity === undefined) return 1;
  return Number.isInteger(rawQuantity) && rawQuantity >= 1 && rawQuantity <= 99 ? rawQuantity : null;
}

async function handlePurchaseCharacterResource(db, id, session, characterId, resource, quantity, requestId) {
  const auth = session?.__characterAuth?.auth || await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = session?.__characterAuth?.owned || await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  const kind = String(resource?.kind || "");
  const resourceId = String(resource?.id || "");
  const normalizedQuantity = normalizeShopQuantity(quantity);
  if (normalizedQuantity === null) return json({ error: "invalid_shop_quantity" }, 400);
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "invalid_request_id" }, 400);
  const definitions = {
    protection_stone: { currency: "diamonds", cost: 30 },
    iron: { currency: "gold", cost: 6 },
    manaOre: { currency: "gold", cost: 22 },
    hp_small: { currency: "gold", cost: 15, name: "Small HP Potion" },
    hp_medium: { currency: "gold", cost: 32, name: "Medium HP Potion" },
    hp_high: { currency: "gold", cost: 60, name: "High HP Potion" },
    hp_full: { currency: "gold", cost: 110, name: "Full HP Potion" },
    mp_small: { currency: "gold", cost: 15, name: "Small SP Potion" },
    mp_medium: { currency: "gold", cost: 32, name: "Medium SP Potion" },
    mp_high: { currency: "gold", cost: 60, name: "High SP Potion" },
    mp_full: { currency: "gold", cost: 110, name: "Full SP Potion" }
  };
  const definition = definitions[kind === "protection_stone" ? kind : resourceId];
  if (!definition || !["protection_stone", "material", "potion"].includes(kind)
      || (kind === "material" && !["iron", "manaOre"].includes(resourceId))
      || (kind === "potion" && !/^(hp|mp)_(small|medium|high|full)$/.test(resourceId))) return json({ error: "invalid_shop_resource" }, 400);
  if (kind === "protection_stone" && normalizedQuantity !== 1) return json({ error: "invalid_shop_quantity" }, 400);
  const actionId = kind === "protection_stone" ? "protection_stone" : `${kind}:${resourceId}`;
  const payloadJson = JSON.stringify({ kind: actionId, quantity: normalizedQuantity });
  const operation = `purchase:${actionId}`;
  const totalCost = definition.cost * normalizedQuantity;
  const balanceSql = definition.currency === "diamonds"
    ? `EXISTS (SELECT 1 FROM players WHERE id = ? AND diamonds >= ?)`
    : `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND gold >= ?)`;
  const guardBinds = definition.currency === "diamonds" ? [id, totalCost] : [characterId, id, totalCost];
  const overflowGuardSql = kind === "protection_stone"
    ? ""
    : ` AND NOT EXISTS (
        SELECT 1 FROM items
        WHERE player_id = ? AND character_id = ?
          AND json_extract(extra_json, '$.overflow') = 1
      )`;
  const overflowGuardBinds = kind === "protection_stone" ? [] : [id, characterId];
  const tokenItemId = `shop-${randomToken(18)}`;
  const result = kind === "protection_stone"
    ? { resource: kind, amount: 1, quantity: 1, unitPrice: definition.cost, cost: totalCost }
    : { resource: resourceId, amount: normalizedQuantity, quantity: normalizedQuantity, itemId: tokenItemId, unitPrice: definition.cost, cost: totalCost };
  const inventoryPlan = kind === "protection_stone" ? null : await loadMailSettlementState(db, id, characterId, null, { reconcile: false });
  if (kind !== "protection_stone" && inventoryPlan?.overflow?.some(entry => !entry.deleted)) return json({ error: "inventory_overflow_pending" }, 409);
  if (inventoryPlan) {
      const potion = kind === "potion";
    const slotType = potion ? "potion" : "junk";
    const itemName = potion ? definition.name : resourceId === "iron" ? "Iron" : "Mana Ore";
    inventoryPlanAddRow(inventoryPlan, {
      item_id: tokenItemId, slot_type: slotType, equipped: 0, inventory_slot: "", item_template_id: "",      rarity: "common", name: itemName, item_level: 0, enhance_level: 0, bound: 0, quantity: 1,
      atk: 0, def: 0, hp: 0, mp: 0,
      extra_json: JSON.stringify(potion ? { potionId: resourceId, quantity: normalizedQuantity } : { junkId: resourceId, quantity: normalizedQuantity })
    }, { originType: "shop_purchase", sourceId: actionId, context: { resource: resourceId, quantity: normalizedQuantity } });
    reconcileMailOverflow(inventoryPlan);
  }
  return runCharacterReceiptMutation(db, {
    id, characterId, operation, requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ?) AND ${balanceSql}${overflowGuardSql}`,
    guardBinds: [characterId, id, ...guardBinds, ...overflowGuardBinds],
    mutationStatements: token => {
      if (kind === "protection_stone") return [
        db.prepare(`UPDATE players SET diamonds = diamonds - ? WHERE id = ? AND diamonds >= ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(totalCost, id, totalCost, token),
        db.prepare(`UPDATE characters SET protection_stones = protection_stones + 1, updated_at = ? WHERE character_id = ? AND player_id = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(nowIso(), characterId, id, token)
      ];
      return [
        db.prepare(`UPDATE characters SET gold = gold - ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND gold >= ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(totalCost, nowIso(), characterId, id, totalCost, token),
        ...mailPlanPersistenceStatements(db, inventoryPlan, id, characterId, nowIso(),
          `EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`, [token])
      ];
    },
    result
  });
}
const W45_SHOP_PRICES = Object.freeze({
  1: Object.freeze({ rare: 800, unique: 1300, elite: 2300 }),
  2: Object.freeze({ rare: 1900, unique: 3200, elite: 5500 }),
  3: Object.freeze({ rare: 3100, unique: 5200, elite: 9000 }),
  4: Object.freeze({ rare: 4600, unique: 7700, elite: 13500 }),
  5: Object.freeze({ rare: 6900, unique: 11500, elite: 20000 })
});
async function handleGetCharacterShopStock(db, id, session, characterId, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "invalid_request_id" }, 400);
  const floor = Math.max(1, Number(owned.row.unlocked_floor) || 1);
  const tier = dungeonV2ServerTierForFloor(floor);
  const operation = "shop_stock";
  const payloadJson = JSON.stringify({ floor, tier });
  const replay = await characterOperationReplay(db, id, characterId, operation, key, payloadJson);
  if (replay) return replay;
  const offers = Array.from({ length: 3 }, (_, index) => {
    const rarity = secureRandomUnit() < 0.18 ? "unique" : "rare";
    const type = ["weapon", "helmet", "chest", "gloves", "boots"][Math.floor(secureRandomUnit() * 5)];
    const offerId = `offer-${randomToken(14)}`;
    const item = dungeonV2ServerCanonicalEquipment({
      battleId: `shop-${randomToken(12)}`, floor, type, rarity, sourceType: "shop_normal",
      sourceFloor: floor, sourceIdentity: `normal-shop-tier-${tier}`, rng: secureRandomUnit
    });
    item.id = `shop-item-${randomToken(14)}`;
    return { offerId, price: W45_SHOP_PRICES[tier][rarity], item };
  });
  const result = { tier, items: offers.map(offer => ({ ...offer.item, offerId: offer.offerId, price: offer.price })) };
  const offersJson = JSON.stringify(offers);
  return runCharacterReceiptMutation(db, {
    id, characterId, operation, requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND unlocked_floor = ?)`,
    guardBinds: [characterId, id, owned.row.unlocked_floor],
    mutationStatements: token => [db.prepare(
      `INSERT INTO character_shop_offers (character_id, player_id, floor, offers_json, updated_at)
       SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')
       ON CONFLICT(character_id) DO UPDATE SET player_id = excluded.player_id, floor = excluded.floor, offers_json = excluded.offers_json, updated_at = excluded.updated_at`
    ).bind(characterId, id, floor, offersJson, nowIso(), token)],
    result
  });
}

async function handlePurchaseShopEquipment(db, id, session, characterId, offerId, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  const keyOffer = String(offerId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key) || !/^offer-[A-Za-z0-9_-]{10,40}$/.test(keyOffer)) return json({ error: "invalid_shop_purchase" }, 400);
  const operation = "shop_purchase_equipment";
  const payloadJson = JSON.stringify({ offerId: keyOffer });
  const replay = await characterOperationReplay(db, id, characterId, operation, key, payloadJson);
  if (replay) return replay;
  const shop = await db.prepare(`SELECT floor, offers_json FROM character_shop_offers WHERE character_id = ? AND player_id = ?`).bind(characterId, id).first();
  if (!shop || Number(shop.floor) !== Math.max(1, Number(owned.row.unlocked_floor) || 1)) return json({ error: "shop_offer_expired" }, 409);
  const offers = parseJsonColumn(shop.offers_json, []);
  const offer = (Array.isArray(offers) ? offers : []).find(row => row?.offerId === keyOffer);
  if (!offer?.item || !DUNGEON_V2_REWARD_SLOTS.has(String(offer.item.type)) || !["rare", "unique"].includes(String(offer.item.rarity))) return json({ error: "shop_offer_not_found" }, 404);
  const price = Number(offer.price) || 0;
  if (!price) return json({ error: "shop_offer_invalid" }, 409);
  if (Number(owned.row.gold) < price) return json({ error: "insufficient_gold", need: price, have: Number(owned.row.gold) || 0 }, 409);
  const nextOffers = offers.filter(row => row?.offerId !== keyOffer);
  const itemId = String(offer.item.id || `shop-item-${randomToken(14)}`);
  const itemRow = dungeonV2ServerRewardItem({ ...offer.item, id: itemId }, 0, false);
  if (!itemRow) return json({ error: "shop_offer_invalid" }, 409);
  const inventoryPlan = await loadMailSettlementState(db, id, characterId, null, { reconcile: false });
  inventoryPlanAddRow(inventoryPlan, itemRow, { originType: "shop_purchase", sourceId: keyOffer, context: { offerId: keyOffer, floor: shop.floor } });
  reconcileMailOverflow(inventoryPlan);
  const now = nowIso();
  const result = { offerId: keyOffer, itemId, price };
  return runCharacterReceiptMutation(db, {
    id, characterId, operation, requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND gold >= ?)
      AND EXISTS (SELECT 1 FROM character_shop_offers WHERE character_id = ? AND player_id = ? AND floor = ? AND offers_json = ?
        AND EXISTS (SELECT 1 FROM json_each(character_shop_offers.offers_json) WHERE json_extract(value, '$.offerId') = ?))`,
    guardBinds: [characterId, id, price, characterId, id, shop.floor, shop.offers_json, keyOffer],
    mutationStatements: token => [
      db.prepare(`UPDATE characters SET gold = gold - ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND gold >= ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(price, now, characterId, id, price, token),
      ...mailPlanPersistenceStatements(db, inventoryPlan, id, characterId, now,
        `EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`, [token]),
      db.prepare(`UPDATE character_shop_offers SET offers_json = ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND offers_json = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(JSON.stringify(nextOffers), now, characterId, id, shop.offers_json, token)
    ], result
  });
}

function sellUnitPrice(row, extra) {
  const junkValues = { stone: 1, grass: 1, wood: 2, iron: 4, manaOre: 6 };
  const potionValues = { hp_small: 4, mp_small: 4, hp_medium: 9, mp_medium: 9, hp_high: 18, mp_high: 18, hp_full: 33, mp_full: 33 };
  if (row.slot_type === "junk") return junkValues[String(extra.junkId || "")] || 1;
  if (row.slot_type === "potion") return potionValues[String(extra.potionId || "")] || 0;
  let value = (Number(row.atk) || 0) * 3 + (Number(row.def) || 0) * 3 + (Number(row.hp) || 0) * .6 + (Number(row.mp) || 0) * .6
    + (Number(extra.dodgeChance) || 0) * 4 + (Number(extra.critChance) || 0) * 4 + (Number(extra.critDamage) || 0) * 2.5;
  if (row.slot_type === "wings") {
    const family = String(extra.wingFamily || extra.wingId || extra.wingsId || extra.setId || "").toLowerCase();
    const primary = { azure: "agi", robot: "vit", skeleton: "str" }[family];
    value += (Number(row.enhance_level) || 0) * 3;
    for (const slot of (Array.isArray(extra.empowerSlots) ? extra.empowerSlots : [])) {
      value += Number(slot?.value) || 0;
      if (slot?.key === primary) value += Number(slot.value) || 0;
    }
  }
  const rarityMult = { rare: 1, unique: 1.9, elite: 3.2, mythic: 5.4, azure: 5.4 }[String(row.rarity || "").toLowerCase()] || 1;
  return Math.max(3, Math.round(value * rarityMult * .9));
}

async function handleSellCharacterItem(db, id, session, characterId, itemId, quantity, requestId) {
  const auth = session?.__characterAuth?.auth || await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = session?.__characterAuth?.owned || await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  const idKey = String(itemId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key) || !idKey) return json({ error: "invalid_sell_request" }, 400);
  const operation = "sell_item";
  const row = await db.prepare(`SELECT * FROM items WHERE item_id = ? AND player_id = ? AND character_id = ?`).bind(idKey, id, characterId).first();
  if (!row) {
    const prior = await db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
      .bind(characterId, operation, key).first();
    if (prior) {
      const priorPayload = parseJsonColumn(prior.payload_json, {});
      if (String(priorPayload.itemId || "") !== idKey || (quantity !== undefined && Number(priorPayload.quantity) !== Number(quantity))) {
        return json({ error: "operation_request_conflict" }, 409);
      }
      if (prior.result_json === "pending") return json({ error: "operation_in_progress", retry: true }, 409);
      return json({ ok: true, replayed: true, result: parseJsonColumn(prior.result_json, {}), ...(await battleCompletionSnapshot(db, id, characterId)) });
    }
    return json({ error: "item_not_owned" }, 403);
  }  const extra = parseJsonColumn(row.extra_json, {});
  if (Number(row.equipped) === 1) return json({ error: "item_equipped" }, 409);
  if (extra.favorite) return json({ error: "item_favorited" }, 409);
  const stackable = row.slot_type === "junk" || row.slot_type === "potion";
  const storedQuantity = Math.max(1, Math.floor(Number(extra.quantity ?? row.quantity) || 1));
  let sellQuantity = quantity === undefined ? (stackable ? storedQuantity : 1) : quantity;
  if (!Number.isInteger(sellQuantity) || sellQuantity < 1 || sellQuantity > 99) return json({ error: "invalid_sell_quantity" }, 400);
  if (!stackable && sellQuantity !== 1) return json({ error: "invalid_sell_quantity" }, 400);
  if (stackable && sellQuantity > storedQuantity) return json({ error: "invalid_sell_quantity" }, 400);
  const unitPrice = sellUnitPrice(row, extra);
  if (!unitPrice) return json({ error: "invalid_sell_item" }, 409);
  const totalGold = unitPrice * sellQuantity;
  const payloadJson = JSON.stringify({ itemId: idKey, quantity: sellQuantity });
  const result = { itemId: idKey, quantity: sellQuantity, unitPrice, goldGained: totalGold, remaining: storedQuantity - sellQuantity };
  const rowExtra = row.extra_json || "";
  const guard = `EXISTS (SELECT 1 FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND equipped = 0
    AND COALESCE(extra_json, '') = ? AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
    AND COALESCE(json_extract(extra_json, '$.quantity'), 1) = ?
    AND COALESCE(atk, 0) = ? AND COALESCE(def, 0) = ? AND COALESCE(hp, 0) = ? AND COALESCE(mp, 0) = ?
    AND COALESCE(enhance_level, 0) = ? AND COALESCE(rarity, '') = ?)`;
  return runCharacterReceiptMutation(db, {
    id, characterId, operation, requestId: key, payloadJson,
    guardSql: guard, guardBinds: [idKey, id, characterId, rowExtra, storedQuantity,
      Number(row.atk) || 0, Number(row.def) || 0, Number(row.hp) || 0, Number(row.mp) || 0,
      Number(row.enhance_level) || 0, String(row.rarity || "")],
    mutationStatements: token => {
      const statements = [];
      if (sellQuantity === storedQuantity) {
        statements.push(db.prepare(`DELETE FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND equipped = 0
          AND COALESCE(extra_json, '') = ? AND COALESCE(json_extract(extra_json, '$.quantity'), 1) = ?
          AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
          AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
          .bind(idKey, id, characterId, rowExtra, storedQuantity, token));
      } else {
        const nextExtra = JSON.stringify({ ...extra, quantity: storedQuantity - sellQuantity });
        statements.push(db.prepare(`UPDATE items SET extra_json = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND equipped = 0
          AND COALESCE(extra_json, '') = ? AND COALESCE(json_extract(extra_json, '$.quantity'), 1) = ?
          AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
          AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
          .bind(nextExtra, idKey, id, characterId, rowExtra, storedQuantity, token));
      }
      statements.push(db.prepare(`UPDATE characters SET gold = gold + ?, updated_at = ? WHERE character_id = ? AND player_id = ?
        AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(totalGold, nowIso(), characterId, id, token));
      return statements;
    },
    result
  });
}

async function handleSalvageItem(db, id, session, characterId, itemId, requestId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const targetId = String(itemId || "");
  const key = String(requestId || "");
  if (!targetId || !/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "invalid_salvage_request" }, 400);
  const operation = "salvage_item";
  const payloadJson = JSON.stringify({ itemId: targetId });
  const prior = await db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
    .bind(characterId, operation, key).first();
  if (prior) {
    if (prior.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
    return json({ ok: true, replayed: true, salvage: parseJsonColumn(prior.result_json, {}), ...(await battleCompletionSnapshot(db, id, characterId)) });
  }

  const row = await db.prepare(`SELECT * FROM items WHERE item_id = ? AND character_id = ? AND player_id = ?`).bind(targetId, characterId, id).first();
  if (!row) return json({ error: "item_not_owned" }, 403);
  const extra = parseJsonColumn(row.extra_json, {});
  if (Number(row.equipped)) return json({ error: "item_equipped" }, 409);
  if (extra.favorite === true) return json({ error: "item_favorited" }, 409);

  let materials = [];
  let salvageKind = "normal";
  const v2 = Number(extra.itemModelVersion) === 2 || Number(extra.rewardVersion) === 2;
  if (v2 || ["mythic", "azure"].includes(String(row.rarity || "").toLowerCase())) {
    const model = { type: row.slot_type, rarity: row.rarity, itemModelVersion: Number(extra.itemModelVersion), setId: extra.setId };
    if (globalThis.MYTHIC_V2?.validSetItem(model)) {
      const consumed = Array.isArray(extra.craftConsumed) ? extra.craftConsumed : [];
      const needs = Object.fromEntries(consumed.filter(entry => ["bossHorn", "bossHide"].includes(entry?.junkId)).map(entry => [entry.junkId, Math.max(0, Math.floor(Number(entry.qty) || 0))]));
      if (!needs.bossHorn || !needs.bossHide) return json({ error: "mythic_salvage_source_invalid" }, 409);
      materials = ["bossHorn", "bossHide"].map(junkId => ({ junkId, quantity: Math.max(1, Math.floor(needs[junkId] / 2)) }));
      salvageKind = "mythic_set";
    } else if (globalThis.MYTHIC_V2?.bossWeapon({ type: row.slot_type, rarity: row.rarity, itemModelVersion: Number(extra.itemModelVersion), bossWeaponId: extra.bossWeaponId, specialSource: extra.specialSource })) {
      // Boss Weapons return no Stones and no crafting Gold.
      materials = [];
      salvageKind = "mythic_boss_weapon";
    } else {
      // Reward V2 Rare/Unique/Elite equipment is normal salvage. Only Mythic
      // Set/Boss Weapon uses the special rules above; Raid/Wing sources remain
      // blocked by the canonical Reward V2 salvage table.
      const yieldPlan = globalThis.DUNGEON_REWARD_V2?.dungeonV2SalvageYield(row.rarity, { ...extra, sourceType: extra.sourceType });
      if (!yieldPlan) return json({ error: "salvage_not_eligible" }, 409);
      materials = Object.entries(yieldPlan).filter(([, quantity]) => Number(quantity) > 0)
        .map(([junkId, quantity]) => ({ junkId, quantity: Math.floor(Number(quantity)) }));
    }
  } else {
    const yieldPlan = globalThis.DUNGEON_REWARD_V2?.dungeonV2SalvageYield(row.rarity, { ...extra, sourceType: extra.sourceType });
    if (!yieldPlan) return json({ error: "salvage_not_eligible" }, 409);
    materials = Object.entries(yieldPlan).filter(([, quantity]) => Number(quantity) > 0).map(([junkId, quantity]) => ({ junkId, quantity: Math.floor(Number(quantity)) }));
  }

  const operationToken = crypto.randomUUID();
  const now = nowIso();
  const salvage = { itemId: targetId, kind: salvageKind, materials };
  const inventoryPlan = await loadMailSettlementState(db, id, characterId, null, { reconcile: false });
  inventoryPlanRemoveItem(inventoryPlan, targetId);
  // The source row is deleted by the guarded salvage statement below. Keep it
  // out of the planner persistence list so that deletion releases its slot
  // without consuming the planner's changes() gate.
  inventoryPlan.entries = inventoryPlan.entries.filter(entry => String(entry.raw.item_id) !== targetId);
  inventoryPlanLists(inventoryPlan);
  materials.forEach(material => {
    const junkId = String(material.junkId).slice(0, 80);
    const quantity = Math.max(1, Math.floor(Number(material.quantity) || 1));
    const outId = `salvage-${dungeonV2ServerHash(`${characterId}:${key}:${junkId}`)}`;
    const meta = DUNGEON_V2_REWARD_JUNK_META[junkId] || [junkId, "📦"];
    inventoryPlanAddRow(inventoryPlan, {
      item_id: outId, slot_type: "junk", equipped: 0, inventory_slot: "", item_template_id: "",
      rarity: "common", name: meta[0], item_level: 0, enhance_level: 0, bound: 0, quantity: 1,
      atk: 0, def: 0, hp: 0, mp: 0,
      extra_json: JSON.stringify({ junkId, quantity, icon: meta[1] })
    }, { originType: "salvage", sourceId: targetId, context: { itemId: targetId, salvageKind } });
  });
  reconcileMailOverflow(inventoryPlan);
  const statements = [db.prepare(
    `INSERT INTO character_operation_receipts (character_id, operation, request_id, operation_token, payload_json, result_json, created_at)
     SELECT ?, ?, ?, ?, ?, 'pending', ? WHERE EXISTS (SELECT 1 FROM items WHERE item_id = ? AND character_id = ? AND player_id = ? AND equipped = 0 AND COALESCE(extra_json, '') = ? AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1)
     ON CONFLICT(character_id, operation, request_id) DO NOTHING`
  ).bind(characterId, operation, key, operationToken, payloadJson, now, targetId, characterId, id, row.extra_json || "")];
  statements.push(db.prepare(
    `DELETE FROM items WHERE item_id = ? AND character_id = ? AND player_id = ? AND equipped = 0 AND COALESCE(extra_json, '') = ?
       AND COALESCE(json_extract(extra_json, '$.favorite'), 0) != 1
       AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`
  ).bind(targetId, characterId, id, row.extra_json || "", operationToken));
  statements.push(...mailPlanPersistenceStatements(db, inventoryPlan, id, characterId, now,
    `changes() > 0 AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`, [operationToken]));
  statements.push(db.prepare(`UPDATE character_operation_receipts SET result_json = ? WHERE operation_token = ? AND result_json = 'pending' AND changes() = 1`)
    .bind(JSON.stringify(salvage), operationToken));
  statements.push(db.prepare(`DELETE FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending'`).bind(operationToken));
  const results = await db.batch(statements);
  const receipt = await db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`)
    .bind(characterId, operation, key).first();
  if (!receipt) return json({ error: "salvage_conflict", retry: true }, 409);
  if (receipt.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
  const deleted = Number(results?.[1]?.meta?.changes) === 1;
  return json({ ok: true, replayed: !deleted, salvage: parseJsonColumn(receipt.result_json, salvage), ...(await battleCompletionSnapshot(db, id, characterId)) });
}

async function handleSaveRunState(db, id, session, characterId, runState) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  if (!runState) {
    await db.prepare(`DELETE FROM character_run_state WHERE character_id = ?`).bind(characterId).run();
    return json({ ok: true });
  }

  // Migration v12 supplies this additive per-character table. The legacy
  // player-keyed run_state table remains untouched for rollback compatibility.
  const obj = normalizedRunState(characterId, { ...runState, updated_at: nowIso() }, owned.row);
  await upsertRow(db, "run_state", "character_id", obj);
  return json({ ok: true });
}

// ---------- Battle V1 checkpoint / quick-slot / completion boundary ----------
function parseJsonColumn(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; }
}

async function handleGetBattleState(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const checkpoint = await db.prepare(
    `SELECT battle_id, checkpoint_seq, payload_json, updated_at FROM battle_checkpoints
     WHERE character_id = ? AND state = 'active' LIMIT 1`
  ).bind(characterId).first();
  const settings = await db.prepare(`SELECT quick_slots_json FROM character_settings WHERE character_id = ?`).bind(characterId).first();
  const checkpointPayload = checkpoint ? parseJsonColumn(checkpoint.payload_json, null) : null;
  return json({
    ok: true,
    // An authorization row owns immutable encounter identity but is not yet a
    // resumable Battle Core checkpoint. A reconnect can safely call
    // startDungeonBattle again and receive this same authorization.
    checkpoint: checkpoint && !checkpointPayload?.authorizationOnly ? {
      battleId: checkpoint.battle_id,
      checkpointSeq: Number(checkpoint.checkpoint_seq) || 0,
      payload: checkpointPayload,
      updatedAt: checkpoint.updated_at
    } : null,
    quickSlots: parseJsonColumn(settings && settings.quick_slots_json, [null, null, null, null])
  });
}

async function handleSaveBattleCheckpoint(db, id, session, characterId, battleId, checkpointSeq, payload) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!battleId || !payload || String(payload.battleId || "") !== String(battleId)) return json({ error: "invalid_checkpoint" }, 400);
  const seq = Math.max(0, Math.floor(Number(checkpointSeq) || 0));
  const identity = await db.prepare(`SELECT character_id FROM battle_checkpoints WHERE battle_id = ? LIMIT 1`).bind(String(battleId)).first();
  if (identity && identity.character_id !== characterId) return json({ error: "battle_identity_conflict" }, 409);
  const priorCheckpoint = await db.prepare(`SELECT checkpoint_seq, payload_json FROM battle_checkpoints WHERE battle_id = ? AND character_id = ? AND state = 'active' LIMIT 1`).bind(String(battleId), characterId).first();
  if (payload?.mode === "dungeon") {
    if (!priorCheckpoint) return json({ error: "dungeon_battle_not_authorized" }, 409);
    const priorPayload = parseJsonColumn(priorCheckpoint.payload_json, null);
    const priorContext = dungeonV2ServerContextFromStoredCheckpoint(priorPayload);
    if (!priorContext) return json({ error: "dungeon_battle_not_authorized" }, 409);
    const checkpointValidationReason = dungeonV2ServerCheckpointValidationReason(payload);
    const incomingContext = dungeonV2ServerContextFromClientCheckpoint(payload);
    if (!incomingContext) {
      // Keep the player-facing error intentionally generic; the structural
      // reason is safe for server logs and makes a future runtime-shape drift
      // diagnosable without exposing authorization context to clients.
      console.warn("[battle-checkpoint-invalid]", JSON.stringify({
        reason: checkpointValidationReason,
        checkpoint: {
          phaseType: typeof payload.phase,
          phase: ["prepared", "active", "complete"].includes(payload.phase) ? payload.phase : null,
          floorType: typeof payload.floor,
          floorInRange: Number.isInteger(Number(payload.floor)) && Number(payload.floor) >= 1 && Number(payload.floor) <= 10000,
          encounterTypePresent: payload.encounterType != null,
          encounterTypeMatchesExpected: payload.encounterType == null ? null : String(payload.encounterType) === priorContext.role,
          contextPresent: payload.serverContext != null,
          contextType: Array.isArray(payload.serverContext) ? "array" : typeof payload.serverContext,
          contextModeMatches: payload.serverContext?.mode === "dungeon",
          contextFloorMatches: Number(payload.serverContext?.floor) === priorContext.floor,
          contextRoleMatches: payload.serverContext?.role === priorContext.role,
          contextEnemyCount: Array.isArray(payload.serverContext?.enemies) ? payload.serverContext.enemies.length : null,
          expectedEnemyCount: priorContext.packCount,
          enemyIdsMatchExpected: Array.isArray(payload.enemyIds)
            ? payload.enemyIds.length === priorContext.packCount
              && payload.enemyIds.every(id => priorContext.enemies.some(enemy => enemy.instanceId === String(id)))
            : null,
          enemyIdsType: Array.isArray(payload.enemyIds) ? "array" : typeof payload.enemyIds,
          enemyIdsCount: Array.isArray(payload.enemyIds) ? payload.enemyIds.length : null,
          unitsType: Array.isArray(payload.units) ? "array" : typeof payload.units,
          unitCount: payload.units && typeof payload.units === "object" ? Object.keys(payload.units).length : null
        }
      }));
      return json({ error: "invalid_dungeon_checkpoint" }, 400);
    }
    if (!dungeonV2ServerContextsMatch(priorContext, incomingContext)) return json({ error: "checkpoint_context_conflict" }, 409);
    const trustedPayload = {
      ...payload,
      battleId: String(battleId),
      mode: "dungeon",
      floor: priorContext.floor,
      encounterType: priorContext.role,
      serverContext: priorContext,
      authorizationOnly: false
    };
    const encoded = JSON.stringify(trustedPayload);
    if (encoded.length > 512000) return json({ error: "checkpoint_too_large" }, 413);
    const result = await db.prepare(
      `UPDATE battle_checkpoints SET checkpoint_seq = ?, payload_json = ?, updated_at = ?
       WHERE battle_id = ? AND character_id = ? AND state = 'active' AND ? > checkpoint_seq`
    ).bind(seq, encoded, nowIso(), String(battleId), characterId, seq).run();
    return json({ ok: true, accepted: !!(result.meta && result.meta.changes), checkpointSeq: seq });
  }
  const encoded = JSON.stringify(payload);
  if (encoded.length > 512000) return json({ error: "checkpoint_too_large" }, 413);
  const existing = await db.prepare(`SELECT battle_id FROM battle_checkpoints WHERE character_id = ? AND state = 'active' LIMIT 1`).bind(characterId).first();
  if (existing && existing.battle_id !== String(battleId)) return json({ error: "active_battle_conflict" }, 409);
  const now = nowIso();
  const result = await db.prepare(
    `INSERT INTO battle_checkpoints (battle_id, character_id, checkpoint_seq, payload_json, state, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', ?, ?)
     ON CONFLICT(battle_id) DO UPDATE SET
       checkpoint_seq = excluded.checkpoint_seq,
       payload_json = excluded.payload_json,
       updated_at = excluded.updated_at
     WHERE battle_checkpoints.character_id = excluded.character_id
       AND battle_checkpoints.state = 'active'
       AND excluded.checkpoint_seq > battle_checkpoints.checkpoint_seq`
  ).bind(String(battleId), characterId, seq, encoded, now, now).run();
  return json({ ok: true, accepted: !!(result.meta && result.meta.changes), checkpointSeq: seq });
}

async function handleClearBattleCheckpoint(db, id, session, characterId, battleId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!battleId) return json({ error: "missing_fields" });
  await db.prepare(`UPDATE battle_checkpoints SET state = 'closed', updated_at = ? WHERE battle_id = ? AND character_id = ? AND state = 'active'`)
    .bind(nowIso(), String(battleId), characterId).run();
  return json({ ok: true });
}

const DUNGEON_V2_REWARD_SLOTS = new Set(["weapon", "helmet", "chest", "gloves", "boots"]);
const DUNGEON_V2_REWARD_RARITIES = new Set(["rare", "unique", "elite"]);
const DUNGEON_V2_REWARD_BASE_STATS = Object.freeze({
  weapon: [14, 18, 24, 31, 40],
  gloves: [6, 8, 10, 13, 17],
  chest: [9, 12, 15, 20, 26],
  helmet: [6, 8, 10, 13, 17],
  boots: [5, 6, 9, 11, 14]
});
const DUNGEON_V2_REWARD_NAMES = Object.freeze({
  weapon: ["Beginner Sword", "Copper Blade", "Steel Greatsword", "Platinum Greatsword", "Dragon Slayer Sword"],
  helmet: ["Leather Cap", "Bronze Guard Helm", "Steel Helm", "Platinum Helm", "Dragon Scale Helm"],
  chest: ["Leather Vest", "Bronze Armor", "Chain Armor", "Platinum Plate Armor", "Dragon Scale Armor"],
  gloves: ["Leather Gloves", "Bronze Gauntlets", "Chain Gloves", "Platinum Gauntlets", "Dragonhide Gloves"],
  boots: ["Leather Boots", "Bronze Greaves", "Chain Boots", "Platinum Sabatons", "Dragonhide Boots"],
  accessory: ["Lucky Charm", "Vitality Pendant", "Mana Ring", "Swift Anklet", "Phoenix Feather"]
});
const DUNGEON_V2_REWARD_RARITY_MULT = Object.freeze({ rare: 1, unique: 1.15, elite: 1.3 });
const DUNGEON_V2_REWARD_EMPOWER_SLOTS = Object.freeze({ rare: 1, unique: 2, elite: 3 });
const DUNGEON_V2_REWARD_TIER_MULT = Object.freeze([1, 1.3, 1.69, 2.197, 2.856]);
const DUNGEON_V2_REWARD_RARITY_BANDS = Object.freeze([
  { min: 1, max: 10, weights: { rare: 82.5, unique: 15, elite: 2.5 } },
  { min: 11, max: 20, weights: { rare: 78, unique: 18, elite: 4 } },
  { min: 21, max: 30, weights: { rare: 73, unique: 21, elite: 6 } },
  { min: 31, max: 50, weights: { rare: 69, unique: 24, elite: 7 } },
  { min: 51, max: 70, weights: { rare: 64, unique: 28, elite: 8 } },
  { min: 71, max: 90, weights: { rare: 60, unique: 30, elite: 10 } },
  { min: 91, max: Infinity, weights: { rare: 55, unique: 33, elite: 12 } }
]);
// Remote monster_loot rows and the generic fallback remain limited to ordinary
// materials. Boss Stones are emitted only by the chapter-boss reward plan below,
// so config cannot leak an elemental Stone into Normal or Elite encounters.
const DUNGEON_V2_REWARD_JUNK_IDS = Object.freeze(["iron", "manaOre", "stone", "grass", "wood"]);
const DUNGEON_V2_REWARD_JUNK_META = Object.freeze({
  iron: ["Iron", "🔩"], manaOre: ["Mana Ore", "🔮"], stone: ["Stone", "🪨"], grass: ["Grass", "🌿"], wood: ["Wood", "🪵"],
  earthStone: ["Earth Stone", "🟢"], fireStone: ["Fire Stone", "🔴"], waterStone: ["Water Stone", "🔵"]
});
const DUNGEON_V2_ACCESSORY_BASE = Object.freeze({ critChance: 2.5, dodgeChance: 2, critDamage: 8 });
const DUNGEON_V2_MONSTER_ID_LIST = Object.freeze(["jelly_slime", "spore_cap", "tusky_boar", "bramble_bat", "bone_rattler", "sandy_crab"]);
const DUNGEON_V2_BOSS_ID_LIST = Object.freeze(["moss_king", "ember_drake", "frost_warden"]);
const DUNGEON_V2_MODIFIER_ID_LIST = Object.freeze(["elite_pack", "golden", "arcane", "treasure", "cursed"]);
const DUNGEON_V2_MONSTER_IDS = new Set(DUNGEON_V2_MONSTER_ID_LIST);
const DUNGEON_V2_BOSS_IDS = new Set(DUNGEON_V2_BOSS_ID_LIST);
const DUNGEON_V2_FIRST_CLEAR_ACCESSORIES = {
  10: { gearTier: 1, rarity: "rare" }, 20: { gearTier: 1, rarity: "unique" }, 30: { gearTier: 1, rarity: "elite" },
  40: { gearTier: 2, rarity: "unique" }, 50: { gearTier: 2, rarity: "elite" }, 60: { gearTier: 3, rarity: "unique" },
  70: { gearTier: 3, rarity: "elite" }, 80: { gearTier: 4, rarity: "unique" }, 90: { gearTier: 4, rarity: "elite" },
  100: { gearTier: 5, rarity: "unique" }, 110: { gearTier: 5, rarity: "elite" },
};
function dungeonV2ServerPackMultiplier(pack) { return ({ 1: 1, 2: 1.35, 3: 1.65 })[Math.max(1, Math.min(3, Number(pack) || 1))] || 1; }
function dungeonV2ServerExp(floor, role, pack) {
  const base = Math.round(6 + Math.max(1, Math.floor(Number(floor) || 1)) * 2.4);
  const encounter = role === "chapter_boss" ? 2 : role === "elite" ? 1.5 : 1;
  return Math.round(base * encounter * (role === "normal" ? dungeonV2ServerPackMultiplier(pack) : 1));
}
function dungeonV2ServerGold(floor, role, pack) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  const base = f <= 30 ? 20 + 3 * f : f <= 50 ? 120 + 4 * (f - 31) : f <= 70 ? 210 + 5 * (f - 51) : f <= 90 ? 320 + 7 * (f - 71) : 480 + 10 * (f - 91);
  const encounter = role === "chapter_boss" ? 2 : role === "elite" ? 1.5 : 1;
  return Math.round(base * encounter * (role === "normal" ? dungeonV2ServerPackMultiplier(pack) : 1));
}
function dungeonV2ServerTierForFloor(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  return f <= 30 ? 1 : f <= 50 ? 2 : f <= 70 ? 3 : f <= 90 ? 4 : 5;
}
function dungeonV2ServerExpectedRole(floor) {
  const f = Math.max(1, Math.floor(Number(floor) || 1));
  return f % 10 === 0 ? "chapter_boss" : f % 10 === 5 ? "elite" : "normal";
}
function dungeonV2ServerHash(value) {
  let hash = 2166136261;
  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
function dungeonV2ServerRng(seed) {
  let state = (Number(seed) >>> 0) || 0x6d2b79f5;
  return () => {
    let x = state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state = x >>> 0;
    return state / 4294967296;
  };
}
function dungeonV2ServerNormalizeContext(value) {
  if (!value || value.mode !== "dungeon") return null;
  const floor = Math.floor(Number(value.floor) || 0);
  if (floor < 1) return null;
  const role = dungeonV2ServerExpectedRole(floor);
  if (String(value.role || "") !== role) return null;
  const entries = Array.isArray(value.enemies) ? value.enemies : [];
  if (entries.length < 1 || entries.length > 3 || Number(value.packCount) !== entries.length) return null;
  if (role === "chapter_boss" && entries.length !== 1) return null;
  const allowedIds = role === "chapter_boss" ? DUNGEON_V2_BOSS_IDS : DUNGEON_V2_MONSTER_IDS;
  const enemies = entries.map((enemy, index) => ({
    id: String(enemy?.id || ""),
    instanceId: String(enemy?.instanceId || ""),
    modifierId: enemy?.modifierId == null ? null : String(enemy.modifierId),
    kind: role === "chapter_boss" ? "boss" : "monster",
    isBoss: role === "chapter_boss"
  }));
  if (enemies.some(enemy => !allowedIds.has(enemy.id) || !enemy.instanceId)) return null;
  if (enemies.some(enemy => enemy.modifierId !== null && (role !== "normal" || !DUNGEON_V2_MODIFIER_ID_LIST.includes(enemy.modifierId)))) return null;
  const encounterSeed = Number(value.encounterSeed) >>> 0;
  const rewardSeed = Number(value.rewardSeed) >>> 0;
  if (!encounterSeed || !rewardSeed) return null;
  return { version: 1, mode: "dungeon", floor, role, packCount: enemies.length, enemies, encounterSeed, rewardSeed };
}
function dungeonV2ServerContextFromStoredCheckpoint(payload) {
  return dungeonV2ServerNormalizeContext(payload?.serverContext);
}
function dungeonV2ServerCheckpointIdentityReason(payload, context) {
  if (!payload || !context || payload.mode !== "dungeon") return "mode";
  if (Math.floor(Number(payload.floor) || 0) !== context.floor) return "floor";
  if (payload.encounterType && String(payload.encounterType) !== context.role) return "encounter_type";

  const units = payload.units && typeof payload.units === "object" ? payload.units : {};
  const enemyIds = Array.isArray(payload.enemyIds) ? payload.enemyIds.map(String).filter(Boolean) : [];
  const expectedInstanceIds = context.enemies.map(enemy => enemy.instanceId);
  const expectedInstanceSet = new Set(expectedInstanceIds);

  // Battle Core guarantees server-issued enemy instance IDs. Definition aliases
  // are validation hints, not mandatory persistence fields on every checkpoint.
  if (enemyIds.length !== context.packCount || new Set(enemyIds).size !== enemyIds.length) return "enemy_ids_count_or_duplicate";
  if (enemyIds.some(id => !expectedInstanceSet.has(id))) return "enemy_id_not_authorized";
  if (expectedInstanceIds.some(id => !enemyIds.includes(id))) return "enemy_id_missing";

  const enemyLikeUnits = Object.values(units).filter(unit =>
    unit && (unit.side === "enemy" || unit.kind === "monster" || unit.kind === "boss")
  );
  if (enemyLikeUnits.length !== context.packCount) return "enemy_unit_count";
  if (enemyLikeUnits.some(unit => !expectedInstanceSet.has(String(unit.id || "")))) return "enemy_unit_not_authorized";

  for (const expected of context.enemies) {
    const unit = units[expected.instanceId];
    if (!unit || String(unit.id || "") !== expected.instanceId) return "enemy_unit_instance_id";

    const definitionAlias = unit.monsterDefId ?? unit.dungeonV2ProfileId;
    if (definitionAlias != null && String(definitionAlias) !== expected.id) return "enemy_definition";
    if (unit.encounterType && String(unit.encounterType) !== context.role) return "enemy_encounter_type";

    const hasBossMarker = unit.kind != null || unit.isBoss != null;
    if (hasBossMarker) {
      const bossLike = unit.kind === "boss" || unit.isBoss === true;
      if (context.role === "chapter_boss" ? !bossLike : bossLike) return "enemy_boss_marker";
    }
  }
  return null;
}
function dungeonV2ServerCheckpointIdentityMatches(payload, context) {
  return dungeonV2ServerCheckpointIdentityReason(payload, context) == null;
}
function dungeonV2ServerContextFromClientCheckpoint(payload) {
  const context = dungeonV2ServerNormalizeContext(payload?.serverContext);
  if (!context) return null;
  return dungeonV2ServerCheckpointIdentityReason(payload, context) == null ? context : null;
}
function dungeonV2ServerCheckpointValidationReason(payload) {
  const context = dungeonV2ServerNormalizeContext(payload?.serverContext);
  return context ? dungeonV2ServerCheckpointIdentityReason(payload, context) : "server_context";
}
function dungeonV2ServerContextsMatch(a, b) {
  return !!(a && b
    && a.mode === b.mode
    && a.floor === b.floor
    && a.role === b.role
    && a.packCount === b.packCount
    && a.encounterSeed === b.encounterSeed
    && a.rewardSeed === b.rewardSeed
    && JSON.stringify(a.enemies.map(enemy => [enemy.id, enemy.instanceId, enemy.modifierId]))
      === JSON.stringify(b.enemies.map(enemy => [enemy.id, enemy.instanceId, enemy.modifierId])));
}
function dungeonV2ServerEncounterContext(characterId, floor, ordinal) {
  const role = dungeonV2ServerExpectedRole(floor);
  const encounterSeed = dungeonV2ServerHash(`encounter:${characterId}:${floor}:${ordinal}:v1`) || 1;
  const rewardSeed = dungeonV2ServerHash(`reward:${characterId}:${floor}:${ordinal}:v1`) || 1;
  const rng = dungeonV2ServerRng(encounterSeed);
  const packCount = role !== "normal" || floor < 5 ? 1 : (() => {
    const roll = rng();
    return roll < 0.45 ? 1 : roll < 0.8 ? 2 : 3;
  })();
  const pool = role === "chapter_boss" ? DUNGEON_V2_BOSS_ID_LIST : DUNGEON_V2_MONSTER_ID_LIST;
  const enemies = Array.from({ length: packCount }, (_, index) => {
    const id = pool[Math.floor(rng() * pool.length)] || pool[0];
    const modifierId = role === "normal" && rng() < 0.4
      ? DUNGEON_V2_MODIFIER_ID_LIST[Math.floor(rng() * DUNGEON_V2_MODIFIER_ID_LIST.length)]
      : null;
    return {
      id,
      instanceId: `dungeon-enemy-${index + 1}-${dungeonV2ServerHash(`${encounterSeed}:${id}:${index}`)}`,
      modifierId,
      kind: role === "chapter_boss" ? "boss" : "monster",
      isBoss: role === "chapter_boss"
    };
  });
  return { version: 1, mode: "dungeon", floor, role, packCount, enemies, encounterSeed, rewardSeed };
}
async function handleGetDungeonEncounterPreview(db, id, session, characterId, requestedFloor) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const floor = Math.floor(Number(requestedFloor) || 0);
  const unlockedFloor = Math.max(1, Math.floor(Number(owned.row.unlocked_floor) || 1));
  if (floor < 1 || floor > unlockedFloor) return json({ error: "dungeon_floor_locked" }, 403);

  const existing = await db.prepare(
    `SELECT battle_id, payload_json FROM battle_checkpoints WHERE character_id = ? AND state = 'active' LIMIT 1`
  ).bind(characterId).first();
  if (existing) {
    const payload = parseJsonColumn(existing.payload_json, null);
    const context = dungeonV2ServerContextFromStoredCheckpoint(payload);
    if (payload?.authorizationOnly && context && context.floor === floor) {
      return json({ ok: true, context });
    }
    // Preview is read-only: an in-progress battle must not make the floor preview
    // unreadable. The actual start endpoint remains responsible for rejecting a
    // second live battle with the existing active-battle guard.
  }
  const completed = await db.prepare(
    `SELECT COUNT(*) AS c FROM battle_completions WHERE character_id = ?`
  ).bind(characterId).first();
  const ordinal = Math.max(1, (Number(completed?.c) || 0) + 1);
  return json({
    ok: true,
    context: dungeonV2ServerEncounterContext(characterId, floor, ordinal)
  });
}

async function handleStartDungeonBattle(db, id, session, characterId, requestedFloor, previewContext = null) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const floor = Math.floor(Number(requestedFloor) || 0);
  const unlockedFloor = Math.max(1, Math.floor(Number(owned.row.unlocked_floor) || 1));
  if (floor < 1 || floor > unlockedFloor) return json({ error: "dungeon_floor_locked" }, 403);

  const existing = await db.prepare(
    `SELECT battle_id, payload_json FROM battle_checkpoints WHERE character_id = ? AND state = 'active' LIMIT 1`
  ).bind(characterId).first();
  if (existing) {
    const payload = parseJsonColumn(existing.payload_json, null);
    const context = dungeonV2ServerContextFromStoredCheckpoint(payload);
    if (payload?.authorizationOnly && context && context.floor === floor) {
      return json({ ok: true, battleId: existing.battle_id, context });
    }
    if (!payload?.authorizationOnly) return json({ error: "active_battle_conflict", battleId: existing.battle_id }, 409);
    await db.prepare(`UPDATE battle_checkpoints SET state = 'closed', updated_at = ? WHERE battle_id = ? AND character_id = ? AND state = 'active'`)
      .bind(nowIso(), existing.battle_id, characterId).run();
  }

  const completed = await db.prepare(`SELECT COUNT(*) AS c FROM battle_completions WHERE character_id = ?`).bind(characterId).first();
  const ordinal = Math.max(1, (Number(completed?.c) || 0) + 1);
  const context = dungeonV2ServerEncounterContext(characterId, floor, ordinal);
  if (previewContext != null) {
    const suppliedContext = dungeonV2ServerNormalizeContext(previewContext);
    if (!suppliedContext || !dungeonV2ServerContextsMatch(suppliedContext, context)) {
      return json({ error: "dungeon_preview_stale", context }, 409);
    }
  }
  const battleId = `dungeon-${randomToken(16)}`;
  const now = nowIso();
  const authorization = JSON.stringify({
    version: 1,
    battleId,
    mode: "dungeon",
    floor,
    encounterType: context.role,
    safeActionSeq: -1,
    authorizationOnly: true,
    serverContext: context
  });
  try {
    await db.prepare(
      `INSERT INTO battle_checkpoints (battle_id, character_id, checkpoint_seq, payload_json, state, created_at, updated_at)
       VALUES (?, ?, -1, ?, 'active', ?, ?)`
    ).bind(battleId, characterId, authorization, now, now).run();
  } catch (error) {
    const raced = await db.prepare(
      `SELECT battle_id, payload_json FROM battle_checkpoints WHERE character_id = ? AND state = 'active' LIMIT 1`
    ).bind(characterId).first();
    const racedPayload = parseJsonColumn(raced?.payload_json, null);
    const racedContext = dungeonV2ServerContextFromStoredCheckpoint(racedPayload);
    if (racedPayload?.authorizationOnly && racedContext && racedContext.floor === floor) {
      return json({ ok: true, battleId: raced.battle_id, context: racedContext });
    }
    return json({ error: "active_battle_conflict" }, 409);
  }
  return json({ ok: true, battleId, context });
}
function dungeonV2ServerRollRarity(floor, rng) {
  const band = DUNGEON_V2_REWARD_RARITY_BANDS.find(item => floor >= item.min && floor <= item.max) || DUNGEON_V2_REWARD_RARITY_BANDS.at(-1);
  const roll = rng() * 100;
  if (roll < band.weights.rare) return "rare";
  if (roll < band.weights.rare + band.weights.unique) return "unique";
  return "elite";
}
function dungeonV2ServerDropBonus(ownedRow, equippedRows) {
  let bonus = Math.round((Number(ownedRow?.luk) || 0) * 0.2 * 10) / 10;
  for (const row of equippedRows || []) {
    const extra = parseJsonColumn(row.extra_json, {});
    bonus += Number(extra.dropBonus) || 0;
    for (const slot of Array.isArray(extra.empowerSlots) ? extra.empowerSlots : []) {
      if (slot?.key === "dropBonus") bonus += Number(slot.value) || 0;
    }
  }
  return Math.max(0, Math.round(bonus * 10) / 10);
}
async function dungeonV2ServerLootRows(db, monsterIds) {
  const ids = [...new Set((monsterIds || []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  try {
    const placeholders = ids.map(() => "?").join(",");
    const result = await db.prepare(
      `SELECT monster_id, kind, item_type, rarity, junk_id, qty_min, qty_max, weight, drop_chance
       FROM monster_loot WHERE monster_id IN (${placeholders})`
    ).bind(...ids).all();
    return result.results || [];
  } catch (e) {
    // Older QA schemas may not have the optional loot table. Generic V2 fallback remains valid.
    return [];
  }
}
function dungeonV2ServerCanonicalEquipment({ battleId, floor, type, rarity, sourceType, sourceFloor, specialSource, sourceIdentity, rng, utilityKey }) {
  const tier = dungeonV2ServerTierForFloor(floor);
  const multiplier = DUNGEON_V2_REWARD_RARITY_MULT[rarity];
  const capacity = DUNGEON_V2_REWARD_EMPOWER_SLOTS[rarity];
  const item = {
    id: `v2-${dungeonV2ServerHash(`${battleId}:${type}:${sourceType}:${sourceIdentity || ""}`)}`,
    type,
    rarity,
    name: (DUNGEON_V2_REWARD_NAMES[type] || DUNGEON_V2_REWARD_NAMES.weapon)[tier - 1],
    gearTier: tier,
    rewardVersion: 2,
    itemModelVersion: 2,
    empowerSlotCapacity: capacity,
    empowerSlotCount: capacity,
    empowerSlots: globalThis.ENHANCEMENT_V2?.fillEmpowerSlots
      ? globalThis.ENHANCEMENT_V2.fillEmpowerSlots(type, rarity, rng)
      : Array(capacity).fill(null),
    sourceType,
    sourceFloor,
    specialSource: specialSource || undefined,
    sourceIdentity: sourceIdentity || undefined
  };
  if (type === "accessory") {
    const keys = ["critChance", "dodgeChance", "critDamage"];
    const key = keys.includes(utilityKey) ? utilityKey : keys[Math.floor(rng() * keys.length)];
    item.utilityStat = key;
    item[key] = Math.round(DUNGEON_V2_ACCESSORY_BASE[key] * DUNGEON_V2_REWARD_TIER_MULT[tier - 1] * multiplier * 10) / 10;
    return item;
  }
  const stat = Math.max(1, Math.round(DUNGEON_V2_REWARD_BASE_STATS[type][tier - 1] * DUNGEON_V2_REWARD_TIER_MULT[tier - 1] * multiplier));
  if (type === "weapon" || type === "gloves") item.atk = stat;
  else item.def = stat;
  return item;
}
function dungeonV2ServerPickWeighted(rows, rng) {
  const valid = (rows || []).filter(row => DUNGEON_V2_REWARD_SLOTS.has(String(row.item_type || "")) && (!row.rarity || DUNGEON_V2_REWARD_RARITIES.has(String(row.rarity))) && Number(row.weight || 0) > 0);
  if (!valid.length) return null;
  const total = valid.reduce((sum, row) => sum + Number(row.weight || 0), 0);
  let roll = rng() * total;
  for (const row of valid) {
    roll -= Number(row.weight || 0);
    if (roll < 0) return row;
  }
  return valid.at(-1);
}
function dungeonV2ServerJunkItem(battleId, junkId, quantity, index, sourceType = "dungeon", sourceFloor = 0, sourceIdentity = null) {
  const id = `junk-${dungeonV2ServerHash(`${battleId}:${sourceType}:${junkId}:${index}`)}`;
  const meta = DUNGEON_V2_REWARD_JUNK_META[junkId] || [junkId, "📦"];
  return { id, type: "junk", junkId, name: meta[0], icon: meta[1], quantity: Math.max(1, Math.floor(Number(quantity) || 1)), sourceType, sourceFloor, sourceIdentity };
}
function dungeonV2ServerGenericJunk(rng, floor) {
  const junkId = DUNGEON_V2_REWARD_JUNK_IDS[Math.floor(rng() * DUNGEON_V2_REWARD_JUNK_IDS.length)];
  const quantity = 1 + Math.floor(floor / 12) + (rng() < 0.25 ? 1 : 0);
  return { junkId, quantity };
}
async function dungeonV2ServerRewardPlan(db, id, characterId, battleId, context, ownedRow, checkpointPayload) {
  // The reward seed is issued and persisted by startDungeonBattle. It is not
  // derived from a client-selected battle id or mutable checkpoint fields.
  const seed = context.rewardSeed;
  const rng = dungeonV2ServerRng(seed);
  const lootIds = [...new Set((context.enemies || []).map(enemy => String(enemy.id || "")).filter(Boolean))];
  const lootPlaceholders = lootIds.length ? lootIds.map(() => "?").join(",") : "NULL";
  let rewardReadBatch;
  try {
    rewardReadBatch = await db.batch([
      db.prepare(`SELECT extra_json FROM items WHERE character_id = ? AND equipped = 1`).bind(characterId),
      db.prepare(
        `SELECT monster_id, kind, item_type, rarity, junk_id, qty_min, qty_max, weight, drop_chance
         FROM monster_loot WHERE monster_id IN (${lootPlaceholders})`
      ).bind(...lootIds),
      db.prepare(`SELECT * FROM items WHERE player_id = ? AND character_id = ? ORDER BY rowid, item_id`).bind(id, characterId)
    ]);
  } catch (_) {
    rewardReadBatch = [rewardReadBatch?.[0] || { results: [] }, { results: [] }, { results: [] }];
  }
  const equippedRows = rewardReadBatch?.[0]?.results || [];
  const dropBonus = dungeonV2ServerDropBonus(ownedRow, equippedRows);
  const lootRows = rewardReadBatch?.[1]?.results || [];
  const inventoryPlan = await loadMailSettlementState(db, id, characterId, null, {
    reconcile: false,
    prefetchedRows: rewardReadBatch?.[2]?.results || []
  });
  console.log("DUNGEON_REWARD_INVENTORY_PLAN", JSON.stringify({
    prefetched: rewardReadBatch?.[2]?.results?.length || 0,
    carried: inventoryPlan.carried.length,
    overflow: inventoryPlan.overflow.length,
    equipped: inventoryPlan.equipped.length
  }));
  const rowsByMonster = lootRows.reduce((out, row) => ((out[String(row.monster_id)] ||= []).push(row), out), {});
  const items = [];
  let drop = null;
  const rollEquipment = (sourceIdentity, rollIndex) => {
    const chance = context.role === "elite" ? 0.08 : 0.04 * (1 + dropBonus / 100);
    if (rng() >= Math.min(1, chance)) return null;
    const custom = dungeonV2ServerPickWeighted((rowsByMonster[sourceIdentity] || []).filter(row => row.kind === "gear"), rng);
    const type = custom?.item_type || DUNGEON_V2_REWARD_SLOTS.values().next().value;
    const rarity = dungeonV2ServerRollRarity(context.floor, rng);
    return dungeonV2ServerCanonicalEquipment({
      battleId: `${battleId}:${rollIndex}`, floor: context.floor, type, rarity,
      sourceType: context.role === "elite" ? "dungeon_elite" : "dungeon_normal",
      sourceFloor: context.floor, sourceIdentity, rng
    });
  };
  if (context.role === "normal") {
    for (const enemy of context.enemies) {
      if (!drop) drop = rollEquipment(enemy.id, items.length);
      if (rng() < 0.45) {
        const generic = dungeonV2ServerGenericJunk(rng, context.floor);
        items.push(dungeonV2ServerJunkItem(battleId, generic.junkId, generic.quantity, items.length));
      }
    }
  } else if (context.role === "elite") {
    drop = rollEquipment(context.enemies[0].id, items.length);
    if (rng() < 0.45) {
      const generic = dungeonV2ServerGenericJunk(rng, context.floor);
      generic.quantity = Math.max(1, Math.round(generic.quantity * 2));
      items.push(dungeonV2ServerJunkItem(battleId, generic.junkId, generic.quantity, items.length, "dungeon_elite"));
    }
  }
  if (context.role === "chapter_boss") {
    const bossId = context.enemies[0]?.id;
    const stone = globalThis.MYTHIC_V2.bossStoneForEnemy(bossId);
    if (stone) items.push(dungeonV2ServerJunkItem(battleId, stone.junkId, 1 + (rng() < 0.25 ? 1 : 0), items.length, "chapter_boss_stone", context.floor, bossId));
  }
  if (drop) { items.push(drop); }
  for (const enemy of context.enemies) {
    for (const row of (rowsByMonster[enemy.id] || []).filter(entry => entry.kind === "junk" && DUNGEON_V2_REWARD_JUNK_IDS.includes(String(entry.junk_id || "")))) {
      if (rng() >= Math.max(0, Math.min(1, Number(row.drop_chance) || 0))) continue;
      const min = Math.max(1, Math.floor(Number(row.qty_min) || 1));
      const max = Math.max(min, Math.floor(Number(row.qty_max) || min));
      const quantity = min + Math.floor(rng() * (max - min + 1));
      items.push(dungeonV2ServerJunkItem(battleId, String(row.junk_id), quantity, items.length, "monster_loot"));
    }
  }
  const unlockedNext = context.floor === Number(ownedRow.unlocked_floor || 1);
  const claims = dungeonV2ServerClaims(parseJsonColumn(ownedRow.pets_json, []));
  const accessoryContract = DUNGEON_V2_FIRST_CLEAR_ACCESSORIES[context.floor];
  const firstClear = context.role === "chapter_boss" && !!accessoryContract && unlockedNext && !claims[String(context.floor)];
  if (firstClear) {
    const boss = context.enemies[0];
    const accessory = dungeonV2ServerCanonicalEquipment({
      battleId: `${battleId}:first-clear`, floor: context.floor, type: "accessory", rarity: accessoryContract.rarity,
      sourceType: "dungeon_boss_first_clear", sourceFloor: context.floor, specialSource: "first_clear_accessory",
      sourceIdentity: boss.id, rng
    });
    items.push(accessory);
    drop = accessory;
  }
  const starterEligible = context.floor === 5 && context.role === "elite" && unlockedNext
    && !((Array.isArray(parseJsonColumn(ownedRow.pets_json, [])) ? parseJsonColumn(ownedRow.pets_json, []) : parseJsonColumn(ownedRow.pets_json, {}).list || []).some(pet => pet && pet.defId === "sprout"));
  const starterPetGrant = starterEligible ? {
    defId: "sprout",
    instance: {
      instId: `pet-${dungeonV2ServerHash(`${battleId}:sprout`)}`,      defId: "sprout", level: 1, xp: 0, star: 1,
      stats: { str: 3, vit: 5, agi: 4, dex: 4, luk: 4 }
    }
  } : null;
  const junkSummary = {};
  items.filter(item => item.type === "junk").forEach(item => { junkSummary[item.junkId] = (junkSummary[item.junkId] || 0) + item.quantity; });
  const [junkType, junkAmount] = Object.entries(junkSummary)[0] || [];
  const result = {
    floor: context.floor, encounterType: context.role, rewardRole: context.role, packCount: context.packCount,
    gold: dungeonV2ServerGold(context.floor, context.role, context.packCount),
    xp: dungeonV2ServerExp(context.floor, context.role, context.packCount),
    diamonds: 0, unlockedNext, firstClear, starterPetGrant, items,
    drop, junkDrop: junkType ? { type: junkType, amount: junkAmount } : null,
    sourceIdentity: context.enemies[0]?.id || null, rewardSeed: seed
  };
  Object.defineProperty(result, "__inventoryPlan", { value: inventoryPlan, enumerable: false });
  return result;
}
function dungeonV2ServerClaims(petsRaw) {
  const object = Array.isArray(petsRaw) ? {} : (petsRaw && typeof petsRaw === "object" ? petsRaw : {});
  const claims = { ...(object.firstClearAccessoryClaims || {}) };
  (Array.isArray(object.rewardReceipts) ? object.rewardReceipts : []).forEach(key => {
    const match = String(key).match(/^first-clear-accessory:(\d+)$/);
    if (match) claims[match[1]] = true;
  });
  return Object.fromEntries(Object.entries(claims).filter(([floor, value]) => /^\d+$/.test(floor) && value === true));
}
function dungeonV2ServerRewardItem(item, index, overflow) {
  if (!item || typeof item !== "object") return null;
  const id = String(item.id || `v2-reward-${Date.now()}-${index}`).slice(0, 160);
  const type = String(item.type || "");
  if (type === "junk") {
    const junkId = String(item.junkId || "").slice(0, 80);
    if (!junkId) return null;
    return {
      item_id: id, slot_type: "junk", equipped: 0, inventory_slot: "", item_template_id: "",
      rarity: "common", name: String(item.name || junkId).slice(0, 160), item_level: 0, enhance_level: 0,
      bound: 0, quantity: Math.max(1, Number(item.quantity) || 1), atk: 0, def: 0, hp: 0, mp: 0,
      extra_json: JSON.stringify({ junkId, quantity: Math.max(1, Number(item.quantity) || 1), icon: item.icon || "📦", overflow: !!overflow,
        sourceType: item.sourceType || undefined, sourceFloor: Number(item.sourceFloor) || undefined, sourceIdentity: item.sourceIdentity || undefined }),
    };
  }
  if (!(DUNGEON_V2_REWARD_SLOTS.has(type) || type === "accessory")) return null;
  if (!DUNGEON_V2_REWARD_RARITIES.has(item.rarity) || Number(item.rewardVersion) !== 2 || Number(item.itemModelVersion) !== 2) return null;
  const extra = {
    empowerSlots: Array.isArray(item.empowerSlots) ? item.empowerSlots : [],
    empowerSlotCapacity: Math.max(0, Number(item.empowerSlotCapacity) || 0),
    rewardVersion: 2, itemModelVersion: 2, ...(type === "wings" ? {} : { gearTier: Math.max(1, Math.min(5, Number(item.gearTier) || 1)) }),
    sourceType: String(item.sourceType || "dungeon").slice(0, 80), sourceFloor: Number(item.sourceFloor) || 0,
    specialSource: item.specialSource ? String(item.specialSource).slice(0, 80) : undefined,
    sourceIdentity: item.sourceIdentity ? String(item.sourceIdentity).slice(0, 120) : undefined,
    utilityStat: item.utilityStat ? String(item.utilityStat).slice(0, 40) : undefined,
    wingFamily: type === "wings" ? String(item.wingFamily || item.setId || "").toLowerCase() : undefined,
    critChance: item.critChance || undefined, dodgeChance: item.dodgeChance || undefined, critDamage: item.critDamage || undefined,
    overflow: !!overflow
  };
  return {
    item_id: id, slot_type: type, equipped: 0, inventory_slot: "", item_template_id: "", rarity: item.rarity,
    name: String(item.name || type).slice(0, 160), item_level: 0, enhance_level: 0, bound: 0, quantity: 1,
    atk: Number(item.atk) || 0, def: Number(item.def) || 0, hp: Number(item.hp) || 0, mp: Number(item.mp) || 0,
    extra_json: JSON.stringify(extra)
  };
}
// Character XP is persisted authoritatively here so reward snapshots cannot roll level back.
  // The first server-granted starter pet is also auto-equipped here so the active slot survives reload.
const DUNGEON_CHARACTER_MAX_LEVEL = 99;
function dungeonV2CharacterXpToNext(level) {
  return Math.max(1, Math.floor(Number(level) || 1)) * 22 + 18;
}
function dungeonV2ApplyCharacterXp(level, xp, statPoints, gained) {
  let nextLevel = Math.max(1, Math.min(DUNGEON_CHARACTER_MAX_LEVEL, Math.floor(Number(level) || 1)));
  let nextXp = Math.max(0, Number(xp) || 0) + Math.max(0, Number(gained) || 0);
  let nextStatPoints = Math.max(0, Number(statPoints) || 0);
  const levelBefore = nextLevel;
  while (nextLevel < DUNGEON_CHARACTER_MAX_LEVEL && nextXp >= dungeonV2CharacterXpToNext(nextLevel)) {
    nextXp -= dungeonV2CharacterXpToNext(nextLevel);
    nextLevel += 1;
    nextStatPoints += 5;
  }
  if (nextLevel >= DUNGEON_CHARACTER_MAX_LEVEL) nextXp = 0;
  return {
    level: nextLevel,
    xp: Math.max(0, nextXp),
    statPoints: nextStatPoints,
    levelBefore,
    levelAfter: nextLevel,
    leveledUp: nextLevel > levelBefore,
  };
}
function dungeonV2PetXpToNext(level) {
  const lv = Math.max(1, Math.min(49, Math.floor(Number(level) || 1)));
  return Math.round(34 + 6 * lv + 0.32 * lv * lv);
}
function dungeonV2GrantActivePetXp(list, activePetId, battleXp) {
  const active = (list || []).find(pet => pet?.instId === activePetId);
  if (!active || Number(active.level) >= 50) return { list: list || [], progress: null };
  const before = { level: Math.max(1, Number(active.level) || 1), xp: Math.max(0, Number(active.xp) || 0) };
  const gained = Math.max(0, Math.round((Number(battleXp) || 0) * 0.8));
  let level = before.level, xp = before.xp + gained;
  while (level < 50 && xp >= dungeonV2PetXpToNext(level)) { xp -= dungeonV2PetXpToNext(level); level += 1; }
  if (level >= 50) xp = 0;
  const next = (list || []).map(pet => pet?.instId === activePetId ? { ...pet, level, xp } : pet);
  return { list: next, progress: { instId: activePetId, defId: active.defId, xpGained: gained, levelBefore: before.level, levelAfter: level, xpBefore: before.xp, xpAfter: xp } };
}
async function commitDungeonRewardInBattleTransaction(db, id, characterId, battleId, resultPayload, ownedRow, checkpointPayload, context, now) {
  const reward = resultPayload?.reward;
  if (!reward || resultPayload.result !== "victory") return { reward: null, committed: false };
  if (!context || Number(resultPayload.floor) !== context.floor) return { error: "invalid_battle_context" };
  if (Number(reward.floor) !== context.floor || String(reward.rewardRole || "") !== context.role
      || String(reward.encounterType || context.role) !== context.role || Number(reward.packCount) !== context.packCount) {
    return { error: "invalid_reward_context" };
  }
  const rewardPlan = await dungeonV2ServerRewardPlan(db, id, characterId, battleId, context, ownedRow, checkpointPayload);
  const inventoryPlan = rewardPlan?.__inventoryPlan;
  const serverReward = rewardPlan;
  if (!inventoryPlan || Number(reward.gold) !== serverReward.gold || Number(reward.xp) !== serverReward.xp) return { error: "invalid_reward_plan" };
  const petsRaw = parseJsonColumn(ownedRow.pets_json, []);
  const envelope = Array.isArray(petsRaw) ? { list: petsRaw } : { ...petsRaw };
  if (!Array.isArray(envelope.list)) envelope.list = [];
  const petXp = dungeonV2GrantActivePetXp(envelope.list, ownedRow.active_pet_id, serverReward.xp);
  envelope.list = petXp.list;
  const claims = dungeonV2ServerClaims(petsRaw);
  const firstClear = serverReward.firstClear;
  const starterGrant = serverReward.starterPetGrant;
  if (starterGrant) envelope.list.push(starterGrant.instance);
  const nextClaims = firstClear ? { ...claims, [String(context.floor)]: true } : claims;
  const battleKey = `battle:${String(battleId)}`;
  const oldBattleReceipts = Array.isArray(envelope.battleRewardReceipts) ? envelope.battleRewardReceipts : [];
  const battleReceipts = [...new Set([...oldBattleReceipts.filter(Boolean), battleKey])].slice(-128);
  envelope.firstClearAccessoryClaims = nextClaims;
  envelope.battleRewardReceipts = battleReceipts;
  envelope.rewardReceipts = battleReceipts;
  const characterProgress = dungeonV2ApplyCharacterXp(
    ownedRow.level,
    ownedRow.xp,
    ownedRow.stat_points,
    serverReward.xp
  );
  const normalizedReward = {
    ...serverReward,
    battleId,
    starterPetGrant: starterGrant || null,
    petProgress: petXp.progress,
    levelBefore: characterProgress.levelBefore,
    levelAfter: characterProgress.levelAfter,
    leveledUp: characterProgress.leveledUp,
  };
  const encoded = JSON.stringify({ ...resultPayload, floor: context.floor, reward: normalizedReward });
  if (encoded.length > 512000) return { error: "battle_result_too_large" };
  const rows = serverReward.items.map((item, index) => dungeonV2ServerRewardItem(item, index, false)).filter(Boolean);
  if (rows.length !== serverReward.items.length) return { error: "invalid_reward_plan" };
  rows.forEach(row => {
    const rewardMeta = parseJsonColumn(row.extra_json, {});
    const isJunk = row.slot_type === "junk";
    inventoryPlanAddRow(inventoryPlan, row, {
      originType: isJunk ? "dungeon_junk" : (rewardMeta.sourceType || "dungeon_reward"),
      sourceId: isJunk ? battleId : (rewardMeta.sourceIdentity || battleId),
      context: { battleId, sourceFloor: context.floor }
    });
  });
  reconcileMailOverflow(inventoryPlan);
  const completionStmt = db.prepare(
    `INSERT INTO battle_completions (battle_id, character_id, result_json, completed_at) VALUES (?, ?, ?, ?) ON CONFLICT(battle_id) DO NOTHING`
  ).bind(String(battleId), characterId, encoded, now);
  const characterStmt = db.prepare(
    `UPDATE characters SET gold = gold + ?, level = ?, xp = ?, stat_points = ?, unlocked_floor = CASE WHEN ? THEN unlocked_floor + 1 ELSE unlocked_floor END, pets_json = ?, active_pet_id = CASE WHEN (active_pet_id IS NULL OR active_pet_id = '') AND ? != '' THEN ? ELSE active_pet_id END, updated_at = ? WHERE character_id = ? AND changes() > 0`
  ).bind(
    Number(normalizedReward.gold),
    characterProgress.level,
    characterProgress.xp,
    characterProgress.statPoints,
    normalizedReward.unlockedNext ? 1 : 0,
    JSON.stringify(envelope),
    starterGrant?.instance?.instId || "",
    starterGrant?.instance?.instId || "",
    now,
    characterId
  );
  // Dungeon V2 currently has no approved Diamond reward source. The server plan is
  // deliberately zero and never reads reward.diamonds from the client.
  const playerStmt = db.prepare(`UPDATE players SET diamonds = diamonds + 0 WHERE id = ? AND changes() > 0`).bind(id);
  const itemStatements = mailPlanPersistenceStatements(db, inventoryPlan, id, characterId, now, "changes() > 0", []);
  const completionReadIndex = 3 + itemStatements.length;
  const snapshotIndex = completionReadIndex + 1;
  const finalStatements = [
    completionStmt,
    characterStmt,
    playerStmt,
    ...itemStatements,
    db.prepare(`SELECT character_id, result_json, completed_at FROM battle_completions WHERE battle_id = ?`).bind(String(battleId)),
    db.prepare(`UPDATE battle_checkpoints SET state = 'completed', updated_at = ? WHERE battle_id = ? AND character_id = ?`).bind(now, String(battleId), characterId),
    ...battleCompletionSnapshotStatements(db, id, characterId)
  ];
  const batchResult = await db.batch(finalStatements);
  const committed = Number(batchResult?.[0]?.meta?.changes) > 0;
  const completionRow = batchResult?.[completionReadIndex]?.results?.[0] || null;
  const snapshot = battleCompletionSnapshotFromBatch(batchResult, snapshotIndex);
  return { completionEncoded: encoded, reward: committed ? normalizedReward : null, committed, completionRow, snapshot };
}
function battleCompletionSnapshotStatements(db, id, characterId) {
  return [
    db.prepare(`SELECT * FROM characters WHERE character_id = ?`).bind(characterId),
    db.prepare(`SELECT * FROM items WHERE character_id = ?`).bind(characterId),
    db.prepare(`SELECT diamonds FROM players WHERE id = ?`).bind(id)
  ];
}
function battleCompletionSnapshotFromBatch(batch, offset = 0) {
  const character = batch?.[offset]?.results?.[0] || null;
  const items = batch?.[offset + 1]?.results || [];
  const player = batch?.[offset + 2]?.results?.[0] || null;
  return { character, items, diamonds: Number(player?.diamonds) || 0 };
}
async function battleCompletionSnapshot(db, id, characterId) {
  const batch = await db.batch(battleCompletionSnapshotStatements(db, id, characterId));
  return battleCompletionSnapshotFromBatch(batch);
}
function itemProvenanceStatement(db, itemId, playerId, characterId, originType, originSourceId, context, timestamp, gateSql = null, gateBinds = []) {
  const gate = gateSql ? ` WHERE ${gateSql}` : "";
  return db.prepare(`INSERT OR IGNORE INTO item_provenance
    (item_id, original_player_id, original_character_id, origin_type, origin_source_id, origin_context_json, created_at, acquired_at, tradeable, bound)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, 0, 0${gate}`)
    .bind(itemId, playerId, characterId, String(originType || "unknown").slice(0, 80), originSourceId ? String(originSourceId).slice(0, 160) : null,
      JSON.stringify(context || {}), timestamp, timestamp, ...gateBinds);
}
function itemOwnershipAcquireStatement(db, itemId, playerId, characterId, originType, context, timestamp, gateSql = null, gateBinds = []) {
  const gate = gateSql ? ` WHERE ${gateSql}` : "";
  return db.prepare(`INSERT OR IGNORE INTO item_ownership_events
    (event_id, item_id, from_player_id, from_character_id, to_player_id, to_character_id, event_type, context_json, occurred_at)
    SELECT ?, ?, NULL, NULL, ?, ?, 'acquire', ?, ?${gate}`)
    .bind(`acquire-${String(itemId).slice(0, 180)}`, itemId, playerId, characterId, JSON.stringify({ originType, ...(context || {}) }), timestamp, ...gateBinds);
}
// Mail claim credits are derived only from the persisted mailbox row. The claim token
// gates each credit statement, and callers include these statements in the same D1
// batch as the claimed marker so disconnects and concurrent retries cannot split them.
const MAIL_INVENTORY_CAPACITY = 30;
const MAIL_STACK_MAX = 99;

function mailStackKey(slotType, extra) {
  if (slotType === "junk" && extra?.junkId) return `junk:${String(extra.junkId)}`;
  if (slotType === "potion" && extra?.potionId) return `potion:${String(extra.potionId)}`;
  return "";
}

function mailQuantity(entry) {
  const quantity = Number(entry?.extra?.quantity);
  return Number.isFinite(quantity) && quantity > 0 ? Math.trunc(quantity) : 1;
}

function mailEntryIsEquipped(entry) {
  return Number(entry?.raw?.equipped) === 1 || entry?.raw?.equipped === true;
}

function mailEntryIsOverflow(entry) {
  return entry?.extra?.overflow === true || entry?.extra?.overflow === 1 || entry?.extra?.overflow === "1";
}

function mailPlanLists(plan) {
  const active = plan.entries.filter(entry => !entry.deleted);
  plan.carried = active.filter(entry => !mailEntryIsEquipped(entry) && !mailEntryIsOverflow(entry));
  plan.overflow = active.filter(entry => !mailEntryIsEquipped(entry) && mailEntryIsOverflow(entry));
  plan.equipped = active.filter(mailEntryIsEquipped);
}

function mailMergeInto(entries, key, quantity) {
  let remaining = Math.max(0, Math.trunc(Number(quantity) || 0));
  if (!key || !remaining) return remaining;
  for (const entry of entries) {
    if (remaining <= 0 || mailStackKey(entry.raw.slot_type, entry.extra) !== key) continue;
    const current = mailQuantity(entry);
    const add = Math.min(Math.max(0, MAIL_STACK_MAX - current), remaining);
    if (add <= 0) continue;
    entry.extra.quantity = current + add;
    entry.changed = true;
    remaining -= add;
  }
  return remaining;
}

function mailNewEntry(item, itemId, overflow, quantity, extra, origin) {
  const slotType = String(item?.type || "junk");
  return {
    raw: {
      item_id: itemId, slot_type: slotType, equipped: 0, inventory_slot: "", item_template_id: "",
      rarity: slotType === "junk" || slotType === "potion" ? "common" : String(item?.rarity || "common").slice(0, 40),
      name: String(item?.name || item?.junkId || item?.potionId || slotType).slice(0, 160),
      item_level: 0, enhance_level: 0, bound: 0, quantity: 1,
      atk: Number(item?.atk) || 0, def: Number(item?.def) || 0, hp: Number(item?.hp) || 0, mp: Number(item?.mp) || 0
    },
    extra: { ...(extra || {}), quantity: Math.max(1, Math.trunc(Number(quantity) || 1)), overflow: !!overflow },
    new: true, changed: true, origin
  };
}

// Canonical server-side Inventory V2 capacity planner.  Mail introduced this
// planner first; all authoritative acquisition paths use the same row-based
// planner so capacity is derived from authenticated persisted state rather
// than raw item-row counts or client presentation data.
function inventoryPlanEntryFromRow(row, overflow, origin) {
  const parsed = parseJsonColumn(row?.extra_json, {});
  const extra = parsed && typeof parsed === "object" ? { ...parsed } : {};
  extra.quantity = Math.max(1, Math.trunc(Number(extra.quantity) || Number(row?.quantity) || 1));
  extra.overflow = !!overflow;
  return {
    raw: { ...row, equipped: 0, quantity: Number(row?.quantity) || 1 },
    extra,
    new: true,
    changed: true,
    deleted: false,
    origin
  };
}

function inventoryPlanLists(plan) {
  mailPlanLists(plan);
  return plan;
}

function inventoryPlanAddRow(plan, row, origin) {
  if (!row || typeof row !== "object") return;
  const parsed = parseJsonColumn(row.extra_json, {});
  const extra = parsed && typeof parsed === "object" ? { ...parsed } : {};
  const quantity = Math.max(1, Math.trunc(Number(extra.quantity) || Number(row.quantity) || 1));
  const key = mailStackKey(String(row.slot_type || ""), extra);
  if (key) {
    let remaining = mailMergeInto(plan.carried, key, quantity);
    if (remaining > 0 && plan.carried.length < MAIL_INVENTORY_CAPACITY) {
      const chunk = Math.min(MAIL_STACK_MAX, remaining);
      plan.entries.push(inventoryPlanEntryFromRow({ ...row, quantity: 1, extra_json: JSON.stringify(extra) }, false, origin));
      const entry = plan.entries[plan.entries.length - 1];
      entry.extra.quantity = chunk;
      remaining -= chunk;
      inventoryPlanLists(plan);
    }
    if (remaining > 0) remaining = mailMergeInto(plan.overflow, key, remaining);
    let part = 1;
    while (remaining > 0) {
      const chunk = Math.min(MAIL_STACK_MAX, remaining);
      const partRow = { ...row, item_id: `${row.item_id}-part-${part++}`, quantity: 1, extra_json: JSON.stringify(extra) };
      const entry = inventoryPlanEntryFromRow(partRow, true, origin);
      entry.extra.quantity = chunk;
      plan.entries.push(entry);
      remaining -= chunk;
      inventoryPlanLists(plan);
    }
    return;
  }
  plan.entries.push(inventoryPlanEntryFromRow(row, plan.carried.length >= MAIL_INVENTORY_CAPACITY, origin));
  inventoryPlanLists(plan);
}

function inventoryPlanRemoveItem(plan, itemId) {
  const entry = plan.entries.find(candidate => !candidate.deleted && String(candidate.raw.item_id) === String(itemId));
  if (!entry) return false;
  entry.deleted = true;
  entry.changed = true;
  inventoryPlanLists(plan);
  return true;
}

function inventoryPlanConsume(plan, predicate, quantity) {
  let remaining = Math.max(0, Math.trunc(Number(quantity) || 0));
  for (const entry of plan.entries) {
    if (!remaining || entry.deleted || !predicate(entry)) continue;
    const current = mailQuantity(entry);
    const take = Math.min(current, remaining);
    remaining -= take;
    const next = current - take;
    if (next > 0) entry.extra.quantity = next;
    else entry.deleted = true;
    entry.changed = true;
    inventoryPlanLists(plan);
  }
  return remaining;
}

function mailAddReward(plan, item, itemId, extra, origin) {
  if (!item || typeof item !== "object") return;
  const slotType = String(item.type || "");
  const stackExtra = { ...(extra || {}), junkId: item.junkId, potionId: item.potionId };
  const key = mailStackKey(slotType, stackExtra);
  if (key) {
    let remaining = mailMergeInto(plan.carried, key, Math.max(1, Math.trunc(Number(item.quantity) || 1)));
    if (remaining > 0 && plan.carried.length < MAIL_INVENTORY_CAPACITY) {
      const chunk = Math.min(MAIL_STACK_MAX, remaining);
      plan.entries.push(mailNewEntry(item, itemId, false, chunk, stackExtra, origin));
      remaining -= chunk;
      mailPlanLists(plan);
    }
    if (remaining > 0) remaining = mailMergeInto(plan.overflow, key, remaining);
    let part = 1;
    while (remaining > 0) {
      const chunk = Math.min(MAIL_STACK_MAX, remaining);
      plan.entries.push(mailNewEntry(item, `${itemId}-part-${part++}`, true, chunk, stackExtra, origin));
      remaining -= chunk;
      mailPlanLists(plan);
    }
    return;
  }

  plan.entries.push(mailNewEntry(item, itemId, plan.carried.length >= MAIL_INVENTORY_CAPACITY, 1, extra, origin));
  mailPlanLists(plan);
}

function reconcileMailOverflow(plan) {
  mailPlanLists(plan);
  for (const entry of plan.overflow.slice()) {
    if (entry.deleted) continue;
    const key = mailStackKey(entry.raw.slot_type, entry.extra);
    if (key) {
      const before = mailQuantity(entry);
      const remaining = mailMergeInto(plan.carried, key, before);
      if (remaining !== before) {
        if (remaining > 0) entry.extra.quantity = remaining;
        else entry.deleted = true;
        entry.changed = true;
      }
      if (!entry.deleted && remaining > 0 && plan.carried.length < MAIL_INVENTORY_CAPACITY) {
        entry.extra.overflow = false;
        entry.extra.quantity = remaining;
        entry.changed = true;
      }
    } else if (plan.carried.length < MAIL_INVENTORY_CAPACITY) {
      entry.extra.overflow = false;
      entry.changed = true;
    }
    mailPlanLists(plan);
  }
}

function inventoryPlanFromRows(rows, options = {}) {
  const plan = {
    entries: (Array.isArray(rows) ? rows : []).map(raw => {
      const parsed = parseJsonColumn(raw.extra_json, {});
      const extra = parsed && typeof parsed === "object" ? { ...parsed } : {};
      return { raw, extra, new: false, changed: false, deleted: false };
    }),
    carried: [], overflow: [], equipped: []
  };
  mailPlanLists(plan);
  if (options.reconcile !== false) reconcileMailOverflow(plan);
  return plan;
}
async function loadMailSettlementState(db, id, characterId, holder, options = {}) {
  if (holder?.plan) return holder.plan;
  const rows = Array.isArray(options.prefetchedRows)
    ? options.prefetchedRows
    : (await db.prepare(`SELECT * FROM items WHERE player_id = ? AND character_id = ? ORDER BY rowid, item_id`)
      .bind(id, characterId).all()).results || [];
  const plan = inventoryPlanFromRows(rows, options);
  if (holder) holder.plan = plan;
  return plan;
}

function mailPlanPersistenceStatements(db, plan, id, characterId, timestamp, gate, gateBinds) {
  const statements = [];
  for (const entry of plan.entries) {
    if (entry.new) {
      const row = entry.raw;
      statements.push(db.prepare(
        `INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, inventory_slot, item_template_id, rarity, name, item_level, enhance_level, bound, quantity, atk, def, hp, mp, extra_json, created_at, updated_at)
         SELECT ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${gate}
         ON CONFLICT(item_id) DO UPDATE SET quantity = excluded.quantity, extra_json = excluded.extra_json, updated_at = excluded.updated_at
         WHERE items.player_id = excluded.player_id AND items.character_id = excluded.character_id`
      ).bind(row.item_id, id, characterId, row.slot_type, row.inventory_slot || "", row.item_template_id || "", row.rarity || "common", row.name || row.slot_type,
        Number(row.item_level) || 0, Number(row.enhance_level) || 0, Number(row.bound) || 0, Number(row.quantity) || 1,
        Number(row.atk) || 0, Number(row.def) || 0, Number(row.hp) || 0, Number(row.mp) || 0, JSON.stringify(entry.extra), timestamp, timestamp, ...gateBinds));
      if (entry.origin) {
        statements.push(itemProvenanceStatement(db, row.item_id, id, characterId, entry.origin.originType, entry.origin.sourceId, entry.origin.context, timestamp, gate, gateBinds));
        statements.push(itemOwnershipAcquireStatement(db, row.item_id, id, characterId, entry.origin.originType, entry.origin.context, timestamp, gate, gateBinds));
      }
      continue;
    }
    if (!entry.changed) continue;
    if (entry.deleted) {
      statements.push(db.prepare(`DELETE FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND ${gate}`)
        .bind(entry.raw.item_id, id, characterId, ...gateBinds));
    } else {
      statements.push(db.prepare(`UPDATE items SET quantity = ?, extra_json = ?, updated_at = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND ${gate}`)
        .bind(Number(entry.raw.quantity) || 1, JSON.stringify(entry.extra), timestamp, entry.raw.item_id, id, characterId, ...gateBinds));
    }
  }
  return statements;
}

function isW6RetiredLegacySpecialItem(item) {
  const slot = String(item?.type || item?.slot_type || "").toLowerCase();
  const rarity = String(item?.rarity || "").toLowerCase();
  const isV2 = Number(item?.itemModelVersion) === 2 || Number(item?.rewardVersion) === 2;
  if (isV2) return false;
  if (slot === "wings" && rarity === "raid") return true;
  return ["weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"].includes(slot) && rarity === "azure";
}

async function mailboxRewardStatements(db, id, characterId, mail, claimedAt, inventoryOffset = 0, claimGate = null, settlementHolder = null) {
  const mailId = String(mail.mail_id || "");
  const timestamp = String(claimedAt).split("#", 1)[0];
  const gate = claimGate?.sql || `EXISTS (SELECT 1 FROM mailbox WHERE mail_id = ? AND character_id = ? AND claimed = 1 AND claimed_at = ?)`;
  const gateBinds = claimGate?.binds || [mailId, characterId, claimedAt];
  const statements = [];
  const gold = Math.max(0, Math.trunc(Number(mail.gold) || 0));
  const diamonds = Math.max(0, Math.trunc(Number(mail.diamonds) || 0));
  statements.push(db.prepare(`UPDATE characters SET gold = gold + ?, updated_at = ? WHERE character_id = ? AND ${gate}`)
    .bind(gold, timestamp, characterId, ...gateBinds));
  statements.push(db.prepare(`UPDATE players SET diamonds = diamonds + ? WHERE id = ? AND ${gate}`)
    .bind(diamonds, id, ...gateBinds));

  const plan = await loadMailSettlementState(db, id, characterId, settlementHolder || {});

  const resourceTotals = new Map();
  const junkRows = parseJsonColumn(mail.junk_json, []);
  for (const value of Array.isArray(junkRows) ? junkRows : []) {
    const potionId = String(value?.potionId || "").slice(0, 80);
    const junkId = String(value?.junkId || "").slice(0, 80);
    const quantity = Math.max(0, Math.trunc(Number(value?.quantity) || 0));
    const key = potionId ? `potion:${potionId}` : junkId ? `junk:${junkId}` : "";
    if (key && quantity) resourceTotals.set(key, (resourceTotals.get(key) || 0) + quantity);
  }
  for (const [resourceKey, quantity] of resourceTotals) {
    const [resourceType, resourceId] = resourceKey.split(":", 2);
    const item = resourceType === "potion"
      ? { type: "potion", potionId: resourceId, name: resourceId, quantity }
      : { type: "junk", junkId: resourceId, name: resourceId, quantity };
    const itemId = `mail-${resourceType}-${dungeonV2ServerHash(`${mailId}:${resourceType}:${resourceId}`)}`;
    mailAddReward(plan, item, itemId, resourceType === "potion" ? { potionId: resourceId } : { junkId: resourceId },
      { originType: "mail_reward", sourceId: mailId, context: { mailId, [resourceType === "potion" ? "potionId" : "junkId"]: resourceId } });
  }

  const itemRows = parseJsonColumn(mail.items_json, []);
  const items = Array.isArray(itemRows) ? itemRows : [];
  items.forEach((item, index) => {
    if (isW6RetiredLegacySpecialItem(item)) return;
    const slot = String(item?.type || "");
    if (!["weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"].includes(slot)) return;
    const itemId = `mail-item-${dungeonV2ServerHash(`${mailId}:${index}`)}`;
    const extra = {
      empowerSlots: Array.isArray(item.empowerSlots) ? item.empowerSlots : (globalThis.ENHANCEMENT_V2?.fillEmpowerSlots
        ? globalThis.ENHANCEMENT_V2.fillEmpowerSlots(slot, String(item.rarity || "rare").toLowerCase(), secureRandomUnit)
        : Array(Math.max(0, Math.min(6, Math.trunc(Number(item.empowerSlotCount || item.empowerSlotCapacity) || 1)))).fill(null)),
      empowerSlotCapacity: Math.max(0, Math.min(6, Math.trunc(Number(item.empowerSlotCapacity || item.empowerSlotCount) || 1))),
      ...(Number(item.rewardVersion) === 2 || Number(item.itemModelVersion) === 2 ? {
        rewardVersion: 2, itemModelVersion: 2,
        ...(slot === "wings" ? {} : { gearTier: Math.max(1, Math.min(5, Number(item.gearTier) || 1)) }),
        sourceType: item.sourceType ? String(item.sourceType).slice(0, 80) : undefined,
        sourceFloor: Number(item.sourceFloor) || undefined,
        sourceIdentity: item.sourceIdentity ? String(item.sourceIdentity).slice(0, 120) : undefined,
        specialSource: item.specialSource ? String(item.specialSource).slice(0, 80) : undefined,
        wingFamily: slot === "wings" ? String(item.wingFamily || item.setId || "").toLowerCase() : undefined,
        utilityStat: item.utilityStat ? String(item.utilityStat).slice(0, 40) : undefined,
        critChance: item.critChance || undefined, critDamage: item.critDamage || undefined,
        dodgeChance: item.dodgeChance || undefined
      } : {}),
      ...(item.dodgeChance ? { dodgeChance: Number(item.dodgeChance) || 0 } : {}),
      ...(item.critChance ? { critChance: Number(item.critChance) || 0 } : {}),
      ...(item.critDamage ? { critDamage: Number(item.critDamage) || 0 } : {}),
      ...(item.setId ? { setId: String(item.setId).slice(0, 80) } : {}),
      ...(item.bossWeaponId ? { bossWeaponId: String(item.bossWeaponId).slice(0, 80) } : {}),
      ...(item.signatureId ? { signatureId: String(item.signatureId).slice(0, 80) } : {}),
      ...(item.sourceBossId ? { sourceBossId: String(item.sourceBossId).slice(0, 80) } : {})
    };
    mailAddReward(plan, item, itemId, extra,
      { originType: item.sourceType || "mail_reward", sourceId: item.sourceIdentity || mailId,
        context: { mailId, sourceFloor: item.sourceFloor || null } });
  });
  statements.push(...mailPlanPersistenceStatements(db, plan, id, characterId, timestamp, gate, gateBinds));
  return statements;
}

async function handleCompleteBattle(db, id, session, characterId, battleId, resultPayload) {
  const auth = session?.__characterAuth?.auth || await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = session?.__characterAuth?.owned || await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const resultName = resultPayload && resultPayload.result;
  if (!battleId || !["victory", "defeat", "fled"].includes(resultName)) return json({ error: "invalid_battle_result" }, 400);
  const battleKey = String(battleId);
  const preRead = await db.batch([
    db.prepare(`SELECT character_id, result_json, completed_at FROM battle_completions WHERE battle_id = ?`).bind(battleKey),
    db.prepare(`SELECT checkpoint_seq, payload_json FROM battle_checkpoints WHERE battle_id = ? AND character_id = ? AND state = 'active' LIMIT 1`).bind(battleKey, characterId),
    db.prepare(`UPDATE battle_checkpoints SET state = 'completed', updated_at = ? WHERE battle_id = ? AND character_id = ? AND EXISTS (SELECT 1 FROM battle_completions WHERE battle_id = ? AND character_id = ?)`).bind(nowIso(), battleKey, characterId, battleKey, characterId),
    ...battleCompletionSnapshotStatements(db, id, characterId)
  ]);
  const prior = preRead?.[0]?.results?.[0] || null;
  if (prior) {
    if (prior.character_id !== characterId) return json({ error: "battle_identity_conflict" }, 409);
    return json({ ok: true, firstCompletion: false, result: parseJsonColumn(prior.result_json, null), completedAt: prior.completed_at, ...battleCompletionSnapshotFromBatch(preRead, 3) });
  }
  const checkpoint = preRead?.[1]?.results?.[0] || null;
  if (!checkpoint) return json({ error: "battle_checkpoint_missing" }, 409);
  if (Math.floor(Number(resultPayload.safeActionSeq) || 0) <= (Number(checkpoint.checkpoint_seq) || 0)) return json({ error: "battle_result_not_after_checkpoint" }, 409);
  const checkpointPayload = parseJsonColumn(checkpoint.payload_json, null);
  if (checkpointPayload?.authorizationOnly) return json({ error: "battle_checkpoint_missing" }, 409);
  const battleContext = resultName === "victory" && resultPayload?.reward ? dungeonV2ServerContextFromStoredCheckpoint(checkpointPayload) : null;
  if (resultName === "victory" && resultPayload?.reward && !battleContext) return json({ error: "invalid_battle_context" }, 400);
  const encoded = JSON.stringify(resultPayload);
  if (encoded.length > 512000) return json({ error: "battle_result_too_large" }, 413);
  const now = nowIso();
  const rewardCommit = resultPayload?.reward && resultName === "victory"
    ? await commitDungeonRewardInBattleTransaction(db, id, characterId, battleId, resultPayload, owned.row, checkpointPayload, battleContext, now)
    : { reward: null, committed: false };
  if (rewardCommit.error) return json({ error: rewardCommit.error }, 400);
  if (resultPayload?.reward && resultName === "victory") {
    const row = rewardCommit.completionRow;
    if (!row || row.character_id !== characterId) return json({ error: "battle_identity_conflict" }, 409);
    return json({
      ok: true,
      firstCompletion: !!rewardCommit.committed,
      result: parseJsonColumn(row.result_json, null),
      completedAt: row.completed_at,
      ...(rewardCommit.snapshot || {})
    });
  }
  const finalStatements = [
    db.prepare(`INSERT INTO battle_completions (battle_id, character_id, result_json, completed_at) VALUES (?, ?, ?, ?) ON CONFLICT(battle_id) DO NOTHING`).bind(battleKey, characterId, encoded, now),
    db.prepare(`SELECT character_id, result_json, completed_at FROM battle_completions WHERE battle_id = ?`),
    db.prepare(`UPDATE battle_checkpoints SET state = 'completed', updated_at = ? WHERE battle_id = ? AND character_id = ?`).bind(now, battleKey, characterId),
    ...battleCompletionSnapshotStatements(db, id, characterId)
  ];
  finalStatements[1] = db.prepare(`SELECT character_id, result_json, completed_at FROM battle_completions WHERE battle_id = ?`).bind(battleKey);
  const finalBatch = await db.batch(finalStatements);
  const rowReadIndex = 1;
  const snapshotIndex = 3;
  const row = finalBatch?.[rowReadIndex]?.results?.[0] || null;
  if (!row || row.character_id !== characterId) return json({ error: "battle_identity_conflict" }, 409);
  const firstCompletion = !!(finalBatch?.[0]?.meta?.changes);
  return json({ ok: true, firstCompletion, result: parseJsonColumn(row.result_json, null), completedAt: row.completed_at, ...battleCompletionSnapshotFromBatch(finalBatch, snapshotIndex) });
}

async function handleSaveQuickSlots(db, id, session, characterId, quickSlots) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!Array.isArray(quickSlots) || quickSlots.length !== 4) return json({ error: "invalid_quick_slots" }, 400);
  const encoded = JSON.stringify(quickSlots);
  await db.prepare(
    `INSERT INTO character_settings (character_id, quick_slots_json, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(character_id) DO UPDATE SET quick_slots_json = excluded.quick_slots_json, updated_at = excluded.updated_at`
  ).bind(characterId, encoded, nowIso()).run();
  return json({ ok: true });
}

async function handleSyncItems(db, id, session, characterId, items) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  if (!Array.isArray(items)) return json({ error: "invalid_items" }, 400);
  if (items.length > 5000) return json({ error: "inventory_too_large", max: 5000 }, 413);

  // This endpoint is presentation-only. Identity, existence, stats, stack size,
  // ownership and mutation history remain server-owned.
  const rows = (await db.prepare(`SELECT * FROM items WHERE character_id = ? AND player_id = ?`).bind(characterId, id).all()).results || [];
  const byId = new Map(rows.map(row => [String(row.item_id), row]));
  const seen = new Set();
  const equippedStateById = new Map(rows.map(row => [String(row.item_id), Number(row.equipped) === 1]));
  const stmts = [];
  const allowedItemTypes = new Set(["junk", "potion", "weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"]);
  const normalizeInventorySlot = value => {
    if (value === "" || value === null || value === undefined) return "";
    if (!Number.isInteger(value) || value < 0 || value >= 5000) return null;
    return value;
  };
  for (let snapshotIndex = 0; snapshotIndex < items.length; snapshotIndex += 1) {
    const incoming = items[snapshotIndex];
    const itemId = String(incoming?.itemId || "");
    if (!itemId || seen.has(itemId)) return json({ error: "invalid_item_reference" }, 400);
    seen.add(itemId);
    const existing = byId.get(itemId);
    const incomingExtra = incoming?.extra && typeof incoming.extra === "object" ? incoming.extra : {};
    const storedExtra = parseJsonColumn(existing?.extra_json, {});
    const incomingV2 = ENHANCEMENT_V2_RULES?.isV2Item({ rewardVersion: incomingExtra.rewardVersion, itemModelVersion: incomingExtra.itemModelVersion });
    const existingV2 = !!existing && ENHANCEMENT_V2_RULES?.isV2Item({ rewardVersion: storedExtra.rewardVersion, itemModelVersion: storedExtra.itemModelVersion });
    if (incomingV2 && !existingV2) return json({ error: "untrusted_v2_item" }, 403);
    if (!existing) {
      console.warn("[production-diagnostic]", JSON.stringify({
        event: "inventory_sync_rejected",
        system: "inventory",
        reason: "item_not_owned",
        action: "syncItems",
        itemRef: itemId,
        snapshotIndex,
        snapshotCount: items.length,
      }));
      return json({ error: "item_not_owned", action: "syncItems", itemId }, 403);
    }
    if (!allowedItemTypes.has(String(existing.slot_type || ""))) return json({ error: "invalid_item_slot_type" }, 400);

    if (typeof incoming.equipped !== "boolean") return json({ error: "invalid_presentation_state" }, 400);
    equippedStateById.set(itemId, incoming.equipped);
    if (incoming.equipped) {
      if (!["weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"].includes(existing.slot_type)) {
        return json({ error: "invalid_equip_slot" }, 400);
      }
    } else if (["junk", "potion"].includes(existing.slot_type) && Number(existing.equipped) === 1) {
      return json({ error: "invalid_equip_slot" }, 400);
    }
    const nextInventorySlot = normalizeInventorySlot(incoming.inventorySlot);
    if (nextInventorySlot === null) return json({ error: "invalid_inventory_slot" }, 400);
    const nextExtra = { ...storedExtra };
    if (typeof incomingExtra.favorite === "boolean") nextExtra.favorite = incomingExtra.favorite;
    if (typeof incomingExtra.overflow === "boolean") nextExtra.overflow = incomingExtra.overflow;
    stmts.push(db.prepare(
      `UPDATE items SET equipped = ?, inventory_slot = COALESCE(?, inventory_slot), extra_json = ?, updated_at = ? WHERE item_id = ? AND character_id = ? AND player_id = ?`
    ).bind(incoming.equipped ? 1 : 0, nextInventorySlot, JSON.stringify(nextExtra), nowIso(), itemId, characterId, id));
  }

  // Omitted rows retain their existing state. Validate the resulting DB state, not
  // only the submitted subset, so partial payloads cannot create duplicate slots.
  const finalEquippedSlots = new Set();
  for (const row of rows) {
    if (!equippedStateById.get(String(row.item_id))) continue;
    if (!["weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"].includes(row.slot_type)) {
      return json({ error: "invalid_equip_slot" }, 400);
    }
    if (finalEquippedSlots.has(row.slot_type)) return json({ error: "duplicate_equipped_slot" }, 400);
    finalEquippedSlots.add(row.slot_type);
  }

  if (stmts.length) await db.batch(stmts);
  return json({ ok: true, count: stmts.length, added: 0, removed: 0 });
}

// ---------- WAVE 3: authoritative Reward V2 Enhance / Empower ----------
function secureRandomUnit() {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0] / 0x100000000;
}
function v2BlacksmithItemFromRow(row, extra) {
  return {
    id: row.item_id,
    type: row.slot_type,
    rarity: row.rarity,
    enhanceLevel: Number(row.enhance_level) || 0,
    gearTier: Number(extra.gearTier) || 0,
    rewardVersion: Number(extra.rewardVersion) || 0,
    itemModelVersion: Number(extra.itemModelVersion) || 0,
    empowerSlotCapacity: Number(extra.empowerSlotCapacity) || 0,
    empowerSlots: Array.isArray(extra.empowerSlots) ? extra.empowerSlots : [],
    wingFamily: extra.wingFamily || extra.wingId || extra.wingsId || extra.setId || ""
  };
}
function v2BlacksmithReceipts(extra) {
  return Array.isArray(extra?.blacksmithReceipts)
    ? extra.blacksmithReceipts.map(String).filter(Boolean).slice(-32)
    : [];
}
async function v2BlacksmithSnapshot(db, id, characterId) {
  const [character, items, player] = await Promise.all([
    getRow(db, "characters", "character_id", characterId),
    getRows(db, "items", "character_id", characterId),
    getRow(db, "players", "id", id),
  ]);
  return { character, items, diamonds: Number(player?.diamonds) || 0 };
}
async function handleMutateV2Blacksmith(db, id, session, characterId, itemId, mutation, requestId) {
  const auth = session?.__characterAuth?.auth || await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = session?.__characterAuth?.owned || await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "").trim();
  if (!key || key.length > 128) return json({ error: "missing_request_id" }, 400);
  const action = String(mutation?.type || "");
  if (!["enhance", "empower_open", "empower_lock", "empower_reroll"].includes(action)) return json({ error: "invalid_blacksmith_action" }, 400);
  const row = await db.prepare(`SELECT * FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? LIMIT 1`).bind(String(itemId || ""), id, characterId).first();
  if (!row) return json({ error: "item_not_found" }, 404);
  const originalExtra = parseJsonColumn(row.extra_json, {});
  const receipts = v2BlacksmithReceipts(originalExtra);
  if (receipts.includes(key)) return json({ ok: true, replayed: true, mutation: originalExtra.blacksmithLastResult || { type: action }, ...(await v2BlacksmithSnapshot(db, id, characterId)) });
  const currentVersion = Math.max(0, Number(originalExtra.blacksmithVersion) || 0);
  if (Math.floor(Number(mutation?.expectedVersion)) !== currentVersion) return json({ error: "blacksmith_version_conflict", currentVersion, retry: true, ...(await v2BlacksmithSnapshot(db, id, characterId)) }, 409);
  const item = v2BlacksmithItemFromRow(row, originalExtra);
  if (!ENHANCEMENT_V2_RULES?.isV2Item(item)) return json({ error: "not_v2_item" }, 400);
  const canonicalCapacity = ENHANCEMENT_V2_RULES.empowerCapacity(item);
  if (!canonicalCapacity || item.empowerSlots.length !== canonicalCapacity) return json({ error: "invalid_v2_empower_shape" }, 409);

  const character = owned.row;
  const oldGold = Math.max(0, Number(character.gold) || 0);
  const oldProtection = Math.max(0, Number(character.protection_stones) || 0);
  let goldCost = 0;
  let junkId = "";
  let protectionConsumed = 0;
  let nextLevel = item.enhanceLevel;
  let nextSlots = item.empowerSlots.map(slot => slot ? { ...slot } : null);
  let outcome = { type: action };

  if (action === "enhance") {
    const cost = ENHANCEMENT_V2_RULES.enhanceCost(item, item.enhanceLevel);
    if (!cost) return json({ error: item.enhanceLevel >= ENHANCEMENT_V2_RULES.ENHANCE_MAX ? "enhance_max" : "invalid_enhance_item" }, 400);
    const risky = item.enhanceLevel >= 6;
    const wantsProtection = mutation?.useProtectionStone === true;
    if (wantsProtection && !risky) return json({ error: "protection_not_eligible" }, 400);
    if (wantsProtection && oldProtection < 1) return json({ error: "insufficient_protection_stones", need: 1, have: oldProtection }, 400);
    const resolved = ENHANCEMENT_V2_RULES.resolveEnhanceAttempt({
      level: item.enhanceLevel,
      successRoll: secureRandomUnit(),
      downgradeRoll: secureRandomUnit(),
      protectionRequested: wantsProtection,
      protectionStones: oldProtection
    });
    goldCost = cost.gold;
    junkId = "iron";
    protectionConsumed = resolved.protectionConsumed ? 1 : 0;
    nextLevel = resolved.levelAfter;
    outcome = { ...resolved, type: action, cost };
  } else if (action === "empower_open") {
    const slotIndex = nextSlots.findIndex(slot => !slot);
    if (slotIndex < 0) return json({ error: "empower_slots_full" }, 400);
    const cost = ENHANCEMENT_V2_RULES.empowerOpenCost(item, slotIndex);
    if (!cost) return json({ error: "invalid_empower_cost" }, 400);
    const rolled = ENHANCEMENT_V2_RULES.rollEmpowerOption(item.type, secureRandomUnit(), secureRandomUnit());
    if (!rolled) return json({ error: "invalid_empower_item_type" }, 400);
    nextSlots[slotIndex] = { ...rolled };
    goldCost = cost.gold;
    junkId = "manaOre";
    outcome = { type: action, slotIndex, option: rolled, cost };
  } else if (action === "empower_lock") {
    const slotIndex = Math.floor(Number(mutation?.slotIndex));
    const slot = nextSlots[slotIndex];
    if (!slot || !ENHANCEMENT_V2_RULES.isValidEmpowerOption(item.type, { ...slot, locked: !!slot.locked })) return json({ error: "invalid_empower_slot" }, 400);
    const nextLocked = !slot.locked;
    const filledCount = nextSlots.filter(Boolean).length;
    const lockedAfter = nextSlots.filter((current, index) => current && (index === slotIndex ? nextLocked : !!current.locked)).length;
    if (nextLocked && filledCount > 0 && lockedAfter >= filledCount) return json({ error: "cannot_lock_all_empower_slots" }, 400);
    nextSlots[slotIndex] = { ...slot, locked: nextLocked };
    outcome = { type: action, slotIndex, locked: nextLocked, cost: { gold: 0, manaOre: 0 } };
  } else {
    const filledCount = nextSlots.filter(Boolean).length;
    const lockedCount = nextSlots.filter(slot => slot?.locked).length;
    const cost = ENHANCEMENT_V2_RULES.empowerRerollCost(item, filledCount, lockedCount);
    if (!cost) return json({ error: filledCount && lockedCount >= filledCount ? "all_empower_slots_locked" : "invalid_reroll" }, 400);
    nextSlots = nextSlots.map(slot => !slot || slot.locked ? slot : ENHANCEMENT_V2_RULES.rerollEmpowerOptionValue(item.type, slot, secureRandomUnit()));
    goldCost = cost.gold;
    junkId = "manaOre";
    outcome = { type: action, filledCount, lockedCount, cost };
  }

  if (oldGold < goldCost) return json({ error: "insufficient_gold", need: goldCost, have: oldGold }, 400);
  let junkRow = null;
  let junkExtra = null;
  if (junkId) {
    const rows = await db.prepare(`SELECT item_id, extra_json FROM items WHERE player_id = ? AND character_id = ? AND slot_type = 'junk' ORDER BY item_id`).bind(id, characterId).all();
    for (const candidate of rows.results || []) {
      const extra = parseJsonColumn(candidate.extra_json, {});
      if (extra.junkId === junkId && Number(extra.quantity) > 0) { junkRow = candidate; junkExtra = extra; break; }
    }
    if (!junkRow) return json({ error: "insufficient_materials", junkId, need: 1, have: 0 }, 400);
  }

  const operationToken = randomToken(12);
  const now = nowIso();
  const finalReceipts = [...receipts.filter(receipt => receipt !== key), key].slice(-32);
  const finalExtra = {
    ...originalExtra,
    empowerSlots: nextSlots,
    blacksmithVersion: currentVersion + 1,
    blacksmithReceipts: finalReceipts,
    blacksmithLastResult: { requestId: key, ...outcome }
  };
  const pendingExtra = { ...originalExtra, blacksmithPending: operationToken };
  const oldExtraEncoded = row.extra_json || "";
  const pendingEncoded = JSON.stringify(pendingExtra);
  const finalEncoded = JSON.stringify(finalExtra);
  const resourceChecks = [
    `EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND gold = ? AND gold >= ? AND protection_stones = ? AND protection_stones >= ?)`
  ];
  const claimBinds = [characterId, oldGold, goldCost, oldProtection, protectionConsumed];
  if (junkRow) {
    resourceChecks.push(`EXISTS (SELECT 1 FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ? AND CAST(json_extract(extra_json, '$.quantity') AS INTEGER) >= 1)`);
    claimBinds.push(junkRow.item_id, id, characterId, junkRow.extra_json || "");
  }
  const statements = [
    db.prepare(`UPDATE items SET extra_json = ?, updated_at = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND enhance_level = ? AND COALESCE(extra_json, '') = ? AND ${resourceChecks.join(" AND ")}`)
      .bind(pendingEncoded, now, row.item_id, id, characterId, Number(row.enhance_level) || 0, oldExtraEncoded, ...claimBinds),
    db.prepare(`UPDATE characters SET gold = gold - ?, protection_stones = protection_stones - ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND gold = ? AND protection_stones = ? AND EXISTS (SELECT 1 FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ?)`)
      .bind(goldCost, protectionConsumed, now, characterId, id, oldGold, oldProtection, row.item_id, id, characterId, pendingEncoded)
  ];
  if (junkRow) {
    const remaining = Number(junkExtra.quantity) - 1;
    if (remaining > 0) {
      statements.push(db.prepare(`UPDATE items SET extra_json = ?, updated_at = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ? AND EXISTS (SELECT 1 FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ?)`)
        .bind(JSON.stringify({ ...junkExtra, quantity: remaining }), now, junkRow.item_id, id, characterId, junkRow.extra_json || "", row.item_id, id, characterId, pendingEncoded));
    } else {
      statements.push(db.prepare(`DELETE FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ? AND EXISTS (SELECT 1 FROM items target WHERE target.item_id = ? AND target.player_id = ? AND target.character_id = ? AND target.extra_json = ?)`)
        .bind(junkRow.item_id, id, characterId, junkRow.extra_json || "", row.item_id, id, characterId, pendingEncoded));
    }
  }
  statements.push(db.prepare(`UPDATE items SET enhance_level = ?, extra_json = ?, updated_at = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND extra_json = ?`)
    .bind(nextLevel, finalEncoded, now, row.item_id, id, characterId, pendingEncoded));
  const batch = await db.batch(statements);
  const claimed = Number(batch?.[0]?.meta?.changes) || 0;
  const characterUpdated = Number(batch?.[1]?.meta?.changes) || 0;
  const finalized = Number(batch?.[batch.length - 1]?.meta?.changes) || 0;
  if (claimed !== 1 || characterUpdated !== 1 || finalized !== 1) {
    const current = await db.prepare(`SELECT extra_json FROM items WHERE item_id = ? AND character_id = ?`).bind(row.item_id, characterId).first();
    const currentExtra = parseJsonColumn(current?.extra_json, {});
    if (v2BlacksmithReceipts(currentExtra).includes(key)) return json({ ok: true, replayed: true, mutation: currentExtra.blacksmithLastResult || { type: action }, ...(await v2BlacksmithSnapshot(db, id, characterId)) });
    return json({ error: "blacksmith_conflict", retry: true }, 409);
  }
  return json({ ok: true, replayed: false, mutation: outcome, ...(await v2BlacksmithSnapshot(db, id, characterId)) });
}

async function handleMutateLegacyBlacksmith(db, id, session, characterId, itemId, mutation, requestId) {
  const auth = session?.__characterAuth?.auth || await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  const owned = session?.__characterAuth?.owned || await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error }, 403);
  const key = String(requestId || "");
  const action = String(mutation?.type || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key) || !["enhance", "empower_open", "empower_lock", "empower_reroll"].includes(action)) return json({ error: "invalid_blacksmith_request" }, 400);
  const row = await db.prepare(`SELECT * FROM items WHERE item_id = ? AND player_id = ? AND character_id = ?`).bind(String(itemId || ""), id, characterId).first();
  if (!row) return json({ error: "item_not_owned" }, 403);
  const extra = parseJsonColumn(row.extra_json, {});
  if (ENHANCEMENT_V2_RULES?.isV2Item({ itemModelVersion: extra.itemModelVersion, rewardVersion: extra.rewardVersion })) return json({ error: "not_legacy_item" }, 409);
  const operation = `legacy_blacksmith_${action}`;
  const payload = action === "empower_lock" ? { slotIndex: Math.floor(Number(mutation.slotIndex)) } : { useProtectionStone: mutation?.useProtectionStone === true };
  const payloadJson = JSON.stringify({ itemId: row.item_id, ...payload });
  const replay = await characterOperationReplay(db, id, characterId, operation, key, payloadJson);
  if (replay) return replay;

  const slots = Array.isArray(extra.empowerSlots) ? extra.empowerSlots.map(slot => slot ? { ...slot } : null) : [];
  const level = Math.max(0, Number(row.enhance_level) || 0);
  let nextLevel = level;
  let nextSlots = slots;
  let goldCost = 0;
  let materialId = "";
  let protectionCost = 0;
  const rarityMultiplier = { rare: 1, unique: 1.9, elite: 3.2, mythic: 5.4, azure: 5.4 }[String(row.rarity || "").toLowerCase()] || 1;
  const outcome = { type: action };
  if (action === "enhance") {    if (level >= 10) return json({ error: "enhance_max" }, 409);
    goldCost = 25 + level * 35;
    materialId = "iron";
    const rates = [95, 90, 82, 72, 60, 48, 36, 25, 16, 10];
    const success = secureRandomUnit() * 100 < rates[level];
    const risky = level >= 6;
    const requestedProtection = mutation?.useProtectionStone === true;
    if (requestedProtection && !risky) return json({ error: "protection_not_eligible" }, 400);
    if (success) nextLevel = level + 1;
    else if (risky && !requestedProtection) nextLevel = Math.max(0, level - 1);
    else if (risky && requestedProtection) protectionCost = 1;
    Object.assign(outcome, { success, levelBefore: level, levelAfter: nextLevel, protectionConsumed: protectionCost, cost: { gold: goldCost, iron: 1 } });
  } else if (action === "empower_open") {
    if (!slots.length || slots.length > 8) return json({ error: "invalid_legacy_empower_shape" }, 409);
    const slotIndex = slots.findIndex(slot => !slot);
    if (slotIndex < 0) return json({ error: "empower_slots_full" }, 409);
    const defs = [
      ["atkPct", "ATK", "⚔️", .03], ["defPct", "DEF", "🛡️", .03], ["critChance", "Crit", "💥", 1.2],
      ["accuracy", "Accuracy", "🎯", 1.2], ["dodgeChance", "Dodge", "💨", 1], ["hp", "HP", "❤️", 6],
      ["mp", "MP", "💧", 4], ["dropBonus", "Drop", "🎁", 1.5]
    ];
    const def = defs[Math.floor(secureRandomUnit() * defs.length)];
    const raw = def[3] * rarityMultiplier * (.8 + secureRandomUnit() * .4);
    const option = { key: def[0], label: def[1], icon: def[2], value: ["hp", "mp"].includes(def[0]) ? Math.round(raw) : Math.round(raw * 10) / 10 };
    nextSlots[slotIndex] = option;
    materialId = "manaOre";
    goldCost = 30 + slotIndex * 45;
    Object.assign(outcome, { slotIndex, option, cost: { gold: goldCost, manaOre: 1 } });
  } else if (action === "empower_lock") {
    const index = payload.slotIndex;
    if (!Number.isInteger(index) || !slots[index]) return json({ error: "invalid_empower_slot" }, 400);
    nextSlots[index] = { ...slots[index], locked: !slots[index].locked };
    Object.assign(outcome, { slotIndex: index, locked: nextSlots[index].locked });
  } else {
    const filled = slots.filter(Boolean);
    const locked = filled.filter(slot => slot.locked).length;
    if (!filled.length || locked >= filled.length) return json({ error: "all_empower_slots_locked" }, 409);
    goldCost = Math.round((25 + filled.length * 15) * (1 + locked * .6));
    materialId = "manaOre";
    const defs = [
      ["atkPct", "ATK", "⚔️", .03], ["defPct", "DEF", "🛡️", .03], ["critChance", "Crit", "💥", 1.2],
      ["accuracy", "Accuracy", "🎯", 1.2], ["dodgeChance", "Dodge", "💨", 1], ["hp", "HP", "❤️", 6],
      ["mp", "MP", "💧", 4], ["dropBonus", "Drop", "🎁", 1.5]
    ];
    nextSlots = slots.map(slot => {
      if (!slot || slot.locked) return slot;
      const def = defs[Math.floor(secureRandomUnit() * defs.length)];
      const raw = def[3] * rarityMultiplier * (.8 + secureRandomUnit() * .4);
      return { key: def[0], label: def[1], icon: def[2], value: ["hp", "mp"].includes(def[0]) ? Math.round(raw) : Math.round(raw * 10) / 10 };
    });
    Object.assign(outcome, { filledCount: filled.length, lockedCount: locked, cost: { gold: goldCost, manaOre: 1 } });
  }
  if (Number(owned.row.gold) < goldCost) return json({ error: "insufficient_gold" }, 409);
  if (Number(owned.row.protection_stones) < protectionCost) return json({ error: "insufficient_protection_stones" }, 409);
  let materialRow = null;
  let materialExtra = null;
  if (materialId) {
    const candidates = await db.prepare(`SELECT item_id, extra_json FROM items WHERE player_id = ? AND character_id = ? AND slot_type = 'junk' ORDER BY item_id`).bind(id, characterId).all();
    for (const candidate of candidates.results || []) {
      const parsed = parseJsonColumn(candidate.extra_json, {});
      if (parsed.junkId === materialId && Number(parsed.quantity) > 0) { materialRow = candidate; materialExtra = parsed; break; }
    }
    if (!materialRow) return json({ error: "insufficient_materials", materialId }, 409);
  }
  const nextExtra = { ...extra, empowerSlots: nextSlots };
  const now = nowIso();
  const result = { ...outcome };
  return runCharacterReceiptMutation(db, {
    id, characterId, operation, requestId: key, payloadJson,
    guardSql: `EXISTS (SELECT 1 FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND COALESCE(extra_json, '') = ? AND enhance_level = ?)
      AND EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND gold >= ? AND protection_stones >= ?)
      ${materialRow ? "AND EXISTS (SELECT 1 FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND COALESCE(extra_json, '') = ? AND CAST(json_extract(extra_json, '$.quantity') AS INTEGER) >= 1)" : ""}`,
    guardBinds: [row.item_id, id, characterId, row.extra_json || "", level, characterId, id, goldCost, protectionCost, ...(materialRow ? [materialRow.item_id, id, characterId, materialRow.extra_json || ""] : [])],
    mutationStatements: token => [
      db.prepare(`UPDATE items SET enhance_level = ?, extra_json = ?, updated_at = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND COALESCE(extra_json, '') = ? AND enhance_level = ? AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(nextLevel, JSON.stringify(nextExtra), now, row.item_id, id, characterId, row.extra_json || "", level, token),
      db.prepare(`UPDATE characters SET gold = gold - ?, protection_stones = protection_stones - ?, updated_at = ? WHERE character_id = ? AND player_id = ? AND gold >= ? AND protection_stones >= ? AND changes() = 1 AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`)
        .bind(goldCost, protectionCost, now, characterId, id, goldCost, protectionCost, token),
      ...(materialRow ? [Number(materialExtra.quantity) > 1
        ? db.prepare(`UPDATE items SET extra_json = ?, updated_at = ? WHERE item_id = ? AND player_id = ? AND character_id = ? AND COALESCE(extra_json, '') = ? AND changes() = 1 AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(JSON.stringify({ ...materialExtra, quantity: Number(materialExtra.quantity) - 1 }), now, materialRow.item_id, id, characterId, materialRow.extra_json || "", token)
        : db.prepare(`DELETE FROM items WHERE item_id = ? AND player_id = ? AND character_id = ? AND COALESCE(extra_json, '') = ? AND changes() = 1 AND EXISTS (SELECT 1 FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending')`).bind(materialRow.item_id, id, characterId, materialRow.extra_json || "", token)] : [])
    ], result
  });
}

async function handleGetInventory(db, id, session, characterId, page, pageSize) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error }, 401);
  if (characterId) {
    const owned = await verifyOwnedCharacter(db, id, characterId);
    if (owned.error) return json({ error: owned.error }, 403);
  }

  const p = Math.max(1, Number(page) || 1);
  const size = Math.min(200, Math.max(1, Number(pageSize) || 100));
  const offset = (p - 1) * size;
  const whereCol = characterId ? "character_id" : "player_id";
  const whereVal = characterId || id;

  const totalRow = await db.prepare(`SELECT COUNT(*) as c FROM items WHERE ${whereCol} = ?`).bind(whereVal).first();
  const total = totalRow ? totalRow.c : 0;
  const res = await db
    .prepare(`SELECT * FROM items WHERE ${whereCol} = ? ORDER BY rowid LIMIT ? OFFSET ?`)
    .bind(whereVal, size, offset)
    .all();

  return json({
    ok: true,
    page: p,
    pageSize: size,
    total,
    items: res.results || [],
    hasNext: offset + size < total,
  });
}

async function handleSetInventorySlot(db, id, session, characterId, itemId, inventorySlot) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  if (!itemId) return json({ error: "missing_fields" });
  const ownedCharacter = await verifyOwnedCharacter(db, id, characterId);
  if (ownedCharacter.error) return json({ error: ownedCharacter.error }, 403);

  const row = await db.prepare(`SELECT * FROM items WHERE player_id = ? AND character_id = ? AND item_id = ?`).bind(id, characterId, itemId).first();
  if (!row) return json({ error: "item_not_found" });
  if (!new Set(["junk", "potion", "weapon", "helmet", "chest", "gloves", "boots", "accessory", "wings"]).has(String(row.slot_type || ""))) {
    return json({ error: "invalid_item_slot_type" }, 400);
  }

  const slot = inventorySlot === undefined ? "" : inventorySlot;
  if (slot !== "" && (!Number.isInteger(slot) || slot < 0 || slot >= 5000)) return json({ error: "invalid_inventory_slot" }, 400);
  await db
    .prepare(`UPDATE items SET inventory_slot = ?, updated_at = ? WHERE player_id = ? AND character_id = ? AND item_id = ?`)
    .bind(slot, nowIso(), id, characterId, itemId)
    .run();

  return json({ ok: true, itemId: String(itemId), inventorySlot: slot });
}

// ---------- NEW: daily login ----------
async function handleGetDailyLogin(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const row = await getRow(db, "daily_login_claims", "character_id", characterId);
  const state = {
    loginStreak: row ? Number(row.login_streak) || 0 : 0,
    lastClaimDate: row ? row.last_claim_date || "" : "",
    totalClaims: row ? Number(row.total_claims) || 0 : 0,
  };
  const today = todayDateKey();
  const canClaim = state.lastClaimDate !== today;
  const previewStreak = state.lastClaimDate === yesterdayDateKey() ? state.loginStreak + 1 : 1;
  return json({ ok: true, state, canClaim, preview: { streak: previewStreak, reward: dailyLoginReward(previewStreak) } });
}

async function handleClaimDailyLogin(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const today = todayDateKey();
  const existingReceipt = await db.prepare(`SELECT reward_json FROM daily_login_claim_receipts WHERE character_id = ? AND claim_date = ?`)
    .bind(characterId, today).first();
  if (existingReceipt) {
    const reward = parseJsonColumn(existingReceipt.reward_json, {});
    const row = await getRow(db, "daily_login_claims", "character_id", characterId);
    return json({ ok: true, replayed: true, reward: reward.reward, streak: reward.streak, state: {
      loginStreak: Number(row?.login_streak) || 0, lastClaimDate: row?.last_claim_date || today, totalClaims: Number(row?.total_claims) || 0
    }, ...(await battleCompletionSnapshot(db, id, characterId)) });
  }

  const row = await getRow(db, "daily_login_claims", "character_id", characterId);
  const lastClaimDate = row ? row.last_claim_date || "" : "";
  if (lastClaimDate === today) return json({ error: "already_claimed" });
  const prevStreak = row ? Number(row.login_streak) || 0 : 0;
  const streak = lastClaimDate === yesterdayDateKey() ? prevStreak + 1 : 1;
  const rewardDef = dailyLoginReward(streak);
  const reward = { gold: rewardDef.gold, diamonds: rewardDef.diamonds, junk: rewardDef.junk || [], items: [] };
  if (rewardDef.mythicSetFamily) {
    const family = String(rewardDef.mythicSetFamily || "").toLowerCase();
    const slots = globalThis.MYTHIC_V2?.SET_SLOTS || [];
    const slot = slots.length ? slots[Math.floor(secureRandomUnit() * slots.length)] : "";
    const floor = Math.max(1, Number(owned.row.unlocked_floor) || 1);
    const recipe = slot ? globalThis.MYTHIC_V2?.setRecipe(family, slot, floor) : null;
    const item = recipe ? globalThis.MYTHIC_V2?.createMythicItem(recipe, floor, secureRandomUnit) : null;
    if (!item) return json({ error: "daily_reward_contract_unavailable" }, 503);
    reward.items = [{
      ...item,
      sourceType: "daily_login",
      sourceIdentity: `daily_login:day7:${family}`,
      rewardVersion: 2,
      itemModelVersion: 2
    }];
  }
  const totalClaims = (row ? Number(row.total_claims) || 0 : 0) + 1;
  const claimToken = crypto.randomUUID();
  const now = nowIso();
  const rewardReceipt = { reward, streak };
  const gate = {
    sql: `EXISTS (SELECT 1 FROM daily_login_claim_receipts WHERE character_id = ? AND claim_date = ? AND claim_token = ?)`,
    binds: [characterId, today, claimToken]
  };
  const rewardRow = {
    mail_id: `daily-login:${characterId}:${today}`,
    gold: reward.gold, diamonds: reward.diamonds,
    junk_json: JSON.stringify(reward.junk), items_json: JSON.stringify(reward.items)
  };
  const statements = [db.prepare(
    `INSERT INTO daily_login_claim_receipts (character_id, claim_date, claim_token, reward_json, created_at)
     SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM daily_login_claims WHERE character_id = ? AND last_claim_date = ?)
     ON CONFLICT(character_id, claim_date) DO NOTHING`
  ).bind(characterId, today, claimToken, JSON.stringify(rewardReceipt), now, characterId, today)];
  statements.push(db.prepare(
    `INSERT INTO daily_login_claims (character_id, login_streak, last_claim_date, total_claims, updated_at)
     SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM daily_login_claim_receipts WHERE character_id = ? AND claim_date = ? AND claim_token = ?)
     ON CONFLICT(character_id) DO UPDATE SET login_streak = excluded.login_streak, last_claim_date = excluded.last_claim_date,
       total_claims = excluded.total_claims, updated_at = excluded.updated_at
     WHERE daily_login_claims.last_claim_date <> excluded.last_claim_date
       AND EXISTS (SELECT 1 FROM daily_login_claim_receipts WHERE character_id = ? AND claim_date = ? AND claim_token = ?)`
  ).bind(characterId, streak, today, totalClaims, now, characterId, today, claimToken, characterId, today, claimToken));
  statements.push(...await mailboxRewardStatements(db, id, characterId, rewardRow, now, 0, gate));
  const batchResults = await db.batch(statements);

  const canonical = await db.prepare(`SELECT reward_json FROM daily_login_claim_receipts WHERE character_id = ? AND claim_date = ?`).bind(characterId, today).first();
  const committed = parseJsonColumn(canonical?.reward_json, rewardReceipt);
  const latest = await getRow(db, "daily_login_claims", "character_id", characterId);
  return json({ ok: true, replayed: !(Number(batchResults?.[0]?.meta?.changes) > 0),
    reward: committed.reward, streak: committed.streak, state: {
      loginStreak: Number(latest?.login_streak) || 0, lastClaimDate: latest?.last_claim_date || today, totalClaims: Number(latest?.total_claims) || 0
    }, ...(await battleCompletionSnapshot(db, id, characterId)) });
}

// ---------- Mailbox: generic reward delivery queue ----------
// ---------- Wave 4 Mythic crafting ----------
// The Worker resolves canonical V2 recipes, Tier, stats, identity, costs, and random
// Accessory utility. The request id is only an idempotency key; it is not an RNG seed.
// One D1 batch conditionally inserts the result and then spends the matching resources.
async function handleCraftItem(db, id, session, characterId, recipeId, requestId) {
  const auth = session?.__characterAuth?.auth || await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = session?.__characterAuth?.owned || await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const character = owned.row;
  const floor = Math.max(1, Number(character.unlocked_floor) || 1);
  const canonicalRecipe = globalThis.MYTHIC_V2.recipeById(recipeId, floor);
  if (!canonicalRecipe) return json({ error: "recipe_not_found" });
  const operationId = String(requestId || "").trim();
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(operationId)) return json({ error: "invalid_request_id" });
  const existing = await db.prepare(`SELECT * FROM items WHERE character_id = ? AND json_extract(extra_json, '$.craftRequestId') = ? LIMIT 1`).bind(characterId, operationId).first();
  if (existing) {
    const extra = parseJsonColumn(existing.extra_json, {});
    return json({ ok: true, replayed: true, item: {
      id: existing.item_id, type: existing.slot_type, rarity: existing.rarity, name: existing.name,
      atk: Number(existing.atk) || 0, def: Number(existing.def) || 0, hp: Number(existing.hp) || 0, mp: Number(existing.mp) || 0,
      ...extra
    }, consumed: extra.craftConsumed || [], goldSpent: Number(extra.craftGoldSpent) || 0, craftedAtFloor: Number(extra.sourceFloor) || floor,
      ...(await battleCompletionSnapshot(db, id, characterId)) });
  }
  const materials = canonicalRecipe.materials;
  const goldCost = Number(materials.gold) || 0;
  if (goldCost > 0 && (Number(character.gold) || 0) < goldCost) {
    return json({ error: "insufficient_gold", need: goldCost, have: Number(character.gold) || 0 });
  }

  const junkNeeds = Object.keys(materials)
    .filter((k) => k !== "gold")
    .map((k) => ({ junkId: k, qty: Number(materials[k]) || 0 }))
    .filter((m) => m.qty > 0);

  // Fresh read of this character's own junk stacks — junkId AND the real stack quantity
  // both ride inside extra_json (see itemsToServerList in serialize.js: the client never
  // sends a top-level `quantity` at all for junk, only extra.quantity — the DB column just
  // sits at its schema default of 1 for every junk row, decorative and unused elsewhere).
  // BUG FIX: this used to read the top-level `quantity` column, which is always 1 no
  // matter how large a stack actually is — that's what caused "have 1/6" even when a
  // player had a real stack of e.g. 17.
  const junkRowsRes = await db
    .prepare(`SELECT item_id, extra_json FROM items WHERE player_id = ? AND character_id = ? AND slot_type = 'junk'`)
    .bind(id, characterId)
    .all();
  const junkRows = (junkRowsRes.results || []).map((r) => {
    let extra = {};
    try { extra = JSON.parse(r.extra_json || "{}"); } catch (e) { extra = {}; }
    return { item_id: r.item_id, quantity: Number(extra.quantity) || 0, junkId: extra.junkId, extra, rawExtra: r.extra_json || "" };
  });

  for (const need of junkNeeds) {
    const have = junkRows.filter((r) => r.junkId === need.junkId).reduce((s, r) => s + r.quantity, 0);
    if (have < need.qty) return json({ error: "insufficient_materials", junkId: need.junkId, need: need.qty, have });
  }

  const now = nowIso();
  const operationToken = crypto.randomUUID();
  let seed = 2166136261;
  for (const ch of operationToken) { seed ^= ch.charCodeAt(0); seed = Math.imul(seed, 16777619); }
  const authoritativeRng = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const item = globalThis.MYTHIC_V2.createMythicItem(canonicalRecipe, floor, authoritativeRng);
  const newItemId = `item-craft-${characterId}-${operationId}`.slice(0, 160);
  const extra = {
    empowerSlots: item.empowerSlots, empowerSlotCapacity: 4, rewardVersion: 2, itemModelVersion: 2,
    gearTier: item.gearTier, sourceType: item.sourceType, sourceFloor: item.sourceFloor,
    specialSource: item.specialSource, sourceIdentity: item.sourceIdentity, utilityStat: item.utilityStat,
    dodgeChance: item.dodgeChance, critChance: item.critChance, critDamage: item.critDamage,
    setId: item.setId, craftRecipeId: recipeId, bossWeaponId: item.bossWeaponId,
    signatureId: item.signatureId, sourceBossId: item.sourceBossId, craftRequestId: operationId,
    craftConsumed: junkNeeds, craftGoldSpent: goldCost, craftPendingToken: operationToken
  };
  const inventoryPlan = await loadMailSettlementState(db, id, characterId, null, { reconcile: false });
  for (const need of junkNeeds) {
    const left = inventoryPlanConsume(inventoryPlan,
      entry => String(entry.raw.slot_type || "") === "junk" && String(entry.extra?.junkId || "") === String(need.junkId),
      need.qty);
    if (left > 0) return json({ error: "insufficient_materials", junkId: need.junkId, need: need.qty, have: need.qty - left });
  }
  const craftRow = {
    item_id: newItemId, slot_type: item.type, equipped: 0, inventory_slot: "", item_template_id: recipeId,
    rarity: "mythic", name: item.name, item_level: 0, enhance_level: 0, bound: 0, quantity: 1,
    atk: Number(item.atk) || 0, def: Number(item.def) || 0, hp: Number(item.hp) || 0, mp: Number(item.mp) || 0,
    extra_json: JSON.stringify(extra)
  };
  inventoryPlanAddRow(inventoryPlan, craftRow, { originType: "craft", sourceId: recipeId, context: { recipeId, floor } });
  const craftEntry = inventoryPlan.entries.find(entry => entry.new && String(entry.raw.item_id) === newItemId);
  if (!craftEntry) return json({ error: "craft_capacity_conflict", retry: true }, 409);
  reconcileMailOverflow(inventoryPlan);
  const resourceConditions = junkNeeds.map(() => `(SELECT COALESCE(SUM(CAST(json_extract(extra_json, '$.quantity') AS INTEGER)), 0) FROM items WHERE player_id = ? AND character_id = ? AND slot_type = 'junk' AND json_extract(extra_json, '$.junkId') = ?) >= ?`);
  const resourceBinds = junkNeeds.flatMap(need => [id, characterId, need.junkId, need.qty]);
  const insertWhere = [`EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ? AND gold >= ?)`].concat(resourceConditions).join(" AND ");
  const stmts = [db.prepare(
    `INSERT OR IGNORE INTO items (item_id, player_id, character_id, slot_type, equipped, inventory_slot, item_template_id, rarity, name, item_level, enhance_level, bound, quantity, atk, def, hp, mp, extra_json, created_at, updated_at)
     SELECT ?, ?, ?, ?, 0, '', ?, 'mythic', ?, 0, 0, 0, 1, ?, ?, ?, ?, ?, ?, ? WHERE ${insertWhere}`
  ).bind(newItemId, id, characterId, item.type, recipeId, item.name, Number(item.atk) || 0, Number(item.def) || 0, Number(item.hp) || 0, Number(item.mp) || 0, JSON.stringify(craftEntry.extra), now, now, characterId, id, goldCost, ...resourceBinds)];
  const craftLogGate = `EXISTS (SELECT 1 FROM items marker WHERE marker.item_id = ? AND marker.character_id = ? AND json_extract(marker.extra_json, '$.craftPendingToken') = ?)`;
  const craftLogBinds = [newItemId, characterId, operationToken];
  stmts.push(itemProvenanceStatement(db, newItemId, id, characterId, "craft", recipeId, { recipeId, floor }, now, craftLogGate, craftLogBinds));
  stmts.push(itemOwnershipAcquireStatement(db, newItemId, id, characterId, "craft", { recipeId, floor }, now, craftLogGate, craftLogBinds));
  const planWithoutCraft = { ...inventoryPlan, entries: inventoryPlan.entries.filter(entry => entry !== craftEntry) };
  stmts.push(...mailPlanPersistenceStatements(db, planWithoutCraft, id, characterId, now, craftLogGate, craftLogBinds));
  if (goldCost > 0) {
    stmts.push(db.prepare(`UPDATE characters SET gold = gold - ?, updated_at = ? WHERE character_id = ? AND gold >= ? AND EXISTS (SELECT 1 FROM items marker WHERE marker.item_id = ? AND json_extract(marker.extra_json, '$.craftPendingToken') = ?)`)
      .bind(goldCost, now, characterId, goldCost, newItemId, operationToken));
  }
  const finalizedExtra = { ...craftEntry.extra }; delete finalizedExtra.craftPendingToken;
  stmts.push(db.prepare(`UPDATE items SET extra_json = ?, updated_at = ? WHERE item_id = ? AND character_id = ? AND json_extract(extra_json, '$.craftPendingToken') = ?`)
    .bind(JSON.stringify(finalizedExtra), now, newItemId, characterId, operationToken));
  const batch = await db.batch(stmts);
  if ((Number(batch?.[0]?.meta?.changes) || 0) !== 1) return json({ error: "craft_conflict", retry: true }, 409);

  return json({
    ok: true,
    item: {
      ...item,
      id: newItemId,
    },
    consumed: junkNeeds,
    goldSpent: goldCost,
    craftedAtFloor: floor,
    ...(await battleCompletionSnapshot(db, id, characterId)),
  });
}

// ---------- Phase 3: Raid Boss ----------
// One shared boss per day, rotates through this list as each one dies (spawnIndex =
// how many have already spawned today, scales hpMax up a bit each respawn so later
// bosses in the day are a bit tougher once the playerbase has more total damage output).
const RAID_BOSS_DEFS = [
  { id: "azure_angel", name: "Azure Angel", hpBase: 150000, family: "azure" },
  { id: "robo_phoenix", name: "Robo Phoenix", hpBase: 260000, family: "robot" },
  { id: "dark_dragonlord", name: "Dark Dragonlord", hpBase: 420000, family: "skeleton" },
];
const RAID_STAMINA_MAX = 10;
const RAID_STAMINA_REGEN_MS = 15 * 60 * 1000; // +1 every 15 minutes
const RAID_DIAMOND_REFILL_COST = 50; // per extra attack once stamina hits 0
const RAID_HITS_PER_ATTACK = 3; // mini combat round per attack, not a single flat hit

function resolveRaidStamina(stored, updatedAtIso) {
  const rawStamina = Number(stored);
  const storedStamina = Number.isFinite(rawStamina) ? Math.max(0, Math.min(RAID_STAMINA_MAX, Math.floor(rawStamina))) : RAID_STAMINA_MAX;
  if (storedStamina >= RAID_STAMINA_MAX) {
    return { stamina: RAID_STAMINA_MAX, updatedAt: "" };
  }
  const updatedAtMs = Date.parse(updatedAtIso || "");
  // A missing/malformed checkpoint must not turn stamina into NaN and crash every Raid
  // request. Start a fresh regeneration window while preserving the stored amount.
  if (!Number.isFinite(updatedAtMs)) {
    return { stamina: storedStamina, updatedAt: new Date(Date.now()).toISOString() };
  }
  const elapsedMs = Math.max(0, Date.now() - updatedAtMs);
  const ticks = Math.floor(elapsedMs / RAID_STAMINA_REGEN_MS);
  if (ticks <= 0) return { stamina: storedStamina, updatedAt: updatedAtIso };
  const stamina = Math.min(RAID_STAMINA_MAX, storedStamina + ticks);
  const updatedAt = stamina >= RAID_STAMINA_MAX ? "" : new Date(updatedAtMs + ticks * RAID_STAMINA_REGEN_MS).toISOString();
  return { stamina, updatedAt };
}
function raidStaminaSecondsToNext(updatedAtIso) {
  if (!updatedAtIso) return 0;
  const updatedAtMs = Date.parse(updatedAtIso);
  if (!Number.isFinite(updatedAtMs)) return Math.round(RAID_STAMINA_REGEN_MS / 1000);
  const elapsedMs = Math.max(0, Date.now() - updatedAtMs);
  const remaining = RAID_STAMINA_REGEN_MS - (elapsedMs % RAID_STAMINA_REGEN_MS);
  return Math.max(0, Math.round(remaining / 1000));
}

const RAID_FAMILIES = Object.freeze({ azure: { name: "Azure", primary: "AGI" }, robot: { name: "Robot", primary: "VIT" }, skeleton: { name: "Skeleton", primary: "STR" } });
const RAID_WING_RARITIES = Object.freeze({ rare: 1, unique: 2, elite: 3, mythic: 4 });
function raidFamilyForBoss(def) { return RAID_FAMILIES[def?.family] ? def.family : "azure"; }
function raidWingItemDesc(family, rarity) {
  const f = RAID_FAMILIES[family] ? family : "azure";
  const r = String(rarity || "rare").toLowerCase();
  const capacity = RAID_WING_RARITIES[r] || RAID_WING_RARITIES.rare;
  return {
    type: "wings", rarity: r, name: `${RAID_FAMILIES[f].name} Wings`, wingFamily: f,
    rewardVersion: 2, itemModelVersion: 2, empowerSlotCapacity: capacity, empowerSlotCount: capacity,
    empowerSlots: globalThis.ENHANCEMENT_V2_RULES?.fillEmpowerSlots
      ? globalThis.ENHANCEMENT_V2_RULES.fillEmpowerSlots("wings", r, secureRandomUnit)
      : Array(capacity).fill(null), sourceType: "raid", sourceIdentity: `raid_wing:${f}`
  };
}
// Recipes are inert placeholder items (stackable, riding the existing junk pipeline) until
// the Crafting phase exists to consume them — see JUNK_INFO/recipe_* entries in enhancement.js.
function randomSetRecipeJunkId(family) {
  const f = RAID_FAMILIES[family] ? family : "azure";
  const slots = ["helmet", "chest", "gloves", "boots", "weapon", "ring"];
  return `recipe_${f}_${slots[Math.floor(Math.random() * slots.length)]}`;
}
// Boss horn/hide — a single shared material pool across all boss types (not per-boss for now).
function randomBossMaterialJunkId() {
  return Math.random() < 0.5 ? "bossHorn" : "bossHide";
}

// Rank rewards, keyed by cumulative CONTRIBUTION (total_contribution) across the whole
// raid instance — settled for EVERY participant (rank 1..last), not just a top-N cutoff.
// Rank 1-3 get a family Wing + boss materials + a random matching recipe; everyone ranked
// 4th or lower gets 2 random boss materials as a consolation.
const RAID_RANK_REWARDS = [
  { wingRarity: "mythic", junk: [{ junkId: "bossHorn", quantity: 3 }, { junkId: "bossHide", quantity: 3 }], recipe: true },
  { wingRarity: "elite", junk: [{ junkId: "bossHorn", quantity: 2 }, { junkId: "bossHide", quantity: 2 }], recipe: true },
  { wingRarity: "unique", junk: [{ junkId: "bossHorn", quantity: 1 }, { junkId: "bossHide", quantity: 1 }], recipe: true },
];

// Milestones — % of boss hpMax the character has personally CONTRIBUTED this raid instance
// (rewards the players who carry the server boss, not just whoever gets lucky crits).
// Every 5% -> diamonds. Every 10% -> 1 random boss material (on top of the 5% diamonds).
// 25% -> 1★ wing, 50% -> 3★ wing, 75% -> random azure recipe, 99% -> a full random azure item.
const RAID_MILESTONE_STEP = 5; // percent
const RAID_MILESTONE_DIAMOND_PER_STEP = 5;

function raidBossDefById(defId) {
  return RAID_BOSS_DEFS.find((b) => b.id === defId) || RAID_BOSS_DEFS[0];
}

// Raid resets at Thai midnight specifically (not the UTC boundary todayDateKey() uses for
// daily login), so it gets its own +7h-shifted date key.
function raidDateKey() {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Fetches today's live boss, or spawns the next one in rotation if there isn't one yet
// or the last one is already dead. Never returns a dead boss.
async function getOrCreateActiveRaid(db) {
  const today = raidDateKey();
  const row = await db
    .prepare(`SELECT * FROM raid_boss_state WHERE date = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(today)
    .first();
  if (row && Number(row.boss_hp_current) > 0) return row;

  // Which boss is next: continue the rotation from whichever boss spawned most recently,
  // across ALL dates (not just today) — using "how many spawned today" as the rotation
  // index always restarts at 0 every new calendar day, which is the bug that made every
  // day show the same first boss (Azure Angel) regardless of how many days had passed.
  // This only needs the single latest row, so it's unaffected by the 7-day retention
  // cleanup pruning old raid_boss_state rows.
  const lastRow = await db.prepare(`SELECT boss_def_id FROM raid_boss_state ORDER BY created_at DESC LIMIT 1`).first();
  const lastIndex = lastRow ? RAID_BOSS_DEFS.findIndex((b) => b.id === lastRow.boss_def_id) : -1;
  const nextIndex = (lastIndex + 1 + RAID_BOSS_DEFS.length) % RAID_BOSS_DEFS.length;
  const def = RAID_BOSS_DEFS[nextIndex];

  // HP scaling still escalates per spawn WITHIN today specifically (later respawns/resets
  // the same day are tougher), independent of which boss it happens to be.
  const cntRow = await db.prepare(`SELECT COUNT(*) as c FROM raid_boss_state WHERE date = ?`).bind(today).first();
  const spawnCountToday = cntRow ? Number(cntRow.c) || 0 : 0;
  const hpMax = Math.round(def.hpBase * (1 + spawnCountToday * 0.2));
  const raidId = `raid-${today}-${nextIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO raid_boss_state (raid_id, date, boss_def_id, boss_hp_max, boss_hp_current, settled_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '', ?, ?)`
    )
    .bind(raidId, today, def.id, hpMax, hpMax, now, now)
    .run();
  return { raid_id: raidId, date: today, boss_def_id: def.id, boss_hp_max: hpMax, boss_hp_current: hpMax, settled_at: "", created_at: now, updated_at: now };
}

// Settles (and closes out) any raid instance whose date has rolled past today — this is what
// makes the "changes every midnight even if the boss is still alive" rule actually happen,
// since getOrCreateActiveRaid alone would just silently start ignoring the old raid_id without
// ever paying out its rank rewards. Call from scheduled() — see bottom of file. Needs the Cron
// Trigger (Dashboard -> this worker -> Trigger Events) to fire at least roughly daily around
// 17:00 UTC (00:00 ICT) for the reset to land on time; it's safe to run more often too, since
// settleRaidRank() is idempotent (guarded by settled_at).
async function closeOutExpiredRaids(db) {
  const today = raidDateKey();
  const stale = await db.prepare(`SELECT raid_id FROM raid_boss_state WHERE date != ? AND settled_at = ''`).bind(today).all();
  for (const row of stale.results || []) {
    await settleRaidRank(db, row.raid_id);
  }
}

// Ported subset of characterBaseStats/itemBonus above — returns only what raid combat
// needs (atk/crit) rather than the full CP number, so this stays decoupled from the
// leaderboard CP formula (don't merge these; CP formula changes shouldn't silently
// reshape raid damage and vice versa).
function raidCombatStats(character, equippedItems) {
  const s = {
    str: Number(character.str) || 0, vit: Number(character.vit) || 0, agi: Number(character.agi) || 0,
    dex: Number(character.dex) || 0, luk: Number(character.luk) || 0,
  };
  const level = Number(character.level) || 1;
  const base = characterBaseStats(level, s);
  const eb = { atk: 0, str: 0, critChance: 0, critDamage: 0 };
  (equippedItems || []).forEach((it) => {
    const ib = itemBonus(it);
    eb.atk += ib.atk;
    eb.str += ib.str || 0;
    eb.critChance += ib.critChance || 0;
    eb.critDamage += ib.critDamage || 0;
  });
  const setEffects = globalThis.MYTHIC_V2.setEffects(mythicEquippedFromRows(equippedItems));
  eb.str += setEffects.str;
  eb.critDamage += setEffects.critDamage;
  return {
    atk: Math.round(base.atk + eb.atk + eb.str * 3),
    critChance: Math.min(100, Math.round((base.critChance + eb.critChance) * 10) / 10),
    critDamage: Math.round((base.critDamage + eb.critDamage) * 10) / 10,
  };
}

// One "attack" = a short simulated combat round (a few swings with crit rolls), not a
// single flat hit — keeps some randomness/excitement per attempt like real combat.
function simulateRaidAttack(stats) {
  let total = 0;
  let anyCrit = false;
  for (let i = 0; i < RAID_HITS_PER_ATTACK; i++) {
    const variance = 0.85 + Math.random() * 0.3;
    let dmg = stats.atk * variance;
    if (Math.random() * 100 < stats.critChance) {
      dmg *= 1 + stats.critDamage / 100;
      anyCrit = true;
    }
    total += dmg;
  }
  return { damage: Math.max(1, Math.round(total)), crit: anyCrit };
}

function raidAccessoryRewardDesc(floor, rarity) {
  const item = globalThis.DUNGEON_REWARD_V2.dungeonV2EquipmentItem({
    floor, type: "accessory", rarity, sourceType: "raid_milestone", sourceIdentity: "raid:accessory", rng: Math.random
  });
  return item;
}
function raidSetItemRewardDesc(family, floor) {
  const slots = globalThis.MYTHIC_V2.SET_SLOTS;
  const slot = slots[Math.floor(Math.random() * slots.length)];
  const recipe = globalThis.MYTHIC_V2.setRecipe(family, slot, floor);
  const item = globalThis.MYTHIC_V2.createMythicItem(recipe, floor, Math.random);
  return item ? { ...item, sourceType: "raid_milestone", sourceIdentity: `raid:99:${family}`, rewardVersion: 2, itemModelVersion: 2 } : null;
}

// Grants rank-bonus rewards once, the instant the boss dies. Guarded by an atomic
// UPDATE on settled_at (only succeeds for whichever concurrent attack request gets
// there first) so two players killing it in the same instant can't double-pay rewards.
// Grants rank rewards once, either the instant the boss dies OR when closeOutExpiredRaids()
// force-closes an unfinished raid at the daily reset. Guarded by an atomic UPDATE on
// settled_at so it can only ever run once per raid_id even under concurrent triggers.
// Ranked by cumulative CONTRIBUTION (not best single hit) across ALL participants —
// rank 1-3 get the big reward, everyone else (4th..last) gets a consolation.
async function settleRaidRank(db, raidId) {
  const guard = await db
    .prepare(`UPDATE raid_boss_state SET settled_at = ? WHERE raid_id = ? AND settled_at = ''`)
    .bind(nowIso(), raidId)
    .run();
  if (!guard.meta || !guard.meta.changes) return; // already settled

  const bossRow = await db.prepare(`SELECT boss_def_id FROM raid_boss_state WHERE raid_id = ?`).bind(raidId).first();
  const bossDef = raidBossDefById(bossRow ? bossRow.boss_def_id : "");
  const bossName = bossDef.name;
  const family = raidFamilyForBoss(bossDef);
  const allRes = await db
    .prepare(`SELECT character_id, total_contribution FROM raid_participants WHERE raid_id = ? ORDER BY total_contribution DESC`)
    .bind(raidId)
    .all();
  const rows = allRes.results || [];

  for (let i = 0; i < rows.length; i++) {
    const top = RAID_RANK_REWARDS[i];
    if (top) {
      const junk = top.junk.slice();
      if (top.recipe) junk.push({ junkId: randomSetRecipeJunkId(family), quantity: 1 });
      await sendMail(
        db, rows[i].character_id, `🏆 อันดับ ${i + 1} ศึก ${bossName}`,
        `คุณจบการล่า ${bossName} ในอันดับที่ ${i + 1} ด้วยดาเมจสะสม ${rows[i].total_contribution}`,
        { junk, items: [raidWingItemDesc(family, top.wingRarity)] }, `raid:rank:${raidId}:${rows[i].character_id}`
      );
    } else {
      await sendMail(
        db, rows[i].character_id, `⚔️ ร่วมศึก ${bossName}`, `อันดับที่ ${i + 1} ในการล่าครั้งนี้ — ได้วัตถุดิบติดไม้ติดมือ`,
        { junk: [{ junkId: randomBossMaterialJunkId(), quantity: 1 }, { junkId: randomBossMaterialJunkId(), quantity: 1 }] },
        `raid:rank:${raidId}:${rows[i].character_id}`
      );
    }
  }
}

async function handleGetRaidStatus(db, id, session, characterId) {
  // These three are fully independent reads (auth check, ownership check, and the raid's
  // own state don't depend on each other) — firing them together instead of one-after-
  // another cuts several D1 round trips down to the time of the single slowest one. Same
  // pattern below for the participant/leaderboard reads once raid_id is known.
  const [auth, owned, raid] = await Promise.all([verifyPlayer(db, id, session), verifyOwnedCharacter(db, id, characterId), getOrCreateActiveRaid(db)]);
  if (auth.error) return json({ error: auth.error });
  if (owned.error) return json({ error: owned.error });

  const def = raidBossDefById(raid.boss_def_id);
  const [participant, topRes] = await Promise.all([
    db.prepare(`SELECT * FROM raid_participants WHERE raid_id = ? AND character_id = ?`).bind(raid.raid_id, characterId).first(),
    db.prepare(`SELECT character_id, name, total_damage, total_contribution FROM raid_participants WHERE raid_id = ? ORDER BY total_contribution DESC LIMIT 10`).bind(raid.raid_id).all(),
  ]);

  const staminaState = resolveRaidStamina(owned.row.raid_stamina, owned.row.raid_stamina_updated_at);
  const contribution = participant ? Number(participant.total_contribution) || 0 : 0;
  return json({
    ok: true,
    boss: { raidId: raid.raid_id, defId: def.id, name: def.name, family: raidFamilyForBoss(def), hpMax: Number(raid.boss_hp_max), hpCurrent: Number(raid.boss_hp_current) },
    me: {
      stamina: staminaState.stamina,
      staminaMax: RAID_STAMINA_MAX,
      staminaRegenSeconds: raidStaminaSecondsToNext(staminaState.updatedAt),
      diamondRefillCost: RAID_DIAMOND_REFILL_COST,
      bestHit: participant ? Number(participant.total_damage) || 0 : 0,
      contribution,
      contributionPct: Math.min(100, Math.round((contribution / Number(raid.boss_hp_max)) * 1000) / 10),
      milestonesClaimed: participant ? (participant.milestone_claimed || "").split(",").filter(Boolean) : [],
    },
    milestoneStep: RAID_MILESTONE_STEP,
    milestoneSpecials: [
      { pct: 25, label: `${RAID_FAMILIES[raidFamilyForBoss(def)].name} Wings Rare` }, { pct: 50, label: "Accessory Unique/Elite" },
      { pct: 75, label: `แบบร่างชุด ${RAID_FAMILIES[raidFamilyForBoss(def)].name}` }, { pct: 99, label: `ไอเทมชุด ${RAID_FAMILIES[raidFamilyForBoss(def)].name}` },
    ],
    top: topRes.results || [],
  });
}

async function handleAttackRaidBoss(db, id, session, characterId, paidDiamonds, requestId) {
  // See handleGetRaidStatus for why these four are safe to fire concurrently — the equipped-
  // items read only needs characterId, so it doesn't have to wait for raid/ownership either.
  const [auth, owned, raid, itemsRes] = await Promise.all([
    verifyPlayer(db, id, session),
    verifyOwnedCharacter(db, id, characterId),
    getOrCreateActiveRaid(db),
    db.prepare(`SELECT slot_type, rarity, name, atk, def, hp, mp, extra_json, enhance_level FROM items WHERE character_id = ? AND equipped = 1`).bind(characterId).all(),
  ]);
  if (auth.error) return json({ error: auth.error });
  if (owned.error) return json({ error: owned.error });
  const character = owned.row;

  if (Number(raid.boss_hp_current) <= 0) return json({ error: "boss_already_dead" });
  const key = String(requestId || "");
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(key)) return json({ error: "request_id_required" }, 400);
  const operation = "raid_attack";
  const payloadJson = JSON.stringify({ paidDiamonds: !!paidDiamonds, raidId: raid.raid_id });
  const existing = await db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`).bind(characterId, operation, key).first();
  if (existing) {
    if (existing.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
    if (existing.result_json === "pending") return json({ error: "operation_in_progress", retry: true }, 409);
    return json({ ...parseJsonColumn(existing.result_json, {}), replayed: true });
  }
  const operationToken = randomToken(16);
  const claimedReceipt = await db.prepare(`INSERT INTO character_operation_receipts (character_id, operation, request_id, operation_token, payload_json, result_json, created_at)
    SELECT ?, ?, ?, ?, ?, 'pending', ? WHERE EXISTS (SELECT 1 FROM characters WHERE character_id = ? AND player_id = ?)
    ON CONFLICT(character_id, operation, request_id) DO NOTHING`)
    .bind(characterId, operation, key, operationToken, payloadJson, nowIso(), characterId, id).run();
  if (!claimedReceipt.meta?.changes) {
    const prior = await db.prepare(`SELECT payload_json, result_json FROM character_operation_receipts WHERE character_id = ? AND operation = ? AND request_id = ?`).bind(characterId, operation, key).first();
    if (prior?.payload_json !== payloadJson) return json({ error: "operation_request_conflict" }, 409);
    return prior?.result_json === "pending" ? json({ error: "operation_in_progress", retry: true }, 409) : json({ ...parseJsonColumn(prior?.result_json, {}), replayed: true });
  }
  const clearPendingReceipt = () => db.prepare(`DELETE FROM character_operation_receipts WHERE operation_token = ? AND result_json = 'pending'`).bind(operationToken).run();

  // Stamina is per-character and regenerates over time. Reserve it before applying damage
  // with a compare-and-swap update, so two simultaneous taps cannot both spend the same
  // final stamina point. Paid attacks are also charged atomically on the authoritative
  // player row; never trust the client's paidDiamonds flag as proof of payment. This has to
  // stay its own round trip (can't be folded into the batch below) — if the CAS/charge
  // fails, the batch's damage + participant writes must not happen at all, and D1 batches
  // don't support conditionally skipping later statements based on an earlier one's result.
  const staminaState = resolveRaidStamina(character.raid_stamina, character.raid_stamina_updated_at);
  let spentStamina = false;
  let diamondsSpent = 0;
  let newStamina = staminaState.stamina;
  let newStaminaUpdatedAt = staminaState.updatedAt;
  if (staminaState.stamina >= 1) {
    spentStamina = true;
    newStamina = staminaState.stamina - 1;
    newStaminaUpdatedAt = staminaState.updatedAt || nowIso();
    const storedStamina = Number.isFinite(Number(character.raid_stamina)) ? Number(character.raid_stamina) : RAID_STAMINA_MAX;
    const storedUpdatedAt = character.raid_stamina_updated_at || "";
    const reserved = await db
      .prepare(`UPDATE characters SET raid_stamina = ?, raid_stamina_updated_at = ? WHERE character_id = ? AND raid_stamina = ? AND raid_stamina_updated_at = ?`)
      .bind(newStamina, newStaminaUpdatedAt, characterId, storedStamina, storedUpdatedAt)
      .run();
    if (!reserved.meta || !reserved.meta.changes) {
      await clearPendingReceipt();
      return json({ error: "stamina_conflict", retry: true });
    }
  } else if (!paidDiamonds) {
    await clearPendingReceipt();
    return json({ error: "no_stamina", diamondRefillCost: RAID_DIAMOND_REFILL_COST, staminaRegenSeconds: raidStaminaSecondsToNext(staminaState.updatedAt) });
  } else {
    const charged = await db
      .prepare(`UPDATE players SET diamonds = diamonds - ? WHERE id = ? AND diamonds >= ?`)
      .bind(RAID_DIAMOND_REFILL_COST, id, RAID_DIAMOND_REFILL_COST)
      .run();
    if (!charged.meta || !charged.meta.changes) {
      await clearPendingReceipt();
      return json({ error: "insufficient_diamonds", diamondRefillCost: RAID_DIAMOND_REFILL_COST });
    }
    diamondsSpent = RAID_DIAMOND_REFILL_COST;
  }

  const stats = raidCombatStats(character, itemsRes.results || []);
  const hit = simulateRaidAttack(stats);
  const hpBefore = Number(raid.boss_hp_current);
  const appliedDamage = Math.min(hit.damage, hpBefore); // this character's actual contribution to the shared boss HP
  const now = nowIso();

  // Both writes use RETURNING so this single batch also gets us the numbers we need back —
  // no separate SELECT before (to know the participant's prior best/contribution) or after
  // (to read the boss's post-hit HP). MAX()/+= happen in SQL against the live row, which is
  // also correctness-safer than the old read-then-write-computed-value approach: two
  // concurrent hits reading the same stale contribution total could otherwise silently lose
  // one of them, the same race class the stamina CAS above exists to prevent.
  const [bossBatch, participantBatch] = await db.batch([
    db.prepare(`UPDATE raid_boss_state SET boss_hp_current = MAX(0, boss_hp_current - ?), updated_at = ? WHERE raid_id = ? AND boss_hp_current > 0 RETURNING boss_hp_current`).bind(hit.damage, now, raid.raid_id),
    db.prepare(
      `INSERT INTO raid_participants (raid_id, character_id, player_id, name, total_damage, total_contribution, attempts_used, milestone_claimed, last_hit_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, '', ?)
       ON CONFLICT(raid_id, character_id) DO UPDATE SET
         total_damage = MAX(total_damage, excluded.total_damage),
         total_contribution = total_contribution + excluded.total_contribution,
         attempts_used = attempts_used + 1,
         name = excluded.name,
         last_hit_at = excluded.last_hit_at
       RETURNING total_damage, total_contribution`
    ).bind(raid.raid_id, characterId, id, character.name || "", hit.damage, appliedDamage, now),
  ]);
  // If the WHERE didn't match (boss already hit 0 by someone else between our early check
  // and this batch landing), RETURNING yields no row — treat that as "our damage didn't land"
  // rather than crashing on a missing value.
  const bossRow = (bossBatch.results || [])[0];
  const bossHpAfter = bossRow ? Number(bossRow.boss_hp_current) : hpBefore;
  const participantRow = (participantBatch.results || [])[0];
  const newBest = participantRow ? Number(participantRow.total_damage) : hit.damage;
  const newContribution = participantRow ? Number(participantRow.total_contribution) : appliedDamage;

  let bossDied = false;
  const bossDef = raidBossDefById(raid.boss_def_id);
  const family = raidFamilyForBoss(bossDef);
  // Snapshot the 99% direct Set Item at threshold time. The descriptor is kept in
  // the participant row and delivered later by the exact-once milestone mailbox.
  if (participantRow && Number(participantRow.total_contribution) >= Number(raid.boss_hp_max) * 0.99) {
    const current = await db.prepare(`SELECT p99_json FROM raid_milestone_snapshots WHERE raid_id = ? AND character_id = ?`).bind(raid.raid_id, characterId).first();
    if (!current?.p99_json) {
      const snapshot = raidSetItemRewardDesc(family, Number(character.unlocked_floor) || 1);
      if (snapshot) await db.prepare(`INSERT INTO raid_milestone_snapshots (raid_id, character_id, p99_json, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(raid_id, character_id) DO NOTHING`).bind(raid.raid_id, characterId, JSON.stringify(snapshot), nowIso()).run();
    }
  }
  if (bossRow && bossHpAfter <= 0 && hpBefore > 0) {
    bossDied = true;
    await sendMail(db, characterId, `💥 Last Hit! ${bossDef.name}`, `คุณคือผู้ปิดจ๊อบ! ได้รับแบบร่างชุด ${RAID_FAMILIES[family].name}`, { junk: [{ junkId: randomSetRecipeJunkId(family), quantity: 1 }] }, `raid:last-hit:${raid.raid_id}:${characterId}`);
    await settleRaidRank(db, raid.raid_id);
  }

  const response = {
    ok: true,
    diamonds: Number((await db.prepare(`SELECT diamonds FROM players WHERE id = ?`).bind(id).first())?.diamonds) || 0,
    damage: hit.damage,
    crit: hit.crit,
    appliedDamage,
    bossHpCurrent: bossHpAfter,
    bossDied,
    paidDiamonds: !spentStamina,
    diamondsSpent,
    stamina: newStamina,
    staminaMax: RAID_STAMINA_MAX,
    staminaRegenSeconds: raidStaminaSecondsToNext(newStaminaUpdatedAt),
    bestHit: newBest,
    contribution: newContribution,
  };
  await db.prepare(`UPDATE character_operation_receipts SET result_json = ? WHERE operation_token = ? AND result_json = 'pending'`)
    .bind(JSON.stringify(response), operationToken).run();
  return json(response);
}

async function handleClaimRaidMilestones(db, id, session, characterId) {
  const [auth, owned, raid] = await Promise.all([verifyPlayer(db, id, session), verifyOwnedCharacter(db, id, characterId), getOrCreateActiveRaid(db)]);
  if (auth.error) return json({ error: auth.error });
  if (owned.error) return json({ error: owned.error });

  const participant = await db.prepare(`SELECT * FROM raid_participants WHERE raid_id = ? AND character_id = ?`).bind(raid.raid_id, characterId).first();
  if (!participant) return json({ error: "no_participation" });

  const claimed = (participant.milestone_claimed || "").split(",").filter(Boolean);
  const family = raidFamilyForBoss(raidBossDefById(raid.boss_def_id));
  const hpMax = Number(raid.boss_hp_max) || 1;
  const pctReached = ((Number(participant.total_contribution) || 0) / hpMax) * 100;

  const newKeys = [];
  let diamonds = 0;
  const junk = [];
  const items = [];
  for (let pct = RAID_MILESTONE_STEP; pct <= 100; pct += RAID_MILESTONE_STEP) {
    const key = `p${pct}`;
    if (pctReached < pct || claimed.indexOf(key) !== -1) continue;
    newKeys.push(key);
    diamonds += RAID_MILESTONE_DIAMOND_PER_STEP;
    if (pct % 10 === 0) junk.push({ junkId: randomBossMaterialJunkId(), quantity: 1 });
    if (pct === 25) items.push(raidWingItemDesc(family, "rare"));
    if (pct === 50) {
      const floor = Math.max(1, Number((await db.prepare(`SELECT unlocked_floor FROM characters WHERE character_id = ?`).bind(characterId).first())?.unlocked_floor) || 1);
      items.push(raidAccessoryRewardDesc(floor, Math.random() < 0.8 ? "unique" : "elite"));
    }
    if (pct === 75) junk.push({ junkId: randomSetRecipeJunkId(family), quantity: 1 });
  }
  // 99% is its own checkpoint (not a multiple of 5) — a full random azure piece, not a recipe.
  if (pctReached >= 99 && claimed.indexOf("p99") === -1) {
    newKeys.push("p99");
    const snapshotRow = await db.prepare(`SELECT p99_json FROM raid_milestone_snapshots WHERE raid_id = ? AND character_id = ?`).bind(raid.raid_id, characterId).first();
    let snapshot = parseJsonColumn(snapshotRow?.p99_json, null);
    if (!snapshot) {
      const currentFloor = Math.max(1, Number((await db.prepare(`SELECT unlocked_floor FROM characters WHERE character_id = ?`).bind(characterId).first())?.unlocked_floor) || 1);
      snapshot = raidSetItemRewardDesc(family, currentFloor);
    }
    if (snapshot) items.push(snapshot);
  }
  if (!newKeys.length) return json({ ok: true, claimed: [] });

  const def = raidBossDefById(raid.boss_def_id);
  const allClaimed = claimed.concat(newKeys).join(",");
  const rewardTitle = `🎁 รางวัลดาเมจสะสม ${def.name}`;
  const rewardBody = `คุณสะสมดาเมจถึง ${newKeys.map((k) => k.replace("p", "")).join("%, ")}%`;
  const rewardMailId = newMailId();
  const rewardInsert = db.prepare(`INSERT INTO mailbox (mail_id, character_id, title, body, gold, diamonds, junk_json, items_json, claimed, created_at, claimed_at, source_key)
    SELECT ?, ?, ?, ?, 0, ?, ?, ?, 0, ?, '', ?
    WHERE changes() = 1 AND NOT EXISTS (SELECT 1 FROM mailbox WHERE source_key = ? AND source_key <> '')`)
    .bind(rewardMailId, characterId, rewardTitle, rewardBody, diamonds, junk.length ? JSON.stringify(junk) : "", items.length ? JSON.stringify(items) : "", nowIso(), `raid-milestone:${raid.raid_id}:${characterId}:${allClaimed}`, `raid-milestone:${raid.raid_id}:${characterId}:${allClaimed}`);
  const batch = await db.batch([
    db.prepare(`UPDATE raid_participants SET milestone_claimed = ? WHERE raid_id = ? AND character_id = ? AND COALESCE(milestone_claimed, '') = ?`)
      .bind(allClaimed, raid.raid_id, characterId, participant.milestone_claimed || ""),
    rewardInsert
  ]);
  if (Number(batch?.[0]?.meta?.changes) !== 1 || Number(batch?.[1]?.meta?.changes) !== 1) return json({ ok: true, claimed: [], replayed: true });
  return json({ ok: true, claimed: newKeys, rewardCommitted: true });
}

// ---------- Phase 5: PvP Arena (Battle Core V1, symmetric) ----------
// Ported verbatim from src/systems/heroSkillsV1.js, src/systems/pets.js's
// PET_COMBAT_SKILLS_V2, and src/systems/battleCore.js. These three are the shared,
// authoritative combat data + resolver used by Dungeon/Raid/Arena on the client — Arena
// reuses them as-is (no forked damage/status/skill logic) rather than freezing a second
// copy, per docs/BATTLE-SYSTEM-V1.md's "modes are configuration adapters only" rule.
// Keep these three blocks byte-for-byte in sync with their src/systems/ source files —
// re-paste on any upstream change to skill/pet/battle-core balance or mechanics.

// ===== ported: src/systems/heroSkillsV1.js =====
// ---------- Hero Skill System V1 ----------
// Shared skill catalog/data layer for Dungeon, Arena and Raid. Modes must import
// these ranks and values rather than freezing or duplicating their own copies.
// Battle values that were not locked in the source-of-truth documents live in
// one playtest object. They can be tuned later without changing resolver logic.
const HERO_SKILL_V1_PLAYTEST = Object.freeze({
  toxicStrike: { sp: 12, cooldown: 2 },
  stunningBlow: { sp: 16, cooldown: 3 },
  silentEdge: { sp: 18, cooldown: 3 },
  counter: { sp: 18, cooldown: 4 },
  disruption: { sp: 22, cooldown: 5, stunWeight: 0.5 },
  aegisCounterStunChance: 35,
  survivalReflectCapMaxHpPct: 10,
  globalStatusProcCap: 90
});

function heroSkill(id, branch, tier, kind, ranks, extra = {}) {
  return Object.freeze({ id, branch, tier, kind, maxRank: kind === "passive" ? 5 : kind === "keystone" ? 5 : 3, ranks, ...extra });}

const HERO_SKILLS_V1 = Object.freeze([
  heroSkill("power_strike", "assault", 1, "active", [
    { mult: 1.45, sp: 10, cooldown: 0 }, { mult: 1.65, sp: 10, cooldown: 0 },
    { mult: 1.85, sp: 10, cooldown: 0, critDamageBonus: 15 }
  ]),
  heroSkill("weapon_mastery", "assault", 1, "passive", [2, 4, 6, 8, 10].map(damagePct => ({ damagePct }))),
  heroSkill("killer_instinct", "assault", 1, "passive", [2, 4, 6, 8, 10].map(critPct => ({ critPct, targetBelowPct: 50 }))),
  heroSkill("heavy_blow", "assault", 2, "active", [
    { mult: 1.7, armorBreakChance: 35 }, { mult: 1.9, armorBreakChance: 45 }, { mult: 2.1, armorBreakChance: 55 }
  ].map(rank => ({ ...rank, sp: 16, cooldown: 2 }))),
  heroSkill("bloodlust", "assault", 2, "passive", [4, 6, 8, 10, 12].map((damagePct, index) => ({ damagePct, hpAtMostPct: 40, critPct: index === 4 ? 5 : 0 }))),
  heroSkill("armor_break_mastery", "assault", 2, "passive", [5, 10, 15, 20, 25].map(procBonus => ({ procBonus }))),
  heroSkill("blade_storm", "assault", 3, "active", [
    { mult: 0.6 }, { mult: 0.7 }, { mult: 0.75, stunChancePerHit: 5 }
  ].map(rank => ({ ...rank, hits: 3, distribution: "living", sp: 24, cooldown: 3 }))),
  heroSkill("life_drain", "assault", 3, "passive", [1, 2, 3, 4, 5].map(drainPct => ({ drainPct, capMaxHpPct: 10 }))),
  heroSkill("finishing_blow", "assault", 3, "passive", [4, 7, 10, 13, 16].map(damagePct => ({ damagePct, targetAtMostPct: 40 }))),
  heroSkill("rampage", "assault", 4, "active", [
    { damagePct: 15, takenPct: 15 }, { damagePct: 18, critPct: 5, takenPct: 10 }, { damagePct: 20, critPct: 5, takenPct: 0 }
  ].map(rank => ({ ...rank, duration: 3, sp: 25, cooldown: 6, buff: "rampage" }))),
  heroSkill("critical_mastery", "assault", 4, "passive", [5, 10, 15, 20, 25].map(critDamagePct => ({ critDamagePct }))),
  heroSkill("relentless_fury", "assault", 5, "keystone", [1, 2, 3, 4, 5].map(rank => ({ rank }))),

  heroSkill("guard", "guard", 1, "active", [
    { mult: 1.05, duration: 1 }, { mult: 1.2, duration: 2 }, { mult: 1.35, duration: 2 }
  ].map(rank => ({ ...rank, sp: 10, cooldown: 2, status: "def_up" }))),
  heroSkill("toughness", "guard", 1, "passive", [3, 6, 9, 12, 15].map(maxHpPct => ({ maxHpPct }))),
  heroSkill("iron_body", "guard", 1, "passive", [2, 4, 6, 8, 10].map(defPct => ({ defPct }))),
  heroSkill("shield_wall", "guard", 2, "active", [
    { damagePenaltyPct: 20 }, { damagePenaltyPct: 10 }, { damagePenaltyPct: 0 }
  ].map(rank => ({ ...rank, sp: 18, cooldown: 4, duration: 3, status: "def_up" }))),
  heroSkill("recovery", "guard", 2, "passive", [4, 8, 12, 16, 20].map(receivedPct => ({ receivedPct }))),
  heroSkill("last_stand", "guard", 2, "passive", [20, 40, 60, 80, 100].map(chance => ({ chance, hpAtMostPct: 40, internalCooldown: 3 }))),
  heroSkill("counter", "guard", 3, "active", [
    { counterMult: 1 }, { counterMult: 1.3 }, { counterMult: 1.6, armorBreakChance: 35 }
  ].map(rank => ({ ...rank, sp: HERO_SKILL_V1_PLAYTEST.counter.sp, cooldown: HERO_SKILL_V1_PLAYTEST.counter.cooldown, duration: 1, buff: "counter" }))),
  heroSkill("battle_hardened", "guard", 3, "passive", [5, 10, 15, 20, 25].map(statusResist => ({ statusResist }))),
  heroSkill("second_wind", "guard", 3, "passive", [5, 7, 9, 11, 15].map(healMaxHpPct => ({ healMaxHpPct, oncePerBattle: true }))),
  heroSkill("fortress", "guard", 4, "active", [
    { defPct: 20, damagePenaltyPct: 20 }, { defPct: 25, damagePenaltyPct: 10 }, { defPct: 30, damagePenaltyPct: 0 }
  ].map(rank => ({ ...rank, sp: 28, cooldown: 7, duration: 2, buff: "fortress" }))),
  heroSkill("survival_instinct", "guard", 4, "passive", [
    [10, 5], [15, 7], [20, 9], [25, 12], [30, 15]
  ].map(([excessReductionPct, reflectPct]) => ({ thresholdMaxHpPct: 25, excessReductionPct, reflectPct }))),
  heroSkill("thorned_aegis", "guard", 5, "keystone", [1, 2, 3, 4, 5].map(rank => ({ rank }))),

  heroSkill("toxic_strike", "tactic", 1, "active", [
    { mult: 1.2, poisonChance: 30 }, { mult: 1.4, poisonChance: 40 }, { mult: 1.6, poisonChance: 50 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.toxicStrike }))),
  heroSkill("exploit_weakness", "tactic", 1, "passive", [2, 4, 6, 8, 10].map(damagePct => ({ damagePct }))),
  heroSkill("debilitating_edge", "tactic", 1, "passive", [3, 6, 9, 12, 15].map(procBonus => ({ procBonus }))),
  heroSkill("stunning_blow", "tactic", 2, "active", [
    { mult: 1.45, stunChance: 15 }, { mult: 1.65, stunChance: 25 }, { mult: 1.85, stunChance: 35 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.stunningBlow }))),
  heroSkill("spirit_drain", "tactic", 2, "passive", [1, 2, 3, 4, 5].map(spRestore => ({ spRestore }))),
  heroSkill("toxic_mastery", "tactic", 2, "passive", [5, 10, 15, 20, 25].map((poisonDamagePct, index) => ({ poisonDamagePct, durationBonus: index === 4 ? 1 : 0 }))),
  heroSkill("silent_edge", "tactic", 3, "active", [
    { mult: 1.5, silenceChance: 25 }, { mult: 1.7, silenceChance: 35 }, { mult: 1.9, silenceChance: 45 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.silentEdge }))),
  heroSkill("quick_recovery", "tactic", 3, "passive", [5, 8, 11, 14, 18].map(chance => ({ chance }))),
  heroSkill("skill_efficiency", "tactic", 3, "passive", [2, 4, 6, 8, 10].map(spReductionPct => ({ spReductionPct }))),
  heroSkill("disruption", "tactic", 4, "active", [
    { count: 2, procChance: 30 }, { count: 3, procChance: 35 }, { count: 4, procChance: 40 }
  ].map(rank => ({ ...rank, ...HERO_SKILL_V1_PLAYTEST.disruption, debuffOnly: true })), {
    prerequisites: { toxic_strike: 1, stunning_blow: 1, silent_edge: 1 }
  }),
  heroSkill("master_tactician", "tactic", 4, "passive", [5, 8, 11, 15, 20].map(chance => ({ chance })), {
    prerequisites: { skill_efficiency: 1 }
  }),
  heroSkill("usurper", "tactic", 5, "keystone", [1, 2, 3, 4, 5].map(rank => ({ rank })))
]);

const HERO_SKILLS_V1_BY_ID = Object.freeze(Object.fromEntries(HERO_SKILLS_V1.map(skill => [skill.id, skill])));
const HERO_SKILL_TIER_GATES = Object.freeze({ 1: { level: 1, points: 0 }, 2: { level: 15, points: 8 }, 3: { level: 30, points: 20 }, 4: { level: 50, points: 35 } });

function heroSkillPointBudget(level) { return Math.max(0, Math.min(98, Math.floor(Number(level) || 1) - 1)); }
function heroSkillRank(levels, id) { return Math.max(0, Math.floor(Number((levels || {})[id]) || 0)); }
function heroSkillBranchPoints(levels, branch) {
  return HERO_SKILLS_V1.filter(skill => skill.branch === branch).reduce((sum, skill) => sum + heroSkillRank(levels, skill.id) * (skill.kind === "keystone" ? 2 : 1), 0);
}
function heroSkillSpentPoints(levels) {
  return HERO_SKILLS_V1.reduce((sum, skill) => sum + heroSkillRank(levels, skill.id) * (skill.kind === "keystone" ? 2 : 1), 0);
}
function canSpendHeroSkillPoint(level, levels, id) {
  const skill = HERO_SKILLS_V1_BY_ID[id];
  if (!skill) return { ok: false, reason: "unknown_skill" };
  const rank = heroSkillRank(levels, id);
  if (rank >= skill.maxRank) return { ok: false, reason: "max_rank" };
  const cost = skill.kind === "keystone" ? 2 : 1;
  if (heroSkillSpentPoints(levels) + cost > heroSkillPointBudget(level)) return { ok: false, reason: "not_enough_sp" };
  const branchPoints = heroSkillBranchPoints(levels, skill.branch);
  if (skill.kind === "keystone") {
    if (branchPoints < 40) return { ok: false, reason: "keystone_points" };
    if (!HERO_SKILLS_V1.some(candidate => candidate.branch === skill.branch && candidate.tier === 4 && heroSkillRank(levels, candidate.id) > 0)) return { ok: false, reason: "keystone_t4" };
  } else {
    const gate = HERO_SKILL_TIER_GATES[skill.tier] || HERO_SKILL_TIER_GATES[1];
    if ((Number(level) || 1) < gate.level) return { ok: false, reason: "level_gate" };
    if (branchPoints < gate.points) return { ok: false, reason: "branch_points" };
  }
  for (const [requiredId, requiredRank] of Object.entries(skill.prerequisites || {})) {
    if (heroSkillRank(levels, requiredId) < requiredRank) return { ok: false, reason: "prerequisite", requiredId };
  }
  return { ok: true, cost };
}

function heroSkillRankData(levels, id) {
  const skill = HERO_SKILLS_V1_BY_ID[id];
  const rank = heroSkillRank(levels, id);
  return skill && rank ? skill.ranks[rank - 1] : null;
}
function heroActiveSkillList(levels) {
  const icons = { power_strike: "⚔️", heavy_blow: "🔨", blade_storm: "🌪️", rampage: "🔥", guard: "🛡️", shield_wall: "🏰", counter: "↩️", fortress: "🏯", toxic_strike: "☠️", stunning_blow: "💫", silent_edge: "🤫", disruption: "🎭" };
  return HERO_SKILLS_V1.filter(skill => skill.kind === "active" && heroSkillRank(levels, skill.id) > 0).map(skill => {
    const data = heroSkillRankData(levels, skill.id);
    return { key: skill.id, name: skill.id.split("_").map(word => word[0].toUpperCase() + word.slice(1)).join(" "), icon: icons[skill.id] || "✨", mp: data.sp || 0, cooldown: data.cooldown || 0, desc: `${skill.branch} Rank ${heroSkillRank(levels, skill.id)}` };
  });
}

if (typeof module !== "undefined") module.exports = {
  HERO_SKILL_V1_PLAYTEST, HERO_SKILLS_V1, HERO_SKILLS_V1_BY_ID, HERO_SKILL_TIER_GATES,
  heroSkillPointBudget, heroSkillRank, heroSkillBranchPoints, heroSkillSpentPoints,
  canSpendHeroSkillPoint, heroSkillRankData, heroActiveSkillList
};

// ===== ported: src/systems/pets.js (PET_COMBAT_SKILLS_V2 data only) =====
const PET_COMBAT_SKILLS_V2 = {"sprout":{"active":{"name":"Regrowth","icon":"💚","cooldown":3,"type":"regen","healPetHpPct":0.12,"vitScale":0.8,"regenTurns":2,"desc":"ฟื้นฟู Hero 12% Pet Max HP + 0.8×VIT นาน 2 เทิร์น"}},"flamekit":{"active":{"name":"Flame Claw","icon":"🔥","cooldown":2,"type":"damage","mult":1.35,"desc":"ดาเมจเป้าหมายเดียว 1.35× Pet ATK"}},"sparkpup":{"active":{"name":"Static Bite","icon":"⚡","cooldown":2,"type":"damage","mult":1,"stunChance":0.15,"desc":"ดาเมจ 1.0× Pet ATK และ Stun 15%"}},"ember_fox":{"active":{"name":"Blazing Fang","icon":"🔥","cooldown":2,"type":"damage","mult":1.55,"desc":"ดาเมจเป้าหมายเดียว 1.55× Pet ATK"},"passive":{"name":"Predator Instinct","icon":"💪","type":"atkBoost","petCritPct":0.1,"heroCritPct":0.05,"desc":"Pet Crit +10% และ Hero Crit +5%"}},"moon_hare":{"active":{"name":"Moonlight Heal","icon":"💚","cooldown":2,"type":"groupHeal","healPetHpPct":0.1,"vitScale":1,"desc":"ฟื้นฟู Hero และ Pet 10% Pet Max HP + 1.0×VIT"},"passive":{"name":"Status Ward","icon":"🌙","type":"statusResist","pct":0.15,"desc":"Hero และ Pet Status Resist +15%"}},"hell_wolf":{"active":{"name":"Hell Fang","icon":"⚡","cooldown":2,"type":"damage","mult":1.1,"armorBreakChance":0.4,"poisonChance":0.25,"poisonPct":0.2,"poisonTurns":3,"desc":"ดาเมจ 1.10× Pet ATK, Armor Break 40%, Poison 25%"},"passive":{"name":"Hunter's Eye","icon":"💪","type":"accuracyBoost","pct":0.08,"desc":"Hero และ Pet Accuracy +8%"}},"inferno_drake":{"active":{"name":"Draconic Sweep","icon":"🔥","cooldown":2,"type":"aoe","mult":0.75,"defUpChance":0.35,"defUpTurns":2,"desc":"โจมตีศัตรูสูงสุด 3 ตัว 0.75× Pet ATK และมีโอกาสให้ Hero DEF Up"},"passive":{"name":"Dragon Hide","icon":"💪","type":"defBoost","petPct":0.15,"heroPct":0.08,"desc":"Pet DEF +15% และ Hero DEF +8%"},"extra":{"name":"Guardian Scale","icon":"🛡️","type":"heroBlock","pct":0.2,"desc":"20% โอกาสบล็อก direct damage ที่โจมตี Hero"}},"storm_phoenix":{"active":{"name":"Tempest Strike","icon":"⚡","cooldown":3,"type":"aoe","mult":0.7,"silenceChance":0.3,"desc":"โจมตีศัตรูสูงสุด 3 ตัว 0.70× Pet ATK และ Silence 30%"},"passive":{"name":"Storm Step","icon":"🌙","type":"dodgeBoost","pct":0.08,"desc":"Hero และ Pet Dodge +8%"},"extra":{"name":"Thunder Judgment","icon":"🌩️","type":"petCdrOnDebuff","pct":0.5,"desc":"เมื่อ Hero หรือ Pet ลง Debuff สำเร็จ มีโอกาส 50% ลด Pet Active CD 1"}}}
;

// ===== ported: src/systems/battleCore.js =====
// ---------- Battle Core V1 ----------
// Generic, pure and serializable combat resolver. Dungeon, future Arena/Raid
// adapters, UI, Auto and Skip must call this core instead of forking skill logic.
(function battleCoreFactory(root) {
  const STATUS_PROC_CAP = 90;
  const STATUS_KEYS = new Set(["poison", "stun", "silence", "armor_break", "def_up"]);
  const HARMFUL = new Set(["poison", "stun", "silence", "armor_break"]);
  const STEALABLE_BLOCKLIST = new Set(["fury", "aegis", "scheme", "phase", "immunity", "boss_mechanic"]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const pct = value => clamp(value, 0, 100) / 100;
  const copy = value => JSON.parse(JSON.stringify(value));
  const living = unit => unit && !unit.dead && unit.hp > 0;
  const hpPct = unit => unit && unit.maxHp ? unit.hp / unit.maxHp * 100 : 0;
  const status = (unit, key) => unit.statuses && unit.statuses[key];
  const rank = (unit, id) => Math.max(0, Math.floor(Number(unit.skills && unit.skills[id]) || 0));
  const unitName = unit => String(unit && (unit.name || unit.id) || "Unknown");
  const title = id => String(id || "skill").split("_").map(word => word ? word[0].toUpperCase() + word.slice(1) : "").join(" ");
  const attackActionName = (spec, context) => spec.actionName
    || (spec.actionType === "active" ? title(spec.id || context.usedSkillId) : spec.actionType === "counter" ? "counter attack" : "basic attack");
  const freshResources = () => ({ fury: 0, aegis: 0, scheme: 0, schemeConsumed: 0, nextActiveDebuffBonus: 0 });

  // Mode adapters own entry rules only. Damage, status, skills, cooldowns and
  // turn resolution remain shared below for every mode.
  const BATTLE_MODE_ADAPTERS = Object.freeze({
    dungeon: Object.freeze({ controlledSide: "ally", allowFlee: true, bossControlStatusConversion: true }),
    arena: Object.freeze({ controlledSide: "team_a", allowFlee: false, bossControlStatusConversion: true }),
    raid: Object.freeze({ controlledSide: "ally", allowFlee: false, bossControlStatusConversion: true })
  });

  function nextRandom(state) {
    let x = (state.rngState >>> 0) || 0x6d2b79f5;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rngState = x >>> 0;
    return state.rngState / 4294967296;
  }
  function chance(state, percent) { return nextRandom(state) * 100 < clamp(percent, 0, 100); }
  function choose(state, list) { return list.length ? list[Math.floor(nextRandom(state) * list.length)] : null; }
  function chooseWeighted(state, list, weightFor) {
    const total = list.reduce((sum, item) => sum + Math.max(0, Number(weightFor(item)) || 0), 0);
    if (!list.length || total <= 0) return null;
    let roll = nextRandom(state) * total;
    for (const item of list) {
      roll -= Math.max(0, Number(weightFor(item)) || 0);
      if (roll <= 0) return item;
    }
    return list[list.length - 1];
  }
  function log(state, type, text, data = {}) {
    state.log.push({ seq: ++state.logSeq, round: state.round, type, text, ...data });
    if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
  }

  function normalizeUnit(raw, index, defaultSide) {
    const unit = copy(raw || {});
    unit.id = String(unit.id || `unit-${index}`);
    unit.kind = unit.kind || "monster";
    unit.side = String(defaultSide || unit.side || (unit.kind === "monster" || unit.kind === "boss" || unit.kind === "raid_boss" ? "enemy" : "ally"));
    unit.maxHp = Math.max(1, Math.round(Number(unit.maxHp) || Number(unit.hp) || 1));
    unit.hp = clamp(Math.round(Number(unit.hp == null ? unit.maxHp : unit.hp)), 0, unit.maxHp);
    unit.maxSp = Math.max(0, Math.round(Number(unit.maxSp) || 0));
    unit.sp = clamp(Math.round(Number(unit.sp == null ? unit.maxSp : unit.sp)), 0, unit.maxSp);
    unit.atk = Math.max(1, Number(unit.atk) || 1);
    unit.def = Math.max(0, Number(unit.def) || 0);
    unit.speed = Math.max(0, Number(unit.speed) || 0);
    unit.accuracy = clamp(unit.accuracy == null ? unit.hitRate == null ? 95 : unit.hitRate : unit.accuracy, 0, 99);
    unit.dodge = clamp(unit.dodge == null ? unit.evasion || 0 : unit.dodge, 0, 95);
    unit.crit = clamp(unit.crit == null ? unit.critChance || 0 : unit.crit, 0, 100);
    unit.critDamage = Math.max(1, Number(unit.critDamage) || 1.5);
    unit.statusResist = clamp(unit.statusResist || 0, 0, 100);
    unit.equipmentEffects = copy(unit.equipmentEffects || {});
    unit.statuses = copy(unit.statuses || {});
    unit.cooldowns = copy(unit.cooldowns || {});
    unit.skills = copy(unit.skills || {});
    unit.activeSkills = Array.isArray(unit.activeSkills) ? unit.activeSkills.slice(0, 4) : [];
    unit.ai = copy(unit.ai || {});
    unit.flags = copy(unit.flags || {});
    unit.tieOrder = Number.isFinite(unit.tieOrder) ? unit.tieOrder : index;
    unit.dead = unit.hp <= 0 || !!unit.dead;
    return unit;
  }

  function buildHeroUnit(raw = {}, index = 0, side) { return normalizeUnit({ ...raw, kind: "hero" }, index, side || raw.side || "ally"); }
  function buildPetUnit(raw = {}, index = 1, side) { return normalizeUnit({ ...raw, kind: "pet" }, index, side || raw.side || "ally"); }
  function buildMonsterUnit(raw = {}, index = 0, side) {
    const kind = raw.kind === "boss" || raw.kind === "raid_boss" ? raw.kind : "monster";
    return normalizeUnit({ ...raw, kind }, index + 2, side || raw.side || "enemy");
  }

  // The team/side model is the reusable boundary: exactly two sides, each with
  // any supported unit kinds. Legacy Dungeon ids remain compatibility aliases.
  function teamUnits(state, side) {
    return Object.values(state.units || {}).filter(unit => unit.side === side);
  }
  function livingTeamUnits(state, side) { return teamUnits(state, side).filter(living); }
  function opposingUnits(state, actorOrSide) {
    const side = typeof actorOrSide === "string" ? actorOrSide : actorOrSide && actorOrSide.side;
    return Object.values(state.units || {}).filter(unit => living(unit) && unit.side !== side);
  }
  function heroForSide(state, side) { return teamUnits(state, side).find(unit => unit.kind === "hero") || null; }
  function petForSide(state, side) { return teamUnits(state, side).find(unit => unit.kind === "pet") || null; }
  function resourcesFor(state, actorOrSide) {
    const side = typeof actorOrSide === "string" ? actorOrSide : actorOrSide && actorOrSide.side;
    if (side === state.controlledSide) return state.resources;
    state.teamResources = state.teamResources || {};
    state.teamResources[side] = state.teamResources[side] || freshResources();
    return state.teamResources[side];
  }
  function resetBattleResources(state) {
    for (const side of state.teamIds || []) Object.assign(resourcesFor(state, side), freshResources());
  }
  function ensureTeamModel(state) {
    const sides = Array.from(new Set(Object.values(state.units || {}).map(unit => unit.side)));
    state.teamIds = Array.isArray(state.teamIds) && state.teamIds.length ? state.teamIds : sides;
    state.controlledSide = state.controlledSide || (state.heroId && state.units[state.heroId] && state.units[state.heroId].side) || state.teamIds[0];
    state.teams = state.teams || Object.fromEntries(state.teamIds.map(side => [side, { id: side, unitIds: teamUnits(state, side).map(unit => unit.id) }]));
    state.teamResources = state.teamResources || {};
    state.resources = state.resources || state.teamResources[state.controlledSide] || freshResources();
    state.teamResources[state.controlledSide] = state.resources;
    for (const side of state.teamIds) state.teamResources[side] = state.teamResources[side] || freshResources();
    state.selectedTargetIds = state.selectedTargetIds || {};
    for (const side of state.teamIds) {
      if (!state.selectedTargetIds[side]) state.selectedTargetIds[side] = opposingUnits(state, side)[0]?.id || null;
    }
    state.selectedTargetId = state.selectedTargetId || state.selectedTargetIds[state.controlledSide] || null;
    state.selectedTargetIds[state.controlledSide] = state.selectedTargetId;
    state.heroTurnCounts = state.heroTurnCounts || (state.heroId ? { [state.heroId]: Number(state.heroTurnCount) || 0 } : {});
    return state;
  }

  function createBattleState(options, input, adapter) {
    const units = {};
    input.forEach(unit => {
      if (units[unit.id]) throw new Error("battle_duplicate_unit_id");
      units[unit.id] = unit;
    });
    const teamIds = Array.from(new Set(input.map(unit => unit.side)));
    if (teamIds.length !== 2 || teamIds.some(side => !input.some(unit => unit.side === side))) throw new Error("battle_requires_two_teams");
    const controlledSide = String(options.controlledSide || adapter.controlledSide || teamIds[0]);
    if (!teamIds.includes(controlledSide)) throw new Error("battle_invalid_controlled_side");
    const controlledUnits = input.filter(unit => unit.side === controlledSide);
    const hero = controlledUnits.find(unit => unit.kind === "hero") || null;
    const pet = controlledUnits.find(unit => unit.kind === "pet") || null;
    const enemies = input.filter(unit => unit.side !== controlledSide);
    const teamResources = Object.fromEntries(teamIds.map(side => [side, freshResources()]));
    const state = {
      version: 1,
      battleId: String(options.battleId || `battle-${Date.now()}`),
      mode: options.mode || "dungeon",
      floor: Math.max(1, Math.floor(Number(options.floor) || 1)),
      round: 0, queue: [], queueIndex: 0, speedSnapshot: {},
      teamIds,
      teams: Object.fromEntries(teamIds.map(side => [side, { id: side, unitIds: input.filter(unit => unit.side === side).map(unit => unit.id) }])),
      controlledSide,
      teamResources,
      units, heroId: hero ? hero.id : null, petId: pet ? pet.id : null, enemyIds: enemies.map(unit => unit.id),
      selectedTargetId: enemies[0].id,
      selectedTargetIds: Object.fromEntries(teamIds.map(side => [side, input.find(unit => unit.side !== side)?.id || null])),
      heroTurnCount: 0, heroTurnCounts: {},
      resources: teamResources[controlledSide],
      flags: { auto: false, skipResolving: false, heroReviveNextFloor: false, fled: false },
      result: null, safeActionSeq: 0, logSeq: 0,
      rngState: (Number(options.seed) >>> 0) || 0x12345678, log: [],
      rules: {
        allowFlee: options.allowFlee == null ? adapter.allowFlee : options.allowFlee !== false,
        bossControlStatusConversion: adapter.bossControlStatusConversion !== false,
        ...(options.rules || {})
      }
    };
    rebuildQueue(state);
    log(state, "battle_start", "Battle started");
    checkBattleEnd(state);
    return state;
  }
  function createTeamBattle(options = {}) {
    const mode = options.mode || "arena";
    const adapter = BATTLE_MODE_ADAPTERS[mode] || BATTLE_MODE_ADAPTERS.arena;
    const teams = Array.isArray(options.teams) ? options.teams : [];
    const input = teams.flatMap((team, teamIndex) => (team.units || []).map((raw, unitIndex) => {
      const index = teamIndex * 100 + unitIndex;
      const side = String(team.id || `team_${teamIndex + 1}`);
      if (raw.kind === "hero") return buildHeroUnit(raw, index, side);
      if (raw.kind === "pet") return buildPetUnit(raw, index, side);
      return buildMonsterUnit(raw, index, side);
    }));
    return createBattleState({ ...options, mode }, input, adapter);
  }
  function createBattle(options = {}) {
    if (Array.isArray(options.teams)) return createTeamBattle(options);
    const input = [
      options.hero && buildHeroUnit(options.hero, 0, "ally"),
      options.pet && buildPetUnit(options.pet, 1, "ally"),
      ...(options.enemies || []).map((enemy, index) => buildMonsterUnit(enemy, index, "enemy"))
    ].filter(Boolean);
    const hero = input.find(unit => unit.kind === "hero" && unit.side === "ally");
    const enemies = input.filter(unit => unit.side === "enemy");
    if (!hero || !enemies.length) throw new Error("battle_requires_hero_and_enemy");
    const modeAdapter = BATTLE_MODE_ADAPTERS[options.mode] || BATTLE_MODE_ADAPTERS.dungeon;
    return createBattleState({ ...options, mode: options.mode || "dungeon" }, input, { ...modeAdapter, controlledSide: "ally" });
  }
  function createDungeonBattle(options = {}) {
    return createBattle({ ...options, mode: "dungeon", allowFlee: true });
  }
  function createArenaBattle(options = {}) {
    return createTeamBattle({ ...options, mode: "arena", controlledSide: options.controlledSide || "team_a", teams: [
      { id: "team_a", units: [options.teamA?.hero && { ...options.teamA.hero, kind: "hero" }, options.teamA?.pet && { ...options.teamA.pet, kind: "pet" }, ...(options.teamA?.units || [])].filter(Boolean) },
      { id: "team_b", units: [options.teamB?.hero && { ...options.teamB.hero, kind: "hero" }, options.teamB?.pet && { ...options.teamB.pet, kind: "pet" }, ...(options.teamB?.units || [])].filter(Boolean) }
    ] });
  }
  function createRaidBattle(options = {}) {
    const boss = options.raidBoss || options.boss || (options.enemies || [])[0];
    return createBattle({ ...options, mode: "raid", allowFlee: false, enemies: boss ? [{ ...boss, kind: "raid_boss" }] : [] });
  }

  function rebuildQueue(state) {
    state.round += 1;
    const candidates = Object.values(state.units).filter(living);
    state.speedSnapshot = Object.fromEntries(candidates.map(unit => [unit.id, Number(unit.speed) || 0]));
    state.queue = candidates.sort((a, b) => state.speedSnapshot[b.id] - state.speedSnapshot[a.id] || a.tieOrder - b.tieOrder || a.id.localeCompare(b.id)).map(unit => unit.id);
    state.queueIndex = 0;
    log(state, "round", `Round ${state.round}`);
  }

  function currentUnit(state) {
    while (state.queueIndex < state.queue.length && !living(state.units[state.queue[state.queueIndex]])) state.queueIndex += 1;
    if (state.queueIndex >= state.queue.length && !state.result) {
      if (!completeArenaRound(state)) rebuildQueue(state);
    }
    return state.units[state.queue[state.queueIndex]] || null;
  }

  function upcomingActions(state, count = 4) {
    if (state.result) return [];
    const visible = state.queue.slice(state.queueIndex).filter(id => living(state.units[id]));
    if (visible.length >= count) return visible.slice(0, count);
    const next = Object.values(state.units).filter(living).sort((a, b) => Number(b.speed) - Number(a.speed) || a.tieOrder - b.tieOrder || a.id.localeCompare(b.id)).map(unit => unit.id);
    return visible.concat(next).slice(0, count);
  }

  function hasDebuff(unit) { return Object.keys(unit.statuses || {}).some(key => HARMFUL.has(key)); }
  function effectiveDef(unit) {
    let value = unit.def;
    if (status(unit, "armor_break")) value *= 0.85;
    if (status(unit, "fortress")) value *= 1 + pct(status(unit, "fortress").defPct);
    return Math.max(0, value);
  }
  function activeBuffDamageMultiplier(unit) {
    let mult = 1;
    if (status(unit, "rampage")) mult *= 1 + pct(status(unit, "rampage").damagePct);
    if (status(unit, "shield_wall")) mult *= 1 - pct(status(unit, "shield_wall").damagePenaltyPct);
    if (status(unit, "fortress")) mult *= 1 - pct(status(unit, "fortress").damagePenaltyPct);
    return mult;
  }
  function heroPassiveDamageMultiplier(state, actor, target) {
    if (actor.kind !== "hero") return 1;
    const resources = resourcesFor(state, actor);
    let bonus = 0;
    const wm = skillData(actor, "weapon_mastery"); if (wm) bonus += wm.damagePct;
    const bloodlust = skillData(actor, "bloodlust"); if (bloodlust && hpPct(actor) <= 40) bonus += bloodlust.damagePct;
    const finish = skillData(actor, "finishing_blow"); if (finish && hpPct(target) <= 40) bonus += finish.damagePct;
    const exploit = skillData(actor, "exploit_weakness"); if (exploit && hasDebuff(target)) bonus += exploit.damagePct;
    const furyRank = rank(actor, "relentless_fury");
    if (furyRank) {
      bonus += resources.fury * 3;
      if (furyRank >= 2 && hpPct(actor) <= 40) bonus += 5;
      if (furyRank >= 4 && hpPct(actor) <= 40) bonus += 5;
    }
    return 1 + pct(bonus);
  }
  function skillData(unit, id) {
    const catalog = root.HERO_SKILLS_V1_BY_ID || (typeof HERO_SKILLS_V1_BY_ID !== "undefined" ? HERO_SKILLS_V1_BY_ID : {});
    const skill = catalog[id];
    const learned = rank(unit, id);
    return skill && learned ? skill.ranks[learned - 1] : null;
  }
  function petSkillData(unit) {
    const catalog = root.PET_COMBAT_SKILLS_V2 || (typeof PET_COMBAT_SKILLS_V2 !== "undefined" ? PET_COMBAT_SKILLS_V2 : {});
    const defined = catalog[unit.petDefId] || {};
    return {
      active: { ...(defined.active || {}), ...(unit.active || {}) },
      passive: { ...(defined.passive || {}), ...(unit.passive || {}) },
      extra: { ...(defined.extra || {}), ...(unit.extra || {}) }
    };
  }
  const chancePercent = value => Math.abs(Number(value) || 0) <= 1 ? (Number(value) || 0) * 100 : Number(value) || 0;

  function procChance(state, actor, target, base, type, options = {}) {
    let value = Number(base) || 0;
    if (!options.fixed && actor.kind === "hero") {
      const resources = resourcesFor(state, actor);
      const edge = skillData(actor, "debilitating_edge"); if (edge) value += edge.procBonus;
      if (type === "armor_break") { const mastery = skillData(actor, "armor_break_mastery"); if (mastery) value += mastery.procBonus; }
      value += resources.scheme * 3;
      if (options.active) value += Number(options.activeDebuffBonus) || Number(resources.nextActiveDebuffBonus) || 0;
    }
    if (!HARMFUL.has(type)) return clamp(value, 0, 100);
    if (options.bypassStatusResist) return clamp(value, 0, 100);
    const controlResist = type === "stun" || type === "silence" ? Number(target.equipmentEffects?.ccResist) || 0 : 0;
    return Math.max(0, Math.min(STATUS_PROC_CAP, value) - (Number(target.statusResist) || 0) - controlResist);
  }

  function applyStatus(state, actor, target, key, spec = {}, context = {}) {
    ensureTeamModel(state);
    if (!STATUS_KEYS.has(key) || !living(target)) return { applied: false };
    const finalChance = procChance(state, actor, target, spec.chance == null ? 100 : spec.chance, key, context);
    if (!chance(state, finalChance)) return { applied: false, resisted: true };
    if (state.rules?.bossControlStatusConversion !== false && (target.kind === "boss" || target.kind === "raid_boss") && (key === "stun" || key === "silence")) {
      const conversion = key === "stun" ? "critical" : "armor_pierce";
      log(state, "boss_conversion", `${key === "stun" ? "Stun" : "Silence"} converted to ${conversion === "critical" ? "Critical Hit" : "30% Armor Pierce"}`, { actorId: actor.id, targetId: target.id, status: key, conversion });
      return { applied: false, converted: conversion };
    }
    const duration = Math.max(1, Math.floor(Number(spec.duration) || (key === "armor_break" ? 2 : 1)));
    if (key === "stun" && target.statuses.stun) return { applied: false, unchanged: true };
    if (key === "poison") {
      const existing = target.statuses.poison;
      target.statuses.poison = { key, duration, damage: Math.max(Number(existing && existing.damage) || 0, Number(spec.damage) || 1), sourceId: actor.id, harmful: true };
    } else {
      target.statuses[key] = { ...(target.statuses[key] || {}), ...copy(spec), key, duration, harmful: HARMFUL.has(key) };
    }
    context.appliedStatuses && context.appliedStatuses.add(`${target.id}:${key}`);
    log(state, "status", `${target.name || target.id} gained ${key}`, { actorId: actor.id, targetId: target.id, status: key });
    return { applied: true };
  }

  function heal(state, target, amount, source, label = "Heal") {
    if (!living(target)) return 0;
    const recovery = target.kind === "hero" ? skillData(target, "recovery") : null;
    const actual = Math.min(target.maxHp - target.hp, Math.max(0, Math.round(amount * (1 + pct(recovery ? recovery.receivedPct : 0)))));
    target.hp += actual;
    if (actual) log(state, "heal", `${unitName(source)} use ${label} to ${unitName(target)} heal ${actual}.`, { actorId: source && source.id, targetId: target.id, amount: actual, actionName: label });
    return actual;
  }

  function restoreSp(state, target, amount, source, label = "SP") {
    if (!living(target) || !target.maxSp) return 0;
    const recovery = target.kind === "hero" ? skillData(target, "recovery") : null;
    const actual = Math.min(target.maxSp - target.sp, Math.max(0, Math.round(amount * (1 + pct(recovery ? recovery.receivedPct : 0)))));
    target.sp += actual;
    if (actual) log(state, "sp", `${label} +${actual}`, { actorId: source && source.id, targetId: target.id, amount: actual });
    return actual;
  }

  function markDead(state, target) {
    if (target.hp > 0 || target.dead) return;
    target.hp = 0; target.dead = true;
    log(state, "death", `${unitName(target)} defeated.`, { targetId: target.id });
  }

  function receiveDamage(state, actor, target, rawDamage, context = {}) {
    let amount = Math.max(0, Math.round(rawDamage));
    const directHit = !!context.direct;
    const pet = petForSide(state, target.side);
    const guardian = pet && petSkillData(pet).extra;
    if (directHit && target.kind === "hero" && actor.side !== target.side && pet && living(pet) && guardian.type === "heroBlock" && chance(state, chancePercent(guardian.pct))) {
      log(state, "block", "Guardian Scale blocked direct damage", { actorId: actor.id, targetId: target.id });
      amount = 0;
    }
    if (status(target, "def_up")) amount = Math.round(amount * 0.7);
    if (status(target, "rampage")) amount = Math.round(amount * (1 + pct(status(target, "rampage").takenPct)));
    if (directHit && target.kind === "hero") {
      const survival = skillData(target, "survival_instinct");
      const threshold = target.maxHp * 0.25;
      if (survival && amount > threshold) amount = Math.round(threshold + (amount - threshold) * (1 - pct(survival.excessReductionPct)));
    }
    const before = target.hp;
    target.hp = Math.max(0, target.hp - amount);
    if (target.kind === "hero" && target.equipmentEffects?.robotThresholdDefUp
        && before >= target.maxHp * 0.5 && target.hp < target.maxHp * 0.5 && target.hp > 0) {
      target.statuses.def_up = { key: "def_up", duration: 2, harmful: false };
      context.appliedStatuses?.add(`${target.id}:def_up`);
      log(state, "status", "Robot Set granted DEF Up", { targetId: target.id, status: "def_up" });
    }
    if (directHit && target.kind === "hero" && target.hp <= 0 && rank(target, "thorned_aegis") >= 2 && !target.flags.aegisLethalUsed) {
      const resources = resourcesFor(state, target);
      const priorAegis = resources.aegis;
      target.hp = 1; target.flags.aegisLethalUsed = true; resources.aegis = 3;
      log(state, "survive", "Thorned Aegis prevented lethal damage", { targetId: target.id });
      if (rank(target, "thorned_aegis") >= 3 && priorAegis === 3) {
        performCounter(state, target, actor, context); resources.aegis = 0;
      } else if (rank(target, "thorned_aegis") >= 4 && priorAegis < 3 && living(actor)) {
        performCounter(state, target, actor, context);
      }
    }
    if (target.kind === "hero" && target.hp > 0 && amount > 0) {
      const secondWind = skillData(target, "second_wind");
      if (secondWind && hpPct(target) <= 40 && !target.flags.secondWindUsed) {
        heal(state, target, target.maxHp * pct(secondWind.healMaxHpPct), target, "Second Wind");
        target.flags.secondWindUsed = true;
      }
      const lastStand = directHit ? skillData(target, "last_stand") : null;
      if (lastStand && hpPct(target) <= 40 && !(target.flags.lastStandCooldown > 0) && chance(state, lastStand.chance)) {
        target.statuses.def_up = { key: "def_up", duration: 2, harmful: false };
        target.flags.lastStandCooldown = lastStand.internalCooldown;
        log(state, "status", "Last Stand granted DEF Up", { targetId: target.id });
      }
    }
    if (amount) {
      const dealt = before - target.hp;
      const text = context.direct
        ? `${unitName(actor)} ${context.actionName === "basic attack" || context.actionName === "counter attack" ? context.actionName : `use ${context.actionName || "skill"}`} to ${unitName(target)} damage ${dealt}.`
        : `${unitName(target)} took ${dealt}.`;
      log(state, "damage", text, { actorId: actor.id, targetId: target.id, amount: dealt, crit: !!context.crit, actionName: context.actionName || null });
    }
    if (directHit && target.kind === "hero" && actor.side !== target.side && before > target.hp && !context.indirect) {
      const survival = skillData(target, "survival_instinct");
      if (survival && living(actor)) {
        const playtest = root.HERO_SKILL_V1_PLAYTEST || (typeof HERO_SKILL_V1_PLAYTEST !== "undefined" ? HERO_SKILL_V1_PLAYTEST : {});
        const reflectCap = target.maxHp * pct(Number(playtest.survivalReflectCapMaxHpPct) || 10);
        const reflected = Math.max(1, Math.round(Math.min((before - target.hp) * pct(survival.reflectPct), reflectCap)));
        receiveDamage(state, target, actor, reflected, { ...context, indirect: true });
        log(state, "reflect", `Reflected ${reflected} damage`, { actorId: target.id, targetId: actor.id });
      }
    }
    markDead(state, target);
    return before - target.hp;
  }

  function attackHit(state, actor, target, spec, actionContext) {
    if (!living(actor) || !living(target)) return { hit: false, damage: 0 };
    if (!chance(state, clamp(actor.accuracy - target.dodge, 5, 99))) {
      log(state, "miss", `${unitName(actor)} missed.`, { actorId: actor.id, targetId: target.id, actionName: attackActionName(spec, actionContext) });
      return { hit: false, damage: 0 };
    }
    // Proc rolls must be known before damage for Boss conversion, but a newly
    // applied Armor Break affects subsequent hits/actions rather than the hit
    // that created it. Snapshot DEF before applying this hit's statuses.
    const targetDefAtHitStart = effectiveDef(target);
    const conversions = [];
    const hitStatuses = (spec.statuses || []).map(statusSpec => ({ ...statusSpec }));
    for (const statusSpec of hitStatuses) {
      const result = applyStatus(state, actor, target, statusSpec.key, statusSpec, { ...actionContext, active: spec.actionType === "active", fixed: !!statusSpec.fixed });
      if (result.converted) conversions.push(result.converted);
      if (result.applied) actionContext.debuffApplied = actionContext.debuffApplied || HARMFUL.has(statusSpec.key);
    }
    let critChance = actor.crit + (Number(spec.critBonus) || 0);
    if (actor.kind === "hero") {
      const killer = skillData(actor, "killer_instinct"); if (killer && hpPct(target) < 50) critChance += killer.critPct;
      const bloodlust = skillData(actor, "bloodlust"); if (bloodlust && hpPct(actor) <= 40) critChance += bloodlust.critPct || 0;
      if (status(actor, "rampage")) critChance += Number(status(actor, "rampage").critPct) || 0;
    }
    if (target.kind === "hero") critChance -= resourcesFor(state, target).aegis * 5;
    const crit = conversions.includes("critical") || !!spec.guaranteedCrit || chance(state, critChance);
    const pierce = Math.max(Number(spec.defPierce) || 0, conversions.includes("armor_pierce") ? 0.3 : 0);
    const attackPower = actor.atk * (Number(spec.mult) || 1) * activeBuffDamageMultiplier(actor) * heroPassiveDamageMultiplier(state, actor, target);
    const critMult = crit ? actor.critDamage + pct(Number(spec.critDamageBonus) || 0) + pct((skillData(actor, "critical_mastery") || {}).critDamagePct || 0) : 1;
    const baseDamage = Math.max(1, Math.round((attackPower - targetDefAtHitStart * (1 - pierce)) * critMult));
    // Optional generic actor modifier. Omitted/invalid values remain neutral;
    // Dungeon V2 sets it only after its Boss Enrage threshold is crossed.
    const damageMultiplier = Number.isFinite(Number(actor.damageMultiplier))
      ? Math.max(0, Number(actor.damageMultiplier))
      : 1;
    const damage = Math.max(1, Math.round(baseDamage * damageMultiplier));
    const dealt = receiveDamage(state, actor, target, damage, { ...actionContext, actionName: attackActionName(spec, actionContext), crit, direct: true });
    actionContext.totalDamage += dealt;
    actionContext.hitAny = true;
    actionContext.firstHitTargetId = actionContext.firstHitTargetId || target.id;
    if (spec.actionType === "active") actionContext.activeHitTargetIds.push(target.id);
    if (crit && actor.kind === "hero" && actor.equipmentEffects?.skeletonCritArmorBreak && living(target)) {
      const result = applyStatus(state, actor, target, "armor_break", { chance: 100, duration: 2 }, { ...actionContext, bypassStatusResist: true });
      if (result.applied) actionContext.debuffApplied = true;
    }
    if (target.kind === "hero" && dealt > 0) {
      actionContext.heroStruck = true;
      actionContext.struckHeroIds.add(target.id);
    }
    if (target.dead) actionContext.killed = true;
    return { hit: true, crit, damage: dealt };
  }

  function basicTarget(state, actor, requestedId, options = {}) {
    const targets = opposingUnits(state, actor);
    const requested = requestedId && state.units[requestedId];
    if (living(requested) && requested.side !== actor.side) return requested;
    if (options.strict && requestedId) return null;
    return targets.sort((a, b) => a.hp - b.hp || a.tieOrder - b.tieOrder)[0] || null;
  }
  function tickCooldowns(unit, justUsedId) {
    for (const key of Object.keys(unit.cooldowns)) if (key !== justUsedId) unit.cooldowns[key] = Math.max(0, Number(unit.cooldowns[key]) - 1);
  }
  function tickStatuses(unit, appliedStatuses) {
    for (const [key, value] of Object.entries(unit.statuses || {})) {
      if (key === "poison" || appliedStatuses.has(`${unit.id}:${key}`)) continue;
      value.duration -= 1;
      if (value.duration <= 0) delete unit.statuses[key];
    }
  }
  function reduceOneCooldown(unit, excludedId, state) {
    const candidates = Object.entries(unit.cooldowns).filter(([id, cd]) => id !== excludedId && Number(cd) > 0);
    if (!candidates.length) return false;
    const selected = state ? choose(state, candidates) : candidates.sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]))[0];
    unit.cooldowns[selected[0]] -= 1;
    return true;
  }
  function reduceAllCooldowns(unit, excludedId) {
    let changed = false;
    for (const [id, cooldown] of Object.entries(unit.cooldowns)) {
      if (id !== excludedId && Number(cooldown) > 0) { unit.cooldowns[id] -= 1; changed = true; }
    }
    return changed;
  }

  function performCounter(state, hero, enemy, actionContext) {
    if (!living(hero) || !living(enemy)) return;
    const data = skillData(hero, "counter") || { counterMult: 1 };
    const statuses = data.armorBreakChance ? [{ key: "armor_break", chance: data.armorBreakChance, duration: 2 }] : [];
    const result = attackHit(state, hero, enemy, { mult: data.counterMult, actionType: "counter", statuses }, actionContext);
    if (rank(hero, "thorned_aegis") >= 5 && result.hit) {
      const playtest = root.HERO_SKILL_V1_PLAYTEST || (typeof HERO_SKILL_V1_PLAYTEST !== "undefined" ? HERO_SKILL_V1_PLAYTEST : {});
      const stun = applyStatus(state, hero, enemy, "stun", { chance: Number(playtest.aegisCounterStunChance) || 35, duration: 1 }, actionContext);
      if (stun.applied) {
        const resources = resourcesFor(state, hero);
        resources.aegis = Math.max(0, resources.aegis - 1);
      }
    }
    log(state, "counter", "Hero countered", { actorId: hero.id, targetId: enemy.id });
  }

  function heroActiveSpec(state, actor, id) {
    const data = skillData(actor, id);
    if (!data) return null;
    const base = { id, actionType: "active", mult: data.mult || 0, hits: data.hits || 1, statuses: [], ...data };
    if (id === "heavy_blow") base.statuses.push({ key: "armor_break", chance: data.armorBreakChance, duration: 2 });
    if (id === "toxic_strike") base.statuses.push({ key: "poison", chance: data.poisonChance, duration: 3 + ((skillData(actor, "toxic_mastery") || {}).durationBonus || 0), damage: Math.max(1, Math.round(actor.atk * 0.2 * (1 + pct((skillData(actor, "toxic_mastery") || {}).poisonDamagePct || 0)))) });
    if (id === "stunning_blow") base.statuses.push({ key: "stun", chance: data.stunChance, duration: 1 });
    if (id === "silent_edge") base.statuses.push({ key: "silence", chance: data.silenceChance, duration: 2 });
    if (id === "guard") base.statuses = [];
    return base;
  }

  function resolveActor(state, actorOrId) {
    return typeof actorOrId === "string" ? state.units && state.units[actorOrId] : actorOrId;
  }

  function actionTargeting(state, actor, command = {}) {
    const type = command && command.type || "basic";
    if (type === "basic") return { mode: "enemy_single", requiresEnemyTarget: true, isSelfTarget: false, isSupport: false, isAoE: false };
    if (type === "potion") return { mode: "self", requiresEnemyTarget: false, isSelfTarget: true, isSupport: true, isAoE: false };
    if (type === "flee") return { mode: "none", requiresEnemyTarget: false, isSelfTarget: false, isSupport: false, isAoE: false };
    if (type !== "active" || !actor || actor.kind !== "hero") return { mode: "unknown", requiresEnemyTarget: false, isSelfTarget: false, isSupport: false, isAoE: false };
    const spec = heroActiveSpec(state, actor, command.skillId);
    if (!spec) return { mode: "unknown", requiresEnemyTarget: false, isSelfTarget: false, isSupport: false, isAoE: false };
    if (spec.distribution === "living") return { mode: "enemy_aoe", requiresEnemyTarget: false, isSelfTarget: false, isSupport: false, isAoE: true };
    if (spec.debuffOnly) return { mode: "enemy_single", requiresEnemyTarget: true, isSelfTarget: false, isSupport: false, isAoE: false };
    if (Number(spec.mult) > 0) return { mode: "enemy_single", requiresEnemyTarget: true, isSelfTarget: false, isSupport: false, isAoE: false };
    return { mode: "self", requiresEnemyTarget: false, isSelfTarget: true, isSupport: true, isAoE: false };
  }

  function getActionMetadata(state, actorOrId, command = {}) {
    const actor = resolveActor(state, actorOrId);
    const type = command && command.type || "basic";
    const targeting = actionTargeting(state, actor, command);
    const legalTargetIds = actor && targeting.requiresEnemyTarget
      ? opposingUnits(state, actor).map(unit => unit.id)
      : [];
    const suppliedTargetId = command && command.targetId != null ? String(command.targetId) : null;
    let reason = null;
    let spCost = 0;
    let cooldown = 0;
    if (!actor) reason = "Unknown actor";
    else if (actor.kind !== "hero") reason = "Only Hero actions expose command metadata";
    else if (type === "potion") reason = (Number(command.count) || 0) > 0 ? null : "No potion available";
    else if (type === "flee") reason = state.rules.allowFlee ? null : "Flee is not allowed";
    else if (type === "active") {
      const spec = heroActiveSpec(state, actor, command.skillId);
      if (!spec || !actor.activeSkills.includes(command.skillId) || (actor.cooldowns[command.skillId] || 0) > 0 || status(actor, "silence")) reason = "Active skill unavailable";
      else {
        const efficiency = skillData(actor, "skill_efficiency");
        const equipmentMultiplier = Math.max(0, Number(actor.equipmentEffects?.activeSkillMpMultiplier) || 1);
        spCost = spec.sp > 0 ? Math.max(1, Math.ceil(spec.sp * (1 - pct(efficiency ? efficiency.spReductionPct : 0)) * equipmentMultiplier)) : 0;
        cooldown = Number(spec.cooldown) || 0;
        if (actor.sp < spCost) reason = "Not enough SP";
      }
    } else if (type !== "basic") reason = "Unknown Hero action";
    const targetLegal = !targeting.requiresEnemyTarget
      ? true
      : suppliedTargetId == null ? null : legalTargetIds.includes(suppliedTargetId);
    return {
      actorId: actor && actor.id || null,
      actionType: type,
      skillId: command && command.skillId || null,
      usable: !reason,
      reason,
      targetMode: targeting.mode,
      requiresEnemyTarget: targeting.requiresEnemyTarget,
      isSelfTarget: targeting.isSelfTarget,
      isSupport: targeting.isSupport,
      isAoE: targeting.isAoE,
      legalTargetIds,
      targetId: suppliedTargetId,
      targetLegal,
      spCost,
      cooldown
    };
  }

  function getLegalTargetIds(state, actorOrId, command = { type: "basic" }) {
    return getActionMetadata(state, actorOrId, command).legalTargetIds;
  }

  function isLegalTarget(state, actorOrId, targetId, command = { type: "basic" }) {
    const metadata = getActionMetadata(state, actorOrId, { ...command, targetId });
    return !metadata.requiresEnemyTarget || metadata.legalTargetIds.includes(String(targetId));
  }

  function isActionUsable(state, actorOrId, command = { type: "basic" }) {
    const metadata = getActionMetadata(state, actorOrId, command);
    return metadata.usable && (!metadata.requiresEnemyTarget || metadata.targetLegal === true);
  }

  function consumeScheme(state, actor, target, context) {
    const resources = resourcesFor(state, actor);
    if (rank(actor, "usurper") < 3 || resources.scheme < 3) return false;
    const buffKey = Object.keys(target.statuses || {}).find(key => !HARMFUL.has(key) && !STEALABLE_BLOCKLIST.has(key) && target.statuses[key].stealable !== false);
    if (buffKey) {
      actor.statuses[buffKey] = copy(target.statuses[buffKey]); delete target.statuses[buffKey];
      log(state, "scheme", `Stole ${buffKey}`, { actorId: actor.id, targetId: target.id });
    } else {
      const extendable = Object.keys(target.statuses || {}).filter(key => HARMFUL.has(key) && key !== "stun");
      const key = choose(state, extendable);
      if (!key) return false;
      target.statuses[key].duration += 1;
      log(state, "scheme", `Extended ${key}`, { actorId: actor.id, targetId: target.id });
    }
    resources.scheme -= 1; resources.schemeConsumed += 1;
    context.schemeConsumed = true;
    if (rank(actor, "usurper") >= 4) resources.nextActiveDebuffBonus = 10;
    if (rank(actor, "usurper") >= 5 && resources.schemeConsumed >= 3) {
      if (!context.cdrUsed && reduceAllCooldowns(actor, context.usedSkillId)) context.cdrUsed = true;
      resources.schemeConsumed = 0;
    }
    return true;
  }

  function resolveHeroAction(state, actor, command, context) {
    const resources = resourcesFor(state, actor);
    const type = command.type || "basic";
    if (type === "flee") {
      if (!state.rules.allowFlee) { log(state, "flee", "Flee is not allowed"); return; }
      if (chance(state, Math.min(99, 50 + (Number(actor.agi) || 0) * 0.5))) { state.flags.fled = true; state.result = "fled"; log(state, "flee", "Escaped successfully"); }
      else log(state, "flee", "Escape Failed!");
      return;
    }
    if (type === "potion") {
      if ((Number(command.count) || 0) <= 0) { log(state, "invalid", "No potion available"); return; }
      heal(state, actor, Number(command.heal) || actor.maxHp * 0.35, actor, "Potion");
      if (command.restoreSp) restoreSp(state, actor, Number(command.restoreSp), actor, "Potion SP");
      context.consumePotion = true; return;
    }
    const metadata = getActionMetadata(state, actor, command);
    const requiresTarget = metadata.requiresEnemyTarget;
    const requestedTargetId = command.targetId || state.selectedTargetIds?.[actor.side] || state.selectedTargetId;
    const target = basicTarget(state, actor, requestedTargetId, { strict: requiresTarget && context.strictTarget });
    if (requiresTarget && !target) return;
    if (target) context.targetHadDebuff = hasDebuff(target);
    if (type === "active") {
      const id = command.skillId;
      const spec = heroActiveSpec(state, actor, id);
      if (!spec || !actor.activeSkills.includes(id) || (actor.cooldowns[id] || 0) > 0 || status(actor, "silence")) { log(state, "invalid", "Active skill unavailable"); return; }
      const efficiency = skillData(actor, "skill_efficiency");
      const equipmentMultiplier = Math.max(0, Number(actor.equipmentEffects?.activeSkillMpMultiplier) || 1);
      const cost = spec.sp > 0 ? Math.max(1, Math.ceil(spec.sp * (1 - pct(efficiency ? efficiency.spReductionPct : 0)) * equipmentMultiplier)) : 0;
      if (actor.sp < cost) { log(state, "invalid", "Not enough SP"); return; }
      actor.sp -= cost; context.usedSkillId = id; context.wasActive = true;
      context.attackAction = Number(spec.mult) > 0;
      const schemeEligible = context.attackAction || id === "disruption";
      context.activeDebuffBonus = schemeEligible ? resources.nextActiveDebuffBonus : 0;
      if (schemeEligible) resources.nextActiveDebuffBonus = 0;
      if (id === "rampage") { actor.statuses.rampage = { key: "rampage", duration: spec.duration, damagePct: spec.damagePct, critPct: spec.critPct || 0, takenPct: spec.takenPct, stealable: false }; context.appliedStatuses.add(`${actor.id}:rampage`); }
      else if (id === "shield_wall") {
        actor.statuses.shield_wall = { key: "shield_wall", duration: spec.duration, damagePenaltyPct: spec.damagePenaltyPct, stealable: false };
        actor.statuses.def_up = { key: "def_up", duration: spec.duration, harmful: false };
        context.appliedStatuses.add(`${actor.id}:shield_wall`); context.appliedStatuses.add(`${actor.id}:def_up`);
      }
      else if (id === "fortress") { actor.statuses.fortress = { key: "fortress", duration: spec.duration, defPct: spec.defPct, damagePenaltyPct: spec.damagePenaltyPct, stealable: false }; context.appliedStatuses.add(`${actor.id}:fortress`); }
      else if (id === "counter") { actor.statuses.counter = { key: "counter", duration: 1, counterMult: spec.counterMult, stealable: false }; context.appliedStatuses.add(`${actor.id}:counter`); }
      else if (id === "disruption") {
        const pool = ["poison", "armor_break", "silence", "stun"];
        const picked = [];
        while (picked.length < spec.count && pool.length) {
          const key = chooseWeighted(state, pool, candidate => candidate === "stun" && spec.count < 4 ? spec.stunWeight : 1);
          picked.push(key); pool.splice(pool.indexOf(key), 1);
        }
        for (const key of picked) {
          const applied = applyStatus(state, actor, target, key, { chance: spec.procChance, duration: key === "stun" ? 1 : key === "armor_break" ? 2 : 3, damage: key === "poison" ? Math.round(actor.atk * 0.2) : undefined }, { ...context, active: true });
          if (applied.applied) context.debuffApplied = true;
        }
      } else {
        const distributedTargets = id === "blade_storm"
          ? [target, ...opposingUnits(state, actor).filter(unit => unit.id !== target.id)]
          : [target];
        for (let hit = 0; hit < spec.hits; hit++) {
          let hitTarget = distributedTargets[hit % distributedTargets.length];
          if (!living(hitTarget)) hitTarget = distributedTargets.find(living) || basicTarget(state, actor, null);
          if (!hitTarget) break;
          const hitSpec = { ...spec, statuses: spec.statuses.slice() };
          if (hit === 0 && rank(actor, "relentless_fury") >= 3 && resources.fury === 3) hitSpec.statuses.push({ key: "stun", chance: 5, duration: 1, fixed: true });
          if (id === "blade_storm" && spec.stunChancePerHit) hitSpec.statuses.push({ key: "stun", chance: spec.stunChancePerHit, duration: 1, fixed: true });
          attackHit(state, actor, hitTarget, hitSpec, context);
        }
        if (id === "guard") { actor.statuses.def_up = { key: "def_up", duration: spec.duration, harmful: false }; context.appliedStatuses.add(`${actor.id}:def_up`); }
      }
      actor.cooldowns[id] = Number(spec.cooldown) || 0;
      if (schemeEligible) consumeScheme(state, actor, target, context);
    } else {
      context.attackAction = true;
      const statuses = rank(actor, "relentless_fury") >= 3 && resources.fury === 3 ? [{ key: "stun", chance: 5, duration: 1, fixed: true }] : [];
      const hit = attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses }, context);
      const drain = skillData(actor, "life_drain");
      if (hit.damage && drain) heal(state, actor, Math.min(hit.damage * pct(drain.drainPct), actor.maxHp * 0.10), actor, "Life Drain");
      const spirit = skillData(actor, "spirit_drain"); if (hit.hit && spirit) restoreSp(state, actor, spirit.spRestore, actor, "Spirit Drain");
    }
    if (context.attackAction) {
      const furyRank = rank(actor, "relentless_fury"); if (furyRank) resources.fury = Math.min(3, resources.fury + 1);
      const quick = skillData(actor, "quick_recovery");
      if (quick && context.targetHadDebuff && !context.cdrUsed && chance(state, quick.chance + (rank(actor, "usurper") >= 2 ? resources.scheme * 2 : 0)) && reduceOneCooldown(actor, context.usedSkillId, state)) context.cdrUsed = true;
    }
    if (context.debuffApplied && rank(actor, "usurper")) resources.scheme = Math.min(3, resources.scheme + 1);
    const tactician = skillData(actor, "master_tactician");
    if (tactician && context.targetHadDebuff && chance(state, tactician.chance)) {
      const extendable = Object.keys(target.statuses || {}).filter(key => HARMFUL.has(key) && key !== "stun");
      const key = choose(state, extendable);
      if (key) { target.statuses[key].duration += 1; log(state, "status", `Master Tactician extended ${key}`, { actorId: actor.id, targetId: target.id }); }
    }
    if (context.killed && rank(actor, "relentless_fury") >= 5 && resources.fury > 0 && !context.cdrUsed && reduceOneCooldown(actor, context.usedSkillId, state)) { resources.fury -= 1; context.cdrUsed = true; }
  }

  function resolvePetAction(state, actor, context) {
    const hero = heroForSide(state, actor.side);
    const target = basicTarget(state, actor, state.selectedTargetIds?.[actor.side] || state.selectedTargetId);
    if (!target) return;
    const { active } = petSkillData(actor);
    const activeReady = (actor.cooldowns.pet_active || 0) === 0;
    const activeName = active.name || "Pet Active";
    const isSupport = active.type === "regen" || active.type === "groupHeal";
    const needsHeal = living(hero) && (hpPct(hero) <= 60 || (active.type === "groupHeal" && hpPct(actor) <= 60));
    if (isSupport && activeReady && needsHeal) {
      log(state, "pet_active", `${unitName(actor)} use ${activeName}.`, { actorId: actor.id, skillName: activeName });
      const amount = actor.maxHp * (Number(active.healPetHpPct) || 0) + (Number(actor.vit) || 0) * (Number(active.vitScale) || 0);
      if (active.type === "regen") hero.statuses.pet_regrowth = { key: "pet_regrowth", duration: Math.max(1, Number(active.regenTurns) || 1), heal: Math.round(amount), sourceId: actor.id, stealable: false };
      else { heal(state, hero, amount, actor, "Moonlight Heal"); heal(state, actor, amount, actor, "Moonlight Heal"); }
      actor.cooldowns.pet_active = Number(active.cooldown) || 0; context.usedSkillId = "pet_active"; return;
    }
    if (!activeReady) { attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses: [] }, context); return; }
    if (active.type !== "damage" && active.type !== "aoe") { attackHit(state, actor, target, { mult: 1, actionType: "basic", statuses: [] }, context); return; }
    const spec = { mult: Number(active.mult) || 1, actionType: "active", actionName: activeName, statuses: [] };
    if (active.stunChance) spec.statuses.push({ key: "stun", chance: chancePercent(active.stunChance), duration: 1 });
    if (active.armorBreakChance) spec.statuses.push({ key: "armor_break", chance: chancePercent(active.armorBreakChance), duration: 2 });
    if (active.poisonChance) spec.statuses.push({ key: "poison", chance: chancePercent(active.poisonChance), duration: Math.max(1, Number(active.poisonTurns) || 1), damage: Math.round(actor.atk * (Number(active.poisonPct) || 0)) });
    if (active.silenceChance) spec.statuses.push({ key: "silence", chance: chancePercent(active.silenceChance), duration: 2 });
    const targets = active.type === "aoe" ? opposingUnits(state, actor).slice(0, 3) : [target];
    log(state, "pet_active", `${unitName(actor)} use ${activeName}.`, { actorId: actor.id, skillName: activeName });
    targets.forEach(unit => attackHit(state, actor, unit, spec, context));
    if (living(hero) && active.defUpChance && chance(state, chancePercent(active.defUpChance))) applyStatus(state, actor, hero, "def_up", { chance: 100, duration: Math.max(1, Number(active.defUpTurns) || 1) }, context);
    actor.cooldowns.pet_active = Number(active.cooldown) || 0; context.usedSkillId = "pet_active";
  }

  function nextDungeonEnemyAction(actor) {
    if (!Array.isArray(actor.dungeonV2SkillCycle) || !actor.dungeonV2SkillCycle.length) return null;
    if (actor.dungeonV2PendingAction) {
      const pending = actor.dungeonV2PendingAction;
      actor.dungeonV2PendingAction = null;
      if (pending.id === "overgrowth") actor.dungeonV2OvergrowthUsed = true;
      return pending;
    }
    const index = Math.max(0, Math.floor(Number(actor.dungeonV2CycleIndex) || 0)) % actor.dungeonV2SkillCycle.length;
    actor.dungeonV2CycleIndex = (index + 1) % actor.dungeonV2SkillCycle.length;
    return actor.dungeonV2SkillCycle[index];
  }

  function materializeEnemyStatuses(actor, statuses) {
    return (statuses || []).map(statusSpec => ({
      ...statusSpec,
      damage: statusSpec.damagePct == null
        ? statusSpec.damage
        : Math.max(1, Math.round(actor.atk * Number(statusSpec.damagePct)))
    }));
  }

  function resolveDungeonEnemyAction(state, actor, action, context) {
    if (!action) return;
    log(state, "enemy_skill", `${unitName(actor)} use ${action.actionName || action.id || "skill"}.`, {
      actorId: actor.id,
      skillId: action.id || null,
      actionName: action.actionName || action.id || "skill"
    });
    if (action.kind === "utility") {
      if (action.selfStatus) {
        applyStatus(state, actor, actor, action.selfStatus.key, { ...action.selfStatus, chance: 100 }, context);
      }
      return;
    }
    const targets = action.targetMode === "all_opposing"
      ? opposingUnits(state, actor)
      : [choose(state, opposingUnits(state, actor))].filter(Boolean);
    const statuses = materializeEnemyStatuses(actor, action.statuses);
    const hits = Math.max(1, Math.floor(Number(action.hits) || 1));
    for (const target of targets) {
      for (let hit = 0; hit < hits && living(target); hit++) {
        attackHit(state, actor, target, {
          mult: Number(action.mult) || 1,
          actionType: "enemy",
          actionName: action.actionName || action.id || "skill",
          statuses: statuses.map(statusSpec => ({ ...statusSpec }))
        }, context);
      }
    }
  }

  function resolveEnemyAction(state, actor, context) {
    const dungeonAction = state.mode === "dungeon" ? nextDungeonEnemyAction(actor) : null;
    if (dungeonAction) {
      resolveDungeonEnemyAction(state, actor, dungeonAction, context);
      return;
    }
    const targets = opposingUnits(state, actor);
    if (!targets.length) return;
    const target = choose(state, targets);
    const hits = Math.max(1, Math.floor(Number(actor.ai.hits) || 1));
    for (let hit = 0; hit < hits && living(target); hit++) attackHit(state, actor, target, { mult: Number(actor.ai.mult) || 1, actionType: "enemy", statuses: actor.ai.statuses || [] }, context);
  }

  function startEffects(state, actor, context) {
    const poison = status(actor, "poison");
    if (poison) {
      const source = state.units[poison.sourceId] || { id: poison.sourceId || "poison", side: state.teamIds.find(side => side !== actor.side) };
      receiveDamage(state, source, actor, poison.damage, context);
      poison.duration -= 1; if (poison.duration <= 0) delete actor.statuses.poison;
    }
    const regen = status(actor, "pet_regrowth"); if (regen) heal(state, actor, regen.heal, state.units[regen.sourceId], "Regrowth");
  }

  function resolveHeroReactionsAfterAction(state, actor, context) {
    for (const heroId of context.struckHeroIds) {
      const hero = state.units[heroId];
      if (!living(hero) || hero.side === actor.side) continue;
      if (status(hero, "counter") && living(actor)) { performCounter(state, hero, actor, context); delete hero.statuses.counter; }
      if (!rank(hero, "thorned_aegis")) continue;
      hero.flags.hitSinceLastHeroAction = true;
      if (status(hero, "def_up")) {
        const resources = resourcesFor(state, hero);
        const before = resources.aegis; resources.aegis = Math.min(3, before + 1);
        if (rank(hero, "thorned_aegis") >= 4 && before < 3 && resources.aegis === 3 && living(actor)) performCounter(state, hero, actor, context);
      }
    }
  }

  function resolveMythicEffectsAfterAction(state, actor, context) {
    if (actor.kind === "hero" && context.attackAction && context.hitAny) {
      const effects = actor.equipmentEffects || {};
      if (effects.bossWeaponSignature === "spirit_restore" && chance(state, 30)) {
        heal(state, actor, actor.maxHp * 0.10, actor, "Spirit Greatsword");
      }
      if (effects.bossWeaponSignature === "lavalon_extra_basic" && context.wasActive) {
        let extras = 0;
        for (const targetId of context.activeHitTargetIds) {
          if (extras >= 3) break;
          const target = state.units[targetId];
          if (living(target) && chance(state, 10)) {
            attackHit(state, actor, target, { mult: 1, actionType: "basic", actionName: "Lavalon extra attack", statuses: [] }, context);
            extras += 1;
          }
        }
      }
    }
    if (actor.kind !== "hero" && context.heroStruck) {
      for (const heroId of context.struckHeroIds) {
        const hero = state.units[heroId];
        if (living(hero) && living(actor) && hero.equipmentEffects?.bossWeaponSignature === "icicle_counter" && chance(state, 20)) {
          attackHit(state, hero, actor, { mult: 1, actionType: "counter", actionName: "Icicle counter", statuses: [] }, context);
          log(state, "counter", "Icicle Longsword countered", { actorId: hero.id, targetId: actor.id });
        }
      }
    }
  }

  function finishBattle(state, result, winnerSide = null, text = null) {
    if (state.result) return;
    state.winnerSide = winnerSide;
    state.result = result;
    state.flags.auto = false;
    resetBattleResources(state);
    log(state, "battle_end", text || (result === "victory" ? "Victory" : result === "defeat" ? "Defeat" : "Draw"));
  }

  function checkBattleEnd(state) {
    if (state.result) return true;
    if (state.mode === "arena") {
      const attackerSide = state.controlledSide;
      const defenderSide = state.teamIds.find(side => side !== attackerSide) || null;
      const attackerHero = heroForSide(state, attackerSide);
      const defenderHero = heroForSide(state, defenderSide);
      if (!living(attackerHero)) {
        finishBattle(state, "defeat", defenderSide);
        return true;
      }
      if (!living(defenderHero)) {
        finishBattle(state, "victory", attackerSide);
        return true;
      }
      return false;
    }
    const aliveSides = state.teamIds.filter(side => livingTeamUnits(state, side).length);
    if (aliveSides.length > 1) return false;
    const winnerSide = aliveSides[0] || null;
    const result = winnerSide === state.controlledSide ? "victory" : "defeat";
    const hero = heroForSide(state, state.controlledSide);
    const pet = petForSide(state, state.controlledSide);
    if (state.mode === "dungeon" && !living(hero) && living(pet) && result === "victory") state.flags.heroReviveNextFloor = true;
    finishBattle(state, result, winnerSide);
    return true;
  }

  function completeArenaRound(state) {
    if (state.result || state.mode !== "arena" || state.round < 20) return false;
    const pending = state.queue.slice(state.queueIndex).some(id => living(state.units[id]));
    if (pending) return false;
    if (checkBattleEnd(state)) return true;
    finishBattle(state, "draw", null);
    return true;
  }

  function validateHeroCommand(state, actor, command, options = {}) {
    const metadata = getActionMetadata(state, actor, command);
    if (metadata.reason) return metadata.reason;
    if (metadata.requiresEnemyTarget && options.strictTarget) {
      if (!metadata.targetId) return "Target required";
      if (!metadata.targetLegal) return "Invalid target";
    }
    return null;
  }

  function battleStep(inputState, command) {
    // Presentation only observes the returned state/log. Animation timing, UI
    // speed and VFX must never decide queue order or gameplay resolution here.
    const state = ensureTeamModel(copy(inputState));
    if (state.result) return { state, waiting: false, completedAction: false };
    const actor = currentUnit(state);
    if (!actor) { checkBattleEnd(state); return { state, waiting: false, completedAction: false }; }
    // A mode orchestrator may authorize a non-controlled Hero command (for
    // example Arena defender AI) without changing controlledSide. This keeps
    // Arena result semantics anchored to team_a while still routing the command
    // through the shared resolver.
    const commandActor = state.commandActorId && actor.id === state.commandActorId;
    const manualActor = actor.kind === "hero" && (actor.side === state.controlledSide || commandActor);
    if (manualActor && !command && !state.flags.auto && !state.flags.skipResolving) return { state, waiting: true, completedAction: false };
    const strictArenaTarget = state.mode === "arena" && manualActor && !commandActor && !state.flags.auto && !state.flags.skipResolving;
    if (manualActor && command) {
      const invalid = validateHeroCommand(state, actor, command, { strictTarget: strictArenaTarget });
      if (invalid) {
        log(state, "invalid", invalid);
        return { state, waiting: true, completedAction: false, error: invalid };
      }
    }
    const context = { appliedStatuses: new Set(), struckHeroIds: new Set(), activeHitTargetIds: [], firstHitTargetId: null, azureProcRolled: false, totalDamage: 0, hitAny: false, heroStruck: false, killed: false, debuffApplied: false, cdrUsed: false, usedSkillId: null, schemeConsumed: false, activeDebuffBonus: 0, attackAction: false, targetHadDebuff: false, strictTarget: strictArenaTarget };
    startEffects(state, actor, context);
    if (living(actor)) {
      if (status(actor, "stun")) { delete actor.statuses.stun; log(state, "stun", `${actor.name || actor.id} lost the Action`); }
      else if (actor.kind === "hero") {
        state.heroTurnCounts[actor.id] = (Number(state.heroTurnCounts[actor.id]) || 0) + 1;
        if (actor.id === state.heroId) state.heroTurnCount += 1;
        resolveHeroAction(state, actor, manualActor && command ? command : { type: "basic" }, context);
      } else if (actor.kind === "pet") resolvePetAction(state, actor, context);
      else resolveEnemyAction(state, actor, context);
    }
    resolveHeroReactionsAfterAction(state, actor, context);
    resolveMythicEffectsAfterAction(state, actor, context);
    const pet = petForSide(state, actor.side);
    const petCdr = pet && petSkillData(pet).extra;
    if (context.debuffApplied && (actor.kind === "hero" || actor.kind === "pet") && pet && living(pet) && petCdr.type === "petCdrOnDebuff" && !context.cdrUsed && !(actor.id === pet.id && context.usedSkillId === "pet_active") && Number(pet.cooldowns.pet_active) > 0 && chance(state, chancePercent(petCdr.pct))) {
      pet.cooldowns.pet_active -= 1; context.cdrUsed = true;
      log(state, "cooldown", "Thunder Judgment reduced Pet Active cooldown", { actorId: actor.id, targetId: pet.id });
    }
    tickCooldowns(actor, context.usedSkillId);
    tickStatuses(actor, context.appliedStatuses);
    if (actor.kind === "hero") {
      const resources = resourcesFor(state, actor);
      actor.flags.lastStandCooldown = Math.max(0, Number(actor.flags.lastStandCooldown) - 1);
      if (!actor.flags.hitSinceLastHeroAction && resources.aegis > 0) resources.aegis -= 1;
      actor.flags.hitSinceLastHeroAction = false;
    }
    checkBattleEnd(state);
    state.queueIndex += 1; state.safeActionSeq += 1;
    completeArenaRound(state);
    delete state.commandActorId;
    return { state, waiting: false, completedAction: true, consumePotion: !!context.consumePotion };
  }

  function simulateBattle(inputState, maxActions = 10000) {
    let state = copy(inputState); state.flags.skipResolving = true; state.flags.auto = false;
    let actions = 0;
    while (!state.result && actions < maxActions) { const result = battleStep(state, { type: "basic" }); state = result.state; actions += result.completedAction ? 1 : 0; }
    state.flags.skipResolving = false;
    if (!state.result) { state.result = "invalid"; log(state, "error", "Simulation action limit reached"); }
    return state;
  }

  function serializeCheckpoint(state) {
    if (!state || state.version !== 1 || !state.battleId || (state.result && state.result !== "draw")) throw new Error("invalid_checkpoint_state");
    const checkpoint = ensureTeamModel(copy(state));
    return JSON.stringify({ ...checkpoint, flags: { ...checkpoint.flags, auto: false, skipResolving: false } });
  }
  function restoreCheckpoint(raw) {
    const state = typeof raw === "string" ? JSON.parse(raw) : copy(raw);
    if (!state || state.version !== 1 || !state.battleId || !state.units || (!state.heroId && !Array.isArray(state.teamIds)) || !Array.isArray(state.queue)) throw new Error("corrupt_checkpoint");
    ensureTeamModel(state);
    state.flags = { ...(state.flags || {}), auto: false, skipResolving: false };
    return state;
  }

  const api = {
    BATTLE_MODE_ADAPTERS,
    buildHeroUnit, buildPetUnit, buildMonsterUnit,
    createBattle, createTeamBattle, createDungeonBattle, createArenaBattle, createRaidBattle,
    rebuildQueue, currentUnit, upcomingActions, applyStatus, battleStep, simulateBattle,
    basicTarget, getActionMetadata, getLegalTargetIds, isLegalTarget, isActionUsable, validateHeroCommand,
    serializeCheckpoint, restoreCheckpoint
  };
  Object.assign(root, { BATTLE_CORE_V1: api });
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

// ---------- Phase 5: PvP Arena orchestration ----------
// W9 closeout: legacy V1 orchestration is retired; only helpers still shared by Arena V2 remain below.
const PVP_BASE_SPEED = 10; // shared Arena speed baseline retained for V2 combat snapshots

function petBattleStats(instance) {
  if (!instance) return null;
  const defId = instance.defId === "thunder_cub" ? "hell_wolf" : instance.defId;
  const base = PET_BASE_STATS[defId] || PET_BASE_STATS.sprout;
  const growth = PET_GROWTH_STATS[defId] || PET_GROWTH_STATS.sprout;
  const lvl = Math.max(1, Math.min(50, Number(instance.level) || 1));
  const mult = PET_STAR_MULT[Math.max(0, Math.min(PET_STAR_MULT.length - 1, (Number(instance.star) || 1) - 1))] || 1;
  const values = instance.statModel === "v2" && instance.stats
    ? [instance.stats.str, instance.stats.vit, instance.stats.agi, instance.stats.dex, instance.stats.luk]
    : base.map((value, index) => value + growth[index] * (lvl - 1));
  const s = { str: values[0] * mult, vit: values[1] * mult, agi: values[2] * mult, dex: values[3] * mult, luk: values[4] * mult };
  return {
    defId: instance.defId || "",
    maxHp: Math.round(30 + lvl * 4 + s.vit * 7),
    atk: Math.round(5 + lvl * 0.7 + s.str * 2),
    def: Math.round(2 + lvl * 0.25 + s.vit * 0.5),
    evasion: Math.min(20, Math.round(s.agi * 0.35 * 10) / 10),
    critChance: Math.min(25, Math.round(s.luk * 0.4 * 10) / 10),
    agi: s.agi, vit: s.vit,
  };
}

function parsePetsJson(character) {
  let parsed = {};
  try { parsed = character.pets_json ? JSON.parse(character.pets_json) : {}; } catch (e) { parsed = {}; }
  const list = Array.isArray(parsed.list) ? parsed.list : [];
  const skillLevels = parsed.skills && typeof parsed.skills === "object" ? parsed.skills : {};
  // Pet instances key on instId (see src/systems/pets.js's newPetInstance()), NOT id.
  const active = list.find((p) => p && p.instId === character.active_pet_id) || null;
  return { active, skillLevels };
}

const PET_DISPLAY_NAMES = {
  sprout: "Sprout", flamekit: "Flamekit", sparkpup: "Sparkpup", ember_fox: "Ember Fox",
  moon_hare: "Moon Hare", hell_wolf: "Hell Wolf", inferno_drake: "Inferno Drake", storm_phoenix: "Storm Phoenix",
};

function pvpPetUnit(instance, id, ownerName) {
  const bs = petBattleStats(instance);
  if (!bs) return null;
  const speciesName = PET_DISPLAY_NAMES[bs.defId] || "Pet";
  return {
    id, kind: "pet", name: ownerName ? `${ownerName}'s ${speciesName}` : speciesName, petDefId: bs.defId,
    maxHp: bs.maxHp, hp: bs.maxHp,
    atk: bs.atk, def: bs.def,
    speed: Math.round(PVP_BASE_SPEED + bs.agi * 1.5),
    dodge: bs.evasion, crit: bs.critChance, vit: bs.vit,
  };
}

function pvpHeroSkillsPublic(actor) {
  if (!actor) return [];
  return heroActiveSkillList(actor.skills).map((s) => ({ ...s, cooldownRemaining: actor.cooldowns[s.key] || 0 }));
}

function pvpPublicLogEntry(e, { includeSeq = false } = {}) {
  const entry = {
    type: e.type, text: e.text, actorId: e.actorId || null, targetId: e.targetId || null,
    crit: !!e.crit, amount: e.amount != null ? e.amount : null, actionName: e.actionName || null,
    status: e.status || null, skillName: e.skillName || null,
  };
  if (includeSeq && Number.isFinite(Number(e.seq))) entry.seq = Number(e.seq);
  return entry;
}

// ---------- Phase 5: PvP Arena V2 server foundation + W9.5 lifecycle ----------
// Arena V2 is the only production Arena runtime after W9 closeout. Legacy V1 routes
// and pvp_* runtime reads/writes are retired; historical V1 tables are dropped only
// after this V2-only Worker cutover is deployed and verified.
const ARENA_V2_UNLOCK_LEVEL = 10;
const ARENA_TICKET_MAX = 10;
const ARENA_TICKET_PASSIVE_MS = 2 * 60 * 60 * 1000;
const ARENA_TICKET_DAILY_GRANT = 5;
const ARENA_TICKET_PURCHASE_COST = 10;
const ARENA_SEASON_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;
const ARENA_REFRESH_COOLDOWN_MS = 10 * 1000;
const ARENA_PREPARED_TTL_MS = 2 * 60 * 1000;
const ARENA_ACTIVE_DURATION_MS = 10 * 60 * 1000;
const ARENA_SURRENDER_COOLDOWN_MS = 10 * 1000;
const ARENA_MATCH_BANDS = Object.freeze({
  lower: { min: -225, max: -75, rewardSlot: "lower" },
  equal: { min: -74, max: 74, rewardSlot: "equal" },
  higher: { min: 75, max: 225, rewardSlot: "higher" },
});
const ARENA_BOT_DEFS = Object.freeze([
  { id: "warrior", name: "BOT Warrior", level: 10, rating: 1000, archetype: "warrior", pet: null },
  { id: "guardian", name: "BOT Guardian", level: 15, rating: 1125, archetype: "guardian", pet: null },
  { id: "assassin", name: "BOT Assassin", level: 25, rating: 1275, archetype: "assassin", pet: null },
  { id: "poison", name: "BOT Poison", level: 35, rating: 1375, archetype: "poison", pet: null },
  { id: "balanced", name: "BOT Balanced", level: 45, rating: 1425, archetype: "balanced", pet: null },
  { id: "pet_master", name: "BOT Pet Master", level: 50, rating: 1500, archetype: "pet_master", pet: null },
]);

function arenaNowMs(now = Date.now()) {
  const value = now instanceof Date ? now.getTime() : (typeof now === "number" ? now : Date.parse(String(now)));
  return Number.isFinite(value) ? value : Date.now();
}
function arenaNowIso(now = Date.now()) { return new Date(arenaNowMs(now)).toISOString(); }
function arenaUtcDateKey(now = Date.now()) { return arenaNowIso(now).slice(0, 10); }
function arenaUtcDayDiff(fromKey, toKey) {
  const from = Date.parse(`${fromKey}T00:00:00.000Z`);
  const to = Date.parse(`${toKey}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return 0;
  return Math.floor((to - from) / 86400000);
}
function arenaTicketSecondsToNext(anchor, now = Date.now()) {
  if (!anchor) return 0;
  const at = Date.parse(anchor);
  if (!Number.isFinite(at)) return 0;
  const elapsed = Math.max(0, arenaNowMs(now) - at);
  return Math.max(0, Math.ceil((ARENA_TICKET_PASSIVE_MS - (elapsed % ARENA_TICKET_PASSIVE_MS)) / 1000));
}
function arenaTicketStateAt(row, now = Date.now()) {
  const nowMs = arenaNowMs(now);
  const today = arenaUtcDateKey(nowMs);
  let tickets = Number.isFinite(Number(row?.tickets)) ? Math.max(0, Math.min(ARENA_TICKET_MAX, Math.floor(Number(row.tickets)))) : 0;
  let anchor = row?.ticket_updated_at || "";
  let dailyKey = /^\d{4}-\d{2}-\d{2}$/.test(String(row?.last_daily_ticket_date || "")) ? row.last_daily_ticket_date : "";
  let dailyGrant = 0;

  const missedDays = dailyKey ? arenaUtcDayDiff(dailyKey, today) : 1;
  if (missedDays > 0) {
    dailyGrant = Math.min(ARENA_TICKET_MAX - tickets, missedDays * ARENA_TICKET_DAILY_GRANT);
    tickets += dailyGrant;
    dailyKey = today;
  } else if (!dailyKey) {
    dailyKey = today;
  }

  if (tickets >= ARENA_TICKET_MAX) {
    tickets = ARENA_TICKET_MAX;
    anchor = "";
  } else {
    const anchorMs = Date.parse(anchor);
    if (!Number.isFinite(anchorMs)) {
      anchor = new Date(nowMs).toISOString();
    } else {
      const ticks = Math.floor(Math.max(0, nowMs - anchorMs) / ARENA_TICKET_PASSIVE_MS);
      if (ticks > 0) {
        tickets = Math.min(ARENA_TICKET_MAX, tickets + ticks);
        anchor = tickets >= ARENA_TICKET_MAX ? "" : new Date(anchorMs + ticks * ARENA_TICKET_PASSIVE_MS).toISOString();
      }
    }
    if (tickets >= ARENA_TICKET_MAX) anchor = "";
  }
  return {
    tickets,
    ticketUpdatedAt: anchor,
    lastDailyTicketDate: dailyKey,
    dailyGrant,
    nextPassiveTicketAt: anchor ? new Date(Date.parse(anchor) + ARENA_TICKET_PASSIVE_MS).toISOString() : null,
    passiveSeconds: arenaTicketSecondsToNext(anchor, nowMs),
  };
}

async function ensureArenaCharacterState(db, characterId, now = Date.now()) {
  const at = arenaNowIso(now);
  await db.prepare(`
    INSERT INTO arena_character_state
      (character_id, arena_coin, tickets, ticket_updated_at, last_daily_ticket_date, unlock_notice_seen, created_at, updated_at)
    VALUES (?, 0, 0, '', '', 0, ?, ?)
    ON CONFLICT(character_id) DO NOTHING
  `).bind(characterId, at, at).run();
  return await db.prepare(`SELECT * FROM arena_character_state WHERE character_id = ?`).bind(characterId).first();
}

async function reconcileArenaV2Tickets(db, characterId, now = Date.now()) {
  const nowMs = arenaNowMs(now);
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await ensureArenaCharacterState(db, characterId, nowMs);
    const next = arenaTicketStateAt(current, nowMs);
    const changed = Number(current.tickets) !== next.tickets
      || String(current.ticket_updated_at || "") !== next.ticketUpdatedAt
      || String(current.last_daily_ticket_date || "") !== next.lastDailyTicketDate;
    if (!changed) return { ...next, changed: false };
    const result = await db.prepare(`
      UPDATE arena_character_state
      SET tickets = ?, ticket_updated_at = ?, last_daily_ticket_date = ?, updated_at = ?
      WHERE character_id = ? AND tickets = ? AND ticket_updated_at = ? AND last_daily_ticket_date = ?
    `).bind(
      next.tickets, next.ticketUpdatedAt, next.lastDailyTicketDate, arenaNowIso(nowMs), characterId,
      current.tickets, current.ticket_updated_at || "", current.last_daily_ticket_date || ""
    ).run();
    if (result.meta && result.meta.changes) return { ...next, changed: true };
  }
  return { ...(arenaTicketStateAt(await ensureArenaCharacterState(db, characterId, nowMs), nowMs)), changed: false };
}

function arenaTierForRating(rating) {
  const value = Number(rating) || 1000;
  return value >= 1450 ? "Diamond" : value >= 1250 ? "Gold" : value >= 1100 ? "Silver" : "Bronze";
}
function arenaPreviousTierBase(rating) {
  const value = Number(rating) || 1000;
  return value >= 1450 ? 1250 : value >= 1250 ? 1100 : 1000;
}
const ARENA_RATING_K = 24;
const ARENA_RATING_FLOOR = 1000;
const ARENA_DIAMOND_ENTRY_RATING = 1450;
const ARENA_PROMOTION_REWARDS = Object.freeze({
  1: { tier: "Silver", arenaCoin: 500, diamonds: 100 },
  2: { tier: "Gold", arenaCoin: 1000, diamonds: 200 },
  3: { tier: "Diamond", arenaCoin: 2000, diamonds: 400 },
});
const ARENA_COIN_REWARDS = Object.freeze({
  lower: { win: 10, draw: 6, loss: 3 },
  equal: { win: 15, draw: 9, loss: 5 },
  higher: { win: 20, draw: 12, loss: 7 },
});
const ARENA_MILESTONE_REWARDS = Object.freeze({
  play: [
    { threshold: 10, arenaCoin: 100 }, { threshold: 25, arenaCoin: 200 },
    { threshold: 50, arenaCoin: 400 }, { threshold: 100, arenaCoin: 800 },
  ],
  win: [
    { threshold: 5, arenaCoin: 150 }, { threshold: 15, arenaCoin: 300 },
    { threshold: 30, arenaCoin: 600 }, { threshold: 50, arenaCoin: 1000 },
  ],
});
const ARENA_SEASON_REWARDS = Object.freeze({
  rank1: { arenaCoin: 5000, diamonds: 1000, manaOre: 25, frameKey: "arena_rank_1" },
  rank2: { arenaCoin: 4000, diamonds: 750, manaOre: 20, frameKey: "arena_rank_2" },
  rank3: { arenaCoin: 3000, diamonds: 500, manaOre: 15, frameKey: "arena_rank_3" },
  rank4to10: { arenaCoin: 2000, diamonds: 300, manaOre: 10 },
  rank11to100: { arenaCoin: 1000, diamonds: 150, manaOre: 0 },
  rank101plus: { arenaCoin: 500, diamonds: 100, manaOre: 0 },
});

function arenaTierRank(rating) {
  const value = Number(rating) || ARENA_RATING_FLOOR;
  return value >= ARENA_DIAMOND_ENTRY_RATING ? 3 : value >= 1250 ? 2 : value >= 1100 ? 1 : 0;
}
function arenaTierBaseForRank(rank) {
  return [1000, 1100, 1250, 1450][Math.max(0, Math.min(3, Number(rank) || 0))];
}
function arenaRoundRatingDelta(before, opponent, attackerResult) {
  if (attackerResult === "draw") return 0;
  const expected = 1 / (1 + Math.pow(10, ((Number(opponent) || ARENA_RATING_FLOOR) - (Number(before) || ARENA_RATING_FLOOR)) / 400));
  const actual = attackerResult === "win" ? 1 : 0;
  return Math.round(ARENA_RATING_K * (actual - expected));
}
function arenaApplyPairMultiplier(delta, encounterCount) {
  const multiplier = Number(encounterCount) <= 0 ? 1 : Number(encounterCount) === 1 ? 0.5 : 0;
  if (!delta || multiplier === 0) return 0;
  const magnitude = Math.round(Math.abs(delta) * multiplier);
  return delta < 0 ? -magnitude : magnitude;
}
function arenaPairKey(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  return left < right ? [left, right] : [right, left];
}
function arenaResolutionForState(state, requested = "normal") {
  if (requested === "cutoff" || requested === "timeout" || requested === "surrender") return requested;
  if (state?.result === "surrender") return "surrender";
  return "normal";
}
function arenaAttackerResult(state, resolution) {
  if (resolution === "surrender" || resolution === "timeout" || resolution === "cutoff") return "loss";
  if (state?.result === "draw") return "draw";
  return state?.winnerSide === "team_a" || state?.result === "victory" ? "win" : "loss";
}
function arenaCoinReward(slot, result) {
  return Number(ARENA_COIN_REWARDS[slot]?.[result] || 0);
}
function arenaSeasonRewardForRank(rank) {
  if (rank === 1) return ARENA_SEASON_REWARDS.rank1;
  if (rank === 2) return ARENA_SEASON_REWARDS.rank2;
  if (rank === 3) return ARENA_SEASON_REWARDS.rank3;
  if (rank <= 10) return ARENA_SEASON_REWARDS.rank4to10;
  if (rank <= 100) return ARENA_SEASON_REWARDS.rank11to100;
  return ARENA_SEASON_REWARDS.rank101plus;
}
function arenaRankAheadSql() {
  return `(
    p.rating > ?
    OR (p.rating = ? AND p.attack_wins > ?)
    OR (
      p.rating = ? AND p.attack_wins = ?
      AND (
        p.rating_reached_at < ?
        OR (p.rating_reached_at = ? AND p.character_id < ?)
      )
    )
  )`;
}
function arenaNextSundayCutoff(now = Date.now()) {
  const nowMs = arenaNowMs(now);
  const candidate = new Date(nowMs);
  const daysUntilSunday = (7 - candidate.getUTCDay()) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + daysUntilSunday);
  candidate.setUTCHours(16, 0, 0, 0);
  if (candidate.getTime() <= nowMs) candidate.setUTCDate(candidate.getUTCDate() + 7);
  return candidate.toISOString();
}

async function ensureArenaV2Season(db, now = Date.now()) {
  const nowMs = arenaNowMs(now);
  let active = await db.prepare(`SELECT * FROM arena_seasons WHERE status = 'active' ORDER BY season_number DESC LIMIT 1`).first();
  if (!active) {
    const pending = await db.prepare(`SELECT * FROM arena_seasons WHERE status = 'finalizing' ORDER BY season_number DESC LIMIT 1`).first();
    if (pending) await arenaFinalizeSeason(db, pending, nowMs);
    const seasonNumber = Number((await db.prepare(`SELECT COALESCE(MAX(season_number), 0) AS n FROM arena_seasons`).first())?.n || 0) + 1;
    const seasonId = `arena-season-${seasonNumber}`;
    const startsAt = arenaNowIso(nowMs);
    const endsAt = arenaNextSundayCutoff(nowMs);
    await db.prepare(`
      INSERT INTO arena_seasons (season_id, season_number, starts_at, ends_at, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(season_id) DO NOTHING
    `).bind(seasonId, seasonNumber, startsAt, endsAt, startsAt, startsAt).run();
    active = await db.prepare(`SELECT * FROM arena_seasons WHERE status = 'active' ORDER BY season_number DESC LIMIT 1`).first();
  }
  // Catch up every elapsed weekly boundary in one request. Skipped seasons are
  // retained as finalizing rows so later settlement/finalization can account for
  // every season identity. There is intentionally no arbitrary week ceiling:
  // correctness requires the returned active season to contain `now`.
  while (active) {
    const activeEndMs = Date.parse(active.ends_at);
    if (!Number.isFinite(activeEndMs)) throw new Error("arena_invalid_season_end");
    if (activeEndMs > nowMs) break;

    const at = arenaNowIso(nowMs);
    await arenaSettleExpiredActiveMatches(db, active.season_id, nowMs);
    await db.prepare(`UPDATE arena_seasons SET status = 'finalizing', updated_at = ? WHERE season_id = ? AND status = 'active'`).bind(at, active.season_id).run();
    await arenaFinalizeSeason(db, { ...active, status: "finalizing" }, nowMs);

    const nextNumber = Number(active.season_number) + 1;
    const nextId = `arena-season-${nextNumber}`;
    const startsAt = active.ends_at;
    const nextEndMs = activeEndMs + ARENA_SEASON_LENGTH_MS;
    if (!Number.isFinite(nextEndMs) || nextEndMs <= activeEndMs) throw new Error("arena_season_catchup_no_progress");
    const endsAt = new Date(nextEndMs).toISOString();

    await db.prepare(`
      INSERT INTO arena_seasons (season_id, season_number, starts_at, ends_at, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?)
      ON CONFLICT(season_id) DO NOTHING
    `).bind(nextId, nextNumber, startsAt, endsAt, at, at).run();

    const nextActive = await db.prepare(`SELECT * FROM arena_seasons WHERE status = 'active' ORDER BY season_number DESC LIMIT 1`).first();
    const nextActiveEndMs = Date.parse(nextActive?.ends_at || "");
    if (!nextActive || !Number.isFinite(nextActiveEndMs) || nextActiveEndMs <= activeEndMs) {
      throw new Error("arena_season_catchup_no_progress");
    }
    active = nextActive;
  }

  const finalEndMs = Date.parse(active?.ends_at || "");
  if (!active || !Number.isFinite(finalEndMs) || finalEndMs <= nowMs) {
    throw new Error("arena_season_catchup_incomplete");
  }
  return active;
}

async function ensureArenaSeasonPlayer(db, season, character, now = Date.now()) {
  const at = arenaNowIso(now);
  const previous = await db.prepare(`
    SELECT p.rating FROM arena_season_players p JOIN arena_seasons s ON s.season_id = p.season_id
    WHERE p.character_id = ? AND s.season_number < ?
    ORDER BY s.season_number DESC LIMIT 1
  `).bind(character.character_id, Number(season.season_number) || 0).first();
  const initialRating = previous ? arenaPreviousTierBase(previous.rating) : ARENA_RATING_FLOOR;
  await db.prepare(`
    INSERT INTO arena_season_players
      (season_id, character_id, rating, rating_reached_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(season_id, character_id) DO NOTHING
  `).bind(season.season_id, character.character_id, initialRating, at, at, at).run();
  return await db.prepare(`SELECT * FROM arena_season_players WHERE season_id = ? AND character_id = ?`).bind(season.season_id, character.character_id).first();
}

function arenaSkillKeysFromQuickSlots(quickSlots, skillLevels, max = 4) {
  const learned = new Set(heroActiveSkillList(skillLevels || {}).map((skill) => skill.key));
  const result = [];
  for (const slot of Array.isArray(quickSlots) ? quickSlots : []) {
    const key = slot && slot.kind === "skill" ? String(slot.key || "") : "";
    result.push(key && learned.has(key) ? key : null);
    if (result.length >= max) break;
  }
  while (result.length < max) result.push(null);
  return result;
}
function arenaPetFromCharacter(character, petInstId = character.active_pet_id) {
  let parsed = {};
  try { parsed = character?.pets_json ? JSON.parse(character.pets_json) : {}; } catch (e) { parsed = {}; }
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.list) ? parsed.list : []);
  const active = list.find((pet) => pet && pet.instId === petInstId) || null;
  return active && active.instId && active.defId && petBattleStats(active) ? active : null;
}
async function readCharacterQuickSlots(db, characterId) {
  const settings = await db.prepare(`SELECT quick_slots_json FROM character_settings WHERE character_id = ?`).bind(characterId).first();
  return parseJsonColumn(settings?.quick_slots_json, [null, null, null, null]);
}
async function ensureArenaSetup(db, character, now = Date.now()) {
  const existing = await db.prepare(`SELECT * FROM arena_setup WHERE character_id = ?`).bind(character.character_id).first();
  if (!existing) {
    const { skillLevels } = parsePetsJson(character);
    const slots = arenaSkillKeysFromQuickSlots(await readCharacterQuickSlots(db, character.character_id), skillLevels);
    const pet = arenaPetFromCharacter(character);
    const at = arenaNowIso(now);
    await db.prepare(`
      INSERT INTO arena_setup (character_id, pet_inst_id, skill_slots_json, initialized_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(character_id) DO NOTHING
    `).bind(character.character_id, pet ? pet.instId : "", JSON.stringify(slots), at, at).run();
  }
  return await sanitizeArenaSetup(db, character, now);
}
async function sanitizeArenaSetup(db, character, now = Date.now()) {
  const row = await db.prepare(`SELECT * FROM arena_setup WHERE character_id = ?`).bind(character.character_id).first();
  if (!row) return { petInstId: "", skillSlots: [null, null, null, null], initialized: false };
  const { skillLevels } = parsePetsJson(character);
  const learned = new Set(heroActiveSkillList(skillLevels || {}).map((skill) => skill.key));
  const stored = parseJsonColumn(row.skill_slots_json, [null, null, null, null]);
  const seenSkills = new Set();
  const skillSlots = Array.from({ length: 4 }, (_, index) => {
    const key = stored[index];
    if (typeof key !== "string" || !learned.has(key) || seenSkills.has(key)) return null;
    seenSkills.add(key);
    return key;
  });
  const pet = arenaPetFromCharacter(character, row.pet_inst_id);
  const petInstId = pet ? pet.instId : "";
  if (petInstId !== String(row.pet_inst_id || "") || JSON.stringify(skillSlots) !== JSON.stringify(stored)) {
    await db.prepare(`UPDATE arena_setup SET pet_inst_id = ?, skill_slots_json = ?, updated_at = ? WHERE character_id = ?`)
      .bind(petInstId, JSON.stringify(skillSlots), arenaNowIso(now), character.character_id).run();
  }
  return { petInstId, skillSlots, initialized: true };
}

function arenaEquipmentPublic(items) {
  return (items || []).map((item) => ({
    itemId: item.item_id || "",
    slotType: item.slot_type || "",
    type: item.slot_type || "",
    itemTemplateId: item.item_template_id || "",
    name: item.name || "",
    rarity: item.rarity || "",
    setId: item.set_id || (String(item.item_template_id || "").startsWith("azure_") ? "azure" : ""),
    star: item.star || "",
    enhanceLevel: Number(item.enhance_level) || 0,
  }));
}
async function arenaCurrentEquipment(db, characterId) {
  const rows = await db.prepare(`SELECT * FROM items WHERE character_id = ? AND equipped = 1`).bind(characterId).all();
  return rows.results || [];
}
async function arenaValidProfileFrame(db, characterId) {
  const now = nowIso();
  await db.prepare(`UPDATE profile_frame_entitlements SET disabled_at = ?, updated_at = ? WHERE character_id = ? AND disabled_at IS NULL AND expires_at IS NOT NULL AND expires_at <= ?`)
    .bind(now, now, characterId, now).run();
  const state = await db.prepare(`SELECT equipped_frame_key FROM character_profile_frame_state WHERE character_id = ?`).bind(characterId).first();
  const key = String(state?.equipped_frame_key || "");
  if (!key) return null;
  const entitlement = await db.prepare(`
    SELECT entitlement_id FROM profile_frame_entitlements
    WHERE character_id = ? AND frame_key = ? AND disabled_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?)
    ORDER BY granted_at DESC LIMIT 1
  `).bind(characterId, key, now).first();
  return entitlement ? key : null;
}

function arenaOpponentKey(entry) {
  return String(entry?.opponentKey || "");
}
function arenaStoredOpponents(value) {
  const rows = parseJsonColumn(value, []);
  return Array.isArray(rows) && rows.length === 3 && rows.every((row) => row && row.opponentKey && row.type && row.slot) ? rows : null;
}
function arenaBotVirtualRating(selfRating, slot) {
  const band = ARENA_MATCH_BANDS[slot];
  const rating = Number(selfRating) || 1000;
  const minimum = Math.max(1000, rating + band.min);
  const maximum = Math.max(1000, rating + band.max);
  const target = rating + (slot === "lower" ? -150 : slot === "higher" ? 150 : 0);
  return Math.max(minimum, Math.min(maximum, target));
}
function arenaBotForSlot(slot, selfRating, previous, used) {
  const prior = new Set((previous || []).map((row) => row.botId));
  const start = typeof slot === "number" ? Math.max(0, Math.floor(slot)) : ["lower", "equal", "higher"].indexOf(slot);
  const index = start >= 0 ? start : 0;
  for (let i = 0; i < ARENA_BOT_DEFS.length; i++) {
    const def = ARENA_BOT_DEFS[(index + i) % ARENA_BOT_DEFS.length];
    const botId = `arena-${def.id}`;
    if (!used.has(`bot:${botId}`) && (!previous || !prior.has(botId))) return { def, botId, rating: arenaBotVirtualRating(selfRating, typeof slot === "string" ? slot : ["lower", "equal", "higher"][index]) };
  }
  const def = ARENA_BOT_DEFS[index % ARENA_BOT_DEFS.length];
  return { def, botId: `arena-${def.id}-${index}`, rating: arenaBotVirtualRating(selfRating, typeof slot === "string" ? slot : ["lower", "equal", "higher"][index]) };
}
async function generateArenaV2Opponents(db, season, character, previous = null) {
  const player = await db.prepare(`SELECT rating FROM arena_season_players WHERE season_id = ? AND character_id = ?`).bind(season.season_id, character.character_id).first();
  const rating = Number(player?.rating) || 1000;
  const used = new Set();
  const result = [];
  for (const slot of ["lower", "equal", "higher"]) {
    const band = ARENA_MATCH_BANDS[slot];
    const rows = await db.prepare(`
      SELECT p.character_id, p.rating, c.name, c.level
      FROM arena_season_players p JOIN characters c ON c.character_id = p.character_id
      WHERE p.season_id = ? AND p.character_id != ?
        AND (p.attack_wins + p.attack_draws + p.attack_losses) > 0
        AND p.rating BETWEEN ? AND ?
      ORDER BY ABS(p.rating - ?) ASC, p.rating DESC, p.rating_reached_at ASC
    `).bind(season.season_id, character.character_id, Math.max(1000, rating + band.min), Math.max(1000, rating + band.max), rating).all();
    const candidate = (rows.results || []).find((row) => {
      const key = `real:${row.character_id}`;
      return !used.has(key) && !(previous || []).some((old) => old.opponentKey === key);
    }) || (rows.results || []).find((row) => !used.has(`real:${row.character_id}`));
    if (candidate) {
      const key = `real:${candidate.character_id}`;
      used.add(key);
      result.push({ opponentKey: key, type: "player", slot, rewardSlot: band.rewardSlot, characterId: candidate.character_id, name: candidate.name || "", level: Number(candidate.level) || 1, rating: Number(candidate.rating) || 1000 });
      continue;
    }
    const bot = arenaBotForSlot(slot, rating, previous, used);
    const key = `bot:${bot.botId}`;
    used.add(key);
    result.push({ opponentKey: key, type: "bot", slot, rewardSlot: band.rewardSlot, botId: bot.botId, name: bot.def.name, level: bot.def.level, rating: bot.rating, archetype: bot.def.archetype, profileFrameKey: null });
  }
  return result;
}
async function arenaUpsertOpponentState(db, seasonId, characterId, opponents, refreshAvailableAt, now) {
  await db.prepare(`
    INSERT INTO arena_opponent_state (season_id, character_id, opponents_json, refresh_available_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(season_id, character_id) DO UPDATE SET
      opponents_json = excluded.opponents_json, refresh_available_at = excluded.refresh_available_at, updated_at = excluded.updated_at
  `).bind(seasonId, characterId, JSON.stringify(opponents), refreshAvailableAt, now).run();
}

async function arenaV2Context(db, id, session, characterId, now = Date.now()) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return { error: auth.error };
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return { error: owned.error };
  const character = owned.row;
  if (Number(character.level) < ARENA_V2_UNLOCK_LEVEL) return { error: "arena_locked", character, requiredLevel: ARENA_V2_UNLOCK_LEVEL };
  const state = await ensureArenaCharacterState(db, characterId, now);
  const season = await ensureArenaV2Season(db, now);
  const seasonPlayer = await ensureArenaSeasonPlayer(db, season, character, now);
  return { ok: true, player: auth.row, character, state, season, seasonPlayer };
}
function arenaPublicOpponent(row) {
  return { opponentKey: row.opponentKey, name: row.name || "", level: Number(row.level) || 1, rating: Number(row.rating) || 1000 };
}
async function handleGetArenaV2Status(db, id, session, characterId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error === "arena_locked") return json({ ok: true, unlocked: false, requiredLevel: ARENA_V2_UNLOCK_LEVEL });
  if (context.error) return json({ error: context.error });
  const now = nowIso();
  const tickets = await reconcileArenaV2Tickets(db, characterId, now);
  const setup = await ensureArenaSetup(db, context.character, now);
  const items = await arenaCurrentEquipment(db, characterId);
  const parsed = parsePetsJson(context.character);
  const availablePets = (Array.isArray(JSON.parse(context.character.pets_json || '{}')?.list) ? JSON.parse(context.character.pets_json || '{}').list : []).map(p => ({
    instId: p.instId, defId: p.defId, level: Number(p.level) || 1, star: Number(p.star) || 1,
    name: PET_DISPLAY_NAMES[p.defId] || p.defId || "Pet"
  }));
  const availableSkills = heroActiveSkillList(parsed.skillLevels || {}).map(skill => ({ key: skill.key, name: skill.name || skill.key, icon: skill.icon || "✦" }));
  const rankAhead = arenaRankAheadSql();
  const rankRow = await db.prepare(`
    SELECT COUNT(*) AS c
    FROM arena_season_players p
    WHERE p.season_id = ? AND ${rankAhead}
  `).bind(
    context.season.season_id,
    Number(context.seasonPlayer.rating) || ARENA_RATING_FLOOR,
    Number(context.seasonPlayer.rating) || ARENA_RATING_FLOOR,
    Number(context.seasonPlayer.attack_wins) || 0,
    Number(context.seasonPlayer.rating) || ARENA_RATING_FLOOR,
    Number(context.seasonPlayer.attack_wins) || 0,
    context.seasonPlayer.rating_reached_at || "",
    context.seasonPlayer.rating_reached_at || "",
    context.seasonPlayer.character_id,
  ).first();
  return json({
    ok: true, unlocked: true, requiredLevel: ARENA_V2_UNLOCK_LEVEL,
    showUnlockNotice: Number(context.state.unlock_notice_seen) !== 1,
    seasonEndsAt: context.season.ends_at,
    serverNow: now,
    season: { seasonId: context.season.season_id, seasonNumber: Number(context.season.season_number), seasonEndsAt: context.season.ends_at, serverNow: now },
    player: {
      rating: Number(context.seasonPlayer.rating), tier: arenaTierForRating(context.seasonPlayer.rating), rank: Number(rankRow?.c || 0) + 1,
      attack: { wins: Number(context.seasonPlayer.attack_wins), draws: Number(context.seasonPlayer.attack_draws), losses: Number(context.seasonPlayer.attack_losses) },
      defense: { wins: Number(context.seasonPlayer.defense_wins), draws: Number(context.seasonPlayer.defense_draws), losses: Number(context.seasonPlayer.defense_losses) },
      arenaCoin: Number(context.state.arena_coin) || 0,
    },
    tickets: { tickets: tickets.tickets, ticketsMax: ARENA_TICKET_MAX, dailyGrant: ARENA_TICKET_DAILY_GRANT, purchaseCost: ARENA_TICKET_PURCHASE_COST, nextPassiveTicketAt: tickets.nextPassiveTicketAt, passiveSeconds: tickets.passiveSeconds },
    setup,
    availablePets,
    availableSkills,
    equipment: arenaEquipmentPublic(items),
  });
}
async function getArenaV2OpponentRows(db, context, now = Date.now()) {
  const current = await db.prepare(`SELECT * FROM arena_opponent_state WHERE season_id = ? AND character_id = ?`).bind(context.season.season_id, context.character.character_id).first();
  let opponents = arenaStoredOpponents(current?.opponents_json);
  if (!opponents) {
    opponents = await generateArenaV2Opponents(db, context.season, context.character);
    await arenaUpsertOpponentState(db, context.season.season_id, context.character.character_id, opponents, current?.refresh_available_at || "", arenaNowIso(now));
  }
  return { opponents, state: current };
}
async function handleGetArenaV2Opponents(db, id, session, characterId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const { opponents, state } = await getArenaV2OpponentRows(db, context);
  return json({
    ok: true,
    opponents: opponents.map(arenaPublicOpponent),
    refreshAvailableAt: state?.refresh_available_at || null,
  });
}
async function handleGetArenaV2History(db, id, session, characterId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const historyTable = "arena_" + "match_history";
  const [attack, defense] = await Promise.all([
    db.prepare(`SELECT * FROM ${historyTable} WHERE season_id = ? AND attacker_character_id = ? ORDER BY completed_at DESC, match_id DESC LIMIT 5`).bind(context.season.season_id, characterId).all(),
    db.prepare(`SELECT * FROM ${historyTable} WHERE season_id = ? AND defender_character_id = ? ORDER BY completed_at DESC, match_id DESC LIMIT 5`).bind(context.season.season_id, characterId).all(),
  ]);
  const map = row => ({ matchId: row.match_id, completedAt: row.completed_at, result: row.attacker_result, resolution: row.resolution, attackerCharacterId: row.attacker_character_id, defenderCharacterId: row.defender_character_id || null, defenderType: row.defender_type, arenaCoinEarned: Number(row.arena_coin_earned) || 0, attackerRatingChange: Number(row.attacker_rating_change) || 0, defenderRatingChange: Number(row.defender_rating_change) || 0, attackerName: row.attacker_name, defenderName: row.defender_name });
  return json({ ok: true, attack: (attack.results || []).map(map), defense: (defense.results || []).map(map) });
}
async function handleGetArenaV2Ranking(db, id, session, characterId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const rows = await db.prepare(`
    SELECT p.character_id, c.name, p.rating, p.attack_wins, p.attack_draws, p.attack_losses, p.rating_reached_at
    FROM arena_season_players p JOIN characters c ON c.character_id = p.character_id
    WHERE p.season_id = ? ORDER BY p.rating DESC, p.attack_wins DESC, p.rating_reached_at ASC, p.character_id ASC LIMIT 100
  `).bind(context.season.season_id).all();
  return json({ ok: true, seasonId: context.season.season_id, rows: (rows.results || []).map((row, index) => ({ rank: index + 1, characterId: row.character_id, name: row.name, rating: Number(row.rating) || ARENA_RATING_FLOOR, wins: Number(row.attack_wins) || 0, draws: Number(row.attack_draws) || 0, losses: Number(row.attack_losses) || 0, rewardBucket: index === 0 ? "1" : index === 1 ? "2" : index === 2 ? "3" : index < 10 ? "4-10" : index < 100 ? "11-100" : "101+" })) });
}
async function handleRefreshArenaV2Opponents(db, id, session, characterId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const nowMs = Date.now();
  const current = await getArenaV2OpponentRows(db, context, nowMs);
  const availableAt = Date.parse(current.state?.refresh_available_at || "");
  if (Number.isFinite(availableAt) && availableAt > nowMs) {
    return json({ error: "arena_refresh_cooldown", retryAfter: Math.ceil((availableAt - nowMs) / 1000), refreshAvailableAt: new Date(availableAt).toISOString() }, 429);  }
  // Acquire the cooldown with a single conditional UPDATE.  The read above is
  // advisory only; this CAS is the authoritative gate for concurrent refreshes.
  const refreshAvailableAt = new Date(nowMs + ARENA_REFRESH_COOLDOWN_MS).toISOString();
  const claimed = await db.prepare(`
    UPDATE arena_opponent_state
    SET refresh_available_at = ?, updated_at = ?
    WHERE season_id = ? AND character_id = ?
      AND (refresh_available_at = '' OR refresh_available_at IS NULL OR refresh_available_at <= ?)
  `).bind(refreshAvailableAt, arenaNowIso(nowMs), context.season.season_id, characterId, arenaNowIso(nowMs)).run();
  if (Number(claimed?.meta?.changes) !== 1) {
    const latest = await db.prepare(`SELECT refresh_available_at FROM arena_opponent_state WHERE season_id = ? AND character_id = ?`).bind(context.season.season_id, characterId).first();
    const latestAt = Date.parse(latest?.refresh_available_at || "");
    return json({ error: "arena_refresh_cooldown", retryAfter: Number.isFinite(latestAt) ? Math.max(1, Math.ceil((latestAt - nowMs) / 1000)) : 1, refreshAvailableAt: Number.isFinite(latestAt) ? new Date(latestAt).toISOString() : refreshAvailableAt }, 429);
  }
  const next = await generateArenaV2Opponents(db, context.season, context.character, current.opponents);
  if (!next.some((row) => !current.opponents.some((old) => old.opponentKey === row.opponentKey))) {
    const fallback = arenaBotForSlot("higher", context.seasonPlayer.rating, current.opponents, new Set(next.map((row) => row.opponentKey)));
    next[2] = { opponentKey: `bot:${fallback.botId}`, type: "bot", slot: "higher", rewardSlot: "higher", botId: fallback.botId, name: fallback.def.name, level: fallback.def.level, rating: fallback.rating, archetype: fallback.def.archetype, profileFrameKey: null };
  }
  const saved = await db.prepare(`
    UPDATE arena_opponent_state SET opponents_json = ?, updated_at = ?
    WHERE season_id = ? AND character_id = ? AND refresh_available_at = ?
  `).bind(JSON.stringify(next), arenaNowIso(nowMs), context.season.season_id, characterId, refreshAvailableAt).run();
  if (Number(saved?.meta?.changes) !== 1) return json({ error: "arena_refresh_conflict", retry: true }, 409);
  return json({ ok: true, opponents: next.map(arenaPublicOpponent), refreshAvailableAt });
}
async function handleAcknowledgeArenaV2Unlock(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (Number(owned.row.level) < ARENA_V2_UNLOCK_LEVEL) return json({ error: "arena_locked", requiredLevel: ARENA_V2_UNLOCK_LEVEL });
  await ensureArenaCharacterState(db, characterId);
  await db.prepare(`UPDATE arena_character_state SET unlock_notice_seen = 1, updated_at = ? WHERE character_id = ?`).bind(nowIso(), characterId).run();
  return json({ ok: true, showUnlockNotice: false });
}
async function handleSaveArenaV2Setup(db, id, session, characterId, petInstId, skillSlots) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  if (!Array.isArray(skillSlots) || skillSlots.length !== 4) return json({ error: "invalid_arena_setup" }, 400);
  const { skillLevels } = parsePetsJson(context.character);
  const learned = new Set(heroActiveSkillList(skillLevels || {}).map((skill) => skill.key));
  const seenSkills = new Set();
  const normalizedSkills = skillSlots.map((key) => {
    if (typeof key !== "string" || !learned.has(key) || seenSkills.has(key)) return null;
    seenSkills.add(key);
    return key;
  });
  const pet = arenaPetFromCharacter(context.character, petInstId || "");
  const at = nowIso();
  await db.prepare(`
    INSERT INTO arena_setup (character_id, pet_inst_id, skill_slots_json, initialized_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(character_id) DO UPDATE SET pet_inst_id = excluded.pet_inst_id, skill_slots_json = excluded.skill_slots_json, updated_at = excluded.updated_at
  `).bind(characterId, pet ? pet.instId : "", JSON.stringify(normalizedSkills), at, at).run();
  return json({ ok: true, setup: await sanitizeArenaSetup(db, context.character, at) });
}
async function handlePurchaseArenaV2Ticket(db, id, session, characterId, requestId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const key = String(requestId || "").trim();
  if (!key || key.length > 128) return json({ error: "missing_request_id" }, 400);
  const receiptKey = `arena:ticket-purchase:${characterId}:${key}`;
  const prior = await db.prepare(`SELECT payload_json FROM arena_idempotency_receipts WHERE receipt_key = ?`).bind(receiptKey).first();
  const now = nowIso();
  const tickets = await reconcileArenaV2Tickets(db, characterId, now);
  const player = await db.prepare(`SELECT diamonds FROM players WHERE id = ?`).bind(id).first();
  if (prior) {
    const current = await db.prepare(`SELECT tickets, ticket_updated_at FROM arena_character_state WHERE character_id = ?`).bind(characterId).first();
    return json({ ok: true, replayed: true, tickets: Number(current?.tickets) || 0, ticketsMax: ARENA_TICKET_MAX, diamonds: Number((await db.prepare(`SELECT diamonds FROM players WHERE id = ?`).bind(id).first())?.diamonds) || 0, passiveSeconds: arenaTicketSecondsToNext(current?.ticket_updated_at || "") });
  }
  if (tickets.tickets >= ARENA_TICKET_MAX) return json({ error: "arena_tickets_full", tickets: tickets.tickets, ticketsMax: ARENA_TICKET_MAX });
  if (Number(player?.diamonds) < ARENA_TICKET_PURCHASE_COST) return json({ error: "insufficient_diamonds", purchaseCost: ARENA_TICKET_PURCHASE_COST, diamonds: Number(player?.diamonds) || 0 });
  const operationToken = randomToken(12);
  const oldTicket = await db.prepare(`SELECT tickets, ticket_updated_at, last_daily_ticket_date FROM arena_character_state WHERE character_id = ?`).bind(characterId).first();
  const oldDiamonds = Number(player.diamonds) || 0;
  const receiptPayload = JSON.stringify({ operationToken, kind: "ticket_purchase", requestId: key });
  // D1 batches are atomic. The receipt INSERT is a conditional gate; the two following
  // updates are additionally scoped to its operation token, so a replay/different
  // requestId cannot spend or grant independently of the same receipt gate.
  const batch = await db.batch([
    db.prepare(`
      INSERT INTO arena_idempotency_receipts (receipt_key, kind, character_id, payload_json, created_at)
      SELECT ?, 'ticket_purchase', ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?)
        AND EXISTS (SELECT 1 FROM arena_character_state WHERE character_id = ? AND tickets = ? AND ticket_updated_at = ? AND last_daily_ticket_date = ? AND tickets < ?)
        AND EXISTS (SELECT 1 FROM players WHERE id = ? AND diamonds = ? AND diamonds >= ?)
    `).bind(receiptKey, characterId, receiptPayload, now, receiptKey, characterId, oldTicket.tickets, oldTicket.ticket_updated_at || "", oldTicket.last_daily_ticket_date || "", ARENA_TICKET_MAX, id, oldDiamonds, ARENA_TICKET_PURCHASE_COST),
    db.prepare(`UPDATE players SET diamonds = diamonds - ? WHERE id = ? AND diamonds = ? AND EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ? AND json_extract(payload_json, '$.operationToken') = ?)`)
      .bind(ARENA_TICKET_PURCHASE_COST, id, oldDiamonds, receiptKey, operationToken),
    db.prepare(`UPDATE arena_character_state SET tickets = tickets + 1, updated_at = ? WHERE character_id = ? AND tickets = ? AND EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ? AND json_extract(payload_json, '$.operationToken') = ?)`)
      .bind(now, characterId, oldTicket.tickets, receiptKey, operationToken),
  ]);
  const receiptInserted = Number(batch?.[0]?.meta?.changes) || 0;
  const charged = Number(batch?.[1]?.meta?.changes) || 0;
  const granted = Number(batch?.[2]?.meta?.changes) || 0;
  if (!receiptInserted) {
    const existingReceipt = await db.prepare(`SELECT payload_json FROM arena_idempotency_receipts WHERE receipt_key = ?`).bind(receiptKey).first();
    if (!existingReceipt) return json({ error: "arena_ticket_purchase_conflict", retry: true }, 409);
    const existing = await db.prepare(`SELECT tickets FROM arena_character_state WHERE character_id = ?`).bind(characterId).first();
    return json({ ok: true, replayed: true, tickets: Number(existing?.tickets) || 0, ticketsMax: ARENA_TICKET_MAX, diamonds: Number((await db.prepare(`SELECT diamonds FROM players WHERE id = ?`).bind(id).first())?.diamonds) || 0 });
  }
  if (charged !== 1 || granted !== 1) return json({ error: "arena_ticket_purchase_conflict", retry: true }, 409);
  const resultState = await db.prepare(`SELECT tickets, ticket_updated_at FROM arena_character_state WHERE character_id = ?`).bind(characterId).first();
  const resultPlayer = await db.prepare(`SELECT diamonds FROM players WHERE id = ?`).bind(id).first();
  return json({ ok: true, replayed: false, tickets: Number(resultState.tickets), ticketsMax: ARENA_TICKET_MAX, diamonds: Number(resultPlayer.diamonds) || 0, passiveSeconds: arenaTicketSecondsToNext(resultState.ticket_updated_at || "") });
}

function arenaClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
function mythicEquippedFromRows(items) {
  const equipped = {};
  for (const row of items || []) {
    const extra = parseJsonColumn(row.extra_json, {});
    equipped[row.slot_type] = { type: row.slot_type, rarity: row.rarity, itemModelVersion: extra.itemModelVersion,
      setId: extra.setId, bossWeaponId: extra.bossWeaponId, specialSource: extra.specialSource,
      sourceIdentity: extra.sourceIdentity, name: row.name };
  }
  return equipped;
}
function arenaSnapshotStats(character, items) {
  const stats = {
    str: Number(character.str) || 0,
    vit: Number(character.vit) || 0,
    agi: Number(character.agi) || 0,
    dex: Number(character.dex) || 0,
    luk: Number(character.luk) || 0,
  };
  const base = characterBaseStats(Number(character.level) || 1, stats);
  const bonus = { atk: 0, def: 0, hp: 0, mp: 0, hpPct: 0, mpPct: 0, str: 0, vit: 0, agi: 0, dex: 0, luk: 0, accuracy: 0, critChance: 0, critDamage: 0, dodgeChance: 0 };
  for (const item of items || []) {
    const current = itemBonus(item);
    for (const key of Object.keys(current)) bonus[key] = (bonus[key] || 0) + (Number(current[key]) || 0);
  }
  const setEffects = globalThis.MYTHIC_V2.setEffects(mythicEquippedFromRows(items));
  bonus.str += setEffects.str; bonus.vit += setEffects.vit; bonus.agi += setEffects.agi; bonus.critDamage += setEffects.critDamage;
  return {
    ...stats,
    level: Number(character.level) || 1,
    maxHp: Math.round((base.maxHp + bonus.vit * 12 + bonus.hp) * (1 + bonus.hpPct / 100)),
    maxMp: Math.round((base.maxMp + bonus.mp) * (1 + bonus.mpPct / 100)),
    atk: Math.round(base.atk + bonus.str * 3 + Math.floor((stats.dex + bonus.dex) * 0.5) - Math.floor(stats.dex * 0.5) + bonus.atk),
    def: Math.round(base.def + Math.floor((stats.vit + bonus.vit) * 0.5) - Math.floor(stats.vit * 0.5) + bonus.def),
    accuracy: Math.min(99, Math.round((base.accuracy + bonus.accuracy + bonus.dex * 0.5) * 10) / 10),
    critChance: Math.round((base.critChance + bonus.critChance + bonus.luk * 0.5) * 10) / 10,
    critDamage: Math.round((base.critDamage + bonus.critDamage) * 10) / 10,
    dodgeChance: Math.round((base.dodgeChance + bonus.dodgeChance + bonus.agi * 0.5) * 10) / 10,
  };
}
function arenaEquipmentSnapshot(items) {
  return (items || []).map((item) => ({
    itemId: item.item_id || "",
    itemTemplateId: item.item_template_id || "",
    slotType: item.slot_type || "",
    name: item.name || "",
    rarity: item.rarity || "",
    enhanceLevel: Number(item.enhance_level) || 0,
    stats: itemBonus(item),
    ...(() => { const extra = parseJsonColumn(item.extra_json, {}); return { setId: extra.setId || null, bossWeaponId: extra.bossWeaponId || null, itemModelVersion: Number(extra.itemModelVersion) || 0 }; })()
  }));
}
async function arenaRealSnapshot(db, character, setup, items, rating) {
  const pet = setup.petInstId ? arenaPetFromCharacter(character, setup.petInstId) : null;
  const { skillLevels } = parsePetsJson(character);
  return {
    type: "player",
    characterId: character.character_id,
    name: character.name || "",
    level: Number(character.level) || 1,
    rating: Number(rating) || 1000,
    tier: arenaTierForRating(rating),
    cp: combatPowerFromCharacter(character, items),
    stats: arenaSnapshotStats(character, items),
    equipment: arenaEquipmentSnapshot(items),
    equipmentEffects: globalThis.MYTHIC_V2.combatEffects(mythicEquippedFromRows(items)),
    pet: pet ? arenaClone(pet) : null,
    skillLevels: arenaClone(skillLevels || {}),
    skillSlots: Array.isArray(setup.skillSlots) ? [...setup.skillSlots] : [null, null, null, null],
    profileFrameKey: await arenaValidProfileFrame(db, character.character_id),
  };
}
function arenaBotCombatStats(snapshot) {
  const level = Number(snapshot?.level) || 10;
  const rating = Number(snapshot?.rating) || 1000;
  return snapshot?.stats || {
    maxHp: 80 + level * 5 + Math.max(0, rating - 1000) * 0.04,
    maxMp: 100,
    atk: 10 + level * 2 + Math.max(0, rating - 1000) * 0.02,
    def: 4 + level * 0.6,
    accuracy: 95,
    dodgeChance: 2,
    critChance: 3,
    critDamage: 50,
    agi: level,
  };
}
function arenaBotCombatPower(snapshot, stats = arenaBotCombatStats(snapshot)) {
  const level = Number(snapshot?.level) || 10;
  return Math.round(
    (Number(stats.atk) || 0) * 12
    + (Number(stats.def) || 0) * 15
    + (Number(stats.maxHp) || 0) * 2
    + (Number(stats.maxMp) || 0) * 1.5
    + (Number(stats.accuracy) || 0) * 4
    + (Number(stats.critChance) || 0) * 8
    + (Number(stats.critDamage) || 0) * 3
    + (Number(stats.dodgeChance) || 0) * 6
    + level * 50
  );
}
function arenaBotSnapshot(opponent) {
  const stats = arenaBotCombatStats(opponent);
  return {
    type: "bot",
    botId: opponent.botId,
    name: opponent.name || "",
    level: Number(opponent.level) || 1,
    rating: Number(opponent.rating) || 1000,
    tier: arenaTierForRating(opponent.rating),
    cp: arenaBotCombatPower(opponent, stats),
    stats,
    equipment: [],
    pet: null,
    skillSlots: [null, null, null, null],
    profileFrameKey: null,
    archetype: opponent.archetype || "",
  };
}
async function arenaBuildMatchSnapshot(db, context, opponent, source, preparedAt, seed) {
  const attackerSetup = await ensureArenaSetup(db, context.character, preparedAt);
  const attackerItems = await arenaCurrentEquipment(db, context.character.character_id);
  const attacker = await arenaRealSnapshot(db, context.character, attackerSetup, attackerItems, context.seasonPlayer.rating);
  let defender;
  if (opponent.type === "bot") {
    defender = arenaBotSnapshot(opponent);
  } else {
    const defenderCharacter = await db.prepare(`SELECT * FROM characters WHERE character_id = ?`).bind(opponent.characterId).first();
    if (!defenderCharacter) return { error: "arena_opponent_not_found" };
    const defenderSetup = await sanitizeArenaSetup(db, defenderCharacter, preparedAt);
    const defenderItems = await arenaCurrentEquipment(db, defenderCharacter.character_id);
    const defenderPlayer = await db.prepare(`SELECT rating FROM arena_season_players WHERE season_id = ? AND character_id = ?`).bind(context.season.season_id, defenderCharacter.character_id).first();
    defender = await arenaRealSnapshot(db, defenderCharacter, defenderSetup, defenderItems, defenderPlayer?.rating ?? opponent.rating);
  }
  return {
    version: 1,
    preparedAt,
    seed,
    source,
    rewardSlot: opponent.rewardSlot,
    opponentKey: opponent.opponentKey,
    attacker,
    defender,
  };
}
function arenaMatchPayload(row) {
  const rawState = parseJsonColumn(row.state_json, null);
  return {
    matchId: row.match_id,
    seasonId: row.season_id,
    status: row.status,
    defenderType: row.defender_type,
    defenderCharacterId: row.defender_character_id || null,
    defenderBotId: row.defender_bot_id || "",
    rewardSlot: row.reward_slot,
    seed: Number(row.seed),
    snapshot: parseJsonColumn(row.snapshot_json, null),
    state: rawState && rawState.mode === "arena" ? arenaCombatPublicState(rawState) : rawState,
    result: parseJsonColumn(row.result_json, null),
    preparedAt: row.prepared_at,
    preparedExpiresAt: row.prepared_expires_at,
    activatedAt: row.activated_at,
    ticketConsumedAt: row.ticket_consumed_at,
    deadlineAt: row.deadline_at,
    completedAt: row.completed_at,
  };
}
async function arenaOpenMatchForAttacker(db, characterId) {
  return await db.prepare(`
    SELECT * FROM arena_matches
    WHERE attacker_character_id = ? AND status IN ('prepared', 'active')
    ORDER BY created_at DESC LIMIT 1
  `).bind(characterId).first();
}
async function arenaExpirePreparedMatch(db, row, nowMs, force = false) {
  if (!row || row.status !== "prepared" || (!force && Date.parse(row.prepared_expires_at) > nowMs)) return row;
  await db.prepare(`UPDATE arena_matches SET status = 'expired', updated_at = ? WHERE match_id = ? AND status = 'prepared'`)
    .bind(arenaNowIso(nowMs), row.match_id).run();
  return await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(row.match_id).first();
}
async function arenaRevengeOpponent(db, seasonId, characterId, opponentKey) {
  const key = String(opponentKey || "");
  if (!key.startsWith("history:")) return null;
  const matchId = key.slice("history:".length);
  const historyTable = "arena_" + "match_history";
  const row = await db.prepare(`SELECT * FROM ${historyTable} WHERE season_id = ? AND match_id = ? AND (attacker_character_id = ? OR defender_character_id = ?)`).bind(seasonId, matchId, characterId, characterId).first();
  if (!row) return null;
  const targetCharacterId = row.attacker_character_id === characterId ? row.defender_character_id : row.attacker_character_id;
  if (!targetCharacterId || row.defender_type === "bot" && row.attacker_character_id === characterId) return null;
  const target = await db.prepare(`SELECT character_id, name, level FROM characters WHERE character_id = ?`).bind(targetCharacterId).first();
  if (!target) return null;
  const rating = await db.prepare(`SELECT rating FROM arena_season_players WHERE season_id = ? AND character_id = ?`).bind(seasonId, targetCharacterId).first();
  return { opponentKey: key, type: "player", characterId: targetCharacterId, slot: "equal", rewardSlot: "equal", name: target.name || "", level: Number(target.level) || 1, rating: Number(rating?.rating) || ARENA_RATING_FLOOR };
}
async function handlePrepareArenaV2Match(db, id, session, characterId, opponentKey, source = "matchmaking") {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const nowMs = Date.now();
  const { opponents } = await getArenaV2OpponentRows(db, context, nowMs);
  const opponent = source === "revenge"
    ? await arenaRevengeOpponent(db, context.season.season_id, characterId, opponentKey)
    : opponents.find((row) => row.opponentKey === String(opponentKey || ""));
  if (!opponent) return json({ error: "arena_opponent_not_found" }, 404);
  let existing = await arenaOpenMatchForAttacker(db, characterId);
  existing = await arenaExpirePreparedMatch(db, existing, nowMs);
  if (existing?.status === "prepared" && existing.season_id !== context.season.season_id) {
    // Prepared matches are season-bound. A rollover before activation must not
    // occupy the one-open-match slot for the new season.
    existing = await arenaExpirePreparedMatch(db, existing, nowMs, true);
  }
  if (existing && ["prepared", "active"].includes(existing.status)) {
    const existingSnapshot = parseJsonColumn(existing.snapshot_json, {});
    if (existingSnapshot.opponentKey !== opponent.opponentKey) return json({ error: "arena_match_in_progress" }, 409);
    return json({ ok: true, replayed: true, match: arenaMatchPayload(existing) });
  }
  const normalizedSource = source === "revenge" ? "revenge" : "matchmaking";
  const preparedAt = arenaNowIso(nowMs);
  const preparedExpiresAt = arenaNowIso(nowMs + ARENA_PREPARED_TTL_MS);
  const seed = (parseInt(randomToken(4), 16) >>> 0);
  const snapshot = await arenaBuildMatchSnapshot(db, context, opponent, normalizedSource, preparedAt, seed);
  if (snapshot.error) return json({ error: snapshot.error }, 404);
  const matchId = `arena-match-${randomToken(12)}`;
  try {
    await db.prepare(`
      INSERT INTO arena_matches (
        match_id, season_id, attacker_character_id, defender_type, defender_character_id,
        defender_bot_id, source, reward_slot, status, seed, snapshot_json, state_json,
        result_json, prepared_at, prepared_expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?, '', '', ?, ?, ?, ?)
    `).bind(
      matchId, context.season.season_id, characterId, opponent.type,
      opponent.type === "player" ? opponent.characterId : null,
      opponent.type === "bot" ? opponent.botId : "", normalizedSource, opponent.rewardSlot,
      seed, JSON.stringify(snapshot), preparedAt, preparedExpiresAt, preparedAt, preparedAt
    ).run();
  } catch (error) {
    const raced = await arenaOpenMatchForAttacker(db, characterId);
    if (raced && ["prepared", "active"].includes(raced.status)) return json({ ok: true, replayed: true, match: arenaMatchPayload(raced) });
    throw error;
  }
  const created = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(matchId).first();
  return json({ ok: true, replayed: false, match: arenaMatchPayload(created) });
}
async function handleActivateArenaV2Match(db, id, session, characterId, matchId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const key = String(matchId || "").trim();
  if (!key) return json({ error: "missing_match_id" }, 400);
  let match = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ? AND attacker_character_id = ?`).bind(key, characterId).first();
  if (!match) return json({ error: "arena_match_not_found" }, 404);
  if (match.status === "active" || match.status === "done") return json({ ok: true, replayed: true, match: arenaMatchPayload(match) });
  if (match.status !== "prepared") return json({ error: "arena_match_expired", match: arenaMatchPayload(match) }, 409);
  const nowMs = Date.now();
  if (match.season_id !== context.season.season_id || Date.parse(context.season.ends_at) <= nowMs) {
    // Season cutoff/mismatch is an immediate terminal condition. Do not leave the
    // prepared row occupying the one-open-match slot until its normal TTL elapses.
    match = await arenaExpirePreparedMatch(db, match, nowMs, true);
    return json({ error: "arena_match_expired", match: arenaMatchPayload(match) }, 409);
  }
  if (Date.parse(match.prepared_expires_at) <= nowMs) {
    match = await arenaExpirePreparedMatch(db, match, nowMs);
    return json({ error: "arena_match_expired", match: arenaMatchPayload(match) }, 409);
  }
  const tickets = await reconcileArenaV2Tickets(db, characterId, nowMs);
  if (tickets.tickets < 1) return json({ error: "arena_no_ticket", tickets: tickets.tickets, ticketsMax: ARENA_TICKET_MAX }, 409);
  const activatedAt = arenaNowIso(nowMs);
  const seasonEndMs = Date.parse(context.season.ends_at);
  const deadlineAt = arenaNowIso(Math.min(nowMs + ARENA_ACTIVE_DURATION_MS, seasonEndMs));
  const snapshot = parseJsonColumn(match.snapshot_json, null);
  let combatState;
  try {
    combatState = arenaCombatState(snapshot, key);
    // Resolve any opening defender/Pet turns through Battle Core so activation
    // always returns at the attacker's Hero decision boundary.
    combatState = arenaCombatAdvance(combatState);
  } catch (error) { return json({ error: "arena_match_state_invalid" }, 409); }
  const activationStatus = combatState.result ? "done" : "active";
  const activationResult = arenaCombatResult(combatState);
  const activationCompletedAt = activationStatus === "done" ? activatedAt : "";
  const state = JSON.stringify(combatState);
  const receiptKey = `arena:match-activate:${key}`;
  const activationToken = randomToken(12);
  const receiptPayload = JSON.stringify({ matchId: key, characterId, activatedAt, activationToken });
  const batch = await db.batch([
    db.prepare(`
      INSERT INTO arena_idempotency_receipts (receipt_key, kind, season_id, character_id, match_id, payload_json, created_at)
      SELECT ?, 'match_activate', ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?)
        AND EXISTS (SELECT 1 FROM arena_matches WHERE match_id = ? AND attacker_character_id = ? AND status = 'prepared' AND prepared_expires_at > ?)
        AND EXISTS (SELECT 1 FROM arena_character_state WHERE character_id = ? AND tickets >= 1)
    `).bind(receiptKey, match.season_id, characterId, key, receiptPayload, activatedAt, receiptKey, key, characterId, activatedAt, characterId),
    db.prepare(`
      UPDATE arena_matches SET status = ?, state_json = ?, result_json = ?, activated_at = ?, ticket_consumed_at = ?, deadline_at = ?, completed_at = ?, updated_at = ?
      WHERE match_id = ? AND attacker_character_id = ? AND status = 'prepared' AND prepared_expires_at > ?
        AND EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ? AND json_extract(payload_json, '$.activationToken') = ?)
    `).bind(activationStatus, state, activationResult ? JSON.stringify(activationResult) : "", activatedAt, activatedAt, deadlineAt, activationCompletedAt, activatedAt, key, characterId, activatedAt, receiptKey, activationToken),
    db.prepare(`
      UPDATE arena_character_state SET tickets = tickets - 1, ticket_updated_at = ?, updated_at = ?
      WHERE character_id = ? AND tickets >= 1
        AND EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ? AND json_extract(payload_json, '$.activationToken') = ?)
        AND EXISTS (SELECT 1 FROM arena_matches WHERE match_id = ? AND status IN ('active', 'done') AND ticket_consumed_at = ?)
    `).bind(activatedAt, activatedAt, characterId, receiptKey, activationToken, key, activatedAt),
  ]);
  const receiptInserted = Number(batch?.[0]?.meta?.changes) || 0;
  match = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(key).first();
  if (match.status === "active") return json({ ok: true, replayed: receiptInserted !== 1, match: arenaMatchPayload(match) });
  if (match.status === "done") {
    const stateForSettlement = parseJsonColumn(match.state_json, null);
    if (stateForSettlement?.result) {
      const settled = await arenaSettleV2Match(db, match, stateForSettlement, arenaResolutionForState(stateForSettlement));
      return json({ ok: true, replayed: receiptInserted !== 1 || !!settled.replayed, match: arenaMatchPayload(settled.match), result: settled.result });
    }
    return json({ ok: true, replayed: receiptInserted !== 1, match: arenaMatchPayload(match) });
  }
  if (!receiptInserted) {
    if (await db.prepare(`SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?`).bind(receiptKey).first()) {
      const current = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(key).first();
      if (current?.status === "active" || current?.status === "done") return json({ ok: true, replayed: true, match: arenaMatchPayload(current) });
    }
    return json({ error: "arena_activation_conflict", retry: true }, 409);
  }
  return json({ error: "arena_activation_conflict", retry: true }, 409);
}
async function handleGetArenaV2Match(db, id, session, characterId, matchId) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const key = String(matchId || "").trim();
  let match = key
    ? await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ? AND attacker_character_id = ?`).bind(key, characterId).first()
    : await arenaOpenMatchForAttacker(db, characterId);
  if (!key && !match) return json({ ok: true, match: null });
  if (!match) return json({ error: "arena_match_not_found" }, 404);
  if (match.status === "prepared") match = await arenaExpirePreparedMatch(db, match, Date.now());
  if (match.status === "active" && Date.parse(match.deadline_at || "") <= Date.now()) {
    const expiredState = parseJsonColumn(match.state_json, {}) || {};
    const season = await db.prepare(`SELECT ends_at FROM arena_seasons WHERE season_id = ?`).bind(match.season_id).first();
    const resolution = Date.parse(season?.ends_at || "") <= Date.now() ? "cutoff" : "timeout";
    const settled = await arenaSettleV2Match(db, match, expiredState, resolution);
    match = settled.match;
  }
  if (match.status === "done" && !parseJsonColumn(match.result_json, null)?.settlementVersion) {
    const terminalState = parseJsonColumn(match.state_json, null);
    if (terminalState?.result) {
      const settled = await arenaSettleStoredTerminalMatch(db, match, terminalState);
      if (settled) match = settled.match;
    }
  }
  return json({ ok: true, match: arenaMatchPayload(match) });
}

// ---------- W9.6 Arena combat orchestration ----------
// This layer selects commands and owns persistence only. Damage, status effects,
// cooldowns, pet behavior, queue order and round completion remain in the shared
// Battle Core above.
function arenaCombatHeroUnit(snapshot, id, side) {
  const stats = snapshot?.stats || {};
  const slots = Array.isArray(snapshot?.skillSlots) ? snapshot.skillSlots.filter((key) => typeof key === "string") : [];
  const skillLevels = arenaClone(snapshot?.skillLevels || {});
  for (const key of slots) if (!skillLevels[key]) skillLevels[key] = 1;
  const agi = Number(stats.agi) || 0;
  return {
    id, side, kind: "hero", name: snapshot?.name || id, level: Number(snapshot?.level) || 1,
    maxHp: Number(stats.maxHp) || 1, hp: Number(stats.maxHp) || 1,
    maxSp: Number(stats.maxMp) || 0, sp: Number(stats.maxMp) || 0,
    atk: Number(stats.atk) || 1, def: Number(stats.def) || 0,
    speed: Math.round(PVP_BASE_SPEED + agi * 2), accuracy: Number(stats.accuracy) || 95,
    dodge: Number(stats.dodgeChance) || 0, crit: Number(stats.critChance) || 0,
    critDamage: 1 + (Number(stats.critDamage) || 0) / 100,
    skills: skillLevels, activeSkills: slots.slice(0, 4), equipmentEffects: arenaClone(snapshot?.equipmentEffects || {}),
  };
}
function arenaCombatBotUnit(snapshot, id, side) {
  const stats = arenaBotCombatStats(snapshot);
  return arenaCombatHeroUnit({ ...snapshot, stats, skillLevels: { power_strike: 1 }, skillSlots: ["power_strike"] }, id, side);
}
function arenaCombatPetUnit(snapshot, id, side, ownerName) {
  if (!snapshot?.pet) return null;
  const unit = pvpPetUnit(snapshot.pet, id, ownerName || "");
  return unit ? { ...unit, side } : null;
}
function arenaCombatState(snapshot, matchId) {
  const teamA = {
    hero: arenaCombatHeroUnit(snapshot.attacker, "team_a_hero", "team_a"),
    pet: arenaCombatPetUnit(snapshot.attacker, "team_a_pet", "team_a", snapshot.attacker?.name),
  };
  const teamB = {
    hero: snapshot.defender?.type === "bot"
      ? arenaCombatBotUnit(snapshot.defender, "team_b_hero", "team_b")
      : arenaCombatHeroUnit(snapshot.defender, "team_b_hero", "team_b"),
    pet: arenaCombatPetUnit(snapshot.defender, "team_b_pet", "team_b", snapshot.defender?.name),
  };
  const state = BATTLE_CORE_V1.createArenaBattle({ battleId: matchId, seed: Number(snapshot.seed) >>> 0, teamA, teamB });
  state.arenaActionSeq = 0;
  state.arenaStateRev = 0;
  return state;
}
function arenaCombatLivingTargets(state, actor) {
  return Object.values(state.units || {}).filter((unit) => unit && unit.side !== actor.side && !unit.dead && unit.hp > 0);
}
function arenaCombatLowestHpPercentTarget(state, actor) {
  return arenaCombatLivingTargets(state, actor).sort((a, b) => {
    const pctA = a.maxHp ? a.hp / a.maxHp : 1;
    const pctB = b.maxHp ? b.hp / b.maxHp : 1;
    return pctA - pctB || (a.kind === "hero" ? -1 : 1) - (b.kind === "hero" ? -1 : 1) || (a.tieOrder || 0) - (b.tieOrder || 0) || a.id.localeCompare(b.id);
  })[0] || null;
}
function arenaCombatHeroCommand(state, actor) {
  const target = arenaCombatLowestHpPercentTarget(state, actor);
  for (const skillId of Array.isArray(actor.activeSkills) ? actor.activeSkills.slice(0, 4) : []) {
    const metadata = BATTLE_CORE_V1.getActionMetadata(state, actor, { type: "active", skillId, targetId: target?.id || null });
    if (!metadata.usable) continue;
    if (metadata.requiresEnemyTarget && !metadata.legalTargetIds.includes(target?.id)) continue;
    return { type: "active", skillId, ...(metadata.requiresEnemyTarget ? { targetId: target.id } : {}) };
  }
  return { type: "basic", targetId: target?.id || null };
}
function arenaCombatStep(state, command, actor = null) {
  if (actor && actor.side !== state.controlledSide && actor.kind === "hero") state.commandActorId = actor.id;
  const result = BATTLE_CORE_V1.battleStep(state, command);
  delete result.state.commandActorId;
  return result;
}
// Advance only automatic non-player turns until the next attacker-Hero
// decision boundary. Auto orchestration submits each Hero decision through the
// same authoritative action endpoint; it must never resolve multiple Hero
// decisions in one opaque request.
function arenaCombatAdvance(state) {
  let steps = 0;
  while (!state.result && steps++ < 128) {
    const actor = BATTLE_CORE_V1.currentUnit(state);
    if (!actor) break;
    if (actor.kind === "hero" && actor.side === "team_a") break;
    if (actor.kind === "hero") {
      const command = arenaCombatHeroCommand(state, actor);
      const result = arenaCombatStep(state, command, actor);
      state = result.state;
      if (result.error) break;
    } else {
      if (actor.side === "team_b") {
        const target = arenaCombatLowestHpPercentTarget(state, actor);
        state.selectedTargetIds[actor.side] = target?.id || null;
        if (actor.side === state.controlledSide) state.selectedTargetId = target?.id || null;
      }
      state = arenaCombatStep(state, undefined).state;
    }
  }
  return state;
}
function arenaCombatPublicState(state) {
  const current = state.result ? null : BATTLE_CORE_V1.currentUnit(state);
  const actionMetadata = current && current.kind === "hero" && current.side === "team_a" && !state.flags?.auto
    ? BATTLE_CORE_V1.getActionMetadata(state, current, { type: "basic" }) : null;
  const skills = current && current.kind === "hero" && current.side === "team_a"
    ? pvpHeroSkillsPublic(current).filter((skill) => (current.activeSkills || []).includes(skill.key))
    : [];
  return {
    version: state.version, battleId: state.battleId, mode: "arena", phase: state.result ? "done" : "active",
    round: Number(state.round) || 0, roundMax: 20, actionSeq: Number(state.arenaActionSeq) || 0,
    currentActorId: current?.id || null, auto: !!state.flags?.auto,
    queue: BATTLE_CORE_V1.upcomingActions(state, 4).map((id) => ({ id, name: state.units[id]?.name || id, kind: state.units[id]?.kind || null })),
    units: Object.values(state.units || {}).map((unit) => ({
      id: unit.id, side: unit.side, kind: unit.kind, name: unit.name || unit.id,
      hp: unit.hp, maxHp: unit.maxHp, sp: unit.sp, maxSp: unit.maxSp,
      statuses: Object.keys(unit.statuses || {}), dead: !!unit.dead,
    })),
    skills,
    action: actionMetadata ? { basic: actionMetadata, activeSkills: skills.map((skill) => ({ skillId: skill.key, ...BATTLE_CORE_V1.getActionMetadata(state, current, { type: "active", skillId: skill.key }) })) } : null,
    log: (state.log || []).slice(-40).map((entry) => pvpPublicLogEntry(entry, { includeSeq: true })),
    result: state.result ? { result: state.result, winnerSide: state.winnerSide || null } : null,
  };
}
function arenaCombatResult(state) {
  return state.result ? { result: state.result, winnerSide: state.winnerSide || null } : null;
}

function arenaPlayerGuard(player) {
  if (!player) return { sql: "0", params: [] };
  return {
    sql: `EXISTS (
      SELECT 1 FROM arena_season_players
      WHERE season_id = ? AND character_id = ?
        AND rating = ? AND attack_wins = ? AND attack_draws = ? AND attack_losses = ?
        AND defense_wins = ? AND defense_draws = ? AND defense_losses = ?
        AND highest_rewarded_tier = ?
    )`,
    params: [
      player.season_id, player.character_id, Number(player.rating) || ARENA_RATING_FLOOR,
      Number(player.attack_wins) || 0, Number(player.attack_draws) || 0, Number(player.attack_losses) || 0,
      Number(player.defense_wins) || 0, Number(player.defense_draws) || 0, Number(player.defense_losses) || 0,
      Number(player.highest_rewarded_tier) || 0,
    ],
  };
}

function arenaMilestoneCrossings(kind, before, after) {
  return (ARENA_MILESTONE_REWARDS[kind] || []).filter((reward) => before < reward.threshold && after >= reward.threshold);
}

function arenaPromotionAwards(player, newRating, enabled) {
  if (!enabled || !player) return [];
  const oldHighest = Number(player.highest_rewarded_tier) || 0;
  const oldTier = arenaTierRank(player.rating);
  const newTier = arenaTierRank(newRating);
  if (newTier <= oldTier) return [];
  const awards = [];
  for (let tier = Math.max(1, oldHighest + 1); tier <= newTier; tier++) {
    const reward = ARENA_PROMOTION_REWARDS[tier];
    if (reward) awards.push({ tierRank: tier, ...reward });
  }
  return awards;
}

async function arenaBuildSettlementPlan(db, match, state, requestedResolution = "normal", nowMs = Date.now()) {
  const season = await db.prepare(`SELECT * FROM arena_seasons WHERE season_id = ?`).bind(match.season_id).first();
  if (!season) throw new Error("arena_season_not_found");
  const seasonEndMs = Date.parse(season.ends_at || "");
  const completedMs = Date.parse(match.completed_at || "");
  const terminalCompletedBeforeCutoff = match.status === "done" && !!state?.result
    && Number.isFinite(completedMs) && Number.isFinite(seasonEndMs) && completedMs < seasonEndMs;
  let resolution = arenaResolutionForState(state, requestedResolution);
  if (resolution === "normal" && Number.isFinite(seasonEndMs) && nowMs >= seasonEndMs && !terminalCompletedBeforeCutoff) resolution = "cutoff";

  const attacker = await db.prepare(`SELECT p.*, c.player_id FROM arena_season_players p JOIN characters c ON c.character_id = p.character_id WHERE p.season_id = ? AND p.character_id = ?`)
    .bind(match.season_id, match.attacker_character_id).first();
  if (!attacker) throw new Error("arena_attacker_season_player_not_found");
  const defender = match.defender_type === "player" && match.defender_character_id
    ? await db.prepare(`SELECT p.*, c.player_id FROM arena_season_players p JOIN characters c ON c.character_id = p.character_id WHERE p.season_id = ? AND p.character_id = ?`)
      .bind(match.season_id, match.defender_character_id).first()
    : null;
  const pair = defender
    ? await db.prepare(`SELECT * FROM arena_pair_season_stats WHERE season_id = ? AND character_id_a = ? AND character_id_b = ?`)
      .bind(match.season_id, ...arenaPairKey(match.attacker_character_id, match.defender_character_id)).first()
    : null;

  const attackerResult = arenaAttackerResult(state, resolution);
  const defenderResult = attackerResult === "win" ? "loss" : attackerResult === "loss" ? "win" : "draw";
  const pairCount = Number(pair?.encounter_count) || 0;
  const pairMultiplier = defender ? (pairCount <= 0 ? 1 : pairCount === 1 ? 0.5 : 0) : 1;
  const ratingEnabled = resolution !== "cutoff";
  const statsEnabled = resolution !== "cutoff";
  const rawDelta = defender ? arenaRoundRatingDelta(attacker.rating, defender.rating, attackerResult) : arenaRoundRatingDelta(attacker.rating, Number(match.snapshot_json && parseJsonColumn(match.snapshot_json, {})?.defender?.rating) || 1000, attackerResult);
  let attackerDelta = ratingEnabled ? arenaApplyPairMultiplier(rawDelta, defender ? pairCount : -1) : 0;
  if (match.defender_type === "bot" && attackerResult === "win") {
    attackerDelta = Math.min(attackerDelta, Math.max(0, 1449 - (Number(attacker.rating) || ARENA_RATING_FLOOR)));
  }
  const attackerRatingBefore = Number(attacker.rating) || ARENA_RATING_FLOOR;
  const defenderRatingBefore = defender ? Number(defender.rating) || ARENA_RATING_FLOOR : null;
  const attackerRatingAfter = Math.max(ARENA_RATING_FLOOR, attackerRatingBefore + attackerDelta);
  const defenderRatingAfter = defender ? Math.max(ARENA_RATING_FLOOR, defenderRatingBefore - attackerDelta) : null;
  attackerDelta = attackerRatingAfter - attackerRatingBefore;
  const defenderDelta = defender ? defenderRatingAfter - defenderRatingBefore : 0;

  const attackPlayBefore = (Number(attacker.attack_wins) || 0) + (Number(attacker.attack_draws) || 0) + (Number(attacker.attack_losses) || 0);
  const attackWinsBefore = Number(attacker.attack_wins) || 0;
  const attackPlayAfter = statsEnabled ? attackPlayBefore + 1 : attackPlayBefore;
  const attackWinsAfter = statsEnabled ? attackWinsBefore + (attackerResult === "win" ? 1 : 0) : attackWinsBefore;
  const attackerMilestones = statsEnabled ? [
    ...arenaMilestoneCrossings("play", attackPlayBefore, attackPlayAfter).map((reward) => ({ kind: "play", ...reward })),
    ...arenaMilestoneCrossings("win", attackWinsBefore, attackWinsAfter).map((reward) => ({ kind: "win", ...reward })),
  ] : [];
  const attackerPromotion = arenaPromotionAwards(attacker, attackerRatingAfter, ratingEnabled);
  const defenderPromotion = arenaPromotionAwards(defender, defenderRatingAfter, ratingEnabled);
  const snapshot = parseJsonColumn(match.snapshot_json, {}) || {};
  const attackerName = snapshot.attacker?.name || "";
  const defenderName = snapshot.defender?.name || (match.defender_type === "bot" ? match.defender_bot_id : "");
  const baseCoin = arenaCoinReward(match.reward_slot, attackerResult);
  const attackerPromotionCoin = attackerPromotion.reduce((sum, reward) => sum + reward.arenaCoin, 0);
  const defenderPromotionCoin = defenderPromotion.reduce((sum, reward) => sum + reward.arenaCoin, 0);
  const attackerPromotionDiamonds = attackerPromotion.reduce((sum, reward) => sum + reward.diamonds, 0);
  const defenderPromotionDiamonds = defenderPromotion.reduce((sum, reward) => sum + reward.diamonds, 0);
  const milestoneCoin = attackerMilestones.reduce((sum, reward) => sum + reward.arenaCoin, 0);
  const now = arenaNowIso(nowMs);
  const result = {
    settlementVersion: 1,
    matchId: match.match_id,
    seasonId: match.season_id,
    combatResult: state?.result || (resolution === "cutoff" || resolution === "timeout" ? "timeout" : null),
    result: attackerResult,
    winnerSide: attackerResult === "win" ? "team_a" : attackerResult === "loss" ? "team_b" : null,
    resolution,
    completedAt: now,
    attacker: {
      characterId: match.attacker_character_id, name: attackerName, result: attackerResult,
      ratingBefore: Number(attacker.rating) || ARENA_RATING_FLOOR, ratingAfter: attackerRatingAfter, ratingChange: attackerDelta,
      attack: statsEnabled ? (attackerResult === "win" ? "win" : attackerResult === "draw" ? "draw" : "loss") : null,
    },
    defender: match.defender_type === "player" ? {
      characterId: match.defender_character_id, name: defenderName, result: defenderResult,
      ratingBefore: Number(defender?.rating) || ARENA_RATING_FLOOR, ratingAfter: defenderRatingAfter, ratingChange: defenderDelta,
      defense: statsEnabled ? (defenderResult === "win" ? "win" : defenderResult === "draw" ? "draw" : "loss") : null,
    } : { type: "bot", botId: match.defender_bot_id, name: defenderName, result: defenderResult, ratingChange: 0 },
    arenaCoin: { earned: baseCoin, rewardSlot: match.reward_slot, result: attackerResult },
    milestones: attackerMilestones.map((reward) => ({ kind: reward.kind, threshold: reward.threshold, arenaCoin: reward.arenaCoin })),
    promotion: {
      attacker: attackerPromotion.map((reward) => ({ tier: reward.tierRank, name: reward.tier, arenaCoin: reward.arenaCoin, diamonds: reward.diamonds })),
      defender: defenderPromotion.map((reward) => ({ tier: reward.tierRank, name: reward.tier, arenaCoin: reward.arenaCoin, diamonds: reward.diamonds })),
    },
    statsApplied: statsEnabled,
    seasonEligible: statsEnabled,
  };
  return {
    season, attacker, defender, pair, pairCount, pairMultiplier, attackerResult, defenderResult,
    attackerDelta, defenderDelta, attackerRatingAfter, defenderRatingAfter, attackerMilestones, attackerPromotion, defenderPromotion,
    baseCoin, attackerPromotionCoin, defenderPromotionCoin, milestoneCoin,
    attackerCoinTotal: baseCoin + attackerPromotionCoin + milestoneCoin,
    defenderCoinTotal: defenderPromotionCoin,
    attackerPromotionDiamonds, defenderPromotionDiamonds,
    result, now, resolution,
  };
}

function arenaReceiptExistsSql(receiptKey, operationToken) {
  return `EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ? AND json_extract(payload_json, '$.operationToken') = ?)`;
}

async function arenaSettleV2Match(db, match, state, requestedResolution = "normal", options = {}) {
  const matchId = String(match?.match_id || "");
  const settlementNowMs = Number.isFinite(Number(options.nowMs)) ? Number(options.nowMs) : Date.now();
  if (!matchId) throw new Error("arena_match_id_missing");
  const settlementReceiptKey = `arena:settlement:${matchId}`;
  const existingReceipt = await db.prepare(`SELECT payload_json FROM arena_idempotency_receipts WHERE receipt_key = ?`).bind(settlementReceiptKey).first();
  if (existingReceipt) {
    const stored = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(matchId).first();
    const result = parseJsonColumn(stored?.result_json, null);
    if (result?.settlementVersion === 1) return { match: stored, result, replayed: true };
    const receiptResult = parseJsonColumn(existingReceipt.payload_json, {})?.result;
    if (receiptResult?.settlementVersion === 1) return { match: stored, result: receiptResult, replayed: true };
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const freshMatch = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(matchId).first();
    if (!freshMatch) throw new Error("arena_match_not_found");
    const storedResult = parseJsonColumn(freshMatch.result_json, null);
    if (storedResult?.settlementVersion === 1) return { match: freshMatch, result: storedResult, replayed: true };
    const plan = await arenaBuildSettlementPlan(db, freshMatch, state, requestedResolution, settlementNowMs);
    const operationToken = randomToken(16);
    const receiptPayload = JSON.stringify({ operationToken, result: plan.result });
    const attackerGuard = arenaPlayerGuard(plan.attacker);
    const defenderGuard = arenaPlayerGuard(plan.defender);
    const pairKeys = plan.defender ? arenaPairKey(freshMatch.attacker_character_id, freshMatch.defender_character_id) : null;
    const pairGuard = plan.defender
      ? (plan.pair ? `EXISTS (SELECT 1 FROM arena_pair_season_stats WHERE season_id = ? AND character_id_a = ? AND character_id_b = ? AND encounter_count = ?)` : `NOT EXISTS (SELECT 1 FROM arena_pair_season_stats WHERE season_id = ? AND character_id_a = ? AND character_id_b = ?)`)
      : "1";
    const pairGuardParams = plan.defender
      ? [freshMatch.season_id, ...pairKeys, ...(plan.pair ? [plan.pairCount] : [])]
      : [];
    const settlementStatus = freshMatch.status === "active" ? "active" : "done";
    const settlementInsert = db.prepare(`
      INSERT INTO arena_idempotency_receipts (receipt_key, kind, season_id, character_id, match_id, payload_json, created_at)
      SELECT ?, 'settlement', ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?)
        AND EXISTS (SELECT 1 FROM arena_matches WHERE match_id = ? AND status = ?)
        AND ${attackerGuard.sql}
        ${defenderGuard.sql === "0" ? "" : `AND ${defenderGuard.sql}`}
        AND ${pairGuard}
    `).bind(
      settlementReceiptKey, freshMatch.season_id, freshMatch.attacker_character_id, matchId, receiptPayload, plan.now,
      settlementReceiptKey, matchId, settlementStatus,
      ...attackerGuard.params, ...defenderGuard.params, ...pairGuardParams,
    );
    const statements = [settlementInsert];
    const receiptGate = arenaReceiptExistsSql(settlementReceiptKey, operationToken);
    const finalState = arenaClone(state) || {};
    if (!finalState.result) {
      finalState.result = plan.resolution === "cutoff" || plan.resolution === "timeout" ? "timeout" : plan.result.result;
      finalState.winnerSide = "team_b";
      finalState.flags = { ...(finalState.flags || {}), auto: false };
      finalState.log = Array.isArray(finalState.log) ? finalState.log : [];
      finalState.logSeq = Number(finalState.logSeq) || 0;
      finalState.log.push({ seq: ++finalState.logSeq, round: Number(finalState.round) || 0, type: "battle_end", text: plan.resolution === "cutoff" ? "Season cutoff" : "Timeout" });
    }
    const finalStateJson = JSON.stringify(finalState);
    statements.push(db.prepare(`
      UPDATE arena_matches SET status = 'done', state_json = ?, result_json = ?,
        completed_at = CASE WHEN completed_at IS NULL OR completed_at = '' THEN ? ELSE completed_at END,
        updated_at = ?
      WHERE match_id = ? AND status = ? AND ${receiptGate}
    `).bind(finalStateJson, JSON.stringify(plan.result), plan.now, plan.now, matchId, settlementStatus, settlementReceiptKey, operationToken));
    const attackerNewHighest = Math.max(Number(plan.attacker.highest_rewarded_tier) || 0, ...plan.attackerPromotion.map((reward) => reward.tierRank), 0);
    if (plan.result.statsApplied) {
      statements.push(db.prepare(`
        UPDATE arena_season_players SET rating = ?, rating_reached_at = ?,
          attack_wins = attack_wins + ?, attack_draws = attack_draws + ?, attack_losses = attack_losses + ?,
          highest_rewarded_tier = ?, updated_at = ?
        WHERE season_id = ? AND character_id = ? AND ${receiptGate}
      `).bind(
        plan.attackerRatingAfter,
        plan.attackerRatingAfter > (Number(plan.attacker.rating) || ARENA_RATING_FLOOR) ? plan.now : plan.attacker.rating_reached_at,
        plan.attackerResult === "win" ? 1 : 0, plan.attackerResult === "draw" ? 1 : 0, plan.attackerResult === "loss" ? 1 : 0,
        attackerNewHighest, plan.now, freshMatch.season_id, freshMatch.attacker_character_id, settlementReceiptKey, operationToken,
      ));
    }
    if (plan.defender) {
      const defenderNewHighest = Math.max(Number(plan.defender.highest_rewarded_tier) || 0, ...plan.defenderPromotion.map((reward) => reward.tierRank), 0);
      if (plan.result.statsApplied) {
        statements.push(db.prepare(`
          UPDATE arena_season_players SET rating = ?, rating_reached_at = ?,
            defense_wins = defense_wins + ?, defense_draws = defense_draws + ?, defense_losses = defense_losses + ?,
            highest_rewarded_tier = ?, updated_at = ?
          WHERE season_id = ? AND character_id = ? AND ${receiptGate}
        `).bind(
          plan.defenderRatingAfter,
          plan.defenderRatingAfter > (Number(plan.defender.rating) || ARENA_RATING_FLOOR) ? plan.now : plan.defender.rating_reached_at,
          plan.defenderResult === "win" ? 1 : 0, plan.defenderResult === "draw" ? 1 : 0, plan.defenderResult === "loss" ? 1 : 0,
          defenderNewHighest, plan.now, freshMatch.season_id, freshMatch.defender_character_id, settlementReceiptKey, operationToken,
        ));
      }
      if (plan.result.statsApplied && !plan.pair) {
        statements.push(db.prepare(`
          INSERT INTO arena_pair_season_stats (season_id, character_id_a, character_id_b, encounter_count, updated_at)
          SELECT ?, ?, ?, 1, ? WHERE ${receiptGate}
        `).bind(freshMatch.season_id, pairKeys[0], pairKeys[1], plan.now, settlementReceiptKey, operationToken));
      } else if (plan.result.statsApplied) {
        statements.push(db.prepare(`
          UPDATE arena_pair_season_stats SET encounter_count = encounter_count + 1, updated_at = ?
          WHERE season_id = ? AND character_id_a = ? AND character_id_b = ? AND encounter_count = ? AND ${receiptGate}
        `).bind(plan.now, freshMatch.season_id, pairKeys[0], pairKeys[1], plan.pairCount, settlementReceiptKey, operationToken));
      }
      if (plan.result.statsApplied) {
        statements.push(db.prepare(`
          INSERT INTO arena_character_state (character_id, arena_coin, tickets, ticket_updated_at, last_daily_ticket_date, unlock_notice_seen, created_at, updated_at)
          SELECT ?, 0, 0, '', '', 1, ?, ? WHERE ${receiptGate}
          ON CONFLICT(character_id) DO NOTHING
        `).bind(freshMatch.defender_character_id, plan.now, plan.now, settlementReceiptKey, operationToken));
      }
    }
    statements.push(db.prepare(`UPDATE arena_character_state SET arena_coin = arena_coin + ?, updated_at = ? WHERE character_id = ? AND ${receiptGate}`)
      .bind(plan.attackerCoinTotal, plan.now, freshMatch.attacker_character_id, settlementReceiptKey, operationToken));
    if (plan.defender && plan.defenderCoinTotal > 0) {
      statements.push(db.prepare(`UPDATE arena_character_state SET arena_coin = arena_coin + ?, updated_at = ? WHERE character_id = ? AND ${receiptGate}`)
        .bind(plan.defenderCoinTotal, plan.now, freshMatch.defender_character_id, settlementReceiptKey, operationToken));
    }
    if (plan.attackerPromotionDiamonds > 0) statements.push(db.prepare(`UPDATE players SET diamonds = diamonds + ? WHERE id = ? AND ${receiptGate}`)
      .bind(plan.attackerPromotionDiamonds, plan.attacker.player_id, settlementReceiptKey, operationToken));
    if (plan.defender && plan.defenderPromotionDiamonds > 0) statements.push(db.prepare(`UPDATE players SET diamonds = diamonds + ? WHERE id = ? AND ${receiptGate}`)
      .bind(plan.defenderPromotionDiamonds, plan.defender.player_id, settlementReceiptKey, operationToken));

    for (const reward of plan.attackerMilestones) {
      const key = `arena:milestone:${freshMatch.season_id}:${freshMatch.attacker_character_id}:${reward.kind}:${reward.threshold}`;
      statements.push(db.prepare(`
        INSERT INTO arena_idempotency_receipts (receipt_key, kind, season_id, character_id, match_id, payload_json, created_at)
        SELECT ?, 'milestone', ?, ?, ?, ?, ? WHERE ${receiptGate}
        ON CONFLICT(receipt_key) DO NOTHING
      `).bind(key, freshMatch.season_id, freshMatch.attacker_character_id, matchId, JSON.stringify({ operationToken, kind: reward.kind, threshold: reward.threshold, arenaCoin: reward.arenaCoin }), plan.now, settlementReceiptKey, operationToken));
    }
    for (const [owner, rewards, characterId] of [
      ["attacker", plan.attackerPromotion, freshMatch.attacker_character_id],
      ["defender", plan.defenderPromotion, freshMatch.defender_character_id],
    ]) {
      if (!characterId) continue;
      for (const reward of rewards) {
        const key = `arena:promotion:${freshMatch.season_id}:${characterId}:${reward.tierRank}`;
        statements.push(db.prepare(`
          INSERT INTO arena_idempotency_receipts (receipt_key, kind, season_id, character_id, match_id, payload_json, created_at)
          SELECT ?, 'promotion', ?, ?, ?, ?, ? WHERE ${receiptGate}
          ON CONFLICT(receipt_key) DO NOTHING
        `).bind(key, freshMatch.season_id, characterId, matchId, JSON.stringify({ operationToken, owner, tier: reward.tierRank, tierName: reward.tier, arenaCoin: reward.arenaCoin, diamonds: reward.diamonds }), plan.now, settlementReceiptKey, operationToken));
      }
    }
    if (plan.result.seasonEligible) {
      const eligibilityKey = `arena:season-eligibility:${freshMatch.season_id}:${freshMatch.attacker_character_id}`;
      statements.push(db.prepare(`
        INSERT INTO arena_idempotency_receipts (receipt_key, kind, season_id, character_id, match_id, payload_json, created_at)
        SELECT ?, 'season_eligibility', ?, ?, ?, ?, ? WHERE ${receiptGate}
        ON CONFLICT(receipt_key) DO NOTHING
      `).bind(eligibilityKey, freshMatch.season_id, freshMatch.attacker_character_id, matchId, JSON.stringify({ operationToken, eligible: true }), plan.now, settlementReceiptKey, operationToken));
    }
    statements.push(db.prepare(`
      INSERT INTO arena_match_history (
        match_id, season_id, attacker_character_id, defender_type, defender_character_id, defender_bot_id,
        attacker_name, defender_name, attacker_result, attacker_rating_change, defender_rating_change,
        arena_coin_earned, resolution, completed_at
      ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${receiptGate}
      ON CONFLICT(match_id) DO NOTHING
    `).bind(
      matchId, freshMatch.season_id, freshMatch.attacker_character_id, freshMatch.defender_type, freshMatch.defender_character_id || null,
      freshMatch.defender_bot_id || "", plan.result.attacker.name, plan.result.defender.name || "", plan.attackerResult,
      plan.attackerDelta, plan.defender ? plan.defenderDelta : 0, plan.baseCoin, plan.resolution, plan.now,
      settlementReceiptKey, operationToken,
    ));
    if (options.actionKey && options.actionResponse) {
      const authoritativeResponse = { ...options.actionResponse, result: plan.result };
      statements.push(db.prepare(`UPDATE arena_match_actions SET response_json = ? WHERE match_id = ? AND action_key = ? AND ${receiptGate}`)
        .bind(JSON.stringify(authoritativeResponse), matchId, options.actionKey, settlementReceiptKey, operationToken));
    }
    const batch = await db.batch(statements);
    if (Number(batch?.[0]?.meta?.changes) === 1) {
      const stored = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(matchId).first();
      return { match: stored, result: plan.result, replayed: false };    }
    const replay = await db.prepare(`SELECT payload_json FROM arena_idempotency_receipts WHERE receipt_key = ?`).bind(settlementReceiptKey).first();
    if (replay) {
      const stored = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(matchId).first();
      return { match: stored, result: parseJsonColumn(stored?.result_json, null) || parseJsonColumn(replay.payload_json, {})?.result, replayed: true };
    }
  }
  throw new Error("arena_settlement_conflict");
}

async function arenaSettleStoredTerminalMatch(db, match, state = null, nowMs = Date.now()) {
  if (!match || match.status !== "done") return null;
  const storedResult = parseJsonColumn(match.result_json, null);
  if (storedResult?.settlementVersion === 1) return { match, result: storedResult, replayed: true };
  const terminalState = state || parseJsonColumn(match.state_json, {}) || {};
  const season = await db.prepare(`SELECT ends_at FROM arena_seasons WHERE season_id = ?`).bind(match.season_id).first();
  const seasonEndMs = Date.parse(season?.ends_at || "");
  const seasonEnded = Number.isFinite(seasonEndMs) && seasonEndMs <= nowMs;
  let completedMs = Date.parse(match.completed_at || "");

  // A terminal combat commit can be persisted in the action ledger before the
  // final match row update. If a crash leaves completed_at blank, recover the
  // action's server timestamp so season cutoff handling uses the real completion time.
  if (terminalState.result && !Number.isFinite(completedMs)) {
    const terminalAction = await db.prepare(
      `SELECT created_at, response_json
       FROM arena_match_actions
       WHERE match_id = ?
       ORDER BY action_seq DESC
       LIMIT 1`
    ).bind(match.match_id).first();
    const actionResponse = parseJsonColumn(terminalAction?.response_json, null);
    const actionResult = actionResponse?.result;
    const matchesTerminal = actionResult
      && actionResult.result === terminalState.result
      && String(actionResult.winnerSide || "") === String(terminalState.winnerSide || "");
    if (matchesTerminal) completedMs = Date.parse(terminalAction.created_at || "");
  }

  if (!terminalState.result && !seasonEnded) return null;
  let resolution;
  if (terminalState.result && Number.isFinite(completedMs) && Number.isFinite(seasonEndMs)) {
    resolution = completedMs < seasonEndMs ? arenaResolutionForState(terminalState) : "cutoff";
  } else {
    resolution = seasonEnded ? "cutoff" : arenaResolutionForState(terminalState);
  }
  return arenaSettleV2Match(db, match, terminalState, resolution, { nowMs });
}


async function arenaSettleExpiredActiveMatches(db, seasonId, nowMs = Date.now()) {
  const rows = await db.prepare(`SELECT * FROM arena_matches WHERE season_id = ? AND status IN ('active', 'done') ORDER BY created_at ASC, match_id ASC`).bind(seasonId).all();
  let settled = 0;
  for (const row of rows.results || []) {
    if (row.status === "done" && parseJsonColumn(row.result_json, null)?.settlementVersion === 1) continue;
    const state = parseJsonColumn(row.state_json, {}) || {};
    let result;
    if (row.status === "done") {
      result = await arenaSettleStoredTerminalMatch(db, row, state, nowMs);
      if (!result) continue;
    } else {
      result = await arenaSettleV2Match(db, row, state, "cutoff");
    }
    if (!result.replayed) settled++;
  }
  return settled;
}

async function arenaFinalizeSeason(db, season, nowMs = Date.now()) {
  if (!season) return { finalized: false, already: false };
  const current = await db.prepare(`SELECT * FROM arena_seasons WHERE season_id = ?`).bind(season.season_id).first();
  if (!current || current.status === "finalized") return { finalized: false, already: true };
  await arenaSettleExpiredActiveMatches(db, current.season_id, nowMs);
  const ranked = await db.prepare(`
    SELECT p.*, c.name, c.player_id
    FROM arena_season_players p JOIN characters c ON c.character_id = p.character_id
    WHERE p.season_id = ? AND (p.attack_wins + p.attack_draws + p.attack_losses) > 0
    ORDER BY p.rating DESC, p.attack_wins DESC, p.rating_reached_at ASC, p.character_id ASC
  `).bind(current.season_id).all();
  let rank = 0;
  for (const player of ranked.results || []) {
    rank += 1;
    const reward = arenaSeasonRewardForRank(rank);
    const now = arenaNowIso(nowMs);
    const expiresAt = reward.frameKey ? new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
    await ensureArenaCharacterState(db, player.character_id, nowMs);
    const receiptKey = `arena:season-reward:${current.season_id}:${player.character_id}`;
    const operationToken = randomToken(16);
    const payload = {
      operationToken, seasonId: current.season_id, characterId: player.character_id, rank,
      bucket: rank === 1 ? "1" : rank === 2 ? "2" : rank === 3 ? "3" : rank <= 10 ? "4-10" : rank <= 100 ? "11-100" : "101+",
      arenaCoin: reward.arenaCoin, diamonds: reward.diamonds,
      progressionMaterial: reward.manaOre > 0
        ? { enabled: true, junkId: "manaOre", quantity: reward.manaOre, delivery: "mailbox", sourceKey: receiptKey }
        : { enabled: false },
      profileFrame: reward.frameKey ? { enabled: true, frameKey: reward.frameKey, expiresAt } : { enabled: false },
    };
    const rewardStatements = [
      db.prepare(`
        INSERT INTO arena_idempotency_receipts (receipt_key, kind, season_id, character_id, payload_json, created_at)
        SELECT ?, 'season_reward', ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?)
      `).bind(receiptKey, current.season_id, player.character_id, JSON.stringify(payload), now, receiptKey),
      db.prepare(`UPDATE arena_character_state SET arena_coin = arena_coin + ?, updated_at = ? WHERE character_id = ? AND ${arenaReceiptExistsSql(receiptKey, operationToken)}`)
        .bind(reward.arenaCoin, now, player.character_id, receiptKey, operationToken),
      db.prepare(`UPDATE players SET diamonds = diamonds + ? WHERE id = ? AND ${arenaReceiptExistsSql(receiptKey, operationToken)}`)
        .bind(reward.diamonds, player.player_id, receiptKey, operationToken),
    ];
    if (reward.frameKey) {
      rewardStatements.push(db.prepare(`
        INSERT INTO profile_frame_entitlements
          (entitlement_id, character_id, frame_key, source_type, source_key, granted_at, expires_at, disabled_at, created_at, updated_at)
        SELECT ?, ?, ?, 'arena_season_rank', ?, ?, ?, NULL, ?, ?
        WHERE ${arenaReceiptExistsSql(receiptKey, operationToken)}
        ON CONFLICT(character_id, frame_key, source_type, source_key) DO NOTHING
      `).bind(
        `arena-frame:${current.season_id}:${player.character_id}:${rank}`, player.character_id, reward.frameKey,
        receiptKey, now, expiresAt, now, now, receiptKey, operationToken,
      ));
      rewardStatements.push(db.prepare(`
        INSERT INTO character_profile_frame_state (character_id, equipped_frame_key, updated_at)
        SELECT ?, ?, ? WHERE ${arenaReceiptExistsSql(receiptKey, operationToken)}
        ON CONFLICT(character_id) DO UPDATE SET equipped_frame_key = excluded.equipped_frame_key, updated_at = excluded.updated_at
      `).bind(player.character_id, reward.frameKey, now, receiptKey, operationToken));
    }
    await db.batch(rewardStatements);
    if (reward.manaOre > 0) {
      await sendMail(
        db,
        player.character_id,
        "Arena Season Reward",
        `Season ${current.season_number} Rank ${rank} · Mana Ore ×${reward.manaOre}`,
        { junk: [{ junkId: "manaOre", quantity: reward.manaOre }] },
        receiptKey,
      );
    }
  }
  const finalizedAt = arenaNowIso(nowMs);
  await db.batch([
    db.prepare(`UPDATE arena_seasons SET status = 'finalized', finalized_at = ?, updated_at = ? WHERE season_id = ? AND status != 'finalized'`).bind(finalizedAt, finalizedAt, current.season_id),
    db.prepare(`INSERT INTO arena_idempotency_receipts (receipt_key, kind, season_id, payload_json, created_at) SELECT ?, 'season_finalization', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM arena_idempotency_receipts WHERE receipt_key = ?)`)
      .bind(`arena:season-finalized:${current.season_id}`, current.season_id, JSON.stringify({ seasonId: current.season_id, finalizedAt }), finalizedAt, `arena:season-finalized:${current.season_id}`),
  ]);
  return { finalized: true, already: false, ranked: ranked.results?.length || 0 };
}
async function arenaStoreCombatState(db, match, state, now, response, actionKey, actionSeq, previousActionSeq, previousStateRev) {
  const responseJson = JSON.stringify(response);
  const stateJson = JSON.stringify(state);
  const resultJson = arenaCombatResult(state);
  const status = state.result ? "done" : "active";
  const batch = await db.batch([
    db.prepare(`
      INSERT INTO arena_match_actions (match_id, action_key, action_seq, response_json, created_at)
      SELECT ?, ?, ?, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM arena_match_actions WHERE match_id = ? AND action_key = ?)
        AND NOT EXISTS (SELECT 1 FROM arena_match_actions WHERE match_id = ? AND action_seq = ?)
        AND EXISTS (SELECT 1 FROM arena_matches WHERE match_id = ? AND status = 'active' AND json_extract(state_json, '$.arenaActionSeq') = ? AND COALESCE(json_extract(state_json, '$.arenaStateRev'), 0) = ?)
    `).bind(match.match_id, actionKey, actionSeq, responseJson, now, match.match_id, actionKey, match.match_id, actionSeq, match.match_id, previousActionSeq, previousStateRev),
    db.prepare(`
      UPDATE arena_matches SET status = ?, state_json = ?, result_json = ?, completed_at = CASE WHEN ? = 'done' THEN ? ELSE completed_at END, updated_at = ?
      WHERE match_id = ? AND status = 'active' AND json_extract(state_json, '$.arenaActionSeq') = ? AND COALESCE(json_extract(state_json, '$.arenaStateRev'), 0) = ?
        AND EXISTS (SELECT 1 FROM arena_match_actions WHERE match_id = ? AND action_key = ? AND action_seq = ?)
    `).bind(status, stateJson, resultJson ? JSON.stringify(resultJson) : "", status, now, now, match.match_id, previousActionSeq, previousStateRev, match.match_id, actionKey, actionSeq),
  ]);
  const inserted = Number(batch?.[0]?.meta?.changes) || 0;
  const updated = Number(batch?.[1]?.meta?.changes) || 0;
  if (updated === 1) return true;
  if (inserted === 1) {
    await db.prepare(`DELETE FROM arena_match_actions WHERE match_id = ? AND action_key = ? AND action_seq = ?`)
      .bind(match.match_id, actionKey, actionSeq).run();
  }
  return false;
}
async function handleSetArenaV2Auto(db, id, session, characterId, matchId, enabled) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const match = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ? AND attacker_character_id = ?`).bind(String(matchId || ""), characterId).first();
  if (!match || match.status !== "active") return json({ error: "arena_match_not_active" }, 409);
  if (Date.parse(match.deadline_at || "") <= Date.now()) {
    const expiredState = parseJsonColumn(match.state_json, {}) || {};
    const season = await db.prepare(`SELECT ends_at FROM arena_seasons WHERE season_id = ?`).bind(match.season_id).first();
    const resolution = Date.parse(season?.ends_at || "") <= Date.now() ? "cutoff" : "timeout";
    const settled = await arenaSettleV2Match(db, match, expiredState, resolution);
    return json({ ok: true, replayed: !!settled.replayed, match: arenaMatchPayload(settled.match), result: settled.result });
  }
  const state = parseJsonColumn(match.state_json, null);
  if (!state || state.result) return json({ error: "arena_match_already_done" }, 409);
  const previousStateRev = Number(state.arenaStateRev) || 0;
  state.flags = { ...(state.flags || {}), auto: !!enabled };
  state.arenaStateRev = previousStateRev + 1;
  const saved = await db.prepare(`UPDATE arena_matches SET state_json = ?, updated_at = ? WHERE match_id = ? AND status = 'active' AND COALESCE(json_extract(state_json, '$.arenaStateRev'), 0) = ?`)
    .bind(JSON.stringify(state), nowIso(), match.match_id, previousStateRev).run();
  if (Number(saved?.meta?.changes) !== 1) return json({ error: "arena_combat_conflict", retry: true }, 409);
  return json({ ok: true, match: arenaMatchPayload({ ...match, state_json: JSON.stringify(state) }) });
}
async function handleSubmitArenaV2Action(db, id, session, characterId, matchId, actionKey, actionType = "basic", skillId, targetId, auto = false) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const key = String(matchId || "").trim();
  const requestKey = String(actionKey || "").trim();
  if (!key || !requestKey || requestKey.length > 128) return json({ error: "missing_action_key" }, 400);
  const prior = await db.prepare(`SELECT response_json FROM arena_match_actions WHERE match_id = ? AND action_key = ?`).bind(key, requestKey).first();
  if (prior) {
    const stored = { ...parseJsonColumn(prior.response_json, { error: "arena_action_replay_corrupt" }), replayed: true };
    const authoritative = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(key).first();
    const recovered = await arenaSettleStoredTerminalMatch(db, authoritative);
    if (recovered?.result) stored.result = recovered.result;
    return json(stored);
  }
  const match = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ? AND attacker_character_id = ?`).bind(key, characterId).first();
  if (!match) return json({ error: "arena_match_not_found" }, 404);
  if (match.status !== "active") {
    if (match.status === "done") {
      const recovered = await arenaSettleStoredTerminalMatch(db, match);
      const settledMatch = recovered?.match || match;
      return json({ ok: true, replayed: true, match: arenaMatchPayload(settledMatch), result: recovered?.result || parseJsonColumn(settledMatch.result_json, null) });
    }
    return json({ error: "arena_match_not_active", match: arenaMatchPayload(match) }, 409);
  }
  const nowMs = Date.now();
  if (Date.parse(match.deadline_at || "") <= nowMs) {
    const expiredState = parseJsonColumn(match.state_json, {}) || {};
    const season = await db.prepare(`SELECT ends_at FROM arena_seasons WHERE season_id = ?`).bind(match.season_id).first();
    const resolution = Date.parse(season?.ends_at || "") <= nowMs ? "cutoff" : "timeout";
    const settled = await arenaSettleV2Match(db, match, expiredState, resolution);
    return json({ ok: true, replayed: !!settled.replayed, timedOut: true, match: arenaMatchPayload(settled.match), result: settled.result });
  }
  if (actionType === "surrender") {
    const activatedMs = Date.parse(match.activated_at || "");
    if (!Number.isFinite(activatedMs)) return json({ error: "arena_match_state_invalid" }, 409);
    const availableAt = activatedMs + ARENA_SURRENDER_COOLDOWN_MS;
    if (nowMs < availableAt) {
      return json({ error: "arena_surrender_cooldown", retryAfter: Math.max(1, Math.ceil((availableAt - nowMs) / 1000)), surrenderAvailableAt: arenaNowIso(availableAt) }, 409);
    }
  }
  let state = parseJsonColumn(match.state_json, null);
  if (!state || state.mode !== "arena") return json({ error: "arena_match_state_invalid" }, 409);
  state.flags = { ...(state.flags || {}) };
  const previousStateRev = Number(state.arenaStateRev) || 0;
  const actor = BATTLE_CORE_V1.currentUnit(state);
  if (!actor || actor.kind !== "hero" || actor.side !== "team_a") return json({ error: "arena_not_attacker_turn" }, 409);
  const previousActionSeq = Number(state.arenaActionSeq) || 0;
  const actionSeq = previousActionSeq + 1;
  state.arenaActionSeq = actionSeq;
  let command;
  if (actionType === "surrender") {
    state.result = "surrender"; state.winnerSide = "team_b"; state.flags.auto = false;
    state.log.push({ seq: ++state.logSeq, round: state.round, type: "battle_end", text: "Surrender" });
  } else {
    if (actionType !== "basic" && actionType !== "active") return json({ error: "arena_action_invalid" }, 400);
    const autoMode = !!state.flags.auto;
    command = autoMode
      ? arenaCombatHeroCommand(state, actor)
      : actionType === "active"
        ? { type: "active", skillId: String(skillId || ""), targetId: targetId == null ? undefined : String(targetId) }
        : { type: "basic", targetId: targetId == null ? undefined : String(targetId) };
    const invalid = BATTLE_CORE_V1.validateHeroCommand(state, actor, command, { strictTarget: !autoMode });
    if (invalid) return json({ error: "arena_action_illegal", reason: invalid }, 409);
    const playerStep = arenaCombatStep(state, command, actor);
    if (playerStep.error) return json({ error: "arena_action_illegal", reason: playerStep.error }, 409);
    state = playerStep.state;
    state = arenaCombatAdvance(state);
  }
  state.arenaStateRev = previousStateRev + 1;
  const publicState = arenaCombatPublicState(state);
  const response = { ok: true, replayed: false, matchId: key, actionKey: requestKey, actionSeq, state: publicState, result: arenaCombatResult(state) };
  const stored = await arenaStoreCombatState(db, match, state, nowIso(), response, requestKey, actionSeq, previousActionSeq, previousStateRev);
  if (!stored) {
    const replay = await db.prepare(`SELECT response_json FROM arena_match_actions WHERE match_id = ? AND action_key = ?`).bind(key, requestKey).first();
    if (replay) {
      const storedResponse = { ...parseJsonColumn(replay.response_json, { error: "arena_action_replay_corrupt" }), replayed: true };
      const authoritative = await db.prepare(`SELECT * FROM arena_matches WHERE match_id = ?`).bind(key).first();
      const recovered = await arenaSettleStoredTerminalMatch(db, authoritative);
      if (recovered?.result) storedResponse.result = recovered.result;
      return json(storedResponse);
    }
    return json({ error: "arena_action_conflict", retry: true }, 409);
  }
  if (state.result) {
    const settled = await arenaSettleV2Match(db, match, state, arenaResolutionForState(state), {
      actionKey: requestKey,
      actionResponse: response,
    });
    response.result = settled.result;
  }
  return json(response);
}
async function handleGetArenaV2PlayerCard(db, id, session, characterId, opponentKey) {
  const context = await arenaV2Context(db, id, session, characterId);
  if (context.error) return json({ error: context.error });
  const { opponents } = await getArenaV2OpponentRows(db, context);
  const target = String(opponentKey || "").startsWith("history:")
    ? await arenaRevengeOpponent(db, context.season.season_id, characterId, opponentKey)
    : opponents.find((row) => arenaOpponentKey(row) === String(opponentKey || ""));
  if (!target) return json({ error: "arena_opponent_not_found" }, 404);
  if (target.type === "bot") {
    const bot = arenaBotSnapshot(target);
    return json({ ok: true, playerCard: {
      opponentKey: target.opponentKey,
      name: bot.name,
      level: bot.level,
      rating: bot.rating,
      tier: bot.tier,
      cp: bot.cp,
      equipment: bot.equipment,
      pet: bot.pet,
      profileFrameKey: null,
      avatar: { mode: "head", layers: [] },
      archetype: bot.archetype,
      isBot: true,
    } });
  }
  const targetCharacter = await db.prepare(`SELECT character_id, name, level, str, vit, agi, dex, luk, pets_json, active_pet_id FROM characters WHERE character_id = ?`).bind(target.characterId).first();
  if (!targetCharacter) return json({ error: "arena_opponent_not_found" }, 404);
  const items = await arenaCurrentEquipment(db, target.characterId);
  const setup = await sanitizeArenaSetup(db, targetCharacter);
  const pet = setup.petInstId ? arenaPetFromCharacter(targetCharacter, setup.petInstId) : null;
  return json({ ok: true, playerCard: {
    opponentKey: target.opponentKey, name: targetCharacter.name || target.name || "", level: Number(targetCharacter.level) || 1,
    rating: Number(target.rating) || 1000, tier: arenaTierForRating(target.rating), cp: combatPowerFromCharacter(targetCharacter, items),
    equipment: arenaEquipmentPublic(items), pet: pet ? {
      instId: pet.instId,
      defId: pet.defId,
      name: PET_DISPLAY_NAMES[pet.defId] || pet.name || pet.defId || "Pet",
      level: Number(pet.level) || 1,
      star: Number(pet.star) || 1,
    } : null,
    profileFrameKey: await arenaValidProfileFrame(db, target.characterId), avatar: { mode: "head", layers: [] }, isBot: false,
  } });
}



// ---------- admin / QA ----------
function publicPlayerFields(player) {
  if (!player) return player;
  const { password, password_hash, recovery_code_hash, ...safe } = player;
  return safe;
}
async function handleAdminGetPlayer(db, adminAuth, id) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!id) return json({ error: "missing_fields" });

  const player = await getRow(db, "players", "id", id);
  if (!player) return json({ error: "not_found" });
  const characters = await getRows(db, "characters", "player_id", id);
  const items = await getRows(db, "items", "player_id", id);
  await writeAdminAudit(
    db,
    adminAuth.playerId,
    "ADMIN_PLAYER_VIEW",
    { characterCount: characters.length, itemCount: items.length },
    "player",
    player.id
  );

  return json({ ok: true, player: publicPlayerFields(player), characters, items });
}

async function handleAdminSearchPlayers(db, adminAuth, query, limit) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  const q = String(query || "").trim();
  if (!q) return json({ error: "missing_query" }, 400);
  const safeLimit = Math.min(50, Math.max(1, Math.floor(Number(limit) || 25)));
  const normalized = q.toLowerCase();
  const result = await db.prepare(`
    SELECT
      p.id AS player_id,
      COUNT(DISTINCT c.character_id) AS character_count,
      COALESCE(MAX(c.level), 0) AS max_level,
      COALESCE(MAX(c.unlocked_floor), 0) AS max_floor,
      COALESCE(GROUP_CONCAT(NULLIF(c.name, ''), ' · '), '') AS character_names
    FROM players p
    LEFT JOIN characters c ON c.player_id = p.id
    WHERE instr(LOWER(p.id), ?) > 0
       OR EXISTS (
         SELECT 1 FROM characters sc
         WHERE sc.player_id = p.id
           AND instr(LOWER(sc.name), ?) > 0
       )
    GROUP BY p.id
    ORDER BY LOWER(p.id)
    LIMIT ?
  `).bind(normalized, normalized, safeLimit).all();
  const rows = (result.results || []).map(row => ({
    playerId: row.player_id,
    characterCount: Number(row.character_count) || 0,
    maxLevel: Number(row.max_level) || 0,
    maxFloor: Number(row.max_floor) || 0,
    characterNames: String(row.character_names || "")
  }));
  await writeAdminAudit(
    db,
    adminAuth.playerId,
    "ADMIN_PLAYER_SEARCH",
    { queryLength: q.length, resultCount: rows.length, limit: safeLimit },
    "player_search",
    null
  );
  return json({ ok: true, results: rows });
}

async function handleAdminGetAllPlayers(db, adminAuth) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);

  const players = await db.prepare(`SELECT * FROM players`).all();
  const characters = await db.prepare(`SELECT * FROM characters`).all();
  return json({ ok: true, players: (players.results || []).map(publicPlayerFields), characters: characters.results || [] });
}

async function handleAdminGetPlayerItems(db, adminAuth, id) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!id) return json({ error: "missing_fields" });

  const items = await getRows(db, "items", "player_id", id);
  return json({ ok: true, items });
}

async function handleAdminGetGameStats(db, adminAuth) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);

  const playerCount = await db.prepare(`SELECT COUNT(*) as c FROM players`).first();
  const characterCount = await db.prepare(`SELECT COUNT(*) as c FROM characters`).first();
  const itemCount = await db.prepare(`SELECT COUNT(*) as c FROM items`).first();
  const runCount = await db.prepare(`SELECT COUNT(*) as c FROM character_run_state`).first();
  const levelStats = await db.prepare(`SELECT AVG(level) as avgLevel, MAX(level) as maxLevel FROM characters`).first();
  const floorStats = await db.prepare(`SELECT MAX(unlocked_floor) as maxFloor FROM characters`).first();

  return json({
    ok: true,
    stats: {
      players: playerCount ? playerCount.c : 0,
      characters: characterCount ? characterCount.c : 0,
      activeRuns: runCount ? runCount.c : 0,
      items: itemCount ? itemCount.c : 0,
      avgLevel: levelStats && levelStats.avgLevel ? +Number(levelStats.avgLevel).toFixed(2) : 0,
      maxLevel: levelStats ? levelStats.maxLevel || 0 : 0,
      maxFloor: floorStats ? floorStats.maxFloor || 0 : 0,
    },
  });
}

async function handleAdminGetSheet(db, adminAuth, tableName) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  const allowed = Object.keys(TABLES);
  if (!tableName || allowed.indexOf(tableName) === -1) return json({ error: "invalid_sheet", allowed });

  const table = TABLES[tableName] ? TABLES[tableName].name : tableName;
  const res = await db.prepare(`SELECT * FROM ${table}`).all();
  const rows = tableName === "players" ? (res.results || []).map(publicPlayerFields) : (res.results || []);
  return json({ ok: true, sheet: tableName, rows });
}

async function handleAdminSaveGameConfig(db, adminAuth, config) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!config || typeof config !== "object") return json({ error: "invalid_config" });

  const now = nowIso();
  const stmts = Object.keys(config).map((key) =>
    db
      .prepare(
        `INSERT INTO game_config (key, value_json, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`
      )
      .bind(key, JSON.stringify(config[key]), now)
  );
  if (stmts.length) await db.batch(stmts);

  return json({ ok: true });
}

async function handleAdminSetGameConfigItem(db, adminAuth, key, value) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!key) return json({ error: "missing_fields" });

  await db
    .prepare(
      `INSERT INTO game_config (key, value_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`
    )
    .bind(key, JSON.stringify(value), nowIso())
    .run();

  return json({ ok: true });
}

// ---------- admin: recipes + monster loot (admin.html) ----------
// Admin V2 uses the dedicated Admin session verifier. The legacy ADMIN_API_KEY path is
// retained only as a temporary rollback path during Phase 0 production verification.
// Reading recipes/monster_loot uses the generic authenticated getSheet action; writes
// use dedicated handlers because getSheet is read-only by design.
async function handleAdminUpsertRecipe(db, adminAuth, recipeId, type, name, setId, empowerSlotCount, materials) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!recipeId || !type || !name || !materials || typeof materials !== "object") return json({ error: "missing_fields" });
  // rarity is ALWAYS "azure" regardless of set — see the design notes in handleCraftItem:
  // this is a fixed "crafted tier" tag (== mythic), not literally the Azure set's name, so
  // RARITY_MULT/RARITY_STARS/SALVAGE_TABLE lookups never hit an unregistered rarity key for
  // a new set. Give the new set its own identity via `setId` instead.
  const resultDef = {
    type,
    rarity: "azure",
    name,
    setId: setId || "azure",
    empowerSlotCount: Number(empowerSlotCount) || 5,
  };
  await db
    .prepare(
      `INSERT INTO recipes (recipe_id, result_item_def, materials_json, source, created_at)
       VALUES (?, ?, ?, 'admin', ?)
       ON CONFLICT(recipe_id) DO UPDATE SET result_item_def = excluded.result_item_def, materials_json = excluded.materials_json`
    )
    .bind(recipeId, JSON.stringify(resultDef), JSON.stringify(materials), nowIso())
    .run();
  return json({ ok: true });
}

async function handleAdminDeleteRecipe(db, adminAuth, recipeId) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!recipeId) return json({ error: "missing_fields" });
  await db.prepare(`DELETE FROM recipes WHERE recipe_id = ?`).bind(recipeId).run();
  return json({ ok: true });
}

async function handleAdminUpsertMonsterLootEntry(db, adminAuth, entry) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  const { entryId, monsterId, kind, itemType, rarity, junkId, qtyMin, qtyMax, weight, dropChance } = entry || {};
  if (!monsterId || (kind !== "gear" && kind !== "junk")) return json({ error: "missing_fields" });
  if (kind === "gear" && !itemType) return json({ error: "missing_fields" });
  if (kind === "junk" && !junkId) return json({ error: "missing_fields" });
  const validRarities = ["rare", "unique", "elite", "mythic"];
  if (rarity && validRarities.indexOf(rarity) === -1) return json({ error: "invalid_rarity", allowed: validRarities });
  const id = entryId || crypto.randomUUID();
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO monster_loot (entry_id, monster_id, kind, item_type, rarity, junk_id, qty_min, qty_max, weight, drop_chance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entry_id) DO UPDATE SET
         monster_id = excluded.monster_id, kind = excluded.kind, item_type = excluded.item_type,
         rarity = excluded.rarity, junk_id = excluded.junk_id, qty_min = excluded.qty_min,
         qty_max = excluded.qty_max, weight = excluded.weight, drop_chance = excluded.drop_chance,
         updated_at = excluded.updated_at`
    )
    .bind(id, monsterId, kind, itemType || null, rarity || null, junkId || null, Number(qtyMin) || 1, Number(qtyMax) || 1, Number(weight) || 1, Number(dropChance) != null ? Number(dropChance) : 1, now, now)
    .run();
  return json({ ok: true, entryId: id });
}

async function handleAdminDeleteMonsterLootEntry(db, adminAuth, entryId) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!entryId) return json({ error: "missing_fields" });
  await db.prepare(`DELETE FROM monster_loot WHERE entry_id = ?`).bind(entryId).run();
  return json({ ok: true });
}

async function handleAdminUpsertJunkInfo(db, adminAuth, junkId, name, icon) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!junkId || !name) return json({ error: "missing_fields" });
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO junk_info (junk_id, name, icon, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(junk_id) DO UPDATE SET name = excluded.name, icon = excluded.icon, updated_at = excluded.updated_at`
    )
    .bind(junkId, name, icon || "📦", now, now)
    .run();
  return json({ ok: true });
}

async function handleAdminDeleteJunkInfo(db, adminAuth, junkId) {
  if (!adminAuth?.ok) return json({ error: adminAuth?.error || "admin_session_invalid" }, 401);
  if (!junkId) return json({ error: "missing_fields" });
  await db.prepare(`DELETE FROM junk_info WHERE junk_id = ?`).bind(junkId).run();
  return json({ ok: true });
}

// ---------- request boundary hardening ----------
const MAX_REQUEST_BODY_BYTES = 512 * 1024;
const DEFAULT_CORS_ORIGINS = Object.freeze([
  "https://thorniedungeons.ekqtjl.workers.dev",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

function corsOrigins(env) {
  const configured = String(env?.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_CORS_ORIGINS, ...configured]);
}

function requestOriginAllowed(request, env) {
  const origin = request.headers.get("Origin");
  return !origin || corsOrigins(env).has(origin);
}

function withCorsHeaders(response, request, env) {
  const headers = new Headers(response.headers);
  const origin = request.headers.get("Origin");
  headers.delete("Access-Control-Allow-Origin");
  if (origin && corsOrigins(env).has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function enforceRequestBodyLimit(request) {
  const declared = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BODY_BYTES) return false;
  if (!request.body) return true;
  const body = await request.clone().arrayBuffer();
  return body.byteLength <= MAX_REQUEST_BODY_BYTES;
}

// ---------- router ----------
async function apiFetch(request, env) {
    const db = env.DB;
    const url = new URL(request.url);

    if (!requestOriginAllowed(request, env)) {
      return json({ error: "cors_origin_not_allowed" }, 403);
    }
    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    if (request.method === "POST" && !(await enforceRequestBodyLimit(request))) {
      return json({ error: "request_body_too_large" }, 413);
    }

    try {
      if (request.method === "GET") {
        const p = url.searchParams;
        const action = p.get("action");
        if (action === "getGameConfig") return await handleGetGameConfig(db);
        if (action === "getRecipes") return await handleGetRecipes(db);
        if (action === "getMonsterLoot") return await handleGetMonsterLoot(db);
        if (action === "getJunkInfo") return await handleGetJunkInfo(db);
        if (action === "getLeaderboard") return await handleGetLeaderboard(db, p.get("board"));
        if (action === "getLeaderboardHistory") return await handleGetLeaderboardHistory(db, p.get("board"), p.get("date"));
        if (action === "adminValidateSession") {
          const adminAuth = await verifyAdminSession(db, bearerToken(request));
          if (adminAuth.error) return json({ error: adminAuth.error }, 401);
          return await handleAdminValidateSession(db, adminAuth);
        }
        if (["runLeaderboardSnapshot", "getPlayer", "getAllPlayers", "getPlayerItems", "getGameStats", "getSheet", "adminSearchPlayers"].includes(action)) {
          const adminAuth = await verifyAdminAccess(db, env, request, p.get("adminKey"));
          if (adminAuth.error) return json({ error: adminAuth.error }, 401);
          if (action === "runLeaderboardSnapshot") return json({ ok: true, ...(await runLeaderboardSnapshot(db)) });
          if (action === "getPlayer") return await handleAdminGetPlayer(db, adminAuth, p.get("id"));
          if (action === "adminSearchPlayers") return await handleAdminSearchPlayers(db, adminAuth, p.get("query"), p.get("limit"));
          if (action === "getAllPlayers") return await handleAdminGetAllPlayers(db, adminAuth);
          if (action === "getPlayerItems") return await handleAdminGetPlayerItems(db, adminAuth, p.get("id"));
          if (action === "getGameStats") return await handleAdminGetGameStats(db, adminAuth);
          if (action === "getSheet") return await handleAdminGetSheet(db, adminAuth, p.get("sheet"));
        }
        const auth = await verifySession(db, bearerToken(request));
        if (auth.error) return json({ error: auth.error }, 401);
        const id = auth.row.id;
        if (action === "validateSession") return await handleValidateSession(db, auth);
        if (action === "getRecoveryStatus") return await handleRecoveryStatus(db, auth);
        if (action === "getInventory") return await handleGetInventory(db, id, auth, p.get("characterId"), p.get("page"), p.get("pageSize"));
        if (action === "getDailyLogin") return await handleGetDailyLogin(db, id, auth, p.get("characterId"));
        if (action === "getRaidStatus") return await handleGetRaidStatus(db, id, auth, p.get("characterId"));
        if (action === "getMailbox") return await handleGetMailbox(db, id, auth, p.get("characterId"));
        if (action === "getArenaV2Status") return await handleGetArenaV2Status(db, id, auth, p.get("characterId"));
        if (action === "getArenaV2Opponents") return await handleGetArenaV2Opponents(db, id, auth, p.get("characterId"));
        if (action === "getArenaV2History") return await handleGetArenaV2History(db, id, auth, p.get("characterId"));
        if (action === "getArenaV2Ranking") return await handleGetArenaV2Ranking(db, id, auth, p.get("characterId"));
        if (action === "getArenaV2PlayerCard") return await handleGetArenaV2PlayerCard(db, id, auth, p.get("characterId"), p.get("opponentKey"));
        if (action === "getArenaV2Match") return await handleGetArenaV2Match(db, id, auth, p.get("characterId"), p.get("matchId"));
        if (action === "getBattleState") return await handleGetBattleState(db, id, auth, p.get("characterId"));
        if (action === "getDungeonEncounterPreview") return await handleGetDungeonEncounterPreview(db, id, auth, p.get("characterId"), p.get("floor"));
        // Friend System V1 (Phase 2) — read actions
        if (action === "searchCharacters") return await handleSearchCharacters(db, id, auth, p.get("characterId"), p.get("query"));
        if (action === "getPublicProfile") return await handleGetPublicProfile(db, id, auth, p.get("characterId"), p.get("targetCharacterId"));
        if (action === "getFriendList") return await handleGetFriendList(db, id, auth, p.get("characterId"));
        if (action === "getFriendRequests") return await handleGetFriendRequests(db, id, auth, p.get("characterId"));
        if (action === "getBlockedList") return await handleGetBlockedList(db, id, auth, p.get("characterId"));
        // Chat System V1 (Phase 3) — read actions
        if (action === "getGlobalChat") return await handleGetGlobalChat(db, id, auth, p.get("characterId"), p.get("afterId"));
        if (action === "getGuildChat") return await handleGetGuildChat(db, id, auth, p.get("characterId"), p.get("afterId"));
        if (action === "getGuildChatStatus") return await handleGetGuildChatStatus(db, id, auth, p.get("characterId"));
        if (action === "getDirectMessages") return await handleGetDirectMessages(db, id, auth, p.get("characterId"), p.get("withCharacterId"), p.get("afterId"));
        if (action === "getDirectConversations") return await handleGetDirectConversations(db, id, auth, p.get("characterId"));
        if (action === "runChatRetentionCleanup") {
          const adminAuth = await verifyAdminAccess(db, env, request, p.get("adminKey"));
          if (adminAuth.error) return json({ error: adminAuth.error }, 401);
          return json({ ok: true, ...(await runChatRetentionCleanup(db)) });
        }
        // Guild System V1 Core (Phase 4) — read actions
        if (action === "searchGuilds") return await handleSearchGuilds(db, id, auth, p.get("characterId"), p.get("query"));
        if (action === "getMyGuild") return await handleGetMyGuild(db, id, auth, p.get("characterId"));
        if (action === "getGuildProfile") return await handleGetGuildProfile(db, id, auth, p.get("characterId"), p.get("guildId"));
        if (action === "getPublicGuildProfile") return await handleGetPublicGuildProfile(db, id, auth, p.get("characterId"), p.get("guildId"));
        if (action === "getMyApplications") return await handleGetMyApplications(db, id, auth, p.get("characterId"));
        if (action === "getGuildApplications") return await handleGetGuildApplications(db, id, auth, p.get("characterId"), p.get("guildId"));
        if (action === "getGuildDonationHistory") return await handleGetGuildDonationHistory(db, id, auth, p.get("characterId"), p.get("limit"));
        return json({ error: "unknown_action" });
      }

      if (request.method === "POST") {
        const body = await request.json();
        const ip = requestIp(request);
        if (body.action === "login") return await handleLogin(db, body.id, body.password, !!body.rememberLogin, ip);
        if (body.action === "register") return await handleRegister(db, body.id, body.password, body.confirmPassword, !!body.rememberLogin, ip);
        if (body.action === "forgotPassword") return await handleForgotPassword(db, body.id, body.recoveryCode, body.newPassword, body.confirmPassword, ip);
        if (body.action === "adminLogin") return await handleAdminLogin(db, body.id, body.password, ip);
        if (body.action === "adminLogout") {
          const adminAuth = await verifyAdminSession(db, bearerToken(request));
          if (adminAuth.error) return json({ error: adminAuth.error }, 401);
          return await handleAdminLogout(db, adminAuth);
        }
        if (["saveGameConfig", "setGameConfigItem", "adminUpsertRecipe", "adminDeleteRecipe", "adminUpsertMonsterLootEntry", "adminDeleteMonsterLootEntry", "adminUpsertJunkInfo", "adminDeleteJunkInfo"].includes(body.action)) {
          const adminAuth = await verifyAdminAccess(db, env, request, body.adminKey);
          if (adminAuth.error) return json({ error: adminAuth.error }, 401);
          switch (body.action) {
            case "saveGameConfig": return await handleAdminSaveGameConfig(db, adminAuth, body.config);
            case "setGameConfigItem": return await handleAdminSetGameConfigItem(db, adminAuth, body.key, body.value);
            case "adminUpsertRecipe": return await handleAdminUpsertRecipe(db, adminAuth, body.recipeId, body.type, body.name, body.setId, body.empowerSlotCount, body.materials);
            case "adminDeleteRecipe": return await handleAdminDeleteRecipe(db, adminAuth, body.recipeId);
            case "adminUpsertMonsterLootEntry": return await handleAdminUpsertMonsterLootEntry(db, adminAuth, body.entry);
            case "adminDeleteMonsterLootEntry": return await handleAdminDeleteMonsterLootEntry(db, adminAuth, body.entryId);
            case "adminUpsertJunkInfo": return await handleAdminUpsertJunkInfo(db, adminAuth, body.junkId, body.name, body.icon);
            case "adminDeleteJunkInfo": return await handleAdminDeleteJunkInfo(db, adminAuth, body.junkId);
          }
        }
        const token = bearerToken(request);
        const characterAuthActions = new Set(["purchaseCharacterResource", "sellCharacterItem", "completeBattle", "craftItem", "mutateV2Blacksmith", "mutateLegacyBlacksmith", "claimMail", "claimAllMail"]);
        let auth;
        let characterAuth = null;
        if (characterAuthActions.has(body.action) && body.characterId) {
          characterAuth = await authenticateCharacter(db, token, body.characterId);
          if (characterAuth.error) {
            const sessionErrors = new Set(["invalid_session", "session_expired", "session_revoked", "session_replaced"]);
            const status = sessionErrors.has(characterAuth.error) ? 401 : 403;
            return json({ error: characterAuth.error }, status);
          }
          auth = characterAuth.auth;
          auth.__characterAuth = characterAuth;
        } else {
          auth = await verifySession(db, token);
          if (auth.error) return json({ error: auth.error }, 401);
        }
        const id = auth.row.id;
        switch (body.action) {
          case "logout":
            return await handleLogout(db, auth);
          case "createRecoveryCode":
            return await handleCreateRecoveryCode(db, auth, body.currentPassword);
          case "changePassword":
            return await handleChangePassword(db, auth, body.currentPassword, body.newPassword, body.confirmPassword);
          case "createCharacter":
            return await handleCreateCharacter(db, id, auth, body.slotIndex, body.name);
          case "deleteCharacter":
            return await handleDeleteCharacter(db, id, auth, body.slotIndex);
          case "enterCharacter":
            return await handleEnterCharacter(db, id, auth, body.slotIndex);
          case "saveCharacterProgress":
            return await handleSaveCharacterProgress(db, id, auth, body.characterId, body.diamonds, body.progress);
          case "allocateStats":
            return await handleAllocateStats(db, id, auth, body.characterId, body.allocations, body.requestId);
          case "allocateHeroSkills":
            return await handleAllocateHeroSkills(db, id, auth, body.characterId, body.allocations, body.requestId);
          case "resetCharacterStats":
            return await handleResetCharacterStats(db, id, auth, body.characterId, body.requestId);
          case "resetHeroSkills":
            return await handleResetHeroSkills(db, id, auth, body.characterId, body.requestId);
          case "petEconomyAction":
            return await handlePetEconomyAction(db, id, auth, body.characterId, body.petAction, body.petInstId, body.requestId);
          case "consumePotion":
            return await handleConsumePotion(db, id, auth, body.characterId, body.potionId, body.requestId);
          case "purchaseCharacterResource":
            return await handlePurchaseCharacterResource(db, id, auth, body.characterId, body.resource, body.quantity, body.requestId);
          case "getCharacterShopStock":
            return await handleGetCharacterShopStock(db, id, auth, body.characterId, body.requestId);
          case "purchaseShopEquipment":
            return await handlePurchaseShopEquipment(db, id, auth, body.characterId, body.offerId, body.requestId);
          case "sellCharacterItem":
            return await handleSellCharacterItem(db, id, auth, body.characterId, body.itemId, body.quantity, body.requestId);
          case "salvageItem":
            return await handleSalvageItem(db, id, auth, body.characterId, body.itemId, body.requestId);
          case "saveRunState":
            return await handleSaveRunState(db, id, auth, body.characterId, body.runState);
          case "startDungeonBattle":
            return await handleStartDungeonBattle(db, id, auth, body.characterId, body.floor, body.previewContext || null);
          case "saveBattleCheckpoint":
            return await handleSaveBattleCheckpoint(db, id, auth, body.characterId, body.battleId, body.checkpointSeq, body.payload);
          case "clearBattleCheckpoint":
            return await handleClearBattleCheckpoint(db, id, auth, body.characterId, body.battleId);
          case "completeBattle":
            return await handleCompleteBattle(db, id, auth, body.characterId, body.battleId, body.result);
          case "saveQuickSlots":
            return await handleSaveQuickSlots(db, id, auth, body.characterId, body.quickSlots);
          case "syncItems":
            return await handleSyncItems(db, id, auth, body.characterId, body.items || []);
          case "mutateV2Blacksmith":
            return await handleMutateV2Blacksmith(db, id, auth, body.characterId, body.itemId, body.mutation, body.requestId);
          case "mutateLegacyBlacksmith":
            return await handleMutateLegacyBlacksmith(db, id, auth, body.characterId, body.itemId, body.mutation, body.requestId);
          case "setInventorySlot":
            return await handleSetInventorySlot(db, id, auth, body.characterId, body.itemId, body.inventorySlot);
          case "claimDailyLogin":
            return await handleClaimDailyLogin(db, id, auth, body.characterId);
          case "attackRaidBoss":
            return await handleAttackRaidBoss(db, id, auth, body.characterId, !!body.paidDiamonds, body.requestId);
          case "claimRaidMilestones":
            return await handleClaimRaidMilestones(db, id, auth, body.characterId);
          case "saveArenaV2Setup":
            return await handleSaveArenaV2Setup(db, id, auth, body.characterId, body.petInstId, body.skillSlots);
          case "purchaseArenaV2Ticket":
            return await handlePurchaseArenaV2Ticket(db, id, auth, body.characterId, body.requestId);
          case "refreshArenaV2Opponents":
            return await handleRefreshArenaV2Opponents(db, id, auth, body.characterId);
          case "acknowledgeArenaV2Unlock":
            return await handleAcknowledgeArenaV2Unlock(db, id, auth, body.characterId);
          case "prepareArenaV2Match":
            return await handlePrepareArenaV2Match(db, id, auth, body.characterId, body.opponentKey, body.source);
          case "activateArenaV2Match":
            return await handleActivateArenaV2Match(db, id, auth, body.characterId, body.matchId);
          case "setArenaV2Auto":
            return await handleSetArenaV2Auto(db, id, auth, body.characterId, body.matchId, body.enabled);
          case "submitArenaV2Action":
            return await handleSubmitArenaV2Action(db, id, auth, body.characterId, body.matchId, body.actionKey || body.requestId, body.actionType, body.skillId || body.skillKey, body.targetId, body.auto);
          case "claimMail":
            return await handleClaimMail(db, id, auth, body.characterId, body.mailId);
          case "claimAllMail":
            return await handleClaimAllMail(db, id, auth, body.characterId, body.requestId);
          case "deleteMail":
            return await handleDeleteMail(db, id, auth, body.characterId, body.mailId);
          case "deleteMails":
            return await handleDeleteMails(db, id, auth, body.characterId, body.mailIds);
          case "deleteAllClaimedMail":
            return await handleDeleteAllClaimedMail(db, id, auth, body.characterId);
          case "craftItem":
            return await handleCraftItem(db, id, auth, body.characterId, body.recipeId, body.requestId);
          // Friend System V1 (Phase 2) — write actions
          case "sendFriendRequest":
            return await handleSendFriendRequest(db, id, auth, body.characterId, body.targetCharacterId);
          case "acceptFriendRequest":
            return await handleAcceptFriendRequest(db, id, auth, body.characterId, body.requestId);
          case "rejectFriendRequest":
            return await handleRejectFriendRequest(db, id, auth, body.characterId, body.requestId);
          case "cancelFriendRequest":
            return await handleCancelFriendRequest(db, id, auth, body.characterId, body.requestId);
          case "removeFriend":
            return await handleRemoveFriend(db, id, auth, body.characterId, body.targetCharacterId);
          case "blockCharacter":
            return await handleBlockCharacter(db, id, auth, body.characterId, body.targetCharacterId);
          case "unblockCharacter":
            return await handleUnblockCharacter(db, id, auth, body.characterId, body.targetCharacterId);
          // Chat System V1 (Phase 3) — write actions
          case "sendGlobalMessage":
            return await handleSendGlobalMessage(db, id, auth, body.characterId, body.text, body.nonce);
          case "sendGuildMessage":
            return await handleSendGuildMessage(db, id, auth, body.characterId, body.text, body.nonce);
          case "markGuildChatRead":
            return await handleMarkGuildChatRead(db, id, auth, body.characterId);
          case "sendDirectMessage":
            return await handleSendDirectMessage(db, id, auth, body.characterId, body.toCharacterId, body.text, body.nonce);
          case "markConversationRead":
            return await handleMarkConversationRead(db, id, auth, body.characterId, body.withCharacterId);
          // Guild System V1 Core (Phase 4) — write actions
          case "createGuild":
            return await handleCreateGuild(db, id, auth, body.characterId, body.name, body.description);
          case "requestGuildJoin":
            return await handleRequestGuildJoin(db, id, auth, body.characterId, body.guildId);
          case "cancelGuildApplication":
            return await handleCancelGuildApplication(db, id, auth, body.characterId, body.applicationId);
          case "acceptGuildApplication":
            return await handleAcceptGuildApplication(db, id, auth, body.characterId, body.applicationId);
          case "rejectGuildApplication":
            return await handleRejectGuildApplication(db, id, auth, body.characterId, body.applicationId);
          case "leaveGuild":
            return await handleLeaveGuild(db, id, auth, body.characterId);
          case "kickGuildMember":
            return await handleKickGuildMember(db, id, auth, body.characterId, body.targetCharacterId);
          case "transferGuildLeadership":
            return await handleTransferGuildLeadership(db, id, auth, body.characterId, body.targetCharacterId);
          case "disbandGuild":
            return await handleDisbandGuild(db, id, auth, body.characterId);
          case "updateGuildSettings":
            return await handleUpdateGuildSettings(db, id, auth, body.characterId, body.description, body.joinPolicy);
          case "donateGuildItem":
            return await handleDonateGuildItem(db, id, auth, body.characterId, body.junkId, body.quantity, body.donationId);
          default:
            return json({ error: "unknown_action" });
        }
      }

      return json({ error: "method_not_allowed" }, 405);
    } catch (err) {
      // Keep SQL/stack details in Worker logs only.  Clients receive one stable
      // code so internal schema and implementation details cannot be fingerprinted.
      console.error("[api-error]", JSON.stringify({
        method: request.method,
        path: url.pathname,
        action: request.method === "GET" ? url.searchParams.get("action") : "post",
        error: String((err && err.message) || err).slice(0, 500)
      }));
      if (err instanceof SyntaxError || String(err?.name || "") === "SyntaxError") return json({ error: "invalid_json" }, 400);
      return json({ error: "server_error" }, 500);
    }
}

export default {
  async fetch(request, env) {
    return withCorsHeaders(await apiFetch(request, env), request, env);
  },
  // Cron Trigger entry point (set up in Cloudflare Dashboard -> this worker -> Trigger
  // Events, since there's no wrangler.toml here to declare it in). Not testable locally
  // via bash (api.cloudflare.com isn't allowlisted) — use the runLeaderboardSnapshot
  // admin GET action above to trigger it manually for testing/backfill.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runLeaderboardSnapshot(env.DB));
    ctx.waitUntil(ensureArenaV2Season(env.DB, Date.now()));
    ctx.waitUntil(closeOutExpiredRaids(env.DB));
    ctx.waitUntil(runChatRetentionCleanup(env.DB));
  },
};