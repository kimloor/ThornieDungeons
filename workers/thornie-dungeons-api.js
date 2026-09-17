/**
 * THORNIE DUNGEONS — Cloud Save Backend (Cloudflare Worker + D1) — schema v2 + daily login
 * ---------------------------------------------------------------
 * Repository source for the independently deployed gameplay API Worker. It includes the
 * existing character/game systems plus Login/Auth V2's central session boundary.
 *
 * NOT YET DEPLOYED — the root wrangler.jsonc targets the frontend/static Worker, not this
 * API file. After applying the reviewed D1 migration, deploy this API source manually:
 *   wrangler deploy workers/thornie-dungeons-api.js --name thornie-dungeons-api
 * or paste it into the Cloudflare Dashboard editor for the `thornie-dungeons-api` worker,
 * while preserving the production Worker's DB binding, secrets and triggers.
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
 * Auth V2 endpoints:
 *   POST { action: "login"|"register"|"forgotPassword", ...credentials }
 *   GET  ?action=validateSession          Authorization: Bearer <session token>
 *   POST { action: "logout"|"changePassword"|"createRecoveryCode", ... }
 * All character/gameplay endpoints below use the same Authorization header; player_id is
 * derived from the validated session and id/password are never accepted as ownership proof.
 * Public/admin endpoints remain unchanged:
 *   GET  ?action=getGameConfig
 *   GET  ?action=getRecipes                                                (NEW, Phase 4 refactor)
 *   GET  ?action=getMonsterLoot                                             (NEW, monster loot table)
 *   GET  ?action=getJunkInfo                                                (NEW, admin.html — material names/icons)
 *   POST { action: "adminUpsertJunkInfo", adminKey, junkId, name, icon }     (NEW, admin.html)
 *   POST { action: "adminDeleteJunkInfo", adminKey, junkId }                 (NEW, admin.html)
 *   GET  ?action=getLeaderboard&board=floor|cp|pet_cp|raid|pvp            (pvp = NEW)
 *   GET  ?action=getLeaderboardHistory&board=&date=YYYY-MM-DD             (NEW, Phase 2.1, last 7 days)
 *   GET  ?action=getPlayer&adminKey=&id=            (admin)
 *   GET  ?action=getAllPlayers&adminKey=            (admin)
 *   GET  ?action=getPlayerItems&adminKey=&id=        (admin)
 *   GET  ?action=getGameStats&adminKey=              (admin)
 *   GET  ?action=getSheet&adminKey=&sheet=           (admin — "sheet" name kept from before, means "table")
 *   POST { action: "saveGameConfig", adminKey, config }
 *   POST { action: "setGameConfigItem", adminKey, key, value }
 *   POST { action: "adminUpsertRecipe", adminKey, recipeId, type, name, setId, empowerSlotCount, materials }  (NEW, admin.html)
 *   POST { action: "adminDeleteRecipe", adminKey, recipeId }                                                  (NEW, admin.html)
 *   POST { action: "adminUpsertMonsterLootEntry", adminKey, entry: {...} }                                    (NEW, admin.html)
 *   POST { action: "adminDeleteMonsterLootEntry", adminKey, entryId }                                         (NEW, admin.html)
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
    name: "character_run_state",
    cols: ["character_id", "floor", "level", "xp", "hp", "mp", "base_atk", "base_def", "base_max_hp", "base_max_mp", "run_gold", "potions", "pet_state_json", "updated_at"],
  },
  items: {
    name: "items",
    cols: ["item_id", "player_id", "character_id", "slot_type", "equipped", "inventory_slot", "item_template_id", "rarity", "name", "item_level", "enhance_level", "bound", "quantity", "atk", "def", "hp", "mp", "extra_json", "created_at", "updated_at"],
  },
  game_config: { name: "game_config", cols: ["key", "value_json", "updated_at"] },
  // Reference/design-data tables, registered here purely so the existing admin `getSheet`
  // action can list them raw — nothing writes to these via the generic upsertRow()/getRow()
  // sync path (recipes/monster_loot writes go through their own dedicated admin handlers
  // below, same as craftItem/getRecipes/getMonsterLoot already do their own raw queries).
  recipes: { name: "recipes", cols: ["recipe_id", "result_item_def", "materials_json", "source", "created_at"] },
  monster_loot: { name: "monster_loot", cols: ["entry_id", "monster_id", "kind", "item_type", "rarity", "junk_id", "qty_min", "qty_max", "weight", "drop_chance", "created_at", "updated_at"] },
  junk_info: { name: "junk_info", cols: ["junk_id", "name", "icon", "created_at", "updated_at"] },
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
  sprout: [3,5,4,4,4], flamekit: [5,3,4,4,4], sparkpup: [4,3,5,5,3], ember_fox: [8,5,6,6,5],
  moon_hare: [4,8,6,7,5], hell_wolf: [7,5,7,6,5], thunder_cub: [7,5,7,6,5],
  inferno_drake: [11,11,7,8,8], storm_phoenix: [9,7,11,10,8],
};
const PET_GROWTH_STATS = {
  sprout: [.10,.40,.20,.30,.20], flamekit: [.45,.10,.20,.25,.20], sparkpup: [.25,.10,.40,.30,.15],
  ember_fox: [.45,.15,.20,.30,.25], moon_hare: [.10,.40,.20,.35,.25], hell_wolf: [.35,.15,.35,.30,.20], thunder_cub: [.35,.15,.35,.30,.20],
  inferno_drake: [.40,.45,.15,.25,.25], storm_phoenix: [.30,.15,.45,.35,.25],
};
const PET_STAR_MULT = [1.0, 1.15, 1.35];

// instance: one entry from a character's parsed pets_json list; rarity comes from the
// pet's def, which the worker doesn't have a copy of (PET_POOL lives client-side only)
// — instance.stats already reflects the pet's own rolled base line, so we use that
// directly rather than re-deriving it from rarity.
function petCombatPower(instance) {
  if (!instance) return 0;
  const defId = instance.defId === "thunder_cub" ? "hell_wolf" : instance.defId;
  const base = PET_BASE_STATS[defId] || PET_BASE_STATS.sprout;
  const growth = PET_GROWTH_STATS[defId] || PET_GROWTH_STATS.sprout;
  const lvl = Math.max(1, Math.min(50, Number(instance.level) || 1));
  const mult = PET_STAR_MULT[Math.max(0, Math.min(2, (Number(instance.star) || 1) - 1))] || 1;
  const values = instance.statModel === "v2" && instance.stats
    ? [instance.stats.str, instance.stats.vit, instance.stats.agi, instance.stats.dex, instance.stats.luk]
    : base.map((value, index) => value + growth[index] * (lvl - 1));
  const s = { str: values[0] * mult, vit: values[1] * mult, agi: values[2] * mult, dex: values[3] * mult, luk: values[4] * mult };
  const maxHp = Math.round(30 + lvl * 4 + s.vit * 7);
  const atk = Math.round(5 + lvl * 0.7 + s.str * 2);
  const def = Math.round(2 + lvl * 0.25 + s.vit * 0.5);
  const evasion = Math.min(20, Math.round(s.agi * 0.35 * 10) / 10);
  const critChance = Math.min(25, Math.round(s.luk * 0.4 * 10) / 10);
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
    return json({ ok: true, board, raidId: raid.raid_id, bossName: def.name, hpMax: Number(raid.boss_hp_max), hpCurrent: Number(raid.boss_hp_current), rows: res.results || [], availableDates: recentDateKeys() });
  }
  // NEW — public, read-only ranking view. pvp_ranking is already the live, persistent
  // record (updated by settleArenaMatch on every match), so this is a straight top-50
  // read with no snapshot step needed, unlike floor/cp/pet_cp which are derived values.
  if (board === "pvp") {
    const res = await db
      .prepare(`SELECT character_id, player_id, name, rating, wins, losses FROM pvp_ranking ORDER BY rating DESC LIMIT 50`)
      .all();
    return json({ ok: true, board, rows: res.results || [] }); // no availableDates — history isn't tracked for pvp
  }
  const col = LEADERBOARD_BOARD_COLS[board];
  if (!col) return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS).concat(["raid", "pvp"]) });
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
  // pvp has no history table (see handleGetLeaderboard) — the client only shows the date
  // picker for boards that support it, but guard here too in case that ever changes.
  if (board === "pvp") return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS).concat(["raid"]) });

  const col = LEADERBOARD_BOARD_COLS[board];
  if (!col) return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS).concat(["raid"]) });
  const res = await db
    .prepare(`SELECT character_id, player_id, name, max_floor, total_cp, pet_cp, created_at FROM leaderboard_history WHERE date = ? ORDER BY ${col} DESC LIMIT 50`)
    .bind(dateKey)
    .all();
  return json({ ok: true, board, date: dateKey, availableDates: recentDateKeys(), rows: res.results || [] });
}

// NEW — server-owned reward cycle (source of truth; client only displays what this returns,
// never computes its own reward, so a tampered client can't grant itself diamonds).
// Day 3/5 grant existing raid materials (see JUNK_INFO: iron/manaOre/bossHorn/bossHide),
// day 7 resolves to one random Azure set piece via randomAzureItemDesc() (defined further
// down, in the Raid Boss section) at claim time — the preview below just flags
// `azureRandom: true` rather than pre-rolling it, so browsing the preview can't
// waste/predetermine that roll before the player actually claims.
const DAILY_LOGIN_REWARDS = [
  { day: 1, gold: 5000 },
  { day: 2, diamonds: 150 },
  { day: 3, junk: [{ junkId: "manaOre", quantity: 10 }, { junkId: "iron", quantity: 10 }] },
  { day: 4, diamonds: 350 },
  { day: 5, junk: [{ junkId: "bossHide", quantity: 3 }, { junkId: "bossHorn", quantity: 3 }] },
  { day: 6, diamonds: 550 },
  { day: 7, azureRandom: true }, // bonus day, cycle repeats after this
];

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

// ---------- Login/Auth V2 ----------
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
  const length = String(password || "").length;
  return length >= PASSWORD_MIN && length <= PASSWORD_MAX;
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
  if (Number(row.attempts) >= limit) return { error: "rate_limited", retryAfter: 30 };
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
  const registerKey = rateKey("register", ip);
  const limited = await checkRateLimit(db, registerKey, 3, 60 * 60 * 1000);
  if (limited.error) return json(limited, 429);
  await recordRateAttempt(db, registerKey, 3, 60 * 60 * 1000);
  const cleanId = String(id || "").trim();
  if (!validPlayerId(cleanId)) return json({ error: "invalid_player_id" }, 400);
  if (!validPassword(password)) return json({ error: "invalid_password_length" }, 400);
  if (String(password) !== String(confirmPassword)) return json({ error: "password_mismatch" }, 400);
  const existing = await playerByLoginId(db, cleanId);
  if (existing) return json({ error: "id_unavailable" });

  const now = nowIso();
  const passwordHash = await hashPassword(password);
  const recoveryCode = createRecoveryCode();
  const recoveryHash = await recoveryCodeHash(recoveryCode);
  await db.prepare(
    `INSERT INTO players (id, password, password_hash, recovery_code_hash, auth_version, diamonds, active_slot, created_at)
     VALUES (?, '', ?, ?, 2, 0, NULL, ?)`
  ).bind(cleanId, passwordHash, recoveryHash, now).run();
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
  if (!validPassword(newPassword)) return json({ error: "invalid_password_length" }, 400);
  if (String(newPassword) !== String(confirmPassword)) return json({ error: "password_mismatch" }, 400);
  const verified = await verifyPasswordCredentials(db, auth.row.id, currentPassword);
  if (verified.error) return json({ error: "invalid_credentials" });
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE players SET password_hash = ?, auth_version = 2 WHERE id = ?`).bind(await hashPassword(newPassword), auth.row.id),
    db.prepare(`UPDATE auth_sessions SET revoked_at = ?, revoke_reason = 'password_changed' WHERE player_id = ? AND revoked_at IS NULL`).bind(now, auth.row.id)
  ]);
  return json({ ok: true, requireLogin: true });
}

async function handleForgotPassword(db, id, recoveryCode, newPassword, confirmPassword, ip) {
  const recoveryKey = rateKey("recovery", ip, id);
  const limited = await checkRateLimit(db, recoveryKey, 5, 5 * 60 * 1000);
  if (limited.error) return json(limited, 429);
  if (!validPassword(newPassword)) return json({ error: "invalid_password_length" }, 400);
  if (String(newPassword) !== String(confirmPassword)) return json({ error: "password_mismatch" }, 400);
  const player = await playerByLoginId(db, id);
  const suppliedHash = await recoveryCodeHash(recoveryCode);
  if (!player?.recovery_code_hash || String(player.recovery_code_hash) !== String(suppliedHash)) {
    await recordRateAttempt(db, recoveryKey, 5, 5 * 60 * 1000);
    return json({ error: "invalid_recovery" });
  }
  const nextRecoveryCode = createRecoveryCode();
  const now = nowIso();
  await db.batch([
    db.prepare(`UPDATE players SET password_hash = ?, recovery_code_hash = ?, auth_version = 2 WHERE id = ?`)
      .bind(await hashPassword(newPassword), await recoveryCodeHash(nextRecoveryCode), player.id),
    db.prepare(`UPDATE auth_sessions SET revoked_at = ?, revoke_reason = 'password_reset' WHERE player_id = ? AND revoked_at IS NULL`).bind(now, player.id)
  ]);
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

  await db.batch([
    db.prepare(`DELETE FROM items WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM character_run_state WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM battle_checkpoints WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM battle_completions WHERE character_id = ?`).bind(row.character_id),
    db.prepare(`DELETE FROM character_settings WHERE character_id = ?`).bind(row.character_id),
    // NEW — clean up daily login state along with the rest of the character's data
    db.prepare(`DELETE FROM daily_login_claims WHERE character_id = ?`).bind(row.character_id),
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

  await db.prepare(`UPDATE players SET active_slot = ? WHERE id = ?`).bind(slot, id).run();

  const items = await getRows(db, "items", "character_id", character.character_id);
  let runState = await getRow(db, "run_state", "character_id", character.character_id);
  if (!runState) {
    const legacyRun = await db.prepare(
      `SELECT * FROM run_state
       WHERE character_id = ? OR (player_id = ? AND (character_id IS NULL OR TRIM(character_id) = ''))
       LIMIT 1`
    ).bind(character.character_id, id).first();
    if (legacyRun) {
      runState = normalizedRunState(character.character_id, legacyRun);
      await upsertRow(db, "run_state", "character_id", runState);
    }
  }

  return json({ ok: true, character, items, runState: runState || null });
}

// ---------- per-character progress / items / run-state ----------
function normalizedRunState(characterId, runState) {
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
    floor: Math.max(1, Number(runState.floor) || 1),
    level: Math.max(1, Number(runState.level) || 1),
    xp: Math.max(0, Number(runState.xp) || 0),
    hp: Math.max(0, Number(runState.hp) || 0),
    mp: Math.max(0, Number(runState.mp) || 0),
    base_atk: Math.max(0, Number(runState.base_atk) || 0),
    base_def: Math.max(0, Number(runState.base_def) || 0),
    base_max_hp: Math.max(0, Number(runState.base_max_hp) || 0),
    base_max_mp: Math.max(0, Number(runState.base_max_mp) || 0),
    run_gold: Math.max(0, Number(runState.run_gold) || 0),
    potions: Math.max(0, Number(runState.potions) || 0),
    pet_state_json: JSON.stringify(safePetState),
    updated_at: runState.updated_at || nowIso()
  };
}

async function handleSaveCharacterProgress(db, id, session, characterId, diamonds, progress) {
  const auth = await verifyPlayer(db, id, session);
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
  const obj = normalizedRunState(characterId, { ...runState, updated_at: nowIso() });
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
  return json({
    ok: true,
    checkpoint: checkpoint ? {
      battleId: checkpoint.battle_id,
      checkpointSeq: Number(checkpoint.checkpoint_seq) || 0,
      payload: parseJsonColumn(checkpoint.payload_json, null),
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
  const encoded = JSON.stringify(payload);
  if (encoded.length > 512000) return json({ error: "checkpoint_too_large" }, 413);
  const identity = await db.prepare(`SELECT character_id FROM battle_checkpoints WHERE battle_id = ? LIMIT 1`).bind(String(battleId)).first();
  if (identity && identity.character_id !== characterId) return json({ error: "battle_identity_conflict" }, 409);
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

async function handleCompleteBattle(db, id, session, characterId, battleId, resultPayload) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const resultName = resultPayload && resultPayload.result;
  if (!battleId || !["victory", "defeat", "fled"].includes(resultName)) return json({ error: "invalid_battle_result" }, 400);
  const prior = await db.prepare(`SELECT character_id, result_json, completed_at FROM battle_completions WHERE battle_id = ?`).bind(String(battleId)).first();
  if (prior) {
    if (prior.character_id !== characterId) return json({ error: "battle_identity_conflict" }, 409);
    await db.prepare(`UPDATE battle_checkpoints SET state = 'completed', updated_at = ? WHERE battle_id = ? AND character_id = ?`)
      .bind(nowIso(), String(battleId), characterId).run();
    return json({ ok: true, firstCompletion: false, result: parseJsonColumn(prior.result_json, null), completedAt: prior.completed_at });
  }
  const checkpoint = await db.prepare(
    `SELECT checkpoint_seq FROM battle_checkpoints WHERE battle_id = ? AND character_id = ? AND state = 'active' LIMIT 1`
  ).bind(String(battleId), characterId).first();
  if (!checkpoint) return json({ error: "battle_checkpoint_missing" }, 409);
  if (Math.floor(Number(resultPayload.safeActionSeq) || 0) <= (Number(checkpoint.checkpoint_seq) || 0)) {
    return json({ error: "battle_result_not_after_checkpoint" }, 409);
  }
  const encoded = JSON.stringify(resultPayload);
  if (encoded.length > 512000) return json({ error: "battle_result_too_large" }, 413);
  const now = nowIso();
  const insert = await db.prepare(
    `INSERT INTO battle_completions (battle_id, character_id, result_json, completed_at)
     VALUES (?, ?, ?, ?) ON CONFLICT(battle_id) DO NOTHING`
  ).bind(String(battleId), characterId, encoded, now).run();
  const row = await db.prepare(`SELECT character_id, result_json, completed_at FROM battle_completions WHERE battle_id = ?`).bind(String(battleId)).first();
  if (!row || row.character_id !== characterId) return json({ error: "battle_identity_conflict" }, 409);
  await db.prepare(`UPDATE battle_checkpoints SET state = 'completed', updated_at = ? WHERE battle_id = ? AND character_id = ?`)
    .bind(now, String(battleId), characterId).run();
  return json({ ok: true, firstCompletion: !!(insert.meta && insert.meta.changes), result: parseJsonColumn(row.result_json, null), completedAt: row.completed_at });
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

async function handleGetInventory(db, id, session, characterId, page, pageSize) {
  const auth = await verifyPlayer(db, id, session);
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

async function handleSetInventorySlot(db, id, session, itemId, inventorySlot) {
  const auth = await verifyPlayer(db, id, session);
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

  const row = await getRow(db, "daily_login_claims", "character_id", characterId);
  const today = todayDateKey();
  const lastClaimDate = row ? row.last_claim_date || "" : "";
  if (lastClaimDate === today) return json({ error: "already_claimed" });

  const prevStreak = row ? Number(row.login_streak) || 0 : 0;
  const streak = lastClaimDate === yesterdayDateKey() ? prevStreak + 1 : 1;
  const rewardDef = dailyLoginReward(streak);
  // Resolve any random component only at the moment of claiming, never at preview time.
  const reward = { gold: rewardDef.gold, diamonds: rewardDef.diamonds, junk: rewardDef.junk };
  if (rewardDef.azureRandom) reward.items = [randomAzureItemDesc()];
  const totalClaims = (row ? Number(row.total_claims) || 0 : 0) + 1;
  const now = nowIso();

  await upsertRow(db, "daily_login_claims", "character_id", {
    character_id: characterId,
    login_streak: streak,
    last_claim_date: today,
    total_claims: totalClaims,
    updated_at: now,
  });

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
async function handleGetMailbox(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
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
async function handleClaimMail(db, id, session, characterId, mailId) {
  const auth = await verifyPlayer(db, id, session);
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
async function handleClaimAllMail(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
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
async function handleDeleteMail(db, id, session, characterId, mailId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!mailId) return json({ error: "missing_fields" });

  const result = await db.prepare(`DELETE FROM mailbox WHERE mail_id = ? AND character_id = ? AND claimed = 1`).bind(mailId, characterId).run();
  if (!result.meta || !result.meta.changes) return json({ error: "not_found_or_unclaimed" });
  return json({ ok: true, mailId });
}
async function handleDeleteMails(db, id, session, characterId, mailIds) {
  const auth = await verifyPlayer(db, id, session);
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
async function handleDeleteAllClaimedMail(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
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
async function handleCraftItem(db, id, session, characterId, recipeId) {
  const [auth, owned] = await Promise.all([verifyPlayer(db, id, session), verifyOwnedCharacter(db, id, characterId)]);
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

  // Fresh read of this character's own junk stacks — junkId AND the real stack quantity
  // both ride inside extra_json (see itemsToServerList in serialize.js: the client never
  // sends a top-level `quantity` at all for junk, only extra.quantity — the DB column just
  // sits at its schema default of 1 for every junk row, decorative and unused elsewhere).
  // BUG FIX: this used to read the top-level `quantity` column, which is always 1 no
  // matter how large a stack actually is — that's what caused "have 1/6" even when a
  // player had a real stack of e.g. 17.
  const junkRowsRes = await db
    .prepare(`SELECT item_id, extra_json FROM items WHERE character_id = ? AND slot_type = 'junk'`)
    .bind(characterId)
    .all();
  const junkRows = (junkRowsRes.results || []).map((r) => {
    let extra = {};
    try { extra = JSON.parse(r.extra_json || "{}"); } catch (e) { extra = {}; }
    return { item_id: r.item_id, quantity: Number(extra.quantity) || 0, junkId: extra.junkId, extra };
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
        // Write the decremented amount back into extra_json.quantity (preserving every
        // other extra field — icon, empowerSlots, etc.), NOT the top-level column.
        const nextExtra = JSON.stringify({ ...row.extra, quantity: leftover });
        stmts.push(db.prepare(`UPDATE items SET extra_json = ?, updated_at = ? WHERE item_id = ? AND character_id = ?`).bind(nextExtra, now, row.item_id, characterId));
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
  { id: "azure_angel", name: "Azure Angel", hpBase: 150000 },
  { id: "robo_phoenix", name: "Robo Phoenix", hpBase: 260000 },
  { id: "dark_dragonlord", name: "Dark Dragonlord", hpBase: 420000 },
];
const RAID_STAMINA_MAX = 10;
const RAID_STAMINA_REGEN_MS = 15 * 60 * 1000; // +1 every 15 minutes
const RAID_DIAMOND_REFILL_COST = 50; // per extra attack once stamina hits 0
const RAID_HITS_PER_ATTACK = 3; // mini combat round per attack, not a single flat hit

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
  return Object.freeze({ id, branch, tier, kind, maxRank: kind === "passive" ? 5 : kind === "keystone" ? 5 : 3, ranks, ...extra });
}

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
    if (state.queueIndex >= state.queue.length && !state.result) rebuildQueue(state);
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
    return Math.max(0, Math.min(STATUS_PROC_CAP, value) - (Number(target.statusResist) || 0));
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
    for (const statusSpec of spec.statuses || []) {
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
    const damage = Math.max(1, Math.round((attackPower - targetDefAtHitStart * (1 - pierce)) * critMult));
    const dealt = receiveDamage(state, actor, target, damage, { ...actionContext, actionName: attackActionName(spec, actionContext), crit, direct: true });
    actionContext.totalDamage += dealt;
    actionContext.hitAny = true;
    if (target.kind === "hero" && dealt > 0) {
      actionContext.heroStruck = true;
      actionContext.struckHeroIds.add(target.id);
    }
    if (target.dead) actionContext.killed = true;
    return { hit: true, crit, damage: dealt };
  }

  function basicTarget(state, actor, requestedId) {
    const targets = opposingUnits(state, actor);
    const requested = requestedId && state.units[requestedId];
    if (living(requested) && requested.side !== actor.side) return requested;
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
    const target = basicTarget(state, actor, command.targetId || state.selectedTargetIds?.[actor.side] || state.selectedTargetId);
    if (!target) return;
    context.targetHadDebuff = hasDebuff(target);
    if (type === "active") {
      const id = command.skillId;
      const spec = heroActiveSpec(state, actor, id);
      if (!spec || !actor.activeSkills.includes(id) || (actor.cooldowns[id] || 0) > 0 || status(actor, "silence")) { log(state, "invalid", "Active skill unavailable"); return; }
      const efficiency = skillData(actor, "skill_efficiency");
      const cost = Math.max(0, Math.ceil(spec.sp * (1 - pct(efficiency ? efficiency.spReductionPct : 0))));
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

  function resolveEnemyAction(state, actor, context) {
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

  function checkBattleEnd(state) {
    const aliveSides = state.teamIds.filter(side => livingTeamUnits(state, side).length);
    if (aliveSides.length > 1) return;
    state.winnerSide = aliveSides[0] || null;
    state.result = state.winnerSide === state.controlledSide ? "victory" : "defeat";
    state.flags.auto = false;
    const hero = heroForSide(state, state.controlledSide);
    const pet = petForSide(state, state.controlledSide);
    if (state.mode === "dungeon" && !living(hero) && living(pet) && state.result === "victory") state.flags.heroReviveNextFloor = true;
    resetBattleResources(state);
    log(state, "battle_end", state.result === "victory" ? "Victory" : "Defeat");
  }

  function validateHeroCommand(state, actor, command) {
    const type = command && command.type || "basic";
    if (type === "basic") return null;
    if (type === "potion") return (Number(command.count) || 0) > 0 ? null : "No potion available";
    if (type === "flee") return state.rules.allowFlee ? null : "Flee is not allowed";
    if (type !== "active") return "Unknown Hero action";
    const id = command.skillId;
    const spec = heroActiveSpec(state, actor, id);
    if (!spec || !actor.activeSkills.includes(id) || (actor.cooldowns[id] || 0) > 0 || status(actor, "silence")) return "Active skill unavailable";
    const efficiency = skillData(actor, "skill_efficiency");
    const cost = Math.max(0, Math.ceil(spec.sp * (1 - pct(efficiency ? efficiency.spReductionPct : 0))));
    return actor.sp >= cost ? null : "Not enough SP";
  }

  function battleStep(inputState, command) {
    // Presentation only observes the returned state/log. Animation timing, UI
    // speed and VFX must never decide queue order or gameplay resolution here.
    const state = ensureTeamModel(copy(inputState));
    if (state.result) return { state, waiting: false, completedAction: false };
    const actor = currentUnit(state);
    if (!actor) { checkBattleEnd(state); return { state, waiting: false, completedAction: false }; }
    const manualActor = actor.kind === "hero" && actor.side === state.controlledSide;
    if (manualActor && !command && !state.flags.auto && !state.flags.skipResolving) return { state, waiting: true, completedAction: false };
    if (manualActor && command) {
      const invalid = validateHeroCommand(state, actor, command);
      if (invalid) {
        log(state, "invalid", invalid);
        return { state, waiting: true, completedAction: false, error: invalid };
      }
    }
    const context = { appliedStatuses: new Set(), struckHeroIds: new Set(), totalDamage: 0, hitAny: false, heroStruck: false, killed: false, debuffApplied: false, cdrUsed: false, usedSkillId: null, schemeConsumed: false, activeDebuffBonus: 0, attackAction: false, targetHadDebuff: false };
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
    if (!state || state.version !== 1 || !state.battleId || state.result) throw new Error("invalid_checkpoint_state");
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
    serializeCheckpoint, restoreCheckpoint
  };
  Object.assign(root, { BATTLE_CORE_V1: api });
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

// ---------- Phase 5: PvP Arena orchestration ----------
// Everything below calls ONLY the public BATTLE_CORE_V1 API (createArenaBattle,
// currentUnit, battleStep) — it does not reimplement damage/status/skill resolution.
const PVP_TICKET_MAX = 5;
const PVP_TICKET_REGEN_MS = 20 * 60 * 1000; // +1 every 20 minutes
const PVP_DIAMOND_REFILL_COST = 30; // per extra attack once tickets hit 0
const PVP_RATING_K = 24;
const PVP_RATING_FLOOR = 100; // rating never drops below this
const PVP_RATING_MIN_DELTA = 5; // guaranteed minimum rating swing on any decisive match
const PVP_WIN_DIAMONDS = 15;
const PVP_LOSS_DIAMONDS = 3; // small consolation so losing still feels worth attempting
const PVP_BASE_SPEED = 10; // matches src/systems/stats.js's speedFromAgi() base (worker's
// own BASE_SPEED=100 above is an unrelated legacy constant — don't reuse it here)

function resolvePvpTickets(stored, updatedAtIso) {
  const rawTickets = Number(stored);
  const storedTickets = Number.isFinite(rawTickets) ? Math.max(0, Math.min(PVP_TICKET_MAX, Math.floor(rawTickets))) : PVP_TICKET_MAX;
  if (storedTickets >= PVP_TICKET_MAX) {
    return { tickets: PVP_TICKET_MAX, updatedAt: "" };
  }
  const updatedAtMs = Date.parse(updatedAtIso || "");
  if (!Number.isFinite(updatedAtMs)) {
    return { tickets: storedTickets, updatedAt: new Date(Date.now()).toISOString() };
  }
  const elapsedMs = Math.max(0, Date.now() - updatedAtMs);
  const ticks = Math.floor(elapsedMs / PVP_TICKET_REGEN_MS);
  if (ticks <= 0) return { tickets: storedTickets, updatedAt: updatedAtIso };
  const tickets = Math.min(PVP_TICKET_MAX, storedTickets + ticks);
  const updatedAt = tickets >= PVP_TICKET_MAX ? "" : new Date(updatedAtMs + ticks * PVP_TICKET_REGEN_MS).toISOString();
  return { tickets, updatedAt };
}
function pvpTicketsSecondsToNext(updatedAtIso) {
  if (!updatedAtIso) return 0;
  const updatedAtMs = Date.parse(updatedAtIso);
  if (!Number.isFinite(updatedAtMs)) return Math.round(PVP_TICKET_REGEN_MS / 1000);
  const elapsedMs = Math.max(0, Date.now() - updatedAtMs);
  const remaining = PVP_TICKET_REGEN_MS - (elapsedMs % PVP_TICKET_REGEN_MS);
  return Math.max(0, Math.round(remaining / 1000));
}

// Mirrors petCombatPower()'s own internal stat derivation (defId alias, v1-growth-curve
// vs v2-rolled-stats, 3-tier star mult) exactly, returning the raw stat block a
// BATTLE_CORE_V1 pet unit needs (including agi/vit, since Pet Actives like Sprout's heal
// or the speed formula both read those directly) instead of collapsing to a single CP.
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
// Parses a character row's pets_json (see serialize.js's characterProgressToServer) for
// its active pet instance + committed Hero Skill V1 ranks — the same envelope the client
// already writes on every save, so no new column was needed for either.
function parsePetsJson(character) {
  let parsed = {};
  try { parsed = character.pets_json ? JSON.parse(character.pets_json) : {}; } catch (e) { parsed = {}; }
  const list = Array.isArray(parsed.list) ? parsed.list : [];
  const skillLevels = parsed.skills && typeof parsed.skills === "object" ? parsed.skills : {};
  const active = list.find((p) => p && p.id === character.active_pet_id) || null;
  return { active, skillLevels };
}

// Builds a raw hero unit for BATTLE_CORE_V1.buildHeroUnit()/createArenaBattle() from a
// live character row. toughness/iron_body/battle_hardened are applied the same way
// src/ui/App.js's own stat calc applies them (multiplicative on top of base+equipment),
// so a snapshot taken here matches what the character would show on their own status
// screen. `level` is carried along for opponent-list display only — battleCore ignores
// unknown fields on a unit.
function pvpHeroUnit(character, equippedItems, id, name, skillLevels) {
  const s = {
    str: Number(character.str) || 0, vit: Number(character.vit) || 0, agi: Number(character.agi) || 0,
    dex: Number(character.dex) || 0, luk: Number(character.luk) || 0,
  };
  const level = Number(character.level) || 1;
  const base = characterBaseStats(level, s);
  const eb = { atk: 0, def: 0, hp: 0, mp: 0, critChance: 0, critDamage: 0, dodgeChance: 0 };
  (equippedItems || []).forEach((it) => {
    const ib = itemBonus(it);
    eb.atk += ib.atk; eb.def += ib.def; eb.hp += ib.hp; eb.mp += ib.mp;
    eb.critChance += ib.critChance || 0; eb.critDamage += ib.critDamage || 0; eb.dodgeChance += ib.dodgeChance || 0;
  });
  const toughness = heroSkillRankData(skillLevels, "toughness");
  const ironBody = heroSkillRankData(skillLevels, "iron_body");
  const battleHardened = heroSkillRankData(skillLevels, "battle_hardened");
  const maxHp = Math.round((base.maxHp + eb.hp) * (1 + (toughness ? toughness.maxHpPct : 0) / 100));
  const def = Math.round((base.def + eb.def) * (1 + (ironBody ? ironBody.defPct : 0) / 100));
  return {
    id, name, kind: "hero", level,
    maxHp, hp: maxHp,
    maxSp: Math.round(base.maxMp + eb.mp), sp: Math.round(base.maxMp + eb.mp),
    atk: Math.round(base.atk + eb.atk), def,
    speed: Math.round(PVP_BASE_SPEED + s.agi * 2),
    accuracy: base.accuracy,
    dodge: Math.round((base.dodgeChance + eb.dodgeChance) * 10) / 10,
    crit: Math.round((base.critChance + eb.critChance) * 10) / 10,
    critDamage: 1 + (base.critDamage + eb.critDamage) / 100,
    statusResist: battleHardened ? battleHardened.statusResist : 0,
    skills: skillLevels,
    activeSkills: heroActiveSkillList(skillLevels).map((sk) => sk.key),
  };
}
function pvpPetUnit(instance, id) {
  const bs = petBattleStats(instance);
  if (!bs) return null;
  return {
    id, kind: "pet", name: "Pet", petDefId: bs.defId,
    maxHp: bs.maxHp, hp: bs.maxHp,
    atk: bs.atk, def: bs.def,
    speed: Math.round(PVP_BASE_SPEED + bs.agi * 1.5),
    dodge: bs.evasion, crit: bs.critChance, vit: bs.vit,
  };
}

async function ensureArenaRanking(db, characterId, playerId, name) {
  await db
    .prepare(
      `INSERT INTO pvp_ranking (character_id, player_id, name, rating, wins, losses, updated_at)
       VALUES (?, ?, ?, 1000, 0, 0, ?)
       ON CONFLICT(character_id) DO UPDATE SET name = excluded.name`
    )
    .bind(characterId, playerId, name || "", nowIso())
    .run();
}
async function upsertArenaSnapshot(db, characterId, playerId, name, loadout) {
  await db
    .prepare(
      `INSERT INTO pvp_snapshots (character_id, player_id, name, stats_json, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(character_id) DO UPDATE SET
         player_id = excluded.player_id, name = excluded.name, stats_json = excluded.stats_json, updated_at = excluded.updated_at`
    )
    .bind(characterId, playerId, name || "", JSON.stringify(loadout), nowIso())
    .run();
}

// Refreshes the caller's own ranking row + combat snapshot (so the opponent pool always
// reflects roughly-current gear/level/skills/pet), then returns rating/rank/tickets/top-10
// plus an activeMatchId if a match is already in progress so the client can resume it.
async function handleGetArenaStatus(db, id, session, characterId) {
  const [auth, owned, itemsRes] = await Promise.all([
    verifyPlayer(db, id, session),
    verifyOwnedCharacter(db, id, characterId),
    db.prepare(`SELECT atk, def, hp, mp, extra_json, enhance_level FROM items WHERE character_id = ? AND equipped = 1`).bind(characterId).all(),
  ]);
  if (auth.error) return json({ error: auth.error });
  if (owned.error) return json({ error: owned.error });
  const character = owned.row;
  const { active, skillLevels } = parsePetsJson(character);
  const heroUnit = pvpHeroUnit(character, itemsRes.results || [], "snap_hero", character.name || "", skillLevels);
  const petUnit = active ? pvpPetUnit(active, "snap_pet") : null;

  const [, , activeMatch] = await Promise.all([
    ensureArenaRanking(db, characterId, id, character.name || ""),
    upsertArenaSnapshot(db, characterId, id, character.name || "", { hero: heroUnit, pet: petUnit }),
    db.prepare(`SELECT match_id FROM pvp_matches WHERE attacker_character_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`).bind(characterId).first(),
  ]);

  const [rankRow, top10] = await Promise.all([
    db.prepare(`SELECT rating, wins, losses FROM pvp_ranking WHERE character_id = ?`).bind(characterId).first(),
    db.prepare(`SELECT character_id, name, rating, wins, losses FROM pvp_ranking ORDER BY rating DESC LIMIT 10`).all(),
  ]);
  const myRating = rankRow ? Number(rankRow.rating) : 1000;
  const rankPosRow = await db.prepare(`SELECT COUNT(*) as c FROM pvp_ranking WHERE rating > ?`).bind(myRating).first();
  const rankPos = (rankPosRow ? Number(rankPosRow.c) : 0) + 1;
  const ticketState = resolvePvpTickets(character.pvp_tickets, character.pvp_tickets_updated_at);

  return json({
    ok: true,
    rating: myRating,
    wins: rankRow ? Number(rankRow.wins) : 0,
    losses: rankRow ? Number(rankRow.losses) : 0,
    rank: rankPos,
    tickets: ticketState.tickets,
    ticketsMax: PVP_TICKET_MAX,
    ticketsRegenSeconds: pvpTicketsSecondsToNext(ticketState.updatedAt),
    diamondRefillCost: PVP_DIAMOND_REFILL_COST,
    activeMatchId: activeMatch ? activeMatch.match_id : null,
    top: (top10.results || []).map((r) => ({ characterId: r.character_id, name: r.name, rating: Number(r.rating), wins: Number(r.wins), losses: Number(r.losses) })),
  });
}

// Returns 3 opponents (never self), preferring characters within +-300 rating of the
// caller and falling back to any ranked character if that band is too sparse.
async function handleGetArenaOpponents(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const myRank = await db.prepare(`SELECT rating FROM pvp_ranking WHERE character_id = ?`).bind(characterId).first();
  const myRating = myRank ? Number(myRank.rating) : 1000;

  // json_extract(...) IS NOT NULL filters out snapshots still in an older stats_json
  // shape (e.g. written before a combat-engine migration, before that character's own
  // owner has reopened Arena to refresh it) — without this, a listed opponent could
  // 404 with "opponent_not_found" the moment you actually tried to fight them.
  const nearby = await db
    .prepare(
      `SELECT s.character_id, s.name, s.stats_json, r.rating, r.wins, r.losses
       FROM pvp_snapshots s JOIN pvp_ranking r ON r.character_id = s.character_id
       WHERE s.character_id != ? AND r.rating BETWEEN ? AND ? AND json_extract(s.stats_json, '$.hero') IS NOT NULL
       ORDER BY RANDOM() LIMIT 3`
    )
    .bind(characterId, myRating - 300, myRating + 300)
    .all();
  let rows = nearby.results || [];
  if (rows.length < 3) {
    const any = await db
      .prepare(
        `SELECT s.character_id, s.name, s.stats_json, r.rating, r.wins, r.losses
         FROM pvp_snapshots s JOIN pvp_ranking r ON r.character_id = s.character_id
         WHERE s.character_id != ? AND json_extract(s.stats_json, '$.hero') IS NOT NULL ORDER BY RANDOM() LIMIT 3`
      )
      .bind(characterId)
      .all();
    rows = any.results || [];
  }
  const opponents = rows.map((r) => {
    let loadout = {};
    try { loadout = r.stats_json ? JSON.parse(r.stats_json) : {}; } catch (e) { loadout = {}; }
    return {
      characterId: r.character_id, name: r.name, level: (loadout.hero && loadout.hero.level) || 1,
      hasPet: !!loadout.pet, rating: Number(r.rating), wins: Number(r.wins), losses: Number(r.losses),
    };
  });
  return json({ ok: true, opponents });
}

// ---- session driver: wraps BATTLE_CORE_V1, adds zero resolver logic of its own ----
function pvpIsPlayerHeroTurn(actor) { return !!actor && actor.kind === "hero" && actor.side === "team_a"; }
// battleStep() only accepts a real command from state.controlledSide's hero — anyone
// else defaults to a basic attack (see src/systems/battleCore.js's battleStep). Flipping
// controlledSide immediately before every step, and re-aliasing state.resources to match
// (the exact invariant ensureTeamModel itself maintains), is how BOTH PvP fighters get to
// use real active skills through that same, unmodified resolver — no forked logic here.
function pvpSetControlledSide(state, side) {
  if (state.controlledSide !== side) {
    state.controlledSide = side;
    state.teamResources = state.teamResources || {};
    state.teamResources[side] = state.teamResources[side] || { fury: 0, aegis: 0, scheme: 0, schemeConsumed: 0, nextActiveDebuffBonus: 0 };
    state.resources = state.teamResources[side];
  }
  return state;
}
// Ordinary "which button would this side press" decision-making — the same category of
// logic a client UI already does to decide which skill buttons are enabled. Not a
// duplicate of any battleCore damage/status resolution.
function pvpPickBotCommand(actor) {
  if (actor.statuses && actor.statuses.silence) return { type: "basic" };
  const candidates = (actor.activeSkills || []).filter((skillId) => {
    const data = heroSkillRankData(actor.skills, skillId);
    if (!data) return false;
    if ((actor.cooldowns[skillId] || 0) > 0) return false;
    if (actor.sp < (Number(data.sp) || 0)) return false;
    return true;
  });
  if (candidates.length && Math.random() < 0.5) {
    return { type: "active", skillId: candidates[Math.floor(Math.random() * candidates.length)] };
  }
  return { type: "basic" };
}
function pvpAutoAdvance(state, maxSteps = 30) {
  let steps = 0;
  while (steps++ < maxSteps && !state.result) {
    const actor = BATTLE_CORE_V1.currentUnit(state);
    if (!actor) break;
    if (pvpIsPlayerHeroTurn(actor)) break;
    pvpSetControlledSide(state, actor.side);
    const command = actor.kind === "hero" ? pvpPickBotCommand(actor) : undefined;
    state = BATTLE_CORE_V1.battleStep(state, command).state;
  }
  return state;
}
function pvpSubmitPlayerTurn(state, command) {
  const actor = BATTLE_CORE_V1.currentUnit(state);
  if (!pvpIsPlayerHeroTurn(actor)) return { state, error: "not_your_turn" };
  pvpSetControlledSide(state, actor.side);
  const result = BATTLE_CORE_V1.battleStep(state, command);
  if (result.error) return { state: result.state, error: result.error };
  return { state: pvpAutoAdvance(result.state) };
}
function pvpUnitPublic(state, id) {
  const u = state.units[id];
  if (!u) return null;
  return { hp: u.hp, maxHp: u.maxHp, mp: u.sp, maxMp: u.maxSp, statuses: Object.keys(u.statuses || {}) };
}
function pvpHeroSkillsPublic(actor) {
  if (!actor) return [];
  return heroActiveSkillList(actor.skills).map((s) => ({ ...s, cooldownRemaining: actor.cooldowns[s.key] || 0 }));
}
// Trims a battleCore log entry (which also carries internal bookkeeping fields) down to
// what the client needs: the human-readable text plus enough structure (actorId/targetId/
// crit) to drive the placeholder battle-stage animation.
function pvpPublicLogEntry(e) {
  return { type: e.type, text: e.text, actorId: e.actorId || null, targetId: e.targetId || null, crit: !!e.crit };
}

async function settleArenaMatch(db, characterId, opponentCharacterId, state) {
  const attackerWon = state.winnerSide === "team_a";
  const myRating = Number((await db.prepare(`SELECT rating FROM pvp_ranking WHERE character_id = ?`).bind(characterId).first())?.rating) || 1000;
  const oppRating = Number((await db.prepare(`SELECT rating FROM pvp_ranking WHERE character_id = ?`).bind(opponentCharacterId).first())?.rating) || 1000;
  const expected = 1 / (1 + Math.pow(10, (oppRating - myRating) / 400));
  const actual = attackerWon ? 1 : 0;
  let delta = Math.round(PVP_RATING_K * (actual - expected));
  delta = attackerWon ? Math.max(PVP_RATING_MIN_DELTA, delta) : Math.min(-PVP_RATING_MIN_DELTA, delta);
  const myNewRating = Math.max(PVP_RATING_FLOOR, myRating + delta);
  const oppNewRating = Math.max(PVP_RATING_FLOOR, oppRating - delta);
  const now = nowIso();

  await db.batch([
    db.prepare(`UPDATE pvp_ranking SET rating = ?, wins = wins + ?, losses = losses + ?, updated_at = ? WHERE character_id = ?`)
      .bind(myNewRating, attackerWon ? 1 : 0, attackerWon ? 0 : 1, now, characterId),
    db.prepare(`UPDATE pvp_ranking SET rating = ?, wins = wins + ?, losses = losses + ?, updated_at = ? WHERE character_id = ?`)
      .bind(oppNewRating, attackerWon ? 0 : 1, attackerWon ? 1 : 0, now, opponentCharacterId),
  ]);

  const oppName = (state.units.team_b_hero && state.units.team_b_hero.name) || "คู่ต่อสู้";
  const diamonds = attackerWon ? PVP_WIN_DIAMONDS : PVP_LOSS_DIAMONDS;
  if (attackerWon) await sendMail(db, characterId, `🏆 ชนะศึกอารีน่า!`, `คุณเอาชนะ ${oppName} ได้สำเร็จ (Rating ${myRating} → ${myNewRating})`, { diamonds });
  else await sendMail(db, characterId, `💢 แพ้ศึกอารีน่า`, `คุณแพ้ให้กับ ${oppName} (Rating ${myRating} → ${myNewRating})`, { diamonds });

  return { win: attackerWon, ratingBefore: myRating, ratingAfter: myNewRating, ratingChange: delta, opponentName: oppName, diamondsEarned: diamonds };
}

// Starts (or resumes, if one is already active) a match against opponentCharacterId. A
// ticket (or diamonds) is only spent when a brand-new match is created — resuming an
// existing one is always free, so a dropped connection can't cost the player a second
// ticket. pvpAutoAdvance() runs once up front too, in case the opponent's side happens to
// act (or their Pet auto-acts) before the player's very first move.
async function handleStartArenaMatch(db, id, session, characterId, opponentCharacterId, paidDiamonds) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const character = owned.row;

  const existing = await db.prepare(`SELECT * FROM pvp_matches WHERE attacker_character_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`).bind(characterId).first();
  if (existing) {
    const state = JSON.parse(existing.state_json);
    return json({
      ok: true, matchId: existing.match_id, resumed: true, turn: state.round, done: false,
      you: pvpUnitPublic(state, "team_a_hero"), yourPet: pvpUnitPublic(state, "team_a_pet"),
      opponent: pvpUnitPublic(state, "team_b_hero"), opponentPet: pvpUnitPublic(state, "team_b_pet"),
      opponentName: (state.units.team_b_hero && state.units.team_b_hero.name) || "คู่ต่อสู้",
      skills: pvpHeroSkillsPublic(state.units.team_a_hero),
      log: [],
    });
  }

  if (!opponentCharacterId) return json({ error: "missing_fields" });
  if (opponentCharacterId === characterId) return json({ error: "cannot_attack_self" });
  const [itemsRes, oppSnap] = await Promise.all([
    db.prepare(`SELECT atk, def, hp, mp, extra_json, enhance_level FROM items WHERE character_id = ? AND equipped = 1`).bind(characterId).all(),
    db.prepare(`SELECT * FROM pvp_snapshots WHERE character_id = ?`).bind(opponentCharacterId).first(),
  ]);
  if (!oppSnap) return json({ error: "opponent_not_found" });
  let oppLoadout = {};
  try { oppLoadout = oppSnap.stats_json ? JSON.parse(oppSnap.stats_json) : {}; } catch (e) { oppLoadout = {}; }
  if (!oppLoadout.hero) return json({ error: "opponent_not_found" });

  // Ticket CAS — identical shape to the raid_stamina reservation in handleAttackRaidBoss.
  const ticketState = resolvePvpTickets(character.pvp_tickets, character.pvp_tickets_updated_at);
  let newTickets = ticketState.tickets;
  let newTicketsUpdatedAt = ticketState.updatedAt;
  let diamondsSpent = 0;
  if (ticketState.tickets >= 1) {
    newTickets = ticketState.tickets - 1;
    newTicketsUpdatedAt = ticketState.updatedAt || nowIso();
    const storedTickets = Number.isFinite(Number(character.pvp_tickets)) ? Number(character.pvp_tickets) : PVP_TICKET_MAX;
    const storedUpdatedAt = character.pvp_tickets_updated_at || "";
    const reserved = await db
      .prepare(`UPDATE characters SET pvp_tickets = ?, pvp_tickets_updated_at = ? WHERE character_id = ? AND pvp_tickets = ? AND pvp_tickets_updated_at = ?`)
      .bind(newTickets, newTicketsUpdatedAt, characterId, storedTickets, storedUpdatedAt)
      .run();
    if (!reserved.meta || !reserved.meta.changes) return json({ error: "ticket_conflict", retry: true });
  } else if (!paidDiamonds) {
    return json({ error: "no_tickets", diamondRefillCost: PVP_DIAMOND_REFILL_COST, ticketsRegenSeconds: pvpTicketsSecondsToNext(ticketState.updatedAt) });
  } else {
    const charged = await db.prepare(`UPDATE players SET diamonds = diamonds - ? WHERE id = ? AND diamonds >= ?`).bind(PVP_DIAMOND_REFILL_COST, id, PVP_DIAMOND_REFILL_COST).run();
    if (!charged.meta || !charged.meta.changes) return json({ error: "insufficient_diamonds", diamondRefillCost: PVP_DIAMOND_REFILL_COST });
    diamondsSpent = PVP_DIAMOND_REFILL_COST;
  }

  const { active, skillLevels } = parsePetsJson(character);
  const myHero = pvpHeroUnit(character, itemsRes.results || [], "team_a_hero", character.name || "You", skillLevels);
  const myPet = active ? pvpPetUnit(active, "team_a_pet") : null;
  const oppHero = { ...oppLoadout.hero, id: "team_b_hero" };
  const oppPet = oppLoadout.pet ? { ...oppLoadout.pet, id: "team_b_pet" } : null;

  let state = BATTLE_CORE_V1.createArenaBattle({
    seed: Math.floor(Math.random() * 0xffffffff),
    teamA: { hero: myHero, pet: myPet },
    teamB: { hero: oppHero, pet: oppPet },
  });
  state = pvpAutoAdvance(state);

  const matchId = crypto.randomUUID();
  const now = nowIso();
  let result = null;
  if (state.result) result = await settleArenaMatch(db, characterId, opponentCharacterId, state);
  await db
    .prepare(`INSERT INTO pvp_matches (match_id, attacker_character_id, attacker_player_id, defender_character_id, status, turn, state_json, result_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(matchId, characterId, id, opponentCharacterId, result ? "done" : "active", state.round, JSON.stringify(state), result ? JSON.stringify(result) : "", now, now)
    .run();

  return json({
    ok: true, matchId, resumed: false, turn: state.round, done: !!result,
    you: pvpUnitPublic(state, "team_a_hero"), yourPet: pvpUnitPublic(state, "team_a_pet"),
    opponent: pvpUnitPublic(state, "team_b_hero"), opponentPet: pvpUnitPublic(state, "team_b_pet"),
    opponentName: oppHero.name || "คู่ต่อสู้",
    skills: pvpHeroSkillsPublic(state.units.team_a_hero),
    log: state.log.map(pvpPublicLogEntry),
    result,
    tickets: newTickets, ticketsMax: PVP_TICKET_MAX, ticketsRegenSeconds: pvpTicketsSecondsToNext(newTicketsUpdatedAt),
    diamondsSpent,
  });
}

// Resolves exactly the player's next hero action, then auto-advances (both Pets, the
// bot's own real active-skill usage) until it's the player's turn again or the match
// ends — settling rating/mailbox here if it does.
async function handleSubmitArenaTurn(db, id, session, characterId, matchId, actionType, skillId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!matchId) return json({ error: "missing_fields" });

  const match = await db.prepare(`SELECT * FROM pvp_matches WHERE match_id = ? AND attacker_character_id = ?`).bind(matchId, characterId).first();
  if (!match) return json({ error: "match_not_found" });
  if (match.status !== "active") return json({ error: "match_already_done" });

  let state = JSON.parse(match.state_json);
  const beforeSeq = state.logSeq;
  const command = actionType === "active" ? { type: "active", skillId } : { type: "basic" };
  const advance = pvpSubmitPlayerTurn(state, command);
  if (advance.error) return json({ error: advance.error });
  state = advance.state;
  const newLog = state.log.filter((e) => e.seq > beforeSeq).map(pvpPublicLogEntry);

  let result = null;
  if (state.result) {
    result = await settleArenaMatch(db, characterId, match.defender_character_id, state);
    await db.prepare(`UPDATE pvp_matches SET status = 'done', turn = ?, state_json = ?, result_json = ?, updated_at = ? WHERE match_id = ?`)
      .bind(state.round, JSON.stringify(state), JSON.stringify(result), nowIso(), matchId).run();
  } else {
    await db.prepare(`UPDATE pvp_matches SET turn = ?, state_json = ?, updated_at = ? WHERE match_id = ?`)
      .bind(state.round, JSON.stringify(state), nowIso(), matchId).run();
  }

  return json({
    ok: true, log: newLog, turn: state.round, done: !!result,
    you: pvpUnitPublic(state, "team_a_hero"), yourPet: pvpUnitPublic(state, "team_a_pet"),
    opponent: pvpUnitPublic(state, "team_b_hero"), opponentPet: pvpUnitPublic(state, "team_b_pet"),
    skills: pvpHeroSkillsPublic(state.units.team_a_hero),
    result,
  });
}



// ---------- admin / QA ----------
function publicPlayerFields(player) {
  if (!player) return player;
  const { password, password_hash, recovery_code_hash, ...safe } = player;
  return safe;
}
async function handleAdminGetPlayer(db, env, adminKey, id) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  if (!id) return json({ error: "missing_fields" });

  const player = await getRow(db, "players", "id", id);
  if (!player) return json({ error: "not_found" });
  const characters = await getRows(db, "characters", "player_id", id);
  const items = await getRows(db, "items", "player_id", id);

  return json({ ok: true, player: publicPlayerFields(player), characters, items });
}

async function handleAdminGetAllPlayers(db, env, adminKey) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);

  const players = await db.prepare(`SELECT * FROM players`).all();
  const characters = await db.prepare(`SELECT * FROM characters`).all();
  return json({ ok: true, players: (players.results || []).map(publicPlayerFields), characters: characters.results || [] });
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

async function handleAdminGetSheet(db, env, adminKey, tableName) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  const allowed = Object.keys(TABLES);
  if (!tableName || allowed.indexOf(tableName) === -1) return json({ error: "invalid_sheet", allowed });

  const table = TABLES[tableName] ? TABLES[tableName].name : tableName;
  const res = await db.prepare(`SELECT * FROM ${table}`).all();
  const rows = tableName === "players" ? (res.results || []).map(publicPlayerFields) : (res.results || []);
  return json({ ok: true, sheet: tableName, rows });
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

// ---------- admin: recipes + monster loot (admin.html) ----------
// Reuses the existing ADMIN_API_KEY / verifyAdminKey infra above — no new secret needed.
// Reading recipes/monster_loot as an admin already works via the existing generic
// `getSheet` action (now that both tables are registered in TABLES); only writes need
// dedicated handlers since getSheet is read-only by design.
async function handleAdminUpsertRecipe(db, env, adminKey, recipeId, type, name, setId, empowerSlotCount, materials) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
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

async function handleAdminDeleteRecipe(db, env, adminKey, recipeId) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  if (!recipeId) return json({ error: "missing_fields" });
  await db.prepare(`DELETE FROM recipes WHERE recipe_id = ?`).bind(recipeId).run();
  return json({ ok: true });
}

async function handleAdminUpsertMonsterLootEntry(db, env, adminKey, entry) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
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

async function handleAdminDeleteMonsterLootEntry(db, env, adminKey, entryId) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  if (!entryId) return json({ error: "missing_fields" });
  await db.prepare(`DELETE FROM monster_loot WHERE entry_id = ?`).bind(entryId).run();
  return json({ ok: true });
}

async function handleAdminUpsertJunkInfo(db, env, adminKey, junkId, name, icon) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
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

async function handleAdminDeleteJunkInfo(db, env, adminKey, junkId) {
  const auth = verifyAdminKey(env, adminKey);
  if (auth.error) return json(auth);
  if (!junkId) return json({ error: "missing_fields" });
  await db.prepare(`DELETE FROM junk_info WHERE junk_id = ?`).bind(junkId).run();
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
        if (action === "getGameConfig") return await handleGetGameConfig(db);
        if (action === "getRecipes") return await handleGetRecipes(db);
        if (action === "getMonsterLoot") return await handleGetMonsterLoot(db);
        if (action === "getJunkInfo") return await handleGetJunkInfo(db);
        if (action === "getLeaderboard") return await handleGetLeaderboard(db, p.get("board"));
        if (action === "getLeaderboardHistory") return await handleGetLeaderboardHistory(db, p.get("board"), p.get("date"));
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
        const auth = await verifySession(db, bearerToken(request));
        if (auth.error) return json({ error: auth.error }, 401);
        const id = auth.row.id;
        if (action === "validateSession") return await handleValidateSession(db, auth);
        if (action === "getRecoveryStatus") return await handleRecoveryStatus(db, auth);
        if (action === "getInventory") return await handleGetInventory(db, id, auth, p.get("characterId"), p.get("page"), p.get("pageSize"));
        if (action === "getDailyLogin") return await handleGetDailyLogin(db, id, auth, p.get("characterId"));
        if (action === "getRaidStatus") return await handleGetRaidStatus(db, id, auth, p.get("characterId"));
        if (action === "getMailbox") return await handleGetMailbox(db, id, auth, p.get("characterId"));
        if (action === "getArenaStatus") return await handleGetArenaStatus(db, id, auth, p.get("characterId"));
        if (action === "getArenaOpponents") return await handleGetArenaOpponents(db, id, auth, p.get("characterId"));
        if (action === "getBattleState") return await handleGetBattleState(db, id, auth, p.get("characterId"));
        return json({ error: "unknown_action" });
      }

      if (request.method === "POST") {
        const body = await request.json();
        const ip = requestIp(request);
        if (body.action === "login") return await handleLogin(db, body.id, body.password, !!body.rememberLogin, ip);
        if (body.action === "register") return await handleRegister(db, body.id, body.password, body.confirmPassword, !!body.rememberLogin, ip);
        if (body.action === "forgotPassword") return await handleForgotPassword(db, body.id, body.recoveryCode, body.newPassword, body.confirmPassword, ip);
        if (["saveGameConfig", "setGameConfigItem", "adminUpsertRecipe", "adminDeleteRecipe", "adminUpsertMonsterLootEntry", "adminDeleteMonsterLootEntry", "adminUpsertJunkInfo", "adminDeleteJunkInfo"].includes(body.action)) {
          switch (body.action) {
            case "saveGameConfig": return await handleAdminSaveGameConfig(db, env, body.adminKey, body.config);
            case "setGameConfigItem": return await handleAdminSetGameConfigItem(db, env, body.adminKey, body.key, body.value);
            case "adminUpsertRecipe": return await handleAdminUpsertRecipe(db, env, body.adminKey, body.recipeId, body.type, body.name, body.setId, body.empowerSlotCount, body.materials);
            case "adminDeleteRecipe": return await handleAdminDeleteRecipe(db, env, body.adminKey, body.recipeId);
            case "adminUpsertMonsterLootEntry": return await handleAdminUpsertMonsterLootEntry(db, env, body.adminKey, body.entry);
            case "adminDeleteMonsterLootEntry": return await handleAdminDeleteMonsterLootEntry(db, env, body.adminKey, body.entryId);
            case "adminUpsertJunkInfo": return await handleAdminUpsertJunkInfo(db, env, body.adminKey, body.junkId, body.name, body.icon);
            case "adminDeleteJunkInfo": return await handleAdminDeleteJunkInfo(db, env, body.adminKey, body.junkId);
          }
        }
        const auth = await verifySession(db, bearerToken(request));
        if (auth.error) return json({ error: auth.error }, 401);
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
          case "saveRunState":
            return await handleSaveRunState(db, id, auth, body.characterId, body.runState);
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
          case "setInventorySlot":
            return await handleSetInventorySlot(db, id, auth, body.itemId, body.inventorySlot);
          case "claimDailyLogin":
            return await handleClaimDailyLogin(db, id, auth, body.characterId);
          case "attackRaidBoss":
            return await handleAttackRaidBoss(db, id, auth, body.characterId, !!body.paidDiamonds);
          case "claimRaidMilestones":
            return await handleClaimRaidMilestones(db, id, auth, body.characterId);
          case "startArenaMatch":
            return await handleStartArenaMatch(db, id, auth, body.characterId, body.opponentCharacterId, !!body.paidDiamonds);
          case "submitArenaTurn":
            return await handleSubmitArenaTurn(db, id, auth, body.characterId, body.matchId, body.actionType, body.skillKey);
          case "claimMail":
            return await handleClaimMail(db, id, auth, body.characterId, body.mailId);
          case "claimAllMail":
            return await handleClaimAllMail(db, id, auth, body.characterId);
          case "deleteMail":
            return await handleDeleteMail(db, id, auth, body.characterId, body.mailId);
          case "deleteMails":
            return await handleDeleteMails(db, id, auth, body.characterId, body.mailIds);
          case "deleteAllClaimedMail":
            return await handleDeleteAllClaimedMail(db, id, auth, body.characterId);
          case "craftItem":
            return await handleCraftItem(db, id, auth, body.characterId, body.recipeId);
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
