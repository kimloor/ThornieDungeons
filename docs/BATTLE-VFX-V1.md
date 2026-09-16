# ThornieDungeons — Battle VFX V1 Specification

Status: **approved presentation specification / source of truth for Battle VFX V1**

Purpose: preserve the agreed VFX direction so future chats/DEV/Graphics sessions can continue without relying on conversation memory.

Related source-of-truth:
- `docs/BATTLE-SYSTEM-V1.md` — combat rules / resolver / turn flow
- `docs/HERO-SKILL-SYSTEM-V1.md` — Hero skill catalog and gameplay values
- `src/systems/heroSkillsV1.js` — current implemented Hero active-skill ids/values
- `docs/HERO-OVERLAY-V4.md` — Hero visual/presentation contract

If this document conflicts with gameplay behavior in `BATTLE-SYSTEM-V1.md`, the Battle System document wins. VFX must never change combat outcomes.

---

## 1. Core rule — VFX is presentation only

Battle Core resolves gameplay first. VFX only visualizes the already-resolved action/outcome.

VFX MUST NOT:
- trigger or calculate damage
- decide hit/miss/crit
- apply status/debuff/buff
- start or reduce cooldowns
- advance turns/queue
- trigger passives/Keystones
- control reward/result logic
- become a required dependency for battle resolution

Correct order conceptually:

`Battle Core resolves action -> result/event is known -> presentation plays animation/VFX -> UI continues`

If VFX fails to load, gameplay must still complete correctly.

Auto / Manual / Skip must continue using the same combat resolver. Skip may bypass presentation waits.

---

## 2. VFX V1 visual standard

Default production rules:
- image-based VFX first
- transparent PNG
- normally **3 frames per VFX animation**
- no text baked into assets
- no gameplay information baked into artwork
- no sound in V1
- no screen shake in V1
- no camera zoom/flash in V1
- no extra CSS particle system in V1
- keep mobile readability as priority

Layering:

`battle background -> units -> VFX -> HP/status/name UI`

So VFX is:
- above Hero/Pet/Monster sprites
- below HP/status/name overlays
- `pointer-events: none`
- must never block tap targets

VFX should be short, readable, and not cover the whole screen unless the skill is intentionally AoE.

Placement contract:
- main attack VFX use fixed presentation anchors and never follow a target's live coordinate
- Hero attacks use the fixed center-left Hero lane anchor
- Pet attacks use a fixed lane anchor in the same area, slightly lower than the Hero anchor
- Monster attacks use the mirrored center-right Monster lane anchor and face the opposite direction
- `blade_storm` renders once at the fixed central shared combat-lane anchor for AoE readability
- `buff_aura` remains centered on the acting unit
- `poison_hit` and `silence_hit` remain centered on the actual resolved target

---

## 3. Timing / x1 / x2

VFX duration belongs to the **presentation timing layer**, not gameplay timing.

- x1 = normal presentation duration
- x2 = faster presentation duration
- changing x1/x2 must NOT alter queue order, cooldown semantics, status durations, damage, or number of actions
- Skip Battle can resolve without waiting for VFX

Animation speed should remain readable on mobile; do not compress 3-frame effects so aggressively that frames are visually indistinguishable.

The production Pack 01 frame cadence is approximately 1.5× slower than its initial integration. x2 still divides presentation timing only; it never changes Battle Core resolution.

Exact milliseconds may be tuned by DEV after real-device testing without changing the asset contract.

---

## 4. VFX family library

Use reusable visual families instead of inventing a totally unrelated effect for every skill.

### 4.1 `slash_basic`
Use for fast direct melee strikes.

Visual:
- icy white / pale blue slash
- small restrained gold highlight
- clean, quick, readable
- single-target scale

Primary V1 skill:
- Power Strike

An optional weaker `slash_normal` family may represent Hero, Pet, and Monster Basic Attacks. Runtime must use it only when that exact key exists in the loaded manifest; otherwise Basic Attack has no extra VFX.

### 4.2 `slash_heavy`
Use for heavier impact attacks.

Visual:
- deeper orange impact/slash
- small gold accent
- heavier/thicker silhouette than `slash_basic`
- impact should feel weighty without screen shake

Primary V1 skill:
- Heavy Blow

### 4.3 `slash_status`
Reusable base family for melee attacks carrying a harmful status identity.

Variants:
- Toxic Strike — dark purple / poison tone
- Silent Edge — gray / muted spectral tone

Status impact overlays should remain separable where practical instead of permanently baking all status feedback into the slash.

### 4.4 `blade_storm`
Dedicated multi-hit / AoE family.

Visual:
- white-blue blades/slashes
- restrained gold accent
- visually broader than single-target slash
- communicates multiple rapid hits
- avoid obscuring HP/status UI

Primary V1 skill:
- Blade Storm

### 4.5 `buff_aura`
Reusable self-buff / defensive cast family.

Visual:
- blue aura
- soft gold highlight
- centered around Hero
- full-frame cast effect only; do not keep a large permanent effect on screen

Primary V1 skill:
- Guard

Future defensive skills may reuse/extend this family if Graphics/DEV preserve clear differentiation.

### 4.6 `debuff_burst`
Short target-centered status confirmation burst.

Examples:
- `poison_hit`
- `silence_hit`

Purpose:
- make a successful status application visually readable
- should play only when the resolved outcome says the status/conversion succeeded

Do not let this effect decide whether the proc happened.

---

## 5. VFX Pack 1 — approved first production pack

Pack 1 contains these Hero skills/effects:

| Skill | VFX family | Visual direction | Target scale |
|---|---|---|---|
| Power Strike | `slash_basic` | icy white-blue + subtle gold | single target |
| Heavy Blow | `slash_heavy` | deep orange + subtle gold, heavier impact | single target |
| Toxic Strike | `slash_status` + optional `poison_hit` | dark purple poison strike | single target |
| Silent Edge | `slash_status` + optional `silence_hit` | gray/muted silence strike | single target |
| Guard | `buff_aura` | blue + soft gold defensive aura | Hero/self |
| Blade Storm | `blade_storm` | white-blue + gold multi-slash | multi-target/AoE |

Also include GUI presentation assets:
- Speed x1
- Speed x2

`Stunning Blow` is **not part of Pack 1 unless explicitly re-added later**.

---

## 6. Current Hero-skill coverage context

Current Hero Skill V1 contains more active skills than Pack 1. Pack 1 intentionally starts with a reusable visual foundation rather than trying to finish every active immediately.

Current active ids include:

Assault:
- `power_strike`
- `heavy_blow`
- `blade_storm`
- `rampage`

Guard:
- `guard`
- `shield_wall`
- `counter`
- `fortress`

Tactic:
- `toxic_strike`
- `stunning_blow`
- `silent_edge`
- `disruption`

Pack 1 explicitly covers:
`power_strike`, `heavy_blow`, `blade_storm`, `guard`, `toxic_strike`, `silent_edge`.

Uncovered active skills remain future VFX work. Do not silently invent their final art direction in implementation.

---

## 7. Recommended asset contract

Graphics should inspect latest `r2-upload/manifest.json` before creating final keys/paths; exact path naming must follow the current repo convention and should not be guessed from this document.

Recommended logical organization:

- Hero skill cast/hit VFX
- Status confirmation VFX
- Battle presentation GUI (Speed x1/x2)

Each animated VFX should normally expose ordered frames:
- frame 0
- frame 1
- frame 2

DEV integration should read manifest-defined assets rather than hardcoding R2 URLs where existing asset loaders support manifest lookup.

Graphics-only work may update:
- `r2-upload/**`
- `r2-upload/manifest.json`

Graphics-only work must not change combat code.

---

## 8. Runtime integration contract

DEV should trigger VFX from resolved Battle presentation/event data.

Examples:

Power Strike:
1. Battle Core resolves Power Strike.
2. Hit/miss/crit/damage result is finalized.
3. UI receives resolved action.
4. Hero attack animation and `slash_basic` presentation play.
5. Combat proceeds independent of whether asset loaded successfully.

Toxic Strike:
1. Core resolves hit and Poison proc.
2. Play toxic slash for the skill action.
3. Play `poison_hit` only if resolved Poison/status conversion succeeded.

Silent Edge:
1. Core resolves hit and Silence proc.
2. Play muted slash.
3. Play `silence_hit` only if resolved Silence/status conversion succeeded.

Boss/Raid conversions follow Battle Core output. Example: a successful Silence proc converted to DEF Pierce should not visually pretend the boss is Silenced if the actual status was converted.

Miss:
- action VFX may still show the attack attempt if appropriate
- do not show a successful status confirmation overlay on failed/missed proc

Basic Attack:
- use manifest key `slash_normal` only when present
- Manual and Auto consume the same resolved Basic Attack output
- missing `slash_normal` falls back to no VFX without warning, delay, or gameplay impact

Pet / Monster reuse:
- Pet and Monster action VFX are derived only from completed Battle Core logs, using the same presentation bridge as Hero actions
- Pet direct-damage skills may reuse `slash_basic`; Poison/Silence identities may reuse the matching `slash_status` family
- Pet AoE may reuse `blade_storm`; support/heal/buff presentation may reuse `buff_aura` when appropriate
- `poison_hit` / `silence_hit` play only for actual resolved status applications, including Pet or Monster sources; failed, missed, resisted, or boss-converted outcomes do not invent confirmations
- Monster Basic Attack uses `slash_normal` at the mirrored Monster anchor when the asset exists
- if no appropriate reusable family or manifest asset exists, presentation emits nothing and Battle continues normally

Multi-hit:
- visual timing may represent multiple hits
- gameplay hit count/results come only from Core
- VFX must not generate additional hit events

---

## 9. Buff/debuff persistence rule

Large cast VFX should not remain permanently visible.

For ongoing status readability, rely on the existing HP/status icon UI rather than looping large full-body VFX.

Recommended behavior:
- cast/apply moment -> play full VFX
- ongoing status -> small existing status icon/indicator
- expiration -> no mandatory VFX in V1

This keeps combat readable on mobile and prevents multiple statuses from covering sprites.

---

## 10. Graphics handoff requirements

Graphics handoff should include:

`THORNIE_GRAPHICS_HANDOFF`
`STATUS: READY_FOR_DEV`

And report:
- assets created
- manifest keys
- R2 paths
- frame order
- canvas dimensions if relevant
- commit SHA
- whether R2 workflow/upload succeeded

Graphics must self-check:
- transparency
- no accidental background
- consistent frame alignment
- correct ordered frames
- mobile readability
- no baked text
- no gameplay-code edits

---

## 11. DEV acceptance checklist

Before considering a VFX integration complete:

- VFX plays from resolved action/event, never drives resolver logic
- missing VFX asset cannot break battle
- x1/x2 changes presentation only
- Skip is not blocked waiting for animation
- layer is above sprite / below HP-status UI
- VFX does not intercept input
- single-target VFX follows intended target position
- AoE remains readable on mobile
- successful status feedback only appears from successful resolved proc/conversion
- Hero returns to normal idle/presentation state after action
- no changes to skill damage/SP/CD/status values unless separately authorized

---

## 12. Future packs

Future VFX packs can cover:
- Stunning Blow
- Rampage
- Shield Wall
- Counter
- Fortress
- Disruption
- Pet skill VFX
- Monster/Boss skill VFX

Before defining a future pack, inspect latest gameplay source and current assets. Reuse existing VFX families where visually appropriate instead of creating unnecessary one-off effects.

Do not add sound, camera shake, heavy particles, or new gameplay-trigger coupling unless separately approved.
