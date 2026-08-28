// ---------- cloud persistence (Cloudflare D1 via Worker API) ----------
const CONFIG_CACHE_KEY = "thornie-dungeons-cloud-config-v1"; // caches {url,id} only — never the password
const GAME_CONFIG_CACHE_KEY = "thornie-dungeons-game-config-v2"; // caches monster/equipment/pet/skill balance data
const DEFAULT_SERVER_URL = "https://thornie-dungeons-api.ekqtjl.workers.dev";

// ---------- save schema versioning ----------
// Bump this whenever the shape of `defaultSave()` changes (new top-level field, new stat key,
// a field being removed/renamed, etc). Each bump should get a matching entry in SAVE_MIGRATIONS
// below so saves created by older client builds keep loading correctly instead of producing
// `undefined`/`NaN` once the new code tries to read a key that doesn't exist yet in old data.
const CURRENT_SAVE_VERSION = 2;

const defaultSave = () => ({
  saveVersion: CURRENT_SAVE_VERSION,
  gold: 0,
  diamonds: 0,
  unlockedFloor: 1,
  potions: 2,
  pets: [],
  activePetId: null,
  protectionStones: 0,
  chestPity: 0,
  character: {
    level: 1,
    xp: 0,
    statPoints: 0,
    stats: {
      str: 0,
      vit: 0,
      agi: 0,
      dex: 0,
      luk: 0
    }
  }
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
// (normally the output of defaultSave()) as the source of truth for shape + defaults.
// This is what makes adding a new field to defaultSave() "just work" for old saves — no need
// to hand-write a migration every time, only when a value needs something smarter than "default".
function deepHydrate(raw, schema) {
  const out = {};
  Object.keys(schema).forEach(key => {
    const def = schema[key];
    const val = raw && typeof raw === "object" ? raw[key] : undefined;
    if (def === null) {
      // Nullable field (e.g. activePetId) — accept null or string, otherwise fall back.
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

// Cross-checks character.stats against STAT_INFO (constants.js) — the actual canonical list of
// stat keys the game uses. This is a second safety net on top of deepHydrate()'s defaultSave()
// comparison: if a new stat gets added to STAT_INFO but someone forgets to also add it to
// defaultSave(), old *and* freshly-created saves still self-heal instead of showing NaN in the
// stat allocation screen.
function ensureStatKeys(save) {
  if (typeof STAT_INFO === "undefined" || !Array.isArray(STAT_INFO)) return save;
  STAT_INFO.forEach(s => {
    save.character.stats[s.key] = numOr(save.character.stats[s.key], 0);
  });
  return save;
}

// ---------- versioned migrations ----------
// Each entry runs once, in order, for any save whose version is below `to`. Keep these small and
// additive — they exist purely to handle data-shape changes that deepHydrate() can't infer on its
// own (renames, dropping an obsolete field, moving a value from one place to another).
const SAVE_MIGRATIONS = [{
  to: 2,
  migrate(save) {
    // v1 -> v2: added the AGI stat (deepHydrate/ensureStatKeys already default it to 0), and
    // replaced the old flat `materials: {iron, silver, manaOre}` counters with stackable junk
    // items that live in the inventory instead. Drop the legacy field so it doesn't linger.
    if ("materials" in save) delete save.materials;
    return save;
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

// Single entry point every save load path (cloud row, localStorage fallback, brand-new account)
// should run through. Guaranteed to always return a complete, valid save object — never throws,
// never returns something with missing/NaN fields, even if `raw` is null, garbage, or an old
// pre-versioning save.
function hydrateSave(raw) {
  try {
    const schema = defaultSave();
    let save = deepHydrate(raw, schema);
    save = ensureStatKeys(save);
    save = runSaveMigrations(save);
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
