# ThornieDungeons Dungeon Floor V1

Status: **ACTIVE-PRODUCTION — current Dungeon Floor Select / Floor Detail contract**

## 1. Purpose

This document defines the current Dungeon floor-selection and pre-battle floor-detail contract. Read it with `AGENTS.md`, `PROJECT-INDEX.md`, `BATTLE-SYSTEM-V1.md`, and `r2-upload/README.md` when the task touches Dungeon presentation, floor modifiers, monsters, or entry flow.

## 2. Floor Select presentation

The approved floor-select direction is a vertical, first-person progression view with dungeon stairs/doors and the common game shell.

Current presentation rules:

- show 5 floor doors at a time
- floors ascend from bottom to top
- progression runs diagonally bottom-left toward top-right
- door positions should visually align with the staircase/background
- normal and boss doors are visually distinct
- boss door uses stronger/golden presentation
- cleared floors do not keep the active glow
- floors not yet available are locked
- current/shared currency and navigation shell stay consistent with the rest of the game

Current Dungeon Select assets live under `ui/dungeon-select/` and include the floor-select background plus normal/boss gate artwork. Verify actual manifest/R2 paths before changing asset references.

## 3. Floor Detail before battle

Selecting a floor opens a pre-entry detail view before combat.

The detail view should prioritize:

- floor/event information
- monster preview for the selected floor
- monster idle presentation when the required sprite exists
- clear entry/back actions

Do not restore the old generic “possible enemies” text block when the approved UI uses the selected floor's real monster preview and event information instead.

Text and preview content must not overlap on supported mobile layouts.

## 4. Floor modifiers / events

### Dungeon V2 Event Floor contract

Dungeon V2 supersedes the old generic floor-modifier selection rules for new Dungeon Event behavior.

Encounter priority is:

**Boss → Elite → Event → Normal**

Rules:

- Event is rolled independently on **Normal Floors only**.
- Event does **not** occur on Boss Floors.
- Event does **not** replace or override the dedicated Elite Floor encounter.
- When an Event is rolled, it **replaces the Normal Encounter** on that floor; it does not create an additional battle.
- Event chance is **25%** on an eligible Normal Floor.
- When an Event occurs, all seven Event types have **equal probability**: **1/7 each (~14.29%)**.
- Event floors are not fixed to predetermined floor numbers; eligible floors are determined by the random roll.
- Normal/Elite/Boss encounter generation and the Event roll must preserve the existing Dungeon V2 encounter classification rules.

The approved V2 Event types are:

| ID | Name | Effect |
| --- | --- | --- |
| `golden` | Golden Floor | Existing Golden Floor effect: **Gold ×2.2**. |
| `arcane` | Arcane Surge | Existing Arcane Surge effect: **EXP ×2**. |
| `treasure` | Treasure Trove | Existing Treasure Trove effect: **Drop +35 percentage points** and **Rare Drop Up**. |
| `rage` | Rage | Replaces Cursed Mist and keeps its existing effect: **Monster ATK ×1.55, Monster HP ×0.80, Gold ×1.35**. |
| `rush` | Rush | **Monster Speed ×2**. Hero/Pet Speed is unchanged. |
| `oasis` | Oasis | **Hero + Pet + Monster recover 5% of Max HP every Turn**, capped at Max HP. |
| `toxic` | Toxic | Hero is affected by the existing **Poison** status, using the same status mechanics as Skill-applied Poison. Toxic does not create a second Poison stack when Poison is already active. |

The legacy `elite_pack` event is **removed** from Dungeon V2 because Elite Floors already provide the dedicated Elite encounter system.

For Golden, Arcane, Treasure, and Rage, the existing approved runtime effect values remain unchanged unless a later balance decision explicitly overrides them.

Event effects must be resolved by the shared Battle Core/status systems where applicable. Do not create a parallel Poison/status implementation for Toxic.

These values are gameplay rules. Do not rebalance Event chance, Event weighting, or Event effects during a UI-only task.

## 5. Event display contract

If a floor has an event/modifier, the Floor Detail event area should display that real event rather than a decorative floor subtitle.

Examples include increased gold, stronger enemies, increased EXP, improved drops, and other approved floor modifiers.

The UI may summarize the event for readability, but must not invent effects that are not present in the runtime floor modifier data.

## 6. Monster preview contract

The selected floor's monster preview should use the actual monster identity resolved for that floor and the manifest-defined sprite when available.

Use idle animation for preview where supported. Missing optional art must follow the established fallback behavior rather than blocking floor entry.

Do not change monster combat stats, encounter generation, or battle behavior merely to make the preview look correct.

## 7. Boss floors

Boss floors must remain visually distinguishable in Floor Select and route into the existing battle/boss flow.

A visual change to boss doors does not authorize changes to boss stats, rewards, encounter logic, or Battle rules.

## 8. Navigation and responsive behavior

Dungeon Select and Floor Detail are mobile-first and must preserve the shared navigation/safe-area contract.

Verify:

- five-door composition remains readable
- doors align with the background/stairs
- locks/glow states remain understandable
- text does not overlap monster preview or controls
- safe areas and bottom navigation do not cover interactive content
- responsive scaling includes both layout and relevant visual assets

## 9. Change boundaries

A Dungeon Floor UI task must not silently alter:

- Battle turn/damage rules
- floor modifier balance
- monster stats
- drop/economy values
- save/checkpoint behavior
- unrelated navigation destinations

If one of those systems must change, read the relevant ACTIVE spec and report the dependency first.

## 10. Verification

For Dungeon Floor changes, verify the relevant subset of:

- 5-door floor-select layout
- current/cleared/locked/boss visual states
- staircase/door alignment
- selected floor event shown correctly
- selected monster preview and idle animation/fallback
- entry/back flow
- mobile safe area and no text overlap
- manifest/R2 path validity for changed assets
- no gameplay rebalance in presentation-only changes

## 11. Maintenance

Update this document when an approved Dungeon Floor production contract changes. Runtime code is evidence of implementation; if it conflicts with an approved ACTIVE contract, investigate the discrepancy rather than silently redefining the intended design.
