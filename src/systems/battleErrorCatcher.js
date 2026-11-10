// One runtime switch controls both safe Battle rejection details and structured failure logging.
(function installBattleErrorCatcher(root) {
  let enabled = true;
  const safeCode = value => {
    const code = String(value == null ? "" : value).trim().toLowerCase();
    return /^[a-z0-9][a-z0-9_-]{0,79}$/.test(code) ? code : "";
  };
  root.BATTLE_ERROR_CATCHER = Object.freeze({
    setEnabled(value) { enabled = !!value; return enabled; },
    isEnabled() { return enabled; },
    capturePresentation({ thrown, surface, phase } = {}) {
      if (!enabled) return null;
      const safeSurface = ["inventory", "dungeon", "arena"].includes(surface) ? surface : "unknown";
      const safePhase = safeCode(phase) || "unknown";
      const reason = safeCode(thrown?.code) || `aura_${safePhase}_failed`;
      const diagnostic = {
        event: "enhancement_aura_failed", system: "phaser_presentation",
        component: "enhancement_aura", reason, version: "1.1.49", surface: safeSurface, phase: safePhase
      };
      try { root.console?.warn?.("[production-diagnostic]", JSON.stringify(diagnostic)); } catch (_) {}
      return { reason, surface: safeSurface, phase: safePhase };
    },
    capture({ response, thrown, action, battleId, authorityRev, safeActionSeq, requestId } = {}) {
      if (!enabled) return null;
      const reason = safeCode(response?.error) || safeCode(response?.reason) || safeCode(thrown?.code) || "unknown_error";
      const detail = safeCode(response?.reason);
      const n = Number(response?.status);
      const status = Number.isInteger(n) && n >= 100 && n <= 599 ? n : null;
      const diagnostic = {
        event: "battle_action_rejected", system: "dungeon_battle", reason, version: "1.1.37",
        correlation: {
          battleId: safeCode(battleId) ? String(battleId).slice(0, 120) : "",
          requestId: safeCode(requestId) ? String(requestId).slice(0, 120) : "",
          authorityRev: Number.isInteger(Number(authorityRev)) ? Number(authorityRev) : null,
          safeActionSeq: Number.isInteger(Number(safeActionSeq)) ? Number(safeActionSeq) : null
        },
        action: safeCode(action) || "unknown", status
      };
      try { root.console?.warn?.("[production-diagnostic]", JSON.stringify(diagnostic)); } catch (_) {}
      return { reason, detail, status };
    }
  });
})(globalThis);
