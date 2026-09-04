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
    pets_json: JSON.stringify({ list: flatSave.pets || [], dup: flatSave.petDuplicates || {} }),
    active_pet_id: flatSave.activePetId || ""
  };
}

// ---------- items <-> server ----------
// No characterId tagging needed here anymore — syncItems takes characterId as its own
// authenticated top-level parameter (see App.js's pushItems), and the server stamps every row
// with THAT value server-side rather than trusting anything the client puts in extra_json. This
// is what makes it structurally impossible for syncing one character's inventory to touch
// another's: the server's delete-stale-rows query is scoped by character_id, not just player_id.
function itemsToServerList(inventory, equipped) {
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
      icon: it.icon || undefined
    }
  });
  Object.values(equipped).forEach(it => {
    if (it) list.push(pack(it, true));
  });
  inventory.forEach(it => list.push(pack(it, false)));
  return list;
}
function itemsFromServerList(rows) {
  const equipped = emptyEquipped();
  const inventory = [];
  if (!Array.isArray(rows)) return {
    equipped,
    inventory
  };
  rows.forEach(r => {
    // A single malformed row (bad JSON, unexpected type, etc) should never take down the whole
    // inventory load — skip just that row and keep processing the rest.
    try {
      const extra = safeJsonParse(r.extra_json, {});
      if (r.slot_type === "junk") {
        inventory.push({
          id: r.item_id,
          type: "junk",
          junkId: extra.junkId,
          name: r.name,
          icon: extra.icon || (JUNK_INFO[extra.junkId] || {}).icon || "📦",
          rarity: r.rarity || "common",
          quantity: numOr(extra.quantity, 1)
        });
        return;
      }
      if (r.slot_type === "potion") {
        const def = getPotionDef(extra.potionId);
        inventory.push({
          id: r.item_id,
          type: "potion",
          potionId: extra.potionId,
          name: r.name || (def && def.name) || "Potion",
          icon: extra.icon || (def && def.icon) || "🧪",
          rarity: r.rarity || "common",
          quantity: numOr(extra.quantity, 1)
        });
        return;
      }
      const it = {
        id: r.item_id,
        type: r.slot_type,
        rarity: r.rarity,
        name: r.name,
        atk: numOr(r.atk, 0),
        def: numOr(r.def, 0),
        hp: numOr(r.hp, 0),
        mp: numOr(r.mp, 0),
        dodgeChance: numOr(extra.dodgeChance, 0),
        critChance: numOr(extra.critChance, 0),
        critDamage: numOr(extra.critDamage, 0),
        enhanceLevel: numOr(r.enhance_level, 0),
        empowerSlots: Array.isArray(extra.empowerSlots) ? extra.empowerSlots : Array(RARITY_STARS[r.rarity] || 1).fill(null)
      };
      ["atk", "def", "hp", "mp", "dodgeChance", "critChance", "critDamage"].forEach(k => {
        if (!it[k]) delete it[k];
      });
      if (String(r.equipped) === "1" || r.equipped === true) equipped[r.slot_type] = it;else inventory.push(it);
    } catch (e) {
      console.warn("[ThornieDungeons] Skipped a corrupted item row:", e);
    }
  });
  return {
    equipped,
    inventory
  };
}
