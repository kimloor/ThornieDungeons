// ---------- W5 React Battlefield Integration ----------
function isPhaserBattleRendererEnabled() {
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_PHASER_BATTLE__ === true) return true;
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_PHASER_BATTLE__ === false) return false;
  try {
    const value = new URLSearchParams(globalThis.location?.search || "").get("phaserBattle");
    return value !== "0";
  } catch (_) { return true; }
}

function PhaserBattlefield(props) {
  const hostRef = React.useRef(null);
  const handleRef = React.useRef(null);
  const [status, setStatus] = React.useState("loading");
  // Arena V2 is authoritative and always uses the shared battlefield. Dungeon
  // keeps its existing opt-in flag so this change cannot alter Dungeon UX.
  const enabled = props.mode === "arena" ? true : isPhaserBattleRendererEnabled();
  const snapshot = React.useMemo(() => props.mode === "arena"
    ? buildArenaBattlefieldSnapshot(props)
    : buildBattlefieldSnapshot(props), [props.mode, props.battleState, props.preparedSnapshot, props.teams, props.heroName, props.equipped, props.petCombat, props.monsters, props.targetUid, props.heroAnim, props.petAnim, props.enemyAnims, props.combatSpeed]);

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
    props.onPresentationController?.(handle);
    setStatus("loading");
    props.onStatus?.("loading");
    void handle.mount();
    return () => {
      disposed = true;
      props.onPresentationController?.(null);
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


function PhaserRaidBoss({ boss, config, hurtToken = 0, onHurtComplete, onStatus } = {}) {
  const hostRef = React.useRef(null);
  const handleRef = React.useRef(null);
  const snapshot = React.useMemo(
    () => buildRaidBossPresentationSnapshot({ boss, config, hurtToken }),
    [boss?.id, boss?.defId, boss?.name, boss?.hpCurrent, boss?.hpMax, config, hurtToken]
  );

  React.useEffect(() => {
    if (!hostRef.current) return undefined;
    let disposed = false;
    const handle = createRaidBossHost({
      mountNode: hostRef.current,
      snapshot,
      onReady: () => { if (!disposed) onStatus?.("ready"); },
      onError: error => { if (!disposed) onStatus?.("error", error); },
      onDestroyed: () => { if (!disposed) onStatus?.("destroyed"); },
      onHurtComplete
    });
    handleRef.current = handle;
    onStatus?.("loading");
    void handle.mount();
    return () => {
      disposed = true;
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  React.useEffect(() => { handleRef.current?.sync(snapshot); }, [snapshot]);
  return React.createElement("div", {
    ref: hostRef,
    className: "md-raid-boss-sprite md-phaser-raid-boss",
    "aria-hidden": "true"
  });
}


function PhaserEnhanceResult({ presentation, onStatus, onComplete } = {}) {
  const hostRef = React.useRef(null);
  const handleRef = React.useRef(null);
  const snapshot = React.useMemo(() => ({
    token: Math.max(0, Number(presentation?.token) || 0),
    result: presentation?.result || null
  }), [presentation?.token, presentation?.result]);

  React.useEffect(() => {
    if (!hostRef.current) return undefined;
    let disposed = false;
    const handle = createEnhancePresentationHost({
      mountNode: hostRef.current,
      snapshot,
      onReady: () => { if (!disposed) onStatus?.("ready"); },
      onError: error => { if (!disposed) onStatus?.("error", error); },
      onDestroyed: () => { if (!disposed) onStatus?.("destroyed"); },
      onComplete
    });
    handleRef.current = handle;
    onStatus?.("loading");
    void handle.mount();
    return () => {
      disposed = true;
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  React.useEffect(() => { handleRef.current?.sync(snapshot); }, [snapshot]);
  return React.createElement("div", {
    ref: hostRef,
    className: "md-phaser-enhance-result",
    "aria-hidden": "true"
  });
}
