// Public Guild Profile surface. This module owns read-only guild presentation and
// delegates join/apply mutations to the existing Guild V1 request handler.
const GUILD_PROFILE_STATE_LABELS = Object.freeze({
  member: "เป็นสมาชิกกิลด์นี้แล้ว",
  pending: "ส่งใบสมัครแล้ว — รอการอนุมัติ",
  closed: "กิลด์ปิดรับสมาชิก",
  eligible_join: "พร้อมเข้าร่วมกิลด์",
  eligible_apply: "พร้อมส่งใบสมัคร",
  application_limit_reached: "สมัครกิลด์ครบ 5 แห่งแล้ว",
});

function GuildProfileOverlay({ serverUrl, characterId, guildId, onClose }) {
  const e = React.createElement;
  const url = serverUrl || DEFAULT_SERVER_URL;
  const [state, setState] = React.useState({ loading: true, error: "", profile: null });
  const [busy, setBusy] = React.useState(false);

  const loadProfile = React.useCallback(() => {
    setState(current => ({ ...current, loading: true, error: "" }));
    cloudGetPublicGuildProfile(url, characterId, guildId).then(res => {
      if (!res || res.error) {
        setState({ loading: false, error: "ไม่สามารถโหลดข้อมูลกิลด์ได้", profile: null });
        return;
      }
      setState({ loading: false, error: "", profile: res.profile || null });
    }).catch(() => setState({ loading: false, error: "เชื่อมต่อ Server ไม่สำเร็จ", profile: null }));
  }, [url, characterId, guildId]);

  React.useEffect(() => { loadProfile(); }, [loadProfile]);

  const profile = state.profile;
  const status = profile?.viewerState;
  const canJoin = profile?.canJoin === true;
  const canApply = profile?.canApply === true;
  const canRequest = canJoin || canApply;
  const actionLabel = canJoin ? "เข้าร่วมกิลด์" : canApply ? "ส่งใบสมัคร" : status ? (GUILD_PROFILE_STATE_LABELS[status] || "ดูข้อมูลกิลด์") : "ดูข้อมูลกิลด์";
  const capacityText = profile ? `${profile.memberCount}/${profile.memberCap}` : "-";
  const expText = profile?.atCap ? `${profile.exp} (สูงสุด)` : `${profile?.expProgress ?? 0}/${profile?.expRequired ?? 0}`;

  const requestJoin = () => {
    if (!canRequest || busy) return;
    setBusy(true);
    cloudRequestGuildJoin(url, characterId, guildId).then(res => {
      if (!res || res.error) {
        setBusy(false);
        loadProfile();
        return;
      }
      loadProfile();
    }).catch(() => {
      setBusy(false);
      setState(current => ({ ...current, error: "เชื่อมต่อ Server ไม่สำเร็จ" }));
    });
  };

  return ReactDOM.createPortal(e("div", {
    className: "md-guild-profile-overlay",
    role: "presentation",
    onClick: event => { if (event.target === event.currentTarget) onClose(); }
  }, e("section", {
    className: "md-card md-guild-profile",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "md-guild-profile-name"
  },
    e("button", { type: "button", className: "md-guild-profile-close", onClick: onClose, "aria-label": "ปิด Guild Profile" }, "✕"),
    e("h2", { id: "md-guild-profile-name", className: "md-title" }, profile?.name || (state.loading ? "กำลังโหลด..." : "Guild Profile")),
    state.loading && e("p", { className: "md-sub" }, "กำลังโหลดข้อมูลกิลด์สาธารณะ..."),
    state.error && e("p", { className: "md-auth-error", role: "alert" }, state.error),
    profile && e(React.Fragment, null,
      e("div", { className: "md-guild-profile-grid" },
        e("div", null, e("span", null, "Guild Level"), e("strong", null, profile.level ?? "-")),
        e("div", null, e("span", null, "Guild EXP"), e("strong", null, expText)),
        e("div", null, e("span", null, "สมาชิก"), e("strong", null, capacityText)),
        e("div", null, e("span", null, "รับสมาชิก"), e("strong", null, profile.joinPolicyLabel || profile.joinPolicy || "-")),
        e("div", null, e("span", null, "หัวหน้ากิลด์"), e("strong", null, profile.leaderName || "-"))
      ),
      profile.capacityState === "full" && e("p", { className: "md-guild-profile-notice" }, canApply ? "กิลด์เต็มในขณะนี้ แต่ยังส่งใบสมัครได้ตามกฎเดิม" : "กิลด์เต็มแล้ว"),
      e("p", { className: "md-guild-profile-state" }, GUILD_PROFILE_STATE_LABELS[status] || "ดูข้อมูลกิลด์"),
      e("button", { type: "button", className: "md-btn primary wide", disabled: !canRequest || busy, onClick: requestJoin }, busy ? "กำลังดำเนินการ..." : actionLabel)
    )
  )), document.body);
}
