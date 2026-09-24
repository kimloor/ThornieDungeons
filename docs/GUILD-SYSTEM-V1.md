# Guild System V1

Status: **ACTIVE-PRODUCTION for Core — current Guild System V1 Core contract and implementation reference. Donation and Guild Chat sections below remain design-only (not implemented).**

Depends on `SOCIAL-SYSTEM-V1.md`. Guild membership is character-scoped.

## 1. V1 scope

Guild V1 includes:
- Create Guild;
- Search Guild;
- Guild Profile/Home;
- Join policy;
- Applications;
- Accept/Reject Application;
- Leave;
- Kick;
- Transfer Leader;
- automatic Leader succession after inactivity;
- Disband;
- Member List;
- Guild Level/EXP;
- item donation;
- personal contribution;
- Guild Chat integration.

Roles in V1:
- `LEADER`
- `MEMBER`

No Officer role in V1.

Not V1:
- Guild rename;
- Guild Quest implementation;
- Guild Shop;
- Guild Raid/Boss;
- Guild War;
- Treasury;
- Guild Buff;
- Officer role.

## 2. Character membership rule

One character may belong to **one Guild at a time**.

This must be enforced server-side/database-side, not only by UI.

Other characters on the same account have independent Guild membership.

## 3. Guild creation

Guild creation is free.

Requirement:
- creating character must be **Level 30 or higher**;
- character must not already belong to a Guild.

Guild rename is not available in V1 and is reserved for Guild V2.

Guild name uniqueness must be case-insensitive using a normalized-name rule.

Recommended name validation:
- 3–20 characters;
- trim surrounding whitespace;
- reject invalid/control content;
- prevent equivalent normalized duplicates.

## 4. Roles and permissions

### Leader
May:
- edit Guild description;
- set join policy;
- accept/reject applications;
- kick Members;
- manually transfer leadership;
- disband Guild;
- use all normal Member functions.

### Member
May:
- view Guild;
- view Member List;
- use Guild Chat;
- donate eligible items;
- leave Guild.

Only server-authoritative role state grants Leader actions.

## 5. Join policy

Guild supports:
- `OPEN` — join immediately if eligible and capacity is available;
- `APPLICATION` — application required; Leader accepts/rejects;
- `CLOSED` — not accepting joins.

A character not in a Guild may have at most **5 pending Guild applications** at once.

When a character successfully joins any Guild:
- all other pending applications for that character are cancelled;
- stale concurrent acceptance attempts must fail with `already_in_guild`.

If a Guild is full while an application is pending:
- application may remain pending;
- Accept fails with `guild_full`;
- the application is not automatically deleted solely because the Guild is temporarily full.

## 6. Guild Level and member capacity

Guild Level cap = **10**.

Member capacity:
| Guild Level | Max Members |
| ---: | ---: |
| 1 | 10 |
| 2 | 15 |
| 3 | 20 |
| 4 | 25 |
| 5 | 30 |
| 6 | 35 |
| 7 | 40 |
| 8 | 40 |
| 9 | 40 |
| 10 | 40 |

Capacity is derived from Guild Level through one shared rule/config. Do not scatter hard-coded capacity checks across frontend/backend.

Max member capacity is **40** in V1.

## 7. Guild EXP sources

V1 Guild EXP comes from **eligible item donation**.

Approved V1 donation value:
- **1 eligible junk item = 1 Guild EXP**.

Keep the mapping centralized/configurable even though the initial V1 value is fixed at 1 EXP per item.

Future Guild Quest EXP is planned but not implemented in Guild V1.

Planned future integration:
- monster-kill Guild Quests;
- other Guild Quest objectives;
- implementation should be done when the Daily Quest feature is developed.

## 8. Donation eligibility

Only item categories on an explicit donation whitelist may be donated.

Typical intended examples:
- junk/common resources such as stone, wood, grass, and similar low-value materials.

Rules:
- equipped items cannot be donated;
- locked items cannot be donated;
- quantity per donation action: **1–999**;
- no daily donation cap in V1;
- server validates ownership, quantity, membership, whitelist eligibility, and lock/equip state.

The concrete whitelist must use real production item/category identifiers after inspection; do not guess item keys.

## 9. Donation transaction

Donation is a high-impact inventory transaction and must be atomic/idempotency-safe.

Required logical order:
1. verify authenticated character ownership;
2. verify current Guild membership;
3. verify item eligibility;
4. verify quantity and inventory ownership;
5. consume items;
6. add Guild EXP if Guild is below Level 10 cap;
7. add personal contribution;
8. write donation audit/history.

If any required step fails, the transaction must not leave partial item/EXP state.

A mobile double-tap/network retry must not consume items twice.

## 10. Personal Contribution

Each Member has cumulative personal contribution.

V1:
- **1 eligible junk item = 1 Personal Contribution**;
- contribution therefore matches donated eligible-junk quantity 1:1 in V1;
- contribution is cumulative and does not reset;
- contribution does not yet purchase rewards in V1.

Keep contribution available for future:
- Guild Shop;
- rankings;
- rewards;
- Guild Quest systems.

## 11. Level 10 donation behavior

At Guild Level 10:
- Guild cannot level further;
- donation remains allowed;
- Guild EXP no longer increases beyond the Level 10 cap;
- personal contribution still increases.

This prevents donation from becoming unusable after the Guild reaches max level.

## 12. Guild EXP thresholds

Approved V1 progression:

| Level | EXP to next level | Cumulative EXP |
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

Total EXP required from Guild Level 1 to Level 10 = **15,300**.

Use one central progression table/config. Do not scatter threshold values across frontend/backend.

At Level 10, Guild EXP is capped at the Level 10 threshold while donation and Personal Contribution continue.

## 13. Guild application/join concurrency

Server must handle races safely:
- two Guilds accepting the same character;
- final member slot being accepted/joined concurrently;
- application accepted after character joined elsewhere;
- repeated/double Accept.

The one-Guild rule and capacity check must be enforced at transaction/constraint level where practical.

## 14. Manual leadership transfer

Leader may transfer leadership to a current Member of the same Guild.

Transfer must atomically:
- old Leader -> Member;
- target Member -> Leader;
- update authoritative Guild leader reference if stored separately.

Old Leader remains in the Guild as Member.

If Guild has more than one member, Leader cannot simply leave without first transferring leadership.

If the Leader is the sole member, disband is the exit path.

No Guild rename behavior is tied to leadership transfer.

## 15. Automatic leadership succession

If the current Leader has been inactive for **36 hours or more**, the Guild may automatically transfer leadership.

Eligibility:
- candidate must be a current Member of the same Guild;
- candidate must have activity within the latest **24 hours**.

Candidate selection priority:
1. highest character Level;
2. if tied, most recent `last_active_at`;
3. if tied, earlier `joined_at`;
4. if still tied, stable character ID as deterministic final tie-breaker.

If no eligible Member exists, do not transfer leadership yet.

When an eligible member later becomes active and a Guild/Social activity triggers evaluation, succession may proceed.

Auto-transfer:
- demotes old Leader to Member;
- promotes selected Member to Leader;
- does not kick the old Leader.

## 16. Auto-transfer trigger strategy

V1 does not require a frequent scheduled job.

Prefer evaluating succession during meaningful Guild/Social activity, such as:
- character login/activity;
- opening Guild page;
- Guild API request;
- donation;
- Guild Chat activity.

Use one shared succession check function; do not duplicate the 36h/24h rule across endpoints.

A future scheduled/real-time mechanism may replace this if scale/requirements justify it.

## 17. Character deletion and Leader safety

A Leader with other Guild members cannot delete the Leader character without resolving leadership first.

Required path:
- manual leadership transfer, or another explicitly approved safe path;
- sole-member Leader may disband.

Character deletion must not wait for the 36-hour inactivity rule.

A normal Member deletion may remove membership as part of safe deletion cleanup.

Historical donation records may be retained/anonymized for audit and must not expose private account data.

## 18. Guild Chat integration

Guild Chat behavior is defined in `CHAT-SYSTEM-V1.md`.

Key rules:
- current membership required;
- leaving Guild removes active access immediately;
- rejoining later follows new-member history rules;
- Guild Chat is the same channel whether entered from Chat Page or Guild Page shortcut.

## 19. Guild Page

Guild is a dedicated full page, separate from Friend and Chat.

### Character without a Guild
May see:
- Guild Search/List;
- pending Applications;
- Create Guild if Level 30+.

### Character with a Guild
May see:
- Guild Home/Profile;
- Guild Level/EXP;
- Member count/capacity;
- Leader;
- description;
- Donate;
- Member List;
- Guild Chat shortcut;
- Leader Management controls when authorized.

The page must reserve future growth space for Guild Quest/Shop/Raid/War without requiring Social-page consolidation.

## 20. Conceptual data entities

Implementation must inspect current production schema first.

Likely concepts:
- `guilds`
- `guild_members`
- `guild_applications`
- `guild_donations`

Possible fields include Guild level/EXP, join policy, leader character reference, joined time, and contribution total.

Member capacity should be derived from Guild Level rather than stored as an independently mutable truth unless implementation has a documented compatibility reason.

## 21. V2 / future hooks

Reserved for later approval:
- Guild rename;
- Officer role;
- Guild Quest system;
- Guild Shop;
- Guild Raid/Boss;
- Guild War;
- Guild buffs;
- advanced recruitment tags;
- expanded progression rewards.

Guild Quest EXP must be integrated when the Daily Quest feature is designed, not silently implemented as part of V1.
