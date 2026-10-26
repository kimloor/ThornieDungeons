const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const qa = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/graphics/g15/QA.json"), "utf8"));

test("G15 review candidates match recorded dimensions, byte budgets and hashes", () => {
  assert.equal(qa.status, "artwork-candidate-owner-review");
  assert.equal(qa.assets.length, 6);
  const hashes = new Set();
  for (const asset of qa.assets) {
    const file = path.join(ROOT, "docs/graphics/g15", asset.filename);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.readUInt32BE(16), 128, asset.filename + " width");
    assert.equal(bytes.readUInt32BE(20), 128, asset.filename + " height");
    assert.equal(bytes.length, asset.bytes, asset.filename + " bytes");
    assert.ok(bytes.length <= qa.target_bytes, asset.filename + " target budget");
    assert.ok(Math.min(...Object.values(asset.padding)) >= qa.minimum_safe_padding_px, asset.filename + " padding");
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash, asset.sha256, asset.filename + " sha256");
    assert.ok(!hashes.has(hash), asset.filename + " duplicate hash");
    hashes.add(hash);
  }
});

test("G15 candidate gate has not published or integrated assets before Owner approval", () => {
  assert.equal(qa.checks.owner_approval, "PENDING");
  assert.equal(qa.checks.r2_published, false);
  assert.equal(qa.checks.runtime_integrated, false);
  for (const asset of qa.assets) {
    assert.equal(fs.existsSync(path.join(ROOT, "r2-upload", asset.proposed_r2_path)), false);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "r2-upload/manifest.json"), "utf8"));
  assert.equal(manifest.assets.infoCenterUi, undefined);
});
