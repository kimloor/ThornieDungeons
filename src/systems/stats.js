// ---------- floating-point-safe math helpers ----------
// JS floats can't exactly represent most decimal fractions (5.1 + 2.3 === 7.3999999999999995,
// 12.7 * 1.18 === 14.985999999999999), so any value built from repeated multiplication/addition
// of decimals — % stats, enhancement growth, empower rolls — needs to be rounded back to a
// sane precision at the point it's stored/displayed, not left to drift. roundTo() does that
// safely (the Number.EPSILON nudge avoids the classic Math.round(1.005*100)/100 === 1 gotcha
// where the *input* itself is already slightly off before rounding).
function roundTo(value, decimals = 1) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
// HP/MP/gold/damage etc are always whole numbers — same idea as roundTo(x, 0) but reads clearer
// at call sites and guarantees an actual integer type (not just "no decimals when printed").
function roundInt(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}
// Formats large numbers for UI display so gold/XP/combat-power text never overflows its box at
// high floors: 950 -> "950", 1234 -> "1.2K", 3500000 -> "3.5M", 10200000000 -> "10.2B".
// Always trims a trailing ".0" (e.g. 2000 -> "2K", not "2.0K") and preserves the sign.
const NUMBER_FORMAT_UNITS = [{
  value: 1e12,
  suffix: "T"
}, {
  value: 1e9,
  suffix: "B"
}, {
  value: 1e6,
  suffix: "M"
}, {
  value: 1e3,
  suffix: "K"
}];
function formatNumber(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0";
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);
  if (abs < 1000) return sign + roundInt(abs).toString();
  let unitIndex = NUMBER_FORMAT_UNITS.findIndex(u => abs >= u.value);
  let scaled = roundTo(abs / NUMBER_FORMAT_UNITS[unitIndex].value, 1);
  // Rounding can push a value like 999,999 up to "1000.0" of its unit — bump to the next unit
  // up instead of ever displaying a leading "1000" (e.g. show "1M", not "1000K").
  if (scaled >= 1000 && unitIndex > 0) {
    unitIndex -= 1;
    scaled = roundTo(abs / NUMBER_FORMAT_UNITS[unitIndex].value, 1);
  }
  const text = scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1);
  return sign + text + NUMBER_FORMAT_UNITS[unitIndex].suffix;
}

// Accessories no longer roll HP/MP — they roll one of these % utility stats instead.
const ACCESSORY_STAT_POOL = ["dodgeChance", "critChance", "critDamage"];
const ACCESSORY_STAT_BASE = {
  dodgeChance: {
    flat: 1,
    perFloor: 0.12
  },
  critChance: {
    flat: 1.2,
    perFloor: 0.15
  },
  critDamage: {
    flat: 4,
    perFloor: 0.35
  }
};
// ---------- 5-stat model: STR / VIT / AGI / DEX / LUK ----------
// Derived stat formulas (shared reference — also used by pets & monsters where applicable):
//   Speed        = BaseSpeed + (AGI * 2)
//   Evasion      = AGI * 0.5%
//   HitRate      = 80 + (DEX * 0.5)%
//   CritChance   = LUK * 0.5%
//   ItemDropBonus= LUK * 0.2%
function speedFromAgi(agi) {
  return roundInt(BASE_SPEED + (agi || 0) * 2);
}
function evasionFromAgi(agi) {
  return roundTo((agi || 0) * 0.5, 1);
}
function hitRateFromDex(dex) {
  return Math.min(99, roundTo(80 + (dex || 0) * 0.5, 1));
}
function critChanceFromLuk(luk) {
  return roundTo((luk || 0) * 0.5, 1);
}
function dropBonusFromLuk(luk) {
  return roundTo((luk || 0) * 0.2, 1);
}
function characterBaseStats(save) {
  const lvl = save.character.level;
  const s = save.character.stats;
  return {
    maxHp: roundInt(40 + lvl * 4 + s.vit * 12),
    maxMp: roundInt(15 + lvl * 2),
    atk: roundInt(8 + lvl + s.str * 3 + Math.floor(s.dex * 0.5)),
    def: roundInt(2 + Math.floor(lvl * 0.4) + Math.floor(s.vit * 0.5)),
    speed: speedFromAgi(s.agi),
    accuracy: hitRateFromDex(s.dex),
    critChance: critChanceFromLuk(s.luk),
    critDamage: 50,
    dodgeChance: evasionFromAgi(s.agi),
    dropBonus: dropBonusFromLuk(s.luk)
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
  const hp = carry && Number.isFinite(carry.hp) ? roundInt(Math.max(0, Math.min(cb.maxHp, carry.hp))) : cb.maxHp;
  const mp = carry && Number.isFinite(carry.mp) ? roundInt(Math.max(0, Math.min(cb.maxMp, carry.mp))) : cb.maxMp;
  return {
    level: save.character.level,
    xp: save.character.xp,
    baseAtk: cb.atk,
    baseDef: cb.def,
    baseMaxHp: cb.maxHp,
    baseMaxMp: cb.maxMp,
    baseSpeed: cb.speed,
    accuracy: cb.accuracy,
    critChance: cb.critChance,
    critDamage: cb.critDamage,
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
function makeEnemy(floor, options = {}) {
  const isBoss = floor % 5 === 0;
  const isEliteBoss = floor % 10 === 0;
  const modifier = isBoss ? null : rollFloorModifier();
  const pool = isBoss ? BOSS_POOL : ENEMY_POOL;
  const t = pool[Math.floor(Math.random() * pool.length)];
  const mult = isEliteBoss ? 4.2 : isBoss ? 2.6 : 1;
  // groupScale softens HP/ATK a bit per monster when multiple spawn together in one encounter,
  // so a 3-monster pack isn't simply 3x harder than a solo fight.
  const groupScale = options.groupScale || 1;
  const hpM = (t.hpMult || 1) * (modifier?.hpMult || 1) * groupScale;
  const atkM = (t.atkMult || 1) * (modifier?.atkMult || 1) * groupScale;
  const defB = t.defBonus || 0;
  const goldM = (t.goldMult || 1) * (modifier?.goldMult || 1);
  const xpM = (t.xpMult || 1) * (modifier?.xpMult || 1);
  const name = isEliteBoss ? `${t.name} (Elite Boss)` : isBoss ? `${t.name} (Boss)` : modifier ? `${t.name} ${modifier.icon}` : t.name;
  const agi = t.agi || (isBoss ? 8 : 4) + Math.floor(floor / 10);
  return {
    id: t.id,
    uid: `${t.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    color: t.color,
    isBoss,
    isEliteBoss,
    modifier,
    agi,
    speed: speedFromAgi(agi),
    evasion: evasionFromAgi(agi),
    hitRate: hitRateFromDex(t.dex || (isBoss ? 6 : 2)),
    hp: roundInt((18 + floor * 7) * mult * hpM),
    maxHp: roundInt((18 + floor * 7) * mult * hpM),
    atk: roundInt((3 + floor * 1.6) * (isBoss ? 1.3 : 1) * atkM),
    def: roundInt(Math.floor(floor * 0.7) + (isBoss ? 3 : 0) + (isEliteBoss ? 4 : 0) + defB),
    xp: roundInt((6 + floor * 3) * (isBoss ? 2.2 : 1) * xpM),
    gold: roundInt((4 + floor * 2.5) * (isBoss ? 2.2 : 1) * goldM)
  };
}
// Builds a full encounter: boss floors always spawn exactly 1 (boss or elite boss),
// normal floors spawn 1-3 regular monsters that share the field together.
function makeEncounter(floor) {
  const isBoss = floor % 5 === 0;
  if (isBoss) return [makeEnemy(floor)];
  const roll = Math.random();
  const count = roll < 0.45 ? 1 : roll < 0.8 ? 2 : 3;
  const groupScale = count === 1 ? 1 : count === 2 ? 0.72 : 0.55;
  const monsters = [];
  for (let i = 0; i < count; i++) monsters.push(makeEnemy(floor, { groupScale }));
  return monsters;
}
// Builds the round's initiative queue: every living unit on the field
// ([Player, Active Pet, ...Monsters]) sorted by Speed (AGI-derived), highest first.
// Ties are broken randomly so repeated equal-speed matchups don't always favor the same side.
// Callers are expected to only pass units that are already alive.
function buildTurnQueue(units) {
  return units
    .filter(Boolean)
    .map(u => ({ ...u, _r: Math.random() }))
    .sort((a, b) => (b.speed - a.speed) || (b._r - a._r));
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
    const atk = Math.max(1, roundInt((2 + floor * 0.9) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(WEAPON_NAMES, floor),
      atk
    };
  }
  if (type === "helmet") {
    const def = Math.max(1, roundInt((1 + floor * 0.35) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(HELMET_NAMES, floor),
      def
    };
  }
  if (type === "chest") {
    const def = Math.max(1, roundInt((1.5 + floor * 0.5) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(CHEST_NAMES, floor),
      def
    };
  }
  if (type === "gloves") {
    const atk = Math.max(1, roundInt((1 + floor * 0.35) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(GLOVES_NAMES, floor),
      atk
    };
  }
  if (type === "boots") {
    const def = Math.max(1, roundInt((1 + floor * 0.3) * mult));
    return {
      id,
      type,
      rarity,
      name: pickName(BOOTS_NAMES, floor),
      def
    };
  }
  // Accessories are pure utility pieces: dodge / crit chance / crit damage as % values, never HP or MP.
  const statKey = ACCESSORY_STAT_POOL[Math.floor(Math.random() * ACCESSORY_STAT_POOL.length)];
  const base = ACCESSORY_STAT_BASE[statKey];
  const val = roundTo((base.flat + floor * base.perFloor) * mult, 1);
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
  // Kept unrounded here on purpose — this gets summed across every equipped item in
  // getEquipBonus() first, and rounding *once* after that sum (rather than once per item)
  // avoids stacking up separate rounding errors. Anything that displays a single item's
  // bonus directly (itemStatText) rounds its own copy at the display boundary instead.
  const b = {
    atk: (it.atk || 0) * growMult,
    def: (it.def || 0) * growMult,
    hp: (it.hp || 0) * growMult,
    mp: (it.mp || 0) * growMult,
    critChance: (it.critChance || 0) * growMult,
    critDamage: (it.critDamage || 0) * growMult,
    accuracy: 0,
    dodgeChance: (it.dodgeChance || 0) * growMult,
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
  if (b.atk) parts.push(`+${roundInt(b.atk)} ATK`);
  if (b.def) parts.push(`+${roundInt(b.def)} DEF`);
  if (b.hp) parts.push(`+${roundInt(b.hp)} HP`);
  if (b.mp) parts.push(`+${roundInt(b.mp)} MP`);
  if (b.critChance) parts.push(`+${roundTo(b.critChance, 1)}% Crit`);
  if (b.critDamage) parts.push(`+${roundTo(b.critDamage, 1)}% Crit Dmg`);
  if (b.accuracy) parts.push(`+${roundTo(b.accuracy, 1)}% Acc`);
  if (b.dodgeChance) parts.push(`+${roundTo(b.dodgeChance, 1)}% Dodge`);
  if (b.dropBonus) parts.push(`+${roundTo(b.dropBonus, 1)}% Drop`);
  return parts.join("  ");
}
function getEquipBonus(equipped) {
  const b = {
    atk: 0,
    def: 0,
    hp: 0,
    mp: 0,
    critChance: 0,
    critDamage: 0,
    accuracy: 0,
    dodgeChance: 0,
    dropBonus: 0
  };
  Object.values(equipped).forEach(it => {
    const ib = itemBonus(it);
    if (!ib) return;
    Object.keys(ib).forEach(k => b[k] += ib[k]);
  });
  b.atk = roundInt(b.atk);
  b.def = roundInt(b.def);
  b.hp = roundInt(b.hp);
  b.mp = roundInt(b.mp);
  b.critChance = roundTo(b.critChance, 1);
  b.critDamage = roundTo(b.critDamage, 1);
  b.accuracy = roundTo(b.accuracy, 1);
  b.dodgeChance = roundTo(b.dodgeChance, 1);
  b.dropBonus = roundTo(b.dropBonus, 1);
  return b;
}
function getStats(player, equipped) {
  const b = getEquipBonus(equipped);
  const atkMult = Math.max(0.1, 1 + (player.atkBuffPct || 0) + (player.petAtkBoostPct || 0) - (player.weakenPct || 0));
  const defBuff = 1 + (player.defBuffPct || 0);
  return {
    atk: roundInt((player.baseAtk + b.atk) * atkMult),
    def: roundInt((player.baseDef + b.def) * defBuff),
    maxHp: roundInt(player.baseMaxHp + b.hp),
    maxMp: roundInt(player.baseMaxMp + b.mp),
    speed: roundInt(player.baseSpeed || BASE_SPEED),
    // These are each the sum of two already-rounded numbers (e.g. 5.1 + 2.3), which floating
    // point can turn into 7.3999999999999995 even though both inputs were "clean" — re-round
    // every percentage stat here, since this is the value combat rolls and the UI both read.
    accuracy: roundTo(Math.min(99, (player.accuracy || 0) + b.accuracy), 1),
    critChance: roundTo(Math.min(80, (player.critChance || 0) + b.critChance), 1),
    critDamage: roundTo(Math.min(300, (player.critDamage || 0) + b.critDamage), 1),
    dodgeChance: roundTo(Math.min(60, (player.dodgeChance || 0) + b.dodgeChance), 1),
    dropBonus: roundTo((player.dropBonus || 0) + b.dropBonus, 1)
  };
}
function combatPower(stats, level) {
  return roundInt(stats.atk * 12 + stats.def * 15 + stats.maxHp * 2 + stats.maxMp * 1.5 + (stats.accuracy || 0) * 4 + (stats.critChance || 0) * 8 + (stats.critDamage || 0) * 3 + (stats.dodgeChance || 0) * 6 + level * 50);
}

