// Global Loading System V1 — the single shared blocking overlay (see docs/GLOBAL-LOADING-SYSTEM-V1.md).
// Presentation only. Pure CSS fallback emblem; G14 artwork may replace the emblem later without
// changing the manager contract. No baked text, no mode-specific words.
const GLOBAL_LOADING_STYLE = `
.gl-overlay {
  position: fixed; inset: 0; z-index: 2100;
  display: block; overflow: hidden;
  padding: var(--safe-top-eff) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
  background: #08050f;
  color: #F3EEFF; touch-action: none; user-select: none; -webkit-user-select: none;
  animation: gl-fade-in .18s ease-out both;
}
.gl-gate-stage { position: absolute; inset: 0; overflow: hidden; background: radial-gradient(circle at 50% 42%, #2c1e4a, #08050f 72%); }
.gl-art { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 50%; opacity: 0; pointer-events: none; }
.gl-gate-stage.closed-ready .gl-art-closed { opacity: 1; }
.gl-overlay.gl-gate-opening .gl-art { animation-duration: .9s; animation-timing-function: ease-in-out; animation-fill-mode: both; }
.gl-overlay.gl-gate-opening .gl-art-closed { animation-name: gl-gate-closed; }
.gl-overlay.gl-gate-opening .gl-art-opening { animation-name: gl-gate-opening; }
.gl-overlay.gl-gate-opening .gl-art-open { animation-name: gl-gate-open; }
.gl-overlay.gl-gate-open .gl-art, .gl-overlay.gl-gate-fading .gl-art { animation: none; opacity: 0; }
.gl-overlay.gl-gate-open .gl-art-open, .gl-overlay.gl-gate-fading .gl-art-open { opacity: 1; transform: scale(1.02); }
.gl-overlay.gl-gate-fading { animation: gl-fade-out .18s ease-in both; }
.gl-overlay.gl-reduced .gl-art { animation: none !important; opacity: 0; }
.gl-overlay.gl-reduced .gl-art-open { opacity: 1; }
.gl-panel { position: absolute; z-index: 2; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(24px, 7vh, 72px)); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 12px; width: min(78vw, 360px); padding: 12px 16px; text-align: center; border-radius: 14px; background: linear-gradient(180deg, rgba(8,5,15,.1), rgba(8,5,15,.72)); text-shadow: 0 2px 5px rgba(0,0,0,.95); }
.gl-fallback { position: relative; width: 72px; height: 72px; margin-bottom: 2px; }
.gl-ring, .gl-ring-inner { position: absolute; border-radius: 50%; }
.gl-ring { inset: 0; border: 3px solid rgba(255,209,102,.22); border-top-color: #FFD166; animation: gl-spin 1.1s linear infinite; }
.gl-ring-inner { inset: 14px; border: 2px solid rgba(185,174,221,.2); border-bottom-color: #B9AEDD; animation: gl-spin 1.7s linear infinite reverse; }
.gl-rune { position: absolute; inset: 23px; background: #FFD166; transform: rotate(45deg); border-radius: 3px; opacity: .85; animation: gl-pulse 1.6s ease-in-out infinite; }
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
@keyframes gl-gate-closed { 0%, 24% { opacity: 1; transform: scale(1); } 43%, 100% { opacity: 0; transform: scale(1.01); } }
@keyframes gl-gate-opening { 0%, 18% { opacity: 0; transform: scale(.995); } 36%, 61% { opacity: 1; transform: scale(1.005); } 78%, 100% { opacity: 0; transform: scale(1.015); } }
@keyframes gl-gate-open { 0%, 56% { opacity: 0; transform: scale(1); } 76%, 100% { opacity: 1; transform: scale(1.02); } }
@keyframes gl-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes gl-fade-out { from { opacity: 1; } to { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .gl-overlay { animation: none; }
  .gl-ring, .gl-ring-inner, .gl-rune, .gl-art { animation: none !important; }
}
@media (max-width: 480px) {
  .gl-panel { width: min(86vw, 340px); bottom: calc(env(safe-area-inset-bottom, 0px) + 22px); padding: 10px 14px; }
}
`;

const GLOBAL_LOADING_GATE_TIMING = Object.freeze({
  openingMs: 900,
  fullOpenHoldMs: 1000,
  fadeOutMs: 180,
  reducedExitMs: 120
});

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
  const [exitMode, setExitMode] = useState("");
  const wasVisibleRef = React.useRef(false);
  const lastVisibleRef = React.useRef(snap);
  const closedSrc = loadingUiUrl("fullscreenGateClosed");
  const openingSrc = loadingUiUrl("fullscreenGateOpening");
  const openSrc = loadingUiUrl("fullscreenGateOpen");
  const hasArtSources = Boolean(closedSrc && openingSrc && openSrc);
  const artReady = hasArtSources && !artFailed && loadedFrames === 7;
  useEffect(() => {
    if (snap.visible) {
      wasVisibleRef.current = true;
      lastVisibleRef.current = snap;
      setExitMode("");
      return undefined;
    }
    if (!wasVisibleRef.current) return undefined;
    wasVisibleRef.current = false;
    const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!artReady) return undefined;
    const timers = [];
    const schedule = (callback, delay) => {
      const timer = setTimeout(callback, delay);
      timers.push(timer);
    };
    if (reduced) {
      setExitMode("reduced-open");
      schedule(() => {
        setExitMode("reduced-exit");
        schedule(() => setExitMode(""), GLOBAL_LOADING_GATE_TIMING.reducedExitMs);
      }, GLOBAL_LOADING_GATE_TIMING.fullOpenHoldMs);
    } else {
      setExitMode("opening");
      schedule(() => {
        setExitMode("open");
        schedule(() => {
          setExitMode("fading");
          schedule(() => setExitMode(""), GLOBAL_LOADING_GATE_TIMING.fadeOutMs);
        }, GLOBAL_LOADING_GATE_TIMING.fullOpenHoldMs);
      }, GLOBAL_LOADING_GATE_TIMING.openingMs);
    }
    return () => timers.forEach(clearTimeout);
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
  if (!snap.visible && !exitMode) return notice;
  const determinate = snap.visible && shown.mode === "determinate";
  return /*#__PURE__*/React.createElement(React.Fragment, null, notice, /*#__PURE__*/React.createElement("div", {
    className: "gl-overlay" + (exitMode ? " gl-exiting gl-gate-" + exitMode : "") + (exitMode.startsWith("reduced") ? " gl-reduced" : ""),
    role: "status",
    "aria-live": "polite",
    "aria-busy": "true",
    "aria-label": shown.label,
    "data-global-loading": "true",
    "data-loading-gate-phase": exitMode || "loading"
  }, /*#__PURE__*/React.createElement("style", null, GLOBAL_LOADING_STYLE), /*#__PURE__*/React.createElement("div", {
    className: "gl-gate-stage" + ((loadedFrames & 1) && !artFailed ? " closed-ready" : ""),
    "aria-hidden": "true"
  }, hasArtSources ? [
    [closedSrc, "gl-art gl-art-closed", 1],
    [openingSrc, "gl-art gl-art-opening", 2],
    [openSrc, "gl-art gl-art-open", 4]
  ].map(([src, className, bit]) => /*#__PURE__*/React.createElement("img", {
    key: className, className, src, alt: "", width: 1536, height: 1024,
    decoding: "async", draggable: false,
    onLoad: () => setLoadedFrames(mask => mask | bit),
    onError: () => setArtFailed(true)
  })) : null), /*#__PURE__*/React.createElement("div", {
    className: "gl-panel"
  }, (!hasArtSources || artFailed) ? /*#__PURE__*/React.createElement("div", {
    className: "gl-fallback",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("span", { className: "gl-ring" }), /*#__PURE__*/React.createElement("span", { className: "gl-ring-inner" }), /*#__PURE__*/React.createElement("span", { className: "gl-rune" })) : null, /*#__PURE__*/React.createElement("p", {
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
