// Keeps Dungeon Floor Preview aligned with an active Battle V1 checkpoint.
// The map normally pre-rolls a fresh encounter for preview; when a safe cloud checkpoint
// exists, continuing that floor must preview the checkpoint's exact enemy pack instead.
(function installResumeFloorPreviewPatch(root) {
  if (typeof cloudGetBattleState !== "function" || typeof makeEncounter !== "function") return;

  let activeResume = null;

  function encounterFromCheckpoint(payload) {
    if (!payload || !Array.isArray(payload.enemyIds) || !payload.units) return null;
    const monsters = payload.enemyIds.map((enemyId) => {
      const unit = payload.units[enemyId];
      if (!unit) return null;
      return {
        ...unit,
        id: unit.monsterDefId || unit.id,
        uid: unit.id,
        hp: Number(unit.hp) || 0,
        maxHp: Math.max(1, Number(unit.maxHp) || Number(unit.hp) || 1),
        isBoss: unit.kind === "boss" || unit.kind === "raid_boss" || !!unit.isBoss,
        isEliteBoss: !!unit.isEliteBoss,
      };
    }).filter(Boolean);
    return monsters.length ? monsters : null;
  }

  function rememberCheckpoint(characterId, checkpoint) {
    const payload = checkpoint && checkpoint.payload;
    const encounter = encounterFromCheckpoint(payload);
    if (!payload || !encounter) {
      if (!characterId || activeResume?.characterId === String(characterId)) activeResume = null;
      return;
    }
    activeResume = {
      characterId: String(characterId || ""),
      battleId: String(payload.battleId || checkpoint.battleId || ""),
      floor: Math.max(1, Math.floor(Number(payload.floor) || 1)),
      encounter,
    };
  }

  const originalGetBattleState = cloudGetBattleState;
  cloudGetBattleState = async function patchedCloudGetBattleState(serverUrl, characterId, ...rest) {
    const result = await originalGetBattleState(serverUrl, characterId, ...rest);
    if (result?.ok) rememberCheckpoint(characterId, result.checkpoint);
    return result;
  };

  const originalMakeEncounter = makeEncounter;
  makeEncounter = function patchedMakeEncounter(floor) {
    if (activeResume && Number(floor) === activeResume.floor) {
      return activeResume.encounter.map(monster => ({ ...monster }));
    }
    return originalMakeEncounter(floor);
  };

  if (typeof cloudCompleteBattle === "function") {
    const originalCompleteBattle = cloudCompleteBattle;
    cloudCompleteBattle = async function patchedCloudCompleteBattle(serverUrl, characterId, battleId, ...rest) {
      const result = await originalCompleteBattle(serverUrl, characterId, battleId, ...rest);
      if (result?.ok && activeResume && String(battleId) === activeResume.battleId) activeResume = null;
      return result;
    };
  }

  if (typeof cloudClearBattleCheckpoint === "function") {
    const originalClearBattleCheckpoint = cloudClearBattleCheckpoint;
    cloudClearBattleCheckpoint = async function patchedCloudClearBattleCheckpoint(serverUrl, characterId, battleId, ...rest) {
      const result = await originalClearBattleCheckpoint(serverUrl, characterId, battleId, ...rest);
      if (result?.ok && activeResume && String(battleId) === activeResume.battleId) activeResume = null;
      return result;
    };
  }

  root.__thornieResumeFloorPreview = {
    getActive: () => activeResume ? { ...activeResume, encounter: activeResume.encounter.map(monster => ({ ...monster })) } : null,
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
