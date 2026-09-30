# ThornieDungeons — Dungeon Reward Progression V2

Status: **ACTIVE-DESIGN / USER-APPROVED**

Scope: Dungeon reward progression, equipment tier/rarity, monster equipment drops, Elite/Boss rewards, Boss crafting, Gold/EXP/material economy, salvage, and the reward-facing roles of Shop/Crafting.

Implementation status: **DESIGN CONTRACT ONLY — not yet production behavior.**

This document supersedes older reward-balance proposals where they conflict with the rules below. It does not replace the Dungeon encounter/stat-scaling contract, Battle Core rules, inventory safety, or save/persistence contracts.

---

## 1. Design goals

Dungeon Reward Progression V2 must:

- keep farming rewarding without turning Dungeon reruns into an unlimited high-end equipment faucet;
- make equipment drops frequent enough that farming does not feel empty;
- separate **Tier** (generation/power band) from **Rarity** (quality inside that band);
- reserve **Mythic** for special/crafted equipment rather than normal random drops;
- give Normal, Elite, Chapter Boss, First Clear, Shop, Crafting, and Salvage distinct roles;
- keep Boss reruns useful through targeted materials rather than repeatable Boss chests;
- support future monster/source-specific loot pools without rebuilding the reward system;
- keep Gold and materials useful as the game expands to higher Floors;
- preserve existing-player compatibility when implemented.

---

## 2. Dungeon encounter dependency

Reward V2 assumes the approved Dungeon V2 encounter structure:

- 1 Chapter = 10 Floors.
- Elite floors are separate encounter types (for example F5, F15, F25...).
- Chapter Boss floors are F10, F20, F30...
- Normal / Elite / Chapter Boss reward rules are separate.
- Encounter/stat scaling is governed by the dedicated Dungeon V2 stat-scaling design, not by this reward document.

Legacy production logic such as every-F5 Boss / every-F10 Elite Boss must not be treated as the intended Reward V2 structure.

---

## 3. Equipment rarity

There is **no Normal/Common equipment rarity**.

Equipment rarity is:

| Rarity | Raw stat multiplier | Empower slots | Primary source |
| --- | ---: | ---: | --- |
| Rare | ×1.00 | 1 | Monster drop / Shop |
| Unique | ×1.15 | 2 | Monster drop / Shop |
| Elite | ×1.30 | 3 | Highest normal random-drop rarity |
| Mythic | ×1.50 | 4 | Crafted Set / Boss Weapon / special sources |

Rules:

- Normal random equipment drops stop at **Elite**.
- **Mythic never drops from the generic monster equipment roll.**
- Azure, Robot, and future equipment sets are conceptually **Mythic sets**, not separate rarities.
- New architecture should represent set identity separately, e.g. rarity = mythic plus setId = azure / robot / future set.
- Existing legacy azure rarity items require backward-compatible migration/normalization when implementation begins.

### 3.1 Rarity power relationship

The intended relationship is:

- Elite of the old Tier ≈ Rare of the next Tier.
- Mythic of the old Tier ≈ Unique of the next Tier.
- Elite of the new Tier exceeds old-Tier Mythic in raw-stat budget.

This allows special Mythic gear to remain useful during early progression into the next Tier without permanently blocking new gear progression.

---

## 4. Equipment Tier progression

| Tier | Floor range | Tier power multiplier |
| --- | --- | ---: |
| T1 | F1–30 | ×1.000 |
| T2 | F31–50 | ×1.300 |
| T3 | F51–70 | ×1.690 |
| T4 | F71–90 | ×2.197 |
| T5 | F91+ | ×2.856 |

Notes:

- T1 intentionally spans 30 Floors.
- From T2 onward, progression advances in 20-Floor bands.
- T6 is not approved yet. Until a future Tier is explicitly designed, F91+ remains T5.
- The existing gearTier field should be reused where possible rather than creating a parallel Tier field.

### 4.1 Tier is the main equipment power band

Reward V2 should not continue the legacy model where the same Tier gains large base-stat increases on every Floor.

Target model:

~~~text
Base equipment stat
× Tier multiplier
× Rarity multiplier
~~~

Items of the same slot, Tier, and Rarity should share the same base power budget. Build identity then comes from slot, rarity, Enhance, Empower, set effects, Boss-specific options, and future affixes/passives.

This is an intentional change from the current continuous floor-stat formulas.

---


### 4.2 Approved base equipment stat budget

The approved normal-equipment base budget uses fixed stats by Tier rather than continuous per-Floor stat growth.

Rare base values:

| Slot | T1 | T2 | T3 | T4 | T5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Weapon ATK | 14 | 18 | 24 | 31 | 40 |
| Gloves ATK | 6 | 8 | 10 | 13 | 17 |
| Chest DEF | 9 | 12 | 15 | 20 | 26 |
| Helmet DEF | 6 | 8 | 10 | 13 | 17 |
| Boots DEF | 5 | 6 | 9 | 11 | 14 |
| Full offensive budget | 20 | 26 | 34 | 44 | 57 |
| Full defensive budget | 20 | 26 | 34 | 44 | 57 |

Slot-role target:

- Weapon ≈ 70% of normal offensive budget.
- Gloves ≈ 30% of normal offensive budget.
- Chest ≈ 45% of normal defensive budget.
- Helmet ≈ 30% of normal defensive budget.
- Boots ≈ 25% of normal defensive budget.

Apply the approved Rarity multiplier after the Tier/base-slot value.

### 4.3 Accessory utility budget

Accessory is a utility slot rather than part of the normal ATK/DEF full-set budget.

T1 Rare utility baselines:

| Utility stat | T1 Rare baseline |
| --- | ---: |
| Crit Chance | +2.5% |
| Dodge | +2.0% |
| Crit Damage | +8% |

Apply the approved Tier multiplier and Rarity multiplier to the appropriate utility baseline.

Boss First-Clear Accessory rewards should eventually have intentional Boss/source identity rather than forcing the one-time reward through uncontrolled random utility selection.

Wings remain outside the normal ATK/DEF equipment budget and should be balanced with their own special-source contract.


---

## 5. Normal monster equipment drop

Normal monsters have:

**4% equipment drop chance per defeated monster**

Rules:

- Maximum **1 generic equipment item per encounter**.
- Equipment slot is random.
- Initial generic slot pool:
  - Weapon
  - Helmet
  - Chest
  - Gloves
  - Boots
- Accessory is not in the normal generic pool.
- Mythic is not in the normal generic pool.
- For now, slots are random rather than monster-specific.
- Existing monster_loot data architecture should be retained so specific monsters can receive custom weighted pools later without redesigning the system.

### 5.1 Drop Bonus / LUK

Gear Drop Bonus must apply **multiplicatively**, not as flat percentage points.

Example:

~~~text
Base gear chance 4%
Drop Bonus +20%

4% × 1.20 = 4.8%
~~~

Do not implement 4% + 20% = 24%.

---

## 6. Rarity weights after an equipment drop succeeds

All three normal-drop rarities are available from F1. There is no rarity unlock gate.

| Floor | Rare | Unique | Elite |
| --- | ---: | ---: | ---: |
| F1–10 | 82.5% | 15% | 2.5% |
| F11–20 | 78% | 18% | 4% |
| F21–30 | 73% | 21% | 6% |
| F31–50 | 69% | 24% | 7% |
| F51–70 | 64% | 28% | 8% |
| F71–90 | 60% | 30% | 10% |
| F91+ | 55% | 33% | 12% |

These percentages are conditional on the 4% equipment roll already succeeding.

Examples:

- F1–10 Elite actual chance per normal monster = 4% × 2.5% = **0.10%**, approximately 1 in 1,000 monsters.
- F91+ Elite actual chance per normal monster = 4% × 12% = **0.48%**, approximately 1 in 208 monsters before Drop Bonus.

The design intentionally allows lucky early Elite drops while keeping Mythic outside random drops.

---

## 7. Reward roles by encounter type

| Source | EXP / Gold | Generic Gear | Materials | Special reward |
| --- | --- | --- | --- | --- |
| Normal | ×1.00 baseline | 4% per monster, max 1/encounter | normal | none |
| Elite | ×1.50 | 8% per encounter, max 1 | approx. ×2 quantity | none |
| Chapter Boss | ×2.00 | none | Boss-specific material | First-Clear Accessory |
| Chapter Boss rerun | ×2.00 | none | Boss-specific material | no chest |

### 7.1 Normal

Normal is the main source of:

- EXP
- Gold
- common materials
- low-chance Rare / Unique / Elite equipment

### 7.2 Elite

Elite is an efficient farming encounter, not a mini Boss chest.

Elite gives:

- higher EXP and Gold;
- approximately double material quantity;
- 8% generic equipment roll per Elite encounter;
- Rare / Unique / Elite only.

Elite does not drop Mythic and does not use Boss-exclusive material rules.

### 7.3 Chapter Boss

Boss does not roll generic equipment.

Boss progression is:

~~~text
First Clear
→ EXP + Gold
→ Boss material
→ One-time Accessory chest

Rerun
→ EXP + Gold
→ Boss material
→ No chest
~~~

This prevents Boss reruns from becoming an unlimited equipment faucet.

---

## 8. Boss First-Clear Accessory

Boss chest is awarded **only on the first clear**.

The chest guarantees one Accessory.

| Boss Floor | Accessory reward |
| --- | --- |
| F10 | T1 Rare |
| F20 | T1 Unique |
| F30 | T1 Elite |
| F40 | T2 Unique |
| F50 | T2 Elite |
| F60 | T3 Unique |
| F70 | T3 Elite |
| F80 | T4 Unique |
| F90 | T4 Elite |
| F100 | T5 Unique |
| F110 | T5 Elite |

Why T2+ begins at Unique:

- T1 Elite and T2 Rare have equal raw-stat budget under the approved multipliers.
- A later Boss First-Clear chest should represent a meaningful upgrade rather than repeat equal power.

Accessory acquisition is **not intended to remain Dungeon-only forever**. Future alternate sources may include systems such as:

- Raid Boss milestones;
- Daily Login streaks;
- other approved special content.

Those channels are not designed by this document.

---

## 9. Boss-specific materials

Every Chapter Boss should have its own identifiable material.

Examples are content placeholders only:

- Boss A Core
- Boss B Fang
- Boss C Crystal

Drop rule per Boss clear:

- **1 Boss Material guaranteed**
- **25% chance for +1 additional material**

Expected value:

**1.25 Boss Materials per clear**

Reasoning:

- targeted Boss crafting should make progress every successful clear;
- difficulty should come from completing several Boss clears, not from repeatedly receiving zero progress.

Boss material data must not be hardcoded to a single recipe forever. Architecture should permit future additional recipes, exchanges, upgrades, or reforges.

---

## 10. Mythic Boss Weapon crafting

Boss Weapons are:

- Rarity: **Mythic**
- Tier: Tier of the Boss
- Empower slots: **4**
- Source: targeted crafting
- Generic random drop: **never**

Base recipe target:

~~~text
Boss-specific Material ×5
+ Gold
→ Mythic Boss Weapon
~~~

At 1.25 materials per Boss clear, the target is approximately **4 Boss clears per weapon on average**.

### 10.1 Boss Weapons inside the same Tier

Boss Weapons from different Bosses inside the same Tier share the same raw-stat power budget.

Example:

- F10 Boss Weapon = T1 Mythic
- F20 Boss Weapon = T1 Mythic
- F30 Boss Weapon = T1 Mythic
- F40 Boss Weapon = T2 Mythic

F10/F20/F30 should not automatically power-creep each other through raw stat.

Their future differentiation should come from Boss-specific options/passives/build identity, for example Crit-oriented, DoT-oriented, sustain-oriented, etc.

Exact Boss Weapon special options are **NOT YET LOCKED**.

---

## 11. Mythic equipment sets

Azure, Robot, and future sets belong to the Mythic equipment layer.

Target representation:

~~~text
rarity = mythic
setId = azure
~~~

or:

~~~text
rarity = mythic
setId = robot
~~~

Set identity and Rarity must be separate concepts.

Set bonuses, set acquisition, recipe materials, and exact set power are outside the locked scope of this document unless explicitly listed later.

---

## 12. EXP baseline

Normal encounter EXP baseline:

~~~text
EXP = round(6 + Floor × 2.4)
~~~

Reference values:

| Floor | Normal EXP baseline |
| --- | ---: |
| F1 | 8 |
| F10 | 30 |
| F30 | 78 |
| F50 | 126 |
| F70 | 174 |
| F90 | 222 |
| F110 | 270 |

Encounter multipliers:

- Normal ×1.00
- Elite ×1.50
- Chapter Boss ×2.00

For multi-monster normal encounters, reward scaling should be softened rather than multiplying full rewards by monster count:

| Encounter size | Reward multiplier |
| --- | ---: |
| 1 monster | ×1.00 |
| 2 monsters | ×1.35 |
| 3 monsters | ×1.65 |

This avoids a 3-monster pack automatically paying 3× while still rewarding greater encounter difficulty.

---

## 13. Gold baseline

Normal Gold baseline:

| Floor band | Formula |
| --- | --- |
| F1–30 | 20 + 3F |
| F31–50 | 120 + 4(F − 31) |
| F51–70 | 210 + 5(F − 51) |
| F71–90 | 320 + 7(F − 71) |
| F91+ | 480 + 10(F − 91) |

Approximate reference ranges:

| Tier | Normal Gold range / baseline |
| --- | ---: |
| T1 | 23–110 |
| T2 | 120–196 |
| T3 | 210–305 |
| T4 | 320–453 |
| T5 F91–110 | 480–670 |

Encounter multipliers:

- Normal ×1.00
- Elite ×1.50
- Chapter Boss ×2.00

Gold should remain a persistent economy resource and primary scaling sink.

---

## 14. Tier economy multipliers

Gold costs for item progression scale by the item's **Tier**, not by the player's current Floor.

| Tier | Economy multiplier |
| --- | ---: |
| T1 | ×1.00 |
| T2 | ×2.25 |
| T3 | ×3.75 |
| T4 | ×5.75 |
| T5 | ×8.50 |

Reason:

- an old T1 item must not become more expensive to work on merely because the character reached F100;
- permanent Gold accumulation needs stronger sink growth than equipment raw-power growth.

---

## 15. Enhance

Status: **DEFERRED FOR V2 RE-DESIGN / NOT FULLY LOCKED**

Enhance remains an intended equipment-progression layer, but the exact V2 balance must be reviewed separately before implementation.

Do not treat the earlier legacy/current-production values for the following as final V2 requirements:

- exact stat gain per Enhance level;
- exact success-rate curve;
- exact Gold/Iron attempt costs;
- expected total +10 cost;
- final high-end power ceiling.

Current production behavior may be used as comparison/reference during the later design pass, not as automatic V2 approval.

---

## 16. Empower

Status: **DEFERRED FOR V2 RE-DESIGN / NOT FULLY LOCKED**

The Rarity architecture currently reserves the following maximum slot counts:

- Rare = 1
- Unique = 2
- Elite = 3
- Mythic = 4

However, exact Empower V2 balance is intentionally postponed.

The later design pass must explicitly review:

- exact stat pool;
- stat magnitude per slot;
- whether duplicate/same-stat rolls are allowed;
- Gold and Mana Ore costs;
- reroll/rework behavior;
- interaction with Tier/Rarity;
- total high-end power ceiling.

Do not implement the previous cost/magnitude assumptions as locked V2 balance without a new approval.

---

## 17. Normal materials

Keep the existing general material family:

- Stone
- Grass
- Wood
- Iron
- Mana Ore

Do **not** create T1 Iron, T2 Iron, T3 Iron, etc.

Target material quantity per successful material drop:

| Floor | Quantity |
| --- | ---: |
| F1–10 | 1–2 |
| F11–30 | 1–3 |
| F31–50 | 2–4 |
| F51–70 | 3–5 |
| F71–90 | 4–6 |
| F91+ | 5–8 |

Baseline material-drop target: approximately **50% per normal monster**, subject to final implementation validation against real battle pacing.

Elite encounters give approximately **×2 material quantity**.

Material roles:

- Iron → Enhance
- Mana Ore → Empower
- Stone / Grass / Wood → general Craft/consumable/future systems
- Boss-specific material → Mythic Boss crafting

---

## 18. Salvage

Normal dropped equipment should return a controlled amount of progression material.

Target V2 salvage:

| Rarity | Salvage return |
| --- | --- |
| Rare | Iron ×2 |
| Unique | Iron ×4 + Mana Ore ×1 |
| Elite | Iron ×8 + Mana Ore ×3 |
| Mythic | Do not use the normal salvage table |

Mythic crafted equipment should use source/recipe-aware refund rules.

Principles:

- Gold spent on crafting is not refunded.
- Crafted material refund should be partial.
- Salvage is a secondary material source, not the primary farming source.
- Salvage values may be tuned after real drop telemetry/playtesting, but the source-role distinction must remain.

---

## 19. Boss Weapon Gold cost

Initial crafting Gold targets:

| Tier | Boss Weapon Gold |
| --- | ---: |
| T1 | 2,500 |
| T2 | 6,000 |
| T3 | 10,000 |
| T4 | 15,000 |
| T5 | 22,500 |

These costs are intended to add a meaningful Gold sink without turning the first Mythic Boss Weapon into a very long grind.

Boss Material ×5 remains the targeted crafting requirement.

---

## 20. Shop role

Shop is:

**Bad-luck protection + Gold sink**

It is not a Best-in-Slot source.

Target Shop rules:

- normal stock: Rare / Unique;
- Elite may appear as a rare/special rotation;
- Mythic is never sold through the normal Shop;
- Shop stock Tier follows player progression/current eligible Tier;
- Shop should help players recover from poor slot RNG without replacing Dungeon farming.

Initial pricing targets:

| Tier | Rare | Unique | Elite rotation |
| --- | ---: | ---: | ---: |
| T1 | 800 | 1,300 | 2,300 |
| T2 | 1,900 | 3,200 | 5,500 |
| T3 | 3,100 | 5,200 | 9,000 |
| T4 | 4,600 | 7,700 | 13,500 |
| T5 | 6,900 | 11,500 | 20,000 |

The temporary Azure sprite-QA shop stock currently present in legacy code is not part of this design.

---

## 21. Crafting role

Crafting is the deterministic path to special Mythic equipment.

At minimum:

~~~text
Boss Craft
→ Boss-specific Material + Gold
→ Mythic Boss Weapon

Set Craft
→ Set-specific requirements + Gold
→ Mythic Azure / Robot / future set
~~~

Legacy behavior that calculates crafted stats from the character's current unlocked Floor must be replaced. Crafted output must have a defined Tier/source budget so an old recipe cannot be held until a much later Floor and then produce unintended endgame power.

---

## 22. Item Drop Pool architecture

Do not rebuild the existing monster_loot architecture.

V2 should extend/reuse it so future content can define:

- monster-specific equipment slots;
- rarity overrides/weights;
- monster-specific materials;
- future source-specific loot.

Initial V2 behavior may use the generic random slot pool when no custom monster pool exists.

The system should preserve fallback compatibility so adding new loot rows does not require rewriting generic drop logic.

---

## 23. Item-inflation controls

The following controls are part of the design and must not be removed independently:

1. Normal equipment drop chance is limited and capped to 1 generic gear per encounter.
2. Normal equipment rarity stops at Elite.
3. Mythic is source-specific and crafted/special.
4. Boss does not generate generic equipment on every clear.
5. Boss chest is First Clear only.
6. Boss rerun value comes from targeted material.
7. Shop does not sell Mythic.
8. Salvage returns controlled materials rather than duplicating high-tier gear.
9. Gold sinks scale by item Tier.
10. Tiers prevent low-generation items from scaling indefinitely with player Floor.

---

## 24. Production migration notes

Current production code does not yet match this document.

Known legacy areas that implementation must intentionally replace or migrate include:

- rarity multipliers currently much larger than V2;
- legacy Empower slot counts;
- gear Tier mapping that currently changes roughly every 4 Floors;
- equipment base stats currently scaling continuously with Floor;
- normal random rarity logic currently capped differently;
- legacy Boss chest/pity logic that allows repeatable equipment generation;
- legacy Boss Diamond reward behavior;
- generic bossHorn / bossHide crafting materials;
- crafted Azure output using current unlocked Floor;
- Azure encoded as its own rarity key;
- Shop price/value formulas tied to legacy rarity multipliers;
- temporary Azure QA Shop items.

Implementation must preserve existing saves/items and provide explicit compatibility handling. Do not silently rewrite owned player inventory.

Reward/persistence operations must remain compatible with Battle Result commit/idempotency and overflow safety.

---

## 25. Not yet locked

The following remain open for later design:

- exact names and identities of Boss-specific materials;
- exact Boss Weapon names;
- Boss Weapon special options/passives;
- Set effects for Azure / Robot / future sets;
- detailed set recipe costs and acquisition;
- future Mythic Accessory sources;
- Raid milestone Accessory details;
- Daily Login streak Accessory details;
- T6 and post-T5 progression;
- monster-specific equipment pools beyond the generic fallback;
- exact Enhance V2 rates, stat gain, costs, and final power ceiling;
- exact Empower V2 stat pool, magnitudes, costs, reroll/rework rules, and final power ceiling.

These must not be invented during implementation without a new user-approved design decision.

---

## 26. Core reward loop

~~~text
NORMAL
→ EXP
→ Gold
→ Materials
→ 4% equipment roll
   → Rare / Unique / Elite

ELITE
→ More EXP / Gold
→ More Materials
→ 8% equipment roll
   → Rare / Unique / Elite

CHAPTER BOSS — FIRST CLEAR
→ EXP + Gold
→ Boss-specific Material
→ One-time Accessory Chest

CHAPTER BOSS — RERUN
→ EXP + Gold
→ Boss-specific Material

BOSS-SPECIFIC MATERIAL ×5 + GOLD
→ Mythic Boss Weapon

SPECIAL SET CRAFT
→ Mythic Azure / Robot / future sets

UNWANTED NORMAL GEAR
→ Salvage
→ Iron / Mana Ore
→ Enhance / Empower
~~~

This loop is the baseline for Dungeon Reward Progression V2 implementation and future balance work.
