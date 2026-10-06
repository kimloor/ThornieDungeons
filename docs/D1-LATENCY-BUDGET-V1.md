# D1 Latency Budget V1

## Purpose

Reduce sequential Cloudflare D1 round trips on latency-sensitive gameplay mutations without changing reward authority, guards, receipt/idempotency semantics, or error codes.

The API entrypoint emits a Server-Timing header per request:

`Server-Timing: d1;desc="<N> calls", app;dur=<ms>`

- **d1** = counted D1 terminal statement calls plus each `db.batch()` as one round trip.
- **app** = total API handler wall time in milliseconds.
- No payloads or player data are included.
- Browsers expose `Server-Timing` only for the existing CORS allowlist.

## Budgets

| Action | Before | After | Budget |
|---|---:|---:|---:|
| purchaseCharacterResource | 4 | 3 | <= 4 |
| sellCharacterItem | 4 | 3 | <= 4 |
| completeBattle normal | 7 | 4 | <= 4 |
| completeBattle replay | 2 | 2 | <= 2 |

The before counts include the old separate session/ownership path and, for battle completion, the two sequential reward-plan reads. The after counts use the shared character authentication query and one reward-read batch.

## Implementation rules

- New character mutations should use the shared `authenticateCharacter()` boundary where applicable.
- Do not add per-request authority-table DDL to gameplay hot paths. Migration 0028 provides the required item authority tables.
- Keep one receipt replay/idempotency check per mutation.
- Keep payload conflict, pending-receipt, stale-state, identity, checkpoint, and reward-plan guards unchanged.
- Prefer D1 batches when multiple reads have no dependency on each other.

## Reading production measurements

1. Open the browser's Network panel.
2. Select the gameplay API request.
3. Read the `Server-Timing` response header.
4. Record **d1 calls** and **app ms** for repeated purchase, sell, and complete-battle actions.
5. Compare Asia-side client measurements before/after any placement change. Do not treat a single request as a meaningful Smart Placement result.

## Smart Placement measurement

PR-3 is intentionally config-only and must not be merged without owner approval. After PR-1 is deployed, establish a baseline for the three actions above, then measure again only after Cloudflare Smart Placement has had time to analyze traffic.

Rollback: remove only the `placement.mode = "smart"` key from `wrangler.api.template.jsonc`, then redeploy the API Worker through the normal workflow.

## QA

The PR test suite includes a test-side D1 counting fake and architecture budget assertions. Full CI remains the authority for syntax, regression, and generated-build checks.
