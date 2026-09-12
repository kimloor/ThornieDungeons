#!/usr/bin/env node
// ThornieDungeons build script
// Concatenates split source modules (dependency order) into index.html.
// Run: node build.js

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "src");

const MODULE_ORDER = [
  "data/styles.js",
  "state/save.js",
  "assets/loader.js",
  "assets/manifest.js",
  "state/localCache.js",
  "state/configCache.js",
  "state/api.js",
  "state/persistence.js",
  "data/gameConfig.js",
  "state/serialize.js",
  "data/constants.js",
  "systems/skills.js",
  "systems/pets.js",
  "systems/enhancement.js",
  "systems/crafting.js",
  "systems/potions.js",
  "systems/salvage.js",
  "systems/floorModifier.js",
  "systems/stats.js",
  "systems/shop.js",
  "ui/App.js",
  "ui/components.js",
];

function mapR2UiAssetPaths(content) {
  return content.replace(
    /(?<!\/assets\/)ui\/([A-Za-z0-9_.\/-]+\.(?:png|webp|jpg|jpeg|gif|svg))/g,
    "/assets/ui/$1"
  );
}

function readModule(relPath) {
  const fullPath = path.join(SRC, relPath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing module: ${relPath}`);
  return fs.readFileSync(fullPath, "utf8");
}

function build() {
  const head = fs.readFileSync(path.join(ROOT, "head.html"), "utf8");
  const tail = fs.readFileSync(path.join(ROOT, "tail.html"), "utf8");
  const body = MODULE_ORDER.map((m) => `// ===== ${m} =====\n${readModule(m)}`).join("\n");
  const output = mapR2UiAssetPaths(head + body + "\n" + tail);

  fs.writeFileSync(path.join(ROOT, "index.html"), output, "utf8");
  console.log(`Built index.html (${output.split("\n").length} lines) from ${MODULE_ORDER.length} modules.`);
}

build();
