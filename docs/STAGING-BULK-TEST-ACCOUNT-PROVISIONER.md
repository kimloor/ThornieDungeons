# Staging Bulk Test Account Provisioner

**Status:** Implemented in source and regression-covered. Not enabled, deployed, or used against live Staging. No account or D1 mutation was performed during implementation.

This utility provisions explicitly named synthetic Staging accounts for the Battle Load Test Harness. It is not a public registration replacement and must remain separately guarded from Production.

## Security boundary

The Worker action is `stagingProvisionTestAccounts` and is accepted only when all conditions hold:

- The request hostname is exactly `thornie-dungeons-api-staging.ekqtjl.workers.dev`.
- `STAGING_PROVISIONER_ENABLED` is exactly `true`.
- The Staging Worker has its own `STAGING_PROVISIONER_SECRET` of at least 32 characters.
- The request includes that secret as a Bearer token and `X-Confirm-Staging-Provisioning: YES`.
- The request is a POST with a valid bounded batch.

The hostname check occurs before any account lookup or write. The Production API hostname is rejected even if a flag or secret were mistakenly configured there. Never copy the Staging secret to Production.

Disable the feature by setting `STAGING_PROVISIONER_ENABLED=false` or removing the secret binding. Remove the secret after the approved Staging provisioning window. No deployment or secret configuration is part of this implementation task.

## Input and limits

The input is a JSON file containing only explicit Test IDs and optional character names; it must not contain passwords, Recovery Codes, session tokens, or other credentials.

- Test IDs must use the uppercase `STG_` prefix and the normal Player ID character/length bounds.
- IDs must be unique within the batch (case-insensitive).
- Hard batch limit: **100 accounts**.
- Each account may request 0–3 character names, matching the normal character-slot limit.
- Character names must be unique per account, non-empty, and at most 16 characters.
- A preflight checks every requested ID against existing accounts before starting. If any ID already exists, the entire request is rejected with HTTP 409; existing account data and progression are never reset or changed.
- The caller-supplied `batchId` is a trace label, not a persisted idempotency key. Repeating a batch with already-created IDs is rejected as a duplicate/no-op rather than provisioning again.

## Account and character creation

- Passwords are generated using cryptographic randomness and the accepted alphanumeric password policy.
- A shared `createPlayerAccountRow` helper is used by normal registration and the provisioner, including the same password hash, an internally generated-and-hashed Recovery Code value, and Player row fields. The generated Recovery Code plaintext is discarded.
- The provisioner creates a temporary normal session, verifies it, and creates each requested character through `handleCreateCharacter` so existing authentication, slot, and name checks remain in force.
- The temporary session is revoked after the account's character operations, including failure cleanup.
- No schema migration or direct D1 write path that bypasses the shared account/character business logic is introduced.

## Credential manifest and failure handling

The Worker returns a one-time credential manifest for attempted accounts. It contains generated Player ID, password, account status, and created character IDs/names; Recovery Code plaintext is never returned or stored in the manifest, and session tokens are never returned.

The local CLI:

- Does not print credentials or request secrets to stdout/stderr.
- Reads the provisioner secret only from `STAGING_PROVISIONER_SECRET`.
- Writes the manifest outside the repository by default, under `~/.thorniedungeons/staging/credentials/`.
- Creates the directory with restrictive permissions, writes the file as mode `0600`, and refuses to overwrite an existing manifest.
- Saves a manifest for partial results before reporting a non-success exit status.

All input validation and existing-ID preflight happen before writes. A runtime error can still leave a partial batch; the Worker stops at the first such failure and returns HTTP 207 with statuses and passwords for attempted accounts. Inspect the manifest and Staging state before taking further action. Do not blindly retry or delete accounts; cleanup is intentionally not automatic.

## CLI

Input example (IDs and character names only):

```json
{
  "accounts": [
    { "testId": "STG_LOAD_01", "characterNames": ["Load Hero", "Load Pet"] },
    { "testId": "STG_LOAD_02", "characterNames": ["Load Hero"] }
  ]
}
```

Dry-run; performs no network request:

```node scripts/staging-bulk-test-account-provisioner.mjs --input ./staging-test-accounts.json --batch-id batch_20261105```

Execute only after the Staging isolation gate and separate Owner authorization are satisfied:

```sh
STAGING_PROVISIONER_SECRET="$STAGING_PROVISIONER_SECRET" \
node scripts/staging-bulk-test-account-provisioner.mjs \
  --input ./staging-test-accounts.json \
  --batch-id batch_20261105 \
  --execute --confirm-staging-provisioning
```

The CLI target is fixed to the exact Staging Worker hostname; an override is accepted only if it resolves to that same HTTPS origin. Never run this utility against Production.

## QA and release status

Regression coverage includes Production hostname rejection, disabled-flag and secret/confirmation guards, batch and ID validation, existing-account protection, credential hashing, normal character creation, session revocation, and partial failure behavior. The CLI tests cover target/input validation and zero-network dry-run behavior.

This feature has not been deployed or enabled. No live Staging accounts were created, no Staging D1 mutation was performed, and no Battle Load Test was run. Provisioned accounts may be used only after Staging gates pass and the Owner separately authorizes the load test.
