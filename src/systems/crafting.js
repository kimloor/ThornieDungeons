// ---------- Phase 4: Crafting ----------
// Recipes are client-side display data ONLY (icons, names, materials/gold costs, and the
// stat FORMULA used to preview what you'll get). The actual craft is granted by the server
// (handleCraftItem in the worker), which computes the real stats itself the same way — this
// list must stay numerically in sync with the recipes D1 table (materials/gold) and with
// the AZURE_STAT_FORMULA table in the worker (stat math) or the preview will just show a
// number the server doesn't agree with.
//
// Azure gear stats are NOT flat numbers — they scale with the character's unlockedFloor
// using the exact same per-type formulas as normal floor drops (generateDrop in stats.js),
// just with rarity mult fixed at RARITY_MULT.azure (== mythic, see pets.js). This is what
// keeps crafted gear "always current BiS" without needing manual rebalancing every time a
// new floor is added — see the phase-4 design discussion for why flat numbers were rejected.
const CRAFTING_RECIPES = [
  { recipeId: "azure_helmet", type: "helmet", name: "หมวก Azure", icon: "⛑️", materials: { recipe_azure_helmet: 1, bossHorn: 5, bossHide: 5, gold: 300 } },
  { recipeId: "azure_chest", type: "chest", name: "เสื้อ Azure", icon: "🥋", materials: { recipe_azure_chest: 1, bossHorn: 6, bossHide: 6, gold: 350 } },
  { recipeId: "azure_gloves", type: "gloves", name: "ถุงมือ Azure", icon: "🧤", materials: { recipe_azure_gloves: 1, bossHorn: 5, bossHide: 5, gold: 300 } },
  { recipeId: "azure_boots", type: "boots", name: "รองเท้า Azure", icon: "🥾", materials: { recipe_azure_boots: 1, bossHorn: 5, bossHide: 5, gold: 300 } },
  { recipeId: "azure_weapon", type: "weapon", name: "อาวุธ Azure", icon: "⚔️", materials: { recipe_azure_weapon: 1, bossHorn: 8, bossHide: 8, gold: 500 } },
  { recipeId: "azure_ring", type: "accessory", name: "แหวน Azure", icon: "💍", materials: { recipe_azure_ring: 1, bossHorn: 6, bossHide: 6, gold: 350 } }
];

// Mirrors generateDrop()'s per-type formulas in stats.js, pinned to RARITY_MULT.azure.
// KEEP IN SYNC with AZURE_STAT_FORMULA in workers/thornie-dungeons-api.js — the worker is
// authoritative (uses the character's real unlocked_floor at craft time); this copy only
// exists so the UI can show an accurate "you'll get ~X atk" preview before crafting.
const AZURE_STAT_FORMULA = {
  weapon: floor => ({ atk: Math.max(1, Math.round((2 + floor * 0.9) * RARITY_MULT.azure)) }),
  helmet: floor => ({ def: Math.max(1, Math.round((1 + floor * 0.35) * RARITY_MULT.azure)) }),
  chest: floor => ({ def: Math.max(1, Math.round((1.5 + floor * 0.5) * RARITY_MULT.azure)) }),
  gloves: floor => ({ atk: Math.max(1, Math.round((1 + floor * 0.35) * RARITY_MULT.azure)) }),
  boots: floor => ({ def: Math.max(1, Math.round((1 + floor * 0.3) * RARITY_MULT.azure)) }),
  accessory: floor => ({ dodgeChance: Math.round((1 + floor * 0.12) * RARITY_MULT.azure * 10) / 10 })
};

function craftPreviewStats(recipe, floor) {
  const fn = AZURE_STAT_FORMULA[recipe.type];
  return fn ? fn(Math.max(1, floor || 1)) : {};
}

// Salvaging a crafted item returns a portion of what it cost to make: the recipe scroll
// back in full (it's the "proof of design", not consumed materials — refunding it in full
// means salvaging a mis-craft doesn't lose you the recipe, just the raw materials) plus a
// cut of the raw junk materials (bossHorn/bossHide etc, NOT the gold — gold sunk into a
// craft is gone either way, same as any other gold sink in this game).
// CRAFT_SALVAGE_REFUND_RATE is a tunable balance knob, easy to adjust later.
const CRAFT_SALVAGE_REFUND_RATE = 0.5;
function craftSalvageRefund(item) {
  if (!item || item.setId !== "azure") return null;
  // Prefer the exact recipe stamped on the item at craft time (craftRecipeId); fall back to
  // matching by type for older crafted items from before that field existed.
  const recipe = CRAFTING_RECIPES.find(r => r.recipeId === item.craftRecipeId) || CRAFTING_RECIPES.find(r => r.type === item.type);
  if (!recipe) return null;
  const refund = [];
  Object.keys(recipe.materials).forEach(key => {
    if (key === "gold") return; // gold sunk into a craft isn't recoverable, same as any other gold sink
    const original = recipe.materials[key];
    // The recipe's own scroll (recipe_azure_*) always comes back in full; raw farmed
    // materials (bossHorn/bossHide) come back at the partial refund rate.
    const qty = key.indexOf("recipe_") === 0 ? original : Math.max(1, Math.floor(original * CRAFT_SALVAGE_REFUND_RATE));
    if (qty > 0) refund.push({ junkId: key, qty });
  });
  return refund;
}

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
