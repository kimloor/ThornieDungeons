const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const { validateInlineJavaScript } = require(path.join(root, "build.js"));

test("generated index inline JavaScript parses", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.doesNotThrow(() => validateInlineJavaScript(html));
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(match => !/\bsrc\s*=/i.test(match[1]) && match[2].trim());
  assert.ok(scripts.length >= 2);
  scripts.forEach((match, index) => {
    assert.doesNotThrow(() => new vm.Script(match[2], { filename: `test-index-inline-${index + 1}.js` }));
  });
});

test("build syntax guard rejects malformed inline JavaScript", () => {
  assert.throws(
    () => validateInlineJavaScript("<script>React.createElement(</script>"),
    /Generated JavaScript syntax validation failed/
  );
});
