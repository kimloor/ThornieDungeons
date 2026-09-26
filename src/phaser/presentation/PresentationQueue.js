// ---------- W6 Shared Presentation Queue ----------
const PRESENTATION_QUEUE_CONTRACT = Object.freeze({
  version: 1,
  minSpeed: 1,
  maxSpeed: 2
});

function normalizePresentationTask(entry) {
  if (typeof entry === "function") return Object.freeze({ run: entry });
  if (entry && typeof entry.run === "function") return entry;
  return null;
}

// This queue is intentionally presentation-only. It serializes already-resolved
// visual callbacks and has no access to gameplay, rewards, persistence or saves.
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
      const task = entries.shift();
      await task.run(speed);
    }
    running = false;
    notifyDrained();
  }

  function enqueue(entry) {
    const task = normalizePresentationTask(entry);
    if (task) entries.push(task);
    if (!running && entries.length) void run();
    if (running || entries.length) {
      drainPromise = new Promise(resolve => { resolveDrain = resolve; });
    }
    return drainPromise;
  }

  return Object.freeze({
    contract: PRESENTATION_QUEUE_CONTRACT,
    enqueue,
    clear() { entries.splice(0, entries.length); },
    setSpeed(value) {
      speed = Math.max(
        PRESENTATION_QUEUE_CONTRACT.minSpeed,
        Math.min(PRESENTATION_QUEUE_CONTRACT.maxSpeed, Number(value) || 1)
      );
    },
    getSpeed: () => speed,
    isBusy: () => running || entries.length > 0,
    whenDrained: () => drainPromise
  });
}
