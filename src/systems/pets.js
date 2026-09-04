// ---------- pets ----------
// R: 1 active skill only. SR: active + 1 passive. SSR: active + passive + 1 extra skill.
let PET_POOL = [{
  id: "sprout",
  rarity: "r",
  isStarter: true,
  name: "Sprout",
  icon: "🌱",
  active: {
    name: "Regrowth",
    icon: "💚",
    cooldown: 4,
    type: "regen",
    regenPct: 0.08,
    regenTurns: 3,
    desc: "ฟื้นฟู HP 8% ของ HP สูงสุด ต่อเนื่อง 3 เทิร์น"
  }
}, {
  id: "flamekit",
  rarity: "r",
  name: "Flamekit",
  icon: "🔥",
  active: {
    name: "Ember Spark",
    icon: "🔥",
    cooldown: 4,
    type: "damage",
    mult: 0.9,
    desc: "ดาเมจไฟ 0.9x ATK"
  }
}, {
  id: "sparkpup",
  rarity: "r",
  name: "Sparkpup",
  icon: "⚡",
  active: {
    name: "Static Nip",
    icon: "⚡",
    cooldown: 3,
    type: "damage",
    mult: 0.7,
    desc: "ดาเมจสายฟ้า 0.7x ATK คูลดาวน์สั้น"
  }
}, {
  id: "ember_fox",
  rarity: "sr",
  name: "Ember Fox",
  icon: "🦊",
  active: {
    name: "Ember Spark+",
    icon: "🔥",
    cooldown: 4,
    type: "damage",
    mult: 1.0,
    desc: "ดาเมจไฟ 1.0x ATK"
  },
  passive: {
    name: "Warrior's Instinct",
    icon: "💪",
    type: "atkBoost",
    pct: 0.10,
    desc: "เพิ่ม ATK ถาวร +10%"
  }
}, {
  id: "moon_hare",
  rarity: "sr",
  name: "Moon Hare",
  icon: "🐇",
  active: {
    name: "Moonlit Regrowth",
    icon: "💚",
    cooldown: 4,
    type: "regen",
    regenPct: 0.09,
    regenTurns: 3,
    desc: "ฟื้นฟู HP 9% ของ HP สูงสุด ต่อเนื่อง 3 เทิร์น"
  },
  passive: {
    name: "Status Ward",
    icon: "🌙",
    type: "statusResist",
    pct: 0.60,
    desc: "60% โอกาสต้านทานสถานะผิดปกติจากบอส"
  }
}, {
  id: "thunder_cub",
  rarity: "sr",
  name: "Thunder Cub",
  icon: "🐺",
  active: {
    name: "Static Nip+",
    icon: "⚡",
    cooldown: 3,
    type: "damage",
    mult: 0.85,
    desc: "ดาเมจสายฟ้า 0.85x ATK"
  },
  passive: {
    name: "Pack Instinct",
    icon: "💪",
    type: "atkBoost",
    pct: 0.08,
    desc: "เพิ่ม ATK ถาวร +8%"
  }
}, {
  id: "inferno_drake",
  rarity: "ssr",
  name: "Inferno Drake",
  icon: "🐲",
  active: {
    name: "Inferno Blast",
    icon: "🔥",
    cooldown: 4,
    type: "damage",
    mult: 1.2,
    desc: "ดาเมจไฟ 1.2x ATK"
  },
  passive: {
    name: "Dragon Might",
    icon: "💪",
    type: "atkBoost",
    pct: 0.15,
    desc: "เพิ่ม ATK ถาวร +15%"
  },
  extra: {
    name: "Guard",
    icon: "🛡️",
    type: "block",
    pct: 0.20,
    desc: "20% โอกาสป้องกันการโจมตีของศัตรูทั้งหมด"
  }
}, {
  id: "storm_phoenix",
  rarity: "ssr",
  name: "Storm Phoenix",
  icon: "🦅",
  active: {
    name: "Storm Bolt",
    icon: "⚡",
    cooldown: 3,
    type: "damage",
    mult: 1.05,
    desc: "ดาเมจสายฟ้า 1.05x ATK"
  },
  passive: {
    name: "Tempest Ward",
    icon: "🌙",
    type: "statusResist",
    pct: 0.70,
    desc: "70% โอกาสต้านทานสถานะผิดปกติจากบอส"
  },
  extra: {
    name: "Paralyze",
    icon: "🌩️",
    type: "stun",
    pct: 0.30,
    desc: "30% โอกาสทำให้ศัตรูมึนงง 1 เทิร์นเมื่อสกิลทำงาน"
  }
}];
// ---------- pet stats (STR/VIT/AGI/DEX/LUK) & level ----------
// Base per-rarity stat lines a freshly-obtained pet starts with at level 1.
const PET_BASE_STATS = {
  r: { str: 4, vit: 4, agi: 4, dex: 4, luk: 4 },
  sr: { str: 6, vit: 6, agi: 6, dex: 6, luk: 6 },
  ssr: { str: 9, vit: 9, agi: 9, dex: 9, luk: 9 }
};
// Creates a new pet instance (what gets stored in save.pets / pets_json) with
// its own Level, EXP and 5-stat block, ready to be saved to D1 as-is.
function newPetInstance(defId) {
  const def = getPetDef(defId);
  const rarity = (def && def.rarity) || "r";
  const base = PET_BASE_STATS[rarity] || PET_BASE_STATS.r;
  return {
    instId: `pet-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    defId,
    level: 1,
    xp: 0,
    star: 1,
    stats: { ...base }
  };
}
function petXpToNext(level) {
  return level * 15 + 10;
}
// ---------- pet star-up (max 5★, spent from the duplicate pool, player-driven) ----------
// Multiplier applied to a pet's 5-stat block per star. Kept modest and relative to the existing
// per-rarity gap (r=20/sr=30/ssr=45 total at 1★) so a maxed-out lower rarity never overtakes the
// next rarity up at 1★: r ★5 ≈ 29 (< sr ★1 = 30), sr ★5 ≈ 43.5 (< ssr ★1 = 45).
const PET_STAR_MULT = [1.00, 1.08, 1.18, 1.30, 1.45]; // index 0 = ★1 ... index 4 = ★5
// Duplicates required to go from star N to star N+1 (index 0 = ★1→★2 ... index 3 = ★4→★5).
const PET_STAR_UP_COST = [1, 1, 1, 2];
function petStarUpCost(star) {
  const idx = (star || 1) - 1;
  return PET_STAR_UP_COST[idx] ?? null; // null = already ★5, nothing more to spend on
}
function petDuplicateCount(petDuplicates, defId) {
  return ((petDuplicates || {})[defId]) || 0;
}
// Derived combat stats for a pet instance, following the same Speed/Evasion/
// HitRate/CritChance/ItemDropBonus formulas used for the player character.
function petCombatStats(instance) {
  const base = (instance && instance.stats) || PET_BASE_STATS.r;
  const mult = PET_STAR_MULT[((instance && instance.star) || 1) - 1] || 1;
  const s = {
    str: base.str * mult,
    vit: base.vit * mult,
    agi: base.agi * mult,
    dex: base.dex * mult,
    luk: base.luk * mult
  };
  const lvl = (instance && instance.level) || 1;
  return {
    maxHp: roundInt(25 + lvl * 3 + s.vit * 8),
    atk: roundInt(4 + Math.floor(lvl * 0.6) + s.str * 2),
    def: roundInt(1 + Math.floor(lvl * 0.3) + Math.floor(s.vit * 0.4)),
    speed: roundInt(BASE_SPEED + s.agi * 2),
    evasion: +(s.agi * 0.5).toFixed(1),
    hitRate: Math.min(99, +(80 + s.dex * 0.5).toFixed(1)),
    critChance: +(s.luk * 0.5).toFixed(1),
    dropBonus: +(s.luk * 0.2).toFixed(1)
  };
}
const RARITY_ORDER_PET = ["r", "sr", "ssr"];
const PET_RARITY_LABEL = {
  r: "R",
  sr: "SR",
  ssr: "SSR"
};
const GACHA_RATES = {
  r: 0.70,
  sr: 0.25,
  ssr: 0.05
};
const GACHA_COST = 100;
function getPetDef(defId) {
  return PET_POOL.find(p => p.id === defId) || null;
}
function starterPetDef() {
  return PET_POOL.find(p => p.isStarter);
}
function rollGachaPet() {
  const roll = Math.random();
  let rarity = "r";
  if (roll < GACHA_RATES.ssr) rarity = "ssr";else if (roll < GACHA_RATES.ssr + GACHA_RATES.sr) rarity = "sr";
  const pool = PET_POOL.filter(p => p.rarity === rarity);
  return pool[Math.floor(Math.random() * pool.length)];
}
let ENEMY_POOL = [{
  id: "jelly_slime",
  name: "Jelly Slime",
  color: "#7ED9A8"
}, {
  id: "spore_cap",
  name: "Spore Cap",
  color: "#C98BE0"
}, {
  id: "tusky_boar",
  name: "Tusky Boar",
  color: "#C9A06A"
}, {
  id: "bramble_bat",
  name: "Bramble Bat",
  color: "#8E8CD8"
}, {
  id: "bone_rattler",
  name: "Bone Rattler",
  color: "#E5E2D6"
}, {
  id: "sandy_crab",
  name: "Sandy Crab",
  color: "#F2B25C"
}];
let BOSS_POOL = [{
  id: "moss_king",
  name: "Moss King",
  color: "#5FA85F"
}, {
  id: "ember_drake",
  name: "Ember Drake",
  color: "#F0714B"
}, {
  id: "frost_warden",
  name: "Frost Warden",
  color: "#7BC7E8"
}];
let WEAPON_NAMES = ["Wooden Sword", "Iron Blade", "Steel Rapier", "Flame Saber", "Dragon Fang"];
let HELMET_NAMES = ["Cloth Cap", "Leather Hood", "Iron Helm", "Horned Helm", "Dragonbone Crown"];
let CHEST_NAMES = ["Cloth Robe", "Leather Vest", "Iron Plate", "Mystic Cloak", "Dragon Scale Mail"];
let GLOVES_NAMES = ["Cloth Gloves", "Leather Gauntlets", "Iron Gauntlets", "Runed Gloves", "Dragonclaw Gauntlets"];
let BOOTS_NAMES = ["Worn Sandals", "Leather Boots", "Iron Greaves", "Swift Boots", "Dragonhide Boots"];
let ACCESSORY_NAMES = ["Lucky Charm", "Vitality Pendant", "Mana Ring", "Swift Anklet", "Phoenix Feather"];
let WINGS_NAMES = ["Tattered Wings", "Feathered Cloak", "Gale Wings", "Spectral Wings", "Dragonwing Mantle"];
let RARITY_MULT = {
  rare: 1,
  unique: 1.9,
  elite: 3.2,
  mythic: 5.4
};
const RARITY_LABEL = {
  rare: "Rare",
  unique: "Unique",
  elite: "Elite",
  mythic: "Mythic"
};
const RARITY_STARS = {
  rare: 1,
  unique: 3,
  elite: 5,
  mythic: 7
};
