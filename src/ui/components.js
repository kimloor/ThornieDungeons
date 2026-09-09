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
  return /*#__PURE__*/React.createElement("div", {
    className: "md-status"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-status-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-chip-icon"
  }, "🏅"), "Lv", player?.level ?? save.character.level), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flex: 1,
      justifyContent: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-status-chip"
  }, /*#__PURE__*/React.createElement(GameIcon, {
    category: "currency",
    iconKey: "gold",
    fallback: "🪙",
    className: "md-game-icon md-resource-icon",
    alt: "Gold"
  }), formatNumber(save.gold)), /*#__PURE__*/React.createElement("div", {
    className: "md-status-chip"
  }, /*#__PURE__*/React.createElement(GameIcon, {
    category: "currency",
    iconKey: "diamond",
    fallback: "💎",
    className: "md-game-icon md-resource-icon",
    alt: "Diamond"
  }), formatNumber(save.diamonds || 0)), /*#__PURE__*/React.createElement("div", {
    className: "md-status-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-chip-icon"
  }, "🛡️"), formatNumber(save.protectionStones || 0))));
}
function LoginScreen({
  cred,
  setCred,
  error,
  busy,
  departing,
  rememberPassword,
  onRememberPassword,
  onLogin,
  onRegister
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `md-login-wrap${departing ? " is-departing" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-menu-title md-login-brand"
  }, /*#__PURE__*/React.createElement("img", {
    className: "md-login-emblem",
    src: "icons/icon-512.png",
    alt: "ThornieDungeons"
  }), /*#__PURE__*/React.createElement("h1", null, "ThornieDungeons"), /*#__PURE__*/React.createElement("p", null, "เข้าสู่ดันเจี้ยนของคุณ")), /*#__PURE__*/React.createElement("div", {
    className: "md-card md-login-card"
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-field-label"
  }, "Player ID"), /*#__PURE__*/React.createElement("input", {
    className: "md-field",
    placeholder: "e.g. kimmie",
    autoComplete: "username",
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
    autoComplete: "current-password",
    value: cred.password,
    onChange: e => setCred(c => ({
      ...c,
      password: e.target.value
    }))
  }), /*#__PURE__*/React.createElement("label", {
    className: "md-remember-password"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: rememberPassword,
    disabled: busy,
    onChange: e => onRememberPassword(e.target.checked)
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-remember-check",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", null, "จำรหัสผ่านบนอุปกรณ์นี้")), error && /*#__PURE__*/React.createElement("p", {
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
  }, busy ? "..." : "เข้าสู่ระบบ"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn info",
    disabled: busy,
    onClick: onRegister
  }, busy ? "..." : "สร้างบัญชีใหม่")), /*#__PURE__*/React.createElement("p", {
    className: "md-hint"
  }, "ใช้บัญชีเดิมเพื่อโหลดเซฟจากทุกอุปกรณ์")));
}
function GameDock({
  onCharacter,
  onOpenInv,
  onPets,
  activeKey,
  moreOpen,
  onToggleMore
}) {
  return /*#__PURE__*/React.createElement("nav", {
    className: "md-hub-dock",
    "aria-label": "เมนูหลัก"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: activeKey === "character" ? "active" : "",
    onClick: onCharacter
  }, /*#__PURE__*/React.createElement("img", {
    src: "ui/hub-icons/character.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", null, "ตัวละคร")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onOpenInv
  }, /*#__PURE__*/React.createElement("img", {
    src: "ui/hub-icons/bag.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", null, "กระเป๋า")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPets
  }, /*#__PURE__*/React.createElement("img", {
    src: "ui/hub-icons/pet.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", null, "สัตว์เลี้ยง")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: moreOpen ? "active" : "",
    onClick: onToggleMore
  }, /*#__PURE__*/React.createElement("img", {
    src: "ui/hub-icons/more.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", null, "เพิ่มเติม")));
}

function HubScreen({
  save,
  cp,
  onTown,
  onCharacter,
  onMap,
  onOpenInv,
  onShop,
  onEnhance,
  onCraft,
  onPets,
  onLeaderboard,
  onRaid,
  onArena,
  onMailbox,
  onSave,
  onSwitchCharacter,
  onLogout,
  dailyLogin,
  dailyLoginClaimResult,
  onClaimDailyLogin,
  onClearDailyLoginResult
}) {
  const [saveFlash, setSaveFlash] = useState(false);
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const canClaimDaily = dailyLogin.canClaim;
  const dailyPreview = dailyLogin.preview || { streak: 1, reward: {} };
  React.useEffect(() => {
    if (dailyLoginClaimResult) setDailyModalOpen(true);
  }, [dailyLoginClaimResult]);
  const handleSave = () => {
    onSave();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };
  const openDaily = () => {
    setMoreOpen(false);
    setDailyModalOpen(true);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("main", {
    className: "md-hub-shell"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hub-resources"
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-resource-icon", alt: "Gold" }), " ", /*#__PURE__*/React.createElement("b", null, formatNumber(save.gold))), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-resource-icon", alt: "Diamond" }), " ", /*#__PURE__*/React.createElement("b", null, formatNumber(save.diamonds || 0))), /*#__PURE__*/React.createElement("span", null, "🛡️ ", /*#__PURE__*/React.createElement("b", null, formatNumber(save.protectionStones || 0)))), /*#__PURE__*/React.createElement("header", {
    className: "md-hub-topbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hub-profile"
  }, /*#__PURE__*/React.createElement("img", {
    className: "md-hub-mark",
    src: "icons/icon-192.png",
    alt: ""
  }), /*#__PURE__*/React.createElement("div", {
    className: "md-hub-profile-copy"
  }, /*#__PURE__*/React.createElement("strong", null, save.characterName || "Adventurer"), /*#__PURE__*/React.createElement("div", {
    className: "md-hub-character-meta"
  }, /*#__PURE__*/React.createElement("b", null, "LV. ", save.character.level), /*#__PURE__*/React.createElement("span", null, "⚔️ CP ", formatNumber(cp))))), /*#__PURE__*/React.createElement("div", {
    className: "md-hub-top-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "md-hub-icon-btn" + (canClaimDaily ? " has-alert" : ""),
    onClick: openDaily,
    "aria-label": "รางวัลรายวัน"
  }, canClaimDaily ? "🎁" : "📅", canClaimDaily && /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "md-hub-icon-btn",
    onClick: onMailbox,
    "aria-label": "จดหมาย"
  }, "📬"))), /*#__PURE__*/React.createElement("section", {
    className: "md-hub-world",
    "aria-label": "โถงทางเข้าดันเจี้ยน"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "md-hub-raid-callout",
    onClick: onRaid
  }, /*#__PURE__*/React.createElement("img", { src: "ui/hub-icons/raid.svg", alt: "" }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("small", null, "WORLD EVENT"), /*#__PURE__*/React.createElement("strong", null, "Raid Boss")), /*#__PURE__*/React.createElement("b", null, "ไปต่อ ›")), /*#__PURE__*/React.createElement("div", {
    className: "md-hub-gate-focus"
  }, /*#__PURE__*/React.createElement("span", null, "ชั้นปัจจุบัน"), /*#__PURE__*/React.createElement("strong", null, save.unlockedFloor)), /*#__PURE__*/React.createElement("div", {
    className: "md-hub-world-actions"
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "md-hub-town-btn",
    onClick: onTown
  }, /*#__PURE__*/React.createElement("span", null, "🏰"), /*#__PURE__*/React.createElement("b", null, "กลับเมือง")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "md-hub-enter-btn",
    onClick: onMap
  }, /*#__PURE__*/React.createElement("span", null, "เข้าสู่ดันเจี้ยน"), /*#__PURE__*/React.createElement("small", null, "เลือกชั้นและเริ่มการเดินทาง", "  ›")))), moreOpen && /*#__PURE__*/React.createElement("div", {
    className: "md-hub-more-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hub-more-head"
  }, /*#__PURE__*/React.createElement("strong", null, "เมนูเพิ่มเติม"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMoreOpen(false),
    "aria-label": "ปิดเมนู"
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    className: "md-hub-more-grid"
  }, /*#__PURE__*/React.createElement("button", { type: "button", onClick: onLeaderboard }, "🏆", /*#__PURE__*/React.createElement("span", null, "อันดับ")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: onShop }, "🛒", /*#__PURE__*/React.createElement("span", null, "ร้านค้า")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: onEnhance }, "⚒️", /*#__PURE__*/React.createElement("span", null, "ตีบวก")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: onCraft }, "🛠️", /*#__PURE__*/React.createElement("span", null, "ประดิษฐ์")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: onRaid }, /*#__PURE__*/React.createElement("img", { src: "ui/hub-icons/raid.svg", alt: "" }), /*#__PURE__*/React.createElement("span", null, "Raid")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: onArena }, "🥊", /*#__PURE__*/React.createElement("span", null, "อารีน่า")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: onMailbox }, "📬", /*#__PURE__*/React.createElement("span", null, "จดหมาย")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: openDaily }, canClaimDaily ? "🎁" : "📅", /*#__PURE__*/React.createElement("span", null, "รายวัน")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: handleSave }, saveFlash ? "✅" : "💾", /*#__PURE__*/React.createElement("span", null, saveFlash ? "บันทึกแล้ว" : "บันทึก")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: onSwitchCharacter }, "👥", /*#__PURE__*/React.createElement("span", null, "เปลี่ยนตัว")), /*#__PURE__*/React.createElement("button", { type: "button", className: "danger", onClick: onLogout }, "🚪", /*#__PURE__*/React.createElement("span", null, "ออกจากระบบ")))), /*#__PURE__*/React.createElement(GameDock, {
    onCharacter: onCharacter,
    onOpenInv: onOpenInv,
    onPets: onPets,
    moreOpen: moreOpen,
    onToggleMore: () => setMoreOpen(open => !open)
  })), dailyModalOpen && /*#__PURE__*/React.createElement("div", {
    className: "md-equip-overlay",
    onClick: () => { setDailyModalOpen(false); onClearDailyLoginResult(); }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-equip-sheet",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("h3", { className: "md-title" }, "🎁 รางวัลรายวัน"), dailyLoginClaimResult ? /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("p", { className: "md-sub" }, `รับแล้ว! Day ${dailyLoginClaimResult.streak}`),
    /*#__PURE__*/React.createElement("p", { className: "md-sub" },
      dailyLoginClaimResult.reward.gold ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " +", dailyLoginClaimResult.reward.gold, " ") : "",
      dailyLoginClaimResult.reward.diamonds ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " +", dailyLoginClaimResult.reward.diamonds, " ") : "",
      dailyLoginClaimResult.reward.potions ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: "hp_small" }, fallback: "🧪", className: "md-game-icon md-inline-item-icon", alt: "Potion" }), " +", dailyLoginClaimResult.reward.potions) : "")
  ) : /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("p", { className: "md-sub" }, `Streak ปัจจุบัน: ${dailyLogin.state.loginStreak} วัน`),
    /*#__PURE__*/React.createElement("p", { className: "md-sub" },
      `วันนี้ (Day ${dailyPreview.streak}) จะได้รับ: `,
      dailyPreview.reward.gold ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " ", dailyPreview.reward.gold, " ") : "",
      dailyPreview.reward.diamonds ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " ", dailyPreview.reward.diamonds, " ") : "",
      dailyPreview.reward.potions ? /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: "hp_small" }, fallback: "🧪", className: "md-game-icon md-inline-item-icon", alt: "Potion" }), " ", dailyPreview.reward.potions) : ""),
    canClaimDaily ? /*#__PURE__*/React.createElement("button", {
      className: "md-btn primary wide",
      onClick: onClaimDailyLogin
    }, "รับรางวัล") : /*#__PURE__*/React.createElement("p", { className: "md-sub", style: { color: "var(--gold)" } }, "รับไปแล้ววันนี้ พรุ่งนี้มาใหม่นะ")
  ), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide",
    style: { marginTop: 8 },
    onClick: () => { setDailyModalOpen(false); onClearDailyLoginResult(); }
  }, "ปิด"))));
}

function TownScreen({
  save,
  onCharacter,
  onDungeon,
  onOpenInv,
  onShop,
  onEnhance,
  onCraft,
  onPets,
  onLeaderboard,
  onRaid,
  onArena,
  onMailbox,
  onSummoning,
  onSave,
  onSwitchCharacter,
  onLogout,
  dailyLogin,
  dailyLoginClaimResult,
  onClaimDailyLogin,
  onClearDailyLoginResult
}) {
  const e = React.createElement;
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const canClaimDaily = dailyLogin.canClaim;
  const dailyPreview = dailyLogin.preview || { streak: 1, reward: {} };
  const noticeTimer = useRef(null);
  React.useEffect(() => {
    if (dailyLoginClaimResult) setDailyModalOpen(true);
    return () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, [dailyLoginClaimResult]);
  const showSoon = label => {
    setNotice(`ระบบ ${label} กำลังพัฒนา`);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 1800);
  };
  const handleSave = () => {
    onSave();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };
  const openDaily = () => {
    setMoreOpen(false);
    setDailyModalOpen(true);
  };
  const hotspot = (className, label, icon, onClick) => e("button", {
    type: "button",
    className: `md-town-hotspot ${className}`,
    onClick,
    "aria-label": label
  }, icon && e("span", { className: "md-town-hotspot-icon", "aria-hidden": "true" }, icon),
  e("strong", null, label));
  return e(React.Fragment, null,
    e("main", { className: "md-town-shell" },
      e("div", { className: "md-hub-resources md-town-resources" },
        e("span", null, e(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-resource-icon", alt: "Gold" }), " ", e("b", null, formatNumber(save.gold))),
        e("span", null, e(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-resource-icon", alt: "Diamond" }), " ", e("b", null, formatNumber(save.diamonds || 0))),
        e("span", null, "🛡️ ", e("b", null, formatNumber(save.protectionStones || 0)))
      ),
      e("section", { className: "md-town-world", "aria-label": "ตัวเมือง" },
        e("h1", { className: "md-town-title" }, "Town"),
        e("button", {
          type: "button",
          className: "md-town-leaderboard",
          onClick: onLeaderboard,
          "aria-label": "Leaderboard"
        }, e("img", { src: "ui/town-icons/leaderboard-bird.svg", alt: "" }),
        e("span", null, "Leaderboard")),
        hotspot("guild", "กิลด์", "♜", () => showSoon("กิลด์")),
        hotspot("arena", "อารีน่า", "⚔", onArena),
        hotspot("summoning", "Summoning", "✦", onSummoning),
        hotspot("home", "ประดิษฐ์", "⌂", onCraft),
        hotspot("enhance", "ร้านตีบวก", "⚒", onEnhance),
        hotspot("shop", "ร้านค้า", "◈", onShop),
        e("button", {
          type: "button",
          className: "md-town-dungeon",
          onClick: onDungeon
        }, e("span", null, "กลับสู่ดันเจี้ยน")),
        e("button", {
          type: "button",
          className: "md-town-chat",
          onClick: () => showSoon("แชท"),
          "aria-label": "แชท"
        }, e("span", { "aria-hidden": "true" }, "•••"), e("b", null, "แชท")),
        notice && e("div", { className: "md-town-notice", role: "status" }, notice)
      ),
      moreOpen && e("div", { className: "md-hub-more-panel md-town-more-panel" },
        e("div", { className: "md-hub-more-head" },
          e("strong", null, "เมนูเพิ่มเติม"),
          e("button", { type: "button", onClick: () => setMoreOpen(false), "aria-label": "ปิดเมนู" }, "✕")
        ),
        e("div", { className: "md-hub-more-grid" },
          e("button", { type: "button", onClick: onLeaderboard }, "✉️", e("span", null, "อันดับ")),
          e("button", { type: "button", onClick: onShop }, "🛒", e("span", null, "ร้านค้า")),
          e("button", { type: "button", onClick: onEnhance }, "⚒️", e("span", null, "ตีบวก")),
          e("button", { type: "button", onClick: onCraft }, "🛠️", e("span", null, "ประดิษฐ์")),
          e("button", { type: "button", onClick: onRaid }, e("img", { src: "ui/hub-icons/raid.svg", alt: "" }), e("span", null, "Raid")),
          e("button", { type: "button", onClick: onArena }, "🥊", e("span", null, "อารีน่า")),
          e("button", { type: "button", onClick: onMailbox }, "📬", e("span", null, "จดหมาย")),
          e("button", { type: "button", onClick: openDaily }, canClaimDaily ? "🎁" : "📅", e("span", null, "รายวัน")),
          e("button", { type: "button", onClick: handleSave }, saveFlash ? "✅" : "💾", e("span", null, saveFlash ? "บันทึกแล้ว" : "บันทึก")),
          e("button", { type: "button", onClick: onSwitchCharacter }, "👥", e("span", null, "เปลี่ยนตัว")),
          e("button", { type: "button", className: "danger", onClick: onLogout }, "🚪", e("span", null, "ออกจากระบบ"))
        )
      ),
      e(GameDock, {
        onCharacter,
        onOpenInv,
        onPets,
        moreOpen,
        onToggleMore: () => setMoreOpen(open => !open)
      })
    ),
    dailyModalOpen && e("div", {
      className: "md-equip-overlay",
      onClick: () => { setDailyModalOpen(false); onClearDailyLoginResult(); }
    }, e("div", {
      className: "md-equip-sheet",
      onClick: event => event.stopPropagation()
    }, e("h3", { className: "md-title" }, "🎁 รางวัลรายวัน"),
    dailyLoginClaimResult ? e(React.Fragment, null,
      e("p", { className: "md-sub" }, `รับแล้ว! Day ${dailyLoginClaimResult.streak}`),
      e("p", { className: "md-sub" },
        dailyLoginClaimResult.reward.gold ? e("span", null, e(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " +", dailyLoginClaimResult.reward.gold, " ") : "",
        dailyLoginClaimResult.reward.diamonds ? e("span", null, e(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " +", dailyLoginClaimResult.reward.diamonds, " ") : "",
        dailyLoginClaimResult.reward.potions ? e("span", null, e(GameIcon, { item: { type: "potion", potionId: "hp_small" }, fallback: "🧪", className: "md-game-icon md-inline-item-icon", alt: "Potion" }), " +", dailyLoginClaimResult.reward.potions) : "")
    ) : e(React.Fragment, null,
      e("p", { className: "md-sub" }, `Streak ปัจจุบัน: ${dailyLogin.state.loginStreak} วัน`),
      e("p", { className: "md-sub" },
        `วันนี้ (Day ${dailyPreview.streak}) จะได้รับ: `,
        dailyPreview.reward.gold ? e("span", null, e(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " ", dailyPreview.reward.gold, " ") : "",
        dailyPreview.reward.diamonds ? e("span", null, e(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " ", dailyPreview.reward.diamonds, " ") : "",
        dailyPreview.reward.potions ? e("span", null, e(GameIcon, { item: { type: "potion", potionId: "hp_small" }, fallback: "🧪", className: "md-game-icon md-inline-item-icon", alt: "Potion" }), " ", dailyPreview.reward.potions) : ""),
      canClaimDaily ? e("button", {
        className: "md-btn primary wide",
        onClick: onClaimDailyLogin
      }, "รับรางวัล") : e("p", {
        className: "md-sub",
        style: { color: "var(--gold)" }
      }, "รับไปแล้ววันนี้ พรุ่งนี้มาใหม่นะ")
    ), e("button", {
      className: "md-btn flee wide",
      style: { marginTop: 8 },
      onClick: () => { setDailyModalOpen(false); onClearDailyLoginResult(); }
    }, "ปิด")))
  );
}

function CharacterSelectScreen({
  account,
  entryTransition,
  onEnter,
  onCreate,
  onDelete,
  onLogout
}) {
  const [creatingSlot, setCreatingSlot] = useState(null); // index currently showing the create-name form, or null
  const [nameInput, setNameInput] = useState("");
  const [createError, setCreateError] = useState("");
  const [confirmDeleteSlot, setConfirmDeleteSlot] = useState(null); // index awaiting delete confirmation, or null
  // onEnter/onCreate/onDelete are now real network round-trips (schema-v2 API), not instant
  // local state updates — busy disables every action button on the screen so a slow connection
  // can't let someone double-tap Enter/Create/Delete and fire the request twice.
  const [busy, setBusy] = useState(false);
  if (!account) return null;
  const startCreate = slotIndex => {
    setConfirmDeleteSlot(null);
    setCreatingSlot(slotIndex);
    setNameInput("");
    setCreateError("");
  };
  const confirmCreate = async () => {
    if (creatingSlot === null || busy) return;
    setBusy(true);
    const res = await onCreate(creatingSlot, nameInput.trim());
    setBusy(false);
    if (res && res.ok === false) {
      setCreateError(res.message);
      return;
    }
    setCreatingSlot(null);
    setNameInput("");
    setCreateError("");
  };
  return /*#__PURE__*/React.createElement("div", {
    className: `md-character-select-wrap${entryTransition ? " is-entering" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-character-atmosphere",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-character-door-glow"
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-character-torch-glow"
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-character-fog md-character-fog-a"
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-character-fog md-character-fog-b"
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-character-particles"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-menu-title md-character-select-title"
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      fontSize: 24
    }
  }, "เลือกตัวละคร"), /*#__PURE__*/React.createElement("p", null, `${MAX_CHARACTER_SLOTS} ช่องตัวละครต่อบัญชี`)), /*#__PURE__*/React.createElement("div", {
    className: "md-character-slot-list",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      width: "100%"
    }
  }, account.characters.map((slot, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "md-card md-charselect-slot"
  }, slot ? confirmDeleteSlot === i ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: "0 0 8px",
      textAlign: "center"
    }
  }, "⚠️ ลบ \"", slot.name, "\" ถาวร? ข้อมูลตัวละครนี้จะหายไปทั้งหมด"), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee",
    disabled: busy,
    onClick: async () => {
      setBusy(true);
      await onDelete(i);
      setBusy(false);
      setConfirmDeleteSlot(null);
    }
  }, "🗑️ ยืนยันลบ"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn info",
    disabled: busy,
    onClick: () => setConfirmDeleteSlot(null)
  }, "ยกเลิก"))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-charselect-crest",
    "aria-hidden": "true"
  }, "T"), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("p", {
    className: "md-title",
    style: {
      fontSize: 15,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, slot.name), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "Lv", slot.level, " · STR", slot.stats.str, " VIT", slot.stats.vit, " AGI", slot.stats.agi, " DEX", slot.stats.dex, " LUK", slot.stats.luk), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      margin: 0
    }
  }, "🪙 ", formatNumber(slot.gold), " · Stage ", slot.unlockedFloor)), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee small",
    style: {
      flexShrink: 0,
      minHeight: 34,
      fontSize: 10
    },
    disabled: busy,
    onClick: () => setConfirmDeleteSlot(i)
  }, "🗑️ ลบ")), /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    style: {
      marginTop: 8
    },
    disabled: busy,
    onClick: async () => {
      setBusy(true);
      await onEnter(i);
      setBusy(false);
    }
  }, "▶️ เข้าเล่น")) : creatingSlot === i ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "md-field-label"
  }, "ตั้งชื่อตัวละคร"), /*#__PURE__*/React.createElement("input", {
    className: "md-field",
    placeholder: `Character ${i + 1}`,
    value: nameInput,
    maxLength: 16,
    autoFocus: true,
    onChange: e => {
      setNameInput(e.target.value);
      if (createError) setCreateError("");
    },
    onKeyDown: e => e.key === "Enter" && confirmCreate()
  }), createError && /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: {
      color: "#FF8787",
      margin: "4px 0 0"
    }
  }, "⚠️ ", createError), /*#__PURE__*/React.createElement("div", {
    className: "md-btn-row",
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary",
    disabled: busy,
    onClick: confirmCreate
  }, "✨ สร้างตัวละคร"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn info",
    disabled: busy,
    onClick: () => {
      setCreatingSlot(null);
      setCreateError("");
    }
  }, "ยกเลิก"))) : /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    style: {
      minHeight: 64
    },
    disabled: busy,
    onClick: () => startCreate(i)
  }, "➕ สร้างตัวละคร")))), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide md-character-logout",
    style: {
      marginTop: 14
    },
    onClick: onLogout
  }, "🚪 ออกจากระบบ"));
}
function CharacterPageHeader({ save, cp, onBack }) {
  const xpNeed = xpToNext(save.character.level);
  const xpPct = save.character.level >= MAX_LEVEL ? 100 : Math.max(0, Math.min(100, save.character.xp / xpNeed * 100));
  return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("header", { className: "md-character-page-title" },
      /*#__PURE__*/React.createElement("button", { type: "button", onClick: onBack, "aria-label": "ย้อนกลับ" }, "‹"),
      /*#__PURE__*/React.createElement("h1", null, "Character")
    ),
    /*#__PURE__*/React.createElement("section", { className: "md-character-summary" },
      /*#__PURE__*/React.createElement("div", { className: "md-character-summary-main" },
        /*#__PURE__*/React.createElement("strong", null, save.characterName || "Adventurer"),
        /*#__PURE__*/React.createElement("b", null, "⚔ CP ", formatNumber(cp))
      ),
      /*#__PURE__*/React.createElement("div", { className: "md-character-level" }, "LV. ", save.character.level),
      /*#__PURE__*/React.createElement("div", { className: "md-character-exp" },
        /*#__PURE__*/React.createElement("span", null, "EXP ", Math.round(xpPct), "%"),
        /*#__PURE__*/React.createElement("i", null, /*#__PURE__*/React.createElement("b", { style: { width: `${xpPct}%` } }))
      )
    )
  );
}

function CharacterTabs({ active, onStatus, onSkills }) {
  return /*#__PURE__*/React.createElement("nav", { className: "md-character-tabs", "aria-label": "ข้อมูลตัวละคร" },
    /*#__PURE__*/React.createElement("button", { type: "button", className: active === "status" ? "active" : "", onClick: onStatus }, "◈ Status"),
    /*#__PURE__*/React.createElement("button", { type: "button", className: active === "skills" ? "active" : "", onClick: onSkills }, "▤ Skills")
  );
}

function CharacterPageDock({ onCharacter, onOpenInv, onOpenPets, onBack }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return /*#__PURE__*/React.createElement(React.Fragment, null,
    moreOpen && /*#__PURE__*/React.createElement("div", { className: "md-character-more" },
      /*#__PURE__*/React.createElement("button", { type: "button", onClick: onBack }, "↩ กลับหน้าก่อนหน้า")
    ),
    /*#__PURE__*/React.createElement(GameDock, {
      activeKey: "character",
      onCharacter,
      onOpenInv,
      onPets: onOpenPets,
      moreOpen,
      onToggleMore: () => setMoreOpen(open => !open)
    })
  );
}

function PaidResetConfirm({ type, diamonds, onCancel, onConfirm }) {
  const label = type === "stats" ? "รีสเตตัสทั้งหมด" : "รีสกิลทั้งหมด";
  return /*#__PURE__*/React.createElement("div", { className: "md-character-confirm", role: "dialog", "aria-modal": "true" },
    /*#__PURE__*/React.createElement("div", { className: "md-character-confirm-card" },
      /*#__PURE__*/React.createElement("h3", null, label),
      /*#__PURE__*/React.createElement("p", null, type === "stats" ? "คืนแต้มสเตตัสที่เคยใช้ทั้งหมด" : "คืนแต้มสกิลที่เคยใช้ทั้งหมด"),
      /*#__PURE__*/React.createElement("strong", null, "ใช้ 💎 100 · มี ", formatNumber(diamonds)),
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("button", { type: "button", onClick: onCancel }, "ยกเลิก"),
        /*#__PURE__*/React.createElement("button", { type: "button", className: "confirm", disabled: diamonds < 100, onClick: onConfirm }, diamonds < 100 ? "เพชรไม่พอ" : "ยืนยัน")
      )
    )
  );
}

function StatusScreen({
  save,
  charStats,
  cp,
  onCommitStats,
  onResetStats,
  onOpenInv,
  onOpenPets,
  onOpenSkill,
  onBack
}) {
  const emptyDraft = () => Object.fromEntries(STAT_INFO.map(st => [st.key, 0]));
  const [draft, setDraft] = useState(emptyDraft);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const used = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const pointsLeft = Math.max(0, save.character.statPoints - used);
  const previewStatsRaw = { ...save.character.stats };
  STAT_INFO.forEach(st => { previewStatsRaw[st.key] += draft[st.key]; });
  const previewSave = { ...save, character: { ...save.character, stats: previewStatsRaw } };
  const committedBase = characterBaseStats(save);
  const previewBase = characterBaseStats(previewSave);
  // charStats includes equipment/set/pet bonuses. Add only the delta caused by this draft so
  // the screen previews the real total value without pretending equipment disappeared.
  const preview = { ...charStats };
  ["maxHp", "maxMp", "atk", "def", "speed", "accuracy", "critChance", "critDamage", "dodgeChance", "dropBonus"].forEach(key => {
    preview[key] = roundTo(charStats[key] + (previewBase[key] - committedBase[key]), 1);
  });
  const changed = (before, after) => before !== after;
  const value = (before, after, suffix = "") => /*#__PURE__*/React.createElement("span", null,
    before, suffix,
    changed(before, after) && /*#__PURE__*/React.createElement(React.Fragment, null, " → ", /*#__PURE__*/React.createElement("b", { className: "md-preview-value" }, after, suffix))
  );
  const changeDraft = (key, delta) => setDraft(current => {
    const next = Math.max(0, current[key] + delta);
    if (delta > 0 && pointsLeft <= 0) return current;
    return { ...current, [key]: next };
  });
  const commit = () => {
    if (onCommitStats(draft)) setDraft(emptyDraft());
  };
  const doPaidReset = () => {
    if (onResetStats()) {
      setDraft(emptyDraft());
      setConfirmReset(false);
    }
  };
  const combatRows = [
    ["♥", "HP", charStats.maxHp, preview.maxHp, ""],
    ["◆", "MP", charStats.maxMp, preview.maxMp, ""],
    ["⚔", "ATK", charStats.atk, preview.atk, ""],
    ["⬟", "DEF", charStats.def, preview.def, ""],
    ["➤", "SPD", charStats.speed, preview.speed, ""]
  ];
  const advancedRows = [
    ["◎", "Hit Rate", charStats.accuracy, preview.accuracy, "%"],
    ["✦", "CRIT Rate", charStats.critChance, preview.critChance, "%"],
    ["✷", "CRIT DMG", charStats.critDamage, preview.critDamage, "%"],
    ["≋", "Evasion", charStats.dodgeChance, preview.dodgeChance, "%"],
    ["⚔", "Armor Pen.", 0, 0, "%"],
    ["♣", "Drop Bonus", charStats.dropBonus, preview.dropBonus, "%"]
  ];
  const allocatedStats = STAT_INFO.reduce((sum, st) => sum + Math.max(0, Number(save.character.stats[st.key]) || 0), 0);
  return /*#__PURE__*/React.createElement("main", { className: "md-character-page" },
    /*#__PURE__*/React.createElement(CharacterPageHeader, { save, cp, onBack }),
    /*#__PURE__*/React.createElement(CharacterTabs, { active: "status", onStatus: () => {}, onSkills: onOpenSkill }),
    /*#__PURE__*/React.createElement("section", { className: "md-character-scroll" },
      /*#__PURE__*/React.createElement("div", { className: "md-status-grid" },
        /*#__PURE__*/React.createElement("div", { className: "md-stat-card" },
          /*#__PURE__*/React.createElement("h2", null, "⚔ Combat Status"),
          combatRows.map(row => /*#__PURE__*/React.createElement("div", { className: "md-derived-row", key: row[1] }, /*#__PURE__*/React.createElement("span", null, row[0], " ", row[1]), value(row[2], row[3], row[4])))
        ),
        /*#__PURE__*/React.createElement("div", { className: "md-stat-card" },
          /*#__PURE__*/React.createElement("h2", null, "✦ Advanced Status"),
          advancedRows.slice(0, advancedOpen ? advancedRows.length : 4).map(row => /*#__PURE__*/React.createElement("div", { className: "md-derived-row", key: row[1] }, /*#__PURE__*/React.createElement("span", null, row[0], " ", row[1]), value(row[2], row[3], row[4]))),
          /*#__PURE__*/React.createElement("button", { type: "button", className: "md-advanced-toggle", onClick: () => setAdvancedOpen(open => !open) }, advancedOpen ? "ย่อรายการ⌃" : "ดูทั้งหมด⌄")
        )
      ),
      /*#__PURE__*/React.createElement("section", { className: "md-upgrade-card" },
        /*#__PURE__*/React.createElement("div", { className: "md-upgrade-head" },
          /*#__PURE__*/React.createElement("h2", null, "▥ อัปสเตตัส"),
          /*#__PURE__*/React.createElement("span", null, "แต้มคงเหลือ ", /*#__PURE__*/React.createElement("b", null, pointsLeft)),
          /*#__PURE__*/React.createElement("span", null, "ใช้ไป ", /*#__PURE__*/React.createElement("b", null, used))
        ),
        STAT_INFO.map(st => {
          const current = save.character.stats[st.key];
          const after = current + draft[st.key];
          return /*#__PURE__*/React.createElement("div", { className: "md-upgrade-row", key: st.key },
            /*#__PURE__*/React.createElement("span", { className: "md-upgrade-name" }, st.icon, " ", st.label),
            /*#__PURE__*/React.createElement("button", { type: "button", disabled: draft[st.key] <= 0, onClick: () => changeDraft(st.key, -1) }, "−"),
            /*#__PURE__*/React.createElement("span", { className: "md-upgrade-value" }, current, draft[st.key] > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " → ", /*#__PURE__*/React.createElement("b", { className: "md-preview-value" }, after))),
            /*#__PURE__*/React.createElement("button", { type: "button", disabled: pointsLeft <= 0, onClick: () => changeDraft(st.key, 1) }, "+")
          );
        }),
        /*#__PURE__*/React.createElement("div", { className: "md-preview-help" }, /*#__PURE__*/React.createElement("span", null, "● ค่าที่เปลี่ยนจากการทดลองอัป"), /*#__PURE__*/React.createElement("button", { type: "button", disabled: !used, onClick: () => setDraft(emptyDraft()) }, "↻ รีเซ็ต")),
        /*#__PURE__*/React.createElement("div", { className: "md-character-actions" },
          /*#__PURE__*/React.createElement("button", { type: "button", className: "reset", disabled: !allocatedStats, onClick: () => setConfirmReset(true) }, "↻ รีสเตตัส ", /*#__PURE__*/React.createElement("span", null, "💎 100")),
          /*#__PURE__*/React.createElement("button", { type: "button", className: "apply", disabled: !used, onClick: commit }, "ยืนยันการอัปสเตตัส")
        )
      )
    ),
    /*#__PURE__*/React.createElement(CharacterPageDock, { onCharacter: () => {}, onOpenInv, onOpenPets, onBack }),
    confirmReset && /*#__PURE__*/React.createElement(PaidResetConfirm, { type: "stats", diamonds: save.diamonds, onCancel: () => setConfirmReset(false), onConfirm: doPaidReset })
  );
}

function SkillScreen({
  save,
  cp,
  onCommitSkills,
  onResetSkills,
  onOpenInv,
  onOpenPets,
  onBack
}) {
  const [draft, setDraft] = useState({});
  const [filter, setFilter] = useState("all");
  const [confirmReset, setConfirmReset] = useState(false);
  const points = remainingSkillPoints(save);
  const used = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const pointsLeft = Math.max(0, points - used);
  const visibleSkills = SKILLS.filter(skill => filter === "all" || (filter === "active" ? skill.type !== "passive" : skill.type === "passive"));
  const changeDraft = (skill, delta) => setDraft(current => {
    const now = current[skill.key] || 0;
    const committed = committedSkillLevel(save, skill.key);
    if (delta > 0 && (pointsLeft <= 0 || committed + now >= SKILL_MAX_LEVEL)) return current;
    const next = Math.max(0, now + delta);
    return { ...current, [skill.key]: next };
  });
  const effectText = (skill, level) => {
    const scaled = skillAtLevel(skill, level);
    if (Number.isFinite(scaled.mult)) return `${roundInt(scaled.mult * 100)}% ATK`;
    if (Number.isFinite(scaled.healPct)) return `ฟื้นฟู ${roundInt(scaled.healPct * 100)}% HP`;
    return skill.desc;
  };
  const commit = () => {
    if (onCommitSkills(draft)) setDraft({});
  };
  const doPaidReset = () => {
    if (onResetSkills()) {
      setDraft({});
      setConfirmReset(false);
    }
  };
  return /*#__PURE__*/React.createElement("main", { className: "md-character-page" },
    /*#__PURE__*/React.createElement(CharacterPageHeader, { save, cp, onBack }),
    /*#__PURE__*/React.createElement(CharacterTabs, { active: "skills", onStatus: onBack, onSkills: () => {} }),
    /*#__PURE__*/React.createElement("section", { className: "md-character-scroll" },
      /*#__PURE__*/React.createElement("div", { className: "md-skill-toolbar" }, /*#__PURE__*/React.createElement("strong", null, "✦ Skill Points ", pointsLeft)),
      /*#__PURE__*/React.createElement("nav", { className: "md-skill-filters" },
        [["all", "ทั้งหมด"], ["active", "Active"], ["passive", "Passive"]].map(item => /*#__PURE__*/React.createElement("button", { type: "button", key: item[0], className: filter === item[0] ? "active" : "", onClick: () => setFilter(item[0]) }, item[1]))
      ),
      /*#__PURE__*/React.createElement("section", { className: "md-skill-list" },
        visibleSkills.map(skill => {
          const unlocked = skill.unlockLevel <= save.character.level;
          const current = committedSkillLevel(save, skill.key);
          const added = draft[skill.key] || 0;
          const after = current + added;
          return /*#__PURE__*/React.createElement("article", { className: `md-skill-upgrade${unlocked ? "" : " locked"}`, key: skill.key },
            /*#__PURE__*/React.createElement("span", { className: "md-skill-upgrade-icon" }, unlocked ? skill.icon : "🔒"),
            /*#__PURE__*/React.createElement("div", { className: "md-skill-upgrade-copy" },
              /*#__PURE__*/React.createElement("strong", null, skill.name),
              unlocked ? /*#__PURE__*/React.createElement("small", null, effectText(skill, current), added > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " → ", /*#__PURE__*/React.createElement("b", { className: "md-preview-value" }, effectText(skill, after)))) : /*#__PURE__*/React.createElement("small", null, "ปลดล็อกที่ LV. ", skill.unlockLevel)
            ),
            unlocked && /*#__PURE__*/React.createElement("div", { className: "md-skill-level-control" },
              /*#__PURE__*/React.createElement("button", { type: "button", disabled: added <= 0, onClick: () => changeDraft(skill, -1) }, "−"),
              /*#__PURE__*/React.createElement("span", null, "LV. ", current, added > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, " → ", /*#__PURE__*/React.createElement("b", { className: "md-preview-value" }, after))),
              /*#__PURE__*/React.createElement("button", { type: "button", disabled: pointsLeft <= 0 || after >= SKILL_MAX_LEVEL, onClick: () => changeDraft(skill, 1) }, "+")
            )
          );
        }),
        visibleSkills.length === 0 && /*#__PURE__*/React.createElement("p", { className: "md-skill-empty" }, "ยังไม่มีสกิลประเภทนี้")
      ),
      /*#__PURE__*/React.createElement("div", { className: "md-preview-help" }, /*#__PURE__*/React.createElement("span", null, "● ค่าที่เปลี่ยนจากการทดลองอัป"), /*#__PURE__*/React.createElement("button", { type: "button", disabled: !used, onClick: () => setDraft({}) }, "↻ รีเซ็ต")),
      /*#__PURE__*/React.createElement("div", { className: "md-character-actions" },
        /*#__PURE__*/React.createElement("button", { type: "button", className: "reset", disabled: !spentSkillPoints(save), onClick: () => setConfirmReset(true) }, "↻ รีสกิล ", /*#__PURE__*/React.createElement("span", null, "💎 100")),
        /*#__PURE__*/React.createElement("button", { type: "button", className: "apply", disabled: !used, onClick: commit }, "ยืนยันการอัปสกิล")
      )
    ),
    /*#__PURE__*/React.createElement(CharacterPageDock, { onCharacter: onBack, onOpenInv, onOpenPets, onBack }),
    confirmReset && /*#__PURE__*/React.createElement(PaidResetConfirm, { type: "skills", diamonds: save.diamonds, onCancel: () => setConfirmReset(false), onConfirm: doPaidReset })
  );
}
// ---------- Phase 2: Leaderboard ----------
const LEADERBOARD_BOARDS = [{
  key: "floor",
  icon: "🗺️",
  label: "ชั้นลึกสุด",
  valueKey: "max_floor",
  format: v => `ชั้น ${v}`
}, {
  key: "cp",
  icon: "⚡",
  label: "พลังรบ",
  valueKey: "total_cp",
  format: v => `${formatNumber(v)} CP`
}, {
  key: "pet_cp",
  icon: "🐾",
  label: "พลังรบสัตว์เลี้ยง",
  valueKey: "pet_cp",
  format: v => `${formatNumber(v)} CP`
}, {
  key: "pvp",
  icon: "⚔️",
  label: "PvP",
  disabled: true
}, {
  key: "raid",
  icon: "🐉",
  label: "Raid Boss (ดาเมจสะสม)",
  valueKey: "total_contribution",
  format: v => `${formatNumber(v)} dmg`
}];
function LeaderboardScreen({
  serverUrl,
  myCharacterId,
  onBack
}) {
  const [board, setBoard] = useState("floor");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null); // null = live/today
  React.useEffect(() => {
    const def = LEADERBOARD_BOARDS.find(b => b.key === board);
    if (!def || def.disabled) return undefined;
    let cancelled = false;
    setRows(null);
    setError(null);
    const url = serverUrl || DEFAULT_SERVER_URL;
    const fetcher = selectedDate ? cloudGetLeaderboardHistory(url, board, selectedDate) : cloudGetLeaderboard(url, board);
    fetcher.then(res => {
      if (cancelled) return;
      setSpinning(false);
      if (!res || !res.ok) { setError("โหลดอันดับไม่สำเร็จ ลองใหม่อีกครั้ง"); setRows([]); return; }
      setRows(res.rows || []);
      if (res.availableDates) setAvailableDates(res.availableDates);
    });
    return () => { cancelled = true; };
  }, [board, serverUrl, refreshKey, selectedDate]);
  const handleRefresh = () => {
    setSpinning(true);
    setRefreshKey(k => k + 1);
  };
  const dateLabel = (d, idx) => idx === 0 ? "วันนี้" : idx === 1 ? "เมื่อวาน" : `${d.slice(5)}`; // "09-05" etc for 2+ days back
  const activeDef = LEADERBOARD_BOARDS.find(b => b.key === board);
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel",
    style: { flex: 1 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: { marginBottom: 10, position: "relative" }
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-btn small flee",
    title: "รีเฟรช",
    onClick: handleRefresh,
    style: {
      position: "absolute",
      top: 8,
      right: 8,
      padding: "4px 8px",
      lineHeight: 1
    }
  }, spinning ? "⏳" : "🔄"), /*#__PURE__*/React.createElement("p", {
    className: "md-title"
  }, "🏆 อันดับผู้เล่น"), /*#__PURE__*/React.createElement("p", {
    className: "md-sub",
    style: { margin: 0 }
  }, "อัปเดตทุกเที่ยงคืน · Top 50", selectedDate ? ` · ย้อนหลัง ${selectedDate}` : "")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginBottom: 10
    }
  }, LEADERBOARD_BOARDS.map(b => /*#__PURE__*/React.createElement("button", {
    key: b.key,
    className: "md-btn small" + (board === b.key ? " primary" : " flee"),
    disabled: b.disabled,
    style: b.disabled ? { opacity: 0.45 } : undefined,
    onClick: () => setBoard(b.key)
  }, b.icon, " ", b.label, b.disabled ? " (เร็วๆนี้)" : ""))), availableDates.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }
  }, availableDates.map((d, idx) => /*#__PURE__*/React.createElement("button", {
    key: d,
    className: "md-btn small" + ((selectedDate === d || (!selectedDate && idx === 0)) ? " primary" : " flee"),
    onClick: () => setSelectedDate(idx === 0 ? null : d)
  }, dateLabel(d, idx)))), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: { marginBottom: 10 }
  }, activeDef && activeDef.disabled ? /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, "บอร์ดนี้จะเปิดใช้งานในเฟสถัดไป") : error ? /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, error) : rows === null ? /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, "กำลังโหลด...") : rows.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, selectedDate ? "ไม่มีข้อมูลของวันนี้" : "ยังไม่มีข้อมูลอันดับ") : /*#__PURE__*/React.createElement("div", {
    className: "md-inv-list",
    style: { maxHeight: 420, overflowY: "auto" }
  }, rows.map((row, idx) => {
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
    const isMe = row.character_id === myCharacterId;
    const infoEl = /*#__PURE__*/React.createElement("div", {
      className: "md-shop-info"
    }, medal, " ", row.name || "?", isMe ? " (คุณ)" : "");
    const valueEl = /*#__PURE__*/React.createElement("div", {
      className: "md-shop-lv"
    }, activeDef.format(Number(row[activeDef.valueKey]) || 0));
    return /*#__PURE__*/React.createElement("div", {
      key: row.character_id,
      className: "md-shop-row",
      style: isMe ? { background: "rgba(255,215,0,0.12)", borderRadius: 8 } : undefined
    }, /*#__PURE__*/React.createElement("div", null, infoEl, valueEl));
  }))), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide small",
    onClick: onBack
  }, "← Back"));
}
// ---------- Phase 3: Raid Boss ----------
const RAID_STAMINA_MAX_CLIENT = 10; // fallback only — server response's staminaMax is authoritative
function RaidScreen({
  serverUrl,
  cred,
  characterId,
  diamonds,
  onSpendDiamonds,
  onBack
}) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [attacking, setAttacking] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [toast, setToast] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hurtToken, setHurtToken] = useState(0);
  const [hurtPlaying, setHurtPlaying] = useState(false);

  const load = React.useCallback(() => {
    setError(null);
    cloudGetRaidStatus(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId).then(res => {
      if (!res || res.error) { setError("โหลดข้อมูล Raid ไม่สำเร็จ"); return; }
      setStatus(res);
      setSecondsLeft((res.me && res.me.staminaRegenSeconds) || 0);
    }).catch(() => setError("โหลดข้อมูล Raid ไม่สำเร็จ"));
  }, [serverUrl, cred.id, cred.password, characterId]);
  React.useEffect(() => { load(); }, [load]);
  // Use a one-second local timer only while regeneration is active. The previous interval
  // called load() every second whenever the value was already 0 (including at full stamina),
  // which needlessly hammered the API. Re-fetch once, only when this countdown expires.
  React.useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const t = setTimeout(() => {
      if (secondsLeft <= 1) load();
      else setSecondsLeft(secondsLeft - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, load]);

  // Milestones are auto-granted now — no claim button. This is idempotent server-side
  // (returns claimed: [] if nothing new crossed), so it's safe to fire after every attack
  // and once on mount to sweep up anything a previous session left unclaimed. It does NOT
  // run off the countdown-timer's periodic load() — contribution only changes from this
  // character's own attacks, so checking there too would just be wasted API calls.
  const checkMilestones = React.useCallback(() => {
    cloudClaimRaidMilestones(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId).then(res => {
      if (!res || res.error || !res.claimed || !res.claimed.length) return;
      const pcts = res.claimed.map(k => k.replace("p", "") + "%").join(", ");
      setToast(`🎁 ถึงเกณฑ์ดาเมจสะสม ${pcts} — รางวัลส่งเข้ากล่องจดหมายแล้ว!`);
      setTimeout(() => setToast(null), 3500);
      load();
    });
  }, [serverUrl, cred.id, cred.password, characterId, load]);
  React.useEffect(() => { checkMilestones(); }, [checkMilestones]);

  const handleHurtComplete = React.useCallback(() => {
    setHurtPlaying(false);
    load();
    checkMilestones();
  }, [load, checkMilestones]);

  const handleAttack = (useDiamonds) => {
    if (attacking || hurtPlaying) return;
    setAttacking(true);
    setLastResult(null);
    cloudAttackRaidBoss(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId, useDiamonds).then(res => {
      if (!res || res.error) { setLastResult({ error: res && res.error }); return; }
      if (res.paidDiamonds && onSpendDiamonds) onSpendDiamonds(res.diamondsSpent || status.me.diamondRefillCost || 50);
      setLastResult(res);
      // A successful server-side hit is the only trigger for hurt. Delay the
      // status refresh until all three frames finish so a respawn cannot reset
      // or replace the animation halfway through.
      setHurtPlaying(true);
      setHurtToken(token => token + 1);
    }).catch(() => setLastResult({ error: "network_error" })).finally(() => setAttacking(false));
  };

  if (error) {
    return /*#__PURE__*/React.createElement("div", { className: "md-panel" },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, error),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small", onClick: onBack }, "← Back"));
  }
  if (!status) {
    return /*#__PURE__*/React.createElement("div", { className: "md-panel" },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "กำลังโหลด..."));
  }

  const boss = status.boss || {};
  // Keep the screen usable while the separately-deployed API worker is still on the legacy
  // attemptsUsed/attemptsMax response. Diamond refill is shown only after stamina fields exist.
  const serverMe = status.me || {};
  const supportsStamina = Number.isFinite(Number(serverMe.stamina));
  const me = Object.assign({ stamina: RAID_STAMINA_MAX_CLIENT, staminaMax: RAID_STAMINA_MAX_CLIENT, diamondRefillCost: 50, attemptsUsed: 0, attemptsMax: 5, bestHit: 0, contribution: 0, contributionPct: 0, milestonesClaimed: [] }, serverMe);
  const milestoneSpecials = status.milestoneSpecials || [];
  const hpMax = boss.hpMax || 0;
  const hpCurrent = boss.hpCurrent || 0;
  const hpPct = hpMax ? Math.max(0, Math.min(100, hpCurrent / hpMax * 100)) : 0;
  const isDead = hpCurrent <= 0;
  const bossSpriteConfig = getRaidBossSpriteConfig(boss.defId || boss.id);
  const legacyAttemptsLeft = Math.max(0, Number(me.attemptsMax) - Number(me.attemptsUsed));
  const outOfStamina = supportsStamina ? me.stamina <= 0 : legacyAttemptsLeft <= 0;
  const canAffordRefill = (diamonds || 0) >= me.diamondRefillCost;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return /*#__PURE__*/React.createElement("div", { className: "md-panel", style: { flex: 1, position: "relative" } },
    toast && /*#__PURE__*/React.createElement("div", { className: "md-toast" }, toast),
    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10, textAlign: "center" } },
      /*#__PURE__*/React.createElement("p", { className: "md-title" }, boss.name || "Raid Boss"),
      /*#__PURE__*/React.createElement("div", { className: "md-bar-track" },
        /*#__PURE__*/React.createElement("div", {
          className: "md-bar-fill",
          style: { width: `${hpPct}%`, background: "linear-gradient(90deg,#FFD166,#FF6B6B)" }
        })),
      /*#__PURE__*/React.createElement("div", { className: "md-bar-label" }, formatNumber(hpCurrent), " / ", formatNumber(hpMax)),
      /*#__PURE__*/React.createElement(RaidBossFrameSprite, {
        config: bossSpriteConfig,
        hurtToken,
        className: "md-raid-boss-sprite",
        alt: boss.name || "Raid Boss",
        onHurtComplete: handleHurtComplete
      }),
      isDead && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "บอสตายแล้ว! กำลังจะมีตัวใหม่มา")),

    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
        supportsStamina
          ? /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "⚡ ", me.stamina, "/", me.staminaMax, outOfStamina ? ` (เติมอีกใน ${mm}:${ss})` : "")
          : /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "โจมตีเหลือ ", legacyAttemptsLeft, "/", me.attemptsMax),
        /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "สูงสุด ", formatNumber(me.bestHit))),
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "ดาเมจสะสม: ", formatNumber(me.contribution)),
      lastResult && !lastResult.error && /*#__PURE__*/React.createElement("p", {
        className: "md-sub",
        style: { color: lastResult.crit ? "#FFD166" : undefined, fontWeight: "bold" }
      }, lastResult.crit ? "💥 CRIT! " : "", "ดาเมจ ", formatNumber(lastResult.damage)),
      lastResult && lastResult.error && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, lastResult.error === "boss_already_dead" ? "บอสตายแล้ว รอตัวใหม่" : lastResult.error === "no_attempts_left" ? "หมดจำนวนครั้งโจมตีวันนี้แล้ว" : lastResult.error === "no_stamina" ? "พลัง Raid หมดแล้ว กรุณารอให้ฟื้น" : lastResult.error === "stamina_conflict" ? "พลัง Raid มีการเปลี่ยนแปลง กรุณากดใหม่" : lastResult.error === "insufficient_diamonds" ? "เพชรไม่พอสำหรับโจมตี" : lastResult.error === "network_error" ? "เชื่อมต่อ Raid ไม่สำเร็จ กรุณาลองใหม่" : lastResult.error),
      (!outOfStamina || !supportsStamina) && /*#__PURE__*/React.createElement("button", {
        className: "md-btn attack wide",
        style: { marginTop: 8 },
        disabled: attacking || hurtPlaying || isDead || (!supportsStamina && outOfStamina),
        onClick: () => handleAttack(false)
      }, attacking ? "กำลังโจมตี..." : "⚔️ โจมตี"),
      supportsStamina && outOfStamina && /*#__PURE__*/React.createElement("button", {
        className: "md-btn attack wide",
        style: { marginTop: 8 },
        disabled: attacking || hurtPlaying || isDead || !canAffordRefill,
        onClick: () => handleAttack(true)
      }, attacking ? "กำลังโจมตี..." : `💎 จ่าย ${me.diamondRefillCost} เพชรเพื่อโจมตี`)),

    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 14 } }, "ดาเมจสะสม (ทุก 5% ได้เพชร, ทุก 10% ได้วัตถุดิบ — แจกอัตโนมัติ)"),
      /*#__PURE__*/React.createElement("div", { className: "md-bar-track" },
        /*#__PURE__*/React.createElement("div", { className: "md-bar-fill", style: { width: `${me.contributionPct}%`, background: "linear-gradient(90deg,#6EC6FF,#4A7CFF)" } })),
      /*#__PURE__*/React.createElement("div", { className: "md-bar-label" }, me.contributionPct, "%"),
      milestoneSpecials.length === 0 && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "(อัปเดต server แล้วรายละเอียดจะขึ้นตรงนี้)"),
      milestoneSpecials.map(m => {
        const key = `p${m.pct}`;
        const done = me.contributionPct >= m.pct;
        const claimed = me.milestonesClaimed.indexOf(key) !== -1;
        return /*#__PURE__*/React.createElement("div", { key: m.pct, className: "md-shop-row" },
          /*#__PURE__*/React.createElement("div", { className: "md-shop-info" }, m.pct, "% — ", m.label),
          /*#__PURE__*/React.createElement("div", { className: "md-shop-lv" }, claimed ? "✅ ส่งแล้ว" : done ? "⏳ กำลังส่ง..." : "🔒"));
      })),

    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 14 } }, "อันดับดาเมจ"),
      (status.top || []).map((row, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
        const isMe = row.character_id === characterId;
        return /*#__PURE__*/React.createElement("div", {
          key: row.character_id,
          className: "md-shop-row",
          style: isMe ? { background: "rgba(255,215,0,0.12)", borderRadius: 8 } : undefined
        }, /*#__PURE__*/React.createElement("div", { className: "md-shop-info" }, medal, " ", row.name || "?", isMe ? " (คุณ)" : ""),
           /*#__PURE__*/React.createElement("div", { className: "md-shop-lv" }, formatNumber(row.total_contribution)));
      })),

    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small", onClick: onBack }, "← Back"));
}
const PVP_TICKET_MAX_CLIENT = 5; // fallback only — server response's ticketsMax is authoritative
// ---------- Phase 5: PvP Arena ----------
function ArenaScreen({
  serverUrl,
  cred,
  characterId,
  diamonds,
  onSpendDiamonds,
  onBack
}) {
  const [status, setStatus] = useState(null);
  const [opponents, setOpponents] = useState(null);
  const [error, setError] = useState(null);
  const [attackingId, setAttackingId] = useState(null);
  const [refreshingOpp, setRefreshingOpp] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const load = React.useCallback(() => {
    setError(null);
    cloudGetArenaStatus(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId).then(res => {
      if (!res || res.error) { setError("โหลดข้อมูลอารีน่าไม่สำเร็จ"); return; }
      setStatus(res);
      setSecondsLeft(res.ticketsRegenSeconds || 0);
    }).catch(() => setError("โหลดข้อมูลอารีน่าไม่สำเร็จ"));
  }, [serverUrl, cred.id, cred.password, characterId]);
  const loadOpponents = React.useCallback(() => {
    setRefreshingOpp(true);
    cloudGetArenaOpponents(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId).then(res => {
      if (!res || res.error) return;
      setOpponents(res.opponents || []);
    }).finally(() => setRefreshingOpp(false));
  }, [serverUrl, cred.id, cred.password, characterId]);
  React.useEffect(() => { load(); loadOpponents(); }, [load, loadOpponents]);
  // Same "only tick while regen is actually pending" rule as RaidScreen — avoids polling
  // the API once per second while sitting at full tickets.
  React.useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const t = setTimeout(() => {
      if (secondsLeft <= 1) load();
      else setSecondsLeft(secondsLeft - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, load]);

  const handleAttack = (opponentCharacterId, useDiamonds) => {
    if (attackingId) return;
    setAttackingId(opponentCharacterId);
    setLastResult(null);
    cloudAttackArenaOpponent(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId, opponentCharacterId, useDiamonds).then(res => {
      if (!res || res.error) { setLastResult({ error: res && res.error }); return; }
      if (res.paidDiamonds && onSpendDiamonds) onSpendDiamonds(res.diamondsSpent || (status && status.diamondRefillCost) || 30);
      setLastResult(res);
      load();
    }).catch(() => setLastResult({ error: "network_error" })).finally(() => setAttackingId(null));
  };

  if (error) {
    return /*#__PURE__*/React.createElement("div", { className: "md-panel" },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, error),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small", onClick: onBack }, "← Back"));
  }
  if (!status) {
    return /*#__PURE__*/React.createElement("div", { className: "md-panel" },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "กำลังโหลด..."));
  }

  const ticketsMax = status.ticketsMax || PVP_TICKET_MAX_CLIENT;
  const outOfTickets = status.tickets <= 0;
  const canAffordRefill = (diamonds || 0) >= (status.diamondRefillCost || 30);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const errMsgMap = {
    no_tickets: "ตั๋วอารีน่าหมดแล้ว กรุณารอให้ฟื้น",
    ticket_conflict: "ตั๋วอารีน่ามีการเปลี่ยนแปลง กรุณากดใหม่",
    insufficient_diamonds: "เพชรไม่พอสำหรับโจมตี",
    opponent_not_found: "หาคู่ต่อสู้นี้ไม่เจอแล้ว กรุณาสุ่มใหม่",
    cannot_attack_self: "โจมตีตัวเองไม่ได้",
    network_error: "เชื่อมต่ออารีน่าไม่สำเร็จ กรุณาลองใหม่"
  };

  return /*#__PURE__*/React.createElement("div", { className: "md-panel", style: { flex: 1, position: "relative" } },
    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10, textAlign: "center" } },
      /*#__PURE__*/React.createElement("p", { className: "md-title" }, "🥊 อารีน่า"),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-around", marginTop: 6 } },
        /*#__PURE__*/React.createElement("div", null,
          /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "Rating"),
          /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 18 } }, formatNumber(status.rating))),
        /*#__PURE__*/React.createElement("div", null,
          /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "อันดับ"),
          /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 18 } }, "#", status.rank)),
        /*#__PURE__*/React.createElement("div", null,
          /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "W / L"),
          /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 18 } }, status.wins, " / ", status.losses))),
      /*#__PURE__*/React.createElement("p", { className: "md-sub", style: { marginTop: 8 } }, "⚡ ตั๋ว ", status.tickets, "/", ticketsMax, outOfTickets ? ` (เติมอีกใน ${mm}:${ss})` : "")),

    lastResult && /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10, textAlign: "center" } },
      lastResult.error
        ? /*#__PURE__*/React.createElement("p", { className: "md-sub" }, errMsgMap[lastResult.error] || lastResult.error)
        : /*#__PURE__*/React.createElement(React.Fragment, null,
            /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 16, color: lastResult.win ? "#7CFF9E" : "#FF6B6B" } }, lastResult.win ? "🏆 ชนะ!" : "💢 แพ้"),
            /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "vs ", lastResult.opponentName || "?"),
            /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "Rating ", lastResult.ratingBefore, " → ", lastResult.ratingAfter, " (", lastResult.ratingChange >= 0 ? "+" : "", lastResult.ratingChange, ")"),
            /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "💎 +", lastResult.diamondsEarned || 0))),

    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 14 } }, "คู่ต่อสู้"),
        /*#__PURE__*/React.createElement("button", {
          className: "md-btn wide small",
          disabled: refreshingOpp,
          onClick: loadOpponents
        }, refreshingOpp ? "..." : "🔄 สุ่มใหม่")),
      (!opponents || opponents.length === 0) && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, refreshingOpp ? "กำลังหาคู่ต่อสู้..." : "ไม่พบคู่ต่อสู้ในตอนนี้"),
      (opponents || []).map(opp => /*#__PURE__*/React.createElement("div", { key: opp.characterId, className: "md-shop-row" },
        /*#__PURE__*/React.createElement("div", null,
          /*#__PURE__*/React.createElement("div", { className: "md-shop-info" }, opp.name || "?", " (Lv.", opp.level, ")"),
          /*#__PURE__*/React.createElement("div", { className: "md-shop-lv" }, "Rating ", formatNumber(opp.rating), " · ", opp.wins, "W ", opp.losses, "L")),
        !outOfTickets
          ? /*#__PURE__*/React.createElement("button", {
              className: "md-btn attack small",
              disabled: !!attackingId,
              onClick: () => handleAttack(opp.characterId, false)
            }, attackingId === opp.characterId ? "..." : "⚔️ โจมตี")
          : /*#__PURE__*/React.createElement("button", {
              className: "md-btn attack small",
              disabled: !!attackingId || !canAffordRefill,
              onClick: () => handleAttack(opp.characterId, true)
            }, attackingId === opp.characterId ? "..." : `💎${status.diamondRefillCost || 30}`)))),

    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
      /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 14 } }, "จัดอันดับ"),
      (status.top || []).map((row, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
        const isMe = row.characterId === characterId;
        return /*#__PURE__*/React.createElement("div", {
          key: row.characterId,
          className: "md-shop-row",
          style: isMe ? { background: "rgba(255,215,0,0.12)", borderRadius: 8 } : undefined
        }, /*#__PURE__*/React.createElement("div", { className: "md-shop-info" }, medal, " ", row.name || "?", isMe ? " (คุณ)" : ""),
           /*#__PURE__*/React.createElement("div", { className: "md-shop-lv" }, formatNumber(row.rating), " (", row.wins, "W ", row.losses, "L)"));
      })),

    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small", onClick: onBack }, "← Back"));
}
// Turns a mail's item descriptor (worker-side plain data: type/rarity/name/stats/setId/star)
// into a proper client-side item object with a fresh local id + empowerSlots array, ready to
// drop into inventory. The worker never touches items table directly (see mailbox comment in
// api.js) — this is the one place a mail's equipment reward actually "becomes" a real item.
function materializeMailItem(desc) {
  return {
    id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: desc.type,
    rarity: desc.rarity,
    name: desc.name,
    atk: desc.atk || 0,
    def: desc.def || 0,
    hp: desc.hp || 0,
    mp: desc.mp || 0,
    dodgeChance: desc.dodgeChance || 0,
    critChance: desc.critChance || 0,
    critDamage: desc.critDamage || 0,
    enhanceLevel: 0,
    empowerSlots: Array(Math.max(1, desc.empowerSlotCount || 1)).fill(null),
    ...(desc.setId ? { setId: desc.setId } : {}),
    ...(desc.star ? { star: desc.star } : {}),
    ...(desc.craftRecipeId ? { craftRecipeId: desc.craftRecipeId } : {})
  };
}
// ---------- Phase 3.1: Mailbox ----------
function MailboxScreen({
  serverUrl,
  cred,
  characterId,
  onApplyReward,
  onBack
}) {
  const [mails, setMails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState({});

  const load = () => {
    cloudGetMailbox(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId).then(res => {
      if (!res || res.error) { setMails([]); return; }
      setMails(res.mails || []);
      // Drop selections for mail that no longer exists (e.g. after a delete).
      setSelected(prev => {
        const ids = new Set((res.mails || []).map(m => m.mailId));
        const next = {};
        Object.keys(prev).forEach(id => { if (ids.has(id)) next[id] = prev[id]; });
        return next;
      });
    });
  };
  React.useEffect(() => { load(); }, [characterId]);

  const handleClaim = (mailId) => {
    if (busy) return;
    setBusy(true);
    cloudClaimMail(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId, mailId).then(res => {
      setBusy(false);
      if (!res || res.error) return;
      onApplyReward({ gold: res.gold, diamonds: res.diamonds, junk: res.junk, items: res.items });
      load();
    });
  };

  const handleClaimAll = () => {
    if (busy) return;
    setBusy(true);
    cloudClaimAllMail(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId).then(res => {
      setBusy(false);
      if (!res || res.error) return;
      if (res.mailIds && res.mailIds.length) onApplyReward({ gold: res.gold, diamonds: res.diamonds, junk: res.junk, items: res.items });
      load();
    });
  };

  const toggleSelect = (mailId) => setSelected(prev => ({ ...prev, [mailId]: !prev[mailId] }));

  const handleDeleteOne = (mailId) => {
    if (busy) return;
    setBusy(true);
    cloudDeleteMail(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId, mailId).then(() => {
      setBusy(false);
      load();
    });
  };

  const handleDeleteSelected = () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (!ids.length || busy) return;
    setBusy(true);
    cloudDeleteMails(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId, ids).then(() => {
      setBusy(false);
      setSelected({});
      load();
    });
  };

  const handleDeleteAllClaimed = () => {
    if (busy) return;
    setBusy(true);
    cloudDeleteAllClaimedMail(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId).then(() => {
      setBusy(false);
      setSelected({});
      load();
    });
  };

  if (!mails) {
    return /*#__PURE__*/React.createElement("div", { className: "md-panel" },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "กำลังโหลด..."));
  }
  const unclaimed = mails.filter(m => !m.claimed);
  const claimedMails = mails.filter(m => m.claimed);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return /*#__PURE__*/React.createElement("div", { className: "md-panel", style: { flex: 1 } },
    /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" } },
      /*#__PURE__*/React.createElement("p", { className: "md-title" }, "📬 กล่องจดหมาย"),
      unclaimed.length > 0 && /*#__PURE__*/React.createElement("button", { className: "md-btn primary small", disabled: busy, onClick: handleClaimAll }, "รับทั้งหมด")),
    claimedMails.length > 0 && /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, selectedCount > 0 ? `เลือกแล้ว ${selectedCount} ฉบับ` : "จดหมายที่รับแล้ว"),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6 } },
        selectedCount > 0 && /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", disabled: busy, onClick: handleDeleteSelected }, "🗑️ ลบที่เลือก"),
        /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", disabled: busy, onClick: handleDeleteAllClaimed }, "🗑️ ลบที่รับแล้วทั้งหมด"))),
    mails.length === 0 && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "ยังไม่มีจดหมาย"),
    mails.map(m => /*#__PURE__*/React.createElement("div", { key: m.mailId, className: "md-card", style: { marginBottom: 8, opacity: m.claimed ? 0.6 : 1, display: "flex", gap: 8 } },
      m.claimed && /*#__PURE__*/React.createElement("input", {
        type: "checkbox",
        checked: !!selected[m.mailId],
        onChange: () => toggleSelect(m.mailId),
        style: { marginTop: 4, flexShrink: 0 }
      }),
      /*#__PURE__*/React.createElement("div", { style: { flex: 1 } },
        /*#__PURE__*/React.createElement("p", { className: "md-sub", style: { fontWeight: "bold" } }, m.title),
        /*#__PURE__*/React.createElement("p", { className: "md-sub" }, m.body),
        (m.gold > 0 || m.diamonds > 0 || (m.junk && m.junk.length > 0) || (m.items && m.items.length > 0)) && /*#__PURE__*/React.createElement("div", { className: "md-sub md-mail-reward-icons" },
          m.gold > 0 && /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), formatNumber(m.gold)),
          m.diamonds > 0 && /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), formatNumber(m.diamonds)),
          (m.junk || []).map(j => /*#__PURE__*/React.createElement("span", { key: `junk-${j.junkId}` }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: j.junkId }, fallback: (JUNK_INFO[j.junkId] || {}).icon || "📦", className: "md-game-icon md-inline-item-icon", alt: (JUNK_INFO[j.junkId] || {}).name || j.junkId }), j.quantity)),
          (m.items || []).map((it, idx) => /*#__PURE__*/React.createElement("span", { key: `item-${idx}` }, /*#__PURE__*/React.createElement(GameIcon, { item: it, fallback: it.star ? "🪽" : it.setId ? "🔷" : SLOT_ICON[it.type] || "📦", className: "md-game-icon md-inline-item-icon", alt: it.name || "Item" }), it.name))),
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 4 } },
          m.claimed
            ? /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", disabled: busy, onClick: () => handleDeleteOne(m.mailId) }, "🗑️ ลบ")
            : /*#__PURE__*/React.createElement("button", { className: "md-btn primary small", disabled: busy, onClick: () => handleClaim(m.mailId) }, "รับรางวัล"))))),
    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small", onClick: onBack }, "← Back"));
}
function floorEventPreview(monsters) {
  const modifierEvents = new Map();
  monsters.forEach(monster => {
    const modifier = monster.modifier;
    if (!modifier) return;
    const effects = [];
    if (modifier.goldMult > 1) effects.push(`Gold +${roundInt((modifier.goldMult - 1) * 100)}%`);
    if (modifier.xpMult > 1) effects.push(`EXP +${roundInt((modifier.xpMult - 1) * 100)}%`);
    if (modifier.hpMult > 1) effects.push(`Enemy HP +${roundInt((modifier.hpMult - 1) * 100)}%`);
    if (modifier.hpMult < 1) effects.push(`Enemy HP -${roundInt((1 - modifier.hpMult) * 100)}%`);
    if (modifier.atkMult > 1) effects.push(`Enemy ATK +${roundInt((modifier.atkMult - 1) * 100)}%`);
    if (modifier.dropBonusFlat > 0) effects.push(`Drop +${roundInt(modifier.dropBonusFlat)}%`);
    if (modifier.rarityBoost) effects.push("Rare Drop Up");
    modifierEvents.set(modifier.id || modifier.name, {
      id: modifier.id || modifier.name,
      icon: modifier.icon || "✦",
      name: modifier.name || "Special Floor",
      desc: modifier.desc || "ชั้นนี้มีเงื่อนไขพิเศษ",
      color: modifier.color || "#43c8ff",
      effects
    });
  });
  const events = Array.from(modifierEvents.values());
  const boss = monsters.find(monster => monster.isBoss);
  if (boss) {
    events.push({
      id: boss.isEliteBoss ? "elite-boss" : "boss",
      icon: "♛",
      name: boss.isEliteBoss ? "Elite Boss" : "Boss Gate",
      desc: boss.isEliteBoss ? "บอสระดับสูง พร้อมหีบการันตี Elite / Mythic" : "เอาชนะบอสเพื่อปลดล็อกหีบรางวัล",
      color: "#e2aa38",
      effects: []
    });
  }
  return events.length ? events : [{
    id: "normal",
    icon: "◇",
    name: "Normal Floor",
    desc: "ไม่มีอีเวนต์พิเศษในชั้นนี้",
    color: "#7189a7",
    effects: []
  }];
}

function floorRewardPreview(floor, monsters) {
  const gold = monsters.reduce((sum, monster) => sum + (monster.gold || 0), 0);
  const xp = monsters.reduce((sum, monster) => sum + (monster.xp || 0), 0);
  const boss = monsters.find(monster => monster.isBoss);
  const rewards = [
    { icon: "🪙", category: "currency", iconKey: "gold", label: formatNumber(gold), hint: "Gold" },
    { icon: "✦", label: formatNumber(xp), hint: "EXP" }
  ];
  if (boss) rewards.push({ icon: "🎁", category: "chests", iconKey: "equipment", label: "1", hint: "หีบอุปกรณ์" });
  else rewards.push({ icon: "📦", label: "สุ่ม", hint: "วัตถุดิบ" });
  if (boss?.isEliteBoss) rewards.push({ icon: "💎", category: "currency", iconKey: "diamond", label: formatNumber(20 + Math.round(floor / 2)), hint: "Blue Gem" });
  return rewards;
}

function recommendedFloorCp(monsters) {
  return roundInt(monsters.reduce((sum, monster) => {
    return sum + monster.maxHp * 4 + monster.atk * 18 + monster.def * 12 + monster.speed * 5;
  }, 0));
}

function FloorMonsterPreview({ monster }) {
  const config = getMonsterSpriteConfig(monster);
  if (!config) return /*#__PURE__*/React.createElement("div", {
    className: "md-floor-monster-fallback",
    role: "img",
    "aria-label": monster.name
  }, "👹");
  return /*#__PURE__*/React.createElement(AnimatedFrameSprite, {
    config,
    className: `md-floor-monster-sprite${monster.isBoss ? " boss" : ""}`,
    alt: monster.name,
    idleFrameMs: 260
  });
}

function MapScreen({
  save,
  unlockedFloor,
  onSelectFloor,
  onSave,
  onBack,
  onCharacter,
  onOpenInv,
  onPets
}) {
  const e = React.createElement;
  // Five fixed perspective slots match the stair landings painted into
  // dungeon-floor-select-v2.webp. Keep this index-based: calculating positions from
  // floor numbers makes the gates drift away from the artwork as progress changes.
  const gateSlots = [
    { x: 79, y: 2, scale: 0.62 },
    { x: 58, y: 20, scale: 0.72 },
    { x: 75, y: 39, scale: 0.86 },
    { x: 49, y: 58, scale: 0.8 },
    { x: 23, y: 72, scale: 0.88 }
  ];
  const topFloor = Math.max(5, unlockedFloor + 2);
  const bottomFloor = Math.max(1, topFloor - 4);
  const floors = Array.from({ length: topFloor - bottomFloor + 1 }, (_, index) => topFloor - index);
  const encounterCache = useRef(new Map());
  const [detail, setDetail] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);

  const encounterFor = floor => {
    if (!encounterCache.current.has(floor)) encounterCache.current.set(floor, makeEncounter(floor));
    return encounterCache.current.get(floor);
  };
  const openFloor = floor => {
    if (floor > unlockedFloor) return;
    setMoreOpen(false);
    setDetail({ floor, monsters: encounterFor(floor) });
  };
  const handleSave = () => {
    onSave();
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1200);
  };
  const enterSelectedFloor = () => {
    if (!detail || detail.floor > unlockedFloor) return;
    onSelectFloor(detail.floor, detail.monsters);
  };
  return e("main", { className: `md-dungeon-map-page${detail ? " detail-open" : ""}` },
    e("div", { className: "md-hub-resources md-dungeon-resources" },
      e("span", null, e(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-resource-icon", alt: "Gold" }), " ", e("b", null, formatNumber(save.gold))),
      e("span", null, e(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-resource-icon", alt: "Diamond" }), " ", e("b", null, formatNumber(save.diamonds || 0))),
      e("span", null, "🛡️ ", e("b", null, formatNumber(save.protectionStones || 0)))
    ),
    e("header", { className: "md-dungeon-map-header" },
      e("button", { type: "button", onClick: onBack, "aria-label": "กลับหน้าหลัก" }, "‹"),
      e("div", null,
        e("h1", null, "เลือกชั้นดันเจี้ยน"),
        e("p", null, "ท้าทายให้สูงขึ้น เพื่อรับรางวัลที่ดีกว่า")
      )
    ),
    e("section", { className: "md-dungeon-floor-world", "aria-label": "ชั้นดันเจี้ยน" },
      floors.map((floor, index) => {
        const locked = floor > unlockedFloor;
        const current = floor === unlockedFloor;
        const cleared = floor < unlockedFloor;
        const boss = floor % 5 === 0;
        const elite = floor % 10 === 0;
        const slot = gateSlots[index];
        const state = locked ? "locked" : current ? "current" : "cleared";
        return e("button", {
          key: floor,
          type: "button",
          className: `md-dungeon-floor-node ${state}${boss ? " boss" : ""}${elite ? " elite" : ""}`,
          style: {
            left: `${slot.x}%`,
            top: `${slot.y}%`,
            "--md-gate-scale": slot.scale
          },
          disabled: locked,
          onClick: () => openFloor(floor),
          "aria-label": `ชั้น ${floor} ${locked ? "ล็อกอยู่" : current ? "ชั้นปัจจุบัน" : "เคลียร์แล้ว"}`
        },
          e("span", { className: "md-dungeon-floor-number" }, floor),
          boss && e("span", { className: "md-dungeon-boss-label" }, elite ? "ELITE BOSS" : "BOSS"),
          e("span", { className: "md-dungeon-door" },
            e("img", {
              src: boss ? "ui/dungeon-select/dungeon-gate-boss-v2.webp" : "ui/dungeon-select/dungeon-gate-normal-v2.webp",
              alt: "",
              draggable: false,
              "aria-hidden": "true"
            }),
            locked && e("span", { className: "md-dungeon-lock", "aria-hidden": "true" }, "▣")
          ),
          e("span", { className: "md-dungeon-floor-state" }, locked ? "ล็อกอยู่" : current ? "พร้อมท้าทาย" : cleared ? "เคลียร์แล้ว" : "")
        );
      })
    ),
    moreOpen && e("div", { className: "md-hub-more-panel md-dungeon-more-panel" },
      e("div", { className: "md-hub-more-head" },
        e("strong", null, "เมนูเพิ่มเติม"),
        e("button", { type: "button", onClick: () => setMoreOpen(false), "aria-label": "ปิดเมนู" }, "✕")
      ),
      e("div", { className: "md-hub-more-grid" },
        e("button", { type: "button", onClick: onBack }, "⌂", e("span", null, "หน้าหลัก")),
        e("button", { type: "button", onClick: handleSave }, saveFlash ? "✅" : "💾", e("span", null, saveFlash ? "บันทึกแล้ว" : "บันทึก"))
      )
    ),
    e(GameDock, {
      onCharacter,
      onOpenInv,
      onPets,
      moreOpen,
      onToggleMore: () => setMoreOpen(open => !open)
    }),
    detail && e("div", { className: "md-floor-detail-backdrop", onClick: () => setDetail(null) },
      e("section", {
        className: "md-floor-detail-sheet",
        role: "dialog",
        "aria-modal": "true",
        "aria-labelledby": "md-floor-detail-title",
        onClick: event => event.stopPropagation()
      },
        e("button", { type: "button", className: "md-floor-detail-x", onClick: () => setDetail(null), "aria-label": "ปิด" }, "✕"),
        e("div", { className: `md-floor-detail-heading${detail.floor % 5 === 0 ? " boss" : ""}` },
          e("div", { className: "md-floor-title" },
            e("small", null, detail.floor % 5 === 0 ? "BOSS GATE" : "DUNGEON FLOOR"),
            e("h2", { id: "md-floor-detail-title" }, "ชั้น ", detail.floor)
          ),
          e("div", { className: "md-floor-cp" }, e("span", null, "⚔ พลังต่อสู้แนะนำ"), e("strong", null, formatNumber(recommendedFloorCp(detail.monsters))))
        ),
        e("div", { className: "md-floor-monster-stage", "aria-label": "มอนสเตอร์ประจำชั้น" },
          detail.monsters.map(monster => e("div", { className: "md-floor-monster", key: monster.uid },
            e(FloorMonsterPreview, { monster }),
            e("span", null, monster.name.replace(/\s*\((?:Elite\s+)?Boss\)\s*/gi, ""))
          ))
        ),
        e("h3", null, "อีเวนต์ชั้นนี้"),
        e("div", { className: "md-floor-events" },
          floorEventPreview(detail.monsters).map(event => e("div", {
            key: event.id,
            className: "md-floor-event",
            style: { "--md-event-color": event.color }
          },
            e("span", { className: "md-floor-event-icon", "aria-hidden": "true" }, event.icon),
            e("div", { className: "md-floor-event-copy" },
              e("b", null, event.name),
              e("p", null, event.desc),
              event.effects.length > 0 && e("small", null, event.effects.join(" · "))
            )
          ))
        ),
        e("h3", null, "รางวัลที่อาจได้รับ"),
        e("div", { className: "md-floor-rewards" },
          floorRewardPreview(detail.floor, detail.monsters).map(reward => e("div", { key: reward.hint },
            e("span", null, reward.category ? e(GameIcon, { category: reward.category, iconKey: reward.iconKey, fallback: reward.icon, className: "md-game-icon md-floor-reward-icon", alt: reward.hint }) : reward.icon), e("b", null, reward.label), e("small", null, reward.hint)
          ))
        ),
        e("div", { className: "md-floor-detail-actions" },
          e("button", { type: "button", className: "close", onClick: () => setDetail(null) }, "ปิด"),
          e("button", { type: "button", className: "enter", onClick: enterSelectedFloor }, "เข้าสู่ดันเจี้ยน", e("span", null, " ›"))
        )
      )
    )
  );
}
function ShopOverlay({
  gold,
  diamonds,
  protectionStones,
  stock,
  onBuyItem,
  onBuyPotionTier,
  onBuyProtectionStone,
  onBuyMaterial,
  onClose
}) {
  const [toast, setToast] = useState("");
  const toastRef = useRef(null);
  const showToast = msg => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 1000);
  };
  const guardBuy = (canAfford, action) => {
    if (!canAfford) {
      showToast("เงินไม่พอซื้อ");
      return;
    }
    action();
  };
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
      borderBottom: "none",
      position: "relative"
    }
  }, toast && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 10,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.85)",
      color: "#fff",
      padding: "8px 16px",
      borderRadius: 20,
      fontSize: 12,
      zIndex: 30,
      whiteSpace: "nowrap",
      boxShadow: "0 2px 10px rgba(0,0,0,0.4)"
    }
  }, "💸 ", toast), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), gold, " · ", /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), diamonds || 0)), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee small",
    onClick: onClose,
    style: {
      boxShadow: "none",
      padding: "6px 12px"
    }
  }, "Close")), /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, "รายการสุ่มใหม่ทุกครั้งที่เปิดร้าน"), /*#__PURE__*/React.createElement("div", {
    className: "md-shop-list"
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
  }, /*#__PURE__*/React.createElement(GameIcon, { item: it, fallback: SLOT_ICON[it.type], className: "md-game-icon md-shop-item-icon", alt: it.name }), " ", it.name), /*#__PURE__*/React.createElement("div", {
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
    onClick: () => guardBuy(gold >= it.price, () => onBuyItem(it))
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), /*#__PURE__*/React.createElement("span", { className: gold < it.price ? "md-cost-insufficient" : "" }, it.price)))), (stock.potions || []).map(p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "md-inv-item"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-inv-name"
  }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: p.id }, fallback: p.icon, className: "md-game-icon md-shop-item-icon", alt: p.name }), " ", p.name), /*#__PURE__*/React.createElement("div", {
    className: "md-inv-stat"
  }, p.desc)), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    onClick: () => guardBuy(gold >= p.price, () => onBuyPotionTier(p.id))
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), /*#__PURE__*/React.createElement("span", { className: gold < p.price ? "md-cost-insufficient" : "" }, p.price)))), /*#__PURE__*/React.createElement("div", {
    key: "protectionStone",
    className: "md-inv-item"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-inv-name"
  }, "🛡️ หินป้องกัน (มีอยู่ ", protectionStones || 0, ")"), /*#__PURE__*/React.createElement("div", {
    className: "md-inv-stat"
  }, "ป้องกันไม่ให้เลเวลตีบวกร่วงเมื่อล้มเหลว (+7 ขึ้นไป)")), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    onClick: () => guardBuy((diamonds || 0) >= PROTECTION_STONE_PRICE, onBuyProtectionStone)
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), /*#__PURE__*/React.createElement("span", { className: (diamonds || 0) < PROTECTION_STONE_PRICE ? "md-cost-insufficient" : "" }, PROTECTION_STONE_PRICE))), ["iron", "manaOre"].map(type => /*#__PURE__*/React.createElement("div", {
    key: type,
    className: "md-inv-item"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "md-inv-name"
  }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: type }, fallback: JUNK_INFO[type].icon, className: "md-game-icon md-shop-item-icon", alt: JUNK_INFO[type].name }), " ", JUNK_INFO[type].name)), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    onClick: () => guardBuy(gold >= MATERIAL_SHOP_PRICE[type], () => onBuyMaterial(type))
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), /*#__PURE__*/React.createElement("span", { className: gold < MATERIAL_SHOP_PRICE[type] ? "md-cost-insufficient" : "" }, MATERIAL_SHOP_PRICE[type])))))));
}
function PetScreen({
  save,
  onEquip,
  onUnequip,
  onStarUp,
  onOpenGacha,
  onBack
}) {
  const [starUpMsg, setStarUpMsg] = React.useState({}); // instId -> {text, short:bool}
  const rarityRank = { r: 0, sr: 1, ssr: 2 };
  const owned = [...(save.pets || [])].sort((a, b) => {
    const da = getPetDef(a.defId);
    const db = getPetDef(b.defId);
    return (rarityRank[db?.rarity] ?? 0) - (rarityRank[da?.rarity] ?? 0);
  });
  function handleStarUp(inst) {
    const res = onStarUp(inst.instId);
    if (res && res.ok) {
      setStarUpMsg(m => ({ ...m, [inst.instId]: null }));
      return;
    }
    if (res && res.maxed) {
      setStarUpMsg(m => ({ ...m, [inst.instId]: { text: "★5 เต็มแล้ว", short: false } }));
      return;
    }
    const missing = (res.need || 0) - (res.have || 0);
    setStarUpMsg(m => ({
      ...m,
      [inst.instId]: { text: `ตัวซ้ำไม่พอ ขาดอีก ${missing} ตัว (มี ${res.have}/${res.need})`, short: true }
    }));
  }
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
    className: "md-title",
    style: {
      margin: 0
    }
  }, "🐾 Pets ", /*#__PURE__*/React.createElement("span", {
    className: "md-shop-lv"
  }, "💎", save.diamonds || 0))), /*#__PURE__*/React.createElement("div", {
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
    const star = inst.star || 1;
    const dupHave = petDuplicateCount(save.petDuplicates, inst.defId);
    const cost = petStarUpCost(star);
    const msg = starUpMsg[inst.instId];
    return /*#__PURE__*/React.createElement("div", {
      key: inst.instId,
      className: `md-inv-item ${def.rarity === "ssr" ? "epic" : def.rarity === "sr" ? "rare" : ""}`
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "md-inv-name"
    }, def.icon, " ", def.name, " ", /*#__PURE__*/React.createElement("span", {
      className: "md-shop-lv"
    }, PET_RARITY_LABEL[def.rarity]), isActive ? " ⭐" : ""), /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat"
    }, "★".repeat(star), "☆".repeat(5 - star), " ", cost !== null ? `· ตัวซ้ำ ${dupHave}/${cost}` : "· ★5 สูงสุด"), /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat"
    }, def.active.icon, " ", def.active.name, " — ", def.active.desc), def.passive && /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat"
    }, def.passive.icon, " ", def.passive.name, " — ", def.passive.desc), def.extra && /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat"
    }, def.extra.icon, " ", def.extra.name, " — ", def.extra.desc), msg && /*#__PURE__*/React.createElement("div", {
      className: "md-inv-stat",
      style: msg.short ? { color: "#ff5566", fontWeight: 700 } : { color: "var(--gold)" }
    }, msg.text)), /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", flexDirection: "column", gap: 4, alignItems: "stretch" }
    }, isActive ? /*#__PURE__*/React.createElement("button", {
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
    }, "Equip"), cost !== null && /*#__PURE__*/React.createElement("button", {
      className: "md-buy-btn",
      style: dupHave < cost ? {
        background: "var(--panel-soft)",
        color: "#ff5566",
        boxShadow: "none",
        border: "1px solid #ff5566"
      } : undefined,
      onClick: () => handleStarUp(inst)
    }, `⭐ อัพดาว (${cost})`)));
  }))), /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    style: {
      marginBottom: 8
    },
    onClick: onOpenGacha
  }, "🎰 Pet Gacha"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide small",
    onClick: onBack
  }, "← Back"));
}
function GachaScreen({
  save,
  gachaResult,
  onClearGachaResult,
  onGacha,
  onClaimDiamonds,
  onBack
}) {
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
    className: "md-title",
    style: {
      margin: "0 0 4px",
      fontSize: 15
    }
  }, "🎰 Pet Gacha ", /*#__PURE__*/React.createElement("span", {
    className: "md-shop-lv"
  }, "💎", save.diamonds || 0)), /*#__PURE__*/React.createElement("p", {
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
  }, PET_RARITY_LABEL[gachaResult.pet.rarity], " ", gachaResult.duplicate ? "· ได้ตัวซ้ำ! เก็บเป็นวัตถุดิบอัพดาวแล้ว" : "· ได้สัตว์เลี้ยงใหม่!"), /*#__PURE__*/React.createElement("button", {
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
  anim,
  equipped = {},
  showName = true,
  label = "You",
  combatSpeed = 1
}) {
  // Hero V3 only: one approved Base Hero plus transparent overlay equipment.
  // The old skeletal rig and legacy core.neutral paths have been removed.
  const visual = getHeroV3Config("hero001")
    ? /*#__PURE__*/React.createElement(HeroOverlayComposer, {
      characterId: "hero001",
      selection: heroVisualSelectionFromEquipment(equipped),
      anim: anim || "",
      playbackRate: combatSpeed
    })
    : /*#__PURE__*/React.createElement("div", {
        className: `md-hero ${anim || ""}`
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
      }));

  return /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-wrap"
  }, visual, showName && /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-name"
  }, label));
}

const MONSTER_VISUAL_SIZES = {
  small: { height: 52, maxWidth: 78 },
  medium: { height: 68, maxWidth: 100 },
  large: { height: 84, maxWidth: 120 },
  elite: { height: 104, maxWidth: 144 }
};
function getMonsterPresentation(enemy) {
  const config = getMonsterSpriteConfig(enemy);
  const configuredSize = config?.presentation?.sizeClass;
  const requestedSize = enemy?.isEliteBoss ? "elite" : configuredSize || enemy?.sizeClass || (enemy?.isBoss ? "large" : "medium");
  const sizeClass = MONSTER_VISUAL_SIZES[requestedSize] ? requestedSize : "medium";
  const configuredAnchor = config?.presentation?.anchorType;
  const anchorType = configuredAnchor === "flying" || enemy?.anchorType === "flying" ? "flying" : "ground";
  return { sizeClass, anchorType, ...MONSTER_VISUAL_SIZES[sizeClass] };
}
function EnemySprite({
  enemy,
  anim,
  selected,
  onClick,
  combatSpeed = 1
}) {
  const spriteConfig = getMonsterSpriteConfig(enemy);
  const presentation = getMonsterPresentation(enemy);
  const hpPct = Math.max(0, Math.min(100, enemy.hp / enemy.maxHp * 100));
  const dead = enemy.hp <= 0;
  const spriteVisual = spriteConfig
    ? /*#__PURE__*/React.createElement(AnimatedFrameSprite, {
        key: `${enemy.uid}:${dead ? "death" : anim === "attack" ? "attack" : "idle"}`,
        config: spriteConfig,
        anim: anim || "",
        dead,
        // Match the combat action window so all three attack frames are readable.
        attackFrameMs: 120 / combatSpeed,
        cropTransparent: true,
        visualHeight: presentation.height,
        maxVisualWidth: presentation.maxWidth,
        className: `md-enemy-img ${enemy.isBoss ? "boss" : ""} ${anim || ""}`,
        alt: enemy.name
      })
    : null;

  return /*#__PURE__*/React.createElement("div", {
    className: `md-sprite-wrap md-monster-unit size-${presentation.sizeClass} anchor-${presentation.anchorType}`,
    onClick: !dead && onClick ? () => onClick(enemy.uid) : undefined,
    style: {
      cursor: !dead && onClick ? "pointer" : "default",
      opacity: 1,
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
  }, enemy.hp, "/", enemy.maxHp)), /*#__PURE__*/React.createElement("div", {
    className: "md-unit-status",
    "aria-label": "Enemy status effects"
  }, enemy.isEliteBoss && /*#__PURE__*/React.createElement("span", {
    className: "elite",
    title: "Elite Boss"
  }, "👑 ELITE"), enemy.frozenTurns > 0 && /*#__PURE__*/React.createElement("span", {
    title: `Frozen · ${enemy.frozenTurns} turn(s)`
  }, "❄️", enemy.frozenTurns), enemy.poisonTurns > 0 && /*#__PURE__*/React.createElement("span", {
    title: `Poison · ${enemy.poisonTurns} turn(s)`
  }, "☠️", enemy.poisonTurns)), spriteVisual || /*#__PURE__*/React.createElement("div", {
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
  }, enemy.name));
}

function PetCombatSprite({ pet, anim, combatSpeed = 1 }) {
  const dead = pet.hp <= 0;
  const hpPct = Math.max(0, Math.min(100, pet.hp / pet.maxHp * 100));
  const spriteConfig = getPetSpriteConfig(pet.defId);
  const spriteVisual = spriteConfig
    ? /*#__PURE__*/React.createElement(AnimatedFrameSprite, {
        key: `${pet.instId}:${dead ? "death" : anim === "attack" ? "attack" : "idle"}`,
        config: spriteConfig,
        anim: anim || "",
        dead,
        // Keep all three attack frames visible long enough to read in combat.
        // The pet action state is held for 420ms in App.js.
        attackFrameMs: 120 / combatSpeed,
        className: `md-enemy-img md-pet-img ${anim || ""}`,
        alt: pet.name
      })
    : null;

  return /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-wrap",
    style: { opacity: 1 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-fill",
    style: { width: `${hpPct}%` }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-hp"
  }, pet.hp, "/", pet.maxHp)), /*#__PURE__*/React.createElement("div", {
    className: "md-unit-status pet",
    "aria-label": "Pet status"
  }, pet.atkBuffTurns > 0 && /*#__PURE__*/React.createElement("span", {
    title: `ATK Up · ${pet.atkBuffTurns} turn(s)`
  }, "⚔️", pet.atkBuffTurns), pet.defBuffTurns > 0 && /*#__PURE__*/React.createElement("span", {
    title: `DEF Up · ${pet.defBuffTurns} turn(s)`
  }, "🛡️", pet.defBuffTurns), /*#__PURE__*/React.createElement("span", {
    className: pet.cooldown > 0 ? "cooldown" : "ready",
    title: pet.active && pet.active.desc
  }, pet.cooldown > 0 ? `CD ${pet.cooldown}` : "READY")), spriteVisual || /*#__PURE__*/React.createElement("div", {
    className: `md-enemy ${anim || ""}`,
    style: { display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: "none", border: "none" }
  }, pet.icon), /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-name"
  }, pet.name, dead ? " 💤" : ""));
}

// Four fixed ATB cells occupy the middle four sixths of the combat header. When
// an action is resolving, the window follows the active unit so upcoming turns
// remain readable even in a five-unit battle (hero + pet + three monsters).
function TurnOrderBar({ queue, activeKey, monsters, petCombat }) {
  const visible = queue.filter(item => {
    if (item.kind === "monster") {
      const m = monsters.find(mm => mm.uid === item.uid);
      return !!m && m.hp > 0;
    }
    if (item.kind === "pet") {
      return !!petCombat && petCombat.hp > 0;
    }
    return true;
  });
  const activeIndex = Math.max(0, visible.findIndex(item => item.key === activeKey));
  const ordered = visible.slice(activeIndex);
  const overflow = Math.max(0, ordered.length - 4);
  const slots = Array.from({ length: 4 }, (_, index) => ordered[index] || null);
  return /*#__PURE__*/React.createElement("div", {
    className: "md-turn-queue"
  }, slots.map((item, i) => {
    if (!item) return /*#__PURE__*/React.createElement("div", {
      key: `empty-${i}`,
      className: "md-turn-queue-item empty",
      title: "Empty ATB slot"
    }, /*#__PURE__*/React.createElement("span", {
      className: "md-turn-queue-icon"
    }, "·"));
    const isActive = activeKey === item.key;
    return /*#__PURE__*/React.createElement("div", {
      key: item.key,
      className: `md-turn-queue-item ${item.kind} ${isActive ? "active" : ""}`,
      title: `${item.name} · Speed ${item.speed}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "md-turn-queue-icon"
    }, item.icon), i === 3 && overflow > 0 && /*#__PURE__*/React.createElement("i", {
      className: "md-turn-queue-more"
    }, "+", overflow));
  }));
}
function CombatScreen({
  player,
  monsters,
  targetUid,
  onSelectTarget,
  log,
  busy,
  inventory,
  quickSlots,
  onAssignQuickSlot,
  onClearQuickSlot,
  heroAnim,
  petAnim,
  enemyAnims,
  floats,
  onAction,
  equipped,
  petCombat,
  turnQueue,
  activeTurnKey,
  combatSpeed,
  combatTurnCount,
  onCycleCombatSpeed
}) {
  const [editSlots, setEditSlots] = useState(false);
  const [assignSlotIndex, setAssignSlotIndex] = useState(null);
  const [autoRun, setAutoRun] = useState(false);
  const skills = unlockedSkills(player.level);
  const potionStacks = ownedPotionStacks(inventory || []);
  const stats = getStats(player, equipped);
  const hpPct = Math.max(0, Math.min(100, player.hp / stats.maxHp * 100));
  const mpPct = Math.max(0, Math.min(100, player.mp / stats.maxMp * 100));
  const xpNeed = xpToNext(player.level);
  const xpPct = player.level >= MAX_LEVEL ? 100 : Math.max(0, Math.min(100, player.xp / xpNeed * 100));
  const primaryEnemy = monsters.find(m => m.uid === targetUid && m.hp > 0) || monsters.find(m => m.hp > 0) || monsters[0];
  const bossOrModifier = monsters.find(m => m.isEliteBoss || m.modifier);
  const skipUnlocked = (combatTurnCount || 0) >= 5;
  // Keep ground monsters in their encounter order. A verified flying monster is
  // placed last, which maps it to formation slot 3 in a three-enemy encounter.
  const formationMonsters = monsters.slice().sort((a, b) => {
    const aFlying = getMonsterPresentation(a).anchorType === "flying" ? 1 : 0;
    const bFlying = getMonsterPresentation(b).anchorType === "flying" ? 1 : 0;
    return aFlying - bFlying;
  });
  const qs = quickSlots || [null, null, null, null];
  function quickSlotVisual(entry) {
    if (!entry) return { icon: "➕", disabled: true, badge: null };
    if (entry.kind === "skill") {
      const sk = skills.find(s => s.key === entry.key);
      if (!sk) return { icon: "❓", disabled: true, badge: null };
      return { icon: sk.icon, disabled: busy || player.mp < sk.mp, badge: sk.mp, title: `${sk.name} (${sk.mp}mp) — ${sk.desc}` };
    }
    const def = getPotionDef(entry.potionId);
    const qty = potionTotal(inventory || [], entry.potionId);
    if (!def) return { icon: "🧪", disabled: true, badge: null };
    return { icon: def.icon, disabled: busy || qty <= 0, badge: qty, title: `${def.name} — ${def.desc}` };
  }
  function useQuickSlot(i) {
    const entry = qs[i];
    if (editSlots) {
      setAssignSlotIndex(i);
      return;
    }
    if (!entry) {
      setAssignSlotIndex(i);
      return;
    }
    if (entry.kind === "skill") onAction("skill", entry.key);else onAction("item", entry.potionId);
  }
  function assignTo(slotIndex, entry) {
    onAssignQuickSlot(slotIndex, entry);
    setAssignSlotIndex(null);
  }
  useEffect(() => {
    // Auto Run: keep throwing basic attacks on its own while enabled, as long
    // as we're not mid-animation and no picker is open (so a manual pick doesn't
    // get raced by an auto attack).
    if (!autoRun || busy || assignSlotIndex !== null) return;
    const t = setTimeout(() => onAction("attack"), Math.round(550 / (combatSpeed || 1)));
    return () => clearTimeout(t);
  }, [autoRun, busy, assignSlotIndex, onAction, combatSpeed]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "md-scene battle-bg"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-battle-top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-combat-stats"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-combat-level"
  }, "LV ", player.level), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-text"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hud-text-row"
  }, "HP ", player.hp, "/", stats.maxHp), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-text-row"
  }, "SP ", player.mp, "/", stats.maxMp), /*#__PURE__*/React.createElement("div", {
    className: "md-hud-text-row xp"
  }, "EXP ", Math.floor(xpPct), "%"))), /*#__PURE__*/React.createElement(TurnOrderBar, {
    queue: turnQueue || [],
    activeKey: activeTurnKey,
    monsters: monsters,
    petCombat: petCombat
  }), /*#__PURE__*/React.createElement("div", {
    className: "md-combat-top-actions"
  }, /*#__PURE__*/React.createElement("button", {
    className: `md-combat-header-action ${skipUnlocked ? "skip" : "speed"}`,
    disabled: busy,
    title: skipUnlocked ? "ข้ามเทิร์นของฮีโร่" : "เปลี่ยนความเร็วการต่อสู้",
    onClick: skipUnlocked ? () => onAction("skip") : onCycleCombatSpeed
  }, skipUnlocked ? "SKIP" : `×${combatSpeed || 1}`))), bossOrModifier && !bossOrModifier.isEliteBoss && /*#__PURE__*/React.createElement("div", {
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
    className: "md-party-board"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hero-slot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar hero"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-fill",
    style: {
      width: `${hpPct}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-hp"
  }, player.hp, "/", stats.maxHp)), /*#__PURE__*/React.createElement(HeroSprite, {
    anim: heroAnim,
    equipped: equipped,
    combatSpeed: combatSpeed
  }), (player.atkBuffTurns > 0 || player.defBuffTurns > 0 || player.regenTurns > 0) && /*#__PURE__*/React.createElement("div", {
    className: "md-unit-status hero",
    "aria-label": "Hero status"
  }, player.atkBuffTurns > 0 ? `⚔️${player.atkBuffTurns}` : "", player.defBuffTurns > 0 ? `🛡️${player.defBuffTurns}` : "", player.regenTurns > 0 ? `💚${player.regenTurns}` : ""), floats.filter(f => f.side === "hero").map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: {
      color: f.color
    }
  }, f.text))), petCombat && /*#__PURE__*/React.createElement("div", {
    className: "md-pet-slot"
  }, /*#__PURE__*/React.createElement(PetCombatSprite, {
    pet: petCombat,
    anim: petAnim,
    combatSpeed: combatSpeed
  }), floats.filter(f => f.side === "pet").map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: { color: f.color }
  }, f.text)))), /*#__PURE__*/React.createElement("div", {
    className: `md-monster-board md-monster-count-${Math.min(3, Math.max(1, monsters.length))}`
  }, formationMonsters.map((m, monsterIndex) => /*#__PURE__*/React.createElement("div", {
    key: m.uid,
    className: `md-monster-slot md-monster-slot-${Math.min(monsterIndex, 2)} ${m.isEliteBoss ? "elite" : ""} ${getMonsterPresentation(m).anchorType === "flying" ? "flying" : "grounded"}`
  }, /*#__PURE__*/React.createElement(EnemySprite, {
    enemy: m,
    anim: enemyAnims[m.uid],
    selected: monsters.filter(mm => mm.hp > 0).length > 1 && m.uid === (primaryEnemy && primaryEnemy.uid),
    onClick: onSelectTarget,
    combatSpeed: combatSpeed
  }), floats.filter(f => f.side === m.uid).map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: {
      color: f.color
    }
  }, f.text)))))), /*#__PURE__*/React.createElement("div", {
    className: "md-battle-dock"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-quickslot-bar battle"
  }, [0, 1, 2, 3].map(i => {
    const v = quickSlotVisual(qs[i]);
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      className: `md-quickslot-btn battle ${qs[i] ? "filled" : "empty"} ${editSlots ? "editing" : ""}`,
      disabled: !editSlots && v.disabled,
      title: v.title || "แตะเพื่อกำหนดช่องนี้",
      onClick: () => useQuickSlot(i)
    }, /*#__PURE__*/React.createElement("span", { className: "md-quickslot-icon" }, qs[i]?.kind === "potion" ? /*#__PURE__*/React.createElement(GameIcon, {
      item: { type: "potion", potionId: qs[i].potionId },
      fallback: v.icon,
      className: "md-game-icon md-quickslot-item-icon",
      alt: v.title || "Potion"
    }) : v.icon), v.badge != null && /*#__PURE__*/React.createElement("i", {
      className: "md-rail-badge"
    }, v.badge));
  })), assignSlotIndex !== null && /*#__PURE__*/React.createElement("div", {
    className: "md-skill-popover quickslot-assign"
  }, /*#__PURE__*/React.createElement("div", { className: "md-quickslot-popover-title" }, `เลือกไอเทม/สกิลสำหรับช่อง ${assignSlotIndex + 1}`), /*#__PURE__*/React.createElement("div", {
    className: "md-quickslot-popover-list"
  }, skills.map(s => /*#__PURE__*/React.createElement("button", {
    key: `sk-${s.key}`,
    className: "md-quickslot-popover-item",
    onClick: () => assignTo(assignSlotIndex, { kind: "skill", key: s.key })
  }, /*#__PURE__*/React.createElement("span", null, s.icon, " ", s.name), /*#__PURE__*/React.createElement("span", { className: "md-quickslot-popover-sub" }, "MP ", s.mp))), potionStacks.map(p => /*#__PURE__*/React.createElement("button", {
    key: `pt-${p.id}`,
    className: "md-quickslot-popover-item",
    onClick: () => assignTo(assignSlotIndex, { kind: "potion", potionId: p.id })
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, {
    item: { type: "potion", potionId: p.id },
    fallback: p.icon,
    className: "md-game-icon md-inline-item-icon",
    alt: p.name
  }), " ", p.name), /*#__PURE__*/React.createElement("span", { className: "md-quickslot-popover-sub" }, "x", p.quantity))), skills.length === 0 && potionStacks.length === 0 && /*#__PURE__*/React.createElement("div", { className: "md-sub" }, "ยังไม่มีสกิลหรือโพชั่น")), qs[assignSlotIndex] && /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee small",
    onClick: () => {
      onClearQuickSlot(assignSlotIndex);
      setAssignSlotIndex(null);
    },
    style: { boxShadow: "none", marginTop: 6 }
  }, "ล้างช่อง"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee small",
    onClick: () => setAssignSlotIndex(null),
    style: { boxShadow: "none", marginTop: 6 }
  }, "ปิด")), /*#__PURE__*/React.createElement("div", {
    className: "md-dock-side-controls"
  }, /*#__PURE__*/React.createElement("button", {
    className: `md-dock-auto ${autoRun ? "active" : ""}`,
    onClick: () => setAutoRun(a => !a)
  }, autoRun ? "⏸ AUTO" : "▶ AUTO"), /*#__PURE__*/React.createElement("div", {
    className: "md-dock-half-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-dock-mini flee",
    disabled: busy,
    title: "หลบหนีจากการต่อสู้",
    onClick: () => onAction("flee")
  }, "🏃"), /*#__PURE__*/React.createElement("button", {
    className: `md-dock-mini settings ${editSlots ? "active" : ""}`,
    title: editSlots ? "เสร็จสิ้นการตั้งค่า Quick Slot" : "ตั้งค่า Quick Slot",
    onClick: () => {
      setAssignSlotIndex(null);
      setEditSlots(v => !v);
    }
  }, editSlots ? "✓" : "⚙️"))), /*#__PURE__*/React.createElement("button", {
    className: "md-dock-attack",
    disabled: busy,
    onClick: () => {
      onAction("attack");
    }
  }, "👊"))), /*#__PURE__*/React.createElement("div", {
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
  }, "+", rewards.gold, " ", /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " gold · +", rewards.xp, " XP", rewards.diamonds ? /*#__PURE__*/React.createElement(React.Fragment, null, " · +", rewards.diamonds, " ", /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" })) : "", rewards.leveledUp ? " · Level up!" : "", rewards.unlockedNext ? " · Next stage unlocked!" : ""), rewards.isEliteBoss && /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "chests", iconKey: "equipment", fallback: "🎁", className: "md-game-icon md-inline-item-icon", alt: "Equipment chest" }), " เปิดหีบรางวัลจากบอส"), showItemBanner ? /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner",
    style: {
      background: dropItem.rarity === "mythic" ? "rgba(255,209,102,0.28)" : dropItem.rarity === "elite" ? "rgba(178,106,232,0.18)" : dropItem.rarity === "unique" ? "rgba(79,168,224,0.18)" : "rgba(156,156,168,0.15)"
    }
  }, /*#__PURE__*/React.createElement(GameIcon, { item: dropItem, fallback: SLOT_ICON[dropItem.type], className: "md-game-icon md-drop-item-icon", alt: itemDisplayName(dropItem) }), " Found ", RARITY_LABEL[dropItem.rarity], " ", itemDisplayName(dropItem), "! ", /*#__PURE__*/React.createElement(StarRating, {
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
  }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: rewards.junkDrop.type }, fallback: JUNK_INFO[rewards.junkDrop.type].icon, className: "md-game-icon md-drop-item-icon", alt: JUNK_INFO[rewards.junkDrop.type].name }), " ได้รับ ", JUNK_INFO[rewards.junkDrop.type].name, " x", rewards.junkDrop.amount) : /*#__PURE__*/React.createElement("p", {
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
  busy,
  gold,
  diamonds,
  protectionStones,
  characterName,
  quickSlots,
  unlockedSkillList,
  onAssignQuickSlot,
  onClearQuickSlot,
  onEquip,
  onUnequip,
  onSell,
  onSalvage,
  onClose
}) {
  const [selectedId, setSelectedId] = useState(null);
  const [assignSlotIndex, setAssignSlotIndex] = useState(null);
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

  const SLOT_GRID_POS = {
    helmet: { gridColumn: 2, gridRow: 1 },
    gloves: { gridColumn: 3, gridRow: 1 },
    chest: { gridColumn: 1, gridRow: 2 },
    weapon: { gridColumn: 3, gridRow: 2 },
    accessory: { gridColumn: 1, gridRow: 3 },
    boots: { gridColumn: 3, gridRow: 3 }
  };
  const renderEquipSlot = slot => {
    const it = equipped[slot];
    const selected = selectedEquippedSlot === slot;
    return /*#__PURE__*/React.createElement("button", {
      key: slot,
      type: "button",
      className: `md-equip-slot ${slot} ${it ? "filled" : "empty"} ${selected ? "selected" : ""}`,
      style: SLOT_GRID_POS[slot],
      title: it ? itemStatText(it) : "",
      onClick: () => chooseEquipped(slot)
    }, /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-icon" }, it ? /*#__PURE__*/React.createElement(GameIcon, { item: it, fallback: SLOT_ICON[slot], className: "md-game-icon md-equipped-item-icon", alt: itemDisplayName(it) }) : SLOT_ICON[slot]), /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-label" }, SLOT_LABEL[slot]), it ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-name" }, itemDisplayName(it)),
      /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-hint" }, "แตะดูรายละเอียด")
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

  const quickAssignOptions = [
    ...(unlockedSkillList || []).map(s => ({ kind: "skill", key: s.key, potionId: null, icon: s.icon, name: s.name, sub: `MP ${s.mp}` })),
    ...ownedPotionStacks(inventory).map(p => ({ kind: "potion", key: null, potionId: p.id, icon: p.icon, name: p.name, sub: `x${p.quantity}` }))
  ];
  const quickSlotVisual = entry => {
    if (!entry) return { icon: "➕", name: "ว่าง" };
    if (entry.kind === "skill") {
      const sk = (unlockedSkillList || []).find(s => s.key === entry.key);
      return sk ? { icon: sk.icon, name: sk.name } : { icon: "❓", name: "ล็อกอยู่" };
    }
    const def = getPotionDef(entry.potionId);
    return def ? { icon: def.icon, name: def.name } : { icon: "🧪", name: "Potion" };
  };

  return /*#__PURE__*/React.createElement("div", { className: "md-equip-overlay" }, /*#__PURE__*/React.createElement("div", { className: "md-equip-sheet" },
    /*#__PURE__*/React.createElement("div", { className: "md-equip-head" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("p", { className: "md-equip-head-title" }, "⚔️ Equipment & Inventory"),
        /*#__PURE__*/React.createElement("div", { className: "md-equip-head-sub" }, "แตะอุปกรณ์รอบตัวละคร หรือแตะไอเทมในกระเป๋าเพื่อเลือก · ตีบวก/เสริมพลังไปที่ร้านตีเหล็ก ⚒️")
      ),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", onClick: onClose, style: { minHeight: 38, padding: "6px 11px", boxShadow: "none" } }, "✕")
    ),
    onAssignQuickSlot && /*#__PURE__*/React.createElement("div", { className: "md-quickslot-panel" },
      /*#__PURE__*/React.createElement("div", { className: "md-quickslot-panel-label" }, "🎯 Quick Slots (ใช้ในสนามรบแบบแตะครั้งเดียว)"),
      /*#__PURE__*/React.createElement("div", { className: "md-quickslot-bar" },
        [0, 1, 2, 3].map(i => {
          const entry = (quickSlots || [])[i];
          const v = quickSlotVisual(entry);
          return /*#__PURE__*/React.createElement("button", {
            key: i,
            type: "button",
            className: `md-quickslot-btn ${entry ? "filled" : "empty"}`,
            title: v.name,
            onClick: () => setAssignSlotIndex(i)
          }, /*#__PURE__*/React.createElement("span", { className: "md-quickslot-icon" }, entry?.kind === "potion" ? /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: entry.potionId }, fallback: v.icon, className: "md-game-icon md-quickslot-item-icon", alt: v.name }) : v.icon),
             entry && /*#__PURE__*/React.createElement("span", {
               className: "md-quickslot-clear",
               onClick: e => { e.stopPropagation(); onClearQuickSlot(i); }
             }, "✕"));
        })
      ),
      assignSlotIndex !== null && /*#__PURE__*/React.createElement("div", { className: "md-quickslot-popover" },
        /*#__PURE__*/React.createElement("div", { className: "md-quickslot-popover-title" }, `เลือกไอเทม/สกิลสำหรับช่อง ${assignSlotIndex + 1}`),
        /*#__PURE__*/React.createElement("div", { className: "md-quickslot-popover-list" },
          quickAssignOptions.length === 0 && /*#__PURE__*/React.createElement("div", { className: "md-sub" }, "ยังไม่มีสกิลหรือโพชั่นให้เลือก"),
          quickAssignOptions.map((opt, idx) => /*#__PURE__*/React.createElement("button", {
            key: `${opt.kind}-${opt.key || opt.potionId}-${idx}`,
            type: "button",
            className: "md-quickslot-popover-item",
            onClick: () => {
              onAssignQuickSlot(assignSlotIndex, opt.kind === "skill" ? { kind: "skill", key: opt.key } : { kind: "potion", potionId: opt.potionId });
              setAssignSlotIndex(null);
            }
          }, /*#__PURE__*/React.createElement("span", null, opt.kind === "potion" ? /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: opt.potionId }, fallback: opt.icon, className: "md-game-icon md-inline-item-icon", alt: opt.name }) : opt.icon, " ", opt.name), /*#__PURE__*/React.createElement("span", { className: "md-quickslot-popover-sub" }, opt.sub)))
        ),
        /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", onClick: () => setAssignSlotIndex(null), style: { boxShadow: "none", marginTop: 6 } }, "ปิด")
      )
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-stage" },
      /*#__PURE__*/React.createElement("div", { className: "md-equip-grid" },
        SLOT_ORDER.filter(s => s !== "wings").map(renderEquipSlot),
        /*#__PURE__*/React.createElement("div", { key: "hero", className: "md-equip-hero" }, /*#__PURE__*/React.createElement(HeroSprite, { anim: "", equipped: equipped, label: characterName || "Adventurer" })),
        /*#__PURE__*/React.createElement("div", {
          key: "wings-slot",
          style: { gridColumn: 1, gridRow: 1 }
        }, renderEquipSlot("wings"))
      )
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-summary" },
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " ", /*#__PURE__*/React.createElement("b", null, formatNumber(gold || 0))),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, "🛡️ ", /*#__PURE__*/React.createElement("b", null, protectionStones || 0)),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: "manaOre" }, fallback: JUNK_INFO.manaOre.icon, className: "md-game-icon md-inline-item-icon", alt: JUNK_INFO.manaOre.name }), " ", /*#__PURE__*/React.createElement("b", null, junkTotal(inventory, "manaOre"))),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " ", /*#__PURE__*/React.createElement("b", null, diamonds || 0))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-item-detail" }, detailTarget ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name" }, /*#__PURE__*/React.createElement(GameIcon, { item: detailTarget, fallback: detailTarget.icon || SLOT_ICON[detailTarget.type] || "📦", className: "md-game-icon md-detail-item-icon", alt: itemDisplayName(detailTarget) }), " ", itemDisplayName(detailTarget)),
      detailTarget.type === "junk" ? /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, `วัตถุดิบขยะ · มี ${detailTarget.quantity} ชิ้น (สูงสุด 99/ช่อง) · ขายได้ ${sellPrice(detailTarget)} 🪙`) : /*#__PURE__*/React.createElement(React.Fragment, null,
        /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, RARITY_LABEL[detailTarget.rarity] || detailTarget.rarity, selectedEquipped ? " · สวมใส่อยู่" : "", " · ", itemStatText(detailTarget) || "ไม่มีค่าสเตตัส"),
        renderEmpowerSlotsReadOnly(detailTarget)
      ),
      selectedItem && detailTarget.type !== "junk" && /*#__PURE__*/React.createElement("button", {
        className: "md-btn flee small",
        disabled: busy,
        style: { marginTop: 6, minHeight: 38, fontSize: 10, width: "100%", opacity: busy ? 0.6 : 1 },
        onClick: doSalvage
      }, (() => {
        const y = salvageYield(detailTarget.rarity);
        return `♻️ แยกชิ้นส่วน (🔩${y.iron} 🔮${y.manaOre})`;
      })()),
      actionMsg && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { marginTop: 4, color: "var(--ink)" } }, actionMsg)
    ) : /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { textAlign: "center" } }, "เลือกไอเทมเพื่อดูรายละเอียดและคำสั่ง")),
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
        /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-icon" }, /*#__PURE__*/React.createElement(GameIcon, { item: it, fallback: it.icon || SLOT_ICON[it.type] || "📦", className: "md-game-icon md-inventory-item-icon", alt: itemDisplayName(it) })),
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
    /*#__PURE__*/React.createElement("div", { className: "md-item-actions" },
      /*#__PURE__*/React.createElement("button", { className: "md-btn primary", disabled: !selectedItem || selectedItem.type === "junk" || busy, onClick: doEquip }, "⚔️ สวมใส่"),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee", disabled: !selectedItem || busy, onClick: doSell }, selectedItem ? `🪙 ขาย ${sellPrice(selectedItem)}` : "🪙 ขาย"),
      /*#__PURE__*/React.createElement("button", { className: "md-btn info", disabled: !selectedEquippedSlot || busy, onClick: doUnequip }, "↩️ ถอด")
    ),
    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small md-equip-close", onClick: onClose }, "← ปิด Inventory")
  ));
}
function BlacksmithOverlay({
  equipped,
  inventory,
  busy,
  gold,
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
      title: it ? itemStatText(it) : "",
      onClick: () => chooseEquipped(slot)
    }, /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-icon" }, SLOT_ICON[slot]), /*#__PURE__*/React.createElement("div", { className: "md-equip-slot-label" }, SLOT_LABEL[slot]), it ? /*#__PURE__*/React.createElement(React.Fragment, null,
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
      /*#__PURE__*/React.createElement("div", { className: "md-blacksmith-icon" }, animState === "success" ? "✨⚒️✨" : animState === "fail" ? "💥⚒️" : "⚒️"),
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name" }, /*#__PURE__*/React.createElement(GameIcon, { item: detailTarget, fallback: SLOT_ICON[detailTarget.type] || "📦", className: "md-game-icon md-detail-item-icon", alt: itemDisplayName(detailTarget) }), " ", itemDisplayName(detailTarget)),
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, RARITY_LABEL[detailTarget.rarity] || detailTarget.rarity, selectedEquipped ? " · สวมใส่อยู่" : "", " · ", itemStatText(detailTarget) || "ไม่มีค่าสเตตัส"),
      renderEmpowerSlots(detailTarget),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6, marginTop: 6 } },
        /*#__PURE__*/React.createElement("button", {
          className: "md-btn info small",
          style: { flex: 1, minHeight: 38, fontSize: 10 },
          disabled: (detailTarget.enhanceLevel || 0) >= ENHANCE_MAX || busy,
          onClick: doEnhance
        }, (detailTarget.enhanceLevel || 0) >= ENHANCE_MAX ? "🔨 ตีบวกสูงสุดแล้ว" : (() => {
          const c = enhanceCost(detailTarget.enhanceLevel || 0);
          const haveIron = junkTotal(inventory, "iron");
          return [`🔨 ตีบวก +${(detailTarget.enhanceLevel || 0) + 1} (${enhanceSuccessRate(detailTarget.enhanceLevel || 0)}% · `,
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
          const c = empowerCost((detailTarget.empowerSlots || []).findIndex(s => !s));
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
        const c = rerollCost(filled.length, lockedCount);
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

// ---------- Phase 4: Crafting ----------
// Talks to the server directly (like RaidScreen/MailboxScreen) rather than mutating local
// state itself — the worker is the one that validates+consumes materials/gold, so this
// component only ever applies what the server confirms actually happened.
function CraftingOverlay({
  serverUrl,
  cred,
  characterId,
  inventory,
  gold,
  floor,
  busy,
  onCrafted,
  onClose
}) {
  const [craftingId, setCraftingId] = useState(null);
  const [msg, setMsg] = useState("");

  const doCraft = recipe => {
    if (craftingId || busy) return;
    setCraftingId(recipe.recipeId);
    setMsg("");
    cloudCraftItem(serverUrl || DEFAULT_SERVER_URL, cred.id, cred.password, characterId, recipe.recipeId)
      .then(res => {
        if (!res || res.error) {
          const errMsg = res && res.error === "insufficient_gold" ? `ทองไม่พอ (ต้องการ 🪙${res.need})`
            : res && res.error === "insufficient_materials" ? `${(JUNK_INFO[res.junkId] || {}).icon || ""} ${(JUNK_INFO[res.junkId] || {}).name || res.junkId} ไม่พอ (มี ${res.have}/${res.need})`
            : "ประดิษฐ์ไม่สำเร็จ";
          setMsg(errMsg);
          return;
        }
        onCrafted(res);
        setMsg(`✨ ประดิษฐ์สำเร็จ! ได้รับ ${res.item && res.item.name}`);
      })
      .catch(() => setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"))
      .finally(() => setCraftingId(null));
  };

  return /*#__PURE__*/React.createElement("div", { className: "md-equip-overlay" }, /*#__PURE__*/React.createElement("div", { className: "md-equip-sheet" },
    /*#__PURE__*/React.createElement("div", { className: "md-equip-head" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("p", { className: "md-equip-head-title" }, "🛠️ ประดิษฐ์ไอเทม"),
        /*#__PURE__*/React.createElement("div", { className: "md-equip-head-sub" }, "ใช้แบบร่าง + วัตถุดิบจากบอส Raid เพื่อประดิษฐ์ชุด Azure (สเกลสเตตัสตาม floor สูงสุด ", floor || 1, ")")
      ),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", onClick: onClose, style: { minHeight: 38, padding: "6px 11px", boxShadow: "none" } }, "✕")
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-summary", style: { marginTop: 2, marginBottom: 8 } },
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " ", formatNumber(gold)),
      // Union of every non-gold/non-scroll material across ALL loaded recipes — was
      // hardcoded to bossHorn/bossHide (Azure-only) before; now reads whatever the current
      // recipe list actually needs, so a future set with different materials shows up here
      // automatically with no code change.
      ...Array.from(new Set(CRAFTING_RECIPES.flatMap(r => Object.keys(r.materials)))).filter(k => k !== "gold" && k.indexOf("recipe_") !== 0).map(key =>
        /*#__PURE__*/React.createElement("span", { key: key, className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: key }, fallback: (JUNK_INFO[key] || {}).icon || "📦", className: "md-game-icon md-inline-item-icon", alt: (JUNK_INFO[key] || {}).name || key }), " ", junkTotal(inventory, key))
      )
    ),
    CRAFTING_RECIPES.map(recipe => {
      const afford = canAffordRecipe(recipe, inventory, gold);
      const preview = craftPreviewStats(recipe, floor);
      const statText = [preview.atk ? `⚔️${preview.atk}` : "", preview.def ? `🛡️${preview.def}` : "", preview.dodgeChance ? `💨${preview.dodgeChance}%` : ""].filter(Boolean).join(" ");
      return /*#__PURE__*/React.createElement("div", { key: recipe.recipeId, className: "md-card", style: { marginBottom: 8, padding: 10 } },
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          /*#__PURE__*/React.createElement("div", null,
            /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name", style: { fontSize: 13 } }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: recipe.type, setId: "azure" }, fallback: craftIcon(recipe), className: "md-game-icon md-detail-item-icon", alt: recipe.name }), " ", recipe.name),
            /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { fontSize: 11 } }, statText)
          ),
          /*#__PURE__*/React.createElement("button", {
            type: "button",
            className: "md-btn primary small",
            disabled: !afford.ok || !!craftingId || busy,
            onClick: () => doCraft(recipe)
          }, craftingId === recipe.recipeId ? "..." : "ประดิษฐ์")
        ),
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 } },
          Object.keys(recipe.materials).map(key => {
            if (key === "gold") {
              return /*#__PURE__*/React.createElement("span", { key: key, className: "md-equip-stat-chip", style: !afford.goldOk ? { color: "#e05555" } : undefined }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " ", recipe.materials.gold);
            }
            const missing = afford.missing.find(m => m.junkId === key);
            const info = JUNK_INFO[key] || {};
            const have = craftMaterialTotal(inventory, key);
            return /*#__PURE__*/React.createElement("span", { key: key, className: "md-equip-stat-chip", style: missing ? { color: "#e05555" } : undefined }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: key }, fallback: info.icon || "📦", className: "md-game-icon md-inline-item-icon", alt: info.name || key }), " ", have, "/", recipe.materials[key]);
          })
        )
      );
    }),
    msg && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { marginTop: 6, textAlign: "center", color: "var(--ink)" } }, msg),
    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small md-equip-close", onClick: onClose }, "← ปิดร้านประดิษฐ์")
  ));
}
