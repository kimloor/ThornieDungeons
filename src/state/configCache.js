async function loadCachedConfig() {
  try {
    const v = await kvGet(CONFIG_CACHE_KEY);
    if (v) {
      const parsed = JSON.parse(v);
      // Auth V2 never restores the legacy raw password. Rewrite the cache immediately so a
      // password left by an older frontend is removed on first V2 startup.
      const safe = { url: parsed.url || "", id: parsed.id || "" };
      if (parsed.password || parsed.rememberPassword) await writeCachedConfig(safe);
      return safe;
    }
  } catch (e) {}
  return {
    url: "",
    id: ""
  };
}
async function writeCachedConfig(cfg) {
  await kvSet(CONFIG_CACHE_KEY, JSON.stringify({ url: cfg.url || "", id: cfg.id || "" }));
}
async function loadCachedGameConfig() {
  try {
    const v = await kvGet(GAME_CONFIG_CACHE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return null;
}
async function writeCachedGameConfig(cfg) {
  await kvSet(GAME_CONFIG_CACHE_KEY, JSON.stringify(cfg));
}
async function loadCachedRecipes() {
  try {
    const v = await kvGet(RECIPES_CACHE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return null;
}
async function writeCachedRecipes(recipes) {
  await kvSet(RECIPES_CACHE_KEY, JSON.stringify(recipes));
}
async function loadCachedMonsterLoot() {
  try {
    const v = await kvGet(MONSTER_LOOT_CACHE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return null;
}
async function writeCachedMonsterLoot(loot) {
  await kvSet(MONSTER_LOOT_CACHE_KEY, JSON.stringify(loot));
}
async function loadCachedJunkInfo() {
  try {
    const v = await kvGet(JUNK_INFO_CACHE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return null;
}
async function writeCachedJunkInfo(info) {
  await kvSet(JUNK_INFO_CACHE_KEY, JSON.stringify(info));
}
