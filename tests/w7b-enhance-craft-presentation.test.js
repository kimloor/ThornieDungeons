const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = rel => fs.readFileSync(path.join(root, rel), "utf8");

test("W7B build includes one shared forge presentation stack", () => {
  const build = read("build.js");
  for (const file of [
    "phaser/scenes/ForgePresentationScene.js",
    "phaser/runtime/ForgePresentationHost.js",
    "phaser/ui/PhaserForgePresentation.js"
  ]) assert.equal(build.includes(file), true);
});

test("Forge presentation scene is presentation-only and reuses shared queue/VFX", () => {
  const scene = read("src/phaser/scenes/ForgePresentationScene.js");
  assert.equal(scene.includes("createPresentationQueue({ onError })"), true);
  assert.equal(scene.includes("createVfxManager(this)"), true);
  assert.equal(scene.includes("playResolvedEvent(event, speed = 1)"), true);
  for (const forbidden of ["cloudCraftItem", "cloudMutate", "fetch(", "mutationStatements", "rewardReceipts"]) assert.equal(scene.includes(forbidden), false);
});

test("Refine presentation is triggered only from resolved authoritative mutation output", () => {
  const app = read("src/ui/App.js");
  const components = read("src/ui/components.js");
  assert.equal(app.includes("const result = res.mutation || {};"), true);
  assert.equal(app.includes("return { ok: true, result, message:"), true);
  assert.equal(app.includes("return { ok: false, result, message:"), true);
  const enhanceCall = components.indexOf("const res = await Promise.resolve(onEnhance(detailTarget.id, useProtectionStone));");
  const presentation = components.indexOf("setForgePresentation({", enhanceCall);
  assert.ok(enhanceCall >= 0 && presentation > enhanceCall);
  assert.equal(components.includes("outcome: result.success ? \"success\" : result.protectionConsumed ? \"protected\" : result.downgraded ? \"downgrade\" : \"fail\""), true);
  assert.equal(components.includes("playAnim(res.ok && !!res?.result)"), true);
});

test("Craft reveal starts only after successful server craft and authoritative hydration", () => {
  const components = read("src/ui/components.js");
  const craftCall = components.indexOf("cloudCraftItem(");
  const successGuard = components.indexOf("if (!res || res.error)", craftCall);
  const hydrated = components.indexOf("onCrafted(res);", successGuard);
  const reveal = components.indexOf("setCraftPresentation({", hydrated);
  assert.ok(craftCall >= 0 && successGuard > craftCall && hydrated > successGuard && reveal > hydrated);
  assert.equal(components.includes("kind: \"craft\""), true);
  assert.equal(components.includes("PhaserForgePresentation, { event: craftPresentation }"), true);
});

test("Summoning remains outside W7B presentation implementation", () => {
  const source = read("src/phaser/scenes/ForgePresentationScene.js") + read("src/phaser/runtime/ForgePresentationHost.js");
  assert.equal(/summon|gacha|portal/i.test(source), false);
});

test("Forge presentation uses Refine labels and mobile-safe outcome text", () => {
  const scene = read("src/phaser/scenes/ForgePresentationScene.js");
  assert.match(scene, /REFINE SUCCESS/);
  assert.match(scene, /REFINE FAILED/);
  assert.doesNotMatch(scene, /ENHANCE SUCCESS|ENHANCE FAILED/);
  assert.match(scene, /wordWrap: \{ width: Math\.max\(140, width - 20\)/);
});
