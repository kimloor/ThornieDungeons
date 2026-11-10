// The static-assets bundle uses assets.directory = "." (wrangler.jsonc), so .assetsignore is the
// only thing keeping source, config, migrations and docs out of public hosting.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const ignore = fs.readFileSync(path.join(root, ".assetsignore"), "utf8")
  .split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const isIgnored = (rel) => ignore.some((rule) => rule.endsWith("/") ? rel.startsWith(rule) : rel === rule);

test("wrangler serves the repo root, so .assetsignore must exclude every private path", () => {
  assert.match(fs.readFileSync(path.join(root, "wrangler.jsonc"), "utf8"), /"directory":\s*"\."/);
  for (const rel of [
    "workers/thornie-dungeons-api.js", "workers/modules/auth.js", "worker.js", "wrangler.jsonc", "wrangler.api.template.jsonc",
    "AGENTS.md", "build.js", "head.html", "tail.html", "migrations/auto/0022_admin_v2_auth.sql", "tests/admin-v2-auth.test.js",
    "docs/ADMIN-V2.md", "src/data/styles.js", "scripts/battle-core-port.js", ".github/workflows/deploy-frontend-production.yml", ".git/config",
  ]) assert.ok(isIgnored(rel), `${rel} would be publicly served`);
});

test(".assetsignore does not hide anything the site or Admin page loads", () => {
  for (const rel of ["index.html", "admin.html", "admin-app.js", "site.webmanifest", "icons/icon-192.png"]) {
    assert.ok(!isIgnored(rel), `${rel} must stay public`);
  }
  const html = fs.readFileSync(path.join(root, "admin.html"), "utf8");
  for (const m of html.matchAll(/(?:src|href)="\/([^"#?]+)"/g)) assert.ok(!isIgnored(m[1]), `${m[1]} is referenced by admin.html`);
});

test("every top-level entry is either public or deliberately ignored (new private folders fail here)", () => {
  const publicEntries = new Set(["admin-app.js", "admin.html", "icons", "index.html", "site.webmanifest", ".assetsignore"]);
  for (const name of fs.readdirSync(root)) {
    const rel = fs.statSync(path.join(root, name)).isDirectory() ? name + "/" : name;
    if (publicEntries.has(name)) continue;
    if (name === "node_modules") continue;
    assert.ok(isIgnored(rel), `${rel} is neither in the public allowlist nor in .assetsignore`);
  }
});
