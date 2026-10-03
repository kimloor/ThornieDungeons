const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflow = fs.readFileSync(
  path.join(__dirname, "../.github/workflows/cleanup-branches.yml"),
  "utf8"
);

test("branch cleanup evaluates main pushes and only applicable release gates", () => {
  assert.match(workflow, /on:\n\s+push:\n\s+branches:\n\s+- main/);
  assert.match(workflow, /actions: read/);
  assert.match(workflow, /github\.event_name != 'workflow_dispatch'/);
  assert.match(workflow, /repos\/\$REPO\/commits\/\$sha/);

  assert.match(
    workflow,
    /index\.html\|admin\.html\|worker\.js\|wrangler\.jsonc\|\.github\/workflows\/deploy-frontend-production\.yml/
  );
  assert.match(
    workflow,
    /workers\/thornie-dungeons-api\.js\|workers\/thornie-dungeons-api-entry\.js\|wrangler\.api\.template\.jsonc\|\.github\/workflows\/deploy-api\.yml\|migrations\/auto\/\*\.sql/
  );
  assert.match(workflow, /src\/systems\/battleCore\.js/);
  assert.match(workflow, /docs\/ARENA-V2-W9-IMPLEMENTATION-ROADMAP\.md/);

  assert.match(workflow, /Gate not applicable: \$workflow/);
  assert.match(workflow, /Gate pending\/not successful yet: \$workflow/);
  assert.match(workflow, /echo "ready=true" >> "\$GITHUB_OUTPUT"/);
  assert.match(
    workflow,
    /steps\.gates\.outputs\.current == 'true' && steps\.gates\.outputs\.ready == 'true'/
  );
});

test("branch cleanup still permanently protects ops branch", () => {
  assert.match(workflow, /name" = "ops\/branch-cleanup"/);
  assert.match(workflow, /skip: permanent cleanup ops branch/);
});
