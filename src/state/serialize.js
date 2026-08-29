// progress <-> server row. The v3 multi-character system stores its real data as JSON inside
// materials_json (same "avoid a D1 schema migration" trick already used for AGI/junk items) —
// the legacy fixed columns (bank_gold, char_level, etc) are mirrored from the ACTIVE character
// purely for backward-compat / in case anything else ever reads them directly; they are not the
// source of truth for anything.
function progressToServer(account) {
  const activeChar = account.activeSlot !== null ? account.characters[account.activeSlot] : null;
  return {
    bank_gold: activeChar ? activeChar.gold : 0,
    diamonds: account.diamonds,
    best_floor: activeChar ? activeChar.unlockedFloor : 1,
    potions: activeChar ? activeChar.potions : 2,
    char_level: activeChar ? activeChar.level : 1,
    char_xp: activeChar ? activeChar.xp : 0,
    char_points: activeChar ? activeChar.statPoints : 0,
    char_str: activeChar ? activeChar.stats.str : 0,
    char_vit: activeChar ? activeChar.stats.vit : 0,
    char_dex: activeChar ? activeChar.stats.dex : 0,
    char_luk: activeChar ? activeChar.stats.luk : 0,
    pets_json: JSON.stringify(activeChar ? activeChar.pets : []),
    active_pet_id: activeChar ? activeChar.activePetId || "" : "",
    // Real source of truth for all MAX_CHARACTER_SLOTS characters lives here.
    materials_json: JSON.stringify({
      v: account.saveVersion || CURRENT_SAVE_VERSION,
      activeSlot: account.activeSlot,
      characters: account.characters
    })
  };
}

// Rebuilds a client account-save from a D1 row. Never throws and never leaves a field
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
    diamonds: numOr(row.diamonds, 0),
    activeSlot: materials.activeSlot,
    // Present only on v3+ saves; absent (undefined) on anything older, which is exactly what
    // tells the v3 migration in save.js to build slot 0 out of the legacy fields below instead.
    characters: materials.characters,
    // Legacy v1/v2 flat fields — read only by the v3 migration, ignored otherwise.
    gold: numOr(row.bank_gold, 0),
    unlockedFloor: numOr(row.best_floor, 1),
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

// Splits raw item rows (as returned by the login/sync API, extra_json still a string) between
// the given character and every other character on the account. Untagged rows (no
// extra.characterId — i.e. items that existed before this feature) are attributed to slot 0
// only, matching the v3 migration story (the pre-existing single character becomes slot 0).
function splitItemRowsBySlot(rows, activeCharacterId, activeSlotIndex) {
  const mine = [];
  const others = [];
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const extra = safeJsonParse(r.extra_json, {});
    const isMine = extra.characterId ? extra.characterId === activeCharacterId : activeSlotIndex === 0;
    (isMine ? mine : others).push(r);
  });
  return {
    mine,
    others
  };
}

function itemsToServerList(inventory, equipped, characterId) {
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
    // dodgeChance/critChance/critDamage (accessory base rolls), junk stack data
    // (junkId/quantity/icon), and now characterId (which of the account's up-to-3 characters
    // owns this item) don't have their own server columns, so they all ride along inside the
    // extra JSON blob instead.
    extra: {
      empowerSlots: it.empowerSlots || [],
      dodgeChance: it.dodgeChance || undefined,
      critChance: it.critChance || undefined,
      critDamage: it.critDamage || undefined,
      junkId: it.junkId || undefined,
      quantity: it.quantity || undefined,
      icon: it.icon || undefined,
      characterId: characterId || undefined
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

