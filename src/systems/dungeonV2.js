// ---------- Dungeon V2 encounter and stat foundation ----------
// This module owns Dungeon encounter identity and enemy stat generation only.
// It deliberately does not resolve damage, turns, skills, statuses, rewards, or
// persistence transactions. Those remain owned by Battle Core and the existing
// Dungeon result/checkpoint flow.
(function dungeonV2Factory(root) {
  const ENCOUNTER_TYPES = Object.freeze({
    NORMAL: "normal",
    ELITE: "elite",
    CHAPTER_BOSS: "chapter_boss"
  });

  const NORMAL_REFERENCE_POINTS = Object.freeze([
    Object.freeze({ floor: 1, hp: 29, atk: 6, def: 1 }),
    Object.freeze({ floor: 30, hp: 328, atk: 64, def: 28 }),
    Object.freeze({ floor: 71, hp: 829, atk: 155, def: 70 }),
    Object.freeze({ floor: 105, hp: 1300, atk: 236, def: 109 })
  ]);

  const MONSTER_IDENTITY_PROFILES = Object.freeze({
    jelly_slime: Object.freeze({ id: "jelly_slime", name: "Jelly Slime", hp: 1, atk: 0.9, def: 0.9, speedAdjustment: 0, dodge: 0, identity: "Balanced" }),
    spore_cap: Object.freeze({ id: "spore_cap", name: "Spore Cap", hp: 0.9, atk: 0.85, def: 0.85, speedAdjustment: 1, dodge: 2, identity: "Glass / Poison" }),
    tusky_boar: Object.freeze({ id: "tusky_boar", name: "Tusky Boar", hp: 1.3, atk: 1.25, def: 1.05, speedAdjustment: -1, dodge: 0, identity: "Heavy bruiser" }),
    bramble_bat: Object.freeze({ id: "bramble_bat", name: "Bramble Bat", hp: 0.7, atk: 0.9, def: 0.65, speedAdjustment: 4, dodge: 12, identity: "Fast / evasive" }),
    bone_rattler: Object.freeze({ id: "bone_rattler", name: "Bone Rattler", hp: 1.1, atk: 0.95, def: 1.35, speedAdjustment: -1, dodge: 0, identity: "Defensive" }),
    sandy_crab: Object.freeze({ id: "sandy_crab", name: "Sandy Crab", hp: 1.2, atk: 0.75, def: 1.55, speedAdjustment: -2, dodge: 0, identity: "Tank" })
  });

  const BOSS_PROFILES = Object.freeze({
    moss_king: Object.freeze({ id: "moss_king", name: "Moss King", hp: 3, atk: 1.15, def: 1.35, statusResist: 10, identity: "Tank / sustain-pressure" }),
    ember_drake: Object.freeze({ id: "ember_drake", name: "Ember Drake", hp: 3.2, atk: 1.35, def: 1.1, statusResist: 15, identity: "Aggressive" }),
    frost_warden: Object.freeze({ id: "frost_warden", name: "Frost Warden", hp: 3.6, atk: 1.15, def: 1.5, statusResist: 20, identity: "Defensive" })
  });

  const PACK_MODIFIERS = Object.freeze({ 1: Object.freeze({ hp: 1, atk: 1 }), 2: Object.freeze({ hp: 0.72, atk: 0.72 }), 3: Object.freeze({ hp: 0.605, atk: 0.605 }) });
  const ELITE_MODIFIERS = Object.freeze({ hp: 1.3, atk: 1.1, def: 1.05 });
  const BOSS_ENRAGE_THRESHOLD = 0.5;
  const BOSS_ENRAGE_ATK_MULTIPLIER = 1.2;

  function numberOr(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function dungeonV2Round(value) {
    return Math.round(Number(value) || 0);
  }

  function clampFloor(floor) {
    return Math.max(1, Math.floor(Number(floor) || 1));
  }

  function classifyDungeonEncounter(floor) {
    const value = clampFloor(floor);
    if (value % 10 === 0) return ENCOUNTER_TYPES.CHAPTER_BOSS;
    if (value % 10 === 5) return ENCOUNTER_TYPES.ELITE;
    return ENCOUNTER_TYPES.NORMAL;
  }

  function dungeonChapterForFloor(floor) {
    const value = clampFloor(floor);
    return Math.floor((value - 1) / 10) + 1;
  }

  function dungeonChapterFloor(floor) {
    const value = clampFloor(floor);
    return ((value - 1) % 10) + 1;
  }

  // Monotone cubic interpolation gives a continuous, smooth curve through the
  // four locked sample points without introducing floor breakpoints in gameplay.
  // Outside the approved samples it continues with the nearest endpoint slope.
  function interpolateDungeonV2Curve(floor, key) {
    const x = clampFloor(floor);
    const points = NORMAL_REFERENCE_POINTS;
    if (x <= points[0].floor) return points[0][key];
    if (x >= points[points.length - 1].floor) {
      const a = points[points.length - 2];
      const b = points[points.length - 1];
      return b[key] + (x - b.floor) * ((b[key] - a[key]) / (b.floor - a.floor));
    }

    let index = 0;
    while (index < points.length - 2 && x > points[index + 1].floor) index += 1;
    const p0 = points[index];
    const p1 = points[index + 1];
    const pPrev = points[Math.max(0, index - 1)];
    const pNext = points[Math.min(points.length - 1, index + 2)];
    const h = p1.floor - p0.floor;
    const t = (x - p0.floor) / h;
    const secant = (p1[key] - p0[key]) / h;
    const m0 = index === 0 ? secant : (p1[key] - pPrev[key]) / (p1.floor - pPrev.floor);
    const m1 = index + 1 === points.length - 1 ? secant : (pNext[key] - p0[key]) / (pNext.floor - p0.floor);
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * p0[key] + h10 * h * m0 + h01 * p1[key] + h11 * h * m1;
  }

  function dungeonV2NormalBaseStats(floor) {
    return {
      hp: dungeonV2Round(interpolateDungeonV2Curve(floor, "hp")),
      atk: dungeonV2Round(interpolateDungeonV2Curve(floor, "atk")),
      def: dungeonV2Round(interpolateDungeonV2Curve(floor, "def"))
    };
  }

  function getDungeonV2MonsterProfile(monsterId) {
    return MONSTER_IDENTITY_PROFILES[String(monsterId || "")] || null;
  }

  function getDungeonV2BossProfile(bossId) {
    return BOSS_PROFILES[String(bossId || "")] || null;
  }

  function resolveDungeonV2NormalStats(floor, monsterId, options = {}) {
    const profile = getDungeonV2MonsterProfile(monsterId) || MONSTER_IDENTITY_PROFILES.jelly_slime;
    const packCount = Math.max(1, Math.min(3, Math.floor(Number(options.packCount) || 1)));
    const pack = PACK_MODIFIERS[packCount];
    const base = dungeonV2NormalBaseStats(floor);
    const elite = options.elite === true;
    const modifier = options.modifier || {};
    return {
      hp: dungeonV2Round(base.hp * profile.hp * pack.hp * (elite ? ELITE_MODIFIERS.hp : 1) * numberOr(modifier.hpMult, 1)),
      atk: dungeonV2Round(base.atk * profile.atk * pack.atk * (elite ? ELITE_MODIFIERS.atk : 1) * numberOr(modifier.atkMult, 1)),
      def: Math.max(0, dungeonV2Round(base.def * profile.def * (elite ? ELITE_MODIFIERS.def : 1) * numberOr(modifier.defMult, 1))),
      speedAdjustment: profile.speedAdjustment,
      dodge: profile.dodge,
      profileId: profile.id,
      identity: profile.identity,
      encounterType: elite ? ENCOUNTER_TYPES.ELITE : ENCOUNTER_TYPES.NORMAL,
      packCount
    };
  }

  function resolveDungeonV2BossStats(floor, bossId) {
    const profile = getDungeonV2BossProfile(bossId) || BOSS_PROFILES.moss_king;
    const base = dungeonV2NormalBaseStats(floor);
    return {
      hp: dungeonV2Round(base.hp * profile.hp),
      atk: dungeonV2Round(base.atk * profile.atk),
      def: Math.max(0, dungeonV2Round(base.def * profile.def)),
      statusResist: profile.statusResist,
      profileId: profile.id,
      identity: profile.identity,
      encounterType: ENCOUNTER_TYPES.CHAPTER_BOSS,
      packCount: 1
    };
  }

  function isDungeonV2BossEnraged(unit) {
    return !!(unit && unit.flags && unit.flags.dungeonV2Enraged);
  }

  // This is intentionally an adapter around Battle Core state. It changes only
  // the V2 boss's prepared ATK once; Battle Core still owns every hit/action.
  function applyDungeonV2BossEnrage(state) {
    if (!state || !state.units) return state;
    Object.values(state.units).forEach(unit => {
      if (!unit || unit.kind !== "boss" || unit.hp <= 0 || unit.dead || unit.hp >= unit.maxHp * BOSS_ENRAGE_THRESHOLD || isDungeonV2BossEnraged(unit)) return;
      unit.flags = unit.flags || {};
      const baseAtk = numberOr(unit.flags.dungeonV2BaseAtk, unit.atk);
      unit.flags.dungeonV2BaseAtk = baseAtk;
      unit.flags.dungeonV2Enraged = true;
      unit.atk = dungeonV2Round(baseAtk * BOSS_ENRAGE_ATK_MULTIPLIER);
    });
    return state;
  }

  // Skip uses the exact same Battle Core battleStep resolver as normal play;
  // this helper only inserts the Dungeon V2 enrage boundary between actions.
  function simulateDungeonV2Battle(inputState, battleCore, maxActions = 10000) {
    if (!battleCore || typeof battleCore.battleStep !== "function") throw new Error("battle_core_required");
    let state = JSON.parse(JSON.stringify(inputState));
    state.flags = { ...(state.flags || {}), skipResolving: true, auto: false };
    let actions = 0;
    while (!state.result && actions < maxActions) {
      const result = battleCore.battleStep(state, { type: "basic" });
      state = applyDungeonV2BossEnrage(result.state);
      actions += result.completedAction ? 1 : 0;
    }
    state.flags.skipResolving = false;
    if (!state.result) state.result = "invalid";
    return state;
  }

  const api = {
    ENCOUNTER_TYPES,
    NORMAL_REFERENCE_POINTS,
    MONSTER_IDENTITY_PROFILES,
    BOSS_PROFILES,
    PACK_MODIFIERS,
    ELITE_MODIFIERS,
    BOSS_ENRAGE_THRESHOLD,
    BOSS_ENRAGE_ATK_MULTIPLIER,
    classifyDungeonEncounter,
    dungeonChapterForFloor,
    dungeonChapterFloor,
    interpolateDungeonV2Curve,
    dungeonV2NormalBaseStats,
    getDungeonV2MonsterProfile,
    getDungeonV2BossProfile,
    resolveDungeonV2NormalStats,
    resolveDungeonV2BossStats,
    isDungeonV2BossEnraged,
    applyDungeonV2BossEnrage,
    simulateDungeonV2Battle
  };
  Object.assign(root, { DUNGEON_V2: api });
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
