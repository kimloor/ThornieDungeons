# ThornieDungeons — Arena V2 Graphics Asset Master Checklist

**STATUS:** LIVING DOCUMENT / SOURCE OF TRUTH  
**OWNER:** Graphics Agent + Project Lead  
**SCOPE:** Arena V2 graphics/assets only  
**RISK:** LOW for documentation / MEDIUM for asset publication  
**LAST AUDIT BASE:** `9f99ca020fb03867acb95db38d5886975822e5da`  
**LAST UPDATED:** 2026-09-30

---

## 1. Purpose

This file is the persistent checklist for **all Arena V2 graphics work**.

Arena graphics will be completed across multiple batches. Do **not** assume one session or one graphics batch will finish the entire pack.

Every future Graphics Agent must:

1. Read this file before creating or replacing any Arena asset.
2. Check the latest `main`, `AGENTS.md`, `r2-upload/README.md`, current R2 manifests, and current Arena assets.
3. Treat every checked item `[x]` as **already completed / approved / reusable** unless the Project Lead explicitly requests a revision.
4. Do **not** redraw, rename, move, overwrite, or “improve” a checked production asset just because a new batch starts.
5. Work only on unchecked `[ ]` items assigned for the current batch.
6. After Project Lead approval, publish through the normal R2/manifest workflow and then update this checklist.
7. Record the approved path, manifest key, dimensions, and commit in the Progress Log when known.
8. Preserve work from other DEV / QA / Graphics branches. No force-push.

This document tracks **graphics state**, not gameplay completion.

---

## 2. Design source of truth

### Visual reference

Primary Arena Hub visual direction:

- ChatGPT Library reference: `ThornieDungeons/refs/arena/arena-v2-option-b.png`
- Reference name: **OPTION B — Arena Hub + Tabs**

Use this reference for:

- dark navy + warm gold competitive fantasy language;
- strong Arena identity;
- readable mobile hierarchy;
- tab treatment;
- premium panel/button/icon language;
- colosseum atmosphere.

### Important: current design overrides the old mockup

Do **not** reproduce the old mockup literally.

Current Arena V2 rules override it:

- No Arena Shop tab in current W9.
- Current tabs are:
  - BATTLE
  - SETUP
  - RANKING
  - HISTORY
- Do not create EASY / EQUAL / HARD opponent categories.
- Do not bake reward estimates into opponent artwork.
- Opponent information remains dynamic UI.
- Dynamic text must stay DOM/UI text:
  - player name
  - level
  - rating
  - tier text
  - season number
  - season countdown
  - ticket count
  - Arena Coin count
  - rank
  - rewards
  - result text
- Phaser is presentation-only; graphics must not encode gameplay logic.

---

## 3. Status rules

Use only these checklist meanings:

- `[x]` = approved/current asset exists and must be preserved.
- `[ ]` = not completed yet, or not approved for production yet.

An item may be checked only when:

- final visual is Project Lead approved;
- production output exists at the agreed path;
- transparency/edges/mobile readability are verified;
- R2 manifest entry is correct when required;
- no unrelated approved asset was replaced.

A concept mockup, temporary generation, comparison sheet, or unapproved candidate is **not** enough to tick the box.

---

# PART A — EXISTING / APPROVED ASSETS

These assets already exist. **Do not recreate them unless explicitly requested.**

## 4. Arena base assets

- [x] **Arena colosseum/background**
  - Current path: `r2-upload/ui/arena/arena_background.webp`
  - Manifest key: `assets.arenaUi.background`
  - Status: approved/current
  - Use:
    - Arena Hub background
    - current Arena visual identity
    - can remain current Arena battle backdrop until a future explicit split is approved
  - Preserve:
    - safe mobile crop
    - calm central actor zone
    - no baked UI/data

- [x] **Arena Coin icon**
  - Current path: `r2-upload/ui/item-icons/currency/arena_coin.png`
  - Manifest key: `assets.itemIcons.currency.arenaCoin`
  - Status: approved/current
  - Do not redraw.
  - Must continue to work in the shared global currency bar.

- [x] **Arena Ticket icon**
  - Current path: `r2-upload/ui/item-icons/currency/arena_ticket.png`
  - Manifest key: `assets.itemIcons.currency.arenaTicket`
  - Status: approved/current
  - Do not redraw.
  - Must remain visually distinct from Gold / Diamond / Arena Coin.

## 5. Arena seasonal Profile Frames

These are **global profile frames**, not Arena-only Player Card decorations.

- [x] **Season Rank 1 Profile Frame**
  - Path: `r2-upload/ui/profile-frames/arena_rank_1.png`
  - Manifest key: `assets.profileFrames.arenaRank1`
  - Status: approved/current

- [x] **Season Rank 2 Profile Frame**
  - Path: `r2-upload/ui/profile-frames/arena_rank_2.png`
  - Manifest key: `assets.profileFrames.arenaRank2`
  - Status: approved/current

- [x] **Season Rank 3 Profile Frame**
  - Path: `r2-upload/ui/profile-frames/arena_rank_3.png`
  - Manifest key: `assets.profileFrames.arenaRank3`
  - Status: approved/current

Profile-frame geometry contract is recorded in:

- `r2-upload/ui/arena/GRAPHICS_CONTRACT.json`

Do not confuse these with the fixed Player Card avatar frame.

## 6. Existing Player Card asset family — reuse

Arena Player Card already uses the approved Social Player Card family.

- [x] `r2-upload/ui/social/player_card/card_bg.png`
- [x] `r2-upload/ui/social/player_card/detail_panel.png`
- [x] `r2-upload/ui/social/player_card/name_plate.png`
- [x] `r2-upload/ui/social/player_card/avatar_frame.png`
- [x] `r2-upload/ui/social/player_card/avatar_placeholder_no_pic.png`
- [x] `r2-upload/ui/social/player_card/button_primary.png`
- [x] `r2-upload/ui/social/player_card/button_secondary.png`
- [x] `r2-upload/ui/social/player_card/button_close.png`

**Do not create a new Arena Player Card family.**

Current Arena Player Card issues are layout/presentation issues unless the Project Lead explicitly asks for new art.

## 7. Existing shared Battle UI — reuse in Arena Battle

The following are already production assets and should be reused where appropriate:

- [x] **Battle top bar**
  - `r2-upload/ui/battle/battle_top_bar.png`
  - Manifest: `assets.battleUi.topBar`

- [x] **Turn-order / ATB slot**
  - `r2-upload/ui/battle/turn_order_slot.png`
  - Manifest: `assets.battleUi.turnOrderSlot`

- [x] **HP / status frame**
  - `r2-upload/ui/battle/hp_status_frame.png`
  - Manifest: `assets.battleUi.hpStatusFrame`

- [x] **Target selected marker**
  - `r2-upload/ui/battle/target_selected_marker.png`
  - Manifest: `assets.battleUi.targetSelectedMarker`

- [x] **Quick/skill slot frame**
  - `r2-upload/ui/battle/quick_slot_frame.png`
  - Manifest: `assets.battleUi.quickSlotFrame`

- [x] **Attack button**
  - `r2-upload/ui/battle/button_attack.png`

- [x] **Auto button**
  - `r2-upload/ui/battle/button_auto.png`

- [x] **Settings button**
  - `r2-upload/ui/battle/button_settings.png`

- [x] **Skip button**
  - `r2-upload/ui/battle/button_skip.png`

- [x] **Speed x1**
  - `r2-upload/ui/battle/button_speed_x1.png`

- [x] **Speed x2**
  - `r2-upload/ui/battle/button_speed_x2.png`

- [x] **Dungeon Flee button exists**
  - `r2-upload/ui/battle/button_flee.png`
  - Important: this is **not automatically the Arena Surrender asset**.
  - Arena Surrender gets its own TODO below unless Project Lead explicitly approves reuse.

### ATB icon rule

Do **not** create four fixed Arena ATB character icons.

The slot frame is static art, but the icon/portrait must represent the actual actor:

- attacker Hero
- attacker Pet
- defender Hero
- defender Pet

Preferred runtime source:

- real Hero head/portrait presentation from the match;
- real Pet icon/presentation from the prepared match snapshot.

Only create fallback icons if requested below.

---

# PART B — ARENA HUB CORE PACK

This is the highest-priority missing graphics set.

After enough of this section is approved, DEV can progressively replace the current CSS-only Arena Hub with asset-driven UI.

## 8. Arena identity

- [x] **Arena emblem**
  - Proposed canonical path: `r2-upload/ui/arena/hub/arena_emblem.png`
  - Purpose:
    - main Arena identity above/inside Hub header
  - Visual:
    - fantasy competitive shield
    - crossed weapons or equivalent combat symbol
    - laurel/champion treatment
    - dark navy / steel / warm gold family
  - Requirements:
    - transparent PNG
    - readable on narrow mobile
    - strong silhouette at small size
    - no player-specific data
    - **do not bake the word “ARENA” into the image**
  - Text remains DOM so localization/layout stay flexible.
  - Final dimensions: 512×512 (approved R1).
  - Manifest key: `assets.arenaUi.hub.emblem` (published independently of UI integration).

## 9. Reusable Arena panels

- [x] **Arena main panel frame**
  - Proposed path: `r2-upload/ui/arena/hub/panel_frame.png`
  - Purpose:
    - Season summary
    - Setup panel
    - Ranking panel
    - History panel
    - Result/reward containers where appropriate
  - Requirements:
    - stretch-safe / 9-slice-safe geometry
    - corners/ornaments must not distort
    - center must remain calm for dynamic content
    - dark navy body with restrained gold edge
    - no baked text
    - no fixed height assumptions
    - must support narrow iPhone width

- [x] **Arena list-row frame**
  - Proposed path: `r2-upload/ui/arena/hub/row_frame.png`
  - Purpose:
    - opponent rows
    - ranking rows
    - history rows
  - Requirements:
    - reusable across different row heights
    - lighter visual weight than main panel
    - enough contrast for name / level / rating / action button
    - no baked separator text
    - stretch-safe horizontally

## 10. Arena tabs

Current required tabs are exactly:

1. BATTLE
2. SETUP
3. RANKING
4. HISTORY

No Shop tab in current W9.

### Tab backgrounds

- [x] **Tab active**
  - Proposed path: `r2-upload/ui/arena/tabs/tab_active.png`
  - Requirements:
    - selected state clearly visible without relying on text color only
    - blue/gold premium active treatment
    - stretch-safe
    - no baked icon
    - no baked text

- [x] **Tab inactive**
  - Proposed path: `r2-upload/ui/arena/tabs/tab_inactive.png`
  - Requirements:
    - same geometry as active
    - darker/quieter
    - clear active/inactive hierarchy
    - no baked icon/text

### Tab icons

All icons must be:

- transparent PNG;
- same canvas family;
- same optical weight;
- production display 24–32 px; 24 px minimum for detailed Setup/History icons;
- readable in active and inactive states;
- no baked text.

- [x] **Battle tab icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_battle.png`
  - Direction: crossed swords / crossed weapons
  - Avoid looking identical to the generic Attack button.

- [x] **Setup tab icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_setup.png`
  - Direction: warrior helmet, shield+gear, or loadout motif
  - Must communicate team/loadout configuration.

- [x] **Ranking tab icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_ranking.png`
  - Direction: trophy / podium / laurel
  - Must read clearly at small scale.

- [x] **History tab icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_history.png`
  - Direction: scroll/log + clock
  - Must communicate battle record/history, not mailbox.

---

# PART C — ARENA BUTTON FAMILY

Use one coherent family so later Arena screens do not create random CSS buttons.

All button artwork:

- no baked label text;
- touch area belongs to UI code, not image;
- stretch-safe where possible;
- consistent corner radius and edge treatment;
- preserve readable center for DOM label/icon;
- provide disabled-state strategy through runtime tint/opacity unless a dedicated disabled asset is later required.

## 11. Buttons

- [x] **Arena primary button**
  - Proposed path: `r2-upload/ui/arena/buttons/button_primary.png`
  - Use:
    - BATTLE
    - SAVE SETUP
    - major confirmation
    - BACK TO ARENA where primary
  - Direction:
    - highest emphasis
    - blue/gold or gold-dominant
    - should not compete visually with destructive states

- [x] **Arena secondary button**
  - Proposed path: `r2-upload/ui/arena/buttons/button_secondary.png`
  - Use:
    - PLAYER CARD
    - CLOSE
    - FULL LOG
    - information/secondary actions
  - Direction:
    - navy/steel
    - clearly below primary

- [x] **Arena danger button**
  - Proposed path: `r2-upload/ui/arena/buttons/button_danger.png`
  - Use only for genuinely destructive/danger actions if Arena UI requires one.
  - Red/coral treatment.
  - Do not use simply to make a button visually different.

---

# PART D — ARENA HUB UTILITY ICONS

## 12. Utility icons

- [x] **Season / countdown icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_season.png`
  - Direction: clock / hourglass / calendar-clock
  - Use near season countdown.
  - Must not look like History icon; Season should read as “time remaining”.

- [x] **Refresh opponent icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_refresh.png`
  - Direction: circular refresh arrows
  - Must remain recognizable at 18–24 px.

- [x] **Player Card icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_player_card.png`
  - Direction: profile/card silhouette
  - Use in opponent action/button where desired.
  - Do not duplicate the actual Player Card avatar frame.

- [x] **Information icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_info.png`
  - Direction: clean circled “i” or equivalent
  - Use:
    - Currency info
    - Arena rules/help hint
  - Must remain legible at very small size.

---

# PART E — ARENA TIER BADGES

Current server tier names are:

- Bronze
- Silver
- Gold
- Diamond

Do not create Platinum or Master.

Tier artwork must:

- be a coherent family;
- have the same footprint/canvas;
- remain identifiable without tier text;
- not bake numeric rating;
- not bake “Bronze”, “Silver”, etc. into image;
- leave tier name as DOM text;
- scale cleanly around header/profile sizes.

## 13. Tier badges

- [x] **Bronze tier badge**
  - Proposed path: `r2-upload/ui/arena/tiers/tier_bronze.png`
  - Material hierarchy: bronze/copper
  - Lowest visual ornament level while still premium.

- [x] **Silver tier badge**
  - Proposed path: `r2-upload/ui/arena/tiers/tier_silver.png`
  - Material hierarchy: silver/steel
  - Visibly above Bronze.

- [x] **Gold tier badge**
  - Proposed path: `r2-upload/ui/arena/tiers/tier_gold.png`
  - Gold ornament
  - Visibly above Silver.

- [x] **Diamond tier badge**
  - Proposed path: `r2-upload/ui/arena/tiers/tier_diamond.png`
  - Highest normal Arena tier
  - Premium crystal/gem treatment
  - Must not be confused with the global Diamond currency icon.

---

# PART F — MILESTONE / PROGRESS PACK

This is not required to remove CSS from the first Hub pass, but should belong to the same Arena family.

## 14. Progress UI

- [x] **Arena progress frame**
  - Proposed path: `r2-upload/ui/arena/progress/progress_frame.png`
  - Reusable for Arena milestones/progress
  - Stretch-safe horizontally
  - No baked progress amount

- [x] **Arena progress fill**
  - Proposed path: `r2-upload/ui/arena/progress/progress_fill.png`
  - Must crop/mask cleanly from 0–100%
  - Avoid ornament that looks broken when partially filled

- [x] **Arena reward slot**
  - Proposed path: `r2-upload/ui/arena/progress/reward_slot.png`
  - Use for milestone/reward checkpoints
  - Must support currency/item icon overlay
  - No baked reward icon

## 15. Milestone icons

- [x] **Play milestone icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_play_milestone.png`
  - Meaning: total Arena matches played
  - Direction: crossed weapons / arena participation marker
  - Must not look like WIN.

- [x] **Win milestone icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_win_milestone.png`
  - Meaning: total Arena wins
  - Direction: wreath/check/trophy
  - Clearly different from play-count icon.

---

# PART G — HISTORY / RESULT PACK

## 16. Battle history icons

- [x] **Attack history icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_attack_history.png`
  - Meaning: matches where the player attacked/challenged
  - Direction: sword/arrow-forward/offense motif

- [x] **Defense history icon**
  - Proposed path: `r2-upload/ui/arena/icons/icon_defense_history.png`
  - Meaning: offline/defense history
  - Direction: shield/guard motif
  - Must be visually distinct from attack history.

## 17. Result emblems

These are presentation emblems only. Result text remains DOM.

- [ ] **WIN emblem**
  - Proposed path: `r2-upload/ui/arena/results/result_win.png`
  - Direction: victory laurel / champion mark
  - Positive but not visually stronger than Rank 1 seasonal frame.

- [ ] **LOSS emblem**
  - Proposed path: `r2-upload/ui/arena/results/result_loss.png`
  - Direction: restrained defeat/broken crest
  - Avoid overly punitive/gory art.

- [ ] **DRAW emblem**
  - Proposed path: `r2-upload/ui/arena/results/result_draw.png`
  - Direction: balanced crossed shields/weapons
  - Must not look like WIN or LOSS.

---

# PART H — ARENA BATTLE-SPECIFIC MISSING ART

Most Arena Battle UI should reuse the existing shared Battle pack.

## 18. Surrender button

- [ ] **Arena Surrender button**
  - Proposed path: `r2-upload/ui/arena/battle/button_surrender.png`
  - Reason:
    - Dungeon has `button_flee.png`
    - Arena rule is **Surrender**, not Flee
    - do not silently repurpose semantics without approval
  - Visual:
    - same geometry/visual family as Battle buttons
    - danger/withdrawal identity
    - no baked “SURRENDER” text
    - runtime supplies text/countdown
  - Must work with the 10-second Surrender cooldown presentation.

## 19. Optional fallback actor icons

These are **optional** and should be created only if runtime presentation needs them.

- [ ] **Hero fallback ATB icon — OPTIONAL**
  - Proposed path: `r2-upload/ui/arena/battle/icon_hero_fallback.png`
  - Use only when a real Hero portrait/head asset cannot be resolved.
  - Generic silhouette only.
  - Never replace the real actor portrait when available.

- [ ] **Pet fallback ATB icon — OPTIONAL**
  - Proposed path: `r2-upload/ui/arena/battle/icon_pet_fallback.png`
  - Use only when real Pet icon/presentation cannot be resolved.
  - Never bake a specific Pet into the fallback.

---

# PART I — DO NOT CREATE / DO NOT DUPLICATE

Unless explicitly approved later, Graphics should **not** create any of the following:

- [x] No new Arena Coin icon — already exists.
- [x] No new Arena Ticket icon — already exists.
- [x] No new Arena background just because a new graphics batch starts.
- [x] No new Rank 1/2/3 Profile Frames — already approved.
- [x] No second Arena Player Card skin.
- [x] No second ATB slot frame.
- [x] No second HP/status frame.
- [x] No second target marker.
- [x] No second Attack button.
- [x] No second Auto button.
- [x] No second x1/x2 speed buttons.
- [x] No separate Skill 1/2/3/4 frames — reuse Battle quick-slot frame.
- [x] No Shop tab/icon for current W9.
- [x] No EASY / EQUAL / HARD opponent banners.
- [x] No static opponent portraits tied to specific BOTs/players.
- [x] No static four-character ATB icon sheet.
- [x] No text baked into panels/buttons/tabs.
- [x] No season number baked into artwork.
- [x] No rating/rank/countdown/reward amount baked into artwork.
- [x] No fake HP bars or actor shadows baked into Arena background.

---

# PART J — FILE / R2 CONTRACT

## 20. Canonical Arena asset family

Existing Arena root:

`r2-upload/ui/arena/`

For new work, use the following organization unless Project Lead explicitly changes it:

- `ui/arena/hub/`
  - emblem
  - reusable Hub panels/rows

- `ui/arena/tabs/`
  - active/inactive tab backgrounds

- `ui/arena/icons/`
  - tab/utility/history/milestone icons

- `ui/arena/buttons/`
  - reusable Arena Hub button family

- `ui/arena/tiers/`
  - Bronze/Silver/Gold/Diamond

- `ui/arena/progress/`
  - milestone/progress frames

- `ui/arena/results/`
  - win/loss/draw emblems

- `ui/arena/battle/`
  - Arena-specific Battle assets only

### Publication rules

Before publishing any new item:

1. Inspect current file dimensions and format conventions from comparable production UI assets.
2. Do not guess final dimensions when an existing reusable contract already exists.
3. Transparent assets must have clean alpha edges:
   - no white matte
   - no black matte
   - no accidental rectangular background
4. Keep useful negative space for DOM text/icon overlays.
5. Panels/buttons intended for resizing must be stretch-safe / 9-slice-safe.
6. Update:
   - `r2-upload/manifest.json`
   - any synced/generated manifest only through the normal project pipeline
7. Verify exact path and manifest key match.
8. Do not rename an approved production path later without updating all references.
9. Do not publish rejected candidates into production paths.
10. Do not edit gameplay/API/Phaser logic in a graphics-only batch.

---

# PART K — ICON DESIGN CONTRACT

## 21. Shared icon rules

All new Arena icons must:

- use one coherent visual family;
- work on dark navy and light/gold surfaces;
- use clean silhouettes;
- remain identifiable at small mobile sizes;
- avoid tiny decorative details that disappear around 20–32 px;
- avoid text/letters unless the symbol fundamentally requires them;
- use transparent background;
- keep safe padding around the silhouette;
- keep consistent optical weight across the set;
- avoid cloning Gold/Diamond/Arena Coin silhouettes;
- avoid looking like generic emoji;
- feel like ThornieDungeons fantasy UI.

### Master/export note

Graphics may use a larger working master for quality, but **final production dimensions must be chosen after inspecting comparable current production icons**.

Once the first approved icon family establishes final canvas dimensions, record that dimension here and reuse it for the whole family:

- Arena icon final canvas: **256×256; display 24–32 px**
- Tier badge final canvas: **256×256; max artwork extent 224 px**
- Tab background final size/9-slice contract: **256×128; 22 px source insets on all sides**
- Button final size/9-slice contract: **512×128; 32 px source insets on all sides**
- Panel frame 9-slice contract: **768×512, 64 px source insets; row 768×160, 48 px source insets**

Do not allow later batches to silently switch canvas geometry.

---

# PART L — REVIEW FLOW

## 22. Batch strategy

Do not try to generate and publish the entire pack in one pass.

Recommended order:

### Graphics Batch A — Hub foundation

- [x] Arena emblem
- [x] Panel frame
- [x] Row frame
- [x] Tab active
- [x] Tab inactive
- [x] Battle tab icon
- [x] Setup tab icon
- [x] Ranking tab icon
- [x] History tab icon

**Review sheet:** show all 9 together in one Arena Hub mockup plus small-size icon row.

### Graphics Batch B — Hub controls + tiers

- [x] Primary button
- [x] Secondary button
- [x] Danger button
- [x] Season icon
- [x] Refresh icon
- [x] Player Card icon
- [x] Info icon
- [x] Bronze tier badge
- [x] Silver tier badge
- [x] Gold tier badge
- [x] Diamond tier badge

**Review sheet:** show button hierarchy and all four tier badges side-by-side.

### Graphics Batch C — Progress + History + Results

- [x] Progress frame
- [x] Progress fill
- [x] Reward slot
- [x] Play milestone icon
- [x] Win milestone icon
- [x] Attack history icon
- [x] Defense history icon
- [ ] WIN emblem
- [ ] LOSS emblem
- [ ] DRAW emblem

### Graphics Batch D — Arena Battle additions

- [ ] Surrender button
- [ ] Hero fallback ATB icon — only if runtime needs it
- [ ] Pet fallback ATB icon — only if runtime needs it

---

# PART M — ACCEPTANCE CHECKLIST FOR EVERY GRAPHICS BATCH

Before returning `THORNIE_GRAPHICS_HANDOFF`:

- [ ] Latest `main` and `AGENTS.md` checked.
- [ ] This checklist was read first.
- [ ] Only assigned unchecked items were worked on.
- [ ] Existing checked assets were preserved.
- [ ] Comparison/review sheet was shown before final publication where appropriate.
- [ ] Project Lead approval received for final candidate.
- [ ] Production asset has clean edges/transparency.
- [ ] Small mobile readability checked.
- [ ] Safe-area/crop assumptions checked where relevant.
- [ ] Stretch/9-slice safety checked for panels/buttons.
- [ ] No dynamic text baked into art.
- [ ] No gameplay values baked into art.
- [ ] R2 production path verified.
- [ ] Manifest path/key verified.
- [ ] No unrelated manifest entry changed.
- [ ] No unrelated Hero/Pet/Equipment art changed.
- [ ] Rejected temporary candidates not left in production paths.
- [ ] This document updated:
  - tick completed items;
  - fill final dimensions;
  - fill manifest key;
  - add Progress Log entry.
- [ ] Return handoff includes exact branch + HEAD + paths + manifest keys.

---

# PART N — PROGRESS LOG

Append new entries. Do not rewrite old approved history unless correcting a factual error.

## 2026-09-30 — Master checklist created

**Audit base:** `9f99ca020fb03867acb95db38d5886975822e5da`

Confirmed existing approved/reusable production assets:

- Arena background
- Arena Coin
- Arena Ticket
- Arena Rank 1/2/3 Profile Frames
- Social Player Card art family
- shared Battle top bar / ATB slot / HP/status / target marker / quick slot
- shared Battle Attack / Auto / Settings / Skip / Speed x1 / Speed x2

Confirmed current Arena Hub is **not yet fully asset-driven**.

Main missing Arena graphics groups:

- Hub emblem/panel/row
- tabs + four tab icons
- Arena Hub button family
- utility icons
- Bronze/Silver/Gold/Diamond tier badges
- milestone/progress art
- history/result icons
- Arena-specific Surrender button
- optional fallback actor icons only if runtime requires them

Current rule:

> Preserve every approved asset. Future graphics batches continue only from unchecked items in this document.

---

## 2026-10-01 — Arena Hub Extension R1 approved for publication/integration

**Integration base:** `801611fec0980e74db60532540049fa5eb7443b3`

Approved 18 new Arena Hub assets from `ARENA_HUB_EXTENSION_REVIEW_R1` and integrated them without regenerating or altering Hub Core R1.

Completed groups:
- button family: primary / secondary / danger — 512×128, 32 px source nine-slice insets;
- utility icons: season / refresh / Player Card / info — 256×256;
- tier badges: Bronze / Silver / Gold / Diamond — 256×256, shared 224 px maximum artwork extent;
- progress: frame 512×64 with 16 px source insets, fill 512×32 clipped by percentage, reward slot 256×256;
- milestone icons: Play / Win — 256×256;
- history icons: Attack / Defense — 256×256.

Runtime scope:
- Arena Hub only;
- manifest/optionalAsset resolution only, no hardcoded R2 URLs;
- current Tier badge in summary and tier badges in Ranking;
- Season / Info / Refresh / Player Card utility icons;
- asset-skinned primary/secondary Hub buttons;
- compact Play/Win milestone progress using authoritative Attack W/D/L status;
- Attack/Defense History identity;
- Arena Battle / Result shared presentation and Battle Core remain unchanged.

Manifest keys and nine-slice metadata are recorded in `r2-upload/ui/arena/GRAPHICS_CONTRACT.json` → `hubExtensionR1`.

Publication / verification:
- integration commit: `dd58c0cad8ebf49524ea9134651ebc05f46cd643`;
- R2 run: `36801032793` — SUCCESS, 20 changed R2 objects uploaded and downloaded with matching SHA-256;
- Frontend Production run: `36801032829` — SUCCESS, Worker Version ID `e06e078b-7ac2-4abd-bd9b-506096cacc7d`;
- Battle Core parity run: `36801032827` — SUCCESS, including W9 suites and `node build.js` generated-frontend equality check.

Next Arena graphics scope remains Battle/Result only: Surrender button and WIN/LOSS/DRAW result emblems; fallback actor icons only if runtime proves they are needed.


# PART O — HANDOFF TEMPLATE

Use this after each graphics batch:

**THORNIE_GRAPHICS_HANDOFF**  
**STATUS:** READY_FOR_REVIEW / READY_FOR_INTEGRATION  
**BATCH:** Arena Graphics <batch name>  
**BRANCH:** <branch>  
**HEAD:** <sha>

**COMPLETED**
- <asset>
- <asset>

**CHECKLIST UPDATED**
- [x] <asset>
- [x] <asset>

**FILES**
- <path>
- <path>

**MANIFEST**
- <key> → <path>

**DIMENSIONS / CONTRACT**
- <asset>: <dimensions / stretch contract>

**PRESERVED**
- Existing Arena background
- Arena Coin/Ticket
- Rank Profile Frames
- Player Card family
- shared Battle UI
- unrelated Graphics/DEV work

**NOT DONE / NEXT**
- <next unchecked assets>

**DEPLOY**
- NONE unless separately authorized.

## Approved Hub Core R1 publication — 2026-09-30

Exact approved artwork. Final paths, dimensions, manifest keys and publication commit are recorded in [R1 publication](ARENA-V2-HUB-CORE-R1-PUBLICATION.md). Nine-slice metadata: `r2-upload/ui/arena/GRAPHICS_CONTRACT.json` → `hubCoreR1`. Only the nine Hub Core assets are complete; later batches remain unfinished.

Publication commit: `3496d9035a1feb759fd239374ed457eac198f7a7`; R2 run `36734738831` SUCCESS, 11 objects uploaded/downloaded with matching SHA-256.
