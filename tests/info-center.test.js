const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { INFO_CENTER, infoFindSection, infoResolveRoute, infoLatestVersion } = require("../src/data/infoCenter.js");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

function allStrings(value, out = []) {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach(item => allStrings(item, out));
  else if (value && typeof value === "object") Object.values(value).forEach(item => allStrings(item, out));
  return out;
}

test("sections: unique ids, valid groups and kinds, required fields", () => {
  const ids = INFO_CENTER.sections.map(section => section.id);
  assert.equal(new Set(ids).size, ids.length);
  const groups = new Set(INFO_CENTER.groups.map(group => group.id));
  ["announcements", "guide", "terms", "privacy", "fairplay", "purchase", "account", "support", "credits"].forEach(id => assert.ok(ids.includes(id), id));
  INFO_CENTER.sections.forEach(section => {
    assert.ok(groups.has(section.group), section.id);
    assert.ok(["announcements", "document", "reserved"].includes(section.kind), section.id);
    assert.ok(section.title && section.subtitle && section.icon, section.id);
    if (section.kind === "document") {
      assert.match(section.version, /^\d+\.\d+$/);
      assert.match(section.effectiveDate, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(section.lastUpdated, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(section.blocks.length >= 3 && section.blocks.every(block => block.heading && block.body.length));
    }
    if (section.kind === "reserved") assert.ok(section.reservedText, section.id);
  });
  INFO_CENTER.groups.forEach(group => assert.ok(INFO_CENTER.sections.some(section => section.group === group.id), group.id));
});

test("Support, Account & Data, Credits and Guide are reserved areas without details", () => {
  ["guide", "account", "support", "credits"].forEach(id => assert.equal(infoFindSection(id).kind, "reserved"));
});

test("policy documents stay drafts until the Legal & Policy Gate and never enable real-money checkout", () => {
  ["terms", "privacy", "fairplay", "purchase"].forEach(id => assert.equal(infoFindSection(id).status, "draft", id));
  const purchase = allStrings(infoFindSection("purchase")).join("\n");
  assert.match(purchase, /ยังไม่เปิดให้ชำระเงินจริง/);
});

test("deep links resolve sections and fall back safely", () => {
  assert.deepEqual(infoResolveRoute("terms"), { sectionId: "terms", topicId: "" });
  assert.deepEqual(infoResolveRoute("guide/drops"), { sectionId: "guide", topicId: "" }, "unknown topic keeps the section");
  assert.equal(infoResolveRoute("nope"), null);
  assert.equal(infoResolveRoute(""), null);
  assert.equal(infoResolveRoute(undefined), null);
});

test("announcements: latest matches the visible version; history is unique and newest first", () => {
  const styles = read("src/data/styles.js");
  assert.ok(styles.includes(`content: "Ver ${infoLatestVersion()}"`), "latest announcement must match the Ver badge");
  const versions = INFO_CENTER.announcements.history.map(entry => entry.version);
  assert.equal(new Set(versions).size, versions.length);
  const key = v => v.split(/[–-]/).pop().split(".").map(Number);
  for (let i = 1; i < versions.length; i++) {
    const [a, b, c] = key(versions[i - 1]);
    const [x, y, z] = key(versions[i]);
    assert.ok(a * 1e6 + b * 1e3 + c > x * 1e6 + y * 1e3 + z, `${versions[i - 1]} before ${versions[i]}`);
  }
  INFO_CENTER.announcements.history.forEach(entry => assert.ok(entry.title && entry.date && entry.items.length, entry.version));
});

test("roadmap uses player-readable states and promises no dates", () => {
  const labels = INFO_CENTER.announcements.statusLabels;
  INFO_CENTER.announcements.roadmap.forEach(item => {
    assert.ok(labels[item.status], item.title);
    assert.doesNotMatch(item.title + item.note, /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4}/);
  });
});

test("public-information boundary: no internal security / QA / infrastructure details", () => {
  const text = allStrings([INFO_CENTER.sections, INFO_CENTER.announcements]).join("\n");
  [/anti-?cheat/i, /exploit/i, /pbkdf/i, /\bsalt/i, /\bhash/i, /\btoken/i, /validation/i, /migration/i, /\bD1\b/, /\bQA\b/, /\bGate\b/, /receipt/i, /requestId/i, /secret/i, /admin/i]
    .forEach(pattern => assert.doesNotMatch(text, pattern, String(pattern)));
});

test("UI wiring: Settings opens the separate Information Center page; storage access is guarded", () => {
  const comps = read("src/ui/components.js");
  const ui = read("src/ui/infoCenter.js");
  assert.match(comps, /InfoCenterScreen, \{ onClose: \(\) => setInfoOpen\(false\) \}/);
  assert.match(comps, /\(\) => setInfoOpen\(true\)/);
  assert.match(ui, /function InfoCenterScreen\(\{ initialRoute, onClose \}\)/);
  assert.match(ui, /infoResolveRoute\(initialRoute\)/);
  assert.match(ui, /try \{ return window\.localStorage/);
  assert.match(ui, /try \{ window\.localStorage/);
  const build = read("build.js");
  assert.ok(build.indexOf('"data/infoCenter.js"') > -1 && build.indexOf('"ui/infoCenter.js"') < build.indexOf('"ui/components.js"'));
  assert.match(read("index.html"), /function InfoCenterScreen/);
});
