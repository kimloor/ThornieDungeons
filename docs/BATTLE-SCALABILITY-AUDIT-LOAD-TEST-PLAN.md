# Battle Scalability Audit & Staging Load Test Plan

**Status:** ACTIVE-PLANNING / staging parity and data refresh NOT VERIFIED  
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

## 10. Findings and current blockers (2026-11-04)

| Item | Repository evidence | Status |
|---|---|---|
| Latest main source | `841a4ca19915dbedf0a321791d8b76ac333fb100` | Verified via GitHub branch API |
| App version | `1.1.44` | Verified from current project context/release commit |
| Production D1 ID | `2f6d52b4-3de7-4e78-98d4-fc143a4d29e2` | Config reference only; not live-queried in this audit |
| Staging D1 ID | `c16e0b11-cf83-468c-a533-0ecbf522082f` | Config reference only; not live-queried in this audit |
| D1 separation | IDs differ | Config-level separation only; live account/resource ownership not verified |
| Existing staging workflow | `.github/workflows/p0-isolated-staging-deploy.yml` | Pins old source SHA `d128b96f3a652325de77592b3f5a859ad319dc5b`, targets Worker `thornie-dungeons-p0-staging`, and refuses to overwrite an existing Worker |
| Historical staging Worker evidence | `docs/ADMIN-V2-W2FG-STAGING-QA-PLAN.md` | Historical, retired workflow; references Worker `thornie-dungeons-api-staging` and same Staging D1 ID. Not proof of current deployment |
| Live schema parity | No live Cloudflare D1 access available in this audit | NOT VERIFIED |
| Current Worker parity | No live Cloudflare Worker settings/deployment access available in this audit | NOT VERIFIED |
| Sanitized Production data copy | No live D1 export/import access available in this audit | NOT STARTED |
| 100-player load test | Must wait for Gates 0–3 | NOT STARTED |

### Immediate blockers

1. The available connected tools in this session expose GitHub read/write but no Cloudflare D1/Workers inspection, export/import, or deployment action. Do not substitute guesses or run an unverified workflow.
2. The existing staging deploy workflow is pinned to a historical source SHA and a named Worker target; it is not a safe deploy path for current `main` without review and an explicit new staging deployment plan.
3. The existing staging Worker may already exist. The workflow explicitly refuses to overwrite it, which is a useful safety guard; current live existence/state still needs Cloudflare verification.
4. `docs/ADMIN-V2-W2FG-STAGING-QA-PLAN.md` contains historical staging setup notes that prohibit copying production player data. The Owner's newer 2026-11-04 approval supersedes that policy for this task only, with anonymization and the controls in §5; the historical document itself is not modified here.

**Next required action:** obtain a Cloudflare-capable execution path with read access to Workers/D1 and staging-scoped write access. First complete Gate 0 read-only checks; then present the exact table/column sanitization map and copy/rollback plan for approval before writing any data. The Owner has approved the sanitized-copy direction, but this audit has not performed the copy or Worker deployment.
