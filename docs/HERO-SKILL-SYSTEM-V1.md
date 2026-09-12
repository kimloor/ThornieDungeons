# Hero Skill System V1

Status: approved gameplay design source of truth for Hero skills.

This document owns the detailed Hero Skill System V1 rules. `docs/CHARACTER-PROGRESSION.md` remains the Character-page/UI overview. If an older skill note conflicts with this file, use this file unless a later user-approved task explicitly changes the rule.

## 1. Core structure

Three branches:

- **Assault** — damage, Crit, Fury, burst and low-HP offense.
- **Guard** — DEF, survival, Counter and Aegis.
- **Tactic** — debuffs, cooldown efficiency, SP sustain and buff stealing.

Progression:

- Active skills: Rank 1–3, **1 Skill Point per Rank**.
- Passive skills: Lv1–5, **1 Skill Point per Lv**; learned passives work automatically and use no equip slot.
- Keystone: Rank 1–5, **2 Skill Points per Rank**.
- Multiple learned Keystones may work simultaneously.
- Hero max level: **99**. Normal level progression targets about **98 Skill Points** total.
- Active skill equip limit in battle remains **4 slots** using the existing Inventory/Combat slot system.
- Do not duplicate Active-slot management on the Character Skills page.

Tier gates:

| Tier | Requirement |
|---|---|
| T1 | Lv1 / 0 SP invested in branch |
| T2 | Lv15 + 8 SP invested in branch |
| T3 | Lv30 + 20 SP invested in branch |
| T4 | Lv50 + 35 SP invested in branch |
| Keystone | 40 SP invested in branch + at least 1 Rank in a T4 skill |

After Keystone R1 is unlocked, R2–R5 have no additional level gate; only their Skill Point costs apply.

Use branch investment plus selective prerequisites. Do not turn every skill into a hard prerequisite chain.

Approximate full-branch cost: **57 SP** (`4 Active ×3 = 12`, `7 Passive ×5 = 35`, `Keystone = 10`). Two fully maxed branches would cost 114 SP, intentionally above normal Lv99 progression.

Avoid large repeatable bonus-Skill-Point sources. Any future bonus SP should be rare and capped.

## 2. Global status rules

### Poison

- Damage over time each turn.
- Reapply **does not stack damage**.
- Reapply refreshes duration.
- Duration is not added together.
- If multiple sources apply Poison, use the strongest current Poison damage and refresh duration. Hero and Pet Poison share the same Poison slot.

### Stun

- Target loses one Action/Turn.
- Duration: **1 Turn**.
- No stacking and no duration extension.
- `Master Tactician` cannot extend Stun.

### Armor Break

- **DEF -15%**.
- Normal duration: **2 Turns** unless a skill explicitly says otherwise.
- Strength does not stack; reapply refreshes duration.

### Silence

- Target cannot use Active Skills.
- Basic Attack remains available.
- Strength does not stack; reapply refreshes duration.

### DEF Up

- **Damage Taken -30%**.
- Strength does not stack.
- Reapply refreshes/keeps the longer duration.

`Freeze` and `Bleed` are not part of Hero Skill System V1.

## 3. Boss / Raid conversion rules

Boss and Raid Boss are immune to hard control from Stun/Silence, but a successful proc converts instead of becoming a wasted proc:

- Successful **Stun** proc -> the triggering hit becomes a **Critical Hit**.
- Successful **Silence** proc -> the triggering hit gains **30% DEF Pierce** for that hit (V1 target value).
- Combat Log must show the conversion.

Poison and Armor Break can affect Boss/Raid Boss unless a later boss-specific rule explicitly overrides them.

These are shared combat rules. Do not duplicate separate Boss conversion logic inside every individual skill.

## 4. Buff ownership and steal rules

Stealable examples:

- ATK Up
- DEF Up
- Crit Up
- Regen
- ordinary barriers that are explicitly marked stealable

Unstealable:

- boss phases/mechanics
- invulnerability
- immunity
- scripted aura
- special Keystone resources

`Fury`, `Aegis`, and `Scheme` are special resources, not normal buffs, and cannot be stolen.

## 5. Global anti-loop rules

- Combined cooldown reduction from passives/Keystones: max **1 Turn per Action**.
- An Action that causes cooldown reduction cannot reduce the cooldown of the same skill that created that cooldown in that same Action.
- Passive/Keystone triggers occur at most **once per Action** unless explicitly marked `per Hit`.
- One enemy multi-hit Action can grant at most **1 Aegis**.
- Control/status proc chance should respect the global proc cap when applicable; V1 target cap is **90–95%**.
- Life Drain must use a healing cap per Action; exact cap is still **TBD** and must be confirmed before final balance lock.
- Last Stand requires an internal cooldown; V1 target is about **2–3 Turns**, exact value **TBD**.
- PvP control-chain behavior must be reviewed separately before Arena/PvP release.

## 6. Assault branch

### T1

#### Power Strike — Active, Rank 1–3

- R1: **145% ATK**
- R2: **165% ATK**
- R3: **185% ATK** and **+15% Crit Damage** for this attack
- Draft battle cost: **10 SP**
- Draft cooldown: **0**

#### Weapon Mastery — Passive, Lv1–5

Hero attack damage:

`+2 / +4 / +6 / +8 / +10%`

#### Killer Instinct — Passive, Lv1–5

Against an enemy below 50% HP, Hero Crit Chance:

`+2 / +4 / +6 / +8 / +10%`

### T2

#### Heavy Blow — Active, Rank 1–3

- R1: **170% ATK**, Armor Break 35%
- R2: **190% ATK**, Armor Break 45%
- R3: **210% ATK**, Armor Break 55%
- Draft battle cost: **16 SP**
- Draft cooldown: **2 Turns**

#### Bloodlust — Passive, Lv1–5

While Hero HP <=40%, Damage:

`+4 / +6 / +8 / +10 / +12%`

At Lv5, also gain **Crit Chance +5%** while the condition is active.

#### Armor Break Mastery — Passive, Lv1–5

Adds percentage points to Armor Break proc chance:

`+5 / +10 / +15 / +20 / +25 pp`

### T3

#### Blade Storm — Active, Rank 1–3

Always performs **3 hits**, distributed across living monsters.

- R1: `60% ATK ×3`
- R2: `70% ATK ×3`
- R3: `75% ATK ×3` + **5% Stun per hit**
- Draft battle cost: **24 SP**
- Draft cooldown: **3 Turns**

The R3 Stun check is explicitly `per Hit`. Tactic Debuff Chance bonuses do **not** increase this 5% Stun chance.

#### Life Drain — Passive, Lv1–5

Basic Attack heals the Hero for:

`1 / 2 / 3 / 4 / 5%` of damage dealt.

A per-Action healing cap is required; exact cap is **TBD**.

#### Finishing Blow — Passive, Lv1–5

Against an enemy at or below 40% HP, Damage:

`+4 / +7 / +10 / +13 / +16%`

### T4

#### Rampage — Active, Rank 1–3

Duration: **3 Turns**.

- R1: Damage +15%, Damage Taken +15%
- R2: Damage +18%, Crit +5%, Damage Taken +10%
- R3: Damage +20%, Crit +5%, no Damage Taken penalty
- Draft battle cost: **25 SP**
- Draft cooldown: **6 Turns**

#### Critical Mastery — Passive, Lv1–5

Crit Damage:

`+5 / +10 / +15 / +20 / +25%`

### Keystone — Relentless Fury, Rank 1–5

- **R1:** each Hero attack Action grants `Fury +1`, max 3. Each Fury grants **+3% Damage**.
- **R2:** while Hero HP <=40%, gain another **+5% Damage**.
- **R3:** at Fury 3, gain **5% Stun chance**. This Stun chance is not increased by Tactic Debuff Chance.
- **R4:** while Hero HP <=40%, gain another **+5% Damage**.
- **R5:** on kill, reduce cooldown of eligible cooling Active skills by 1 Turn and consume **1 Fury**; respect the global max-1-CDR-per-Action rule.

Fury decay is not fully locked. Current preferred direction: after a Hero Action that does not attack, `Fury -1`; clear Fury at battle end. Confirm before final implementation if code needs this exact behavior.

## 7. Guard branch

### T1

#### Guard — Active, Rank 1–3

Attack plus DEF Up.

- R1: DEF Up 1 Turn
- R2: DEF Up 2 Turns
- R3: DEF Up 2 Turns with the strongest approved Rank effect
- Draft battle cost: **10 SP**
- Draft cooldown: **2 Turns**

Use the shared DEF Up rule (`Damage Taken -30%`) rather than creating a second DEF Up type.

#### Toughness — Passive, Lv1–5

Max HP:

`+3 / +6 / +9 / +12 / +15%`

#### Iron Body — Passive, Lv1–5

DEF:

`+2 / +4 / +6 / +8 / +10%`

### T2

#### Shield Wall — Active, Rank 1–3

DEF Up for **3 Turns** with temporary Hero Damage Dealt penalty:

- R1: Damage Dealt -20%
- R2: Damage Dealt -10%
- R3: no damage penalty
- Draft battle cost: **18 SP**
- Draft cooldown: **4 Turns**

#### Recovery — Passive, Lv1–5

HP/SP received:

`+4 / +8 / +12 / +16 / +20%`

#### Last Stand — Passive, Lv1–5

While Hero HP <=40%, when hit, chance to gain DEF Up:

`20 / 40 / 60 / 80 / 100%`

Requires an internal cooldown. Target is about 2–3 Turns; exact value is **TBD**.

### T3

#### Counter — Active, Rank 1–3

Enter Counter stance for **1 Turn** and counter once when triggered:

- R1: 100% ATK
- R2: 130% ATK
- R3: 160% ATK + **35% Armor Break**

#### Battle Hardened — Passive, Lv1–5

Status Resist:

`+5 / +10 / +15 / +20 / +25%`

#### Second Wind — Passive, Lv1–5

First time per battle that Hero HP reaches <=40%, heal Max HP:

`5 / 7 / 9 / 11 / 15%`

### T4

#### Fortress — Active, Rank 1–3

Duration: **2 Turns**.

- R1: DEF +20%, Hero Damage Dealt -20%
- R2: DEF +25%, Hero Damage Dealt -10%
- R3: DEF +30%, no damage penalty
- Draft battle cost: **28 SP**
- Draft cooldown: **7 Turns**

Fortress does **not** directly add a second Damage Taken reduction effect.

#### Survival Instinct — Passive, Lv1–5

If one incoming hit exceeds **25% Max HP**, reduce the excess portion by:

`10 / 15 / 20 / 25 / 30%`

Reflect damage:

`5 / 7 / 9 / 12 / 15%`

Reflect restrictions/cap must be validated during balance implementation to avoid loops or boss abuse.

### Keystone — Thorned Aegis, Rank 1–5

- **R1:** while DEF Up and struck, gain `Aegis +1` per enemy Action, max 3. Each Aegis gives **Crit Resist +5%**. Aegis decays by 1 on the relevant turn without being hit.
- **R2:** first lethal damage each battle leaves Hero at **1 HP** and grants **3 Aegis**.
- **R3:** when the 1-HP survival triggers while at Aegis 3, automatically Counter, then clear Aegis.
- **R4:** when Aegis transitions from `<3` to `3`, automatically Counter.
- **R5:** after a Counter, if its Stun succeeds, consume `Aegis -1`; if Stun fails, do not reduce Aegis.

Critical R4 anti-loop rule:

- Trigger only on the **transition `<3 -> 3`**.
- Max once per enemy Action.
- Do not retrigger while Aegis remains at 3.

This rule is mandatory because Boss Stun immunity/conversion can otherwise create an infinite Counter loop.

## 8. Tactic branch

### T1

#### Toxic Strike — Active, Rank 1–3

- R1: 120% ATK + Poison 30%
- R2: 140% ATK + Poison 40%
- R3: 160% ATK + Poison 50%

#### Exploit Weakness — Passive, Lv1–5

Against a debuffed target, Damage:

`+2 / +4 / +6 / +8 / +10%`

#### Debilitating Edge — Passive, Lv1–5

Adds percentage points to eligible debuff proc chance:

`+3 / +6 / +9 / +12 / +15 pp`

Respect the global proc cap.

### T2

#### Stunning Blow — Active, Rank 1–3

Stun chance:

`15 / 25 / 35%`

Damage value should use the final approved combat implementation value; do not invent a new value from old legacy skills.

#### Spirit Drain — Passive, Lv1–5

Basic Attack restores flat SP:

`+1 / +2 / +3 / +4 / +5`

#### Toxic Mastery — Passive, Lv1–5

Poison damage:

`+5 / +10 / +15 / +20 / +25%`

At Lv5, Poison duration also gains **+1 Turn**.

### T3

#### Silent Edge — Active, Rank 1–3

Silence chance:

`25 / 35 / 45%`

Damage value should use the final approved combat implementation value; do not copy legacy Freeze-era numbers.

#### Quick Recovery — Passive, Lv1–5

When attacking a debuffed target, chance to reduce cooldown of one random eligible cooling Active skill by 1 Turn:

`5 / 8 / 11 / 14 / 18%`

- Max once per Action.
- Cannot reduce the cooldown of the skill that caused the trigger in the same Action.
- Respect the global combined CDR cap.

#### Skill Efficiency — Passive, Lv1–5

Active Skill SP cost:

`-2 / -4 / -6 / -8 / -10%`

### T4

#### Disruption — Active, Rank 1–3

Debuff pool:

- Poison
- Armor Break
- Silence
- Stun

Ranks:

- R1: select **2** debuffs, base proc **30%**
- R2: select **3** debuffs, base proc **35%**
- R3: use **all 4** debuffs, base proc **40%**

Use a lower Stun selection weight at R1/R2.

Prerequisites: `Toxic Strike R1 + Stunning Blow R1 + Silent Edge R1`.

#### Master Tactician — Passive, Lv1–5

When acting against a debuffed target, proc chance:

`5 / 8 / 11 / 15 / 20%`

On proc, extend one random existing debuff by **+1 Turn**, excluding Stun.

Prerequisite: `Skill Efficiency Lv1`.

### Keystone — Usurper, Rank 1–5

- **R1:** each successful debuff grants `Scheme +1` per Action, max 3. Each Scheme grants **+3% Debuff Chance**.
- **R2:** each Scheme grants **+2% Quick Recovery proc chance**.
- **R3:** at Scheme 3, using an Active against a target with a stealable buff steals 1 buff and consumes 1 Scheme. If no stealable buff exists, consume 1 Scheme and extend one random enemy debuff by +1 Turn, excluding Stun.
- **R4:** **not fully locked yet**. Current safe candidate: after Scheme is consumed, the next Active gains **+10% Debuff Chance**, non-stacking and still subject to the global proc cap.
- **R5:** after a cumulative **3 Scheme consumed**, reduce all eligible cooling Active skills by 1 Turn, then reset the consumed-Scheme counter. Respect the global combined CDR cap.

Do not finalize R4 behavior in production without user confirmation if implementation reaches this point before a newer approved rule exists.

## 9. Character Skills UI contract

- Character page keeps `Status` and `Skills` tabs only.
- Skill page stays mobile-first and uses the established dark-navy ThornieDungeons visual language.
- Top branch tabs: **Assault / Guard / Tactic**.
- One vertical list grouped `T1 / T2 / T3 / T4 / Keystone`; do not use a sprawling tree UI.
- Row shows icon, name, compact type/effect, current Rank/Lv and state (`Locked`, `Upgradable`, `Max`).
- `SP` shown on an Active row means **battle SP cost**, not Skill Points used to upgrade.
- Tap a row -> open a Floor-Detail-style popup/bottom sheet with full rank progression, battle SP cost, cooldown, effects, prerequisites and Upgrade action.
- Active equip management remains in the existing Inventory/Combat 4-slot system.

## 10. Save / migration expectations

- Existing saves must remain loadable.
- New skill ownership/rank data must be migrated or defaulted without deleting unrelated fields.
- Legacy skills are replaced by this system; do not silently keep legacy Freeze-based behavior active alongside V1.
- Any schema change must preserve backward compatibility and be covered by targeted save/reload tests.

## 11. Required combat checks

At minimum verify:

- Active rank values and SP costs
- branch/tier gates and selective prerequisites
- Passive auto-activation
- all shared status rules
- Boss/Raid Stun and Silence conversion
- cooldown timing and all CDR caps
- Fury/Aegis/Scheme gain, spend, reset and no-loop behavior
- Counter and lethal-survival interactions
- multi-hit trigger limits
- 4 Active-slot compatibility
- save/reload and existing-player migration

## 12. Known balance items still intentionally open

These are not permission to invent new behavior. They require a later approved value/rule:

- exact Life Drain heal cap per Action
- exact Last Stand internal cooldown
- final Fury decay rule
- final Usurper R4 behavior
- any Active damage/battle-SP values not explicitly listed above
- PvP-specific control-chain rules
