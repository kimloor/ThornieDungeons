function Starfield() {
  const dots = [{
    top: 12,
    left: 8,
    size: 3
  }, {
    top: 30,
    left: 80,
    size: 2
  }, {
    top: 8,
    left: 55,
    size: 2
  }, {
    top: 55,
    left: 15,
    size: 2
  }, {
    top: 70,
    left: 90,
    size: 3
  }, {
    top: 20,
    left: 35,
    size: 2
  }, {
    top: 45,
    left: 65,
    size: 2
  }, {
    top: 85,
    left: 40,
    size: 2
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "md-stars"
  }, dots.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "md-star-dot",
    style: {
      top: `${d.top}%`,
      left: `${d.left}%`,
      width: d.size,
      height: d.size,
      animationDelay: `${i * 0.4}s`
    }
  })));
}
function StarRating({
  rarity
}) {
  const filled = RARITY_STARS[rarity] || 1;
  return /*#__PURE__*/React.createElement("span", {
    className: "md-stars-row"
  }, [1, 2, 3, 4, 5].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `md-star ${i > filled ? "dim" : ""}`
  }, "★")));
}
function StatusBar({
  player,
  save,
  phase,
  equipped
}) {
  const stats = player ? getStats(player, equipped || {}) : null;
  const hpPct = player && stats ? Math.max(0, Math.min(100, player.hp / stats.maxHp * 100)) : 0;
  const mpPct = player && stats ? Math.max(0, Math.min(100, player.mp / stats.maxMp * 100)) : 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "md-status"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-status-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-chip-icon"
  }, "🏅"), "Lv", player?.level ?? save.character.level), player ? /*#__PURE__*/React.createElement("div", {
    className: "md-bars"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-bar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-bar-fill",
    style: {
      width: `${hpPct}%`,
      background: "linear-gradient(90deg,#FF8787,#FF6B6B)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-bar-label"
  }, "HP ", player.hp, "/", stats.maxHp)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-bar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-bar-fill",
    style: {
      width: `${mpPct}%`,
      background: "linear-gradient(90deg,#A78BF0,#8B6AE8)"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-bar-label"
  }, "MP ", player.mp, "/", stats.maxMp))) : /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "md-status-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-chip-icon"
  }, "🪙"), save.gold));
}
function LoginScreen({
  cred,
  setCred,
  error,
  busy,
  onLogin,
  onRegister
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "md-login-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-menu-title",
    style: {
      padding: "0 0 10px"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 26
    }
  }, "ThornieDungeons"), /*#__PURE__*/React.createElement("p", null, "sign in to sync your save")), /*#__PURE__*/React.createElement("div", {
    className: "md-card"
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-field-label"
  }, "Player ID"), /*#__PURE__*/React.createElement("input", {
    className: "md-field",
    placeholder: "e.g. kimmie",
    value: cred.id,
    onChange: e => setCred(c => ({
      ...c,
      id: e.target.value
    }))
  }), /*#__PURE__*/React.createElement("p", {
    className: "md-field-label"
  }, "Password"), /*#__PURE__*/React.createElement("input", {
    className: "md-field",
    type: "password",
    placeholder: "••••••",
    value: cred.password,
    onChange: e => setCred(c => ({
      ...c,
      password: e.target.value
    }))
  }), error && /*#__PURE__*/React.createElement("p", {
    className: "md-auth-error"
  }, error), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row",
    style: {
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary",
    disabled: busy,
    onClick: onLogin
  }, busy ? "..." : "🔑 เข้าสู่ระบบ"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn info",
    disabled: busy,
    onClick: onRegister
  }, busy ? "..." : "✨ สร้างบัญชีใหม่")), /*#__PURE__*/React.createElement("p", {
    className: "md-hint"
  }, "ตั้ง Player ID + Password เอง — ใช้ชุดเดียวกันนี้เข้าจากเครื่องไหนก็โหลดเซฟเดิมได้")));
}
function MenuScreen({
  save,
  cp,
  playerId,
  onTown,
  onMap,
  onLogout
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "md-menu-title"
  }, /*#__PURE__*/React.createElement("h1", null, "ThornieDungeons"), /*#__PURE__*/React.createElement("p", null, "a persistent dungeon crawl")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "6px 0 16px",
      position: "relative",
      zIndex: 2
    }
  }, /*#__PURE__*/React.createElement(HeroSprite, {
    anim: ""
  }), /*#__PURE__*/React.createElement("div", {
    className: "md-cp-badge"
  }, "⚡ CP ", cp.toLocaleString())), /*#__PURE__*/React.createElement("div", {
    className: "md-panel",
    style: {
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title",
    style: {
      fontSize: 15
    }
  }, "🏰 Adventurer ", /*#__PURE__*/React.createElement("span", {
    className: "md-shop-lv"
  }, "(", playerId, ")")), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "🪙 ", save.gold, " gold · Lv", save.character.level, " · Stage ", save.unlockedFloor, " unlocked")), /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    onClick: onMap
  }, "🗺️ Select Stage"), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn info",
    onClick: onTown
  }, "🧙 Character"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee",
    onClick: onLogout
  }, "🚪 Switch Account"))));
}
function CharacterScreen({
  save,
  charStats,
  onAddStat,
  onOpenInv,
  onMap,
  onOpenPets,
  onBack
}) {
  const s = save.character.stats;
  const points = save.character.statPoints;
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title"
  }, "🧙 Character"), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "Lv", save.character.level, " · แต้มสเตตัสคงเหลือ: ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--gold)"
    }
  }, points))), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, STAT_INFO.map(st => /*#__PURE__*/React.createElement("div", {
    className: "md-shop-row",
    key: st.key
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-info"
  }, st.icon, " ", st.label, " ", /*#__PURE__*/React.createElement("span", {
    className: "md-shop-lv"
  }, s[st.key])), /*#__PURE__*/React.createElement("div", {
    className: "md-shop-lv"
  }, st.desc)), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    disabled: points <= 0,
    onClick: () => onAddStat(st.key)
  }, "+1")))), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "ATK ", charStats.atk, " · DEF ", charStats.def, " · HP ", charStats.maxHp, " · MP ", charStats.maxMp, " · Speed ", charStats.speed), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: "4px 0 0"
    }
  }, "Hit Rate ", charStats.accuracy, "% · Crit ", charStats.critChance, "% · Evasion ", charStats.dodgeChance, "% · Drop Bonus +", charStats.dropBonus, "%")), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title",
    style: {
      margin: "0 0 4px",
      fontSize: 15
    }
  }, "✨ Skills"), /*#__PURE__*/React.createElement("div", {
    className: "md-inv-list",
    style: {
      maxHeight: 220,
      overflowY: "auto"
    }
  }, SKILLS.map(sk => {
    const unlocked = sk.unlockLevel <= save.character.level;
    return /*#__PURE__*/React.createElement("div", {
      key: sk.key,
      className: "md-shop-row",
      style: {
        opacity: unlocked ? 1 : 0.5
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "md-shop-info"
    }, unlocked ? sk.icon : "🔒", " ", sk.name, " ", /*#__PURE__*/React.createElement("span", {
      className: "md-shop-lv"
    }, sk.mp, "mp")), /*#__PURE__*/React.createElement("div", {
      className: "md-shop-lv"
    }, unlocked ? sk.desc : `ปลดล็อกที่ Lv${sk.unlockLevel}`)));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn info",
    onClick: onOpenInv
  }, "🎒 Equipment"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn skill",
    onClick: onOpenPets
  }, "🐾 Pets"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    onClick: onMap
  }, "🗺️ Stage Select")), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide small",
    onClick: onBack
  }, "← Back"));
}
function MapScreen({
  unlockedFloor,
  onSelectFloor,
  onOpenPets,
  onBack
}) {
  const maxShow = unlockedFloor + 1; // one locked preview ahead
  const floors = Array.from({
    length: maxShow
  }, (_, i) => i + 1);
  const [selected, setSelected] = useState(unlockedFloor);
  const isBossSel = selected % 5 === 0;
  const isEliteBossSel = selected % 10 === 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title",
    style: {
      margin: 0
    }
  }, "🗺️ Select Stage"), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "Cleared stages can be farmed as many times as you like.")), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("select", {
    className: "md-select",
    value: selected,
    onChange: e => setSelected(Number(e.target.value))
  }, floors.map(f => {
    const locked = f > unlockedFloor;
    const isBoss = f % 5 === 0;
    const isEliteBoss = f % 10 === 0;
    const label = locked ? `🔒 Stage ${f} — Locked` : isEliteBoss ? `🔥👑 Stage ${f} — Elite Boss` : isBoss ? `👑 Stage ${f} — Boss` : `Stage ${f}`;
    return /*#__PURE__*/React.createElement("option", {
      key: f,
      value: f,
      disabled: locked
    }, label);
  })), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: "8px 0 10px"
    }
  }, isEliteBossSel ? "🔥 Elite Boss — เปิดหีบการันตี Elite/Mythic + bonus 💎!" : isBossSel ? "👑 Boss — ชนะแล้วได้เปิดหีบสุ่มความหายากอุปกรณ์!" : "Farmable · gold, XP, วัตถุดิบตีบวก/เสริมพลัง. อาจมี Floor Modifier พิเศษ!"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn attack wide",
    onClick: () => onSelectFloor(selected)
  }, "⚔️ Enter Stage ", selected)), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn skill wide",
    onClick: onOpenPets
  }, "🐾 Pets")), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide small",
    onClick: onBack
  }, "🧙 Character"));
}
function ShopOverlay({
  gold,
  diamonds,
  protectionStones,
  stock,
  onBuyItem,
  onBuyPotion,
  onBuyProtectionStone,
  onBuyMaterial,
  onClose
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 20,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "flex-end"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "linear-gradient(180deg, #2C1E4A, #1B1233)",
      width: "100%",
      borderRadius: "20px 20px 0 0",
      padding: 16,
      maxHeight: "88%",
      overflowY: "auto",
      border: "1.5px solid var(--gold-deep)",
      borderBottom: "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title",
    style: {
      margin: 0
    }
  }, "🛒 Shop ", /*#__PURE__*/React.createElement("span", {
    className: "md-shop-lv"
  }, "🪙", gold, " · 💎", diamonds || 0)), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee small",
    onClick: onClose,
    style: {
      boxShadow: "none",
      padding: "6px 12px"
    }
  }, "Close")), /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, "รายการสุ่มใหม่ทุกครั้งที่เปิดร้าน"), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-info"
  }, "🧪 Potion"), /*#__PURE__*/React.createElement("div", {
    className: "md-shop-lv"
  }, "ฟื้นฟู HP 40% ระหว่างต่อสู้")), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    disabled: gold < stock.potionPrice,
    onClick: onBuyPotion
  }, "🪙", stock.potionPrice)), /*#__PURE__*/React.createElement("div", {
    className: "md-shop-row",
    style: { marginTop: 8 }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-info"
  }, "🛡️ หินป้องกัน (มีอยู่ ", protectionStones || 0, ")"), /*#__PURE__*/React.createElement("div", {
    className: "md-shop-lv"
  }, "ป้องกันไม่ให้เลเวลตีบวกร่วงเมื่อล้มเหลว (+7 ขึ้นไป)")), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    disabled: (diamonds || 0) < PROTECTION_STONE_PRICE,
    onClick: onBuyProtectionStone
  }, "💎", PROTECTION_STONE_PRICE))), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-info",
    style: { marginBottom: 6 }
  }, "⛏️ วัตถุดิบตีบวก/เสริมพลัง"), ["iron", "manaOre"].map(type => /*#__PURE__*/React.createElement("div", {
    key: type,
    className: "md-shop-row",
    style: { marginBottom: 4 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-info"
  }, JUNK_INFO[type].icon, " ", JUNK_INFO[type].name), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    disabled: gold < MATERIAL_SHOP_PRICE[type],
    onClick: () => onBuyMaterial(type)
  }, "🪙", MATERIAL_SHOP_PRICE[type])))), /*#__PURE__*/React.createElement("div", {
    className: "md-inv-list"
  }, stock.items.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "ของหมดแล้ว — ปิดแล้วเปิดใหม่เพื่อสุ่มร้านใหม่"), stock.items.map(it => /*#__PURE__*/React.createElement("div", {
    key: it.id,
    className: `md-inv-item ${it.rarity}`
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-inv-name"
  }, SLOT_ICON[it.type], " ", it.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(StarRating, {
    rarity: it.rarity
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-inv-stat"
  }, itemStatText(it)))), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    disabled: gold < it.price,
    onClick: () => onBuyItem(it)
  }, "🪙", it.price))))));
}
function PetScreen({
  save,
  gachaResult,
  onClearGachaResult,
  onEquip,
  onUnequip,
  onGacha,
  onClaimDiamonds,
  onBack
}) {
  const owned = save.pets || [];
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel",
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title"
  }, "🐾 Pets"), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "💎 ", save.diamonds, " เพชร")), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title",
    style: {
      margin: "0 0 4px",
      fontSize: 15
    }
  }, "สัตว์เลี้ยงของฉัน"), owned.length === 0 && /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "ยังไม่มีสัตว์เลี้ยง — เอาชนะบอสด่าน 5 เพื่อรับสัตว์เลี้ยงตัวแรก!"), /*#__PURE__*/React.createElement("div", {
    className: "md-inv-list"
  }, owned.map(inst => {
    const def = getPetDef(inst.defId);
    if (!def) return null;
    const isActive = save.activePetId === inst.instId;
    return /*#__PURE__*/React.createElement("div", {
      key: inst.instId,
      className: `md-inv-item ${def.rarity === "ssr" ? "epic" : def.rarity === "sr" ? "rare" : ""}`
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "md-inv-name"
    }, def.icon, " ", def.name, " ", /*#__PURE__*/React.createElement("span", {
      className: "md-shop-lv"
    }, PET_RARITY_LABEL[def.rarity]), isActive ? " ⭐" : ""), /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat"
    }, def.active.icon, " ", def.active.name, " — ", def.active.desc), def.passive && /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat"
    }, def.passive.icon, " ", def.passive.name, " — ", def.passive.desc), def.extra && /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat"
    }, def.extra.icon, " ", def.extra.name, " — ", def.extra.desc)), isActive ? /*#__PURE__*/React.createElement("button", {
      className: "md-buy-btn",
      style: {
        background: "var(--panel-soft)",
        color: "var(--ink)",
        boxShadow: "none",
        border: "1px solid var(--gold-deep)"
      },
      onClick: onUnequip
    }, "Unequip") : /*#__PURE__*/React.createElement("button", {
      className: "md-buy-btn",
      onClick: () => onEquip(inst.instId)
    }, "Equip"));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title",
    style: {
      margin: "0 0 4px",
      fontSize: 15
    }
  }, "🎰 Pet Gacha"), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: "0 0 6px"
    }
  }, "อัตราออก: R 70% · SR 25% · SSR 5%"), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: "0 0 6px",
      color: "var(--ink-soft)"
    }
  }, "🧪 อยู่ระหว่างช่วงทดสอบ — ใช้ปุ่มด้านล่างรับเพชรฟรีเพื่อทดสอบระบบสุ่มได้เลย (ระบบเติมเงินจริงยังไม่เปิด)"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn item wide",
    style: {
      marginBottom: 8
    },
    onClick: onClaimDiamonds
  }, "🎁 รับเพชรทดสอบ +500"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    disabled: save.diamonds < GACHA_COST,
    onClick: onGacha
  }, "💎 สุ่ม 1 ครั้ง (", GACHA_COST, " เพชร)")), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide small",
    onClick: onBack
  }, "← Back"), gachaResult && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 25,
      background: "rgba(0,0,0,0.7)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      textAlign: "center",
      maxWidth: 280
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title"
  }, gachaResult.pet.icon, " ", gachaResult.pet.name), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, PET_RARITY_LABEL[gachaResult.pet.rarity], " ", gachaResult.duplicate ? "· ได้ตัวซ้ำ! รับเพชรคืน +30" : "· ได้สัตว์เลี้ยงใหม่!"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    style: {
      marginTop: 10
    },
    onClick: onClearGachaResult
  }, "OK"))));
}
function FloatingQuickActions({
  onShop,
  onCharacter,
  onBag,
  onBlacksmith,
  activePhase
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "md-fab-stack"
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-fab",
    onClick: onShop,
    title: "Shop"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-fab-icon"
  }, "🛒")), /*#__PURE__*/React.createElement("button", {
    className: "md-fab",
    onClick: onBlacksmith,
    title: "Blacksmith"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-fab-icon"
  }, "⚒️")), /*#__PURE__*/React.createElement("button", {
    className: `md-fab ${activePhase === "town" ? "active" : ""}`,
    onClick: onCharacter,
    title: "Character"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-fab-icon"
  }, "🧙")), /*#__PURE__*/React.createElement("button", {
    className: "md-fab",
    onClick: onBag,
    title: "Equipment"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-fab-icon"
  }, "🎒")));
}
function HeroSprite({
  anim
}) {
  const heroIdleUrl = asset("hero.idle");
  return /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-wrap"
  }, heroIdleUrl ? /*#__PURE__*/React.createElement("img", {
    className: `md-hero-img ${anim}`,
    src: heroIdleUrl,
    alt: "hero",
    draggable: false
  }) : /*#__PURE__*/React.createElement("div", {
    className: `md-hero ${anim}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "hair"
  }), /*#__PURE__*/React.createElement("div", {
    className: "head"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eye l"
  }), /*#__PURE__*/React.createElement("div", {
    className: "eye r"
  })), /*#__PURE__*/React.createElement("div", {
    className: "body"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-name"
  }, "You"));
}
function EnemySprite({
  enemy,
  anim,
  selected,
  onClick
}) {
  const enemyUrl = asset(`enemy.${enemy.id}`);
  const hpPct = Math.max(0, Math.min(100, enemy.hp / enemy.maxHp * 100));
  const dead = enemy.hp <= 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-wrap",
    onClick: !dead && onClick ? () => onClick(enemy.uid) : undefined,
    style: {
      cursor: !dead && onClick ? "pointer" : "default",
      opacity: dead ? 0.35 : 1,
      outline: selected && !dead ? "2px solid var(--gold)" : "none",
      outlineOffset: 4,
      borderRadius: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-fill",
    style: {
      width: `${hpPct}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-hp"
  }, enemy.hp, "/", enemy.maxHp)), enemyUrl ? /*#__PURE__*/React.createElement("img", {
    className: `md-enemy-img ${enemy.isBoss ? "boss" : ""} ${anim || ""}`,
    src: enemyUrl,
    alt: enemy.name,
    draggable: false
  }) : /*#__PURE__*/React.createElement("div", {
    className: `md-enemy ${enemy.isBoss ? "boss" : ""} ${anim || ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "blob",
    style: {
      background: enemy.color
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eye l"
  }), /*#__PURE__*/React.createElement("div", {
    className: "eye r"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-name"
  }, enemy.name, enemy.frozenTurns > 0 ? " ❄️" : "", enemy.poisonTurns > 0 ? " ☠️" : ""));
}
function PetCombatSprite({ pet, anim }) {
  const dead = pet.hp <= 0;
  const hpPct = Math.max(0, Math.min(100, pet.hp / pet.maxHp * 100));
  return /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-wrap",
    style: { opacity: dead ? 0.35 : 1 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-fill",
    style: { width: `${hpPct}%`, background: "linear-gradient(90deg,#8ee0a8,#4CAF7D)" }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-hp"
  }, pet.hp, "/", pet.maxHp)), /*#__PURE__*/React.createElement("div", {
    className: `md-enemy ${anim || ""}`,
    style: { display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: "none", border: "none" }
  }, pet.icon), /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-name"
  }, pet.name, dead ? " 💤" : ""));
}
function CombatScreen({
  player,
  monsters,
  targetUid,
  onSelectTarget,
  log,
  busy,
  potions,
  heroAnim,
  petAnim,
  enemyAnims,
  floats,
  onAction,
  equipped,
  petCombat
}) {
  const [showSkills, setShowSkills] = useState(false);
  const [autoRun, setAutoRun] = useState(false);
  const skills = unlockedSkills(player.level);
  const stats = getStats(player, equipped);
  const hpPct = Math.max(0, Math.min(100, player.hp / stats.maxHp * 100));
  const mpPct = Math.max(0, Math.min(100, player.mp / stats.maxMp * 100));
  const xpNeed = xpToNext(player.level);
  const xpPct = player.level >= MAX_LEVEL ? 100 : Math.max(0, Math.min(100, player.xp / xpNeed * 100));
  const primaryEnemy = monsters.find(m => m.uid === targetUid && m.hp > 0) || monsters.find(m => m.hp > 0) || monsters[0];
  const bossOrModifier = monsters.find(m => m.isEliteBoss || m.modifier);
  function pickSkill(skill) {
    setShowSkills(false);
    onAction("skill", skill.key);
  }
  useEffect(() => {
    // Auto Run: keep throwing basic attacks on its own while enabled, as long
    // as we're not mid-animation and the skill grid isn't open (so a manual
    // skill pick doesn't get raced by an auto attack).
    if (!autoRun || busy || showSkills) return;
    const t = setTimeout(() => onAction("attack"), 550);
    return () => clearTimeout(t);
  }, [autoRun, busy, showSkills, onAction]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "md-scene battle-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-battle-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hud-lv"
  }, player.level), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-bars"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hud-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-hud-label"
  }, "HP"), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-track hp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hud-fill",
    style: {
      width: `${hpPct}%`
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-hud-txt"
  }, player.hp, "/", stats.maxHp))), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-row"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-hud-label"
  }, "MP"), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-track mp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hud-fill",
    style: {
      width: `${mpPct}%`
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-hud-txt"
  }, player.mp, "/", stats.maxMp))), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-track xp"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hud-fill",
    style: {
      width: `${xpPct}%`
    }
  }))), petCombat && /*#__PURE__*/React.createElement("div", {
    className: `md-pet-chip ${petCombat.cooldown > 0 ? "" : "ready"}`,
    title: petCombat.active.desc
  }, petCombat.icon, " ", petCombat.cooldown > 0 ? /*#__PURE__*/React.createElement("span", {
    className: "cd"
  }, "CD ", petCombat.cooldown) : /*#__PURE__*/React.createElement("span", null, "Ready"))), bossOrModifier && /*#__PURE__*/React.createElement("div", {
    className: "md-modifier-chip",
    style: {
      background: bossOrModifier.isEliteBoss ? "rgba(255,209,102,0.25)" : `${bossOrModifier.modifier.color}22`,
      border: `1px solid ${bossOrModifier.isEliteBoss ? "#ffd166" : bossOrModifier.modifier.color}`,
      color: bossOrModifier.isEliteBoss ? "#caa143" : bossOrModifier.modifier.color,
      borderRadius: 8,
      padding: "3px 8px",
      fontSize: 11,
      fontWeight: 700,
      textAlign: "center",
      margin: "0 auto 4px"
    },
    title: bossOrModifier.isEliteBoss ? "Elite Boss: หีบการันตี Elite/Mythic" : bossOrModifier.modifier.desc
  }, bossOrModifier.isEliteBoss ? "🔥👑 Elite Boss" : `${bossOrModifier.modifier.icon} ${bossOrModifier.modifier.name}`), monsters.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: { textAlign: "center", fontSize: 10.5, color: "var(--ink-soft)", fontWeight: 700, margin: "0 0 2px" }
  }, "แตะศัตรูเพื่อเลือกเป้าหมาย · เหลือ ", monsters.filter(m => m.hp > 0).length, "/", monsters.length), /*#__PURE__*/React.createElement("div", {
    className: "md-arena"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-ground"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: { position: "relative" }
  }, /*#__PURE__*/React.createElement(HeroSprite, {
    anim: heroAnim
  }), (player.atkBuffTurns > 0 || player.defBuffTurns > 0 || player.regenTurns > 0) && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: -6,
      left: "50%",
      transform: "translateX(-50%)",
      fontSize: 11,
      whiteSpace: "nowrap"
    }
  }, player.atkBuffTurns > 0 ? "⚔️+" : "", player.defBuffTurns > 0 ? "🛡️+" : "", player.regenTurns > 0 ? "💚" : ""), floats.filter(f => f.side === "hero").map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: {
      color: f.color
    }
  }, f.text))), petCombat && /*#__PURE__*/React.createElement("div", {
    style: { position: "relative", transform: "scale(0.8)" }
  }, /*#__PURE__*/React.createElement(PetCombatSprite, {
    pet: petCombat,
    anim: petAnim
  }), floats.filter(f => f.side === "pet").map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: { color: f.color }
  }, f.text)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "flex-end"
    }
  }, monsters.map(m => /*#__PURE__*/React.createElement("div", {
    key: m.uid,
    style: { position: "relative" }
  }, /*#__PURE__*/React.createElement(EnemySprite, {
    enemy: m,
    anim: enemyAnims[m.uid],
    selected: monsters.filter(mm => mm.hp > 0).length > 1 && m.uid === (primaryEnemy && primaryEnemy.uid),
    onClick: onSelectTarget
  }), floats.filter(f => f.side === m.uid).map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: {
      color: f.color
    }
  }, f.text)))))), /*#__PURE__*/React.createElement("div", {
    className: "md-battle-dock"
  }, /*#__PURE__*/React.createElement("button", {
    className: `md-dock-auto ${autoRun ? "active" : ""}`,
    onClick: () => setAutoRun(a => !a)
  }, autoRun ? "⏸ AUTO" : "▶ AUTO"), /*#__PURE__*/React.createElement("button", {
    className: "md-dock-circle item",
    disabled: busy || potions <= 0,
    onClick: () => onAction("item")
  }, "🧪", /*#__PURE__*/React.createElement("i", {
    className: "md-rail-badge"
  }, potions)), /*#__PURE__*/React.createElement("button", {
    className: "md-dock-attack",
    disabled: busy,
    onClick: () => {
      setShowSkills(false);
      onAction("attack");
    }
  }, "👊"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, showSkills && /*#__PURE__*/React.createElement("div", {
    className: "md-skill-popover"
  }, skills.map((s, i) => /*#__PURE__*/React.createElement("button", {
    key: s.key,
    className: "md-skill-cell",
    disabled: busy || player.mp < s.mp,
    title: `${s.name} (${s.mp}mp) — ${s.desc}`,
    onClick: () => pickSkill(s)
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-skill-num"
  }, i + 1), s.icon))), /*#__PURE__*/React.createElement("button", {
    className: "md-dock-circle skill",
    disabled: busy || skills.length === 0,
    onClick: () => setShowSkills(v => !v)
  }, "✨")), /*#__PURE__*/React.createElement("button", {
    className: "md-dock-circle flee",
    disabled: busy,
    onClick: () => onAction("flee")
  }, "🏃"))), /*#__PURE__*/React.createElement("div", {
    className: "md-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-log"
  }, (Array.isArray(log) ? log : [log]).slice(0, 3).map((line, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: `md-log-line ${i === 0 ? "latest" : ""}`
  }, line)))));
}
function ResultScreen({
  floor,
  rewards,
  dropItem,
  onNext,
  onRetry,
  onMap,
  onOpenInv
}) {
  const [chestOpened, setChestOpened] = useState(false);
  const showChest = rewards.isBoss && dropItem;
  const showItemBanner = showChest && chestOpened;
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel",
    style: {
      flex: 1,
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title"
  }, "🎉 Stage ", floor, " Cleared!"), /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, "+", rewards.gold, " 🪙 gold · +", rewards.xp, " XP", rewards.diamonds ? ` · +${rewards.diamonds} 💎` : "", rewards.leveledUp ? " · Level up!" : "", rewards.unlockedNext ? " · Next stage unlocked!" : ""), rewards.isEliteBoss && /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner",
    style: {
      background: "rgba(255,209,102,0.22)"
    }
  }, "👑🔥 Elite Boss Defeated! Chest guarantees Elite/Mythic gear + bonus 💎"), rewards.modifier && /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner",
    style: {
      background: `${rewards.modifier.color}22`
    }
  }, rewards.modifier.icon, " ", rewards.modifier.name, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--ink-soft)"
    }
  }, rewards.modifier.desc)), rewards.newPet && /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner",
    style: {
      background: "rgba(139,106,232,0.18)"
    }
  }, rewards.newPet.icon, " New Companion: ", rewards.newPet.name, " (R)!", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--ink-soft)"
    }
  }, rewards.newPet.active.desc)), rewards.newSkill && /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner",
    style: {
      background: "rgba(255,209,102,0.18)"
    }
  }, rewards.newSkill.icon, " New Skill Unlocked: ", rewards.newSkill.name, "!", /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--ink-soft)"
    }
  }, rewards.newSkill.desc)), showChest && !chestOpened && /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    style: {
      marginTop: 4
    },
    onClick: () => setChestOpened(true)
  }, "🎁 เปิดหีบรางวัลจากบอส"), showItemBanner ? /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner",
    style: {
      background: dropItem.rarity === "mythic" ? "rgba(255,209,102,0.28)" : dropItem.rarity === "elite" ? "rgba(178,106,232,0.18)" : dropItem.rarity === "unique" ? "rgba(79,168,224,0.18)" : "rgba(156,156,168,0.15)"
    }
  }, SLOT_ICON[dropItem.type], " Found ", RARITY_LABEL[dropItem.rarity], " ", itemDisplayName(dropItem), "! ", /*#__PURE__*/React.createElement(StarRating, {
    rarity: dropItem.rarity
  }), /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: "var(--ink-soft)"
    }
  }, itemStatText(dropItem))) : !showChest && (rewards.junkDrop ? /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner",
    style: {
      background: "rgba(156,156,168,0.15)"
    }
  }, JUNK_INFO[rewards.junkDrop.type].icon, " ได้รับ ", JUNK_INFO[rewards.junkDrop.type].name, " x", rewards.junkDrop.amount) : /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "ไม่ได้วัตถุดิบจากศัตรูตัวนี้"))), showItemBanner && /*#__PURE__*/React.createElement("button", {
    className: "md-btn info wide",
    onClick: onOpenInv
  }, "🎒 Open Equipment"), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row",
    style: {
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    onClick: onNext
  }, "⚔️ Next Stage"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn info wide",
    onClick: onRetry
  }, "🔁 Retry Stage")), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row",
    style: {
      marginTop: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide",
    onClick: onMap
  }, "🗺️ Back to Map")));
}
function DefeatScreen({
  floor,
  onRetry,
  onMap
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel",
    style: {
      flex: 1,
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: {
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title"
  }, "💀 Defeated on Stage ", floor), /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, "No penalty — your gold, level, and gear are all safe. Gear up in Town and try again.")), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    onClick: onRetry
  }, "🔁 Retry Stage"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide",
    onClick: onMap
  }, "🗺️ Back to Map")));
}
function InventoryOverlay({
  equipped,
  inventory,
  onEquip,
  onUnequip,
  onSell,
  onSalvage,
  onClose
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEquippedSlot, setSelectedEquippedSlot] = useState(null);
  const [sortMode, setSortMode] = useState("default");
  const [actionMsg, setActionMsg] = useState("");
  // Inventory grid starts collapsed to a couple of rows so the sheet fits on a phone screen;
  // "ดูทั้งหมด" expands it out to the full 25 slots.
  const [gridExpanded, setGridExpanded] = useState(false);
  const GRID_COLLAPSED_COUNT = 10;

  const sortedInventory = [...inventory].sort((a, b) => {
    if (sortMode === "rarity") {
      const rank = { mythic: 4, elite: 3, unique: 2, rare: 1 };
      return (rank[b.rarity] || 0) - (rank[a.rarity] || 0);
    }
    if (sortMode === "type") return String(a.type).localeCompare(String(b.type));
    if (sortMode === "value") return sellPrice(b) - sellPrice(a);
    return 0;
  });
  const visibleInventory = sortedInventory.slice(0, 25);
  const gridSlotCount = gridExpanded ? 25 : Math.min(GRID_COLLAPSED_COUNT, 25);
  const selectedItem = selectedId ? inventory.find(i => i.id === selectedId) : null;
  const selectedEquipped = selectedEquippedSlot ? equipped[selectedEquippedSlot] : null;
  const detailTarget = selectedItem || selectedEquipped;

  const chooseInventory = item => {
    setSelectedId(item.id);
    setSelectedEquippedSlot(null);
    setActionMsg("");
  };
  const chooseEquipped = slot => {
    if (!equipped[slot]) return;
    setSelectedEquippedSlot(slot);
    setSelectedId(null);
    setActionMsg("");
  };
  const doEquip = () => {
    if (!selectedItem || selectedItem.type === "junk") return;
    onEquip(selectedItem);
    setSelectedId(null);
  };
  const doUnequip = () => {
    if (!selectedEquippedSlot) return;
    onUnequip(selectedEquippedSlot);
    setSelectedEquippedSlot(null);
  };
  const doSell = () => {
    if (!selectedItem) return;
    onSell(selectedItem);
    setSelectedId(null);
  };
  const doSalvage = () => {
    if (!selectedItem) return;
    const res = onSalvage(selectedItem.id);
    setActionMsg(res.message);
    if (res.ok) setSelectedId(null);
  };

  const renderEquipSlot = slot => {
    const it = equipped[slot];
    const selected = selectedEquippedSlot === slot;
    return /*#__PURE__*/React.createElement("button", {
      key: slot,
      type: "button",
      className: `md-equip-slot ${slot} ${it ? "filled" : "empty"} ${selected ? "selected" : ""}`,
      onClick: () => chooseEquipped(slot)
    }, /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-icon" }, SLOT_ICON[slot]), /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-label" }, SLOT_LABEL[slot]), it ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-name" }, itemDisplayName(it)),
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-stat" }, itemStatText(it))
    ) : /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-name", style: { color: "var(--ink-soft)", opacity: .55 } }, "Empty"));
  };

  const renderEmpowerSlotsReadOnly = it => {
    const slots = it.empowerSlots || [];
    if (!slots.length) return null;
    return /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 } },
      slots.map((s, i) => /*#__PURE__*/React.createElement("span", {
        key: i,
        title: s ? `${s.icon} +${s.value} ${s.label}` : "ยังไม่ปลดล็อก (ไปปลดล็อกที่ร้านตีเหล็ก)",
        style: {
          fontSize: 10,
          padding: "2px 6px",
          borderRadius: 6,
          background: s ? "rgba(139,106,232,0.22)" : "rgba(156,156,168,0.15)",
          border: s && s.locked ? "1px solid #ffd166" : "1px solid transparent",
          color: s ? "var(--ink)" : "var(--ink-soft)"
        }
      }, s ? `${s.locked ? "🔒" : ""}${s.icon}+${s.value}` : "◻️"))
    );
  };

  return /*#__PURE__*/React.createElement("div", { className: "md-equip-overlay" }, /*#__PURE__*/React.createElement("div", { className: "md-equip-sheet" },
    /*#__PURE__*/React.createElement("div", { className: "md-equip-head" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("p", { className: "md-equip-head-title" }, "⚔️ Equipment & Inventory"),
        /*#__PURE__*/React.createElement("div", { className: "md-equip-head-sub" }, "แตะอุปกรณ์รอบตัวละคร หรือแตะไอเทมในกระเป๋าเพื่อเลือก · ตีบวก/เสริมพลังไปที่ร้านตีเหล็ก ⚒️")
      ),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", onClick: onClose, style: { minHeight: 38, padding: "6px 11px", boxShadow: "none" } }, "✕")
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-stage" },
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slots" }, SLOT_ORDER.map(renderEquipSlot)),
      /*#__PURE__*/React.createElement("div", { className: "md-equip-character" }, /*#__PURE__*/React.createElement(HeroSprite, { anim: "" }))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-summary" },
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, "⚔️ ATK ", /*#__PURE__*/React.createElement("b", null, getEquipBonus(equipped).atk)),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, "🛡️ DEF ", /*#__PURE__*/React.createElement("b", null, getEquipBonus(equipped).def)),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, "❤️ HP ", /*#__PURE__*/React.createElement("b", null, getEquipBonus(equipped).hp)),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, "💧 MP ", /*#__PURE__*/React.createElement("b", null, getEquipBonus(equipped).mp))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-summary", style: { marginTop: 2 } },
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, JUNK_INFO.iron.icon, " ", junkTotal(inventory, "iron")),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, JUNK_INFO.manaOre.icon, " ", junkTotal(inventory, "manaOre"))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-inventory-header" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-title" }, "🎒 Inventory"),
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-count", style: { marginLeft: 7 } }, `${Math.min(inventory.length,25)}/25 ช่องแสดง`)
      ),
      /*#__PURE__*/React.createElement("select", { className: "md-select", value: sortMode, onChange: e => setSortMode(e.target.value), style: { width: 100, padding: "7px 26px 7px 8px", fontSize: 10 } },
        /*#__PURE__*/React.createElement("option", { value: "default" }, "เรียงเดิม"),
        /*#__PURE__*/React.createElement("option", { value: "rarity" }, "ความหายาก"),
        /*#__PURE__*/React.createElement("option", { value: "type" }, "ประเภท"),
        /*#__PURE__*/React.createElement("option", { value: "value" }, "ราคาขาย")
      )
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-inventory-grid" }, Array.from({ length: gridSlotCount }, (_, index) => {
      const it = visibleInventory[index];
      return /*#__PURE__*/React.createElement("button", {
        key: it ? it.id : `empty-${index}`,
        type: "button",
        className: `md-inventory-cell ${it ? it.rarity : "empty"} ${it && selectedId === it.id ? "selected" : ""}`,
        onClick: () => it && chooseInventory(it)
      }, it ? /*#__PURE__*/React.createElement(React.Fragment, null,
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-num" }, index + 1),
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-icon" }, it.icon || SLOT_ICON[it.type] || "📦"),
        it.type !== "junk" && /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-stars" }, /*#__PURE__*/React.createElement(StarRating, { rarity: it.rarity })),
        it.enhanceLevel > 0 && /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-qty" }, "+", it.enhanceLevel),
        it.quantity > 1 && /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-qty" }, "x", it.quantity)
      ) : /*#__PURE__*/React.createElement("span", { style: { fontSize: 13, opacity: .18 } }, "＋"));
    })),
    Math.min(inventory.length, 25) > GRID_COLLAPSED_COUNT && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "md-inventory-toggle",
      onClick: () => setGridExpanded(v => !v)
    }, gridExpanded ? "▲ ย่อกระเป๋า" : `▼ ดูทั้งหมด (${Math.min(inventory.length, 25)} ชิ้น)`),
    inventory.length > 25 && /*#__PURE__*/React.createElement("div", { className: "md-item-detail", style: { textAlign: "center", color: "var(--ink-soft)", fontSize: 10 } }, "มีไอเทมเกิน 25 ชิ้น — ตอนนี้แสดง 25 ช่องแรกเพื่อให้เหมาะกับหน้าจอมือถือ"),
    /*#__PURE__*/React.createElement("div", { className: "md-item-detail" }, detailTarget ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name" }, detailTarget.icon || SLOT_ICON[detailTarget.type], " ", itemDisplayName(detailTarget)),
      detailTarget.type === "junk" ? /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, `วัตถุดิบขยะ · มี ${detailTarget.quantity} ชิ้น (สูงสุด 99/ช่อง) · ขายได้ ${sellPrice(detailTarget)} 🪙`) : /*#__PURE__*/React.createElement(React.Fragment, null,
        /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, RARITY_LABEL[detailTarget.rarity] || detailTarget.rarity, selectedEquipped ? " · สวมใส่อยู่" : "", " · ", itemStatText(detailTarget) || "ไม่มีค่าสเตตัส"),
        renderEmpowerSlotsReadOnly(detailTarget)
      ),
      selectedItem && detailTarget.type !== "junk" && /*#__PURE__*/React.createElement("button", {
        className: "md-btn flee small",
        style: { marginTop: 6, minHeight: 38, fontSize: 10, width: "100%" },
        onClick: doSalvage
      }, (() => {
        const y = salvageYield(detailTarget.rarity);
        return `♻️ แยกชิ้นส่วน (🔩${y.iron} 🔮${y.manaOre})`;
      })()),
      actionMsg && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { marginTop: 4, color: "var(--ink)" } }, actionMsg)
    ) : /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { textAlign: "center" } }, "เลือกไอเทมเพื่อดูรายละเอียดและคำสั่ง")),
    /*#__PURE__*/React.createElement("div", { className: "md-item-actions" },
      /*#__PURE__*/React.createElement("button", { className: "md-btn primary", disabled: !selectedItem || selectedItem.type === "junk", onClick: doEquip }, "⚔️ สวมใส่"),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee", disabled: !selectedItem, onClick: doSell }, selectedItem ? `🪙 ขาย ${sellPrice(selectedItem)}` : "🪙 ขาย"),
      /*#__PURE__*/React.createElement("button", { className: "md-btn info", disabled: !selectedEquippedSlot, onClick: doUnequip }, "↩️ ถอด")
    ),
    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small md-equip-close", onClick: onClose }, "← ปิด Inventory")
  ));
}
function BlacksmithOverlay({
  equipped,
  inventory,
  onEnhance,
  onEmpower,
  onReroll,
  onToggleLock,
  onClose
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [selectedEquippedSlot, setSelectedEquippedSlot] = useState(null);
  const [actionMsg, setActionMsg] = useState("");
  const [animState, setAnimState] = useState(null); // 'success' | 'fail' | null
  const animTimerRef = useRef(null);
  const [gridExpanded, setGridExpanded] = useState(false);
  const GRID_COLLAPSED_COUNT = 10;
  const gridSlotCount = gridExpanded ? 25 : Math.min(GRID_COLLAPSED_COUNT, 25);

  const selectedItem = selectedId ? inventory.find(i => i.id === selectedId) : null;
  const selectedEquipped = selectedEquippedSlot ? equipped[selectedEquippedSlot] : null;
  const detailTarget = selectedItem || selectedEquipped;
  // Junk (stone/wood/iron/mana stone etc.) can't be enhanced or empowered, so the
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
  };
  const chooseEquipped = slot => {
    if (!equipped[slot]) return;
    setSelectedEquippedSlot(slot);
    setSelectedId(null);
    setActionMsg("");
  };
  const doEnhance = () => {
    if (!detailTarget) return;
    const res = onEnhance(detailTarget.id);
    setActionMsg(res.message);
    playAnim(res.ok);
  };
  const doEmpower = () => {
    if (!detailTarget) return;
    const res = onEmpower(detailTarget.id);
    setActionMsg(res.message);
    playAnim(res.ok);
  };
  const doReroll = () => {
    if (!detailTarget) return;
    const res = onReroll(detailTarget.id);
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
      onClick: () => chooseEquipped(slot)
    }, /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-icon" }, SLOT_ICON[slot]), /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-label" }, SLOT_LABEL[slot]), it ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-name" }, itemDisplayName(it)),
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-stat" }, itemStatText(it))
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
        onClick: () => s && onToggleLock(it.id, i),
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
        /*#__PURE__*/React.createElement("div", { className: "md-equip-head-sub" }, "เลือกอุปกรณ์เพื่อ ตีบวก / เสริมพลัง / รีรอล")
      ),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", onClick: onClose, style: { minHeight: 38, padding: "6px 11px", boxShadow: "none" } }, "✕")
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-stage" },
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slots" }, SLOT_ORDER.map(renderEquipSlot)),
      /*#__PURE__*/React.createElement("div", { className: "md-equip-character" }, /*#__PURE__*/React.createElement(HeroSprite, { anim: "" }))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-summary", style: { marginTop: 2 } },
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, JUNK_INFO.iron.icon, " ", junkTotal(inventory, "iron")),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, JUNK_INFO.manaOre.icon, " ", junkTotal(inventory, "manaOre"))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-inventory-header" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-title" }, "🎒 เลือกอุปกรณ์")
      )
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-inventory-grid" }, Array.from({ length: gridSlotCount }, (_, index) => {
      const it = gearInventory[index];
      return /*#__PURE__*/React.createElement("button", {
        key: it ? it.id : `empty-${index}`,
        type: "button",
        className: `md-inventory-cell ${it ? it.rarity : "empty"} ${it && selectedId === it.id ? "selected" : ""}`,
        onClick: () => it && chooseInventory(it)
      }, it ? /*#__PURE__*/React.createElement(React.Fragment, null,
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-num" }, index + 1),
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-icon" }, it.icon || SLOT_ICON[it.type] || "📦"),
        it.type !== "junk" && /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-stars" }, /*#__PURE__*/React.createElement(StarRating, { rarity: it.rarity })),
        it.enhanceLevel > 0 && /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-qty" }, "+", it.enhanceLevel)
      ) : /*#__PURE__*/React.createElement("span", { style: { fontSize: 13, opacity: .18 } }, "＋"));
    })),
    Math.min(gearInventory.length, 25) > GRID_COLLAPSED_COUNT && /*#__PURE__*/React.createElement("button", {
      type: "button",
      className: "md-inventory-toggle",
      onClick: () => setGridExpanded(v => !v)
    }, gridExpanded ? "▲ ย่อกระเป๋า" : `▼ ดูทั้งหมด (${Math.min(gearInventory.length, 25)} ชิ้น)`),
    /*#__PURE__*/React.createElement("div", { className: `md-item-detail ${anvilClass}` }, detailTarget ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-blacksmith-icon" }, animState === "success" ? "✨⚒️✨" : animState === "fail" ? "💥⚒️" : "⚒️"),
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name" }, SLOT_ICON[detailTarget.type], " ", itemDisplayName(detailTarget)),
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, RARITY_LABEL[detailTarget.rarity] || detailTarget.rarity, selectedEquipped ? " · สวมใส่อยู่" : "", " · ", itemStatText(detailTarget) || "ไม่มีค่าสเตตัส"),
      renderEmpowerSlots(detailTarget),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 6 } },
        /*#__PURE__*/React.createElement("button", {
          className: "md-btn info small",
          style: { flex: 1, minHeight: 38, fontSize: 10 },
          disabled: (detailTarget.enhanceLevel || 0) >= ENHANCE_MAX,
          onClick: doEnhance
        }, (detailTarget.enhanceLevel || 0) >= ENHANCE_MAX ? "🔨 ตีบวกสูงสุดแล้ว" : `🔨 ตีบวก +${(detailTarget.enhanceLevel || 0) + 1} (${enhanceSuccessRate(detailTarget.enhanceLevel || 0)}% · 🔩${enhanceCost(detailTarget.enhanceLevel || 0).iron} 🪙${enhanceCost(detailTarget.enhanceLevel || 0).gold})`),
        /*#__PURE__*/React.createElement("button", {
          className: "md-btn info small",
          style: { flex: 1, minHeight: 38, fontSize: 10 },
          disabled: !(detailTarget.empowerSlots || []).some(s => !s),
          onClick: doEmpower
        }, !(detailTarget.empowerSlots || []).some(s => !s) ? "🔮 เสริมพลังครบแล้ว" : (() => {
          const c = empowerCost((detailTarget.empowerSlots || []).findIndex(s => !s));
          return `🔮 เสริมพลัง (🔮${c.manaOre} 🪙${c.gold})`;
        })())
      ),
      /*#__PURE__*/React.createElement("button", {
        className: "md-btn info small",
        style: { width: "100%", minHeight: 38, fontSize: 10, marginTop: 6 },
        disabled: !(detailTarget.empowerSlots || []).some(Boolean) || (detailTarget.empowerSlots || []).filter(Boolean).every(s => s.locked),
        onClick: doReroll
      }, (() => {
        const filled = (detailTarget.empowerSlots || []).filter(Boolean);
        if (!filled.length) return "🔄 รีรอล (ยังไม่มีออฟชั่น)";
        const lockedCount = filled.filter(s => s.locked).length;
        return `🔄 รีรอลออฟชั่น (🔮${rerollCost(filled.length, lockedCount).manaOre} 🪙${rerollCost(filled.length, lockedCount).gold}) — แตะออฟชั่นด้านบนเพื่อล็อก`;
      })()),
      actionMsg && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { marginTop: 6, color: "var(--ink)" } }, actionMsg)
    ) : /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { textAlign: "center" } }, "เลือกอุปกรณ์จากช่องสวมใส่หรือกระเป๋าเพื่อเริ่มตีบวก/เสริมพลัง")),
    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small md-equip-close", onClick: onClose }, "← ปิดร้านตีเหล็ก")
  ));
}
