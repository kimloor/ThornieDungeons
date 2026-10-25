const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { INFO_GUIDE, INFO_GUIDE_FACTS: F } = require("../src/data/infoGuide.js");
const { INFO_CENTER, infoFindSection, infoResolveRoute } = require("../src/data/infoCenter.js");
const reward = require("../src/systems/rewardV2.js");
const enh = require("../src/systems/enhancementV2.js");
const mythic = require("../src/systems/mythicV2.js");
const dungeon = require("../src/systems/dungeonV2.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
const worker = read("workers/thornie-dungeons-api.js");
const guideText = JSON.stringify(INFO_GUIDE);

// Evaluate a top-level `const NAME = <expr>;` from a source file (used for Worker constants that cannot be required).
function constOf(source, name) {
  const start = source.indexOf(`const ${name} =`);
  assert.ok(start >= 0, `${name} not found`);
  const end = source.indexOf(";\n", start);
  return vm.runInNewContext("(" + source.slice(start, end).replace(/^const [A-Za-z0-9_]+ =\s*/, "") + ")");
}
const num = (source, regex, label) => {
  const match = source.match(regex);
  assert.ok(match, label || String(regex));
  return Number(match[1]);
};
// "0.3" -> 30, "0.14" -> 14 (digits after the decimal point, read as a percentage)
const pctDigits = (source, regex, label) => {
  const digits = String(num(source, regex, label));
  return Math.round(Number("0." + digits) * 100);
};

test("guide: structure, unique ids, every topic has readable blocks", () => {
  const expected = ["drops", "refine", "enchant", "stats", "cc-boss", "sets", "dungeon", "arena", "raid", "pets"];
  assert.deepEqual(INFO_GUIDE.topics.map(topic => topic.id), expected);
  INFO_GUIDE.topics.forEach(topic => {
    assert.ok(topic.title && topic.subtitle && topic.icon, topic.id);
    assert.ok(topic.blocks.length >= 1, topic.id);
    topic.blocks.forEach(block => {
      assert.ok(block.heading, topic.id);
      assert.ok(Array.isArray(block.body) && (block.body.length || (block.rows && block.rows.length)), `${topic.id}/${block.heading}`);
      (block.rows || []).forEach(row => {
        assert.equal(row.length, 2);
        assert.ok(typeof row[0] === "string" && typeof row[1] === "string" && row[0] && row[1], `${topic.id}/${block.heading}`);
        assert.doesNotMatch(row[0] + row[1], /undefined|NaN|\[object/, `${topic.id}/${block.heading}`);
      });
    });
  });
});

test("guide section is wired into the Information Center with deep links", () => {
  const section = infoFindSection("guide");
  assert.equal(section.kind, "guide");
  assert.equal(section.topics, INFO_GUIDE.topics);
  INFO_GUIDE.topics.forEach(topic => assert.deepEqual(infoResolveRoute("guide/" + topic.id), { sectionId: "guide", topicId: topic.id }));
  assert.deepEqual(infoResolveRoute("guide/unknown"), { sectionId: "guide", topicId: "" });
  const ui = read("src/ui/infoCenter.js");
  assert.match(ui, /function InfoGuide\(/);
  assert.match(ui, /section\.kind === "guide"/);
  assert.match(ui, /md-info-acc-head/);
  assert.match(ui, /aria-expanded/);
  assert.match(ui, /useState\(resolved \? resolved\.topicId : ""\)/);
  const build = read("build.js");
  assert.ok(build.indexOf('"data/infoGuide.js"') > -1 && build.indexOf('"data/infoGuide.js"') < build.indexOf('"data/infoCenter.js"'));
  assert.match(read("index.html"), /const INFO_GUIDE = \{/);
});

test("drops: gear tiers, rarity bands, chances, first-clear and rewards match rewardV2", () => {
  assert.equal(JSON.stringify(F.baseStats), JSON.stringify(reward.BASE_STATS));
  assert.equal(JSON.stringify(F.accessoryHp), JSON.stringify(reward.ACCESSORY_BASE_HP));
  Object.keys(F.rarityMult).forEach(r => {
    assert.equal(F.rarityMult[r], reward.RARITIES[r].multiplier, r);
    assert.equal(F.empowerSlots[r], reward.RARITIES[r].empowerSlots, r);
    assert.equal(F.empowerSlots[r], enh.EMPOWER_CAPACITY[r], r);
  });
  assert.equal(JSON.stringify(F.rarityBands.map(b => [b.from, b.to, b.rare, b.unique, b.elite])),
    JSON.stringify(reward.RARITY_BANDS.map(b => [b.minFloor, b.maxFloor, b.weights.rare, b.weights.unique, b.weights.elite])));
  assert.deepEqual(F.tierLastFloors, [1, 2, 3, 4].map(t => reward.TIERS[t].maxFloor));
  assert.equal(reward.dungeonV2GenericEquipmentChance("normal", 0) * 100, F.normalGearChancePct);
  assert.equal(reward.dungeonV2GenericEquipmentChance("elite", 0) * 100, F.eliteGearChancePct);
  assert.equal(reward.dungeonV2GenericEquipmentChance("elite", 100) * 100, F.eliteGearChancePct, "Drop Bonus does not change Elite");
  assert.ok(Math.abs(reward.dungeonV2GenericEquipmentChance("normal", 20) - 0.048) < 1e-9);
  assert.equal(reward.dungeonV2GenericEquipmentChance("chapter_boss", 0), 0);
  Object.entries(F.firstClear).forEach(([floor, tier]) => {
    const item = reward.FIRST_CLEAR_ACCESSORIES[floor];
    assert.equal(item.gearTier, tier, floor);
    assert.equal(item.rarity, "elite", floor);
  });
  assert.equal(Object.keys(F.firstClear).length, Object.keys(reward.FIRST_CLEAR_ACCESSORIES).length);
  Object.entries(F.packMult).forEach(([count, mult]) => assert.equal(reward.dungeonV2PackMultiplier(Number(count)), mult));
  F.expSamples.forEach(([floor, exp]) => assert.equal(reward.dungeonV2RewardExp(floor), exp, "exp " + floor));
  F.goldSamples.forEach(([floor, gold]) => assert.equal(reward.dungeonV2RewardGold(floor), gold, "gold " + floor));
  assert.equal(reward.dungeonV2RewardExp(10, "chapter_boss"), reward.dungeonV2RewardExp(10) * 2);
  assert.equal(reward.dungeonV2RewardGold(15, "elite"), Math.round(reward.dungeonV2RewardGold(15) * 1.5));
  // Reward numbers shown to players also have to match what the Worker clamps with.
  assert.equal(JSON.stringify(constOf(worker, "DUNGEON_V2_REWARD_BASE_STATS")), JSON.stringify(reward.BASE_STATS));
  assert.equal(JSON.stringify(constOf(worker, "DUNGEON_V2_REWARD_TIER_MULT")), JSON.stringify([1, 2, 3, 4, 5].map(t => reward.TIERS[t].multiplier)));
});

test("drops: material roll constants in client code", () => {
  const app = read("src/ui/App.js");
  const enhLegacy = read("src/systems/enhancement.js");
  assert.equal(num(app, /const matChance = 0\.(\d+) \+ \(currentPlayer\?\.dropBonus \|\| 0\) \/ 100/, "material base chance"), F.materialBaseChancePct);
  assert.equal(num(app, /const eliteMaterialChance = 0\.(\d+) \+ \(currentPlayer\?\.dropBonus \|\| 0\) \/ 100/, "elite material chance"), F.materialBaseChancePct);
  assert.equal(pctDigits(enhLegacy, /const manaWeight = modifier\?\.rarityBoost \? 0\.(\d+) : 0\.\d+;/, "treasure mana weight"), F.treasureManaWeightPct);
  assert.equal(num(enhLegacy, /const manaWeight = modifier\?\.rarityBoost \? 0\.\d+ : 0\.(\d+);/, "mana weight"), F.manaWeightPct);
  assert.equal(num(enhLegacy, /const ironWeight = 0\.(\d+);/, "iron weight"), F.ironWeightPct);
  assert.match(enhLegacy, new RegExp(`Math\\.floor\\(floor / ${F.materialFloorDivisor}\\)`));
  assert.match(enhLegacy, new RegExp(`Math\\.random\\(\\) < 0\\.${F.materialExtraChancePct}`));
  assert.match(read("src/systems/stats.js"), new RegExp(`luk \\* ${F.dropBonusPerLuk}`));
});

test("refine: rates, cost, downgrade and protection match enhancementV2 and the Worker", () => {
  assert.equal(F.enhanceMax, enh.ENHANCE_MAX);
  assert.equal(F.enhanceStatPct / 100, enh.ENHANCE_STAT_PCT);
  assert.deepEqual(F.enhanceRates, enh.ENHANCE_RATES);
  assert.deepEqual(F.tierEconomy, [1, 2, 3, 4, 5].map(t => enh.TIER_ECONOMY[t]));
  const item = { rewardVersion: 2, itemModelVersion: 2, type: "weapon", gearTier: 1, rarity: "rare", enhanceLevel: 0 };
  const first = enh.enhanceCost(item, 0);
  assert.equal(first.gold, F.enhanceGoldBase);
  assert.equal(first.iron, 1);
  assert.equal(enh.enhanceCost(item, 1).gold, F.enhanceGoldBase + F.enhanceGoldPerLevel);
  // Downgrade starts at the configured level and uses the configured chance.
  const fail = (level, roll, stones = 0) => enh.resolveEnhanceAttempt({ level, successRoll: 0.999, downgradeRoll: roll, protectionRequested: stones > 0, protectionStones: stones });
  assert.equal(fail(F.downgradeFromLevel - 1, 0).levelAfter, F.downgradeFromLevel - 1, "no downgrade below the threshold");
  assert.equal(fail(F.downgradeFromLevel, 0).levelAfter, F.downgradeFromLevel - 1);
  assert.equal(fail(F.downgradeFromLevel, F.downgradeChancePct / 100 - 0.001).levelAfter, F.downgradeFromLevel - 1);
  assert.equal(fail(F.downgradeFromLevel, F.downgradeChancePct / 100).levelAfter, F.downgradeFromLevel);
  assert.equal(fail(F.downgradeFromLevel, 0, 1).protectionConsumed, true);
  assert.equal(fail(F.downgradeFromLevel, 0.99, 1).protectionConsumed, false, "stone is only used when a downgrade would happen");
  assert.match(worker, new RegExp(`protection_stone: \\{ currency: "diamonds", cost: ${F.protectionStoneDiamonds} \\}`));
});

test("enchant: slots, open cost, reroll cost and option tables match enhancementV2", () => {
  assert.deepEqual(F.empowerOpenGold, enh.EMPOWER_OPEN_BASE_GOLD);
  const item = { rewardVersion: 2, itemModelVersion: 2, type: "weapon", gearTier: 1, rarity: "mythic", empowerSlotCapacity: 4, enhanceLevel: 0 };
  F.empowerOpenGold.forEach((gold, index) => assert.equal(enh.empowerOpenCost(item, index).gold, gold));
  assert.equal(enh.empowerOpenCost(item, 0).manaOre, 1);
  const reroll = enh.empowerRerollCost(item, 3, 1);
  assert.equal(reroll.gold, Math.round((F.rerollGoldBase + 3 * F.rerollGoldPerFilled) * (1 + 1 * F.rerollLockExtraPct / 100)));
  assert.equal(reroll.manaOre, 1);
  assert.equal(enh.empowerRerollCost(item, 2, 2), null, "at least one slot must stay unlocked");
  Object.entries(F.options).forEach(([key, def]) => {
    const real = enh.OPTION_DEFS[key];
    assert.deepEqual({ label: def.label, values: def.values, weights: def.weights }, { label: real.label, values: real.values, weights: real.weights }, key);
  });
  assert.equal(Object.keys(F.options).length, Object.keys(enh.OPTION_DEFS).length);
  assert.deepEqual(F.slotPools, enh.SLOT_POOLS);
});

test("stats: level, points, reset cost, formulas and caps match client code", () => {
  const constants = read("src/data/constants.js");
  assert.equal(num(constants, /const MAX_LEVEL = (\d+);/), F.maxLevel);
  assert.equal(num(constants, /const STAT_POINTS_PER_LEVEL = (\d+);/), F.statPointsPerLevel);
  assert.equal(num(constants, /const STAT_RESET_COST = (\d+);/), F.resetCostDiamonds);
  assert.equal(num(constants, /const SKILL_RESET_COST = (\d+);/), F.resetCostDiamonds);
  const stats = read("src/systems/stats.js");
  assert.match(stats, new RegExp(`Math\\.min\\(${F.caps.accuracy}, `));
  assert.match(stats, new RegExp(`Math\\.min\\(${F.caps.critChance}, `));
  assert.match(stats, new RegExp(`Math\\.min\\(${F.caps.critDamage}, `));
  assert.match(stats, new RegExp(`Math\\.min\\(${F.caps.dodge}, `));
  assert.match(stats, /40 \+ level \* 4 \+ vit \* 12|40 \+ .*\* 4 \+ .*\* 12/);
  assert.match(read("src/systems/battleCore.js"), new RegExp(`clamp\\([^\\n]*${F.hitChanceMin}, ${F.hitChanceMax}\\)`));
});

test("cc-boss: boss resist, enrage and conversion match battle core", () => {
  assert.equal(dungeon.BOSS_ENRAGE_THRESHOLD * 100, F.enrageBelowHpPct);
  assert.equal(Math.round((dungeon.BOSS_ENRAGE_DAMAGE_MULTIPLIER - 1) * 100), F.enrageDamagePct);
  Object.entries(F.bossStatusResist).forEach(([id, resist]) => assert.equal(dungeon.BOSS_PROFILES[id].statusResist, resist, id));
  const core = read("src/systems/battleCore.js");
  assert.match(core, new RegExp(`STATUS_PROC_CAP = ${F.statusChanceCap}`));
  assert.match(core, /key === "stun" \? "critical" : "armor_pierce"/);
  assert.match(core, new RegExp(`${F.bossArmorPierceOnSilencePct}% Armor Pierce`));
});

test("sets: set bonuses and boss weapon texts match mythicV2", () => {
  const equipped = id => Object.fromEntries(mythic.SET_SLOTS.slice(0, 6).map(slot => [slot, { type: slot, setId: id, setFamily: id, rewardVersion: 2, itemModelVersion: 2, rarity: "mythic", gearTier: 1 }]));
  const fx = id => mythic.setEffects(equipped(id));
  assert.equal(fx("skeleton").str, F.setTwoPiece);
  assert.equal(fx("robot").vit, F.setTwoPiece);
  assert.equal(fx("azure").agi, F.setTwoPiece);
  assert.equal(fx("skeleton").critDamage, F.setFourCritDamage);
  assert.equal(fx("azure").activeSkillMpMultiplier, F.setFourMpMultiplier);
  assert.equal(fx("robot").ccResist, F.setFourCcResist);
  assert.equal(fx("skeleton").skeletonCritArmorBreak, true);
  assert.equal(fx("robot").robotThresholdDefUp, true);
  // Azure has no 6-piece effect: six pieces behave exactly like four, and the guide says so.
  assert.equal(fx("azure").skeletonCritArmorBreak, false);
  assert.equal(fx("azure").robotThresholdDefUp, false);
  assert.equal(JSON.stringify({ ...fx("azure"), counts: 0 }), JSON.stringify({ ...mythic.setEffects(Object.fromEntries(mythic.SET_SLOTS.slice(0, 4).map(slot => [slot, { type: slot, setId: "azure", setFamily: "azure", rewardVersion: 2, itemModelVersion: 2, rarity: "mythic", gearTier: 1 }]))), counts: 0 }));
  const sets = INFO_GUIDE.topics.find(topic => topic.id === "sets");
  ["Azure", "Robot", "Skeleton"].forEach(name => {
    const block = sets.blocks.find(item => item.heading === name);
    assert.deepEqual(block.rows.map(row => row[0]), ["2 ชิ้น", "4 ชิ้น", "6 ชิ้น"], name);
  });
  assert.match(sets.blocks.find(item => item.heading === "Azure").rows[2][1], /ไม่มีโบนัสเพิ่ม/);
  assert.ok(["azure", "robot", "skeleton"].every(id => fx(id).counts[id] === 6), "fixture equips six pieces of one family");
  Object.values(mythic.BOSS_WEAPONS).forEach(weapon => assert.ok(guideText.includes(mythic.signatureText({ signatureId: weapon.signatureId }).replace(/"/g, '\\"')), weapon.id));
});

test("dungeon: monster pools, fixed bosses, events and pack odds match the Worker", () => {
  const poolFor = floor => {
    const fn = vm.runInNewContext("(" + worker.slice(worker.indexOf("function dungeonV2ServerMonsterPoolForFloor"), worker.indexOf("function dungeonV2ServerBossForFloor")).trim() + ")");
    return fn(floor);
  };
  const names = { jelly_slime: "Jelly Slime", spore_cap: "Spore Cap", tusky_boar: "Tusky Boar", sandy_crab: "Sandy Crab", bramble_bat: "Bramble Bat", bone_rattler: "Bone Rattler" };
  F.floorPools.forEach(([from, name], index) => {
    assert.equal(names[poolFor(from)[index]], name);
    assert.equal(poolFor(from).length, index + 1);
    if (from > 1) assert.equal(poolFor(from - 1).length, index, "pool grows exactly at floor " + from);
  });
  const bossList = constOf(worker, "DUNGEON_V2_BOSS_ID_LIST");
  F.bosses.forEach(([floor, name], index) => {
    assert.equal(dungeon.BOSS_PROFILES[bossList[index]].name, name);
    assert.equal(floor, (index + 1) * 10);
  });
  assert.equal(constOf(worker, "DUNGEON_V2_EVENT_CHANCE") * 100, F.eventChancePct);
  const effects = constOf(worker, "DUNGEON_V2_EVENT_EFFECTS");
  assert.equal(effects.golden.goldMult, 2.2);
  assert.equal(effects.arcane.xpMult, 2);
  assert.equal(effects.treasure.dropBonusFlat, 35);
  assert.deepEqual([effects.rage.atkMult, effects.rage.hpMult, effects.rage.goldMult], [1.55, 0.8, 1.35]);
  assert.equal(effects.rush.speedMult, 2);
  assert.equal(effects.oasis.turnHealPct, 0.05);
  assert.deepEqual([effects.toxic.poisonDamagePct, effects.toxic.poisonDuration], [0.05, 3]);
  const [p1, p2] = F.packChancePct;
  assert.ok(worker.includes(`return roll < ${p1 / 100} ? 1 : roll < ${(p1 + p2) / 100} ? 2 : 3;`));
  assert.ok(worker.includes('role !== "normal" || floor < 5 ? 1'));
});

test("arena: tickets, rating, tiers and coins match the Worker", () => {
  const a = F.arena;
  assert.equal(constOf(worker, "ARENA_V2_UNLOCK_LEVEL"), a.unlockLevel);
  assert.equal(constOf(worker, "ARENA_TICKET_MAX"), a.ticketMax);
  assert.equal(constOf(worker, "ARENA_TICKET_PASSIVE_MS"), a.ticketPassiveHours * 3600000);
  assert.equal(constOf(worker, "ARENA_TICKET_DAILY_GRANT"), a.ticketDailyGrant);
  assert.equal(constOf(worker, "ARENA_TICKET_PURCHASE_COST"), a.ticketCostDiamonds);
  assert.equal(constOf(worker, "ARENA_SEASON_LENGTH_MS"), a.seasonDays * 86400000);
  assert.equal(constOf(worker, "ARENA_RATING_K"), a.ratingK);
  assert.equal(constOf(worker, "ARENA_RATING_FLOOR"), a.ratingFloor);
  assert.equal(constOf(worker, "ARENA_DIAMOND_ENTRY_RATING"), a.diamond);
  assert.match(worker, new RegExp(`value >= ${a.diamond} \\? "Diamond" : value >= ${a.gold} \\? "Gold" : value >= ${a.silver} \\? "Silver" : "Bronze"`));
  const coins = constOf(worker, "ARENA_COIN_REWARDS");
  ["lower", "equal", "higher"].forEach(band => assert.deepEqual(a.coins[band], [coins[band].win, coins[band].draw, coins[band].loss], band));
  const promo = constOf(worker, "ARENA_PROMOTION_REWARDS");
  [1, 2, 3].forEach(rank => assert.deepEqual(a.promotions[rank - 1], [promo[rank].arenaCoin, promo[rank].diamonds], "promotion " + rank));
});

test("raid and pets: constants match the Worker and pet code", () => {
  const r = F.raid;
  assert.equal(constOf(worker, "RAID_STAMINA_MAX"), r.staminaMax);
  assert.match(worker, new RegExp(`const RAID_STAMINA_REGEN_MS = ${r.staminaRegenMinutes} \\* 60 \\* 1000`));
  assert.match(worker, new RegExp(`const RAID_DIAMOND_REFILL_COST = ${r.extraAttackDiamonds};`));
  assert.match(worker, new RegExp(`const RAID_HITS_PER_ATTACK = ${r.hitsPerAttack};`));
  assert.equal(constOf(worker, "RAID_MILESTONE_DIAMOND_PER_STEP"), r.milestoneDiamonds);
  assert.match(worker, new RegExp(`const RAID_MILESTONE_STEP = ${r.milestoneStepPct};`));
  const defs = constOf(worker, "RAID_BOSS_DEFS");
  assert.equal(JSON.stringify(r.bosses), JSON.stringify(defs.map(def => [def.name, def.hpBase])));
  assert.match(worker, new RegExp(`hpBase \\* \\(1 \\+ spawnCountToday \\* ${r.respawnHpPct / 100}\\)`));
  const ranks = constOf(worker, "RAID_RANK_REWARDS");
  assert.equal(JSON.stringify(ranks.map(item => item.wingRarity)), JSON.stringify(["mythic", "elite", "unique"]));
  assert.equal(JSON.stringify(ranks.map(item => item.junk[0].quantity)), "[3,2,1]");
  assert.match(worker, /Math\.random\(\) < 0\.8 \? "unique" : "elite"/);

  const p = F.pet;
  const pets = read("src/systems/pets.js");
  assert.equal(num(pets, /const GACHA_COST = (\d+);/), p.gachaCost);
  assert.match(pets, new RegExp(`const PET_STAR_MULT = \\[${p.starMult.map(v => v.toFixed(2)).join(", ")}\\]`));
  assert.match(worker, new RegExp(`star === 1 \\? ${p.starUpCost[0]} : star === 2 \\? ${p.starUpCost[1]} : 0`));
  assert.match(worker, new RegExp(`const GACHA_COST = ${p.gachaCost}|cost: ${p.gachaCost}|${p.gachaCost}`));
  const pools = constOf(worker, "W45_PET_GACHA_POOLS");
  assert.equal(JSON.stringify([pools.r.length, pools.sr.length, pools.ssr.length]), "[3,3,2]");
  assert.equal(p.ratePct.r + p.ratePct.sr + p.ratePct.ssr, 100);
  assert.match(pets, /r: 0\.70|r: 0\.7\b/);
  assert.match(pets, /sr: 0\.25/);
  assert.match(pets, /ssr: 0\.05/);
  assert.match(read("workers/modules/shared.js"), /Math\.min\(50, /);
});

test("guide text shows the audited numbers (facts and text stay in sync)", () => {
  F.enhanceRates.forEach(rate => assert.ok(guideText.includes(rate + "%"), "rate " + rate));
  F.rarityBands.forEach(band => assert.ok(guideText.includes("Rare " + band.rare + "%"), "band " + band.from));
  F.arena.promotions.forEach(([coin, diamonds]) => assert.ok(guideText.includes(coin + " Coin + " + diamonds + " เพชร"), "promotion " + coin));
  assert.ok(guideText.includes("ราคา Protection Stone") && guideText.includes(F.protectionStoneDiamonds + " เพชร"));
  F.raid.bosses.forEach(([name, hp]) => assert.ok(guideText.includes(name) && guideText.includes(hp.toLocaleString("en-US")), name));
  Object.values(F.options).forEach(def => assert.ok(guideText.includes(def.label), def.label));
});

test("guide content boundary: no internal details, no dates or promises", () => {
  const text = [];
  (function walk(value) {
    if (typeof value === "string") text.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
  })(INFO_GUIDE);
  const joined = text.join("\n");
  [/anti-?cheat/i, /exploit/i, /pbkdf/i, /\bsalt/i, /\bhash/i, /\btoken/i, /validation/i, /migration/i, /\bD1\b/, /\bQA\b/, /\bGate\b/, /receipt/i, /requestId/i, /secret/i, /admin/i, /worker/i, /cheat|โกง/i]
    .forEach(pattern => assert.doesNotMatch(joined, pattern, String(pattern)));
  assert.doesNotMatch(joined, /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}|เร็ว ๆ นี้|จะเปิดให้|ภายใน/);
  assert.match(joined, /[\u0e00-\u0e7f]/);
});

test("safe area: opaque fixed strip keeps the iOS 27 top blur off the installed app", () => {
  const head = read("head.html");
  assert.match(head, /<div id="ios-top-strip" aria-hidden="true"><\/div>\s*<div id="root">/);
  assert.match(head, /@supports \(-webkit-touch-callout: none\) \{\s*#ios-top-strip \{[^}]*position: fixed; top: 0; left: 0; right: 0; height: max\(env\(safe-area-inset-top, 0px\), 20px\); background: #1B1233/);
  assert.match(head, /viewport-fit=cover/);
  assert.doesNotMatch(read("src/data/styles.js"), /body::before/);
});
