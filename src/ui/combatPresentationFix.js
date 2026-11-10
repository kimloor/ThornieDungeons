// Presentation-only combat stability overrides.
// Keeps the battle log from changing outer layout height on first multi-enemy action,
// and renders a guaranteed-visible BEGIN! cue for the existing 800ms intro gate.
(() => {
  const STYLE_ID = "thornie-combat-presentation-fix-v1";

  function installCombatPresentationFix() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* The combat log is a sibling of .md-scene, not its child. Target the real DOM shape so
   long first-turn multi-monster messages cannot grow the bottom panel and shrink the arena. */
.md-root-combat > .md-panel {
  flex: 0 0 auto !important;
  min-height: 0 !important;
  padding: 6px 10px max(7px, env(safe-area-inset-bottom, 0px)) !important;
  border-top-width: 1px !important;
}
.md-root-combat > .md-panel .md-log {
  height: 50px !important;
  min-height: 50px !important;
  max-height: 50px !important;
  overflow: hidden !important;
  overscroll-behavior: none !important;
  padding: 5px 8px !important;
  gap: 1px !important;
  contain: size layout paint !important;
}
.md-root-combat > .md-panel .md-log-line {
  flex: 0 0 auto !important;
  min-height: 12px !important;
  font-size: 9px !important;
  line-height: 1.25 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.md-root-combat > .md-panel .md-log-line.latest {
  font-size: 10.5px !important;
}

/* The original component already owns the 800ms gameplay presentation gate. Render the cue
   from the battlefield itself so reduced-motion settings cannot collapse it to a 1ms flash. */
.md-root-combat .md-battle-intro {
  display: none !important;
}
.md-root-combat .md-scene.battle-bg::after {
  content: "BEGIN!";
  position: absolute;
  left: 50%;
  top: 48%;
  z-index: 40;
  transform: translate(-50%, -50%) scale(1);
  color: #fff1ad;
  font: 800 clamp(34px, 11vw, 52px)/1 'Baloo 2', sans-serif;
  letter-spacing: .08em;
  text-shadow: 0 3px 0 #6c3d13, 0 0 18px rgba(255,209,102,.9);
  pointer-events: none;
  opacity: 0;
  animation: md-battle-begin-stable 800ms linear both;
}
@keyframes md-battle-begin-stable {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.86); }
  10% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  68% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -56%) scale(1.04); }
}

@media (max-width: 380px) {
  .md-root-combat > .md-panel .md-log {
    height: 44px !important;
    min-height: 44px !important;
    max-height: 44px !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .md-root-combat .md-scene.battle-bg::after {
    animation-name: md-battle-begin-reduced !important;
  }
  @keyframes md-battle-begin-reduced {
    0%, 82% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1); }
  }
}
`;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", installCombatPresentationFix, { once: true });
  } else {
    installCombatPresentationFix();
  }
})();
