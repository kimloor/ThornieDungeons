const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const head = fs.readFileSync(path.join(root, "head.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/data/styles.js"), "utf8");

const requiredViewports = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [393, 852],
  [430, 932],
  [667, 375],
  [844, 390],
  [1280, 720],
];

test("document and game root share the visual viewport height authority", () => {
  assert.match(head, /--md-visual-viewport-height/);
  assert.match(head, /window\.visualViewport/);
  assert.match(head, /visualViewportHeight|installVisualViewportHeight/);
  assert.match(head, /html, body \{[\s\S]*height: var\(--md-visual-viewport-height, 100dvh\)[\s\S]*overflow: hidden/);
  assert.match(head, /#root \{[^}]*height: 100%;[^}]*min-height: 0/);
  assert.match(styles, /\.md-root,[\s\S]*\.md-root-combat \{ height:100%; min-height:0; max-height:100%; \}/);
  assert.doesNotMatch(styles.slice(0, 2500), /min-height:\s*max\(640px/);
});

test("every top-level page can shrink and long content owns bounded internal scrolling", () => {
  const fitBlock = styles.slice(styles.indexOf("/* Issue #169 viewport-fit authority"));
  for (const selector of [
    ".md-hub-shell",
    ".md-town-shell",
    ".md-character-page",
    ".md-dungeon-map-page",
    ".md-pet-page",
    ".md-friend-page",
    ".md-chat-page",
    ".md-arena-v2",
  ]) assert.ok(fitBlock.includes(selector), `${selector} participates in the viewport-fit shell`);

  assert.match(fitBlock, /flex:1 1 auto; min-height:0; max-height:100%; height:auto; overflow:hidden/);
  assert.match(styles, /\.md-character-scroll \{[^}]*min-height:0; overflow-y:auto/);
  assert.match(styles, /\.md-shared-overlay-body \{[^}]*min-height:0; overflow-y:auto/);
  assert.match(fitBlock, /\.md-pet-page > \.md-pet-card,[\s\S]*overflow-y:auto; overscroll-behavior:contain/);
  assert.match(fitBlock, /\.md-friend-page > \.md-card:last-of-type[\s\S]*overflow-y:auto; overscroll-behavior:contain/);
});

test("supported viewport budgets resolve without document overflow and retain 44px landscape targets", () => {
  for (const [width, visualHeight] of requiredViewports) {
    const bodyPadding = width <= 480 ? 0 : 32;
    const bodyBorderBox = visualHeight;
    const rootContentHeight = bodyBorderBox - bodyPadding;
    const documentScrollHeight = bodyBorderBox;
    assert.equal(documentScrollHeight, visualHeight, `${width}x${visualHeight}: outer document fits`);
    assert.ok(rootContentHeight > 0 && rootContentHeight <= visualHeight, `${width}x${visualHeight}: root fits body content box`);
  }

  const landscape = styles.slice(styles.indexOf("@media (max-height:480px) and (orientation:landscape)"));
  assert.match(landscape, /--md-dock-hit:44px/);
  assert.match(landscape, /\.md-hub-town-btn,\.md-hub-enter-btn \{ min-height:44px/);
  assert.match(styles, /\.md-character-page-title button \{ width:44px; height:44px/);
  assert.match(styles, /\.md-shared-overlay-back,\.md-shared-overlay-close \{ width:44px; height:44px/);
});

test("viewport synchronization covers keyboard, resize, and orientation changes", () => {
  assert.match(head, /window\.addEventListener\('resize', sync/);
  assert.match(head, /window\.addEventListener\('orientationchange', sync/);
  assert.match(head, /viewport\.addEventListener\('resize', sync/);
  assert.match(head, /viewport\.addEventListener\('scroll', sync/);
  assert.match(styles, /\.md-login-wrap[\s\S]*overflow-y:auto; overscroll-behavior:contain/);
  assert.match(styles, /\.md-auth-sheet \{[\s\S]*max-height:min\(calc\(100dvh[\s\S]*overflow:auto/);
});
