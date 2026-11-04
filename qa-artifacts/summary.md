# W2-F/G Actual D1 handler QA
commit: 8453dd620c608a4cb2303bfca7bdf1061a42d717  worker version: 1278f313-de00-46df-8765-113bd0118958  mode: remote  staging D1: c16e0b11-cf83-468c-a533-0ecbf522082f
**32/33 PASS**

| # | Scenario | Result |
|---|---|---|
| 1 | Delete normal gear | PASS |
| 2 | Restore gear | PASS |
| 3 | Duplicate restore / idempotency | PASS |
| 4 | Partial stack delete and restore | PASS |
| 5 | Equipped item rejection | PASS |
| 6 | Pending operation blocks delete/restore | PASS |
| 7 | Active run blocks delete/restore | PASS |
| 8 | Stale run permits operation | PASS |
| 9 | Invalid run timestamp blocks operation | PASS |
| 10 | Stale snapshot hash rejection | PASS |
| 11 | Inventory capacity and overflow | PASS |
| 12 | Item ID collision | PASS |
| 13 | Different stack identity | PASS |
| 14 | Malformed audit snapshot rejection | PASS |
| 15 | Feature flag disabled rejection | PASS |
| 16 | Concurrent duplicate delete (real D1) | PASS |
| 17 | Concurrent duplicate restore (real D1) | PASS |
| 18 | Pending-operation race during mutation (real D1) | PASS |
| 19 | Forced audit failure and atomic rollback (real D1) | PASS |
| 20 | W2F-1: requestId bound to the exact delete request | PASS |
| 21 | H1: flag absent blocks lookup/preview/apply (403); invalid token is 401 | PASS |
| 22 | H1: lookup returns all characters of the username with diamonds | PASS |
| 23 | H1: preview is read-only; apply adds Gold with one audit row (readback) | PASS |
| 24 | H1: requestId replay / payload binding | PASS |
| 25 | H1: stale preview (Gold changed without touching updated_at) is refused | PASS |
| 26 | H1: pending operation and recent run block; old run does not | PASS |
| 27 | H1 P1-C: row-count assertion fires on real D1 and rolls the whole batch back | PASS |
| 28 | H1: forced audit failure rolls back; retry applies exactly once | PASS |
| 29 | H1: concurrent identical requests (same requestId) mutate once | PASS |
| 30 | H1: concurrent different requestIds on one preview: one wins, the rest refused | PASS |
| 31 | H1: input validation and identity checks | FAIL |
| 32 | H1: flags are independent (seed vs item delete) | PASS |
| 33 | H1: any-player target accepted; audit actor is the Admin, target is the character | PASS |