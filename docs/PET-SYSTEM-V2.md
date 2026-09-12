# Pet System V2

Status: approved gameplay design source of truth for Pet V2.

This file owns the detailed Pet V2 rules. If older Pet code/comments or older chat notes conflict with this document, use this document unless a later user-approved task explicitly changes the rule.

## 1. Design goals

Pet V2 separates progression into clear layers:

- **Rarity** = baseline potential and skill complexity.
- **Role** = one of four simple combat identities.
- **Level** = stat growth from actual battle participation.
- **Star** = duplicate-investment stat multiplier.
- **Skill** = gameplay identity; skills do not have their own level-up system in V2.

Keep the system simple enough to read on mobile and easy to rebalance after playtesting.

## 2. Roles

Only these four roles are used:

- **Support**
- **Attack**
- **Tank**
- **Control**

Do not expose hybrid role labels in UI. A Pet may have secondary utility, but its stored/displayed primary role is exactly one value.

Current assignments:

| Pet | Rarity | Role |
|---|---:|---|
| Sprout | R | Support |
| Flamekit | R | Attack |
| Sparkpup | R | Control |
| Ember Fox | SR | Attack |
| Moon Hare | SR | Support |
| Hell Wolf | SR | Control |
| Inferno Drake | SSR | Tank |
| Storm Phoenix | SSR | Control |

`Hell Wolf` replaces the old `Thunder Cub` design identity in V2.

## 3. Level progression

- Max Pet Level: **50**.
- Only the **equipped/active Pet that participated in the battle** gains Pet EXP.
- Pet EXP gained = **80% of the Hero battle EXP** from that battle.
- Use the Hero's total battle EXP, then multiply by 80%; do not calculate separately per monster.
- A Pet still receives EXP if it dies during that battle.
- Lv50 Pets stop gaining EXP.
- Pet Level increases stats only.
- Level does not unlock skills, add skills, or directly raise a skill Rank.
- Skills should scale from Pet combat stats so Level/Star still matter naturally.

### EXP formula

For current Pet level `L` from 1–49:

`XP_next = round(34 + 6L + 0.32L²)`

Total EXP from Lv1 to Lv50: **21,952 EXP**.

### EXP table

| Level | EXP to next |
|---|---:|
| 1 → 2 | 40 |
| 2 → 3 | 47 |
| 3 → 4 | 55 |
| 4 → 5 | 63 |
| 5 → 6 | 72 |
| 6 → 7 | 82 |
| 7 → 8 | 92 |
| 8 → 9 | 102 |
| 9 → 10 | 114 |
| 10 → 11 | 126 |
| 11 → 12 | 139 |
| 12 → 13 | 152 |
| 13 → 14 | 166 |
| 14 → 15 | 181 |
| 15 → 16 | 196 |
| 16 → 17 | 212 |
| 17 → 18 | 228 |
| 18 → 19 | 246 |
| 19 → 20 | 264 |
| 20 → 21 | 282 |
| 21 → 22 | 301 |
| 22 → 23 | 321 |
| 23 → 24 | 341 |
| 24 → 25 | 362 |
| 25 → 26 | 384 |
| 26 → 27 | 406 |
| 27 → 28 | 429 |
| 28 → 29 | 453 |
| 29 → 30 | 477 |
| 30 → 31 | 502 |
| 31 → 32 | 528 |
| 32 → 33 | 554 |
| 33 → 34 | 580 |
| 34 → 35 | 608 |
| 35 → 36 | 636 |
| 36 → 37 | 665 |
| 37 → 38 | 694 |
| 38 → 39 | 724 |
| 39 → 40 | 755 |
| 40 → 41 | 786 |
| 41 → 42 | 818 |
| 42 → 43 | 850 |
| 43 → 44 | 884 |
| 44 → 45 | 918 |
| 45 → 46 | 952 |
| 46 → 47 | 987 |
| 47 → 48 | 1023 |
| 48 → 49 | 1059 |
| 49 → 50 | 1096 |

This curve is intentionally fast enough for catch-up when switching to a newly acquired Pet. Rebalance only after live playtesting if leveling is clearly too fast/slow.

## 4. Star progression

Max Star: **3★**.

Duplicate costs:

- `1★ -> 2★` uses **1 duplicate copy** of the same Pet.
- `2★ -> 3★` uses **2 duplicate copies** of the same Pet.
- Total from 1★ to 3★: **3 duplicate copies**.

Star multiplier:

| Star | Stat multiplier |
|---|---:|
| 1★ | 1.00x |
| 2★ | 1.15x |
| 3★ | 1.35x |

Star mechanically multiplies stats only. It does not unlock new skills or skill effects.

### Star visuals

- 1★: base appearance.
- 2★: add an **aura overlay** only; do not redraw the base sprite.
- 3★: add a stronger/more distinct **aura overlay** for now.
- Any larger visual evolution for 3★ is deferred for future art design.

Prefer aura as a separate reusable overlay so Idle/Attack/Death frames do not need duplicate full sprite sets.

## 5. Base stats and growth profiles

Stat order: `STR / VIT / AGI / DEX / LUK`.

Effective raw stat before combat conversion:

`Effective Stat = (Base Stat + Growth × (Level - 1)) × Star Multiplier`

Recommended current growth profiles:

| Pet | Base STR/VIT/AGI/DEX/LUK | Growth per Lv STR/VIT/AGI/DEX/LUK |
|---|---|---|
| Sprout | 3 / 5 / 4 / 4 / 4 | .10 / .40 / .20 / .30 / .20 |
| Flamekit | 5 / 3 / 4 / 4 / 4 | .45 / .10 / .20 / .25 / .20 |
| Sparkpup | 4 / 3 / 5 / 5 / 3 | .25 / .10 / .40 / .30 / .15 |
| Ember Fox | 8 / 5 / 6 / 6 / 5 | .45 / .15 / .20 / .30 / .25 |
| Moon Hare | 4 / 8 / 6 / 7 / 5 | .10 / .40 / .20 / .35 / .25 |
| Hell Wolf | 7 / 5 / 7 / 6 / 5 | .35 / .15 / .35 / .30 / .20 |
| Inferno Drake | 11 / 11 / 7 / 8 / 8 | .40 / .45 / .15 / .25 / .25 |
| Storm Phoenix | 9 / 7 / 11 / 10 / 8 | .30 / .15 / .45 / .35 / .25 |

Approximate total stat growth per level by rarity:

- R: about **1.20** total stat/Lv
- SR: about **1.35** total stat/Lv
- SSR: about **1.50** total stat/Lv

SSR is allowed to have a higher ceiling, but R Pets at Lv50/3★ should remain usable rather than becoming dead collection items.

## 6. Combat stat conversion

Use these V2 draft formulas for playtest:

`ATK = 5 + (Level × 0.7) + STR × 2`

`Max HP = 30 + (Level × 4) + VIT × 7`

`DEF = 2 + (Level × 0.25) + VIT × 0.5`

`Speed = Base Speed + AGI × 1.5`

`Accuracy = 85% + DEX × 0.4%`

- Accuracy cap: **99%**

`Dodge = AGI × 0.35%`

- Dodge cap: **20%**

`Crit = LUK × 0.4%`

- Crit cap from Pet stats: **25%**

Star multiplies raw stats before these combat formulas; do not apply another final Star multiplier to final damage/HP/DEF afterward.

These values are balance-draft values. Keep formulas centralized so playtest tuning does not require rewriting skill logic.

## 7. Pet HP lifecycle across dungeon floors

Pet HP does not simply refill every normal floor.

Approved V2 direction:

- Before entering a **Boss Floor**, refill the active Pet to full HP.
- Between normal floors, the active Pet carries its remaining HP forward.
- After the Boss Floor, continue carrying the resulting HP through normal floors until the next Boss Floor refill point.
- If the Pet dies in a battle, it remains dead for the rest of that battle.
- On the **next floor after that death**, the Pet revives at full HP.
- No Pet potion/healing-item system is required for V2.

This rule intentionally gives Pet attrition meaning without forcing the Hero potion economy onto Pets.

Playtest watch item: verify players cannot exploit deliberate Pet death/revive in a way that is stronger than intended. If that becomes a real issue, adjust the revive rule later rather than adding Pet potions immediately.

## 8. Cooldown semantics

Pet Active Skill cooldown uses the **same cooldown timing semantics as Hero Active Skills**.

Do not maintain a separate Pet-only interpretation of `CD 2`, `CD 3`, etc. Shared cooldown behavior prevents confusing UI and turn-count differences between Hero and Pet.

## 9. Rarity skill structure

Keep the current simple rarity complexity model for V2:

- **R** = Active Skill only.
- **SR** = Active + 1 Passive.
- **SSR** = Active + 1 Passive + 1 Extra effect.

Skills do not have their own Rank/Lv progression in V2.

## 10. Pet Skill V2

### Sprout — R / Support

#### Regrowth — Active

- Heal the Hero each turn for `12% Pet Max HP + 0.8 × VIT`.
- Duration: **2 Turns**.
- Cooldown: **3 Turns**.

Purpose: simple sustain starter Pet. Healing scales from Pet stats rather than Hero Max HP so Pet Level/Star matter.

### Flamekit — R / Attack

#### Flame Claw — Active

- Single target damage: **135% Pet ATK**.
- Cooldown: **2 Turns**.

Purpose: straightforward low-complexity Attack Pet.

### Sparkpup — R / Control

#### Static Bite — Active

- Single target damage: **100% Pet ATK**.
- Stun chance: **15%**.
- Cooldown: **2 Turns**.

Use the global Boss/Raid Stun conversion rule rather than letting the Pet hard-Stun Boss/Raid targets.

### Ember Fox — SR / Attack

#### Blazing Fang — Active

- Single target damage: **155% Pet ATK**.
- Cooldown: **2 Turns**.

#### Predator Instinct — Passive

- Pet Crit Chance: **+10%**.
- Hero Crit Chance: **+5%**.

Hero bonus is intentionally smaller than the Pet bonus to avoid excessive stacking with Hero Assault/Crit builds.

### Moon Hare — SR / Support

#### Moonlight Heal — Active

- Heal both **Hero and living Pet**.
- Heal each target for `10% Pet Max HP + 1.0 × VIT`.
- Cooldown: **2 Turns**.

#### Moon Ward — Passive

- Hero Status Resist: **+15%**.
- Pet Status Resist: **+15%**.

Purpose: group sustain/support without direct Hero Max-HP-percent scaling.

### Hell Wolf — SR / Control

#### Hell Fang — Active

- Single target damage: **110% Pet ATK**.
- Armor Break chance: **40%**.
- Poison chance: **25%**.
- Cooldown: **2 Turns**.

Use shared global Armor Break and Poison rules.

Recommended V2 Pet Poison damage baseline from Hell Wolf:

- `20% Pet ATK` per turn
- Duration: **3 Turns**

This value is a playtest baseline and should remain centralized for easy tuning.

#### Hunter's Eye — Passive

- Hero Accuracy: **+8%**.
- Pet Accuracy: **+8%**.

### Inferno Drake — SSR / Tank

#### Draconic Sweep — Active

- Hit up to **3 living enemies**.
- Damage: **75% Pet ATK per target**.
- **35% chance** to grant Hero DEF Up.
- DEF Up duration: **2 Turns**.
- Cooldown: **2 Turns**.

DEF Up uses the shared game rule: **Damage Taken -30%**, no strength stacking; reapply refreshes duration.

#### Dragon Hide — Passive

- Pet DEF: **+15%**.
- Hero DEF: **+8%**.

#### Guardian Scale — Extra

- **20% chance** to block an incoming direct-damage attack that targets the Hero.
- If blocked, Hero takes **0 direct damage** from that attack.
- Debuff/status effects attached to that attack still roll normally.
- Does not block attacks aimed at Inferno Drake itself.

This is damage blocking, not full attack immunity.

### Storm Phoenix — SSR / Control

#### Tempest Strike — Active

- Hit up to **3 living enemies**.
- Damage: **70% Pet ATK per target**.
- Silence chance: **30%** per eligible target.
- Cooldown: **3 Turns**.

Use the shared Boss/Raid Silence conversion rule instead of hard-Silencing Boss/Raid targets.

#### Storm Step — Passive

- Hero Dodge: **+8%**.
- Pet Dodge: **+8%**.

Respect final global Dodge caps/rules where applicable.

#### Thunder Judgment — Extra

When Hero or Pet successfully applies a debuff:

- **50% chance** to reduce the active Pet skill cooldown by **1 Turn**.
- Trigger at most **once per Action**.
- Cannot reduce a cooldown created by that same Action.
- If Pet Active cooldown is already 0, there is no effect.
- Respect the shared global max-1-CDR-per-Action rule.

This anti-loop protection is mandatory, especially with Hero Tactic builds.

## 11. Shared Poison rule: Hero + Pet

Hero and Pet Poison use **one Poison slot per target**.

When a new Poison is successfully applied:

1. Compare current Poison damage-per-turn with the new Poison damage-per-turn.
2. Keep the **stronger damage value**.
3. Refresh duration using the new application; do not add durations together.
4. Do not run Hero Poison and Pet Poison as two simultaneous damage stacks.

Examples:

- Hero Poison = 120/turn, 2 turns left; Pet applies 80/turn for 3 turns -> keep 120/turn, refresh to 3 turns.
- Hero Poison = 80/turn; Pet applies 110/turn -> replace with 110/turn and refresh duration.

Track source ownership (`hero` / `pet`) for combat log/debugging if useful, but gameplay still treats it as one Poison status.

## 12. Boss / Raid status interaction

Pet status skills use the same shared Boss/Raid rules as Hero skills:

- Successful Stun proc against Boss/Raid -> triggering hit becomes **Critical**.
- Successful Silence proc against Boss/Raid -> triggering hit gains **30% DEF Pierce** for that hit.
- Poison and Armor Break can affect Boss/Raid unless a later boss-specific rule overrides them.
- Combat Log should show conversions.

Do not build separate Pet-specific Boss status logic if the shared combat rule can be reused.

## 13. Pet target/action behavior

V2 preserves the current core concept that the active Pet is a real combat unit:

- Only one active/equipped Pet participates.
- Pet has its own HP/ATK/DEF/Speed/Accuracy/Dodge/Crit.
- Pet takes turns according to the shared combat turn system.
- Pet can be targeted, damaged, evade and die.
- Pet Active Skills are automatic when the Pet action logic allows them and cooldown is ready.

Any redesign of Pet target priority beyond the skills explicitly described here should be proposed before changing behavior.

## 14. Pet page UI direction

The final graphics pass is deferred, but the approved interaction direction is:

- Portrait/mobile-first web layout.
- Follow existing ThornieDungeons dark navy/gold fantasy visual language.
- Top area shows normal game currencies, not a separate Hero profile panel.
- Large selected Pet sprite showcase.
- Pet list is **vertical**, compact, and positioned to the **left** of the large Pet showcase.
- Each Pet list row/card shows at minimum: portrait, rarity, level/star state, and **duplicate count**.
- Do not use left/right carousel arrows for Pet switching.
- Tabs: **Info / Skills / Growth**.
- The detail panel only shows the content of the selected tab; do not combine all sections into one long panel.
- **Info** includes current Pet Level and EXP bar in addition to combat stats/role.
- Remove story/lore text from the Pet management screen.
- Keep bottom navigation consistent with Main/Town/Character screens.
- 2★/3★ aura should be artwork/overlay, not text/CSS pretending to be final production art.

Current concept art is only layout direction; Graphics may refine final visuals later.

## 15. Save / migration requirements

Current saves already contain Pet instances, duplicates and active Pet identity. V2 migration must preserve existing players.

Expected stored concepts after migration:

- `instId`
- `defId`
- `level`
- `xp`
- `star`
- active Pet identity
- duplicate count by Pet definition

Migration expectations:

- Existing Pets remain owned.
- Existing active Pet remains active where possible.
- Existing star values above V2 max must be migrated safely to the 3★ ceiling without deleting unrelated save data; exact compensation policy, if any, requires explicit approval before implementation.
- Replace old Thunder Cub identity with Hell Wolf only through an explicit compatible migration/mapping; do not orphan existing instances.
- Preserve unrelated fields in `pets_json` or any richer save envelope.

Any irreversible or economy-affecting conversion requires user confirmation before production migration.

## 16. Gacha/economy status

Pet Gacha economy is **not finalized by this V2 spec**.

Current legacy values such as `100 diamonds/pull`, old rarity rates, and test `+500 diamonds` controls should not automatically be treated as final live economy rules.

After Pet V2 gameplay is stable, review:

- R/SR/SSR rates
- pull cost
- duplicate economy pacing
- pity/guarantee policy
- removal of test-only currency controls

Do not make major economy-wide changes without explicit approval.

## 17. Required implementation/playtest checks

At minimum verify:

- Pet EXP = 80% of Hero battle EXP
- dead Pet still receives battle EXP
- Lv50 EXP cap
- EXP formula/table behavior
- 3★ cap and duplicate costs 1 / 2
- stat multiplier order
- combat stat formulas/caps
- all eight Growth Profiles
- role display
- all eight Pet Skill V2 definitions
- Hero/Pet shared Poison strongest-wins behavior
- Boss/Raid Stun/Silence conversion
- shared cooldown semantics with Hero
- Storm Phoenix CDR anti-loop rules
- Inferno Drake block still allows attached debuff rolls
- Pet HP carry/refill/revive lifecycle across normal and Boss Floors
- Hell Wolf migration from Thunder Cub
- save/reload and old-save compatibility
- mobile Pet page layout, overflow, safe area and touch targets

## 18. Balance values intentionally marked for playtest

The following are approved as V2 starting values, not promises that they will never change:

- EXP curve
- 1.15x / 1.35x Star multipliers
- raw stat Growth Profiles
- combat-stat conversion formulas and caps
- Pet skill damage/heal numbers
- Hell Wolf Poison damage baseline
- Moon Hare healing output
- Inferno Drake 75% ×3 damage
- Storm Phoenix 50% cooldown-reduction proc

Tune these only from playtest evidence and keep the underlying V2 structure intact unless a new design decision explicitly changes it.
