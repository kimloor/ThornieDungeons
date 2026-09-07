// ---------- Phase 4: Crafting ----------
// Recipes are client-side display data ONLY (icons, names, and the material/gold costs
// shown in the UI so players can see what they need before tapping Craft). The actual
// craft is granted by the server (handleCraftItem in the worker), which reads the same
// costs from the `recipes` D1 table as the single source of truth — this list must stay
// numerically in sync with those rows (and with AZURE_SET_DEFS in the worker) or the UI
// will just show a wrong "you have enough" state that the server then rejects.
const CRAFTING_RECIPES = [
  {
    recipeId: "azure_helmet",
    type: "helmet",
    name: "หมวก Azure",
    icon: "⛑️",
    atk: 0,
    def: 60,
    dodgeChance: 0,
    materials: { recipe_azure_helmet: 1, bossHorn: 5, bossHide: 5, gold: 300 }
  },
  {
    recipeId: "azure_chest",
    type: "chest",
    name: "เสื้อ Azure",
    icon: "🥋",
    atk: 0,
    def: 90,
    dodgeChance: 0,
    materials: { recipe_azure_chest: 1, bossHorn: 6, bossHide: 6, gold: 350 }
  },
  {
    recipeId: "azure_gloves",
    type: "gloves",
    name: "ถุงมือ Azure",
    icon: "🧤",
    atk: 40,
    def: 0,
    dodgeChance: 0,
    materials: { recipe_azure_gloves: 1, bossHorn: 5, bossHide: 5, gold: 300 }
  },
  {
    recipeId: "azure_boots",
    type: "boots",
    name: "รองเท้า Azure",
    icon: "🥾",
    atk: 0,
    def: 45,
    dodgeChance: 0,
    materials: { recipe_azure_boots: 1, bossHorn: 5, bossHide: 5, gold: 300 }
  },
  {
    recipeId: "azure_weapon",
    type: "weapon",
    name: "อาวุธ Azure",
    icon: "⚔️",
    atk: 120,
    def: 0,
    dodgeChance: 0,
    materials: { recipe_azure_weapon: 1, bossHorn: 8, bossHide: 8, gold: 500 }
  },
  {
    recipeId: "azure_ring",
    type: "accessory",
    name: "แหวน Azure",
    icon: "💍",
    atk: 0,
    def: 0,
    dodgeChance: 15,
    materials: { recipe_azure_ring: 1, bossHorn: 6, bossHide: 6, gold: 350 }
  }
];

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
