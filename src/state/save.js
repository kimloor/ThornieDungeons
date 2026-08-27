// ---------- cloud persistence (Cloudflare D1 via Worker API) ----------
const CONFIG_CACHE_KEY = "thornie-dungeons-cloud-config-v1"; // caches {url,id} only — never the password
const GAME_CONFIG_CACHE_KEY = "thornie-dungeons-game-config-v2"; // caches monster/equipment/pet/skill balance data
const DEFAULT_SERVER_URL = "https://thornie-dungeons-api.ekqtjl.workers.dev";
const defaultSave = () => ({
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
      dex: 0,
      luk: 0
    }
  }
});
