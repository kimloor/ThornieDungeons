const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(ROOT, relative), "utf8");

test("G12 covers every authoritative Hero skill with a budget-compliant 256px PNG", () => {
  const manifest = JSON.parse(read("r2-upload/manifest.json"));
  const { HERO_SKILLS_V1 } = require("../src/systems/heroSkillsV1.js");
  const icons = manifest.assets.heroSkillIcons;
  assert.deepEqual(Object.keys(icons).sort(), HERO_SKILLS_V1.map(skill => skill.id).sort());
  for (const skill of HERO_SKILLS_V1) {
    const manifestPath = icons[skill.id];
    assert.match(manifestPath, new RegExp(`^ui/skill-icons/hero/${skill.id}\\.png\\?v=g12_r1$`));
    const file = path.join(ROOT, "r2-upload", manifestPath.split("?")[0]);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.subarray(1, 4).toString(), "PNG");
    assert.equal(bytes.readUInt32BE(16), 256);
    assert.equal(bytes.readUInt32BE(20), 256);
    assert.ok(bytes.length <= 120 * 1024, `${skill.id} exceeds the G10.5 target`);
    assert.equal(bytes.subarray(-8, -4).toString(), "IEND");
  }
});

test("G12 uses one safe manifest resolver across all four required surfaces", () => {
  const assets = read("src/assets/manifest.js");
  const ui = read("src/ui/components.js");
  const skills = read("src/systems/heroSkillsV1.js");
  assert.match(assets, /function resolveHeroSkillIconPath/);
  assert.match(assets, /function resolveHeroSkillIconUrl/);
  assert.match(assets, /function HeroSkillIcon/);
  assert.match(assets, /failedSrc === src/);
  assert.doesNotMatch(skills, /const icons = \{ power_strike/);

  const requiredBindings = [
    /className: "md-skill-upgrade-icon"[\s\S]{0,240}HeroSkillIcon/,
    /md-quickslot-skill-icon/,
    /md-arena-skill-setup-slot/,
    /md-arena-skill-control/
  ];
  requiredBindings.forEach(pattern => assert.match(ui, pattern));
});
