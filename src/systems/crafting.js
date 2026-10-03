// ---------- Wave 4 Mythic Crafting ----------
// W4 recipes are canonical contract data. Remote rows may add legacy presentation
// entries, but cannot replace W4 identity, costs, Tier, or generated stats.
let CRAFTING_RECIPES = [];
function refreshMythicRecipes(floor = 1) {
  CRAFTING_RECIPES = MYTHIC_V2.allRecipes(floor);
  return CRAFTING_RECIPES;
}
refreshMythicRecipes(1);
const CRAFT_ICON_BY_TYPE = {
  helmet: "⛑️", chest: "🥋", gloves: "🧤", boots: "🥾", weapon: "⚔️", accessory: "💍"
};
function craftIcon(recipe) {
  return CRAFT_ICON_BY_TYPE[recipe.type] || "📦";
}
// Applies a freshly-fetched recipe list from getRecipes. Defensive like applyGameConfig()
// — a malformed/empty response should never wipe out a working recipe list.
function applyRecipes(list) {
  if (!Array.isArray(list) || !list.length) return;
  const valid = list.filter(r => r && r.recipeId && r.type && r.materials);
  if (valid.length) {
    const canonical = new Map(CRAFTING_RECIPES.map(recipe => [recipe.recipeId, recipe]));
    valid.forEach(recipe => { if (!canonical.has(recipe.recipeId)) canonical.set(recipe.recipeId, recipe); });
    CRAFTING_RECIPES = [...canonical.values()];
  }
}

function craftPreviewStats(recipe, floor) {
  const canonical = MYTHIC_V2.recipeById(recipe.recipeId, floor);
  const item = canonical ? MYTHIC_V2.createMythicItem(canonical, floor, () => 0) : null;
  return item ? { atk: item.atk || 0, def: item.def || 0, dodgeChance: item.dodgeChance || 0, critChance: item.critChance || 0, critDamage: item.critDamage || 0 } : {};
}

// W4 V2 items use source-aware salvage above. The old refund table remains only for
// pre-V2 crafted inventory until the separately approved W6 cleanup.
const CRAFT_SALVAGE_REFUND_RATE = 0.5;
// junkTotal()/JUNK_INFO come from enhancement.js (earlier module in build order).
function craftMaterialTotal(inventory, junkId) {
  return junkTotal(inventory, junkId);
}

// Returns { ok, missing: [{junkId,need,have}], goldOk } — used to gray out the Craft
// button and show what's missing, without needing a server round trip just to check.
function canAffordRecipe(recipe, inventory, gold) {
  const missing = [];
  Object.keys(recipe.materials).forEach(key => {
    if (key === "gold") return;
    const need = recipe.materials[key];
    const have = craftMaterialTotal(inventory, key);
    if (have < need) missing.push({ junkId: key, need, have });
  });
  const goldNeed = recipe.materials.gold || 0;
  const goldOk = (gold || 0) >= goldNeed;
  return { ok: missing.length === 0 && goldOk, missing, goldOk, goldNeed };
}
