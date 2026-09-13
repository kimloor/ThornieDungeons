// Wires the remaining Battle GUI image contracts released by Graphics.
// Presentation-only: no combat rules, target rules, queue order, hit areas, or backend logic change.
(function installBattleGuiCompletionPatch(root) {
  if (typeof React === "undefined") return;

  const imageStyle = key => {
    if (typeof optionalAsset !== "function") return undefined;
    const src = optionalAsset(`battleUi.${key}`);
    return src ? {
      "--battle-ui-image": `url("${src}")`,
      backgroundImage: `url("${src}")`,
      backgroundRepeat: "no-repeat",
      backgroundPosition: "center",
      backgroundSize: "100% 100%"
    } : undefined;
  };

  // Keep the three newly released controls in the critical Battle preload group.
  if (typeof battleUiAssetUrls === "function") {
    const originalBattleUiAssetUrls = battleUiAssetUrls;
    battleUiAssetUrls = function patchedBattleUiAssetUrls() {
      const extra = ["buttons.skip", "turnOrderSlot", "targetSelectedMarker"]
        .map(key => optionalAsset(`battleUi.${key}`))
        .filter(Boolean);
      return [...new Set([...(originalBattleUiAssetUrls() || []), ...extra])];
    };
  }

  // Turn-order cells keep their current queue semantics and hit-free presentation,
  // but use the new portrait frame from R2 for both occupied and empty cells.
  if (typeof TurnOrderBar === "function") {
    TurnOrderBar = function BattleGuiTurnOrderBar({ queue, activeKey, monsters, petCombat }) {
      const visible = (queue || []).filter(item => {
        if (item.kind === "monster") {
          const m = (monsters || []).find(mm => mm.uid === item.uid);
          return !!m && m.hp > 0;
        }
        if (item.kind === "pet") return !!petCombat && petCombat.hp > 0;
        return true;
      });
      const activeIndex = Math.max(0, visible.findIndex(item => item.key === activeKey));
      const ordered = visible.slice(activeIndex);
      const overflow = Math.max(0, ordered.length - 4);
      const slots = Array.from({ length: 4 }, (_, index) => ordered[index] || null);
      const slotArt = imageStyle("turnOrderSlot");

      return React.createElement("div", { className: "md-turn-queue" }, slots.map((item, i) => {
        if (!item) return React.createElement("div", {
          key: `empty-${i}`,
          className: "md-turn-queue-item empty md-battle-art",
          style: slotArt,
          title: "Empty ATB slot"
        }, React.createElement("span", { className: "md-turn-queue-icon" }, "·"));

        const isActive = activeKey === item.key;
        return React.createElement("div", {
          key: item.key,
          className: `md-turn-queue-item ${item.kind} ${isActive ? "active" : ""} md-battle-art`,
          style: slotArt,
          title: `${item.name} · Speed ${item.speed}`
        }, React.createElement("span", { className: "md-turn-queue-icon" }, item.icon),
        i === 3 && overflow > 0 && React.createElement("i", { className: "md-turn-queue-more" }, "+", overflow));
      }));
    };
  }

  // Replace the temporary CSS outline with the R2 selected-target marker.
  // Target selection itself is untouched; this only decorates the already-selected enemy.
  if (typeof EnemySprite === "function") {
    const originalEnemySprite = EnemySprite;
    EnemySprite = function BattleGuiEnemySprite(props) {
      const rendered = originalEnemySprite(props);
      if (!rendered || !props?.selected || !(Number(props?.enemy?.hp) > 0)) return rendered;
      const markerArt = imageStyle("targetSelectedMarker");
      if (!markerArt) return rendered;

      const children = React.Children.toArray(rendered.props.children);
      children.push(React.createElement("span", {
        key: "battle-target-marker",
        className: "md-target-selected-marker md-battle-art",
        "aria-hidden": "true",
        style: {
          ...markerArt,
          position: "absolute",
          left: "50%",
          top: "50%",
          width: "118%",
          height: "118%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 5
        }
      }));

      return React.cloneElement(rendered, {
        style: {
          ...(rendered.props.style || {}),
          position: "relative",
          outline: "none"
        }
      }, ...children);
    };
  }

  // Add the dedicated Skip art while retaining the existing button, title, disabled state,
  // click handler, and turn-6 unlock rule from CombatScreen.
  if (typeof CombatScreen === "function") {
    const originalCombatScreen = CombatScreen;
    const decorateSkip = node => {
      if (!React.isValidElement(node)) return node;
      const className = typeof node.props?.className === "string" ? node.props.className : "";
      const isSkip = className.includes("md-combat-header-action") && className.includes("skip");
      const nextChildren = React.Children.map(node.props?.children, decorateSkip);
      if (!isSkip) return React.cloneElement(node, undefined, nextChildren);
      return React.cloneElement(node, {
        className: `${className} md-battle-art`,
        style: { ...(node.props.style || {}), ...(imageStyle("buttons.skip") || {}) }
      }, nextChildren);
    };
    CombatScreen = function BattleGuiCombatScreen(props) {
      return decorateSkip(originalCombatScreen(props));
    };
  }

  root.__thornieBattleGuiCompletion = { installed: true };
})(typeof globalThis !== "undefined" ? globalThis : this);
