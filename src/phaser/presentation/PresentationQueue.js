// ---------- W5 Visual Presentation Queue ----------
// This queue is intentionally renderer-only. It serializes already-resolved
// presentation callbacks and has no access to Battle Core, rewards or saves.
function createPresentationQueue({ onDrained } = {}) {
  const entries = [];
  let running = false;
  let speed = 1;
  let drainPromise = Promise.resolve();
  let resolveDrain = null;

  function notifyDrained() {
    if (!running && entries.length === 0) {
      onDrained?.();
      resolveDrain?.();
      resolveDrain = null;
      drainPromise = Promise.resolve();
    }
  }

  async function run() {
    if (running) return;
    running = true;
    while (entries.length) {
      const entry = entries.shift();
      if (typeof entry === "function") await entry(speed);
      else if (entry?.run) await entry.run(speed);
    }
    running = false;
    notifyDrained();
  }

  function enqueue(entry) {
    if (entry) entries.push(entry);
    if (!running) void run();
    if (running || entries.length) {
      drainPromise = new Promise(resolve => { resolveDrain = resolve; });
    }
    return drainPromise;
  }

  return Object.freeze({
    enqueue,
    clear() { entries.splice(0, entries.length); },
    setSpeed(value) { speed = Math.max(1, Math.min(2, Number(value) || 1)); },
    isBusy: () => running || entries.length > 0,
    whenDrained: () => drainPromise
  });
}
