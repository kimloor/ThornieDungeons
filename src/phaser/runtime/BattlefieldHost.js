// ---------- W5 Phaser Battlefield Host ----------
function createBattlefieldHost({ mountNode, snapshot, onReady, onError, onDestroyed, onTargetSelected } = {}) {
  let game = null;
  let scene = null;
  let destroyed = false;
  let resizeObserver = null;
  let windowResize = null;
  let currentSnapshot = snapshot || null;
  const bridge = createPresentationEventBridge({
    syncType: "BATTLEFIELD_SYNC",
    streamKey: "battleId",
    allowStaleSync: true,
    onEvent: event => {
      try {
        scene?.consume(event);
      } catch (error) {
        onError?.(error);
      }
    },
    onStatus: (status, detail) => status === "error" && onError?.(detail)
  });

  function hostSize() {
    return {
      width: Math.max(1, Math.round(mountNode?.clientWidth || 1)),
      height: Math.max(1, Math.round(mountNode?.clientHeight || 1))
    };
  }

  function resize() {
    if (destroyed || !game || !mountNode) return;
    const { width, height } = hostSize();
    game.scale.resize(width, height);
  }

  async function mount() {
    if (destroyed || !mountNode) return;
    try {
      const Phaser = await THORNIE_PHASER_RUNTIME.load();
      if (destroyed) return;
      const { width, height } = hostSize();
      const SceneClass = createBattleScene(Phaser, {
        initialSnapshot: currentSnapshot,
        onReady: payload => {
          scene = payload?.scene || null;
          if (scene) bridge.sync(currentSnapshot);
          if (payload?.destroyed) { scene = null; return; }
          onReady?.({ game, scene, version: THORNIE_PHASER_RUNTIME.version });
        },
        onError,
        onTargetSelected
      });
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: mountNode,
        width,
        height,
        transparent: true,
        backgroundColor: "rgba(0,0,0,0)",
        banner: false,
        audio: { noAudio: true },
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        render: { antialias: true, pixelArt: false, roundPixels: false },
        scene: SceneClass
      });
      if (game?.canvas?.style) {
        game.canvas.style.background = "transparent";
        game.canvas.style.backgroundColor = "transparent";
      }
      if (typeof ResizeObserver === "function") {
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mountNode);
      } else {
        windowResize = resize;
        window.addEventListener("resize", windowResize, { passive: true });
      }
    } catch (error) {
      if (!destroyed) onError?.(error);
    }
  }

  function sync(nextSnapshot) {
    currentSnapshot = nextSnapshot || currentSnapshot;
    if (scene) bridge.sync(currentSnapshot);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (windowResize) window.removeEventListener("resize", windowResize);
    windowResize = null;
    bridge.reset();
    const gameToDestroy = game;
    game = null;
    scene = null;
    try {
      gameToDestroy?.destroy(true);
    } catch (error) {
      // Phaser is presentation-only. A teardown failure must never bubble into
      // the app/result flow after authoritative combat has already completed.
      console.warn("Phaser battlefield teardown failed", error);
    }
    onDestroyed?.();
  }

  return Object.freeze({ mount, sync, destroy, getGame: () => game, getScene: () => scene });
}
