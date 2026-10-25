const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function bootScript() {
  const head = fs.readFileSync(path.join(__dirname, "..", "head.html"), "utf8");
  const start = head.indexOf("<script>\n  // Runtime errors are queued");
  assert.ok(start >= 0, "boot error script present");
  return head.slice(start + "<script>".length, head.indexOf("</script>", start));
}

function load() {
  const window = { addEventListener() {} };
  vm.runInNewContext(bootScript(), { window, setTimeout: () => 0, clearTimeout() {}, Date, String, Number, Error, React: undefined });
  return window;
}

test("opaque cross-origin \"Script error.\" events are not shown as a game crash", () => {
  const w = load();
  const reported = [];
  w.__thornieReportRuntimeError = detail => reported.push(detail);
  w.__thornieCaptureRuntimeError("window_error", "Script error.", null, "", 0, 0);
  assert.equal(w.__thornieRuntimeQueue.length, 0);
  assert.equal(reported.length, 0);
  assert.equal(w.__thornieOpaqueScriptErrors, 1);
});

test("real game errors (with file/line or a message) are still reported", () => {
  const w = load();
  const reported = [];
  w.__thornieReportRuntimeError = detail => reported.push(detail);
  w.__thornieCaptureRuntimeError("window_error", "x is not defined", new Error("x is not defined"), "https://example.test/", 120, 4);
  w.__thornieCaptureRuntimeError("window_error", "Script error.", null, "https://example.test/", 0, 0);
  w.__thornieCaptureRuntimeError("window_error", "Script error.", null, "", 55, 3);
  w.__thornieCaptureRuntimeError("unhandled_rejection", "Script error.", null);
  assert.equal(reported.length, 4);
  assert.equal(w.__thornieRuntimeQueue.length, 4);
});
