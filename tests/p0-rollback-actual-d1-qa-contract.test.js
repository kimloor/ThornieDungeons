const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/p0-rollback-actual-d1-qa.yml"), "utf8");
const runner = fs.readFileSync(path.join(root, "scripts/p0-rollback-actual-d1-qa.mjs"), "utf8");

test("actual D1 QA is manual-only, explicit opt-in, and main-only", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s{2}(push|pull_request):/m);
  assert.match(workflow, /default:\s*DO_NOT_RUN/);
  assert.match(workflow, /RUN_P0_R01_R04/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
});

test("actual D1 runner is pinned to the dedicated QA Worker, fixture, and Staging D1", () => {
  assert.match(runner, /thornie-dungeons-p0-rollback-staging\.ekqtjl\.workers\.dev/);
  assert.match(runner, /5f78f5c8aeb8c32c912e4677c3a4a806be76ab1d/);
  assert.match(runner, /c16e0b11-cf83-468c-a533-0ecbf522082f/);
  assert.match(runner, /2f6d52b4-3de7-4e78-98d4-fc143a4d29e2/);
  assert.match(runner, /P0_QA_ROLLBACK_01/);
  assert.match(runner, /char-p0-rollback-20261102/);
  assert.match(runner, /dungeon-p0-rollback-20261102/);
  assert.match(runner, /assert\(process\.env\.GITHUB_REF === "refs\/heads\/main"/);
});

test("R01 proves the real settlement-batch failure and exact atomic rollback", () => {
  assert.match(runner, /X-P0-Rollback-Fault/);
  assert.match(runner, /X-P0-Rollback-Key/);
  assert.match(runner, /X-P0-Rollback-Nonce/);
  assert.match(runner, /x-p0-rollback-injection/);
  assert.match(runner, /injectedAfter >= 6/);
  assert.match(runner, /JSON\.stringify\(afterFailure\) === JSON\.stringify\(before\)/);
});

test("R02-R04 cover recovery, concurrent replay, and no-injection parity", () => {
  assert.match(runner, /firstCompletion === true/);
  assert.match(runner, /rewardRole === "chapter_boss"/);
  assert.match(runner, /Promise\.all\(Array\.from\(\{ length: 4 \}/);
  assert.match(runner, /firstCompletion === false/);
  assert.match(runner, /startBattle\(11\)/);
  assert.match(runner, /rewardRole === "normal"/);
});

test("actual QA runner does not deploy Workers or apply migrations", () => {
  assert.doesNotMatch(runner, /wrangler deploy/);
  assert.doesNotMatch(runner, /migrations\/auto/);
  assert.doesNotMatch(runner, /d1\/database\/[^/]+\/import/);
});
