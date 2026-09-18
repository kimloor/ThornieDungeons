# Social System V1 — Shared Foundation

Status: **ACTIVE-DESIGN**

This document is the shared contract for Friend V1, Chat V1, and Guild V1. It defines cross-system identity, presence, block, unread, lifecycle, security, and error rules. Feature-specific behavior belongs in:
- `FRIEND-SYSTEM-V1.md`
- `CHAT-SYSTEM-V1.md`
- `GUILD-SYSTEM-V1.md`

## 1. Identity boundary

Social identity is **character-scoped**, not account-scoped.

One authenticated account may own up to multiple characters; each character has independent:
- friends;
- blocks;
- direct conversations;
- guild membership;
- social unread state.

Required authorization flow:

`authenticated session -> verify character ownership/current character context -> social action`

Use the existing production character primary key as the canonical social identity. Do not create a parallel social user identity layer.

Character name is display/search data only and must never be used as an authorization key.

The server must not trust client-supplied character name, guild role, guild membership, friendship, or ownership when those facts can be derived server-side.

## 2. Character switching

Switching character switches social identity immediately.

After a character switch, reload character-scoped:
- Friend list and requests;
- blocks;
- Guild membership;
- Direct Message conversations;
- unread/read state.

No Friend/Guild/DM state is inherited by another character on the same account.

## 3. Character search contract

V1 player discovery uses **character name only**.

Rules:
- case-insensitive;
- trim surrounding whitespace;
- prefix search is allowed;
- duplicate character names are allowed;
- duplicate-name results must remain separate records;
- UI should show supporting public data such as Level, avatar/profile icon, and Guild name when available;
- Account ID is not exposed as a social search method.

Exact-name search may return multiple characters.

## 4. Presence

Use one shared server-side activity source such as `last_active_at` for Friend and Guild rules.

Friend UI:
- Online = activity within 5 minutes.
- Offline = more than 5 minutes.
- V1 does not display detailed "last seen" text.

Guild succession uses separate thresholds defined in Guild V1; it must not equate Friend "Online" with succession eligibility.

Presence writes must be lightweight and must not require permanent realtime connections in V1.

## 5. Shared block primitive

Block is directional and character-scoped.

If A blocks B:
- friendship between A/B ends;
- pending Friend requests between A/B are cancelled;
- new Friend requests between A/B are denied while either direction is blocked;
- Direct Message sending between A/B is denied;
- A does not see B's Global Chat messages;
- Guild membership and Guild permissions are not changed;
- B receives no explicit "you were blocked" notification.

Exact character search may still expose a blocked result when needed to allow unblock.

Block does not override Leader/Member Guild authority.

## 6. Unread/read state

Unread is character-scoped and server-persistent.

V1 uses unread state for:
- incoming Friend requests;
- Direct Message conversations;
- Guild Chat.

Global Chat has no unread badge in V1.

Chat implementations should prefer a deterministic cursor such as `last_read_message_id` where compatible with the real schema.

Do not mark messages read when message fetch failed.

Logout/login must not reset unread state.

## 7. Session and persistence rules

Social server state is authoritative.

Logout/login must preserve:
- Friend relationships;
- Guild membership;
- DM history within retention;
- unread state;
- blocks.

Client-side social cache is only a cache.

On session expiry/replacement, stop authenticated polling/mutations according to Login/Auth V2. Never replay a stale social mutation under a different account/character context.

## 8. Character deletion lifecycle

Deletion must not corrupt other players' social history.

Before deletion:
- if character is Guild Leader with other members, require leadership transfer first;
- a sole Leader may disband under Guild rules.

Deletion cleanup:
- remove active Guild membership when allowed;
- remove friendships;
- cancel pending Friend requests;
- remove/anonymize block rows as appropriate;
- preserve historical chat/donation records when required for other users/audit, with deleted sender identity rendered safely rather than cascading history deletion.

Guild donation history must not expose private account data after character deletion.

## 9. Idempotency and duplicate input

Mobile double-taps and network retries must not duplicate social mutations.

Critical mutations must be idempotent or protected by server constraints/transaction logic, including:
- Friend request/send/accept;
- Guild join/application acceptance;
- Guild donation;
- Chat send where duplicate retry is possible.

Frontend button disabling is not sufficient protection.

## 10. Canonical error codes

Frontend behavior must use stable error codes rather than parsing human-readable backend text.

Expected V1 codes include:
- `FRIEND_LIMIT_REACHED`
- `REQUEST_ALREADY_EXISTS`
- `BLOCKED_RELATIONSHIP`
- `NOT_FRIENDS`
- `GUILD_FULL`
- `ALREADY_IN_GUILD`
- `APPLICATION_LIMIT_REACHED`
- `NOT_GUILD_LEADER`
- `CHAT_RATE_LIMITED`
- `MESSAGE_TOO_LONG`
- `CHANNEL_ACCESS_DENIED`

Implementation may add narrowly-scoped codes, but must not silently redefine these meanings.

## 11. Shared UI ownership

Friend, Chat, and Guild are **three separate full pages**. Do not combine them into one Social tab/page.

Each page may have its own internal sub-navigation.

Navigation placement must follow current `NAVIGATION-SETTINGS-V1.md` and current production navigation. Do not add duplicate destinations to More/bottom navigation without checking existing routes.

## 12. Security

All social mutations require authenticated ownership verification.

Never authorize from:
- display name;
- client-supplied role;
- client-supplied Guild ID alone;
- client-supplied friendship flag;
- cached frontend membership.

Sanitize all user-authored text and enforce all limits server-side.

## 13. Migration and implementation rules

Before implementation:
- inspect latest `main`;
- inspect actual character/account schema and API Worker;
- reuse the production character key;
- use forward-only additive migrations in the current migration lane;
- never replay/recreate existing production migrations;
- preserve existing save/player data.

This design document does not assign concrete table/column names where current production schema must decide them.
