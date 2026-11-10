const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflowPath = path.resolve(__dirname, "../.github/workflows/p0-isolated-staging-deploy.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

test("P0 staging deployment is manual-only and pins the approved PR #186 source", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /APPROVED_SOURCE_SHA: d128b96f3a652325de77592b3f5a859ad319dc5b/);
  assert.match(workflow, /ref: d128b96f3a652325de77592b3f5a859ad319dc5b/);
  assert.match(workflow, /refs\/pull\/186\/head/);
  assert.match(workflow, /test "\$\(git rev-parse refs\/remotes\/origin\/pr-186\)" = "\$APPROVED_SOURCE_SHA"/);
});

test("P0 staging deployment uses only dedicated staging credentials and D1", () => {
  assert.match(workflow, /secrets\.CF_STAGING_API_TOKEN/);
  assert.match(workflow, /secrets\.CF_STAGING_ACCOUNT_ID/);
  assert.doesNotMatch(workflow, /secrets\.CF_API_TOKEN/);
  assert.doesNotMatch(workflow, /secrets\.CF_ACCOUNT_ID/);
  assert.match(workflow, /STAGING_DB_NAME: thornie-dungeons-staging/);
  assert.match(workflow, /STAGING_DB_ID: c16e0b11-cf83-468c-a533-0ecbf522082f/);
  assert.match(workflow, /PRODUCTION_DB_ID: 2f6d52b4-3de7-4e78-98d4-fc143a4d29e2/);
  assert.match(workflow, /\.d1_databases \| length == 1/);
  assert.match(workflow, /\.d1_databases\[0\]\.binding == "DB"/);
  assert.match(workflow, /has\("routes"\) \| not/);
  assert.match(workflow, /has\("triggers"\) \| not/);
  assert.match(workflow, /has\("vars"\) \| not/);
});

test("P0 staging deployment verifies migration and schema but never applies migrations", () => {
  assert.match(workflow, /SELECT COUNT\(\*\) AS n FROM d1_migrations WHERE name='0031_battle_authority_v1\.sql'/);
  assert.match(workflow, /pragma_table_info\('battle_authority'\)/);
  assert.match(workflow, /PRAGMA foreign_key_check/);
  assert.doesNotMatch(workflow, /d1 migrations apply/);
});

test("P0 staging deployment targets only the isolated Worker and verifies remote state", () => {
  assert.match(workflow, /WORKER_NAME: thornie-dungeons-p0-staging/);
  assert.match(workflow, /--strict/);
  assert.match(workflow, /--tag "\$APPROVED_SOURCE_SHA"/);
  assert.match(workflow, /\.result\.bindings \| length == 1/);
  assert.match(workflow, /\.result\.annotations\["workers\/tag"\] == \$sha/);
  assert.match(workflow, /workers\/scripts\/\$WORKER_NAME\/schedules/);
  assert.doesNotMatch(workflow, /wrangler delete|d1 delete|d1 export|--keep-vars|--force/);
});
