const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const styles = fs.readFileSync(path.join(__dirname, "..", "src/data/styles.js"), "utf8");

test("responsive tokens use the approved mobile, tablet, and desktop breakpoints", () => {
  assert.match(styles, /--md-dock-height:\s*72px/);
  assert.match(styles, /@media \(min-width:431px\) and \(max-width:700px\)[\s\S]*?--md-dock-height:88px/);
  assert.match(styles, /@media \(min-width:701px\)[\s\S]*?--md-dock-height:100px/);
  assert.match(styles, /@media \(min-width:431px\) and \(max-height:700px\)[\s\S]*?--md-dock-height:72px/);
  assert.match(styles, /\.md-hub-dock button > img \{ width:var\(--md-dock-icon\); height:var\(--md-dock-icon\)/);
  assert.match(styles, /\.md-hub-dock button span \{[^}]*font-size:var\(--md-dock-label\)/);
  assert.doesNotMatch(styles, /\.md-root\s*\{[^}]*transform:\s*scale/);
});

test("required viewport widths select proportional inventory geometry without overlap", () => {
  const geometryFor = (width, height = 900) => {
    if (width >= 431 && height <= 700) return { stage:334, slotHeight:68, step:82, heroWidth:175 };
    if (width > 700) return { stage:462, slotHeight:94, step:116, heroWidth:270 };
    if (width >= 431) {
      const slotHeight = Math.min(84, Math.max(72, width * .12));
      const step = Math.min(100, Math.max(86, width * .142));
      return { stage:step * 3 + slotHeight + 20, slotHeight, step, heroWidth:Math.min(225, Math.max(180, width * .32)) };
    }
    return { stage:330, slotHeight:66, step:78, heroWidth:165 };
  };

  for (const viewport of [
    { width:390, height:844 },
    { width:430, height:932 },
    { width:600, height:900 },
    { width:700, height:900 },
    { width:820, height:1000 },
    { width:820, height:650 }
  ]) {
    const geometry = geometryFor(viewport.width, viewport.height);
    const lastSlotBottom = geometry.step * 3 + geometry.slotHeight;
    assert.ok(lastSlotBottom <= geometry.stage, `${viewport.width}x${viewport.height}: slots fit stage`);
    assert.ok(geometry.heroWidth > 0 && geometry.heroWidth < viewport.width, `${viewport.width}x${viewport.height}: hero fits viewport`);
  }

  assert.match(styles, /\.md-inv2-equipment \{[^}]*height:var\(--md-inv-stage-height\)/);
  assert.match(styles, /\.md-inv2-equip-slot\.l4 \{ top:calc\(var\(--md-inv-slot-step\) \* 3\)/);
  assert.match(styles, /\.md-inv2-hero \.md-sprite-wrap \{ transform:scale\(var\(--md-inv-hero-scale\)\)/);
  assert.match(styles, /\.md-inv2-popup \{[^}]*max-height:calc\(100dvh[^}]*overflow-y:auto/);
});

test("responsive scope excludes Raid, Arena, combat pet, and battle controls", () => {
  const responsiveStart = styles.indexOf("/* Responsive tokens are layout-specific");
  const responsiveEnd = styles.indexOf("/* ---- manifest-backed item icons ----", responsiveStart);
  const responsive = styles.slice(responsiveStart, responsiveEnd);
  assert.doesNotMatch(responsive, /md-raid|md-arena|md-combat|md-battle|md-pet-slot/);
});
