// ---------- W6 Locked Combat Anchors ----------
const RESPONSIVE_ANCHORS = Object.freeze({
  HERO: Object.freeze({ x: 0.20, y: 0.50 }),
  PET: Object.freeze({ x: 0.22, y: 0.84 }),
  MONSTER_SINGLE: Object.freeze({ x: 0.80, y: 0.61 }),
  MONSTER_TWO: Object.freeze([{ x: 0.74, y: 0.38 }, { x: 0.85, y: 0.80 }]),
  MONSTER_THREE: Object.freeze([{ x: 0.71, y: 0.29 }, { x: 0.80, y: 0.58 }, { x: 0.87, y: 0.87 }]),
  VFX_HERO: Object.freeze({ x: 0.32, y: 0.60 }),
  VFX_PET: Object.freeze({ x: 0.42, y: 0.66 })
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

function responsiveMonsterVfxAnchor(slot, monsterCount, width, height) {
  const base = monsterAnchorsForCount(monsterCount)[Math.max(0, Math.min(2, Number(slot) || 0))] || RESPONSIVE_ANCHORS.MONSTER_SINGLE;
  return responsiveAnchorPixels({ x: base.x - 0.04, y: base.y - 0.12 }, width, height);
}
