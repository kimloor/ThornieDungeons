// ---------- W8 React Hero Preview Integration ----------
function isPhaserHeroPreviewEnabled() {
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_PHASER_HERO_PREVIEW__ === true) return true;
  if (typeof globalThis !== "undefined" && globalThis.__THORNIE_PHASER_HERO_PREVIEW__ === false) return false;
  try {
    return new URLSearchParams(globalThis.location?.search || "").get("phaserPreview") === "1";
  } catch (_) {
    return false;
  }
}

function PhaserHeroPreview({ equipped = {}, heroName = "Hero", fallback = null, className = "", anchorX = 0.5 }) {
  const hostRef = React.useRef(null);
  const handleRef = React.useRef(null);
  const [status, setStatus] = React.useState("loading");
  const enabled = isPhaserHeroPreviewEnabled();
  const snapshot = React.useMemo(
    () => buildHeroPreviewSnapshot({ heroName, equipped, heroV5: true }),
    [heroName, equipped]
  );

  React.useEffect(() => {
    if (!enabled || !hostRef.current) return undefined;
    let disposed = false;
    const handle = createHeroPreviewHost({
      mountNode: hostRef.current,
      snapshot,
      anchorX,
      onReady: () => { if (!disposed) setStatus("ready"); },
      onError: () => { if (!disposed) setStatus("error"); },
      onDestroyed: () => {}
    });
    handleRef.current = handle;
    setStatus("loading");
    void handle.mount();
    return () => {
      disposed = true;
      handle.destroy();
      handleRef.current = null;
    };
  }, [enabled, anchorX]);

  React.useEffect(() => {
    if (enabled) handleRef.current?.sync(snapshot);
  }, [enabled, snapshot]);

  if (!enabled) return fallback;

  return React.createElement("div", {
    className: `md-phaser-hero-preview status-${status} ${className}`.trim(),
    "data-phaser-preview-status": status,
    "aria-hidden": "true"
  },
    React.createElement("div", { ref: hostRef, className: "md-phaser-hero-preview-canvas" }),
    status !== "ready" && React.createElement("div", { className: "md-phaser-hero-preview-fallback" }, fallback)
  );
}
