# Chat System V1

Status: **ACTIVE-DESIGN**

Depends on `SOCIAL-SYSTEM-V1.md` and, for Direct Message access, `FRIEND-SYSTEM-V1.md`.

## 1. V1 channels

Chat V1 supports:
- Global Chat;
- Guild Chat;
- Direct Message.

All messages are character-authored and use canonical character identity server-side.

Global Chat is one shared room for V1.

Do not display Guild tag beside character names in Global Chat.

## 2. Channel model

Use one reusable channel/message architecture where practical rather than separate unrelated message engines.

Logical channel types:
- `GLOBAL`
- `GUILD`
- `DIRECT`

Global does not require per-character membership rows.

Guild access is derived from current Guild membership; do not duplicate Guild authority in chat membership state if avoidable.

Direct channels contain exactly two character participants and must not create duplicate parallel channels for the same pair.

## 3. Direct Message rules

DM is Friend-only in V1.

Server must verify active friendship at send time.

If friendship is removed:
- existing history remains readable within retention;
- new sends are denied.

If the same pair becomes friends again, reuse the existing conversation when safely supported.

If either direction is blocked, DM send is denied.

## 4. Guild Chat rules

Guild Chat requires current Guild membership.

Leaving/changing Guild:
- immediately removes access to send/read active Guild Chat;
- Guild unread state for the old Guild is cleared/invalidated;
- rejoining later follows new-member history rules rather than restoring unlimited historical access.

New/rejoining members may initially load the **50 latest Guild messages** subject to retention.

Guild Chat history belongs to the Guild, not to an individual character.

Block does not alter Guild membership or Leader authority. A blocker may hide the blocked character's Guild messages in their own view, but Guild moderation/permission logic remains independent.

## 5. Global Chat rules

One Global room in V1.

Global has no unread badge.

If A blocks B, A does not see B's Global messages.

No Guild tag is shown beside sender name in V1.

## 6. Polling / realtime strategy

V1 uses lightweight incremental polling, not a required WebSocket/Durable Objects architecture.

Rules:
- poll only while Chat UI/conversation is active;
- baseline interval approximately 3–5 seconds;
- fetch only messages after a cursor/message ID;
- stop polling when page/conversation becomes inactive;
- do not reload complete history every poll;
- on failure, retain already-rendered messages;
- retry with bounded backoff, e.g. 3s -> 5s -> 10s cap;
- return to normal interval after recovery.

Do not create request storms during outages.

Realtime infrastructure may be reconsidered in V2 if scale requires it.

## 7. Retention

V1 retention targets:
- Global: **7 days**
- Guild: **14 days**
- Direct Message: **30 days**

Retention values should be central/configurable where practical.

Deletion/cleanup must not break currently valid pagination/cursor behavior.

## 8. Message limits

Server-enforced V1 maximums:
- Global: **200 characters**
- Guild: **300 characters**
- Direct: **300 characters**

User text is plain text only.

Required sanitation:
- no trusted HTML;
- normalize unreasonable whitespace;
- strip/reject unsafe control characters;
- bound newline behavior;
- server-side length validation.

## 9. Rate limits

V1 baseline:
- Global: approximately 1 send / 3 seconds;
- Guild/Direct: approximately 1 send / 1–2 seconds.

Backend must also protect against bursts/retry abuse.

Exact implementation constants may be tuned without changing gameplay contract as long as they preserve anti-spam intent and user usability.

Rate-limit failure uses `chat_rate_limited`.

## 10. Read/unread

Unread is used for:
- each Direct conversation;
- Guild Chat.

Global has no unread count.

Prefer deterministic per-character read cursor such as `last_read_message_id`.

Do not mark read on failed fetch.

Unread persists across logout/login.

## 11. Message edit/delete

User-facing message edit and self-delete are **not V1**.

Schema may preserve a moderation-safe deletion/tombstone field such as `deleted_at` if useful, but this does not authorize user delete/edit UI.

Do not cascade-delete conversation history merely because a sender character was deleted.

## 12. Sticker placeholder

Chat V1 UI reserves a Sticker tab/button/entry point for future use.

V1 behavior:
- visual placeholder/disabled/Coming Soon is allowed;
- no sticker assets are required;
- no sticker inventory/store is required;
- no sticker message type/backend support is required.

Sticker sending belongs to a later Chat version unless explicitly approved.

## 13. UI ownership

Chat is a dedicated full page, separate from Friend and Guild.

Internal Chat navigation may expose:
- Global;
- Guild;
- Direct.

Direct section should provide a conversation list and unread counts.

Guild Chat may also have a shortcut from Guild Page, but both entry paths must open the same Guild Chat state rather than duplicate message systems.

## 14. Failure/recovery

On polling/fetch failure:
- keep current messages visible;
- show a compact reconnect/error state;
- retry with bounded backoff;
- do not falsely mark unread as read.

On session expiry/replacement:
- stop polling;
- follow Auth V2 handling;
- never continue as another character/account with stale channel state.

## 15. Data model concept

Implementation should inspect latest production schema first.

Conceptual entities:
- `chat_channels`
- `chat_channel_members` for Direct channels where useful
- `chat_messages`
- per-character read state

Guild membership remains authoritative from Guild System.

Global membership need not be materialized for every character.

## 16. V2 candidates

Not V1:
- sticker sending;
- system channels;
- Party Chat;
- Trade Chat;
- Raid Chat;
- reactions;
- pinned messages;
- user message edit/delete;
- richer moderation/report/mute UI;
- WebSocket/realtime infrastructure if scale justifies it.
