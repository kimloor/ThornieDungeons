// Global Loading System V1 — the single shared blocking overlay (see docs/GLOBAL-LOADING-SYSTEM-V1.md).
// Presentation only. Pure CSS fallback emblem; G14 artwork may replace the emblem later without
// changing the manager contract. No baked text, no mode-specific words.
const GLOBAL_LOADING_STYLE = `
.gl-overlay {
  position: fixed; inset: 0; z-index: 2100;
  display: flex; align-items: center; justify-content: center;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  background: radial-gradient(circle at 50% 42%, rgba(44,30,74,.82), rgba(10,6,24,.92));
  color: #F3EEFF; touch-action: none; user-select: none; -webkit-user-select: none;
  animation: gl-fade-in .18s ease-out both;
}
.gl-panel { display: flex; flex-direction: column; align-items: center; gap: 14px; width: min(78vw, 320px); text-align: center; }
.gl-emblem { position: relative; width: 76px; height: 76px; }
.gl-ring, .gl-ring-inner { position: absolute; border-radius: 50%; }
.gl-ring { inset: 0; border: 3px solid rgba(255,209,102,.22); border-top-color: #FFD166; animation: gl-spin 1.1s linear infinite; }
.gl-ring-inner { inset: 14px; border: 2px solid rgba(185,174,221,.2); border-bottom-color: #B9AEDD; animation: gl-spin 1.7s linear infinite reverse; }
.gl-rune { position: absolute; inset: 29px; background: #FFD166; transform: rotate(45deg); border-radius: 3px; opacity: .85; animation: gl-pulse 1.6s ease-in-out infinite; }
.gl-label { margin: 0; font: 800 15px/1.35 'Baloo 2', sans-serif; color: #FFD166; letter-spacing: .02em; }
.gl-progress { width: 100%; height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
.gl-progress-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #FFD166, #FFA94D); transition: width .2s ease-out; }
.gl-progress-text { margin: -6px 0 0; font: 700 11px/1 'Baloo 2', sans-serif; color: #B9AEDD; font-variant-numeric: tabular-nums; }
@keyframes gl-spin { to { transform: rotate(360deg); } }
@keyframes gl-pulse { 0%, 100% { transform: rotate(45deg) scale(.8); opacity: .55; } 50% { transform: rotate(45deg) scale(1); opacity: 1; } }
@keyframes gl-fade-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .gl-overlay { animation: none; }
  .gl-ring, .gl-ring-inner, .gl-rune { animation: none; }
}
`;

function useGlobalLoadingSnapshot(manager) {
  const [snapshot, setSnapshot] = useState(() => manager.getSnapshot());
  useEffect(() => {
    setSnapshot(manager.getSnapshot());
    return manager.subscribe(setSnapshot);
  }, [manager]);
  return snapshot;
}

function GlobalLoadingOverlay({ manager }) {
  const source = manager || GLOBAL_LOADING;
  const snap = useGlobalLoadingSnapshot(source);
  if (!snap.visible) return null;
  const determinate = snap.mode === "determinate";
  return /*#__PURE__*/React.createElement("div", {
    className: "gl-overlay",
    role: "status",
    "aria-live": "polite",
    "aria-busy": "true",
    "aria-label": snap.label,
    "data-global-loading": "true"
  }, /*#__PURE__*/React.createElement("style", null, GLOBAL_LOADING_STYLE), /*#__PURE__*/React.createElement("div", {
    className: "gl-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gl-emblem",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span", { className: "gl-ring" }), /*#__PURE__*/React.createElement("span", { className: "gl-ring-inner" }), /*#__PURE__*/React.createElement("span", { className: "gl-rune" })), /*#__PURE__*/React.createElement("p", {
    className: "gl-label"
  }, snap.label), determinate ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "gl-progress",
    role: "progressbar",
    "aria-valuemin": 0,
    "aria-valuemax": snap.total,
    "aria-valuenow": snap.current,
    "aria-label": snap.label
  }, /*#__PURE__*/React.createElement("div", {
    className: "gl-progress-fill",
    style: { width: snap.percent + "%" }
  })), /*#__PURE__*/React.createElement("p", {
    className: "gl-progress-text"
  }, snap.current + " / " + snap.total)) : null));
}
