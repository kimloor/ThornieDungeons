# SHOP-AND-SELL-V1

Status: **IMPLEMENTED ON FEATURE BRANCH — PENDING OWNER MERGE / PRODUCTION QA**

## Scope

Shop and Sell V1 adds quantity-aware resource purchases and stack selling while keeping price, inventory settlement, replay/idempotency, and stale-state checks server authoritative.

## Shop

- Resources: HP/MP potions, Iron, Mana Ore.
- Quantity: 1–99 per request.
- Protection Stone remains single-purchase.
- Purchases may settle into Overflow using the existing inventory planner.
- Existing pending Overflow blocks further resource purchases with `inventory_overflow_pending`.
- Request receipts include quantity; reusing a requestId with different quantity is rejected as a request conflict.
- Client Shop uses stepper, x5, x10, and Max controls.
- Purchase UI shows pending quantity and disables competing Shop actions while a mutation is confirming.
- Purchase retries transient network/server failures with the same requestId, then rolls back local optimistic currency on final failure.
- Server response is authoritative for the final snapshot and totals.

## Sell

- Stackable junk and potions can be sold partially or as a full stack.
- Non-stackable equipment/wing remains quantity 1.
- Server validates quantity and computes the authoritative unit price.
- Full-stack sale deletes the row; partial stack sale updates the authoritative stored quantity.
- Favorite/equipped/pending items remain protected by the existing guards.
- Client shows a quantity dialog with unit-price × quantity preview and reconciles the result from the server.
- Stale item/pricing inputs are guarded before mutation.

## Approved prices

### Potions

| Item | Sell price |
| --- | ---: |
| HP Small | 4 |
| MP Small | 4 |
| HP Medium | 9 |
| MP Medium | 9 |
| HP High | 18 |
| MP High | 18 |
| HP Full | 33 |
| MP Full | 33 |

### Junk

| Item | Sell price |
| --- | ---: |
| Stone | 1 |
| Grass | 1 |
| Wood | 2 |
| Iron | 4 |
| Mana Ore | 6 |

Equipment and Wing formulas remain unchanged from the existing authoritative implementation.

## QA

Required checks:

1. Shop/Sell contract tests.
2. Frontend source syntax and generated build.
3. Full Admin V2 QA.
4. Battle Core parity; unrelated pre-existing Arena graphics failures must remain explicitly identified rather than hidden.
5. Production QA after owner-approved merge/deploy.

## Explicit non-goals

No new migration, no new assets/R2 work, no multi-select sell, no sell-all junk shortcut, no Shop reroll, and no changes to approved economy prices are part of V1.
