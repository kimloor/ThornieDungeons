# Arena V2 W9 — Implementation Roadmap

Status: **READY_FOR_IMPLEMENTATION — HIGH RISK**

Branch:
- `feat/w9-arena-v2`

Base:
- `c101ead2e4a36ed7bed9c895fe9aadbb16400ebf`

Source of truth:
- `docs/ARENA-V2-W9.md`

Supporting contracts:
- `AGENTS.md`
- `docs/ACTIVE-DEVELOPMENT-ROADMAP-V1.md`
- `docs/PHASER-COMBAT-ARENA-V1.md`
- `docs/BATTLE-SYSTEM-V1.md`
- `docs/SAVE-RELIABILITY-V1.md`
- `docs/LOGIN-AUTH-V2.md`

## Goal

Ship full Arena V2 with the approved Arena Hub, Arena Setup, weekly seasons, Ticket V2, Arena Coin, matchmaking, bots, tactical Battle Core combat, Phaser 2v2 presentation, History/Revenge, seasonal rewards and global Top-3 Profile Frames.

Arena V2 must be deployed additively. Arena V1 cleanup is a separate post-production-verification step.

## Locked architecture

- Battle Core remains authoritative for combat resolution.
- Server remains authoritative for matchmaking, setup validation, tickets, seasons, rating, rewards, timeout and settlement.
- Phaser remains presentation-only.
- Existing shared Phaser renderers/assets/VFX architecture must be reused.
- Source edits require `node build.js`.
- User-visible staging fixes must bump the visible preview patch version.
- No production deploy during W9 implementation without explicit authorization.
- Do not remove Arena V1 data/schema before Arena V2 production verification.

## W9.0 — Safety foundation
**Status: COMPLETE — CI PASS**

Purpose: prevent shared-combat drift before Arena rules change.

Implemented:
- deterministic byte-for-byte parity guard between `src/systems/battleCore.js` and the Worker-embedded Battle Core;
- explicit `--check` / `--sync` utility in `scripts/battle-core-port.js`;
- dedicated CI guard triggered by either Battle Core copy, W9 safety tests, or this roadmap;
- reusable W9 Arena test fixtures;
- W9 baseline regressions for explicit `targetId` routing and preserved Dungeon Pet-clutch semantics;
- no gameplay behavior changes.

Verification:
- Battle Core source/Worker parity: PASS;
- targeted Battle/Raid/Auth/Save/Phaser regression suite: PASS;
- `node build.js` produces no `index.html` diff: PASS;
- CI guard fails when either Battle Core copy changes independently.

## W9.1 — Battle Core Arena rules

**Status: COMPLETE — QA APPROVED**

Purpose: add only the generic/mode-aware combat hooks Arena V2 requires.

Work:
- preserve explicit `targetId` command support;
- expose Battle-Core-owned action legality/target metadata needed by Arena UI and AI;
- reject invalid Arena target requests instead of silently submitting the wrong target;
- add Arena terminal rule: Hero death ends the match even if that side's Pet survives;
- preserve Dungeon Hero-dead/Pet-clutch behavior;
- add 20-round Arena terminal handling: after Round 20, if both Heroes live, result = Draw;
- add/retain deterministic serialization/resume coverage.

Gate:
- Dungeon behavior unchanged;
- Hero death / Pet death / Draw tests pass;
- target legality tests pass;
- no Phaser dependency inside Battle Core.

Implementation notes:
- Arena manual Hero commands use strict living enemy target validation. Invalid,
  friendly, dead and missing targets remain on the Hero action boundary without
  consuming SP, cooldown, RNG or `safeActionSeq`.
- `getActionMetadata(state, actor, command)` exposes current action usability,
  target mode, legal target IDs, target legality, SP cost and cooldown metadata.
  `getLegalTargetIds`, `isLegalTarget` and `isActionUsable` are convenience APIs
  for future Arena UI/AI callers.
- Arena Hero death is terminal while Pet death remains non-terminal. Dungeon and
  Raid continue using their existing team-alive semantics.
- Arena completes all queued actions in Round 20 and returns serializable
  `result: "draw"` when both Heroes remain alive; Round 21 is never created.
- Draw checkpoints are accepted by the existing serialization/restore contract.

## W9.2 — Shared Phaser Arena primitives

**Status: COMPLETE — QA APPROVED**

Purpose: make the existing Phaser presentation stack capable of 2v2 Arena without creating a second rendering system.

Implemented:
- shared actor-facing model with right/left defaults and whole-`visualRoot` mirroring;
- facing-driven attack/recoil motion so layered Hero equipment remains aligned while mirrored;
- shared selectable hit area + target ellipse in `PhaserBattleActor`, reused by Monster, Hero and Pet actors;
- defender Hero/Pet targetability through the existing `onTargetSelected` callback;
- responsive Arena anchors using the current Dungeon Hero/Pet scale baseline;
- `buildArenaBattlefieldSnapshot` adapter for attacker/defender Hero-only and Hero+Pet teams;
- attacker Hero/Pet face right and defender Hero/Pet face left;
- Arena snapshot carries only presentation speed (x1/x2 range) and no Skip/gameplay resolver authority;
- published Arena background key is resolved through `arenaUi.background`, with no hardcoded asset URL.

Verification:
- W9.2 + shared Phaser + W9.1 regression suite: 90/90 PASS;
- existing Dungeon anchor/presentation tests: PASS;
- Battle Core parity: PASS;
- `node build.js` produces no pending `index.html` diff: PASS;
- independent QA workflow run `36381597503`: PASS.

Gate:
- existing Dungeon Phaser presentation unchanged;
- both teams render Hero-only and Hero+Pet combinations;
- target selection works on defender Hero and Pet;
- no combat/rating/economy logic enters Phaser.

## W9.3 — Additive Arena V2 schema

**Status: COMPLETE — QA APPROVED**

Migration:
- next automated production migration at W9.3 preflight: `0022`;
- implemented filename after Admin V2 integration: `migrations/auto/0023_arena_v2_foundation.sql`;
- integration note: W9.3 was originally implemented/QA-approved as 0022; Admin V2 subsequently claimed and deployed production 0022, so Arena was renumbered to 0023 with the SQL body unchanged;
- migration QA: `tests/arena-v2-w9-schema.test.js`;
- no Arena gameplay/API/runtime implementation included.

Schema contract:
- `docs/ARENA-V2-W9-SCHEMA-CONTRACT.md`

Purpose: create V2 authoritative state without mutating/removing Arena V1 schema.

Preflight locked:
- 12 additive tables with exact ownership/index/uniqueness rules;
- persistent Ticket/Coin/Setup separated from per-season rating/stats;
- canonical unordered real-player pair counter;
- prepared/active/done Arena match state with one-open-match guard;
- action-level exact-once receipt surface;
- deterministic generic Arena idempotency receipts;
- current/old-season history keyed by season;
- first global Profile Frame entitlement + equipped-selection schema;
- existing Lv.10+ migration backfill suppresses retroactive unlock popup;
- Mailbox schema intentionally deferred to W9.8;
- dedicated `node:sqlite` migration QA matrix is defined.

QA verification:
- independent QA branch from implementation HEAD `a12e8ab4f4e29067c6e2888466178764bff020f4`;
- W9.3 schema + W9.1/W9.2/Auth/Save regression suite: 51/51 PASS;
- Battle Core parity: PASS;
- `node build.js` generated no pending `index.html` diff;
- GitHub Actions run `36429796592`: PASS.

Implementation complete:
- Admin 0022 followed by additive Arena 0023 applies against a minimal pre-production SQLite database;
- Lv.10+ existing characters are backfilled with `unlock_notice_seen = 1`;
- Arena V1 tables and legacy character ticket columns remain unchanged;
- required constraints, indexes, cascades, and exact-once identities are covered by migration tests.

Rules:
- V2 Season 1 starts players at Rating 1000/Bronze;
- later seasons explicitly insert the approved one-tier-drop reset rating;
- do not migrate V1 rating/W-L/history;
- V1 tables/columns remain intact during rollout;
- every irreversible reward/settlement path needs a deterministic idempotency/receipt key.

Gate:
- migration applies cleanly from latest production schema;
- old players/saves remain loadable;
- schema tests cover all locked uniqueness/FK/check/backfill behavior;
- repeated migration is not used as a test strategy;
- V1 paths remain available for rollback until cutover is verified.

## W9.4 — Arena server foundation

**Status: COMPLETE — QA APPROVED**

Purpose: implement non-combat Arena V2 authoritative state.

Work:
- Level 10 access gate;
- one-time unlock-popup state for characters that cross Lv.10 after V2 launch;
- no retroactive unlock popup for existing Lv.10+ characters;
- first-visit Setup initialization from active Pet + current ordered active skill Quick Slots;
- Setup sanitization for missing Pet/skills;
- read current equipped items from DB rather than storing a separate equipment loadout;
- UTC central daily Ticket reconciliation (+5, cap 10);
- passive +1 Ticket every 2 hours while below 10;
- atomic +1 Ticket purchase for 10 Diamonds;
- three-band opponent matching;
- bot fallback;
- server-enforced 10-second refresh cooldown;
- changed-list rule: successful refresh differs by at least one opponent;
- Arena Player Card server payload;
- weekly season creation/reconciliation and authoritative `seasonEndsAt`.

Implemented API surface:
- GET `getArenaV2Status`, `getArenaV2Opponents`, `getArenaV2PlayerCard`;
- POST `saveArenaV2Setup`, `purchaseArenaV2Ticket`, `refreshArenaV2Opponents`, `acknowledgeArenaV2Unlock`;
- all V2 callers use Auth V2 session validation and owned-character checks;
- legacy `getArenaStatus`, `getArenaOpponents`, `startArenaMatch` and `submitArenaTurn` remain unchanged.

Foundation behavior:
- Lv.1–9 returns a safe locked payload; Lv.10+ state is authoritative and unlock notice acknowledgement is idempotent;
- first Setup copy uses `pets_json.list[].instId` and current `character_settings.quick_slots_json`, excluding potions/passive/unowned skills;
- subsequent reads sanitize missing Pet/skills without rebuilding from later normal Pet/Quick Slot changes;
- equipment is read live from equipped `items` rows and is never persisted into `arena_setup`;
- one shared UTC Ticket reconciliation helper handles current-day/missed +5 grants, 2-hour passive ticks, cap reset and exact-once 10-Diamond purchase receipts;
- lazy season creation uses the next Sunday 16:00 UTC cutoff and one-tier-independent Season 1 initialization at Rating 1000;
- opponent state stores exactly three server-owned lower/equal/higher entries, with eligible real-player bands, stable safe bot fallback, 10-second server cooldown and identity-based changed-list refresh;
- Player Card resolves only from the persisted opponent list, uses current equipment/saved Arena Pet, and does not expose skills, priority or private account fields.

QA verification:
- focused W9.4 server foundation suite: 11/11 PASS, including inactivity beyond the former 104-week catch-up ceiling;
- Admin 0022 → Arena 0023 schema/Admin integration suite: 20/20 PASS;
- CI W9 safety regression suite: 121/121 PASS;
- Battle Core parity: PASS;
- `node build.js`: PASS; generated `index.html` has no diff;
- no W9.5 combat lifecycle implementation and no production deployment.

Gate:
- Ticket math correct across offline gaps;
- purchase cannot exceed cap;
- refresh cooldown cannot be bypassed by client;
- first Setup initializes once and later preserves saved Arena Setup.

## W9.5 — Two-phase match lifecycle

**Status: COMPLETE — READY_FOR_QA**

Purpose: satisfy the W9 rule that presentation preparation succeeds before a Ticket is consumed.

Lifecycle:
1. player opens Arena Player Card — no Ticket cost;
2. BATTLE creates/loads a short-lived prepared match snapshot;
3. client preloads required Phaser/assets;
4. successful preparation calls server activation;
5. activation atomically consumes exactly one Ticket and marks the match active;
6. later network/app failure resumes the same active match with no second Ticket.

Work:
- `prepareArenaV2Match`, `activateArenaV2Match`, and `getArenaV2Match` APIs;
- immutable attacker/defender match snapshot;
- current equipped-item-derived stats/presentation;
- Arena Pet and ordered skill setup;
- deterministic seed/state;
- prepared-state expiry/replay protection;
- resume exact match state;
- 2-minute prepared-match TTL;
- deterministic `arena:match-activate:<matchId>` receipt gate with conditional D1 batch updates;
- 10-minute deadline;
- effective deadline = min(start + 10m, seasonEndsAt);

Gate:
- failed preload consumes no Ticket;
- duplicate activation consumes one Ticket;
- resume consumes no Ticket;
- active match cannot cross season cutoff.

Out of scope and reserved for later W9 batches:
- Battle Core action/target/AI orchestration;
- settlement, surrender, timeout/cutoff results, rating, rewards and history.

## W9.6 — Arena combat orchestration and AI — COMPLETE / READY_FOR_QA

Purpose: connect Arena V2 lifecycle to shared Battle Core.

Work:
- attacker manual Hero turns;
- attacker Pet automatic;
- defender Hero and Pet AI-controlled;
- Auto toggle for attacker Hero;
- saved skill priority 1→4;
- choose first Battle-Core-legal usable skill, else Basic;
- offensive target = lowest remaining HP percentage, Hero wins ties;
- Pet targeting follows shared Pet skill behavior plus Arena target policy where applicable;
- support/self/AoE actions execute without unnecessary target tap;
- manual offensive single-target actions require legal Hero/Pet target;
- Surrender settlement;
- no Flee;
- no Skip;
- four-slot authoritative Speed Queue display;
- Round X / 20.
- `submitArenaV2Action` with `arena_match_actions` exact-once persistence;
- `setArenaV2Auto` for attacker Auto state;
- shared Battle Core command-actor seam for defender Hero AI without changing
  Arena result perspective or Dungeon/Raid behavior;
- public combat state excludes defender skill priorities and internal unit data.

Gate:
- Hero-only / Hero+Pet combinations pass;
- SP/cooldown/status/passives remain shared-core behavior;
- target behavior matches W9;
- Auto does not change rating/reward rules;
- duplicate/retried action keys return the stored response without a second
  Battle Core advance;
- surrender and normal combat completion store combat result only; W9.7 owns
  settlement/economy/rewards.

## W9.7 — Settlement, economy and rewards — IMPLEMENTED / READY_FOR_QA

Purpose: one idempotent authoritative settlement path for every Arena result.

Settlement entry points:
- normal Win;
- normal Loss;
- Draw;
- Surrender;
- timeout;
- season cutoff.

Work:
- Elo K=24 baseline;
- rating floor 1000;
- tiers Bronze/Silver/Gold/Diamond;
- symmetric pair diminishing 100% / 50% / 0%;
- no V1 minimum-delta floor after pair multiplier;
- bot win cap at 1449;
- bot wins cannot promote into Diamond;
- attacker Arena Coin reward by matchmaking slot/result;
- Attack W/D/L;
- Defense W/D/L;
- Play/Win milestones;
- once-per-tier-per-season promotion rewards;
- season eligibility;
- deterministic leaderboard tie-break;
- season rollover rating reset;
- History records;
- authoritative stored Arena Result for replay.

Exact-once requirement:
- duplicate action/settlement/retry must return the already stored result and must not duplicate rating, tickets, pair count, Coin, milestones, mail or frames.

Content dependency:
- final progression-material item ID/quantity for season rank rewards must be approved before enabling that reward component; do not guess.

Implementation boundary:
- `workers/thornie-dungeons-api.js` now owns one authoritative settlement path for normal terminal results, surrender, timeout and season cutoff.
- Settlement identity is `arena:settlement:{matchId}`; milestone, promotion, season-eligibility and season-finalization receipts use deterministic identities under the same `arena_idempotency_receipts` table.
- Rating/stat/pair/Coin/history/result writes are guarded by season-player state CAS and committed through one D1 batch; replay reads the stored `result_json` and never recalculates.
- Real-player pair encounters are canonicalized by unordered character ID; bot wins are capped at 1449 and cannot promote into Diamond.
- A season-cutoff settlement is Coin-only: it persists the authoritative result/history and base slot Coin, but does not move rating, pair counts, W/D/L stats, milestones, promotion rewards or season eligibility.
- Terminal combat commits are recoverable: action replay and season finalization sweep done-but-unsettled matches and return the stored authoritative settlement result.
- Recovery respects the authoritative terminal timestamp: a result completed before season cutoff keeps its normal/surrender settlement even if recovery runs after cutoff; only unresolved active matches (or terminal rows completed at/after cutoff) use cutoff Coin-only settlement.
- Live and final rank ordering is identical: rating DESC, Attack Wins DESC, rating_reached_at ASC, character_id ASC. Result/history rating deltas are computed after floor and bot-cap clamping.
- Season rollover finalizes expired active and terminal-but-unsettled matches, ranks by rating → Attack Wins → rating reached time → character ID, and initializes the next season with the locked one-tier-drop base.
- Arena Coin and Diamonds settle immediately where approved. Progression-material reward is explicitly disabled pending an approved item ID/quantity. W9.8 now owns delayed mailbox identity/claim receipts and global frame delivery.
- W9.5/W9.6 combat action receipts and Ticket activation semantics remain unchanged; W9.8 adds only additive migration 0024 for mailbox source/claim identities.

## W9.8 — Mailbox + global Profile Frames

Purpose: support delayed/offline Arena rewards safely.

Mailbox:
- add the reward payload/receipt support needed for Arena Coin and W9 reward delivery;
- make Arena reward mail idempotent by deterministic source/receipt identity;
- harden Claim All so concurrent/replayed claims cannot return duplicate rewards.

Profile Frames:
- implement a real global frame entitlement model;
- Rank 1 / Rank 2 / Rank 3 are distinct 7-day entitlements;
- new seasonal frame auto-equips immediately;
- prior frame entitlement remains;
- server rejects expired equipped frames;
- expired entitlement remains recorded but disabled;
- Player Card/social surfaces render the currently valid equipped frame.

Graphics dependency:
- Graphics PR #32 is published on main and preserved on the W9 branch;
- use manifest keys `arenaUi.background`, `profileFrames.arenaRank1`, `profileFrames.arenaRank2`, `profileFrames.arenaRank3`, `itemIcons.currency.arenaCoin` and `itemIcons.currency.arenaTicket`;
- frame geometry/face-safe rules are documented in `r2-upload/ui/arena/GRAPHICS_CONTRACT.json`; do not invent alternate asset paths.

Gate:
- repeated reward delivery produces one reward;
- expiry fallback works even with stale client cache;
- Player Card uses shared frame state.

Implementation status:
- migration `0024_arena_w98_rewards.sql` adds deterministic mailbox `source_key` and Claim All receipts;
- season finalization grants Rank 1/2/3 entitlements with deterministic identity and auto-equips the new 7-day frame;
- expired equipped frames are disabled and omitted from Arena/Player Card responses.

## W9.9 — Arena V2 frontend + staging QA

Frontend:
- locked view below Lv.10;
- four tabs: BATTLE / SETUP / RANKING / HISTORY;
- compact season countdown;
- extend global currency row with Arena Coin + Arena Ticket;
- currency detail popups;
- Setup editor with one atomic SAVE SETUP;
- three opponent rows;
- Arena Player Card + Loading Battle flow;
- Phaser Arena battlefield;
- hybrid target UX;
- Auto / Surrender;
- compact 1–2 line battle log + full log view;
- persistent full Result until BACK TO ARENA;
- History Attack/Defense 5+5;
- Revenge;
- Ranking summary/reward bands;
- force-fetch season state at countdown zero;
- return to BATTLE and changed-list refresh after Result confirmation.

Implementation status:
- `ArenaV2Screen` is the active Arena route and uses the authoritative V2 status/opponent/match/history/ranking APIs;
- generated `index.html` is refreshed only by `node build.js`.

Production Browser QA follow-up — Ver 1.0.20:
- Arena Hub now renders the approved `arenaUi.background` asset instead of the generic dungeon backdrop alone;
- Arena Coin and Arena Ticket render from `itemIcons.currency.arenaCoin` / `itemIcons.currency.arenaTicket`;
- shared Dungeon Combat Phaser and Inventory Hero Preview are production-default with explicit `=0` opt-out fallbacks;
- no Battle Core, rating, ticket, reward, schema or settlement behavior changed.

Staging:
- every user-visible staging fix increments preview patch version;
- test small-screen safe area/overflow/touch targets;
- test iPhone/Safari behavior;
- test reload/background/network interruption;
- no production deploy during this batch.

Final W9 QA gates:
- migration/schema;
- auth/session;
- tickets;
- setup;
- matchmaking/refresh/bots;
- Battle Core regression;
- manual target/Auto/AI;
- 20-round Draw;
- resume/deadline/cutoff;
- Elo/pair diminishing;
- Arena Coin/milestones/promotion/season rewards;
- Mailbox exact-once;
- Profile Frame expiry;
- Result persistence;
- History/Revenge;
- mobile Phaser layout;
- no regression to Dungeon/Raid/Social/Inventory/Audio.

## Production cutover

Only after explicit release authorization:
1. sync W9 branch with latest main;
2. run final QA;
3. merge approved W9;
4. deploy additive Arena V2;
5. verify production V2 using QA-only data;
6. confirm V2 endpoints/UI no longer depend on V1 objects.

Do not delete Arena V1 during this release.

## Post-W9 — Arena V1 cleanup

Separate controlled change after Arena V2 production verification.

Audit and remove only proven-unused legacy objects/callers, including candidates:
- `pvp_snapshots`;
- `pvp_ranking`;
- `pvp_match_log`;
- `pvp_matches`;
- old Arena ticket columns/paths;
- old Arena V1 frontend/API code;
- old public PvP leaderboard path after its V2 replacement is verified.

Cleanup must use a separate explicit migration and regression gate.

## Recommended execution order

`W9.0 → W9.1 → W9.2 → W9.3 → W9.4 → W9.5 → W9.6 → W9.7 → W9.8 → W9.9 → Production Verification → V1 Cleanup`

Do not skip W9.0 or collapse schema, lifecycle, settlement and frontend work into one uncontrolled batch.
