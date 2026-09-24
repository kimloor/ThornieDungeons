# W3 Guild Chat + Social Integration — Implementation Preparation

Status: **FROZEN PREPARATION / DOCS ONLY — implementation not started**

Prepared from latest `main` at `f047cedba64157f6cf20fb9d800ac23cf4437c63`.

Authoritative parent contracts:
- `AGENTS.md`
- `ACTIVE-DEVELOPMENT-ROADMAP-V1.md`
- `CHAT-SYSTEM-V1.md`
- `GUILD-SYSTEM-V1.md`
- `SOCIAL-SYSTEM-V1.md`
- current production Chat/Guild code and schema

This file freezes the W3 implementation boundary. It does **not** authorize runtime/backend changes by itself.

---

## 1. Existing production facts

Current Chat V1:
- Global + Direct are implemented.
- `chat_messages` already supports `channel='guild'` and `guild_id`.
- `idx_chat_guild(guild_id, created_at DESC)` already exists.
- migration `0016_chat_v1.sql` added `conversation_key` and `chat_read_state`.
- migration `0018_social_audit_hotfix.sql` added per-sender `client_nonce` send idempotency.
- Global initial load uses latest 50; incremental reads use `afterId`.
- polling is lightweight incremental polling.
- current retention is Global 7 days / Direct 30 days.
- current read state is persistent and character-scoped.
- current retention cleanup assumes every `chat_read_state.conversation_key` belongs to Direct Chat and must be generalized for Guild Chat.

Current Guild V1:
- current membership truth is `guild_members`.
- one character can belong to only one Guild.
- `joined_at` already exists on Guild membership.
- leave, kick and disband are implemented.
- Guild Page currently contains a disabled Guild Chat shortcut.
- block does not modify Guild membership or Guild authority.

Migration inventory inspected:
- `0016_chat_v1.sql`: present.
- `0017_guild_v1_core.sql`: present.
- `0018_social_audit_hotfix.sql`: present.
- `0019`: **not present at preparation time**.

---

## 2. Architecture lock

W3 extends the existing Chat engine. Do not create a second Guild-specific chat system.

Logical channels remain:
- Global
- Guild
- Direct

Storage:
- reuse `chat_messages`.
- Guild message row:
  - `channel='guild'`
  - `guild_id=<authoritative current guild>`
  - `from_character_id=<authenticated character>`
  - `from_name=<server-derived character name>`
  - `message=<sanitized plain text>`
  - `client_nonce=<client retry nonce>`
  - `conversation_key=NULL`
  - `to_character_id=NULL`

Authorization:
`session -> verifySocialActor() -> read current guild_members row -> Guild Chat action`

Never authorize Guild Chat from:
- client-supplied Guild role;
- cached frontend membership;
- Guild name;
- arbitrary client `guildId` without current membership verification.

Guild membership remains the only Guild authority.

---

## 3. Schema / migration plan

### Decision: no W3 migration is required on the current schema

Reuse:
- `chat_messages.channel/guild_id`;
- existing `idx_chat_guild`;
- existing `chat_messages.client_nonce`;
- existing `chat_read_state`.

Guild read-state key:

```text
guild:<guildId>
```

Example:

```text
character_id = char_123
conversation_key = guild:guild_456
last_read_message_id = 912
```

No new:
- `chat_channels`;
- `chat_channel_members`;
- Guild membership mirror;
- Guild unread table.

If implementation discovers a real schema limitation not visible from current `main`, stop and document it before adding a migration. Do not create a migration merely for architectural symmetry.

### Required retention-cleanup change

Current cleanup prunes `chat_read_state` as though every key is a Direct `conversation_key`. W3 must change cleanup so:
- Direct keys continue to be retained/pruned correctly;
- `guild:<guildId>` keys are not deleted merely because they are not Direct conversation keys;
- stale Guild read state is removed when membership is invalidated or the Guild no longer exists.

---

## 4. Guild membership / history lifecycle

### Join / accepted application

After a successful new membership:
1. membership is committed first;
2. initialize the character's Guild read cursor to the Guild's current maximum message ID;
3. old retained messages may still be shown as history, but they do **not** become historical unread.

This rule also applies to rejoin.

Reason:
- new/rejoining members may view latest 50 retained messages;
- old membership unread must never be restored;
- only messages after the new membership starts should create new unread.

### Leave

Successful leave must immediately:
- remove Guild Chat read/send authorization;
- delete `chat_read_state(character_id, 'guild:<oldGuildId>')`;
- stop active Guild polling on the frontend after the response/current membership refresh.

### Kick

Successful kick must immediately:
- invalidate target access;
- delete target Guild read state for that Guild.

### Disband

Successful disband must:
- invalidate all members' Guild Chat access;
- clear all Guild read-state keys for the Guild;
- Guild messages may be removed by the existing Guild FK/cascade lifecycle; do not preserve an active channel for a deleted Guild.

### Rejoin

Rejoin is a new membership session:
- no restoration of old unread;
- latest 50 retained messages may be loaded;
- read baseline is initialized to the maximum message ID that existed before/at membership creation;
- new messages after rejoin create unread normally.

---

## 5. Guild Chat API contract

Use lower_snake_case errors.

### GET `action=getGuildChat`

Request:
```text
characterId
afterId=0 | message id
```

Do not require client `guildId`; derive it from current membership.

Initial load:
- latest 50 visible Guild messages;
- subject to 14-day retention;
- return oldest -> newest for rendering.

Incremental:
- messages with `id > afterId`;
- ascending order;
- bounded result size consistent with the current Chat engine.

Block filtering:
- hide messages whose sender is blocked by the viewer;
- filter **before LIMIT**, same safety rule as Global Chat;
- the blocked relationship changes visibility only, never membership/role/authority.

Success:
```json
{
  "ok": true,
  "guild": { "guildId": "...", "name": "..." },
  "messages": [
    {
      "id": 123,
      "characterId": "...",
      "name": "...",
      "text": "...",
      "createdAt": "..."
    }
  ]
}
```

Errors:
- `not_guild_member`
- `channel_access_denied`
- normal Auth V2/session errors

### POST `action=sendGuildMessage`

Request:
```json
{
  "action": "sendGuildMessage",
  "characterId": "...",
  "text": "...",
  "nonce": "client-generated UUID-class value"
}
```

Server:
- derive current Guild from `guild_members`;
- verify membership at send time;
- use existing sanitation;
- max length: **300 characters**;
- rate target: same Guild/Direct class, approximately 1 send / 1–2 seconds;
- reuse existing `client_nonce` idempotency pattern;
- author name comes from server character row.

Success:
```json
{
  "ok": true,
  "id": 123,
  "createdAt": "...",
  "guildId": "...",
  "replay": false
}
```

A replay of the same successful logical send returns the original result with `replay:true`.

Errors:
- `not_guild_member`
- `channel_access_denied`
- `message_empty`
- `message_too_long`
- `chat_rate_limited`

Blocking another member does **not** prevent either member from sending to the Guild channel.

### POST `action=markGuildChatRead`

Request:
```json
{
  "action": "markGuildChatRead",
  "characterId": "..."
}
```

Server:
- verify current membership;
- derive current Guild;
- find Guild's current max message ID;
- upsert `chat_read_state` using `guild:<guildId>`;
- cursor must only move forward.

Mark-read may advance across currently hidden blocked messages. This prevents an old hidden message from becoming a false unread if the sender is later unblocked.

Success:
```json
{
  "ok": true,
  "guildId": "...",
  "lastReadMessageId": 123
}
```

### GET `action=getGuildChatStatus`

Purpose:
- lightweight persistent unread/badge state;
- usable from Chat Page and Guild Page without loading full Guild history.

Request:
```text
characterId
```

Success while a member:
```json
{
  "ok": true,
  "guild": { "guildId": "...", "name": "..." },
  "unread": true
}
```

Success without a Guild:
```json
{
  "ok": true,
  "guild": null,
  "unread": false
}
```

Unread is a **boolean V1 badge**, not an exact count.

Unread is true only when there is a message:
- in the current Guild;
- newer than the stored read cursor;
- not sent by the viewer;
- not currently hidden by the viewer's block list.

A user's own Guild messages never create unread for that user.

---

## 6. Retention

Lock:
- Global: 7 days
- Guild: **14 days**
- Direct: 30 days

Add central:
```text
CHAT_GUILD_RETENTION_DAYS = 14
CHAT_GUILD_MAX_LEN = 300
CHAT_GUILD_RATE_MS = Direct-class rate
```

`runChatRetentionCleanup()` must delete expired `channel='guild'` rows using the 14-day cutoff.

Cleanup must not break monotonic message-ID cursors.

---

## 7. Frontend boundary

### Reuse ChatScreen

Do not create `GuildChatScreen` as a second engine.

Extend existing Chat Page tabs:
- Global
- Guild
- Direct
- Sticker placeholder remains UI-only / Coming Soon

Guild tab:
- no Guild -> compact "ยังไม่มีกิลด์" empty state; no polling/composer;
- member -> load current Guild channel;
- current message list remains visible during transient poll failure;
- send composer uses existing Chat send interaction pattern.

### Shared entry state

Guild Page shortcut and Chat Page Guild tab must enter the same `ChatScreen` Guild channel state/API.

Recommended App boundary:
- extend the current Chat deep-link intent model (currently Direct uses `chatDirectTarget`);
- add one channel intent such as `chatInitialChannel = 'guild'`;
- Guild shortcut sets Chat as destination and Guild as initial channel;
- normal Chat entry may default to the current approved tab behavior.

Do not duplicate Guild message state in `GuildScreen`.

### Character switch isolation

Every Guild Chat effect/state must be scoped by `characterId`.

On character/session change:
- clear message/cursor/read state held in React;
- cancel/ignore stale in-flight responses;
- stop polling timers;
- reload membership/unread for the new character;
- never apply a response from character A into character B's screen.

Auth V2 invalidation/replacement stops polling immediately.

---

## 8. Polling / reconnect / loading / error

Use the existing Chat polling strategy.

Active Guild tab:
- initial fetch immediately;
- normal interval approximately 3–5 seconds;
- incremental `afterId`;
- stop polling when Chat Page/Guild tab is inactive;
- bounded retry backoff, e.g. 3s -> 5s -> 10s cap;
- after success, return to normal interval.

Failure behavior:
- keep already-rendered messages;
- show compact reconnect/error state;
- do not clear history on a transient error;
- do not mark read after failed fetch;
- no request storm.

Membership/access failure:
- `not_guild_member` / `channel_access_denied` is not a transient reconnect state;
- stop Guild polling;
- clear active Guild channel access;
- refresh Guild status/membership.

---

## 9. Badge and navigation behavior

W3 does not add a new bottom-nav destination.

V1 Guild unread indicator:
- Guild tab inside Chat: unread dot;
- Guild Page "Guild Chat" shortcut: same unread dot;
- both are fed by the same server-persistent Guild read state.

Do not create a second independent unread cache.

No Global unread badge.

Do not broaden W3 into a redesign of `GameDock` or More menu. Any app-wide Chat badge beyond these two W3 surfaces requires separate approval.

---

## 10. Mobile / safe-area contract

Preserve current shared responsive/safe-area foundation.

Guild Chat must verify:
- message list can scroll without hiding composer;
- composer stays above bottom safe area/shared navigation;
- keyboard-open viewport remains usable;
- long 300-char plain-text messages wrap;
- reconnect/error indicator does not push composer offscreen;
- tab controls remain usable at mobile widths;
- no horizontal overflow;
- touch targets remain consistent with current shared UI.

Do not scale the entire page as one bitmap/container.

---

## 11. Focused test matrix

### Schema / migration
- current schema works without W3 migration;
- no recreation/replay of migration_v3 / 0016 / 0017 / 0018;
- no duplicate chat/membership tables.

### Authorization
- non-member cannot read Guild Chat;
- non-member cannot send;
- member can read/send current Guild only;
- stale client Guild state cannot authorize;
- character A cannot read using character B membership.

### Initial / incremental fetch
- initial returns latest <=50, oldest -> newest;
- 14-day cutoff respected;
- incremental `afterId` returns newer rows only;
- blocked senders filtered before LIMIT;
- blocking does not change membership/role.

### Send
- 300-char boundary;
- sanitation/plain text;
- rate limiting;
- nonce retry returns replay without duplicate insert;
- own send does not create own unread.

### Unread
- persisted across logout/login;
- incoming visible message sets unread;
- mark read clears;
- read cursor never regresses;
- blocked hidden message does not create unread;
- Global remains no-unread;
- Direct unread behavior remains unchanged.

### Membership lifecycle
- join initializes baseline; old retained history is readable but not unread;
- leave immediately denies read/send and clears old Guild read state;
- kick immediately denies target and clears target read state;
- disband invalidates all Guild Chat state;
- rejoin gets latest 50 retained history with fresh unread baseline;
- joining another Guild cannot inherit old Guild cursor.

### Frontend
- Chat Guild tab and Guild shortcut open same engine/state;
- no-Guild empty state;
- loading state;
- transient polling failure retains messages;
- bounded reconnect/backoff;
- access loss stops polling;
- Direct/Global regression;
- character switch isolation;
- session replacement stops polling.

### Navigation / responsive
- existing Friend/Chat/Guild routes remain reachable;
- no duplicate Guild Chat page;
- Guild unread dot consistent on Chat tab + Guild shortcut;
- mobile/tablet/desktop;
- safe area;
- keyboard/composer;
- no overflow.

### Standard verification
- `node build.js`
- generated inline-JS syntax
- existing Chat/Social/Guild/navigation tests
- new focused Guild Chat tests
- authenticated staging E2E before release

---

## 12. Explicit exclusions

W3 must not implement:
- Sticker backend;
- sticker assets/inventory/store;
- Party Chat;
- Trade Chat;
- Raid Chat;
- Guild Quest;
- Guild Shop;
- Guild War;
- realtime WebSocket/Durable Object migration;
- message edit/delete;
- Guild moderation roles beyond current Guild authority;
- unrelated economy/Donation changes.

W2 Donation and W3 Guild Chat must remain independently reviewable even if both touch Guild UI.

---

## 13. Work implementation prompt skeleton

```text
THORNIEDUNGEONS — W3 GUILD CHAT + SOCIAL INTEGRATION
STATUS: READY_FOR_DEV
MODE: COMPACT
RISK: HIGH

REPO:
kimloor/ThornieDungeons

BASE:
latest main

READ FIRST:
- AGENTS.md
- docs/ACTIVE-DEVELOPMENT-ROADMAP-V1.md
- docs/W3-GUILD-CHAT-V1-PREP.md
- docs/CHAT-SYSTEM-V1.md
- docs/GUILD-SYSTEM-V1.md
- docs/SOCIAL-SYSTEM-V1.md
- current Chat/Guild frontend + worker
- migrations 0016–latest

IMPLEMENT W3 ONLY.

LOCK:
- reuse chat_messages + guild_id
- current guild_members authorization
- NO migration unless latest schema materially changed
- latest 50 initial history
- Guild retention 14d
- persistent read key guild:<guildId>
- join/rejoin fresh unread baseline
- leave/kick/disband immediate access + unread invalidation
- blocked sender hidden for blocker only; Guild authority unchanged
- Guild shortcut + Chat Guild tab use same ChatScreen engine
- character/session isolation
- bounded polling backoff
- Guild unread dot on Chat Guild tab + Guild shortcut only
- mobile/safe-area

ADD API:
- getGuildChat
- sendGuildMessage
- markGuildChatRead
- getGuildChatStatus

DO NOT:
- Sticker backend
- Party/Trade/Raid Chat
- Guild Quest/Shop/War
- unrelated Donation/economy work
- duplicate chat/membership tables

TEST:
- build + generated syntax
- focused Guild Chat backend tests
- existing Chat/Direct/Global regression
- Guild lifecycle/unread/block tests
- navigation/responsive tests
- staging authenticated E2E

DELIVER:
THORNIE_DEV_HANDOFF
STATUS: READY_FOR_QA
include BASE_SHA / HEAD_SHA / branch / migrations / changed files / tests / staging evidence
DO NOT merge main before QA.
```

---

## 14. Implementation gate

W3 is ready for Work implementation when:
- latest main is synced;
- W2 work, if concurrently active, is isolated to a separate branch/PR;
- implementation follows this frozen contract;
- any discovered schema conflict is reported before adding a migration.

This preparation document does not deploy or modify production behavior.
