// ---------- Battle V1 backward-compatible save migration ----------
const BATTLE_SAVE_VERSION = 1;
const PET_V2_ID_ALIASES = Object.freeze({ thunder_cub: "hell_wolf" });

function migratePetV2Instance(pet) {
  if (!pet || typeof pet !== "object") return pet;
  const defId = PET_V2_ID_ALIASES[pet.defId] || pet.defId;
  return { ...pet, defId, star: Math.max(1, Math.min(3, Math.floor(Number(pet.star) || 1))) };
}

function migratePetDuplicatePoolV2(pool) {
  const next = {};
  for (const [rawId, rawCount] of Object.entries(pool || {})) {
    const id = PET_V2_ID_ALIASES[rawId] || rawId;
    next[id] = (next[id] || 0) + Math.max(0, Math.floor(Number(rawCount) || 0));
  }
  return next;
}

function migrateBattleV1Save(save) {
  const next = { ...(save || {}) };
  next.character = { ...(next.character || {}) };
  next.pets = (next.pets || []).map(migratePetV2Instance);
  next.petDuplicates = migratePetDuplicatePoolV2(next.petDuplicates);

  if (Number(next.character.skillVersion) !== BATTLE_SAVE_VERSION) {
    // Old skill ownership has no rank-for-rank equivalent. Reset only the old
    // allocation and preserve its full level entitlement for V1 redistribution.
    next.character.skillLevels = {};
    next.character.skillVersion = BATTLE_SAVE_VERSION;
    next.character.skillResetPoints = Math.max(0, Math.min(98, Math.floor(Number(next.character.level) || 1) - 1));
  }
  if (!next.character.skillLevels || typeof next.character.skillLevels !== "object") next.character.skillLevels = {};

  const validActive = new Set((typeof HERO_SKILLS_V1 !== "undefined" ? HERO_SKILLS_V1 : [])
    .filter(skill => skill.kind === "active").map(skill => skill.id));
  if (Array.isArray(next.quickSlots)) {
    next.quickSlots = next.quickSlots.slice(0, 4).map(slot => {
      if (!slot || slot.kind !== "skill") return slot || null;
      return validActive.has(slot.key || slot.skillId) ? slot : null;
    });
    while (next.quickSlots.length < 4) next.quickSlots.push(null);
  }
  return next;
}

if (typeof module !== "undefined") module.exports = {
  BATTLE_SAVE_VERSION, PET_V2_ID_ALIASES, migratePetV2Instance,
  migratePetDuplicatePoolV2, migrateBattleV1Save
};
