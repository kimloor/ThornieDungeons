# Battle Scalability Audit & Staging Load Test Plan

**Status:** READY-FOR-STAGING-QA / Gates 0–3 verified; Gate 4 load test not yet run  
**Baseline inspected:** `main` `841a4ca19915dbedf0a321791d8b76ac333fb100`  
**App version at baseline:** `1.1.44`  
**Scope:** Read-only audit, isolated staging preparation, and 10–100 concurrent-player Battle load testing. This document does not authorize production changes or a load test against Production.

## 1. Goals and non-goals

Establish whether the current Battle API and D1 setup can support 10, 25, 50, and 100 concurrent players, identify measurable bottlenecks, and preserve gameplay correctness.

Non-negotiable constraints:
- Keep current Battle animation/presentation delays unchanged. Measure client animation separately from API wait.
- Keep Battle Core server-authoritative; preserve action ordering, receipt/idempotency, revision checks, reward settlement, and save integrity.
- Do not run stress/load tests against Production.
- Do not write to Production D1, alter production Worker configuration, or copy Production secrets.
- Staging must have a dedicated Worker and D1 binding, no Production routes, no production cron/schedules, and no Production credentials.
- Use synthetic/test identities for load generation. Production player data may be copied only under the approved sanitized-data process in §5.

## 2. Current architecture and baseline observations

At baseline `841a4ca` / App `1.1.44`:
- Client `src/ui/App.js` `driveCoreBattle()` awaits `cloudSubmitDungeonBattleAction(...)` before applying the authoritative response and scheduling the next action.
- Hero, Pet, and Monster actions are sent serially through the client flow; each action may require a separate HTTP request/response.
- The API entrypoint is `workers/thornie-dungeons-api-entry.js`; core handler is `workers/thornie-dungeons-api.js`; Worker D1 binding is `env.DB`.
- `docs/D1-LATENCY-BUDGET-V1.md` defines Server-Timing fields: `d1;desc="<N> calls"` and `app;dur=<ms>`. Existing budgets include `completeBattle normal <= 4` D1 calls and replay `<= 2`; these are not yet a budget for every in-progress Battle Action.
- Existing source audit found a synchronous client wait on the authoritative API response. Animation delay is intentional and is not a target for optimization.

These are source-level observations, not measured live latency or a proven 100-player capacity result.

## 3. Preliminary performance objectives

These are proposed acceptance targets for the Battle Action API, not current measured results. Measure from a load generator in the same region/network profile and report client-side and Worker-side timings separately.

| Metric | Initial target |
|---|---:|
| API response P50 | <= 200 ms |
| API response P95 | <= 500 ms |
| API response P99 | <= 1,000 ms |
| Action error rate | < 0.1% |
| D1 overload / unavailable | 0 |
| Battle revision / stale-state correctness errors | 0 |
| Duplicate reward settlement or lost committed action | 0 |

Report actual throughput (requests/sec and completed Battle Actions/sec), concurrency, duration, warm/cold state, region, and test data size alongside percentiles. If targets are missed, record the first concurrency level and exact failure mode rather than reporting only a final average.

## 4. Load-test matrix

Run only after staging parity, isolation, and data-integrity gates pass.

| Stage | Concurrent players | Pattern | Minimum observation |
|---|---:|---|---|
| Smoke | 1–5 | Normal Battle actions | API correctness and instrumentation |
| A | 10 | Steady actions | 10 minutes |
| B | 25 | Steady actions | 10 minutes |
| C | 50 | Steady actions | 15 minutes |
| D | 100 | Steady actions | 15 minutes |
| Burst | 100 | Synchronized action bursts | 5 controlled bursts |
| Soak | 50–100 | Sustained mixed battles | 30 minutes |

The load model must represent the real client action sequence (Hero, Pet, Monster, and server turn transitions), not simply send arbitrary requests at a fixed high rate. Record the assumed action interval and derive offered request rate from that model. Add a separate burst profile to expose queueing and overload behavior.

Stop immediately on any Production binding/route detection, unexpected writes outside the staging database, integrity mismatch, sustained 5xx/429/overload responses, or any evidence of cross-player state contamination.

## 5. Staging data refresh — approved sanitized-copy policy

Owner-approved direction (2026-11-04): copy game data from current Production D1 into the existing Staging D1, while anonymizing personal data and preserving relational integrity.

Before any write:
1. Verify both database IDs and account IDs through Cloudflare API/Wrangler using dedicated staging credentials. Confirm Staging ID differs from Production ID.
2. Take and verify a recoverable backup of the current Staging D1. Never overwrite an unknown staging environment.
3. Capture Production schema/migration inventory read-only; compare `d1_migrations`, tables, columns, indexes, constraints, triggers, and views against Staging.
4. Build a table/column data classification from the actual schema and current Worker/auth code. Do not infer PII columns from names alone.
5. Exclude authentication secrets and credentials: password hashes, session/access/refresh tokens, recovery codes, API keys, admin credentials, and other security material. Exclude live sessions and production-only operational state.
6. Anonymize direct identifiers (email, login/display identifiers, phone/contact fields, names and free-text fields that may contain personal data). Use deterministic per-source-ID pseudonyms where relationships require stable references; apply the same mapping to every foreign-key/reference column.
7. Preserve game-domain relationships and values needed for test coverage: characters, equipment/items, pets, progression, currencies, battle-relevant state, guild/social relationships only if explicitly required, and approved non-secret game configuration. Review every table individually.
8. Do not copy production admin accounts, credentials, sessions, audit/security logs, or external integration secrets unless a separate explicit need and safe transformation is approved.
9. Import into Staging only. Compare per-table row counts (accounting for intentionally excluded rows), foreign-key checks, uniqueness constraints, orphan checks, and representative character/item/pet consistency.
10. Record copy timestamp, source/target database IDs, migration version, transformation version, row counts, exclusions, and verification output. Never put secrets or raw PII in the report.

A sanitized copy is not automatically safe merely because names/emails are replaced. Free-text fields, external IDs, tokens, and derived identifiers must also be reviewed. If the schema or relationships cannot be classified confidently, stop and report the exact tables/columns rather than copying them.

## 6. Staging Worker parity and isolation

Production source/config references:
- Worker source: `workers/thornie-dungeons-api.js`
- Entrypoint: `workers/thornie-dungeons-api-entry.js`
- Production Worker name: `thornie-dungeons-api`
- Production D1 binding: `env.DB`
- Production deploy workflow: `.github/workflows/deploy-api.yml`
- Production Wrangler template: `wrangler.api.template.jsonc`

Staging Worker requirements:
- Deploy the exact selected current `main` source SHA, not a historical pinned source revision.
- Use a distinct Worker name and a runtime config with exactly the intended Staging D1 binding.
- Verify remote Worker settings after deploy: Worker identity, source tag/version, all bindings, routes, cron schedules, and environment variables.
- No Production routes, custom domains, cron triggers, service bindings, queues, buckets, KV, Durable Objects, or other production resources unless an isolated staging counterpart is explicitly configured and verified.
- Do not copy Production secrets. Create separate staging secrets only when required and only with staging-scoped permissions.
- Run dry-run and config assertions before deployment; perform a read-only staging health/config smoke test after deployment.
- Ensure test traffic cannot reach the Production API/DB through fallback URLs, shared config, redirects, or client hard-coding.

## 7. Telemetry and diagnosis

Collect per request:
- Client: action type, battle/session correlation ID, request start/end, response status, retry count, and time spent waiting for API. Do not log credentials or full player payloads.
- Worker: total handler wall time, route/action, status, CPU time if available, and D1 Server-Timing count/duration.
- D1: query/batch timing, overload/error count, queue/latency indicators available from Cloudflare analytics, and read/write volume.
- Load generator: active virtual players, offered request rate, successful actions, latency histogram, errors, and test phase.

Use correlation IDs that are synthetic and scoped to the test. Redact player identifiers and payloads. Do not add high-volume per-action production logging solely for this test.

## 8. Optimization candidates (not pre-approved implementation)

Prioritize evidence before changes:
1. Measure each in-progress Battle Action's D1 call count and Worker wall time.
2. Confirm whether completion snapshots (Character/Items/Diamonds) are needed on every action response or only on specific action types.
3. Batch independent D1 reads where transaction/consistency semantics allow.
4. Evaluate a server-side action sequence/batch (Hero → Pet → Monster) only if it preserves all authoritative checks, intermediate client-visible decisions, idempotency, checkpointing, and error recovery.
5. Evaluate read replication only for safe read paths; writes remain primary-authoritative and replica staleness must not weaken gameplay correctness.

No optimization may be implemented by weakening server authority, removing receipt/revision guards, skipping persistence, or shortening the intentional animation delay.

## 9. QA and release gates

**Gate 0 — access and isolation**
- Confirm current Production/Staging D1 identities via live Cloudflare inspection.
- Confirm Staging Worker identity and bindings.
- Confirm credentials and permissions are staging-scoped.
- Confirm no Production routes/schedules/secrets are attached.

**Gate 1 — schema parity**
- Migration history and schema parity verified.
- Foreign-key and integrity checks pass.
- Staging backup and restore procedure verified.

**Gate 2 — sanitized data parity**
- Approved data classification and transformation map reviewed.
- Row-count reconciliation and relationship checks pass.
- PII/secret scans pass; no production credentials/sessions/admin secrets copied.

**Gate 3 — Worker parity**
- Exact current source SHA recorded.
- Staging config differs only in explicitly approved environment/resource settings.
- Health/config smoke tests pass; no Production resource binding.

**Gate 4 — staged load**
- Run matrix in §4 progressively.
- All correctness and performance metrics captured.
- Stop conditions in §4 respected.

**Gate 5 — optimization/regression**
- Any code changes follow `AGENTS.md` backend branch/PR approval route.
- Battle Core parity, relevant Worker tests, migration QA if applicable, and staging regression pass.
- No Production deploy until separate Owner release approval.

## 10. Gate 0 live evidence (2026-11-04)

Cloudflare inspection and controlled Staging-only preparation completed against account `72a2af0ff5c5e4a83d037953f8a35356` on 2026-11-04. Production remained read-only; no Production export, import, Worker mutation, or deployment was performed.

### Account and D1 identity

- Production D1: `thornie-dungeons-db` / `2f6d52b4-3de7-4e78-98d4-fc143a4d29e2`
- Staging D1: `thornie-dungeons-staging` / `c16e0b11-cf83-468c-a533-0ecbf522082f`
- Both are in the same Cloudflare account; IDs are distinct.
- Production D1 is 6,496,256 bytes / 62 tables; Staging D1 is 1,155,072 bytes / 62 tables.
- Both have D1 read replication disabled. Production is running in ENAM; Staging is running in APAC.

### Schema and migration comparison

- Table/column comparison: 62 tables and 480 columns on each side; no column-level differences found.
- Foreign-key checks: zero violations on Production and zero violations on Staging.
- Migration history initially differed: Production had `0033_battle_checkpoint_recovery_reset_v1.sql`; Staging stopped at `0032_battle_action_idempotency_v1.sql`.
- Migration 0033 was applied on Staging after preflight (2 authorities abandoned, 2 checkpoints closed) and is recorded as migration id 22. Final Staging state is verified at migration 0033.

### Current data differences

Final sanitized Staging refresh matches the approved Production core-data counts: `players` 17, `characters` 23, `items` 160, `battle_checkpoints` 473, `battle_completions` 446, and `arena_matches` 41. Excluded security/social data is intentionally zeroed and recorded below.

### Worker identity and isolation

- Production Worker `thornie-dungeons-api` is bound to Production D1 and has secret binding `ADMIN_API_KEY`; it has one live cron schedule `0 17 * * *`.
- Existing `thornie-dungeons-api-staging` is bound only to Staging D1, has no secret binding returned, and has no cron schedules. It now runs the current `main` source with version annotation `main-50c64b1a3152123294399d9d1f3c4b2f06a319da`; live settings and routes were rechecked after upload.
- Existing `thornie-dungeons-p0-staging` is bound only to Staging D1, has no cron schedules, but is explicitly tagged to historical source SHA `d128b96f3a652325de77592b3f5a859ad319dc5b`.
- `thornie-dungeons-h01-staging` is also bound only to Staging D1 and has no cron schedules, but its workers.dev subdomain is disabled.
- Account worker domains and zones returned no custom domain/zone route records for this account. Worker subdomains are enabled for Production and the two API/P0 staging Workers; this does not by itself prove application-level URL isolation.
- No Production secret values were read or exposed.

### Backup and rollback capability

- Cloudflare D1 Time Travel is available as the platform point-in-time recovery mechanism; the connected API exposes restore by bookmark or timestamp.
- A task-specific Staging D1 export completed before writes: bookmark `00000038-00000000-00005119-386f115ca82f29d2be657635a55b851c`; the signed URL is intentionally not recorded here.
- Restore from that bookmark was exercised repeatedly during importer validation and verified by row counts and `PRAGMA foreign_key_check` (zero violations). Staging rollback capability is verified.

## 11. Findings and current blockers (2026-11-04)

| Item | Repository evidence | Status |
|---|---|---|
| Latest main source | `50c64b1a3152123294399d9d1f3c4b2f06a319da` | Verified via GitHub branch API |
| App version | `1.1.44` | Verified from current project context/release commit |
| Production D1 ID | `2f6d52b4-3de7-4e78-98d4-fc143a4d29e2` | Live-verified in account `72a2af0ff5c5e4a83d037953f8a35356` |
| Staging D1 ID | `c16e0b11-cf83-468c-a533-0ecbf522082f` | Live-verified in account `72a2af0ff5c5e4a83d037953f8a35356` |
| D1 separation | IDs differ | PASS at live account/resource identity level |
| Existing staging workflow | `.github/workflows/p0-isolated-staging-deploy.yml` | Pins old source SHA `d128b96f3a652325de77592b3f5a859ad319dc5b`, targets Worker `thornie-dungeons-p0-staging`, and refuses to overwrite an existing Worker |
| Historical staging Worker evidence | `docs/ADMIN-V2-W2FG-STAGING-QA-PLAN.md` | Historical, retired workflow; references Worker `thornie-dungeons-api-staging` and same Staging D1 ID. Not proof of current deployment |
| Live schema parity | 62 tables / 480 columns match; FK checks are clean; both now record migration 0033 | PASS |
| Current Worker parity | Staging version 6 is annotated with current main SHA, Staging D1-only, routes empty, schedules empty; smoke GET returned HTTP 200 | PASS |
| Sanitized Production data copy | 1,669 sanitized core rows inserted; credentials/sessions/admin/social optional data excluded; FK/orphan/CHECK validation passed | PASS with documented exclusions |
| 100-player load test | Must wait for Gates 0–3 | NOT STARTED — correctly blocked |

### Immediate blockers

1. Backup/rollback is verified for this task via the recorded Staging export bookmark and repeated successful restores.
2. The final classification excludes `auth_sessions`, `auth_rate_limits`, `admin_users`, `admin_sessions`, `admin_audit_log`, battle/arena/character/mailbox/raid idempotency receipts, all optional social conversation/application/membership data, and `w6_legacy_item_cleanup_audit`; `players.password`, `password_hash`, and `recovery_code_hash` contain no copied credential values. Core foreign keys use deterministic `stg_*` surrogate IDs; names, descriptions, and JSON references are sanitized.
3. Final validation: 1,669 inserted rows, zero foreign-key violations, zero orphan items/characters, zero invalid arena pairs, zero credential values, zero sessions/admin accounts, and exact core counts recorded above.
4. Current-main Worker source is deployed to `thornie-dungeons-api-staging` with only the Staging D1 binding; routes and cron schedules are empty; smoke GET returned HTTP 200.
5. No load test has been run yet; Gate 4 remains pending staging QA sign-off.

**Next required action:** run the approved staging QA smoke/regression suite, then execute the §4 load matrix only against Staging. Production remains read-only.
