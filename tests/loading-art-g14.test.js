const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("r2-upload/manifest.json"));
const qa = JSON.parse(read("docs/graphics/g14/QA.json"));

test("G14 loading frame pack matches the approved manifest, hashes and PNG budget", () => {
  assert.deepEqual(manifest.assets.loadingUi, {
    gateEmblem: "ui/loading/gate_emblem.png",
    gateEmblemOpening: "ui/loading/gate_emblem_opening.png",
    gateEmblemOpen: "ui/loading/gate_emblem_open.png"
  });
  for (const row of qa.frames) {
    const buffer = fs.readFileSync(path.join(root, "r2-upload", row.r2_path));
    assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(buffer.readUInt32BE(16), 256);
    assert.equal(buffer.readUInt32BE(20), 256);
    assert.equal(buffer[24], 8);
    assert.equal(buffer[25], 6, "production frame must be RGBA");
    assert.equal(buffer.length, row.bytes);
    assert.ok(buffer.length <= 100000, `${row.file} exceeds the target budget`);
    assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"), row.sha256);
    assert.ok(Math.min(...Object.values(row.padding)) >= 20);
    assert.equal(manifest.assets.loadingUi[row.manifest_key], row.r2_path);
  }
});

test("G14 presentation keeps the CSS fallback and never acquires loading ownership", () => {
  const overlay = read("src/ui/GlobalLoadingOverlay.js");
  assert.match(overlay, /loadingUiUrl\("gateEmblem"\)/);
  assert.match(overlay, /loadingUiUrl\("gateEmblemOpening"\)/);
  assert.match(overlay, /loadingUiUrl\("gateEmblemOpen"\)/);
  assert.match(overlay, /hasArtSources && !artFailed && loadedFrames === 7/);
  assert.match(overlay, /onError: \(\) => setArtFailed\(true\)/);
  assert.match(overlay, /if \(reduced \|\| !artReady\) return undefined/);
  assert.match(overlay, /prefers-reduced-motion: reduce/);
  assert.match(overlay, /setTimeout\(\(\) => setHoldExit\(false\), 360\)/);
  const component = overlay.slice(overlay.indexOf("function GlobalLoadingOverlay"));
  assert.doesNotMatch(component, /GLOBAL_LOADING\.(begin|run|releaseKey)/);
  assert.match(overlay, /className: "gl-rune"/);
});

test("G14 manifest resolver is optional and introduces no new loader", () => {
  const resolver = read("src/assets/manifest.js");
  assert.match(resolver, /function loadingUiUrl\(key\) \{\s*return optionalAsset\(`loadingUi\.\$\{key\}`\);\s*\}/);
  assert.equal((resolver.match(/async function loadAssetManifest/g) || []).length, 1);
});
