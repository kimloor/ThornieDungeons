# ThornieDungeons — Production Diagnostic Logging Contract V1

Status: **ACTIVE-PRODUCTION / OPERATIONS CONTRACT**

## 1. Purpose

This contract defines the shared Production diagnostic logging pattern for ThornieDungeons. It exists to make Production-only failures diagnosable without weakening player-facing validation, exposing sensitive data, or turning normal gameplay into noisy debug logging.

The pattern was validated during the Dungeon checkpoint hotfix where a generic client error was resolved by a structured server diagnostic reason such as `enemy_id_not_authorized`.

## 2. Core principles

1. **Validation authority never changes for diagnostics.**
   - Diagnostics explain why a request failed.
   - They must not create fallback compatibility, bypass checks, or accept legacy/forged values.

2. **Player-facing errors remain intentionally sanitized.**
   - The client may receive a stable generic error such as `invalid_dungeon_checkpoint`.
   - Detailed structural reasons belong in server-side diagnostics unless explicitly safe and useful to expose.

3. **Log only on meaningful failure or invariant drift.**
   - Do not emit verbose per-action Production logs by default.
   - Successful normal gameplay should remain quiet unless a temporary approved investigation requires sampling.

4. **Structured fields are preferred over free-form dumps.**
   - Use a stable event name plus a machine-readable `reason`.
   - Add only the minimum context required to reproduce or classify the failure.

5. **Never trade privacy/security for convenience.**
   - Secrets, raw credentials, auth tokens, passwords, recovery material, full request bodies, and unnecessary player data must never be logged.

## 3. Required diagnostic envelope

New high-value Production diagnostics should follow this logical shape when applicable:

```js
console.warn("[production-diagnostic]", JSON.stringify({
  event: "dungeon_checkpoint_invalid",
  system: "dungeon",
  reason: "enemy_id_not_authorized",
  version: "1.0.40",
  correlation: {
    battleId: "...",
    requestId: "...",
    characterRef: "non-sensitive-or-hashed-ref"
  },
  checkpoint: {
    floor: 10,
    expectedEnemyCount: 1,
    enemyIdsCount: 1
  }
}));
```

The exact transport or logger may evolve, but the semantic contract should remain stable.

### Recommended top-level fields

- `event` — stable event family, e.g. `dungeon_checkpoint_invalid`.
- `system` — subsystem owner, e.g. `dungeon`, `arena`, `inventory`, `auth`, `cloud_sync`.
- `reason` — stable machine-readable classification.
- `version` — visible/runtime version when available.
- `workerVersion` or deployment identifier — when safely available from the runtime.
- `correlation` — IDs needed to join related operations without exposing secrets.
- subsystem-specific structural metadata.

## 4. Reason-code rules

Reason codes must:

- be lowercase snake_case;
- describe the failed invariant rather than a guessed root cause;
- stay stable once used in Production where practical;
- avoid embedding player names, IDs, free text, or values directly in the reason string.

Good examples:

- `enemy_id_not_authorized`
- `enemy_unit_count`
- `checkpoint_context_conflict`
- `settlement_receipt_duplicate`
- `inventory_capacity_conflict`
- `session_owner_mismatch`
- `cloud_save_sequence_regression`

Avoid vague values such as `bad_data`, `unknown_error_2`, or full exception messages as the only classification.

## 5. Data classification and redaction

### Must never be logged

- passwords or password hashes;
- session tokens, bearer tokens, cookies, API keys, recovery tokens;
- raw authorization headers;
- full request/response bodies unless a narrowly approved temporary diagnostic explicitly sanitizes every field;
- payment or future receipt secrets;
- private chat/message content unless a future moderation contract explicitly authorizes it;
- full inventory/save/player records when a few structural fields are enough.

### Prefer not to log directly

- account login identifiers;
- email addresses;
- player-provided names;
- raw character IDs where a hashed/non-sensitive correlation reference is sufficient.

### Safe structural metadata examples

- counts;
- booleans;
- enum/state names;
- floor/rank/slot numbers when not sensitive;
- expected vs received type;
- expected vs received count;
- authorized instance IDs only when operationally necessary and not linked to secret/account credentials;
- battle/transaction IDs when they are non-secret correlation IDs.

## 6. Severity and volume

Use severity intentionally:

- `console.error` — integrity/security failures, impossible state, failed authoritative settlement, or failures requiring immediate investigation.
- `console.warn` — rejected invalid state, contract drift, recoverable invariant mismatch, or Production-only diagnostic conditions.
- `console.info` — rare lifecycle markers useful for operations; not for normal per-action gameplay.
- debug/trace-style logging should not remain permanently enabled in Production without an explicit reason.

For high-frequency endpoints:

- log only failures;
- aggregate or sample repeated identical diagnostics if volume becomes material;
- prefer one diagnostic per rejected request/transaction boundary rather than per internal helper;
- never add retries solely to generate more logs.

## 7. Correlation

Where possible, a Production failure should be traceable across the minimum relevant boundaries.

Preferred correlation fields:

- request/operation ID;
- battle ID / arena match ID / transaction ID;
- sanitized character reference;
- checkpoint or action sequence;
- runtime version;
- Worker/deployment version when available.

Correlation identifiers are for diagnosis only and must not become new authorization inputs.

## 8. System-specific guidance

### Dungeon / Battle checkpoint

Keep:
- generic player-facing checkpoint error;
- detailed server reason such as `enemy_id_not_authorized`;
- structural counts/types;
- authoritative `instanceId` validation unchanged.

Do not:
- accept definition IDs as a fallback;
- add arbitrary legacy-ID compatibility;
- dump the full checkpoint/save payload.

### Arena settlement

Useful reasons include:
- invalid terminal state;
- duplicate/idempotent receipt path;
- ticket/settlement authority mismatch;
- rating/reward settlement conflict.

Log the transaction boundary and structural state, not the full player profile or loadout unless required and sanitized.

### Inventory / reward / crafting

Useful reasons include:
- capacity-plan conflict;
- ownership mismatch;
- item state/version mismatch;
- duplicate reward receipt;
- impossible quantity/slot transition.

Never log full inventories when item ID, quantity, slot/capacity counts, and transaction ID are sufficient.

### Auth / session

Log only sanitized classifications such as:
- expired session;
- owner mismatch;
- invalid session state;
- rate-limit or lockout category.

Never log passwords, password hashes, recovery material, session tokens, cookies, or authorization headers.

### Cloud sync / save

Useful fields include:
- sequence number;
- expected/current sequence;
- checkpoint/save type;
- operation ID;
- retry classification.

Do not dump full saves by default.

## 9. Temporary diagnostic investigations

A temporary Production diagnostic is allowed when a Production-only issue cannot be reproduced safely elsewhere, provided that:

1. scope is narrow;
2. secrets/player-private data are excluded;
3. validation behavior is unchanged;
4. the event has a clear removal or promotion decision;
5. after the incident, either:
   - remove the temporary log, or
   - promote the useful stable portion into this shared contract/pattern.

The Dungeon checkpoint diagnostic is an example of a temporary investigation that proved useful enough to retain as a stable failure-classification pattern.

## 10. QA requirements

When a task adds or changes Production diagnostics, QA should verify:

- failing behavior still fails;
- successful behavior is unchanged;
- player-facing error remains appropriately sanitized;
- expected `event` / `reason` is emitted for the targeted failure;
- secrets/private payloads are absent;
- high-frequency success paths do not become noisy;
- logging does not mutate gameplay, economy, save, or authorization state.

For backend/data-authority changes, the normal HIGH/VERY HIGH QA and release gates still apply. Diagnostic logging does not reduce risk classification.

## 11. Operational use

Project Lead / DEV may use Production logs or tail output to:

- classify real failures;
- compare client/runtime state with server authority;
- confirm whether a suspected producer or validator is at fault;
- derive a focused regression test before implementing the fix.

Do not redesign gameplay from a log message alone. Confirm the related code path and current authoritative contract first.

## 12. Definition of done for new diagnostics

A diagnostic addition is complete when:

1. event and reason are stable and meaningful;
2. no secrets/private payloads are exposed;
3. validation/authority is unchanged;
4. focused regression covers the failure class where practical;
5. Production logging volume is acceptable;
6. related docs are updated when the diagnostic establishes a reusable contract.
