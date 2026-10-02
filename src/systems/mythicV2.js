// ---------- Wave 4 Mythic Boss Weapons + Set contract ----------
// Pure shared helpers. Persistence and gameplay RNG remain server/Battle Core owned.
(function mythicV2Factory(root) {
  const SET_IDS = Object.freeze(["azure", "robot", "skeleton"]);
  const SET_SLOTS = Object.freeze(["weapon", "helmet", "chest", "gloves", "boots", "accessory"]);
  const SET_SLOT_COSTS = Object.freeze({
    helmet: Object.freeze({ bossHorn: 5, bossHide: 5, gold: 300 }),
    chest: Object.freeze({ bossHorn: 6, bossHide: 6, gold: 350 }),
    gloves: Object.freeze({ bossHorn: 5, bossHide: 5, gold: 300 }),
    boots: Object.freeze({ bossHorn: 5, bossHide: 5, gold: 300 }),
    weapon: Object.freeze({ bossHorn: 8, bossHide: 8, gold: 500 }),
    accessory: Object.freeze({ bossHorn: 6, bossHide: 6, gold: 350 })
  });
  const BOSS_WEAPONS = Object.freeze({
    spirit_greatsword: Object.freeze({ id: "spirit_greatsword", name: "Spirit Greatsword", bossId: "moss_king", stoneId: "earthStone", signatureId: "spirit_restore", visualId: "spiritGreatsword" }),
    lavalon_sword: Object.freeze({ id: "lavalon_sword", name: "Lavalon Sword", bossId: "ember_drake", stoneId: "fireStone", signatureId: "lavalon_extra_basic", visualId: "lavalonSword" }),
    icicle_longsword: Object.freeze({ id: "icicle_longsword", name: "Icicle Longsword", bossId: "frost_warden", stoneId: "waterStone", signatureId: "icicle_counter", visualId: "icicleLongsword" })
  });
  const BOSS_WEAPON_GOLD = Object.freeze({ 1: 2500, 2: 6000, 3: 10000, 4: 15000, 5: 22500 });
  const STONES = Object.freeze({
    moss_king: Object.freeze({ junkId: "earthStone", name: "Earth Stone" }),
    ember_drake: Object.freeze({ junkId: "fireStone", name: "Fire Stone" }),
    frost_warden: Object.freeze({ junkId: "waterStone", name: "Water Stone" })
  });

  const clean = value => String(value || "").trim().toLowerCase();
  function canonicalSetId(value) { const id = clean(value); return SET_IDS.includes(id) ? id : null; }
  function validSetItem(item) {
    return !!item && Number(item.itemModelVersion) === 2 && clean(item.rarity) === "mythic"
      && SET_SLOTS.includes(clean(item.type)) && !!canonicalSetId(item.setId);
  }
  function setCounts(equipped = {}) {
    const counts = { azure: 0, robot: 0, skeleton: 0 };
    for (const slot of SET_SLOTS) {
      const item = equipped?.[slot];
      if (validSetItem(item) && clean(item.type) === slot) counts[clean(item.setId)] += 1;
    }
    return counts;
  }
  function setEffects(equipped = {}) {
    const counts = setCounts(equipped);
    return Object.freeze({
      counts: Object.freeze({ ...counts }),
      str: counts.skeleton >= 2 ? 5 : 0,
      vit: counts.robot >= 2 ? 5 : 0,
      agi: counts.azure >= 2 ? 5 : 0,
      critDamage: counts.skeleton >= 4 ? 30 : 0,
      activeSkillMpMultiplier: counts.azure >= 4 ? 0.5 : 1,
      ccResist: counts.robot >= 4 ? 10 : 0,
      azureControlProc: counts.azure >= 6,
      skeletonCritArmorBreak: counts.skeleton >= 6,
      robotThresholdDefUp: counts.robot >= 6
    });
  }
  function bossWeapon(item) {
    if (!item || Number(item.itemModelVersion) !== 2 || clean(item.rarity) !== "mythic" || clean(item.type) !== "weapon") return null;
    const id = clean(item.bossWeaponId || item.specialSource || item.sourceIdentity).replace(/^boss_weapon:/, "");
    return BOSS_WEAPONS[id] || Object.values(BOSS_WEAPONS).find(def => clean(item.name) === clean(def.name)) || null;
  }
  function signatureText(item) {
    const signature = bossWeapon(item)?.signatureId || item?.signatureId;
    return ({
      spirit_restore: "โจมตีโดน: 30% ฟื้น HP 10%",
      lavalon_extra_basic: "สกิลโดน: 10%/Hit โจมตีปกติเพิ่ม 1 ครั้ง",
      icicle_counter: "ถูกโจมตี: 20% สวนกลับ 1 ครั้ง"
    })[signature] || "";
  }
  function combatEffects(equipped = {}) {
    const sets = setEffects(equipped);
    const weapon = bossWeapon(equipped.weapon);
    return Object.freeze({
      activeSkillMpMultiplier: sets.activeSkillMpMultiplier,
      ccResist: sets.ccResist,
      azureControlProc: sets.azureControlProc,
      skeletonCritArmorBreak: sets.skeletonCritArmorBreak,
      robotThresholdDefUp: sets.robotThresholdDefUp,
      bossWeaponSignature: weapon?.signatureId || null
    });
  }
  function tierForFloor(floor) {
    const rewards = root.DUNGEON_REWARD_V2;
    return rewards ? rewards.dungeonV2GearTierForFloor(floor) : Math.max(1, Math.min(5, Math.ceil((Number(floor) || 1) / 30)));
  }
  function setRecipeId(setId, slot) { return `${setId}_${slot === "accessory" ? "ring" : slot}`; }
  function setRecipe(setId, slot, floor = 1) {
    const family = canonicalSetId(setId); const type = slot === "ring" ? "accessory" : clean(slot);
    if (!family || !SET_SLOTS.includes(type)) return null;
    const tier = tierForFloor(floor); const base = SET_SLOT_COSTS[type];
    const mult = root.ENHANCEMENT_V2?.TIER_ECONOMY?.[tier] || 1;
    return Object.freeze({ recipeId: setRecipeId(family, type), kind: "set", setId: family, type,
      name: `${family[0].toUpperCase()}${family.slice(1)} ${type[0].toUpperCase()}${type.slice(1)}`,
      materials: Object.freeze({ [`recipe_${setRecipeId(family, type)}`]: 1, bossHorn: base.bossHorn, bossHide: base.bossHide, gold: Math.round(base.gold * mult) }), tier });
  }
  function bossWeaponRecipe(weaponId, floor = 1) {
    const def = BOSS_WEAPONS[clean(weaponId)]; if (!def) return null;
    const tier = tierForFloor(floor);
    return Object.freeze({ recipeId: `boss_weapon_${def.id}`, kind: "boss_weapon", type: "weapon", bossWeaponId: def.id,
      name: def.name, tier, materials: Object.freeze({ [def.stoneId]: 5, gold: BOSS_WEAPON_GOLD[tier] }) });
  }
  function recipeById(recipeId, floor = 1) {
    const id = clean(recipeId);
    if (id.startsWith("boss_weapon_")) return bossWeaponRecipe(id.slice(12), floor);
    for (const family of SET_IDS) for (const slot of SET_SLOTS) if (id === setRecipeId(family, slot)) return setRecipe(family, slot, floor);
    return null;
  }
  function allRecipes(floor = 1) {
    return [...Object.keys(BOSS_WEAPONS).map(id => bossWeaponRecipe(id, floor)), ...SET_IDS.flatMap(setId => SET_SLOTS.map(slot => setRecipe(setId, slot, floor)))];
  }
  function createMythicItem(recipe, floor, rng = Math.random) {
    if (!recipe || !root.DUNGEON_REWARD_V2) return null;
    const sourceFloor = Math.max(1, Math.floor(Number(floor) || 1));
    const item = root.DUNGEON_REWARD_V2.dungeonV2EquipmentItem({ floor: sourceFloor, type: recipe.type, rarity: "mythic",
      sourceType: recipe.kind === "boss_weapon" ? "boss_weapon" : "mythic_set_craft",
      specialSource: recipe.kind === "boss_weapon" ? recipe.bossWeaponId : recipe.setId,
      sourceIdentity: recipe.kind === "boss_weapon" ? `boss_weapon:${recipe.bossWeaponId}` : `mythic_set:${recipe.setId}:${recipe.type}`, rng });
    item.name = recipe.name; item.craftRecipeId = recipe.recipeId; item.empowerSlotCapacity = 4;
    item.empowerSlots = (root.ENHANCEMENT_V2?.fillEmpowerSlots)
      ? root.ENHANCEMENT_V2.fillEmpowerSlots(item.type, "mythic", rng)
      : Array(4).fill(null);
    if (recipe.kind === "boss_weapon") {
      const def = BOSS_WEAPONS[recipe.bossWeaponId];
      item.bossWeaponId = def.id; item.signatureId = def.signatureId; item.sourceBossId = def.bossId;
    } else item.setId = recipe.setId;
    return item;
  }
  function setSalvage(item) {
    if (!validSetItem(item) || !item.craftRecipeId) return null;
    const recipe = recipeById(item.craftRecipeId, item.sourceFloor || 1);
    if (!recipe || recipe.kind !== "set") return null;
    return Object.freeze([{ junkId: "bossHorn", qty: Math.max(1, Math.floor(recipe.materials.bossHorn * 0.5)) }, { junkId: "bossHide", qty: Math.max(1, Math.floor(recipe.materials.bossHide * 0.5)) }]);
  }
  function bossStoneForEnemy(enemyId) { return STONES[clean(enemyId)] || null; }

  const api = Object.freeze({ SET_IDS, SET_SLOTS, SET_SLOT_COSTS, BOSS_WEAPONS, BOSS_WEAPON_GOLD, STONES,
    canonicalSetId, validSetItem, setCounts, setEffects, bossWeapon, signatureText, combatEffects, tierForFloor,
    setRecipeId, setRecipe, bossWeaponRecipe, recipeById, allRecipes, createMythicItem, setSalvage, bossStoneForEnemy });
  root.MYTHIC_V2 = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
