// ---------- Phase 4: Crafting ----------
// Recipes are fetched from the server on app load (getRecipes, see api.js/App.js) rather
// than hardcoded — this is what lets Kimmie add a whole new crafted set later with just a
// `recipes` D1 insert, no client code change or redeploy. CRAFTING_RECIPES starts as a
// small built-in fallback (today's 6 Azure pieces) so the Craft screen still works if the
// fetch fails and there's no cache yet; applyRecipes() below replaces it wholesale once
// real data comes back, same pattern as applyGameConfig() for RARITY_MULT/ENEMY_POOL/etc.
let CRAFTING_RECIPES = [
  { recipeId: "azure_helmet", type: "helmet", name: "หมวก Azure", materials: { recipe_azure_helmet: 1, bossHorn: 5, bossHide: 5, gold: 300 } },
  { recipeId: "azure_chest", type: "chest", name: "เสื้อ Azure", materials: { recipe_azure_chest: 1, bossHorn: 6, bossHide: 6, gold: 350 } },
  { recipeId: "azure_gloves", type: "gloves", name: "ถุงมือ Azure", materials: { recipe_azure_gloves: 1, bossHorn: 5, bossHide: 5, gold: 300 } },
  { recipeId: "azure_boots", type: "boots", name: "รองเท้า Azure", materials: { recipe_azure_boots: 1, bossHorn: 5, bossHide: 5, gold: 300 } },
  { recipeId: "azure_weapon", type: "weapon", name: "อาวุธ Azure", materials: { recipe_azure_weapon: 1, bossHorn: 8, bossHide: 8, gold: 500 } },
  { recipeId: "azure_ring", type: "accessory", name: "แหวน Azure", materials: { recipe_azure_ring: 1, bossHorn: 6, bossHide: 6, gold: 350 } }
];
// Recipes only carry type/name/materials from the server — icon is purely presentational
// and looked up locally by type, so new crafted types (if any are ever added beyond the
// existing 6 gear slots) just need an entry here, not a schema change.
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
  if (valid.length) CRAFTING_RECIPES = valid;
}

// Mirrors generateDrop()'s per-type formulas in stats.js, pinned to CRAFTED_RARITY_MULT.
// KEEP IN SYNC with CRAFTED_STAT_FORMULA in workers/thornie-dungeons-api.js — the worker is
// authoritative (uses the character's real unlocked_floor at craft time); this copy only
// exists so the UI can show an accurate "you'll get ~X atk" preview before crafting. Shared
// by every crafted set (present and future) — mythic is this game's permanent rarity
// ceiling, so all crafted output is pinned to that same ceiling regardless of setId.
const CRAFTED_RARITY_MULT = 5.4;
const CRAFTED_STAT_FORMULA = {
  weapon: floor => ({ atk: Math.max(1, Math.round((2 + floor * 0.9) * CRAFTED_RARITY_MULT)) }),
  helmet: floor => ({ def: Math.max(1, Math.round((1 + floor * 0.35) * CRAFTED_RARITY_MULT)) }),
  chest: floor => ({ def: Math.max(1, Math.round((1.5 + floor * 0.5) * CRAFTED_RARITY_MULT)) }),
  gloves: floor => ({ atk: Math.max(1, Math.round((1 + floor * 0.35) * CRAFTED_RARITY_MULT)) }),
  boots: floor => ({ def: Math.max(1, Math.round((1 + floor * 0.3) * CRAFTED_RARITY_MULT)) }),
  accessory: floor => ({ dodgeChance: Math.round((1 + floor * 0.12) * CRAFTED_RARITY_MULT * 10) / 10 })
};

function craftPreviewStats(recipe, floor) {
  const fn = CRAFTED_STAT_FORMULA[recipe.type];
  return fn ? fn(Math.max(1, floor || 1)) : {};
}

// Salvaging a crafted item returns a portion of what it cost to make: the recipe scroll
// back in full (it's the "proof of design", not consumed materials — refunding it in full
// means salvaging a mis-craft doesn't lose you the recipe, just the raw materials) plus a
// cut of the raw junk materials (bossHorn/bossHide etc, NOT the gold — gold sunk into a
// craft is gone either way, same as any other gold sink in this game). This works for ANY
// crafted item (Azure today, any future set) because it keys off craftRecipeId — the exact
// recipe stamped on the item at craft time — rather than checking a specific setId string.
// CRAFT_SALVAGE_REFUND_RATE is a tunable balance knob, easy to adjust later.
const CRAFT_SALVAGE_REFUND_RATE = 0.5;
function craftSalvageRefund(item) {
  if (!item) return null;
  // craftRecipeId is the source of truth (stamped by the worker at craft time and carried
  // through extra_json ever since). Fall back to matching by type only for items crafted
  // before that field existed — a small, closing window, and only ambiguous if two recipes
  // ever target the same type, which isn't the case for the legacy Azure-only data it covers.
  const recipe = (item.craftRecipeId && CRAFTING_RECIPES.find(r => r.recipeId === item.craftRecipeId))
    || (item.setId === "azure" && !item.craftRecipeId ? CRAFTING_RECIPES.find(r => r.type === item.type) : null);
  if (!recipe) return null;
  const refund = [];
  Object.keys(recipe.materials).forEach(key => {
    if (key === "gold") return; // gold sunk into a craft isn't recoverable, same as any other gold sink
    const original = recipe.materials[key];
    // The recipe's own scroll (recipe_*) always comes back in full; raw farmed materials
    // (bossHorn/bossHide etc) come back at the partial refund rate.
    const qty = key.indexOf("recipe_") === 0 ? original : Math.max(1, Math.floor(original * CRAFT_SALVAGE_REFUND_RATE));
    if (qty > 0) refund.push({ junkId: key, qty });
  });
  return refund;
}

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
