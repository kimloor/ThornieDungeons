// ---------- character progress <-> server (schema v2: real per-character rows) ----------
// Maps the flat "runtime save" (see save.js) into the field names
// handleSaveCharacterProgress on the server expects — a plain, mostly 1:1 mapping now that
// each character has its own real columns server-side, instead of the old JSON-blob-inside-a-
// single-shared-row trick that turned out to silently drop data (the server's fixed column
// list never even included that blob's column).
function characterProgressToServer(flatSave) {
  return {
    level: flatSave.character.level,
    xp: flatSave.character.xp,
    stat_points: flatSave.character.statPoints,
    str: flatSave.character.stats.str,
    vit: flatSave.character.stats.vit,
    agi: flatSave.character.stats.agi,
    dex: flatSave.character.stats.dex,
    luk: flatSave.character.stats.luk,
    gold: flatSave.gold,
    unlocked_floor: flatSave.unlockedFloor,
    potions: flatSave.potions,
    protection_stones: flatSave.protectionStones,
    chest_pity: flatSave.chestPity,
    // Skill progression shares this existing per-character JSON envelope so it remains cloud
    // persistent without a production D1 schema migration.
    pets_json: JSON.stringify({
      list: flatSave.pets || [],
      dup: flatSave.petDuplicates || {},
      skills: flatSave.character.skillLevels || {},
      skillVersion: 1,
      skillResetPoints: Number(flatSave.character.skillResetPoints) || 0,
      firstClearAccessoryClaims: flatSave.firstClearAccessoryClaims && typeof flatSave.firstClearAccessoryClaims === "object" ? { ...flatSave.firstClearAccessoryClaims } : {},
      battleRewardReceipts: Array.isArray(flatSave.battleRewardReceipts) ? flatSave.battleRewardReceipts.slice(-128) : (Array.isArray(flatSave.rewardReceipts) ? flatSave.rewardReceipts.slice(-128) : []),
      rewardReceipts: Array.isArray(flatSave.battleRewardReceipts) ? flatSave.battleRewardReceipts.slice(-128) : (Array.isArray(flatSave.rewardReceipts) ? flatSave.rewardReceipts.slice(-128) : [])
    }),
    active_pet_id: flatSave.activePetId || ""
  };
}

// ---------- items <-> server ----------
// Standard equipment names changed after launch. Legacy items have no gearTier in extra_json,
// so exact old-name matches can be upgraded once on load. New drops always carry gearTier,
// which disambiguates names intentionally reused across generations (Leather Vest/Boots).
const LEGACY_EQUIPMENT_NAME_MIGRATIONS = Object.freeze({
  weapon: Object.freeze({
    "Wooden Sword": { name: "Beginner Sword", gearTier: 1 },
    "Iron Blade": { name: "Copper Blade", gearTier: 2 },
    "Steel Rapier": { name: "Steel Greatsword", gearTier: 3 },
    "Flame Saber": { name: "Platinum Greatsword", gearTier: 4 },
    "Dragon Fang": { name: "Dragon Slayer Sword", gearTier: 5 }
  }),
  helmet: Object.freeze({
    "Cloth Cap": { name: "Leather Cap", gearTier: 1 },
    "Leather Hood": { name: "Bronze Guard Helm", gearTier: 2 },
    "Iron Helm": { name: "Steel Helm", gearTier: 3 },
    "Horned Helm": { name: "Platinum Helm", gearTier: 4 },
    "Dragonbone Crown": { name: "Dragon Scale Helm", gearTier: 5 }
  }),
  chest: Object.freeze({
    "Cloth Robe": { name: "Leather Vest", gearTier: 1 },
    "Leather Vest": { name: "Bronze Armor", gearTier: 2 },
    "Iron Plate": { name: "Chain Armor", gearTier: 3 },
    "Mystic Cloak": { name: "Platinum Plate Armor", gearTier: 4 },
    "Dragon Scale Mail": { name: "Dragon Scale Armor", gearTier: 5 }
  }),
  gloves: Object.freeze({
    "Cloth Gloves": { name: "Leather Gloves", gearTier: 1 },
    "Leather Gauntlets": { name: "Bronze Gauntlets", gearTier: 2 },
    "Iron Gauntlets": { name: "Chain Gloves", gearTier: 3 },
    "Runed Gloves": { name: "Platinum Gauntlets", gearTier: 4 },
    "Dragonclaw Gauntlets": { name: "Dragonhide Gloves", gearTier: 5 }
  }),
  boots: Object.freeze({
    "Worn Sandals": { name: "Leather Boots", gearTier: 1 },
    "Leather Boots": { name: "Bronze Greaves", gearTier: 2 },
    "Iron Greaves": { name: "Chain Boots", gearTier: 3 },
    "Swift Boots": { name: "Platinum Sabatons", gearTier: 4 },
    "Dragonhide Boots": { name: "Dragonhide Boots", gearTier: 5 }
  })
});
function normalizeEquipmentNameForLoad(type, name, gearTier) {
  const storedTier = Math.max(0, Number(gearTier) || 0);
  if (storedTier) return { name, gearTier: storedTier, migrated: false };
  const legacy = LEGACY_EQUIPMENT_NAME_MIGRATIONS[type]?.[name];
  return legacy ? { ...legacy, migrated: true } : { name, gearTier: 0, migrated: false };
}
// No characterId tagging needed here anymore — syncItems takes characterId as its own
// authenticated top-level parameter (see App.js's pushItems), and the server stamps every row
// with THAT value server-side rather than trusting anything the client puts in extra_json. This
// is what makes it structurally impossible for syncing one character's inventory to touch
// another's: the server's delete-stale-rows query is scoped by character_id, not just player_id.
function itemsToServerList(inventory, equipped, overflow = []) {
  const list = [];
  const pack = (it, equippedFlag) => ({
    itemId: it.id,
    slotType: it.type,
    equipped: equippedFlag,
    rarity: it.rarity,
    name: it.name,
    atk: it.atk,
    def: it.def,
    hp: it.hp,
    mp: it.mp,
    itemLevel: it.level || it.itemLevel || 0,
    enhanceLevel: it.enhanceLevel || 0,
    // dodgeChance/critChance/critDamage (accessory base rolls) and junk/potion stack data
    // (junkId/potionId/quantity/icon) don't have their own server columns, so they ride along
    // inside the extra JSON blob instead (this part is unaffected by the schema-v2 change — the
    // items table's extra_json column was always real, unlike progress.materials_json).
    extra: {
      empowerSlots: it.empowerSlots || [],
      dodgeChance: it.dodgeChance || undefined,
      critChance: it.critChance || undefined,
      critDamage: it.critDamage || undefined,
      junkId: it.junkId || undefined,
      potionId: it.potionId || undefined,
      quantity: it.quantity || undefined,
      icon: it.icon || undefined,
      setId: it.setId || undefined,
      star: it.star || undefined,
      craftRecipeId: it.craftRecipeId || undefined,
      favorite: it.favorite === true || undefined,
      overflow: it.overflow === true || undefined,
      gearTier: it.gearTier || undefined,
      rewardVersion: it.rewardVersion || undefined,
      itemModelVersion: it.itemModelVersion || undefined,
      sourceType: it.sourceType || undefined,
      sourceFloor: it.sourceFloor || undefined,
      specialSource: it.specialSource || undefined,
      sourceIdentity: it.sourceIdentity || undefined,
      empowerSlotCapacity: it.empowerSlotCapacity || undefined,
      utilityStat: it.utilityStat || undefined,
      wingFamily: it.wingFamily || undefined,
      blacksmithVersion: it.blacksmithVersion || undefined,
      blacksmithReceipts: Array.isArray(it.blacksmithReceipts) ? it.blacksmithReceipts.slice(-32) : undefined,
      blacksmithLastResult: it.blacksmithLastResult || undefined,
      bossWeaponId: it.bossWeaponId || undefined,
      signatureId: it.signatureId || undefined,
      sourceBossId: it.sourceBossId || undefined
    }
  });
  Object.values(equipped).forEach(it => {
    if (it) list.push(pack(it, true));
  });
  inventory.forEach(it => list.push(pack(it, false)));
  overflow.forEach(it => list.push(pack({ ...it, overflow: true }, false)));
  return list;
}
function itemsFromServerList(rows) {
  const equipped = emptyEquipped();
  const inventory = [];
  const overflow = [];
  let legacyEquipmentMigrated = false;
  if (!Array.isArray(rows)) return {
    equipped,
    inventory,
    overflow,
    legacyEquipmentMigrated
  };
  rows.forEach(r => {
    // A single malformed row (bad JSON, unexpected type, etc) should never take down the whole
    // inventory load — skip just that row and keep processing the rest.
    try {
      const extra = safeJsonParse(r.extra_json, {});
      if (r.slot_type === "junk") {
        (extra.overflow ? overflow : inventory).push({
          id: r.item_id,
          type: "junk",
          junkId: extra.junkId,
          name: r.name,
          icon: extra.icon || (JUNK_INFO[extra.junkId] || {}).icon || "📦",
          rarity: r.rarity || "common",
          quantity: numOr(extra.quantity, 1),
          favorite: extra.favorite === true,
          ...(extra.sourceType ? { sourceType: String(extra.sourceType) } : {}),
          ...(extra.sourceFloor ? { sourceFloor: numOr(extra.sourceFloor, 0) } : {}),
          ...(extra.sourceIdentity ? { sourceIdentity: String(extra.sourceIdentity) } : {})
        });
        return;
      }
      if (r.slot_type === "potion") {
        const def = getPotionDef(extra.potionId);
        (extra.overflow ? overflow : inventory).push({
          id: r.item_id,
          type: "potion",
          potionId: extra.potionId,
          name: r.name || (def && def.name) || "Potion",
          icon: extra.icon || (def && def.icon) || "🧪",
          rarity: r.rarity || "common",
          quantity: numOr(extra.quantity, 1),
          favorite: extra.favorite === true
        });
        return;
      }
      const normalizedEquipment = normalizeEquipmentNameForLoad(r.slot_type, r.name, extra.gearTier);
      if (normalizedEquipment.migrated) legacyEquipmentMigrated = true;
      const it = {
        id: r.item_id,
        type: r.slot_type,
        rarity: r.rarity,
        name: normalizedEquipment.name,
        atk: numOr(r.atk, 0),
        def: numOr(r.def, 0),
        hp: numOr(r.hp, 0),
        mp: numOr(r.mp, 0),
        dodgeChance: numOr(extra.dodgeChance, 0),
        critChance: numOr(extra.critChance, 0),
        critDamage: numOr(extra.critDamage, 0),
        enhanceLevel: numOr(r.enhance_level, 0),
        level: numOr(r.item_level, 0),
        favorite: extra.favorite === true,
        empowerSlots: Array.isArray(extra.empowerSlots)
          ? extra.empowerSlots
          : (Number(extra.itemModelVersion) === 2 || Number(extra.rewardVersion) === 2
            ? Array(Math.max(0, Number(extra.empowerSlotCapacity) || 0)).fill(null)
            : Array(RARITY_STARS[r.rarity] || 1).fill(null))
      };
      if (normalizedEquipment.gearTier) it.gearTier = normalizedEquipment.gearTier;
      if (extra.setId) it.setId = extra.setId;
      if (extra.star) it.star = numOr(extra.star, 0);
      if (extra.craftRecipeId) it.craftRecipeId = extra.craftRecipeId;
      if (extra.rewardVersion) it.rewardVersion = numOr(extra.rewardVersion, 0);
      if (extra.itemModelVersion) it.itemModelVersion = numOr(extra.itemModelVersion, 0);
      if (extra.empowerSlotCapacity !== undefined) it.empowerSlotCapacity = numOr(extra.empowerSlotCapacity, 0);
      if (extra.utilityStat) it.utilityStat = String(extra.utilityStat);
      if (extra.sourceType) it.sourceType = String(extra.sourceType);
      if (extra.sourceFloor) it.sourceFloor = numOr(extra.sourceFloor, 0);
      if (extra.specialSource) it.specialSource = String(extra.specialSource);
      if (extra.sourceIdentity) it.sourceIdentity = String(extra.sourceIdentity);
      if (extra.wingFamily) it.wingFamily = String(extra.wingFamily);
      if (extra.blacksmithVersion) it.blacksmithVersion = numOr(extra.blacksmithVersion, 0);
      if (Array.isArray(extra.blacksmithReceipts)) it.blacksmithReceipts = extra.blacksmithReceipts.map(String).filter(Boolean).slice(-32);
      if (extra.blacksmithLastResult && typeof extra.blacksmithLastResult === "object") it.blacksmithLastResult = extra.blacksmithLastResult;
      if (extra.bossWeaponId) it.bossWeaponId = String(extra.bossWeaponId);
      if (extra.signatureId) it.signatureId = String(extra.signatureId);
      if (extra.sourceBossId) it.sourceBossId = String(extra.sourceBossId);
      ["atk", "def", "hp", "mp", "dodgeChance", "critChance", "critDamage"].forEach(k => {
        if (!it[k]) delete it[k];
      });
      if (String(r.equipped) === "1" || r.equipped === true) equipped[r.slot_type] = it;
      else if (extra.overflow) overflow.push(it);
      else inventory.push(it);
    } catch (e) {
      console.warn("[ThornieDungeons] Skipped a corrupted item row:", e);
    }
  });
  return {
    equipped,
    inventory,
    overflow,
    legacyEquipmentMigrated
  };
}
