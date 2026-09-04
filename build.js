#!/usr/bin/env node
// ThornieDungeons build script
// Concatenates the split source modules (in dependency order) back into
// a single index.html, exactly matching the previous single-file structure.
// Run: node build.js

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");

// Order matters: each file is plain global-scope JS (no import/export),
// so later files can reference consts/functions declared in earlier ones.
const MODULE_ORDER = [
  "data/styles.js",
  "state/save.js",
  "assets/loader.js",
  "assets/manifest.js",
  "state/localCache.js",
  "state/configCache.js",
  "state/api.js",
  "data/gameConfig.js",
  "state/serialize.js",
  "data/constants.js",
  "systems/skills.js",
  "systems/pets.js",
  "systems/enhancement.js",
  "systems/potions.js",
  "systems/salvage.js",
  "systems/floorModifier.js",
  "systems/stats.js",
  "systems/shop.js",
  "ui/App.js",
  "ui/components.js",
];

function readModule(relPath) {
  const fullPath = path.join(SRC, relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing module: ${relPath}`);
  }
  return fs.readFileSync(fullPath, "utf8");
}

function build() {
  const head = fs.readFileSync(path.join(ROOT, "head.html"), "utf8");
  const tail = fs.readFileSync(path.join(ROOT, "tail.html"), "utf8");

  const body = MODULE_ORDER.map((m) => {
    const code = readModule(m);
    return `// ===== ${m} =====\n${code}`;
  }).join("\n");

  const output = head + body + "\n" + tail;

  // Basic sanity check: make sure the compiled JS block is syntactically valid.
  const scriptMatch = output.match(/<script>\s*try\s*\{([\s\S]*?)\}\s*catch \(err\) \{/);

  fs.writeFileSync(path.join(ROOT, "index.html"), output, "utf8");
  console.log(`Built index.html (${output.split("\n").length} lines) from ${MODULE_ORDER.length} modules.`);
}

build();
