# ThornieDungeons — Dungeon Reward Progression V2

Status: **LOCKED / USER-APPROVED — READY FOR V2 IMPLEMENTATION**

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
- preserve save/currency integrity while applying the explicitly approved destructive cleanup of overpowered legacy Wings and legacy crafted Set items.

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
- Legacy Azure/crafted Set items that use the old overpowered rarity/stat model are explicitly removed during V2 migration rather than normalized; see Production migration notes.

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

Accessory acquisition is not Dungeon-only. Raid milestone Accessory rewards are now defined in the Raid / Wings V2 section below. Daily Login and other future special sources remain separate future content.

---


## 9. Boss-specific materials

Chapter Bosses use one dedicated Stone material each:

| Chapter Boss | Boss Material | Mythic Boss Weapon |
| --- | --- | --- |
| Moss King | **Earth Stone** | **Spirit Greatsword** |
| Ember Drake | **Fire Stone** | **Lavalon Sword** |
| Frost Warden | **Water Stone** | **Icicle Longsword** |

Drop rule per Boss clear:

- **1 matching Boss Stone guaranteed**
- **25% chance for +1 additional matching Stone**

Expected value:

**1.25 Boss Stones per clear**

Rules:

- Earth / Fire / Water Stone do not substitute for one another.
- Normal and Elite encounters do not drop these Boss-exclusive Stones.
- First Clear does not add a separate Stone bonus; reruns retain value through the same guaranteed Stone progression.
- Boss material data should remain source-aware so future recipes/exchanges can reuse the material without hardcoding one recipe forever.

## 10. Mythic Boss Weapon crafting

Boss Weapons are:

- Rarity: **Mythic**
- Tier: Tier of the Boss
- Empower slots: **4**
- Source: targeted crafting
- Generic random drop: **never**
- Each Boss Weapon has exactly **one fixed Signature Effect**
- Signature Effect does not randomly roll and does not scale by equipment Tier

Base recipe target:

~~~text
Boss-specific Material ×5
+ Gold
→ Mythic Boss Weapon
~~~

At 1.25 materials per Boss clear, the target is approximately **4 Boss clears per weapon on average**.

Boss Weapon salvage does **not** return Earth / Fire / Water Stone and does not refund crafting Gold. Boss Weapons use source-aware Mythic salvage behavior rather than the normal Rare/Unique/Elite salvage table.

### 10.1 Boss Weapons inside the same Tier

Boss Weapons from different Bosses inside the same Tier share the same raw-stat power budget.

Example:

- F10 Boss Weapon = T1 Mythic
- F20 Boss Weapon = T1 Mythic
- F30 Boss Weapon = T1 Mythic
- F40 Boss Weapon = T2 Mythic

Boss Weapons inside the same Tier do not power-creep each other through raw ATK. Their identity comes from the fixed Signature Effect.

### 10.2 Moss King — Spirit Greatsword

When the Hero completes a successful Basic Attack or damaging Skill action:

- roll **30% once per action**;
- on success, restore **10% of Max HP**;
- multi-hit skills still roll only once for this Signature;
- this heal is based on Max HP, not damage dealt.

Short item description:

~~~text
โจมตีโดน: 30% ฟื้น HP 10%
~~~

### 10.3 Ember Drake — Lavalon Sword

For every successful hit caused by a Skill:

- each successful Skill hit independently has **10% chance** to trigger one immediate extra Basic Attack;
- the roll is intentionally **per hit**;
- maximum **3 extra Basic Attacks per Skill action**;
- an extra Basic Attack created by this Signature cannot trigger Ember's Signature again;
- the extra attack is a normal Basic Attack: it can hit/miss and Crit, consumes no extra resource, and does not consume another turn.

Short item description:

~~~text
สกิลโดน: 10%/Hit โจมตีปกติเพิ่ม 1 ครั้ง
~~~

### 10.4 Frost Warden — Icicle Longsword

After the Hero receives a successful **direct damaging action**:

- roll **20% once per enemy action**;
- on success, immediately Counter Attack the attacker once;
- multi-hit enemy skills do not create multiple Frost rolls;
- Poison, DoT, Reflect, and other indirect damage do not trigger this Signature;
- a counter created by this Signature cannot trigger another Frost counter chain.

Short item description:

~~~text
ถูกโจมตี: 20% สวนกลับ 1 ครั้ง
~~~

### 10.5 Signature presentation

Boss Weapon Signature text must be visually separated from normal item stats and Empower options.

- Use a dedicated **Mythic Signature gold accent** for the Signature line.
- Do not reuse Empower roll-quality colors such as Max-Roll blue or Low-Roll gray.
- Keep the visible description short and player-readable; detailed internal trigger rules belong to system logic/documentation rather than the normal item card.

---

## 11. Mythic equipment sets

Azure, Robot, Skeleton, and future sets belong to the Mythic equipment layer.

Target representation:

~~~text
rarity = mythic
setId = azure | robot | skeleton
~~~

Set identity and Rarity are separate concepts.

Current full sets use six equipment pieces — **Weapon, Helmet, Chest, Gloves, Boots, Accessory** — and activate cumulative bonuses at **2 / 4 / 6 equipped pieces**. **Wings are a separate slot and never count as a Set piece.**

A Mythic Set Item does **not** receive an additional standalone Boss-Weapon-style Signature Effect per piece. Its special power budget comes from its Set Bonus.


### 11.1 Azure Set — CC / tempo

**2 pieces**

- **AGI +5**

**4 pieces**

- Hero **Active Skill MP cost is reduced by 50%**.
- Applies to costed Hero Active Skills only.
- Does not apply to Basic Attack, Potion, or Pet Skill.
- Combine with Skill Efficiency multiplicatively rather than additively:

~~~text
Final MP Cost
= ceil(Base MP Cost × Skill Efficiency multiplier × 0.50)
~~~

- A costed skill cannot be reduced below **1 MP**.
- Example: Skill Efficiency 10% plus Azure 4pc means 45% of base MP cost, not 40%.

**6 pieces**

- after a successful damaging action, roll **30% once per action**;
- on success, randomly apply:
  - **Stun 1 turn**, or
  - **Silence 2 turns**;
- Stun / Silence selection is **50 / 50**;
- multi-hit actions do not roll separately per hit;
- normal status resistance and the shared Battle Core Boss control-status conversion rules remain applicable.

### 11.2 Skeleton Set — ATK / Crit / Armor Break

**2 pieces**

- **STR +5**

**4 pieces**

- **Crit Damage +30 percentage points**

**6 pieces**

- every Critical Hit **guarantees Armor Break** on that target;
- Armor Break lasts **2 turns**;
- this guaranteed application is not reduced by Status Resist;
- Armor Break does **not stack** into a stronger reduction;
- applying it again refreshes the duration to 2 turns;
- the hit that creates Armor Break uses the target DEF snapshot from before the new debuff; Armor Break affects subsequent hits/actions.

The shared Battle Core Armor Break value remains **15% effective DEF reduction** unless the global status system is separately redesigned.

### 11.3 Robot Set — DEF / CC resistance / emergency defense

**2 pieces**

- **VIT +5**

**4 pieces**

- **CC Resist +10%**
- applies to hard-control effects such as Stun and Silence, and equivalent future control effects;
- does not reduce Poison or Armor Break.

**6 pieces**

- when the Hero's HP crosses from **50% or higher to below 50%**, immediately gain **DEF Up for 2 turns**;
- guaranteed trigger on the threshold crossing;
- DEF Up does not stack with itself or other DEF Up instances;
- this is a temporary trigger, not a permanent buff while below 50% HP;
- after recovering to 50% or higher, a later new drop below 50% may trigger the effect again.

The shared Battle Core DEF Up effect remains **30% damage reduction** while active unless the global status system is separately redesigned.

### 11.4 Set mixing intent

The 2 / 4 / 6 structure intentionally supports both full-set and mixed-set builds.

Examples:

- 6 Azure = full CC / tempo identity;
- 6 Skeleton = full Crit / Armor Break identity;
- 6 Robot = full defensive identity;
- 4 + 2 or 2 + 2 + 2 combinations may trade the 6-piece Signature for flexible stat/effect combinations.

Set bonuses do not add Empower slots and do not raise the Enhance ceiling.

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

Status: **LOCKED / USER-APPROVED — FINAL**

### 15.1 Core rules

- Maximum Enhance level: **+10**
- Normal equipment gains **+6% of item base stat per successful +1**
- Normal-equipment Enhance is linear from base stat, not compounded
- +6 = **+36%**
- +10 = **+60%**
- Every attempt consumes its Gold cost and **Iron ×1**
- Item never breaks

Approved success rates:

| Attempt | Success rate |
| --- | ---: |
| +0 → +1 | 95% |
| +1 → +2 | 90% |
| +2 → +3 | 82% |
| +3 → +4 | 72% |
| +4 → +5 | 60% |
| +5 → +6 | 50% |
| +6 → +7 | 40% |
| +7 → +8 | 30% |
| +8 → +9 | 20% |
| +9 → +10 | 15% |

Design intent:

- +0 to +6 is the normal progression-investment range.
- +7 to +10 is the endgame optimization range.
- Temporary early/midgame items are not expected to be pushed to +10.

### 15.2 Downgrade / Protection Stone

Starting with the **+6 → +7** attempt and every later attempt:

- if Enhance fails, roll **50% chance to downgrade the item by 1 Enhance level**;
- if the downgrade roll does not trigger, the item stays at its current level;
- **Protection Stone** prevents a triggered downgrade completely;
- consume **1 Protection Stone only when it actually blocks a triggered downgrade**;
- no item destruction occurs.

Protection Stone acquisition:

- **Shop only**
- current approved price: **30 Diamonds each**
- no other V2 drop/source is approved yet.

This leaves a deliberate gamble path for players who choose not to spend Protection Stones.

### 15.3 Gold / Iron cost

Base Gold cost per attempt:

~~~text
Base Gold = 25 + (Current Enhance Level × 35)
Final Gold = round(Base Gold × Tier economy multiplier)
~~~

Tier economy multiplier:

| Tier | Multiplier |
| --- | ---: |
| T1 | ×1.00 |
| T2 | ×2.25 |
| T3 | ×3.75 |
| T4 | ×5.75 |
| T5 | ×8.50 |

Iron cost is always:

**Iron ×1 per attempt**

Rarity does not change Enhance attempt cost.

### 15.4 Raid Wings special Enhance rule

Raid Wings are **Tierless**, but their Enhance Gold cost always uses the **T5 economy multiplier ×8.50**.

Wings do not use the normal +6%-per-level stat formula.

Instead:

~~~text
Wing +0 = Primary Stat +0
Wing +N = Primary Stat +N
Wing +10 = Primary Stat +10
~~~

Family Primary Stat:

| Wing family | Primary Stat |
| --- | --- |
| Azure Wings | AGI |
| Robot Wings | VIT |
| Skeleton Wings | STR |

All Wings still use Iron ×1 per attempt and the same success / downgrade / Protection rules above.

## 16. Empower

Status: **LOCKED / USER-APPROVED — FINAL GLOBAL COMBAT REVALIDATION REQUIRED**

Empower V2 is a build-customization layer. The rules below are locked for V2. After the remaining progression systems are settled, the complete player-power package must still be stress-tested against Dungeon Monster Scaling V2; that later global validation does not make the Empower rules below provisional.

### 16.1 Empower slots by Rarity

| Rarity | Empower slots |
| --- | ---: |
| Rare | 1 |
| Unique | 2 |
| Elite | 3 |
| Mythic | 4 |

Rarity increases the number of available Empower slots. It does **not** multiply the strength of each Empower roll.

Empower roll ranges are the same for T1 through T5. Tier already increases the item's base power, so Empower does not receive an additional Tier-based strength multiplier.

### 16.2 Empower option pool

Direct Empower rolls:

- ATK %
- DEF %
- HP %
- MP %
- Crit Chance
- Crit Damage
- STR
- VIT
- AGI
- DEX
- LUK

Removed as direct Empower rolls:

- Accuracy
- Dodge
- Drop Bonus

AGI / DEX / LUK may still influence Dodge / Accuracy / Drop Bonus indirectly through the character's normal derived-stat formulas.

### 16.3 Slot filtering

Empower must be item-aware. Invalid/dead rolls are not allowed.

| Empower option | Weapon | Gloves | Helmet | Chest | Boots | Accessory | Wings |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| ATK % | ✓ | ✓ | — | — | — | — | — |
| DEF % | — | — | ✓ | ✓ | ✓ | — | — |
| HP % | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| MP % | — | — | ✓ | — | — | ✓ | ✓ |
| Crit Chance | ✓ | ✓ | — | — | — | ✓ | ✓ |
| Crit Damage | ✓ | ✓ | — | — | — | ✓ | ✓ |
| STR | ✓ | ✓ | — | — | — | ✓ | — |
| VIT | — | — | ✓ | ✓ | ✓ | ✓ | — |
| AGI | — | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| DEX | ✓ | ✓ | ✓ | — | — | ✓ | — |
| LUK | — | — | ✓ | ✓ | ✓ | ✓ | — |

Wings therefore use only HP %, MP %, Crit Chance, and Crit Damage from the current pool.

### 16.4 Current working roll ranges

All displayed Empower values are whole numbers. Do not show decimal Empower rolls.

| Empower option | Current V2 roll range |
| --- | ---: |
| ATK % | 4–8% |
| DEF % | 3–6% |
| HP % | 1–3% |
| MP % | 2–4% |
| Crit Chance | 1–2% |
| Crit Damage | 2–4% |
| STR | +1 |
| VIT | +1 |
| AGI | +1 |
| DEX | +1 |
| LUK | +1 |

These ranges are identical across all equipment Tiers and are not multiplied by Rarity.

### 16.5 Power-stacking rule

Enhance and Empower percentage bonuses must stack additively from the approved base rather than compounding each other.

Example:

~~~text
Base item stat = 100%
Enhance +10 = +60%
Empower ATK total = +32%

Final item-side ATK contribution = 192% of base
NOT 160% × 132% = 211.2%
~~~

### 16.6 Roll probability and display quality

Within each slot's valid option pool, option types use equal weight.

For options with a value range, the approved working probability distribution is:

| Empower option | Roll values / probability |
| --- | --- |
| ATK % | 4 / 5 / 6 / 7 / 8% = 25 / 25 / 25 / 15 / 10% |
| DEF % | 3 / 4 / 5 / 6% = 35 / 35 / 20 / 10% |
| HP % | 1 / 2 / 3% = 50 / 35 / 15% |
| MP % | 2 / 3 / 4% = 50 / 35 / 15% |
| Crit Chance | 1 / 2% = 75 / 25% |
| Crit Damage | 2 / 3 / 4% = 50 / 35 / 15% |
| STR / VIT / AGI / DEX / LUK | +1 = 100% |

Display-quality rule:

- **Maximum roll** uses **blue** value text.
- **Minimum / low roll** uses **gray** value text.
- Intermediate rolls use the normal/default value color.
- Fixed-value Primary Stat rolls (+1 only) use the normal/default value color because they have no low/max range.

### 16.7 Duplicate / Lock / Reroll

Duplicate Empower options are allowed.

The current Lock + Reroll behavior is retained as the V2 direction:

- the player may Lock an already-filled option;
- Reroll changes only unlocked filled options;
- locked options remain unchanged;
- duplicates remain possible after reroll;
- this is intended to provide a long-term endgame optimization chase.

Exact Reroll economy is finalized separately below.

### 16.8 HP / MP percentage boundary

HP% and MP% apply to the character-side maximum resource after normal character growth and Primary Stat contribution, then all Empower percentages of that resource type are summed and applied once.

Conceptually:

~~~text
Max HP before HP% Empower
= Level/base HP + VIT-derived HP + other approved flat/base contributions

Final Max HP
= Max HP before HP% Empower × (1 + total HP% Empower)
~~~

MP% follows the same additive-percentage rule.

Multiple HP% or MP% Empower rolls add together before multiplication. They do not compound roll-by-roll.

### 16.9 Empower economy

Opening a new Empower slot costs **Mana Ore ×1** plus Gold.

Base Gold cost by slot:

| Slot | Base Gold |
| --- | ---: |
| 1 | 30 |
| 2 | 75 |
| 3 | 120 |
| 4 | 165 |

Gold cost is multiplied by the item's approved Tier economy multiplier:

| Tier | Economy multiplier |
| --- | ---: |
| T1 | ×1.00 |
| T2 | ×2.25 |
| T3 | ×3.75 |
| T4 | ×5.75 |
| T5 | ×8.50 |

Round final Gold cost to a whole number.

Reference opening costs:

| Tier | Slot 1 | Slot 2 | Slot 3 | Slot 4 | Mythic total |
| --- | ---: | ---: | ---: | ---: | ---: |
| T1 | 30 | 75 | 120 | 165 | 390 |
| T2 | 68 | 169 | 270 | 371 | 878 |
| T3 | 113 | 281 | 450 | 619 | 1,463 |
| T4 | 173 | 431 | 690 | 949 | 2,243 |
| T5 | 255 | 638 | 1,020 | 1,403 | 3,316 |

Opening all four Mythic slots therefore costs Mana Ore ×4 plus the Tier-scaled Gold total.

### 16.10 Reroll and Lock economy

Lock / Unlock itself is free.

Reroll costs:

~~~text
Base Reroll Gold
= 25 + (Filled Slot Count × 15)

Lock multiplier
= 1 + (Locked Slot Count × 0.60)

Final Reroll Gold
= Base Reroll Gold
× Lock multiplier
× Item Tier economy multiplier
~~~

Round final Gold to a whole number.

Each Reroll costs **Mana Ore ×1**, regardless of Tier or number of locked slots.

For a fully opened 4-slot Mythic item, reference costs are:

| Locked slots | T1 | T2 | T3 | T4 | T5 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 | 85 | 191 | 319 | 489 | 723 |
| 1 | 136 | 306 | 510 | 782 | 1,156 |
| 2 | 187 | 421 | 701 | 1,075 | 1,590 |
| 3 | 238 | 536 | 893 | 1,369 | 2,023 |

Rules:

- Reroll changes only filled, unlocked Empower slots.
- Locked slots remain unchanged.
- All filled slots cannot be locked if that would leave nothing eligible to reroll.
- Duplicate options remain allowed.
- Gold surcharge, not extra Mana Ore, is the primary cost of progressively narrowing RNG through Lock.
- This intentionally creates a long-term endgame chase without making basic Empower access expensive.


### 16.11 V2 validation decision

Empower V2 is locked.

A broad player-power stress test was already reviewed during V2 design. The Project Lead explicitly chose **not to require another mandatory full simulation before implementation**, because the current package remains playable enough for V2.

If live play later shows a concrete balance problem, do not silently alter this V2 contract. Open a new explicit **V3 balance pass**.

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

Normal dropped equipment returns controlled progression material:

| Rarity | Salvage return |
| --- | --- |
| Rare | Iron ×2 |
| Unique | Iron ×4 + Mana Ore ×1 |
| Elite | Iron ×8 + Mana Ore ×3 |
| Mythic | Source-aware; do not use the normal table |

### 18.1 Crafted Set salvage

Crafted Set items use their crafting source for salvage.

Approved rules:

- crafting Gold is **never refunded**;
- the consumed Recipe is **never returned**;
- the Recipe remains a one-use sink;
- Raid raw materials used by the Set recipe (Boss Horn / Boss Hide) keep the existing partial-refund direction at **50% of the original material amount, rounded down with minimum 1 for a material that was actually required**;
- do not generate a replacement Recipe on salvage.

### 18.2 Boss Weapon salvage

- do not refund Earth Stone / Fire Stone / Water Stone;
- do not refund Boss Weapon crafting Gold;
- any future source-aware Mythic salvage output must be explicitly defined rather than falling through to the normal Rare/Unique/Elite table.

Salvage remains a secondary material source, not the primary farming source.

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

Normal Shop role:

**Bad-luck protection + Gold sink**

It is not a normal Best-in-Slot source.

Target normal-stock rules:

- Rare / Unique are regular stock;
- Elite may appear as a rare/special rotation;
- Mythic is not sold through normal progression stock;
- Shop stock Tier follows player progression/current eligible Tier.

Initial pricing targets:

| Tier | Rare | Unique | Elite rotation |
| --- | ---: | ---: | ---: |
| T1 | 800 | 1,300 | 2,300 |
| T2 | 1,900 | 3,200 | 5,500 |
| T3 | 3,100 | 5,200 | 9,000 |
| T4 | 4,600 | 7,700 | 13,500 |
| T5 | 6,900 | 11,500 | 20,000 |

Protection Stone is a separate Diamond-shop progression item:

- **30 Diamonds each**
- Shop is its only approved V2 acquisition source.

### 20.1 Azure QA/Test Shop exception

The existing temporary Azure Shop stock is intentionally retained as a **QA/Test shortcut**, not as a live economy rule.

Those test items must be migrated to the V2 item model:

- rarity = mythic
- setId = azure
- 4 Empower slots
- Tier derived from the tester character's current unlockedFloor
- base stats use the V2 fixed Tier budget + Mythic rarity multiplier
- no legacy continuous-Floor crafted stat formula
- no legacy rarity = azure power tier
- Azure Set bonuses use the current V2 2pc / 4pc / 6pc rules

The QA/Test stock must not be used to justify normal Shop Mythic availability or pricing.


## 21. Crafting role

Crafting is the deterministic path to special Mythic equipment.

### 21.1 Mythic Boss Weapon

~~~text
Matching Boss Stone ×5
+ Tier-specific Gold
→ Mythic Boss Weapon
~~~

Weapon Tier is the Boss Tier. Boss Weapon Gold costs are defined in section 19.

### 21.2 Raid Set crafting

Azure / Robot / Skeleton Set Recipes are:

- family-specific;
- slot-specific;
- **Tierless Recipe items**;
- consumed once when crafting;
- allowed to be stored indefinitely.

The crafted Set Item Tier is resolved from the player's **current unlockedFloor at the moment of Craft**.

Therefore a Recipe earned earlier may intentionally be saved and crafted later at a higher unlocked Tier. This is approved V2 behavior.

All Set families use the same slot cost structure:

| Slot | Boss Horn | Boss Hide | Base Gold |
| --- | ---: | ---: | ---: |
| Helmet | 5 | 5 | 300 |
| Chest | 6 | 6 | 350 |
| Gloves | 5 | 5 | 300 |
| Boots | 5 | 5 | 300 |
| Weapon | 8 | 8 | 500 |
| Accessory | 6 | 6 | 350 |

Set-craft Gold:

~~~text
Final Craft Gold
= round(Base Gold × output Tier economy multiplier)
~~~

Full six-piece base requirement:

- Boss Horn ×35
- Boss Hide ×35
- Base Gold 2,100 before Tier multiplier
- six matching slot Recipes

Approximate full-set Gold:

| Output Tier | Full-set Gold |
| --- | ---: |
| T1 | 2,100 |
| T2 | 4,725 |
| T3 | 7,875 |
| T4 | 12,075 |
| T5 | 17,850 |

Do not add Iron or Mana Ore to Set crafting. Recipe + Raid materials + Gold are the intended gates.

### 21.3 Set output model

Crafted Set output uses the normal V2 item architecture:

~~~text
rarity = mythic
setId = azure | robot | skeleton
gearTier = current eligible Tier at craft time
empowerSlotCount = 4
~~~

Do not use legacy continuous-Floor crafted stat formulas.

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

Known legacy areas that implementation must intentionally replace include:

- oversized legacy rarity multipliers;
- legacy Empower slot counts/pool;
- old gear Tier mapping;
- continuous per-Floor equipment-stat generation;
- legacy Boss chest/pity reward behavior;
- generic/legacy Chapter Boss material handling;
- old crafted Azure continuous-Floor stat formula;
- Azure encoded as its own rarity/power key;
- Raid Wings encoded as ★1–★5 with large direct Dodge;
- old Azure/Set item data using the legacy stat model;
- temporary Azure QA/Test Shop items using legacy item generation.

### 24.1 Approved destructive legacy cleanup

The Project Lead explicitly approved a clean V2 reset for the overpowered legacy special equipment.

During V2 migration:

- **delete all owned legacy Raid Wings ★1–★5**;
- **delete all owned legacy Azure / crafted Set equipment that uses the old stat/rarity model**;
- give **no Gold, materials, Recipes, Diamonds, or other compensation** for those deleted items;
- do not attempt to stat-normalize or convert those old special items.

This destructive cleanup is intentional and overrides the normal preference for item backward compatibility.

Do **not** delete unrelated player progression/resources:

- Gold
- Diamonds
- Iron
- Mana Ore
- Protection Stones
- Raid materials
- valid Recipe items
- unrelated inventory/save data

Valid existing Set Recipes may remain because they have no combat stats; crafting after migration produces a new V2 item using the approved current-Tier craft rule.

Normal non-Set Rare / Unique / Elite equipment is not part of this special destructive reset unless a separate migration requirement is explicitly approved.

### 24.2 Data / transaction safety

- migration must be explicit, auditable, and targeted to legacy special-item identities;
- unrelated inventory rows/fields must be preserved;
- reward/persistence operations remain compatible with Battle Result commit/idempotency and overflow safety;
- server-granted Raid rewards must preserve mailbox/idempotency guarantees already used by production.


### 24.3 Server-authority prerequisite before Raid/Wings V2

Reward V2 / Enhance V2 / Empower V2 server-authoritative mutations are the foundation, but generic save/item-sync paths must also be narrowed before Raid/Wings V2.

Roadmap requirement:
- complete WAVE 4 Mythic content first;
- complete WAVE 4.5 Server Authority / Economy Security before WAVE 5;
- generic client saves must not be able to raise authoritative currency/progression values;
- generic item sync must not create/delete/re-stat authoritative items;
- reward/claim/craft economy mutations must be exact-once and server-owned;
- do not combine this trust-boundary work with the destructive legacy special-item deletion in WAVE 6.

---

## 25. Not yet locked / future V3 content

The following are intentionally deferred and do **not** block V2 implementation:

- future Mythic Accessory sources beyond the approved Raid milestone path;
- Daily Login streak Accessory redesign;
- T6 and post-T5 progression;
- monster-specific equipment pools beyond the generic fallback;
- future additional Set families / Raid bosses;
- any post-launch balance changes, which should be handled as an explicit V3 pass.

One implementation-economy detail remains intentionally separate from Enhance: **Tierless Raid Wing Empower opening/reroll Gold multiplier** is not redefined by the Enhance rule in section 15. Do not silently invent a different multiplier during implementation; resolve it explicitly if the existing Empower implementation requires a Tier value.


## 26. Raid / Wings V2

### 26.1 Raid family mapping

| Raid Boss | Wing family | Wing Primary Stat | Set family |
| --- | --- | --- | --- |
| Azure Angel | **Azure Wings** | **AGI** | Azure |
| Robo Phoenix | **Robot Wings** | **VIT** | Robot |
| Dark Dragonlord | **Skeleton Wings** | **STR** | Skeleton |

Raid Set Recipe / Set Item rewards must follow the current Raid Boss family. They are no longer hardcoded to Azure.

### 26.2 Wings item model

Raid Wings:

- are type = wings;
- have **no Tier**;
- do not count toward Azure / Robot / Skeleton Set-piece count;
- do not use the old Raid ★1–★5 model;
- do not grant the old fixed Dodge bonuses;
- use normal rarity names: Rare / Unique / Elite / Mythic;
- use Empower slots from rarity: **1 / 2 / 3 / 4**;
- rarity changes Empower-slot count, but does **not** multiply the Wing's fixed family Primary Stat;
- Wing +0 grants **0** family Primary Stat;
- Wing +N grants **+N** family Primary Stat, up to +10.

Wings use the approved Wings Empower pool:

- HP %
- MP %
- Crit Chance
- Crit Damage

They do not directly roll STR / VIT / AGI / DEX / LUK in Empower; family Primary Stat comes from Enhance.

### 26.3 Raid ranking rewards

Keep the existing non-Wing Rank rewards while replacing Wing stars with rarity:

| Raid Rank | Wing reward | Additional reward |
| --- | --- | --- |
| Rank 1 | **Mythic Wing** of that Raid family | Boss Horn ×3 + Boss Hide ×3 + random Set Recipe ×1 of that family |
| Rank 2 | **Elite Wing** of that Raid family | Boss Horn ×2 + Boss Hide ×2 + random Set Recipe ×1 of that family |
| Rank 3 | **Unique Wing** of that Raid family | Boss Horn ×1 + Boss Hide ×1 + random Set Recipe ×1 of that family |
| Rank 4+ | none | keep existing two random Boss-material rolls |

Rank rewards may stack with milestone and Last-Hit rewards when the player independently qualifies for them.

### 26.4 Last Hit

Last Hit no longer awards a random ★ Wing.

New Last-Hit reward:

- **random Set Recipe ×1**
- Recipe family must match the defeated Raid Boss.

### 26.5 Contribution milestones

Base milestone rewards remain cumulative:

- every **5% Contribution** → Diamond ×5
- every **10% Contribution** → Boss Material ×1

Special milestones:

| Contribution | Special reward |
| --- | --- |
| **25%** | **Rare Wing** of that Raid family |
| **50%** | random Accessory: **Unique 80% / Elite 20%** |
| **75%** | random Set Recipe ×1 of that Raid family |
| **99%** | random Set Item ×1 of that Raid family |

50% Accessory Tier follows the player's eligible Tier from unlockedFloor when the reward is generated.

For the **99% Set Item**, resolve and snapshot the output Tier **immediately when the character reaches 99% Contribution**. Waiting to claim later must not upgrade the reward into a newer Tier.

The 75% Recipe is Tierless and may intentionally be stored for later crafting.

### 26.6 Raid Recipe / Set Tier behavior

- Recipes themselves have no Tier.
- A stored Recipe may be crafted after the player advances.
- Crafting resolves Set Item Tier from current unlockedFloor at craft time.
- Direct 99% Set Item is different: its Tier is fixed at the 99%-threshold moment.


## 27. Core reward loop

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
→ Earth / Fire / Water Stone
→ One-time Accessory Chest

CHAPTER BOSS — RERUN
→ EXP + Gold
→ Earth / Fire / Water Stone

MATCHING BOSS STONE ×5 + GOLD
→ Spirit Greatsword / Lavalon Sword / Icicle Longsword

RAID
→ Rank / Contribution / Last Hit
→ Family Wings / Recipes / Set Items / Accessory / Raid Materials

TIERLESS RAID SET RECIPE + HORN/HIDE + GOLD
→ Mythic Set Item at current eligible Tier

UNWANTED NORMAL GEAR
→ Salvage
→ Iron / Mana Ore

ENHANCE
→ Gold + Iron ×1 / attempt
→ Protection Stone optional for risky +7 to +10 progression
~~~

This loop is the locked V2 baseline. Future balance changes should be handled as an explicit V3 design pass rather than silently changing these values.
