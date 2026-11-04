import test from "node:test";
import assert from "node:assert/strict";
import { STAGING_ORIGIN, validateTarget, percentile, summarize } from "../scripts/staging-battle-load-test.mjs";

test("only the dedicated staging Worker is an allowed target", () => {
  assert.equal(validateTarget(STAGING_ORIGIN), STAGING_ORIGIN);
  assert.throws(() => validateTarget("https://thornie-dungeons-api.ekqtjl.workers.dev"), /production_target_forbidden/);
  assert.throws(() => validateTarget("https://thorniedungeons.ekqtjl.workers.dev"), /production_target_forbidden/);
  assert.throws(() => validateTarget("http://thornie-dungeons-api-staging.ekqtjl.workers.dev"), /https_required/);
  assert.throws(() => validateTarget("https://example.com"), /host_not_allowlisted/);
  assert.throws(() => validateTarget("https://user:pass@thornie-dungeons-api-staging.ekqtjl.workers.dev"), /target_url_not_allowed/);
});

test("percentiles use nearest-rank calculation", () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  assert.equal(percentile([1, 2, 3, 4, 5], 95), 5);
  assert.equal(percentile([], 99), null);
});

test("metrics summarize errors, status codes and latency", () => {
  const result = summarize([
    { ok: true, status: 200, ms: 10 },
    { ok: true, status: 200, ms: 20 },
    { ok: false, status: 409, ms: 30 }
  ]);
  assert.equal(result.requests, 3);
  assert.equal(result.errors, 1);
  assert.equal(result.errorRatePct, 33.3333);
  assert.equal(result.latencyMs.p50, 20);
  assert.equal(result.statuses[200], 2);
  assert.equal(result.statuses[409], 1);
});
