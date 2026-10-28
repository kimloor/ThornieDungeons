const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("r2-upload/manifest.json"));
const qa = JSON.parse(read("docs/graphics/g14/QA.json"));

test("G14 loading emblem frame pack remains compatible and hash-exact", () => {
  assert.deepEqual({
    gateEmblem: manifest.assets.loadingUi.gateEmblem,
    gateEmblemOpening: manifest.assets.loadingUi.gateEmblemOpening,
    gateEmblemOpen: manifest.assets.loadingUi.gateEmblemOpen
  }, {
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

test("G14 fullscreen presentation uses CSS only as a failed-asset fallback and never owns loading", () => {
  const overlay = read("src/ui/GlobalLoadingOverlay.js");
  assert.match(overlay, /loadingUiUrl\("fullscreenGateClosed"\)/);
  assert.match(overlay, /loadingUiUrl\("fullscreenGateOpening"\)/);
  assert.match(overlay, /loadingUiUrl\("fullscreenGateOpen"\)/);
  assert.match(overlay, /hasArtSources && !artFailed && loadedFrames === 7/);
  assert.match(overlay, /onError: \(\) => setArtFailed\(true\)/);
  assert.match(overlay, /setExitMode\("opening"\)/);
  assert.match(overlay, /setExitMode\("open"\)/);
  assert.match(overlay, /setExitMode\("fading"\)/);
  assert.match(overlay, /setExitMode\("reduced-open"\)/);
  assert.match(overlay, /prefers-reduced-motion: reduce/);
  assert.match(overlay, /data-loading-gate-phase/);
  assert.match(overlay, /\(!hasArtSources \|\| artFailed\) \?/);
  assert.match(overlay, /object-fit: cover/);
  const component = overlay.slice(overlay.indexOf("function GlobalLoadingOverlay"));
  assert.doesNotMatch(component, /GLOBAL_LOADING\.(begin|run|releaseKey)/);
  assert.match(overlay, /className: "gl-rune"/);
});

test("G14 exit timing holds the fully-open gate for 1000ms before fade-out", () => {
  const overlay = read("src/ui/GlobalLoadingOverlay.js");
  assert.match(overlay, /openingMs: 900/);
  assert.match(overlay, /fullOpenHoldMs: 1000/);
  assert.match(overlay, /fadeOutMs: 180/);
  assert.match(overlay, /setExitMode\("open"\);\s*schedule\(\(\) => \{\s*setExitMode\("fading"\)/);
  assert.match(overlay, /GLOBAL_LOADING_GATE_TIMING\.fullOpenHoldMs/);
  assert.match(overlay, /return \(\) => timers\.forEach\(clearTimeout\)/);
  assert.match(overlay, /\.gl-overlay\.gl-gate-fading \{ animation: gl-fade-out \.18s ease-in both; \}/);
});

test("G14 fullscreen production frames are 1536x1024 WebP with approved hashes", () => {
  const expected = {
    fullscreenGateClosed: ["ui/loading/fullscreen/gate_closed.webp", 221338, "42d88171768c2dae3f955c02ca578faa11df7c32a32964e4c59bd4fa7f18ca8d"],
    fullscreenGateOpening: ["ui/loading/fullscreen/gate_opening.webp", 175118, "0597465e1e1b858281366bf09e05fba3d947cc3d424fd6f657c21d070cab8f10"],
    fullscreenGateOpen: ["ui/loading/fullscreen/gate_open.webp", 174714, "f7a52b4ce9b375251fe3b323933e02e343896d76120fd5782ad094c93eac595f"]
  };
  for (const [key, [assetPath, bytes, hash]] of Object.entries(expected)) {
    assert.equal(manifest.assets.loadingUi[key], assetPath);
    const buffer = fs.readFileSync(path.join(root, "r2-upload", assetPath));
    assert.equal(buffer.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(buffer.subarray(8, 12).toString("ascii"), "WEBP");
    assert.equal(buffer.subarray(12, 16).toString("ascii"), "VP8 ");
    assert.equal(buffer.readUInt16LE(26) & 0x3fff, 1536);
    assert.equal(buffer.readUInt16LE(28) & 0x3fff, 1024);
    assert.equal(buffer.length, bytes);
    assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"), hash);
  }
});

test("G14 manifest resolver is optional and introduces no new loader", () => {
  const resolver = read("src/assets/manifest.js");
  assert.match(resolver, /function loadingUiUrl\(key\) \{\s*return optionalAsset\(`loadingUi\.\$\{key\}`\);\s*\}/);
  assert.equal((resolver.match(/async function loadAssetManifest/g) || []).length, 1);
});
