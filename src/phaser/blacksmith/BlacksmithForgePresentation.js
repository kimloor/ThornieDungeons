// ---------- Blacksmith React Forge Presentation Integration ----------
function PhaserBlacksmithForgePresentation({ event, onStatus } = {}) {
  const hostRef = React.useRef(null);
  const handleRef = React.useRef(null);
  React.useEffect(() => {
    if (!hostRef.current) return undefined;
    let disposed = false;
    const handle = createBlacksmithForgeHost({
      mountNode: hostRef.current, event,
      onReady: () => { if (!disposed) onStatus?.("ready"); },
      onError: error => { if (!disposed) onStatus?.("error", error); },
      onDestroyed: () => { if (!disposed) onStatus?.("destroyed"); }
    });
    handleRef.current = handle;
    onStatus?.("loading");
    void handle.mount();
    return () => { disposed = true; handle.destroy(); handleRef.current = null; };
  }, []);
  React.useEffect(() => { if (event) void handleRef.current?.present(event); }, [event?.token]);
  return React.createElement("div", { ref: hostRef, className: "md-forge-phaser-presentation", style: { position: "relative", width: "100%", height: 96, overflow: "hidden", pointerEvents: "none" }, "aria-hidden": "true" });
}
