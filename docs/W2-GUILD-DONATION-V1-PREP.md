# ThornieDungeons — W2 Guild Donation V1 Preparation

Status: **IMPLEMENTATION CANDIDATE — branch `feat/w2-guild-donation-v1`; awaiting QA**

This document freezes the implementation contract for W2 so the high-risk transactional work can start later without re-discovering schema, balance, or API decisions.

## 1. Dependencies

- W0 Social Phase 3+4 Hotfix: COMPLETE.
- W1 Inventory V2 Structural Refactor: COMPLETE.
- Source of truth: `GUILD-SYSTEM-V1.md`, current `main`, and this preparation contract.
- W2 remains separate from W3 Guild Chat.

## 2. Approved balance

Eligible donation value:
- 1 eligible junk item = 1 Guild EXP.
- 1 eligible junk item = 1 Personal Contribution.

Approved initial whitelist:
- `stone`
- `grass`
- `wood`

Do not silently include:
- `iron`
- `manaOre`
- `bossHorn`
- `bossHide`
- `recipe_azure_*`
- any future `slot_type='junk'` item unless explicitly added to the donation config.

Guild EXP uses **cumulative EXP** in `guilds.exp`.

| Guild Level | EXP to next | Cumulative threshold |
| ---: | ---: | ---: |
| 1 -> 2 | 200 | 200 |
| 2 -> 3 | 400 | 600 |
| 3 -> 4 | 700 | 1,300 |
| 4 -> 5 | 1,000 | 2,300 |
| 5 -> 6 | 1,400 | 3,700 |
| 6 -> 7 | 1,900 | 5,600 |
| 7 -> 8 | 2,500 | 8,100 |
| 8 -> 9 | 3,200 | 11,300 |
| 9 -> 10 | 4,000 | 15,300 |

Level 10 cap:
- `guilds.level = 10`;
- `guilds.exp <= 15300`;
- donation remains allowed;
- Guild EXP applied after cap = 0;
- Personal Contribution continues 1:1.

## 3. Verified current data facts

Current Guild truth already exists:
- `guilds.level`
- `guilds.exp`
- `guild_members.contribution`

Do not duplicate those values as independently mutable truth in the donation table.

Current item truth:
- item row identity = `items.item_id`;
- character ownership = `items.character_id`;
- item kind = `items.slot_type`;
- equipped state = `items.equipped`;
- junk identity = `extra_json.junkId`;
- junk runtime/persisted stack quantity = `extra_json.quantity`;
- Favorite/Lock = `extra_json.favorite === true`;
- top-level DB `items.quantity` is NOT authoritative for current junk stacks.

W1 read-only helpers exist for frontend item access. Backend validation must still read authoritative D1 rows directly.

## 4. Migration

Next forward-only migration:
`migrations/auto/0019_guild_donation_v1.sql`

Add forward-only migration `0019`. Do not modify historical migrations. The migration adds the immutable donation receipt/idempotency table, one central donation config (explicit whitelist, item rates, quantity bounds, and level cap), the single cumulative progression table, and an internal stack snapshot used by atomic triggers. The receipt insert is the sole mutation entry point; triggers validate current membership, inventory, and Guild progression, then consume stacks and update Guild EXP/contribution in the same SQLite transaction.

Proposed shape:

```sql
CREATE TABLE guild_donations (
  donation_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  junk_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  guild_exp_granted INTEGER NOT NULL DEFAULT 0,
  contribution_granted INTEGER NOT NULL DEFAULT 0,
  guild_level_before INTEGER NOT NULL,
  guild_level_after INTEGER NOT NULL,
  guild_exp_before INTEGER NOT NULL,
  guild_exp_after INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (quantity BETWEEN 1 AND 999),
  CHECK (guild_exp_granted >= 0),
  CHECK (contribution_granted >= 0)
);

CREATE INDEX idx_guild_donations_guild_created
  ON guild_donations(guild_id, created_at DESC);

CREATE INDEX idx_guild_donations_character_created
  ON guild_donations(character_id, created_at DESC);
```

`donation_id` is the client-generated idempotency/request ID for one logical donation action. The snapshot table is emptied by the same transaction after stack consumption; it is not historical data.

Historical audit rows should not become the authoritative source for Guild EXP or contribution.

## 5. API contract

### Donate

`POST action=donateGuildItem`

Request:

```json
{
  "action": "donateGuildItem",
  "characterId": "...",
  "junkId": "stone",
  "quantity": 25,
  "donationId": "uuid"
}
```

Use `junkId`, not one stack `itemId`, because one junk type may be split across multiple stack rows. The server chooses/consumes eligible rows belonging to that character.

Required request validation:
- authenticated session;
- character owned by authenticated player;
- current Guild membership;
- non-empty donationId;
- explicit whitelisted junkId;
- integer quantity 1..999.

Authoritative item eligibility:
- `character_id` matches actor;
- `slot_type='junk'`;
- `extra_json.junkId` matches request;
- `equipped=0`;
- `extra_json.favorite !== true`;
- sum of eligible `extra_json.quantity` is sufficient.

Success response:

```json
{
  "ok": true,
  "replay": false,
  "donationId": "...",
  "junkId": "stone",
  "quantity": 25,
  "guildExpGranted": 25,
  "contributionGranted": 25,
  "guild": {
    "level": 2,
    "exp": 225,
    "expToNext": 375,
    "memberCap": 15
  },
  "member": {
    "contribution": 125
  },
  "remainingQuantity": 40
}
```

At Level 10, `guildExpGranted` is the actual EXP applied after cap and may be 0 while `contributionGranted` remains equal to donated quantity.

Idempotent replay:
- same authenticated character + same `donationId` returns the original committed receipt;
- it must not consume inventory or grant EXP/contribution again;
- response sets `replay:true`.

### History

W2 may expose a minimal authenticated read action:
`GET action=getGuildDonationHistory&characterId=...&limit=...`

V1 default/maximum should remain small (for example latest 20/50) and return audit data only. Do not build Guild Shop/ranking behavior here.

## 6. Error contract

Use stable lower_snake_case errors:

- `missing_fields`
- `invalid_quantity`
- `not_guild_member`
- `donation_item_not_allowed`
- `insufficient_donation_items`
- `donation_item_locked` only when the requested material exists but all/sufficient quantity is locked
- `donation_item_equipped` only if an otherwise matching row is equipped
- `donation_conflict` for an unrecoverable concurrency/idempotency conflict
- existing auth/session ownership errors remain unchanged

Do not expose account-private information in donation/history responses.

## 7. Transaction contract

One logical donation must commit all-or-nothing:

1. verify auth + owned character;
2. verify current Guild membership;
3. check/replay `donationId`;
4. validate whitelist + quantity;
5. read authoritative eligible junk stacks;
6. atomically consume exactly requested quantity from `extra_json.quantity`;
7. update cumulative Guild EXP, capped at 15,300;
8. derive/update Guild Level from the central cumulative threshold table;
9. increment `guild_members.contribution` by donated quantity;
10. insert immutable donation receipt/audit row;
11. return committed values.

Critical concurrency rule:
- no read-check-write sequence may allow two simultaneous requests to consume the same quantity;
- no partial item consumption may survive if Guild EXP/contribution/audit fails;
- no Guild EXP/contribution may survive if item consumption fails;
- retries/double-taps with the same donationId must replay the receipt.

The implementation uses one receipt insert and SQLite triggers, so inventory, Guild progression, contribution, audit, and idempotency either commit together or roll back together. The Worker repeats user-facing validation and trigger validation checks critical state again inside the write transaction. The UI lock is only presentation behavior.

## 8. Central config

Create one backend-authoritative Guild Donation config containing:
- explicit whitelist;
- EXP per item = 1;
- contribution per item = 1;
- cumulative Guild EXP thresholds;
- Level cap = 10.

Frontend may mirror values for presentation, but server config is authoritative.

Member capacity must continue to use the existing Guild-level capacity rule.

## 9. Frontend boundary

Guild page adds Donation UI only after backend contract is ready.

Expected V1 UI:
- Donate section on current Guild page;
- show only whitelisted junk owned by the character;
- display available eligible quantity;
- quantity selector/input 1..999 bounded by available eligible quantity;
- Donate button disabled during request;
- fresh donationId per logical action;
- after success, refresh Guild state and inventory from authoritative server state;
- show EXP/contribution result;
- no optimistic item consumption.

Do not implement Guild Chat, Guild Shop, Guild Quest, Guild Raid, Guild War or new economy rewards.

## 10. Required focused tests

Backend/D1:
- 1 item donation;
- multi-stack donation;
- exact-stack depletion deletes/zero-handles correctly;
- partial-stack quantity persists in `extra_json.quantity`;
- quantity 0 / negative / >999 denied;
- non-whitelisted junk denied;
- iron/manaOre/boss/recipe IDs denied;
- locked quantity denied/not consumed;
- equipped row denied/not consumed;
- insufficient eligible quantity denied with no partial state;
- non-member denied;
- character ownership enforced;
- Guild EXP and contribution 1:1;
- multi-level jump calculates correct level;
- Level 10 cap at 15,300;
- Level 10 donation still increases contribution;
- same donationId retry returns same receipt;
- concurrent same/different donationIds cannot double-consume;
- forced failure leaves inventory/EXP/contribution/audit unchanged.

Frontend:
- only approved junk appears;
- available quantity displayed correctly;
- 1..999 input constraints;
- disabled/busy state prevents accidental duplicate UI submit;
- success refreshes inventory + Guild values;
- error does not mutate local inventory optimistically;
- responsive/safe-area Guild page remains valid.

Regression:
- crafting still consumes `extra_json.quantity` correctly;
- Inventory Favorite/Lock semantics unchanged;
- Guild join/member/leader behavior unchanged;
- node build.js + generated JS syntax validation.

## 11. Implementation candidate notes

- API actions: authenticated `POST action=donateGuildItem`; authenticated `GET action=getGuildDonationHistory` (current member's own rows only).
- The donation request uses `characterId`, whitelisted `junkId`, integer quantity, and `donationId`.
- The first committed receipt is returned with `replay:false`; a retry by the same character returns that receipt with `replay:true` and performs no additional mutation.
- Worker queries the progression table; no frontend or Worker threshold list duplicates progression values.
- Validation: `node build.js`, generated inline-JS syntax test, Inventory V2/regression tests, and focused SQLite migration tests.

## 12. Release gate

Before merge:
- dedicated branch;
- migration review;
- focused D1 tests;
- build/syntax tests;
- staging/preview only;
- verify migration on disposable/test D1 first;
- QA handoff;
- no production merge/deploy until QA approval.

W2 completion does not imply W3 Guild Chat completion.
