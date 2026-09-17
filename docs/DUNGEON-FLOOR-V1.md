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

Normal floors may have a modifier/event. Current runtime modifier families are:

| ID | Name | Current effect summary |
| --- | --- | --- |
| `elite_pack` | Elite Monster | stronger enemies with increased rewards/drop chance |
| `golden` | Golden Floor | increased gold |
| `arcane` | Arcane Surge | increased EXP |
| `treasure` | Treasure Trove | increased drop chance and rarity boost |
| `cursed` | Cursed Mist | higher enemy attack, lower enemy HP, improved gold |

Current runtime leaves 60% of normal floors without a modifier and rolls a modifier for the remaining 40%.

These values are gameplay/economy rules. Do not rebalance percentages or multipliers during a UI-only task.

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
