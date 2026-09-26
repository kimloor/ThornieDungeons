// ---------- W6 Equipment Visual Resolver Boundary ----------
const EQUIPMENT_VISUAL_RESOLVER_CONTRACT = Object.freeze({
  version: 1,
  currentHeroMode: "v3"
});

function createEquipmentVisualResolver({ legacyHeroSelectionResolver = null } = {}) {
  const resolveLegacySelection = legacyHeroSelectionResolver || (
    typeof heroVisualSelectionFromEquipment === "function" ? heroVisualSelectionFromEquipment : null
  );
  return Object.freeze({
    contract: EQUIPMENT_VISUAL_RESOLVER_CONTRACT,
    resolveHeroSelection(equipped = {}) {
      const selection = resolveLegacySelection ? resolveLegacySelection(equipped || {}) : {};
      return { ...(selection || {}) };
    }
  });
}

const SHARED_EQUIPMENT_VISUAL_RESOLVER = createEquipmentVisualResolver();
