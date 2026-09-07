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
 *   GET  ?action=getRecipes                                                (NEW, Phase 4 refactor)
 *   GET  ?action=getInventory&id=&password=&characterId=&page=&pageSize=
 *   GET  ?action=getDailyLogin&id=&password=&characterId=                (NEW)
 *   GET  ?action=getLeaderboard&board=floor|cp|pet_cp|raid                (NEW, Phase 2/3)
 *   GET  ?action=getLeaderboardHistory&board=&date=YYYY-MM-DD             (NEW, Phase 2.1, last 7 days)
 *   GET  ?action=getRaidStatus&id=&password=&characterId=                (NEW, Phase 3)
 *   GET  ?action=getMailbox&id=&password=&characterId=                   (NEW, Phase 3.1)
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
 *   POST { action: "attackRaidBoss", id, password, characterId }          (NEW, Phase 3)
 *   POST { action: "claimRaidMilestones", id, password, characterId }     (NEW, Phase 3)
 *   POST { action: "claimMail", id, password, characterId, mailId }       (NEW, Phase 3.1)
 *   POST { action: "claimAllMail", id, password, characterId }            (NEW, Phase 3.1)
 *   POST { action: "deleteMail", id, password, characterId, mailId }       (NEW, Phase 3.6)
 *   POST { action: "deleteMails", id, password, characterId, mailIds }     (NEW, Phase 3.6)
 *   POST { action: "deleteAllClaimedMail", id, password, characterId }     (NEW, Phase 3.6)
 *   POST { action: "craftItem", id, password, characterId, recipeId }       (NEW, Phase 4)
 *   POST { action: "saveGameConfig", adminKey, config }
 *   POST { action: "setGameConfigItem", adminKey, key, value }
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
  // NEW — Phase 2 (migration_v3.sql). One row per character; snapshotted nightly by scheduled().
  leaderboard_stats: {
    name: "leaderboard_stats",
    cols: ["character_id", "player_id", "name", "max_floor", "total_cp", "pet_cp", "updated_at"],
  },
  // NEW — Phase 2.1 (migration_v8_leaderboard_history.sql). Append-only daily archive, one
  // row per character per date, pruned to the last 7 days by runLeaderboardSnapshot.
  leaderboard_history: {
    name: "leaderboard_history",
    cols: ["date", "character_id", "player_id", "name", "max_floor", "total_cp", "pet_cp", "created_at"],
  },
};

// ---------- Phase 2: combat-power formulas ----------
// Ported from src/systems/stats.js and src/systems/pets.js. These MUST stay numerically
// consistent with the client so the leaderboard reflects what players actually see on
// their Status screen — if those files change, update the matching function here too.
const ENHANCE_STAT_PCT = 0.06;
const BASE_SPEED = 100; // unused in CP math directly but kept for parity/reference

function characterBaseStats(level, s) {
  return {
    maxHp: Math.round(40 + level * 4 + s.vit * 12),
    maxMp: Math.round(15 + level * 2),
    atk: Math.round(8 + level + s.str * 3 + Math.floor(s.dex * 0.5)),
    def: Math.round(2 + Math.floor(level * 0.4) + Math.floor(s.vit * 0.5)),
    accuracy: Math.min(99, Math.round((80 + s.dex * 0.5) * 10) / 10),
    critChance: Math.round(s.luk * 0.5 * 10) / 10,
    critDamage: 50,
    dodgeChance: Math.round(s.agi * 0.5 * 10) / 10,
  };
}

// it: a row from the `items` table (equipped=1). extra_json may carry critChance/
// critDamage/dodgeChance/empowerSlots that don't have their own columns.
function itemBonus(it) {
  const lvl = Number(it.enhance_level) || 0;
  const growMult = 1 + lvl * ENHANCE_STAT_PCT;
  let extra = {};
  try { extra = it.extra_json ? JSON.parse(it.extra_json) : {}; } catch (e) { extra = {}; }
  const b = {
    atk: (Number(it.atk) || 0) * growMult,
    def: (Number(it.def) || 0) * growMult,
    hp: (Number(it.hp) || 0) * growMult,
    mp: (Number(it.mp) || 0) * growMult,
    critChance: (Number(extra.critChance) || 0) * growMult,
    critDamage: (Number(extra.critDamage) || 0) * growMult,
    dodgeChance: (Number(extra.dodgeChance) || 0) * growMult,
    dropBonus: 0,
  };
  (extra.empowerSlots || []).forEach((slot) => {
    if (!slot) return;
    if (slot.key === "atkPct") b.atk += (Number(it.atk) || 0) * slot.value;
    else if (slot.key === "defPct") b.def += (Number(it.def) || 0) * slot.value;
    else b[slot.key] = (b[slot.key] || 0) + slot.value;
  });
  return b;
}

function combatPowerFromCharacter(character, equippedItems) {
  const s = {
    str: Number(character.str) || 0,
    vit: Number(character.vit) || 0,
    agi: Number(character.agi) || 0,
    dex: Number(character.dex) || 0,
    luk: Number(character.luk) || 0,
  };
  const level = Number(character.level) || 1;
  const base = characterBaseStats(level, s);
  const eb = { atk: 0, def: 0, hp: 0, mp: 0, critChance: 0, critDamage: 0, dodgeChance: 0, dropBonus: 0 };
  (equippedItems || []).forEach((it) => {
    const ib = itemBonus(it);
    Object.keys(ib).forEach((k) => { eb[k] += ib[k]; });
  });
  const atk = Math.round(base.atk + eb.atk);
  const def = Math.round(base.def + eb.def);
  const maxHp = Math.round(base.maxHp + eb.hp);
  const maxMp = Math.round(base.maxMp + eb.mp);
  const accuracy = Math.min(99, Math.round((base.accuracy + eb.accuracy) * 10) / 10 || base.accuracy);
  const critChance = Math.round((base.critChance + eb.critChance) * 10) / 10;
  const critDamage = Math.round((base.critDamage + eb.critDamage) * 10) / 10;
  const dodgeChance = Math.round((base.dodgeChance + eb.dodgeChance) * 10) / 10;
  return Math.round(
    atk * 12 + def * 15 + maxHp * 2 + maxMp * 1.5 + accuracy * 4 + critChance * 8 + critDamage * 3 + dodgeChance * 6 + level * 50
  );
}

const PET_BASE_STATS = {
  r: { str: 4, vit: 4, agi: 4, dex: 4, luk: 4 },
  sr: { str: 6, vit: 6, agi: 6, dex: 6, luk: 6 },
  ssr: { str: 9, vit: 9, agi: 9, dex: 9, luk: 9 },
};
const PET_STAR_MULT = [1.0, 1.08, 1.18, 1.3, 1.45];

// instance: one entry from a character's parsed pets_json list; rarity comes from the
// pet's def, which the worker doesn't have a copy of (PET_POOL lives client-side only)
// — instance.stats already reflects the pet's own rolled base line, so we use that
// directly rather than re-deriving it from rarity.
function petCombatPower(instance) {
  if (!instance || !instance.stats) return 0;
  const mult = PET_STAR_MULT[(Number(instance.star) || 1) - 1] || 1;
  const s = {
    str: (Number(instance.stats.str) || 0) * mult,
    vit: (Number(instance.stats.vit) || 0) * mult,
    agi: (Number(instance.stats.agi) || 0) * mult,
    dex: (Number(instance.stats.dex) || 0) * mult,
    luk: (Number(instance.stats.luk) || 0) * mult,
  };
  const lvl = Number(instance.level) || 1;
  const maxHp = Math.round(25 + lvl * 3 + s.vit * 8);
  const atk = Math.round(4 + Math.floor(lvl * 0.6) + s.str * 2);
  const def = Math.round(1 + Math.floor(lvl * 0.3) + Math.floor(s.vit * 0.4));
  const evasion = Math.round(s.agi * 0.5 * 10) / 10;
  const critChance = Math.round(s.luk * 0.5 * 10) / 10;
  return Math.round(atk * 12 + def * 15 + maxHp * 2 + critChance * 8 + evasion * 6 + lvl * 50);
}

const LEADERBOARD_HISTORY_RETENTION_DAYS = 7;
function dateKeyDaysAgo(days) {
  return new Date(Date.now() + 7 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Snapshots every character into leaderboard_stats. Called by scheduled() (nightly cron)
// and also exposed as an admin action so Kimmie can force a refresh without waiting for
// the cron to fire (e.g. right after deploying this).
async function runLeaderboardSnapshot(db) {
  const chars = await db.prepare(`SELECT * FROM characters`).all();
  const characters = chars.results || [];
  const now = nowIso();
  let updated = 0;

  for (const ch of characters) {
    const itemsRes = await db
      .prepare(`SELECT atk, def, hp, mp, enhance_level, extra_json FROM items WHERE character_id = ? AND equipped = 1`)
      .bind(ch.character_id)
      .all();
    const totalCp = combatPowerFromCharacter(ch, itemsRes.results || []);

    let petCp = 0;
    if (ch.active_pet_id) {
      try {
        const parsed = JSON.parse(ch.pets_json || "[]");
        // pets_json is backward-compatible: legacy rows are a bare array, current rows
        // are `{list, dup}` (dup = star-up duplicate pool) — see pets.js star-up system.
        const pets = Array.isArray(parsed) ? parsed : (parsed && parsed.list) || [];
        const active = pets.find((p) => p.instId === ch.active_pet_id);
        if (active) petCp = petCombatPower(active);
      } catch (e) { /* malformed pets_json — leave pet_cp at 0 for this character */ }
    }

    await db
      .prepare(
        `INSERT INTO leaderboard_stats (character_id, player_id, name, max_floor, total_cp, pet_cp, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(character_id) DO UPDATE SET
           player_id=excluded.player_id, name=excluded.name, max_floor=excluded.max_floor,
           total_cp=excluded.total_cp, pet_cp=excluded.pet_cp, updated_at=excluded.updated_at`
      )
      .bind(ch.character_id, ch.player_id, ch.name || "", Number(ch.unlocked_floor) || 1, totalCp, petCp, now)
      .run();

    // Append-only archive (Phase 2.1) — same values, but keyed by date too so today's
    // snapshot doesn't erase yesterday's like the upsert above does. Uses raidDateKey()
    // (Thai midnight) so every board's history lines up on the same date boundary.
    await db
      .prepare(
        `INSERT INTO leaderboard_history (date, character_id, player_id, name, max_floor, total_cp, pet_cp, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(date, character_id) DO UPDATE SET
           player_id=excluded.player_id, name=excluded.name, max_floor=excluded.max_floor,
           total_cp=excluded.total_cp, pet_cp=excluded.pet_cp, created_at=excluded.created_at`
      )
      .bind(raidDateKey(), ch.character_id, ch.player_id, ch.name || "", Number(ch.unlocked_floor) || 1, totalCp, petCp, now)
      .run();
    updated++;
  }

  // Retention: keep only the last LEADERBOARD_HISTORY_RETENTION_DAYS days of history (and of
  // raid data, which doubles as that board's own history — see handleGetLeaderboardHistory)
  // so these tables don't grow forever.
  const cutoff = dateKeyDaysAgo(LEADERBOARD_HISTORY_RETENTION_DAYS);
  await db.prepare(`DELETE FROM leaderboard_history WHERE date < ?`).bind(cutoff).run();
  await db.prepare(`DELETE FROM raid_boss_state WHERE date < ?`).bind(cutoff).run(); // cascades to raid_participants

  return { updated, at: now };
}

const LEADERBOARD_BOARD_COLS = { floor: "max_floor", cp: "total_cp", pet_cp: "pet_cp" };

async function handleGetLeaderboard(db, board) {
  if (board === "raid") {
    const raid = await getOrCreateActiveRaid(db);
    const def = raidBossDefById(raid.boss_def_id);
    const res = await db
      .prepare(`SELECT character_id, player_id, name, total_damage, total_contribution FROM raid_participants WHERE raid_id = ? ORDER BY total_contribution DESC LIMIT 50`)
      .bind(raid.raid_id)
      .all();
    return json({ ok: true, board, raidId: raid.raid_id, bossName: def.name, bossEmoji: def.emoji, hpMax: Number(raid.boss_hp_max), hpCurrent: Number(raid.boss_hp_current), rows: res.results || [], availableDates: recentDateKeys() });
  }
  const col = LEADERBOARD_BOARD_COLS[board];
  if (!col) return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS) });
  const res = await db
    .prepare(`SELECT character_id, player_id, name, max_floor, total_cp, pet_cp, updated_at FROM leaderboard_stats ORDER BY ${col} DESC LIMIT 50`)
    .all();
  return json({ ok: true, board, rows: res.results || [], availableDates: recentDateKeys() });
}

// Returns the last LEADERBOARD_HISTORY_RETENTION_DAYS calendar dates (today first) so the
// client can render a date picker without needing a separate "which dates have data" call —
// picking an empty day just renders an empty list, which is a fine, simple UX for this.
function recentDateKeys() {
  const out = [];
  for (let i = 0; i < LEADERBOARD_HISTORY_RETENTION_DAYS; i++) out.push(dateKeyDaysAgo(i));
  return out;
}

async function handleGetLeaderboardHistory(db, board, date) {
  const dateKey = date || raidDateKey();
  if (board === "raid") {
    // Raid never had a separate history table — raid_boss_state/raid_participants already
    // carry the date a boss was fought on, so "history" is just querying them directly.
    // Multiple bosses can spawn in one day (respawn-on-death, or the forced daily reset), so
    // this aggregates every raid instance that date per character rather than picking one.
    const raidsThatDay = await db.prepare(`SELECT raid_id FROM raid_boss_state WHERE date = ?`).bind(dateKey).all();
    const raidIds = (raidsThatDay.results || []).map((r) => r.raid_id);
    if (!raidIds.length) return json({ ok: true, board, date: dateKey, availableDates: recentDateKeys(), rows: [] });
    const placeholders = raidIds.map(() => "?").join(",");
    const res = await db
      .prepare(
        `SELECT character_id, MAX(player_id) as player_id, MAX(name) as name, MAX(total_damage) as total_damage, SUM(total_contribution) as total_contribution
         FROM raid_participants WHERE raid_id IN (${placeholders}) GROUP BY character_id ORDER BY total_contribution DESC LIMIT 50`
      )
      .bind(...raidIds)
      .all();
    return json({ ok: true, board, date: dateKey, availableDates: recentDateKeys(), rows: res.results || [] });
  }

  const col = LEADERBOARD_BOARD_COLS[board];
  if (!col) return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS) });
  const res = await db
    .prepare(`SELECT character_id, player_id, name, max_floor, total_cp, pet_cp, created_at FROM leaderboard_history WHERE date = ? ORDER BY ${col} DESC LIMIT 50`)
    .bind(dateKey)
    .all();
  return json({ ok: true, board, date: dateKey, availableDates: recentDateKeys(), rows: res.results || [] });
}

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

// ---------- Mailbox: generic reward delivery queue ----------
// Server-side reward mutations (UPDATE characters/items directly) get silently
// clobbered by this project's client-authoritative full-sync save model — the next
// saveCharacterProgress/syncItems push from the client overwrites them with its own
// stale local copy. So ANY server-granted reward (raid, and future PvP/guild/event)
// must go through here instead: drop a mail row, let the client claim it and merge
// the reward into its own local state, then the normal autosave persists it correctly.
function newMailId() {
  return `mail-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
async function sendMail(db, characterId, title, body, reward) {
  const r = reward || {};
  await db
    .prepare(
      `INSERT INTO mailbox (mail_id, character_id, title, body, gold, diamonds, junk_json, items_json, claimed, created_at, claimed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '')`
    )
    .bind(newMailId(), characterId, title || "", body || "", Number(r.gold) || 0, Number(r.diamonds) || 0, r.junk && r.junk.length ? JSON.stringify(r.junk) : "", r.items && r.items.length ? JSON.stringify(r.items) : "", nowIso())
    .run();
}
async function handleGetMailbox(db, id, password, characterId) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const res = await db
    .prepare(`SELECT mail_id, title, body, gold, diamonds, junk_json, items_json, claimed, created_at FROM mailbox WHERE character_id = ? ORDER BY created_at DESC LIMIT 50`)
    .bind(characterId)
    .all();
  const mails = (res.results || []).map((m) => ({
    mailId: m.mail_id, title: m.title, body: m.body, gold: Number(m.gold) || 0, diamonds: Number(m.diamonds) || 0,
    junk: m.junk_json ? JSON.parse(m.junk_json) : [], items: m.items_json ? JSON.parse(m.items_json) : [],
    claimed: !!Number(m.claimed), createdAt: m.created_at,
  }));
  return json({ ok: true, mails });
}
async function handleClaimMail(db, id, password, characterId, mailId) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!mailId) return json({ error: "missing_fields" });

  const mail = await db.prepare(`SELECT * FROM mailbox WHERE mail_id = ? AND character_id = ?`).bind(mailId, characterId).first();
  if (!mail) return json({ error: "not_found" });
  if (Number(mail.claimed)) return json({ error: "already_claimed" });

  const guard = await db.prepare(`UPDATE mailbox SET claimed = 1, claimed_at = ? WHERE mail_id = ? AND claimed = 0`).bind(nowIso(), mailId).run();
  if (!guard.meta || !guard.meta.changes) return json({ error: "already_claimed" });

  return json({
    ok: true, mailId, gold: Number(mail.gold) || 0, diamonds: Number(mail.diamonds) || 0,
    junk: mail.junk_json ? JSON.parse(mail.junk_json) : [], items: mail.items_json ? JSON.parse(mail.items_json) : [],
  });
}
async function handleClaimAllMail(db, id, password, characterId) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const unclaimed = await db.prepare(`SELECT * FROM mailbox WHERE character_id = ? AND claimed = 0`).bind(characterId).all();
  const rows = unclaimed.results || [];
  if (!rows.length) return json({ ok: true, mailIds: [], gold: 0, diamonds: 0, junk: [], items: [] });

  const now = nowIso();
  await db.batch(rows.map((m) => db.prepare(`UPDATE mailbox SET claimed = 1, claimed_at = ? WHERE mail_id = ? AND claimed = 0`).bind(now, m.mail_id)));

  let gold = 0, diamonds = 0;
  const junkTotals = {};
  const items = [];
  rows.forEach((m) => {
    gold += Number(m.gold) || 0;
    diamonds += Number(m.diamonds) || 0;
    (m.junk_json ? JSON.parse(m.junk_json) : []).forEach((j) => { junkTotals[j.junkId] = (junkTotals[j.junkId] || 0) + (Number(j.quantity) || 0); });
    (m.items_json ? JSON.parse(m.items_json) : []).forEach((it) => items.push(it));
  });
  const junk = Object.keys(junkTotals).map((junkId) => ({ junkId, quantity: junkTotals[junkId] }));
  return json({ ok: true, mailIds: rows.map((m) => m.mail_id), gold, diamonds, junk, items });
}
// Deletes only CLAIMED mail — deleting an unclaimed one would silently discard whatever
// reward it was carrying, so the WHERE clause refuses to touch claimed=0 rows regardless
// of what the client asks for.
async function handleDeleteMail(db, id, password, characterId, mailId) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!mailId) return json({ error: "missing_fields" });

  const result = await db.prepare(`DELETE FROM mailbox WHERE mail_id = ? AND character_id = ? AND claimed = 1`).bind(mailId, characterId).run();
  if (!result.meta || !result.meta.changes) return json({ error: "not_found_or_unclaimed" });
  return json({ ok: true, mailId });
}
async function handleDeleteMails(db, id, password, characterId, mailIds) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!Array.isArray(mailIds) || !mailIds.length) return json({ error: "missing_fields" });

  const placeholders = mailIds.map(() => "?").join(",");
  const result = await db
    .prepare(`DELETE FROM mailbox WHERE character_id = ? AND claimed = 1 AND mail_id IN (${placeholders})`)
    .bind(characterId, ...mailIds)
    .run();
  return json({ ok: true, deleted: result.meta ? result.meta.changes : 0 });
}
// Deletes ALL claimed mail for this character in one shot — the common "clean up my old
// read mail" action, without the client needing to enumerate every id first.
async function handleDeleteAllClaimedMail(db, id, password, characterId) {
  const auth = await verifyPlayer(db, id, password);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const result = await db.prepare(`DELETE FROM mailbox WHERE character_id = ? AND claimed = 1`).bind(characterId).run();
  return json({ ok: true, deleted: result.meta ? result.meta.changes : 0 });
}

// ---------- Phase 4: Crafting ----------
// Recipes live in the `recipes` table (recipe_id, result_item_def JSON, materials_json
// JSON, source, created_at). result_item_def only carries identity fields (type/rarity/
// name/setId/empowerSlotCount) — NOT stat numbers. Stats are computed fresh at craft time
// from the character's own unlocked_floor using CRAFTED_STAT_FORMULA below, so crafted
// gear stays "current BiS" forever without needing a rebalance pass every time a new
// floor is added. Mirrors generateDrop()'s per-type formulas in stats.js, pinned to
// CRAFTED_RARITY_MULT.
//
// This formula table is keyed by item TYPE (weapon/helmet/chest/gloves/boots/accessory),
// not by set — it's shared by every crafted set, present and future. Mythic is the
// permanent rarity ceiling in this game (confirmed, no new rarity tier is ever planned
// above it), so ALL crafted output — Azure today, any future set — is pinned to that same
// ceiling (5.4, equal to mythic) regardless of which `rarity`/`setId` string a given
// recipe's result_item_def uses. A new set just needs a `recipes` row; it does NOT need a
// new rarity tier, a new RARITY_MULT/RARITY_STARS/SALVAGE_TABLE key, or a worker redeploy.
// KEEP IN SYNC with CRAFTED_STAT_FORMULA in src/systems/crafting.js (client preview copy).
// Note: every crafted item's DB `rarity` is hardcoded to the literal string "azure" below
// (see the INSERT), regardless of what a recipe's result_item_def says or which visual
// setId it uses — "azure" here means "crafted tier", not "the Azure set specifically". This
// is deliberate: RARITY_MULT/RARITY_STARS/SALVAGE_TABLE only have entries for rare/unique/
// elite/mythic/azure, so a future set accidentally introducing a new rarity string (e.g.
// "crimson") would silently fall back to the weakest tier everywhere those tables are
// read — the exact bug class already hit twice during this phase. A future set should use
// a new `setId` for its visual identity/set-bonus grouping, but keep `rarity: "azure"`.
const CRAFTED_RARITY_MULT = 5.4;
const CRAFTED_STAT_FORMULA = {
  weapon: (floor) => ({ atk: Math.max(1, Math.round((2 + floor * 0.9) * CRAFTED_RARITY_MULT)) }),
  helmet: (floor) => ({ def: Math.max(1, Math.round((1 + floor * 0.35) * CRAFTED_RARITY_MULT)) }),
  chest: (floor) => ({ def: Math.max(1, Math.round((1.5 + floor * 0.5) * CRAFTED_RARITY_MULT)) }),
  gloves: (floor) => ({ atk: Math.max(1, Math.round((1 + floor * 0.35) * CRAFTED_RARITY_MULT)) }),
  boots: (floor) => ({ def: Math.max(1, Math.round((1 + floor * 0.3) * CRAFTED_RARITY_MULT)) }),
  accessory: (floor) => ({ dodgeChance: Math.round((1 + floor * 0.12) * CRAFTED_RARITY_MULT * 10) / 10 }),
};

// This is a real server-validated mutation (unlike enhance/salvage/shop, which are fully
// client-authoritative and just ride the next full syncItems push) because Kimmie asked for
// anti-cheat here specifically, and because "delete these exact item rows, then insert a new
// one" is impossible to fake safely from a client that could just lie about which stacks it
// spent. It checks materials/gold against THIS request's own fresh read of items/characters
// (not anything the client asserts), consumes them, and returns the crafted item descriptor
// for the client to materialize locally — same "server decides, client mirrors" shape as the
// mailbox/raid systems, just without needing an actual mailbox row since there's no delay.
async function handleCraftItem(db, id, password, characterId, recipeId) {
  const [auth, owned] = await Promise.all([verifyPlayer(db, id, password), verifyOwnedCharacter(db, id, characterId)]);
  if (auth.error) return json({ error: auth.error });
  if (owned.error) return json({ error: owned.error });
  if (!recipeId) return json({ error: "missing_fields" });

  const recipe = await db.prepare(`SELECT * FROM recipes WHERE recipe_id = ?`).bind(recipeId).first();
  if (!recipe) return json({ error: "recipe_not_found" });

  let resultDef = {};
  let materials = {};
  try { resultDef = JSON.parse(recipe.result_item_def || "{}"); } catch (e) { resultDef = {}; }
  try { materials = JSON.parse(recipe.materials_json || "{}"); } catch (e) { materials = {}; }

  const character = owned.row;
  const goldCost = Number(materials.gold) || 0;
  if (goldCost > 0 && (Number(character.gold) || 0) < goldCost) {
    return json({ error: "insufficient_gold", need: goldCost, have: Number(character.gold) || 0 });
  }

  const junkNeeds = Object.keys(materials)
    .filter((k) => k !== "gold")
    .map((k) => ({ junkId: k, qty: Number(materials[k]) || 0 }))
    .filter((m) => m.qty > 0);

  // Fresh read of this character's own junk stacks — junkId isn't its own column (rides
  // inside extra_json, same as everywhere else junk items are read in this file), so we
  // parse it out per row rather than trying to SQL-filter on it.
  const junkRowsRes = await db
    .prepare(`SELECT item_id, quantity, extra_json FROM items WHERE character_id = ? AND slot_type = 'junk'`)
    .bind(characterId)
    .all();
  const junkRows = (junkRowsRes.results || []).map((r) => {
    let extra = {};
    try { extra = JSON.parse(r.extra_json || "{}"); } catch (e) { extra = {}; }
    return { item_id: r.item_id, quantity: Number(r.quantity) || 0, junkId: extra.junkId };
  });

  for (const need of junkNeeds) {
    const have = junkRows.filter((r) => r.junkId === need.junkId).reduce((s, r) => s + r.quantity, 0);
    if (have < need.qty) return json({ error: "insufficient_materials", junkId: need.junkId, need: need.qty, have });
  }

  const now = nowIso();
  const stmts = [];
  junkNeeds.forEach((need) => {
    let remaining = need.qty;
    for (const row of junkRows.filter((r) => r.junkId === need.junkId)) {
      if (remaining <= 0) break;
      const take = Math.min(row.quantity, remaining);
      remaining -= take;
      const leftover = row.quantity - take;
      if (leftover > 0) {
        stmts.push(db.prepare(`UPDATE items SET quantity = ?, updated_at = ? WHERE item_id = ? AND character_id = ?`).bind(leftover, now, row.item_id, characterId));
      } else {
        stmts.push(db.prepare(`DELETE FROM items WHERE item_id = ? AND character_id = ?`).bind(row.item_id, characterId));
      }
    }
  });
  if (goldCost > 0) {
    stmts.push(db.prepare(`UPDATE characters SET gold = MAX(0, gold - ?), updated_at = ? WHERE character_id = ?`).bind(goldCost, now, characterId));
  }

  // Computed fresh from the character's OWN unlocked_floor (already loaded via
  // verifyOwnedCharacter above) — never trusts a floor value from the client.
  const floor = Math.max(1, Number(character.unlocked_floor) || 1);
  const formula = CRAFTED_STAT_FORMULA[resultDef.type] || (() => ({}));
  const stats = formula(floor);

  const newItemId = `item-craft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const extraJson = JSON.stringify({
    dodgeChance: stats.dodgeChance || undefined,
    setId: resultDef.setId || undefined,
    star: resultDef.star || undefined,
    craftRecipeId: recipeId,
  });
  stmts.push(
    db
      .prepare(
        `INSERT INTO items (item_id, player_id, character_id, slot_type, equipped, inventory_slot, item_template_id, rarity, name, item_level, enhance_level, bound, quantity, atk, def, hp, mp, extra_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, '', ?, ?, ?, 0, 0, 0, 1, ?, ?, 0, 0, ?, ?, ?)`
      )
      .bind(newItemId, id, characterId, resultDef.type || "", recipeId, "azure", resultDef.name || "Crafted Item", Number(stats.atk) || 0, Number(stats.def) || 0, extraJson, now, now)
  );

  await db.batch(stmts);

  return json({
    ok: true,
    item: {
      type: resultDef.type,
      rarity: "azure",
      name: resultDef.name,
      atk: Number(stats.atk) || 0,
      def: Number(stats.def) || 0,
      dodgeChance: Number(stats.dodgeChance) || 0,
      setId: resultDef.setId,
      empowerSlotCount: resultDef.empowerSlotCount || 1,
      craftRecipeId: recipeId,
    },
    consumed: junkNeeds,
    goldSpent: goldCost,
    craftedAtFloor: floor,
  });
}

// ---------- Phase 3: Raid Boss ----------
// One shared boss per day, rotates through this list as each one dies (spawnIndex =
// how many have already spawned today, scales hpMax up a bit each respawn so later
// bosses in the day are a bit tougher once the playerbase has more total damage output).
const RAID_BOSS_DEFS = [
  { id: "slime_titan", name: "Slime Titan", emoji: "🟢", hpBase: 150000 },
  { id: "iron_golem", name: "Iron Golem", emoji: "⚙️", hpBase: 260000 },
  { id: "shadow_wyrm", name: "Shadow Wyrm", emoji: "🐉", hpBase: 420000 },
];
const RAID_STAMINA_MAX = 10;
const RAID_STAMINA_REGEN_MS = 15 * 60 * 1000; // +1 every 15 minutes
const RAID_DIAMOND_REFILL_COST = 50; // per extra attack once stamina hits 0
const RAID_HITS_PER_ATTACK = 3; // mini combat round per attack, not a single flat hit

// Lazily resolves current stamina from a stored checkpoint (no cron needed — same
// approach as most mobile energy systems). Only "spends" whole elapsed 15-min ticks
// from the checkpoint so partial progress toward the next point is never lost; once
// stamina is full there's nothing to track so updatedAt collapses back to "" (matches
// the migration's default, and getOrCreateActiveRaid-style lazy init below).
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

// Raid Wings — a separate 1-5★ tier exclusive to raid rewards (not the normal floor-drop
// wings pool; client's buildDropItem() no longer rolls wings/accessory at all — see stats.js).
const RAID_WING_DEFS = [
  { star: 1, name: "ปีกอัศวินฝึกหัด ★1", dodgeChance: 5 },
  { star: 2, name: "ปีกอัศวินฝึกหัด ★2", dodgeChance: 10 },
  { star: 3, name: "ปีกนักรบราชวงศ์ ★3", dodgeChance: 18 },
  { star: 4, name: "ปีกนักรบราชวงศ์ ★4", dodgeChance: 28 },
  { star: 5, name: "ปีกเทพประจัญบาน ★5", dodgeChance: 40 },
];
function raidWingItemDesc(star) {
  const def = RAID_WING_DEFS[Math.max(1, Math.min(5, star)) - 1];
  return { type: "wings", rarity: "raid", name: def.name, dodgeChance: def.dodgeChance, star: def.star, empowerSlotCount: def.star };
}
function randomRaidWingStar() {
  return 1 + Math.floor(Math.random() * 5);
}

// Azure set — 6 pieces (helmet/chest/gloves/boots/weapon/ring), set bonus at 2/4/6 equipped
// (client-side bonus values live in stats.js SET_BONUS_DEFS.azure — keep both in sync).
const AZURE_SET_DEFS = {
  azure_helmet: { type: "helmet", name: "หมวก Azure", def: 60 },
  azure_chest: { type: "chest", name: "เสื้อ Azure", def: 90 },
  azure_gloves: { type: "gloves", name: "ถุงมือ Azure", atk: 40 },
  azure_boots: { type: "boots", name: "รองเท้า Azure", def: 45 },
  azure_weapon: { type: "weapon", name: "อาวุธ Azure", atk: 120 },
  azure_ring: { type: "accessory", name: "แหวน Azure", dodgeChance: 15 }, // uses the existing "accessory" equip slot
};
function randomAzureItemDesc() {
  const keys = Object.keys(AZURE_SET_DEFS);
  const key = keys[Math.floor(Math.random() * keys.length)];
  const d = AZURE_SET_DEFS[key];
  return { type: d.type, rarity: "azure", name: d.name, atk: d.atk || 0, def: d.def || 0, dodgeChance: d.dodgeChance || 0, setId: "azure", empowerSlotCount: 5 };
}
// Recipes are inert placeholder items (stackable, riding the existing junk pipeline) until
// the Crafting phase exists to consume them — see JUNK_INFO/recipe_* entries in enhancement.js.
const AZURE_RECIPE_JUNK_IDS = ["recipe_azure_helmet", "recipe_azure_chest", "recipe_azure_gloves", "recipe_azure_boots", "recipe_azure_weapon", "recipe_azure_ring"];
function randomAzureRecipeJunkId() {
  return AZURE_RECIPE_JUNK_IDS[Math.floor(Math.random() * AZURE_RECIPE_JUNK_IDS.length)];
}
// Boss horn/hide — a single shared material pool across all boss types (not per-boss for now).
function randomBossMaterialJunkId() {
  return Math.random() < 0.5 ? "bossHorn" : "bossHide";
}

// Rank rewards, keyed by cumulative CONTRIBUTION (total_contribution) across the whole
// raid instance — settled for EVERY participant (rank 1..last), not just a top-N cutoff.
// Rank 1-3 get a fixed wing tier + boss materials + a random azure recipe; everyone ranked
// 4th or lower gets 2 random boss materials as a consolation.
const RAID_RANK_REWARDS = [
  { wingStar: 5, junk: [{ junkId: "bossHorn", quantity: 3 }, { junkId: "bossHide", quantity: 3 }], recipe: true },
  { wingStar: 3, junk: [{ junkId: "bossHorn", quantity: 2 }, { junkId: "bossHide", quantity: 2 }], recipe: true },
  { wingStar: 1, junk: [{ junkId: "bossHorn", quantity: 1 }, { junkId: "bossHide", quantity: 1 }], recipe: true },
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

  const cntRow = await db.prepare(`SELECT COUNT(*) as c FROM raid_boss_state WHERE date = ?`).bind(today).first();
  const spawnIndex = cntRow ? Number(cntRow.c) || 0 : 0;
  const def = RAID_BOSS_DEFS[spawnIndex % RAID_BOSS_DEFS.length];
  const hpMax = Math.round(def.hpBase * (1 + spawnIndex * 0.2));
  const raidId = `raid-${today}-${spawnIndex}-${Math.random().toString(36).slice(2, 8)}`;
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
  const eb = { atk: 0, critChance: 0, critDamage: 0 };
  (equippedItems || []).forEach((it) => {
    const ib = itemBonus(it);
    eb.atk += ib.atk;
    eb.critChance += ib.critChance || 0;
    eb.critDamage += ib.critDamage || 0;
  });
  return {
    atk: Math.round(base.atk + eb.atk),
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
  const bossName = raidBossDefById(bossRow ? bossRow.boss_def_id : "").name;
  const allRes = await db
    .prepare(`SELECT character_id, total_contribution FROM raid_participants WHERE raid_id = ? ORDER BY total_contribution DESC`)
    .bind(raidId)
    .all();
  const rows = allRes.results || [];

  for (let i = 0; i < rows.length; i++) {
    const top = RAID_RANK_REWARDS[i];
    if (top) {
      const junk = top.junk.slice();
      if (top.recipe) junk.push({ junkId: randomAzureRecipeJunkId(), quantity: 1 });
      await sendMail(
        db, rows[i].character_id, `🏆 อันดับ ${i + 1} ศึก ${bossName}`,
        `คุณจบการล่า ${bossName} ในอันดับที่ ${i + 1} ด้วยดาเมจสะสม ${rows[i].total_contribution}`,
        { junk, items: [raidWingItemDesc(top.wingStar)] }
      );
    } else {
      await sendMail(
        db, rows[i].character_id, `⚔️ ร่วมศึก ${bossName}`, `อันดับที่ ${i + 1} ในการล่าครั้งนี้ — ได้วัตถุดิบติดไม้ติดมือ`,
        { junk: [{ junkId: randomBossMaterialJunkId(), quantity: 1 }, { junkId: randomBossMaterialJunkId(), quantity: 1 }] }
      );
    }
  }
}

async function handleGetRaidStatus(db, id, password, characterId) {
  // These three are fully independent reads (auth check, ownership check, and the raid's
  // own state don't depend on each other) — firing them together instead of one-after-
  // another cuts several D1 round trips down to the time of the single slowest one. Same
  // pattern below for the participant/leaderboard reads once raid_id is known.
  const [auth, owned, raid] = await Promise.all([verifyPlayer(db, id, password), verifyOwnedCharacter(db, id, characterId), getOrCreateActiveRaid(db)]);
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
    boss: { raidId: raid.raid_id, defId: def.id, name: def.name, emoji: def.emoji, hpMax: Number(raid.boss_hp_max), hpCurrent: Number(raid.boss_hp_current) },
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
      { pct: 25, label: "ปีก 1★" }, { pct: 50, label: "ปีก 3★" }, { pct: 75, label: "แบบร่างชุด Azure" }, { pct: 99, label: "ไอเทมชุด Azure" },
    ],
    top: topRes.results || [],
  });
}

async function handleAttackRaidBoss(db, id, password, characterId, paidDiamonds) {
  // See handleGetRaidStatus for why these four are safe to fire concurrently — the equipped-
  // items read only needs characterId, so it doesn't have to wait for raid/ownership either.
  const [auth, owned, raid, itemsRes] = await Promise.all([
    verifyPlayer(db, id, password),
    verifyOwnedCharacter(db, id, characterId),
    getOrCreateActiveRaid(db),
    db.prepare(`SELECT atk, extra_json, enhance_level FROM items WHERE character_id = ? AND equipped = 1`).bind(characterId).all(),
  ]);
  if (auth.error) return json({ error: auth.error });
  if (owned.error) return json({ error: owned.error });
  const character = owned.row;

  if (Number(raid.boss_hp_current) <= 0) return json({ error: "boss_already_dead" });

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
      return json({ error: "stamina_conflict", retry: true });
    }
  } else if (!paidDiamonds) {
    return json({ error: "no_stamina", diamondRefillCost: RAID_DIAMOND_REFILL_COST, staminaRegenSeconds: raidStaminaSecondsToNext(staminaState.updatedAt) });
  } else {
    const charged = await db
      .prepare(`UPDATE players SET diamonds = diamonds - ? WHERE id = ? AND diamonds >= ?`)
      .bind(RAID_DIAMOND_REFILL_COST, id, RAID_DIAMOND_REFILL_COST)
      .run();
    if (!charged.meta || !charged.meta.changes) {
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
  if (bossRow && bossHpAfter <= 0 && hpBefore > 0) {
    bossDied = true;
    const lastHitStar = randomRaidWingStar();
    await sendMail(db, characterId, `💥 Last Hit! ${raidBossDefById(raid.boss_def_id).name}`, `คุณคือผู้ปิดจ๊อบ! ได้รับปีกสุ่ม ★${lastHitStar}`, { items: [raidWingItemDesc(lastHitStar)] });
    await settleRaidRank(db, raid.raid_id);
  }

  return json({
    ok: true,
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
  });
}

async function handleClaimRaidMilestones(db, id, password, characterId) {
  const [auth, owned, raid] = await Promise.all([verifyPlayer(db, id, password), verifyOwnedCharacter(db, id, characterId), getOrCreateActiveRaid(db)]);
  if (auth.error) return json({ error: auth.error });
  if (owned.error) return json({ error: owned.error });

  const participant = await db.prepare(`SELECT * FROM raid_participants WHERE raid_id = ? AND character_id = ?`).bind(raid.raid_id, characterId).first();
  if (!participant) return json({ error: "no_participation" });

  const claimed = (participant.milestone_claimed || "").split(",").filter(Boolean);
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
    if (pct === 25) items.push(raidWingItemDesc(1));
    if (pct === 50) items.push(raidWingItemDesc(3));
    if (pct === 75) junk.push({ junkId: randomAzureRecipeJunkId(), quantity: 1 });
  }
  // 99% is its own checkpoint (not a multiple of 5) — a full random azure piece, not a recipe.
  if (pctReached >= 99 && claimed.indexOf("p99") === -1) {
    newKeys.push("p99");
    items.push(randomAzureItemDesc());
  }
  if (!newKeys.length) return json({ ok: true, claimed: [] });

  const def = raidBossDefById(raid.boss_def_id);
  await sendMail(db, characterId, `🎁 รางวัลดาเมจสะสม ${def.name}`, `คุณสะสมดาเมจถึง ${newKeys.map((k) => k.replace("p", "")).join("%, ")}%`, { diamonds, junk, items });

  const allClaimed = claimed.concat(newKeys).join(",");
  await db.prepare(`UPDATE raid_participants SET milestone_claimed = ? WHERE raid_id = ? AND character_id = ?`).bind(allClaimed, raid.raid_id, characterId).run();

  return json({ ok: true, claimed: newKeys });
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
        if (action === "getRecipes") return await handleGetRecipes(db);
        if (action === "getInventory") return await handleGetInventory(db, p.get("id"), p.get("password"), p.get("characterId"), p.get("page"), p.get("pageSize"));
        if (action === "getDailyLogin") return await handleGetDailyLogin(db, p.get("id"), p.get("password"), p.get("characterId"));
        if (action === "getLeaderboard") return await handleGetLeaderboard(db, p.get("board"));
        if (action === "getLeaderboardHistory") return await handleGetLeaderboardHistory(db, p.get("board"), p.get("date"));
        if (action === "getRaidStatus") return await handleGetRaidStatus(db, p.get("id"), p.get("password"), p.get("characterId"));
        if (action === "getMailbox") return await handleGetMailbox(db, p.get("id"), p.get("password"), p.get("characterId"));
        if (action === "runLeaderboardSnapshot") {
          const auth = verifyAdminKey(env, p.get("adminKey"));
          if (auth.error) return json(auth);
          return json({ ok: true, ...(await runLeaderboardSnapshot(db)) });
        }
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
          case "attackRaidBoss":
            return await handleAttackRaidBoss(db, body.id, body.password, body.characterId, !!body.paidDiamonds);
          case "claimRaidMilestones":
            return await handleClaimRaidMilestones(db, body.id, body.password, body.characterId);
          case "claimMail":
            return await handleClaimMail(db, body.id, body.password, body.characterId, body.mailId);
          case "claimAllMail":
            return await handleClaimAllMail(db, body.id, body.password, body.characterId);
          case "deleteMail":
            return await handleDeleteMail(db, body.id, body.password, body.characterId, body.mailId);
          case "deleteMails":
            return await handleDeleteMails(db, body.id, body.password, body.characterId, body.mailIds);
          case "deleteAllClaimedMail":
            return await handleDeleteAllClaimedMail(db, body.id, body.password, body.characterId);
          case "craftItem":
            return await handleCraftItem(db, body.id, body.password, body.characterId, body.recipeId);
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

  // Cron Trigger entry point (set up in Cloudflare Dashboard -> this worker -> Trigger
  // Events, since there's no wrangler.toml here to declare it in). Not testable locally
  // via bash (api.cloudflare.com isn't allowlisted) — use the runLeaderboardSnapshot
  // admin GET action above to trigger it manually for testing/backfill.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runLeaderboardSnapshot(env.DB));
    ctx.waitUntil(closeOutExpiredRaids(env.DB));
  },
};
