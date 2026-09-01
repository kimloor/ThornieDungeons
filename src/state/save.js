// ---------- cloud persistence (Cloudflare D1 via Worker API) ----------
const CONFIG_CACHE_KEY = "thornie-dungeons-cloud-config-v1"; // caches {url,id} only — never the password
const GAME_CONFIG_CACHE_KEY = "thornie-dungeons-game-config-v2"; // caches monster/equipment/pet/skill balance data
const DEFAULT_SERVER_URL = "https://thornie-dungeons-api.ekqtjl.workers.dev";

// ---------- save schema version ----------
// v4: switched to the schema-v2 API worker — each character now has its own real row in a
// `characters` table server-side (character_id primary key), instead of being squeezed into a
// single JSON blob column that the old worker's D1 schema didn't even have a column for (the
// actual root cause of the "a character disappeared" bug: the client was correctly sending a
// `materials_json` field every save, but the server's fixed INSERT column list silently dropped
// anything not in it — confirmed by testing directly against the real worker logic with SQLite).
// The server is now the authority on which characters exist; this file's job is just to hold
// and safely shape whatever it returns, not to reconstruct/migrate that structure itself.
const CURRENT_SAVE_VERSION = 4;
const MAX_CHARACTER_SLOTS = 3;

// ---------- safe parsing primitives ----------
// Number(x)||0 silently turns a *legitimate* 0 into the fallback in some call sites and doesn't
// protect against NaN/Infinity from corrupted data — this is the one safe primitive everything
// below (and serialize.js) should use instead of ad-hoc `Number(x) || fallback`.
function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Safe JSON.parse that never throws — used for anything read from localStorage or a server JSON
// column (e.g. an item's extra_json, a character's pets_json), where the raw string could be
// missing, truncated, or otherwise corrupted.
function safeJsonParse(str, fallback = null) {
  if (!str) return fallback;
  try {
    const parsed = JSON.parse(str);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    console.warn("[ThornieDungeons] Failed to parse stored JSON, using fallback.", e);
    return fallback;
  }
}

// ---------- two distinct shapes in this file — don't mix them up ----------
// 1. ACCOUNT save ({saveVersion, diamonds, activeSlot, characters}): built fresh from the
//    server's `login` response every session — never itself round-tripped back to the server
//    as one blob (each field is written back through its own dedicated endpoint instead:
//    createCharacter / deleteCharacter / saveCharacterProgress / syncItems / saveRunState).
// 2. CHARACTER SLOT (defaultCharacterSlot / characterFromServerRow): one character's own
//    progression — name, level, stats, gold, floor, pets, etc.
//
// The rest of the app (combat/shop/blacksmith/inventory/etc) still works with a single flat
// "runtime save" shaped like the pre-multi-character defaultSave() output
// ({gold, character:{...}, pets, unlockedFloor, ...}) — see flattenCharacterForRuntime() /
// packRuntimeIntoSlot() below, which convert between that flat shape and one account slot.
// This means none of the ~50 call sites throughout the game that read `save.gold` /
// `save.character` needed to change for any of this.

const defaultCharacterSlot = () => ({
  id: null,
  name: "",
  level: 1,
  xp: 0,
  statPoints: 0,
  stats: {
    str: 0,
    vit: 0,
    agi: 0,
    dex: 0,
    luk: 0
  },
  gold: 0,
  unlockedFloor: 1,
  potions: 2,
  pets: [],
  activePetId: null,
  protectionStones: 0,
  chestPity: 0
});

// Converts one `characters` table row (snake_case, straight from the server) into the client's
// camelCase slot shape. Defensive the same way the old hydration layer was — a garbled/partial
// row should never let NaN or undefined leak into gameplay math.
function characterFromServerRow(row) {
  if (!row) return null;
  const pets = safeJsonParse(row.pets_json, []);
  return {
    id: row.character_id,
    name: row.name || "",
    level: numOr(row.level, 1),
    xp: numOr(row.xp, 0),
    statPoints: numOr(row.stat_points, 0),
    stats: {
      str: numOr(row.str, 0),
      vit: numOr(row.vit, 0),
      agi: numOr(row.agi, 0),
      dex: numOr(row.dex, 0),
      luk: numOr(row.luk, 0)
    },
    gold: numOr(row.gold, 0),
    unlockedFloor: numOr(row.unlocked_floor, 1),
    potions: row.potions === undefined || row.potions === null ? 2 : numOr(row.potions, 0),
    pets: Array.isArray(pets) ? pets : [],
    activePetId: row.active_pet_id || null,
    protectionStones: numOr(row.protection_stones, 0),
    chestPity: numOr(row.chest_pity, 0)
  };
}

function defaultSave() {
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    diamonds: 0,
    activeSlot: null,
    characters: new Array(MAX_CHARACTER_SLOTS).fill(null)
  };
}

// Builds the account shape straight from a fresh `login` (or post-create/delete refresh)
// response — this is the ONE place server data becomes the client's account state, so every
// field here is read defensively (numOr/Array checks) in case of a partial/odd response.
function accountFromLoginResponse(res) {
  const characters = new Array(MAX_CHARACTER_SLOTS).fill(null);
  (Array.isArray(res.characters) ? res.characters : []).forEach(row => {
    const slot = Number(row.slot_index);
    if (Number.isInteger(slot) && slot >= 0 && slot < MAX_CHARACTER_SLOTS) {
      characters[slot] = characterFromServerRow(row);
    }
  });
  const rawActiveSlot = res.player && res.player.activeSlot;
  const activeSlot = Number.isInteger(rawActiveSlot) && characters[rawActiveSlot] ? rawActiveSlot : null;
  return {
    saveVersion: CURRENT_SAVE_VERSION,
    diamonds: numOr(res.player && res.player.diamonds, 0),
    activeSlot,
    characters
  };
}

// Case-insensitive, whitespace-trimmed check for whether `name` is already used by any occupied
// slot on THIS account. Used for instant client-side feedback before even hitting the server;
// the server (handleCreateCharacter) enforces the same rule authoritatively, so this is purely a
// UX nicety, not the actual guarantee — a name collision from a race between two tabs would
// still be caught (and reported) by the server's response.
function isCharacterNameTaken(account, name) {
  const norm = String(name || "").trim().toLowerCase();
  if (!norm) return false;
  return account.characters.some(c => c && c.name.trim().toLowerCase() === norm);
}

// ---------- flat "runtime save" <-> account character slot adapters ----------
// See the big comment near the top of this file for why these exist.

function flattenCharacterForRuntime(account, slotIndex) {
  const slot = account.characters[slotIndex];
  if (!slot) return null;
  return {
    saveVersion: account.saveVersion,
    diamonds: account.diamonds,
    gold: slot.gold,
    unlockedFloor: slot.unlockedFloor,
    potions: slot.potions,
    pets: slot.pets,
    activePetId: slot.activePetId,
    protectionStones: slot.protectionStones,
    chestPity: slot.chestPity,
    character: {
      level: slot.level,
      xp: slot.xp,
      statPoints: slot.statPoints,
      stats: {
        ...slot.stats
      }
    },
    // Not read by any existing gameplay code — kept only so App.js can address this character
    // in server calls (saveCharacterProgress/syncItems/saveRunState all need characterId) and
    // show its name in the UI, without a second piece of state.
    characterId: slot.id,
    characterName: slot.name
  };
}

function packRuntimeIntoSlot(existingSlot, flatSave) {
  return {
    ...existingSlot,
    level: flatSave.character.level,
    xp: flatSave.character.xp,
    statPoints: flatSave.character.statPoints,
    stats: {
      ...flatSave.character.stats
    },
    gold: flatSave.gold,
    unlockedFloor: flatSave.unlockedFloor,
    potions: flatSave.potions,
    pets: flatSave.pets,
    activePetId: flatSave.activePetId,
    protectionStones: flatSave.protectionStones,
    chestPity: flatSave.chestPity
  };
}
