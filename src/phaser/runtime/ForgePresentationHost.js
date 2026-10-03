// ---------- W7B Forge Presentation Host ----------
function createForgePresentationHost({ mountNode, event, onReady, onError, onDestroyed } = {}) {
  let game = null;
  let scene = null;
  let destroyed = false;
  let resizeObserver = null;
  let currentEvent = event || null;
  function size() { return { width: Math.max(1, Math.round(mountNode?.clientWidth || 1)), height: Math.max(1, Math.round(mountNode?.clientHeight || 1)) }; }
  function resize() { if (!destroyed && game) { const next = size(); game.scale.resize(next.width, next.height); } }
  async function mount() {
    if (destroyed || !mountNode) return;
    try {
      const Phaser = await THORNIE_PHASER_RUNTIME.load();
      if (destroyed) return;
      const initial = size();
      const SceneClass = createForgePresentationScene(Phaser, { initialEvent: currentEvent, onReady: payload => { scene = payload?.scene || null; onReady?.({ game, scene, version: THORNIE_PHASER_RUNTIME.version }); }, onError });
      game = new Phaser.Game({ type: Phaser.AUTO, parent: mountNode, width: initial.width, height: initial.height, transparent: true, backgroundColor: "rgba(0,0,0,0)", banner: false, audio: { noAudio: true }, scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH }, render: { antialias: true, pixelArt: false, roundPixels: false }, scene: SceneClass });
      if (typeof ResizeObserver === "function") { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(mountNode); }
    } catch (error) { if (!destroyed) onError?.(error); }
  }
  function present(nextEvent) {
    currentEvent = nextEvent || currentEvent;
    if (destroyed || !scene?.present || !currentEvent) return Promise.resolve();
    try { return Promise.resolve(scene.present(currentEvent)); } catch (error) { onError?.(error); return Promise.resolve(); }
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    resizeObserver?.disconnect(); resizeObserver = null;
    const target = game; game = null; scene = null;
    try { target?.destroy(true); } catch (error) { console.warn("Phaser Forge teardown failed", error); }
    onDestroyed?.();
  }
  return Object.freeze({ mount, present, destroy, getScene: () => scene });
}
