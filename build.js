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
  "state/auth.js",
  "state/api.js",
  "state/persistence.js",
  "data/gameConfig.js",
  "state/serialize.js",
  "data/constants.js",
  "systems/skills.js",
  "systems/heroSkillsV1.js",
  "systems/pets.js",
  "systems/battleMigration.js",
  "systems/battleCore.js",
  "systems/enhancement.js",
  "systems/crafting.js",
  "systems/potions.js",
  "systems/salvage.js",
  "systems/floorModifier.js",
  "systems/stats.js",
  "systems/shop.js",
  "ui/App.js",
  "ui/components.js",
  "ui/battleGuiCompletionPatch.js",
  "ui/resumePreviewPatch.js",
];

function mapR2UiAssetPaths(content) {
  return content.replace(
    /(?<!\/assets\/)ui\/([A-Za-z0-9_.\/-]+\.(?:png|webp|jpg|jpeg|gif|svg))/g,
    "/assets/ui/$1"
  );
}

// Presentation-only Battle V1 patch. Keep these changes out of the combat resolver:
// - show the battlefield/queue for 800ms before the first action can resolve;
// - hide internal battle/round diagnostics from the player-facing log;
// - replace internal unit IDs/UIDs with display names in the player-facing log.
// The replacements are assertion-backed so a future App.js refactor fails the build instead
// of silently dropping the UX behavior.
function patchBattlePresentationSource(content) {
  const replaceOnce = (source, needle, replacement, label) => {
    if (!source.includes(needle)) throw new Error(`Battle presentation patch target missing: ${label}`);
    return source.replace(needle, replacement);
  };

  let patched = content;

  patched = replaceOnce(
    patched,
    "  const [busy, setBusy] = useState(false);\n",
    "  const [busy, setBusy] = useState(false);\n  // Presentation gate only: combat order is already resolved by Battle Core, but the first\n  // action waits briefly so the player can see the battlefield and upcoming queue.\n  const battleIntroUntilRef = useRef(0);\n",
    "battle intro ref"
  );

  patched = replaceOnce(
    patched,
    "  function applyCoreBattleState(next, persistCheckpoint = true) {\n",
    `  function battleLogForUi(entry, state) {\n    if (!entry || entry.type === "battle_start" || entry.type === "round") return "";\n    let text = String(entry.text || "");\n    const units = Object.values(state?.units || {}).sort((a, b) => String(b?.id || "").length - String(a?.id || "").length);\n    units.forEach(unit => {\n      const internalId = String(unit?.id || "");\n      if (!internalId) return;\n      const displayName = unit.kind === "hero" ? "You" : String(unit.name || (unit.kind === "pet" ? "Pet" : "Monster"));\n      text = text.split(internalId).join(displayName);\n    });\n    return text;\n  }\n  function applyCoreBattleState(next, persistCheckpoint = true) {\n`,
    "battle log formatter"
  );

  patched = replaceOnce(
    patched,
    "    const messages = next.log.slice(-3).reverse().map(entry => entry.text);\n",
    "    const messages = next.log.slice().reverse().map(entry => battleLogForUi(entry, next)).filter(Boolean).slice(0, 3);\n",
    "player-facing battle log"
  );

  patched = replaceOnce(
    patched,
    "    if (busy || !battleStateRef.current) return;\n",
    "    if (busy || Date.now() < battleIntroUntilRef.current || !battleStateRef.current) return;\n",
    "hero input intro guard"
  );

  patched = replaceOnce(
    patched,
    "    criticalAssets.ready.finally(() => {\n      setPhase(\"combat\");\n      setTimeout(() => driveCoreBattle(initialBattle), 0);\n",
    "    criticalAssets.ready.finally(() => {\n      setPhase(\"combat\");\n      battleIntroUntilRef.current = Date.now() + 800;\n      setTimeout(() => driveCoreBattle(initialBattle), 800);\n",
    "first action delay"
  );

  return patched;
}

function readModule(relPath) {
  const fullPath = path.join(SRC, relPath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing module: ${relPath}`);
  let content = fs.readFileSync(fullPath, "utf8");
  if (relPath === "ui/App.js") content = patchBattlePresentationSource(content);
  return content;
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
