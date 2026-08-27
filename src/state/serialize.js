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
    materials_json: JSON.stringify({
      protectionStones: save.protectionStones || 0,
      chestPity: save.chestPity || 0,
      charAgi: save.character.stats.agi || 0
    })
  };
}
function progressFromServer(row) {
  if (!row) return defaultSave();
  let pets = [];
  try {
    pets = row.pets_json ? JSON.parse(row.pets_json) : [];
  } catch (e) {
    pets = [];
  }
  let protectionStones = 0;
  let chestPity = 0;
  let charAgi = 0;
  try {
    if (row.materials_json) {
      const parsed = JSON.parse(row.materials_json);
      protectionStones = Number(parsed.protectionStones) || 0;
      chestPity = Number(parsed.chestPity) || 0;
      charAgi = Number(parsed.charAgi) || 0;
    }
  } catch (e) {}
  return {
    gold: Number(row.bank_gold) || 0,
    diamonds: Number(row.diamonds) || 0,
    unlockedFloor: Number(row.best_floor) || 1,
    potions: row.potions === undefined || row.potions === "" ? 2 : Number(row.potions) || 0,
    pets,
    activePetId: row.active_pet_id || null,
    protectionStones,
    chestPity,
    character: {
      level: Number(row.char_level) || 1,
      xp: Number(row.char_xp) || 0,
      statPoints: Number(row.char_points) || 0,
      stats: {
        str: Number(row.char_str) || 0,
        vit: Number(row.char_vit) || 0,
        agi: charAgi,
        dex: Number(row.char_dex) || 0,
        luk: Number(row.char_luk) || 0
      }
    }
  };
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
  rows.forEach(r => {
    let extra = {};
    try {
      extra = r.extra_json ? JSON.parse(r.extra_json) : {};
    } catch (e) {
      extra = {};
    }
    if (r.slot_type === "junk") {
      inventory.push({
        id: r.item_id,
        type: "junk",
        junkId: extra.junkId,
        name: r.name,
        icon: extra.icon || (JUNK_INFO[extra.junkId] || {}).icon || "📦",
        rarity: r.rarity || "common",
        quantity: Number(extra.quantity) || 1
      });
      return;
    }
    const it = {
      id: r.item_id,
      type: r.slot_type,
      rarity: r.rarity,
      name: r.name,
      atk: Number(r.atk) || 0,
      def: Number(r.def) || 0,
      hp: Number(r.hp) || 0,
      mp: Number(r.mp) || 0,
      dodgeChance: Number(extra.dodgeChance) || 0,
      critChance: Number(extra.critChance) || 0,
      critDamage: Number(extra.critDamage) || 0,
      enhanceLevel: Number(r.enhance_level) || 0,
      empowerSlots: Array.isArray(extra.empowerSlots) ? extra.empowerSlots : Array(RARITY_STARS[r.rarity] || 1).fill(null)
    };
    ["atk", "def", "hp", "mp", "dodgeChance", "critChance", "critDamage"].forEach(k => {
      if (!it[k]) delete it[k];
    });
    if (String(r.equipped) === "1" || r.equipped === true) equipped[r.slot_type] = it;else inventory.push(it);
  });
  return {
    equipped,
    inventory
  };
}

