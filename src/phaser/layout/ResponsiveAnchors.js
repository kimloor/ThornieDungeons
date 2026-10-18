// ---------- W6 Locked Combat Anchors ----------
const RESPONSIVE_ANCHORS = Object.freeze({
  HERO: Object.freeze({ x: 0.20, y: 0.50 }),
  PET: Object.freeze({ x: 0.22, y: 0.84 }),
  MONSTER_SINGLE: Object.freeze({ x: 0.80, y: 0.61 }),
  MONSTER_TWO: Object.freeze([{ x: 0.74, y: 0.38 }, { x: 0.85, y: 0.80 }]),
  MONSTER_THREE: Object.freeze([{ x: 0.71, y: 0.29 }, { x: 0.80, y: 0.58 }, { x: 0.87, y: 0.87 }]),
  VFX_HERO: Object.freeze({ x: 0.32, y: 0.60 }),
  VFX_PET: Object.freeze({ x: 0.42, y: 0.66 }),
  ARENA_ATTACKER_HERO: Object.freeze({ x: 0.20, y: 0.50 }),
  ARENA_ATTACKER_PET: Object.freeze({ x: 0.22, y: 0.84 }),
  ARENA_DEFENDER_HERO: Object.freeze({ x: 0.80, y: 0.50 }),
  ARENA_DEFENDER_PET: Object.freeze({ x: 0.78, y: 0.84 })
});

function monsterAnchorsForCount(count) {
  const safeCount = Math.max(1, Math.min(3, Number(count) || 1));
  if (safeCount === 1) return [RESPONSIVE_ANCHORS.MONSTER_SINGLE];
  if (safeCount === 2) return RESPONSIVE_ANCHORS.MONSTER_TWO;
  return RESPONSIVE_ANCHORS.MONSTER_THREE;
}

function responsiveActorScale(width, height) {
  return responsiveSceneScale(width, height, {
    referenceWidth: 390, referenceHeight: 520, minScale: 0.82, maxScale: 1.15
  });
}

function responsiveAnchorPixels(anchor, width, height) {
  return responsiveScenePoint(anchor, width, height);
}

function responsiveBattlefieldLayout(width, height, monsterCount = 1) {
  const monsterAnchors = monsterAnchorsForCount(monsterCount);
  const shared = createResponsiveSceneLayout({
    width,
    height,
    anchors: {
      hero: RESPONSIVE_ANCHORS.HERO,
      pet: RESPONSIVE_ANCHORS.PET,
      monsters: monsterAnchors,
      vfxHero: RESPONSIVE_ANCHORS.VFX_HERO,
      vfxPet: RESPONSIVE_ANCHORS.VFX_PET
    },
    scale: { referenceWidth: 390, referenceHeight: 520, minScale: 0.82, maxScale: 1.15 }
  });
  return {
    width: shared.width,
    height: shared.height,
    actorScale: shared.scale,
    normalized: shared.normalized,
    pixels: shared.pixels
  };
}

// Stages shorter than this use the compact Arena layout below (phone screens). Taller stages keep the Dungeon baseline anchors.
const ARENA_COMPACT_STAGE_MAX_HEIGHT = 460;
// Measured from the actors: HeroActor draws a 150px sprite (x responsive scale, origin at the feet) with the HP bar 14px,
// HP text ~24px and name ~34px below the anchor; the Pet row sits ARENA_PET_ROW_OFFSET lower and its name ends ~34px below its anchor.
const ARENA_HERO_REACH_UP = 150;
const ARENA_PET_ROW_OFFSET = 26;
const ARENA_LABELS_DOWN = ARENA_PET_ROW_OFFSET + 34;

function responsiveArenaBattlefieldLayout(width, height) {
  const stageHeight = Math.max(0, Number(height) || 0);
  if (stageHeight < ARENA_COMPACT_STAGE_MAX_HEIGHT) {
    // Compact stage: pick the sprite scale that fits Hero + labels + Pet row inside the stage, then centre that block
    // vertically so heads are never clipped and the Hero HP bars/names are not hidden behind the Pets. Pets stand
    // nearer the centre and one row lower, so the four HP bars never overlap.
    const stageWidth = Math.max(1, Number(width) || 1);
    const fit = (stageHeight - ARENA_LABELS_DOWN - 12) / ARENA_HERO_REACH_UP;
    const actorScale = Math.max(0.82, Math.min(0.92, (stageWidth / 390) * 0.95, fit));
    const margin = Math.max(0, (stageHeight - ARENA_HERO_REACH_UP * actorScale - ARENA_LABELS_DOWN) / 2);
    const heroY = (ARENA_HERO_REACH_UP * actorScale + margin) / Math.max(1, stageHeight);
    const petY = heroY + ARENA_PET_ROW_OFFSET / Math.max(1, stageHeight);
    const shared = createResponsiveSceneLayout({
      width,
      height,
      anchors: {
        attackerHero: { x: 0.20, y: heroY },
        attackerPet: { x: 0.38, y: petY },
        defenderHero: { x: 0.80, y: heroY },
        defenderPet: { x: 0.62, y: petY }
      }
    });
    return { width: shared.width, height: shared.height, actorScale, normalized: shared.normalized, pixels: shared.pixels };
  }
  const minScale = 0.82;
  const shared = createResponsiveSceneLayout({
    width,
    height,
    anchors: {
      attackerHero: RESPONSIVE_ANCHORS.ARENA_ATTACKER_HERO,
      attackerPet: RESPONSIVE_ANCHORS.ARENA_ATTACKER_PET,
      defenderHero: RESPONSIVE_ANCHORS.ARENA_DEFENDER_HERO,
      defenderPet: RESPONSIVE_ANCHORS.ARENA_DEFENDER_PET
    },
    scale: { referenceWidth: 390, referenceHeight: 520, minScale, maxScale: 1.15 }
  });
  return {
    width: shared.width,
    height: shared.height,
    actorScale: shared.scale,
    normalized: shared.normalized,
    pixels: shared.pixels
  };
}

