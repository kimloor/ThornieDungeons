# W2-F/G Actual D1 handler QA
commit: 46ee2b2b76a1d9435ef9d0d2ac14c2ba455f3c9e  worker version: 909e491d-212e-45ef-8e35-f4818397881a  mode: remote  staging D1: c16e0b11-cf83-468c-a533-0ecbf522082f
**19/19 PASS**

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