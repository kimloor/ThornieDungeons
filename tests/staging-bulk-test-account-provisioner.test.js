import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  STAGING_PROVISIONER_ORIGIN,
  validateTarget,
  validateProvisionerInput,
  main
} from "../scripts/staging-bulk-test-account-provisioner.mjs";

test("provisioning client allowlists only the exact Staging Worker URL", () => {
  assert.equal(validateTarget(STAGING_PROVISIONER_ORIGIN), STAGING_PROVISIONER_ORIGIN);
  assert.throws(() => validateTarget("https://thornie-dungeons-api.ekqtjl.workers.dev"), /staging_host_not_allowlisted/);
  assert.throws(() => validateTarget("https://thorniedungeons.ekqtjl.workers.dev"), /staging_host_not_allowlisted/);
  assert.throws(() => validateTarget("http://thornie-dungeons-api-staging.ekqtjl.workers.dev"), /https_required/);
  assert.throws(() => validateTarget("https://user:pass@thornie-dungeons-api-staging.ekqtjl.workers.dev"), /target_url_not_allowed/);
  assert.throws(() => validateTarget("https://thornie-dungeons-api-staging.ekqtjl.workers.dev/other"), /target_url_not_allowed/);
});

test("provisioning input requires explicit unique STG IDs and bounded character lists", () => {
  const valid = validateProvisionerInput({
    accounts: [
      { testId: "STG_LOAD_01", characterNames: ["Load Hero"] },
      { testId: "STG_LOAD_02", characterNames: [] }
    ]
  }, "batch_20261105");
  assert.equal(valid.accounts.length, 2);

  assert.throws(() => validateProvisionerInput({ accounts: [{ testId: "TEST_LOAD_01" }] }, "batch_20261105"), /invalid_test_id/);
  assert.throws(() => validateProvisionerInput({
    accounts: [{ testId: "STG_LOAD_01" }, { testId: "STG_LOAD_01" }]
  }, "batch_20261105"), /duplicate_test_id/);
  assert.throws(() => validateProvisionerInput({
    accounts: [{ testId: "STG_LOAD_01", characterNames: ["One", "Two", "Three", "Four"] }]
  }, "batch_20261105"), /character_count_out_of_range/);
  assert.throws(() => validateProvisionerInput({
    accounts: [{ testId: "STG_LOAD_01", characterNames: ["Hero", "hero"] }]
  }, "batch_20261105"), /duplicate_character_name/);
  assert.throws(() => validateProvisionerInput({
    accounts: Array.from({ length: 101 }, (_, index) => ({
      testId: `STG_${String(index).padStart(6, "0")}`,
      characterNames: []
    }))
  }, "batch_20261105"), /batch_limit_exceeded/);
});

test("client dry-run validates input and makes zero network requests", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "thornie-provisioner-test-"));
  try {
    const inputPath = path.join(directory, "accounts.json");
    await writeFile(inputPath, JSON.stringify({
      accounts: [{ testId: "STG_LOAD_01", characterNames: ["Load Hero", "Load Pet"] }]
    }));
    const result = await main(["--input", inputPath, "--batch-id", "batch_20261105"], {});
    assert.equal(result.mode, "dry-run");
    assert.equal(result.accounts, 1);
    assert.equal(result.characters, 2);
    assert.equal(result.networkRequests, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("client execution requires explicit confirmation before any network request", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "thornie-provisioner-test-"));
  try {
    const inputPath = path.join(directory, "accounts.json");
    await writeFile(inputPath, JSON.stringify({ accounts: [{ testId: "STG_LOAD_01", characterNames: [] }] }));
    await assert.rejects(
      main(["--input", inputPath, "--batch-id", "batch_20261105", "--execute"], {
        STAGING_PROVISIONER_SECRET: "staging-provisioner-secret-value-0123456789"
      }),
      /explicit_staging_confirmation_required/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
