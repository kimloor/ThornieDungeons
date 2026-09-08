// Applies a fetched game-balance config on top of the hardcoded defaults below.
// Every field is validated defensively — a partial or malformed sheet should never crash the game;
// missing/invalid pieces just keep their current (default) values.
function applyGameConfig(cfg) {
  if (!cfg || cfg.error) return;
  try {
    if (Array.isArray(cfg.monsters) && cfg.monsters.length) {
      const normal = cfg.monsters.filter(m => !m.isBoss).map(monsterFromConfig);
      const bosses = cfg.monsters.filter(m => m.isBoss).map(monsterFromConfig);
      if (normal.length) ENEMY_POOL = normal;
      if (bosses.length) BOSS_POOL = bosses;
    }
  } catch (e) {}
  try {
    const n = cfg.equipmentNames;
    if (n && Array.isArray(n.weapon) && n.weapon.length) WEAPON_NAMES = n.weapon;
    if (n && Array.isArray(n.helmet) && n.helmet.length) HELMET_NAMES = n.helmet;
    if (n && Array.isArray(n.chest) && n.chest.length) CHEST_NAMES = n.chest;
    if (n && Array.isArray(n.gloves) && n.gloves.length) GLOVES_NAMES = n.gloves;
    if (n && Array.isArray(n.boots) && n.boots.length) BOOTS_NAMES = n.boots;
    if (n && Array.isArray(n.accessory) && n.accessory.length) ACCESSORY_NAMES = n.accessory;
  } catch (e) {}
  try {
    const rm = cfg.rarityMult;
    if (rm && typeof rm.rare === "number" && typeof rm.unique === "number" && typeof rm.elite === "number") {
      RARITY_MULT = {
        rare: rm.rare,
        unique: rm.unique,
        elite: rm.elite,
        mythic: typeof rm.mythic === "number" ? rm.mythic : RARITY_MULT.mythic,
        azure: typeof rm.azure === "number" ? rm.azure : RARITY_MULT.azure
      };
    }
  } catch (e) {}
  try {
    if (Array.isArray(cfg.pets) && cfg.pets.length) {
      const valid = cfg.pets.filter(p => p && p.id && p.rarity && p.active && p.active.type);
      if (valid.length) PET_POOL = valid;
    }
  } catch (e) {}
  try {
    if (Array.isArray(cfg.skills) && cfg.skills.length) {
      const valid = cfg.skills.filter(s => s && s.key && s.type);
      if (valid.length) SKILLS = valid.sort((a, b) => a.unlockLevel - b.unlockLevel);
    }
  } catch (e) {}
}
// Slugify fallback for a monster that's genuinely new (added via remote config with no
// matching static entry and no explicit id supplied) — should rarely trigger in practice
// since real monster ids should always be assigned explicitly going forward.
function slugifyMonsterName(name) {
  return String(name || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "unknown_monster";
}
// BUG FIX (prerequisite for per-monster loot tables): this used to drop `id` entirely, so
// ANY monster overridden via remote config silently lost its stable identity — harmless
// while nothing read monster.id besides makeEnemy's display/uid, but fatal once loot
// tables need to join on it. Preference order: explicit `m.id` from config > matching
// static ENEMY_POOL/BOSS_POOL entry by name (covers today's config, which only overrides
// name/color/mults) > slugified name as a last resort so id is never undefined.
function monsterFromConfig(m) {
  const staticMatch = (ENEMY_POOL || []).find(s => s.name === m.name) || (BOSS_POOL || []).find(s => s.name === m.name);
  return {
    id: m.id || (staticMatch && staticMatch.id) || slugifyMonsterName(m.name),
    name: m.name,
    color: m.color || "#7ED9A8",
    hpMult: typeof m.hpMult === "number" ? m.hpMult : 1,
    atkMult: typeof m.atkMult === "number" ? m.atkMult : 1,
    defBonus: typeof m.defBonus === "number" ? m.defBonus : 0,
    goldMult: typeof m.goldMult === "number" ? m.goldMult : 1,
    xpMult: typeof m.xpMult === "number" ? m.xpMult : 1
  };
}
