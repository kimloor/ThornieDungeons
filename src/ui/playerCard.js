// Public Player Card surface. This module owns profile presentation and avatar composition
// hooks; Friend, Chat, and Guild screens only pass a public-profile target into this interface.
const PLAYER_CARD_RELATIONSHIP_LABELS = Object.freeze({
  self: "นี่คือตัวละครของคุณ",
  friend: "เพื่อน",
  blocked_by_me: "บล็อกผู้เล่นนี้อยู่",
  blocking_me: "ผู้เล่นนี้บล็อกคุณ",
  outgoing_pending: "ส่งคำขอเป็นเพื่อนแล้ว",
  incoming_pending: "มีคำขอเป็นเพื่อน",
  none: "ยังไม่ได้เป็นเพื่อน"
});

function playerCardAsset(key) {
  return typeof optionalAsset === "function" ? optionalAsset(`playerCardUi.${key}`) : "";
}

function normalizePlayerCardAvatar(avatar) {
  const source = avatar && typeof avatar === "object" ? avatar : {};
  const layers = Array.isArray(source.layers) ? source.layers : [];
  return {
    mode: "head",
    layers: layers
      .filter(layer => layer && typeof layer === "object" && typeof layer.assetKey === "string")
      .map(layer => ({
        assetKey: layer.assetKey,
        x: Number(layer.x) || 0,
        y: Number(layer.y) || 0,
        scale: Number(layer.scale) || 1,
        zIndex: Number(layer.zIndex) || 0
      }))
      .sort((a, b) => a.zIndex - b.zIndex)
  };
}

function playerCardAvatarLayers(avatar) {
  return normalizePlayerCardAvatar(avatar).layers
    .map(layer => ({
      ...layer,
      src: playerCardAsset(layer.assetKey) || (typeof optionalAsset === "function" ? optionalAsset(layer.assetKey) : "")
    }))
    .filter(layer => layer.src);
}

function PlayerCardTrigger({ characterId, name, level, onOpenPlayerCard }) {
  const e = React.createElement;
  if (!characterId || !onOpenPlayerCard) return e(React.Fragment, null, name, ` (Lv.${level})`);
  return e("button", {
    type: "button",
    className: "md-player-card-trigger",
    onClick: event => {
      event.stopPropagation();
      onOpenPlayerCard(characterId);
    },
    "aria-label": `เปิด Player Card ของ ${name}`
  },
    e("span", null, name),
    level != null && e("small", null, `(Lv.${level})`)
  );
}

function PlayerCardOverlay({ serverUrl, viewerCharacterId, targetCharacterId, onClose, onGuildLink }) {
  const e = React.createElement;
  const [state, setState] = React.useState({ loading: true, error: "", profile: null });
  const [friendBusy, setFriendBusy] = React.useState(false);
  const url = serverUrl || DEFAULT_SERVER_URL;

  React.useEffect(() => {
    let cancelled = false;
    setState({ loading: true, error: "", profile: null });
    cloudGetPublicProfile(url, viewerCharacterId, targetCharacterId).then(res => {
      if (cancelled) return;
      if (!res || res.error) {
        setState({ loading: false, error: "ไม่สามารถโหลดข้อมูลผู้เล่นได้", profile: null });
        return;
      }
      setState({ loading: false, error: "", profile: res.profile || null });
    }).catch(() => {
      if (!cancelled) setState({ loading: false, error: "เชื่อมต่อ Server ไม่สำเร็จ", profile: null });
    });
    return () => { cancelled = true; };
  }, [url, viewerCharacterId, targetCharacterId]);

  const profile = state.profile;
  const guild = profile?.guild;
  const relationship = PLAYER_CARD_RELATIONSHIP_LABELS[profile?.relationship] || PLAYER_CARD_RELATIONSHIP_LABELS.none;
  const avatarLayers = playerCardAvatarLayers(profile?.avatar);
  const friendActionLabel = !profile ? "เพิ่มเพื่อน"
    : profile.relationship === "none" ? "เพิ่มเพื่อน"
    : profile.relationship === "outgoing_pending" ? "ส่งคำขอแล้ว"
    : profile.relationship === "incoming_pending" ? "มีคำขอเป็นเพื่อน"
    : profile.relationship === "friend" ? "เป็นเพื่อนแล้ว"
    : profile.relationship === "blocked_by_me" ? "บล็อกอยู่"
    : profile.relationship === "blocking_me" ? "ไม่สามารถเพิ่มเพื่อนได้"
    : profile.relationship === "self" ? "ตัวละครของคุณ"
    : "เพิ่มเพื่อน";
  const canAddFriend = profile?.relationship === "none" && !friendBusy;
  const handleFriendAction = () => {
    if (!canAddFriend) return;
    setFriendBusy(true);
    cloudSendFriendRequest(url, viewerCharacterId, targetCharacterId).then(res => {
      setFriendBusy(false);
      if (!res?.ok) return;
      setState(current => current.profile
        ? { ...current, profile: { ...current.profile, relationship: "outgoing_pending" } }
        : current);
    }).catch(() => setFriendBusy(false));
  };
  const close = e("button", {
    type: "button",
    className: "md-player-card-close",
    onClick: onClose,
    "aria-label": "ปิด Player Card"
  }, playerCardAsset("buttonClose") ? e("img", { src: playerCardAsset("buttonClose"), alt: "ปิด" }) : "✕");

  const overlay = e("div", { className: "md-player-card-overlay", role: "presentation", onClick: event => { if (event.target === event.currentTarget) onClose(); } },
    e("section", {
      className: "md-player-card",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "md-player-card-name",
      style: {
        "--player-card-bg": playerCardAsset("cardBg") ? `url("${playerCardAsset("cardBg")}")` : "none",
        "--player-card-detail-panel": playerCardAsset("detailPanel") ? `url("${playerCardAsset("detailPanel")}")` : "none",
        "--player-card-name-plate": playerCardAsset("namePlate") ? `url("${playerCardAsset("namePlate")}")` : "none",
        "--player-card-button-primary": playerCardAsset("buttonPrimary") ? `url("${playerCardAsset("buttonPrimary")}")` : "none",
        "--player-card-button-secondary": playerCardAsset("buttonSecondary") ? `url("${playerCardAsset("buttonSecondary")}")` : "none"
      }
    },
      close,
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
            playerCardAsset("avatarFrame") && e("img", { src: playerCardAsset("avatarFrame"), alt: "", "aria-hidden": "true", className: "md-player-card-avatar-frame" })
          ),
          e("div", { className: "md-player-card-nameplate" },
            e("h2", { id: "md-player-card-name" }, profile?.name || (state.loading ? "กำลังโหลด..." : "Player Card"))
          )
        ),
        e("div", { className: "md-player-card-details" },
          state.loading && e("p", { className: "md-sub" }, "กำลังโหลดข้อมูลสาธารณะ..."),
          state.error && e("p", { className: "md-auth-error", role: "alert" }, state.error),
          profile && e(React.Fragment, null,
            e("div", null, e("span", null, "Level"), e("strong", null, profile.level ?? "-")),
            e("div", null, e("span", null, "CP"), e("strong", null, Number(profile.cp || 0).toLocaleString("en-US"))),
            e("div", null, e("span", null, "Guild"), guild?.name ? e("strong", null, guild.name) : e("strong", null, "ไม่มีสังกัด")),
            e("div", null, e("span", null, "Guild Lv"), e("strong", null, guild?.level ?? "-")),
            e("div", null, e("span", null, "สถานะ"), e("strong", null, relationship))
          )
        )
      ),
      e("div", { className: "md-player-card-actions" },
        e("button", {
          type: "button",
          className: "md-player-card-guild-button",
          onClick: () => onGuildLink?.(guild),
          disabled: !guild || typeof onGuildLink !== "function"
        }, guild ? "Guild Profile" : "ไม่มีกิลด์"),
        e("button", {
          type: "button",
          className: "md-player-card-friend-button",
          onClick: handleFriendAction,
          disabled: !canAddFriend
        }, e("span", null, friendBusy ? "กำลังส่ง..." : friendActionLabel))
      )
    )
  );
  return ReactDOM.createPortal(overlay, document.body);
}
