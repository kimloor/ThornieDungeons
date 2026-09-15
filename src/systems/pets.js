// ---------- pets ----------
// Shared Pet catalog/progression data. Mode adapters feed these Pet units into
// Battle Core; Pet skill behavior must not be forked into Arena or Raid code.
// R: 1 active skill only. SR: active + 1 passive. SSR: active + passive + 1 extra skill.
const PET_V2_PLAYTEST = Object.freeze({
  hellWolfPoisonAtkPct: 20,
  hellWolfPoisonTurns: 3
});
let PET_POOL = [{
  id: "sprout",
  role: "support",
  rarity: "r",
  isStarter: true,
  name: "Sprout",
  icon: "🌱",
  active: {
    name: "Regrowth",
    icon: "💚",
    cooldown: 3,
    type: "regen",
    healPetHpPct: 0.12,
    vitScale: 0.8,
    regenTurns: 2,
    desc: "ฟื้นฟู Hero 12% Pet Max HP + 0.8×VIT นาน 2 เทิร์น"
  }
}, {
  id: "flamekit",
  role: "attack",
  rarity: "r",
  name: "Flamekit",
  icon: "🔥",
  active: {
    name: "Flame Claw",
    icon: "🔥",
    cooldown: 2,
    type: "damage",
    mult: 1.35,
    desc: "ดาเมจเป้าหมายเดียว 1.35× Pet ATK"
  }
}, {
  id: "sparkpup",
  role: "control",
  rarity: "r",
  name: "Sparkpup",
  icon: "⚡",
  active: {
    name: "Static Bite",
    icon: "⚡",
    cooldown: 2,
    type: "damage",
    mult: 1.0,
    stunChance: 0.15,
    desc: "ดาเมจ 1.0× Pet ATK และ Stun 15%"
  }
}, {
  id: "ember_fox",
  role: "attack",
  rarity: "sr",
  name: "Ember Fox",
  icon: "🦊",
  active: {
    name: "Blazing Fang",
    icon: "🔥",
    cooldown: 2,
    type: "damage",
    mult: 1.55,
    desc: "ดาเมจเป้าหมายเดียว 1.55× Pet ATK"
  },
  passive: {
    name: "Predator Instinct",
    icon: "💪",
    type: "atkBoost",
    petCritPct: 0.10,
    heroCritPct: 0.05,
    desc: "Pet Crit +10% และ Hero Crit +5%"
  }
}, {
  id: "moon_hare",
  role: "support",
  rarity: "sr",
  name: "Moon Hare",
  icon: "🐇",
  active: {
    name: "Moonlight Heal",
    icon: "💚",
    cooldown: 2,
    type: "groupHeal",
    healPetHpPct: 0.10,
    vitScale: 1.0,
    desc: "ฟื้นฟู Hero และ Pet 10% Pet Max HP + 1.0×VIT"
  },
  passive: {
    name: "Status Ward",
    icon: "🌙",
    type: "statusResist",
    pct: 0.15,
    desc: "Hero และ Pet Status Resist +15%"
  }
}, {
  id: "hell_wolf",
  role: "control",
  rarity: "sr",
  name: "Hell Wolf",
  icon: "🐺",
  active: {
    name: "Hell Fang",
    icon: "⚡",
    cooldown: 2,
    type: "damage",
    mult: 1.10,
    armorBreakChance: 0.40,
    poisonChance: 0.25,
    poisonPct: 0.20,
    poisonTurns: 3,
    desc: "ดาเมจ 1.10× Pet ATK, Armor Break 40%, Poison 25%"
  },
  passive: {
    name: "Hunter's Eye",
    icon: "💪",
    type: "accuracyBoost",
    pct: 0.08,
    desc: "Hero และ Pet Accuracy +8%"
  }
}, {
  id: "inferno_drake",
  role: "tank",
  rarity: "ssr",
  name: "Inferno Drake",
  icon: "🐲",
  active: {
    name: "Draconic Sweep",
    icon: "🔥",
    cooldown: 2,
    type: "aoe",
    mult: 0.75,
    defUpChance: 0.35,
    defUpTurns: 2,
    desc: "โจมตีศัตรูสูงสุด 3 ตัว 0.75× Pet ATK และมีโอกาสให้ Hero DEF Up"
  },
  passive: {
    name: "Dragon Hide",
    icon: "💪",
    type: "defBoost",
    petPct: 0.15,
    heroPct: 0.08,
    desc: "Pet DEF +15% และ Hero DEF +8%"
  },
  extra: {
    name: "Guardian Scale",
    icon: "🛡️",
    type: "heroBlock",
    pct: 0.20,
    desc: "20% โอกาสบล็อก direct damage ที่โจมตี Hero"
  }
}, {
  id: "storm_phoenix",
  role: "control",
  rarity: "ssr",
  name: "Storm Phoenix",
  icon: "🦅",
  active: {
    name: "Tempest Strike",
    icon: "⚡",
    cooldown: 3,
    type: "aoe",
    mult: 0.70,
    silenceChance: 0.30,
    desc: "โจมตีศัตรูสูงสุด 3 ตัว 0.70× Pet ATK และ Silence 30%"
  },
  passive: {
    name: "Storm Step",
    icon: "🌙",
    type: "dodgeBoost",
    pct: 0.08,
    desc: "Hero และ Pet Dodge +8%"
  },
  extra: {
    name: "Thunder Judgment",
    icon: "🌩️",
    type: "petCdrOnDebuff",
    pct: 0.50,
    desc: "เมื่อ Hero หรือ Pet ลง Debuff สำเร็จ มีโอกาส 50% ลด Pet Active CD 1"
  }
}];
// Battle Core consumes this catalog in every mode. Keep combat values in the
// Pet definitions above so Dungeon/Arena/Raid never maintain separate copies.
const PET_COMBAT_SKILLS_V2 = Object.freeze(Object.fromEntries(PET_POOL.map(def => [def.id, Object.freeze({
  active: def.active,
  passive: def.passive,
  extra: def.extra
})])));
if (typeof globalThis !== "undefined") globalThis.PET_COMBAT_SKILLS_V2 = PET_COMBAT_SKILLS_V2;
// ---------- pet stats (STR/VIT/AGI/DEX/LUK) & level ----------
// Base per-rarity stat lines a freshly-obtained pet starts with at level 1.
const PET_BASE_STATS = {
  sprout: { str: 3, vit: 5, agi: 4, dex: 4, luk: 4 }, flamekit: { str: 5, vit: 3, agi: 4, dex: 4, luk: 4 },
  sparkpup: { str: 4, vit: 3, agi: 5, dex: 5, luk: 3 }, ember_fox: { str: 8, vit: 5, agi: 6, dex: 6, luk: 5 },
  moon_hare: { str: 4, vit: 8, agi: 6, dex: 7, luk: 5 }, hell_wolf: { str: 7, vit: 5, agi: 7, dex: 6, luk: 5 },
  inferno_drake: { str: 11, vit: 11, agi: 7, dex: 8, luk: 8 }, storm_phoenix: { str: 9, vit: 7, agi: 11, dex: 10, luk: 8 }
};
const PET_GROWTH_STATS = {
  sprout: [.10,.40,.20,.30,.20], flamekit: [.45,.10,.20,.25,.20], sparkpup: [.25,.10,.40,.30,.15],
  ember_fox: [.45,.15,.20,.30,.25], moon_hare: [.10,.40,.20,.35,.25], hell_wolf: [.35,.15,.35,.30,.20],
  inferno_drake: [.40,.45,.15,.25,.25], storm_phoenix: [.30,.15,.45,.35,.25]
};
// Creates a new pet instance (what gets stored in save.pets / pets_json) with
// its own Level, EXP and 5-stat block, ready to be saved to D1 as-is.
function newPetInstance(defId) {
  const def = getPetDef(defId);
  const base = PET_BASE_STATS[defId] || PET_BASE_STATS.sprout;
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
  const lv = Math.max(1, Math.min(49, Math.floor(Number(level) || 1)));
  return Math.round(34 + 6 * lv + 0.32 * lv * lv);
}
function grantActivePetBattleXp(pets, activePetId, heroBattleXp) {
  const gained = Math.max(0, Math.round((Number(heroBattleXp) || 0) * 0.8));
  return (pets || []).map(instance => {
    if (!instance || instance.instId !== activePetId || (Number(instance.level) || 1) >= 50) return instance;
    let level = Math.max(1, Number(instance.level) || 1);
    let xp = Math.max(0, Number(instance.xp) || 0) + gained;
    while (level < 50 && xp >= petXpToNext(level)) { xp -= petXpToNext(level); level += 1; }
    if (level >= 50) xp = 0;
    return { ...instance, level, xp };
  });
}

// Compact Pet run-state that travels with the existing per-character run snapshot.
// Battle checkpoints remain authoritative while a battle is in progress; this only
// carries the active Pet's HP between completed floors and across a reload.
function petRunStateSnapshot(petCombat, activePetId) {
  if (!petCombat || !activePetId || petCombat.instId !== activePetId) return null;
  return {
    activePetId,
    currentHp: Math.max(0, Math.round(Number(petCombat.hp) || 0)),
    wasDead: !(Number(petCombat.hp) > 0)
  };
}

function normalizePetRunState(value) {
  let state = value;
  if (typeof state === "string") {
    try { state = JSON.parse(state); } catch (e) { return null; }
  }
  if (!state || typeof state !== "object" || !String(state.activePetId || "").trim()) return null;
  const currentHp = Number(state.currentHp);
  if (!Number.isFinite(currentHp)) return null;
  return {
    activePetId: String(state.activePetId),
    currentHp: Math.max(0, Math.round(currentHp)),
    wasDead: state.wasDead === true || currentHp <= 0
  };
}

function petCarryHpForFloor(floor, activePetId, runtimePet, savedPetState, continuingRun) {
  // Boss floors always refill, and entering a fresh/retried run does not inherit HP.
  if (!activePetId || Number(floor) % 5 === 0 || !continuingRun) return null;
  const runtime = runtimePet && runtimePet.instId === activePetId
    ? { activePetId, currentHp: runtimePet.hp, wasDead: !(runtimePet.hp > 0) }
    : null;
  const saved = normalizePetRunState(savedPetState);
  const source = runtime || (saved?.activePetId === activePetId ? saved : null);
  // A dead Pet revives at full HP on the next floor; null tells the unit builder
  // to use max HP. It also safely handles older saves with no Pet fields.
  return source && !source.wasDead && source.currentHp > 0 ? source.currentHp : null;
}

function petLifetimeXp(instance) {
  if (!instance) return 0;
  const level = Math.max(1, Math.min(50, Number(instance.level) || 1));
  let total = Math.max(0, Number(instance.xp) || 0);
  for (let lv = 1; lv < level; lv += 1) total += petXpToNext(lv);
  return total;
}

function petProgressChange(beforePets, afterPets, activePetId) {
  const before = (beforePets || []).find(p => p?.instId === activePetId);
  const after = (afterPets || []).find(p => p?.instId === activePetId);
  if (!before || !after || (Number(before.level) || 1) >= 50) return null;
  const xpGained = Math.max(0, petLifetimeXp(after) - petLifetimeXp(before));
  if (!xpGained) return null;
  return {
    instId: activePetId,
    defId: after.defId,
    xpGained,
    startLevel: Math.max(1, Number(before.level) || 1),
    endLevel: Math.max(1, Number(after.level) || 1)
  };
}
// ---------- Pet V2 star-up (max 3★, spent from duplicate pool) ----------
const PET_STAR_MULT = [1.00, 1.15, 1.35];
// Duplicates required to go from star N to N+1 (★1→★2, ★2→★3).
const PET_STAR_UP_COST = [1, 2];
function petStarUpCost(star) {
  const idx = (star || 1) - 1;
  return PET_STAR_UP_COST[idx] ?? null; // null = already ★3
}
function petDuplicateCount(petDuplicates, defId) {
  return ((petDuplicates || {})[defId]) || 0;
}
// Derived combat stats for a pet instance, following the same Speed/Evasion/
// HitRate/CritChance/ItemDropBonus formulas used for the player character.
function petCombatStats(instance) {
  const defId = (instance && instance.defId) || "sprout";
  const base = PET_BASE_STATS[defId] || PET_BASE_STATS.sprout;
  const growth = PET_GROWTH_STATS[defId] || PET_GROWTH_STATS.sprout;
  const mult = PET_STAR_MULT[Math.max(0, Math.min(2, ((instance && instance.star) || 1) - 1))] || 1;
  const lvl = Math.max(1, Math.min(50, Number(instance && instance.level) || 1));
  const stored = instance && instance.stats;
  const raw = stored && instance.statModel === "v2" ? stored : {
    str: base.str + growth[0] * (lvl - 1), vit: base.vit + growth[1] * (lvl - 1),
    agi: base.agi + growth[2] * (lvl - 1), dex: base.dex + growth[3] * (lvl - 1),
    luk: base.luk + growth[4] * (lvl - 1)
  };
  const s = {
    str: raw.str * mult, vit: raw.vit * mult, agi: raw.agi * mult, dex: raw.dex * mult, luk: raw.luk * mult
  };
  return {
    rawStats: s,
    maxHp: roundInt(30 + lvl * 4 + s.vit * 7),
    atk: roundInt(5 + lvl * 0.7 + s.str * 2),
    def: roundInt(2 + lvl * 0.25 + s.vit * 0.5),
    speed: roundInt(BASE_SPEED + s.agi * 1.5),
    evasion: Math.min(20, +(s.agi * 0.35).toFixed(1)),
    hitRate: Math.min(99, +(85 + s.dex * 0.4).toFixed(1)),
    critChance: Math.min(25, +(s.luk * 0.4).toFixed(1)),
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
  color: "#7ED9A8",
  sizeClass: "small",
  anchorType: "ground"
}, {
  id: "spore_cap",
  name: "Spore Cap",
  color: "#C98BE0",
  sizeClass: "small",
  anchorType: "ground"
}, {
  id: "tusky_boar",
  name: "Tusky Boar",
  color: "#C9A06A",
  sizeClass: "medium",
  anchorType: "ground"
}, {
  id: "bramble_bat",
  name: "Bramble Bat",
  color: "#8E8CD8",
  sizeClass: "medium",
  anchorType: "flying"
}, {
  id: "bone_rattler",
  name: "Bone Rattler",
  color: "#E5E2D6",
  sizeClass: "medium",
  anchorType: "ground"
}, {
  id: "sandy_crab",
  name: "Sandy Crab",
  color: "#F2B25C",
  sizeClass: "medium",
  anchorType: "ground"
}];
let BOSS_POOL = [{
  id: "moss_king",
  name: "Moss King",
  color: "#5FA85F",
  sizeClass: "large",
  anchorType: "ground"
}, {
  id: "ember_drake",
  name: "Ember Drake",
  color: "#F0714B",
  sizeClass: "large",
  anchorType: "ground"
}, {
  id: "frost_warden",
  name: "Frost Warden",
  color: "#7BC7E8",
  sizeClass: "large",
  anchorType: "ground"
}];
// Per-monster loot tables (design: admin-backend-design.md) — { [monsterId]: { gear: [
// {itemType, rarity, weight} ], junk: [ {junkId, qtyMin, qtyMax, dropChance} ] } }, filled
// in from getMonsterLoot on app load (App.js), same fetch/cache/apply shape as recipes and
// game config. Starts empty on purpose: a monster with no entry here just falls back to
// the existing generic floor-based drop roll — nothing changes until rows are added.
let MONSTER_LOOT = {};
function applyMonsterLoot(data) {
  if (data && typeof data === "object") MONSTER_LOOT = data;
}
function monsterLootFor(monsterId) {
  return MONSTER_LOOT[monsterId] || null;
}
// Weighted pick among a monster's configured gear rows. Returns null if the pool is
// empty/invalid so the caller can fall back to the generic roll.
function pickWeightedGear(gearRows) {
  if (!Array.isArray(gearRows) || !gearRows.length) return null;
  const total = gearRows.reduce((s, g) => s + (Number(g.weight) || 0), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const g of gearRows) {
    r -= Number(g.weight) || 0;
    if (r <= 0) return g;
  }
  return gearRows[gearRows.length - 1];
}
// Independent per-entry roll for a monster's bonus junk table — separate from the gear
// pool above, and additive on top of the game's existing generic junk roll (rollJunkDrop
// in enhancement.js). Each row is its own chance, so a monster can grant several bonus
// materials from a single kill (e.g. "always 2-3 bossHorn" + "10% a recipe scroll").
function rollMonsterBonusJunk(monsterId) {
  const table = monsterLootFor(monsterId);
  if (!table || !table.junk || !table.junk.length) return [];
  const drops = [];
  table.junk.forEach(entry => {
    if (Math.random() < (Number(entry.dropChance) || 0)) {
      const min = Math.max(1, Number(entry.qtyMin) || 1);
      const max = Math.max(min, Number(entry.qtyMax) || min);
      const qty = min + Math.floor(Math.random() * (max - min + 1));
      if (qty > 0) drops.push({ type: entry.junkId, amount: qty });
    }
  });
  return drops;
}
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
  mythic: 5.4,
  // Azure (crafted, Phase 4) is deliberately set equal to mythic, not above it — crafting's
  // value is guaranteeing that tier deterministically via materials/gold, not power-creeping
  // past the rarest chest-pity drop in the game.
  azure: 5.4
};
const RARITY_LABEL = {
  rare: "Rare",
  unique: "Unique",
  elite: "Elite",
  mythic: "Mythic",
  raid: "Raid Wing",
  azure: "Azure Set"
};
const RARITY_STARS = {
  rare: 1,
  unique: 3,
  elite: 5,
  mythic: 7,
  azure: 5
};

if (typeof module !== "undefined") module.exports = { PET_V2_PLAYTEST, PET_POOL, PET_COMBAT_SKILLS_V2, getPetDef };
