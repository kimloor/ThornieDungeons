const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const workflow = fs.readFileSync(path.resolve(__dirname, "../.github/workflows/p0-rollback-fault-staging-deploy.yml"), "utf8");

test("rollback workflow is manual-only, QA source pinned and isolated from release", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  (push|pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /APPROVED_SOURCE_SHA: 5f78f5c8aeb8c32c912e4677c3a4a806be76ab1d/);
  assert.match(workflow, /refs\/pull\/191\/head/);
  assert.match(workflow, /workers\/qa\/p0-rollback-entry\.js/);
  assert.match(workflow, /WORKER_NAME: thornie-dungeons-p0-rollback-staging/);
  assert.doesNotMatch(workflow, /WORKER_NAME: thornie-dungeons-p0-staging\s*$/m);
});

test("staging identity, restricted D1, and no routes or cron", () => {
  assert.match(workflow, /STAGING_DB_ID: c16e0b11-cf83-468c-a533-0ecbf522082f/);
  assert.match(workflow, /PRODUCTION_DB_ID: 2f6d52b4-3de7-4e78-98d4-fc143a4d29e2/);
  assert.match(workflow, /\.d1_databases \| length == 1/);
  assert.match(workflow, /has\("routes"\) \| not/);
  assert.match(workflow, /has\("triggers"\) \| not/);
  assert.match(workflow, /\.result\.schedules \| length == 0/);
  assert.match(workflow, /versions\\?per_page=20/);
  assert.match(workflow, /deployments\\?per_page=20/);
  assert.match(workflow, /\.result\.resources\.script\.etag == \$etag/);
  assert.match(workflow, /max_by\(\.created_on\)/);
  assert.match(workflow, /Worker .*already exists; refusing/);
  assert.match(workflow, /Verify exact QA rows and unsettled Chapter Boss victory/);
  assert.match(workflow, /JOIN players p ON p\.id = c\.player_id/);
  assert.match(workflow, /ba\.settled_at = ''/);
  assert.match(workflow, /bc\.battle_id IS NULL/);
  assert.match(workflow, /json_extract\(ba\.initial_state_json, '\$\.floor'\) = 10/);
  assert.match(workflow, /json_each\(ba\.initial_state_json, '\$\.units'\)/);
  assert.match(workflow, /json_extract\(initial_unit\.value, '\$\.isBoss'\) = 1/);
  assert.match(workflow, /json_extract\(ba\.state_json, '\$\.serverContext\.role'\) = 'chapter_boss'/);
  assert.doesNotMatch(workflow, /d1 migrations apply|--keep-vars/);
});

test("fault QA IDs and secret are mandatory; no production secrets", () => {
  assert.match(workflow, /inputs\.qa_player_id/);
  assert.match(workflow, /inputs\.qa_character_id/);
  assert.match(workflow, /inputs\.qa_battle_id/);
  assert.match(workflow, /secrets\.P0_ROLLBACK_TEST_KEY/);
  assert.match(workflow, /wrangler secret put P0_ROLLBACK_TEST_KEY/);
  assert.match(workflow, /Create short-lived QA bearer session for the exact fixture player/);
  assert.match(workflow, /openssl dgst -sha256 -binary/);
  assert.match(workflow, /FROM characters WHERE character_id='\$QA_CHARACTER_ID' AND player_id='\$QA_PLAYER_ID'/);
  assert.match(workflow, /expires_at > '\$created_at'/);
  assert.match(workflow, /\.result\.resources\.bindings\[\]; \.name == "P0_ROLLBACK_TEST_KEY"/);
  assert.doesNotMatch(workflow, /secrets\.CF_API_TOKEN|secrets\.CF_ACCOUNT_ID/);
});

test("known runner and Wrangler regressions protected", () => {
  assert.match(workflow, /grep -Eoh/);
  assert.doesNotMatch(workflow, /\brg -o\b/);
  assert.match(workflow, /runtime_config="\$GITHUB_WORKSPACE\//);
  assert.match(workflow, /wrangler deploy --dry-run/);
  assert.match(workflow, /\.result\.schedules \| type == "array"/);
  assert.match(workflow, /Expected exactly one source-tagged Worker version/);
  assert.match(workflow, /Active Worker version, source etag, QA binding or staging D1 mismatch/);
});
