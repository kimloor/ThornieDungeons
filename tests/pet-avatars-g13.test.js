const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const manifest = JSON.parse(read("r2-upload/manifest.json"));
const qa = JSON.parse(read("docs/graphics/g13/QA.json"));

function harness() {
  let slots = [], cursor = 0;
  const context = vm.createContext({
    React: { Component: class {}, createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
      useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }]; },
      useEffect() {} },
    assetUrl: value => `/assets/${value}`
  });
  for (const file of ["src/assets/manifest.js", "src/systems/pets.js", "src/ui/components.js"]) vm.runInContext(read(file), context);
  context.inputManifest = manifest.assets;
  vm.runInContext("ASSETS = inputManifest", context);
  return { context, render: (fn, props) => { cursor = 0; return context[fn](props); }, reset: () => { slots = []; } };
}
function flatten(node) {
  if (!node || typeof node !== "object") return [node];
  if (Array.isArray(node)) return node.flatMap(flatten);
  return [node, ...node.children.flatMap(flatten)];
}

test("eight catalog IDs map to approved, budget-compliant RGBA PNG bytes", () => {
  const { context } = harness();
  const ids = vm.runInContext("PET_POOL.map(p => p.id)", context);
  assert.deepEqual(Object.keys(manifest.assets.petAvatars).sort(), Array.from(ids).sort());
  const hashes = new Set();
  for (const row of qa) {
    assert.equal(manifest.assets.petAvatars[row.id], `ui/pet-avatars/${row.id}.png`);
    const buffer = fs.readFileSync(path.join(root, "r2-upload", row.r2_path));
    assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"), row.sha256);
    assert.equal(buffer.length, row.bytes);
    assert.ok(buffer.length <= 120000);
    assert.equal(buffer.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(buffer.readUInt32BE(16), 256);
    assert.equal(buffer.readUInt32BE(20), 256);
    assert.equal(buffer[24], 8);
    assert.equal(buffer[25], 6); // RGBA, not a background baked into RGB.
    const chunks = [];
    for (let offset = 8; offset < buffer.length;) {
      const size = buffer.readUInt32BE(offset), type = buffer.toString("ascii", offset + 4, offset + 8);
      if (type === "IDAT") chunks.push(buffer.subarray(offset + 8, offset + 8 + size));
      offset += size + 12;
    }
    assert.equal(zlib.inflateSync(Buffer.concat(chunks)).length, 256 * (256 * 4 + 1));
    hashes.add(row.sha256);
  }
  assert.equal(hashes.size, 8);
});

test("resolver uses definition IDs and handles absent/invalid manifest entries safely", () => {
  const { context } = harness();
  for (const row of qa) assert.equal(context.petAvatarUrl(row.id), `/assets/${row.r2_path}`);
  for (const id of [undefined, null, "", "sprout001", "pet-instance-123", "sprout.foo", "../sprout", "unknown"]) assert.equal(context.petAvatarUrl(id), "");
  vm.runInContext("ASSETS = {}", context);
  assert.equal(context.petAvatarUrl("sprout"), "");
  vm.runInContext("ASSETS = {petAvatars:{sprout:{path:'not-a-string'}}}", context);
  assert.equal(context.petAvatarUrl("sprout"), "");
});

test("broken image falls back once; another Pet can load without retrying the failed URL", () => {
  const h = harness();
  let node = h.render("PetAvatar", { defId: "sprout" });
  assert.equal(node.type, "img");
  node.props.onError();
  for (let i = 0; i < 3; i++) {
    node = h.render("PetAvatar", { defId: "sprout" });
    assert.equal(node.type, "span");
    assert.equal(node.children[0], "🌱");
    assert.equal(node.props.onError, undefined);
  }
  assert.equal(h.render("PetAvatar", { defId: "moon_hare" }).type, "img");
  assert.equal(h.render("PetAvatar", { defId: "instance-only" }).children[0], "🐾");
  assert.equal(h.render("PetAvatar", {}).children[0], "🐾");
});

test("missing avatars keep catalog emoji and decorative accessibility semantics", () => {
  const h = harness();
  vm.runInContext("ASSETS = {}", h.context);
  for (const row of qa) {
    h.reset();
    const node = h.render("PetAvatar", { defId: row.id, alt: "" });
    h.context.id = row.id;
    assert.equal(node.children[0], vm.runInContext("getPetDef(id).icon", h.context));
    assert.equal(node.props["aria-hidden"], "true");
  }
});

test("roster avatars use defId while selection retains the exact instance ID", () => {
  const h = harness(); let selected;
  const node = h.context.PetRoster({ owned: [{ defId: "sprout", instId: "instance-xyz", level: 7, star: 2 }], activePetId: "instance-xyz", selectedPetId: "instance-xyz", petDuplicates: {}, onSelect: id => { selected = id; } });
  const nodes = flatten(node);
  assert.equal(nodes.find(n => n?.type === h.context.PetAvatar).props.defId, "sprout");
  nodes.find(n => n?.type === "button").props.onClick();
  assert.equal(selected, "instance-xyz");
  assert.ok(nodes.includes(7));
});

test("detail and Arena portrait consumers share the component without replacing battle actors", () => {
  const source = read("src/ui/components.js");
  const detail = source.slice(source.indexOf("function PetScreen"), source.indexOf("function GachaScreen"));
  assert.match(detail, /PetAvatar, \{ defId: selected\.defId/);
  assert.match(detail, /React\.createElement\(AnimatedFrameSprite/);
  const setup = source.slice(source.indexOf('tab === "setup"'), source.indexOf('tab === "ranking"'));
  assert.match(setup, /React\.createElement\("details"/);
  assert.match(setup, /PetAvatar, \{ defId: p\.defId/);
  assert.match(setup, /setSetup\(\{ \.\.\.setup, petInstId: p\.instId \}\)/);
  assert.match(setup, /"Lv\."/);
  const card = source.slice(source.indexOf("function ArenaPlayerCardOverlay"), source.indexOf("const ArenaV2ErrorBoundary"));
  assert.match(card, /PetAvatar, \{ defId: card\.pet\?\.defId/);
  const combat = source.slice(source.indexOf("function PetCombatSprite"), source.indexOf("function turnOrderUnitAlive"));
  assert.doesNotMatch(combat, /PetAvatar|petAvatarUrl/);
});
