function characterBaseStats(save) {
  const lvl = save.character.level;
  const s = save.character.stats;
  return {
    maxHp: 40 + lvl * 4 + s.vit * 12,
    maxMp: 15 + lvl * 2,
    atk: 8 + lvl + s.str * 3 + Math.floor(s.dex * 0.5),
    def: 2 + Math.floor(lvl * 0.4) + Math.floor(s.vit * 0.5),
    accuracy: Math.min(99, +(80 + s.dex * 1.0).toFixed(1)),
    critChance: Math.min(50, +(s.luk * 0.8).toFixed(1)),
    dodgeChance: Math.min(30, +(s.luk * 0.5).toFixed(1)),
    dropBonus: Math.min(20, +(s.luk * 0.35).toFixed(1))
  };
}
function activePetInstance(save) {
  if (!save.activePetId) return null;
  const inst = (save.pets || []).find(p => p.instId === save.activePetId);
  if (!inst) return null;
  const def = getPetDef(inst.defId);
  return def ? {
    inst,
    def
  } : null;
}
function freshPlayerFromSave(save, carry = null) {
  const cb = characterBaseStats(save);
  const petActive = activePetInstance(save);
  const petAtkBoostPct = petActive && petActive.def.passive && petActive.def.passive.type === "atkBoost" ? petActive.def.passive.pct : 0;
  const hp = carry && Number.isFinite(carry.hp) ? Math.max(0, Math.min(cb.maxHp, carry.hp)) : cb.maxHp;
  const mp = carry && Number.isFinite(carry.mp) ? Math.max(0, Math.min(cb.maxMp, carry.mp)) : cb.maxMp;
  return {
    level: save.character.level,
    xp: save.character.xp,
    baseAtk: cb.atk,
    baseDef: cb.def,
    baseMaxHp: cb.maxHp,
    baseMaxMp: cb.maxMp,
    accuracy: cb.accuracy,
    critChance: cb.critChance,
    dodgeChance: cb.dodgeChance,
    dropBonus: cb.dropBonus,
    hp,
    mp,
    atkBuffPct: 0,
    atkBuffTurns: 0,
    defBuffPct: 0,
    defBuffTurns: 0,
    petAtkBoostPct,
    petCooldown: 0,
    weakenPct: 0,
    weakenTurns: 0,
    regenAmount: 0,
    regenTurns: 0
  };
}
function makeEnemy(floor) {
  const isBoss = floor % 5 === 0;
  const isEliteBoss = floor % 10 === 0;
  const modifier = isBoss ? null : rollFloorModifier();
  const pool = isBoss ? BOSS_POOL : ENEMY_POOL;
  const t = pool[Math.floor(Math.random() * pool.length)];
  const mult = isEliteBoss ? 4.2 : isBoss ? 2.6 : 1;
  const hpM = (t.hpMult || 1) * (modifier?.hpMult || 1);
  const atkM = (t.atkMult || 1) * (modifier?.atkMult || 1);
  const defB = t.defBonus || 0;
  const goldM = (t.goldMult || 1) * (modifier?.goldMult || 1);
  const xpM = (t.xpMult || 1) * (modifier?.xpMult || 1);
  const name = isEliteBoss ? `${t.name} (Elite Boss)` : isBoss ? `${t.name} (Boss)` : modifier ? `${t.name} ${modifier.icon}` : t.name;
  return {
    id: t.id,
    name,
    color: t.color,
    isBoss,
    isEliteBoss,
    modifier,
    hp: Math.round((18 + floor * 7) * mult * hpM),
    maxHp: Math.round((18 + floor * 7) * mult * hpM),
    atk: Math.round((3 + floor * 1.6) * (isBoss ? 1.3 : 1) * atkM),
    def: Math.floor(floor * 0.7) + (isBoss ? 3 : 0) + (isEliteBoss ? 4 : 0) + defB,
    xp: Math.round((6 + floor * 3) * (isBoss ? 2.2 : 1) * xpM),
    gold: Math.round((4 + floor * 2.5) * (isBoss ? 2.2 : 1) * goldM)
  };
}
function xpToNext(level) {
  return level * 22 + 18;
}
function rollRarity(boosted = false) {
  const r = Math.random();
  if (boosted) {
    if (r < 0.14) return "elite";
    if (r < 0.5) return "unique";
    return "rare";
  }
  if (r < 0.06) return "elite";
  if (r < 0.28) return "unique";
  return "rare";
}
function pickName(pool, floor) {
  return pool[Math.min(pool.length - 1, Math.floor(floor / 4))];
}
function generateDrop(floor, options = {}) {
  const it = buildDropItem(floor, options);
  it.enhanceLevel = 0;
  it.empowerSlots = Array(RARITY_STARS[it.rarity] || 1).fill(null);
  return it;
}
function buildDropItem(floor, options = {}) {
  const roll = Math.random();
  const type = roll < 0.18 ? "weapon" : roll < 0.33 ? "helmet" : roll < 0.52 ? "chest" : roll < 0.67 ? "gloves" : roll < 0.82 ? "boots" : "accessory";
  const rarity = options.forceRarity || rollRarity(!!options.rarityBoost);
  const mult = RARITY_MULT[rarity];
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  if (type === "weapon") {
    const atk = Math.max(1, Math.round((2 + floor * 0.9) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(WEAPON_NAMES, floor),
      atk
    };
  }
  if (type === "helmet") {
    const def = Math.max(1, Math.round((1 + floor * 0.35) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(HELMET_NAMES, floor),
      def
    };
  }
  if (type === "chest") {
    const def = Math.max(1, Math.round((1.5 + floor * 0.5) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(CHEST_NAMES, floor),
      def
    };
  }
  if (type === "gloves") {
    const atk = Math.max(1, Math.round((1 + floor * 0.35) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(GLOVES_NAMES, floor),
      atk
    };
  }
  if (type === "boots") {
    const def = Math.max(1, Math.round((1 + floor * 0.3) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(BOOTS_NAMES, floor),
      def
    };
  }
  const statKey = Math.random() < 0.5 ? "hp" : "mp";
  const val = Math.max(4, Math.round((statKey === "hp" ? 6 + floor * 2.4 : 4 + floor * 1.6) * mult));
  return {
    id,
    type,
    rarity,
    name: pickName(ACCESSORY_NAMES, floor),
    [statKey]: val
  };
}
function itemDisplayName(it) {
  if (!it) return "";
  return it.enhanceLevel ? `${it.name} +${it.enhanceLevel}` : it.name;
}
function itemBonus(it) {
  if (!it) return null;
  const lvl = it.enhanceLevel || 0;
  const growMult = 1 + lvl * ENHANCE_STAT_PCT;
  const b = {
    atk: (it.atk || 0) * growMult,
    def: (it.def || 0) * growMult,
    hp: (it.hp || 0) * growMult,
    mp: (it.mp || 0) * growMult,
    critChance: 0,
    accuracy: 0,
    dodgeChance: 0,
    dropBonus: 0
  };
  (it.empowerSlots || []).forEach(slot => {
    if (!slot) return;
    if (slot.key === "atkPct") b.atk += (it.atk || 0) * slot.value;else if (slot.key === "defPct") b.def += (it.def || 0) * slot.value;else b[slot.key] = (b[slot.key] || 0) + slot.value;
  });
  return b;
}
function itemStatText(it) {
  const b = itemBonus(it) || {};
  const parts = [];
  if (b.atk) parts.push(`+${Math.round(b.atk)} ATK`);
  if (b.def) parts.push(`+${Math.round(b.def)} DEF`);
  if (b.hp) parts.push(`+${Math.round(b.hp)} HP`);
  if (b.mp) parts.push(`+${Math.round(b.mp)} MP`);
  if (b.critChance) parts.push(`+${b.critChance}% Crit`);
  if (b.accuracy) parts.push(`+${b.accuracy}% Acc`);
  if (b.dodgeChance) parts.push(`+${b.dodgeChance}% Dodge`);
  if (b.dropBonus) parts.push(`+${b.dropBonus}% Drop`);
  return parts.join("  ");
}
function getEquipBonus(equipped) {
  const b = {
    atk: 0,
    def: 0,
    hp: 0,
    mp: 0,
    critChance: 0,
    accuracy: 0,
    dodgeChance: 0,
    dropBonus: 0
  };
  Object.values(equipped).forEach(it => {
    const ib = itemBonus(it);
    if (!ib) return;
    Object.keys(ib).forEach(k => b[k] += ib[k]);
  });
  b.atk = Math.round(b.atk);
  b.def = Math.round(b.def);
  b.hp = Math.round(b.hp);
  b.mp = Math.round(b.mp);
  b.critChance = Math.round(b.critChance * 10) / 10;
  b.accuracy = Math.round(b.accuracy * 10) / 10;
  b.dodgeChance = Math.round(b.dodgeChance * 10) / 10;
  b.dropBonus = Math.round(b.dropBonus * 10) / 10;
  return b;
}
function getStats(player, equipped) {
  const b = getEquipBonus(equipped);
  const atkMult = Math.max(0.1, 1 + (player.atkBuffPct || 0) + (player.petAtkBoostPct || 0) - (player.weakenPct || 0));
  const defBuff = 1 + (player.defBuffPct || 0);
  return {
    atk: Math.round((player.baseAtk + b.atk) * atkMult),
    def: Math.round((player.baseDef + b.def) * defBuff),
    maxHp: player.baseMaxHp + b.hp,
    maxMp: player.baseMaxMp + b.mp,
    accuracy: (player.accuracy || 0) + b.accuracy,
    critChance: (player.critChance || 0) + b.critChance,
    dodgeChance: (player.dodgeChance || 0) + b.dodgeChance,
    dropBonus: (player.dropBonus || 0) + b.dropBonus
  };
}
function combatPower(stats, level) {
  return Math.round(stats.atk * 12 + stats.def * 15 + stats.maxHp * 2 + stats.maxMp * 1.5 + (stats.accuracy || 0) * 4 + (stats.critChance || 0) * 8 + (stats.dodgeChance || 0) * 6 + level * 50);
}

