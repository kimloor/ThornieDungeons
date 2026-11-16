function BlacksmithPage({
  equipped,
  inventory,
  busy,
  gold,
  protectionStones,
  onEnhance,
  onEmpower,
  onReroll,
  onToggleLock,
  onOpenInventory,
  onClose
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEquippedSlot, setSelectedEquippedSlot] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [animState, setAnimState] = useState(null); // 'success' | 'fail' | null
  const [forgePresentation, setForgePresentation] = useState(null);
  const forgePresentationTokenRef = useRef(0);
  const [useProtectionStone, setUseProtectionStone] = useState(false);
  const animTimerRef = useRef(null);
  const [gridExpanded, setGridExpanded] = useState(false);
  const GRID_COLLAPSED_COUNT = 10;
  const gridSlotCount = gridExpanded ? 25 : Math.min(GRID_COLLAPSED_COUNT, 25);

  const selectedItem = selectedId ? inventory.find(i => i.id === selectedId) : null;
  const selectedEquipped = selectedEquippedSlot ? equipped[selectedEquippedSlot] : null;
  const detailTarget = selectedItem || selectedEquipped;
  // Junk (stone/wood/iron/mana stone etc.) can't be refined or enchanted, so the
  // Blacksmith's item grid only shows actual gear — junk totals still show via junkTotal().
  const gearInventory = inventory.filter(i => i.type !== "junk");

  const playAnim = ok => {
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    setAnimState(ok ? "success" : "fail");
    animTimerRef.current = setTimeout(() => setAnimState(null), 650);
  };

  const chooseInventory = item => {
    setSelectedId(item.id);
    setSelectedEquippedSlot(null);
    setActionMsg("");
    setUseProtectionStone(false);
  };
  const chooseEquipped = slot => {
    if (!equipped[slot]) return;
    setSelectedEquippedSlot(slot);
    setSelectedId(null);
    setActionMsg("");
    setUseProtectionStone(false);
  };
  const doEnhance = async () => {
    if (!detailTarget) return;
    const res = await Promise.resolve(onEnhance(detailTarget.id, useProtectionStone));
    setActionMsg(res.message);
    // Resource validation errors are not Refine outcomes: do not play the failure animation
    // when Gold/materials are insufficient and the server returns no mutation result.
    playAnim(res.ok && !!res?.result);
    if (res?.result && Number.isFinite(Number(res.result.levelAfter))) {
      const result = res.result;
      setForgePresentation({
        token: `enhance-${++forgePresentationTokenRef.current}`,
        kind: "enhance",
        outcome: result.success ? "success" : result.protectionConsumed ? "protected" : result.downgraded ? "downgrade" : "fail",
        levelBefore: Number(result.levelBefore) || 0,
        levelAfter: Number(result.levelAfter) || 0
      });
    }
  };
  const doEmpower = async () => {
    if (!detailTarget) return;
    const res = await Promise.resolve(onEmpower(detailTarget.id));
    setActionMsg(res.message);
    playAnim(res.ok);
  };
  const doReroll = async () => {
    if (!detailTarget) return;
    const res = await Promise.resolve(onReroll(detailTarget.id));
    setActionMsg(res.message);
    playAnim(res.ok);
  };

  const renderEquipSlot = slot => {
    const it = equipped[slot];
    const selected = selectedEquippedSlot === slot;
    return /*#__PURE__*/React.createElement("button", {
      key: slot,
      type: "button",
      className: `md-equip-slot ${slot} ${it ? "filled" : "empty"} ${selected ? "selected" : ""}`,
      title: it ? itemStatText(it) : "",
      onClick: () => chooseEquipped(slot)
    }, /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-icon" }, it ? /*#__PURE__*/React.createElement(GameIcon, { item: it, fallback: SLOT_ICON[slot], className: "md-game-icon md-equipped-item-icon", alt: itemDisplayName(it) }) : SLOT_ICON[slot]), /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-label" }, SLOT_LABEL[slot]), it ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-name" }, itemDisplayName(it)),
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-hint" }, "แตะดูรายละเอียด")
    ) : /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-name", style: { color: "var(--ink-soft)", opacity: .55 } }, "Empty"));
  };

  const renderEmpowerSlots = it => {
    const slots = it.empowerSlots || [];
    const nextIndex = slots.findIndex(s => !s);
    return /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 } },
      slots.map((s, i) => /*#__PURE__*/React.createElement("button", {
        key: i,
        type: "button",
        disabled: !s,
        onClick: async () => {
          if (!s) return;
          const result = await Promise.resolve(onToggleLock(it.id, i));
          if (result?.message) setActionMsg(result.message);
        },
        title: s ? `${s.icon} +${s.value} ${s.label} — แตะเพื่อ${s.locked ? "ปลดล็อก" : "ล็อก"}` : "ยังไม่ปลดล็อก",
        style: {
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 6,
          background: s ? "rgba(139,106,232,0.22)" : "rgba(156,156,168,0.15)",
          border: s && s.locked ? "1px solid #ffd166" : i === nextIndex ? "1px solid #8b6ae8" : "1px solid transparent",
          color: s ? "var(--ink)" : "var(--ink-soft)",
          cursor: s ? "pointer" : "default"
        }
      }, s ? `${s.locked ? "🔒" : ""}${s.icon}+${s.value}` : "◻️"))
    );
  };

  const anvilClass = animState === "success" ? "md-anvil-result-success" : animState === "fail" ? "md-anvil-result-fail" : "";

  return /*#__PURE__*/React.createElement("div", { className: "md-equip-overlay" }, /*#__PURE__*/React.createElement("div", { className: "md-equip-sheet" },
    /*#__PURE__*/React.createElement("div", { className: "md-equip-head" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("p", { className: "md-equip-head-title" }, "⚒️ Blacksmith"),
        /*#__PURE__*/React.createElement("div", { className: "md-equip-head-sub" }, "เลือกอุปกรณ์เพื่อ Refine / Enchant / รีรอล")
      ),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", onClick: onClose, style: { minHeight: 38, padding: "6px 11px", boxShadow: "none" } }, "✕")
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("div", { className: "md-blacksmith-slots" }, SLOT_ORDER.map(renderEquipSlot))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-summary", style: { marginTop: 2 } },
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: "iron" }, fallback: JUNK_INFO.iron.icon, className: "md-game-icon md-inline-item-icon", alt: JUNK_INFO.iron.name }), " ", junkTotal(inventory, "iron")),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: "manaOre" }, fallback: JUNK_INFO.manaOre.icon, className: "md-game-icon md-inline-item-icon", alt: JUNK_INFO.manaOre.name }), " ", junkTotal(inventory, "manaOre"))
    ),
    /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "md-inventory-toggle",
      onClick: onOpenInventory
    }, "🎒 ไปที่กระเป๋าไอเทม"),
    /*#__PURE__*/React.createElement("div", { className: `md-item-detail ${anvilClass}` }, detailTarget ? /*#__PURE__*/React.createElement(React.Fragment, null,
      forgePresentation && /*#__PURE__*/React.createElement(PhaserBlacksmithForgePresentation, { event: forgePresentation }),
      /*#__PURE__*/React.createElement("div", { className: "md-blacksmith-icon" }, animState === "success" ? "✨⚒️✨" : animState === "fail" ? "💥⚒️" : "⚒️"),
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name" }, /*#__PURE__*/React.createElement(GameIcon, { item: detailTarget, fallback: SLOT_ICON[detailTarget.type] || "📦", className: "md-game-icon md-detail-item-icon", alt: itemDisplayName(detailTarget) }), " ", itemDisplayName(detailTarget)),
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, RARITY_LABEL[detailTarget.rarity] || detailTarget.rarity, selectedEquipped ? " · สวมใส่อยู่" : "", " · ", itemStatText(detailTarget) || "ไม่มีค่าสเตตัส"),
      MYTHIC_V2.signatureText(detailTarget) && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { color: "var(--gold)", fontWeight: 800 } }, `✦ ${MYTHIC_V2.signatureText(detailTarget)}`),
      renderEmpowerSlots(detailTarget),
      ENHANCEMENT_V2.isV2Item(detailTarget) && (Number(detailTarget.enhanceLevel) || 0) >= 6 && (Number(detailTarget.enhanceLevel) || 0) < ENHANCEMENT_V2.ENHANCE_MAX && /*#__PURE__*/React.createElement("label", {
        className: "md-item-detail-sub",
        style: { display: "flex", alignItems: "center", gap: 6, marginTop: 7 }
      }, /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: useProtectionStone,
        disabled: busy || (protectionStones || 0) < 1,
        onChange: event => setUseProtectionStone(event.target.checked)
      }), `ใช้ Protection Stone เมื่อ downgrade เกิดขึ้น (มี ${protectionStones || 0})`),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 6 } },
        /*#__PURE__*/React.createElement("button", {
          className: "md-btn info small",
          style: { flex: 1, minHeight: 38, fontSize: 10 },
          disabled: (detailTarget.enhanceLevel || 0) >= ENHANCE_MAX || busy,
          onClick: doEnhance
        }, (detailTarget.enhanceLevel || 0) >= ENHANCE_MAX ? "🔨 Refine สูงสุดแล้ว" : (() => {
          const isV2 = ENHANCEMENT_V2.isV2Item(detailTarget);
          const c = isV2 ? ENHANCEMENT_V2.enhanceCost(detailTarget) : enhanceCost(detailTarget.enhanceLevel || 0);
          const haveIron = junkTotal(inventory, "iron");
          return [`🔨 Refine +${(detailTarget.enhanceLevel || 0) + 1} (${isV2 ? ENHANCEMENT_V2.enhanceSuccessRate(detailTarget.enhanceLevel || 0) : enhanceSuccessRate(detailTarget.enhanceLevel || 0)}% · `,
            /*#__PURE__*/React.createElement(GameIcon, { key: "iron-icon", item: { type: "junk", junkId: "iron" }, fallback: JUNK_INFO.iron.icon, className: "md-game-icon md-inline-item-icon", alt: JUNK_INFO.iron.name }),
            /*#__PURE__*/React.createElement("span", { key: "iron", className: haveIron < c.iron ? "md-cost-insufficient" : "" }, c.iron),
            " ",
            /*#__PURE__*/React.createElement(GameIcon, { key: "gold-icon", category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }),
            /*#__PURE__*/React.createElement("span", { key: "gold", className: gold < c.gold ? "md-cost-insufficient" : "" }, c.gold),
            ")"];
        })()),
        /*#__PURE__*/React.createElement("button", {
          className: "md-btn info small",
          style: { flex: 1, minHeight: 38, fontSize: 10 },
          disabled: !(detailTarget.empowerSlots || []).some(s => !s) || busy,
          onClick: doEmpower
        }, !(detailTarget.empowerSlots || []).some(s => !s) ? "🔮 เสริมพลังครบแล้ว" : (() => {
          const nextIndex = (detailTarget.empowerSlots || []).findIndex(s => !s);
          const c = ENHANCEMENT_V2.isV2Item(detailTarget) ? ENHANCEMENT_V2.empowerOpenCost(detailTarget, nextIndex) : empowerCost(nextIndex);
          if (!c) return "🔮 Empower ใช้งานไม่ได้";
          const haveManaOre = junkTotal(inventory, "manaOre");
          return ["🔮 เสริมพลัง (",
            /*#__PURE__*/React.createElement(GameIcon, { key: "mana-icon", item: { type: "junk", junkId: "manaOre" }, fallback: JUNK_INFO.manaOre.icon, className: "md-game-icon md-inline-item-icon", alt: JUNK_INFO.manaOre.name }),
            /*#__PURE__*/React.createElement("span", { key: "mana", className: haveManaOre < c.manaOre ? "md-cost-insufficient" : "" }, c.manaOre),
            " ",
            /*#__PURE__*/React.createElement(GameIcon, { key: "gold-icon", category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }),
            /*#__PURE__*/React.createElement("span", { key: "gold", className: gold < c.gold ? "md-cost-insufficient" : "" }, c.gold),
            ")"];
        })())
      ),
      /*#__PURE__*/React.createElement("button", {
        className: "md-btn info small",
        style: { width: "100%", minHeight: 38, fontSize: 10, marginTop: 6 },
        disabled: !(detailTarget.empowerSlots || []).some(Boolean) || (detailTarget.empowerSlots || []).filter(Boolean).every(s => s.locked) || busy,
        onClick: doReroll
      }, (() => {
        const filled = (detailTarget.empowerSlots || []).filter(Boolean);
        if (!filled.length) return "🔄 รีรอล (ยังไม่มีออฟชั่น)";
        const lockedCount = filled.filter(s => s.locked).length;
        const c = ENHANCEMENT_V2.isV2Item(detailTarget)
          ? ENHANCEMENT_V2.empowerRerollCost(detailTarget, filled.length, lockedCount)
          : rerollCost(filled.length, lockedCount);
        if (!c) return "🔄 Reroll ใช้งานไม่ได้";
        const haveManaOre = junkTotal(inventory, "manaOre");
        return ["🔄 รีรอลออฟชั่น (",
          /*#__PURE__*/React.createElement(GameIcon, { key: "mana-icon", item: { type: "junk", junkId: "manaOre" }, fallback: JUNK_INFO.manaOre.icon, className: "md-game-icon md-inline-item-icon", alt: JUNK_INFO.manaOre.name }),
          /*#__PURE__*/React.createElement("span", { key: "mana", className: haveManaOre < c.manaOre ? "md-cost-insufficient" : "" }, c.manaOre),
          " ",
          /*#__PURE__*/React.createElement(GameIcon, { key: "gold-icon", category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }),
          /*#__PURE__*/React.createElement("span", { key: "gold", className: gold < c.gold ? "md-cost-insufficient" : "" }, c.gold),
          ") — แตะออฟชั่นด้านบนเพื่อล็อก"];
      })()),
      actionMsg && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { marginTop: 6, color: "var(--ink)" } }, actionMsg)
    ) : /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { textAlign: "center" } }, "เลือกอุปกรณ์จากช่องสวมใส่หรือกระเป๋าเพื่อเริ่มตีบวก/เสริมพลัง")),
    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small md-equip-close", onClick: onClose }, "← ปิดร้านตีเหล็ก")
  ));
}
