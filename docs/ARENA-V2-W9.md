# ThornieDungeons — Arena V2 / W9

Status: **COMPLETE — PRODUCTION VERIFIED / W9 CLOSED**

Last design lock: 2026-09-28  
Final production closeout: 2026-10-01  
Baseline main when this contract was recorded: c7bc3fe350d5cc8b08d3162f16e2daf803e5cefd

This document is the dedicated gameplay, economy, UX, season, persistence and presentation contract for W9 Arena V2.

For W9, this document overrides older Arena assumptions that W9 is presentation-only. Shared Phaser architecture and Battle Core authority remain valid, but the old Arena V1 UI/API/data model may be replaced where required by this contract.

---

## 1. W9 scope and authority

W9 is a full Arena V2 redesign plus Phaser battle presentation.

Core rules:
- asynchronous tactical PvP;
- attacker controls own Hero;
- attacker Pet is automatic;
- defender Hero and Pet are AI-controlled from Arena setup/snapshot;
- opponent does not need to be online;
- Battle Core remains authoritative for combat resolution;
- Phaser remains presentation-only;
- server remains authoritative for matchmaking, tickets, rating, season state, rewards, setup validation, timeout, history and settlement;
- do not fork Dungeon and Arena into separate combat resolvers when shared Battle Core behavior can be reused;
- no production deployment until explicitly authorized under normal release flow.

W9 is HIGH risk: use a dedicated feature branch, focused tests, staging/user verification and QA before release.

---

## 2. Unlock and first-entry flow

Arena unlock level: **Lv.10**.

Lv.1–9:
- Arena entry remains visible;
- entering Arena shows a simple locked view:
  - ARENA
  - Unlock at Level 10
  - Current Level
  - Back.

When a character crosses to Lv.10:
- show one-time Arena unlocked popup;
- popup is per character and must not repeat on reload/login;
- existing Lv.10+ characters at Arena V2 launch do not receive a retroactive unlock popup.

First Arena V2 visit:
- initialize Arena Setup by copying current active Pet and up to four current active skills in their current order;
- equipment is not copied because Arena always reads actual equipped items;
- redirect directly to SETUP tab;
- no onboarding popup.

Later Arena visits:
- default to BATTLE tab unless an active match requires resume handling.

---

## 3. Arena Hub UX

Approved hub concept: **Option B — Arena Hub + Tabs**.

Approved mockup reference is stored in ChatGPT Library:
ThornieDungeons/refs/arena/arena-v2-option-b.png

W9 Arena tabs:
- BATTLE
- SETUP
- RANKING
- HISTORY

SHOP tab is explicitly removed from Arena V2. Arena Coin spending will be integrated into the main Shop system in a future Shop phase.

To preserve mobile space:
- do not create a large Arena summary header;
- keep only Arena title/tabs plus season countdown;
- Tier/Rating/Rank detail belongs in RANKING;
- opponent/milestone detail belongs in BATTLE;
- setup detail belongs in SETUP;
- history/defense detail belongs in HISTORY.

Season countdown:
- sourced from server seasonEndsAt;
- at zero, while Arena Hub is open, force-fetch new Arena season state automatically;
- no season-ended popup.

---

## 4. Global Currency bar

Existing global currency UI must be extended to include:
- Gold;
- Diamond;
- Arena Coin;
- Arena Ticket.

Mobile rule:
- keep currency bar on one line;
- compact icon + amount;
- use K/M display abbreviations if required for width;
- do not wrap to a second row.

Tap behavior:
- tapping a currency opens a detail popup with exact full values;
- Arena Ticket popup includes current/max tickets, next passive ticket countdown, daily +5 rule and ticket purchase action;
- Arena Coin popup shows exact balance and a short explanation; no Arena-local shop.

Arena Ticket popup purchase:
- +1 Ticket costs 10 Diamonds;
- confirmation is a small popup with Cancel / OK;
- server transaction is atomic;
- cannot buy while at cap;
- no daily purchase limit.

---

## 5. Arena Setup

One Arena Setup is used for both offense and defense.

### 5.1 Equipment
- always use the character's currently equipped items from authoritative DB state;
- there is no Arena equipment loadout;
- SETUP displays current Hero/equipment read-only;
- tapping an equipped item opens the same style/detail data as Inventory;
- no Equip/Unequip/Sell/Dismantle/Enhance mutation is allowed from Arena;
- change equipment through Inventory.

### 5.2 Pet
- Arena Pet is selected separately from normal gameplay after first initialization;
- Pet is optional;
- no Pet means Hero fights alone;
- if stored Pet becomes unavailable/deleted/invalid, server sanitizes it to empty.

### 5.3 Skills
- Basic Attack is separate and is not one of the four Arena skill slots;
- Arena has 0–4 active skill slots;
- slots are ordered priority 1 → 4;
- passive skills remain active normally and are not slotted;
- if a stored skill is no longer owned/valid after reset/change, server sanitizes that slot to empty.

### 5.4 Save behavior
- Pet + skill priority are edited locally in SETUP;
- one SAVE SETUP button commits the full Arena setup atomically;
- do not auto-save each intermediate selection;
- leaving with unsaved edits keeps the previously saved setup.

Defense AI skill choice:
1. check priority slot 1;
2. then slot 2;
3. then slot 3;
4. then slot 4;
5. first Battle-Core-legal usable skill wins;
6. if none is usable, use Basic Attack.

No random defense skill selection.

---

## 6. Opponent selection and refresh

Arena shows exactly three opponent rows.

UI row content is deliberately minimal:
- Player Name;
- Level;
- Rating;
- BATTLE button.

Do not show on the row:
- Easy / Equal / Hard labels;
- CP;
- reward estimate;
- Arena Coin estimate;
- View button;
- avatar.

Rows are ordered by rating:
1. lower-rating target;
2. near/equal target;
3. higher-rating target.

Backend internal matchmaking bands remain:
- lower target approximately self rating -150, search approximately -225..-75;
- equal target approximately self rating, search approximately -74..+74;
- higher target approximately self rating +150, search approximately +75..+225.

The difficulty labels are internal only and are not shown to players.

Player Name tap:
- open existing-style Player Card popup.

Manual Refresh:
- free;
- server-enforced 10-second cooldown;
- while cooling down, the button is disabled and the countdown is inside the button;
- when countdown reaches zero, button becomes active;
- a successful refresh must differ from the previous three-person list by at least one opponent;
- do not add special avoid-previously-fought weighting;
- normal rating-band matching remains primary;
- bots may fill shortages and may be used to satisfy a changed-list result when real pool is too small.

After completed Battle and BACK TO ARENA:
- auto-refresh all three opponent rows;
- refreshed set must differ from the pre-battle set by at least one opponent;
- return to BATTLE tab.

---

## 7. Arena Player Card / pre-battle flow

Arena Hub BATTLE button flow:

Arena Hub row BATTLE
→ Arena Player Card
→ player chooses CANCEL or BATTLE
→ BATTLE starts Loading Battle...
→ successful load/start activates match and consumes ticket
→ failure consumes no ticket and shows RETRY.

Arena Player Card may show:
- Avatar;
- equipped Profile Frame;
- Name;
- Level;
- Tier;
- Rating;
- CP;
- current equipment visuals/details;
- selected Arena Pet.

Do not reveal:
- Arena skill slots;
- defense skill priority.

The Player Card also appears for Revenge.

### 7.1 Two-phase match start
Required behavioral contract:
- opening Player Card does not consume a Ticket;
- pressing BATTLE on the Player Card begins load/preparation;
- during Loading Battle..., Cancel/Battle controls are disabled;
- client loads required Phaser/assets/presentation snapshot first;
- only after successful preparation does server confirm/activate the match and atomically consume one Ticket;
- if preparation fails, Ticket is not consumed and RETRY is offered;
- after server activates the match, any later client/network failure resumes the same match and never consumes a second Ticket.

Implementation may use a short-lived prepared/reservation state, but it must preserve this user-visible contract and prevent opponent snapshot races/replay.

---

## 8. Match snapshot and resume

At authoritative match start, lock a deterministic match snapshot containing at minimum:
- both Heroes' current equipped-item-derived stats/presentation;
- both Arena Pets;
- both Arena skill slots/priorities;
- passive/status-relevant combat data;
- presentation metadata required for deterministic resume.

Changes to equipment/Pet/skills after the match starts affect only the next match.

If an active Arena match exists when entering Arena:
- show a small confirmation view:
  - Arena Battle ค้างอยู่
  - เล่นต่อ
  - ออกเลย.
- เล่นต่อ → Loading Battle... → resume exact match state;
- ออกเลย → immediately settle as attacker LOSS using normal Surrender settlement, with no second confirmation;
- no additional Ticket charge on resume;
- if server deadline already expired, settle timeout first and show Result instead of resume prompt.

---

## 9. Battle terminal rules

Battle Core Speed Queue / AGI remains authoritative for all active units.

Player input is required only for attacker Hero turns unless Auto is enabled.
- attacker Pet: automatic;
- defender Hero: AI;
- defender Pet: AI.

Terminal:
- attacker Hero dies → attacker LOSS;
- defender Hero dies → attacker WIN;
- Pet death alone does not end the battle;
- maximum = 20 Battle Core rounds;
- after Round 20, if both Heroes remain alive → DRAW regardless of HP/damage.

Draw:
- Rating ±0;
- pair encounter +1;
- Play milestone +1;
- Win milestone +0;
- history result DRAW;
- defense summary counts Draw/Hold;
- attacker receives Draw Arena Coin.

---

## 10. Targeting and Auto

Manual target UX: hybrid.
- choose Basic or a single-target skill;
- legal enemy actors receive target ring/highlight;
- tap Enemy Hero or Enemy Pet directly;
- touch hit area may be slightly larger than sprite for mobile;
- invalid/off-target taps must not submit an action.

Skill types:
- Basic / single-target offensive → select legal enemy target;
- self buff / self heal / non-target AoE → execute immediately without an extra target tap;
- other skill target legality follows shared Battle Core skill rules.

Defense AI offensive target:
- lowest remaining HP percentage;
- tie → Hero first.

Defense Pet offensive target:
- same lowest-HP-percentage rule where the Pet skill requires an enemy target;
- self/heal/support behavior follows skill rules.

Attacker Auto:
- toggleable on/off at any time;
- attacker Hero uses Arena skill priority 1→4, first legal usable skill, otherwise Basic;
- offensive single target uses lowest HP percentage, tie Hero first;
- Pet remains automatic;
- Auto changes no rating/reward rules.

---

## 11. Arena Phaser battlefield presentation

Arena battle presentation reuses shared Phaser architecture:
- HeroRenderer / HeroActor;
- PetActor;
- ActorPresentationModel;
- EquipmentVisualResolver;
- PresentationEventBridge;
- PresentationQueue;
- VfxManager;
- AssetResolver / TextureRegistry;
- responsive layout utilities.

No independent Arena asset-path guessing or duplicate Hero/VFX engines.

### 11.1 Battlefield composition
Both teams are visibly present:
- attacker Hero + Pet on left;
- defender Hero + Pet on right;
- Hero/Pet use staggered upper/lower positioning;
- right side mirrors left;
- if no Pet, only Hero is present for that team.

Initial actor scale:
- use current Dungeon Combat scale as baseline;
- final Arena-specific scale/anchor tuning is deferred to staging/mobile visual QA.

### 11.2 Facing
- attacker faces right;
- defender faces left;
- add reusable facing/flip support to shared renderer if current renderer does not already expose it;
- preserve layer alignment/equipment composition.

### 11.3 Actor HUD
Reuse current Dungeon Phaser actor-HUD pattern:
- Status above actor and only when active;
- HP bar + HP/MAX near actor base and behind sprite;
- Name below actor;
- same rule for both Heroes and both Pets;
- selected target uses target ring;
- death state uses shared actor presentation.

### 11.4 Top bar
Arena battle top bar is intentionally compact:
- Turn Order: four slots;
- x1 / x2 presentation speed control;
- Round X / 20.

Do not repeat Rating, Level, HP, SP or EXP in the Arena battle top bar.

Turn Order must be sourced from authoritative/shared Speed Queue, not independently inferred by UI.

### 11.5 Action dock
Layout direction:
- Skill 1–4 on left;
- large Basic Attack on the right, matching Dungeon's primary-action emphasis;
- Auto and Surrender as separate controls.

Skill button data:
- icon;
- short name;
- SP cost;
- cooldown number;
- disabled when Battle Core says unusable.

### 11.6 Speed
- x1 / x2 only;
- affects presentation timing only;
- no Arena Skip button.

### 11.7 Surrender
Surrender button opens a tiny confirmation:
- Surrender?
- CANCEL
- OK.

OK:
- attacker immediate LOSS;
- defender WIN;
- normal settlement;
- no Ticket refund.

### 11.8 Battle log
- compact Arena preview;
- show only the latest 1–2 lines to preserve battlefield space;
- textual detail/format vocabulary should match Dungeon Combat;
- tap opens full match log;
- include damage/heal/miss/crit/status/defeat detail supported by shared Battle Core log.

### 11.9 Background
Arena-specific static background:
- outdoor Colosseum;
- dark fantasy;
- ThornieDungeons thorn/vine motif;
- not overly dark/muddy;
- visible sky;
- actor/VFX readability remains primary;
- W9 background is static; ambient animation deferred.

---

## 12. Rating, tiers and pair diminishing

Base rating floor: **1000**.

Tiers:
- Bronze: 1000–1099
- Silver: 1100–1249
- Gold: 1250–1449
- Diamond: 1450+

Use Elo K = 24 as baseline Arena V2 rating math.
Old Arena V1 minimum-delta behavior must not distort pair diminishing.

Real-player pair diminishing is symmetric per season and normalized by unordered character pair:
- encounter #1 → 100% rating effect;
- encounter #2 → 50%;
- encounter #3+ → 0%.

Draw:
- 0 rating;
- still increments pair encounter.

Calculation:
1. compute normal base Elo change;
2. apply pair multiplier;
3. round magnitude to nearest integer and reapply sign so +17 at 50% becomes +9 and -7 at 50% becomes -4;
4. no post-multiplier minimum-delta floor.

Both winner and loser receive the same encounter multiplier.

Pair counter update and rating settlement must be atomic/idempotent so retries cannot double-apply rating or encounter count.

---

## 13. Bots

When real players are insufficient, fill missing opponent slots with bots.

Bot principles:
- simple fixed archetypes plus basic scaling;
- no runtime generative AI;
- no fake/guessed asset paths;
- use real game skills, Pets, equipment visuals/assets where available;
- examples: Warrior/Berserker, Guardian, Assassin, Poison, Balanced, Pet Master;
- fixed Pet/skill/AI priority per archetype;
- stats/level scale to target rating;
- display BOT label;
- bots do not appear in leaderboard;
- bots have no defense history;
- bots are not subject to player-pair diminishing.

Bot virtual rating may exceed 1449 for matching, including high-slot opponents for top players.

Anti-progression cap:
- wins against bots cannot raise a player's Rating above **1449**;
- bots cannot promote a player into Diamond;
- real-player battles are required to cross into Diamond.

Opponent UI otherwise treats bot like a normal opponent row except the BOT label.

---

## 14. Season model

Season length: **7 days**.

Regular boundary:
- Sunday 23:00 Asia/Bangkok;
- equivalent to Sunday 16:00 UTC;
- Bangkok has no DST.

Season 1 after Arena V2 production launch:
- begins at launch;
- ends at the first Sunday 23:00 Asia/Bangkok;
- may therefore be shorter than seven days;
- Season 2+ use normal weekly cadence.

Server exposes seasonEndsAt and is authoritative.

Season rollover resets:
- current season Attack W/D/L;
- current season Defense W/D/L;
- milestones;
- pair encounters;
- promotion-reward flags;
- current season History UI context;
- opponent state as required.

Arena Coin persists.
Arena Tickets persist.
Profile frame entitlement records persist according to their own expiry.

Season rating reset: drop one tier and set to the new tier base:
- Diamond → Gold at 1250;
- Gold → Silver at 1100;
- Silver → Bronze at 1000;
- Bronze → Bronze at 1000.

Season eligibility:
- at least one completed Attack Match in the current season;
- Win/Draw/Loss all qualify;
- bot match counts;
- defense-only activity does not qualify;
- only qualified real players enter the real-player opponent pool.

RANKING UI does not show special UNRANKED messaging:
- when season data is absent/unavailable, display "-";
- do not add onboarding text for missing ranking data.

---

## 15. Season cutoff and match deadline

Every active match has a server-authoritative deadline:
- start time + 10 minutes;
- effective deadline = min(start + 10 minutes, seasonEndsAt).

Normal close/reload/network loss:
- match remains resumable before deadline.

At deadline:
- attacker LOSS;
- defender WIN;
- normal settlement;
- attack Loss Arena Coin;
- Play milestone +1;
- no Win milestone.

At season cutoff:
- an active unfinished match cannot be carried into the next season;
- effective deadline becomes the cutoff;
- server settles it as timeout at cutoff;
- stale post-cutoff action requests must see the already-settled result and must not create a new-season result;
- a normal win/draw completion is not allowed to finalize after cutoff.

This closes the exploit of dragging a losing match across the weekly boundary.

---

## 16. Arena Tickets V2

Maximum tickets: **10**.

Daily:
- +5 at the game's existing central Daily Reset;
- central reset currently uses 00:00 UTC, which is 07:00 Thailand time;
- cap at 10;
- if offline, reconcile idempotently at next relevant load/entry;
- do not create a separate Arena daily clock.

Passive:
- +1 every 2 hours while below 10;
- cap 10.

Purchase:
- +1 ticket = 10 Diamonds;
- no daily purchase limit;
- cannot exceed 10.

All ticket sources are equivalent:
- full rating;
- full Arena Coin;
- full season/milestone progress;
- no ranked-match quota;
- no daily play cap.

Ticket = 0:
- opponent list remains visible;
- BATTLE buttons disabled;
- user can tap Arena Ticket in global currency for countdown/purchase.

---

## 17. Arena Coin

Arena Coin is a separate persistent currency.

Rules:
- no cap;
- never resets with season;
- cannot convert back to Diamonds;
- attacker only receives Arena Coin;
- defender receives no Arena Coin;
- there is no Arena-local Shop tab in W9;
- spending is deferred to the main Shop system.

Attack reward by internal matchmaking slot/result:
- lower slot: Win 10 / Draw 6 / Loss 3;
- equal slot: Win 15 / Draw 9 / Loss 5;
- higher slot: Win 20 / Draw 12 / Loss 7.

UI does not show these reward estimates before battle.

---

## 18. Milestones

Seasonal milestones reset each season.

PLAY:
- 10 matches → 100 Arena Coin
- 25 matches → 200 Arena Coin
- 50 matches → 400 Arena Coin
- 100 matches → 800 Arena Coin

WIN:
- 5 wins → 150 Arena Coin
- 15 wins → 300 Arena Coin
- 30 wins → 600 Arena Coin
- 50 wins → 1,000 Arena Coin

Counting:
- completed Attack Matches only;
- bot matches count;
- Draw counts Play but not Win;
- Defense does not count either track.

Delivery:
- no Claim button;
- server records one-time milestone delivery;
- Arena Coin is credited immediately by authoritative settlement;
- non-currency delayed rewards, if introduced, use Mailbox;
- show a visible Result/notification when reached if player is present;
- exact-once receipt remains authoritative.

BATTLE tab summary:
- only show current Play progress and next reward;
- current Win progress and next reward;
- compact progress bars, not the entire milestone table.

---

## 19. Tier promotion rewards

Promotion reward is once per tier per season.

Bronze baseline:
- no promotion reward.

Silver:
- 500 Arena Coin
- 100 Diamonds

Gold:
- 1,000 Arena Coin
- 200 Diamonds

Diamond:
- 2,000 Arena Coin
- 400 Diamonds

Rules:
- falling and re-promoting in the same season does not re-award;
- store highest rewarded tier or equivalent explicit flags;
- Defense wins may promote a player while offline;
- Defense-triggered promotion reward is delivered by Mailbox so the player sees it later;
- Attack-triggered promotion reward may be surfaced in Result;
- promotion celebration is not a separate overlay.

Arena Result:
- when promoted, include a clear CONGRATULATIONS / Promoted to TIER section and reward summary in the existing Result screen;
- when demoted, a simple Tier changed line is enough.

---

## 20. Season rank rewards

Final season leaderboard reward bands:

- Rank 1:
  - 5,000 Arena Coin
  - 1,000 Diamonds
  - Mana Ore ×25
  - Rank 1 Profile Frame, 7 days

- Rank 2:
  - 4,000 Arena Coin
  - 750 Diamonds
  - Mana Ore ×20
  - Rank 2 Profile Frame, 7 days

- Rank 3:
  - 3,000 Arena Coin
  - 500 Diamonds
  - Mana Ore ×15
  - Rank 3 Profile Frame, 7 days

- Rank 4–10:
  - 2,000 Arena Coin
  - 300 Diamonds
  - Mana Ore ×10

- Rank 11–100:
  - 1,000 Arena Coin
  - 150 Diamonds

- Rank 101+:
  - 500 Arena Coin
  - 100 Diamonds

Progression material is locked to the existing `manaOre` material identity:
- Rank 1: Mana Ore ×25
- Rank 2: Mana Ore ×20
- Rank 3: Mana Ore ×15
- Rank 4–10: Mana Ore ×10
- Rank 11+: none

Mana Ore is delivered through Mailbox using the deterministic season-reward source identity, so finalization retry/replay cannot duplicate it. Arena Coin, Diamonds, and Profile Frame behavior remain unchanged.

Season rank rewards are sent automatically through Mailbox.

Leaderboard deterministic tie-break:
1. Rating descending;
2. Attack Wins descending;
3. earliest time current Rating was reached.

Do not use Defense Wins as a tie-break.

---

## 21. Season stats and defense summary

Store current season separately:
- Attack Wins;
- Attack Draws;
- Attack Losses;
- Defense Wins;
- Defense Draws;
- Defense Losses.

Total Wins may be derived as Attack Wins + Defense Wins.

RANKING tie-break and Win milestone use Attack Wins only.

Defense Hold:
- Hold = Defense Win + Defense Draw;
- Hold Rate = Holds / completed defense matches.

Defense result can change Rating and current Tier immediately, including while player is offline.

Defense grants:
- Rating changes;
- season defense stats;
- potential tier promotion.

Defense does not grant:
- Arena Coin;
- Play milestone;
- Win milestone.

---

## 22. HISTORY tab and Revenge

HISTORY has only two tabs:
- ATTACK
- DEFENSE

Each tab shows only the **5 latest matches from the current season**.

Season rollover:
- current UI history starts empty/new;
- old DB history may remain for audit/stat but W9 does not add historical-season browsing.

History row should show relevant:
- WIN / DRAW / LOSS;
- opponent name;
- Rating change;
- time;
- Attack rows may show Arena Coin earned;
- Defense rows may expose REVENGE where valid;
- REPLAY is available only when the complete, ordered action ledger exists; older/partial records show REPLAY N/A.

Arena-only Replay contract: see [ARENA-HISTORY-REPLAY-V1.md](ARENA-HISTORY-REPLAY-V1.md). Playback is read-only, uses recorded public state frames, and never re-settles a match or grants rewards.

Top summary:
- Defense Wins;
- Defense Draws;
- Defense Losses;
- Hold Rate.

Revenge:
- available from Defense history;
- uses the same Arena Player Card and start flow as normal Battle;
- costs 1 Ticket;
- normal Elo;
- normal pair diminishing;
- normal Coin/milestone rules;
- no special rating bonus;
- bypasses opponent refresh cooldown;
- repeated revenge remains allowed even when pair rating multiplier reaches 0%.

---

## 23. RANKING tab

W9 RANKING tab is intentionally simple.

Show:
- player's current Tier;
- Rating;
- Rank;
- final-season reward bands;
- highlight which reward band the current Rank falls into;
- button for VIEW LEADERBOARD.

Do not design/rebuild the full Leaderboard page in W9.
The full leaderboard UX is deferred to the dedicated Leaderboard phase.

If Arena ranking fields cannot be loaded, render "-" rather than special explanatory states.

---

## 24. Player Card / Profile Frame

Top 3 seasonal frames are **global Profile Frames**, not Arena-only.

Three distinct entitlements:
- Rank 1 frame;
- Rank 2 frame;
- Rank 3 frame.

Each award:
- valid for 7 days from grant;
- auto-equips immediately;
- can be replaced/unequipped later by normal profile-frame controls;
- appears anywhere the global Player Card/avatar-frame system is used, including Arena and Social/Profile surfaces.

Expiry:
- do not delete entitlement record;
- mark expired/disabled;
- expired frame cannot be newly equipped;
- if currently equipped when it expires, stop rendering it and fall back to default/no frame;
- keep expired entitlement visible in future collection/history UI if such UI exists;
- earning the same rank frame again creates/renews an active entitlement/expiry according to the final implementation model.

If a new Rank frame is awarded while another frame is equipped:
- auto-equip the new Rank frame;
- previous frame remains in collection.

Server must reject an expired frame even if client cache is stale.

---

## 25. Arena Result

Arena uses a full Result screen, not a small battlefield popup.

Result remains until the player explicitly confirms.

Show as relevant:
- VICTORY / DRAW / DEFEAT;
- Rating before → after;
- Rating delta;
- current/new Tier;
- Arena Coin earned;
- Play milestone progress;
- Win milestone progress;
- promotion congratulations/reward when applicable.

Do not auto-return.

Primary action:
- BACK TO ARENA.

After confirmation:
- return to BATTLE tab;
- fetch authoritative latest Arena state;
- auto-refresh opponents under changed-list rule.

---

## 26. Season UI force refresh

At seasonEndsAt while the player is already on Arena Hub:
- countdown reaches zero;
- automatically force-fetch current Arena state from server;
- no popup;
- UI updates to new season automatically.

If player is outside Arena:
- do nothing until next Arena entry.

Mailbox remains authoritative for season rewards.

---

## 27. Legacy Arena V1 cutover and cleanup

**Status: COMPLETE — PRODUCTION VERIFIED**

Arena V2 Season 1 remains clean:
- V2 starts at Rating 1000 / Bronze;
- V1 Rating/W-L/history were not migrated into the V2 competition.

Final cutover and cleanup:
- Arena V2 was deployed additively and production-verified first;
- legacy Arena V1 frontend/API runtime entry points were then removed;
- public leaderboard key `pvp` was preserved as a compatibility surface but now reads authoritative Arena V2 season data;
- migration `0025_arena_v1_cleanup.sql` removed:
  - `pvp_snapshots`;
  - `pvp_ranking`;
  - `pvp_match_log`;
  - `pvp_matches`;
- `characters.pvp_tickets` and `characters.pvp_tickets_updated_at` remain as inert compatibility columns because removing them would require a risky table rebuild with no runtime benefit;
- unrelated character, inventory and progression data were preserved.

Production cleanup deployment:
- API run `36812924931`: SUCCESS;
- migration `0025_arena_v1_cleanup.sql`: applied successfully;
- deployed API Worker Version ID: `09a61e53-04dc-49c7-8c2f-28ad3282e501`.

---

## 28. Arena V1 audit baseline — historical

The following list records the pre-W9 legacy state for audit/history only. These runtime paths are no longer active after final closeout:
- V1 `pvp_snapshots`, `pvp_ranking`, `pvp_match_log`, `pvp_matches`;
- Arena V1 lobby/opponent/battle/result runtime;
- old Arena ticket behavior;
- old V1 settlement/reward path;
- old defender AI and snapshot refresh path.

The inert character ticket columns are intentionally retained only for schema compatibility and are not authoritative Arena V2 state.

---

## 29. Implementation requirements to audit before coding

Before implementation, inspect latest main and resolve these against actual code rather than guessing:
- exact Battle Core targetId support and Arena terminal hooks;
- round counter semantics for 20-round draw;
- current Hero/Pet facing support in shared renderer;
- current equipment visual resolver and opponent presentation metadata;
- central Daily Reset implementation/idempotency;
- current Player Card/Profile Frame schema and rendering path;
- Worker scheduled/cron support versus lazy season finalization;
- Mailbox delivery/idempotency helpers;
- existing item/material IDs before assigning Top 10 material rewards;
- exact migration numbering after latest main;
- current Arena API callers/tests that must be replaced or updated.

Recommended new server concepts may include:
- arena_seasons;
- arena_season_players;
- arena_setup;
- arena_pair_season_stats;
- arena_match_history;
- Arena V2 match/prepared-match state;
- milestone delivery state;
- promotion reward state;
- profile frame entitlement state if no shared model exists.

These names are design suggestions, not permission to conflict with existing schema conventions. Inspect before naming.

All authoritative settlements must be transaction-safe/idempotent:
- ticket consume;
- rating updates for both real players;
- pair counter;
- season stats;
- Arena Coin;
- milestone mail;
- promotion reward/mail;
- history;
- surrender/timeout;
- result replay.

---

## 30. W9 validation gates

Backend/data:
- migration applies cleanly from latest production schema;
- old players/saves remain loadable;
- Arena V2 season record initialization is safe;
- prepare/start cannot consume duplicate Tickets;
- failed preload consumes no Ticket;
- resume consumes no Ticket;
- surrender/timeout settlement idempotent;
- pair diminishing exact 100/50/0 behavior;
- bot cap blocks bot-driven Diamond promotion;
- daily/passive/purchase Ticket math correct across offline gaps;
- season rollover/finalization idempotent;
- reward/mail delivery exactly once.

Combat:
- Hero-only and Hero+Pet;
- both sides Hero/Pet render;
- facing correct;
- manual Hero/Pet target selection;
- defense target AI;
- attacker Auto;
- skill priority;
- SP/cooldown/status;
- 20-round Draw;
- Hero death terminal rules;
- Pet death non-terminal;
- x1/x2 presentation only;
- no Skip;
- Surrender;
- resume;
- deadline/cutoff.

UI/mobile:
- compact global currency remains one row on small screens;
- four Arena tabs fit safely;
- opponent rows readable;
- Player Card flow;
- Refresh countdown in disabled button;
- Setup equipment detail read-only;
- Result remains until confirm;
- history 5+5;
- small-screen safe area/overflow;
- static Colosseum background keeps actors/VFX readable.

Release:
- user-visible staging iterations must bump visible preview patch version;
- no production deploy without explicit authorization;
- after release verification, run legacy cleanup as a separate controlled step.

---

## 31. Deferred scope

Not W9:
- full Leaderboard redesign;
- Arena-local Shop;
- main Shop Arena Coin catalog implementation;
- Arena-exclusive equipment/cosmetics;
- exact permanent/season Shop SKU quantities/prices;
- animated Arena background;
- final actor scale polish before staging;
- broader Profile Frame collection UI;
- unrelated Dungeon/Raid gameplay redesign.

The earlier Arena Shop brainstorm is retained as future Shop-phase context only and is not W9 scope.
