# ThornieDungeons — Active Development Roadmap V2

Status: **ACTIVE-EXECUTION — WAVES 1-6 complete / Production verified; POST-W6 FULL GAP + SECURITY RE-AUDIT PASSED; WAVE 7 ready for Project Lead scope approval**

This roadmap preserves completed W0-W9 history and defines the active execution plan from W9R forward, including Dungeon V2, Reward Progression V2, Admin V2, Graphics collaboration and QA gates.

Work is coordinated across four execution roles:

1. **PROJECT LEAD / CHAT** — roadmap ownership, audits, low-risk polish and release decisions.
2. **DEV / WORK** — implementation, backend/transactional work, gameplay systems and refactors.
3. **GRAPHICS** — approved visual asset production, R2/manifest publication and visual contracts.
4. **QA** — independent contract verification, regression gates and release acceptance.

The roles may run in parallel only where the dependency map explicitly allows it.

---

## 1. Global rules

- Check latest `main` before every task.
- Source first -> `node build.js`; never hand-edit generated `index.html`.
- Do not restore `app-v2.html`.
- Do not overwrite unrelated work.
- Existing Battle Core, Arena resolver/API, save/checkpoint, rewards, skill rules and Pet rules remain authoritative unless separately approved.
- React/DOM remains application/page UI.
- Phaser is presentation-only and may be reused for animation-heavy game surfaces; gameplay/data authority remains outside Phaser.
- Inventory remains React/DOM; only the live Hero preview may use the shared Phaser renderer.
- Hero V5 remains modular, layered, synchronized frame-based animation; no skeletal/Spine runtime.
- High-risk scopes use branch + focused QA + user verification before release.
- Do not remove fallbacks until replacements are verified.

---

# PART 1 — CHAT LANE
## Low-complexity work the Project Lead can do directly

These tasks do not require a large coding agent/Work handoff unless audit findings expand the scope.

### C1 — Documentation / roadmap maintenance
- keep this roadmap and `PROJECT-INDEX.md` aligned;
- update ACTIVE-PRODUCTION / ACTIVE-DESIGN status after verified releases;
- archive or mark superseded temporary docs when safe;
- keep implementation prompts compact and scoped.

### C2 — Read-only audits and smoke checks
After each WORK handoff:
- verify latest `main` SHA;
- inspect changed files/migrations;
- verify GitHub Actions/deploy result;
- audit source against the active contract;
- run non-destructive smoke checks where available;
- classify findings as PASS / HOTFIX / NEED_AUTH_E2E.

### C3 — Focused QA review
- review Chat/Guild/Inventory/Phaser handoffs;
- confirm no unrelated changes;
- compare implementation against source-of-truth docs;
- produce small manual test checklists for user verification.

### C4 — Low-risk polish only
May be handled directly when isolated and clearly LOW risk:
- text/copy fixes;
- disabled/Coming Soon labels;
- tiny CSS alignment or safe-area corrections;
- documentation-only cleanup;
- navigation label/order cleanup that does not change routing/state behavior.

Do not use CHAT lane for:
- D1 schema changes;
- economy/item consumption;
- concurrency/idempotency;
- large component refactors;
- Phaser runtime changes;
- Battle/Arena gameplay-sensitive code.

---

# PART 2 — WORK LANE
## Complex implementation requiring Work/DEV

## W0 — Social Phase 3+4 Audit Hotfix
**Status: COMPLETE / RELEASED — 2026-09-24**

Released implementation:
- commit `b44adb58142cfc69df07f537266fb434d9af3d6b`;
- all six confirmed Phase 3+4 audit issues addressed;
- migration `0018_social_audit_hotfix.sql` applied successfully by GitHub Actions;
- API Worker deployment for the W0 commit completed successfully;
- no Phase 5 / Donation / Guild Chat implementation was included.

Verified fixes:
1. DM unread ignores the current character's own sent messages.
2. Global blocked-message filtering occurs before LIMIT and does not block progress to later visible messages.
3. Global/Direct sends use a client nonce with server-side replay/idempotency handling.
4. Guild Leader can edit description and set OPEN / APPLICATION / CLOSED.
5. Max 5 pending Guild applications is enforced inside the guarded INSERT.
6. Manual + automatic leadership transfer share the same atomic/race-safe transfer helper.

Gate result:
- source/build/test evidence reviewed; the only reported full-suite failure is the pre-existing unrelated `tests/battle-persistence.test.js`;
- migration/deploy verified successful in GitHub Actions run `35933082080`;
- authenticated production Social E2E remains scheduled under W4 and is not part of the W0 implementation gate;
- W1 may start from latest `main`.

---

## W1 — Inventory V2 Structural Refactor + Donation-ready Boundary
**Status: COMPLETE / RELEASED — 2026-09-24**

Released via PR #11:
- base `9cf95e22a0d6b39f691778a40545e07d90a455f2`;
- tested head `d5031bd829aa768ae18a4912c504b5d367a3edcf`;
- merge commit `19e153b374f3d34fbe312d7113f6a41f1147cb3c`.

Completed:
- decomposed `InventoryOverlayV2` into InventoryHeader, EquipmentStage/EquipmentSlot, InventoryToolbar, InventoryGrid/InventoryCell, InventoryFilterModal, OverflowModal, ItemDetailModal, ItemStats, ItemComparison, ItemActions;
- preserved shared `GameDock`;
- added read-only item helpers/selectors for runtime/backend identity, type, junk/potion ids, quantity, lock/favorite state, equipped slot/state, and item location;
- preserved current Inventory behavior, responsive layout, safe-area behavior, App-owned state/mutations, and persistence contract;
- no Guild Donation, economy, D1, backend transaction, Battle/Raid/Arena/Social behavior added.

Gate result:
- focused tests 18/18 PASS;
- build and generated JS syntax validation PASS;
- Cloudflare branch build/check PASS;
- QA approved before merge.

W2 may now start from latest `main`.

---

## W2 — Guild Donation V1
**Status: COMPLETE / RELEASED — 2026-09-24**

Released via PR #12:
- tested/final PR head `62c54f6d55de3a65fde82b2aa35e39ae88b73514`;
- merge commit `fab111cee54299a2c26308394ba682f4846a1e61`;
- migration `0019_guild_donation_v1.sql`.

Completed:
- explicit whitelist: `stone`, `grass`, `wood`;
- quantity 1–999;
- 1 eligible item = 1 Guild EXP + 1 Personal Contribution;
- equipped/locked/favorite-protected inventory denied;
- authenticated current Guild membership required;
- multi-stack authoritative consumption from `extra_json.quantity`;
- atomic/idempotent receipt-based donation transaction;
- cumulative Guild EXP thresholds through Level 10 / 15,300 EXP cap;
- Level 10 donations remain allowed while contribution continues;
- donation audit/history;
- Guild donation UI with authoritative inventory/Guild refresh.

QA hotfix:
- added inventory persistence barrier before `donateGuildItem` so pending full-snapshot `syncItems` cannot restore donated items;
- failed persistence flush blocks the donation;
- character-switch guard rejects stale refresh context.

Gate result:
- PR clean/mergeable before merge;
- branch build PASS;
- generated `index.html` rebuilt from source;
- focused source/race tests added;
- migration transaction behavior independently verified against SQLite;
- authenticated production Social/Donation E2E remains scheduled under W4.

W3 implementation is on `feat/w3-guild-chat-social-integration` and is ready for QA from latest `main`. Do not merge/deploy until QA approval.

---

## W3 — Guild Chat + Social Integration / UX
**Status: COMPLETE / RELEASED — 2026-09-24**

Released via PR #13:
- QA-approved/final PR head `5a89b72d229f042b3df523d72e13fe3d8210ce11`;
- merge commit `4aeddfbff28c8b271dacd35ddb54dbd86e9345a9`;
- no migration added; reused existing Chat/Guild schema.

Completed:
- Guild channel added to existing Chat engine / ChatScreen;
- current Guild membership is server-authoritative for read/send access;
- latest 50 initial Guild messages with 14-day retention;
- persistent Guild unread via `chat_read_state` key `guild:<guildId>`;
- own messages and blocked-hidden messages do not create unread;
- block filtering happens before LIMIT while Guild authority remains unchanged;
- join/rejoin initializes a fresh read baseline;
- leave/kick/disband invalidates Guild Chat access/read state;
- client nonce/idempotent Guild send, 300-char limit, Direct-class rate limiting;
- Guild Page shortcut and Chat Page Guild tab share the same channel state;
- character-scoped unread/state isolation;
- Guild retention cleanup generalized alongside Global 7d / Direct 30d;
- Friend/Chat/Guild navigation and Guild unread indicators integrated.

QA hotfix:
- initial Guild Chat transient fetch failure now enters reconnect/backoff;
- retry starts at 5s and successful polling returns to normal 3s cadence;
- `not_guild_member` / `channel_access_denied` remain terminal and stop retry;
- focused source test added for initial failure path.

Gate result:
- PR clean/mergeable before merge;
- branch build PASS;
- generated `index.html` rebuilt from source;
- known unrelated `tests/battle-persistence.test.js` failure remains outside W3 scope;
- authenticated production Social E2E remains scheduled under W4.

W4 may now proceed from latest `main`.

---

## W4 — Social Production E2E / Release QA
**Status: COMPLETE / PRODUCTION VERIFIED**

After W0-W3:
- Friend request/accept/remove/block;
- Global Chat + block filtering;
- Direct Chat + unread + unfriend/re-friend history;
- Guild create/search/policy/apply/accept/kick/transfer/disband;
- Donation retry/double-tap safety;
- Guild EXP/contribution;
- Guild Chat membership/unread/leave/rejoin;
- logout/login persistence;
- character switching;
- navigation/mobile safe areas.

Authenticated production E2E may use test credentials only when explicitly authorized.

---

## W5 — Phaser Combat Foundation + Presentation

**Status: COMPLETE / RELEASED — 2026-09-26**

Released/verified baseline:
- merged main: `12dd534819ee75f6fa7966d14fbfe3a308fcfd77`;
- user browser QA PASS through Ver 1.0.7;
- DOM remains default renderer and Phaser remains opt-in via `?phaserBattle=1`.

Purpose:
- establish the opt-in Phaser Combat battlefield without changing Battle Core;
- keep React/DOM authoritative for HUD, controls, logs, modals and Result shell;
- preserve the DOM battlefield fallback until browser/responsive QA passes.

### W5.1 — Foundation
- Phaser runtime bootstrap and cached lazy loader;
- isolated mount/unmount lifecycle;
- CombatScene shell;
- Hero / Pet / Monster presentation actors;
- responsive normalized anchors;
- read-only battle snapshot bridge;
- safe DOM fallback on runtime/load/scene failure;
- default renderer remains DOM during rollout.

### W5.2 — Combat Presentation
After W5.1 QA:
- Attack / Hit / Hurt / Death presentation;
- target feedback;
- shared VFX playback;
- damage / heal / miss feedback;
- x1/x2 presentation timing;
- Skip presentation drain/cancel boundary;
- terminal action -> Victory/Defeat transition hook.

No gameplay logic moves into Phaser.

---

## W6 — Shared Phaser Presentation Architecture

**Status: COMPLETE / USER QA PASS — 2026-09-26**

Verified W6 branch introduced the shared AssetResolver, TextureRegistry, ActorPresentationModel, PresentationEventBridge, HeroRenderer, PresentationQueue boundary, VfxManager, ResponsiveSceneLayout and EquipmentVisualResolver boundary without moving gameplay authority into Phaser.

**Gate: complete this before expanding Phaser to Arena or additional screens.**

Create/refine the reusable presentation layer so later scenes do not implement their own Hero/VFX/asset logic.

Required shared modules:

### HeroRenderer / HeroActor
One logical Hero renderer reused by:
- Combat;
- Arena;
- Inventory Hero Preview;
- Character Status Preview;
- Player Card/Profile Preview where appropriate;
- Victory presentation.

It owns synchronized visual layers and animation state only.

### EquipmentVisualResolver
Input:
- current/preview equipment identity;
- animation state/frame index.

Output:
- approved visual layers for helmet/armor/gloves/boots/weapon/accessory visual/wings as available.

No Combat/Inventory/Arena component may independently reconstruct Hero equipment asset paths.

### AssetResolver / TextureRegistry
- read real manifest entries;
- resolve canonical R2 asset paths;
- preload only required assets where practical;
- cache textures across scene lifecycle where safe;
- provide explicit fallback behavior;
- never guess asset keys.

### PresentationEventBridge
Normalize authoritative resolved state into scene-independent presentation events.

Phaser must never resolve:
- damage;
- hit/miss;
- target legality;
- cooldowns;
- statuses;
- rewards;
- progression;
- checkpoints.

### PresentationQueue
Own visual sequencing:
```text
ACTOR_ATTACK
→ motion
→ VFX
→ hit feedback
→ floating feedback
→ death
→ ACTION_VISUAL_COMPLETE
```

Also owns:
- x1/x2 visual timing;
- Skip drain/cancel;
- terminal presentation drain boundary.

### VfxManager
One shared VFX library for:
- slash/projectile;
- heal;
- buff/debuff;
- AoE;
- particles;
- screen flash;
- camera shake where approved.

Do not build separate Combat/Arena/Raid VFX systems.

### ResponsiveSceneLayout
Expand the existing normalized anchor system for reusable scene layouts while keeping scene-specific anchor contracts explicit.

### Post-W6 presentation polish — Phaser font sharpness
**COMPLETE / USER QA PASS — 2026-09-26**

The Phaser text-clarity follow-up was completed and user-verified on iPhone before the W7 rollout.

Guardrails preserved:
- actor anchors/layout unchanged;
- Battle Core/gameplay timing unchanged;
- presentation-only rendering adjustments.

---

## W7 — Hero V5 Runtime Integration

**COMPLETE / USER BROWSER QA PASS — 2026-09-27**

Released scope:
- one shared HeroRenderer for V3 fallback + opt-in Hero V5 G2;
- shared 768x768 synchronized frame composition;
- Idle 3 / Attack 3 / Death 2;
- Hurt presentation uses approved `death_01` pose without advancing the Death sequence;
- Wing R5 synchronized to the Hero frame index;
- locked topknot hair `hair_back + hair_front` across all eight runtime frames;
- Azure equipment runtime mapping for helmet/chest/gloves/boots/weapon with partial/full equip coverage;
- Azure Idle weapon grip alignment baked from the approved WEAPON_GRIP reference;
- equipment/weapon equip and unequip browser-verified, including Attack with weapon removed;
- V5 visual grounding/scale tuned without moving the locked Hero actor anchor;
- incomplete requested V5/Azure contracts fail closed to the existing V3 renderer;
- battle-end Phaser teardown made idempotent; user verified no end-of-battle runtime error;
- runtime error diagnostics moved to a centered, scrollable popup with message/source/stack where available;
- after five completed player turns, the existing x1/x2 header slot becomes Skip instead of adding a second control, preventing battlefield layout compression.

Primary wing layer contract:
```text
wing_far
→ Hero/body/hair/equipment/weapon composition
→ wing_near
```

Rollout state:
- DOM remains the application/page UI authority;
- Phaser Combat remains opt-in;
- Hero V5 remains opt-in through `?phaserBattle=1&heroV5=1` at W7 close;
- existing V3 fallback is retained;
- Battle Core / resolver / rewards / persistence / API authority unchanged.

Victory presentation is **not** part of the W7 runtime close. It remains in W10 with the approved Victory/wing presentation work.

No page may create a separate Hero V5 renderer.

---

## W8 — Inventory Hero Live Preview

**Status: COMPLETE — MERGED / PRODUCTION VERIFIED (Ver 1.0.17)**

Inventory remains React/DOM. Phaser is used only for the central live Hero presentation surface.

### W8.1 — Runtime ownership

```text
Inventory React state
        ↓
authoritative equipment state
        ↓
optional previewLoadout
        ↓
EquipmentVisualResolver
        ↓
HeroRenderer
        ↓
HeroPreviewScene
```

DOM remains responsible for:
- Equipment slots and Inventory grid;
- item detail / comparison popup;
- stats and stat deltas;
- filter / sort / favorite / lock;
- Equip / Unequip buttons and mutation authority;
- save/persistence/error handling.

Phaser is responsible only for:
- Hero V5 layered rendering;
- shared Idle animation;
- approved helmet/armor/gloves/boots/weapon/wings/accessory visuals;
- real-time preview swaps;
- optional small presentation-only equip glow/transition.

Equipment slots remain DOM even when they visually surround the Phaser canvas. Phaser must not own equipment state or input authority.

### W8.2 — Preview state contract

The authoritative equipped state and the temporary visual preview state must be separate.

```text
authoritativeEquipped
        ↓ clone
previewLoadout + candidate item
        ↓
HeroPreviewScene
```

Rules:
- opening a compatible unequipped Equipment item may build `previewLoadout` by replacing only that candidate slot;
- previewing never writes save state and never calls Equip by itself;
- closing/cancelling the popup restores the authoritative visual state;
- selecting another candidate rebuilds preview from authoritative state, not from the previous preview;
- Equip success promotes the server/app-confirmed equipment state to authoritative state and refreshes the preview from it;
- Equip failure restores authoritative state and must not leave a stale preview equipped;

### W8.3 — Item comparison boundary

Item comparison remains DOM.

The comparison popup may drive the Phaser preview, but Phaser must not render or calculate:
- CURRENT / NEW item data;
- stat rows or deltas;
- CP;
- rarity text;
- Enhance / Enchant text;
- Equip / Unequip actions.

Expected interaction:

```text
tap compatible inventory equipment
→ DOM opens ItemComparison
→ DOM derives previewLoadout
→ Phaser previews candidate equipment
→ cancel/close = revert visual preview
→ Equip success = authoritative refresh
→ Equip failure = authoritative revert
```

The existing calculated-stat pipeline remains the source of truth for comparison values.

### W8.4 — Hero / equipment visual fallback contract

Fallback must be layered. One missing equipment visual must not force the whole Hero back to the legacy renderer.

**Slot-level fallback — keep Hero V5 active**
- missing helmet visual -> render normal/base head/hair for that slot;
- missing armor visual -> render approved base Hero clothing/body for uncovered layers;
- missing gloves visual -> render base arms/hands for that slot;
- missing boots visual -> render base legs/feet for that slot;
- missing weapon visual -> render no weapon;
- missing wings visual -> render no wings;
- missing accessory visual -> render no accessory overlay.

Slot-level fallback applies when:
- no approved visual mapping exists;
- the declared visual bundle is incomplete;
- a mapped optional equipment texture fails to load.

Gameplay/equipment ownership remains unchanged; only the unavailable visual layer is omitted/fallen back.

**Whole-actor fallback — legacy renderer**
Use the existing whole-actor V3 fallback only when the Hero V5 core cannot render safely, for example:
- required V5 base frame(s) are missing/corrupt;
- required core Hero layer contract cannot be satisfied;
- V5 actor/scene initialization fails at a core level.

Do not use whole-actor fallback merely because one equipped item has no V5 sprite.

### W8.5 — Asset completeness / resolver rules

- `EquipmentVisualResolver` and `AssetResolver` must use real manifest/config mappings only; never construct or guess asset paths from item IDs.
- Do not mix legacy V3/V4 equipment artwork onto a V5 Hero as a per-slot fallback.
- An item may be treated as V5-supported only when its declared synchronized visual contract is complete for the required Hero animation/frame set.
- An incomplete item bundle is unsupported and uses slot-level fallback; do not show the item for some frames and let it disappear for others.
- Texture/load failure must not mutate equipment state, restart the page, or convert a valid Equip result into a gameplay failure.
- Repeated preview changes/open-close cycles must not leak Phaser canvases, scenes or textures.

### W8.6 — W8 QA gate

Verify at minimum:
- current equipment renders identically when entering Inventory;
- candidate helmet/armor/gloves/boots/weapon/wings preview swaps in real time;
- Compare remains DOM and its stat values are unchanged;
- cancel/close restores authoritative equipment visuals;
- successful Equip persists and becomes the new authoritative preview;
- failed Equip reverts cleanly;
- unsupported/missing equipment visual falls back only for that slot;
- Hero V5 core failure uses whole-actor legacy fallback;
- no guessed asset paths / no legacy layer mixing;
- Item Detail/Compare must leave the Hero preview visible so candidate swaps can be visually verified;
- mobile/tablet/desktop layout remains safe;


### W8.7 — Closeout

W8 closed on 2026-09-27 after user browser QA and production deployment.

Final verified behavior:
- Inventory-only Phaser Hero live preview;
- Hero V5 equipment/wings render behind DOM equipment slots;
- candidate Compare preview swaps without mutating authoritative equipment state;
- closing Compare restores authoritative equipment visuals;
- Equip/Unequip refreshes the authoritative preview;
- repeated open/close does not duplicate Phaser canvases;
- mobile Compare remains a Hero-visible DOM bottom sheet;
- equipped Wings reuse the canonical production Angel visual family;
- narrow iPhone layouts keep the full Hero stage;
- final Inventory Hero horizontal anchor is 55.8%;
- Character Status Phaser preview remains out of scope by user direction;
- visible preview/release badge at close: Ver 1.0.17.

Release:
- PR #31 merged to main;
- production frontend deployment and production verification passed.


## W9 — Arena V2 + Phaser
**Status: COMPLETE — PRODUCTION VERIFIED / W9 CLOSED — 2026-10-01**

Implementation roadmap:
- `ARENA-V2-W9-IMPLEMENTATION-ROADMAP.md`
- implementation branch: `feat/w9-arena-v2`

W9 is no longer presentation-only. The user approved a full Arena V2 redesign covering:
- asynchronous tactical Arena;
- Arena Setup Pet + 4-skill priority;
- current-equipment match snapshots;
- attacker manual/Auto targeting and defender AI;
- 3-band opponent matching + bot fallback;
- weekly seasons, tiers, pair diminishing, milestones and rank rewards;
- Arena Coin + Ticket V2;
- history/revenge;
- global Top-3 Profile Frames;
- Arena Hub mobile UX;
- dedicated Phaser 2v2 battlefield;
- additive V2 deploy followed by verified legacy V1 cleanup.

Dedicated source of truth:
- ARENA-V2-W9.md

Shared Phaser architecture remains mandatory:
- HeroRenderer / HeroActor;
- PetActor;
- ActorPresentationModel;
- EquipmentVisualResolver;
- PresentationEventBridge;
- PresentationQueue;
- VfxManager;
- AssetResolver / TextureRegistry;
- responsive scene layout.

Battle Core and server authority remain outside Phaser. Do not infer that older preserve-current-Arena API/rating/reward language still governs W9 where ARENA-V2-W9.md explicitly changes those systems.

---

## W9R — API Worker Modularization Refactor
**Status: COMPLETE — MERGED / PRODUCTION DEPLOYED — 2026-10-01**
**Risk: HIGH**
**Execution: SINGLE REFACTOR BATCH — CLOSED**

Production result:
- PR #39 merged to `main`;
- merge commit: `445ebcaaf2a608947148f7ad80456b06f59ced4a`;
- Production API deploy workflow run: `36829143234` — SUCCESS;
- Production Worker version: `f1516c5b-052e-4d52-b1a4-a07092f8e6f6`;
- D1: `thornie-dungeons-db`; no pending migration was applied;
- full reported local regression: 378 passed, 0 failed;
- Battle Core / W9 Arena parity and post-merge verification: PASS.

Delivered module structure:
```text
workers/
  thornie-dungeons-api.js
  modules/
    shared.js
    auth.js
    social.js
    mailbox.js
    leaderboard.js
```

Implemented outcome:
- Worker entrypoint reduced by approximately 2,500 lines;
- Shared helpers, Auth/Admin primitives, Social/Friend/Chat/Guild, Mailbox and Leaderboard ownership moved behind explicit dependency injection;
- Arena V2 and embedded Battle Core remained byte-for-byte unchanged in the Worker during W9R;
- schema/migrations, visible version, API contracts, gameplay, economy and transaction behavior remained unchanged;
- generated frontend remained unchanged;
- Wrangler ESM/import dry-run passed before release.

QA closeout:
- Auth moved functions: exact vs base;
- Social moved functions: exact vs base;
- Mailbox exact-once behavior: exact vs base;
- Arena + Battle Core retained block: byte-for-byte exact vs base;
- push parity run `36828051453`: SUCCESS;
- PR parity run `36828216679`: SUCCESS;
- Admin V2 QA run `36828216674`: SUCCESS;
- post-merge parity run `36829142882`: SUCCESS.

Known non-blocking infrastructure note:
- the separate Cloudflare GitHub App `Workers Builds: thorniedungeons` check continues to report the known pre-existing integration failure pattern;
- the supported repository `deploy-api.yml` pipeline deployed and activated the Production API Worker successfully.

W9R is closed. Future modularization may continue opportunistically inside later approved scopes, but it is not a blocker for WAVE 1.

Admin Phase 1 (Dashboard + read-only Player Viewer) starts from the post-W9R `main`, not from the old `feat/admin-v2-auth` branch.

---

# PART 3 — POST-W9R EXECUTION WAVES
## Active roadmap from the current post-W9R baseline

The old linear `W10 -> W11` order is replaced by dependency-driven waves.

Rules for all waves:
- every wave starts from latest `main`;
- HIGH/VERY HIGH work uses an approved feature branch and focused QA before release;
- DEV owns gameplay/data/runtime authority;
- Graphics owns approved visual assets only;
- QA independently verifies the locked contract and regressions;
- Battle Core must not be changed to compensate for progression or presentation balance;
- do not mix unrelated cleanup into a wave;
- presentation may begin only when its authoritative mechanic contract is stable enough to consume.

---

## WAVE 1 — Dungeon V2 Encounter + Stat Foundation
**Status: COMPLETE — PRODUCTION VERIFIED — 2026-10-01**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: QA; Graphics only for identified presentation gaps**

Scope:
- replace legacy encounter classification with the approved Dungeon V2 structure;
- Elite midpoint pattern such as F5/F15/F25;
- Chapter Boss pattern F10/F20/F30;
- implement approved Normal Monster stat curve;
- preserve monster identity profiles;
- implement 1/2/3-monster pack scaling;
- implement Elite multipliers;
- implement Moss King / Ember Drake / Frost Warden Boss profiles;
- implement one-time Boss Enrage below 50% HP.

Hard boundaries:
- do not change shared damage/status/turn resolution;
- do not silently rebalance the locked V2 reference values;
- remote-config rows must not override the intended V2 profile accidentally.

QA gate:
- reference-floor outputs including F1/F30/F71/F105;
- encounter classification;
- pack scaling;
- Elite identity retention;
- Boss profiles + one-time Enrage;
- Dungeon save/checkpoint/result regression;
- Battle Core parity.

Exit condition:
- Dungeon V2 combat/encounter generation is stable before Reward V2 begins relying on source type and Floor/Tier identity.

---

## WAVE 1.5 — Dungeon Monster Skills + Boss Mechanics
**Status: COMPLETE — PRODUCTION VERIFIED — 2026-10-01**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: QA mandatory**

Source of truth:
- `docs/DUNGEON-MONSTER-SKILLS-V2.md`

Scope:
- implement six Normal Monster deterministic skill cycles;
- implement six Elite skill variants while retaining source-monster identity;
- implement Moss King / Ember Drake / Frost Warden skill kits and rotations;
- persist enemy action-cycle state across checkpoint/reload/resume;
- preserve Auto / Skip / normal-play deterministic parity;
- integrate Boss phase behavior with WAVE 1 Enrage;
- reuse shared Poison / Stun / Armor Break / DEF Up semantics;
- preserve existing authoritative targeting and Battle Core resolution.

Hard boundaries:
- no random enemy skill-selection system;
- no enemy MP/resource system;
- no new Freeze/Burn status type;
- no Reward V2/economy/item/crafting work;
- no Arena/Raid Dungeon-skill leakage;
- shared Battle Core changes, if required, must be generic and default-neutral.

QA gate:
- all Normal/Elite cycles and exact skill values;
- multi-hit/AoE/guard behavior;
- Poison/status duration/proc semantics;
- Moss King one-time Overgrowth phase insertion;
- Ember Drake phase-2 cycle continuity;
- Frost Warden repeatable Ice Fortress;
- Enrage direct-damage interaction and DoT exclusion;
- Auto/Skip/checkpoint/resume determinism;
- Battle Core + Worker parity when shared core changes;
- Dungeon persistence;
- Arena/Raid regression;
- build/generated-output checks.

Release result:
- combined WAVE 1 + WAVE 1.5 QA passed;
- the combined Dungeon V2 encounter/stat/monster-skill foundation is merged and Production verified;
- frontend/API verification for the released combined scope is complete.

Exit condition:
- Dungeon V2 encounter/stat/skill combat foundation is authoritative and Production-ready before Reward V2 begins.

---

## WAVE 2 — Reward V2 Item / Drop / Economy Foundation
**Status: COMPLETE — PRODUCTION VERIFIED — 2026-10-02**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: QA + Graphics for missing icons**

Scope:
- T1-T5 Floor mapping;
- Rare / Unique / Elite / Mythic item model;
- fixed base-stat budget by slot/Tier;
- rarity multipliers;
- Accessory utility budget;
- generic equipment roll and rarity weights;
- max one generic equipment item per encounter;
- Normal / Elite / Chapter Boss reward roles;
- First-Clear Accessory;
- source-aware item metadata;
- extend existing `monster_loot` architecture with safe generic fallback;
- Gold/EXP/material economy required by Reward V2;
- Shop V2 normal stock rules;
- salvage foundation.

Graphics collaboration:
- audit latest manifest first;
- create only missing Reward V2 material/item icons;
- do not replace approved Azure/Robot/Skeleton art without explicit revision approval.

QA gate:
- Tier boundaries F1-30 / F31-50 / F51-70 / F71-90 / F91+;
- rarity/stat generation;
- 4% Normal gear roll and 8% Elite encounter roll;
- First Clear vs rerun behavior;
- no generic Mythic drop;
- loot-pool fallback;
- inventory overflow/persistence;
- Shop and salvage economy regression.

Exit condition:
- one authoritative V2 item model is used before Enhance, Empower or Mythic content is layered on top.

---

## WAVE 3 — Enhance + Empower V2
**Status: COMPLETE — PRODUCTION VERIFIED — 2026-10-02**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: QA; Graphics may prepare W11 presentation assets in parallel**

Implementation note:
- V2 Enhance/Empower mutations use a server-authoritative Worker transaction boundary; legacy items retain their existing compatibility paths.
- Tierless Raid Wing Enhance uses the locked T5 economy. Wing Empower remains deferred until its explicitly unresolved Tierless Gold multiplier is approved with the W5 Wing model.

### Enhance V2
- +0 to +10;
- approved success rates;
- +6% base-stat gain per successful level for normal equipment;
- +6 -> +7 and later downgrade rules;
- Protection Stone behavior;
- Gold + Iron costs;
- Raid Wing special Enhance rule.

### Empower V2
- rarity-based 1/2/3/4 slots;
- slot-aware option filtering;
- approved whole-number roll ranges/probabilities;
- duplicate rolls allowed;
- Lock / Unlock / Reroll;
- Mana Ore + Gold economy;
- additive Enhance/Empower stacking;
- HP/MP percentage boundary.

Hard boundaries:
- RNG resolution and resource consumption are authoritative mechanics, not presentation;
- W11 must never decide success/failure, rolls or costs.

QA gate:
- cost/consumption exactness;
- success/failure/downgrade/protection paths;
- reroll/lock edge cases;
- duplicate rolls;
- item-slot filtering;
- stat recomputation;
- save/reload;
- Inventory Compare;
- Dungeon/Raid/Arena shared equipment regression.

Exit condition:
- Enhance and Empower mechanics are production-safe before presentation is attached.

---

## WAVE 4 — Mythic Boss Weapons + Mythic Set System
**Status: COMPLETE — PRODUCTION VERIFIED — 2026-10-02**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: Graphics + QA**

### Boss Materials / Weapons
- Earth Stone -> Spirit Greatsword;
- Fire Stone -> Lavalon Sword;
- Water Stone -> Icicle Longsword;
- guaranteed 1 Boss Stone + 25% extra;
- matching Stone x5 + Tier Gold crafting;
- Mythic rarity / 4 Empower slots;
- fixed source-specific Signature Effect.

### Mythic Sets
- `rarity = mythic`;
- `setId = azure | robot | skeleton`;
- six-piece set structure;
- cumulative 2/4/6 bonuses;
- Azure / Skeleton / Robot approved effects;
- Set identity separate from rarity;
- Wings never count as a Set piece.

Graphics collaboration:
- approved Azure/Robot/Skeleton Hero V5 sets must be reused where valid;
- Robot/Skeleton item binding must be completed rather than regenerating approved frames;
- produce missing Boss Weapon icons + Hero V5 synchronized weapon visuals;
- use real manifest keys only.

QA gate:
- crafting source/Tier correctness;
- Boss Signature trigger/reentrancy/multi-hit rules;
- Set 2/4/6 count and mixed-set behavior;
- EquipmentVisualResolver mapping;
- Inventory preview/equip;
- Dungeon/Raid/Arena combat regression;
- Battle Core parity.

Exit condition:
- special Mythic power is shared correctly across combat modes and visuals resolve through the shared renderer.

---

## WAVE 4.5 — Server Authority / Economy Security Gate
**Status: COMPLETE — PRODUCTION VERIFIED — 2026-10-02**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: QA mandatory; Project Lead release approval mandatory**

Purpose:
- close the remaining client-authoritative save/economy boundary before Raid/Wings V2 builds on it;
- preserve W2/W3 server-authoritative reward, Enhance and Empower behavior;
- prevent W4 Mythic items/sets from creating new dependencies on generic client-authoritative persistence.

Production implementation summary:
- `saveCharacterProgress` rejects generic character snapshots. The client no longer queues a `character_progress` snapshot; authoritative changes use cause-specific operations.
- `syncItems` updates approved presentation fields on existing owned rows only. It does not create/delete/re-parent items or accept stat, rarity, enhancement, identity, or quantity changes.
- Dungeon results, Mail, Daily Login, stat/skill allocation and resets, Pet economy, consumables, Shop, Craft, Enhance/Empower, sale, salvage, Guild Donation, Raid refill and Arena settlement use server-side mutations and authoritative responses.
- Craft and non-idempotent character operations use request receipts/guarded writes; Raid attacks carry a request ID to prevent duplicate charges from replaying the same request.
- Mythic Set salvage uses server-recorded crafting inputs and server-side item/resource mutation.
- `migrations/auto/0026_w45_authority_receipts.sql` is additive and re-check safe.
- Released to Production after QA approval, migration apply, API/frontend deployment verification, and post-merge Battle Core/Arena regression.

Public scope summary:
- restrict generic character-save writes to explicitly client-owned/non-economy state;
- make inventory synchronization presentation-state-only for existing authoritative items;
- move claim/reward crediting to atomic server-side transactions where still client-applied;
- make Craft mutations concurrency-safe and idempotent;
- re-verify Craft, Raid, Arena and leaderboard consumers against authoritative data;
- activate source-aware Mythic Set salvage through an atomic server mutation; WAVE 4 keeps the client-local Mythic salvage action blocked;
- add forged-payload and two-account regression coverage.

WAVE 4 integration guardrail:
- WAVE 4 continues to completion and is not interrupted mid-implementation;
- WAVE 4 must not add new currency/stat/progression grants through generic client save endpoints;
- WAVE 4 must not rely on generic inventory sync to create/delete authoritative items;
- any unavoidable dependency is recorded explicitly for WAVE 4.5.

Hard boundaries:
- do not perform W6 destructive legacy-item cleanup here;
- do not silently delete or normalize existing player data;
- schema changes, if required, are forward-only under `migrations/auto/`;
- confidential vulnerability details remain outside the public repository.

QA gate:
- forged currency/progression payloads cannot raise authoritative values;
- client item payloads cannot create/delete/re-stat authoritative inventory;
- legitimate equip/favorite/slot presentation state persists;
- reward claims are exact-once and server-credited;
- Craft duplicate/concurrent submission cannot double-spend/double-craft;
- W2/W3/W4 item/economy regression;
- Raid/Arena/leaderboard regression;
- two-account authorization/isolation tests;
- build/deploy/Production verification.

Exit condition:
- server authority and economy integrity are production-verified before WAVE 5 starts.

---

## WAVE 5 — Raid / Wings V2
**Status: COMPLETE / PRODUCTION VERIFIED — 2026-10-02**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: Graphics + QA**

Scope:
- Raid family mapping: Azure / Robot / Skeleton;
- Tierless Wings;
- Rare / Unique / Elite / Mythic Wing rarity;
- Wing rarity controls Empower-slot count only;
- Wing Enhance grants family Primary Stat +1 per Enhance;
- Rank 1/2/3 Wing reward replacement;
- Last-Hit Set Recipe;
- contribution milestones;
- 50% Accessory;
- 75% Recipe;
- 99% Set Item Tier snapshot;
- family-specific Recipes and current-Tier Set crafting;
- mailbox/idempotency preservation.

Graphics collaboration:
- audit current Azure/Robot/Skeleton Wing runtime visuals and icons;
- create only missing runtime layers/presentation assets;
- prepare Raid presentation assets that WAVE 7 may consume.

QA gate:
- ranking + milestone stacking;
- Last Hit;
- reward exact-once;
- mailbox replay safety;
- 99% Tier snapshot timing;
- stored Tierless Recipe -> later current-Tier craft;
- Wings Enhance/Empower;
- Hero V5 rendering;
- Raid save/auth regression.

Release result:
- merged to Production in PR #45; merge baseline `bb4c0d03c1194fc624c3f7e0169b537f65dcea45`;
- migration `0027_w5_raid_wings_v2.sql` applied successfully;
- Frontend/API deploy, Battle Core parity and Workers Build passed;
- authenticated user verification confirmed real Raid milestone reward delivery.

Exit condition:
- Raid reward mechanics are stable before W10 Raid presentation is finalized.

---

## WAVE 5.1 — Empower V2.1 + Item Pipeline Consistency
**Status: COMPLETE / PRODUCTION VERIFIED — 2026-10-02**
**Risk: HIGH**

Scope completed on the feature branch:
- new V2 equipment fills its server-authoritative Empower slots at creation; reroll preserves option type and changes value only;
- additive item provenance and append-only ownership-event foundation;
- authoritative Wing family visuals, primary-stat display/valuation, Wing Empower UI, and Reward V2 salvage eligibility;
- existing item options and player data remain untouched; Market/Trade and W6 cleanup remain out of scope.

QA / release result:
- Empower rarity boundaries, immutable option-type reroll, lock behavior and existing-item preservation verified;
- Wing family stat/visual/display/sell regressions verified;
- Reward V2 R/U/E salvage and Mythic special salvage verified;
- provenance + ownership acquire events verified, including no orphan craft logs on conflict;
- PR #46 merged as `33562eaad3704f4aa62587d53e1848c5cf7f5e4e`;
- migration `0028_empower_v21_item_provenance.sql` applied successfully;
- Frontend/API deploy, Battle Core parity, Admin V2 QA and Workers Build passed.

---

## WAVE 5.5 — Security Hardening
**Status: COMPLETE / PRODUCTION VERIFIED — 2026-10-03**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: QA mandatory**

Scope:
- retire the legacy Admin-key compatibility path; Admin V2 Bearer sessions remain authoritative;
- validate inventory-slot ownership/range;
- return generic server errors while keeping diagnostic detail server-side;
- verify run-state data can never become an authoritative reward source;
- restrict CORS to approved origins;
- add general request-body limits;
- remove unsafe Admin HTML interpolation;
- review account-enumeration behavior and retain or normalize it explicitly.

Process/security:
- rotate retired legacy credentials/secrets during the approved cutover;
- keep confidential audit detail out of the public repository;
- re-run focused auth/admin/security regression before W6.

Exit condition:
- focused security regression, build and deployment validation pass before destructive W6 cutover.

Release result:
- PR #48 merged to `main` as `96ba68a5e79112f1cf5343e6eb19696c73b30e2b`;
- post-merge API deployment, Frontend production deployment, and Battle Core parity all completed successfully on that merge SHA;
- current-main closeout rerun passed focused W5.5 security regression (40/40), full suite (521/521), build/generated-index checks, `git diff --check`, and Worker syntax;
- no W6 destructive behavior was started as part of this closeout.

---

## PRE-W6 READINESS AUDIT — 2026-10-03
**Status: COMPLETE / GATE PASSED**
**Risk: HIGH**

Canonical audit record: `PRE-W6-READINESS-AUDIT-2026-10-03.md`.

Resolved blocker:
- Azure Mythic Set 6pc control proc drift was removed by PR #58 and Production verified on merge SHA `2e6b2d2a774bee2d975d26e03fd5911a6113f3f0`.
- Focused regression 126/126, full suite 521/521, Battle Core parity, API deploy, and Frontend deploy/live verification all passed.

This pre-W6 audit does not replace the mandatory post-W6 Full Project Gap Audit + Security Re-Audit.

---

## WAVE 6 — V2 Production Cutover + Legacy Special-Item Cleanup
**Status: COMPLETE / PRODUCTION VERIFIED — 2026-10-03**
**Risk: VERY HIGH**
**Lead: DEV**
**Collaboration: QA mandatory; Project Lead release approval mandatory**

Scope:
- remove temporary Azure QA/Test legacy stock/generator from the client source;
- migrate Daily Login Day 7 Azure reward to the canonical Mythic V2 item model;
- remove obsolete legacy special-equipment behavior;
- delete owned legacy Raid Wings ★1-★5;
- delete owned legacy Azure/crafted Set equipment using the old stat/rarity model;
- no compensation, per the approved Reward V2 contract;
- preserve Gold, Diamonds, Iron, Mana Ore, Protection Stones, Raid materials, valid Recipes and unrelated inventory/save data.

Safety requirements:
- destructive cleanup must be explicit, narrow and auditable;
- no broad identity matching that can delete unrelated equipment;
- validate against representative existing-player data before Production;
- migration/release path must not depend on replaying migrations;
- take the final production release decision separately from implementation completion.

QA gate:
- exact deletion target matrix;
- unrelated inventory preservation;
- equipped/unequipped legacy cases;
- valid Recipe preservation;
- login/load/save after cleanup;
- Reward/Crafting/Raid/Arena regression;
- migration/application logs and Production verification.

Exit condition:
- V2 is authoritative in Production and legacy special gear can no longer re-enter through old generation paths.

Release result:
- PR #60 merged to `main` as `9c8f716c6cff1acc38593acf42fafab7d6c11312`;
- migration `0029_w6_legacy_special_item_cleanup.sql` applied successfully to Production D1;
- API deployment, Frontend production deployment/live verification, and Battle Core parity all completed successfully on the merge SHA;
- W6 focused regression 50/50 PASS and full suite 523/523 PASS before release;
- legacy Azure acquisition identifiers were absent after the cutover implementation;
- current Raid V2 rewards, valid Recipes, currencies/materials, ordinary equipment, and V2 items remain outside the destructive target matrix;
- Admin item-deletion tooling remains deferred to a later dedicated Admin phase.

### Post-WAVE 6 — Full Project Gap Audit + Security Re-Audit (mandatory gate before final WAVE 7 closeout)

After WAVE 6 is production-verified, Project Lead performs a full-system gap audit plus a security re-audit before WAVE 7 is treated as the final presentation/polish closeout.

Audit coverage:
- Login / Character / Main Hub / Town;
- Dungeon / Battle / Result;
- Inventory / Equipment / Pets / Skills;
- Shop / Craft / Enhance / Empower;
- Raid / Arena;
- Social / Friends / Chat / Guild;
- Admin V2;
- Audio;
- Hero/Equipment/Item graphics and runtime bindings;
- mobile UX, save/persistence, economy integrity, cross-mode regressions;
- legacy/fallback/dead paths that remain after V2 cutover;
- forged-payload protection for currency/progression/items;
- two-account authorization/isolation regression;
- reward/claim/craft exact-once and concurrency safety;
- Admin/auth/security hardening verification.

Audit outputs:
- classify findings as COMPLETE / GAP / DEFERRED / INTENTIONAL OUT-OF-SCOPE;
- fix release-blocking gaps before final closeout;
- record non-blocking gaps in the active backlog/scope instead of silently expanding a completed wave;
- use the audited post-V2 production state as the baseline for the canonical project scope.

Scope-control rule during WAVE 2-6:
- findings outside the active wave are recorded as **Deferred Gaps** rather than inserted into the current implementation;
- exception: blockers, player-data-loss/integrity risks, security/auth issues, or defects that make the active wave unsafe or unverifiable must be handled immediately through the appropriate risk/QA path.

Exit condition:
- Full Project Gap Audit is complete and release-blocking findings are resolved or explicitly routed before final WAVE 7 closeout.

---

## WAVE 7 — Presentation Expansion
**Status: ACTIVE — W7A1 TERMINAL PRESENTATION IMPLEMENTED / QA PASSED**
**Risk: MEDIUM**
**Lead: DEV + Graphics**
**Collaboration: QA**

Scope lock:
- **W7A** — Victory/Defeat + Boss/Enrage + Raid presentation on the shared Phaser architecture.
- **W7B** — Enhance/Craft presentation after W7A.
- **Summoning presentation is deferred** until a canonical Summoning gameplay contract is approved; do not invent Summoning mechanics inside presentation work.
- W7 presentation must not change Battle/Reward/Raid/Enhance/Craft authority.

### W7A / W10 reference — Victory / Boss / Raid Presentation
Current sequence:
1. **A1 Terminal presentation foundation — IMPLEMENTED / QA PASSED**
   - authoritative `completeBattle` first;
   - shared Phaser queue terminal Victory/Defeat transition second;
   - bounded timeout fallback;
   - Result/Defeat navigation only after presentation drain/fallback.
2. **A2 Boss entrance + Enrage presentation — NEXT**
3. **A3 Raid presentation using shared actors/VFX/queue — AFTER A2**

May begin after the corresponding mechanics are stable:
- Victory / Defeat pose and transition;
- approved wing animation;
- Boss entrance;
- camera/impact presentation;
- Enrage/aura state;
- Raid presentation using shared actors/VFX/queue.

Dependencies:
- Victory/Defeat may start independently after W9R;
- Boss/Enrage presentation depends on WAVE 1;
- Raid presentation depends on WAVE 5.

### W7B / W11 reference — Enhance / Craft Presentation
Enhance/Craft presentation depends on authoritative mechanics:
- forge/fire/spark;
- Enhance success/fail/downgrade result presentation;
- Craft reveal;
- Mythic/Boss Weapon reveal.

Summoning presentation is deferred from W7B until its own gameplay contract is approved. Future visual direction may include portal / rarity glow / reveal / particles-camera presentation, but W7 must not define or implement Summoning economy/mechanics.

Presentation hard rules:
- React/DOM/API owns item/recipe/cost/mutation/economy state;
- Phaser owns presentation only;
- reuse AssetResolver, HeroRenderer, EquipmentVisualResolver, PresentationQueue and VfxManager;
- no per-screen duplicate renderer or VFX architecture.

QA gate:
- authoritative result remains correct if animation fails;
- no duplicate mutation/reward;
- scene teardown/re-entry;
- x1/x2/terminal presentation compatibility where relevant;
- mobile safe area/performance;
- asset fallback and 404 checks.

---

# PART 4 — PARALLEL TRACKS AFTER W9R

## A1 — Admin V2 Phase 1
**Status: READY AFTER W9R**
**Risk: HIGH**
**Lead: DEV**
**Collaboration: QA**

Scope:
- Admin Dashboard;
- server-side Player Search;
- read-only Player Viewer;
- dedicated Admin V2 session/auth boundary;
- audit-safe read paths.

Out of scope:
- economy mutation;
- destructive player tools;
- generic DB editor;
- generic SQL console.

Dependency:
- must start from post-W9R `main`;
- may run in parallel with WAVE 1-5 if branch ownership avoids collisions with the same backend modules.

QA gate:
- Admin/gameplay token separation;
- allowlist enforcement;
- read-only guarantees;
- no private credential/token exposure;
- search/result authorization;
- gameplay regression.

---

## G4-G9 — Graphics support lane
**Risk: LOW to MEDIUM depending on runtime binding**

Graphics runs only where a wave has a real asset dependency:

- **G4 — Reward V2 icons — LOW:** Earth/Fire/Water Stone and other confirmed missing icons.
- **G5 — Boss Weapon assets — MEDIUM:** Spirit Greatsword / Lavalon Sword / Icicle Longsword icons and synchronized Hero V5 weapon layers.
- **G6 — Mythic Set binding/finish — MEDIUM:** reuse approved Azure/Robot/Skeleton assets; fill missing icons/bindings only.
- **G7 — Wings V2 audit/assets — MEDIUM:** verify family Wing runtime layers/icons and fill real gaps.
- **G8 — W10 presentation assets — MEDIUM:** Victory/Boss/Raid VFX/presentation.
- **G9 — W11 presentation assets — MEDIUM:** Enhance/Craft/Summon VFX.

Graphics must not redesign mechanics or publish guessed asset paths.

---

## Q1-Q8 — QA gate lane
**Risk follows the wave under test**

- **Q1 — W9R regression — HIGH**
- **Q2 — Dungeon encounter/stat verification — HIGH — COMPLETE / PRODUCTION VERIFIED**
- **Q2.5 — Dungeon Monster Skills/Boss Mechanics verification — HIGH — COMPLETE / PRODUCTION VERIFIED**
- **Q3 — Reward/item/drop/economy verification — HIGH**
- **Q4 — Enhance/Empower verification — HIGH**
- **Q5 — Boss Weapon/Set cross-mode verification — HIGH**
- **Q5.5 — Server authority/economy security verification — HIGH**
- **Q6 — Raid/Wings verification — HIGH**
- **Q6.5 — Security hardening verification — HIGH**
- **Q7 — Legacy cleanup/cutover verification — VERY HIGH**
- **Q7.5 — Full Project Gap Audit + Security Re-Audit — HIGH**
- **Q8 — W10/W11 presentation integration — MEDIUM**

QA must validate the source-of-truth contract rather than only retesting DEV's implementation assumptions.

---

# PART 5 — MASTER EXECUTION ORDER

```text
W0-W8                         ✅ COMPLETE
 ↓
W9 Arena V2                   ✅ COMPLETE / PRODUCTION VERIFIED
 ↓
W9R API Worker Refactor       ✅ COMPLETE / PRODUCTION
 ↓
WAVE 1 Dungeon V2 Foundation  ✅ COMPLETE / PRODUCTION
 ↓
WAVE 1.5 Monster Skills/Boss   ✅ COMPLETE / PRODUCTION
 ↓
WAVE 2 Reward V2 Foundation   ✅ COMPLETE / PRODUCTION
 ↓
WAVE 3 Enhance + Empower      ✅ COMPLETE / PRODUCTION
 ↓
WAVE 4 Mythic Weapons/Sets    ✅ COMPLETE / PRODUCTION
 ↓
WAVE 4.5 Server Authority     ✅ COMPLETE / PRODUCTION
 ↓
WAVE 5 Raid / Wings V2        ✅ COMPLETE / PRODUCTION
 ↓
WAVE 5.5 Security Hardening   ✅ COMPLETE / PRODUCTION
 ↓
PRE-W6 Readiness Audit        ✅ COMPLETE / GATE PASSED
 ↓
WAVE 6 V2 Cutover/Cleanup     🟣 VERY HIGH — READY FOR OWNER APPROVAL
 ↓
WAVE 7 Presentation Expansion 🟠 MEDIUM
```

Parallel after W9R:

```text
Admin V2 Phase 1              🔴 HIGH
   └─ may run beside WAVE 1-5 with collision-safe branch ownership

Graphics G4-G9
   ├─ G4 Reward V2 icons may start now
   └─ later batches run only when the target wave has a confirmed asset dependency

QA Q1-Q10
   └─ independent gate after each implementation wave
```

Do not hold all presentation work until the very end unnecessarily:
- W10 Victory may begin once W9R is stable;
- Boss stat/Enrage presentation may begin after WAVE 1; Boss skill presentation depends on WAVE 1.5;
- W11 Enhance/Craft presentation may begin after WAVE 3;
- Raid presentation may begin after WAVE 5;
- final integrated presentation QA remains WAVE 7.

CHAT lane C1-C4 continues for roadmap maintenance, audits, focused QA review and isolated LOW-risk polish.

---

# PART 6 — COMPLETION CONDITION

The active roadmap is complete when:
- W9R modularization is production-safe with no intentional behavior drift;
- Dungeon V2 encounter/stat generation and Monster Skill/Boss Mechanics are authoritative;
- Reward V2 Tier/Rarity/item/drop/economy rules are authoritative;
- Enhance and Empower V2 are persistent, transaction-safe and shared across equipment consumers;
- Boss Weapons and Mythic Sets use the approved mechanics and shared Hero V5 visual resolver;
- Server Authority / Economy Security gate is production-verified before Raid/Wings V2;
- Raid/Wings V2 rewards, Recipes and family mappings are production-verified;
- Security Hardening is production-verified before destructive cutover;
- the approved legacy special-item cleanup is completed without unrelated player-data loss;
- the post-W6 Full Project Gap Audit + Security Re-Audit closes release-blocking authority/auth/integrity findings;
- Admin V2 Phase 1 is available from the post-W9R architecture;
- W10/W11 presentation consumes authoritative mechanics without owning gameplay/economy state;
- Graphics assets use canonical R2/manifest paths and approved shared visual contracts;
- every HIGH/VERY HIGH wave passes its focused QA, build/regression gate and live verification where deployed;
- Battle Core, save reliability, exact-once rewards and unrelated production systems remain intact.


### WAVE 1 + 1.5 production closeout — 2026-10-01

- PR #40 merged to `main` as `e2e0a45ae828f57118d9c7fc1e5e9809439b5d42`.
- Frontend production workflow run `36870595048`: SUCCESS.
- Frontend Worker version: `7c2a3ce2-ddf7-4166-89bd-4e58ccb9324f`.
- API production workflow run `36870595178`: SUCCESS.
- API Worker version: `96e4a5b3-9ef6-477c-9fe6-f1e0ab8ea60c`.
- Post-merge Battle Core parity run `36870595034`: SUCCESS.
- D1 migrations: none pending / none applied for this wave.
- Combined focused QA: PASS.
- Full suite reported before merge: 404/404 PASS.
- Supported deploy pipelines verified; the separate Cloudflare GitHub App failure remains a known unrelated infrastructure signal.
