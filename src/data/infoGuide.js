// Game Guide content (Wave 1.5 PR C). Pure data, Thai only, shown at More > Information > Game Guide.
// Every number below is audited against production code (see tests/info-guide.test.js, which loads the real
// modules/worker constants and fails when a number here drifts). Content rules: docs/PLAYER-INFORMATION-CONTENT-POLICY.md
// (no internal security/validation details, nothing that helps cheating, no dates/promises, Thai only).
// When a game number changes, update INFO_GUIDE_FACTS in the same release.

const INFO_GUIDE_FACTS = Object.freeze({
  maxLevel: 99, statPointsPerLevel: 5, resetCostDiamonds: 100, xpToNextBase: 18, xpToNextPerLevel: 22,
  caps: Object.freeze({ accuracy: 99, critChance: 80, critDamage: 300, dodge: 60 }),
  hitChanceMin: 5, hitChanceMax: 99,
  tierLastFloors: Object.freeze([30, 50, 70, 90]),
  baseStats: Object.freeze({
    weapon: [14, 18, 24, 31, 40], gloves: [6, 8, 10, 13, 17], chest: [9, 12, 15, 20, 26],
    helmet: [6, 8, 10, 13, 17], boots: [5, 6, 9, 11, 14]
  }),
  accessoryHp: Object.freeze([40, 52, 68, 88, 114]),
  rarityMult: Object.freeze({ rare: 1, unique: 1.15, elite: 1.3, mythic: 1.5 }),
  empowerSlots: Object.freeze({ rare: 1, unique: 2, elite: 3, mythic: 4 }),
  rarityBands: Object.freeze([
    { from: 1, to: 10, rare: 82.5, unique: 15, elite: 2.5 }, { from: 11, to: 20, rare: 78, unique: 18, elite: 4 },
    { from: 21, to: 30, rare: 73, unique: 21, elite: 6 }, { from: 31, to: 50, rare: 69, unique: 24, elite: 7 },
    { from: 51, to: 70, rare: 64, unique: 28, elite: 8 }, { from: 71, to: 90, rare: 60, unique: 30, elite: 10 },
    { from: 91, to: null, rare: 55, unique: 33, elite: 12 }
  ]),
  normalGearChancePct: 4, eliteGearChancePct: 8, dropBonusPerLuk: 0.2,
  materialBaseChancePct: 45, manaWeightPct: 14, ironWeightPct: 22, treasureManaWeightPct: 30,
  materialFloorDivisor: 12, materialExtraChancePct: 25,
  firstClear: Object.freeze({ 10: 1, 20: 1, 30: 1, 40: 2, 50: 2, 60: 3, 70: 3, 80: 4, 90: 4, 100: 5, 110: 5 }),
  packMult: Object.freeze({ 1: 1, 2: 1.35, 3: 1.65 }),
  expSamples: Object.freeze([[1, 8], [10, 30], [30, 78], [50, 126], [100, 246]]),
  goldSamples: Object.freeze([[1, 23], [30, 110], [31, 120], [50, 196], [51, 210], [70, 305], [71, 320], [90, 453], [91, 480]]),
  enhanceMax: 10, enhanceStatPct: 6, enhanceRates: Object.freeze([95, 90, 82, 72, 60, 50, 40, 30, 20, 15]),
  tierEconomy: Object.freeze([1, 2.25, 3.75, 5.75, 8.5]),
  enhanceGoldBase: 25, enhanceGoldPerLevel: 35, downgradeFromLevel: 6, downgradeChancePct: 50, protectionStoneDiamonds: 30,
  empowerOpenGold: Object.freeze([30, 75, 120, 165]),
  rerollGoldBase: 25, rerollGoldPerFilled: 15, rerollLockExtraPct: 60,
  options: Object.freeze({
    atkPct: { label: "ATK", values: [4, 5, 6, 7, 8], weights: [25, 25, 25, 15, 10], unit: "%" },
    defPct: { label: "DEF", values: [3, 4, 5, 6], weights: [35, 35, 20, 10], unit: "%" },
    hpPct: { label: "HP", values: [1, 2, 3], weights: [50, 35, 15], unit: "%" },
    mpPct: { label: "MP", values: [2, 3, 4], weights: [50, 35, 15], unit: "%" },
    critChance: { label: "Crit", values: [1, 2], weights: [75, 25], unit: "%" },
    critDamage: { label: "Crit Dmg", values: [2, 3, 4], weights: [50, 35, 15], unit: "%" },
    str: { label: "STR", values: [1], weights: [100], unit: "" },
    vit: { label: "VIT", values: [1], weights: [100], unit: "" },
    agi: { label: "AGI", values: [1], weights: [100], unit: "" },
    dex: { label: "DEX", values: [1], weights: [100], unit: "" },
    luk: { label: "LUK", values: [1], weights: [100], unit: "" }
  }),
  slotPools: Object.freeze({
    weapon: ["atkPct", "critChance", "critDamage", "str", "dex"],
    gloves: ["atkPct", "critChance", "critDamage", "str", "agi", "dex"],
    helmet: ["defPct", "hpPct", "mpPct", "vit", "agi", "dex", "luk"],
    chest: ["defPct", "hpPct", "vit", "agi", "luk"],
    boots: ["defPct", "hpPct", "vit", "agi", "luk"],
    accessory: ["hpPct", "mpPct", "critChance", "critDamage", "str", "vit", "agi", "dex", "luk"],
    wings: ["hpPct", "mpPct", "critChance", "critDamage"]
  }),
  enrageBelowHpPct: 50, enrageDamagePct: 20, statusChanceCap: 90,
  bossStatusResist: Object.freeze({ moss_king: 10, ember_drake: 15, frost_warden: 20 }),
  bossArmorPierceOnSilencePct: 30,
  setTwoPiece: 5, setFourCritDamage: 30, setFourMpMultiplier: 0.5, setFourCcResist: 10,
  floorPools: Object.freeze([[1, "Jelly Slime"], [6, "Spore Cap"], [16, "Tusky Boar"], [26, "Sandy Crab"], [36, "Bramble Bat"], [46, "Bone Rattler"]]),
  bosses: Object.freeze([[10, "Moss King"], [20, "Ember Drake"], [30, "Frost Warden"]]),
  packChancePct: Object.freeze([45, 35, 20]), eventChancePct: 25,
  arena: Object.freeze({
    unlockLevel: 10, ticketMax: 10, ticketPassiveHours: 2, ticketDailyGrant: 5, ticketCostDiamonds: 10, seasonDays: 7,
    ratingK: 24, ratingFloor: 1000, silver: 1100, gold: 1250, diamond: 1450,
    coins: { lower: [10, 6, 3], equal: [15, 9, 5], higher: [20, 12, 7] },
    promotions: [[500, 100], [1000, 200], [2000, 400]]
  }),
  raid: Object.freeze({
    staminaMax: 10, staminaRegenMinutes: 15, extraAttackDiamonds: 50, hitsPerAttack: 3, milestoneStepPct: 5, milestoneDiamonds: 5,
    bosses: [["Azure Angel", 150000], ["Robo Phoenix", 260000], ["Dark Dragonlord", 420000]], respawnHpPct: 20
  }),
  pet: Object.freeze({
    gachaCost: 100, ratePct: { r: 70, sr: 25, ssr: 5 }, maxLevel: 50, starMult: [1, 1.15, 1.35], starUpCost: [1, 2]
  })
});

const infoGuideF = INFO_GUIDE_FACTS;
const infoGuideList = (values, suffix = "") => values.map(value => value + suffix).join(" \u00b7 ");
const infoGuideOption = key => {
  const def = infoGuideF.options[key];
  return def.values.map((value, i) => "+" + value + def.unit + " (" + def.weights[i] + "%)").join(" \u00b7 ");
};

const INFO_GUIDE = {
  intro: "ตัวเลขในคู่มือนี้ตรวจจากระบบเกมเวอร์ชันปัจจุบัน หากมีการปรับบาลานซ์ คู่มือจะอัปเดตพร้อมประกาศ",
  topics: [
    {
      id: "drops", icon: "\ud83c\udf81", title: "อัตราดรอป", subtitle: "อุปกรณ์ วัสดุ และรางวัลบอสในดันเจี้ยน",
      blocks: [
        { heading: "อุปกรณ์จากมอนสเตอร์ปกติ",
          body: ["ชั้นปกติจะทอยโอกาสทีละตัวตามจำนวนมอนสเตอร์ในกลุ่ม และดรอปอุปกรณ์ได้สูงสุด 1 ชิ้นต่อชั้น"],
          rows: [
            ["โอกาสต่อมอนสเตอร์ 1 ตัว", infoGuideF.normalGearChancePct + "%"],
            ["ผลของ Drop Bonus", "คูณโอกาสด้วย (1 + Drop Bonus \u00f7 100)"],
            ["ที่มาของ Drop Bonus", "LUK ละ " + infoGuideF.dropBonusPerLuk + "% (LUK 100 = 20% \u2192 ได้ 4.8% ต่อตัว)"]
          ] },
        { heading: "Elite และ Boss",
          body: ["ชั้นที่ลงท้าย 5 คือ Elite ชั้นที่ลงท้าย 0 คือ Boss"],
          rows: [
            ["Elite", infoGuideF.eliteGearChancePct + "% ต่อชั้น (Drop Bonus ไม่เพิ่มโอกาสนี้)"],
            ["Boss", "ไม่ดรอปอุปกรณ์ทั่วไป ดูรางวัลครั้งแรกด้านล่าง"]
          ] },
        { heading: "ความหายากของอุปกรณ์ที่ดรอป",
          body: ["ยิ่งชั้นสูง โอกาสได้ Unique และ Elite ยิ่งมาก Mythic ไม่ดรอปจากดันเจี้ยน ต้องคราฟต์จากวัสดุบอส"],
          rows: infoGuideF.rarityBands.map(band => [
            band.to ? "ชั้น " + band.from + "\u2013" + band.to : "ชั้น " + band.from + " ขึ้นไป",
            "Rare " + band.rare + "% \u00b7 Unique " + band.unique + "% \u00b7 Elite " + band.elite + "%"]) },
        { heading: "ค่าพื้นฐานตาม Tier",
          body: ["ค่าจริง = ค่าพื้นฐานของ Tier \u00d7 ตัวคูณความหายาก (ปัดเศษ)"],
          rows: [
            ["Tier 1 / 2 / 3 / 4 / 5", "ชั้น 1\u2013" + infoGuideF.tierLastFloors[0] + " / \u2013" + infoGuideF.tierLastFloors[1] + " / \u2013" + infoGuideF.tierLastFloors[2] + " / \u2013" + infoGuideF.tierLastFloors[3] + " / 91+"],
            ["Weapon ATK", infoGuideList(infoGuideF.baseStats.weapon)],
            ["Gloves ATK", infoGuideList(infoGuideF.baseStats.gloves)],
            ["Chest DEF", infoGuideList(infoGuideF.baseStats.chest)],
            ["Helmet DEF", infoGuideList(infoGuideF.baseStats.helmet)],
            ["Boots DEF", infoGuideList(infoGuideF.baseStats.boots)],
            ["Accessory HP", infoGuideList(infoGuideF.accessoryHp)],
            ["Rare", "\u00d71 \u00b7 Enchant " + infoGuideF.empowerSlots.rare + " ช่อง"],
            ["Unique", "\u00d71.15 \u00b7 Enchant " + infoGuideF.empowerSlots.unique + " ช่อง"],
            ["Elite", "\u00d71.3 \u00b7 Enchant " + infoGuideF.empowerSlots.elite + " ช่อง"],
            ["Mythic", "\u00d71.5 \u00b7 Enchant " + infoGuideF.empowerSlots.mythic + " ช่อง"]
          ] },
        { heading: "วัสดุ",
          body: ["มอนสเตอร์บางชนิดอาจมีของดรอปเสริมเฉพาะตัว"],
          rows: [
            ["โอกาสได้วัสดุต่อมอนสเตอร์", infoGuideF.materialBaseChancePct + "% + Drop Bonus"],
            ["ชนิด", "Mana Ore " + infoGuideF.manaWeightPct + "% \u00b7 Iron " + infoGuideF.ironWeightPct + "% \u00b7 ที่เหลือแบ่งเท่า ๆ กันระหว่าง Stone/Grass/Wood"],
            ["จำนวน", "1 + \u230a ชั้น \u00f7 " + infoGuideF.materialFloorDivisor + " \u230b ชิ้น และมีโอกาส " + infoGuideF.materialExtraChancePct + "% ได้เพิ่มอีก 1"],
            ["Elite", "จำนวนวัสดุที่ได้ \u00d72"]
          ] },
        { heading: "รางวัลครั้งแรกจากบอส",
          body: ["ชนะบอสที่เป็นชั้นล่าสุดที่ปลดล็อกเป็นครั้งแรก จะได้ Accessory ระดับ Elite 1 ชิ้นต่อชั้นบอส"],
          rows: [
            ["ชั้น 10 / 20 / 30", "Tier 1"], ["ชั้น 40 / 50", "Tier 2"], ["ชั้น 60 / 70", "Tier 3"],
            ["ชั้น 80 / 90", "Tier 4"], ["ชั้น 100 / 110", "Tier 5"]
          ] }
      ]
    },
    {
      id: "refine", icon: "\ud83d\udd28", title: "Refine", subtitle: "เสริมพลังอุปกรณ์ +1 ถึง +" + infoGuideF.enhanceMax,
      blocks: [
        { heading: "พื้นฐาน",
          body: ["Refine ใช้กับอุปกรณ์ปัจจุบัน แต่ละ +1 เพิ่มค่าสเตตัสหลักของอุปกรณ์ " + infoGuideF.enhanceStatPct + "% ของค่าพื้นฐาน"],
          rows: [["เลเวลสูงสุด", "+" + infoGuideF.enhanceMax]] },
        { heading: "อัตราสำเร็จ",
          body: [],
          rows: infoGuideF.enhanceRates.map((rate, i) => ["+" + i + " \u2192 +" + (i + 1), rate + "%"]) },
        { heading: "ค่าใช้จ่ายต่อครั้ง",
          body: ["ทุกครั้งที่ลอง ใช้ Iron 1 ชิ้น และทองตามสูตร ถึงลองแล้วล้มเหลวก็ไม่คืน"],
          rows: [
            ["ทอง", "(" + infoGuideF.enhanceGoldBase + " + " + infoGuideF.enhanceGoldPerLevel + " \u00d7 เลเวลปัจจุบัน) \u00d7 ตัวคูณ Tier (ปัดเศษ)"],
            ["ตัวคูณ Tier 1\u20135", infoGuideF.tierEconomy.map(value => "\u00d7" + value).join(" \u00b7 ")],
            ["ปีก (Wings)", "ใช้ตัวคูณเท่า Tier 5 (" + infoGuideF.tierEconomy[4] + ")"],
            ["ตัวอย่าง", "+0 \u2192 +1 ของ Tier 1 ใช้ " + infoGuideF.enhanceGoldBase + " ทอง + Iron 1"]
          ] },
        { heading: "ตกเลเวลและ Protection Stone",
          body: ["เมื่อเลเวลปัจจุบันตั้งแต่ +" + infoGuideF.downgradeFromLevel + " ขึ้นไป ถ้าลองแล้วล้มเหลว มีโอกาส " + infoGuideF.downgradeChancePct + "% ที่เลเวลลดลง 1 ขั้น อุปกรณ์จะไม่หายไป",
            "Protection Stone ใช้กันการตกเลเวล และจะถูกใช้เฉพาะตอนที่เกิดการตกเลเวลเท่านั้น"],
          rows: [["ราคา Protection Stone", infoGuideF.protectionStoneDiamonds + " เพชร (ซื้อได้ทีละ 1)"]] }
      ]
    },
    {
      id: "enchant", icon: "\u2728", title: "Enchant", subtitle: "ออปชันพิเศษบนอุปกรณ์",
      blocks: [
        { heading: "จำนวนช่อง",
          body: ["จำนวนช่อง Enchant ขึ้นกับความหายากของอุปกรณ์"],
          rows: [["Rare / Unique / Elite / Mythic", infoGuideList([infoGuideF.empowerSlots.rare, infoGuideF.empowerSlots.unique, infoGuideF.empowerSlots.elite, infoGuideF.empowerSlots.mythic], " ช่อง")]] },
        { heading: "เปิดช่องว่าง",
          body: ["ช่องที่ยังว่างเปิดได้ด้วยทองและ Mana Ore 1 ชิ้น ราคาทองขึ้นกับลำดับช่อง"],
          rows: [
            ["ทองพื้นฐานช่อง 1\u20134", infoGuideList(infoGuideF.empowerOpenGold)],
            ["ตัวคูณ", "ตามตัวคูณ Tier (ปีกคิดตัวคูณ 1)"]
          ] },
        { heading: "รีโรลค่า",
          body: ["รีโรลจะสุ่มเฉพาะค่าตัวเลขของออปชันเดิม ชนิดของออปชันไม่เปลี่ยน ล็อกช่องที่พอใจไว้ได้ แต่ต้องเหลืออย่างน้อย 1 ช่องที่ไม่ล็อก"],
          rows: [
            ["ทอง", "(" + infoGuideF.rerollGoldBase + " + " + infoGuideF.rerollGoldPerFilled + " \u00d7 จำนวนช่องที่มีออปชัน) \u00d7 (1 + " + (infoGuideF.rerollLockExtraPct / 100) + " \u00d7 จำนวนช่องที่ล็อก) \u00d7 ตัวคูณ"],
            ["วัสดุ", "Mana Ore 1 ชิ้น"]
          ] },
        { heading: "ออปชันและโอกาสของแต่ละค่า",
          body: [],
          rows: Object.keys(infoGuideF.options).map(key => [infoGuideF.options[key].label, infoGuideOption(key)]) },
        { heading: "ออปชันที่ออกได้ตามชนิดอุปกรณ์",
          body: ["แต่ละช่องสุ่มชนิดจากกลุ่มของอุปกรณ์ชิ้นนั้นเท่า ๆ กัน"],
          rows: Object.keys(infoGuideF.slotPools).map(slot => [
            slot.charAt(0).toUpperCase() + slot.slice(1),
            infoGuideF.slotPools[slot].map(key => infoGuideF.options[key].label).join(", ")]) }
      ]
    },
    {
      id: "stats", icon: "\ud83d\udcca", title: "ค่าสเตตัสและเพดาน", subtitle: "สูตรค่าพื้นฐาน เลเวล และค่าสูงสุด",
      blocks: [
        { heading: "เลเวลและแต้ม",
          body: [],
          rows: [
            ["เลเวลสูงสุด", String(infoGuideF.maxLevel)],
            ["แต้มสเตตัส", infoGuideF.statPointsPerLevel + " แต้มต่อเลเวล"],
            ["EXP เพื่อเลเวลถัดไป", "เลเวล \u00d7 " + infoGuideF.xpToNextPerLevel + " + " + infoGuideF.xpToNextBase],
            ["รีเซ็ตแต้มสเตตัส", infoGuideF.resetCostDiamonds + " เพชร"],
            ["รีเซ็ตแต้มสกิล", infoGuideF.resetCostDiamonds + " เพชร"]
          ] },
        { heading: "สูตรค่าพื้นฐานของตัวละคร",
          body: ["ยังไม่รวมโบนัสจากอุปกรณ์ ออปชัน และเซ็ต"],
          rows: [
            ["HP", "40 + 4 \u00d7 เลเวล + 12 \u00d7 VIT"],
            ["MP", "15 + 2 \u00d7 เลเวล"],
            ["ATK", "8 + เลเวล + 3 \u00d7 STR + \u230a0.5 \u00d7 DEX\u230b"],
            ["DEF", "2 + \u230a0.4 \u00d7 เลเวล\u230b + \u230a0.5 \u00d7 VIT\u230b"],
            ["Speed", "10 + 2 \u00d7 AGI"],
            ["Hit Rate", "80 + 0.5 \u00d7 DEX"],
            ["Dodge", "0.5 \u00d7 AGI"],
            ["Crit", "0.5 \u00d7 LUK"],
            ["Crit Damage", "เริ่มที่ 50% (ดาเมจคริ = 150%)"],
            ["Drop Bonus", infoGuideF.dropBonusPerLuk + " \u00d7 LUK"]
          ] },
        { heading: "เพดานค่าสุดท้าย",
          body: ["ค่ารวมหลังคิดอุปกรณ์และเซ็ตจะไม่เกินเพดานนี้"],
          rows: [
            ["Hit Rate", infoGuideF.caps.accuracy + "%"], ["Crit", infoGuideF.caps.critChance + "%"],
            ["Crit Damage", infoGuideF.caps.critDamage + "%"], ["Dodge", infoGuideF.caps.dodge + "%"],
            ["โอกาสโดนจริงในการต่อสู้", "Hit Rate \u2212 Dodge ของเป้าหมาย อยู่ระหว่าง " + infoGuideF.hitChanceMin + "% ถึง " + infoGuideF.hitChanceMax + "%"]
          ] }
      ]
    },
    {
      id: "cc-boss", icon: "\ud83d\udee1\ufe0f", title: "CC และ Boss", subtitle: "สถานะผิดปกติ ความต้านทาน และโหมดคลั่ง",
      blocks: [
        { heading: "สถานะผิดปกติ (CC)",
          body: ["สถานะหลักคือ Poison, Stun, Silence และ Armor Break โอกาสติดสถานะสูงสุด " + infoGuideF.statusChanceCap + "% และลดลงตามค่าต้านสถานะของเป้าหมาย Stun/Silence ลดเพิ่มตามค่าต้าน CC จากเซ็ต"] },
        { heading: "Boss กับสถานะ",
          body: ["Boss มีค่าต้านสถานะของตัวเอง และ CC บางชนิดทำงานต่างจากปกติ"],
          rows: [
            ["ต้านสถานะ Moss King", infoGuideF.bossStatusResist.moss_king + "%"],
            ["ต้านสถานะ Ember Drake", infoGuideF.bossStatusResist.ember_drake + "%"],
            ["ต้านสถานะ Frost Warden", infoGuideF.bossStatusResist.frost_warden + "%"],
            ["Stun ติด Boss", "ไม่ทำให้ Boss หยุดเดิน แต่แปลงเป็น Critical Hit"],
            ["Silence ติด Boss", "ไม่ทำให้ Boss ใช้สกิลไม่ได้ แต่แปลงเป็น Armor Pierce " + infoGuideF.bossArmorPierceOnSilencePct + "%"]
          ] },
        { heading: "โหมดคลั่ง (Enrage)",
          body: ["เมื่อ HP ของ Boss ต่ำกว่า " + infoGuideF.enrageBelowHpPct + "% จะเข้าสู่โหมดคลั่ง ดาเมจเพิ่ม " + infoGuideF.enrageDamagePct + "% และมีข้อความแจ้งในบันทึกการต่อสู้"] }
      ]
    },
    {
      id: "sets", icon: "\ud83e\udde9", title: "Set bonus และอาวุธบอส", subtitle: "โบนัสเซ็ต Mythic และสกิลประจำอาวุธ",
      blocks: [
        { heading: "เซ็ต Mythic",
          body: ["เซ็ต Mythic มี 3 ตระกูล: Azure, Robot, Skeleton โบนัสนับจากจำนวนชิ้นของตระกูลเดียวกันที่สวมอยู่"],
          rows: [
            ["2 ชิ้น", "Azure AGI +" + infoGuideF.setTwoPiece + " \u00b7 Robot VIT +" + infoGuideF.setTwoPiece + " \u00b7 Skeleton STR +" + infoGuideF.setTwoPiece],
            ["4 ชิ้น Azure", "MP ที่ใช้กับสกิลแอ็กทีฟลดเหลือ " + (infoGuideF.setFourMpMultiplier * 100) + "%"],
            ["4 ชิ้น Robot", "ต้าน CC +" + infoGuideF.setFourCcResist + " (Stun/Silence ติดยากขึ้น)"],
            ["4 ชิ้น Skeleton", "Crit Damage +" + infoGuideF.setFourCritDamage + "%"],
            ["6 ชิ้น Robot", "เมื่อ HP ลดต่ำกว่า 50% ได้ DEF Up 2 เทิร์น"],
            ["6 ชิ้น Skeleton", "เมื่อโจมตีคริติคอล ติด Armor Break 2 เทิร์นแน่นอน"]
          ] },
        { heading: "อาวุธบอส",
          body: ["อาวุธบอสแต่ละชนิดมีสกิลประจำตัว"],
          rows: [
            ["Spirit Greatsword (Moss King)", "โจมตีโดน: 30% ฟื้น HP 10%"],
            ["Lavalon Sword (Ember Drake)", "สกิลโดน: 10%/Hit โจมตีปกติเพิ่ม 1 ครั้ง"],
            ["Icicle Longsword (Frost Warden)", "ถูกโจมตี: 20% สวนกลับ 1 ครั้ง"]
          ] }
      ]
    },
    {
      id: "dungeon", icon: "\ud83c\udff0", title: "Dungeon", subtitle: "ศัตรูตามชั้น บอส อีเวนต์ และรางวัล EXP/ทอง",
      blocks: [
        { heading: "ศัตรูตามชั้น",
          body: ["ชั้นปกติสุ่มจากพูลศัตรู ซึ่งขยายเพิ่มเมื่อชั้นสูงขึ้น ชั้นที่ลงท้าย 5 เป็น Elite ชั้นที่ลงท้าย 0 เป็น Boss"],
          rows: infoGuideF.floorPools.map(([from, name]) => ["ตั้งแต่ชั้น " + from, "เพิ่ม " + name]) },
        { heading: "Boss ประจำชั้น",
          body: ["Boss ตายตัวและวนทุก 30 ชั้น ไม่ปะปนกับพูลศัตรูปกติ"],
          rows: infoGuideF.bosses.map(([floor, name]) => ["ชั้น " + floor + ", " + (floor + 30) + ", " + (floor + 60) + " ...", name]) },
        { heading: "ขนาดกลุ่มศัตรู",
          body: ["ชั้นปกติตั้งแต่ชั้น 5 ขึ้นไปมีศัตรู 1\u20133 ตัว (ชั้น 1\u20134 มี 1 ตัวเสมอ) ยิ่งมีหลายตัว รางวัล EXP/ทองยิ่งเพิ่ม"],
          rows: [
            ["ศัตรู 1 ตัว", infoGuideF.packChancePct[0] + "% \u00b7 รางวัล \u00d7" + infoGuideF.packMult[1]],
            ["ศัตรู 2 ตัว", infoGuideF.packChancePct[1] + "% \u00b7 รางวัล \u00d7" + infoGuideF.packMult[2]],
            ["ศัตรู 3 ตัว", infoGuideF.packChancePct[2] + "% \u00b7 รางวัล \u00d7" + infoGuideF.packMult[3]]
          ] },
        { heading: "รางวัล EXP และทอง",
          body: ["ค่าด้านล่างคือรางวัลของศัตรู 1 ตัวในชั้นปกติ Elite ได้ \u00d71.5 และ Boss ได้ \u00d72"],
          rows: [
            ["EXP", infoGuideF.expSamples.map(([f, v]) => "ชั้น " + f + " = " + v).join(" \u00b7 ")],
            ["ทอง", infoGuideF.goldSamples.map(([f, v]) => "ชั้น " + f + " = " + v).join(" \u00b7 ")]
          ] },
        { heading: "ชั้นอีเวนต์",
          body: ["ชั้นปกติมีโอกาส " + infoGuideF.eventChancePct + "% เป็นชั้นอีเวนต์ แต่ละแบบมีโอกาสเท่ากัน"],
          rows: [
            ["Golden", "ทองที่ได้ \u00d72.2"], ["Arcane", "EXP ที่ได้ \u00d72"],
            ["Treasure", "โอกาสได้วัสดุเพิ่ม 35 จุด, อุปกรณ์ที่ดรอปเป็น Rare/Unique อย่างละ 50%, Mana Ore ออกบ่อยขึ้นเป็น " + infoGuideF.treasureManaWeightPct + "%"],
            ["Rage", "ศัตรู ATK \u00d71.55, HP \u00d70.8, ทอง \u00d71.35"],
            ["Rush", "ศัตรู Speed \u00d72"],
            ["Oasis", "ทุกเทิร์น ทุกฝ่ายฟื้น HP 5% ของ Max HP"],
            ["Toxic", "Hero ติด Poison 5% ของ Max HP ต่อเทิร์น นาน 3 เทิร์น"]
          ] }
      ]
    },
    {
      id: "arena", icon: "\u2694\ufe0f", title: "Arena", subtitle: "ตั๋ว เรตติ้ง ระดับ และรางวัล",
      blocks: [
        { heading: "เข้าร่วมและตั๋ว",
          body: [],
          rows: [
            ["ปลดล็อกที่เลเวล", String(infoGuideF.arena.unlockLevel)],
            ["ตั๋วสูงสุด", String(infoGuideF.arena.ticketMax)],
            ["ตั๋วฟื้นตัวเอง", "1 ใบทุก " + infoGuideF.arena.ticketPassiveHours + " ชั่วโมง"],
            ["ตั๋วรายวัน", infoGuideF.arena.ticketDailyGrant + " ใบ"],
            ["ซื้อตั๋ว", infoGuideF.arena.ticketCostDiamonds + " เพชรต่อใบ"],
            ["ความยาวซีซัน", infoGuideF.arena.seasonDays + " วัน"]
          ] },
        { heading: "เรตติ้งและระดับ",
          body: ["เรตติ้งเริ่มที่ " + infoGuideF.arena.ratingFloor + " ปรับแบบ Elo (K = " + infoGuideF.arena.ratingK + ") คู่ต่อสู้ที่ได้ให้เลือกอยู่ในช่วงเรตติ้งต่ำกว่า/ใกล้เคียง/สูงกว่าคุณ"],
          rows: [
            ["Bronze", "ต่ำกว่า " + infoGuideF.arena.silver], ["Silver", infoGuideF.arena.silver + "+"],
            ["Gold", infoGuideF.arena.gold + "+"], ["Diamond", infoGuideF.arena.diamond + "+"]
          ] },
        { heading: "Arena Coin ต่อแมตช์",
          body: ["รับตามผลและช่วงเรตติ้งคู่ต่อสู้ (ชนะ / เสมอ / แพ้)"],
          rows: [
            ["คู่ต่อสู้เรตติ้งต่ำกว่า", infoGuideF.arena.coins.lower.join(" / ")],
            ["คู่ต่อสู้ใกล้เคียง", infoGuideF.arena.coins.equal.join(" / ")],
            ["คู่ต่อสู้เรตติ้งสูงกว่า", infoGuideF.arena.coins.higher.join(" / ")]
          ] },
        { heading: "โบนัสเลื่อนระดับ",
          body: ["รับครั้งแรกเมื่อขึ้นสู่ระดับใหม่"],
          rows: [
            ["Silver", infoGuideF.arena.promotions[0][0] + " Coin + " + infoGuideF.arena.promotions[0][1] + " เพชร"],
            ["Gold", infoGuideF.arena.promotions[1][0] + " Coin + " + infoGuideF.arena.promotions[1][1] + " เพชร"],
            ["Diamond", infoGuideF.arena.promotions[2][0] + " Coin + " + infoGuideF.arena.promotions[2][1] + " เพชร"]
          ] }
      ]
    },
    {
      id: "raid", icon: "\ud83d\udc09", title: "Raid Boss", subtitle: "การโจมตี รางวัลตามความเสียหาย และอันดับ",
      blocks: [
        { heading: "การโจมตี",
          body: ["Raid Boss ทั้งเซิร์ฟเวอร์ร่วมกันสู้ 1 ตัวต่อวัน เมื่อตัวหนึ่งถูกกำจัด ตัวถัดไปจะขึ้นมาแทน"],
          rows: [
            ["พลังโจมตีสูงสุด", infoGuideF.raid.staminaMax + " ครั้ง"],
            ["ฟื้นพลัง", "1 ครั้งทุก " + infoGuideF.raid.staminaRegenMinutes + " นาที"],
            ["ตีเพิ่มเมื่อพลังหมด", infoGuideF.raid.extraAttackDiamonds + " เพชรต่อครั้ง"],
            ["ต่อ 1 การโจมตี", infoGuideF.raid.hitsPerAttack + " Hit"]
          ] },
        { heading: "Boss และพลังชีวิต",
          body: ["Boss วนตามลำดับด้านล่าง ถ้ามีบอสเกิดใหม่ในวันเดียวกัน HP จะเพิ่มขึ้นรอบละ " + infoGuideF.raid.respawnHpPct + "% ของ HP ตั้งต้น"],
          rows: infoGuideF.raid.bosses.map(([name, hp]) => [name, "HP ตั้งต้น " + hp.toLocaleString("en-US")]) },
        { heading: "รางวัลตามความเสียหายที่คุณทำ",
          body: ["นับจากสัดส่วนความเสียหายที่คุณทำต่อ HP ของ Boss รางวัลส่งทางกล่องจดหมาย และก้าวที่ลงท้ายด้วย 0 ได้วัสดุบอสเพิ่มจากเพชรปกติ"],
          rows: [
            ["ทุก " + infoGuideF.raid.milestoneStepPct + "% ของ HP Boss", infoGuideF.raid.milestoneDiamonds + " เพชร"],
            ["ทุก 10%", "วัสดุบอสสุ่ม 1 ชิ้น (เพิ่มจากเพชร)"],
            ["25%", "ปีก Rare ของตระกูลบอส"],
            ["50%", "Accessory Unique 80% / Elite 20%"],
            ["75%", "สูตรเซ็ตสุ่มของตระกูลบอส"],
            ["99%", "ชิ้นส่วนเซ็ต Mythic สุ่มของตระกูลบอส"]
          ] },
        { heading: "รางวัลอันดับ Top 3",
          body: ["อันดับ 4 ลงไปได้วัสดุบอสสุ่ม 2 ชิ้น"],
          rows: [
            ["อันดับ 1", "ปีก Mythic + Boss Horn 3 + Boss Hide 3 + สูตรเซ็ต"],
            ["อันดับ 2", "ปีก Elite + Boss Horn 2 + Boss Hide 2 + สูตรเซ็ต"],
            ["อันดับ 3", "ปีก Unique + Boss Horn 1 + Boss Hide 1 + สูตรเซ็ต"]
          ] }
      ]
    },
    {
      id: "pets", icon: "\ud83d\udc3e", title: "Pet", subtitle: "กาชา ดาว และค่าสเตตัสของ Pet",
      blocks: [
        { heading: "กาชา",
          body: ["สุ่มด้วยเพชร ได้ Pet ในระดับที่สุ่มได้ โดยแต่ละตัวในระดับเดียวกันมีโอกาสเท่ากัน"],
          rows: [
            ["ราคา", infoGuideF.pet.gachaCost + " เพชรต่อครั้ง"],
            ["R", infoGuideF.pet.ratePct.r + "% (Sprout, Flamekit, Sparkpup)"],
            ["SR", infoGuideF.pet.ratePct.sr + "% (Ember Fox, Moon Hare, Hell Wolf)"],
            ["SSR", infoGuideF.pet.ratePct.ssr + "% (Inferno Drake, Storm Phoenix)"]
          ] },
        { heading: "เลเวลและดาว",
          body: ["Pet ตัวซ้ำเก็บไว้ใช้เพิ่มดาว"],
          rows: [
            ["เลเวลสูงสุด", String(infoGuideF.pet.maxLevel)],
            ["ดาว 1 \u2192 2", "ใช้ตัวซ้ำ " + infoGuideF.pet.starUpCost[0] + " ตัว"],
            ["ดาว 2 \u2192 3", "ใช้ตัวซ้ำ " + infoGuideF.pet.starUpCost[1] + " ตัว"],
            ["ตัวคูณสเตตัสตามดาว", infoGuideF.pet.starMult.map(value => "\u00d7" + value).join(" \u00b7 ")]
          ] },
        { heading: "สูตรสเตตัสของ Pet",
          body: ["ค่าก่อนคูณดาว"],
          rows: [
            ["HP", "30 + 4 \u00d7 เลเวล + 7 \u00d7 VIT"],
            ["ATK", "5 + 0.7 \u00d7 เลเวล + 2 \u00d7 STR"],
            ["DEF", "2 + 0.25 \u00d7 เลเวล + 0.5 \u00d7 VIT"],
            ["Speed", "10 + 1.5 \u00d7 AGI"]
          ] }
      ]
    }
  ]
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = { INFO_GUIDE, INFO_GUIDE_FACTS };
}
