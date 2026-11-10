const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  ERROR_KIND_BY_CODE, ERROR_TEXT_TH, errorKind, errorMessage, isSessionErrorCode, errorCodesOfKind
} = require("../src/state/errorCatalog.js");
const { extractFunction, extractArrowConst } = require("./helpers/extract-source.js");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function serverErrorCodes() {
  const files = ["workers/thornie-dungeons-api.js", "workers/thornie-dungeons-api-entry.js"]
    .concat(fs.readdirSync(path.join(root, "workers/modules")).map(f => "workers/modules/" + f));
  const codes = new Set();
  files.forEach(file => { for (const m of read(file).matchAll(/error:\s*"([a-z0-9_]+)"/g)) codes.add(m[1]); });
  return Array.from(codes).sort();
}

test("Error catalog: every error code the Worker can return is classified (drift guard)", () => {
  const missing = serverErrorCodes().filter(code => !Object.prototype.hasOwnProperty.call(ERROR_KIND_BY_CODE, code));
  assert.deepEqual(missing, [], "add these codes to src/state/errorCatalog.js: " + missing.join(", "));
});

test("Error catalog: kinds are from the allowed set and client-only codes are present", () => {
  const allowed = new Set(["session", "transient", "rate_limit", "conflict", "validation", "business", "admin", "fatal"]);
  Object.entries(ERROR_KIND_BY_CODE).forEach(([code, kind]) => assert.ok(allowed.has(kind), `${code}: ${kind}`));
  ["network_error", "session_replaced", "session_revoked"].forEach(code => assert.ok(ERROR_KIND_BY_CODE[code], code));
  assert.equal(errorKind("insufficient_gold"), "business");
  assert.equal(errorKind("operation_in_progress"), "conflict");
  assert.equal(errorKind("server_error"), "transient");
  assert.equal(errorKind({ error: "chat_rate_limited" }), "rate_limit");
  assert.equal(errorKind("totally_new_code"), "unknown");
  assert.equal(errorKind(undefined), "unknown");
  assert.equal(errorKind("__proto__"), "unknown");
});

test("Error catalog: session kind matches the hand-written session sets (no drift)", () => {
  const auth = read("src/state/auth.js");
  const app = read("src/ui/App.js");
  const parse = (source, name) => new Set(source.match(new RegExp(`${name} = new Set\\(\\[([^\\]]*)\\]`))[1].split(",").map(s => s.trim().replace(/"/g, "")).filter(Boolean));
  const catalog = new Set(errorCodesOfKind("session"));
  assert.deepEqual(parse(auth, "SESSION_LIFECYCLE_ERRORS"), catalog);
  assert.deepEqual(parse(app, "BATTLE_SESSION_ERRORS"), catalog);
  assert.equal(isSessionErrorCode("session_expired"), true);
  assert.equal(isSessionErrorCode("forbidden"), false);
});

test("Error catalog: errorMessage resolves override -> catalog -> fallback and never returns the raw code", () => {
  const overrides = { insufficient_gold: "Gold ไม่พอ", session_expired: "ของหน้านี้" };
  assert.equal(errorMessage("insufficient_gold", { overrides, fallback: "x" }), "Gold ไม่พอ");
  assert.equal(errorMessage("session_expired", { overrides, fallback: "x" }), "ของหน้านี้", "screen override wins over catalog");
  assert.equal(errorMessage("session_expired", { fallback: "x" }), ERROR_TEXT_TH.session_expired);
  assert.equal(errorMessage("something_unknown", { overrides, fallback: "fallback text" }), "fallback text");
  assert.equal(errorMessage({ error: "invalid_session" }), ERROR_TEXT_TH.invalid_session);
  assert.equal(errorMessage(undefined, { fallback: "f" }), "f");
  assert.equal(errorMessage("__proto__", { overrides, fallback: "f" }), "f");
  assert.equal(errorMessage("constructor", { overrides, fallback: "f" }), "f");
  Object.values(ERROR_TEXT_TH).forEach(text => assert.doesNotMatch(text, /^[a-z0-9_]+$/));
});

test("Error catalog: screen helpers render exactly the same text as before the refactor", () => {
  const snapshot = JSON.parse(read("tests/fixtures/error-text-snapshot.json"));
  const components = read("src/ui/components.js");
  const sandbox = { ...require("../src/state/errorCatalog.js") };
  vm.createContext(sandbox);
  vm.runInContext([
    extractFunction(components, "friendErrorText"),
    extractFunction(components, "chatErrorText"),
    extractFunction(components, "guildErrorText"),
    extractArrowConst(components, "mailboxErrorText"),
    "globalThis.__f = { friendErrorText, chatErrorText, guildErrorText, mailboxErrorText };"
  ].join("\n"), sandbox);
  let checked = 0;
  Object.entries(snapshot).forEach(([name, table]) => {
    Object.entries(table).forEach(([code, expected]) => {
      const input = code === "undefined" ? undefined : code === "null" ? null : code;
      assert.equal(sandbox.__f[name](input), expected, `${name}(${code})`);
      checked += 1;
    });
  });
  assert.ok(checked > 700, "snapshot must cover every code on every helper");
});

test("Error catalog: session_revoked is the one intentional wording change (was a generic error)", () => {
  const components = read("src/ui/components.js");
  const sandbox = { ...require("../src/state/errorCatalog.js") };
  vm.createContext(sandbox);
  vm.runInContext([extractFunction(components, "friendErrorText"), extractFunction(components, "chatErrorText"), extractFunction(components, "guildErrorText"), extractArrowConst(components, "mailboxErrorText"), "globalThis.__f = { friendErrorText, chatErrorText, guildErrorText, mailboxErrorText };"].join("\n"), sandbox);
  Object.values(sandbox.__f).forEach(fn => assert.equal(fn("session_revoked"), ERROR_TEXT_TH.session_revoked));
});

test("Error catalog: wired into the bundle before auth.js and the duplicated session text is gone", () => {
  const build = read("build.js");
  assert.ok(build.indexOf('"state/errorCatalog.js"') > -1 && build.indexOf('"state/errorCatalog.js"') < build.indexOf('"state/auth.js"'));
  const components = read("src/ui/components.js");
  assert.equal((components.match(/Session หมดอายุ กรุณาเข้าสู่ระบบใหม่/g) || []).length, 0, "shared session text lives in the catalog only");
});
