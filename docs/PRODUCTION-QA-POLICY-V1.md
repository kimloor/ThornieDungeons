# ThornieDungeons — Production QA Policy V1

**Owner-approved operating policy; updated 2026-11-02.**

## 1. Purpose and scope

This document governs routine post-deploy gameplay, UI, and regression acceptance on the live game. It supersedes older default instructions that route ordinary gameplay QA through a Staging D1 database.

## 2. Routine QA environment

- Use the designated Production QA account below through the normal game client and legitimate player actions.
- Do **not** use Staging D1 or a staging Worker for routine gameplay/regression QA.
- This policy does not authorize security fault injection, forged requests, destructive probes, direct database writes, migrations, or fixture seeding/cleanup in Production.
- Security testing remains a separate activity requiring specific Owner authorization, a defined target/environment, and its own QA plan.

## 3. Designated Production QA identity

| Field | Value |
|---|---|
| Environment | Production |
| Player ID / username | `chatgpt` |
| Character name | `gpt1` |
| Character ID | `char-1793631141111-8kzn3j2j` |
| Intended use | Routine gameplay regression and post-deploy acceptance |

### 3.0 Second designated QA identity (Claude)

| Field | Value |
|---|---|
| Environment | Production |
| Player ID / username | `claude` |
| Character name | `claude1` |
| Character ID | `char-1793632719961-ycr8bbue` |
| Intended use | Claude-side routine regression QA; kept separate from the `chatgpt` account so state, runs, Arena rating and audit trails do not collide |

Identity confirmed by a read-only Production D1 query on 2026-11-02 (created 2026-11-02T15:18:39Z; initial state Level 1, XP 0, Gold 0, Unlocked Floor 1, Potions 2, Diamonds 0 — same baseline as below). Seed status: NOT APPLIED. All rules in this document apply to this identity too. No credentials are stored here.

The identity and Character ID of the `chatgpt` account were confirmed by a read-only Production D1 query on 2026-11-02. Never store passwords, password hashes, session tokens, recovery codes, or other authentication secrets in this document or in chat.

### 3.1 Initial observed state (before any seed)

Read-only snapshot confirmed on 2026-11-02:

| Field | Initial value |
|---|---:|
| Level | 1 |
| XP | 0 |
| Gold | 0 |
| Unlocked Floor | 1 |
| Character Potions | 2 |
| Diamonds | 0 |

The query reported zero rows written and no database change. These values are a historical baseline, not a promise of the account's current state after future play.

### 3.2 Seed status and intended QA baseline

**Seed status: NOT APPLIED as of 2026-11-02.** No Production player data was modified during account identification or documentation.

Proposed bounded test baseline, pending discovery and verification of a supported, audited Admin/QA grant path:

- Level 10, with derived/stat-point values kept internally consistent with the game's progression rules.
- 20 HP Potions and 20 MP Potions.
- Basic, non-overpowered equipment suitable for ordinary Dungeon regression.
- A modest Gold balance only if required by the selected test cases.
- No Diamonds and no unnecessary Floor unlock.

Do not implement this plan by ad-hoc SQL or direct Production D1 writes. Use a supported server-side Admin/QA operation that records an audit event and preserves item ownership/provenance. If no such path exists, stop and request a separately scoped Owner decision before any alternative mutation. After a grant, read back and verify character progression, inventory, item provenance/ownership, and audit record before declaring Seed complete.

## 4. Routine Production QA safeguards

- Use the normal game client and legitimate gameplay flows only.
- Keep tests bounded and reversible where possible; record the relevant before/after state and exact build/version.
- Do not consume scarce/premium items or trigger irreversible progression unless the Owner approves that exact test.
- Do not use direct D1 writes, SQL fixtures, destructive cleanup, fault injection, forged payloads, or security probes as routine gameplay QA.
- Do not test with another player's account or expose account credentials.
- If the QA account is unavailable, access cannot be established safely, or the required test would be destructive, stop and ask the Owner.

## 5. Required QA record

For each Production QA session, record:
- date/time (Asia/Bangkok), frontend/API version or commit where available;
- test case and legitimate client flow;
- QA Player ID and Character ID (never credentials);
- starting and ending state for any relevant resource;
- expected/actual result, screenshots or CI evidence;
- any issue, severity, and follow-up.

## 6. Relationship to security QA

This policy replaces Staging D1 as the default environment only for routine gameplay/UI/regression QA. It does not weaken or replace the separate authorization and isolation requirements for security testing. A Production QA account is not permission to run security attacks against Production.
