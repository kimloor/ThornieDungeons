// ---------- W8 Shared Hero Preview Host ----------
function createHeroPreviewHost({ mountNode, snapshot, anchorX = 0.5, onReady, onError, onDestroyed } = {}) {
  let game = null;
  let scene = null;
  let destroyed = false;
  let resizeObserver = null;
  let windowResize = null;
  let startupTimer = null;
  let startupReady = false;
  let currentSnapshot = snapshot || null;

  function measuredHostSize() {
    return {
      width: Math.max(0, Math.round(mountNode?.clientWidth || 0)),
      height: Math.max(0, Math.round(mountNode?.clientHeight || 0))
    };
  }

  function hostSize() {
    const measured = measuredHostSize();
    return {
      width: Math.max(1, measured.width),
      height: Math.max(1, measured.height)
    };
  }

  function nextLayoutFrame() {
    return new Promise(resolve => {
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 16);
    });
  }

  async function waitForHostSize() {
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const measured = measuredHostSize();
      if (measured.width >= 32 && measured.height >= 32) return measured;
      await nextLayoutFrame();
      if (destroyed) break;
    }
    return hostSize();
  }

  function resize() {
    if (destroyed || !game || !mountNode) return;
    const { width, height } = hostSize();
    game.scale.resize(width, height);
    scene?.handleResize?.({ width, height });
  }

  async function mount() {
    if (destroyed || !mountNode) return;
    try {
      const Phaser = await THORNIE_PHASER_RUNTIME.load();
      if (destroyed) return;
      const { width, height } = await waitForHostSize();
      if (destroyed) return;
      const SceneClass = createHeroPreviewScene(Phaser, {
        initialSnapshot: currentSnapshot,
        anchorX,
        onReady: payload => {
          scene = payload?.scene || null;
          if (scene) scene.sync(currentSnapshot);
          if (payload?.destroyed) { scene = null; return; }
          startupReady = true;
          if (startupTimer) clearTimeout(startupTimer);
          startupTimer = null;
          onReady?.({ game, scene, version: THORNIE_PHASER_RUNTIME.version });
        },
        onError
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
      startupTimer = setTimeout(() => {
        if (destroyed || startupReady) return;
        const error = new Error("Phaser Inventory preview scene startup timed out");
        globalThis.BATTLE_ERROR_CATCHER?.captureRuntime?.({ thrown: error, surface: "inventory", phase: "scene_start" });
        onError?.(error);
        destroy();
      }, 12000);
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
      // iOS can report a zero-sized absolutely positioned host during the first
      // React effect. Re-read layout after Phaser mounts so the actor anchor is
      // never left at the temporary 1x1 origin.
      void nextLayoutFrame().then(() => {
        if (!destroyed) resize();
      });
    } catch (error) {
      if (!destroyed) {
        globalThis.BATTLE_ERROR_CATCHER?.captureRuntime?.({ thrown: error, surface: "inventory", phase: "runtime_load" });
        onError?.(error);
      }
    }
  }

  function sync(nextSnapshot) {
    currentSnapshot = nextSnapshot || currentSnapshot;
    scene?.sync(currentSnapshot);
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (startupTimer) clearTimeout(startupTimer);
    startupTimer = null;
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (windowResize) window.removeEventListener("resize", windowResize);
    windowResize = null;
    if (game) game.destroy(true);
    game = null;
    scene = null;
    onDestroyed?.();
  }

  return Object.freeze({ mount, sync, destroy, getGame: () => game, getScene: () => scene });
}
