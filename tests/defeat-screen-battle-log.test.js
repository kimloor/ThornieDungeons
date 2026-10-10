"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "App.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "src", "ui", "components.js"), "utf8");

function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next < 0 ? undefined : next);
}

test("DefeatScreen receives and renders the full battle log like ResultScreen", () => {
  const defeat = functionBody(components, "DefeatScreen");
  assert.match(defeat, /battleLog/);
  assert.match(defeat, /BattleLogPanel/);
  assert.match(defeat, /entries:\s*battleLog/);
  assert.match(app, /DefeatScreen,\s*\{\s*floor:\s*selectedFloor,\s*battleLog:\s*finishedBattleLog/);
  // ResultScreen behavior stays unchanged.
  assert.match(functionBody(components, "ResultScreen"), /BattleLogPanel/);
});

test("finished battle log is captured for every terminal result, including Skip and defeat", () => {
  const finish = functionBody(app.replace(/\n  async function finishCoreBattle/, "\nfunction finishCoreBattle"), "finishCoreBattle");
  const logIndex = finish.indexOf("setFinishedBattleLog(next.log");
  const presentationIndex = finish.indexOf("if (plan.runPresentation)");
  assert.ok(logIndex >= 0, "log is captured in finishCoreBattle");
  assert.ok(logIndex < presentationIndex, "log is captured before the presentation-only branch");
});
