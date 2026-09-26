// ---------- W5 React Battlefield Integration ----------
function isPhaserBattleRendererEnabled() {
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_PHASER_BATTLE__ === true) return true;
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_PHASER_BATTLE__ === false) return false;
  try { return new URLSearchParams(globalThis.location?.search || "").get("phaserBattle") === "1"; } catch (_) { return false; }
}

function PhaserBattlefield(props) {
  const hostRef = React.useRef(null);
  const handleRef = React.useRef(null);
  const [status, setStatus] = React.useState("loading");
  const enabled = isPhaserBattleRendererEnabled();
  const snapshot = React.useMemo(() => buildBattlefieldSnapshot(props), [props.battleState, props.heroName, props.equipped, props.petCombat, props.monsters, props.targetUid, props.heroAnim, props.petAnim, props.enemyAnims, props.combatSpeed]);

  React.useEffect(() => {
    if (!enabled || !hostRef.current) return undefined;
    let disposed = false;
    const handle = createBattlefieldHost({
      mountNode: hostRef.current,
      snapshot,
      onReady: () => { if (!disposed) { setStatus("ready"); props.onStatus?.("ready"); } },
      onError: error => { if (!disposed) { setStatus("error"); props.onStatus?.("error", error); } },
      onDestroyed: () => { if (!disposed) props.onStatus?.("destroyed"); },
      onTargetSelected: id => props.onTargetSelected?.(id)
    });
    handleRef.current = handle;
    setStatus("loading");
    props.onStatus?.("loading");
    void handle.mount();
    return () => {
      disposed = true;
      handle.destroy();
      handleRef.current = null;
    };
  }, [enabled]);

  React.useEffect(() => { handleRef.current?.sync(snapshot); }, [snapshot]);
  if (!enabled) return null;
  return React.createElement("div", {
    ref: hostRef,
    className: `md-phaser-battlefield status-${status}`,
    "data-phaser-status": status,
    "aria-hidden": "true"
  });
}
