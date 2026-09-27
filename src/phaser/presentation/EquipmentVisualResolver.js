// ---------- W7 Equipment Visual Resolver Boundary ----------
const EQUIPMENT_VISUAL_RESOLVER_CONTRACT = Object.freeze({
  version: 4,
  currentHeroMode: "v3",
  v5OptIn: true
});

function isAzureVisualItem(item) {
  return !!item && (
    item.setId === "azure"
    || String(item.name || "").toLowerCase().includes("azure")
  );
}

function heroV5WingVisualId(item) {
  if (!item) return null;
  const identities = [
    item.id,
    item.itemId,
    item.wingId,
    item.wingsId,
    item.visualId,
    item.setId
  ].map(value => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (identities.some(value => ["angel", "wing01", "angel_wings", "angel-wings"].includes(value))) return "angel";
  if (String(item.name || "").toLowerCase().includes("angel")) return "angel";
  return null;
}

function resolveHeroV5EquipmentSelection(equipped = {}, legacySelection = {}) {
  return {
    // Current production equipment contract resolves any equipped Wings item
    // to the shared Angel visual family. Reuse that canonical selection instead
    // of independently guessing item ids in the Phaser renderer.
    wings: legacySelection?.wings === "angel" ? "angel" : heroV5WingVisualId(equipped?.wings),
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
      const legacySelection = resolveLegacySelection ? resolveLegacySelection(equipped || {}) : {};
      const selection = resolveHeroV5EquipmentSelection(equipped || {}, legacySelection);
      return {
        wings: selection.wings,
        azure: { ...selection.azure }
      };
    }
  });
}

const SHARED_EQUIPMENT_VISUAL_RESOLVER = createEquipmentVisualResolver();
