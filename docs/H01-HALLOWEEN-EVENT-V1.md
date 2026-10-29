# H01 — Halloween Event V1: Contract and Execution Plan

Status: **DESIGN IN PROGRESS / OWNER-APPROVED DIRECTION / IMPLEMENTATION NOT AUTHORIZED**
Date: 2026-10-29 (Asia/Bangkok)
Lane: Special Event between Graphics G16 and G17; separate from Admin V2 Wave 2.
Owner is the final approval authority for gameplay, economy, artwork and high-risk release.
Risk: **HIGH** (authoritative rewards, inventory, event availability, player data); visual-only preparation may be lower risk.
Source: Owner directions and two screenshots supplied on 2026-10-29 (Dungeon Hub v1.1.34, Dungeon floor selection). Screenshots are design references, not repository assets.

## 1. Approved scope and invariants

- Add a Halloween event entrance to the existing Dungeon floor selection map at the **upper-left empty arch** marked in the Owner screenshot (do not reposition existing floors 7–11).
- Reuse the **same architectural gate design** as the current Dungeon floor doors, not a new gate style: normal blue, boss gold, Halloween event **dark purple**. Match perspective, placement, lighting and mobile legibility.
- On Dungeon Hub, reuse the current WORLD EVENT / Raid Boss banner component and **rotate Raid Boss ↔ Halloween every 5 seconds**. Preserve the existing Raid Boss destination and UX. The selected banner's action must navigate to the correct event destination. Proposed active-event filtering and timer behavior require contract verification; do not silently hide an existing Raid Boss entry.
- Halloween encounter: **one fixed boss monster, named `Haloween nightmare` per Owner spelling**, depicted as a grim reaper riding a skeletal horse and wielding a scythe. Use existing battle/status/boss rage systems; exact status availability and attack alternation must be audited before implementation.
- On successful battle reward resolution, **one exclusive outcome**: Halloween event weapon **5%** or existing gold currency **95%**. No second item drop, additional currency or guaranteed weapon. Gold payout is tied to the applicable existing chapter boss reward for the player's current dungeon progress (examples: at floor 9 use floor-10 boss gold, at floor 11 use floor-20 boss gold). Exact mapping across boundary cases and weapon stat-generation compatibility still require verification.
- Event is active for **one calendar month starting from actual activation**, not automatically from deployment or document creation. Exact start timestamp, timezone, month arithmetic and expiry behavior must be locked before implementation; do not substitute 30 days without approval.
- Event weapon remains a normal authoritative inventory item once awarded; permanence after event closure needs explicit Owner confirmation.
- No changes to unrelated Admin V2 PR #182, production D1, player data, other dungeon bosses or existing G16/Skeleton assets.


## 1A. Owner-approved boss combat and reward direction (2026-10-29)

- **Exact working boss name supplied:** `Haloween nightmare` (retain Owner spelling; do not silently rename to “Halloween Nightmare”). Visual: a grim reaper **mounted on a skeletal horse**, holding a **scythe**; detailed concept still requires Owner visual acceptance.
- **Attack cadence:** alternate a **normal attack** and a **skill-use turn**. On each skill turn, randomly select one of **three status skills** corresponding to existing **Stun**, **Silence** and **Poison** effects. DEV must verify exact existing status IDs, availability of Silence, resistance/immunity rules, duration, targeting, selection probability and turn scheduling; these details are not invented here.
- **Rage:** when boss HP becomes **strictly below 50%**, transition to the existing boss Rage behavior. Verify edge cases at exactly 50%, one-time activation and save/resume with current battle contract. No separate Rage mechanic or unexplained numeric buff is authorized.
- **Boss stats:** derive from the existing chapter boss corresponding to the player's **current dungeon progression**, not a newly balanced stat block. Example mapping from Owner: current floor **9** → boss floor **10**; current floor **11** → boss floor **20**. DEV must inspect the source of truth for current floor, chapter boundaries, boss stat scaling and level caps; don't use floor 9 / floor 11 stats directly.
- **Gold reward if weapon does not drop (95% branch):** equal to the gold reward for the corresponding chapter boss using the same mappings: floor 9 → floor-10 boss gold; floor 11 → floor-20 boss gold. Evaluate the authoritative existing reward amount without assuming a fixed numeric payout. Confirm behavior at exact boss floors, locked floors, repeated attempts and progress changing during a run.
- **Weapon reward (5% branch): `Excaliburnt`** — a new sword inspired by a sword-in-the-stone: a large chunk of the stone/pedestal remains attached to the blade tip, producing a hammer-like silhouette. Rarity **Mythic**. Tier is derived from the player's applicable dungeon floor/progression when the item drops (DEV to verify the authoritative tier mapping and snapshot timing). **No unique status/effect** is added. Use existing Mythic weapon stat/refine/enchant rules only after compatibility review; exact base stats, equip slot behavior and wearable silhouette remain pending. A sword-like item with stone at its tip must not be implemented as a new hammer weapon class without Owner approval.
- Reuse existing battle outcomes/statuses/Rage/reward mechanisms. If Silence or required alternating action patterns do not exist in the current engine, stop and report a scoped contract gap rather than silently implementing a new global mechanic.


### Excaliburnt visual and item contract (Owner direction, 2026-10-29)

- **Name (exact):** `Excaliburnt`.
- **Type:** sword, not a newly invented hammer equipment class; stone or pedestal chunk stays stuck to the **tip** of an Excalibur-like blade, giving the combined weapon a hammer-like profile.
- **Rarity:** Mythic.
- **Tier:** derives from the player's dungeon floor level applicable at the **drop event**, subject to DEV inspection of the existing tier band mapping and authoritative battle reward snapshot. Do not hardcode a tier by date or an unapproved level formula.
- **Unique status:** **none**. Do not introduce a new status, special passive, unique skill or bonus. Existing ordinary Mythic attributes must be audited against the game's current item contract rather than guessed.
- **Graphics dependency:** First compare a separate concept image against approved sword visuals. Item icon required. Character-held wearable sprite, grip, animation occlusion and sword runtime compatibility need DEV interface contract and Owner visual approval before production.
- **Economy dependency:** Reuse ordinary eligible Mythic base-stat rules unless the current weapon catalog cannot represent this identity cleanly; report any gap before implementation. Quantity, duplication behavior and exact tier roll semantics still need Owner/DEV decisions.

## 2. Decision register — pending Owner contract (DO NOT IMPLEMENT/INVENT VALUES)

| ID | Decision | State | Why needed |
| --- | --- | --- | --- |
| D01 | Boss `Haloween nightmare`: grim reaper riding a skeletal horse, wielding a scythe; detailed look, sprite size/rig and animation frame contract pending | DIRECTION APPROVED / ASSETS PENDING | Graphics concept and runtime mapping |
| D02 | `Excaliburnt`: sword with stone/pedestal chunk attached at blade tip (hammer-like silhouette), Mythic, tier by floor at drop, **no unique status**; precise base stats, tier calculation, wearable sprite/runtime and stacking remain to audit | DIRECTION APPROVED / TECHNICAL AUDIT + ARTWORK ACCEPTANCE PENDING | Graphics and economy/inventory authority |
| D03 | Gold equals the player's applicable chapter-boss gold payout (floor 9 → boss floor 10; floor 11 → boss floor 20); verify formula at chapter boundaries, max floor and progress snapshot | RULE APPROVED / EDGE CASE AUDIT PENDING | Server reward logic |
| D04 | Entry requirements, attempts/stamina, repeat fights, cooldown, level limits | PENDING | Dungeon encounter rules |
| D05 | Exact activation instant/timezone; one-calendar-month expiry semantics; hide/disable expired gate and pending runs | PENDING | Secure timed event behavior |
| D06 | Banner rotation on inactive events, timer lifecycle, click targets and destination; do not degrade Raid Boss | PENDING DETAIL | UX integration |
| D07 | Weapon permanence after expiry, duplicate drops, capacity/overflow/mailbox delivery | PENDING | Player data safety |
| D08 | Boss stats same as chapter boss at player's current progression tier; alternate normal attacks with random skill turns; skill pool: existing Stun, Silence, Poison; trigger existing Rage on HP below 50% | RULE APPROVED / EXISTING SYSTEM COMPATIBILITY AUDIT PENDING | Confirm exact scaling and whether Silence and attack cadence exist without new mechanics |
| D09 | Event presentation label/localization and banner art | PENDING DETAIL | Consistent Thai/mobile UI |

Owner may decide these in later discussion. **No placeholder values may be shipped as production economy settings.**

## 3. Dependency-first execution (Graphics vs DEV)

| Order | Task / owner | Inputs & dependency | Output / acceptance gate | Start policy |
| --- | --- | --- | --- | --- |
| H01-00 | **Project Lead**: inspect main, AGENTS.md, dungeon UI/asset resolver, current battle and reward authority contracts; draft D01–D09 | Current repository + approved screenshot | Scope/risk review and Owner decision register | AUTHORIZED documentation/research |
| H01-01 | **Owner + PL**: lock boss concept, weapon identity/stats, gold amount, entry limits, event timing/expiry and delivery rules | H01-00 | **Owner gameplay/economy/visual brief approval** | BLOCKS implementation |
| H01-02 | **DEV (contract-first)**: audit existing dungeon door geometry, banner rotation/mount lifecycle, boss rig/animation, combat/reward endpoints; define asset keys, dimensions, coordinates, fallbacks, event flags and test fixture contracts | H01-00; H01-01 for economy-sensitive fields | **DEV→Graphics interface contract** for gate/boss/weapon, plus no-code integration plan | May inspect before H01-01; freeze interface afterward |
| H01-03 | **Graphics**: create **concept only** for dark-purple recolor of existing gate, fixed boss and matching weapon/icon; existing screenshots and H01-02 | H01-01 visual brief + H01-02 asset contract | Owner visual approval for EACH concept | No R2 publishing yet |
| H01-04 | **Graphics**: produce reviewed final gate art, boss animation frames and weapon inventory icon; optional wearable sprite only if explicitly approved | H01-03 approved; approved asset contract | Final exports, dimensions, transparency, per-file SHA and visual comparison, handoff to DEV | Graphics owns art; no runtime edits |
| H01-05 | **DEV (frontend shell)**: implement 5s rotating World Event banner with navigation + event gate placement in marked arch using approved assets/fallback; timed visibility based on agreed contract | H01-02 interface; H01-04 gate/banner assets for final UI | Mobile viewport/safe area/touch regression and Owner UI preview | Can build **non-shipping feature-flagged skeleton** after interface, but cannot release incomplete event |
| H01-06 | **DEV (backend/gameplay)**: integrate fixed boss through existing battle authority, secure 5% weapon vs 95% gold mutually exclusive reward, idempotent claim, inventory delivery, event start/end controls | H01-01 locked gameplay/economy + H01-02 interface + H01-04 boss/weapon assets | Unit/integration tests, real D1 staging and rollback/concurrency verification as applicable | **HIGH RISK: separate branch, no direct main/production merge** |
| H01-07 | **Graphics + DEV**: bind R2 manifest/revision, verify uploaded SHA read-back, browser decode, Phaser texture/runtime resolution, fallback | H01-04 final approved assets + H01-05/06 readiness | Manifest/runtime integration evidence; no stale-cache art | Publication gated by Owner art approval |
| H01-08 | **QA + Project Lead**: independently check banner timing, destination, 2-state/inactive behavior, gate map alignment, boss single identity, 5%/95% server outcomes, duplicate claim protection, event expiry, inventory capacity, save/resume, mobile UI | H01-05/06/07 | CI + staging + release checklist with exact SHA/build/workflow evidence | No invented PASS |
| H01-09 | **Owner + PL**: review artwork/gameplay/economy/staging, authorize safe release, version bump/announcement, production deploy and live verification | H01-08 PASS and restoration/rollback readiness | Production version + visual and authority acceptance | Explicit Owner authorization for high-risk release |
| H01-10 | **PL**: update roadmap/QA evidence and close H01 | H01-09 accepted | DONE with evidence and limitations | Post-release only |

### Critical dependencies
```
H01-00 -> H01-01 -> H01-02 -> H01-03 -> H01-04
                   \-> H01-05 (UI skeleton possible)
H01-01 + H01-02 + H01-04 -> H01-06
H01-04 + H01-05 + H01-06 -> H01-07 -> H01-08 -> H01-09 -> H01-10
```
- **DEV must deliver the asset/rig/path contract before Graphics final exports**, preventing rework.
- **Graphics concepts need Owner approval before final asset creation**, and approved final assets before runtime/R2 binding.
- **DEV can inspect the current system and draft isolated UI scaffolding in parallel**, but authoritative reward implementation waits for Owner economy decisions.
- Do **not** put H01 work into Claude's Admin PR #182 or alter its release flag.

## 4. Graphics Agent scope / deliverable gates

1. Read AGENTS.md, the relevant Dungeon asset reference and, **only if authoring wearable Hero equipment**, Equipment Sprite Master Template and Pipeline V1 + approved Gate 0. Preserve existing blue/gold doors and layout.
2. Gate: same dungeon arch/door silhouette and perspective with dark-purple luminescence; fit marked upper-left map arch in screenshot. No new style that breaks the map.
3. Boss: new single fixed Halloween enemy; submit concept and animation matrix based on DEV-confirmed existing monster rig; do not assume Hero 56-PNG format applies to monsters.
4. Weapon: create `Excaliburnt` concept and icon, visually a sword-in-the-stone with a **stone/pedestal lump still attached at the blade tip**, giving a hammer-like silhouette. It remains a **sword** for classification unless Owner later changes it. A wearable overlay is **not automatically required**; inspect existing sword rig/hand position/occlusion and request Owner approval before using the Hero equipment pipeline.
5. Deliver concept comparison sheet → Owner approval → final transparent/source exports → SHA inventory → DEV handoff → authorized R2 publication.
6. Never alter approved Azure/Leather/Skeleton or unrelated frame assets.

## 5. DEV scope / acceptance

**Frontend (DEV UI)**
- Rotate exactly every 5 seconds across approved active banners, no timer accumulation or duplicate intervals on remount; deterministic fallback when one banner exists; respect reduced motion if animations added.
- Keep existing Raid Boss navigation; Halloween banner opens the agreed event destination. Ensure explicit touch behavior (auto-rotation vs user tap) and accessibility.
- Place dark-purple gate in screenshot's upper-left arch without overlapping floor controls; preserve responsive map scaling and back/close navigation.
- Do not make event actionable outside authorized active window; ensure safe inactive/pending presentation.
- Any player-visible change requires frontend version bump and announcement update; run `node build.js` (never hand-edit `index.html`).

**Backend / battle / reward (DEV authority)**
- Use one server-fixed event boss and existing battle/reward rules; validate entry, event active window and reward entitlement server-side.
- 5% event weapon or 95% gold on eligible victory, exclusive branch; no client-authoritative RNG or double claims. Define secure idempotency, inventory full behavior and retry persistence before integration.
- Explicitly test boundary times, reopen/resume at expiry, request replay, concurrent duplicate reward and failure rollback on test D1/Worker.
- No new economy systems, admin flags, role separation or unrelated mutations.

## 6. QA and release gates

- [ ] Owner locks D01–D09; separately accepts gate/boss/weapon concept and final visual output.
- [ ] Regression: normal blue floor and gold boss door still work; Raid Boss banner/destination unchanged.
- [ ] Two banners change at 5 s (and no duplicate timers); one/inactive state; correct targets.
- [ ] Purple gate visually aligns with Owner upper-left target on mobile and desktop; safe areas/scroll/touch.
- [ ] Fixed boss only; combat parity, restart/reconnect/save-resume and timer expiry.
- [ ] Server-side 5%/95% exclusive reward implementation, deterministic test RNG, claim idempotency, capacity, gold mutation and negative cases.
- [ ] R2 read-back SHA, manifest resolution, browser PNG decode, Phaser/runtime rendering and cache revision.
- [ ] Relevant focused/full regression, build, CI and staging real D1 QA recorded with exact outcomes.
- [ ] Backend high-risk PR review / safe rollback & restore point as applicable; Owner explicit production release approval.
- [ ] Bump frontend version and announcement for visible change; verify deployed version and Production visual/reward behavior.

## 7. Current status (2026-10-29)

- **DONE:** Owner supplied core direction and exact UI placement screenshots; H01 documentation and ordered work plan created.
- **IN PROGRESS:** Owner design discussion / D01–D09 definition.
- **BLOCKED:** Graphics final art and DEV release-quality gameplay until their upstream approval/interface gates pass.
- **NOT STARTED:** H01 implementation, asset publication, staging QA, production deployment.
- **Parallel dependency:** Admin V2 PR #182 remains separate, open and security-blocked; do not merge or activate it because of H01.

**Next conversation:** Owner + PL discuss Excaliburnt base stats, gear tier derivation, wearable appearance, entry and expiry details; then assign H01-02 DEV interface audit before instructing Graphics to produce final assets.
