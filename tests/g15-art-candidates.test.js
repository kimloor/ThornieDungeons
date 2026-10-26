const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const qa = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/graphics/g15/QA.json"), "utf8"));

test("G15 approved production icons match recorded dimensions, byte budgets and hashes", () => {
  assert.equal(qa.status, "owner-approved-runtime-integrated-pending-production");
  assert.equal(qa.assets.length, 6);
  const hashes = new Set();
  for (const asset of qa.assets) {
    const file = path.join(ROOT, "r2-upload", asset.proposed_r2_path);
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

test("G15 manifest mapping is additive and complete 6/6", () => {
  assert.equal(qa.checks.owner_approval, "PASS");
  assert.equal(qa.checks.r2_published, false);
  assert.equal(qa.checks.r2_staged, true);
  assert.equal(qa.checks.runtime_integrated, true);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "r2-upload/manifest.json"), "utf8"));
  assert.deepEqual(manifest.assets.infoCenterUi, Object.fromEntries(qa.assets.map(asset => [
    asset.manifest_key.split(".").at(-1), asset.proposed_r2_path
  ])));
  for (const asset of qa.assets) {
    assert.equal(fs.existsSync(path.join(ROOT, "r2-upload", asset.proposed_r2_path)), true);
  }
});

function iconHarness() {
  let state = [], cursor = 0;
  const context = vm.createContext({
    React: { createElement: (type, props, ...children) => ({ type, props: props || {}, children }) },
    useState(initial) {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], value => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    },
    useEffect() {},
    assetUrl: value => `/assets/${value}`,
    INFO_CENTER_VERSION_SEEN_KEY: "test",
    infoLatestVersion: () => "1.1.18"
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src/assets/manifest.js"), "utf8"), context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "src/ui/infoCenter.js"), "utf8"), context);
  context.inputAssets = JSON.parse(fs.readFileSync(path.join(ROOT, "r2-upload/manifest.json"), "utf8")).assets;
  vm.runInContext("ASSETS = inputAssets", context);
  return {
    context,
    render(section) { cursor = 0; return context.InfoCenterSectionIcon({ section }); },
    clear() { state = []; }
  };
}

test("G15 section icons use one optional resolver and fall back once without retry", () => {
  const h = iconHarness();
  const section = { id: "privacy", icon: "🔒" };
  let node = h.render(section);
  assert.equal(node.type, "span");
  assert.equal(node.children[0].type, "img");
  assert.equal(node.children[0].props.src, "/assets/ui/info-center/privacy.png");
  assert.equal(node.children[0].props.alt, "");
  assert.equal(node.children[0].props.width, 128);
  assert.equal(node.children[0].props.height, 128);
  node.children[0].props.onError();
  for (let i = 0; i < 3; i++) {
    node = h.render(section);
    assert.equal(node.children[0], "🔒");
    assert.equal(node.props.className, "md-info-card-icon is-fallback");
  }
  h.clear();
  vm.runInContext("ASSETS = {}", h.context);
  node = h.render({ id: "announcements", icon: "📣" });
  assert.equal(node.children[0], "📣");
  assert.equal(node.props["aria-hidden"], "true");
});
