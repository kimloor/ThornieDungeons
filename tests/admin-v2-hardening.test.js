// W2-C (ADMIN-V2.md 22.4): Admin page hardening guard.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

function loadStaticWorker() {
  const source = read("worker.js").replace("export default {", "const workerDefault = {") + "\nglobalThis.__w = workerDefault;";
  const sandbox = { console, Response, Headers, Request, URL };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__w;
}
const env = { ASSETS: { fetch: async () => new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } }) } };

test("Admin HTML guard: no inline script, inline handlers, or external resources", () => {
  const html = read("admin.html");
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  assert.deepEqual(scripts, ['<script src="/admin-app.js">']);
  assert.doesNotMatch(html, /<script[^>]*>[^<]+<\/script>/);
  assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']https?:/i);
  assert.doesNotMatch(html, /<(?:iframe|object|embed|link\b[^>]*rel=["']?stylesheet)/i);
});

test("Admin script guard: no HTML string sinks and no legacy adminKey", () => {
  const js = read("admin-app.js");
  assert.doesNotMatch(js, /\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function|setTimeout\(\s*["'`]/);
  assert.doesNotMatch(js, /adminKey|thornie-admin-key|localStorage/);
  const worker = read("workers/thornie-dungeons-api.js") + read("workers/modules/auth.js");
  assert.doesNotMatch(worker, /p\.get\("adminKey"\)|body\.adminKey/);
});

test("Admin script only talks to the API origin allowed by the CSP", async () => {
  const js = read("admin-app.js");
  const origin = js.match(/const SERVER_URL = "([^"]+)"/)[1];
  const res = await loadStaticWorker().fetch(new Request("https://game.example/admin"), env);
  const csp = res.headers.get("content-security-policy");
  assert.ok(csp.includes(`connect-src 'self' ${origin}`), csp);
  assert.deepEqual((js.match(/https?:\/\/[^"'`\s)]+/g) || []), [origin]);
});

test("/admin, /admin/, /admin.html carry CSP and security headers", async () => {
  const w = loadStaticWorker();
  for (const p of ["/admin", "/admin/", "/admin.html"]) {
    const res = await w.fetch(new Request("https://game.example" + p), env);
    const csp = res.headers.get("content-security-policy");
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /script-src 'self'(;|$)/);
    assert.doesNotMatch(csp.match(/script-src[^;]*/)[0], /unsafe-inline|unsafe-eval/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /base-uri 'none'/);
    assert.match(csp, /form-action 'none'/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("cache-control"), "no-store");
    assert.equal(res.status, 200);
  }
  const js = await w.fetch(new Request("https://game.example/admin-app.js"), env);
  assert.equal(js.headers.get("x-content-type-options"), "nosniff");
  assert.equal(js.headers.get("content-security-policy"), null);
});

test("game pages and R2 assets do not receive the Admin headers", async () => {
  const w = loadStaticWorker();
  for (const p of ["/", "/index.html", "/site.webmanifest", "/administrator", "/admin-app.js.map"]) {
    const res = await w.fetch(new Request("https://game.example" + p), env);
    assert.equal(res.headers.get("content-security-policy"), null, p);
    assert.equal(res.headers.get("x-frame-options"), null, p);
  }
});

test("verifyAdminAccess no longer takes a legacy key argument", () => {
  assert.match(read("workers/modules/auth.js"), /async function verifyAdminAccess\(db, env, request\) \{/);
  assert.doesNotMatch(read("workers/thornie-dungeons-api.js"), /verifyAdminAccess\([^)]*,[^)]*,[^)]*,/);
});

test("Admin session is restored on load (restoreAdminSession is actually invoked)", () => {
  const js = read("admin-app.js");
  assert.match(js, /^void restoreAdminSession\(\);$/m);
  assert.equal((js.match(/restoreAdminSession\(/g) || []).length, 2);
});
