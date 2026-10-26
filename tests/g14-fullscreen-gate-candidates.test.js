const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "docs/graphics/g14-fullscreen-gate");
const EXPECTED = Object.freeze({
  "closed.jpg": "b85badc18c003d8e93aa48bfbb36d4a3ad63dbfb48baa09a6b93284ee656ff33",
  "opening.jpg": "f64db9fdf5b13d7299539db5c9efd05fdbe308c36a55b4bb1e7df41e9055feb2",
  "open.jpg": "750a45fe382fd4758e0067af8e8d572e3c806e586729a4cc6cd35b3148c171c4"
});

function jpegDimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const size = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + size;
  }
  throw new Error("JPEG dimensions not found");
}

test("fullscreen gate review candidates are hash-exact 1536x1024 masters", () => {
  for (const [file, expectedHash] of Object.entries(EXPECTED)) {
    const bytes = fs.readFileSync(path.join(DIR, file));
    assert.deepEqual(jpegDimensions(bytes), { width: 1536, height: 1024 });
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expectedHash);
  }
});

test("unapproved fullscreen candidates are documentation-only", () => {
  const manifest = fs.readFileSync(path.join(ROOT, "r2-upload/manifest.json"), "utf8");
  const runtime = fs.readFileSync(path.join(ROOT, "src/ui/GlobalLoadingOverlay.js"), "utf8");
  for (const file of Object.keys(EXPECTED)) {
    assert.ok(!manifest.includes(`g14-fullscreen-gate/${file}`));
    assert.ok(!runtime.includes(`g14-fullscreen-gate/${file}`));
  }
});
