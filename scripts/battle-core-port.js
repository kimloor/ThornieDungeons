"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SOURCE_PATH = path.join(ROOT, "src", "systems", "battleCore.js");
const WORKER_PATH = path.join(ROOT, "workers", "thornie-dungeons-api.js");

const PORT_START = "// ===== ported: src/systems/battleCore.js =====\n";
const PORT_END = "\n// ---------- Phase 5: PvP Arena orchestration ----------";

function countOccurrences(text, needle) {
  let count = 0;
  let from = 0;
  while (true) {
    const index = text.indexOf(needle, from);
    if (index < 0) return count;
    count += 1;
    from = index + needle.length;
  }
}

function locatePort(workerText) {
  const startCount = countOccurrences(workerText, PORT_START);
  const endCount = countOccurrences(workerText, PORT_END);
  if (startCount !== 1 || endCount !== 1) {
    throw new Error(
      `Battle Core port markers must be unique (start=${startCount}, end=${endCount}).`
    );
  }

  const start = workerText.indexOf(PORT_START) + PORT_START.length;
  const end = workerText.indexOf(PORT_END, start);
  if (end < start) throw new Error("Battle Core port end marker appears before the embedded source.");
  return { start, end };
}

function extractEmbeddedBattleCore(workerText) {
  const { start, end } = locatePort(workerText);
  return workerText.slice(start, end);
}

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) index += 1;
  if (index === left.length && index === right.length) return null;

  const prefix = left.slice(0, index);
  const line = prefix.split("\n").length;
  const lastBreak = prefix.lastIndexOf("\n");
  const column = index - lastBreak;
  return {
    index,
    line,
    column,
    sourceChar: left[index],
    embeddedChar: right[index]
  };
}

function assertBattleCoreParity(sourceText, workerText) {
  const embedded = extractEmbeddedBattleCore(workerText);
  if (sourceText === embedded) return true;

  const diff = firstDifference(sourceText, embedded);
  const location = diff ? ` at line ${diff.line}, column ${diff.column}` : "";
  throw new Error(
    "Battle Core parity check failed" + location +
    ". src/systems/battleCore.js and the Worker embedded copy differ. " +
    "Run: node scripts/battle-core-port.js --sync"
  );
}

function syncBattleCoreText(sourceText, workerText) {
  const { start, end } = locatePort(workerText);
  return workerText.slice(0, start) + sourceText + workerText.slice(end);
}

function runCli() {
  const args = process.argv.slice(2);
  const mode = args.length === 0 ? "--check" : args[0];
  if (args.length > 1 || !["--check", "--sync"].includes(mode)) {
    throw new Error("Usage: node scripts/battle-core-port.js [--check|--sync]");
  }

  const sourceText = fs.readFileSync(SOURCE_PATH, "utf8");
  let workerText = fs.readFileSync(WORKER_PATH, "utf8");

  if (mode === "--sync") {
    const synced = syncBattleCoreText(sourceText, workerText);
    if (synced !== workerText) {
      fs.writeFileSync(WORKER_PATH, synced, "utf8");
      workerText = synced;
      console.log("Synced Battle Core into workers/thornie-dungeons-api.js.");
    } else {
      console.log("Battle Core Worker copy already matches source.");
    }
  }

  assertBattleCoreParity(sourceText, workerText);
  console.log("Battle Core parity: PASS");
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exitCode = 1;
  }
}

module.exports = {
  PORT_START,
  PORT_END,
  locatePort,
  extractEmbeddedBattleCore,
  firstDifference,
  assertBattleCoreParity,
  syncBattleCoreText
};
