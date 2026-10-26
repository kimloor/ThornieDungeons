// Global Loading System V1 — the single shared blocking overlay (see docs/GLOBAL-LOADING-SYSTEM-V1.md).
// Presentation only. Pure CSS fallback emblem; G14 artwork may replace the emblem later without
// changing the manager contract. No baked text, no mode-specific words.
const GLOBAL_LOADING_STYLE = `
.gl-overlay {
  position: fixed; inset: 0; z-index: 2100;
  display: flex; align-items: center; justify-content: center;
  padding: var(--safe-top-eff) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  background: radial-gradient(circle at 50% 42%, rgba(44,30,74,.82), rgba(10,6,24,.92));
  color: #F3EEFF; touch-action: none; user-select: none; -webkit-user-select: none;
  animation: gl-fade-in .18s ease-out both;
}
.gl-panel { display: flex; flex-direction: column; align-items: center; gap: 14px; width: min(78vw, 320px); text-align: center; }
.gl-emblem { position: relative; width: 96px; height: 96px; }
.gl-ring, .gl-ring-inner { position: absolute; border-radius: 50%; }
.gl-ring { inset: 0; border: 3px solid rgba(255,209,102,.22); border-top-color: #FFD166; animation: gl-spin 1.1s linear infinite; }
.gl-ring-inner { inset: 14px; border: 2px solid rgba(185,174,221,.2); border-bottom-color: #B9AEDD; animation: gl-spin 1.7s linear infinite reverse; }
.gl-rune { position: absolute; inset: 29px; background: #FFD166; transform: rotate(45deg); border-radius: 3px; opacity: .85; animation: gl-pulse 1.6s ease-in-out infinite; }
.gl-art { position: absolute; inset: 2px; width: calc(100% - 4px); height: calc(100% - 4px); object-fit: contain; opacity: 0; pointer-events: none; }
.gl-emblem.art-ready .gl-art-closed { opacity: 1; animation: gl-art-breathe 1.8s ease-in-out infinite; }
.gl-emblem.art-ready .gl-rune { display: none; }
.gl-overlay.gl-exiting .gl-ring, .gl-overlay.gl-exiting .gl-ring-inner { opacity: 0; transition: opacity .12s ease-out; }
.gl-overlay.gl-exiting .gl-art { animation-duration: .36s; animation-timing-function: ease-in-out; animation-fill-mode: both; }
.gl-overlay.gl-exiting .gl-art-closed { animation-name: gl-gate-closed; }
.gl-overlay.gl-exiting .gl-art-opening { animation-name: gl-gate-opening; }
.gl-overlay.gl-exiting .gl-art-open { animation-name: gl-gate-open; }
.gl-label { margin: 0; font: 800 15px/1.35 'Baloo 2', sans-serif; color: #FFD166; letter-spacing: .02em; }
.gl-toast { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 84px); transform: translateX(-50%); z-index: 2101; max-width: min(88vw, 380px); padding: 10px 14px; border-radius: 12px; background: rgba(30,20,56,.96); border: 1px solid rgba(255,209,102,.45); color: #F3EEFF; font: 700 12px/1.4 'Baloo 2', sans-serif; text-align: center; box-shadow: 0 8px 24px rgba(0,0,0,.45); animation: gl-fade-in .18s ease-out both; }
.gl-toast-text { margin: 0; }
.gl-toast-status { margin: 6px 0 0; font-size: 11px; color: #B9AEDD; }
.gl-toast-status.ok { color: #7FE3A0; }
.gl-toast-status.down { color: #FF8F8F; }
.gl-toast-actions { display: flex; gap: 8px; justify-content: center; margin-top: 10px; flex-wrap: wrap; }
.gl-toast-btn { min-height: 36px; padding: 6px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,.22); background: rgba(255,255,255,.08); color: #F3EEFF; font: 800 12px/1 'Baloo 2', sans-serif; cursor: pointer; }
.gl-toast-btn.primary { background: linear-gradient(90deg, #FFD166, #FFA94D); color: #2A1B4D; border-color: transparent; }
.gl-progress { width: 100%; height: 8px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
.gl-progress-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, #FFD166, #FFA94D); transition: width .2s ease-out; }
.gl-progress-text { margin: -6px 0 0; font: 700 11px/1 'Baloo 2', sans-serif; color: #B9AEDD; font-variant-numeric: tabular-nums; }
@keyframes gl-spin { to { transform: rotate(360deg); } }
@keyframes gl-pulse { 0%, 100% { transform: rotate(45deg) scale(.8); opacity: .55; } 50% { transform: rotate(45deg) scale(1); opacity: 1; } }
@keyframes gl-art-breathe { 0%, 100% { filter: drop-shadow(0 0 3px rgba(185,174,221,.28)); } 50% { filter: drop-shadow(0 0 8px rgba(255,209,102,.42)); } }
@keyframes gl-gate-closed { 0%, 18% { opacity: 1; transform: scale(1); } 45%, 100% { opacity: 0; transform: scale(1.025); } }
@keyframes gl-gate-opening { 0%, 12% { opacity: 0; transform: scale(.985); } 34%, 60% { opacity: 1; transform: scale(1.015); } 82%, 100% { opacity: 0; transform: scale(1.035); } }
@keyframes gl-gate-open { 0%, 52% { opacity: 0; transform: scale(1); } 78%, 100% { opacity: 1; transform: scale(1.045); filter: drop-shadow(0 0 10px rgba(185,174,221,.5)); } }
@keyframes gl-fade-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .gl-overlay { animation: none; }
  .gl-ring, .gl-ring-inner, .gl-rune, .gl-art { animation: none !important; }
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

// Holds a blocking token while `active` is true; released on inactive/unmount.
// Screens use it for their initial data load only (never for in-screen actions or polling).
// `onRetry` (optional) must be idempotent (a reload): it powers the Retry button shown if the
// failsafe fires. A retry re-acquires the token so the overlay reflects the new attempt.
function useGlobalLoadingToken(active, key, label, onRetry) {
  const retryRef = useRef(onRetry);
  retryRef.current = onRetry;
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const token = GLOBAL_LOADING.begin({
      key,
      label,
      onRetry: () => {
        setAttempt(n => n + 1);
        if (typeof retryRef.current === "function") retryRef.current();
      }
    });
    return () => token.release();
  }, [active, key, label, attempt]);
}

function GlobalLoadingOverlay({ manager }) {
  const source = manager || GLOBAL_LOADING;
  const snap = useGlobalLoadingSnapshot(source);
  const [loadedFrames, setLoadedFrames] = useState(0);
  const [artFailed, setArtFailed] = useState(false);
  const [holdExit, setHoldExit] = useState(false);
  const wasVisibleRef = React.useRef(false);
  const lastVisibleRef = React.useRef(snap);
  const closedSrc = loadingUiUrl("gateEmblem");
  const openingSrc = loadingUiUrl("gateEmblemOpening");
  const openSrc = loadingUiUrl("gateEmblemOpen");
  const hasArtSources = Boolean(closedSrc && openingSrc && openSrc);
  const artReady = hasArtSources && !artFailed && loadedFrames === 7;
  useEffect(() => {
    if (snap.visible) {
      wasVisibleRef.current = true;
      lastVisibleRef.current = snap;
      setHoldExit(false);
      return undefined;
    }
    if (!wasVisibleRef.current) return undefined;
    wasVisibleRef.current = false;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !artReady) return undefined;
    setHoldExit(true);
    const timer = setTimeout(() => setHoldExit(false), 360);
    return () => clearTimeout(timer);
  }, [snap.visible, artReady]);
  const shown = snap.visible ? snap : lastVisibleRef.current;
  const n = snap.staleNotice;
  const connectionText = !n ? "" : n.connection === "checking" ? "กำลังตรวจสอบการเชื่อมต่อ Server…"
    : n.connection === "ok" ? "Server ตอบสนองปกติ (" + n.ms + " ms)" + (n.canRetry ? "" : " — งานนี้อาจยังประมวลผลอยู่ ไม่ควรกดซ้ำ")
    : n.connection === "down" ? "ติดต่อ Server ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง" : "";
  const notice = n ? /*#__PURE__*/React.createElement("div", {
    className: "gl-toast",
    role: "status",
    "aria-live": "polite",
    "data-global-loading-notice": "true"
  }, /*#__PURE__*/React.createElement("style", null, GLOBAL_LOADING_STYLE), /*#__PURE__*/React.createElement("p", {
    className: "gl-toast-text"
  }, "ใช้เวลานานกว่าปกติ"), connectionText ? /*#__PURE__*/React.createElement("p", {
    className: "gl-toast-status " + (n.connection === "ok" || n.connection === "down" ? n.connection : "")
  }, connectionText) : null, /*#__PURE__*/React.createElement("div", {
    className: "gl-toast-actions"
  }, n.canRetry ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "gl-toast-btn primary",
    onClick: () => source.retryStale()
  }, "ลองอีกครั้ง") : /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "gl-toast-btn primary",
    onClick: () => source.recheckConnection()
  }, "ตรวจสอบการเชื่อมต่อ"), !n.canRetry ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "gl-toast-btn",
    onClick: () => { if (typeof window !== "undefined") window.location.reload(); }
  }, "รีเฟรชแอป") : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "gl-toast-btn",
    onClick: () => source.dismissStale()
  }, "ปิด"))) : null;
  if (!snap.visible && !holdExit) return notice;
  const determinate = snap.visible && shown.mode === "determinate";
  return /*#__PURE__*/React.createElement(React.Fragment, null, notice, /*#__PURE__*/React.createElement("div", {
    className: "gl-overlay" + (holdExit ? " gl-exiting" : ""),
    role: "status",
    "aria-live": "polite",
    "aria-busy": "true",
    "aria-label": shown.label,
    "data-global-loading": "true"
  }, /*#__PURE__*/React.createElement("style", null, GLOBAL_LOADING_STYLE), /*#__PURE__*/React.createElement("div", {
    className: "gl-panel"
  }, /*#__PURE__*/React.createElement("div", {
    className: "gl-emblem" + (artReady ? " art-ready" : ""),
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span", { className: "gl-ring" }), /*#__PURE__*/React.createElement("span", { className: "gl-ring-inner" }), /*#__PURE__*/React.createElement("span", { className: "gl-rune" }), hasArtSources ? [
    [closedSrc, "gl-art gl-art-closed", 1],
    [openingSrc, "gl-art gl-art-opening", 2],
    [openSrc, "gl-art gl-art-open", 4]
  ].map(([src, className, bit]) => /*#__PURE__*/React.createElement("img", {
    key: className, className, src, alt: "", width: 256, height: 256,
    decoding: "async", draggable: false,
    onLoad: () => setLoadedFrames(mask => mask | bit),
    onError: () => setArtFailed(true)
  })) : null), /*#__PURE__*/React.createElement("p", {
    className: "gl-label"
  }, shown.label), determinate ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "gl-progress",
    role: "progressbar",
    "aria-valuemin": 0,
    "aria-valuemax": shown.total,
    "aria-valuenow": shown.current,
    "aria-label": shown.label
  }, /*#__PURE__*/React.createElement("div", {
    className: "gl-progress-fill",
    style: { width: shown.percent + "%" }
  })), /*#__PURE__*/React.createElement("p", {
    className: "gl-progress-text"
  }, shown.current + " / " + shown.total)) : null)));
}
