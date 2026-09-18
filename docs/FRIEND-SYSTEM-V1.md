# Friend System V1

Status: **ACTIVE-DESIGN**

Depends on `SOCIAL-SYSTEM-V1.md`. Friend relationships are character-scoped.

## 1. V1 scope

Friend V1 includes:
- Friend List;
- character-name search;
- Send Friend Request;
- Incoming Requests;
- Outgoing Requests;
- Accept;
- Reject;
- Cancel outgoing request;
- Remove Friend;
- Block / Unblock;
- Friend Profile;
- Direct Chat entry for accepted friends;
- Online/Offline indicator.

Not V1:
- gifting;
- support bonuses;
- notes;
- friend groups;
- favorite/pin behavior;
- Party integration.

Favorite Friend may be considered in V2; V1 must not require it.

## 2. Capacity

Friend cap = **50 per character**.

This value must be defined centrally/configurably so V2 can change it without scattered hard-coded values.

A Friend Request may still be sent to a character whose Friend List is currently full.

Capacity is checked again at **Accept** time for both characters:
- if either side is at cap, Accept fails with `FRIEND_LIMIT_REACHED`;
- the request remains pending and may be accepted later if a slot opens.

## 3. Search

Search uses **character name only**.

Do not expose Account ID as a Friend search path.

Search rules follow Social V1:
- case-insensitive;
- prefix search;
- duplicate names allowed;
- multiple matching records may be returned.

Minimum public result fields:
- display name;
- character Level;
- avatar/profile icon when available;
- Guild name when available;
- relationship/action state.

Do not expose private account/save/inventory data.

## 4. Friend Request lifecycle

Logical lifecycle:
- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `CANCELLED`
- `EXPIRED`

Request expiry = **7 days**.

Outgoing pending cap = **20 requests per character** for V1.

Rules:
- cannot request self;
- cannot create duplicate pending request;
- cannot request an existing friend;
- cannot request while either direction is blocked;
- cross-request must not create two competing rows.

If A has a pending request to B and B tries to request A, server should return the existing reverse-pending state so B can Accept/Reject instead of creating a second request.

## 5. Accept

Accept must atomically:
- verify request still pending/not expired;
- verify no block exists in either direction;
- verify neither character is already a friend of the other;
- verify both Friend Lists have capacity;
- create exactly one friendship;
- resolve the request.

Database uniqueness/transaction rules must prevent duplicate A-B/B-A friendships.

## 6. Friendship storage concept

Store one canonical friendship pair rather than two directional friendship rows.

The implementation may normalize pair ordering using stable character IDs.

Friend Requests and Blocks remain directional.

## 7. Remove Friend

Remove Friend:
- deletes/ends active friendship;
- does not create a block;
- preserves existing Direct Message history under Chat retention rules;
- immediately prevents new DM sending because the pair is no longer friends;
- allows a new Friend Request later if neither side is blocked.

No unfriend cooldown in V1.

## 8. Block / Unblock

Uses shared Social block behavior.

Block:
- removes active friendship;
- cancels pending Friend Requests in both directions;
- prevents future Friend Requests and DM while either direction remains blocked.

Unblock:
- removes only the blocker -> blocked relation;
- does not automatically restore friendship;
- does not automatically resend prior Friend Requests.

Friend Page must provide a Blocked section so users can unblock.

## 9. Friend Profile

V1 Friend Profile shows only lightweight public social information:
- avatar/profile icon;
- character name;
- Level;
- Guild name when present;
- Online/Offline;
- Chat action for accepted friends;
- Remove Friend;
- Block.

Not V1:
- full equipment inspection;
- private inventory;
- detailed save data;
- achievement/arena/floor showcase unless separately approved.

## 10. Presence and ordering

Presence follows Social V1:
- Online within 5 minutes;
- otherwise Offline.

Friend List should present Online friends before Offline friends. Secondary ordering can be stable/name-based unless later approved.

V1 does not expose detailed last-seen time.

## 11. UI structure

Friend is a dedicated full page.

Recommended internal sections/tabs:
- Friends;
- Requests;
- Blocked.

Requests page separates:
- Incoming;
- Outgoing.

Incoming unseen requests may drive a Friend badge.

## 12. Direct Message dependency

Direct Message requires an active friendship.

Removing/blocking a friend:
- does not erase existing DM history;
- prevents new sends.

If the same characters become friends again later, reuse the prior direct conversation where safely supported rather than creating duplicate parallel conversations.

## 13. Race conditions

Server behavior must be deterministic for:
- simultaneous Accept/Block;
- simultaneous capacity changes;
- duplicate Accept;
- cross-requests;
- Remove while another mutation is in flight.

Block takes precedence over creating/continuing friendship.

Frontend state is never sufficient to enforce these rules.

## 14. V2 candidates

Possible V2 additions:
- configurable higher Friend cap;
- favorites/pins;
- notes/groups;
- gifting;
- support characters;
- Party integration;
- richer Friend Profile.

These are not implementation requirements for V1.
