const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function makeStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function loadAuthClient({ remembered = new Map(), tab = makeStorage() } = {}) {
  const source = fs.readFileSync(path.join(__dirname, "../src/state/auth.js"), "utf8");
  const sandbox = {
    module: { exports: {} },
    exports: {},
    window: { sessionStorage: tab },
    kvGet: async key => remembered.get(key) || null,
    kvSet: async (key, value) => remembered.set(key, value),
    kvRemove: async key => remembered.delete(key),
    Set,
    JSON
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return { ...sandbox.module.exports, remembered, tab };
}

const session = {
  sessionToken: "opaque-token",
  playerId: "Player_1",
  expiresAt: "2099-01-01T00:00:00.000Z",
  recoveryConfigured: true
};

test("Remember Login survives reopen without storing a password", async () => {
  const first = loadAuthClient();
  const store = first.createAuthSessionStore();
  await store.setSession(session, true);
  const persisted = [...first.remembered.values()].join("");
  assert.match(persisted, /opaque-token/);
  assert.doesNotMatch(persisted, /password/i);

  const reopened = loadAuthClient({ remembered: first.remembered });
  const reopenedStore = reopened.createAuthSessionStore();
  assert.equal((await reopenedStore.load()).playerId, "Player_1");
  assert.equal(reopenedStore.getToken(), "opaque-token");
});

test("non-remembered session stays tab-scoped", async () => {
  const client = loadAuthClient();
  const store = client.createAuthSessionStore();
  await store.setSession(session, false);
  assert.equal(client.remembered.size, 0);
  assert.match(client.tab.getItem("thornie-auth-tab-session-v2"), /opaque-token/);
});

test("network failures preserve a valid session; lifecycle failures clear it", async () => {
  const client = loadAuthClient();
  const store = client.createAuthSessionStore();
  await store.setSession(session, true);
  let invalidReason = "";
  store.onInvalid(reason => { invalidReason = reason; });

  store.handleApiResult({ error: "network_error" });
  await Promise.resolve();
  assert.equal(store.getToken(), "opaque-token");

  store.handleApiResult({ error: "session_replaced" });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(store.getToken(), "");
  assert.equal(invalidReason, "session_replaced");
  assert.equal(client.remembered.size, 0);
});

test("a lifecycle response from an old generation cannot clear a newer login", async () => {
  const client = loadAuthClient();
  const store = client.createAuthSessionStore();
  await store.setSession(session, true);
  const oldGeneration = store.getGeneration();
  await store.setSession({ ...session, sessionToken: "new-token" }, true);

  const result = store.handleApiResult({ error: "session_replaced" }, oldGeneration);
  await Promise.resolve();
  assert.equal(result.error, "stale_session_response");
  assert.equal(store.getToken(), "new-token");
});
