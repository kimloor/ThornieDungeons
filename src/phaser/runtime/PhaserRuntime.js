// ---------- W5 Phaser Runtime ----------
// Phaser is an optional presentation dependency. It is loaded only when the
// controlled renderer flag is enabled and is never allowed to block Battle Core.
const THORNIE_PHASER_VERSION = "3.90.0";
const THORNIE_PHASER_URL = `https://cdn.jsdelivr.net/npm/phaser@${THORNIE_PHASER_VERSION}/dist/phaser.min.js`;

const THORNIE_PHASER_RUNTIME = (() => {
  let promise = null;
  let state = { status: "idle", version: THORNIE_PHASER_VERSION, error: null };

  function currentPhaser() {
    const runtime = typeof globalThis !== "undefined" ? globalThis.Phaser : null;
    return runtime && typeof runtime.Game === "function" ? runtime : null;
  }

  function load() {
    const existing = currentPhaser();
    if (existing) {
      state = { status: "ready", version: THORNIE_PHASER_VERSION, error: null };
      return Promise.resolve(existing);
    }
    if (promise) return promise;
    if (typeof document === "undefined") {
      const error = new Error("Phaser runtime requires a browser document");
      state = { status: "error", version: THORNIE_PHASER_VERSION, error };
      promise = Promise.reject(error);
      promise.catch(() => {});
      return promise;
    }

    state = { status: "loading", version: THORNIE_PHASER_VERSION, error: null };
    promise = new Promise((resolve, reject) => {
      let script = document.querySelector(`script[data-thornie-phaser-runtime="${THORNIE_PHASER_VERSION}"]`);
      const fail = error => {
        const nextError = error instanceof Error ? error : new Error("Phaser runtime failed to load");
        state = { status: "error", version: THORNIE_PHASER_VERSION, error: nextError };
        reject(nextError);
      };
      const ready = () => {
        const runtime = currentPhaser();
        if (!runtime) return fail(new Error("Phaser runtime loaded without Phaser.Game"));
        const actualVersion = String(runtime.VERSION || runtime.VERSION_STRING || "");
        if (actualVersion && actualVersion !== THORNIE_PHASER_VERSION) {
          return fail(new Error(`Phaser version mismatch: expected ${THORNIE_PHASER_VERSION}, got ${actualVersion}`));
        }
        state = { status: "ready", version: THORNIE_PHASER_VERSION, error: null };
        resolve(runtime);
      };
      if (!script) {
        script = document.createElement("script");
        script.src = THORNIE_PHASER_URL;
        script.async = true;
        script.dataset.thorniePhaserRuntime = THORNIE_PHASER_VERSION;
        script.addEventListener("load", ready, { once: true });
        script.addEventListener("error", () => fail(new Error(`Unable to load Phaser ${THORNIE_PHASER_VERSION}`)), { once: true });
        (document.head || document.documentElement).appendChild(script);
      } else {
        script.addEventListener("load", ready, { once: true });
        script.addEventListener("error", () => fail(new Error(`Unable to load Phaser ${THORNIE_PHASER_VERSION}`)), { once: true });
        if (currentPhaser()) ready();
      }
    });
    promise.catch(() => {});
    return promise;
  }

  return Object.freeze({
    version: THORNIE_PHASER_VERSION,
    url: THORNIE_PHASER_URL,
    load,
    getState: () => ({ ...state })
  });
})();
