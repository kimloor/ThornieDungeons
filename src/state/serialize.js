// progress <-> server row (reuses existing column names: bank_gold now holds `gold`, best_floor now holds `unlockedFloor`)
function progressToServer(save) {
  return {
    bank_gold: save.gold,
    diamonds: save.diamonds,
    best_floor: save.unlockedFloor,
    potions: save.potions,
    char_level: save.character.level,
    char_xp: save.character.xp,
    char_points: save.character.statPoints,
    char_str: save.character.stats.str,
    char_vit: save.character.stats.vit,
    char_dex: save.character.stats.dex,
    char_luk: save.character.stats.luk,
    pets_json: JSON.stringify(save.pets || []),
    active_pet_id: save.activePetId || "",
    // Iron / mana stone used to live here as raw counters, but they're now regular stackable
    // junk items synced through itemsToServerList instead, so this blob only keeps the misc bits.
    // AGI also rides here (instead of a new char_agi column) so no D1 schema migration is required.
    // `v` stamps the save schema version at write time — mainly useful for debugging/telemetry;
    // the authoritative version used for migrations is whatever hydrateSave() resolves on load.
    materials_json: JSON.stringify({
      v: save.saveVersion || CURRENT_SAVE_VERSION,
      protectionStones: save.protectionStones || 0,
      chestPity: save.chestPity || 0,
      charAgi: save.character.stats.agi || 0
    })
  };
}

// Rebuilds a client save object from a D1 row. Never throws and never leaves a field
// undefined/NaN, no matter how old or malformed the row's JSON blobs are — every value goes
// through numOr()/safeJsonParse(), and the whole result is run through hydrateSave() at the end
// so any field this function doesn't explicitly know about yet still gets a safe default and any
// pending version migration (see SAVE_MIGRATIONS in save.js) still gets applied.
function progressFromServer(row) {
  if (!row) return defaultSave();
  const pets = safeJsonParse(row.pets_json, []);
  const materials = safeJsonParse(row.materials_json, {});
  const raw = {
    saveVersion: numOr(materials.v, 1), // rows written before this field existed default to v1
    gold: numOr(row.bank_gold, 0),
    diamonds: numOr(row.diamonds, 0),
    unlockedFloor: numOr(row.best_floor, 1),
    // potions historically distinguished "missing column" (-> starter 2) from "explicitly 0",
    // so it can't just use numOr's single fallback the way every other field can.
    potions: row.potions === undefined || row.potions === null || row.potions === "" ? 2 : numOr(row.potions, 0),
    pets: Array.isArray(pets) ? pets : [],
    activePetId: row.active_pet_id || null,
    protectionStones: numOr(materials.protectionStones, 0),
    chestPity: numOr(materials.chestPity, 0),
    character: {
      level: numOr(row.char_level, 1),
      xp: numOr(row.char_xp, 0),
      statPoints: numOr(row.char_points, 0),
      stats: {
        str: numOr(row.char_str, 0),
        vit: numOr(row.char_vit, 0),
        agi: numOr(materials.charAgi, 0),
        dex: numOr(row.char_dex, 0),
        luk: numOr(row.char_luk, 0)
      }
    }
  };
  // Final safety net: fills in anything missing against the current defaultSave() schema,
  // cross-checks stat keys against STAT_INFO, and runs any pending saveVersion migrations.
  return hydrateSave(raw);
}
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
    // dodgeChance/critChance/critDamage (accessory base rolls) and junk stack data
    // (junkId/quantity/icon) don't have their own server columns, so they all ride
    // along inside the extra JSON blob instead.
    extra: {
      empowerSlots: it.empowerSlots || [],
      dodgeChance: it.dodgeChance || undefined,
      critChance: it.critChance || undefined,
      critDamage: it.critDamage || undefined,
      junkId: it.junkId || undefined,
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

