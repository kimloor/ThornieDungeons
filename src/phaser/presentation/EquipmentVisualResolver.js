// ---------- W7 Equipment Visual Resolver Boundary ----------
const EQUIPMENT_VISUAL_RESOLVER_CONTRACT = Object.freeze({
  version: 2,
  currentHeroMode: "v3",
  v5OptIn: true
});

function isAzureVisualItem(item) {
  return !!item && (
    item.setId === "azure"
    || String(item.name || "").toLowerCase().includes("azure")
  );
}

function resolveHeroV5EquipmentSelection(equipped = {}) {
  return {
    wings: equipped?.wings ? "angel" : null,
    azure: {
      helmet: isAzureVisualItem(equipped?.helmet),
      chest: isAzureVisualItem(equipped?.chest),
      gloves: isAzureVisualItem(equipped?.gloves),
      boots: isAzureVisualItem(equipped?.boots),
      weapon: isAzureVisualItem(equipped?.weapon)
    }
  };
}

function createEquipmentVisualResolver({ legacyHeroSelectionResolver = null } = {}) {
  const resolveLegacySelection = legacyHeroSelectionResolver || (
    typeof heroVisualSelectionFromEquipment === "function" ? heroVisualSelectionFromEquipment : null
  );
  return Object.freeze({
    contract: EQUIPMENT_VISUAL_RESOLVER_CONTRACT,
    resolveHeroSelection(equipped = {}) {
      const selection = resolveLegacySelection ? resolveLegacySelection(equipped || {}) : {};
      return { ...(selection || {}) };
    },
    resolveHeroV5Selection(equipped = {}) {
      const selection = resolveHeroV5EquipmentSelection(equipped || {});
      return {
        wings: selection.wings,
        azure: { ...selection.azure }
      };
    }
  });
}

const SHARED_EQUIPMENT_VISUAL_RESOLVER = createEquipmentVisualResolver();
