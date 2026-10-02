// ---------- W7 Equipment Visual Resolver Boundary ----------
const EQUIPMENT_VISUAL_RESOLVER_CONTRACT = Object.freeze({
  version: 5,
  currentHeroMode: "v3",
  v5OptIn: true
});

function isAzureVisualItem(item) {
  return !!item && (
    item.setId === "azure"
    || String(item.name || "").toLowerCase().includes("azure")
  );
}

function heroV5SetFamily(item) {
  const setId = String(item?.setId || "").trim().toLowerCase();
  return ["azure", "robot", "skeleton"].includes(setId) ? setId : null;
}

function heroV5BossWeaponVisualId(item) {
  if (!item) return null;
  const id = String(item.bossWeaponId || item.specialSource || item.sourceIdentity || "").toLowerCase().replace(/^boss_weapon:/, "");
  const map = { spirit_greatsword: "spiritGreatsword", lavalon_sword: "lavalonSword", icicle_longsword: "icicleLongsword" };
  return map[id] || null;
}

function heroV5WingVisualId(item) {
  if (!item) return null;
  const identities = [
    item.id,
    item.itemId,
    item.wingFamily,
    item.wingId,
    item.wingsId,
    item.visualId,
    item.setId
  ].map(value => String(value || "").trim().toLowerCase()).filter(Boolean);
  if (identities.some(value => ["angel", "wing01", "angel_wings", "angel-wings"].includes(value))) return "angel";
  if (identities.includes("azure")) return "azure";
  if (identities.includes("robot")) return "robot";
  if (identities.includes("skeleton")) return "skeleton";
  if (String(item.name || "").toLowerCase().includes("angel")) return "angel";
  return null;
}

function resolveHeroV5EquipmentSelection(equipped = {}, legacySelection = {}) {
  const slots = ["helmet", "chest", "gloves", "boots", "weapon"];
  const equipment = Object.fromEntries(slots.map(slot => [slot, heroV5SetFamily(equipped?.[slot])]));
  const bossWeapon = heroV5BossWeaponVisualId(equipped?.weapon);
  return {
    // Family identity is authoritative metadata on the server-owned Wing item.
    wings: legacySelection?.wings === "angel" ? "angel" : heroV5WingVisualId(equipped?.wings),
    equipment,
    bossWeapon,
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
      const extended = selection.bossWeapon || Object.values(selection.equipment).some(family => family && family !== "azure");
      if (!extended) return { wings: selection.wings, azure: { ...selection.azure } };
      return {
        wings: selection.wings,
        equipment: { ...selection.equipment },
        bossWeapon: selection.bossWeapon,
        azure: { ...selection.azure }
      };
    }
  });
}

const SHARED_EQUIPMENT_VISUAL_RESOLVER = createEquipmentVisualResolver();
