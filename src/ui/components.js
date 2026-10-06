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
  equipped,
  arena = null
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: `md-status${arena ? " md-status-arena" : ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-status-chip"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-chip-icon"
  }, "🏅"), "Lv", player?.level ?? save.character.level), /*#__PURE__*/React.createElement("div", {
    className: "md-status-resources"
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
  }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: "protectionStone" }, fallback: "🛡️", className: "md-game-icon md-resource-icon", alt: "Protection Stone" }), formatNumber(save.protectionStones || 0)), arena && /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", { className: "md-status-chip md-arena-global-chip" },
      /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "arenaCoin", fallback: "🪙", className: "md-game-icon md-resource-icon", alt: "Arena Coin" }),
      formatNumber(arena.arenaCoin || 0)),
    /*#__PURE__*/React.createElement("div", { className: "md-status-chip md-arena-global-chip" },
      /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "arenaTicket", fallback: "🎟️", className: "md-game-icon md-resource-icon", alt: "Arena Ticket" }),
      `${Number(arena.tickets) || 0}/${Number(arena.ticketsMax) || 10}`))));
}
// Shared "← Back" action used by sub-screens (Raid, Arena, error states, etc). Pass `label`
// to override the text (e.g. a warning that in-progress state will be left as-is).
function BackButton({ onClick, label = "← Back", className = "" }) {
  return /*#__PURE__*/React.createElement("button", {
    className: `md-btn flee wide small${className ? ` ${className}` : ""}`,
    onClick
  }, label);
}
function LoginScreen({ cred, setCred, error, busy, departing, rememberLogin, onRememberLogin, onLogin, onRegister, onForgotPassword, registrationRecovery, onFinishRegistration, passwordResetRecovery, onClearPasswordResetRecovery }) {
  const e = React.createElement;
  const [registerOpen, setRegisterOpen] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ id: "", password: "", confirmPassword: "" });
  const [forgotForm, setForgotForm] = useState({ id: cred.id || "", recoveryCode: "", newPassword: "", confirmPassword: "" });
  const [modalError, setModalError] = useState("");
  const copyCode = code => navigator.clipboard?.writeText(code).catch(() => {});
  const field = (label, type, value, update, autoComplete, selectOnFocus = false) => e(React.Fragment, null,
    e("p", { className: "md-field-label" }, label),
    e("input", {
      className: "md-field",
      type: type || "text",
      value,
      autoComplete,
      onChange: event => update(event.target.value),
      onFocus: selectOnFocus ? event => event.currentTarget.select() : undefined
    })
  );
  const recoveryPanel = (code, done) => e("div", { className: "md-auth-sheet-overlay" }, e("section", { className: "md-card md-auth-sheet", role: "dialog", "aria-modal": "true" },
    e("h2", { className: "md-title" }, "บันทึก Recovery Code"),
    e("p", { className: "md-sub" }, "โค้ดนี้จะแสดงเพียงครั้งเดียว โปรดเก็บไว้ในที่ปลอดภัย"),
    e("code", { className: "md-recovery-code" }, code),
    e("button", { className: "md-btn info wide", onClick: () => copyCode(code) }, "คัดลอก"),
    e("button", { className: "md-btn primary wide", onClick: done }, "เก็บโค้ดแล้ว")
  ));
  const submitRegister = async () => {
    setModalError("");
    if (!/^[A-Za-z0-9_]{4,20}$/.test(registerForm.id)) return setModalError("Player ID ต้องยาว 4–20 ตัว และใช้ A-Z, a-z, 0-9, _ เท่านั้น");
    if (registerForm.password.length < 4 || registerForm.password.length > 32) return setModalError("Password ต้องยาว 4–32 ตัว");
    if (!/^[A-Za-z0-9]+$/.test(registerForm.password)) return setModalError("Password ใช้ได้เฉพาะ A-Z, a-z และ 0-9 เท่านั้น ห้ามเว้นวรรคหรือใช้อักขระพิเศษ");
    if (registerForm.password !== registerForm.confirmPassword) return setModalError("Confirm Password ไม่ตรงกัน");
    const result = await onRegister(registerForm);
    if (!result?.ok) {
      const registerErrorText = {
        invalid_player_id: "Player ID ต้องยาว 4–20 ตัว และใช้ A-Z, a-z, 0-9, _ เท่านั้น",
        invalid_password_length: "Password ต้องยาว 4–32 ตัว",
        invalid_password_characters: "Password ใช้ได้เฉพาะ A-Z, a-z และ 0-9 เท่านั้น ห้ามเว้นวรรคหรือใช้อักขระพิเศษ",
        password_mismatch: "Confirm Password ไม่ตรงกัน",
        registration_unavailable: "สร้างบัญชีไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองใหม่",
        rate_limited: "สมัครบัญชีถี่เกินไปจากเครือข่ายนี้ กรุณาลองใหม่ภายหลัง",
      };
      setModalError(registerErrorText[result?.error] || "สร้างบัญชีไม่สำเร็จ กรุณาลองใหม่");
    }
  };
  const submitForgot = async () => {
    setModalError("");
    if (forgotForm.newPassword.length < 4 || forgotForm.newPassword.length > 32) return setModalError("Password ใหม่ต้องยาว 4–32 ตัว");
    if (!/^[A-Za-z0-9]+$/.test(forgotForm.newPassword)) return setModalError("Password ใช้ได้เฉพาะ A-Z, a-z และ 0-9 เท่านั้น ห้ามเว้นวรรคหรือใช้อักขระพิเศษ");
    if (forgotForm.newPassword !== forgotForm.confirmPassword) return setModalError("Confirm Password ไม่ตรงกัน");
    const result = await onForgotPassword(forgotForm);
    if (!result.ok) {
      const forgotErrorText = {
        invalid_recovery: "Player ID หรือ Recovery Code ไม่ถูกต้อง",
        invalid_password_length: "Password ใหม่ต้องยาว 4–32 ตัว",
        invalid_password_characters: "Password ใช้ได้เฉพาะ A-Z, a-z และ 0-9 เท่านั้น ห้ามเว้นวรรคหรือใช้อักขระพิเศษ",
        password_mismatch: "Confirm Password ไม่ตรงกัน"
      };
      setModalError(forgotErrorText[result.error] || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่");
    }
  };
  return e("div", { className: `md-login-wrap${departing ? " is-departing" : ""}` },
    e("div", { className: "md-menu-title md-login-brand" }, e("img", { className: "md-login-emblem", src: "icons/icon-512.png", alt: "ThornieDungeons" }), e("h1", null, "ThornieDungeons"), e("p", null, "เข้าสู่ดันเจี้ยนของคุณ")),
    e("form", {
      className: "md-card md-login-card",
      onSubmit: event => {
        event.preventDefault();
        if (!busy) onLogin();
      }
    },
      field("Player ID", "text", cred.id, id => setCred(current => ({ ...current, id })), "username"),
      field("Password", "password", cred.password, password => setCred(current => ({ ...current, password })), "current-password", true),
      e("label", { className: "md-remember-password" }, e("input", { type: "checkbox", checked: rememberLogin, disabled: busy, onChange: event => onRememberLogin(event.target.checked) }), e("span", { className: "md-remember-check", "aria-hidden": "true" }), e("span", null, "จดจำการเข้าสู่ระบบ")),
      error && e("p", { className: "md-auth-error" }, error),
      e("div", { className: "md-btn-row", style: { marginTop: 12 } }, e("button", { type: "submit", className: "md-btn primary", disabled: busy }, busy ? "..." : "เข้าสู่ระบบ"), e("button", { type: "button", className: "md-btn info", disabled: busy, onClick: () => { setModalError(""); setRegisterForm({ id: cred.id || "", password: "", confirmPassword: "" }); setRegisterOpen(true); } }, "สร้างบัญชีใหม่")),
      e("button", { type: "button", className: "md-auth-link", onClick: () => { setModalError(""); setForgotForm(form => ({ ...form, id: cred.id || form.id })); setForgotOpen(true); } }, "ลืมรหัสผ่าน?"),
      e("p", { className: "md-hint" }, "ใช้บัญชีเดิมเพื่อโหลดเซฟจากทุกอุปกรณ์")
    ),
    registerOpen && !registrationRecovery && e("div", { className: "md-auth-sheet-overlay" }, e("section", { className: "md-card md-auth-sheet", role: "dialog", "aria-modal": "true" }, e("h2", { className: "md-title" }, "สร้างบัญชีใหม่"), field("Player ID", "text", registerForm.id, id => setRegisterForm(form => ({ ...form, id })), "username"), field("Password", "password", registerForm.password, password => setRegisterForm(form => ({ ...form, password })), "new-password", true), field("Confirm Password", "password", registerForm.confirmPassword, confirmPassword => setRegisterForm(form => ({ ...form, confirmPassword })), "new-password", true), modalError && e("p", { className: "md-auth-error" }, modalError), e("div", { className: "md-btn-row" }, e("button", { className: "md-btn flee", disabled: busy, onClick: () => setRegisterOpen(false) }, "ยกเลิก"), e("button", { className: "md-btn primary", disabled: busy, onClick: submitRegister }, busy ? "..." : "สร้างบัญชี")))),
    registrationRecovery && recoveryPanel(registrationRecovery.code, onFinishRegistration),
    forgotOpen && !passwordResetRecovery && e("div", { className: "md-auth-sheet-overlay" }, e("section", { className: "md-card md-auth-sheet", role: "dialog", "aria-modal": "true" }, e("h2", { className: "md-title" }, "ลืมรหัสผ่าน"), field("Player ID", "text", forgotForm.id, id => setForgotForm(form => ({ ...form, id })), "username"), field("Recovery Code", "text", forgotForm.recoveryCode, recoveryCode => setForgotForm(form => ({ ...form, recoveryCode })), "one-time-code"), field("New Password", "password", forgotForm.newPassword, newPassword => setForgotForm(form => ({ ...form, newPassword })), "new-password", true), field("Confirm Password", "password", forgotForm.confirmPassword, confirmPassword => setForgotForm(form => ({ ...form, confirmPassword })), "new-password", true), modalError && e("p", { className: "md-auth-error" }, modalError), e("div", { className: "md-btn-row" }, e("button", { className: "md-btn flee", disabled: busy, onClick: () => setForgotOpen(false) }, "ยกเลิก"), e("button", { className: "md-btn primary", disabled: busy, onClick: submitForgot }, busy ? "..." : "รีเซ็ตรหัสผ่าน")))),
    passwordResetRecovery && recoveryPanel(passwordResetRecovery, () => { onClearPasswordResetRecovery(); setForgotOpen(false); })
  );
}
function AccountSettingsOverlay({ serverUrl, playerId, audioSettings, onBgmVolumeChange, onBgmMuteChange, onSfxVolumeChange, onSfxMuteChange, recoveryConfigured, onRecoveryConfigured, onRequireLogin, onSwitchCharacter, onLogout, onClose }) {
  const e = React.createElement;
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [changeCurrentPassword, setChangeCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const copyCode = () => navigator.clipboard?.writeText(recoveryCode).catch(() => {});
  const soundRow = (label, volume, muted, onVolumeChange, onMuteChange) => e("div", { className: "md-sound-row" },
    e("div", { className: "md-sound-row-head" }, e("strong", null, label), e("span", null, `${Math.round(volume * 100)}%`)),
    e("div", { className: "md-sound-row-controls" },
      e("input", {
        className: "md-sound-slider",
        type: "range",
        min: 0,
        max: 100,
        step: 1,
        value: Math.round(volume * 100),
        onChange: event => onVolumeChange(Number(event.target.value) / 100),
        "aria-label": `${label} volume`
      }),
      e("label", { className: "md-sound-mute" },
        e("input", { type: "checkbox", checked: muted, onChange: event => onMuteChange(event.target.checked) }),
        e("span", null, "Mute")
      )
    )
  );
  const generateRecovery = async () => {
    if (!recoveryPassword) return setMessage("กรุณากรอกรหัสผ่านปัจจุบัน");
    setBusy(true); setMessage("");
    const result = await cloudCreateRecoveryCode(serverUrl || DEFAULT_SERVER_URL, recoveryPassword);
    setBusy(false);
    if (!result?.ok) return setMessage(result?.error === "invalid_credentials" ? "รหัสผ่านปัจจุบันไม่ถูกต้อง" : "สร้าง Recovery Code ไม่สำเร็จ");
    setRecoveryCode(result.recoveryCode);
    setRecoveryPassword("");
    onRecoveryConfigured(true);
  };
  const changePassword = async () => {
    if (newPassword.length < 4 || newPassword.length > 32) return setMessage("Password ใหม่ต้องยาว 4–32 ตัว");
    if (!/^[A-Za-z0-9]+$/.test(newPassword)) return setMessage("Password ใช้ได้เฉพาะ A-Z, a-z และ 0-9 เท่านั้น ห้ามเว้นวรรคหรือใช้อักขระพิเศษ");
    if (newPassword !== confirmPassword) return setMessage("Confirm Password ไม่ตรงกัน");
    setBusy(true); setMessage("");
    const result = await cloudChangePassword(serverUrl || DEFAULT_SERVER_URL, changeCurrentPassword, newPassword, confirmPassword);
    setBusy(false);
    if (!result?.ok) {
      const changeErrorText = {
        invalid_credentials: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
        invalid_password_length: "Password ใหม่ต้องยาว 4–32 ตัว",
        invalid_password_characters: "Password ใช้ได้เฉพาะ A-Z, a-z และ 0-9 เท่านั้น ห้ามเว้นวรรคหรือใช้อักขระพิเศษ",
        password_mismatch: "Confirm Password ไม่ตรงกัน"
      };
      return setMessage(changeErrorText[result?.error] || "เปลี่ยน Password ไม่สำเร็จ");
    }
    onRequireLogin("เปลี่ยน Password สำเร็จ กรุณาเข้าสู่ระบบใหม่");
  };
  const settingsSection = (title, subtitle, children) => e("section", { className: "md-settings-section" },
    e("div", { className: "md-settings-section-head" },
      e("h3", { className: "md-title" }, title),
      subtitle ? e("p", { className: "md-sub" }, subtitle) : null
    ),
    children
  );
  return ReactDOM.createPortal(e("div", { className: "md-auth-sheet-overlay" }, e("section", { className: "md-card md-auth-sheet md-account-sheet", role: "dialog", "aria-modal": "true" },
    e("div", { className: "md-settings-header" },
      e("div", { className: "md-settings-header-copy" },
        e("h2", { className: "md-title" }, "Settings"),
        e("p", { className: "md-sub" }, "ACCOUNT & SECURITY"),
        e("p", { className: "md-sub md-settings-player-id" }, `Player ID: ${playerId}`)
      ),
      e("button", { className: "md-btn flee small md-settings-close", onClick: onClose, "aria-label": "Close settings" }, "✕")
    ),
    settingsSection("Sound", "ปรับเสียงของอุปกรณ์นี้", e("div", { className: "md-settings-sound" },
      soundRow("BGM", audioSettings?.bgmVolume ?? 0.5, audioSettings?.bgmMuted === true, onBgmVolumeChange, onBgmMuteChange),
      soundRow("SFX", audioSettings?.sfxVolume ?? 0.5, audioSettings?.sfxMuted === true, onSfxVolumeChange, onSfxMuteChange)
    )),
    settingsSection("Recovery Code", recoveryConfigured ? "ตั้งค่า Recovery Code แล้ว" : "ยังไม่ได้ตั้งค่า Recovery Code", recoveryCode
      ? e("div", { className: "md-settings-stack" },
          e("p", { className: "md-sub" }, "Recovery Code ใหม่นี้จะแสดงเพียงครั้งเดียว"),
          e("code", { className: "md-recovery-code" }, recoveryCode),
          e("button", { className: "md-btn info wide", onClick: copyCode }, "คัดลอก")
        )
      : e("div", { className: "md-settings-stack" },
          e("input", { className: "md-field", type: "password", placeholder: "รหัสผ่านปัจจุบัน", value: recoveryPassword, onChange: event => setRecoveryPassword(event.target.value), autoComplete: "current-password" }),
          e("button", { className: "md-btn info wide", disabled: busy, onClick: generateRecovery }, recoveryConfigured ? "สร้าง Recovery Code ใหม่" : "สร้าง Recovery Code")
        )
    ),
    settingsSection("Change Password", "เปลี่ยนรหัสผ่านของบัญชีนี้", e("div", { className: "md-settings-stack" },
      e("input", { className: "md-field", type: "password", placeholder: "รหัสผ่านปัจจุบัน", value: changeCurrentPassword, onChange: event => setChangeCurrentPassword(event.target.value), autoComplete: "current-password" }),
      e("input", { className: "md-field", type: "password", placeholder: "Password ใหม่", value: newPassword, onChange: event => setNewPassword(event.target.value), onFocus: event => event.currentTarget.select(), autoComplete: "new-password" }),
      e("input", { className: "md-field", type: "password", placeholder: "ยืนยัน Password ใหม่", value: confirmPassword, onChange: event => setConfirmPassword(event.target.value), onFocus: event => event.currentTarget.select(), autoComplete: "new-password" }),
      e("button", { className: "md-btn primary wide", disabled: busy, onClick: changePassword }, "เปลี่ยน Password")
    )),
    message && e("p", { className: "md-auth-error md-settings-message" }, message),
    settingsSection("Account", "จัดการตัวละครและเซสชัน", e("div", { className: "md-settings-actions" },
      e("button", { className: "md-btn info wide", disabled: busy, onClick: onSwitchCharacter }, "เปลี่ยนตัวละคร"),
      e("button", { className: "md-btn flee wide", disabled: busy, onClick: onLogout }, "ออกจากระบบ")
    ))
  )), document.body);
}
function GameDock({
  onCharacter,
  onOpenInv,
  onPets,
  activeKey,
  onSettings,
  onSave,
  onFriend,
  onChat,
  onGuild,
  onMainHub
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [saveFlash, setSaveFlash] = useState("");
  const handleSave = async () => {
    if (!onSave || saveFlash === "saving") return;
    setSaveFlash("saving");
    const ok = await onSave();
    setSaveFlash(ok ? "saved" : "failed");
    setTimeout(() => setSaveFlash(""), 1600);
  };
  const openSettings = () => {
    setMoreOpen(false);
    onSettings?.();
  };
  const openFriend = () => {
    setMoreOpen(false);
    onFriend?.();
  };
  const openChat = () => {
    setMoreOpen(false);
    onChat?.();
  };
  const openGuild = () => {
    setMoreOpen(false);
    onGuild?.();
  };
  const openMainHub = () => {
    setMoreOpen(false);
    onMainHub?.();
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, moreOpen && /*#__PURE__*/React.createElement("div", {
    className: "md-hub-more-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hub-more-head"
  }, /*#__PURE__*/React.createElement("strong", null, "เมนูเพิ่มเติม"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setMoreOpen(false),
    "aria-label": "ปิดเมนู"
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    className: "md-hub-more-grid"
  }, /*#__PURE__*/React.createElement("button", { type: "button", onClick: openSettings }, "⚙️", /*#__PURE__*/React.createElement("span", null, "Settings")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: handleSave, disabled: saveFlash === "saving" }, saveFlash === "saved" ? "✅" : saveFlash === "failed" ? "⚠️" : "💾", /*#__PURE__*/React.createElement("span", null, saveFlash === "saving" ? "Saving…" : saveFlash === "saved" ? "Saved" : saveFlash === "failed" ? "Retry" : "Save")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: openFriend }, "👥", /*#__PURE__*/React.createElement("span", null, "Friend")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: openChat }, "💬", /*#__PURE__*/React.createElement("span", null, "Chat")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: openGuild }, "🏰", /*#__PURE__*/React.createElement("span", null, "Guild")), /*#__PURE__*/React.createElement("button", { type: "button", onClick: openMainHub }, "🏠", /*#__PURE__*/React.createElement("span", null, "กลับหน้าหลัก")))), /*#__PURE__*/React.createElement("nav", {
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
    className: activeKey === "inventory" ? "active" : "",
    onClick: onOpenInv
  }, /*#__PURE__*/React.createElement("img", {
    src: "ui/hub-icons/bag.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", null, "กระเป๋า")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: activeKey === "pets" ? "active" : "",
    onClick: onPets
  }, /*#__PURE__*/React.createElement("img", {
    src: "ui/hub-icons/pet.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", null, "สัตว์เลี้ยง")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: moreOpen ? "active" : "",
    onClick: () => setMoreOpen(open => !open)
  }, /*#__PURE__*/React.createElement("img", {
    src: "ui/hub-icons/more.svg",
    alt: ""
  }), /*#__PURE__*/React.createElement("span", null, "เพิ่มเติม"))));
}

// Renders the icon+amount chips for a daily-login reward (gold/diamonds/junk stacks/a
// resolved Azure item, or "สุ่ม 1 ชิ้น" placeholder for the not-yet-claimed day-7 preview).
// Shared between the preview (before claiming) and the result (after claiming) views.
function dailyRewardIcons(reward, prefix) {
  const out = [];
  if (reward.gold) out.push(/*#__PURE__*/React.createElement("span", { key: "gold" }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), ` ${prefix}${reward.gold} `));
  if (reward.diamonds) out.push(/*#__PURE__*/React.createElement("span", { key: "diamonds" }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), ` ${prefix}${reward.diamonds} `));
  (reward.junk || []).forEach(j => out.push(/*#__PURE__*/React.createElement("span", { key: `junk-${j.junkId}` }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: j.junkId }, fallback: (JUNK_INFO[j.junkId] || {}).icon || "📦", className: "md-game-icon md-inline-item-icon", alt: (JUNK_INFO[j.junkId] || {}).name || j.junkId }), ` ${prefix}${j.quantity} `)));
  (reward.items || []).forEach((it, i) => out.push(/*#__PURE__*/React.createElement("span", { key: `item-${i}` }, "🔷 ", it.name)));
  if (reward.azureRandom && !(reward.items && reward.items.length)) out.push(/*#__PURE__*/React.createElement("span", { key: "azure-preview" }, "🔷 ไอเทมชุด Azure (สุ่ม 1 ชิ้น)"));
  return out;
}
// Mirrors workers/thornie-dungeons-api.js's DAILY_LOGIN_REWARDS table, purely so the calendar
// preview below can show what every day gives — the server remains the sole authority on what
// actually gets granted (this table is never used to compute a real payout, only to render this
// preview). If the server's table ever changes, update this to match or the preview goes stale.
const DAILY_LOGIN_REWARDS_PREVIEW = [
  { day: 1, gold: 5000 },
  { day: 2, diamonds: 150 },
  { day: 3, junk: [{ junkId: "manaOre", quantity: 10 }, { junkId: "iron", quantity: 10 }] },
  { day: 4, diamonds: 350 },
  { day: 5, junk: [{ junkId: "bossHide", quantity: 3 }, { junkId: "bossHorn", quantity: 3 }] },
  { day: 6, diamonds: 550 },
  { day: 7, azureRandom: true }
];
// Maps a raw (ever-increasing) login streak count onto its 1-7 position within the repeating
// weekly cycle — e.g. streak 10 -> day 3 of the *second* lap.
function dailyCyclePosition(streak) {
  return ((Math.max(1, streak) - 1) % DAILY_LOGIN_REWARDS_PREVIEW.length) + 1;
}
// Reset boundary matches the server exactly (workers/thornie-dungeons-api.js's
// todayDateKey/yesterdayDateKey both key off UTC calendar dates) — the countdown must count
// down to UTC midnight, not the player's local midnight, or it'll drift out of sync with when
// canClaimDaily actually flips true server-side.
function msUntilNextUtcMidnight() {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0);
  return next - now.getTime();
}
function formatCountdown(ms) {
  const pad = n => String(n).padStart(2, "0");
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  return `${pad(Math.floor(totalSec / 3600))}:${pad(Math.floor(totalSec % 3600 / 60))}:${pad(totalSec % 60)}`;
}
function DailyLoginToast({
  open,
  onClose,
  dailyLogin,
  dailyLoginClaimResult,
  dailyPreview,
  canClaimDaily,
  onClaimDailyLogin
}) {
  // Hooks must run unconditionally on every render (before the `if (!open) return null` below),
  // or React's hook order breaks the moment `open` toggles — this live-ticking countdown only
  // needs to actually run while the modal is open and today's reward is already claimed.
  const [countdown, setCountdown] = useState(() => formatCountdown(msUntilNextUtcMidnight()));
  useEffect(() => {
    if (!open || canClaimDaily) return;
    const tick = () => setCountdown(formatCountdown(msUntilNextUtcMidnight()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, canClaimDaily]);
  if (!open) return null;
  const loginStreak = (dailyLogin && dailyLogin.state && dailyLogin.state.loginStreak) || 0;
  // A streak that just reset to day 1 (missed a day) means nothing in this fresh lap has been
  // claimed yet, even though the stale loginStreak count from the old streak is still > 0.
  const streakJustReset = canClaimDaily && dailyPreview.streak === 1 && loginStreak > 0;
  const claimedCyclePos = streakJustReset ? 0 : loginStreak > 0 ? dailyCyclePosition(loginStreak) : 0;
  const claimableCyclePos = canClaimDaily ? dailyCyclePosition(dailyPreview.streak) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "md-daily-toast-overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-daily-toast-card md-daily-toast-card-wide",
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("button", { className: "md-daily-toast-close", onClick: onClose, "aria-label": "ปิด" }, "✕"),
  /*#__PURE__*/React.createElement("h3", { className: "md-title" }, "🎁 รางวัลรายวัน"),
  dailyLoginClaimResult ? /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("p", { className: "md-sub" }, `รับแล้ว! Day ${dailyLoginClaimResult.streak}`),
    /*#__PURE__*/React.createElement("p", { className: "md-sub" }, dailyRewardIcons(dailyLoginClaimResult.reward, "+"))
  ) : /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("p", { className: "md-sub" }, `Streak ปัจจุบัน: ${loginStreak} วัน`),
    /*#__PURE__*/React.createElement("p", { className: "md-sub" }, `วันนี้ (Day ${dailyPreview.streak}) จะได้รับ: `, dailyRewardIcons(dailyPreview.reward, "")),
    canClaimDaily ? /*#__PURE__*/React.createElement("button", {
      className: "md-btn primary wide",
      onClick: onClaimDailyLogin
    }, "รับรางวัล") : /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("p", { className: "md-sub", style: { color: "var(--gold)" }, margin: 0 }, "รับไปแล้ววันนี้"),
      /*#__PURE__*/React.createElement("p", { className: "md-daily-countdown" }, "รอบถัดไปในอีก ", /*#__PURE__*/React.createElement("span", { className: "md-daily-countdown-time" }, countdown))
    )
  ),
  /*#__PURE__*/React.createElement("div", { className: "md-daily-calendar" }, DAILY_LOGIN_REWARDS_PREVIEW.map(r => {
    const isClaimed = claimedCyclePos >= r.day;
    const isClaimable = claimableCyclePos === r.day;
    const status = isClaimed ? "claimed" : isClaimable ? "claimable" : "locked";
    return /*#__PURE__*/React.createElement("div", {
      key: r.day,
      className: `md-daily-day md-daily-day-${status}`
    },
    /*#__PURE__*/React.createElement("div", { className: "md-daily-day-num" }, "Day ", r.day),
    /*#__PURE__*/React.createElement("div", { className: "md-daily-day-reward" }, dailyRewardIcons(r, "")),
    /*#__PURE__*/React.createElement("div", { className: "md-daily-day-badge" }, isClaimed ? "✅" : isClaimable ? "🎁" : "🔒"));
  })),
  /*#__PURE__*/React.createElement("p", { className: "md-daily-toast-hint" }, "แตะที่ใดก็ได้เพื่อปิด")));
}
function GlobalCurrencyBar({ save, arena = null, className = "" }) {
  const e = React.createElement;
  const [selected, setSelected] = React.useState(null);
  const currencies = [
    { key: "gold", name: "Gold", value: formatNumber(save.gold), icon: e(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-resource-icon", alt: "" }), detail: "สกุลเงินหลักสำหรับร้านค้า การตีบวก และระบบที่ระบุราคาเป็น Gold" },
    { key: "diamond", name: "Diamonds", value: formatNumber(save.diamonds || 0), icon: e(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-resource-icon", alt: "" }), detail: "สกุลเงินพรีเมียม ใช้เฉพาะเมื่อหน้าจอยืนยันราคาและการทำรายการอย่างชัดเจน" },
    { key: "protectionStone", name: "Protection Stones", value: formatNumber(save.protectionStones || 0), icon: e(GameIcon, { item: { type: "junk", junkId: "protectionStone" }, fallback: "🛡️", className: "md-game-icon md-resource-icon", alt: "" }), detail: "วัตถุดิบป้องกันความเสียหายตามกติกาของระบบ Enhancement" },
    ...(arena ? [
      { key: "arenaCoin", name: "Arena Coin", value: formatNumber(arena.arenaCoin || 0), icon: e(GameIcon, { category: "currency", iconKey: "arenaCoin", fallback: "🪙", className: "md-game-icon md-resource-icon", alt: "" }), detail: "รางวัล Arena ที่คำนวณและยืนยันโดยเซิร์ฟเวอร์" },
      { key: "arenaTicket", name: "Arena Tickets", value: `${Number(arena.tickets) || 0}/${Number(arena.ticketsMax) || 10}`, icon: e(GameIcon, { category: "currency", iconKey: "arenaTicket", fallback: "🎟️", className: "md-game-icon md-resource-icon", alt: "" }), detail: "ใช้เมื่อ Arena match ผ่านการเตรียม presentation และถูก activate โดยเซิร์ฟเวอร์แล้ว" }
    ] : [])
  ];
  const popup = selected && e("div", { className: "md-currency-overlay", role: "presentation", onClick: () => setSelected(null) },
    e("section", { className: "md-currency-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "md-currency-title", onClick: event => event.stopPropagation() },
      e("button", { type: "button", className: "md-currency-close", onClick: () => setSelected(null), "aria-label": "ปิดรายละเอียดสกุลเงิน" }, "×"),
      e("div", { className: "md-currency-detail-icon" }, selected.icon),
      e("h2", { id: "md-currency-title" }, selected.name),
      e("strong", null, selected.value),
      e("p", null, selected.detail),
      e("small", null, "ยอดที่แสดงมาจากสถานะเกมปัจจุบัน ระบบนี้ไม่แก้ไขยอดหรือสิทธิ์การให้รางวัล")));
  return e(React.Fragment, null,
    e("div", {
      className: `md-hub-resources${arena ? " with-arena" : ""}${className ? ` ${className}` : ""}`,
      "aria-label": "สกุลเงินของผู้เล่น"
    }, currencies.map(currency => e("button", {
      type: "button",
      key: currency.key,
      className: currency.key.startsWith("arena") ? "md-arena-global-resource" : "",
      onClick: () => setSelected(currency),
      "aria-label": `${currency.name} ${currency.value} — ดูรายละเอียด`
    }, currency.icon, " ", e("b", null, currency.value)))),
    popup && ReactDOM.createPortal(popup, document.body)
  );
}

function HubScreen({
  save,
  cp,
  arenaHud,
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
  onAccountSettings,
  onFriend,
  onChat,
  onGuild,
  dailyLogin,
  dailyLoginClaimResult,
  onClaimDailyLogin,
  onClearDailyLoginResult
}) {
  const [dailyModalOpen, setDailyModalOpen] = useState(false);
  const canClaimDaily = dailyLogin.canClaim;
  const dailyPreview = dailyLogin.preview || { streak: 1, reward: {} };
  React.useEffect(() => {
    if (dailyLoginClaimResult) setDailyModalOpen(true);
  }, [dailyLoginClaimResult]);
  const openDaily = () => {
    setDailyModalOpen(true);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("main", {
    className: "md-hub-shell"
  }, /*#__PURE__*/React.createElement(GlobalCurrencyBar, { save, arena: arenaHud }), /*#__PURE__*/React.createElement("header", {
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
  }, /*#__PURE__*/React.createElement("span", null, "เข้าสู่ดันเจี้ยน"), /*#__PURE__*/React.createElement("small", null, "เลือกชั้นและเริ่มการเดินทาง", "  ›")))), /*#__PURE__*/React.createElement(GameDock, {
    onCharacter: onCharacter,
    onOpenInv: onOpenInv,
    onPets: onPets,
    onSettings: onAccountSettings,
    onSave: onSave,
    onFriend: onFriend,
    onChat: onChat,
    onGuild: onGuild
  })), /*#__PURE__*/React.createElement(DailyLoginToast, {
    open: dailyModalOpen,
    onClose: () => { setDailyModalOpen(false); onClearDailyLoginResult(); },
    dailyLogin: dailyLogin,
    dailyLoginClaimResult: dailyLoginClaimResult,
    dailyPreview: dailyPreview,
    canClaimDaily: canClaimDaily,
    onClaimDailyLogin: onClaimDailyLogin
  }));
}

function TownScreen({
  save,
  arenaHud,
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
  onAccountSettings,
  onFriend,
  onChat,
  onGuild,
  onMainHub,
  dailyLogin,
  dailyLoginClaimResult,
  onClaimDailyLogin,
  onClearDailyLoginResult
}) {
  const e = React.createElement;
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
  const openDaily = () => {
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
      e(GlobalCurrencyBar, { save, arena: arenaHud, className: "md-town-resources" }),
      e("section", { className: "md-town-world", "aria-label": "ตัวเมือง" },
        e("h1", { className: "md-town-title" }, "Town"),
        e("button", {
          type: "button",
          className: "md-town-leaderboard",
          onClick: onLeaderboard,
          "aria-label": "Leaderboard"
        }, e("img", { src: "ui/town-icons/leaderboard-bird.svg", alt: "" }),
        e("span", null, "Leaderboard")),
        hotspot("guild", "กิลด์", "♜", onGuild),
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
          onClick: onChat,
          "aria-label": "แชท"
        }, e("span", { "aria-hidden": "true" }, "•••"), e("b", null, "แชท")),
        notice && e("div", { className: "md-town-notice", role: "status" }, notice)
      ),
      e(GameDock, {
        onCharacter,
        onOpenInv,
        onPets,
        onSettings: onAccountSettings,
        onSave,
        onFriend,
        onChat,
        onGuild,
        onMainHub
      })
    ),
    e(DailyLoginToast, {
      open: dailyModalOpen,
      onClose: () => { setDailyModalOpen(false); onClearDailyLoginResult(); },
      dailyLogin,
      dailyLoginClaimResult,
      dailyPreview,
      canClaimDaily,
      onClaimDailyLogin
    })
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
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " ", formatNumber(slot.gold), " · Stage ", slot.unlockedFloor)), /*#__PURE__*/React.createElement("button", {
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

function CharacterPageDock({ onCharacter, onOpenInv, onOpenPets, onSettings, onSave, onFriend, onChat, onGuild, onMainHub }) {
  return /*#__PURE__*/React.createElement(GameDock, {
    activeKey: "character",
    onCharacter,
    onOpenInv,
    onPets: onOpenPets,
    onSettings,
    onSave,
    onFriend,
    onChat,
    onGuild,
    onMainHub
  });
}

function PaidResetConfirm({ type, diamonds, onCancel, onConfirm }) {
  const label = type === "stats" ? "รีสเตตัสทั้งหมด" : "รีสกิลทั้งหมด";
  return /*#__PURE__*/React.createElement("div", { className: "md-character-confirm", role: "dialog", "aria-modal": "true" },
    /*#__PURE__*/React.createElement("div", { className: "md-character-confirm-card" },
      /*#__PURE__*/React.createElement("h3", null, label),
      /*#__PURE__*/React.createElement("p", null, type === "stats" ? "คืนแต้มสเตตัสที่เคยใช้ทั้งหมด" : "คืนแต้มสกิลที่เคยใช้ทั้งหมด"),
      /*#__PURE__*/React.createElement("strong", null, "ใช้ ", /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " 100 · มี ", formatNumber(diamonds)),
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
  onSettings,
  onSave,
  onFriend,
  onChat,
  onGuild,
  onMainHub,
  onBack
}) {
  const emptyDraft = () => Object.fromEntries(STAT_INFO.map(st => [st.key, 0]));
  const [draft, setDraft] = useState(emptyDraft);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [statsBusy, setStatsBusy] = useState(false);
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
  const commit = async () => {
    if (statsBusy) return;
    setStatsBusy(true);
    try { if (await onCommitStats(draft)) setDraft(emptyDraft()); }
    finally { setStatsBusy(false); }
  };
  const doPaidReset = async () => {
    if (statsBusy) return;
    setStatsBusy(true);
    try { if (await onResetStats()) {
      setDraft(emptyDraft());
      setConfirmReset(false);
    } } finally { setStatsBusy(false); }
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
          /*#__PURE__*/React.createElement("button", { type: "button", className: "reset", disabled: !allocatedStats || statsBusy, onClick: () => setConfirmReset(true) }, "↻ รีสเตตัส ", /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " 100")),
            /*#__PURE__*/React.createElement("button", { type: "button", className: "apply", disabled: !used || statsBusy, onClick: commit }, statsBusy ? "กำลังบันทึก…" : "ยืนยันการอัปสเตตัส")
        )
      )
    ),
    /*#__PURE__*/React.createElement(CharacterPageDock, { onCharacter: () => {}, onOpenInv, onOpenPets, onSettings, onSave, onFriend, onChat, onGuild, onMainHub }),
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
  onSettings,
  onSave,
  onFriend,
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
  const [skillsBusy, setSkillsBusy] = useState(false);
  const commit = async () => {
    if (skillsBusy) return;
    setSkillsBusy(true);
    try { if (await onCommitSkills(draft)) setDraft({}); }
    finally { setSkillsBusy(false); }
  };
  const doPaidReset = async () => {
    if (skillsBusy) return;
    setSkillsBusy(true);
    try { if (await onResetSkills()) {
      setDraft({});
      setConfirmReset(false);
    } } finally { setSkillsBusy(false); }
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
        /*#__PURE__*/React.createElement("button", { type: "button", className: "reset", disabled: !spentSkillPoints(save), onClick: () => setConfirmReset(true) }, "↻ รีสกิล ", /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " 100")),
        /*#__PURE__*/React.createElement("button", { type: "button", className: "apply", disabled: !used, onClick: commit }, "ยืนยันการอัปสกิล")
      )
    ),
    /*#__PURE__*/React.createElement(CharacterPageDock, { onCharacter: onBack, onOpenInv, onOpenPets, onSettings, onSave, onFriend, onChat }),
    confirmReset && /*#__PURE__*/React.createElement(PaidResetConfirm, { type: "skills", diamonds: save.diamonds, onCancel: () => setConfirmReset(false), onConfirm: doPaidReset })
  );
}
function HeroSkillV1Screen({ save, cp, onLearnSkill, onResetSkills, onOpenInv, onOpenPets, onSettings, onSave, onFriend, onChat, onGuild, onMainHub, onBack }) {
  const [branch, setBranch] = useState("assault");
  const [draft, setDraft] = useState({});
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [skillsBusy, setSkillsBusy] = useState(false);
  const levels = save.character.skillLevels || {};
  const spent = heroSkillSpentPoints(levels);
  const total = heroSkillPointBudget(save.character.level);
  const used = Object.entries(draft).reduce((sum, [id, value]) => {
    const skill = HERO_SKILLS_V1_BY_ID[id];
    return sum + (skill?.kind === "keystone" ? Number(value || 0) * 2 : Number(value || 0));
  }, 0);
  const available = Math.max(0, total - spent);
  const pointsLeft = Math.max(0, available - used);
  const title = id => id.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const reasonText = reason => ({ level_gate: "Level ยังไม่ถึง", branch_points: "แต้มในสายยังไม่ถึง", prerequisite: "ยังขาดสกิล prerequisite", keystone_points: "ต้องใช้แต้มในสาย 40", keystone_t4: "ต้องมี T4 อย่างน้อย 1 Rank", not_enough_sp: "Skill Point ไม่พอ", max_rank: "เต็มแล้ว" }[reason] || "");
  const previewLevels = id => ({ ...levels, [id]: heroSkillRank(levels, id) + (draft[id] || 0) });
  const allPreviewLevels = () => ({
    ...levels,
    ...Object.fromEntries(Object.entries(draft).map(([id, value]) => [id, heroSkillRank(levels, id) + value]))
  });
  const checkSkill = skill => canSpendHeroSkillPoint(save.character.level, allPreviewLevels(), skill.id);
  const visible = HERO_SKILLS_V1.filter(skill => skill.branch === branch);
  const groups = [1, 2, 3, 4, 5];

  const description = skill => ({
    power_strike: "โจมตีเป้าหมายเดี่ยวด้วยพลังโจมตีสูง",
    weapon_mastery: "เพิ่มความเสียหายจากการโจมตีของ Hero",
    killer_instinct: "เพิ่ม Crit เมื่อศัตรูมี HP ต่ำ",
    heavy_blow: "โจมตีหนักและมีโอกาส Armor Break",
    bloodlust: "เพิ่มความเสียหายเมื่อ HP ของ Hero ต่ำ",
    armor_break_mastery: "เพิ่มโอกาสทำให้ศัตรูติด Armor Break",
    blade_storm: "โจมตีหลายครั้ง กระจายใส่ศัตรูที่ยังมีชีวิต",
    life_drain: "ดูดเลือดจาก Basic Attack เพื่อฟื้น HP",
    finishing_blow: "เพิ่มความเสียหายต่อศัตรูที่ใกล้ตาย",
    rampage: "เพิ่มความเสียหายชั่วคราว พร้อมแลกด้วยความเสี่ยงที่ Rank ต่ำ",
    critical_mastery: "เพิ่มความแรงของ Critical Hit",
    relentless_fury: "Keystone ที่สะสม Fury จากการโจมตี",
    guard: "โจมตีพร้อมเสริม DEF Up",
    toughness: "เพิ่ม Max HP",
    iron_body: "เพิ่ม DEF",
    shield_wall: "เพิ่มการป้องกันพร้อมลดความเสียหายที่ทำได้ชั่วคราว",
    recovery: "เพิ่มการฟื้น HP/SP ที่ได้รับ",
    last_stand: "เมื่อ HP ต่ำ มีโอกาสได้รับ DEF Up",
    counter: "เข้าสู่สถานะ Counter เพื่อสวนกลับ",
    battle_hardened: "เพิ่ม Status Resist",
    second_wind: "ฟื้น HP ครั้งแรกที่ HP ลดถึงเกณฑ์",
    fortress: "เพิ่ม DEF ชั่วคราว พร้อมลดความเสียหายที่ทำได้ใน Rank ต่ำ",
    survival_instinct: "ลดความเสียหายส่วนเกินจากการโจมตีหนักและสะท้อนกลับ",
    thorned_aegis: "Keystone ที่สะสม Aegis และปลด Counter ตามเงื่อนไข",
    toxic_strike: "โจมตีพร้อมโอกาสทำให้ติด Poison",
    exploit_weakness: "เพิ่มความเสียหายต่อเป้าหมายที่มี Debuff",
    debilitating_edge: "เพิ่มโอกาสทำ Debuff",
    stunning_blow: "โจมตีพร้อมโอกาส Stun",
    spirit_drain: "Basic Attack ฟื้น SP เพิ่มเติม",
    toxic_mastery: "เพิ่มความเสียหาย Poison และเพิ่มระยะเวลาใน Rank สูงสุด",
    silent_edge: "โจมตีพร้อมโอกาส Silence",
    quick_recovery: "มีโอกาสลด Cooldown เมื่อโจมตีเป้าหมายที่ติด Debuff",
    skill_efficiency: "ลดค่า SP ของ Active Skill",
    disruption: "สุ่มใช้ Debuff หลายชนิดใน Action เดียว",
    master_tactician: "มีโอกาสเพิ่มระยะเวลา Debuff",
    usurper: "Keystone ที่สะสม Scheme และเพิ่มความสามารถด้าน Debuff"
  }[skill.id] || "Hero Skill V1");

  const effectParts = data => {
    if (!data) return [];
    const parts = [];
    if (data.mult != null) parts.push(`${Math.round(Number(data.mult) * 100)}% ATK`);
    if (data.damagePct != null) parts.push(`Damage +${data.damagePct}%`);
    if (data.damagePenaltyPct != null) parts.push(`Damage -${data.damagePenaltyPct}%`);
    if (data.defPct != null) parts.push(`DEF +${data.defPct}%`);
    if (data.maxHpPct != null) parts.push(`Max HP +${data.maxHpPct}%`);
    if (data.critPct != null) parts.push(`Crit +${data.critPct}%`);
    if (data.critDamagePct != null) parts.push(`Crit DMG +${data.critDamagePct}%`);
    if (data.critDamageBonus != null) parts.push(`Crit DMG +${data.critDamageBonus}%`);
    if (data.armorBreakChance != null) parts.push(`Armor Break ${data.armorBreakChance}%`);
    if (data.poisonChance != null) parts.push(`Poison ${data.poisonChance}%`);
    if (data.silenceChance != null) parts.push(`Silence ${data.silenceChance}%`);
    if (data.stunChance != null) parts.push(`Stun ${data.stunChance}%`);
    if (data.stunChancePerHit != null) parts.push(`Stun/Hit ${data.stunChancePerHit}%`);
    if (data.procBonus != null) parts.push(`Proc +${data.procBonus} pp`);
    if (data.statusResist != null) parts.push(`Status Resist +${data.statusResist}%`);
    if (data.receivedPct != null) parts.push(`HP/SP received +${data.receivedPct}%`);
    if (data.healMaxHpPct != null) parts.push(`Heal ${data.healMaxHpPct}% Max HP`);
    if (data.drainPct != null) parts.push(`Heal ${data.drainPct}% damage`);
    if (data.spRestore != null) parts.push(`SP +${data.spRestore}`);
    if (data.spReductionPct != null) parts.push(`SP cost -${data.spReductionPct}%`);
    if (data.poisonDamagePct != null) parts.push(`Poison damage +${data.poisonDamagePct}%`);
    if (data.durationBonus != null) parts.push(`Poison duration +${data.durationBonus}`);
    if (data.duration != null) parts.push(`Duration ${data.duration}T`);
    if (data.hits != null) parts.push(`${data.hits} hits`);
    if (data.count != null) parts.push(`${data.count} debuffs`);
    if (data.procChance != null) parts.push(`Proc ${data.procChance}%`);
    if (data.chance != null && data.procChance == null && data.poisonChance == null && data.stunChance == null) parts.push(`Chance ${data.chance}%`);
    if (data.targetBelowPct != null) parts.push(`Target <${data.targetBelowPct}% HP`);
    if (data.targetAtMostPct != null) parts.push(`Target ≤${data.targetAtMostPct}% HP`);
    if (data.hpAtMostPct != null) parts.push(`Hero HP ≤${data.hpAtMostPct}%`);
    if (data.excessReductionPct != null) parts.push(`Excess damage -${data.excessReductionPct}%`);
    if (data.reflectPct != null) parts.push(`Reflect ${data.reflectPct}%`);
    if (data.chance == null && data.rank != null) parts.push(`Rank ${data.rank}`);
    return parts;
  };
  const rankRows = skill => skill.ranks.map((data, index) => {
    const rank = index + 1;
    const label = skill.kind === "passive" ? `Lv${rank}` : `R${rank}`;
    const battle = [];
    if (data.sp != null) battle.push(`SP ${data.sp}`);
    if (data.cooldown != null) battle.push(`CD ${data.cooldown}T`);
    const effects = effectParts(data);
    return { label, text: [...effects, ...battle].join(" · ") || "รายละเอียดตาม Rank" };
  });
  const changeDraft = (skill, delta) => setDraft(current => {
    const now = heroSkillRank(levels, skill.id) + (current[skill.id] || 0);
    if (delta > 0) {
      if (pointsLeft < (skill.kind === "keystone" ? 2 : 1) || now >= skill.maxRank) return current;
      const preview = { ...levels, ...Object.fromEntries(Object.entries(current).map(([id, value]) => [id, heroSkillRank(levels, id) + value])) };
      const gate = canSpendHeroSkillPoint(save.character.level, preview, skill.id);
      if (!gate.ok) return current;
    }
    const next = Math.max(0, (current[skill.id] || 0) + delta);
    if (next === 0) {
      const copy = { ...current };
      delete copy[skill.id];
      return copy;
    }
    return { ...current, [skill.id]: next };
  });
  const commit = async () => {
    if (skillsBusy || !Object.keys(draft).length) return;
    setSkillsBusy(true);
    try {
      if (await onLearnSkill(draft)) {
        setDraft({});
        setSelectedSkill(null);
      }
    } finally {
      setSkillsBusy(false);
    }
  };
  const doPaidReset = async () => {
    if (skillsBusy) return;
    setSkillsBusy(true);
    try {
      if (await onResetSkills()) {
        setDraft({});
        setSelectedSkill(null);
        setConfirmReset(false);
      }
    } finally {
      setSkillsBusy(false);
    }
  };

  return /*#__PURE__*/React.createElement("main", { className: "md-character-page" },
    /*#__PURE__*/React.createElement(CharacterPageHeader, { save, cp, onBack }),
    /*#__PURE__*/React.createElement(CharacterTabs, { active: "skills", onStatus: onBack, onSkills: () => {} }),
    /*#__PURE__*/React.createElement("section", { className: "md-character-scroll" },
      /*#__PURE__*/React.createElement("div", { className: "md-skill-toolbar" }, /*#__PURE__*/React.createElement("strong", null, "✦ Skill Points ", pointsLeft, "/", available), used > 0 && /*#__PURE__*/React.createElement("span", { className: "md-skill-draft-badge" }, `ทดลองอัป ${used} SP`)),
      /*#__PURE__*/React.createElement("nav", { className: "md-skill-filters", "aria-label": "Hero skill branch" },
        [["assault", "Assault"], ["guard", "Guard"], ["tactic", "Tactic"]].map(item => /*#__PURE__*/React.createElement("button", { type: "button", key: item[0], className: branch === item[0] ? "active" : "", onClick: () => setBranch(item[0]) }, item[1]))
      ),
      groups.map(tier => {
        const rows = visible.filter(skill => skill.tier === tier);
        if (!rows.length) return null;
        return /*#__PURE__*/React.createElement("section", { className: "md-skill-list", key: tier },
          /*#__PURE__*/React.createElement("h3", { className: "md-section-title" }, tier === 5 ? "Keystone" : `T${tier}`),
          rows.map(skill => {
            const current = heroSkillRank(levels, skill.id);
            const added = draft[skill.id] || 0;
            const after = current + added;
            const check = checkSkill(skill);
            const rankLabel = skill.kind === "passive" ? "Lv" : "R";
            return /*#__PURE__*/React.createElement("button", {
              type: "button",
              className: `md-skill-upgrade${check.ok || current ? "" : " locked"}`,
              key: skill.id,
              onClick: () => setSelectedSkill(skill),
              "aria-label": `ดูรายละเอียด ${title(skill.id)}`
            },
              /*#__PURE__*/React.createElement("span", { className: "md-skill-upgrade-icon" }, /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: skill.id, alt: title(skill.id), title: title(skill.id) })),
              /*#__PURE__*/React.createElement("div", { className: "md-skill-upgrade-copy" },
                /*#__PURE__*/React.createElement("strong", null, title(skill.id)),
                /*#__PURE__*/React.createElement("small", null, skill.kind, " · ", rankLabel, current, "/", skill.maxRank, added > 0 ? ` · ทดลอง +${added}` : check.ok ? " · อัปได้" : current >= skill.maxRank ? " · MAX" : ` · ${reasonText(check.reason)}`)
              ),
              /*#__PURE__*/React.createElement("span", { className: "md-skill-detail-chevron" }, "›")
            );
          })
        );
      }),
      /*#__PURE__*/React.createElement("div", { className: "md-character-actions" },
        /*#__PURE__*/React.createElement("button", { type: "button", className: "reset", disabled: !spent || skillsBusy, onClick: () => setConfirmReset(true) }, "↻ รีสกิล ", /*#__PURE__*/React.createElement("span", null, "💎 100")),
        /*#__PURE__*/React.createElement("button", { type: "button", className: "apply", disabled: !used || skillsBusy, onClick: commit }, skillsBusy ? "กำลังบันทึก…" : "ยืนยันการอัปสกิล")
      )
    ),
    /*#__PURE__*/React.createElement(CharacterPageDock, { onCharacter: onBack, onOpenInv, onOpenPets, onSettings, onSave, onFriend, onChat, onGuild, onMainHub }),
    selectedSkill && /*#__PURE__*/React.createElement("div", { className: "md-floor-detail-backdrop", onClick: () => setSelectedSkill(null) },
      /*#__PURE__*/React.createElement("section", { className: "md-floor-detail-sheet md-skill-detail-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "md-skill-detail-title", onClick: event => event.stopPropagation() },
        /*#__PURE__*/React.createElement("button", { type: "button", className: "md-floor-detail-x", onClick: () => setSelectedSkill(null), "aria-label": "ปิด" }, "✕"),
        /*#__PURE__*/React.createElement("div", { className: "md-floor-detail-heading", },
          /*#__PURE__*/React.createElement("div", { className: "md-floor-title" },
            /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: selectedSkill.id, className: "md-skill-detail-icon", alt: title(selectedSkill.id) }),
            /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("small", null, selectedSkill.branch, " · ", selectedSkill.kind), /*#__PURE__*/React.createElement("h2", { id: "md-skill-detail-title" }, title(selectedSkill.id)))
          )
        ),
        /*#__PURE__*/React.createElement("p", { className: "md-skill-detail-desc" }, description(selectedSkill)),
        /*#__PURE__*/React.createElement("h3", null, "Rank / Level"),
        /*#__PURE__*/React.createElement("div", { className: "md-skill-detail-ranks" }, rankRows(selectedSkill).map(row => /*#__PURE__*/React.createElement("div", { key: row.label, className: `md-skill-detail-rank ${row.label === ((selectedSkill.kind === "passive" ? "Lv" : "R") + (heroSkillRank(levels, selectedSkill.id) + (draft[selectedSkill.id] || 0))) ? "preview" : ""}` },
          /*#__PURE__*/React.createElement("strong", null, row.label),
          /*#__PURE__*/React.createElement("span", null, row.text)
        ))),
        /*#__PURE__*/React.createElement("div", { className: "md-skill-detail-meta" },
          selectedSkill.ranks[0]?.sp != null && /*#__PURE__*/React.createElement("span", null, "Battle SP: ", selectedSkill.ranks[0].sp),
          selectedSkill.ranks[0]?.cooldown != null && /*#__PURE__*/React.createElement("span", null, "Cooldown: ", selectedSkill.ranks[0].cooldown, " Turn"),
          selectedSkill.prerequisites && /*#__PURE__*/React.createElement("span", null, "Prerequisite: ", Object.entries(selectedSkill.prerequisites).map(([id, rank]) => `${title(id)} R${rank}`).join(" + "))
        ),
        /*#__PURE__*/React.createElement("div", { className: "md-skill-detail-actions" },
          /*#__PURE__*/React.createElement("button", { type: "button", className: "md-btn info", onClick: () => setSelectedSkill(null) }, "ปิด"),
          /*#__PURE__*/React.createElement("button", { type: "button", className: "md-btn primary", disabled: !checkSkill(selectedSkill).ok || pointsLeft < (selectedSkill.kind === "keystone" ? 2 : 1), onClick: () => changeDraft(selectedSkill, 1) }, "＋ ทดลองอัป")
        )
      )
    ),
    confirmReset && /*#__PURE__*/React.createElement(PaidResetConfirm, { type: "skills", diamonds: save.diamonds, onCancel: () => setConfirmReset(false), onConfirm: doPaidReset })
  );
}
// ---------- Phase 2/3/5: Leaderboard ----------
// "Core" boards (floor/cp/pet_cp) all come from the same leaderboard_stats row shape, so
// they render as ONE table with sortable columns instead of separate tabs that hide each
// other. Raid/PvP have a different row shape (raid = current-instance participants only,
// pvp = arena rating) so they're their own "category" with their own single-stat column.
const LEADERBOARD_CORE_COLUMNS = [{
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
}];
// Top-level categories, always one row of 3 buttons. "character" fans out into the core
// sort buttons below it; raid/arena are single boards with their own stat column.
const LEADERBOARD_CATEGORIES = [{
  key: "character",
  icon: "🧙",
  label: "ตัวละคร",
  boards: LEADERBOARD_CORE_COLUMNS
}, {
  key: "raid",
  icon: "🐉",
  label: "Raid",
  boards: [{
    key: "raid",
    valueKey: "total_contribution",
    format: v => `${formatNumber(v)} dmg`
  }],
  supportsHistory: true
}, {
  key: "arena",
  icon: "⚔️",
  label: "Arena",
  boards: [{
    key: "pvp",
    valueKey: "rating",
    format: v => `Rating ${formatNumber(v)}`
  }]
}];
function categoryForBoard(board) {
  return LEADERBOARD_CATEGORIES.find(c => c.boards.some(b => b.key === board)) || LEADERBOARD_CATEGORIES[0];
}
function LeaderboardScreen({
  serverUrl,
  myCharacterId,
  onBack
}) {
  const [board, setBoard] = useState("floor"); // "floor"/"cp"/"pet_cp" (character sort), "raid", or "pvp"
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(""); // "" = live/today
  const activeCategory = categoryForBoard(board);
  const isCore = activeCategory.key === "character";
  React.useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    const url = serverUrl || DEFAULT_SERVER_URL;
    const supportsHistory = isCore || activeCategory.supportsHistory;
    const fetcher = selectedDate && supportsHistory ? cloudGetLeaderboardHistory(url, board, selectedDate) : cloudGetLeaderboard(url, board);
    fetcher.then(res => {
      if (cancelled) return;
      setSpinning(false);
      if (!res || !res.ok) { setError("โหลดอันดับไม่สำเร็จ ลองใหม่อีกครั้ง"); setRows([]); return; }
      setRows(res.rows || []);
      setAvailableDates(res.availableDates || []);
    });
    return () => { cancelled = true; };
  }, [board, serverUrl, refreshKey, selectedDate]);
  const handleRefresh = () => {
    setSpinning(true);
    setRefreshKey(k => k + 1);
  };
  const handleSelectCategory = cat => {
    setSelectedDate("");
    setBoard(cat.boards[0].key);
  };
  const dateLabel = (d, idx) => idx === 0 ? "วันนี้" : idx === 1 ? "เมื่อวาน" : d.slice(5);
  const activeBoardDef = activeCategory.boards.find(b => b.key === board) || activeCategory.boards[0];
  const rowsBody = rows === null ? /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, "กำลังโหลด...") : error ? /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, error) : rows.length === 0 ? /*#__PURE__*/React.createElement("p", {
    className: "md-sub"
  }, selectedDate ? "ไม่มีข้อมูลของวันนี้" : "ยังไม่มีข้อมูลอันดับ") : /*#__PURE__*/React.createElement("div", {
    className: "md-inv-list",
    style: { maxHeight: 420, overflowY: "auto" }
  }, rows.map((row, idx) => {
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;
    const isMe = row.character_id === myCharacterId;
    const statsNode = isCore ? /*#__PURE__*/React.createElement("div", {
      style: { display: "flex", gap: 10, flexShrink: 0 }
    }, LEADERBOARD_CORE_COLUMNS.map(col => /*#__PURE__*/React.createElement("span", {
      key: col.key,
      style: board === col.key ? { fontWeight: 700, color: "var(--gold, #FFD700)" } : { opacity: 0.75 }
    }, col.icon, " ", col.format(Number(row[col.valueKey]) || 0)))) : /*#__PURE__*/React.createElement("span", {
      style: { fontWeight: 700, color: "var(--gold, #FFD700)", flexShrink: 0 }
    }, activeBoardDef.format(Number(row[activeBoardDef.valueKey]) || 0));
    return /*#__PURE__*/React.createElement("div", {
      key: row.character_id,
      className: "md-shop-row",
      style: Object.assign(
        { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, width: "100%" },
        isMe ? { background: "rgba(255,215,0,0.12)", borderRadius: 8 } : {}
      )
    }, /*#__PURE__*/React.createElement("div", {
      className: "md-shop-info",
      style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
    }, medal, " ", row.name || "?", isMe ? " (คุณ)" : ""), statsNode);
  }));
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
      marginBottom: 8
    }
  }, LEADERBOARD_CATEGORIES.map(cat => /*#__PURE__*/React.createElement("button", {
    key: cat.key,
    className: "md-btn small" + (activeCategory.key === cat.key ? " primary" : " flee"),
    style: { flex: 1 },
    onClick: () => handleSelectCategory(cat)
  }, cat.icon, " ", cat.label))), isCore && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 10
    }
  }, LEADERBOARD_CORE_COLUMNS.map(col => /*#__PURE__*/React.createElement("button", {
    key: col.key,
    className: "md-btn small" + (board === col.key ? " primary" : " flee"),
    style: { flex: 1 },
    onClick: () => setBoard(col.key)
  }, col.icon, " ", col.label))), (isCore || activeCategory.supportsHistory) && availableDates.length > 0 && /*#__PURE__*/React.createElement("select", {
    className: "md-select",
    value: selectedDate,
    onChange: e => setSelectedDate(e.target.value),
    style: { width: "100%", marginBottom: 10, padding: "8px 10px" }
  }, availableDates.map((d, idx) => /*#__PURE__*/React.createElement("option", {
    key: d,
    value: idx === 0 ? "" : d
  }, dateLabel(d, idx)))), /*#__PURE__*/React.createElement("div", {
    className: "md-card",
    style: { marginBottom: 10 }
  }, rowsBody), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide small",
    onClick: onBack
  }, "← Back"));
}
// ---------- Phase 6.2: Friend System V1 ----------
function friendErrorText(error) {
  const map = {
    invalid_session: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    session_expired: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    session_replaced: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    cannot_request_self: "ส่งคำขอหาตัวเองไม่ได้",
    cannot_block_self: "บล็อกตัวเองไม่ได้",
    already_friends: "เป็นเพื่อนกันอยู่แล้ว",
    blocked_relationship: "ทำรายการนี้ไม่ได้เนื่องจากมีการบล็อกอยู่",
    request_already_exists: "มีคำขอเป็นเพื่อนค้างอยู่แล้ว",
    outgoing_request_cap_reached: "ส่งคำขอเป็นเพื่อนค้างไว้ครบจำนวนสูงสุดแล้ว (20 คำขอ)",
    friend_limit_reached: "เพื่อนเต็มจำนวนสูงสุดแล้ว (50 คน)",
    request_not_pending: "คำขอนี้ถูกดำเนินการไปแล้วหรือหมดอายุ",
    request_expired: "คำขอนี้หมดอายุแล้ว",
    request_not_found: "ไม่พบคำขอนี้",
    character_not_found: "ไม่พบผู้เล่นนี้",
    forbidden: "ไม่มีสิทธิ์ทำรายการนี้",
    server_error: "ระบบเพื่อนขัดข้อง กรุณาลองใหม่",
  };
  return map[error] || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
const FRIEND_TABS = [
  { key: "friends", label: "เพื่อน" },
  { key: "requests", label: "คำขอ" },
  { key: "blocked", label: "บล็อก" },
];
function sortFriendsOnlineFirst(a, b) {
  return (b.online - a.online) || String(a.name).localeCompare(String(b.name));
}
function FriendScreen({
  serverUrl,
  characterId,
  onCharacter,
  onOpenInv,
  onPets,
  onSettings,
  onSave,
  onChat,
  onGuild,
  onMainHub,
  onChatWith,
  onOpenPlayerCard,
  onBack
}) {
  const e = React.createElement;
  const url = serverUrl || DEFAULT_SERVER_URL;
  const [tab, setTab] = useState("friends");
  const [friends, setFriends] = useState(null);
  const [requestsData, setRequestsData] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [toast, setToast] = useState("");

  const loadAll = React.useCallback(() => {
    setLoadError("");
    Promise.all([
      cloudGetFriendList(url, characterId),
      cloudGetFriendRequests(url, characterId),
      cloudGetBlockedList(url, characterId),
    ]).then(([friendRes, reqRes, blockedRes]) => {
      if (!friendRes || friendRes.error || !reqRes || reqRes.error || !blockedRes || blockedRes.error) {
        setLoadError(friendErrorText((friendRes && friendRes.error) || (reqRes && reqRes.error) || (blockedRes && blockedRes.error)));
      }
      setFriends((friendRes && friendRes.friends) || []);
      setRequestsData({ incoming: (reqRes && reqRes.incoming) || [], outgoing: (reqRes && reqRes.outgoing) || [] });
      setBlocked((blockedRes && blockedRes.blocked) || []);
    }).catch(() => setLoadError(friendErrorText("network_error")));
  }, [url, characterId]);

  // Full reload only on mount and on character switch (characterId changes) — every
  // in-page action below is optimistic/local instead, per the Friend V1 UX hotfix.
  React.useEffect(() => { loadAll(); }, [loadAll]);

  // Debounced live search — ~190ms after typing stops instead of per keystroke.
  React.useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults(null); setSearching(false); return; }
    setSearching(true);
    const handle = setTimeout(() => {
      cloudSearchCharacters(url, characterId, q).then(res => {
        setSearching(false);
        setSearchResults(res && res.results ? res.results : []);
      }).catch(() => { setSearching(false); setSearchResults([]); });
    }, 190);
    return () => clearTimeout(handle);
  }, [query, url, characterId]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(t => t === msg ? "" : t), 2200); };

  // Applies `apply()` immediately (already called by the caller before this runs), then
  // fires the real request in the background. On failure or network error, `revert()`
  // restores the exact pre-action snapshot the caller captured — no full reload either way.
  const runOptimistic = (key, revert, promise) => {
    setBusyKey(key);
    promise.then(res => {
      setBusyKey("");
      if (!res || res.error) {
        revert();
        showToast(friendErrorText(res && res.error));
      }
    }).catch(() => {
      setBusyKey("");
      revert();
      showToast(friendErrorText("network_error"));
    });
  };

  const handleSendRequest = (row) => {
    const key = `send:${row.characterId}`;
    if (busyKey) return;
    const prevSearch = searchResults;
    const prevOutgoing = requestsData.outgoing;
    if (searchResults) setSearchResults(searchResults.map(r => r.characterId === row.characterId ? { ...r, relationship: "outgoing_pending", requestId: null } : r));
    const promise = cloudSendFriendRequest(url, characterId, row.characterId).then(res => {
      if (res && res.ok) {
        setRequestsData(rd => ({ ...rd, outgoing: [...rd.outgoing, { requestId: res.requestId, characterId: row.characterId, name: row.name, level: row.level, online: row.online, createdAt: new Date().toISOString(), expiresAt: res.expiresAt }] }));
        setSearchResults(sr => sr ? sr.map(r => r.characterId === row.characterId ? { ...r, requestId: res.requestId } : r) : sr);
      }
      return res;
    });
    runOptimistic(key, () => {
      if (prevSearch) setSearchResults(prevSearch);
      setRequestsData(rd => ({ ...rd, outgoing: prevOutgoing }));
    }, promise);
  };

  const handleAccept = (req) => {
    const key = `accept:${req.requestId}`;
    if (busyKey) return;
    const prevIncoming = requestsData.incoming;
    const prevFriends = friends;
    const prevSearch = searchResults;
    setRequestsData({ ...requestsData, incoming: requestsData.incoming.filter(r => r.requestId !== req.requestId) });
    setFriends([...(friends || []), { characterId: req.characterId, name: req.name, level: req.level, guildName: null, online: req.online }].sort(sortFriendsOnlineFirst));
    if (searchResults) setSearchResults(searchResults.map(r => r.characterId === req.characterId ? { ...r, relationship: "friend", requestId: null } : r));
    runOptimistic(key, () => {
      setRequestsData(rd => ({ ...rd, incoming: prevIncoming }));
      setFriends(prevFriends);
      if (prevSearch) setSearchResults(prevSearch);
    }, cloudAcceptFriendRequest(url, characterId, req.requestId));
  };

  const handleReject = (req) => {
    const key = `reject:${req.requestId}`;
    if (busyKey || !req.requestId) return;
    const prevIncoming = requestsData.incoming;
    const prevSearch = searchResults;
    setRequestsData({ ...requestsData, incoming: requestsData.incoming.filter(r => r.requestId !== req.requestId) });
    if (searchResults) setSearchResults(searchResults.map(r => r.characterId === req.characterId ? { ...r, relationship: "none", requestId: null } : r));
    runOptimistic(key, () => {
      setRequestsData(rd => ({ ...rd, incoming: prevIncoming }));
      if (prevSearch) setSearchResults(prevSearch);
    }, cloudRejectFriendRequest(url, characterId, req.requestId));
  };

  const handleCancel = (req) => {
    const key = `cancel:${req.requestId}`;
    if (busyKey || !req.requestId) return;
    const prevOutgoing = requestsData.outgoing;
    const prevSearch = searchResults;
    setRequestsData({ ...requestsData, outgoing: requestsData.outgoing.filter(r => r.requestId !== req.requestId) });
    if (searchResults) setSearchResults(searchResults.map(r => r.characterId === req.characterId ? { ...r, relationship: "none", requestId: null } : r));
    runOptimistic(key, () => {
      setRequestsData(rd => ({ ...rd, outgoing: prevOutgoing }));
      if (prevSearch) setSearchResults(prevSearch);
    }, cloudCancelFriendRequest(url, characterId, req.requestId));
  };

  const handleRemove = (friend) => {
    const key = `remove:${friend.characterId}`;
    if (busyKey) return;
    const prevFriends = friends;
    const prevSearch = searchResults;
    setFriends(friends.filter(f => f.characterId !== friend.characterId));
    if (searchResults) setSearchResults(searchResults.map(r => r.characterId === friend.characterId ? { ...r, relationship: "none", requestId: null } : r));
    runOptimistic(key, () => {
      setFriends(prevFriends);
      if (prevSearch) setSearchResults(prevSearch);
    }, cloudRemoveFriend(url, characterId, friend.characterId));
  };

  const handleBlock = (entity) => {
    const key = `block:${entity.characterId}`;
    if (busyKey) return;
    const prevFriends = friends;
    const prevRequests = requestsData;
    const prevBlocked = blocked;
    const prevSearch = searchResults;
    setFriends((friends || []).filter(f => f.characterId !== entity.characterId));
    setRequestsData({
      incoming: requestsData.incoming.filter(r => r.characterId !== entity.characterId),
      outgoing: requestsData.outgoing.filter(r => r.characterId !== entity.characterId),
    });
    setBlocked([...(blocked || []), { characterId: entity.characterId, name: entity.name, level: entity.level }]);
    if (searchResults) setSearchResults(searchResults.map(r => r.characterId === entity.characterId ? { ...r, relationship: "blocked_by_me", requestId: null } : r));
    runOptimistic(key, () => {
      setFriends(prevFriends);
      setRequestsData(prevRequests);
      setBlocked(prevBlocked);
      if (prevSearch) setSearchResults(prevSearch);
    }, cloudBlockCharacter(url, characterId, entity.characterId));
  };

  const handleUnblock = (entity) => {
    const key = `unblock:${entity.characterId}`;
    if (busyKey) return;
    const prevBlocked = blocked;
    const prevSearch = searchResults;
    setBlocked((blocked || []).filter(b => b.characterId !== entity.characterId));
    if (searchResults) setSearchResults(searchResults.map(r => r.characterId === entity.characterId ? { ...r, relationship: "none", requestId: null } : r));
    runOptimistic(key, () => {
      setBlocked(prevBlocked);
      if (prevSearch) setSearchResults(prevSearch);
    }, cloudUnblockCharacter(url, characterId, entity.characterId));
  };

  const onlineDot = (online) => online ? "🟢" : "⚪";

  const row = (key, left, right) => e("div", { key, className: "md-shop-row" },
    e("div", { className: "md-shop-info" }, left),
    e("div", { style: { display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" } }, right));

  const actionBtn = (label, onClick, variant, disabled) => e("button", {
    className: `md-btn small ${variant || "info"}`,
    disabled: !!disabled,
    onClick,
  }, label);

  // Search results take over the list area whenever there's an active query, regardless
  // of which tab is selected — the tabs themselves stay visible so switching away clears
  // the search naturally. Every relationship state gets a Block action alongside its
  // primary action(s), per the Friend V1 UX hotfix.
  const searchBody = () => {
    if (searching && searchResults === null) return e("p", { className: "md-sub" }, "กำลังค้นหา...");
    if (!searchResults || !searchResults.length) return e("p", { className: "md-sub" }, "ไม่พบผู้เล่น");
    return e("div", { className: "md-inv-list" }, searchResults.map((r) => {
      let actions;
      if (r.relationship === "friend") actions = [
        actionBtn("ลบ", () => handleRemove(r), "flee", busyKey === `remove:${r.characterId}`),
        actionBtn("บล็อก", () => handleBlock(r), "flee", busyKey === `block:${r.characterId}`),
      ];
      else if (r.relationship === "blocked_by_me") actions = [actionBtn("เลิกบล็อก", () => handleUnblock(r), "primary", busyKey === `unblock:${r.characterId}`)];
      else if (r.relationship === "blocking_me") actions = [actionBtn("-", null, "info", true)];
      else if (r.relationship === "outgoing_pending") actions = [
        actionBtn("ส่งคำขอแล้ว", () => handleCancel(r), "flee", busyKey === `cancel:${r.requestId}` || !r.requestId),
        actionBtn("บล็อก", () => handleBlock(r), "flee", busyKey === `block:${r.characterId}`),
      ];
      else if (r.relationship === "incoming_pending") actions = [
        actionBtn("ยอมรับ", () => handleAccept(r), "primary", busyKey === `accept:${r.requestId}`),
        actionBtn("ปฏิเสธ", () => handleReject(r), "flee", busyKey === `reject:${r.requestId}`),
        actionBtn("บล็อก", () => handleBlock(r), "flee", busyKey === `block:${r.characterId}`),
      ];
      else actions = [
        actionBtn("เพิ่มเพื่อน", () => handleSendRequest(r), "primary", busyKey === `send:${r.characterId}`),
        actionBtn("บล็อก", () => handleBlock(r), "flee", busyKey === `block:${r.characterId}`),
      ];
      return row(r.characterId, e("div", { className: "md-friend-player-cell" },
        e("span", { className: "md-friend-online-dot", "aria-hidden": "true" }, onlineDot(r.online)),
        e(PlayerCardTrigger, { characterId: r.characterId, name: r.name, level: r.level, onOpenPlayerCard })
      ), actions);
    }));
  };

  const friendsBody = () => {
    if (friends === null) return e("p", { className: "md-sub" }, "กำลังโหลด...");
    if (!friends.length) return e("p", { className: "md-sub" }, "ยังไม่มีเพื่อน ลองค้นหาชื่อผู้เล่นด้านบนดูสิ");
    return e("div", { className: "md-inv-list" }, friends.map((f) => row(f.characterId,
      `${onlineDot(f.online)} ${f.name} (Lv.${f.level})`,
      [
        onChatWith && actionBtn("แชท", () => onChatWith(f), "primary", false),
        actionBtn("ลบ", () => handleRemove(f), "flee", busyKey === `remove:${f.characterId}`),
        actionBtn("บล็อก", () => handleBlock(f), "flee", busyKey === `block:${f.characterId}`),
      ])));
  };

  const requestsBody = () => {
    if (requestsData === null) return e("p", { className: "md-sub" }, "กำลังโหลด...");
    const incoming = requestsData.incoming || [];
    const outgoing = requestsData.outgoing || [];
    if (!incoming.length && !outgoing.length) return e("p", { className: "md-sub" }, "ไม่มีคำขอเป็นเพื่อน");
    return e(React.Fragment, null,
      incoming.length > 0 && e("div", { style: { marginBottom: 10 } },
        e("p", { className: "md-sub", style: { margin: "0 0 4px" } }, "ได้รับคำขอ"),
        e("div", { className: "md-inv-list" }, incoming.map((r) => row(r.requestId,
          `${onlineDot(r.online)} ${r.name} (Lv.${r.level})`,
          [
            actionBtn("ยอมรับ", () => handleAccept(r), "primary", busyKey === `accept:${r.requestId}`),
            actionBtn("ปฏิเสธ", () => handleReject(r), "flee", busyKey === `reject:${r.requestId}`),
            actionBtn("บล็อก", () => handleBlock(r), "flee", busyKey === `block:${r.characterId}`),
          ])))),
      outgoing.length > 0 && e("div", null,
        e("p", { className: "md-sub", style: { margin: "0 0 4px" } }, `คำขอที่ส่งไป (${outgoing.length}/${FRIEND_OUTGOING_PENDING_CAP_CLIENT})`),
        e("div", { className: "md-inv-list" }, outgoing.map((r) => row(r.requestId,
          `${onlineDot(r.online)} ${r.name} (Lv.${r.level})`,
          [
            actionBtn("ยกเลิก", () => handleCancel(r), "flee", busyKey === `cancel:${r.requestId}`),
            actionBtn("บล็อก", () => handleBlock(r), "flee", busyKey === `block:${r.characterId}`),
          ])))));
  };

  const blockedBody = () => {
    if (blocked === null) return e("p", { className: "md-sub" }, "กำลังโหลด...");
    if (!blocked.length) return e("p", { className: "md-sub" }, "ไม่มีผู้เล่นที่ถูกบล็อก");
    return e("div", { className: "md-inv-list" }, blocked.map((b) => row(b.characterId,
      `${b.name} (Lv.${b.level})`,
      [actionBtn("เลิกบล็อก", () => handleUnblock(b), "primary", busyKey === `unblock:${b.characterId}`)])));
  };

  const incomingCount = (requestsData && requestsData.incoming && requestsData.incoming.length) || 0;

  return e("div", { className: "md-panel md-friend-page" },
    toast && e("div", { className: "md-toast" }, toast),
    e("div", { className: "md-card", style: { marginBottom: 10 } },
      e("p", { className: "md-title" }, "👥 เพื่อน"),
      e("input", {
        className: "md-field",
        style: { width: "100%" },
        placeholder: "ค้นหาชื่อผู้เล่น...",
        value: query,
        onChange: (ev) => setQuery(ev.target.value),
      })),
    !query.trim() && e("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
      FRIEND_TABS.map(t => e("button", {
        key: t.key,
        className: "md-btn small" + (tab === t.key ? " primary" : " flee"),
        style: { flex: 1 },
        onClick: () => setTab(t.key),
      }, t.label, t.key === "requests" && incomingCount > 0 ? ` (${incomingCount})` : ""))),
    loadError && e("p", { className: "md-sub" }, loadError),
    e("div", { className: "md-card", style: { marginBottom: 10, overflowY: "auto", minHeight: 0 } },
      query.trim() ? searchBody() : tab === "friends" ? friendsBody() : tab === "requests" ? requestsBody() : blockedBody()),
    e(BackButton, { onClick: onBack }),
    e(GameDock, { onCharacter, onOpenInv, onPets, onSettings, onSave, onChat, onGuild, onMainHub }));
}
const FRIEND_OUTGOING_PENDING_CAP_CLIENT = 20; // display only — server (FRIEND_OUTGOING_PENDING_CAP) is authoritative
// ---------- Phase 6.3: Chat System V1 ----------
function chatErrorText(error) {
  const map = {
    invalid_session: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    session_expired: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    session_replaced: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    message_empty: "กรุณาพิมพ์ข้อความ",
    message_too_long: "ข้อความยาวเกินไป",
    chat_rate_limited: "ส่งข้อความเร็วเกินไป กรุณารอสักครู่",
    not_friends: "ส่งข้อความได้เฉพาะเพื่อนเท่านั้น",
    blocked_relationship: "ไม่สามารถส่งข้อความได้เนื่องจากมีการบล็อกอยู่",
    invalid_recipient: "ผู้รับไม่ถูกต้อง",
    not_guild_member: "ไม่ได้เป็นสมาชิกกิลด์นี้",
    channel_access_denied: "ไม่สามารถเข้าถึงช่องแชทนี้ได้",
    rate_limited: "ส่งข้อความเร็วเกินไป กรุณารอสักครู่",
    missing_fields: "ข้อมูลไม่ครบ กรุณาลองใหม่",
    character_not_found: "ไม่พบผู้เล่นนี้",
    server_error: "ระบบแชทขัดข้อง กรุณาลองใหม่",
  };
  return map[error] || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
const CHAT_TABS = [
  { key: "global", label: "โลก" },
  { key: "guild", label: "กิลด์" },
  { key: "direct", label: "ส่วนตัว" },
  { key: "sticker", label: "สติกเกอร์" },
];
function ChatScreen({
  serverUrl,
  characterId,
  characterName,
  initialDirectTarget,
  initialChannel,
  guildUnread = false,
  onGuildUnread,
  onChannelChange,
  onCharacter,
  onOpenInv,
  onPets,
  onSettings,
  onSave,
  onFriend,
  onGuild,
  onMainHub,
  onOpenPlayerCard,
  onBack
}) {
  const e = React.createElement;
  const url = serverUrl || DEFAULT_SERVER_URL;
  const [tab, setTab] = useState(initialDirectTarget ? "direct" : (initialChannel === "guild" ? "guild" : "global"));
  const [activeConversation, setActiveConversation] = useState(initialDirectTarget || null);
  const [globalMessages, setGlobalMessages] = useState([]);
  const [globalLoaded, setGlobalLoaded] = useState(false);
  const [globalInput, setGlobalInput] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [globalSending, setGlobalSending] = useState(false);
  const [guildMessages, setGuildMessages] = useState([]);
  const [guildLoaded, setGuildLoaded] = useState(false);
  const [guildName, setGuildName] = useState("");
  const [guildInput, setGuildInput] = useState("");
  const [guildError, setGuildError] = useState("");
  const [guildSending, setGuildSending] = useState(false);
  const [conversations, setConversations] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [threadLoaded, setThreadLoaded] = useState(false);
  const [threadCanSend, setThreadCanSend] = useState(true);
  const [threadInput, setThreadInput] = useState("");
  const [threadError, setThreadError] = useState("");
  const [threadSending, setThreadSending] = useState(false);
  const [pollError, setPollError] = useState(false);

  const lastGlobalIdRef = React.useRef(0);
  const lastThreadIdRef = React.useRef(0);
  const lastGuildIdRef = React.useRef(0);
  const guildNonceRef = React.useRef(null);
  const guildSendLockRef = React.useRef(false);
  const onGuildUnreadRef = React.useRef(onGuildUnread);
  onGuildUnreadRef.current = onGuildUnread;
  const pollTimerRef = React.useRef(null);

  const lastCharacterIdRef = React.useRef(characterId);
  React.useEffect(() => {
    if (lastCharacterIdRef.current === characterId) return;
    lastCharacterIdRef.current = characterId;
    setGlobalMessages([]); setGlobalLoaded(false); setConversations(null);
    setThreadMessages([]); setThreadLoaded(false); setActiveConversation(null);
    setGuildMessages([]); setGuildLoaded(false); setGuildName("");
    setGlobalInput(""); setThreadInput(""); setGuildInput("");
    setGlobalError(""); setThreadError(""); setGuildError("");
    lastGlobalIdRef.current = 0; lastThreadIdRef.current = 0; lastGuildIdRef.current = 0;
    guildNonceRef.current = null;
    guildSendLockRef.current = false;
  }, [characterId]);

  // Single active poller at a time — Global tab, or an open Direct thread, or (Direct tab
  // with no thread open) the conversation list. Cleared on unmount and whenever tab/
  // activeConversation/characterId changes, so nothing polls once Chat isn't showing it
  // (CHAT-SYSTEM-V1.md §6). Baseline ~3s, backs off 3s -> 5s -> 10s on failure and resets
  // to baseline the moment a poll succeeds again; old messages are never cleared on
  // failure, only appended to on success.
  React.useEffect(() => {
    let cancelled = false;
    let delay = 3000;
    if (tab === "guild") { setGuildError(""); setGuildLoaded(false); }
    lastGlobalIdRef.current = 0;
    lastThreadIdRef.current = 0;
    lastGuildIdRef.current = 0;
    setPollError(false);

    const loadInitial = async () => {
      if (tab === "global") {
        const res = await cloudGetGlobalChat(url, characterId, 0);
        if (cancelled) return;
        if (res && res.ok) {
          setGlobalMessages(res.messages);
          if (res.messages.length) lastGlobalIdRef.current = res.messages[res.messages.length - 1].id;
          setGlobalLoaded(true);
        }
      } else if (tab === "guild") {
        const res = await cloudGetGuildChat(url, characterId, 0);
        if (cancelled) return;
        if (res && res.ok) {
          setGuildMessages(res.messages || []);
          setGuildName(res.guild?.name || "");
          if (res.cursor != null) lastGuildIdRef.current = Number(res.cursor);
          else if (res.messages?.length) lastGuildIdRef.current = res.messages[res.messages.length - 1].id;
          setGuildLoaded(true);
          const read = await cloudMarkGuildChatRead(url, characterId);
          if (!cancelled && read && read.ok && onGuildUnreadRef.current) onGuildUnreadRef.current(characterId, false);
        } else if (res?.error === "not_guild_member") {
          setGuildMessages([]); setGuildLoaded(true); setGuildError(chatErrorText(res.error));
        } else if (res?.error) throw new Error(res.error);
      } else if (tab === "direct" && activeConversation) {
        const res = await cloudGetDirectMessages(url, characterId, activeConversation.characterId, 0);
        if (cancelled) return;
        if (res && res.ok) {
          setThreadMessages(res.messages);
          setThreadCanSend(!!res.canSend);
          if (res.messages.length) lastThreadIdRef.current = res.messages[res.messages.length - 1].id;
          setThreadLoaded(true);
          // Only mark read after a confirmed successful render — never on a failed fetch
          // (§10/§14).
          cloudMarkConversationRead(url, characterId, activeConversation.characterId);
        }
      } else if (tab === "direct" && !activeConversation) {
        const res = await cloudGetDirectConversations(url, characterId);
        if (cancelled) return;
        if (res && res.ok) setConversations(res.conversations);
      }
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        if (tab === "global") {
          const res = await cloudGetGlobalChat(url, characterId, lastGlobalIdRef.current);
          if (cancelled) return;
          if (!res || res.error) throw new Error("poll_failed");
          if (res.messages.length) {
            setGlobalMessages((prev) => [...prev, ...res.messages]);
            lastGlobalIdRef.current = res.messages[res.messages.length - 1].id;
          }
          setPollError(false);
          delay = 3000;
        } else if (tab === "guild") {
          const res = await cloudGetGuildChat(url, characterId, lastGuildIdRef.current);
          if (cancelled) return;
          if (res?.error === "not_guild_member") {
            setGuildMessages([]); setGuildLoaded(true); setGuildName(""); setGuildError(chatErrorText(res.error));
            if (onGuildUnreadRef.current) onGuildUnreadRef.current(characterId, false);
            return;
          }
          if (!res || res.error) throw new Error(res?.error || "poll_failed");
          if (res.guild) setGuildName(res.guild.name || "");
          if (res.messages.length) {
            setGuildMessages((prev) => [...prev, ...res.messages]);
            await cloudMarkGuildChatRead(url, characterId);
          }
          if (res.cursor != null) lastGuildIdRef.current = Number(res.cursor);
          else if (res.messages.length) lastGuildIdRef.current = res.messages[res.messages.length - 1].id;
          if (onGuildUnreadRef.current) onGuildUnreadRef.current(characterId, false);
          setPollError(false);
          delay = 3000;
        } else if (tab === "direct" && activeConversation) {
          const res = await cloudGetDirectMessages(url, characterId, activeConversation.characterId, lastThreadIdRef.current);
          if (cancelled) return;
          if (!res || res.error) throw new Error("poll_failed");
          if (res.messages.length) {
            setThreadMessages((prev) => [...prev, ...res.messages]);
            lastThreadIdRef.current = res.messages[res.messages.length - 1].id;
            cloudMarkConversationRead(url, characterId, activeConversation.characterId);
          }
          setThreadCanSend(!!res.canSend);
          setPollError(false);
          delay = 3000;
        } else if (tab === "direct" && !activeConversation) {
          const res = await cloudGetDirectConversations(url, characterId);
          if (cancelled) return;
          if (!res || res.error) throw new Error("poll_failed");
          setConversations(res.conversations);
          setPollError(false);
          delay = 3000;
        }
        if (tab !== "guild") {
          try {
            const status = await cloudGetGuildChatStatus(url, characterId);
            if (!cancelled && status?.ok && onGuildUnreadRef.current) onGuildUnreadRef.current(characterId, !!status.guild?.unread);
          } catch (_) { /* Keep channel polling health independent from the badge request. */ }
        }
      } catch (err) {
        if (cancelled) return;
        setPollError(true);
        delay = delay >= 10000 ? 10000 : delay === 3000 ? 5000 : 10000;
      }
      if (!cancelled) pollTimerRef.current = setTimeout(poll, delay);
    };

    loadInitial()
      .then(() => {
        if (!cancelled) pollTimerRef.current = setTimeout(poll, delay);
      })
      .catch((err) => {
        if (cancelled) return;
        const code = err?.message || "";
        if (code === "not_guild_member" || code === "channel_access_denied") {
          setGuildMessages([]);
          setGuildLoaded(true);
          setGuildName("");
          setGuildError(chatErrorText(code));
          if (onGuildUnreadRef.current) onGuildUnreadRef.current(characterId, false);
          return;
        }
        setPollError(true);
        delay = 5000;
        pollTimerRef.current = setTimeout(poll, delay);
      });

    return () => {
      cancelled = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [tab, activeConversation, url, characterId]);

  const handleSendGuild = () => {
    const text = guildInput.trim();
    if (!text || guildSending || guildSendLockRef.current) return;
    guildSendLockRef.current = true;
    setGuildSending(true); setGuildError("");
    if (!guildNonceRef.current || guildNonceRef.current.text !== text) {
      const nonce = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      guildNonceRef.current = { text, nonce };
    }
    cloudSendGuildMessage(url, characterId, text, guildNonceRef.current.nonce).then(async (res) => {
      setGuildSending(false);
      guildSendLockRef.current = false;
      if (!res || res.error) { setGuildError(chatErrorText(res && res.error)); return; }
      guildNonceRef.current = null;
      setGuildInput("");
      setGuildMessages((prev) => prev.some(message => Number(message.id) === Number(res.id)) ? prev : [...prev, { id: res.id, characterId, name: characterName, text, createdAt: res.createdAt }]);
      if (res.id > lastGuildIdRef.current) lastGuildIdRef.current = res.id;
      await cloudMarkGuildChatRead(url, characterId);
      if (onGuildUnreadRef.current) onGuildUnreadRef.current(characterId, false);
    }).catch(() => { setGuildSending(false); guildSendLockRef.current = false; setGuildError(chatErrorText("network_error")); });
  };

  const handleSendGlobal = () => {
    const text = globalInput.trim();
    if (!text || globalSending) return;
    setGlobalSending(true);
    setGlobalError("");
    // §3 — one nonce per logical send attempt; the server dedupes retries of this exact
    // attempt against it (see workers' handleSendGlobalMessage), so a lost response +
    // resend (or the client's own retry layer) can't create a duplicate message.
    const nonce = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cloudSendGlobalMessage(url, characterId, text, nonce).then((res) => {
      setGlobalSending(false);
      if (!res || res.error) { setGlobalError(chatErrorText(res && res.error)); return; }
      setGlobalInput("");
      setGlobalMessages((prev) => [...prev, { id: res.id, characterId, name: characterName, text, createdAt: res.createdAt }]);
      lastGlobalIdRef.current = res.id;
    }).catch(() => { setGlobalSending(false); setGlobalError(chatErrorText("network_error")); });
  };

  const handleSendDirect = () => {
    const text = threadInput.trim();
    if (!text || threadSending || !activeConversation || !threadCanSend) return;
    setThreadSending(true);
    setThreadError("");
    const nonce = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cloudSendDirectMessage(url, characterId, activeConversation.characterId, text, nonce).then((res) => {
      setThreadSending(false);
      if (!res || res.error) { setThreadError(chatErrorText(res && res.error)); return; }
      setThreadInput("");
      setThreadMessages((prev) => [...prev, { id: res.id, characterId, name: characterName, text, createdAt: res.createdAt }]);
      lastThreadIdRef.current = res.id;
    }).catch(() => { setThreadSending(false); setThreadError(chatErrorText("network_error")); });
  };

  const openConversation = (conv) => {
    setThreadMessages([]);
    setThreadLoaded(false);
    setThreadError("");
    setActiveConversation({ characterId: conv.characterId, name: conv.name });
  };

  const bubble = (m) => e("div", {
    key: m.id,
    className: "md-shop-row",
    style: { flexDirection: "column", alignItems: m.characterId === characterId ? "flex-end" : "flex-start" }
  },
    m.characterId !== characterId && e("div", { className: "md-sub md-chat-sender" , style: { margin: 0 } },
      e(PlayerCardTrigger, { characterId: m.characterId, name: m.name, level: m.level, onOpenPlayerCard })
    ),
    e("div", { className: "md-shop-info", style: { whiteSpace: "pre-wrap", wordBreak: "break-word" } }, m.text));

  const messageList = (messages, loaded, emptyText) => {
    if (!loaded) return e("p", { className: "md-sub" }, "กำลังโหลด...");
    if (!messages.length) return e("p", { className: "md-sub" }, emptyText);
    return e("div", { className: "md-inv-list" }, messages.map(bubble));
  };

  const globalPane = () => e(React.Fragment, null,
    e("div", { className: "md-card", style: { marginBottom: 10, overflowY: "auto", minHeight: 0, flex: 1 } },
      messageList(globalMessages, globalLoaded, "ยังไม่มีข้อความ")),
    pollError && e("p", { className: "md-sub" }, "การเชื่อมต่อไม่เสถียร กำลังลองใหม่..."),
    globalError && e("p", { className: "md-sub" }, globalError),
    e("div", { className: "md-card", style: { display: "flex", gap: 6 } },
      e("input", {
        className: "md-field",
        style: { flex: 1 },
        placeholder: "พิมพ์ข้อความ... (สูงสุด 200 ตัวอักษร)",
        value: globalInput,
        maxLength: 200,
        onChange: (ev) => setGlobalInput(ev.target.value),
        onKeyDown: (ev) => { if (ev.key === "Enter") handleSendGlobal(); },
      }),
      e("button", { className: "md-btn small primary", disabled: globalSending || !globalInput.trim(), onClick: handleSendGlobal }, "ส่ง")));

  const guildPane = () => e(React.Fragment, null,
    guildName && e("p", { className: "md-sub", style: { margin: "0 0 6px" } }, `🏰 ${guildName}`),
    e("div", { className: "md-card", style: { marginBottom: 10, overflowY: "auto", minHeight: 0, flex: 1 } },
      messageList(guildMessages, guildLoaded, "ยังไม่มีข้อความในกิลด์")),
    pollError && e("p", { className: "md-sub" }, "การเชื่อมต่อไม่เสถียร กำลังลองใหม่..."),
    guildError && e("p", { className: "md-sub", role: "alert" }, guildError),
    guildLoaded && guildError === chatErrorText("not_guild_member") ? null : e("div", { className: "md-card", style: { display: "flex", gap: 6 } },
      e("input", { className: "md-field", style: { flex: 1, minWidth: 0 }, placeholder: "พิมพ์ข้อความ... (สูงสุด 300 ตัวอักษร)", value: guildInput, maxLength: 300,
        onChange: (ev) => { setGuildInput(ev.target.value); if (guildNonceRef.current?.text !== ev.target.value.trim()) guildNonceRef.current = null; },
        onKeyDown: (ev) => { if (ev.key === "Enter") handleSendGuild(); } }),
      e("button", { className: "md-btn small primary", disabled: guildSending || !guildInput.trim(), onClick: handleSendGuild }, "ส่ง")));

  const conversationListPane = () => {
    if (conversations === null) return e("p", { className: "md-sub" }, "กำลังโหลด...");
    if (!conversations.length) return e("p", { className: "md-sub" }, "ยังไม่มีการสนทนา — เริ่มแชทได้จากหน้าเพื่อน");
    return e("div", { className: "md-card", style: { overflowY: "auto", minHeight: 0, flex: 1 } },
      e("div", { className: "md-inv-list" }, conversations.map((c) => e("div", {
        key: c.characterId,
        className: "md-shop-row",
        style: { cursor: "pointer" },
        onClick: () => openConversation(c),
      },
          e("div", { className: "md-shop-info" },
          e(PlayerCardTrigger, { characterId: c.characterId, name: `${c.online ? "🟢" : "⚪"} ${c.name}`, level: c.level, onOpenPlayerCard }), c.unread && e("span", { style: { marginLeft: 6 } }, "🔴"),
          e("div", { className: "md-sub", style: { margin: "2px 0 0" } }, `${c.lastSenderIsMe ? "คุณ: " : ""}${c.lastMessage || ""}`)),
      ))));
  };

  const threadPane = () => e(React.Fragment, null,
    e("div", { className: "md-card", style: { marginBottom: 10, overflowY: "auto", minHeight: 0, flex: 1 } },
      messageList(threadMessages, threadLoaded, "ยังไม่มีข้อความ — ส่งข้อความแรกได้เลย")),
    pollError && e("p", { className: "md-sub" }, "การเชื่อมต่อไม่เสถียร กำลังลองใหม่..."),
    !threadCanSend && e("p", { className: "md-sub" }, "ไม่สามารถส่งข้อความได้ในขณะนี้ (ไม่ได้เป็นเพื่อนหรือมีการบล็อก)"),
    threadError && e("p", { className: "md-sub" }, threadError),
    e("div", { className: "md-card", style: { display: "flex", gap: 6 } },
      e("input", {
        className: "md-field",
        style: { flex: 1 },
        placeholder: "พิมพ์ข้อความ... (สูงสุด 300 ตัวอักษร)",
        value: threadInput,
        maxLength: 300,
        disabled: !threadCanSend,
        onChange: (ev) => setThreadInput(ev.target.value),
        onKeyDown: (ev) => { if (ev.key === "Enter") handleSendDirect(); },
      }),
      e("button", { className: "md-btn small primary", disabled: threadSending || !threadInput.trim() || !threadCanSend, onClick: handleSendDirect }, "ส่ง")));

  const stickerPane = () => e("div", { className: "md-card", style: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" } },
    e("p", { className: "md-sub" }, "😄 สติกเกอร์ — เร็วๆ นี้"));

  return e("div", { className: "md-panel md-chat-page" },
    e("div", { className: "md-card", style: { marginBottom: 10 } },
      e("p", { className: "md-title" }, "💬 แชท")),
    e("div", { style: { display: "flex", gap: 6, marginBottom: 8 } },
      CHAT_TABS.map((t) => e("button", {
        key: t.key,
        className: "md-btn small" + (tab === t.key ? " primary" : " flee"),
        style: { flex: 1 },
        onClick: () => { setTab(t.key); if (t.key !== "direct") setActiveConversation(null); if (onChannelChange && t.key !== "sticker") onChannelChange(t.key); },
      }, t.label, t.key === "guild" && guildUnread ? " 🔴" : ""))),
    tab === "global" && globalPane(),
    tab === "guild" && guildPane(),
    tab === "direct" && (activeConversation ? threadPane() : conversationListPane()),
    tab === "sticker" && stickerPane(),
    e(BackButton, { onClick: () => (tab === "direct" && activeConversation) ? setActiveConversation(null) : onBack() }),
    e(GameDock, { onCharacter, onOpenInv, onPets, onSettings, onSave, onFriend, onGuild, onMainHub }));
}
// ---------- Phase 6.4: Guild System V1 Core ----------
function guildErrorText(error) {
  const map = {
    invalid_session: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    session_expired: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    session_replaced: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
    guild_create_level_too_low: "ต้องมีเลเวล 30 ขึ้นไปจึงจะสร้างกิลด์ได้",
    invalid_guild_name: "ชื่อกิลด์ต้องมี 3-20 ตัวอักษร และห้ามมีอักขระควบคุม",
    invalid_join_policy: "นโยบายการรับสมาชิกไม่ถูกต้อง",
    guild_name_taken: "มีกิลด์ชื่อนี้อยู่แล้ว",
    already_in_guild: "อยู่ในกิลด์อื่นอยู่แล้ว",
    guild_not_found: "ไม่พบกิลด์นี้",
    guild_closed: "กิลด์นี้ปิดรับสมัคร",
    guild_full: "กิลด์เต็มแล้ว",
    application_limit_reached: "ส่งคำขอเข้ากิลด์ค้างไว้ครบจำนวนสูงสุดแล้ว (5 คำขอ)",
    application_already_exists: "สมัครกิลด์นี้ไปแล้ว",
    application_not_pending: "คำขอนี้ถูกดำเนินการไปแล้ว",
    application_not_found: "ไม่พบคำขอนี้",
    not_guild_member: "ไม่ได้เป็นสมาชิกกิลด์นี้",
    invalid_quantity: "จำนวนที่บริจาคต้องอยู่ระหว่าง 1–999",
    donation_item_not_allowed: "ไอเท็มชนิดนี้ไม่สามารถบริจาคได้",
    item_not_found: "ไม่พบไอเท็มในกระเป๋า",
    insufficient_quantity: "จำนวนไอเท็มไม่เพียงพอ",
    item_equipped: "ไอเท็มที่สวมใส่อยู่บริจาคไม่ได้",
    item_locked: "ปลดล็อกไอเท็มก่อนบริจาค",
    donation_conflict: "ข้อมูลเปลี่ยนระหว่างทำรายการ กรุณาลองอีกครั้ง",
    not_guild_leader: "ต้องเป็นหัวหน้ากิลด์เท่านั้น",
    target_not_guild_member: "ผู้เล่นนี้ไม่ได้อยู่ในกิลด์",
    leader_must_transfer_first: "ต้องโอนตำแหน่งหัวหน้าก่อนออกจากกิลด์",
    invalid_target: "เป้าหมายไม่ถูกต้อง",
    server_error: "ระบบกิลด์ขัดข้อง กรุณาลองใหม่",
  };
  return map[error] || "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
const GUILD_CREATE_MIN_LEVEL_CLIENT = 30; // display only — server (GUILD_CREATE_MIN_LEVEL) is authoritative
const GUILD_JOIN_POLICY_OPTIONS = [
  { value: "open", label: "เปิดรับ" },
  { value: "application", label: "ต้องสมัคร" },
  { value: "closed", label: "ปิดรับ" },
];
function GuildScreen({
  serverUrl,
  characterId,
  characterLevel,
  onCharacter,
  onOpenInv,
  onPets,
  onSettings,
  onSave,
  onFriend,
  onChat,
  guildUnread = false,
  onRefreshGuildChatStatus,
  onBack,
  inventory = [],
  onBeforeDonate,
  onRefreshInventory,
  onDonationCommitted,
  onMainHub
}) {
  const e = React.createElement;
  const url = serverUrl || DEFAULT_SERVER_URL;
  const [myGuild, setMyGuild] = useState(undefined); // undefined=loading, null=none, object=profile
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [myApplications, setMyApplications] = useState(null);
  const [applications, setApplications] = useState(null); // leader's pending-applications view
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [createError, setCreateError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [toast, setToast] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsDesc, setSettingsDesc] = useState("");
  const [settingsPolicy, setSettingsPolicy] = useState("open");
  const [settingsError, setSettingsError] = useState("");
  const [donateJunkId, setDonateJunkId] = useState("");
  const [donateQuantity, setDonateQuantity] = useState(1);
  const [donationError, setDonationError] = useState("");
  const [donationResult, setDonationResult] = useState(null);
  const [pendingDonationId, setPendingDonationId] = useState("");
  const eligibleDonations = React.useMemo(() => {
    const allowed = new Set(["stone", "grass", "wood"]);
    const byId = new Map();
    (inventory || []).forEach(item => {
      const junkId = inventoryItemJunkId(item);
      if (inventoryItemType(item) !== "junk" || !allowed.has(junkId) || inventoryItemLocked(item)) return;
      const current = byId.get(junkId) || { junkId, quantity: 0, name: item.name || junkId, icon: item.icon || "📦" };
      current.quantity += inventoryItemQuantity(item);
      byId.set(junkId, current);
    });
    return Array.from(byId.values());
  }, [inventory]);
  React.useEffect(() => {
    if (!eligibleDonations.some(item => item.junkId === donateJunkId)) {
      setDonateJunkId(eligibleDonations[0]?.junkId || "");
      setDonateQuantity(1);
      setPendingDonationId("");
    }
  }, [eligibleDonations, donateJunkId]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast((t) => (t === msg ? "" : t)), 2200); };

  const loadMyGuild = React.useCallback(() => {
    setLoadError("");
    cloudGetMyGuild(url, characterId).then((res) => {
      if (!res || res.error) { setLoadError(guildErrorText(res && res.error)); setMyGuild(null); return; }
      setMyGuild(res.guild);
      if (onRefreshGuildChatStatus) onRefreshGuildChatStatus(characterId);
      if (res.guild && res.guild.viewerRole === "leader") {
        cloudGetGuildApplications(url, characterId, res.guild.guildId).then((r) => setApplications(r && r.applications ? r.applications : []));
      } else {
        setApplications(null);
      }
    }).catch(() => { setLoadError(guildErrorText("network_error")); setMyGuild(null); });
  }, [url, characterId, onRefreshGuildChatStatus]);

  React.useEffect(() => { loadMyGuild(); }, [loadMyGuild]);

  React.useEffect(() => {
    if (!myGuild || !onRefreshGuildChatStatus) return;
    let cancelled = false;
    let timer = null;
    const refresh = async () => {
      await onRefreshGuildChatStatus(characterId);
      if (!cancelled) timer = setTimeout(refresh, 5000);
    };
    timer = setTimeout(refresh, 5000);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [myGuild?.guildId, characterId, onRefreshGuildChatStatus]);

  React.useEffect(() => {
    if (myGuild) return; // only relevant when browsing without a Guild
    cloudGetMyApplications(url, characterId).then((res) => setMyApplications(res && res.applications ? res.applications : []));
  }, [myGuild, url, characterId]);

  React.useEffect(() => {
    if (myGuild) return;
    const handle = setTimeout(() => {
      cloudSearchGuilds(url, characterId, query.trim()).then((res) => setSearchResults(res && res.guilds ? res.guilds : []));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, myGuild, url, characterId]);

  const runAction = (key, promise, onSuccess) => {
    if (busyKey) return;
    setBusyKey(key);
    promise.then((res) => {
      setBusyKey("");
      if (!res || res.error) { showToast(guildErrorText(res && res.error)); return; }
      if (onSuccess) onSuccess(res);
    }).catch(() => { setBusyKey(""); showToast(guildErrorText("network_error")); });
  };

  const refreshMyApplications = () => cloudGetMyApplications(url, characterId).then((r) => setMyApplications(r && r.applications ? r.applications : []));

  const handleJoin = (guildId) => runAction(`join:${guildId}`, cloudRequestGuildJoin(url, characterId, guildId), (res) => {
    showToast(res.status === "joined" ? "เข้าร่วมกิลด์แล้ว!" : "ส่งคำขอเข้ากิลด์แล้ว");
    loadMyGuild();
    refreshMyApplications();
  });
  const handleCancelApplication = (applicationId) => runAction(`cancelapp:${applicationId}`, cloudCancelGuildApplication(url, characterId, applicationId), () => {
    setMyApplications((prev) => (prev || []).filter((a) => a.applicationId !== applicationId));
  });
  const handleCreateGuild = () => {
    const name = createName.trim();
    if (!name || busyKey) return;
    setBusyKey("create");
    setCreateError("");
    cloudCreateGuild(url, characterId, name, createDesc.trim()).then((res) => {
      setBusyKey("");
      if (!res || res.error) { setCreateError(guildErrorText(res && res.error)); return; }
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      loadMyGuild();
    }).catch(() => { setBusyKey(""); setCreateError(guildErrorText("network_error")); });
  };
  const handleAcceptApplication = (applicationId) => runAction(`accept:${applicationId}`, cloudAcceptGuildApplication(url, characterId, applicationId), () => {
    setApplications((prev) => (prev || []).filter((a) => a.applicationId !== applicationId));
    loadMyGuild();
  });
  const handleRejectApplication = (applicationId) => runAction(`reject:${applicationId}`, cloudRejectGuildApplication(url, characterId, applicationId), () => {
    setApplications((prev) => (prev || []).filter((a) => a.applicationId !== applicationId));
  });
  const handleLeave = () => runAction("leave", cloudLeaveGuild(url, characterId), () => { setMyGuild(null); loadMyGuild(); });
  const handleKick = (targetCharacterId) => runAction(`kick:${targetCharacterId}`, cloudKickGuildMember(url, characterId, targetCharacterId), () => loadMyGuild());
  const handleTransfer = (targetCharacterId) => runAction(`transfer:${targetCharacterId}`, cloudTransferGuildLeadership(url, characterId, targetCharacterId), () => loadMyGuild());
  const handleDisband = () => runAction("disband", cloudDisbandGuild(url, characterId), () => setMyGuild(null));
  const openSettings = () => {
    setSettingsDesc((myGuild && myGuild.description) || "");
    setSettingsPolicy((myGuild && myGuild.joinPolicy) || "open");
    setSettingsError("");
    setShowSettings(true);
  };
  const handleUpdateSettings = () => {
    if (busyKey) return;
    setBusyKey("settings");
    setSettingsError("");
    cloudUpdateGuildSettings(url, characterId, settingsDesc.trim(), settingsPolicy).then((res) => {
      setBusyKey("");
      if (!res || res.error) { setSettingsError(guildErrorText(res && res.error)); return; }
      setShowSettings(false);
      loadMyGuild();
    }).catch(() => { setBusyKey(""); setSettingsError(guildErrorText("network_error")); });
  };
  const handleDonate = async () => {
    if (busyKey || !donateJunkId) return;
    const available = eligibleDonations.find(item => item.junkId === donateJunkId)?.quantity || 0;
    const quantity = Math.max(1, Math.min(999, Number(donateQuantity) || 1, available));
    setBusyKey("donate");
    setDonationError("");
    try {
      const persistenceReady = onBeforeDonate ? await onBeforeDonate(characterId) : true;
      if (!persistenceReady) {
        setDonationError("บันทึกกระเป๋าล่าสุดยังไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง");
        return;
      }
      const donationId = pendingDonationId || (globalThis.crypto?.randomUUID?.() || `donation-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      setPendingDonationId(donationId);
      const result = await cloudDonateGuildItem(url, characterId, donateJunkId, quantity, donationId);
      if (!result || result.error) { setDonationError(guildErrorText(result && result.error)); return; }
      setPendingDonationId("");
      setDonationResult(result);
      setDonateQuantity(1);
      const remainingQuantity = Number(result.remainingQuantity);
      if (Number.isFinite(remainingQuantity) && remainingQuantity >= 0) {
        onDonationCommitted?.(donateJunkId, quantity, remainingQuantity);
      } else if (onRefreshInventory) {
        // Mark reads started while the donation POST was in flight as stale before issuing
        // a uniquely keyed authoritative refresh.
        onDonationCommitted?.(donateJunkId, quantity, undefined);
        await onRefreshInventory();
      }
      loadMyGuild();
    } catch (_) {
      setDonationError("เชื่อมต่อ Server ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      setBusyKey("");
    }
  };

  const actionBtn = (label, onClick, variant, disabled) => e("button", {
    className: `md-btn small ${variant || "info"}`,
    disabled: !!disabled,
    onClick,
  }, label);

  const row = (key, left, right) => e("div", { key, className: "md-shop-row" },
    e("div", { className: "md-shop-info" }, left),
    e("div", { style: { display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" } }, right));

  const joinPolicyLabel = (policy) => (policy === "open" ? "เปิดรับ" : policy === "application" ? "ต้องสมัคร" : "ปิดรับ");
  const appliedGuildIds = new Set((myApplications || []).map((a) => a.guildId));

  const noGuildView = () => {
    const searchBody = !searchResults
      ? e("p", { className: "md-sub" }, "กำลังโหลด...")
      : !searchResults.length
        ? e("p", { className: "md-sub" }, "ไม่พบกิลด์")
        : e("div", { className: "md-inv-list" }, searchResults.map((g) => {
          let action;
          if (g.joinPolicy === "closed") action = actionBtn("ปิดรับ", null, "info", true);
          else if (appliedGuildIds.has(g.guildId)) action = actionBtn("สมัครแล้ว", null, "info", true);
          else action = actionBtn(g.joinPolicy === "open" ? "เข้าร่วม" : "สมัคร", () => handleJoin(g.guildId), "primary", busyKey === `join:${g.guildId}`);
          return row(g.guildId, `${g.name} (Lv.${g.level}) — ${g.memberCount}/${g.memberCap} — ${joinPolicyLabel(g.joinPolicy)}`, [action]);
        }));

    const applicationsCard = (myApplications && myApplications.length > 0) ? e("div", { className: "md-card", style: { marginBottom: 10 } },
      e("p", { className: "md-sub", style: { margin: "0 0 4px" } }, "คำขอที่ส่งไป"),
      e("div", { className: "md-inv-list" }, myApplications.map((a) => row(a.applicationId,
        `${a.guildName} (Lv.${a.guildLevel})`,
        [actionBtn("ยกเลิก", () => handleCancelApplication(a.applicationId), "flee", busyKey === `cancelapp:${a.applicationId}`)])))) : null;

    const createCard = !showCreate
      ? e("button", {
        className: "md-btn primary wide small",
        disabled: Number(characterLevel || 0) < GUILD_CREATE_MIN_LEVEL_CLIENT,
        onClick: () => setShowCreate(true),
      }, Number(characterLevel || 0) < GUILD_CREATE_MIN_LEVEL_CLIENT ? "สร้างกิลด์ (ต้องเลเวล 30+)" : "สร้างกิลด์")
      : e(React.Fragment, null,
        e("input", { className: "md-field", style: { width: "100%", marginBottom: 6 }, placeholder: "ชื่อกิลด์ (3-20 ตัวอักษร)", value: createName, maxLength: 20, onChange: (ev) => setCreateName(ev.target.value) }),
        e("input", { className: "md-field", style: { width: "100%", marginBottom: 6 }, placeholder: "คำอธิบาย (ไม่บังคับ)", value: createDesc, maxLength: 200, onChange: (ev) => setCreateDesc(ev.target.value) }),
        createError && e("p", { className: "md-sub" }, createError),
        e("div", { style: { display: "flex", gap: 6 } },
          actionBtn("ยืนยัน", handleCreateGuild, "primary", busyKey === "create" || !createName.trim()),
          actionBtn("ยกเลิก", () => { setShowCreate(false); setCreateError(""); }, "flee", false)));

    return e(React.Fragment, null,
      e("div", { className: "md-card", style: { marginBottom: 10 } },
        e("input", {
          className: "md-field",
          style: { width: "100%" },
          placeholder: "ค้นหาชื่อกิลด์...",
          value: query,
          onChange: (ev) => setQuery(ev.target.value),
        })),
      e("div", { className: "md-card", style: { marginBottom: 10, overflowY: "auto", minHeight: 0, flex: 1 } }, searchBody),
      applicationsCard,
      e("div", { className: "md-card" }, createCard));
  };

  const memberView = () => {
    const g = myGuild;
    const isLeader = g.viewerRole === "leader";

    const applicationsCard = (isLeader && applications && applications.length > 0) ? e("div", { className: "md-card", style: { marginBottom: 10 } },
      e("p", { className: "md-sub", style: { margin: "0 0 4px" } }, "คำขอเข้ากิลด์"),
      e("div", { className: "md-inv-list" }, applications.map((a) => row(a.applicationId,
        `${a.online ? "🟢" : "⚪"} ${a.name} (Lv.${a.level})`,
        [
          actionBtn("ยอมรับ", () => handleAcceptApplication(a.applicationId), "primary", busyKey === `accept:${a.applicationId}`),
          actionBtn("ปฏิเสธ", () => handleRejectApplication(a.applicationId), "flee", busyKey === `reject:${a.applicationId}`),
        ])))) : null;

    const memberRows = g.members.map((m) => {
      const actions = (isLeader && m.characterId !== characterId) ? [
        actionBtn("โอนหัวหน้า", () => handleTransfer(m.characterId), "info", busyKey === `transfer:${m.characterId}`),
        actionBtn("เตะออก", () => handleKick(m.characterId), "flee", busyKey === `kick:${m.characterId}`),
      ] : [];
      return row(m.characterId, `${m.online ? "🟢" : "⚪"} ${m.role === "leader" ? "👑 " : ""}${m.name} (Lv.${m.level})`, actions);
    });

    const selectedDonation = eligibleDonations.find(item => item.junkId === donateJunkId);
    const donationCard = e("div", { className: "md-card", style: { marginBottom: 10 } },
      e("p", { className: "md-title", style: { margin: "0 0 5px" } }, "🎁 บริจาคทรัพยากร"),
      e("p", { className: "md-sub", style: { margin: "0 0 8px" } }, `กิลด์ Lv.${g.level} · EXP ${Number(g.exp || 0).toLocaleString()}${g.atCap ? " (เต็มแล้ว)" : ` · อีก ${Number(g.expToNext || 0).toLocaleString()} EXP`} · Contribution ${g.members.find(m => m.characterId === characterId)?.contribution || 0}`),
      !g.atCap && e("div", { style: { height: 7, borderRadius: 8, background: "rgba(255,255,255,.16)", margin: "-2px 0 8px", overflow: "hidden" } },
        e("div", { style: { height: "100%", width: `${Math.max(0, Math.min(100, 100 * Number(g.expProgress || 0) / Math.max(1, Number(g.expRequired || 1))))}%`, background: "#64d9ff" } })),
      eligibleDonations.length ? e("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
        e("select", { className: "md-field", value: donateJunkId, disabled: !!pendingDonationId || busyKey === "donate", onChange: ev => { setDonateJunkId(ev.target.value); setDonateQuantity(1); setPendingDonationId(""); }, style: { flex: "1 1 120px", minWidth: 0 } }, eligibleDonations.map(item => e("option", { key: item.junkId, value: item.junkId }, `${item.icon} ${item.name} · ${item.quantity} ชิ้น`))),
        e("input", { className: "md-field", type: "number", inputMode: "numeric", min: 1, max: Math.min(999, selectedDonation?.quantity || 1), value: donateQuantity, disabled: !!pendingDonationId || busyKey === "donate", onChange: ev => { setDonateQuantity(ev.target.value); setPendingDonationId(""); }, style: { width: 88 } }),
        actionBtn(busyKey === "donate" ? "กำลังบริจาค…" : "บริจาค", handleDonate, "primary", busyKey === "donate" || !selectedDonation || donateQuantity < 1 || donateQuantity > Math.min(999, selectedDonation?.quantity || 0)))
        : e("p", { className: "md-sub" }, "ไม่มีหิน หญ้า หรือไม้ที่ปลดล็อกอยู่ในกระเป๋า"),
      donationError && e("p", { className: "md-sub", role: "alert" }, donationError),
      donationResult && e("p", { className: "md-sub", role: "status" }, `บริจาค ${donationResult.quantity} ชิ้น · กิลด์ +${donationResult.guildExpGranted} EXP · Contribution ${donationResult.member?.contribution ?? donationResult.contributionGranted}`));

    const footerBtn = isLeader
      ? actionBtn("ยุบกิลด์", handleDisband, "flee", busyKey === "disband")
      : actionBtn("ออกจากกิลด์", handleLeave, "flee", busyKey === "leave");

    const settingsCard = isLeader ? (
      showSettings
        ? e("div", { className: "md-card", style: { marginBottom: 10 } },
          e("input", { className: "md-field", style: { width: "100%", marginBottom: 6 }, placeholder: "คำอธิบาย (ไม่บังคับ)", value: settingsDesc, maxLength: 200, onChange: (ev) => setSettingsDesc(ev.target.value) }),
          e("div", { style: { display: "flex", gap: 6, marginBottom: 6 } }, GUILD_JOIN_POLICY_OPTIONS.map((opt) => actionBtn(opt.label, () => setSettingsPolicy(opt.value), settingsPolicy === opt.value ? "primary" : "flee", false))),
          settingsError && e("p", { className: "md-sub" }, settingsError),
          e("div", { style: { display: "flex", gap: 6 } },
            actionBtn("บันทึก", handleUpdateSettings, "primary", busyKey === "settings"),
            actionBtn("ยกเลิก", () => setShowSettings(false), "flee", false)))
        : e("div", { className: "md-card", style: { marginBottom: 10 } },
          actionBtn("⚙️ ตั้งค่ากิลด์", openSettings, "info", false))
    ) : null;

    return e(React.Fragment, null,
      e("div", { className: "md-card", style: { marginBottom: 10 } },
        e("p", { className: "md-title" }, `🏰 ${g.name}`),
        e("p", { className: "md-sub" }, g.description || "ไม่มีคำอธิบาย"),
        e("p", { className: "md-sub" }, `Lv.${g.level} — ${g.memberCount}/${g.memberCap} สมาชิก — ${joinPolicyLabel(g.joinPolicy)}`),
        e("button", { className: "md-btn info small", onClick: onChat }, "💬 แชทกิลด์", guildUnread ? " 🔴" : "")),
      settingsCard,
      donationCard,
      applicationsCard,
      e("div", { className: "md-card", style: { marginBottom: 10, overflowY: "auto", minHeight: 0, flex: 1 } },
        e("div", { className: "md-inv-list" }, memberRows)),
      e("div", { className: "md-card", style: { display: "flex", gap: 6 } }, footerBtn));
  };

  return e("div", { className: "md-panel md-guild-page" },
    toast && e("div", { className: "md-toast" }, toast),
    myGuild === undefined ? e("div", { className: "md-card" }, e("p", { className: "md-sub" }, "กำลังโหลด..."))
      : loadError ? e("div", { className: "md-card" }, e("p", { className: "md-sub" }, loadError))
        : myGuild ? memberView() : noGuildView(),
    e(BackButton, { onClick: onBack }),
    e(GameDock, { onCharacter, onOpenInv, onPets, onSettings, onSave, onFriend, onChat, onMainHub }));
}
// ---------- Phase 3: Raid Boss ----------
const RAID_STAMINA_MAX_CLIENT = 10; // fallback only — server response's staminaMax is authoritative
function RaidBossCard({
  boss,
  bossSpriteConfig,
  hurtToken,
  onHurtComplete,
  isDead
}) {
  return /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10, textAlign: "center" } },
    /*#__PURE__*/React.createElement("p", { className: "md-title" }, boss.name || "Raid Boss"),
    /*#__PURE__*/React.createElement(RaidBossFrameSprite, {
      config: bossSpriteConfig,
      hurtToken,
      className: "md-raid-boss-sprite",
      alt: boss.name || "Raid Boss",
      onHurtComplete
    }),
    isDead && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "บอสตายแล้ว! กำลังจะมีตัวใหม่มา"));
}


function RaidAttackActions({
  supportsStamina,
  outOfStamina,
  attacking,
  hurtPlaying,
  isDead,
  canAffordRefill,
  me,
  onAttack
}) {
  return /*#__PURE__*/React.createElement(React.Fragment, null,
    (!outOfStamina || !supportsStamina) && /*#__PURE__*/React.createElement("button", {
      className: "md-btn attack wide",
      style: { marginTop: 8 },
      disabled: attacking || hurtPlaying || isDead || (!supportsStamina && outOfStamina),
      onClick: () => onAttack(false)
    }, attacking ? "กำลังโจมตี..." : "⚔️ โจมตี"),
    supportsStamina && outOfStamina && /*#__PURE__*/React.createElement("button", {
      className: "md-btn attack wide",
      style: { marginTop: 8 },
      disabled: attacking || hurtPlaying || isDead || !canAffordRefill,
      onClick: () => onAttack(true)
    }, attacking ? "กำลังโจมตี..." : /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement(GameIcon, {
        category: "currency",
        iconKey: "diamond",
        fallback: "💎",
        className: "md-game-icon md-inline-item-icon",
        alt: "Diamond"
      }),
      ` จ่าย ${me.diamondRefillCost} เพชรเพื่อโจมตี`)));
}

function RaidPlayerStatus({
  supportsStamina,
  me,
  outOfStamina,
  mm,
  ss,
  legacyAttemptsLeft,
  lastResult,
  attacking,
  hurtPlaying,
  isDead,
  canAffordRefill,
  onAttack
}) {
  return /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
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
    lastResult && !lastResult.error && lastResult.petDamage > 0 && /*#__PURE__*/React.createElement("p", {
      className: "md-sub",
      style: { color: lastResult.petCrit ? "#FFD166" : undefined }
    }, "🐾 pet ", lastResult.petCrit ? "💥 " : "", formatNumber(lastResult.petDamage)),
    lastResult && lastResult.error && /*#__PURE__*/React.createElement("p", { className: "md-sub" },
      lastResult.error === "boss_already_dead" ? "บอสตายแล้ว รอตัวใหม่"
        : lastResult.error === "no_attempts_left" ? "หมดจำนวนครั้งโจมตีวันนี้แล้ว"
        : lastResult.error === "no_stamina" ? "พลัง Raid หมดแล้ว กรุณารอให้ฟื้น"
        : lastResult.error === "stamina_conflict" ? "พลัง Raid มีการเปลี่ยนแปลง กรุณากดใหม่"
        : lastResult.error === "insufficient_diamonds" ? "เพชรไม่พอสำหรับโจมตี"
        : lastResult.error === "network_error" ? "เชื่อมต่อ Raid ไม่สำเร็จ กรุณาลองใหม่"
        : lastResult.error),
    /*#__PURE__*/React.createElement(RaidAttackActions, {
      supportsStamina,
      outOfStamina,
      attacking,
      hurtPlaying,
      isDead,
      canAffordRefill,
      me,
      onAttack
    }));
}

function RaidMilestonePanel({ me, milestoneSpecials }) {
  return /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
    /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 14 } }, "ดาเมจสะสม (ทุก 5% ได้เพชร, ทุก 10% ได้วัตถุดิบ — แจกอัตโนมัติ)"),
    /*#__PURE__*/React.createElement("div", { className: "md-bar-track" },
      /*#__PURE__*/React.createElement("div", {
        className: "md-bar-fill",
        style: { width: `${me.contributionPct}%`, background: "linear-gradient(90deg,#6EC6FF,#4A7CFF)" }
      })),
    /*#__PURE__*/React.createElement("div", { className: "md-bar-label" }, me.contributionPct, "%"),
    milestoneSpecials.length === 0 && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "(อัปเดต server แล้วรายละเอียดจะขึ้นตรงนี้)"),
    milestoneSpecials.map(m => {
      const key = `p${m.pct}`;
      const done = me.contributionPct >= m.pct;
      const claimed = me.milestonesClaimed.indexOf(key) !== -1;
      return /*#__PURE__*/React.createElement("div", { key: m.pct, className: "md-shop-row" },
        /*#__PURE__*/React.createElement("div", { className: "md-shop-info" }, m.pct, "% — ", m.label),
        /*#__PURE__*/React.createElement("div", { className: "md-shop-lv" }, claimed ? "✅ ส่งแล้ว" : done ? "⏳ กำลังส่ง..." : "🔒"));
    }));
}

function RankRow({ rowKey, medal, name, isMe, value }) {
  return /*#__PURE__*/React.createElement("div", {
    key: rowKey,
    className: "md-shop-row",
    style: isMe ? { background: "rgba(255,215,0,0.12)", borderRadius: 8 } : undefined
  }, /*#__PURE__*/React.createElement("div", { className: "md-shop-info" }, medal, " ", name || "?", isMe ? " (คุณ)" : ""),
     /*#__PURE__*/React.createElement("div", { className: "md-shop-lv" }, value));
}

function RaidRanking({ rows, characterId }) {
  return /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10 } },
    /*#__PURE__*/React.createElement("p", { className: "md-title", style: { fontSize: 14 } }, "อันดับดาเมจ"),
    rows.map((row, idx) => /*#__PURE__*/React.createElement(RankRow, {
      key: row.character_id,
      rowKey: row.character_id,
      medal: idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`,
      name: row.name,
      isMe: row.character_id === characterId,
      value: formatNumber(row.total_contribution)
    })));
}

function RaidScreen({
  serverUrl,
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
  const [pendingPetHit, setPendingPetHit] = useState(false);
  const attackRequestIdRef = useRef(null);

  const load = React.useCallback(() => {
    setError(null);
    cloudGetRaidStatus(serverUrl || DEFAULT_SERVER_URL, characterId).then(res => {
      if (!res || res.error) { setError("โหลดข้อมูล Raid ไม่สำเร็จ"); return; }
      setStatus(res);
      setSecondsLeft((res.me && res.me.staminaRegenSeconds) || 0);
    }).catch(() => setError("โหลดข้อมูล Raid ไม่สำเร็จ"));
  }, [serverUrl, characterId]);
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
    cloudClaimRaidMilestones(serverUrl || DEFAULT_SERVER_URL, characterId).then(res => {
      if (!res || res.error || !res.claimed || !res.claimed.length) return;
      const pcts = res.claimed.map(k => k.replace("p", "") + "%").join(", ");
      setToast(`🎁 ถึงเกณฑ์ดาเมจสะสม ${pcts} — รางวัลส่งเข้ากล่องจดหมายแล้ว!`);
      setTimeout(() => setToast(null), 3500);
      load();
    });
  }, [serverUrl, characterId, load]);
  React.useEffect(() => { checkMilestones(); }, [checkMilestones]);

  const handleHurtComplete = React.useCallback(() => {
    // Hero's hurt cycle just finished. If the pet also landed a hit, play a second hurt
    // cycle for it before actually wrapping up — this callback fires again when that one
    // completes too, at which point pendingPetHit is already false and we finish for real.
    if (pendingPetHit) {
      setPendingPetHit(false);
      setHurtToken(token => token + 1);
      return;
    }
    setHurtPlaying(false);
    load();
    checkMilestones();
  }, [pendingPetHit, load, checkMilestones]);

  const handleAttack = (useDiamonds) => {
    if (attacking || hurtPlaying) return;
    setAttacking(true);
    setLastResult(null);
    const pendingAttack = attackRequestIdRef.current || { requestId: globalThis.crypto?.randomUUID?.() || `raid-${Date.now()}-${Math.random().toString(36).slice(2)}`, paidDiamonds: !!useDiamonds };
    attackRequestIdRef.current = pendingAttack;
    cloudAttackRaidBoss(serverUrl || DEFAULT_SERVER_URL, characterId, pendingAttack.paidDiamonds, pendingAttack.requestId).then(res => {
      if (!res || res.error) {
        if (!res?.error || !["network_error", "server_error", "timeout", "operation_in_progress"].includes(res.error)) attackRequestIdRef.current = null;
        setLastResult({ error: res && res.error }); return;
      }
      attackRequestIdRef.current = null;
      if (res.paidDiamonds && onSpendDiamonds) onSpendDiamonds(res.diamonds);
      setLastResult(res);
      // A successful server-side hit is the only trigger for hurt. Delay the
      // status refresh until all three frames finish so a respawn cannot reset
      // or replace the animation halfway through. Queue a second hurt play for the
      // pet's damage (if any) — handleHurtComplete fires it after the hero's finishes.
      setPendingPetHit((res.petDamage || 0) > 0);
      setHurtPlaying(true);
      setHurtToken(token => token + 1);
    }).catch(() => setLastResult({ error: "network_error" })).finally(() => setAttacking(false));
  };

  if (error) {
    return /*#__PURE__*/React.createElement("div", { className: "md-panel" },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, error),
      /*#__PURE__*/React.createElement(BackButton, { onClick: onBack }));
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
  const isDead = Number(boss.hpCurrent) <= 0;
  const bossSpriteConfig = getRaidBossSpriteConfig(boss.defId || boss.id);
  const legacyAttemptsLeft = Math.max(0, Number(me.attemptsMax) - Number(me.attemptsUsed));
  const outOfStamina = supportsStamina ? me.stamina <= 0 : legacyAttemptsLeft <= 0;
  const canAffordRefill = (diamonds || 0) >= me.diamondRefillCost;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return /*#__PURE__*/React.createElement("div", { className: "md-panel", style: { flex: 1, position: "relative" } },
    toast && /*#__PURE__*/React.createElement("div", { className: "md-toast" }, toast),
    /*#__PURE__*/React.createElement(RaidBossCard, {
      boss,
      bossSpriteConfig,
      hurtToken,
      onHurtComplete: handleHurtComplete,
      isDead
    }),
    /*#__PURE__*/React.createElement(RaidPlayerStatus, {
      supportsStamina,
      me,
      outOfStamina,
      mm,
      ss,
      legacyAttemptsLeft,
      lastResult,
      attacking,
      hurtPlaying,
      isDead,
      canAffordRefill,
      onAttack: handleAttack
    }),
    /*#__PURE__*/React.createElement(RaidMilestonePanel, { me, milestoneSpecials }),
    /*#__PURE__*/React.createElement(RaidRanking, { rows: status.top || [], characterId }),
    /*#__PURE__*/React.createElement(BackButton, { onClick: onBack }));
}

// ---------- W9 Arena V2 runtime helpers ----------
function createArenaV2PreloadGate(timeoutMs = 10000) {
  let settled = false;
  let timer = null;
  let resolveGate;
  let rejectGate;
  const promise = new Promise((resolve, reject) => { resolveGate = resolve; rejectGate = reject; });
  const finish = (ok, value) => {
    if (settled) return;
    settled = true;
    if (timer) clearTimeout(timer);
    ok ? resolveGate(value) : rejectGate(value instanceof Error ? value : new Error(String(value || "arena_preload_failed")));
  };
  timer = setTimeout(() => finish(false, new Error("arena_preload_timeout")), timeoutMs);
  return { promise, ready: value => finish(true, value), fail: reason => finish(false, reason), cancel: reason => finish(false, reason || "arena_preload_unmounted") };
}

function arenaMatchLifecycleStatus(match) {
  return String(match?.status || "").trim().toLowerCase();
}

function arenaMatchIsActive(match) {
  return arenaMatchLifecycleStatus(match) === "active" && !!match?.state && match.state.phase !== "done";
}

function arenaMatchIsPrepared(match) {
  return arenaMatchLifecycleStatus(match) === "prepared";
}

function arenaHumanError(code, reason, fallback = "Arena request failed") {
  const token = String(code || "").trim();
  const detail = String(reason || "").trim().replace(/_/g, " ");
  const labels = {
    arena_match_not_active: "Arena match ยังไม่อยู่ในสถานะต่อสู้",
    arena_action_illegal: "คำสั่ง Arena นี้ใช้ไม่ได้",
    arena_match_expired: "Arena match หมดอายุแล้ว",
    arena_match_not_found: "ไม่พบ Arena match เดิมแล้ว"
  };
  const label = labels[token] || String(fallback || token || "Arena request failed");
  const reasonText = detail ? ` — ${detail}` : "";
  const tokenText = token ? ` [${token}]` : "";
  return `${label}${reasonText}${tokenText}`;
}

// Settlement is authoritative server data. This boundary converts both the W9 V2
// nested payload and the older scalar payload into render-safe display fields without
// changing the stored result or recalculating any economy/rating value.
function arenaResultViewModel(result = {}) {
  const raw = result && typeof result === "object" ? result : {};
  const arenaCoin = raw.arenaCoin;
  const ratingChange = raw.ratingChange ?? raw.attacker?.ratingChange;
  const coinEarned = raw.arenaCoinEarned
    ?? (typeof arenaCoin === "number" ? arenaCoin : arenaCoin?.earned);
  const outcome = raw.result ?? raw.attacker?.result ?? raw.combatResult ?? "unknown";
  const combatResult = raw.combatResult ?? raw.terminalReason ?? raw.reason ?? outcome;
  const resolution = raw.resolution ?? arenaCoin?.result ?? combatResult;
  const rewardSlot = raw.rewardSlot ?? arenaCoin?.rewardSlot ?? "—";
  const milestones = Array.isArray(raw.milestones)
    ? raw.milestones.map(milestone => ({
      kind: String(milestone?.kind || "milestone"),
      threshold: Number.isFinite(Number(milestone?.threshold)) ? Number(milestone.threshold) : null,
      arenaCoin: Number.isFinite(Number(milestone?.arenaCoin)) ? Number(milestone.arenaCoin) : 0
    })).filter(milestone => milestone.threshold !== null && milestone.arenaCoin > 0)
    : [];
  const milestoneNotice = milestones.map(milestone =>
    `MILESTONE! ${milestone.kind.toUpperCase()} ${milestone.threshold} +${milestone.arenaCoin} Arena Coin`
  ).join(" · ");
  return Object.freeze({
    outcome: String(outcome || "unknown"),
    combatResult: String(combatResult || "unknown"),
    ratingChange: Number.isFinite(Number(ratingChange)) ? Number(ratingChange) : null,
    arenaCoinEarned: Number.isFinite(Number(coinEarned)) ? Number(coinEarned) : null,
    rewardSlot: [String(rewardSlot ?? "—"), milestoneNotice].filter(Boolean).join(" · "),
    resolution: String(resolution || "unknown"),
    terminalReason: String(raw.terminalReason ?? raw.reason ?? combatResult ?? "unknown"),
    milestones: Object.freeze(milestones)
  });
}

function arenaResultGraphicKey(outcome) {
  const value = String(outcome || "").trim().toLowerCase();
  if (value === "win" || value === "victory") return "win";
  if (value === "loss" || value === "defeat") return "loss";
  if (value === "draw") return "draw";
  return "";
}

// Public Arena state serializes units as an array. Keep this compatibility boundary
// in one place so Auto never depends on the worker's private unit-map representation.
function arenaPublicUnitById(state, unitId) {
  const units = state?.units;
  if (Array.isArray(units)) return units.find(unit => String(unit?.id || "") === String(unitId || "")) || null;
  if (units && typeof units === "object") return units[unitId] || null;
  return null;
}

function arenaMatchWithResultViewModel(match, resultOverride = undefined) {
  if (!match) return match;
  const result = resultOverride === undefined ? match.result : resultOverride;
  return result ? { ...match, result, resultViewModel: arenaResultViewModel(result) } : match;
}

function arenaTerminalMatchFromResponse(previousMatch, response = {}) {
  const responseMatch = response.match && typeof response.match === "object" ? response.match : null;
  const result = responseMatch?.result ?? response.result ?? previousMatch?.result;
  const next = responseMatch
    ? { ...previousMatch, ...responseMatch, ...(result ? { result } : {}) }
    : { ...previousMatch, state: response.state, ...(result ? { result } : {}) };
  return arenaMatchWithResultViewModel(next, result);
}

function arenaPlayerCardEquipmentLabels(equipment) {
  return (Array.isArray(equipment) ? equipment : [])
    .filter(item => item && typeof item === "object")
    .map(item => {
      const base = String(item.name || item.itemTemplateId || item.slotType || "Item");
      const enhance = Number(item.enhanceLevel) || 0;
      return enhance > 0 ? `${base} +${enhance}` : base;
    });
}

function arenaPlayerCardPetLabel(card) {
  const pet = card?.pet;
  if (!pet) return "None";
  const name = String(pet.name || pet.defId || card?.petName || "Pet");
  const level = Number(pet.level) || 0;
  return level > 0 ? `${name} · Lv${level}` : name;
}

function formatArenaSeasonCountdown(ms) {
  const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = value => String(value).padStart(2, "0");
  return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const ARENA_HUB_MILESTONE_PRESENTATION = Object.freeze({
  play: [{ threshold: 10, arenaCoin: 100 }, { threshold: 25, arenaCoin: 200 }, { threshold: 50, arenaCoin: 400 }, { threshold: 100, arenaCoin: 800 }],
  win: [{ threshold: 5, arenaCoin: 150 }, { threshold: 15, arenaCoin: 300 }, { threshold: 30, arenaCoin: 600 }, { threshold: 50, arenaCoin: 1000 }]
});
function arenaHubMilestoneProgress(kind, rawCount) {
  const rows = ARENA_HUB_MILESTONE_PRESENTATION[kind] || [];
  const count = Math.max(0, Number(rawCount) || 0);
  const next = rows.find(row => count < row.threshold) || null;
  const finalThreshold = rows.length ? rows[rows.length - 1].threshold : 1;
  const target = next?.threshold || finalThreshold;
  return { count, next, percent: next ? Math.max(0, Math.min(100, count / Math.max(1, target) * 100)) : 100 };
}
function arenaHubTierNameFromRating(rating) {
  const value = Number(rating) || 1000;
  return value >= 1450 ? "Diamond" : value >= 1250 ? "Gold" : value >= 1100 ? "Silver" : "Bronze";
}
function ArenaHubMilestoneRow({ label, progress, iconSrc }) {
  const rewardText = progress.next ? `+${progress.next.arenaCoin}` : "DONE";
  return /*#__PURE__*/React.createElement("div", { className: "md-arena-milestone-row" },
    iconSrc && /*#__PURE__*/React.createElement("img", { className: "md-arena-milestone-icon", src: iconSrc, alt: "", "aria-hidden": "true" }),
    /*#__PURE__*/React.createElement("div", { className: "md-arena-milestone-main" },
      /*#__PURE__*/React.createElement("div", { className: "md-arena-milestone-copy" },
        /*#__PURE__*/React.createElement("strong", null, label),
        /*#__PURE__*/React.createElement("span", null, progress.next ? `${progress.count}/${progress.next.threshold}` : `${progress.count} · COMPLETE`)),
      /*#__PURE__*/React.createElement("div", { className: "md-arena-progress-shell", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": progress.next?.threshold || progress.count || 1, "aria-valuenow": progress.count },
        /*#__PURE__*/React.createElement("span", { className: "md-arena-progress-fill", style: { width: `${progress.percent}%` } }))),
    /*#__PURE__*/React.createElement("div", { className: "md-arena-reward-slot" },
      progress.next && /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "arenaCoin", fallback: "◈", className: "md-game-icon md-arena-reward-coin", alt: "" }),
      /*#__PURE__*/React.createElement("b", null, rewardText)));
}

function arenaHistoryPresentation(kind, row = {}) {
  const attackerResult = String(row.result || "unknown").toLowerCase();
  const result = kind === "defense"
    ? ({ win: "LOSS", loss: "WIN", draw: "DRAW" }[attackerResult] || attackerResult.toUpperCase())
    : attackerResult.toUpperCase();
  const opponent = String((kind === "attack" ? row.defenderName : row.attackerName) || "Unknown opponent");
  const ratingChange = Number(kind === "attack" ? row.attackerRatingChange : row.defenderRatingChange) || 0;
  return Object.freeze({
    result,
    opponent,
    direction: kind === "attack" ? `You attacked ${opponent}` : `${opponent} attacked you`,
    ratingChange,
    coin: kind === "attack" ? Number(row.arenaCoinEarned) || 0 : null
  });
}

function arenaSetupPetIcon(pet) {
  return PET_POOL.find(definition => definition.id === pet?.defId)?.icon || "🐾";
}

const ARENA_SETUP_EQUIPMENT_SLOT_ORDER = Object.freeze(["weapon", "helmet", "chest", "gloves", "boots", "wings", "accessory"]);
function arenaSetupEquipmentSlotKey(item) {
  const raw = String(item?.slotType || item?.type || "").toLowerCase();
  return ({ helm: "helmet", armor: "chest", glove: "gloves", wing: "wings" })[raw] || raw;
}
function arenaSetupEquipmentSlots(equipment) {
  const bySlot = new Map();
  (Array.isArray(equipment) ? equipment : []).forEach(item => {
    const slot = arenaSetupEquipmentSlotKey(item);
    if (ARENA_SETUP_EQUIPMENT_SLOT_ORDER.includes(slot) && !bySlot.has(slot)) bySlot.set(slot, item);
  });
  return ARENA_SETUP_EQUIPMENT_SLOT_ORDER.map(slot => ({ slot, item: bySlot.get(slot) || null }));
}

function ArenaPlayerCardOverlay({ card, busy, onBattle, onClose }) {
  const e = React.createElement;
  if (!card) return null;
  const frameSrc = typeof arenaProfileFrameAsset === "function" ? arenaProfileFrameAsset(card.profileFrameKey) : "";
  const equipmentItems = Array.isArray(card.equipment) ? card.equipment : [];
  const equipmentLabel = equipmentItems.length ? "" : card.isBot ? "Standard BOT Loadout" : "None";
  const pet = arenaPlayerCardPetLabel(card);
  const avatarLayers = typeof playerCardAvatarLayers === "function" ? playerCardAvatarLayers(card.avatar) : [];
  const overlay = e("div", {
    className: "md-player-card-overlay md-arena-player-card-overlay",
    role: "presentation",
    onClick: event => { if (event.target === event.currentTarget) onClose(); }
  },
    e("section", {
      className: "md-player-card",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "md-arena-player-card-name",
      style: {
        "--player-card-bg": playerCardAsset("cardBg") ? `url("${playerCardAsset("cardBg")}")` : "none",
        "--player-card-detail-panel": playerCardAsset("detailPanel") ? `url("${playerCardAsset("detailPanel")}")` : "none",
        "--player-card-name-plate": playerCardAsset("namePlate") ? `url("${playerCardAsset("namePlate")}")` : "none",
        "--player-card-button-primary": playerCardAsset("buttonPrimary") ? `url("${playerCardAsset("buttonPrimary")}")` : "none",
        "--player-card-button-secondary": playerCardAsset("buttonSecondary") ? `url("${playerCardAsset("buttonSecondary")}")` : "none"
      }
    },
      e("button", {
        type: "button",
        className: "md-player-card-close",
        onClick: onClose,
        "aria-label": "ปิด Arena Player Card"
      }, playerCardAsset("buttonClose") ? e("img", { src: playerCardAsset("buttonClose"), alt: "ปิด" }) : "✕"),
      e("div", { className: "md-player-card-main" },
        e("div", { className: "md-player-card-identity" },
          e("div", { className: "md-player-card-avatar" },
            avatarLayers.length
              ? avatarLayers.map(layer => e("img", {
                key: `${layer.assetKey}:${layer.zIndex}`,
                src: layer.src,
                alt: "",
                "aria-hidden": "true",
                style: { left: `${layer.x}%`, top: `${layer.y}%`, transform: `translate(-50%, -50%) scale(${layer.scale})`, zIndex: layer.zIndex }
              }))
              : playerCardAsset("avatarPlaceholderNoPic") && e("img", { src: playerCardAsset("avatarPlaceholderNoPic"), alt: "ไม่มีรูปโปรไฟล์", className: "md-player-card-placeholder" }),
            (frameSrc || playerCardAsset("avatarFrame")) && e("img", { src: frameSrc || playerCardAsset("avatarFrame"), alt: "", "aria-hidden": "true", className: "md-player-card-avatar-frame" })
          ),
          e("div", { className: "md-player-card-nameplate" },
            e("h2", { id: "md-arena-player-card-name" }, card.name || "Arena Player Card"))
        ),
        e("div", { className: "md-player-card-details md-arena-player-card-details" },
          e("div", null, e("span", null, "Level"), e("strong", null, card.level ?? "—")),
          e("div", null, e("span", null, "CP"), e("strong", null, card.cp == null ? "—" : Number(card.cp || 0).toLocaleString("en-US"))),
          e("div", null, e("span", null, "Rating"), e("strong", null, card.rating ?? "—")),
          e("div", null, e("span", null, "Tier"), e("strong", null, card.tier || "—")),
          e("div", null, e("span", null, "Pet"), e("strong", null, pet)),
          e("div", { className: "md-arena-card-equipment-row" },
            e("span", null, "Equipment"),
            equipmentItems.length
              ? e("div", { className: "md-arena-equipment-icons", "aria-label": "Equipped items" },
                  equipmentItems.map((item, index) => {
                    const slot = String(item.slotType || item.type || "");
                    const iconItem = { ...item, type: slot, setId: item.setId || "" };
                    const label = `${item.name || SLOT_LABEL[slot] || slot || "Equipment"}${Number(item.enhanceLevel) > 0 ? ` +${item.enhanceLevel}` : ""}`;
                    return e("span", { className: "md-arena-equipment-icon", key: item.itemId || `${slot}-${index}`, title: label, "aria-label": label },
                      e(GameIcon, { item: iconItem, fallback: SLOT_ICON[slot] || "◆", className: "md-game-icon md-arena-equipment-item-icon", alt: label }),
                      Number(item.enhanceLevel) > 0 && e("i", null, `+${item.enhanceLevel}`)
                    );
                  }))
              : e("strong", { className: "md-arena-card-equipment" }, equipmentLabel))
        )
      ),
      e("div", { className: "md-player-card-actions" },
        e("button", { type: "button", className: "md-player-card-guild-button", disabled: busy, onClick: onBattle }, busy ? "กำลังเตรียม..." : "BATTLE ⚔️"),
        e("button", { type: "button", className: "md-player-card-friend-button", disabled: busy, onClick: onClose }, "CLOSE")
      )
    )
  );
  return ReactDOM.createPortal(overlay, document.body);
}

function ArenaUnlockNotice({ busy, onConfirm }) {
  const e = React.createElement;
  return ReactDOM.createPortal(
    e("div", { className: "md-arena-unlock-overlay", role: "presentation" },
      e("section", { className: "md-card md-arena-unlock-card", role: "dialog", "aria-modal": "true", "aria-labelledby": "md-arena-unlock-title" },
        e("div", { className: "md-arena-unlock-icon", "aria-hidden": "true" }, "🏟️"),
        e("p", { id: "md-arena-unlock-title", className: "md-title" }, "Arena ปลดล็อกแล้ว!"),
        e("p", { className: "md-sub" }, "ตัวละคร Lv10 ขึ้นไปสามารถเข้าสู่ Arena V2 เพื่อจัดทีมและต่อสู้กับผู้เล่นอื่นได้แล้ว"),
        e("button", { type: "button", className: "md-btn primary wide", disabled: busy, onClick: onConfirm }, busy ? "กำลังบันทึก..." : "OK")
      )
    ),
    document.body
  );
}

function arenaFatalDiagnostic(error, context = {}, event = {}) {
  const sourceError = error instanceof Error ? error : event?.error instanceof Error ? event.error : null;
  const reason = error && typeof error === "object" && !(error instanceof Error)
    ? (error.reason || error.error || error)
    : error;
  const message = String(sourceError?.message || reason?.message || event?.message || error || "Unknown Arena runtime error");
  const source = String(event?.filename || event?.sourceURL || event?.url || context.source || "");
  const line = Number(event?.lineno ?? event?.lineNumber ?? context.line) || null;
  const column = Number(event?.colno ?? event?.columnNumber ?? context.column) || null;
  const stack = String(sourceError?.stack || reason?.stack || context.stack || "");
  return Object.freeze({
    kind: String(context.kind || event?.type || "arena_runtime"),
    message,
    source,
    line,
    column,
    stack,
    matchId: String(context.matchId || "—"),
    actionSeq: Number.isFinite(Number(context.actionSeq)) ? Number(context.actionSeq) : 0,
    phaserStatus: String(context.phaserStatus || "unknown"),
    arenaPhase: String(context.arenaPhase || "unknown"),
    currentAction: String(context.currentAction || "unknown")
  });
}

const ArenaV2ErrorBoundary = typeof React === "undefined" ? class {
  constructor(props) { this.props = props; this.state = { failed: false }; }
} : class extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
    this.reported = false;
  }

  componentDidCatch(error, info) {
    if (this.reported) return;
    this.reported = true;
    const context = { ...(this.props.getContext?.() || {}), kind: "react_render", stack: info?.componentStack || "" };
    this.props.onFatal?.(arenaFatalDiagnostic(error, context));
    this.setState({ failed: true });
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
};

function sanitizedRuntimeDetail(value, fallback = "unknown") {
  let text = String(value ?? "").trim();
  if (!text) return fallback;
  text = text
    .replace(/([?&](?:token|session|password|key|auth|code)=)[^&#\s]+/gi, "$1[redacted]")
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, "[redacted authorization]")
    .replace(/\b(?:token|password|credential|authorization|cookie|session)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]");
  return text.slice(0, 800);
}

function runtimeDiagnosticText(diagnostic = {}) {
  const fields = [
    ["Event", diagnostic.event || diagnostic.kind || "client_runtime_error"],
    ["Reason", diagnostic.reason || diagnostic.code || diagnostic.kind || "unknown_error"],
    ["Code", diagnostic.code],
    ["HTTP", diagnostic.status],
    ["Domain", diagnostic.domain],
    ["Action", diagnostic.action || diagnostic.currentAction],
    ["Reference", diagnostic.matchId],
    ["Action Seq", diagnostic.actionSeq],
    ["Phase", diagnostic.arenaPhase],
    ["Presentation", diagnostic.phaserStatus],
    ["Message", diagnostic.message]
  ];
  if (diagnostic.source) {
    const source = sanitizedRuntimeDetail(diagnostic.source).split(/[?#]/)[0];
    fields.push(["Source", `${source}:${diagnostic.line || "?"}:${diagnostic.column || "?"}`]);
  }
  if (diagnostic.stack) {
    const stack = sanitizedRuntimeDetail(String(diagnostic.stack).split("\n").slice(0, 8).join("\n"), "");
    if (stack) fields.push(["Stack", stack]);
  }
  return fields
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `${label}: ${sanitizedRuntimeDetail(value)}`)
    .join("\n");
}

function RuntimeDiagnosticOverlay({ diagnostic, title = "Runtime error", summary, primaryLabel, onPrimary, onClose }) {
  if (!diagnostic) return null;
  const e = React.createElement;
  return ReactDOM.createPortal(
    e("div", { className: "md-arena-fatal-overlay", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "md-runtime-error-title" },
      e("section", { className: "md-arena-fatal-card" },
        e("div", { className: "md-arena-fatal-head" },
          e("strong", { id: "md-runtime-error-title" }, `⚠ ${title}`),
          e("button", { type: "button", className: "md-arena-fatal-close", onClick: onClose, "aria-label": "ปิดรายละเอียด" }, "×")
        ),
        e("p", { className: "md-arena-fatal-copy" }, summary || "เกิดข้อผิดพลาดใน runtime รายละเอียดที่แสดงถูกจำกัดและปิดบังข้อมูลลับแล้ว"),
        e("pre", { className: "md-arena-fatal-detail" }, runtimeDiagnosticText(diagnostic)),
        e("div", { className: "md-arena-fatal-actions" },
          onPrimary && e("button", { type: "button", className: "md-btn primary small", onClick: onPrimary }, primaryLabel || "RETRY"),
          e("button", { type: "button", className: "md-btn primary small", onClick: onClose }, "CLOSE")
        )
      )
    ),
    document.body
  );
}

class GlobalGameErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { diagnostic: null };
    this.lastFingerprint = "";
    this.reportRuntimeError = this.reportRuntimeError.bind(this);
  }

  componentDidMount() {
    globalThis.__thornieReportRuntimeError = this.reportRuntimeError;
    const queued = Array.isArray(globalThis.__thornieRuntimeQueue)
      ? globalThis.__thornieRuntimeQueue.slice()
      : [];
    globalThis.__thornieRuntimeQueue = [];
    queued.forEach(this.reportRuntimeError);
  }

  componentWillUnmount() {
    if (globalThis.__thornieReportRuntimeError === this.reportRuntimeError) {
      delete globalThis.__thornieReportRuntimeError;
    }
  }

  componentDidCatch(error, info) {
    this.reportRuntimeError({
      event: "react_render_error",
      message: error?.message || String(error),
      stack: [error?.stack || "", info?.componentStack || ""].filter(Boolean).join("\n")
    });
  }

  reportRuntimeError(raw) {
    const diagnostic = raw && typeof raw === "object"
      ? {
          event: String(raw.event || raw.kind || "client_runtime_error"),
          reason: String(raw.reason || raw.code || raw.message || "unknown_error"),
          message: String(raw.message || raw.reason || "Unknown runtime error"),
          source: String(raw.source || ""),
          line: Number(raw.line) || 0,
          column: Number(raw.column) || 0,
          stack: String(raw.stack || ""),
          time: String(raw.time || new Date().toISOString())
        }
      : {
          event: "client_runtime_error",
          reason: String(raw || "unknown_error"),
          message: String(raw || "Unknown runtime error"),
          source: "",
          line: 0,
          column: 0,
          stack: "",
          time: new Date().toISOString()
        };
    const fingerprint = [
      diagnostic.event,
      diagnostic.message,
      diagnostic.source,
      diagnostic.line,
      diagnostic.column
    ].join("|");
    if (fingerprint === this.lastFingerprint) return;
    this.lastFingerprint = fingerprint;
    this.setState({ diagnostic });
  }

  render() {
    const diagnostic = this.state.diagnostic;
    return /*#__PURE__*/React.createElement(React.Fragment, null,
      this.props.children,
      diagnostic && /*#__PURE__*/React.createElement(RuntimeDiagnosticOverlay, {
        diagnostic: {
          ...diagnostic,
          event: "game_runtime_error",
          reason: diagnostic.reason || "client_runtime_error"
        },
        title: "Game Runtime Error",
        summary: "เกมพบข้อผิดพลาดระหว่างทำงาน ระบบจับ error กลางของเกมแล้ว รายละเอียดด้านล่างคือข้อมูลที่ผ่านการคัดกรองแล้ว",
        onClose: () => {
          this.lastFingerprint = "";
          this.setState({ diagnostic: null });
        }
      })
    );
  }
}

function ArenaFatalDiagnosticOverlay({ diagnostic, onResume, onClose }) {
  return /*#__PURE__*/React.createElement(RuntimeDiagnosticOverlay, {
    diagnostic: { ...diagnostic, event: "arena_presentation_failure", reason: diagnostic?.kind || "arena_runtime" },
    title: "Arena presentation error",
    summary: "Battle ถูกปิดอย่างปลอดภัยแล้ว ข้อมูล match หลักยังอยู่บนเซิร์ฟเวอร์และสามารถ Resume ได้โดยไม่ใช้ Ticket เพิ่ม",
    primaryLabel: "RESUME ARENA",
    onPrimary: onResume,
    onClose
  });
}

function PersistenceDiagnosticOverlay({ diagnostic, onClose }) {
  const response = diagnostic?.response && typeof diagnostic.response === "object" ? diagnostic.response : {};
  const safeDiagnostic = diagnostic ? {
    event: "cloud_persistence_failure",
    reason: diagnostic.code || response.reason || response.error || "unknown_error",
    code: diagnostic.code || response.error,
    status: diagnostic.status,
    domain: diagnostic.domain,
    action: diagnostic.action || response.action,
    message: diagnostic.message || response.message,
  } : null;
  return /*#__PURE__*/React.createElement(RuntimeDiagnosticOverlay, {
    diagnostic: safeDiagnostic,
    title: "Cloud save error",
    summary: "การบันทึก Cloud ไม่สำเร็จ กรุณาตรวจสอบรายละเอียดที่ผ่านการคัดกรองแล้วก่อนลองใหม่ ข้อมูล save, inventory และ checkpoint จะไม่ถูกแสดงในหน้าต่างนี้",
    onClose
  });
}

function arenaTurnOrderIcon(unit, preparedSnapshot) {
  if (unit?.kind === "pet") {
    const side = String(unit.id || "").startsWith("team_b") ? preparedSnapshot?.defender : preparedSnapshot?.attacker;
    return String(side?.pet?.icon || "🐾");
  }
  return String(unit?.side === "team_b" ? "🛡️" : "⚔️");
}

// W9.8/W9.9 authoritative Arena V2 surface. The server owns match state; this
// component only renders snapshots and sends idempotent action keys.
function ArenaSkillDropdown({ index, selectedSkillId, selectedSkill, availableSkills, setup, setSetup }) {
  const triggerRef = React.useRef(null);
  const [open, setOpen] = React.useState(false);
  const [position, setPosition] = React.useState(null);

  const syncPosition = React.useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect?.();
    if (!rect) return;
    const viewportWidth = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
    const viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1);
    const width = Math.min(290, Math.max(0, viewportWidth - 28));
    const maxHeight = Math.min(viewportHeight * 0.42, 310);
    const preferredLeft = index % 2 === 0 ? rect.left : rect.right - width;
    const left = Math.max(14, Math.min(preferredLeft, viewportWidth - width - 14));
    const spaceBelow = viewportHeight - rect.bottom - 14;
    const top = spaceBelow >= maxHeight || rect.top < maxHeight + 14
      ? rect.bottom + 4
      : Math.max(14, rect.top - maxHeight - 4);
    setPosition({ top: Math.round(top), left: Math.round(left), width: Math.round(width), maxHeight: Math.round(maxHeight) });
  }, [index]);

  React.useEffect(() => {
    if (!open) return undefined;
    syncPosition();
    const onViewportChange = () => syncPosition();
    const onKeyDown = event => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, syncPosition]);

  const chooseSkill = skillId => {
    const slots = [...(setup.skillSlots || [null, null, null, null])];
    slots[index] = skillId || null;
    setSetup({ ...setup, skillSlots: slots });
    setOpen(false);
  };
  const usedByOtherSlots = new Set((setup.skillSlots || []).filter((key, slotIndex) => slotIndex !== index && key));
  const options = [
    /*#__PURE__*/React.createElement("button", {
      key: "empty",
      type: "button",
      className: !selectedSkillId ? "selected" : "",
      onClick: () => chooseSkill(null),
      "aria-selected": !selectedSkillId
    }, /*#__PURE__*/React.createElement("span", { className: "md-hero-skill-icon fallback", "aria-hidden": "true" }, "✦"), /*#__PURE__*/React.createElement("b", null, "Empty")),
    ...(availableSkills || []).map(skill => {
      const duplicate = usedByOtherSlots.has(skill.key);
      return /*#__PURE__*/React.createElement("button", {
        key: skill.key,
        type: "button",
        className: selectedSkillId === skill.key ? "selected" : "",
        disabled: duplicate,
        onClick: () => !duplicate && chooseSkill(skill.key),
        "aria-selected": selectedSkillId === skill.key,
        "aria-disabled": duplicate
      }, /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: skill.key, className: "md-hero-skill-icon", alt: "" }),
      /*#__PURE__*/React.createElement("b", null, skill.name || heroSkillDisplayName(skill.key)),
      duplicate && /*#__PURE__*/React.createElement("small", null, "USED"));
    })
  ];

  return /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("button", {
      ref: triggerRef,
      type: "button",
      className: `md-arena-skill-setup-slot md-arena-setup-picker${selectedSkillId ? " filled" : " empty"}`,
      onClick: () => setOpen(value => !value),
      "aria-expanded": open,
      "aria-haspopup": "listbox"
    },
      /*#__PURE__*/React.createElement("span", { className: "md-arena-skill-slot-number" }, index + 1),
      /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: selectedSkillId, className: "md-hero-skill-icon md-arena-setup-skill-icon", alt: selectedSkill?.name || (selectedSkillId ? heroSkillDisplayName(selectedSkillId) : "Empty skill slot") }),
      /*#__PURE__*/React.createElement("span", { className: "md-arena-skill-name" }, selectedSkill?.name || `Skill ${index + 1} · Empty`),
      /*#__PURE__*/React.createElement("i", null, "CHANGE")
    ),
    open && position && ReactDOM.createPortal(
      /*#__PURE__*/React.createElement("div", {
        className: "md-arena-setup-options md-arena-setup-options-portal",
        role: "listbox",
        "aria-label": `Arena skill slot ${index + 1}`,
        style: { top: `${position.top}px`, left: `${position.left}px`, width: `${position.width}px`, maxHeight: `${position.maxHeight}px` },
        onClick: event => event.stopPropagation()
      }, options),
      document.body
    )
  );
}

function ArenaV2Screen({
  serverUrl,
  characterId,
  save,
  arenaHud,
  onHudChange,
  onCharacter,
  onOpenInv,
  onPets,
  onSettings,
  onSave,
  onFriend,
  onChat,
  onGuild,
  onMainHub,
  onBack,
  onFatal
}) {
  const url = serverUrl || DEFAULT_SERVER_URL;
  const [tab, setTab] = React.useState("battle");
  const [status, setStatus] = React.useState(null);
  const [opponents, setOpponents] = React.useState([]);
  const [history, setHistory] = React.useState({ attack: [], defense: [] });
  const [ranking, setRanking] = React.useState([]);
  const [match, setMatch] = React.useState(null);
  const [setup, setSetup] = React.useState({ petInstId: "", skillSlots: [null, null, null, null] });
  const [selectedTarget, setSelectedTarget] = React.useState(null);
  const [auto, setAuto] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [now, setNow] = React.useState(Date.now());
  const [playerCard, setPlayerCard] = React.useState(null);
  const [playerCardSource, setPlayerCardSource] = React.useState("matchmaking");
  const [showFullLog, setShowFullLog] = React.useState(false);
  const [combatSpeed, setCombatSpeed] = React.useState(1);
  const [refreshAvailableAt, setRefreshAvailableAt] = React.useState("");
  const [unlockBusy, setUnlockBusy] = React.useState(false);
  const [preloadState, setPreloadState] = React.useState("idle");
  const [phaserStatus, setPhaserStatus] = React.useState("idle");
  const [presentationAttempt, setPresentationAttempt] = React.useState(0);
  const preloadGateRef = React.useRef(null);
  const preparedFlowRef = React.useRef("");
  const rolloverRefreshRef = React.useRef(false);
  const matchRef = React.useRef(match);
  const phaserStatusRef = React.useRef(phaserStatus);
  const currentActionRef = React.useRef("idle");
  const requestInFlightRef = React.useRef(false);
  const autoActionInFlightRef = React.useRef(false);
  const fatalReportedRef = React.useRef(false);
  matchRef.current = match;
  phaserStatusRef.current = phaserStatus;
  const reportArenaFatal = React.useCallback((error, event = {}, kind = "arena_runtime") => {
    if (fatalReportedRef.current) return;
    fatalReportedRef.current = true;
    const currentMatch = matchRef.current;
    const diagnostic = arenaFatalDiagnostic(error, {
      kind,
      matchId: currentMatch?.matchId,
      actionSeq: currentMatch?.state?.actionSeq,
      phaserStatus: phaserStatusRef.current,
      arenaPhase: currentMatch?.result ? "result" : currentMatch ? arenaMatchLifecycleStatus(currentMatch) : tab,
      currentAction: currentActionRef.current
    }, event);
    preloadGateRef.current?.cancel?.();
    preloadGateRef.current = null;
    // The boot shell owns the global error surface. Close it before leaving the
    // Arena route so a late Phaser/window error cannot cover Main Hub forever.
    globalThis.hideBootError?.();
    // Do not call an Arena API here and do not clear the server match. Removing the
    // local match unmounts Phaser immediately; the next Arena mount will GET and resume
    // the authoritative active match without consuming another ticket.
    setMatch(null);
    setPlayerCardSource("matchmaking");
    setBusy(false);
    onFatal?.(diagnostic);
  }, [onFatal, tab]);
  React.useEffect(() => {
    const context = {
      matchId: match?.matchId || "—",
      actionSeq: match?.state?.actionSeq || 0,
      phaserStatus,
      arenaPhase: match?.result ? "result" : match ? arenaMatchLifecycleStatus(match) : tab,
      currentAction: currentActionRef.current
    };
    const previousErrorHandler = globalThis.__thornieArenaRuntimeError;
    const previousRejectionHandler = globalThis.__thornieArenaUnhandledRejection;
    globalThis.__THORNIE_ARENA_CONTEXT__ = context;
    globalThis.__thornieArenaRuntimeError = event => reportArenaFatal(event?.error || event?.message, event, "window_error");
    globalThis.__thornieArenaUnhandledRejection = event => reportArenaFatal(event?.reason, event, "unhandled_rejection");
    const windowError = event => globalThis.__thornieArenaRuntimeError?.(event);
    const windowRejection = event => globalThis.__thornieArenaUnhandledRejection?.(event);
    window.addEventListener("error", windowError);
    window.addEventListener("unhandledrejection", windowRejection);
    return () => {
      window.removeEventListener("error", windowError);
      window.removeEventListener("unhandledrejection", windowRejection);
      if (globalThis.__thornieArenaRuntimeError) globalThis.__thornieArenaRuntimeError = previousErrorHandler;
      if (globalThis.__thornieArenaUnhandledRejection) globalThis.__thornieArenaUnhandledRejection = previousRejectionHandler;
      if (globalThis.__THORNIE_ARENA_CONTEXT__ === context) delete globalThis.__THORNIE_ARENA_CONTEXT__;
    };
  }, [match?.matchId, match?.state?.actionSeq, phaserStatus, reportArenaFatal, tab]);
  const syncArenaStatus = React.useCallback(async () => {
    const nextStatus = await cloudGetArenaV2Status(url, characterId);
    if (nextStatus?.error) {
      setError(arenaHumanError(nextStatus.error, nextStatus.reason, "ซิงก์สถานะ Arena ไม่สำเร็จ"));
      return null;
    }
    setStatus(nextStatus);
    setSetup(current => nextStatus.setup || current);
    onHudChange?.(nextStatus?.unlocked === false ? null : {
      arenaCoin: Number(nextStatus?.player?.arenaCoin) || 0,
      tickets: Number(nextStatus?.tickets?.tickets) || 0,
      ticketsMax: Number(nextStatus?.tickets?.ticketsMax) || 10,
    });
    return nextStatus;
  }, [characterId, onHudChange, url]);
  const adoptArenaMatch = React.useCallback(nextMatch => {
    if (!nextMatch) return false;
    const lifecycle = arenaMatchLifecycleStatus(nextMatch);
    if (lifecycle === "active" || lifecycle === "done") {
      setMatch(arenaMatchWithResultViewModel(nextMatch));
      setAuto(!!nextMatch.state?.auto || !!nextMatch.state?.flags?.auto);
      setTab("battle");
      setPreloadState("ready");
      return true;
    }
    if (["expired", "invalid", "cancelled"].includes(lifecycle)) {
      setMatch(null);
      setPlayerCard(null);
      setPreloadState("idle");
      setError(arenaHumanError(`arena_match_${lifecycle}`, "", "Arena match ใช้งานไม่ได้"));
    }
    return false;
  }, []);
  const beginPreparedArenaMatch = React.useCallback(async preparedMatch => {
    if (!arenaMatchIsPrepared(preparedMatch) || !preparedMatch.matchId) return false;
    const matchId = String(preparedMatch.matchId);
    if (preparedFlowRef.current === matchId) return false;
    preparedFlowRef.current = matchId;
    fatalReportedRef.current = false;
    setMatch(preparedMatch);
    setPlayerCard(null);
    setTab("battle");
    setBusy(true);
    setError("");
    setPreloadState("loading");
    setPhaserStatus("idle");
    setPresentationAttempt(value => value + 1);
    const gate = createArenaV2PreloadGate(10000);
    preloadGateRef.current = gate;
    try {
      await gate.promise;
      setPreloadState("ready");
      const activated = await cloudActivateArenaV2Match(url, characterId, matchId);
      if (activated?.error) {
        const latest = await cloudGetArenaV2Match(url, characterId);
        if (latest?.match && adoptArenaMatch(latest.match)) {
          await syncArenaStatus();
          return true;
        }
        throw new Error(arenaHumanError(activated.error, activated.reason, "เปิด Arena match ไม่สำเร็จ"));
      }
      if (!activated?.match || !adoptArenaMatch(activated.match)) {
        throw new Error(arenaHumanError("arena_match_not_active", "activation did not return active match", "เปิด Arena match ไม่สำเร็จ"));
      }
      // Activation is the authoritative ticket boundary. Refresh resources after
      // confirmation so the global HUD reflects the server's post-ticket state.
      await syncArenaStatus();
      return true;
    } catch (error) {
      // Keep a valid prepared match on screen. The ticket boundary is activate,
      // so retrying presentation with this same ID cannot consume a second ticket.
      setPreloadState("failed");
      setError(error?.message || arenaHumanError("arena_preload_failed", "", "โหลด Arena presentation ไม่สำเร็จ"));
      return false;
    } finally {
      if (preloadGateRef.current === gate) preloadGateRef.current = null;
      if (preparedFlowRef.current === matchId) preparedFlowRef.current = "";
      setBusy(false);
    }
  }, [adoptArenaMatch, characterId, syncArenaStatus, url]);
  const syncArenaMatch = React.useCallback(async () => {
    const latest = await cloudGetArenaV2Match(url, characterId);
    if (latest?.match) {
      if (arenaMatchIsPrepared(latest.match)) return beginPreparedArenaMatch(latest.match);
      adoptArenaMatch(latest.match);
      return latest.match;
    }
    if (latest?.error) setError(arenaHumanError(latest.error, latest.reason, "ซิงก์ Arena match ไม่สำเร็จ"));
    return null;
  }, [adoptArenaMatch, beginPreparedArenaMatch, characterId, url]);
  const refresh = React.useCallback(async () => {
    setError("");
    const [s, o, resumed] = await Promise.all([cloudGetArenaV2Status(url, characterId), cloudGetArenaV2Opponents(url, characterId), cloudGetArenaV2Match(url, characterId)]);
    if (s?.error) { setError(s.error); return; }
    setStatus(s); setSetup(current => s.setup || current); setOpponents(o?.opponents || []); setRefreshAvailableAt(o?.refreshAvailableAt || "");
    onHudChange?.(s?.unlocked === false ? null : {
      arenaCoin: Number(s?.player?.arenaCoin) || 0,
      tickets: Number(s?.tickets?.tickets) || 0,
      ticketsMax: Number(s?.tickets?.ticketsMax) || 10,
    });
    if (resumed?.match) {
      if (arenaMatchIsPrepared(resumed.match)) void beginPreparedArenaMatch(resumed.match);
      else adoptArenaMatch(resumed.match);
    } else if (resumed?.error && resumed.error !== "arena_match_not_found") {
      setError(arenaHumanError(resumed.error, resumed.reason, "โหลด Arena match ไม่สำเร็จ"));
    }
  }, [adoptArenaMatch, beginPreparedArenaMatch, characterId, onHudChange, url]);
  React.useEffect(() => { refresh().catch(() => setError("โหลด Arena ไม่สำเร็จ")); }, [refresh]);
  React.useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  React.useEffect(() => {
    const end = Date.parse(status?.season?.seasonEndsAt || status?.seasonEndsAt || "");
    if (!Number.isFinite(end)) return;
    if (now >= end && !rolloverRefreshRef.current) {
      rolloverRefreshRef.current = true;
      refresh().catch(() => setError("โหลดซีซันใหม่ไม่สำเร็จ"));
    } else if (now < end) rolloverRefreshRef.current = false;
  }, [now, status, refresh]);
  React.useEffect(() => () => preloadGateRef.current?.cancel(), []);
  const loadTab = async next => {
    setTab(next); setError("");
    if (next === "history") setHistory(await cloudGetArenaV2History(url, characterId));
    if (next === "ranking") setRanking((await cloudGetArenaV2Ranking(url, characterId))?.rows || []);
  };
  const acknowledgeUnlock = async () => {
    if (unlockBusy) return;
    setUnlockBusy(true); setError("");
    try {
      const res = await cloudAcknowledgeArenaV2Unlock(url, characterId);
      if (res?.error) throw new Error(res.error);
      setStatus(current => current ? { ...current, showUnlockNotice: false } : current);
    } catch (e) { setError(e.message || "บันทึกสถานะปลดล็อก Arena ไม่สำเร็จ"); }
    finally { setUnlockBusy(false); }
  };
  const openPlayerCard = async (opponentKey, source = "matchmaking") => {
    setBusy(true); setError("");
    try {
      const res = await cloudGetArenaV2PlayerCard(url, characterId, opponentKey);
      if (res?.error) throw new Error(res.error);
      setPlayerCard(res.playerCard || res.card || res);
      setPlayerCardSource(source === "revenge" ? "revenge" : "matchmaking");
    } catch (e) { setError(e.message || "โหลด Player Card ไม่สำเร็จ"); } finally { setBusy(false); }
  };
  const start = async (opponentKey, source = "matchmaking") => {
    if (busy) return; setBusy(true); setError("");
    currentActionRef.current = "prepare_match";
    try {
      const prepared = await cloudPrepareArenaV2Match(url, characterId, opponentKey, source);
      if (prepared?.error) throw new Error(arenaHumanError(prepared.error, prepared.reason, "เตรียม Arena match ไม่สำเร็จ"));
      if (arenaMatchIsPrepared(prepared?.match)) {
        await beginPreparedArenaMatch(prepared.match);
      } else if (!adoptArenaMatch(prepared?.match)) {
        throw new Error(arenaHumanError("arena_match_not_active", "prepare did not return prepared match", "เตรียม Arena match ไม่สำเร็จ"));
      }
    } catch (e) {
      setPreloadState("failed");
      setMatch(null);
      setError(e.message || "เริ่มการต่อสู้ไม่สำเร็จ");
    } finally {
      preloadGateRef.current = null;
      setBusy(false);
      currentActionRef.current = "idle";
    }
  };
  const submitArenaAction = React.useCallback(async ({ actionType = "basic", skillId = null, targetId = null, autoMode = false } = {}) => {
    const currentMatch = matchRef.current;
    if (!arenaMatchIsActive(currentMatch) || requestInFlightRef.current) return false;
    requestInFlightRef.current = true;
    setBusy(true);
    currentActionRef.current = actionType === "surrender" ? "surrender" : autoMode ? "auto_action" : "submit_action";
    try {
      const currentSeq = Number(currentMatch.state?.actionSeq) || 0;
      const actionKey = autoMode
        ? `arena-auto-${currentMatch.matchId}-${currentSeq + 1}`
        : `arena-action-${currentMatch.matchId}-${currentSeq + 1}`;
      const res = await cloudSubmitArenaV2Action(
        url,
        characterId,
        currentMatch.matchId,
        actionKey,
        actionType,
        skillId,
        targetId,
        autoMode
      );
      if (res?.error) {
        setError(arenaHumanError(res.error, res.reason, "ทำ action ไม่สำเร็จ"));
        if (["arena_match_not_active", "arena_action_illegal", "arena_combat_conflict"].includes(res.error)) await syncArenaMatch();
        return false;
      }
      const next = arenaTerminalMatchFromResponse(currentMatch, res);
      setMatch(next);
      setAuto(next.result ? false : !!next.state?.auto || !!next.state?.flags?.auto);
      return true;
    } catch (e) {
      setError(e.message || "ทำ action ไม่สำเร็จ");
      return false;
    } finally {
      requestInFlightRef.current = false;
      currentActionRef.current = "idle";
      setBusy(false);
    }
  }, [characterId, syncArenaMatch, url]);

  const toggleAuto = async () => {
    const currentMatch = matchRef.current;
    if (!arenaMatchIsActive(currentMatch) || requestInFlightRef.current) return;
    requestInFlightRef.current = true;
    setBusy(true);
    currentActionRef.current = "toggle_auto";
    try {
      const enabled = !auto;
      const res = await cloudSetArenaV2Auto(url, characterId, currentMatch.matchId, enabled);
      if (res?.error) {
        setError(arenaHumanError(res.error, res.reason, "เปลี่ยน Auto ไม่สำเร็จ"));
        if (res.error === "arena_match_not_active") await syncArenaMatch();
        return;
      }
      const next = arenaMatchWithResultViewModel(res.match || currentMatch);
      setMatch(next);
      setAuto(!!next.state?.auto || !!next.state?.flags?.auto);
    } catch (e) {
      setError(e.message || "เปลี่ยน Auto ไม่สำเร็จ");
    } finally {
      requestInFlightRef.current = false;
      setBusy(false);
      currentActionRef.current = "idle";
    }
  };

  React.useEffect(() => {
    const currentMatch = matchRef.current;
    const actor = arenaPublicUnitById(currentMatch?.state, currentMatch?.state?.currentActorId);
    if (
      !auto ||
      busy ||
      requestInFlightRef.current ||
      autoActionInFlightRef.current ||
      !arenaMatchIsActive(currentMatch) ||
      actor?.id !== "team_a_hero"
    ) return;
    autoActionInFlightRef.current = true;
    void submitArenaAction({ autoMode: true }).finally(() => {
      autoActionInFlightRef.current = false;
    });
  }, [auto, busy, match?.matchId, match?.state?.actionSeq, match?.state?.currentActorId, submitArenaAction]);

  const action = (actionType, skillId, targetId) => {
    if (busy || requestInFlightRef.current) return;
    void submitArenaAction({ actionType, skillId, targetId });
  };
  if (status && status.unlocked === false) return /*#__PURE__*/React.createElement("div", { className: "md-panel" }, /*#__PURE__*/React.createElement("p", { className: "md-title" }, "Arena ปลดล็อกที่ Lv10"), /*#__PURE__*/React.createElement(BackButton, { onClick: onBack }));
  if (!status) return /*#__PURE__*/React.createElement("div", { className: "md-panel" }, error || "กำลังโหลด Arena...");
  const end = Date.parse(status.season?.seasonEndsAt || status.seasonEndsAt || "");
  const countdown = Number.isFinite(end) ? Math.max(0, end - now) : 0;
  const seasonCountdownText = formatArenaSeasonCountdown(countdown);
  const arenaBackgroundSrc = typeof optionalAsset === "function" ? optionalAsset("arenaUi.background") : "";
  const arenaHubAssets = {
    emblem: typeof optionalAsset === "function" ? optionalAsset("arenaUi.hub.emblem") : "",
    panelFrame: typeof optionalAsset === "function" ? optionalAsset("arenaUi.hub.panelFrame") : "",
    rowFrame: typeof optionalAsset === "function" ? optionalAsset("arenaUi.hub.rowFrame") : "",
    tabs: { active: typeof optionalAsset === "function" ? optionalAsset("arenaUi.tabs.active") : "", inactive: typeof optionalAsset === "function" ? optionalAsset("arenaUi.tabs.inactive") : "" },
    buttons: { primary: typeof optionalAsset === "function" ? optionalAsset("arenaUi.buttons.primary") : "", secondary: typeof optionalAsset === "function" ? optionalAsset("arenaUi.buttons.secondary") : "", danger: typeof optionalAsset === "function" ? optionalAsset("arenaUi.buttons.danger") : "" },
    tiers: { bronze: typeof optionalAsset === "function" ? optionalAsset("arenaUi.tiers.bronze") : "", silver: typeof optionalAsset === "function" ? optionalAsset("arenaUi.tiers.silver") : "", gold: typeof optionalAsset === "function" ? optionalAsset("arenaUi.tiers.gold") : "", diamond: typeof optionalAsset === "function" ? optionalAsset("arenaUi.tiers.diamond") : "" },
    progress: { frame: typeof optionalAsset === "function" ? optionalAsset("arenaUi.progress.frame") : "", fill: typeof optionalAsset === "function" ? optionalAsset("arenaUi.progress.fill") : "", rewardSlot: typeof optionalAsset === "function" ? optionalAsset("arenaUi.progress.rewardSlot") : "" },
    icons: {
      battle: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.battle") : "", setup: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.setup") : "", ranking: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.ranking") : "", history: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.history") : "",
      season: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.season") : "", refresh: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.refresh") : "", playerCard: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.playerCard") : "", info: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.info") : "",
      playMilestone: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.playMilestone") : "", winMilestone: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.winMilestone") : "", attackHistory: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.attackHistory") : "", defenseHistory: typeof optionalAsset === "function" ? optionalAsset("arenaUi.icons.defenseHistory") : ""
    }
  };
  const arenaBattleAssets = {
    surrender: typeof optionalAsset === "function" ? optionalAsset("arenaUi.battle.surrender") : "",
    results: {
      win: typeof optionalAsset === "function" ? optionalAsset("arenaUi.results.win") : "",
      loss: typeof optionalAsset === "function" ? optionalAsset("arenaUi.results.loss") : "",
      draw: typeof optionalAsset === "function" ? optionalAsset("arenaUi.results.draw") : ""
    }
  };
  const arenaArtStyle = {
    flex: 1,
    ...(arenaBackgroundSrc ? { "--arena-ui-background": `url("${arenaBackgroundSrc}")` } : {}),
    ...(arenaHubAssets.panelFrame ? { "--arena-panel-frame": `url("${arenaHubAssets.panelFrame}")` } : {}),
    ...(arenaHubAssets.rowFrame ? { "--arena-row-frame": `url("${arenaHubAssets.rowFrame}")` } : {}),
    ...(arenaHubAssets.tabs.active ? { "--arena-tab-active": `url("${arenaHubAssets.tabs.active}")` } : {}),
    ...(arenaHubAssets.tabs.inactive ? { "--arena-tab-inactive": `url("${arenaHubAssets.tabs.inactive}")` } : {}),
    ...(arenaHubAssets.buttons.primary ? { "--arena-button-primary": `url("${arenaHubAssets.buttons.primary}")` } : {}),
    ...(arenaHubAssets.buttons.secondary ? { "--arena-button-secondary": `url("${arenaHubAssets.buttons.secondary}")` } : {}),
    ...(arenaHubAssets.buttons.danger ? { "--arena-button-danger": `url("${arenaHubAssets.buttons.danger}")` } : {}),
    ...(arenaHubAssets.progress.frame ? { "--arena-progress-frame": `url("${arenaHubAssets.progress.frame}")` } : {}),
    ...(arenaHubAssets.progress.fill ? { "--arena-progress-fill": `url("${arenaHubAssets.progress.fill}")` } : {}),
    ...(arenaHubAssets.progress.rewardSlot ? { "--arena-reward-slot": `url("${arenaHubAssets.progress.rewardSlot}")` } : {}),
    ...(arenaBattleAssets.surrender ? { "--arena-surrender-button": `url("${arenaBattleAssets.surrender}")` } : {})
  };
  const refreshAtMs = Date.parse(refreshAvailableAt || "");
  const refreshSeconds = Number.isFinite(refreshAtMs) ? Math.max(0, Math.ceil((refreshAtMs - now) / 1000)) : 0;
  const matchStatus = arenaMatchLifecycleStatus(match);
  const matchIsActive = arenaMatchIsActive(match) && !match.result;
  const matchIsPrepared = arenaMatchIsPrepared(match);
  const resultView = match?.resultViewModel || arenaResultViewModel(match?.result);
  const resultGraphicKey = arenaResultGraphicKey(resultView.outcome);
  const resultGraphicSrc = resultGraphicKey ? arenaBattleAssets.results[resultGraphicKey] : "";
  const units = match?.state?.units || {};
  const playerUnits = Object.values(units).filter(u => u.side === "team_a").map(u => ({ ...u, alive: Number(u.hp) > 0 && !u.dead }));
  const enemyUnits = Object.values(units).filter(u => u.side === "team_b").map(u => ({ ...u, alive: Number(u.hp) > 0 && !u.dead }));
  const selected = selectedTarget || enemyUnits.find(u => u.alive)?.id || enemyUnits[0]?.id || null;
  const battleState = match?.state ? { ...match.state, selectedTargetId: selected } : null;
  const arenaTurnQueue = (match?.state?.queue || []).map(item => ({
    key: item.id,
    uid: item.id,
    kind: item.kind === "pet" ? "pet" : item.kind === "hero" ? "player" : "monster",
    name: item.name || item.id,
    icon: arenaTurnOrderIcon(item, match?.snapshot),
    speed: item.speed || "—",
    isBoss: false,
    isElite: false
  }));
  const arenaPet = playerUnits.find(unit => unit.kind === "pet") || null;
  const arenaEnemyUnits = enemyUnits.map(unit => ({ ...unit, uid: unit.id }));
  const arenaUnitsById = Object.fromEntries(Object.values(units).map(unit => [unit.id, unit]));
  const arenaCurrency = arenaHud || {
    arenaCoin: Number(status?.player?.arenaCoin) || 0,
    tickets: Number(status?.tickets?.tickets) || 0,
    ticketsMax: Number(status?.tickets?.ticketsMax) || 10
  };
  const arenaAttackStats = status?.player?.attack || {};
  const arenaPlayProgress = arenaHubMilestoneProgress("play", (Number(arenaAttackStats.wins) || 0) + (Number(arenaAttackStats.draws) || 0) + (Number(arenaAttackStats.losses) || 0));
  const arenaWinProgress = arenaHubMilestoneProgress("win", Number(arenaAttackStats.wins) || 0);
  const currentTierKey = String(status?.player?.tier || arenaHubTierNameFromRating(status?.player?.rating)).toLowerCase();
  const currentTierBadge = arenaHubAssets.tiers[currentTierKey] || "";
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel md-arena-v2 md-arena-v2-art",
    style: arenaArtStyle
  },
    status.showUnlockNotice && /*#__PURE__*/React.createElement(ArenaUnlockNotice, { busy: unlockBusy, onConfirm: acknowledgeUnlock }),
    !match && /*#__PURE__*/React.createElement("header", { className: "md-character-page-title md-arena-page-header" },
      /*#__PURE__*/React.createElement("button", { type: "button", onClick: onBack, "aria-label": "ย้อนกลับ" }, "‹"),
      arenaHubAssets.emblem && /*#__PURE__*/React.createElement("img", { className: "md-arena-brand-emblem", src: arenaHubAssets.emblem, alt: "", "aria-hidden": "true" }),
      /*#__PURE__*/React.createElement("h1", null, "Arena")),
    /*#__PURE__*/React.createElement(GlobalCurrencyBar, { save, arena: arenaCurrency, className: "md-arena-global-currency" }),
    /*#__PURE__*/React.createElement("div", { className: "md-arena-scroll" },
      /*#__PURE__*/React.createElement("div", { className: !match ? "md-card md-arena-hub-panel md-arena-summary-panel" : "md-card" },
      match && /*#__PURE__*/React.createElement("p", { className: "md-title" }, "Arena Battle"),
      /*#__PURE__*/React.createElement("div", { className: "md-arena-summary" },
        !match && currentTierBadge && /*#__PURE__*/React.createElement("img", { className: "md-arena-tier-badge", src: currentTierBadge, alt: "", "aria-hidden": "true" }),
        /*#__PURE__*/React.createElement("div", { className: "md-arena-summary-details" },
          /*#__PURE__*/React.createElement("span", { className: "md-arena-summary-text md-arena-season-line" },
            !match && arenaHubAssets.icons.season && /*#__PURE__*/React.createElement("img", { className: "md-arena-inline-icon", src: arenaHubAssets.icons.season, alt: "", "aria-hidden": "true" }),
            "ซีซันเหลือ ", seasonCountdownText),
          /*#__PURE__*/React.createElement("span", { className: "md-arena-summary-text" }, "Rating ", status.player.rating, " · ", status.player.tier, status.player.rank ? ` · #${status.player.rank}` : ""))),
      !match && /*#__PURE__*/React.createElement("p", { className: "md-arena-summary-hint" }, "แตะสกุลเงินด้านบนเพื่อดูรายละเอียด")),
    !match && /*#__PURE__*/React.createElement("div", { className: "md-tab-row md-arena-tab-row" }, ["battle", "setup", "ranking", "history"].map(key => /*#__PURE__*/React.createElement("button", {
      key, type: "button", className: `md-btn small md-arena-tab ${tab === key ? "active" : "inactive"}`, onClick: () => loadTab(key), "aria-pressed": tab === key
    },
      arenaHubAssets.icons[key] && /*#__PURE__*/React.createElement("img", { className: "md-arena-tab-icon", src: arenaHubAssets.icons[key], alt: "", "aria-hidden": "true" }),
      /*#__PURE__*/React.createElement("span", { className: "md-arena-tab-label" }, key.toUpperCase())
    ))),
    error && /*#__PURE__*/React.createElement(RuntimeDiagnosticOverlay, {
      diagnostic: {
        event: "arena_ui_failure",
        reason: /^[a-z0-9_]+$/i.test(String(error)) ? String(error) : "arena_request_failed",
        code: /^[a-z0-9_]+$/i.test(String(error)) ? String(error) : undefined,
        action: currentActionRef.current,
        arenaPhase: tab,
        message: error
      },
      title: "Arena error",
      summary: "Arena ไม่สามารถทำรายการนี้ได้ รายละเอียดด้านล่างถูกคัดกรองแล้วและไม่เปลี่ยนสถานะ match, Ticket, Rating หรือรางวัล",
      onClose: () => setError("")
    }),
    !match && tab === "battle" && /*#__PURE__*/React.createElement("div", { className: "md-card md-arena-hub-panel md-arena-battle-panel" },
      opponents.map(opp => /*#__PURE__*/React.createElement("div", { className: "md-shop-row md-arena-hub-row", key: opp.opponentKey },
        /*#__PURE__*/React.createElement("span", null, opp.name, " · Lv", opp.level, " · ", opp.rating),
        /*#__PURE__*/React.createElement("button", { className: "md-btn small md-arena-art-btn secondary md-arena-player-card-btn", disabled: busy, onClick: () => openPlayerCard(opp.opponentKey) },
          arenaHubAssets.icons.playerCard && /*#__PURE__*/React.createElement("img", { className: "md-arena-action-icon", src: arenaHubAssets.icons.playerCard, alt: "", "aria-hidden": "true" }),
          /*#__PURE__*/React.createElement("span", null, "PLAYER CARD")))),
      /*#__PURE__*/React.createElement("button", {
        className: "md-btn small md-arena-art-btn secondary md-arena-refresh-button",
        disabled: busy || refreshSeconds > 0,
        onClick: async () => {
          if (busy || refreshSeconds > 0) return;
          setBusy(true); setError("");
          try {
            const r = await cloudRefreshArenaV2Opponents(url, characterId);
            if (r?.error === "arena_refresh_cooldown") {
              setRefreshAvailableAt(r.refreshAvailableAt || new Date(Date.now() + Math.max(1, Number(r.retryAfter) || 1) * 1000).toISOString());
              return;
            }
            if (r?.error) throw new Error(r.error);
            setOpponents(r.opponents || []);
            setRefreshAvailableAt(r.refreshAvailableAt || "");
          } catch (e) { setError(e.message || "รีเฟรชคู่ต่อสู้ไม่สำเร็จ"); }
          finally { setBusy(false); }
        }
      },
        arenaHubAssets.icons.refresh && /*#__PURE__*/React.createElement("img", { className: "md-arena-action-icon", src: arenaHubAssets.icons.refresh, alt: "", "aria-hidden": "true" }),
        /*#__PURE__*/React.createElement("span", null, refreshSeconds > 0 ? `REFRESH · ${refreshSeconds}s` : "REFRESH")),
      /*#__PURE__*/React.createElement("div", { className: "md-arena-milestone-panel", "aria-label": "Arena seasonal milestone progress" },
        /*#__PURE__*/React.createElement(ArenaHubMilestoneRow, { label: "PLAY", progress: arenaPlayProgress, iconSrc: arenaHubAssets.icons.playMilestone }),
        /*#__PURE__*/React.createElement(ArenaHubMilestoneRow, { label: "WIN", progress: arenaWinProgress, iconSrc: arenaHubAssets.icons.winMilestone }))),
    !match && playerCard && /*#__PURE__*/React.createElement(ArenaPlayerCardOverlay, {
      card: playerCard,
      busy,
      onBattle: () => start(playerCard.opponentKey || playerCard.characterId, playerCardSource),
      onClose: () => { setPlayerCard(null); setPlayerCardSource("matchmaking"); }
    }),
    !match && tab === "setup" && /*#__PURE__*/React.createElement("div", { className: "md-card md-arena-hub-panel" },
      /*#__PURE__*/React.createElement("p", { className: "md-title" }, "SETUP · Pet + 4 Skills"),
      /*#__PURE__*/React.createElement("details", { className: "md-arena-setup-picker md-arena-pet-picker" },
        /*#__PURE__*/React.createElement("summary", null,
          /*#__PURE__*/React.createElement("span", { className: "md-arena-pet-avatar", "aria-hidden": "true" }, setup.petInstId ? arenaSetupPetIcon((status.availablePets || []).find(p => p.instId === setup.petInstId)) : "🐾"),
          /*#__PURE__*/React.createElement("span", null, "PET", /*#__PURE__*/React.createElement("b", null, (status.availablePets || []).find(p => p.instId === setup.petInstId)?.name || "No Pet")),
          /*#__PURE__*/React.createElement("i", null, "CHANGE")),
        /*#__PURE__*/React.createElement("div", { className: "md-arena-setup-options", role: "listbox", "aria-label": "Arena Pet" },
          /*#__PURE__*/React.createElement("button", { type: "button", className: !setup.petInstId ? "selected" : "", onClick: () => setSetup({ ...setup, petInstId: "" }), "aria-selected": !setup.petInstId }, /*#__PURE__*/React.createElement("span", null, "🐾"), /*#__PURE__*/React.createElement("b", null, "No Pet")),
          (status.availablePets || []).map(p => /*#__PURE__*/React.createElement("button", { type: "button", key: p.instId, className: setup.petInstId === p.instId ? "selected" : "", onClick: () => setSetup({ ...setup, petInstId: p.instId }), "aria-selected": setup.petInstId === p.instId },
            /*#__PURE__*/React.createElement("span", { className: "md-arena-pet-avatar", "aria-hidden": "true" }, arenaSetupPetIcon(p)),
            /*#__PURE__*/React.createElement("b", null, p.name),
            /*#__PURE__*/React.createElement("small", null, "Lv", p.level, " · ★", p.star))))),
      /*#__PURE__*/React.createElement("div", { className: "md-arena-skill-setup-grid" }, [0, 1, 2, 3].map(i => {
        const selectedSkillId = setup.skillSlots?.[i] || "";
        const selectedSkill = (status.availableSkills || []).find(skill => skill.key === selectedSkillId);
        return /*#__PURE__*/React.createElement(ArenaSkillDropdown, {
          key: i,
          index: i,
          selectedSkillId,
          selectedSkill,
          availableSkills: status.availableSkills || [],
          setup,
          setSetup
        });
      })),
      /*#__PURE__*/React.createElement("div", { className: "md-arena-loadout", "aria-label": "Arena equipment loadout" },
        /*#__PURE__*/React.createElement("strong", null, "EQUIPMENT"),
        /*#__PURE__*/React.createElement("div", { className: "md-arena-loadout-slots" }, arenaSetupEquipmentSlots(status.equipment).map(({ slot, item }) => {
          const slotName = SLOT_LABEL[slot] || slot;
          const label = item ? `${item.name || slotName}${Number(item.enhanceLevel) > 0 ? ` +${item.enhanceLevel}` : ""}` : `${slotName} · Empty`;
          return /*#__PURE__*/React.createElement("span", { key: slot, className: `md-arena-loadout-slot ${item ? "filled" : "empty"}`, title: label, "aria-label": label },
            item ? /*#__PURE__*/React.createElement(GameIcon, { item: { ...item, type: slot }, fallback: SLOT_ICON[slot] || "◆", className: "md-game-icon", alt: "" }) : /*#__PURE__*/React.createElement("span", { className: "md-arena-loadout-placeholder", "aria-hidden": "true" }, SLOT_ICON[slot] || "◇"),
            item && Number(item.enhanceLevel) > 0 && /*#__PURE__*/React.createElement("i", null, `+${item.enhanceLevel}`));
        }))),
      /*#__PURE__*/React.createElement("button", { className: "md-btn primary small md-arena-art-btn primary", disabled: busy, onClick: async () => { setBusy(true); try { const r = await cloudSaveArenaV2Setup(url, characterId, setup.petInstId, setup.skillSlots); if (r?.error) throw new Error(r.error); setSetup(r.setup); } catch (e) { setError(e.message); } finally { setBusy(false); } } }, "SAVE SETUP")),
    !match && tab === "ranking" && /*#__PURE__*/React.createElement("div", { className: "md-card md-arena-hub-panel" }, ranking.map(row => {
      const rowTierName = arenaHubTierNameFromRating(row.rating);
      const rowTierBadge = arenaHubAssets.tiers[rowTierName.toLowerCase()] || "";
      return /*#__PURE__*/React.createElement("div", { className: "md-sub md-arena-hub-row md-arena-ranking-row", key: row.characterId },
        rowTierBadge && /*#__PURE__*/React.createElement("img", { className: "md-arena-ranking-tier", src: rowTierBadge, alt: "", "aria-hidden": "true" }),
        /*#__PURE__*/React.createElement("span", { className: "md-arena-ranking-main" }, "#", row.rank, " ", row.name),
        /*#__PURE__*/React.createElement("span", { className: "md-arena-ranking-meta" }, row.rating, " · ", rowTierName, " · ", row.rewardBucket));
    })),
    !match && tab === "history" && /*#__PURE__*/React.createElement("div", { className: "md-card md-arena-hub-panel" }, ["attack", "defense"].map(kind => {
      const historyIcon = kind === "attack" ? arenaHubAssets.icons.attackHistory : arenaHubAssets.icons.defenseHistory;
      return /*#__PURE__*/React.createElement("div", { key: kind, className: "md-arena-history-group" },
        /*#__PURE__*/React.createElement("p", { className: "md-title md-arena-history-heading" },
          historyIcon && /*#__PURE__*/React.createElement("img", { className: "md-arena-history-icon", src: historyIcon, alt: "", "aria-hidden": "true" }),
          kind === "attack" ? "YOUR ATTACKS" : "INCOMING DEFENSES"),
        (history[kind] || []).map(row => {
          const view = arenaHistoryPresentation(kind, row);
          return /*#__PURE__*/React.createElement("div", { className: "md-sub md-arena-hub-row md-arena-history-row", key: `${kind}-${row.matchId}` },
            /*#__PURE__*/React.createElement("span", { className: "md-arena-history-result" },
              /*#__PURE__*/React.createElement("b", null, view.direction),
              /*#__PURE__*/React.createElement("small", null, view.result, " · ", row.resolution || "resolved", " · Rating ", view.ratingChange >= 0 ? "+" : "", view.ratingChange, view.coin === null ? "" : ` · ${view.coin} Coin`)),
            kind === "defense" && row.attackerCharacterId && /*#__PURE__*/React.createElement("button", { className: "md-btn small md-arena-art-btn secondary", disabled: busy, onClick: () => openPlayerCard(`history:${row.matchId}`, "revenge") }, "REVENGE"));
        }));
    })),
    match && /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-card" }, /*#__PURE__*/React.createElement("p", { className: "md-title" }, "Phaser 2v2 Battle · ", matchIsPrepared ? "Preparing" : `Round ${match.state?.round || 0} / 20`), matchIsPrepared && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "Presentation พร้อมก่อนใช้ Ticket; controls จะเปิดหลัง activation สำเร็จ"), !matchIsPrepared && /*#__PURE__*/React.createElement("button", { className: "md-btn small md-arena-speed-toggle", type: "button", onClick: () => setCombatSpeed(value => value === 1 ? 2 : 1), "aria-label": `Arena presentation speed x${combatSpeed}` }, `×${combatSpeed}`), /*#__PURE__*/React.createElement("div", { className: "md-arena-turn-order", "aria-label": "Arena authoritative turn order" }, /*#__PURE__*/React.createElement(TurnOrderBar, { queue: arenaTurnQueue, activeKey: match.state?.currentActorId, round: match.state?.round, monsters: arenaEnemyUnits, petCombat: arenaPet, unitsById: arenaUnitsById, heroName: playerUnits.find(unit => unit.kind === "hero")?.name || "Hero" })), /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "Speed Queue: ", (match.state?.queue || []).slice(0, 4).map(q => q.name || q.id || q).join(" › ") || (matchIsPrepared ? "waiting for activation" : "—")), /*#__PURE__*/React.createElement("div", { className: `md-arena-phaser-stage status-${phaserStatus}` },
        /*#__PURE__*/React.createElement(PhaserBattlefield, { key: `arena-phaser-${match.matchId}-${presentationAttempt}`, mode: "arena", battleState, preparedSnapshot: match.snapshot, combatSpeed, targetUid: selected, onTargetSelected: setSelectedTarget, onStatus: (s, detail) => {
          setPhaserStatus(s);
          if (s === "ready") preloadGateRef.current?.ready();
          else if (s === "error") {
            preloadGateRef.current?.fail("arena_preload_failed");
            if (arenaMatchIsActive(matchRef.current)) reportArenaFatal(detail || new Error("Arena Phaser presentation failed"), {}, "phaser_error");
            else setError(detail?.message || "Arena presentation โหลดไม่สำเร็จ — กด RETRY ได้");
          }
        } }),
        phaserStatus === "error" && /*#__PURE__*/React.createElement("div", { className: "md-arena-phaser-error", role: "status" }, matchIsPrepared ? "Battle presentation unavailable" : "Battle presentation unavailable · controls remain active")), /*#__PURE__*/React.createElement("p", { className: "md-sub" }, preloadState === "loading" ? "Loading Battle…" : preloadState === "failed" ? "Battle preload failed" : "", " · ", playerUnits.map(u => `${u.name} ${u.hp}/${u.maxHp}`).join(" · "), " VS ", enemyUnits.map(u => `${u.name} ${u.hp}/${u.maxHp}`).join(" · ")), /*#__PURE__*/React.createElement("div", { className: "md-sub" }, "Targets: ", enemyUnits.map(u => /*#__PURE__*/React.createElement("button", { key: u.id, className: `md-btn small ${selected === u.id ? "primary" : ""}`, disabled: !u.alive || !matchIsActive, onClick: () => setSelectedTarget(u.id) }, u.kind || "Hero", " ", u.name))), /*#__PURE__*/React.createElement("p", { className: "md-sub" }, (match.state?.log || []).slice(-2).map((line, i) => /*#__PURE__*/React.createElement("span", { key: i }, line.text || line.message || String(line), " ")), /*#__PURE__*/React.createElement("button", { className: "md-btn small", onClick: () => setShowFullLog(!showFullLog) }, showFullLog ? "HIDE LOG" : "FULL LOG")), showFullLog && /*#__PURE__*/React.createElement("div", { className: "md-card" }, (match.state?.log || []).map((line, i) => /*#__PURE__*/React.createElement("p", { className: "md-sub", key: i }, line.text || line.message || String(line))))),
      match.result ? /*#__PURE__*/React.createElement("div", { className: "md-card md-arena-result-card" },
        resultGraphicSrc && /*#__PURE__*/React.createElement("img", { className: "md-arena-result-emblem", src: resultGraphicSrc, alt: "", "aria-hidden": "true" }),
        /*#__PURE__*/React.createElement("p", { className: "md-title md-arena-result-title" }, "RESULT · ", resultView.outcome),
        /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "Combat: ", resultView.combatResult, " · Rating change: ", resultView.ratingChange ?? "—", " · Arena Coin: ", resultView.arenaCoinEarned ?? "—"),
        /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "Reward: ", resultView.rewardSlot, " · Resolution: ", resultView.resolution),
        /*#__PURE__*/React.createElement("button", { className: "md-btn primary", onClick: () => { setMatch(null); setPlayerCard(null); setPreloadState("idle"); refresh().catch(() => setError("โหลด Arena status ไม่สำเร็จ")); } }, "BACK TO ARENA")) : matchIsPrepared ? /*#__PURE__*/React.createElement("div", { className: "md-card" }, /*#__PURE__*/React.createElement("p", { className: "md-sub" }, preloadState === "failed" ? "Presentation failed before activation. The prepared match is preserved; retry uses the same match ID." : "Waiting for presentation readiness…"), /*#__PURE__*/React.createElement("button", { className: "md-btn primary", disabled: busy, onClick: () => beginPreparedArenaMatch(match) }, "RETRY PRESENTATION"), /*#__PURE__*/React.createElement("button", { className: "md-btn small", disabled: busy, onClick: () => { setMatch(null); setPlayerCard(null); setPreloadState("idle"); } }, "BACK TO ARENA")) : matchIsActive ? /*#__PURE__*/React.createElement("div", { className: "md-card md-arena-action-controls" }, /*#__PURE__*/React.createElement("button", { className: "md-btn attack", disabled: busy, onClick: () => action("basic", null, selected) }, "⚔️ ATTACK"), /*#__PURE__*/React.createElement("button", { className: "md-btn small", disabled: busy, onClick: toggleAuto }, auto ? "AUTO ON" : "AUTO"), /*#__PURE__*/React.createElement("button", { className: "md-btn flee md-arena-surrender-btn", disabled: busy || (Date.parse(match.activatedAt || match.activated_at || "") + 10000 > now), onClick: () => action("surrender", null, selected) }, Date.parse(match.activatedAt || match.activated_at || "") + 10000 > now ? "SURRENDER (10s)" : "SURRENDER"), (setup.skillSlots || []).map((skill, index) => {
          const definition = (status.availableSkills || []).find(candidate => candidate.key === skill);
          return /*#__PURE__*/React.createElement("button", { key: `${index}-${skill || "empty"}`, className: "md-btn small md-arena-skill-control", disabled: busy || !skill, onClick: () => action("active", skill, selected) },
            skill ? /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: skill, className: "md-hero-skill-icon md-arena-battle-skill-icon", alt: definition?.name || heroSkillDisplayName(skill), loading: "eager" }) : /*#__PURE__*/React.createElement("span", { className: "md-hero-skill-icon fallback", "aria-hidden": "true" }, "✦"),
            /*#__PURE__*/React.createElement("span", null, skill ? definition?.name || heroSkillDisplayName(skill) : `Skill ${index + 1}`));
        })) : /*#__PURE__*/React.createElement("div", { className: "md-card" }, /*#__PURE__*/React.createElement("p", { className: "md-sub" }, `Arena match is ${matchStatus || "unavailable"}; controls are disabled.`), /*#__PURE__*/React.createElement("button", { className: "md-btn small", onClick: () => { setMatch(null); setPlayerCard(null); refresh(); } }, "BACK TO ARENA")),
    ),
    !match && /*#__PURE__*/React.createElement(GameDock, {
      onCharacter,
      onOpenInv,
      onPets,
      onSettings,
      onSave,
      onFriend,
      onChat,
      onGuild,
      onMainHub
    })));
}

// Turns a mail's item descriptor (worker-side plain data: type/rarity/name/stats/setId/star)
// into a proper client-side item object with a fresh local id + empowerSlots array, ready to
// drop into inventory. The worker never touches items table directly (see mailbox comment in
// api.js) — this is the one place a mail's equipment reward actually "becomes" a real item.
function materializeMailItem(desc) {
  return {
    id: desc.id || `mail-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    empowerSlots: Array(Math.max(1, desc.empowerSlotCount || desc.empowerSlotCapacity || 1)).fill(null),
    ...(desc.empowerSlotCapacity ? { empowerSlotCapacity: Number(desc.empowerSlotCapacity) || 0 } : {}),
    ...(desc.gearTier ? { gearTier: Number(desc.gearTier) || 0 } : {}),
    ...(desc.rewardVersion ? { rewardVersion: Number(desc.rewardVersion) || 0 } : {}),
    ...(desc.itemModelVersion ? { itemModelVersion: Number(desc.itemModelVersion) || 0 } : {}),
    ...(desc.sourceType ? { sourceType: desc.sourceType } : {}),
    ...(desc.sourceFloor ? { sourceFloor: Number(desc.sourceFloor) || 0 } : {}),
    ...(desc.specialSource ? { specialSource: desc.specialSource } : {}),
    ...(desc.sourceIdentity ? { sourceIdentity: desc.sourceIdentity } : {}),
    ...(desc.utilityStat ? { utilityStat: desc.utilityStat } : {}),
    ...(desc.setId ? { setId: desc.setId } : {}),
    ...(desc.star ? { star: desc.star } : {}),
    ...(desc.craftRecipeId ? { craftRecipeId: desc.craftRecipeId } : {}),
    ...(desc.bossWeaponId ? { bossWeaponId: desc.bossWeaponId } : {}),
    ...(desc.signatureId ? { signatureId: desc.signatureId } : {}),
    ...(desc.sourceBossId ? { sourceBossId: desc.sourceBossId } : {})
  };
}
// ---------- Phase 3.1: Mailbox ----------
// Formats a mail's created_at (ISO, UTC) into the device's local date+time, e.g. "12 ก.ย. 10:57".
function formatMailDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${months[d.getMonth()]} ${hh}:${mm}`;
}
function MailboxScreen({
  serverUrl,
  characterId,
  onBeforeClaim,
  onApplyReward,
  onBack
}) {
  const [mails, setMails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState({});
  const [mailError, setMailError] = useState("");
  const claimAllRequestRef = React.useRef(null);
  React.useEffect(() => { claimAllRequestRef.current = null; }, [characterId]);

  const mailboxErrorText = error => error === "invalid_session" || error === "session_expired" || error === "session_replaced"
    ? "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่"
    : "โหลดกล่องจดหมายไม่สำเร็จ กรุณาลองใหม่";

  const load = () => {
    setMailError("");
    setMails(null);
    cloudGetMailbox(serverUrl || DEFAULT_SERVER_URL, characterId).then(res => {
      if (!res || res.error) {
        setMailError(mailboxErrorText(res && res.error));
        setMails([]);
        return;
      }
      setMails(res.mails || []);
      // Drop selections for mail that no longer exists (e.g. after a delete).
      setSelected(prev => {
        const ids = new Set((res.mails || []).map(m => m.mailId));
        const next = {};
        Object.keys(prev).forEach(id => { if (ids.has(id)) next[id] = prev[id]; });
        return next;
      });
    }).catch(() => {
      setMailError(mailboxErrorText("network_error"));
      setMails([]);
    });
  };
  React.useEffect(() => { load(); }, [characterId]);

  const handleClaim = async (mailId) => {
    if (busy) return;
    setBusy(true);
    setMailError("");
    try {
      if (onBeforeClaim && !await onBeforeClaim(characterId)) throw new Error("save_barrier_failed");
      const res = await cloudClaimMail(serverUrl || DEFAULT_SERVER_URL, characterId, mailId);
      if (!res || res.error) { setMailError("รับรางวัลไม่สำเร็จ กรุณาลองใหม่"); return; }
      onApplyReward(res, characterId);
      load();
    } catch { setMailError("รับรางวัลไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  };

  const handleClaimAll = async () => {
    if (busy) return;
    setBusy(true);
    setMailError("");
    if (!claimAllRequestRef.current) {
      const entropy = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      claimAllRequestRef.current = `claim-all-${characterId}-${entropy}`;
    }
    const requestId = claimAllRequestRef.current;
    try {
      if (onBeforeClaim && !await onBeforeClaim(characterId)) throw new Error("save_barrier_failed");
      const res = await cloudClaimAllMail(serverUrl || DEFAULT_SERVER_URL, characterId, requestId);
      if (!res || res.error) { setMailError("รับรางวัลทั้งหมดไม่สำเร็จ กรุณาลองใหม่"); return; }
      claimAllRequestRef.current = null;
      onApplyReward(res, characterId);
      load();
    } catch { setMailError("รับรางวัลทั้งหมดไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  };

  const toggleSelect = (mailId) => setSelected(prev => ({ ...prev, [mailId]: !prev[mailId] }));

  const handleDeleteOne = (mailId) => {
    if (busy) return;
    setBusy(true);
    setMailError("");
    cloudDeleteMail(serverUrl || DEFAULT_SERVER_URL, characterId, mailId).then(res => {
      setBusy(false);
      if (!res || res.error) { setMailError("ลบจดหมายไม่สำเร็จ กรุณาลองใหม่"); return; }
      load();
    }).catch(() => { setBusy(false); setMailError("ลบจดหมายไม่สำเร็จ กรุณาลองใหม่"); });
  };

  const handleDeleteSelected = () => {
    const ids = Object.keys(selected).filter(id => selected[id]);
    if (!ids.length || busy) return;
    setBusy(true);
    setMailError("");
    cloudDeleteMails(serverUrl || DEFAULT_SERVER_URL, characterId, ids).then(res => {
      setBusy(false);
      if (!res || res.error) { setMailError("ลบจดหมายที่เลือกไม่สำเร็จ กรุณาลองใหม่"); return; }
      setSelected({});
      load();
    }).catch(() => { setBusy(false); setMailError("ลบจดหมายที่เลือกไม่สำเร็จ กรุณาลองใหม่"); });
  };

  const handleDeleteAllClaimed = () => {
    if (busy) return;
    setBusy(true);
    setMailError("");
    cloudDeleteAllClaimedMail(serverUrl || DEFAULT_SERVER_URL, characterId).then(res => {
      setBusy(false);
      if (!res || res.error) { setMailError("ลบจดหมายที่รับแล้วไม่สำเร็จ กรุณาลองใหม่"); return; }
      setSelected({});
      load();
    }).catch(() => { setBusy(false); setMailError("ลบจดหมายที่รับแล้วไม่สำเร็จ กรุณาลองใหม่"); });
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
    mailError && /*#__PURE__*/React.createElement("div", { className: "md-card md-mail-error", role: "alert" },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, mailError),
      /*#__PURE__*/React.createElement("button", { className: "md-btn info small", disabled: busy, onClick: load }, "ลองใหม่")),
    claimedMails.length > 0 && /*#__PURE__*/React.createElement("div", { className: "md-card", style: { marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 } },
      /*#__PURE__*/React.createElement("p", { className: "md-sub" }, selectedCount > 0 ? `เลือกแล้ว ${selectedCount} ฉบับ` : "จดหมายที่รับแล้ว"),
      /*#__PURE__*/React.createElement("div", { style: { display: "flex", gap: 6 } },
        selectedCount > 0 && /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", disabled: busy, onClick: handleDeleteSelected }, "🗑️ ลบที่เลือก"),
        /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", disabled: busy, onClick: handleDeleteAllClaimed }, "🗑️ ลบที่รับแล้วทั้งหมด"))),
    mails.length === 0 && !mailError && /*#__PURE__*/React.createElement("p", { className: "md-sub" }, "ยังไม่มีจดหมาย"),
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
        /*#__PURE__*/React.createElement("p", { className: "md-sub", style: { fontSize: 11, opacity: 0.7 } }, "🕐 ", formatMailDate(m.createdAt)),
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
  const elite = monsters.find(monster => monster.isElite);
  if (elite) events.push({
    id: "elite",
    icon: "♛",
    name: "Elite Encounter",
    desc: "ศัตรู Elite ที่คงเอกลักษณ์ของมอนสเตอร์ต้นทาง",
    color: "#b48cff",
    effects: ["Enemy HP +30%", "Enemy ATK +10%", "Enemy DEF +5%"]
  });
  const boss = monsters.find(monster => monster.isBoss);
  if (boss) {
    events.push({
      id: "boss",
      icon: "♛",
      name: "Chapter Boss",
      desc: "เอาชนะบอสประจำ Chapter เพื่อปลดล็อกเส้นทางต่อไป",
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
  serverUrl,
  arenaHud,
  unlockedFloor,
  onSelectFloor,
  onSave,
  onBack,
  onCharacter,
  onOpenInv,
  onPets,
  onSettings,
  onFriend,
  onChat,
  onGuild,
  onMainHub
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

  const openFloor = async floor => {
    if (floor > unlockedFloor) return;
    const cached = encounterCache.current.get(floor);
    if (cached) {
      setDetail({ floor, monsters: cached.monsters, previewContext: cached.previewContext, loading: false });
      return;
    }
    setDetail({ floor, monsters: [], previewContext: null, loading: true });
    const preview = await cloudGetDungeonEncounterPreview(serverUrl, save.characterId, floor);
    if (!preview?.ok || !preview?.context) {
      setDetail({
        floor,
        monsters: [],
        previewContext: null,
        loading: false,
        error: preview?.error || "dungeon_preview_failed"
      });
      return;
    }
    const monsters = makeEncounter(floor, { serverContext: preview.context });
    encounterCache.current.set(floor, { monsters, previewContext: preview.context });
    setDetail({ floor, monsters, previewContext: preview.context, loading: false });
  };
  const enterSelectedFloor = () => {
    if (!detail || detail.loading || detail.error || detail.floor > unlockedFloor) return;
    onSelectFloor(detail.floor, detail.monsters, detail.previewContext);
  };
  return e("main", { className: `md-dungeon-map-page${detail ? " detail-open" : ""}` },
    e(GlobalCurrencyBar, { save, arena: arenaHud, className: "md-dungeon-resources" }),
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
        const encounterType = DUNGEON_V2.classifyDungeonEncounter(floor);
        const boss = encounterType === DUNGEON_V2.ENCOUNTER_TYPES.CHAPTER_BOSS;
        const elite = encounterType === DUNGEON_V2.ENCOUNTER_TYPES.ELITE;
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
          (boss || elite) && e("span", { className: "md-dungeon-boss-label" }, elite ? "ELITE" : "BOSS"),
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
    e(GameDock, {
      onCharacter,
      onOpenInv,
      onPets,
      onSettings,
      onSave,
      onFriend,
      onChat,
      onGuild,
      onMainHub
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
        e("div", { className: `md-floor-detail-heading${DUNGEON_V2.classifyDungeonEncounter(detail.floor) !== DUNGEON_V2.ENCOUNTER_TYPES.NORMAL ? " boss" : ""}` },
          e("div", { className: "md-floor-title" },
            e("small", null, DUNGEON_V2.classifyDungeonEncounter(detail.floor) === DUNGEON_V2.ENCOUNTER_TYPES.CHAPTER_BOSS ? "CHAPTER BOSS" : DUNGEON_V2.classifyDungeonEncounter(detail.floor) === DUNGEON_V2.ENCOUNTER_TYPES.ELITE ? "ELITE ENCOUNTER" : "DUNGEON FLOOR"),
            e("h2", { id: "md-floor-detail-title" }, "ชั้น ", detail.floor)
          ),
          e("div", { className: "md-floor-cp" }, e("span", null, "⚔ พลังต่อสู้แนะนำ"), e("strong", null, detail.loading || detail.error ? "—" : formatNumber(recommendedFloorCp(detail.monsters))))
        ),
        detail.loading
          ? e("div", { className: "md-floor-preview-loading", role: "status" }, "กำลังโหลดข้อมูล encounter จากเซิร์ฟเวอร์…")
          : detail.error
            ? e("div", { className: "md-floor-preview-error", role: "alert" }, "โหลดข้อมูลมอนไม่สำเร็จ: ", detail.error)
            : e("div", { className: "md-floor-monster-stage", "aria-label": "มอนสเตอร์ประจำชั้น" },
              detail.monsters.map(monster => e("div", { className: "md-floor-monster", key: monster.uid },
                e(FloorMonsterPreview, { monster }),
                e("span", null, monster.name.replace(/\s*\((?:Elite\s+)?Boss\)\s*/gi, ""))
              ))
            ),
        e("h3", null, "อีเวนต์ชั้นนี้"),
        e("div", { className: "md-floor-events" },
          (detail.monsters || []).length ? floorEventPreview(detail.monsters).map(event => e("div", {
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
          )) : []
        ),
        e("h3", null, "รางวัลที่อาจได้รับ"),
        e("div", { className: "md-floor-rewards" },
          floorRewardPreview(detail.floor, detail.monsters || []).map(reward => e("div", { key: reward.hint },
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
  const [tab, setTab] = useState("equipment");
  const [status, setStatus] = useState("");
  const bodyRef = useRef(null);
  const tabs = [
    ["equipment", "อุปกรณ์"],
    ["hp", "ยา HP"],
    ["sp", "ยา SP"],
    ["other", "อื่นๆ"]
  ];
  const showStatus = msg => {
    setStatus(msg);
    window.setTimeout(() => setStatus(current => current === msg ? "" : current), 1400);
  };
  const guardBuy = (canAfford, action) => {
    if (!canAfford) {
      showStatus("เงินไม่พอซื้อ");
      return;
    }
    action();
  };
  const selectTab = next => {
    setTab(next);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  };
  const potions = stock?.potions || [];
  const hpPotions = potions.filter(p => String(p.id || "").startsWith("hp_"));
  const spPotions = potions.filter(p => String(p.id || "").startsWith("mp_"));
  const resourceRow = (type, price) => {
    const info = JUNK_INFO[type];
    return /*#__PURE__*/React.createElement("div", {
      key: type,
      className: "md-shop-resource-row"
    }, /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("div", { className: "md-inv-name" },
        /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: type }, fallback: info.icon, className: "md-game-icon md-shop-item-icon", alt: info.name }),
        " ", info.name
      ),
      /*#__PURE__*/React.createElement("div", { className: "md-inv-stat" }, "ราคา ", price, " ทอง")
    ), /*#__PURE__*/React.createElement("button", {
      className: "md-buy-btn md-shop-buy-action",
      onClick: () => guardBuy(gold >= price, () => onBuyMaterial(type)),
      "aria-label": `ซื้อ ${info.name}`
    }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), price));
  };
  const potionRow = p => /*#__PURE__*/React.createElement("div", {
    key: p.id,
    className: "md-shop-resource-row"
  }, /*#__PURE__*/React.createElement("div", null,
    /*#__PURE__*/React.createElement("div", { className: "md-inv-name" },
      /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: p.id }, fallback: p.icon, className: "md-game-icon md-shop-item-icon", alt: p.name }),
      " ", p.name
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-inv-stat" }, p.desc, " · ", p.price, " ทอง")
  ), /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn md-shop-buy-action",
    onClick: () => guardBuy(gold >= p.price, () => onBuyPotionTier(p.id)),
    "aria-label": `ซื้อ ${p.name}`
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), p.price));
  return /*#__PURE__*/React.createElement("div", {
    className: "md-shop-sheet-backdrop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-sheet",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Shop"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-shop-title-row"
  }, /*#__PURE__*/React.createElement("p", { className: "md-title", style: { margin: 0 } }, "🛒 Shop"),
    /*#__PURE__*/React.createElement("button", {
      className: "md-btn flee small md-shop-close",
      onClick: onClose,
      "aria-label": "ปิดร้าน"
    }, "ปิด")
  ), /*#__PURE__*/React.createElement("div", {
    className: "md-shop-currencies",
    "aria-label": "Shop currencies"
  }, [
    ["gold", "gold", "🪙", gold || 0],
    ["diamond", "diamond", "💎", diamonds || 0],
    ["stone", "protectionStone", "🛡️", protectionStones || 0]
  ].map(([key, iconKey, fallback, value]) => /*#__PURE__*/React.createElement("span", {
    key,
    className: "md-shop-currency-pill"
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey, fallback, className: "md-game-icon md-inline-item-icon", alt: key }), value))),
  /*#__PURE__*/React.createElement("div", {
    className: "md-shop-tabs",
    role: "tablist",
    "aria-label": "Shop categories"
  }, tabs.map(([key, label]) => /*#__PURE__*/React.createElement("button", {
    key,
    type: "button",
    role: "tab",
    "aria-selected": tab === key,
    className: `md-shop-tab ${tab === key ? "active" : ""}`,
    onClick: () => selectTab(key)
  }, label))),
  /*#__PURE__*/React.createElement("div", {
    className: `md-shop-status ${status ? "visible" : ""}`,
    role: "status",
    "aria-live": "polite"
  }, status || "ร้านค้าพร้อมซื้อ")
  ), /*#__PURE__*/React.createElement("div", {
    ref: bodyRef,
    className: "md-shop-body"
  }, tab === "equipment" && /*#__PURE__*/React.createElement(React.Fragment, null,
    stock.items.length === 0 ? /*#__PURE__*/React.createElement("p", { className: "md-sub md-shop-empty" }, "อุปกรณ์หมดแล้ว — ปิดแล้วเปิดใหม่เพื่อสุ่มร้านใหม่") :
    stock.items.map(it => /*#__PURE__*/React.createElement("div", {
      key: it.id,
      className: `md-inv-item md-shop-equipment-card ${it.rarity}`
    }, /*#__PURE__*/React.createElement("div", { className: "md-shop-item-copy" },
      /*#__PURE__*/React.createElement("div", { className: "md-inv-name" },
        /*#__PURE__*/React.createElement(GameIcon, { item: it, fallback: SLOT_ICON[it.type], className: "md-game-icon md-shop-item-icon", alt: it.name }), " ", it.name
      ),
      /*#__PURE__*/React.createElement("div", { className: "md-shop-item-meta" },
        /*#__PURE__*/React.createElement(StarRating, { rarity: it.rarity }),
        /*#__PURE__*/React.createElement("span", { className: "md-inv-stat" }, itemStatText(it))
      )
    ), /*#__PURE__*/React.createElement("button", {
      className: "md-buy-btn md-shop-buy-action",
      onClick: () => guardBuy(gold >= it.price, () => onBuyItem(it))
    }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }),
      /*#__PURE__*/React.createElement("span", { className: gold < it.price ? "md-cost-insufficient" : "" }, it.price)
    )))
  ), tab === "hp" && hpPotions.map(potionRow),
  tab === "sp" && spPotions.map(potionRow),
  tab === "other" && /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("div", { className: "md-shop-resource-row" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("div", { className: "md-inv-name" },
          /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: "protectionStone" }, fallback: "🛡️", className: "md-game-icon md-shop-item-icon", alt: "Protection Stone" }), " หินป้องกัน"
        ),
        /*#__PURE__*/React.createElement("div", { className: "md-inv-stat" }, "มีอยู่ ", protectionStones || 0, " · ป้องกันเลเวลตีบวกร่วงเมื่อล้มเหลว (+7 ขึ้นไป)")
      ),
      /*#__PURE__*/React.createElement("button", {
        className: "md-buy-btn md-shop-buy-action",
        onClick: () => guardBuy((diamonds || 0) >= PROTECTION_STONE_PRICE, onBuyProtectionStone)
      }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), PROTECTION_STONE_PRICE)
    ),
    resourceRow("iron", MATERIAL_SHOP_PRICE.iron),
    resourceRow("manaOre", MATERIAL_SHOP_PRICE.manaOre)
  ));
}
function PetRoster({ owned, activePetId, selectedPetId, petDuplicates, onSelect }) {
  return /*#__PURE__*/React.createElement("div", {
    className: "md-pet-roster",
    "aria-label": "Owned pets"
  }, owned.map(inst => {
    const def = getPetDef(inst.defId);
    if (!def) return null;
    const isActive = activePetId === inst.instId;
    const star = inst.star || 1;
    const petLevel = Math.max(1, Math.min(50, Number(inst.level) || 1));
    return /*#__PURE__*/React.createElement("button", {
      key: inst.instId,
      type: "button",
      className: `md-pet-roster-item ${selectedPetId === inst.instId ? "selected" : ""} ${isActive ? "active" : ""}`,
      onClick: () => onSelect(inst.instId)
    }, /*#__PURE__*/React.createElement("span", {
      className: "md-pet-roster-icon"
    }, def.icon), /*#__PURE__*/React.createElement("span", {
      className: "md-pet-roster-copy"
    }, /*#__PURE__*/React.createElement("strong", null, def.name), /*#__PURE__*/React.createElement("small", null, PET_RARITY_LABEL[def.rarity], " · Lv.", petLevel, " · ", "★".repeat(star)), /*#__PURE__*/React.createElement("small", null, "Dup ", petDuplicateCount(petDuplicates, inst.defId))), isActive && /*#__PURE__*/React.createElement("span", {
      className: "md-pet-active-dot",
      title: "Active Pet"
    }, "●"));
  }));
}

function PetDetailPanel({ children }) {
  return /*#__PURE__*/React.createElement("div", {
    className: "md-pet-detail"
  }, children);
}

function PetPageActions({ onOpenGacha, onBack }) {
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    style: { marginBottom: 8 },
    onClick: onOpenGacha
  }, "🎰 Pet Gacha"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn flee wide small",
    onClick: onBack
  }, "← Back"));
}

function PetScreen({
  save,
  onEquip,
  onUnequip,
  onStarUp,
  onOpenGacha,
  onCharacter,
  onOpenInv,
  onSettings,
  onSave,
  onFriend,
  onChat,
  onGuild,
  onMainHub,
  onBack
}) {
  const [starUpMsg, setStarUpMsg] = React.useState({}); // instId -> {text, short:bool}
  const [selectedPetId, setSelectedPetId] = React.useState(save.activePetId || save.pets?.[0]?.instId || null);
  const [detailTab, setDetailTab] = React.useState("info");
  const rarityRank = { r: 0, sr: 1, ssr: 2 };
  const owned = [...(save.pets || [])].sort((a, b) => {
    const da = getPetDef(a.defId);
    const db = getPetDef(b.defId);
    return (rarityRank[db?.rarity] ?? 0) - (rarityRank[da?.rarity] ?? 0);
  });
  React.useEffect(() => {
    if (!owned.some(p => p.instId === selectedPetId)) setSelectedPetId(save.activePetId || owned[0]?.instId || null);
  }, [save.activePetId, save.pets, selectedPetId]);
  const selected = owned.find(p => p.instId === selectedPetId) || owned[0] || null;
  const selectedDef = selected ? getPetDef(selected.defId) : null;
  const selectedStats = selected ? petCombatStats(selected) : null;
  const selectedLevel = selected ? Math.max(1, Math.min(50, Number(selected.level) || 1)) : 1;
  const selectedXp = selected ? Math.max(0, Number(selected.xp) || 0) : 0;
  const selectedXpNeed = selectedLevel < 50 ? petXpToNext(selectedLevel) : 0;
  const selectedXpPct = selectedLevel < 50 && selectedXpNeed > 0 ? Math.min(100, selectedXp / selectedXpNeed * 100) : 100;
  const selectedStar = selected ? Math.max(1, Math.min(3, Number(selected.star) || 1)) : 1;
  const selectedRole = selectedDef?.role || "attack";
  const roleLabel = { attack: "Attack", support: "Support", tank: "Tank", control: "Control" }[selectedRole] || "Attack";
  const spriteConfig = selectedDef ? getPetSpriteConfig(selectedDef.id) : null;
  const auraUrl = selectedStar === 3 ? petUiUrl("starAuras.threeStar") : selectedStar === 2 ? petUiUrl("starAuras.twoStar") : "";
  async function handleStarUp(inst) {
    const res = await onStarUp(inst.instId);
    if (res && res.ok) {
      setStarUpMsg(m => ({ ...m, [inst.instId]: null }));
      return;
    }
    if (res && res.maxed) {
      setStarUpMsg(m => ({ ...m, [inst.instId]: { text: "★3 เต็มแล้ว", short: false } }));
      return;
    }
    const missing = (res.need || 0) - (res.have || 0);
    setStarUpMsg(m => ({
      ...m,
      [inst.instId]: { text: `ตัวซ้ำไม่พอ ขาดอีก ${missing} ตัว (มี ${res.have}/${res.need})`, short: true }
    }));
  }
  function skillPanel(kind, skill) {
    if (!skill) return null;
    return /*#__PURE__*/React.createElement("div", {
      className: "md-pet-skill-panel md-pet-ui-art",
      style: petUiStyle("skillInfoPanel")
    }, /*#__PURE__*/React.createElement("div", {
      className: "md-pet-skill-title md-pet-ui-art",
      style: petUiStyle("skillTitlePlate")
    }, kind), /*#__PURE__*/React.createElement("div", {
      className: "md-pet-skill-copy"
    }, /*#__PURE__*/React.createElement("strong", null, skill.icon, " ", skill.name), skill.cooldown ? /*#__PURE__*/React.createElement("span", null, "CD ", skill.cooldown) : null, /*#__PURE__*/React.createElement("p", null, skill.desc)));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "md-panel md-pet-page",
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
  }, "Pets")), /*#__PURE__*/React.createElement("div", {
    className: "md-card md-pet-card",
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
  }, "ยังไม่มีสัตว์เลี้ยง — เอาชนะบอสด่าน 5 เพื่อรับสัตว์เลี้ยงตัวแรก!"), owned.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "md-pet-layout"
  }, /*#__PURE__*/React.createElement(PetRoster, {
    owned,
    activePetId: save.activePetId,
    selectedPetId: selected?.instId,
    petDuplicates: save.petDuplicates,
    onSelect: setSelectedPetId
  }), selected && selectedDef && /*#__PURE__*/React.createElement(PetDetailPanel, null, /*#__PURE__*/React.createElement("section", {
    className: "md-pet-profile md-pet-ui-art",
    style: petUiStyle("mainFrame")
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-pet-showcase"
  }, auraUrl && /*#__PURE__*/React.createElement("img", {
    className: "md-pet-star-aura",
    src: auraUrl,
    alt: "",
    "aria-hidden": "true",
    draggable: false
  }), spriteConfig ? /*#__PURE__*/React.createElement(AnimatedFrameSprite, {
    config: spriteConfig,
    className: "md-pet-profile-sprite",
    alt: selectedDef.name,
    idleFrameMs: 260,
    cropTransparent: true,
    visualHeight: 118,
    maxVisualWidth: 145,
    fallback: selectedDef.icon
  }) : /*#__PURE__*/React.createElement("div", {
    className: "md-pet-profile-fallback",
    role: "img",
    "aria-label": selectedDef.name
  }, selectedDef.icon)), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-name-row"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("strong", null, selectedDef.name), /*#__PURE__*/React.createElement("span", null, "Lv.", selectedLevel, " · ", PET_RARITY_LABEL[selectedDef.rarity]))), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-role"
  }, /*#__PURE__*/React.createElement("span", {
    className: "md-pet-role-icon md-pet-ui-art",
    style: petUiStyle(`roles.${selectedRole}`),
    "aria-hidden": "true"
  }), roleLabel), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-stars",
    "aria-label": `${selectedStar} of 3 stars`
  }, [1, 2, 3].map(index => /*#__PURE__*/React.createElement("span", {
    key: index,
    className: `md-pet-star md-pet-ui-art ${index <= selectedStar ? "earned" : ""}`,
    style: petUiStyle("starIcon")
  }))), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-exp-copy"
  }, /*#__PURE__*/React.createElement("span", null, "EXP"), /*#__PURE__*/React.createElement("strong", null, selectedLevel < 50 ? `${selectedXp} / ${selectedXpNeed}` : "MAX")), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-exp-bar",
    style: petUiStyle("expBar.background")
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-pet-exp-fill md-pet-ui-art",
    style: { ...petUiStyle("expBar.fill"), width: `${selectedXpPct}%` }
  }), /*#__PURE__*/React.createElement("span", {
    className: "md-pet-exp-frame md-pet-ui-art",
    style: petUiStyle("expBar.frame"),
    "aria-hidden": "true"
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-primary-stats"
  }, [["HP", selectedStats.maxHp], ["ATK", selectedStats.atk], ["DEF", selectedStats.def], ["SPD", selectedStats.speed]].map(([label, value]) => /*#__PURE__*/React.createElement("div", {
    key: label
  }, /*#__PURE__*/React.createElement("small", null, label), /*#__PURE__*/React.createElement("strong", null, value)))))), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-details-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-pet-detail-tabs"
  }, ["info", "skills", "growth"].map(tab => /*#__PURE__*/React.createElement("button", {
    key: tab,
    type: "button",
    className: detailTab === tab ? "active" : "",
    onClick: () => setDetailTab(tab)
  }, tab === "info" ? "Info" : tab === "skills" ? "Skills" : "Growth"))), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-tab-content"
  }, detailTab === "info" && /*#__PURE__*/React.createElement("div", {
    className: "md-pet-secondary-stats"
  }, [["Accuracy", `${selectedStats.hitRate}%`], ["Dodge", `${selectedStats.evasion}%`], ["Crit", `${selectedStats.critChance}%`], ["Drop", `+${selectedStats.dropBonus}%`]].map(([label, value]) => /*#__PURE__*/React.createElement("div", { key: label }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("strong", null, value)))), detailTab === "skills" && /*#__PURE__*/React.createElement("div", {
    className: "md-pet-skill-list"
  }, skillPanel("ACTIVE", selectedDef.active), skillPanel("PASSIVE", selectedDef.passive), skillPanel("EXTRA", selectedDef.extra)), detailTab === "growth" && /*#__PURE__*/React.createElement("div", {
    className: "md-pet-growth"
  }, /*#__PURE__*/React.createElement("div", null, "STR ", selectedStats.rawStats.str.toFixed(1), " · VIT ", selectedStats.rawStats.vit.toFixed(1), " · AGI ", selectedStats.rawStats.agi.toFixed(1)), /*#__PURE__*/React.createElement("div", null, "DEX ", selectedStats.rawStats.dex.toFixed(1), " · LUK ", selectedStats.rawStats.luk.toFixed(1)), /*#__PURE__*/React.createElement("div", null, petStarUpCost(selectedStar) === null ? "★3 สูงสุด" : `ตัวซ้ำ ${petDuplicateCount(save.petDuplicates, selected.defId)}/${petStarUpCost(selectedStar)}`))), starUpMsg[selected.instId] && /*#__PURE__*/React.createElement("div", {
    className: `md-pet-message ${starUpMsg[selected.instId].short ? "error" : ""}`
  }, starUpMsg[selected.instId].text), /*#__PURE__*/React.createElement("div", {
    className: "md-pet-actions"
  }, save.activePetId === selected.instId ? /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    onClick: onUnequip
  }, "Unequip") : /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    onClick: () => onEquip(selected.instId)
  }, "Equip"), petStarUpCost(selectedStar) !== null && /*#__PURE__*/React.createElement("button", {
    className: "md-buy-btn",
    onClick: () => handleStarUp(selected)
  }, `อัพดาว (${petStarUpCost(selectedStar)})`))))), /*#__PURE__*/React.createElement(PetPageActions, {
    onOpenGacha,
    onBack
  }), /*#__PURE__*/React.createElement(GameDock, {
    activeKey: "pets",
    onCharacter,
    onOpenInv,
    onPets: () => {},
    onSettings,
    onSave,
    onFriend,
    onChat,
    onGuild,
    onMainHub
  }));
}
function GachaScreen({
  save,
  gachaResult,
  onClearGachaResult,
  onGacha,
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
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), save.diamonds || 0)), /*#__PURE__*/React.createElement("p", {
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
  }, "สุ่มสัตว์เลี้ยงจากแค็ตตาล็อกที่กำหนด ใช้ 100 Diamonds ต่อครั้ง"), /*#__PURE__*/React.createElement("button", {
    className: "md-btn primary wide",
    disabled: save.diamonds < GACHA_COST,
    onClick: onGacha
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " สุ่ม 1 ครั้ง (", GACHA_COST, " เพชร)")), /*#__PURE__*/React.createElement("button", {
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
      anim: anim || "idle",
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
// Pets use the same manifest-driven crop and anchor pipeline as monsters, but
// need a larger presentation envelope to read clearly beside the Hero.
const PET_COMBAT_VISUAL_SIZES = {
  small: { height: 78, maxWidth: 114 },
  medium: { height: 94, maxWidth: 136 },
  large: { height: 108, maxWidth: 154 },
  elite: { height: 120, maxWidth: 168 }
};
function getMonsterPresentation(enemy) {
  const config = getMonsterSpriteConfig(enemy);
  const configuredSize = config?.presentation?.sizeClass;
  const requestedSize = (enemy?.isElite || enemy?.isEliteBoss) ? "elite" : configuredSize || enemy?.sizeClass || (enemy?.isBoss ? "large" : "medium");
  const sizeClass = MONSTER_VISUAL_SIZES[requestedSize] ? requestedSize : "medium";
  const configuredAnchor = config?.presentation?.anchorType;
  const anchorType = configuredAnchor === "flying" || enemy?.anchorType === "flying" ? "flying" : "ground";
  return { sizeClass, anchorType, ...MONSTER_VISUAL_SIZES[sizeClass] };
}
function EnemySprite({
  enemy,
  battleUnit = null,
  anim,
  selected,
  onClick,
  combatSpeed = 1
}) {
  const statusSource = battleUnit?.statuses || enemy.battleStatuses || {};
  const statusVisible = Boolean(
    enemy.isElite || enemy.isEliteBoss ||
    statusSource.poison ||
    statusSource.stun ||
    statusSource.silence ||
    statusSource.armor_break ||
    statusSource.def_up
  );
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
        attackFrameMs: 150 / combatSpeed,
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
      opacity: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar md-battle-art",
    style: battleUiStyle("hpStatusFrame")
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-fill",
    style: {
      width: `${hpPct}%`
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-hp"
  }, enemy.hp, "/", enemy.maxHp)), statusVisible &&/*#__PURE__*/React.createElement("div", {
    className: "md-unit-status",
    "aria-label": "Enemy status effects"
  }, (enemy.isElite || enemy.isEliteBoss) && /*#__PURE__*/React.createElement("span", {
    className: "elite",
    title: "Elite"
  }, "👑 ELITE"), statusSource.stun && /*#__PURE__*/React.createElement("span", {
    title: `Stun · ${statusSource.stun.duration} turn(s)`
  }, "💫", statusSource.stun.duration), statusSource.poison && /*#__PURE__*/React.createElement("span", {
    title: `Poison · ${statusSource.poison.duration} turn(s)`
  }, "☠️", statusSource.poison.duration), statusSource.armor_break && /*#__PURE__*/React.createElement("span", {
    title: `Armor Break · ${statusSource.armor_break.duration} turn(s)`
  }, "🛡️↓", statusSource.armor_break.duration), statusSource.silence && /*#__PURE__*/React.createElement("span", {
    title: `Silence · ${statusSource.silence.duration} turn(s)`
  }, "🤫", statusSource.silence.duration), statusSource.def_up && /*#__PURE__*/React.createElement("span", {
    className: "def-up",
    title: `DEF Up · ${statusSource.def_up.duration} turn(s)`
  }, "🛡️↑", statusSource.def_up.duration)), selected && !dead && /*#__PURE__*/React.createElement("span", {
    className: "md-target-selected-marker md-battle-art",
    style: battleUiStyle("targetSelectedMarker"),
    "aria-hidden": "true"
  }), spriteVisual || /*#__PURE__*/React.createElement("div", {
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

function getPetPresentation(pet, config = getPetSpriteConfig(pet?.defId)) {
  const configuredSize = config?.presentation?.sizeClass;
  const sizeClass = PET_COMBAT_VISUAL_SIZES[configuredSize] ? configuredSize : "small";
  const anchorType = config?.presentation?.anchorType === "flying" ? "flying" : "ground";
  return { sizeClass, anchorType, ...PET_COMBAT_VISUAL_SIZES[sizeClass] };
}

function PetCombatSprite({ pet, anim, combatSpeed = 1 }) {
  const dead = pet.hp <= 0;
  const hpPct = Math.max(0, Math.min(100, pet.hp / pet.maxHp * 100));
  const spriteConfig = getPetSpriteConfig(pet.defId);
  const presentation = getPetPresentation(pet, spriteConfig);
  const hasVisibleStatus = Boolean(
    pet.cooldown > 0 ||
    pet.atkBuffTurns > 0 ||
    pet.defBuffTurns > 0 ||
    Object.keys(pet.battleStatuses || {}).length
  );
  const spriteVisual = spriteConfig
    ? /*#__PURE__*/React.createElement(AnimatedFrameSprite, {
        key: `${pet.instId}:${dead ? "death" : anim === "attack" ? "attack" : "idle"}`,
        config: spriteConfig,
        anim: anim || "",
        dead,
        // Keep all three attack frames visible long enough to read in combat.
        // The pet action state is held for 520ms at normal speed in App.js.
        attackFrameMs: 150 / combatSpeed,
        cropTransparent: true,
        // One shared crop box keeps Idle/Attack/Death anchored to the same
        // canvas area, including wide attacks and low death poses.
        stableBoundsAnimations: ["idle", "attack", "death"],
        cropPadding: { top: 0.04, right: 0.08, bottom: 0.07, left: 0.04 },
        visualHeight: presentation.height,
        maxVisualWidth: presentation.maxWidth,
        className: `md-enemy-img md-pet-img ${dead ? "death" : anim || ""}`,
        alt: pet.name,
        fallback: pet.icon
      })
    : null;

  return /*#__PURE__*/React.createElement("div", {
    className: `md-sprite-wrap md-pet-unit size-${presentation.sizeClass} anchor-${presentation.anchorType}`,
    style: { opacity: 1 }
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar md-battle-art",
    style: battleUiStyle("hpStatusFrame")
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-track"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-fill",
    style: { width: `${hpPct}%` }
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar-hp"
  }, pet.hp, "/", pet.maxHp)), hasVisibleStatus && /*#__PURE__*/React.createElement("div", {
    className: "md-unit-status pet",
    "aria-label": "Pet status"
  }, pet.battleStatuses?.poison && /*#__PURE__*/React.createElement("span", {
    title: `Poison · ${pet.battleStatuses.poison.duration} turn(s)`
  }, "☠️", pet.battleStatuses.poison.duration), pet.battleStatuses?.stun && /*#__PURE__*/React.createElement("span", {
    title: "Stun · loses one Action"
  }, "💫1"), pet.battleStatuses?.silence && /*#__PURE__*/React.createElement("span", {
    title: `Silence · ${pet.battleStatuses.silence.duration} turn(s)`
  }, "🤫", pet.battleStatuses.silence.duration), pet.battleStatuses?.armor_break && /*#__PURE__*/React.createElement("span", {
    title: `Armor Break · ${pet.battleStatuses.armor_break.duration} turn(s)`
  }, "🛡️↓", pet.battleStatuses.armor_break.duration), pet.battleStatuses?.def_up && /*#__PURE__*/React.createElement("span", {
    title: `DEF Up · ${pet.battleStatuses.def_up.duration} turn(s)`
  }, "🛡️", pet.battleStatuses.def_up.duration), pet.atkBuffTurns > 0 && /*#__PURE__*/React.createElement("span", {
    title: `ATK Up · ${pet.atkBuffTurns} turn(s)`
  }, "⚔️", pet.atkBuffTurns), pet.defBuffTurns > 0 && /*#__PURE__*/React.createElement("span", {
    title: `DEF Up · ${pet.defBuffTurns} turn(s)`
  }, "🛡️", pet.defBuffTurns), pet.cooldown > 0 && /*#__PURE__*/React.createElement("span", {
    className: "cooldown",
    title: pet.active && pet.active.desc
  }, `CD ${pet.cooldown}`)), spriteVisual || /*#__PURE__*/React.createElement("div", {
    className: `md-enemy ${anim || ""}`,
    style: { display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, background: "none", border: "none" }
  }, pet.icon), /*#__PURE__*/React.createElement("div", {
    className: "md-sprite-name"
  }, pet.name, dead ? " 💤" : ""));
}

function BattleVfx({ event, combatSpeed = 1 }) {
  const frames = battleVfxFrames(event?.effectKey);
  const [failedSources, setFailedSources] = useState([]);
  const playableFrames = frames.filter(src => !failedSources.includes(src));
  const [frameIndex, setFrameIndex] = useState(0);
  const frameKey = frames.join("|");
  const playableKey = playableFrames.join("|");
  useEffect(() => {
    setFailedSources([]);
    setFrameIndex(0);
  }, [event?.id, frameKey]);
  useEffect(() => {
    if (playableFrames.length <= 1) return undefined;
    const frameMs = Math.max(80, Math.round(188 / (combatSpeed || 1)));
    const timer = setInterval(() => setFrameIndex(index => Math.min(index + 1, playableFrames.length - 1)), frameMs);
    return () => clearInterval(timer);
  }, [event?.id, playableKey, combatSpeed]);
  if (!playableFrames.length) return null;
  const currentSrc = playableFrames[Math.min(frameIndex, playableFrames.length - 1)];
  return /*#__PURE__*/React.createElement("img", {
    className: `md-battle-vfx kind-${event.kind || "single"} placement-${event.placement || "target"} anchor-${event.anchor || "target"}`,
    src: currentSrc,
    alt: "",
    "aria-hidden": "true",
    draggable: false,
    onError: () => setFailedSources(current => current.includes(currentSrc) ? current : [...current, currentSrc])
  });
}

// Four fixed ATB cells occupy the middle four sixths of the combat header. When
// an action is resolving, the window follows the active unit so upcoming turns
// remain readable even in a five-unit battle (hero + pet + three monsters).
function turnOrderUnitAlive(item, unitsById, monsters, petCombat) {
  const authoritativeUnit = unitsById?.[item?.uid];
  if (authoritativeUnit) return !authoritativeUnit.dead && Number(authoritativeUnit.hp) > 0;
  if (item?.kind === "monster") {
    const monster = (monsters || []).find(mm => mm.uid === item.uid);
    return !!monster && Number(monster.hp) > 0 && !monster.dead;
  }
  if (item?.kind === "pet") return !!petCombat && Number(petCombat.hp) > 0 && !petCombat.dead;
  return true;
}

function TurnOrderActorIcon({ item, monsterSlot = null }) {
  const role = item.isBoss ? "boss" : item.kind;
  const src = typeof battleActorIconUrl === "function" ? battleActorIconUrl(role) : "";
  const [failedSrc, setFailedSrc] = useState("");
  const fallback = item.icon || (role === "player" ? "🧙" : role === "pet" ? "🐾" : role === "boss" ? "👑" : "👹");
  const showAsset = Boolean(src && failedSrc !== src);
  return /*#__PURE__*/React.createElement("span", {
    className: `md-turn-queue-icon ${item.isElite && !item.isBoss ? "elite" : ""}`
  }, showAsset ? /*#__PURE__*/React.createElement("img", {
    src,
    alt: "",
    "aria-hidden": "true",
    draggable: false,
    onError: () => setFailedSrc(src)
  }) : fallback, monsterSlot != null && !item.isBoss && /*#__PURE__*/React.createElement("b", {
    className: "md-turn-queue-spawn-slot",
    "aria-label": `Enemy ${monsterSlot}`
  }, monsterSlot));
}

function TurnOrderBar({ queue, activeKey, round, monsters = [], petCombat, heroName, unitsById = null }) {
  const seenKeys = new Set();
  const visible = (Array.isArray(queue) ? queue : []).filter(item => {
    if (!turnOrderUnitAlive(item, unitsById, monsters, petCombat)) return false;
    if (!item.key || seenKeys.has(item.key)) return false;
    seenKeys.add(item.key);
    return true;
  });
  const activeIndex = Math.max(0, visible.findIndex(item => item.key === activeKey));
  const ordered = visible.slice(activeIndex);
  const overflow = Math.max(0, ordered.length - 4);
  const slots = Array.from({ length: 4 }, (_, index) => ordered[index] || null);
  const numberedMonsterUids = (monsters || []).filter(monster => !monster.isBoss).map(monster => monster.uid);
  const snapshotKey = `${Number(round) || 0}:${activeKey || "idle"}:${slots.map(item => item?.key || "empty").join("|")}`;
  return /*#__PURE__*/React.createElement("div", {
    className: "md-turn-queue"
  }, slots.map((item, i) => {
    if (!item) return /*#__PURE__*/React.createElement("div", {
      key: `${snapshotKey}:empty-${i}`,
      className: "md-turn-queue-item empty md-battle-art",
      style: battleUiStyle("turnOrderSlot"),
      title: "Empty ATB slot"
    }, /*#__PURE__*/React.createElement("span", {
      className: "md-turn-queue-icon"
    }, "·"));
    const isActive = activeKey === item.key;
    return /*#__PURE__*/React.createElement("div", {
      key: `${snapshotKey}:${i}:${item.key}`,
      className: `md-turn-queue-item ${item.kind} ${isActive ? "active" : ""} md-battle-art`,
      style: battleUiStyle("turnOrderSlot"),
      title: `${item.kind === "player" ? heroName : item.name} · Speed ${item.speed}`
    }, /*#__PURE__*/React.createElement(TurnOrderActorIcon, {
      item,
      monsterSlot: item.kind === "monster" && !item.isBoss && numberedMonsterUids.length > 1 ? numberedMonsterUids.indexOf(item.uid) + 1 || null : null
    }), i === 3 && overflow > 0 && /*#__PURE__*/React.createElement("i", {
      className: "md-turn-queue-more"
    }, "+", overflow));
  }));
}

// Presentation-only slot assignment. Slot 1 is the formation centre; a Boss
// always claims it first while adds keep their encounter order on either side.
function buildMonsterFormation(monsters) {
  const ordered = monsters.map((monster, encounterIndex) => ({ monster, encounterIndex })).sort((a, b) => {
    const aFlying = getMonsterPresentation(a.monster).anchorType === "flying" ? 1 : 0;
    const bFlying = getMonsterPresentation(b.monster).anchorType === "flying" ? 1 : 0;
    return aFlying - bFlying || a.encounterIndex - b.encounterIndex;
  }).map(entry => entry.monster);
  const count = Math.min(3, Math.max(1, ordered.length));
  const boss = ordered.find(monster => monster.isBoss || monster.isEliteBoss || monster.isElite);
  if (boss) {
    const adds = ordered.filter(monster => monster !== boss);
    if (count === 1) return [{ monster: boss, slotIndex: 1 }];
    if (count === 2) return [{ monster: adds[0], slotIndex: 0 }, { monster: boss, slotIndex: 1 }];
    return [
      { monster: adds[0], slotIndex: 0 },
      { monster: boss, slotIndex: 1 },
      { monster: adds[1], slotIndex: 2 }
    ];
  }
  const slots = count === 1 ? [1] : count === 2 ? [0, 2] : [0, 1, 2];
  return ordered.map((monster, index) => ({ monster, slotIndex: slots[Math.min(index, 2)] }));
}
function BattleLogPanel({ entries, result = false }) {
  const [expanded, setExpanded] = useState(false);
  const lines = (Array.isArray(entries) ? entries : [entries]).filter(Boolean);
  if (!lines.length) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: `md-battle-log-shell ${result ? "result" : ""}`
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "md-log md-log-preview",
    "aria-expanded": expanded,
    onClick: () => setExpanded(true)
  }, lines.slice(0, 3).map((line, i) => /*#__PURE__*/React.createElement("span", {
    key: `${i}-${line}`,
    className: `md-log-line ${i === 0 ? "latest" : ""}`
  }, line)), /*#__PURE__*/React.createElement("span", {
    className: "md-log-hint"
  }, "แตะเพื่อดูทั้งหมด")), expanded && /*#__PURE__*/React.createElement("div", {
    className: "md-battle-log-overlay",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Battle log"
  }, /*#__PURE__*/React.createElement("section", {
    className: "md-battle-log-expanded"
  }, /*#__PURE__*/React.createElement("header", null, /*#__PURE__*/React.createElement("strong", null, "Battle Log"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "md-battle-log-close",
    "aria-label": "ปิด Battle Log",
    onClick: () => setExpanded(false)
  }, "✕")), /*#__PURE__*/React.createElement("div", {
    className: "md-battle-log-scroll"
  }, lines.map((line, i) => /*#__PURE__*/React.createElement("div", {
    key: `${i}-${line}`,
    className: `md-log-line ${i === 0 ? "latest" : ""}`
  }, line))))));
}
function CombatScreen({
  player,
  heroName = "Hero",
  battleState,
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
  battleRound,
  battleFinishing,
  combatSpeed,
  battleVfx = [],
  combatTurnCount,
  onCycleCombatSpeed,
  onPresentationController
}) {
  const [editSlots, setEditSlots] = useState(false);
  const [assignSlotIndex, setAssignSlotIndex] = useState(null);
  const [autoRun, setAutoRun] = useState(false);
  const [showBattleIntro, setShowBattleIntro] = useState(true);
  const [phaserStatus, setPhaserStatus] = useState("disabled");
  const skills = heroActiveSkillList(player.skillLevels || {});
  const potionStacks = ownedPotionStacks(inventory || []);
  const stats = getStats(player, equipped);
  const hpPct = Math.max(0, Math.min(100, player.hp / stats.maxHp * 100));
  const battleResources = player.battleResources || {};
  const activeBattleResources = [
    ["fury", "🔥"],
    ["aegis", "🛡"],
    ["scheme", "🎭"]
  ].filter(([key]) => Number(battleResources[key]) > 0);
  const hasHeroStatus = Boolean(
    player.atkBuffTurns > 0 ||
    player.defBuffTurns > 0 ||
    player.regenTurns > 0 ||
    Object.keys(player.battleStatuses || {}).length ||
    activeBattleResources.length
  );
  const mpPct = Math.max(0, Math.min(100, player.mp / stats.maxMp * 100));
  const xpNeed = xpToNext(player.level);
  const xpPct = player.level >= MAX_LEVEL ? 100 : Math.max(0, Math.min(100, player.xp / xpNeed * 100));
  const primaryEnemy = monsters.find(m => m.uid === targetUid && m.hp > 0) || monsters.find(m => m.hp > 0) || monsters[0];
  const bossOrModifier = monsters.find(m => m.isElite || m.isEliteBoss || m.modifier);
  const modifierBanner = bossOrModifier?.modifier && String(bossOrModifier.modifier.name || "").trim()
    ? {
        icon: String(bossOrModifier.modifier.icon || "✨"),
        name: String(bossOrModifier.modifier.name).trim(),
        color: String(bossOrModifier.modifier.color || "#8ee0a8")
      }
    : null;
  const skipUnlocked = (combatTurnCount || 0) >= 5;
  const speedAssetKey = combatSpeed === 2 ? "buttons.speedX2" : "buttons.speedX1";
  const speedAssetSrc = optionalAsset(`battleUi.${speedAssetKey}`);
  const [failedSpeedAsset, setFailedSpeedAsset] = useState("");
  const showSpeedArt = Boolean(speedAssetSrc && failedSpeedAsset !== speedAssetSrc);
  const skipAssetSrc = optionalAsset("battleUi.buttons.skip");
  const [failedSkipAsset, setFailedSkipAsset] = useState("");
  const showSkipArt = Boolean(skipAssetSrc && failedSkipAsset !== skipAssetSrc);

  let headerBattleAction;
  if (skipUnlocked) {
    headerBattleAction = /*#__PURE__*/React.createElement("button", {
      className: `md-combat-header-action skip ${showSkipArt ? "has-art" : ""}`,
      disabled: busy,
      "aria-label": "Skip battle",
      title: "จำลองการต่อสู้ที่เหลือด้วยระบบเดียวกัน",
      onClick: () => onAction("skip")
    }, showSkipArt ? /*#__PURE__*/React.createElement("img", {
      className: "md-combat-skip-art",
      src: skipAssetSrc,
      alt: "",
      "aria-hidden": "true",
      draggable: false,
      onError: () => setFailedSkipAsset(skipAssetSrc)
    }) : /*#__PURE__*/React.createElement("span", {
      className: "md-combat-skip-fallback"
    }, "SKIP"));
  } else {
    headerBattleAction = /*#__PURE__*/React.createElement("button", {
      className: `md-combat-header-action speed ${showSpeedArt ? "has-art" : ""}`,
      disabled: busy,
      title: "เปลี่ยนความเร็วการต่อสู้",
      onClick: onCycleCombatSpeed,
      "aria-label": `Battle speed x${combatSpeed || 1}`
    }, showSpeedArt ? /*#__PURE__*/React.createElement("img", {
      className: "md-combat-speed-art",
      src: speedAssetSrc,
      alt: "",
      "aria-hidden": "true",
      draggable: false,
      onError: () => setFailedSpeedAsset(speedAssetSrc)
    }) : /*#__PURE__*/React.createElement("span", {
      className: "md-combat-speed-fallback"
    }, `×${combatSpeed || 1}`));
  }

  const activeTurn = (turnQueue || []).find(item => item.key === activeTurnKey);
  const activeTurnName = activeTurn
    ? activeTurn.kind === "player" ? heroName : activeTurn.name || (activeTurn.kind === "pet" ? "Pet" : "Monster")
    : "—";
  const formationMonsters = buildMonsterFormation(monsters);
  const phaserActive = phaserStatus === "ready";
  const qs = quickSlots || [null, null, null, null];
  const vfxFor = targetKey => battleVfx.filter(event => event.targetKey === targetKey);
  const skillEfficiency = heroSkillRankData(player.skillLevels || {}, "skill_efficiency");
  const skillCost = skill => Math.max(0, Math.ceil((Number(skill?.mp) || 0) * (1 - (Number(skillEfficiency?.spReductionPct) || 0) / 100)));
  function quickSlotVisual(entry) {
    if (!entry) return { icon: "➕", disabled: true, badge: null };
    if (entry.kind === "skill") {
      const sk = skills.find(s => s.key === entry.key);
      if (!sk) return { icon: "❓", disabled: true, badge: null };
      const cooldown = Number(player.cooldowns && player.cooldowns[sk.key]) || 0;
      const cost = skillCost(sk);
      const silenced = !!player.battleStatuses?.silence;
      return { icon: "✦", skillId: sk.key, disabled: busy || silenced || player.mp < cost || cooldown > 0, badge: cooldown > 0 ? `CD${cooldown}` : cost, title: `${sk.name} (${cost} SP${cooldown ? `, CD ${cooldown}` : ""}${silenced ? ", Silenced" : ""}) — ${sk.desc}` };
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
    if (showBattleIntro || !autoRun || busy || assignSlotIndex !== null) return;
    const t = setTimeout(() => onAction("attack"), Math.round(650 / (combatSpeed || 1)));
    return () => clearTimeout(t);
  }, [showBattleIntro, autoRun, busy, assignSlotIndex, onAction, combatSpeed]);
  useEffect(() => {
    // Label the existing 800ms intro presentation gate without changing who
    // Battle Core selects to act first or when its action resolves.
    const timer = setTimeout(() => setShowBattleIntro(false), 800);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    setFailedSpeedAsset("");
  }, [speedAssetSrc]);
  useEffect(() => {
    setFailedSkipAsset("");
  }, [skipAssetSrc]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "md-scene battle-bg md-battle-background-art",
    style: battleUiStyle("background")
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-battle-top md-battle-art",
    style: battleUiStyle("topBar")
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
    round: battleRound,
    monsters: monsters,
    petCombat: petCombat,
    heroName: heroName
  }), /*#__PURE__*/React.createElement("div", {
    className: "md-combat-top-actions"
  }, headerBattleAction)), modifierBanner && /*#__PURE__*/React.createElement("div", {
    className: "md-modifier-chip",
    style: {
      background: `${modifierBanner.color}22`,
      border: `1px solid ${modifierBanner.color}`,
      color: modifierBanner.color
    }
  }, modifierBanner.icon, " ", modifierBanner.name), /*#__PURE__*/React.createElement("div", {
    className: "md-current-turn",
    "aria-live": "polite"
  }, "Round ", Math.max(1, Number(battleRound) || 1), " · Turn: ", activeTurnName), /*#__PURE__*/React.createElement("div", {
    className: "md-arena"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-ground"
  }), battleVfx.filter(event => String(event.targetKey || "").startsWith("vfx-")).map(event => /*#__PURE__*/React.createElement(BattleVfx, {
    key: event.id,
    event: event,
    combatSpeed: combatSpeed
  })), showBattleIntro && /*#__PURE__*/React.createElement("div", {
    className: "md-battle-intro",
    role: "status",
    "aria-live": "polite"
  }, "BEGIN!"), battleFinishing && /*#__PURE__*/React.createElement("div", {
    className: "md-battle-finishing",
    role: "status",
    "aria-live": "polite"
  }, "Confirming result…"), /*#__PURE__*/React.createElement("div", {
    className: "md-phaser-layer"
  }, /*#__PURE__*/React.createElement(PhaserBattlefield, {
    battleState: battleState,
    heroName: heroName,
    equipped: equipped,
    petCombat: petCombat,
    monsters: monsters,
    targetUid: targetUid,
    heroAnim: heroAnim,
    petAnim: petAnim,
    enemyAnims: enemyAnims,
    combatSpeed: combatSpeed,
    onPresentationController: onPresentationController,
    onStatus: status => setPhaserStatus(status),
    onTargetSelected: onSelectTarget
  })), /*#__PURE__*/React.createElement("div", {
    className: "md-party-board",
    style: phaserActive ? { display: "none" } : undefined
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-hero-slot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "md-enemy-hpbar hero md-battle-art",
    style: battleUiStyle("hpStatusFrame")
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
    label: heroName,
    combatSpeed: combatSpeed
  }), vfxFor("hero").map(event => /*#__PURE__*/React.createElement(BattleVfx, {
    key: event.id,
    event: event,
    combatSpeed: combatSpeed
  })), hasHeroStatus && /*#__PURE__*/React.createElement("div", {
    className: "md-unit-status hero",
    "aria-label": "Hero status"
  }, player.atkBuffTurns > 0 ? `⚔️${player.atkBuffTurns} ` : "", player.defBuffTurns > 0 ? `🛡️${player.defBuffTurns} ` : "", player.regenTurns > 0 ? `💚${player.regenTurns} ` : "", player.battleStatuses?.poison ? `☠️${player.battleStatuses.poison.duration} ` : "", player.battleStatuses?.armor_break ? `🛡️↓${player.battleStatuses.armor_break.duration} ` : "", player.battleStatuses?.silence ? `🤫${player.battleStatuses.silence.duration} ` : "", player.battleStatuses?.stun ? "💫1 " : "", activeBattleResources.map(([key, icon]) => `${icon}${battleResources[key]}`).join(" ")), floats.filter(f => f.side === "hero").map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: {
      color: f.color
    }
  }, f.text))), petCombat && /*#__PURE__*/React.createElement("div", {
    className: `md-pet-slot ${getPetPresentation(petCombat).anchorType === "flying" ? "flying" : "grounded"}`
  }, /*#__PURE__*/React.createElement(PetCombatSprite, {
    pet: petCombat,
    anim: petAnim,
    combatSpeed: combatSpeed
  }), vfxFor("pet").map(event => /*#__PURE__*/React.createElement(BattleVfx, {
    key: event.id,
    event: event,
    combatSpeed: combatSpeed
  })), floats.filter(f => f.side === "pet").map(f => /*#__PURE__*/React.createElement("div", {
    key: f.id,
    className: "md-dmg-float",
    style: { color: f.color }
  }, f.text)))), /*#__PURE__*/React.createElement("div", {
    className: `md-monster-board md-monster-count-${Math.min(3, Math.max(1, monsters.length))}`,
    style: phaserActive ? { display: "none" } : undefined
  }, formationMonsters.map(({ monster: m, slotIndex }) => /*#__PURE__*/React.createElement("div", {
    key: m.uid,
    className: `md-monster-slot md-monster-slot-${slotIndex} ${(m.isElite || m.isEliteBoss) ? "elite" : ""} ${getMonsterPresentation(m).anchorType === "flying" ? "flying" : "grounded"}`
  }, /*#__PURE__*/React.createElement(EnemySprite, {
    enemy: m,
    battleUnit: battleState?.units?.[m.uid],
    anim: enemyAnims[m.uid],
    selected: monsters.filter(mm => mm.hp > 0).length > 1 && m.uid === (primaryEnemy && primaryEnemy.uid),
    onClick: onSelectTarget,
    combatSpeed: combatSpeed
  }), vfxFor(m.uid).map(event => /*#__PURE__*/React.createElement(BattleVfx, {
    key: event.id,
    event: event,
    combatSpeed: combatSpeed
  })), floats.filter(f => f.side === m.uid).map(f => /*#__PURE__*/React.createElement("div", {
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
      className: `md-quickslot-btn battle md-battle-art ${qs[i] ? "filled" : "empty"} ${editSlots ? "editing" : ""}`,
      style: battleUiStyle("quickSlotFrame"),
      disabled: !editSlots && v.disabled,
      title: v.title || "แตะเพื่อกำหนดช่องนี้",
      onClick: () => useQuickSlot(i)
    }, /*#__PURE__*/React.createElement("span", { className: "md-quickslot-icon" }, qs[i]?.kind === "potion" ? /*#__PURE__*/React.createElement(GameIcon, {
      item: { type: "potion", potionId: qs[i].potionId },
      fallback: v.icon,
      className: "md-game-icon md-quickslot-item-icon",
      alt: v.title || "Potion"
    }) : v.skillId ? /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: v.skillId, className: "md-hero-skill-icon md-quickslot-skill-icon", alt: v.title || heroSkillDisplayName(v.skillId), loading: "eager" }) : v.icon), v.badge != null && /*#__PURE__*/React.createElement("i", {
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
  }, /*#__PURE__*/React.createElement("span", { className: "md-skill-option-main" }, /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: s.key, className: "md-hero-skill-icon md-skill-option-icon", alt: s.name }), s.name), /*#__PURE__*/React.createElement("span", { className: "md-quickslot-popover-sub" }, "SP ", skillCost(s)))), potionStacks.map(p => /*#__PURE__*/React.createElement("button", {
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
    className: `md-dock-auto md-battle-art ${autoRun ? "active" : ""}`,
    style: battleUiStyle("buttons.auto"),
    "aria-label": autoRun ? "หยุด Auto" : "เปิด Auto",
    title: autoRun ? "หยุด Auto" : "เปิด Auto",
    onClick: () => setAutoRun(a => !a)
  }, autoRun ? "⏸ AUTO" : "▶ AUTO"), /*#__PURE__*/React.createElement("div", {
    className: "md-dock-half-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "md-dock-mini flee md-battle-art",
    style: battleUiStyle("buttons.flee"),
    disabled: busy,
    "aria-label": "หลบหนี",
    title: "หลบหนีจากการต่อสู้",
    onClick: () => onAction("flee")
  }, "🏃"), /*#__PURE__*/React.createElement("button", {
    className: `md-dock-mini settings md-battle-art ${editSlots ? "active" : ""}`,
    style: battleUiStyle("buttons.settings"),
    "aria-label": editSlots ? "ปิดการตั้งค่า Quick Slot" : "ตั้งค่า Quick Slot",
    title: editSlots ? "เสร็จสิ้นการตั้งค่า Quick Slot" : "ตั้งค่า Quick Slot",
    onClick: () => {
      setAssignSlotIndex(null);
      setEditSlots(v => !v);
    }
  }, editSlots ? "✓" : "⚙️"))), /*#__PURE__*/React.createElement("button", {
    className: "md-dock-attack md-battle-art",
    style: battleUiStyle("buttons.attack"),
    disabled: busy,
    "aria-label": "โจมตี",
    title: "โจมตี",
    onClick: () => {
      onAction("attack");
    }
  }, "👊"))), /*#__PURE__*/React.createElement("div", {
    className: "md-panel"
  }, /*#__PURE__*/React.createElement(BattleLogPanel, {
    entries: log
  })));
}
function ResultScreen({
  floor,
  rewards,
  dropItem,
  battleLog,
  onNext,
  onRetry,
  onMap,
  onOpenInv
}) {
  const [chestOpened, setChestOpened] = useState(false);
  const showChest = !!(rewards.firstClearAccessory && dropItem);
  const showItemBanner = !!dropItem && (!showChest || chestOpened);
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
  }, "👑🔥 Elite Boss Defeated! + bonus 💎"), rewards.petProgress?.xpGained > 0 && /*#__PURE__*/React.createElement("div", {
    className: "md-drop-banner md-pet-result-exp"
  }, /*#__PURE__*/React.createElement("strong", null, "Pet EXP +", rewards.petProgress.xpGained), rewards.petProgress.endLevel > rewards.petProgress.startLevel && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), rewards.petProgress.name, " Lv.", rewards.petProgress.startLevel, " → Lv.", rewards.petProgress.endLevel)), rewards.modifier && /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement(GameIcon, { category: "chests", iconKey: "equipment", fallback: "🎁", className: "md-game-icon md-inline-item-icon", alt: "Equipment chest" }), " เปิด Accessory รางวัล First Clear"), showItemBanner ? /*#__PURE__*/React.createElement("div", {
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
  }, "ไม่ได้วัตถุดิบจากศัตรูตัวนี้"))), /*#__PURE__*/React.createElement(BattleLogPanel, {
    entries: battleLog,
    result: true
  }), showItemBanner && /*#__PURE__*/React.createElement("button", {
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
function inventoryStatRows(item) {
  const labels = { hp: "HP", mp: "SP", hpPct: "HP%", mpPct: "MP%", atk: "ATK", def: "DEF", str: "STR", vit: "VIT", agi: "AGI", dex: "DEX", luk: "LUK", accuracy: "Accuracy", dodgeChance: "Dodge", critChance: "Crit", critDamage: "Crit DMG", dropBonus: "Drop" };
  const finalStats = itemBonus(item) || {};
  return Object.keys(labels).filter(key => Number(finalStats[key])).map(key => ({ key, label: labels[key], value: Math.round(Number(finalStats[key]) * 10) / 10 }));
}

function inventoryComparisonRows(currentItem, nextItem) {
  if (!nextItem || !SLOT_ORDER.includes(nextItem.type)) return [];
  const currentStats = itemBonus(currentItem) || {};
  const nextStats = itemBonus(nextItem) || {};
  const definitions = [
    ["hp", "HP"], ["mp", "SP"], ["hpPct", "HP%"], ["mpPct", "MP%"], ["atk", "ATK"], ["def", "DEF"],
    ["str", "STR"], ["vit", "VIT"], ["agi", "AGI"], ["dex", "DEX"], ["luk", "LUK"],
    ["accuracy", "Accuracy"], ["dodgeChance", "Dodge"], ["critChance", "Crit"],
    ["critDamage", "Crit DMG"], ["dropBonus", "Drop"]
  ];
  return definitions
    .map(([key, label]) => ({
      key,
      label,
      current: Math.round((Number(currentStats[key]) || 0) * 10) / 10,
      next: Math.round((Number(nextStats[key]) || 0) * 10) / 10
    }))
    .filter(row => Math.abs(row.current) > 0.0001 || Math.abs(row.next) > 0.0001);
}

function InventoryHeader({ characterName, onClose }) {
  return /*#__PURE__*/React.createElement("header", { className: "md-character-page-title md-inv2-header" },
    /*#__PURE__*/React.createElement("button", { className: "md-inv2-close", type:"button", onClick: onClose, "aria-label": "ย้อนกลับ" }, "‹"),
    /*#__PURE__*/React.createElement("div", { className:"md-inv2-title" },
      /*#__PURE__*/React.createElement("h2", null, "Inventory"),
      /*#__PURE__*/React.createElement("span", { className:"md-inv2-ornament md-inventory-art", style:inventoryUiStyle("sectionOrnament") }),
      /*#__PURE__*/React.createElement("p", null, characterName || "Adventurer")));
}

const INVENTORY_SLOT_POSITIONS = {
  helmet: "left l1", chest: "left l2", boots: "left l3", wings: "left l4",
  gloves: "right r1", weapon: "right r2", accessory: "right r3"
};

function EquipmentSlot({ slot, item, onOpen }) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: `md-inv2-equip-slot md-inventory-art ${INVENTORY_SLOT_POSITIONS[slot]} ${item ? `filled ${inventoryRarityKey(item)}` : "empty"}`,
    style: inventoryUiStyle("equipmentSlotFrame"),
    onClick: () => item && onOpen(slot)
  }, /*#__PURE__*/React.createElement("span", { className: "md-inv2-slot-icon" }, item
    ? /*#__PURE__*/React.createElement(GameIcon, { item, fallback: item.icon || SLOT_ICON[slot], className: "md-game-icon md-equipped-item-icon", alt: itemDisplayName(item) })
    : SLOT_ICON[slot]), /*#__PURE__*/React.createElement("span", { className: "md-inv2-slot-label" }, SLOT_LABEL[slot]), item?.enhanceLevel > 0 && /*#__PURE__*/React.createElement("span", { className: "md-inv2-badge" }, `+${item.enhanceLevel}`));
}

function EquipmentStage({ equipped, previewEquipped = equipped, characterName, onOpenDetail }) {
  const fallbackHero = /*#__PURE__*/React.createElement(HeroSprite, {
    anim:"",
    equipped:previewEquipped,
    label:characterName || "Adventurer"
  });
  return /*#__PURE__*/React.createElement("div", { className: "md-inv2-equipment" },
    /*#__PURE__*/React.createElement("div", { className: "md-inv2-hero", "aria-hidden": "true" },
      /*#__PURE__*/React.createElement(PhaserHeroPreview, {
        equipped:previewEquipped,
        heroName:characterName || "Adventurer",
        anchorX:0.558,
        fallback:fallbackHero
      })),
    /*#__PURE__*/React.createElement("div", { className: "md-inv2-slots" }, SLOT_ORDER.map(slot => /*#__PURE__*/React.createElement(EquipmentSlot, {
      key: slot, slot, item: equipped[slot], onOpen: openSlot => onOpenDetail({ location: "equipped", slot: openSlot })
    }))));
}

function InventoryToolbar({ inventoryCount, onFilter, onSort }) {
  const iconButtonStyle = key => inventoryUiStyle(`icons.${key}`);
  const iconButtonFallback = (key, fallback) => inventoryUiUrl(`icons.${key}`) ? null : fallback;
  return /*#__PURE__*/React.createElement("div", { className: "md-inventory-header md-inv2-tools" },
    /*#__PURE__*/React.createElement("div", null,
      /*#__PURE__*/React.createElement("span", { className: "md-inventory-title" }, "Items"),
      /*#__PURE__*/React.createElement("span", { className: "md-inventory-count" }, ` ${inventoryCount}/${INVENTORY_CAPACITY}`)),
    /*#__PURE__*/React.createElement("div", { className: "md-inv2-tool-buttons" },
      /*#__PURE__*/React.createElement("button", { className: `md-inv2-icon-btn md-inventory-art ${inventoryUiUrl("icons.filter") ? "has-art" : ""}`, style: iconButtonStyle("filter"), onClick: onFilter, "aria-label":"Filter", title:"Filter" }, iconButtonFallback("filter", "⌕")),
      /*#__PURE__*/React.createElement("button", { className: `md-inv2-icon-btn md-inventory-art ${inventoryUiUrl("icons.sort") ? "has-art" : ""}`, style: iconButtonStyle("sort"), onClick: onSort, "aria-label":"Sort", title:"Sort" }, iconButtonFallback("sort", "⇅"))));
}

function InventoryCell({ item, onOpenDetail }) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: `md-inventory-cell md-inv2-cell ${item ? inventoryRarityKey(item) : "empty"}`,
    onClick: () => item && onOpenDetail({ location: "inventory", id: inventoryItemRuntimeId(item) })
  }, item ? /*#__PURE__*/React.createElement(React.Fragment, null,
    /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-icon" }, /*#__PURE__*/React.createElement(GameIcon, { item, fallback: item.icon || SLOT_ICON[inventoryItemType(item)] || "📦", className: "md-game-icon md-inventory-item-icon", alt: itemDisplayName(item) })),
    /*#__PURE__*/React.createElement("span", { className: `md-inv2-rarity-dot ${inventoryRarityKey(item)}` }),
    item.enhanceLevel > 0 && /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-qty enhance" }, `+${item.enhanceLevel}`),
    inventoryItemQuantity(item) > 1 && /*#__PURE__*/React.createElement("span", { className: "md-inventory-cell-qty" }, `x${inventoryItemQuantity(item)}`)
  ) : null);
}

function InventoryGrid({ items, expanded, onOpenDetail }) {
  const visibleCount = expanded ? INVENTORY_CAPACITY : 10;
  const slotCount = expanded ? INVENTORY_CAPACITY : 10;
  const visible = items.slice(0, visibleCount);
  return /*#__PURE__*/React.createElement("div", { className: "md-inventory-grid md-inv2-grid" },
    Array.from({ length: slotCount }, (_, index) => /*#__PURE__*/React.createElement(InventoryCell, {
      key: visible[index] ? inventoryItemRuntimeId(visible[index]) : `empty-${index}`,
      item: visible[index],
      onOpenDetail
    })));
}

function InventoryFilterModal({ filters, onUpdate, onReset, onClose }) {
  const select = (key, label, values) => /*#__PURE__*/React.createElement("label", { className: "md-inv2-filter-row", key },
    /*#__PURE__*/React.createElement("span", null, label),
    /*#__PURE__*/React.createElement("select", { value: filters[key], onChange: event => onUpdate(key, event.target.value) },
      values.map(([value, text]) => /*#__PURE__*/React.createElement("option", { key: value, value }, text))));
  return /*#__PURE__*/React.createElement("div", { className: "md-inv2-modal-layer" }, /*#__PURE__*/React.createElement("div", { className: "md-inv2-popup md-inventory-art", style: inventoryUiStyle("popupFrame") },
    /*#__PURE__*/React.createElement("h3", null, "Filter"),
    select("category", "Category", [["all","All"],["equipment","Equipment"],["consumable","Consumable"],["material","Material"]]),
    select("type", "Equipment Type", [["all","All"], ...SLOT_ORDER.map(slot => [slot, SLOT_LABEL[slot]])]),
    select("rarity", "Rarity", [["all","All"],["common","Common/Junk"],["rare","Rare"],["unique","Unique"],["elite","Elite"],["mythic","Mythic"]]),
    select("enhanced", "Enhance", [["all","All"],["yes","Enhanced"],["no","Not Enhanced"]]),
    select("enchanted", "Enchant", [["all","All"],["yes","Enchanted"],["no","No Enchant"]]),
    /*#__PURE__*/React.createElement("div", { className: "md-inv2-popup-actions" },
      /*#__PURE__*/React.createElement("button", { onClick: onReset }, "Reset"),
      /*#__PURE__*/React.createElement("button", { onClick: onClose }, "Apply"))));
}

function OverflowModal({ overflow, busy, onClaimOverflow, onClaimAllOverflow, onClose }) {
  return /*#__PURE__*/React.createElement("div", { className: "md-inv2-modal-layer" }, /*#__PURE__*/React.createElement("div", { className: "md-inv2-popup md-inv2-overflow-popup md-inventory-art", style: inventoryUiStyle("popupFrame") },
    /*#__PURE__*/React.createElement("h3", null, `ไอเทมที่ล้น (${overflow.length})`),
    /*#__PURE__*/React.createElement("p", null, "ไอเทมเหล่านี้ถูกเก็บไว้อย่างปลอดภัย เคลียร์ช่องในกระเป๋าแล้วจึงนำกลับเข้ากระเป๋า"),
    /*#__PURE__*/React.createElement("div", { className: "md-inv2-overflow-list" }, overflow.map(item => /*#__PURE__*/React.createElement("div", { className: "md-inv2-overflow-row", key: inventoryItemRuntimeId(item) },
      /*#__PURE__*/React.createElement(GameIcon, { item, fallback:item.icon || SLOT_ICON[inventoryItemType(item)] || "📦" }),
      /*#__PURE__*/React.createElement("span", null, itemDisplayName(item), inventoryItemQuantity(item) > 1 ? ` x${inventoryItemQuantity(item)}` : ""),
      /*#__PURE__*/React.createElement("button", { disabled:busy, onClick:() => onClaimOverflow(inventoryItemRuntimeId(item)) }, "นำเข้ากระเป๋า")))),
    /*#__PURE__*/React.createElement("div", { className: "md-inv2-popup-actions" },
      /*#__PURE__*/React.createElement("button", { disabled:busy, onClick:onClaimAllOverflow }, "นำทั้งหมดที่ใส่ได้"),
      /*#__PURE__*/React.createElement("button", { onClick:onClose }, "ปิด"))));
}

function ItemStats({ item }) {
  return /*#__PURE__*/React.createElement("div", { className:"md-inv2-stat-list" }, inventoryStatRows(item).map(row => /*#__PURE__*/React.createElement("div", { key:row.key },
    /*#__PURE__*/React.createElement("span", null, row.label),
    /*#__PURE__*/React.createElement("b", { className:row.value >= 0 ? "positive" : "negative" }, `${row.value >= 0 ? "+" : ""}${row.value}`))));
}

function ItemComparison({ currentEquipped, currentDetail, compareRows }) {
  if (!compareRows.length) return null;
  return /*#__PURE__*/React.createElement("section", { className:"md-inv2-compare" },
    /*#__PURE__*/React.createElement("div", { className:"md-inv2-compare-head" },
      /*#__PURE__*/React.createElement("span", { className:"md-inv2-compare-item" },
        currentEquipped && /*#__PURE__*/React.createElement(GameIcon, { item:currentEquipped, fallback:currentEquipped.icon || SLOT_ICON[inventoryItemType(currentEquipped)] || "📦", className:"md-game-icon md-inv2-compare-icon", alt:itemDisplayName(currentEquipped) }),
        /*#__PURE__*/React.createElement("span", { className:"md-inv2-compare-copy" },
          /*#__PURE__*/React.createElement("strong", null, currentEquipped ? itemDisplayName(currentEquipped) : "Empty Slot"),
          /*#__PURE__*/React.createElement("small", null, currentEquipped ? `Lv.${currentEquipped.level || 1} • ${isItemEnchanted(currentEquipped) ? "Enchanted" : "No Enchant"}` : "Current"))),
      /*#__PURE__*/React.createElement("b", { className:"md-inv2-compare-arrow" }, ">"),
      /*#__PURE__*/React.createElement("span", { className:"md-inv2-compare-item" },
        /*#__PURE__*/React.createElement(GameIcon, { item:currentDetail, fallback:currentDetail.icon || SLOT_ICON[inventoryItemType(currentDetail)] || "📦", className:"md-game-icon md-inv2-compare-icon", alt:itemDisplayName(currentDetail) }),
        /*#__PURE__*/React.createElement("span", { className:"md-inv2-compare-copy" },
          /*#__PURE__*/React.createElement("strong", null, itemDisplayName(currentDetail)),
          /*#__PURE__*/React.createElement("small", null, `Lv.${currentDetail.level || 1} • ${isItemEnchanted(currentDetail) ? "Enchanted" : "No Enchant"}`)))),
    /*#__PURE__*/React.createElement("div", { className:"md-inv2-compare-columns", "aria-hidden":"true" },
      /*#__PURE__*/React.createElement("span", null, "STAT"),
      /*#__PURE__*/React.createElement("span", null, "CURRENT ITEM"),
      /*#__PURE__*/React.createElement("span", null, "NEW ITEM")),
    compareRows.map(row => {
      const currentClass = row.current > row.next ? "positive" : row.current < row.next ? "negative" : "";
      const nextClass = row.next > row.current ? "positive" : row.next < row.current ? "negative" : "";
      return /*#__PURE__*/React.createElement("div", { className:"md-inv2-compare-row", key:row.key },
        /*#__PURE__*/React.createElement("span", null, row.label),
        /*#__PURE__*/React.createElement("b", { className:currentClass }, row.current),
        /*#__PURE__*/React.createElement("b", { className:nextClass }, row.next));
    }));
}

function ItemActions({ detail, currentDetail, busy, onEquip, onUnequip, onSell, onSalvage, onClose }) {
  return /*#__PURE__*/React.createElement("div", { className:"md-inv2-detail-actions" },
    detail.location === "inventory" && SLOT_ORDER.includes(inventoryItemType(currentDetail)) && /*#__PURE__*/React.createElement("button", { disabled:busy, onClick:() => { onEquip(currentDetail); onClose(); } }, "Equip"),
    detail.location === "equipped" && /*#__PURE__*/React.createElement("button", { disabled:busy, onClick:() => { onUnequip(detail.slot); onClose(); } }, "Unequip"),
    detail.location === "inventory" && /*#__PURE__*/React.createElement("button", { disabled:busy || inventoryItemLocked(currentDetail), onClick:onSell }, "Sell"),
    detail.location === "inventory" && !["junk","potion"].includes(inventoryItemType(currentDetail)) && inventorySalvagePreview(currentDetail) && /*#__PURE__*/React.createElement("button", { disabled:busy || inventoryItemLocked(currentDetail), onClick:onSalvage }, "Salvage"));
}

function inventorySalvagePreview(item) {
  if (!item) return null;
  if (globalThis.MYTHIC_V2?.validSetItem(item)) {
    return { kind: "mythic_set", materials: globalThis.MYTHIC_V2.setSalvage(item) || [] };
  }
  if (globalThis.MYTHIC_V2?.bossWeapon(item)) return { kind: "mythic_boss_weapon", materials: [] };
  const yieldPlan = salvageYield(item.rarity, item);
  if (!yieldPlan) return null;
  return { kind: "normal", materials: Object.entries(yieldPlan).filter(([, quantity]) => Number(quantity) > 0).map(([junkId, quantity]) => ({ junkId, quantity })) };
}

function ItemDetailModal({ detail, currentDetail, currentEquipped, compareRows, salvagePreview, message, busy, onToggleFavorite, onEquip, onUnequip, onSell, onSalvage, onClose }) {
  const rarityLabel = item => ({ common: "Common", junk: "Junk", rare: "Rare", unique: "Unique", elite: "Elite", mythic: "Mythic" })[inventoryRarityKey(item)] || "Common";
  const iconButtonStyle = key => inventoryUiStyle(`icons.${key}`);
  const iconButtonFallback = (key, fallback) => inventoryUiUrl(`icons.${key}`) ? null : fallback;
  const itemType = inventoryItemType(currentDetail);
  return /*#__PURE__*/React.createElement("div", { className: "md-inv2-modal-layer md-inv2-detail-layer" }, /*#__PURE__*/React.createElement("div", {
    className: `md-inv2-popup md-inv2-detail ${inventoryRarityKey(currentDetail)} md-inventory-art`,
    style: inventoryRarityKey(currentDetail) === "mythic" ? inventoryUiStyle("mythicFrame") || inventoryUiStyle("popupFrame") : inventoryUiStyle("popupFrame")
  },
    /*#__PURE__*/React.createElement("button", { className:"md-inv2-popup-close", onClick:onClose }, "✕"),
    /*#__PURE__*/React.createElement("button", {
      className:`md-inv2-favorite-toggle md-inventory-art ${inventoryUiUrl("icons.favorite") ? "has-art" : ""} ${inventoryItemLocked(currentDetail) ? "active" : ""}`,
      style:iconButtonStyle("favorite"),
      onClick:() => onToggleFavorite(inventoryItemRuntimeId(currentDetail)),
      "aria-label":inventoryItemLocked(currentDetail) ? "Unlock item" : "Favorite and lock item",
      "aria-pressed":inventoryItemLocked(currentDetail),
      title:"Favorite / Lock"
    }, iconButtonFallback("favorite", inventoryItemLocked(currentDetail) ? "★" : "☆")),
    /*#__PURE__*/React.createElement("div", { className:"md-inv2-detail-head" },
      /*#__PURE__*/React.createElement(GameIcon, { item:currentDetail, fallback:currentDetail.icon || SLOT_ICON[itemType] || "📦", className:"md-game-icon md-inv2-detail-icon" }),
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("h3", null, itemDisplayName(currentDetail)),
        /*#__PURE__*/React.createElement("p", null, `${rarityLabel(currentDetail)} • ${SLOT_LABEL[itemType] || itemType} • Lv.${currentDetail.level || 1}`))),
    /*#__PURE__*/React.createElement(ItemStats, { item:currentDetail }),
    Array.isArray(currentDetail.empowerSlots) && currentDetail.empowerSlots.some(Boolean) && /*#__PURE__*/React.createElement("div", { className:"md-inv2-enchants" },
      /*#__PURE__*/React.createElement("h4", null, "ENCHANT OPTIONS"),
      currentDetail.empowerSlots.filter(Boolean).map((option,index) => /*#__PURE__*/React.createElement("div", { key:index }, `${option.icon || "✦"} ${option.label || option.stat || "Option"} +${option.value || 0}`))),
    /*#__PURE__*/React.createElement(ItemComparison, { currentEquipped, currentDetail, compareRows }),
    salvagePreview && /*#__PURE__*/React.createElement("div", { className:"md-inv2-salvage-preview" },
      /*#__PURE__*/React.createElement("strong", null, "Salvage Yield"),
      salvagePreview.materials.length
        ? salvagePreview.materials.map(material => /*#__PURE__*/React.createElement("span", { key:material.junkId }, /*#__PURE__*/React.createElement(GameIcon, { item:{ type:"junk", junkId:material.junkId }, fallback:JUNK_INFO[material.junkId]?.icon || "📦", className:"md-game-icon md-inline-item-icon", alt:JUNK_INFO[material.junkId]?.name || material.junkId }), JUNK_INFO[material.junkId]?.name || material.junkId, " ×", material.quantity))
        : /*#__PURE__*/React.createElement("span", null, "ไม่มีวัสดุคืน")),
    message && /*#__PURE__*/React.createElement("p", { className:"md-inv2-message" }, message),
    /*#__PURE__*/React.createElement(ItemActions, { detail, currentDetail, busy, onEquip, onUnequip, onSell, onSalvage, onClose })));
}

function InventoryOverlayV2({
  equipped,
  inventory,
  overflow,
  busy,
  characterName,
  save,
  onEquip,
  onUnequip,
  onSell,
  onSalvage,
  onToggleFavorite,
  onSort,
  onClaimOverflow,
  onClaimAllOverflow,
  onCharacter,
  onPets,
  onSettings,
  onSave,
  onFriend,
  onChat,
  onGuild,
  onMainHub,
  onClose
}) {
  const [detail, setDetail] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [filters, setFilters] = useState({ category: "all", type: "all", rarity: "all", enhanced: "all", enchanted: "all" });
  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const resetFilters = () => setFilters({ category:"all", type:"all", rarity:"all", enhanced:"all", enchanted:"all" });
  const filtered = inventory.filter(item => {
    const category = inventoryItemCategory(item);
    if (filters.category !== "all" && category !== filters.category) return false;
    if (filters.type !== "all" && inventoryItemType(item) !== filters.type) return false;
    if (filters.rarity !== "all" && inventoryRarityKey(item) !== filters.rarity) return false;
    if (filters.enhanced === "yes" && !(Number(item.enhanceLevel) > 0)) return false;
    if (filters.enhanced === "no" && Number(item.enhanceLevel) > 0) return false;
    if (filters.enchanted === "yes" && !isItemEnchanted(item)) return false;
    if (filters.enchanted === "no" && isItemEnchanted(item)) return false;
    return true;
  });
  const currentDetail = detail?.location === "equipped" ? equipped[detail.slot] : inventory.find(item => inventoryItemRuntimeId(item) === detail?.id);
  const previewSlot = detail?.location === "inventory" && currentDetail && SLOT_ORDER.includes(inventoryItemType(currentDetail))
    ? inventoryItemType(currentDetail)
    : null;
  const previewEquipped = previewSlot ? { ...equipped, [previewSlot]: currentDetail } : equipped;
  const currentEquipped = currentDetail && SLOT_ORDER.includes(inventoryItemType(currentDetail)) ? equipped[inventoryItemType(currentDetail)] : null;
  const compareRows = detail?.location === "inventory" ? inventoryComparisonRows(currentEquipped, currentDetail) : [];
  const salvagePreview = currentDetail && detail?.location === "inventory" && !["junk","potion"].includes(inventoryItemType(currentDetail)) ? inventorySalvagePreview(currentDetail) : null;
  const closeDetail = () => { setDetail(null); setMessage(""); };
  const destructiveConfirm = (item, action) => {
    if (!item) return false;
    if (["elite", "mythic"].includes(inventoryRarityKey(item)) || Number(item.enhanceLevel) > 0) return window.confirm(`${action} ${itemDisplayName(item)} หรือไม่?`);
    return true;
  };
  const runSell = () => {
    if (!currentDetail || inventoryItemLocked(currentDetail) || !destructiveConfirm(currentDetail, "ขาย")) return;
    const result = onSell(currentDetail);
    if (result?.ok === false) setMessage(result.message || "ไม่สามารถขายได้"); else closeDetail();
  };
  const runSalvage = async () => {
    if (!currentDetail || inventoryItemLocked(currentDetail) || !salvagePreview || busy) return;
    const yieldText = salvagePreview.materials.map(material => `${JUNK_INFO[material.junkId]?.name || material.junkId} ×${material.quantity}`).join(" + ") || "ไม่มีวัสดุคืน";
    if (!window.confirm(`แยกชิ้นส่วน ${itemDisplayName(currentDetail)} หรือไม่?\nได้รับ ${yieldText}`)) return;
    const result = await onSalvage(inventoryItemRuntimeId(currentDetail));
    if (result?.ok === false) setMessage(result.message || "ไม่สามารถแยกชิ้นส่วนได้"); else closeDetail();
  };
  const iconButtonStyle = key => inventoryUiStyle(`icons.${key}`);

  return /*#__PURE__*/React.createElement("div", { className: "md-equip-overlay md-inv2-overlay" },
    /*#__PURE__*/React.createElement(StatusBar, { player:null, save, phase:"inventory", equipped }),
    /*#__PURE__*/React.createElement("section", { className: "md-equip-sheet md-inv2-sheet" },
      /*#__PURE__*/React.createElement(InventoryHeader, { characterName, onClose }),
      /*#__PURE__*/React.createElement(EquipmentStage, { equipped, previewEquipped, characterName, onOpenDetail:setDetail }),
      overflow.length > 0 && /*#__PURE__*/React.createElement("button", { className: "md-inv2-overflow-banner", onClick: () => setOverflowOpen(true), "aria-label": `ไอเทมที่ล้น ${overflow.length}` },
        /*#__PURE__*/React.createElement("span", { className: `md-inv2-overflow-icon md-inventory-art ${inventoryUiUrl("icons.overflow") ? "has-art" : ""}`, style: iconButtonStyle("overflow"), "aria-hidden":"true" }, inventoryUiUrl("icons.overflow") ? null : "📦"),
        /*#__PURE__*/React.createElement("span", { className:"md-inv2-overflow-label" }, `ไอเทมที่ล้น ${overflow.length}`)),
      /*#__PURE__*/React.createElement(InventoryToolbar, { inventoryCount:inventory.length, onFilter:() => setFilterOpen(true), onSort }),
      /*#__PURE__*/React.createElement(InventoryGrid, { items:filtered, expanded, onOpenDetail:setDetail }),
      (filtered.length > 10 || expanded) && /*#__PURE__*/React.createElement("button", { className: "md-inventory-toggle md-inventory-art", style: iconButtonStyle("expand"), onClick: () => setExpanded(value => !value) }, expanded ? "▲ Collapse" : `▼ View All (${filtered.length})`),
      filterOpen && /*#__PURE__*/React.createElement(InventoryFilterModal, { filters, onUpdate:updateFilter, onReset:resetFilters, onClose:() => setFilterOpen(false) }),
      overflowOpen && /*#__PURE__*/React.createElement(OverflowModal, { overflow, busy, onClaimOverflow, onClaimAllOverflow, onClose:() => setOverflowOpen(false) }),
      currentDetail && /*#__PURE__*/React.createElement(ItemDetailModal, {
        detail, currentDetail, currentEquipped, compareRows, salvagePreview, message, busy,
        onToggleFavorite, onEquip, onUnequip, onSell:runSell, onSalvage:runSalvage, onClose:closeDetail
      })
    ),
    /*#__PURE__*/React.createElement(GameDock, { onCharacter, onOpenInv:() => {}, onPets, activeKey:"inventory", onSettings, onSave, onFriend, onChat, onGuild, onMainHub }));
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
  const selectedSalvagePreview = selectedItem && selectedItem.type !== "junk" ? inventorySalvagePreview(selectedItem) : null;
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
  const doSalvage = async () => {
    if (!selectedItem || busy || !selectedSalvagePreview) return;
    const res = await onSalvage(selectedItem.id);
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
    ...(unlockedSkillList || []).map(s => ({ kind: "skill", key: s.key, potionId: null, name: s.name, sub: `MP ${s.mp}` })),
    ...ownedPotionStacks(inventory).map(p => ({ kind: "potion", key: null, potionId: p.id, icon: p.icon, name: p.name, sub: `x${p.quantity}` }))
  ];
  const quickSlotVisual = entry => {
    if (!entry) return { icon: "➕", name: "ว่าง" };
    if (entry.kind === "skill") {
      const sk = (unlockedSkillList || []).find(s => s.key === entry.key);
      return sk ? { icon: "✦", skillId: sk.key, name: sk.name } : { icon: "?", name: "ล็อกอยู่" };
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
          }, /*#__PURE__*/React.createElement("span", { className: "md-quickslot-icon" }, entry?.kind === "potion" ? /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: entry.potionId }, fallback: v.icon, className: "md-game-icon md-quickslot-item-icon", alt: v.name }) : v.skillId ? /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: v.skillId, className: "md-hero-skill-icon md-quickslot-skill-icon", alt: v.name }) : v.icon),
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
          }, /*#__PURE__*/React.createElement("span", { className: "md-skill-option-main" }, opt.kind === "potion" ? /*#__PURE__*/React.createElement(GameIcon, { item: { type: "potion", potionId: opt.potionId }, fallback: opt.icon, className: "md-game-icon md-inline-item-icon", alt: opt.name }) : /*#__PURE__*/React.createElement(HeroSkillIcon, { skillId: opt.key, className: "md-hero-skill-icon md-skill-option-icon", alt: opt.name }), opt.name), /*#__PURE__*/React.createElement("span", { className: "md-quickslot-popover-sub" }, opt.sub)))
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
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: "protectionStone" }, fallback: "🛡️", className: "md-game-icon md-inline-item-icon", alt: "Protection Stone" }), " ", /*#__PURE__*/React.createElement("b", null, protectionStones || 0)),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: "manaOre" }, fallback: JUNK_INFO.manaOre.icon, className: "md-game-icon md-inline-item-icon", alt: JUNK_INFO.manaOre.name }), " ", /*#__PURE__*/React.createElement("b", null, junkTotal(inventory, "manaOre"))),
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "diamond", fallback: "💎", className: "md-game-icon md-inline-item-icon", alt: "Diamond" }), " ", /*#__PURE__*/React.createElement("b", null, diamonds || 0))
    ),
    /*#__PURE__*/React.createElement("div", { className: "md-item-detail" }, detailTarget ? /*#__PURE__*/React.createElement(React.Fragment, null,
      /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name" }, /*#__PURE__*/React.createElement(GameIcon, { item: detailTarget, fallback: detailTarget.icon || SLOT_ICON[detailTarget.type] || "📦", className: "md-game-icon md-detail-item-icon", alt: itemDisplayName(detailTarget) }), " ", itemDisplayName(detailTarget)),
      detailTarget.type === "junk" ? /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, `วัตถุดิบขยะ · มี ${detailTarget.quantity} ชิ้น (สูงสุด 99/ช่อง) · ขายได้ ${sellPrice(detailTarget)} `, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" })) : /*#__PURE__*/React.createElement(React.Fragment, null,
        /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, RARITY_LABEL[detailTarget.rarity] || detailTarget.rarity, selectedEquipped ? " · สวมใส่อยู่" : "", " · ", itemStatText(detailTarget) || "ไม่มีค่าสเตตัส"),
        detailTarget.setId && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub" }, `Mythic Set: ${detailTarget.setId}`),
        MYTHIC_V2.signatureText(detailTarget) && /*#__PURE__*/React.createElement("div", { className: "md-item-detail-sub", style: { color: "var(--gold)", fontWeight: 800 } }, `✦ ${MYTHIC_V2.signatureText(detailTarget)}`),
        renderEmpowerSlotsReadOnly(detailTarget)
      ),
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
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee", disabled: !selectedItem || busy, onClick: doSell }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), selectedItem ? ` ขาย ${sellPrice(selectedItem)}` : " ขาย"),
      /*#__PURE__*/React.createElement("button", { className: "md-btn info", disabled: !selectedEquippedSlot || busy, onClick: doUnequip }, "↩️ ถอด"),
      /*#__PURE__*/React.createElement("button", {
        className: "md-btn flee",
        disabled: !selectedItem || selectedItem.type === "junk" || busy || !selectedSalvagePreview,
        onClick: doSalvage
      }, selectedItem && selectedItem.type !== "junk" && selectedSalvagePreview ? /*#__PURE__*/React.createElement(React.Fragment, null,
        "♻️ ", selectedSalvagePreview.materials.length ? selectedSalvagePreview.materials.map(material => `${JUNK_INFO[material.junkId]?.icon || "📦"}${material.quantity}`).join(" ") : "ไม่มีวัสดุคืน") : "♻️ ย่อย")
    ),
    /*#__PURE__*/React.createElement("button", { className: "md-btn flee wide small md-equip-close", onClick: onClose }, "← ปิด Inventory")
  ));
}
function BlacksmithOverlay({
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
    playAnim(res.ok);
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
      forgePresentation && /*#__PURE__*/React.createElement(PhaserForgePresentation, { event: forgePresentation }),
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
        }, (detailTarget.enhanceLevel || 0) >= ENHANCE_MAX ? "🔨 ตีบวกสูงสุดแล้ว" : (() => {
          const isV2 = ENHANCEMENT_V2.isV2Item(detailTarget);
          const c = isV2 ? ENHANCEMENT_V2.enhanceCost(detailTarget) : enhanceCost(detailTarget.enhanceLevel || 0);
          const haveIron = junkTotal(inventory, "iron");
          return [`🔨 ตีบวก +${(detailTarget.enhanceLevel || 0) + 1} (${isV2 ? ENHANCEMENT_V2.enhanceSuccessRate(detailTarget.enhanceLevel || 0) : enhanceSuccessRate(detailTarget.enhanceLevel || 0)}% · `,
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

// ---------- Phase 4: Crafting ----------
// Talks to the server directly (like RaidScreen/MailboxScreen) rather than mutating local
// state itself — the worker is the one that validates+consumes materials/gold, so this
// component only ever applies what the server confirms actually happened.
function CraftingOverlay({
  serverUrl,
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
  const [craftPresentation, setCraftPresentation] = useState(null);
  const craftPresentationTokenRef = useRef(0);
  const recipes = MYTHIC_V2.allRecipes(floor);

  const doCraft = recipe => {
    if (craftingId || busy) return;
    setCraftingId(recipe.recipeId);
    setMsg("");
    cloudCraftItem(serverUrl || DEFAULT_SERVER_URL, characterId, recipe.recipeId, crypto.randomUUID())
      .then(res => {
        if (!res || res.error) {
          const errMsg = res && res.error === "insufficient_gold" ? /*#__PURE__*/React.createElement(React.Fragment, null, "ทองไม่พอ (ต้องการ ", /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), res.need, ")")
            : res && res.error === "insufficient_materials" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: res.junkId }, fallback: (JUNK_INFO[res.junkId] || {}).icon || "📦", className: "md-game-icon md-inline-item-icon", alt: (JUNK_INFO[res.junkId] || {}).name || res.junkId }), " ", (JUNK_INFO[res.junkId] || {}).name || res.junkId, ` ไม่พอ (มี ${res.have}/${res.need})`)
            : "ประดิษฐ์ไม่สำเร็จ";
          setMsg(errMsg);
          return;
        }
        onCrafted(res);
        setCraftPresentation({
          token: `craft-${++craftPresentationTokenRef.current}`,
          kind: "craft",
          itemName: String(res.item?.name || recipe.name || "Crafted item"),
          special: String(res.item?.rarity || "").toLowerCase() === "mythic" || !!res.item?.bossWeaponId || !!res.item?.setId
        });
        setMsg(`✨ ประดิษฐ์สำเร็จ! ได้รับ ${res.item && res.item.name}`);
      })
      .catch(() => setMsg("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ"))
      .finally(() => setCraftingId(null));
  };

  return /*#__PURE__*/React.createElement("div", { className: "md-equip-overlay" }, /*#__PURE__*/React.createElement("div", { className: "md-equip-sheet" },
    /*#__PURE__*/React.createElement("div", { className: "md-equip-head" },
      /*#__PURE__*/React.createElement("div", null,
        /*#__PURE__*/React.createElement("p", { className: "md-equip-head-title" }, "🛠️ ประดิษฐ์ไอเทม"),
        /*#__PURE__*/React.createElement("div", { className: "md-equip-head-sub" }, "ประดิษฐ์ Mythic Set และ Boss Weapon ตาม Tier ของชั้นสูงสุด ", floor || 1)
      ),
      /*#__PURE__*/React.createElement("button", { className: "md-btn flee small", onClick: onClose, style: { minHeight: 38, padding: "6px 11px", boxShadow: "none" } }, "✕")
    ),
    craftPresentation && /*#__PURE__*/React.createElement(PhaserForgePresentation, { event: craftPresentation }),
    /*#__PURE__*/React.createElement("div", { className: "md-equip-summary", style: { marginTop: 2, marginBottom: 8 } },
      /*#__PURE__*/React.createElement("span", { className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { category: "currency", iconKey: "gold", fallback: "🪙", className: "md-game-icon md-inline-item-icon", alt: "Gold" }), " ", formatNumber(gold)),
      // Union of every non-gold/non-scroll material across ALL loaded recipes — was
      // hardcoded to bossHorn/bossHide (Azure-only) before; now reads whatever the current
      // recipe list actually needs, so a future set with different materials shows up here
      // automatically with no code change.
      ...Array.from(new Set(recipes.flatMap(r => Object.keys(r.materials)))).filter(k => k !== "gold" && k.indexOf("recipe_") !== 0).map(key =>
        /*#__PURE__*/React.createElement("span", { key: key, className: "md-equip-stat-chip" }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: "junk", junkId: key }, fallback: (JUNK_INFO[key] || {}).icon || "📦", className: "md-game-icon md-inline-item-icon", alt: (JUNK_INFO[key] || {}).name || key }), " ", junkTotal(inventory, key))
      )
    ),
    recipes.map(recipe => {
      const afford = canAffordRecipe(recipe, inventory, gold);
      const preview = craftPreviewStats(recipe, floor);
      const statText = [preview.atk ? `⚔️${preview.atk}` : "", preview.def ? `🛡️${preview.def}` : "", preview.dodgeChance ? `💨${preview.dodgeChance}%` : ""].filter(Boolean).join(" ");
      return /*#__PURE__*/React.createElement("div", { key: recipe.recipeId, className: "md-card", style: { marginBottom: 8, padding: 10 } },
        /*#__PURE__*/React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          /*#__PURE__*/React.createElement("div", null,
            /*#__PURE__*/React.createElement("div", { className: "md-item-detail-name", style: { fontSize: 13 } }, /*#__PURE__*/React.createElement(GameIcon, { item: { type: recipe.type, setId: recipe.setId, bossWeaponId: recipe.bossWeaponId }, fallback: craftIcon(recipe), className: "md-game-icon md-detail-item-icon", alt: recipe.name }), " ", recipe.name),
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
