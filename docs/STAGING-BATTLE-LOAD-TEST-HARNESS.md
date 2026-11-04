# Staging Battle Load Test Harness

**Status:** Initial guarded harness implemented. No live Staging load test has been run.

## Safety

Dry-run is the default. Live execution requires `--execute`, `--confirm-staging-load`, and `ALLOW_STAGING_LOAD_TEST=YES`. The URL must be HTTPS and exactly match the Staging Worker hostname. Production API/frontend hosts, arbitrary hosts, redirects, URL credentials, query strings, and non-root paths are rejected.

The harness never registers accounts, creates/deletes characters, seeds data, deploys Workers, runs migrations, or retries failed requests. It requires pre-created unique player/character credentials through `STAGING_BATTLE_TEST_ACCOUNTS`. Never commit credentials or place them in shell history; use protected environment secrets.

## Current functionality

- Dry-run validation with zero network requests.
- Controlled concurrency of 1–100 virtual players.
- Login, startDungeonBattle, submitDungeonBattleAction and completeBattle.
- Uses Battle Core turn order, unique action keys and current state revision.
- Reports request counts, error rate, HTTP statuses, P50/P95/P99 latency and per-player outcome.
- Hero basic and non-Hero advance commands, with configurable action pacing.

One complete Battle is run per configured test character. A victory can grant normal game rewards. Only dedicated, pre-approved Staging test characters may be used after Staging QA sign-off and separate Owner authorization.

## Limitations

This is the first controlled concurrency runner, not the full §4 matrix orchestrator. Synchronized bursts and 30-minute soak scheduling are not implemented yet. D1 receipts, reward uniqueness, row counts, Worker CPU, D1 queue metrics and Cloudflare analytics are not verified by this tool; these require separately authorized read-only Staging inspection. Passing HTTP requests is not an integrity sign-off.

Run Smoke first, then increase concurrency to 10/25/50/100 only after each prior stage passes. Keep intentional client animation delay separate from API latency. Stop on any unexpected error, identity mismatch, missing state/revision, or production-target indication.

## Configuration

- `STAGING_API_URL`: optional; defaults to the dedicated Staging Worker.
- `CONCURRENCY`: 1–100; default 1.
- `FLOOR`: default 1.
- `ACTION_INTERVAL_MS`: default 750.
- `STAGING_BATTLE_TEST_ACCOUNTS`: JSON array of unique `playerId`, `password`, `characterId` objects.

Dry-run:

```sh
node scripts/staging-battle-load-test.mjs
```

Execution example (do not run until all gates and separate Owner authorization are satisfied):

```sh
ALLOW_STAGING_LOAD_TEST=YES CONCURRENCY=1 \
STAGING_BATTLE_TEST_ACCOUNTS='[{"playerId":"...","password":"...","characterId":"..."}]' \
node scripts/staging-battle-load-test.mjs --execute --confirm-staging-load
```

Node.js 22 checks: `node --check scripts/staging-battle-load-test.mjs` and `node --test tests/staging-battle-load-test.test.js`.
