async function loadCachedConfig() {
  try {
    const v = await kvGet(CONFIG_CACHE_KEY);
    if (v) return JSON.parse(v);
  } catch (e) {}
  return {
    url: "",
    id: "",
    password: "",
    rememberPassword: false
  };
}
async function writeCachedConfig(cfg) {
  await kvSet(CONFIG_CACHE_KEY, JSON.stringify(cfg));
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
