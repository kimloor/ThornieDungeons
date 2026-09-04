/**
 * THORNIE DUNGEONS — Cloud Save Backend (Cloudflare Worker + D1) — schema v2 + daily login
 * ---------------------------------------------------------------
 * This file mirrors the LIVE worker (fetched via Cloudflare MCP on 2026-09-04) with the
 * daily-login endpoints added on top (marked "NEW" below). Everything else is unchanged
 * from the deployed version.
 *
 * NOT YET DEPLOYED — Claude has read access to Workers via the Cloudflare MCP connector
 * (workers_get_worker_code) but no write/deploy tool, and api.cloudflare.com isn't in
 * Claude's bash network allowlist either. Deploy this manually:
 *   wrangler deploy workers/thornie-dungeons-api.js --name thornie-dungeons-api
 * or paste it into the Cloudflare Dashboard editor for the `thornie-dungeons-api` worker,
 * same as migration_v2.sql was applied by hand.
 *
 * v2 change (see migration_v2.sql — RUN THAT FIRST): each account can now have up to
 * MAX_CHARACTER_SLOTS independent characters, each with its own row in `characters`
 * instead of being squeezed into a single `progress` row. Items and run-state
 * checkpoints are now scoped by `character_id` as well as `player_id`, so saving one
 * character's inventory can never touch another character's gear — the old worker
 * deleted any item row for the *player* that wasn't in the sync payload, which is
 * fine for one character but silently unsafe the moment there's more than one.
 *
 * The v1 `progress` table is left in place untouched (harmless, no longer written
 * to) purely as a historical backfill source for the one-time migration.
 *
 * Endpoints:
 *   GET  ?action=login&id=&password=
 *   GET  ?action=getGameConfig
 *   GET  ?action=getInventory&id=&password=&characterId=&page=&pageSize=
 *   GET  ?action=getDailyLogin&id=&password=&characterId=                (NEW)
 *   GET  ?action=getPlayer&adminKey=&id=            (admin)
 *   GET  ?action=getAllPlayers&adminKey=            (admin)
 *   GET  ?action=getPlayerItems&adminKey=&id=        (admin)
 *   GET  ?action=getGameStats&adminKey=              (admin)
 *   GET  ?action=getSheet&adminKey=&sheet=           (admin — "sheet" name kept from before, means "table")
 *   POST { action: "register", id, password }
 *   POST { action: "createCharacter", id, password, slotIndex, name }
 *   POST { action: "deleteCharacter", id, password, slotIndex }
 *   POST { action: "enterCharacter", id, password, slotIndex }
 *   POST { action: "saveCharacterProgress", id, password, characterId, diamonds, progress }
 *   POST { action: "saveRunState", id, password, characterId, runState }
 *   POST { action: "syncItems", id, password, characterId, items }
 *   POST { action: "setInventorySlot", id, password, itemId, inventorySlot }
 *   POST { action: "claimDailyLogin", id, password, characterId }        (NEW)
 *   POST { action: "saveGameConfig", adminKey, config }
 *   POST { action: "setGameConfigItem", adminKey, key, value }
 * ---------------------------------------------------------------
 */

const MAX_CHARACTER_SLOTS = 3;

const TABLES = {
  players: { name: "players", cols: ["id", "password", "diamonds", "active_slot", "created_at"] },
  // v1 leftover — never written to by v2 code, kept readable only so migratePlayerIfNeeded()
  // and the admin "getSheet" endpoint can still look at it for historical/debug purposes.
  progress: {
    name: "progress",
    cols: ["player_id", "bank_gold", "diamonds", "best_floor", "potions", "char_level", "char_xp", "char_points", "char_str", "char_vit", "char_dex", "char_luk", "pets_json", "active_pet_id", "updated_at"],
  },
  characters: {
    name: "characters",
    cols: [
      "character_id", "player_id", "slot_index", "name",
      "level", "xp", "stat_points", "str", "vit", "agi", "dex", "luk",
      "gold", "unlocked_floor", "potions", "protection_stones", "chest_pity",
      "pets_json", "active_pet_id", "updated_at",
    ],
  },
  run_state: {
    name: "run_state",
    cols: ["character_id", "floor", "level", "xp", "hp", "mp", "base_atk", "base_def", "base_max_hp", "base_max_mp", "run_gold", "potions", "updated_at"],
  },
  items: {
    name: "items",
    cols: ["item_id", "player_id", "character_id", "slot_type", "equipped", "inventory_slot", "item_template_id", "rarity", "name", "item_level", "enhance_level", "bound", "quantity", "atk", "def", "hp", "mp", "extra_json", "created_at", "updated_at"],
  },
  game_config: { name: "game_config", cols: ["key", "value_json", "updated_at"] },
  // NEW — daily login (migration_v3.sql)
  daily_login_claims: {
    name: "daily_login_claims",
    cols: ["character_id", "login_streak", "last_claim_date", "total_claims", "updated_at"],
  },
};

// NEW — server-owned reward cycle (source of truth; client only displays what this returns,
// never computes its own reward, so a tampered client can't grant itself diamonds).
const DAILY_LOGIN_REWARDS = [
  { day: 1, gold: 50, diamonds: 0 },
  { day: 2, gold: 80, diamonds: 0 },
  { day: 3, gold: 0, diamonds: 20 },
  { day: 4, gold: 150, diamonds: 0 },
  { day: 5, gold: 0, diamonds: 30 },
  { day: 6, gold: 250, diamonds: 0 },
  { day: 7, gold: 0, diamonds: 120 }, // bonus day, cycle repeats after this
];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
  });
}

function nowIso() {
  return new Date().toISOString();
}

// NEW — UTC day-boundary date keys, used only by the daily login handlers below.
function todayDateKey() {
  return nowIso().slice(0, 10);
}
function yesterdayDateKey() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
function dailyLoginReward(streak) {
  return DAILY_LOGIN_REWARDS[(streak - 1) % DAILY_LOGIN_REWARDS.length];
}

function newCharacterId() {
  return `char-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------- generic D1 helpers ----------
async function getRow(db, table, whereCol, whereVal) {
  const t = TABLES[table];
  const stmt = db.prepare(`SELECT * FROM ${t.name} WHERE ${whereCol} = ? LIMIT 1`).bind(whereVal);
  const row = await stmt.first();
  return row || null;
}

async function getRows(db, table, whereCol, whereVal) {
  const t = TABLES[table];
  const stmt = db.prepare(`SELECT * FROM ${t.name} WHERE ${whereCol} = ?`).bind(whereVal);
  const res = await stmt.all();
  return res.results || [];
}

async function upsertRow(db, table, keyCol, obj) {
  const t = TABLES[table];
  const cols = t.cols;
  const placeholders = cols.map(() => "?").join(",");
  const updates = cols.filter((c) => c !== keyCol).map((c) => `${c}=excluded.${c}`).join(",");
  const values = cols.map((c) => (obj[c] === undefined ? null : obj[c]));
  const sql = `INSERT INTO ${t.name} (${cols.join(",")}) VALUES (${placeholders})
    ON CONFLICT(${keyCol}) DO UPDATE SET ${updates}`;
  await db.prepare(sql).bind(...values).run();
}

// ---------- auth ----------
async function verifyPlayer(db, id, password) {
  if (!id || !password) return { error: "missing_fields" };
  const row = await getRow(db, "players", "id", id);
  if (!row) return { error: "not_found" };
  if (String(row.password) !== String(password)) return { error: "wrong_password" };
  return { ok: true, row };
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

function verifyAdminKey(env, adminKey) {
  const configured = env.ADMIN_API_KEY;
  if (!configured) return { error: "admin_key_not_configured" };
  if (!adminKey || String(adminKey) !== String(configured)) return { error: "forbidden" };
  return { ok: true };
}

// ---------- game config ----------
async function handleGetGameConfig(db) {
  const res = await db.prepare(`SELECT key, value_json FROM game_config`).all();
  const cfg = {};
  for (const r of res.results || []) {
    try { cfg[r.key] = JSON.parse(r.value_json || "null"); } catch (e) {}
  }
  return json(cfg);
}

// ---------- player / auth handlers ----------
async function handleRegister(db, id, password) {
  if (!id || !password) return json({ error: "missing_fields" });
  const existing = await getRow(db, "players", "id", id);
  if (existing) return json({ error: "id_taken" });

  const now = nowIso();
  await db
    .prepare(`INSERT INTO players (id, password, diamonds, active_slot, created_at) VALUES (?, ?, 0, NULL, ?)`)
    .bind(id, password, now)
    .run();

  return json({ ok: true });
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
  await db.prepare(`UPDATE run_state SET character_id = ? WHERE character_id IS NULL AND EXISTS (SELECT 1 FROM players WHERE players.id = ?)`).bind(characterId, id).run();
}

async function handleLogin(db, id, password) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });

  await migratePlayerIfNeeded(db, id);

  const player = await getRow(db, "players", "id", id);
  const characters = await getRows(db, "characters", "player_id", id);
  characters.sort((a, b) => a.slot_index - b.slot_index);

  // Items/run-state are intentionally NOT returned here — they belong to a specific
  // character, and which one hasn't been chosen yet. See "enterCharacter".
  return json({
    ok: true,
    player: { diamonds: Number(player.diamonds) || 0, activeSlot: player.active_slot === null || player.active_slot === undefined ? null : Number(player.active_slot) },
    characters,
  });
}

// ---------- character slot handlers ----------
async function handleCreateCharacter(db, id, password, slotIndex, name) {
  const auth = await verifyPlayer(db, id, password);
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

async function handleDeleteCharacter(db, id, password, slotIndex) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CHARACTER_SLOTS) return json({ error: "invalid_slot" });

  const row = await db.prepare(`SELECT * FROM characters WHERE player_id = ? AND slot_index = ?`).bind(id, slot).first();
  if (!row) return json({ error: "character_not_found" });

  await db.batch([
    db.prepare(`DELETE FROM items WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM run_state WHERE character_id = ?`).bind(row.character_id),
    // NEW — clean up daily login state along with the rest of the character's data
    db.prepare(`DELETE FROM daily_login_claims WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM characters WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`UPDATE players SET active_slot = NULL WHERE id = ? AND active_slot = ?`).bind(id, slot),
  ]);

  return json({ ok: true });
}

async function handleEnterCharacter(db, id, password, slotIndex) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const slot = Number(slotIndex);
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_CHARACTER_SLOTS) return json({ error: "invalid_slot" });

  const character = await db.prepare(`SELECT * FROM characters WHERE player_id = ? AND slot_index = ?`).bind(id, slot).first();
  if (!character) return json({ error: "character_not_found" });

  await db.prepare(`UPDATE players SET active_slot = ? WHERE id = ?`).bind(slot, id).run();

  const items = await getRows(db, "items", "character_id", character.character_id);
  const runState = await getRow(db, "run_state", "character_id", character.character_id);

  return json({ ok: true, character, items, runState: runState || null });
}

// ---------- per-character progress / items / run-state ----------
async function handleSaveCharacterProgress(db, id, password, characterId, diamonds, progress) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!progress) return json({ error: "missing_fields" });

  const editableCols = TABLES.characters.cols.filter((c) => c !== "character_id" && c !== "player_id" && c !== "slot_index" && c !== "name");
  const sets = editableCols.map((c) => `${c} = ?`).join(",");
  const values = editableCols.map((c) => (c === "updated_at" ? nowIso() : progress[c] === undefined ? null : progress[c]));
  await db.prepare(`UPDATE characters SET ${sets} WHERE character_id = ?`).bind(...values, characterId).run();

  if (diamonds !== undefined) {
    await db.prepare(`UPDATE players SET diamonds = ? WHERE id = ?`).bind(Number(diamonds) || 0, id).run();
  }

  return json({ ok: true });
}

async function handleSaveRunState(db, id, password, characterId, runState) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  if (!runState) {
    await db.prepare(`DELETE FROM run_state WHERE character_id = ?`).bind(characterId).run();
    return json({ ok: true });
  }

  const obj = { character_id: characterId, ...runState, updated_at: nowIso() };
  await upsertRow(db, "run_state", "character_id", obj);
  return json({ ok: true });
}

async function handleSyncItems(db, id, password, characterId, items) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!Array.isArray(items)) return json({ error: "invalid_items" });
  if (items.length > 5000) return json({ error: "inventory_too_large", max: 5000 });

  const now = nowIso();
  const keepIds = [];
  const stmts = [];

  items.forEach((it, index) => {
    const itemId = String(it.itemId || `item-${characterId}-${Date.now()}-${index}`);
    keepIds.push(itemId);
    const obj = {
      item_id: itemId,
      player_id: id,
      character_id: characterId, // always the authenticated/owned character — never trust a client-supplied value here
      slot_type: it.slotType || "",
      equipped: it.equipped ? 1 : 0,
      inventory_slot: it.inventorySlot === undefined ? "" : it.inventorySlot,
      item_template_id: it.itemTemplateId || "",
      rarity: it.rarity || "",
      name: it.name || "",
      item_level: Number(it.itemLevel) || 0,
      enhance_level: Number(it.enhanceLevel) || 0,
      bound: it.bound ? 1 : 0,
      quantity: Math.max(1, Number(it.quantity) || 1),
      atk: Number(it.atk) || 0,
      def: Number(it.def) || 0,
      hp: Number(it.hp) || 0,
      mp: Number(it.mp) || 0,
      extra_json: it.extraJson ? String(it.extraJson) : it.extra ? JSON.stringify(it.extra) : "",
      created_at: now,
      updated_at: now,
    };
    const cols = TABLES.items.cols;
    const placeholders = cols.map(() => "?").join(",");
    const updates = cols.filter((c) => c !== "item_id" && c !== "created_at").map((c) => `${c}=excluded.${c}`).join(",");
    const values = cols.map((c) => obj[c]);
    stmts.push(
      db
        .prepare(`INSERT INTO items (${cols.join(",")}) VALUES (${placeholders}) ON CONFLICT(item_id) DO UPDATE SET ${updates}`)
        .bind(...values)
    );
  });

  // Delete stale rows for THIS CHARACTER ONLY that aren't in the new payload — scoped
  // by character_id (not just player_id), so syncing one character's inventory can
  // never delete a different character's items on the same account.
  const placeholders = keepIds.map(() => "?").join(",") || "''";
  const deleteSql = keepIds.length
    ? `DELETE FROM items WHERE character_id = ? AND item_id NOT IN (${placeholders})`
    : `DELETE FROM items WHERE character_id = ?`;
  const deleteStmt = keepIds.length ? db.prepare(deleteSql).bind(characterId, ...keepIds) : db.prepare(deleteSql).bind(characterId);

  const beforeIds = await db.prepare(`SELECT item_id FROM items WHERE character_id = ?`).bind(characterId).all();
  const beforeSet = new Set((beforeIds.results || []).map((r) => r.item_id));
  const keepSet = new Set(keepIds);
  let removed = 0;
  beforeSet.forEach((iid) => { if (!keepSet.has(iid)) removed++; });
  let added = 0;
  keepSet.forEach((iid) => { if (!beforeSet.has(iid)) added++; });

  await db.batch([...stmts, deleteStmt]);

  return json({ ok: true, count: items.length, added, removed });
}

async function handleGetInventory(db, id, password, characterId, page, pageSize) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });

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

async function handleSetInventorySlot(db, id, password, itemId, inventorySlot) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  if (!itemId) return json({ error: "missing_fields" });

  const row = await db.prepare(`SELECT * FROM items WHERE player_id = ? AND item_id = ?`).bind(id, itemId).first();
  if (!row) return json({ error: "item_not_found" });

  const slot = inventorySlot === undefined ? "" : inventorySlot;
  await db
    .prepare(`UPDATE items SET inventory_slot = ?, updated_at = ? WHERE player_id = ? AND item_id = ?`)
    .bind(slot, nowIso(), id, itemId)
    .run();

  return json({ ok: true, itemId: String(itemId), inventorySlot: slot });
}

// ---------- NEW: daily login ----------
async function handleGetDailyLogin(db, id, password, characterId) {
  const auth = await verifyPlayer(db, id, password);
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

async function handleClaimDailyLogin(db, id, password, characterId) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const row = await getRow(db, "daily_login_claims", "character_id", characterId);
  const today = todayDateKey();
  const lastClaimDate = row ? row.last_claim_date || "" : "";
  if (lastClaimDate === today) return json({ error: "already_claimed" });

  const prevStreak = row ? Number(row.login_streak) || 0 : 0;
  const streak = lastClaimDate === yesterdayDateKey() ? prevStreak + 1 : 1;
  const reward = dailyLoginReward(streak);
  const totalClaims = (row ? Number(row.total_claims) || 0 : 0) + 1;
  const now = nowIso();

  await upsertRow(db, "daily_login_claims", "character_id", {
    character_id: characterId,
    login_streak: streak,
    last_claim_date: today,
    total_claims: totalClaims,
    updated_at: now,
  });

  if (reward.gold) {
    await db.prepare(`UPDATE characters SET gold = gold + ?, updated_at = ? WHERE character_id = ?`).bind(reward.gold, now, characterId).run();
  }
  if (reward.diamonds) {
    await db.prepare(`UPDATE players SET diamonds = diamonds + ? WHERE id = ?`).bind(reward.diamonds, id).run();
  }

  return json({
    ok: true,
    reward,
    streak,
    state: { loginStreak: streak, lastClaimDate: today, totalClaims },
  });
}

// ---------- admin / QA ----------
async function handleAdminGetPlayer(db, env, adminKey, id) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  if (!id) return json({ error: "missing_fields" });

  const player = await getRow(db, "players", "id", id);
  if (!player) return json({ error: "not_found" });
  const characters = await getRows(db, "characters", "player_id", id);
  const items = await getRows(db, "items", "player_id", id);

  return json({ ok: true, player, characters, items });
}

async function handleAdminGetAllPlayers(db, env, adminKey) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);

  const players = await db.prepare(`SELECT * FROM players`).all();
  const characters = await db.prepare(`SELECT * FROM characters`).all();
  return json({ ok: true, players: players.results || [], characters: characters.results || [] });
}

async function handleAdminGetPlayerItems(db, env, adminKey, id) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  if (!id) return json({ error: "missing_fields" });

  const items = await getRows(db, "items", "player_id", id);
  return json({ ok: true, items });
}

async function handleAdminGetGameStats(db, env, adminKey) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);

  const playerCount = await db.prepare(`SELECT COUNT(*) as c FROM players`).first();
  const characterCount = await db.prepare(`SELECT COUNT(*) as c FROM characters`).first();
  const itemCount = await db.prepare(`SELECT COUNT(*) as c FROM items`).first();
  const runCount = await db.prepare(`SELECT COUNT(*) as c FROM run_state`).first();
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

async function handleAdminGetSheet(db, env, adminKey, tableName) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  const allowed = Object.keys(TABLES);
  if (!tableName || allowed.indexOf(tableName) === -1) return json({ error: "invalid_sheet", allowed });

  const table = TABLES[tableName] ? TABLES[tableName].name : tableName;
  const res = await db.prepare(`SELECT * FROM ${table}`).all();
  return json({ ok: true, sheet: tableName, rows: res.results || [] });
}

async function handleAdminSaveGameConfig(db, env, adminKey, config) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
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

async function handleAdminSetGameConfigItem(db, env, adminKey, key, value) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
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

// ---------- router ----------
export default {
  async fetch(request, env) {
    const db = env.DB;
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    try {
      if (request.method === "GET") {
        const p = url.searchParams;
        const action = p.get("action");
        if (action === "login") return await handleLogin(db, p.get("id"), p.get("password"));
        if (action === "getGameConfig") return await handleGetGameConfig(db);
        if (action === "getInventory") return await handleGetInventory(db, p.get("id"), p.get("password"), p.get("characterId"), p.get("page"), p.get("pageSize"));
        if (action === "getDailyLogin") return await handleGetDailyLogin(db, p.get("id"), p.get("password"), p.get("characterId"));
        if (action === "getPlayer") return await handleAdminGetPlayer(db, env, p.get("adminKey"), p.get("id"));
        if (action === "getAllPlayers") return await handleAdminGetAllPlayers(db, env, p.get("adminKey"));
        if (action === "getPlayerItems") return await handleAdminGetPlayerItems(db, env, p.get("adminKey"), p.get("id"));
        if (action === "getGameStats") return await handleAdminGetGameStats(db, env, p.get("adminKey"));
        if (action === "getSheet") return await handleAdminGetSheet(db, env, p.get("adminKey"), p.get("sheet"));
        return json({ error: "unknown_action" });
      }

      if (request.method === "POST") {
        const body = await request.json();
        switch (body.action) {
          case "register":
            return await handleRegister(db, body.id, body.password);
          case "createCharacter":
            return await handleCreateCharacter(db, body.id, body.password, body.slotIndex, body.name);
          case "deleteCharacter":
            return await handleDeleteCharacter(db, body.id, body.password, body.slotIndex);
          case "enterCharacter":
            return await handleEnterCharacter(db, body.id, body.password, body.slotIndex);
          case "saveCharacterProgress":
            return await handleSaveCharacterProgress(db, body.id, body.password, body.characterId, body.diamonds, body.progress);
          case "saveRunState":
            return await handleSaveRunState(db, body.id, body.password, body.characterId, body.runState);
          case "syncItems":
            return await handleSyncItems(db, body.id, body.password, body.characterId, body.items || []);
          case "setInventorySlot":
            return await handleSetInventorySlot(db, body.id, body.password, body.itemId, body.inventorySlot);
          case "claimDailyLogin":
            return await handleClaimDailyLogin(db, body.id, body.password, body.characterId);
          case "saveGameConfig":
            return await handleAdminSaveGameConfig(db, env, body.adminKey, body.config);
          case "setGameConfigItem":
            return await handleAdminSetGameConfigItem(db, env, body.adminKey, body.key, body.value);
          default:
            return json({ error: "unknown_action" });
        }
      }

      return json({ error: "method_not_allowed" }, 405);
    } catch (err) {
      return json({ error: "server_error", message: String((err && err.message) || err) }, 500);
    }
  },
};
