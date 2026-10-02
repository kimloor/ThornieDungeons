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
      // Social Foundation V1 (migration 0014) — server-derived only, like updated_at
      // below; never accept a client-supplied value for this column.
      "last_active_at",
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
  // Friend System V1 (migration 0015). Registered for getRow()/getRows() — every write
  // path uses direct SQL (see the Friend System V1 section below), so `cols` here is
  // informational/for future use rather than load-bearing.
  friend_requests: {
    name: "friend_requests",
    cols: ["request_id", "sender_character_id", "receiver_character_id", "status", "created_at", "expires_at", "resolved_at"],
  },
  friendships: {
    name: "friendships",
    cols: ["character_id_a", "character_id_b", "created_at"],
  },
  // Guild System V1 Core (migration 0017). Registered for getRow()/getRows() —
  // guild_members isn't listed here since every access to it uses direct SQL (composite
  // key, no single-PK getRow lookups).
  guilds: {
    name: "guilds",
    cols: ["guild_id", "name", "normalized_name", "leader_character_id", "created_at", "description", "join_policy", "level", "exp"],
  },
  guild_applications: {
    name: "guild_applications",
    cols: ["application_id", "guild_id", "character_id", "status", "created_at", "resolved_at"],
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
  let extra = {};
  try { extra = it.extra_json ? JSON.parse(it.extra_json) : {}; } catch (e) { extra = {}; }
  const rules = globalThis.ENHANCEMENT_V2;
  const v2Item = { type: it.slot_type, rewardVersion: extra.rewardVersion, itemModelVersion: extra.itemModelVersion, wingFamily: extra.wingFamily || extra.wingId || extra.wingsId || extra.setId };
  const isV2 = !!rules?.isV2Item(v2Item);
  const isV2Wing = isV2 && it.slot_type === "wings";
  const growMult = isV2Wing ? 1 : 1 + lvl * ENHANCE_STAT_PCT;
  const b = {
    atk: (Number(it.atk) || 0) * growMult,
    def: (Number(it.def) || 0) * growMult,
    hp: (Number(it.hp) || 0) * growMult,
    mp: (Number(it.mp) || 0) * growMult,
    critChance: (Number(extra.critChance) || 0) * growMult,
    critDamage: (Number(extra.critDamage) || 0) * growMult,
    dodgeChance: (Number(extra.dodgeChance) || 0) * growMult,
    dropBonus: 0, hpPct: 0, mpPct: 0,
    str: 0, vit: 0, agi: 0, dex: 0, luk: 0,
  };
  if (isV2Wing) {
    const primary = rules.WING_PRIMARY_STAT[rules.wingFamily(v2Item)];
    if (primary) b[primary] += lvl;
  }
  (extra.empowerSlots || []).forEach((slot) => {
    if (!slot) return;
    if (slot.key === "atkPct") b.atk += (Number(it.atk) || 0) * slot.value * (isV2 ? 0.01 : 1);
    else if (slot.key === "defPct") b.def += (Number(it.def) || 0) * slot.value * (isV2 ? 0.01 : 1);
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
  const eb = { atk: 0, def: 0, hp: 0, mp: 0, critChance: 0, critDamage: 0, dodgeChance: 0, dropBonus: 0, hpPct: 0, mpPct: 0, str: 0, vit: 0, agi: 0, dex: 0, luk: 0 };
  (equippedItems || []).forEach((it) => {
    const ib = itemBonus(it);
    Object.keys(ib).forEach((k) => { eb[k] += ib[k]; });
  });
  if (globalThis.MYTHIC_V2) {
    const equipped = {};
    for (const row of equippedItems || []) {
      let extra = {};
      try { extra = JSON.parse(row.extra_json || "{}"); } catch (_) {}
      equipped[row.slot_type] = { type: row.slot_type, rarity: row.rarity, itemModelVersion: extra.itemModelVersion, setId: extra.setId };
    }
    const sets = globalThis.MYTHIC_V2.setEffects(equipped);
    eb.str += sets.str; eb.vit += sets.vit; eb.agi += sets.agi; eb.critDamage += sets.critDamage;
  }
  const adjustedAtk = base.atk + eb.str * 3 + Math.floor((s.dex + eb.dex) * 0.5) - Math.floor(s.dex * 0.5);
  const adjustedDef = base.def + Math.floor((s.vit + eb.vit) * 0.5) - Math.floor(s.vit * 0.5);
  const atk = Math.round(adjustedAtk + eb.atk);
  const def = Math.round(adjustedDef + eb.def);
  const maxHp = Math.round((base.maxHp + eb.vit * 12 + eb.hp) * (1 + eb.hpPct / 100));
  const maxMp = Math.round((base.maxMp + eb.mp) * (1 + eb.mpPct / 100));
  const accuracy = Math.min(99, Math.round((base.accuracy + (eb.accuracy || 0) + eb.dex * 0.5) * 10) / 10 || base.accuracy);
  const critChance = Math.round((base.critChance + eb.critChance + eb.luk * 0.5) * 10) / 10;
  const critDamage = Math.round((base.critDamage + eb.critDamage) * 10) / 10;
  const dodgeChance = Math.round((base.dodgeChance + eb.dodgeChance + eb.agi * 0.5) * 10) / 10;
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


export {
  MAX_CHARACTER_SLOTS, TABLES, ENHANCE_STAT_PCT, BASE_SPEED,
  characterBaseStats, itemBonus, combatPowerFromCharacter,
  PET_BASE_STATS, PET_GROWTH_STATS, PET_STAR_MULT, petCombatPower,
  DAILY_LOGIN_REWARDS, json, nowIso, todayDateKey, yesterdayDateKey,
  dailyLoginReward, newCharacterId, getRow, getRows, upsertRow
};
