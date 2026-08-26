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
