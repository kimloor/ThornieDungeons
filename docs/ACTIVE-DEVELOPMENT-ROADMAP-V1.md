# ThornieDungeons — Active Development Roadmap V2

Status: **ACTIVE-DESIGN — current master execution roadmap**

This roadmap merges the remaining Social/Guild/Chat work with the active Hero V5, Inventory V2 and Phaser migration tracks.

Work is split into three execution lanes:

1. **CHAT** — low-complexity / low-risk work the Project Lead can handle directly.
2. **WORK** — medium/high-complexity implementation, transactional/backend work, large refactors and renderer migration.
3. **GRAPHICS** — visual asset production and approval.

The lanes may run in parallel where dependencies allow.

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
**Status: ACTIVE-DESIGN — gameplay/UX contract locked 2026-09-28**

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
**Status: PLANNED — mandatory post-W9 gate before Admin Phase 1**
**Risk: HIGH**
**Execution: SINGLE REFACTOR BATCH**

Purpose:
- reduce the size and change-collision surface of `workers/thornie-dungeons-api.js`;
- separate domain ownership without changing gameplay, API contracts, persistence semantics, auth boundaries, economy, or deployed Worker identity;
- make future Arena/Admin/Social work safer for DEV/QA and easier to review.

Current trigger:
- the W9 branch Worker has grown beyond 7,000 lines;
- Arena, Admin, Auth, Mailbox, Guild, Social, Crafting and shared helpers currently coexist in one large file;
- Admin Phase 1 would otherwise continue adding code to the same monolith.

Target direction:

```text
workers/
  thornie-dungeons-api-entry.js
  thornie-dungeons-api.js        # thin compatibility/router boundary
  modules/
    shared/
      db.js
      response.js
      time.js
      security.js
    auth/
    admin/
    arena/
      status.js
      matchmaking.js
      lifecycle.js
      combat.js
      settlement.js
      rewards.js
    mailbox/
    social/
    guild/
    crafting/
```

The exact filenames may change during implementation. Domain boundaries and behavior-preservation rules are the contract.

### Single-batch execution
W9R is implemented and reviewed as one HIGH-risk refactor batch, not as separate W9R.0–W9R.5 releases.

Within that one batch DEV should still use internal checkpoints:
1. characterize current behavior and map dependencies;
2. extract shared infrastructure;
3. extract Auth/Admin foundation;
4. extract Arena V2;
5. extract Mailbox/Social/Guild/Crafting;
6. reduce the legacy Worker file to thin routing/composition;
7. run the complete regression/build gate before publication.

These checkpoints are implementation discipline only. They do not require separate Project Lead approvals, separate feature branches, separate releases, or separate QA handoffs unless a blocker forces the work to be split.

### W9R hard rules
- behavior-preserving refactor only;
- no feature work mixed into the refactor;
- no migration/schema changes unless a separate approved task requires them;
- no economy/balance changes;
- no endpoint/action renames;
- no Battle Core redesign;
- no destructive cleanup;
- preserve gameplay/Admin session separation;
- preserve Mailbox/Arena exact-once behavior;
- preserve all W9.1-W9.9 contracts;
- if extraction reveals a real bug, record it separately rather than hiding a behavior change inside the refactor.

### Required validation inside the single batch
Before publish/QA handoff, verify:
- current public/admin/gameplay API behavior is preserved;
- Worker entry/deploy contract is unchanged;
- Auth/Admin session separation passes;
- W9 Arena full regression passes;
- Mailbox exact-once tests pass;
- Social/Guild/Crafting regression passes;
- generated frontend/build checks pass where relevant;
- module ownership/import boundaries are documented;
- `workers/thornie-dungeons-api.js` is materially reduced and no longer the primary home for every domain.

Admin Phase 1 (Dashboard + read-only Player Viewer) starts from the post-W9R `main`, not from the old `feat/admin-v2-auth` branch.

---

## W10 — Victory / Boss / Raid Presentation

### Victory / Defeat
Use shared presentation infrastructure for:
- victory pose;
- approved wing animation;
- particles/glow;
- camera fade/flash where appropriate;
- clean transition into the existing Result commit flow;
- defeat presentation before Retry/Map controls.

### Boss presentation
Reusable presentation hooks may support:
- boss entrance;
- camera zoom/shake;
- aura/rage visual state;
- phase-transition presentation.

### Raid
Reuse shared Monster/Boss actors, AssetResolver, VfxManager and PresentationQueue.
Do not create a separate Raid rendering architecture.

Gameplay, rewards and Raid authority remain outside Phaser.

---

## W11 — Summoning / Enhance / Craft Presentation

Use Phaser only for animation-heavy presentation.

### Summoning
Possible presentation scope:
- portal;
- rarity glow;
- summon reveal;
- particles;
- camera effects.

### Enhance / Craft
Possible presentation scope:
- forge/fire/spark effects;
- success/fail presentation;
- result reveal.

React/DOM remains responsible for:
- item/recipe data;
- costs;
- buttons/forms;
- mutation authority;
- resulting inventory/economy state.

---

## Phaser rollout rules after W5-W11

- Do not migrate the entire application into Phaser.
- Do not create per-page Hero renderers.
- Do not create per-scene VFX systems.
- Do not construct asset URLs independently in screens/scenes.
- Keep DOM fallbacks until each migrated surface is QA/user verified.
- Production cutover/removal of obsolete fallback code happens only after the relevant surface is verified.
- Dungeon exploration/presentation is intentionally **not** part of the active roadmap.

---

# PART 3 — GRAPHICS LANE
## Visual production that can run in parallel

## G1 — Hero V5 Base Hero

Produce/approve:
- final Base Hero proportions;
- master canvas 768x768;
- Idle 3 frames;
- Attack 3 frames;
- Death 2–3 frames;
- facing/right presentation per Hero V5 contract;
- mobile readability;
- frame alignment.

This may run in parallel with W0-W7.

---

## G2 — Hero V5 Layer / Equipment Validation

After G1 direction is approved:
- verify shared coordinate space;
- hair/head/body/right-arm/torso-leg/weapon layer structure;
- wings behind all;
- frame-specific ordering where required;
- first complete equipment overlay test set;
- verify full armor coverage where intended;
- define real manifest keys/paths;
- transparency/alignment checks.

G2 approval is the gate for W7.

---

## G3 — Phaser Visual QA / Asset Gaps

During W5-W11:
- inspect actual presentation for scale/clarity;
- produce only missing presentation assets explicitly identified by implementation/QA;
- target marker/VFX/feedback adjustments if existing assets are insufficient;
- never redesign gameplay from Graphics scope;
- update R2/manifest using real paths only.

---

# 4. Master execution order

```text
W0  Social 3+4 Hotfix ✅ COMPLETE
 ↓
W1  Inventory Refactor + Donation-ready Boundary ✅ COMPLETE
 ↓
W2  Guild Donation ✅ COMPLETE
 ↓
W3  Guild Chat + Social Integration/UX ✅ COMPLETE
 ↓
W4  Social Production E2E / Release QA
 ↓
W5  Phaser Combat Foundation + Presentation
 ↓
W6  Shared Phaser Presentation Architecture
 ↓
W7  Hero V5 Runtime Integration
 ↓
W8  Inventory + Character Live Preview
 ↓
W9  Arena V2 + Phaser
 ↓
W9R API Worker Modularization Refactor
 ↓
W10 Victory / Boss / Raid Presentation
 ↓
W11 Summoning / Enhance / Craft Presentation
```

Parallel Graphics path:

```text
G1 Hero V5 Base
 ↓
G2 Layer / Wing / Equipment Validation
 └──────────────> required before W7

G3 Visual asset support runs only when W5-W11 identifies a real need.
```

CHAT lane C1-C4 runs continuously between WORK/GRAPHICS milestones for audit, documentation, QA and small low-risk polish.

---

# 5. Completion condition

The active roadmap is complete when:
- Social Phase 3/4 audit issues are fixed;
- Guild Donation and Guild Chat V1 are production-verified;
- Friend/Chat/Guild integration passes E2E;
- Inventory V2 is structurally clean and behavior-stable;
- Combat presentation uses the approved shared Phaser architecture;
- Hero V5 is integrated once through the shared HeroRenderer and equipment resolver;
- Inventory/Character preview reuses the shared Hero renderer without moving Inventory UI into Phaser;
- Arena reuses the same presentation infrastructure;
- the API Worker is modularized after W9 without changing API/gameplay behavior, and Admin Phase 1 starts from that stabilized structure;
- Victory/Boss/Raid and Summoning/Enhance/Craft presentation reuse shared modules where implemented;
- temporary fallbacks are removed only after surface-specific QA/user verification;
- App/styles/Phaser boundaries remain documented and stable.
