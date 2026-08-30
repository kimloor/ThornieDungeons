// ---------- cloud persistence (Cloudflare D1 via Worker API) ----------
const CONFIG_CACHE_KEY = "thornie-dungeons-cloud-config-v1"; // caches {url,id} only — never the password
const GAME_CONFIG_CACHE_KEY = "thornie-dungeons-game-config-v2"; // caches monster/equipment/pet/skill balance data
const DEFAULT_SERVER_URL = "https://thornie-dungeons-api.ekqtjl.workers.dev";

// ---------- save schema versioning ----------
// Bump this whenever the shape of `defaultSave()` changes (new top-level field, new stat key,
// a field being removed/renamed, etc). Each bump should get a matching entry in SAVE_MIGRATIONS
// below so saves created by older client builds keep loading correctly instead of producing
// `undefined`/`NaN` once the new code tries to read a key that doesn't exist yet in old data.
const CURRENT_SAVE_VERSION = 3;
const MAX_CHARACTER_SLOTS = 3;

// ---------- two distinct shapes in this file — don't mix them up ----------
// 1. ACCOUNT save (defaultSave/hydrateSave/progressToServer/progressFromServer): what actually
//    gets persisted to the server. One account can have up to MAX_CHARACTER_SLOTS characters.
// 2. CHARACTER SLOT (defaultCharacterSlot): one character's own progression — name, level,
//    stats, gold, floor, pets, etc. Items (inventory/equipped) are NOT stored here; they sync
//    separately tagged by the slot's unique `id` (see itemsToServerList/itemsFromServerList in
//    serialize.js) so 3 characters can each have their own gear without a new D1 table.
//
// The rest of the app (combat/shop/blacksmith/inventory/etc) still works with a single flat
// "runtime save" shaped exactly like the OLD pre-multi-character defaultSave() output
// ({gold, character:{...}, pets, unlockedFloor, ...}) — see flattenCharacterForRuntime() /
// packRuntimeIntoSlot() below, which convert between that flat shape and one account slot.
// This means none of the existing ~50 call sites throughout the game that read `save.gold` /
// `save.character` needed to change for this feature.

const defaultCharacterSlot = () => ({
  id: null,
  // Unique per-character id stamped at creation time (e.g. "char-<ts>-<rand>") — used to tag
  // this character's items. A deleted-then-recreated slot gets a brand new id, so it can never
  // accidentally inherit a previous occupant's leftover gear.
  name: "",
  createdAt: 0,
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

const defaultSave = () => ({
  saveVersion: CURRENT_SAVE_VERSION,
  diamonds: 0,
  // Premium currency is account-wide, shared across every character slot — a deliberate
  // design choice (common in multi-character games), not an oversight.
  activeSlot: null,
  // Index (0..MAX_CHARACTER_SLOTS-1) of whichever character was last entered, or null if none
  // has been created/selected yet. Only used to pre-highlight a slot on the Character Select
  // screen — the player always sees that screen after login, this never auto-skips past it.
  characters: new Array(MAX_CHARACTER_SLOTS).fill(null)
});

// ---------- generic hydration helpers ----------
// Number(x)||0 silently turns a *legitimate* 0 into the fallback in some call sites and doesn't
// protect against NaN/Infinity from corrupted data — this is the one safe primitive everything
// below (and serialize.js) should use instead of ad-hoc `Number(x) || fallback`.
function numOr(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// Recursively fills in any key that's missing, mistyped, or NaN in `raw` using `schema`
// (normally the output of defaultSave()/defaultCharacterSlot()) as the source of truth for
// shape + defaults. This is what makes adding a new field "just work" for old saves — no need
// to hand-write a migration every time, only when a value needs something smarter than "default".
function deepHydrate(raw, schema) {
  const out = {};
  Object.keys(schema).forEach(key => {
    const def = schema[key];
    const val = raw && typeof raw === "object" ? raw[key] : undefined;
    if (def === null) {
      // Nullable field (e.g. activePetId, character id) — accept null or string, else fall back.
      out[key] = val === null || typeof val === "string" ? val : def;
    } else if (Array.isArray(def)) {
      out[key] = Array.isArray(val) ? val : def.slice();
    } else if (typeof def === "number") {
      out[key] = numOr(val, def);
    } else if (typeof def === "string") {
      out[key] = typeof val === "string" ? val : def;
    } else if (typeof def === "object") {
      out[key] = deepHydrate(val, def); // nested object (e.g. character, character.stats)
    } else {
      out[key] = val !== undefined ? val : def;
    }
  });
  return out;
}

// Cross-checks a stats object against STAT_INFO (constants.js) — the actual canonical list of
// stat keys the game uses. Second safety net on top of deepHydrate()'s schema comparison: if a
// new stat gets added to STAT_INFO but someone forgets to also add it to defaultCharacterSlot(),
// every character's stats still self-heal instead of showing NaN in the allocation screen.
function ensureStatKeysOn(statsObj) {
  if (typeof STAT_INFO === "undefined" || !Array.isArray(STAT_INFO)) return statsObj;
  STAT_INFO.forEach(s => {
    statsObj[s.key] = numOr(statsObj[s.key], 0);
  });
  return statsObj;
}

// Hydrates one character slot against defaultCharacterSlot()'s schema. A slot with no `id` is
// treated as empty (null) — `id` is what makes a slot "occupied" throughout this feature.
function hydrateCharacterSlot(raw) {
  if (!raw || typeof raw !== "object" || !raw.id) return null;
  const slot = deepHydrate(raw, defaultCharacterSlot());
  ensureStatKeysOn(slot.stats);
  return slot;
}
function hydrateCharacters(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  const out = [];
  for (let i = 0; i < MAX_CHARACTER_SLOTS; i++) out.push(hydrateCharacterSlot(arr[i]));
  return out;
}

// ---------- versioned migrations ----------
// Each entry runs once, in order, for any save whose version is below `to`. Keep these small and
// additive — they exist purely to handle data-shape changes that deepHydrate() can't infer on its
// own (renames, dropping an obsolete field, moving a value from one place to another).
// IMPORTANT: these run on the *raw* pre-hydration object (see hydrateSave below), since v1/v2
// data doesn't have the v3 `characters` shape yet for deepHydrate to even compare against.
const SAVE_MIGRATIONS = [{
  to: 2,
  migrate(save) {
    // v1 -> v2: added the AGI stat (deepHydrate/ensureStatKeysOn already default it to 0), and
    // replaced the old flat `materials: {iron, silver, manaOre}` counters with stackable junk
    // items that live in the inventory instead. Drop the legacy field so it doesn't linger.
    if ("materials" in save) delete save.materials;
    return save;
  }
}, {
  to: 3,
  migrate(save) {
    // v2 and earlier: a single character's data lived at the top level of `save` directly
    // (save.gold, save.character, save.pets, save.unlockedFloor, ...). v3 introduces up to
    // MAX_CHARACTER_SLOTS independent character slots — migrate the existing single character
    // into slot 0 (marked active) so no returning player loses progress.
    if (Array.isArray(save.characters)) return save; // already v3-shaped — nothing to do
    console.warn("[ThornieDungeons] Running v2->v3 character-slot migration. Legacy fields used:", JSON.stringify({
      gold: save.gold,
      unlockedFloor: save.unlockedFloor,
      level: save.character && save.character.level,
      stats: save.character && save.character.stats
    }));
    const legacy = save.character || {};
    const slot0 = {
      id: `char-legacy-${Date.now()}`,
      name: "Character 1",
      createdAt: Date.now(),
      level: numOr(legacy.level, 1),
      xp: numOr(legacy.xp, 0),
      statPoints: numOr(legacy.statPoints, 0),
      stats: {
        ...(legacy.stats || {})
      },
      gold: numOr(save.gold, 0),
      unlockedFloor: numOr(save.unlockedFloor, 1),
      potions: numOr(save.potions, 2),
      pets: Array.isArray(save.pets) ? save.pets : [],
      activePetId: save.activePetId || null,
      protectionStones: numOr(save.protectionStones, 0),
      chestPity: numOr(save.chestPity, 0)
    };
    return {
      saveVersion: save.saveVersion,
      diamonds: numOr(save.diamonds, 0),
      activeSlot: 0,
      characters: [slot0, null, null]
    };
  }
}];
function runSaveMigrations(save) {
  let version = numOr(save.saveVersion, 1);
  SAVE_MIGRATIONS.forEach(step => {
    if (version < step.to) {
      save = step.migrate(save) || save;
      version = step.to;
    }
  });
  save.saveVersion = CURRENT_SAVE_VERSION;
  return save;
}

// Single entry point every save load path (cloud row, brand-new account) should run through.
// Guaranteed to always return a complete, valid account save — never throws, never returns
// something with missing/NaN fields, even if `raw` is null, garbage, or an old pre-versioning
// or pre-multi-character save. Migrations run first (on the raw shape), then the result is
// hydrated against the current schema, then each character slot is hydrated individually
// (deepHydrate's generic array handling doesn't recurse into array *elements*, so `characters`
// needs this explicit second pass).
function hydrateSave(raw) {
  try {
    const migrated = runSaveMigrations(raw && typeof raw === "object" ? {
      ...raw
    } : {});
    const save = deepHydrate(migrated, defaultSave());
    save.characters = hydrateCharacters(migrated.characters);
    // deepHydrate's generic "nullable" branch only accepts null-or-string (it was written for
    // fields like activePetId/character id), so a nullable *number* like activeSlot needs its
    // own explicit handling here instead — otherwise a valid activeSlot of 0 gets silently
    // reset to the schema default (null) since 0 is neither null nor a string.
    save.activeSlot = Number.isInteger(migrated.activeSlot) ? migrated.activeSlot : null;
    if (save.activeSlot !== null && (!Number.isInteger(save.activeSlot) || !save.characters[save.activeSlot])) {
      save.activeSlot = null; // stale/invalid pointer (e.g. that slot got deleted) — never trust it blindly
    }
    return save;
  } catch (e) {
    console.warn("[ThornieDungeons] Save data was corrupted or incompatible — resetting to a fresh save.", e);
    return defaultSave();
  }
}

// Safe JSON.parse that never throws — used for anything read from localStorage or a server JSON
// blob column, where the raw string could be missing, truncated, or otherwise corrupted.
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

// ---------- character slot create / delete ----------
// Both return a NEW account-save object (never mutate the input) — call sites just do
// setAccount(result) and persist as usual.

// Case-insensitive, whitespace-trimmed check for whether `name` is already used by any
// occupied slot on this account (characters within the SAME account only — this can't check
// uniqueness across other players' accounts without a server-side check we don't have).
function isCharacterNameTaken(account, name) {
  const norm = String(name || "").trim().toLowerCase();
  if (!norm) return false;
  return account.characters.some(c => c && c.name.trim().toLowerCase() === norm);
}

function createCharacterInSlot(account, slotIndex, name) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_CHARACTER_SLOTS) return account;
  const characters = account.characters.slice();
  if (characters[slotIndex]) return account; // slot already occupied — caller should check first, no-op here as a safety net
  const cleanName = String(name || "").trim().slice(0, 16);
  const finalName = cleanName || `Character ${slotIndex + 1}`;
  if (isCharacterNameTaken(account, finalName)) return account; // caller should validate first (see isCharacterNameTaken) — no-op here as a safety net
  characters[slotIndex] = {
    ...defaultCharacterSlot(),
    id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: finalName,
    createdAt: Date.now()
    // No starter pet here — pets/activePetId stay at defaultCharacterSlot()'s defaults ([]/null).
    // The starter pet is granted per-character the first time THAT character clears floor 5
    // (see the "alreadyHasStarter" check in App.js's endCombatWin) — giving it at creation would
    // let a fresh character skip that entirely, which isn't the intended design.
  };
  return {
    ...account,
    characters
  };
}

function deleteCharacterInSlot(account, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= MAX_CHARACTER_SLOTS) return account;
  const characters = account.characters.slice();
  characters[slotIndex] = null;
  // Note: that character's items become permanently orphaned server-side (still tagged with its
  // now-unreachable unique id) rather than actively deleted. Harmless leftover data — there's no
  // dedicated "delete items by characterId" server endpoint to call, and since ids are never
  // reused, a future character in this same slot can never accidentally inherit them.
  return {
    ...account,
    characters,
    activeSlot: account.activeSlot === slotIndex ? null : account.activeSlot
  };
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
    // Not read by any existing gameplay code — kept only so App.js can tag this character's
    // items when syncing, and show its name in the UI, without a second piece of state.
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
