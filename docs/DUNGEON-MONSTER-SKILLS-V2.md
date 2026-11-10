# ThornieDungeons — Dungeon Monster Skills V2

Status: **ACTIVE-PRODUCTION — WAVE 1.5 RELEASED 2026-10-01**

Scope: Dungeon Normal Monster skills, Elite variants, Chapter Boss skills/phase mechanics, deterministic enemy action cycles, targeting, status interaction, Enrage interaction, Skip/checkpoint determinism.

This document is the authoritative Dungeon Monster Skill V2 production contract. It was implemented in the combined WAVE 1 + WAVE 1.5 release via PR #40 while preserving the approved monster identities from `DUNGEON-STAT-SCALING-V2.md`.

---

## 1. Shared execution rules

- Monster and Boss skills consume **one normal Action**.
- Enemy skills use **no MP/resource system** in V2.
- Normal/Elite/Boss skill frequency is controlled by a **deterministic action cycle**, not random skill selection.
- The action-cycle cursor is battle state and must survive checkpoint/save/reload/resume.
- Auto/Skip must resolve the same enemy action sequence and outcomes as normal Battle Core progression for the same state/seed.
- Battle Core remains the only damage/status/turn resolver. Dungeon code may choose the enemy action/spec but must not implement a second combat resolver.
- Skill hit/miss/Crit uses the same authoritative Battle Core rules as other direct attacks.
- Unless this document says otherwise, status chance is subject to the target's normal Status Resist rules.
- Utility/guard skills consume the Action and do not add a free Basic Attack.
- Re-entry/reload must not reset a cycle to gain or avoid a stronger/weaker action.

### Shared status semantics

Use the existing shared Battle Core status rules:

- **DEF Up:** Damage Taken -30%; reapply refreshes/keeps the longer duration; never stacks its strength.
- **Armor Break:** effective DEF -15%; normal duration 2 Turns; the proc hit uses pre-break DEF and the debuff affects subsequent hits/actions.
- **Stun:** 1 Turn; the affected unit loses its Action; no stacking/extension.
- **Poison:** one Poison slot; reapply refreshes duration and keeps the strongest current Poison damage.
- Boss/other shared status-resist/conversion behavior remains authoritative unless explicitly overridden here.

---

## 2. Normal Monster skills

### 2.1 Jelly Slime — Balanced

Skill: **Body Slam**

- Direct single-target attack.
- Damage: **1.25× ATK**.
- No additional status.

Cycle:

`Attack -> Body Slam -> repeat`

### 2.2 Spore Cap — Glass / Poison

Skill: **Toxic Spores**

- Direct single-target attack.
- Damage: **0.90× ATK**.
- Poison chance: **35%**.
- Poison duration: **2 Turns**.
- Poison damage: **10% of Spore Cap ATK per Poison tick**.
- Poison damage is indirect damage and is not increased by Boss Enrage or other direct-hit-only effects.

Cycle:

`Attack -> Toxic Spores -> Attack -> repeat`

### 2.3 Tusky Boar — Heavy bruiser

Skill: **Heavy Cleave**

- Direct single-target attack.
- Damage: **1.40× ATK**.
- Armor Break chance: **35%**.
- Armor Break duration: **2 Turns**.

Cycle:

`Attack -> Heavy Cleave -> repeat`

### 2.4 Bramble Bat — Fast / evasive

Skill: **Wing Flurry**

- Direct single-target multi-hit attack.
- **2 hits × 0.65× ATK**.
- Each hit resolves independently through normal Battle Core hit/Crit rules unless the shared resolver already defines action-level behavior.
- No status effect.

Cycle:

`Wing Flurry -> Attack -> Attack -> repeat`

### 2.5 Bone Rattler — Defensive

Skill: **Bone Bash**

- Direct single-target attack.
- Damage: **1.15× ATK**.
- Stun chance: **20%**.
- Stun duration: **1 Turn**.

Cycle:

`Attack -> Bone Bash -> Attack -> repeat`

### 2.6 Sandy Crab — Tank

Skill: **Shell Guard**

- Self utility action.
- Applies shared **DEF Up**.
- Duration: **2 Turns**.
- Deals no damage.

Cycle:

`Attack -> Shell Guard -> Attack -> Attack -> repeat`

---

## 3. Elite variants

Elite encounters keep the source monster's deterministic cycle, but the normal skill in that cycle is replaced by the corresponding Elite variant below.

Elite stat multipliers remain owned by `DUNGEON-STAT-SCALING-V2.md`; do not add hidden extra Elite stat multipliers inside skill definitions.

| Elite source | Elite skill | Effect |
| --- | --- | --- |
| Jelly Slime | **Heavy Body Slam** | 1.45× ATK |
| Spore Cap | **Noxious Spores** | 1.00× ATK; Poison 45%; 3 Turns; 12% ATK/tick |
| Tusky Boar | **Brutal Cleave** | 1.55× ATK; Armor Break 45%; 2 Turns |
| Bramble Bat | **Razor Flurry** | 3 hits × 0.50× ATK |
| Bone Rattler | **Skull Crusher** | 1.30× ATK; Stun 25%; 1 Turn |
| Sandy Crab | **Iron Shell** | shared DEF Up; 3 Turns; no damage |

Elite variants do not introduce separate MP, cooldown, or RNG action-selection systems.

---

## 4. Chapter Boss shared rules

Chapter Boss stat profiles and Status Resist remain owned by `DUNGEON-STAT-SCALING-V2.md`.

All Chapter Bosses also use the locked global Enrage rule:

- trigger strictly below **50% HP**;
- trigger once per battle;
- on the transition, append exactly one `boss_enrage` battle-log entry with the normal Battle Core `seq`/`round` fields (for example, `Moss King เข้าสู่โหมดคลั่ง!`);
- keep that entry in the checkpointed Battle log; resuming must not emit it again, and Manual, Auto, and Skip must produce the same single entry;
- resolved **direct damage +20%** for the remainder of battle;
- no reset/retrigger after checkpoint/reload/resume;
- no multiplier stacking from crossing the threshold multiple times.

Enrage increases:

- Basic Attack direct damage;
- damaging Boss-skill direct damage;
- every resolved hit of a Boss multi-hit action;
- every living target's resolved direct damage from a Boss AoE action.

Enrage does **not** increase:

- Poison/DoT;
- Reflect;
- indirect damage;
- DEF Up or other utility actions.

The Boss phase/enrage flag and action-cycle cursor are part of checkpoint state.

---

## 5. Moss King — Tank / Poison / sustain-pressure

### Skills

**Vine Slam**
- Direct single-target.
- Damage: **1.30× ATK**.

**Toxic Bloom**
- Direct single-target.
- Damage: **0.90× ATK**.
- Poison chance: **40%**.
- Poison duration: **3 Turns**.
- Poison damage: **12% of Moss King ATK per tick**.

**Overgrowth**
- Self utility action.
- Shared DEF Up.
- Duration: **2 Turns**.
- No damage.

### Base rotation

`Vine Slam -> Attack -> Toxic Bloom -> Attack -> repeat`

### Below-50% phase

When Moss King first enters Enrage:

1. global Enrage becomes active immediately for subsequent direct damage;
2. **Overgrowth is queued as Moss King's next scheduled Action**, replacing the next normal rotation action;
3. Overgrowth consumes that Action;
4. after Overgrowth, resume the base rotation from the action slot that was replaced, so the skipped normal rotation action still occurs next;
5. Overgrowth's phase-trigger use occurs **once per battle only**.

This avoids a free out-of-turn buff and makes the phase deterministic across normal play/Skip/resume.

---

## 6. Ember Drake — Aggressive / AoE pressure

### Skills

**Flame Bite**
- Direct single-target.
- Damage: **1.40× ATK**.

**Flame Breath**
- Direct AoE against the living Hero and living active Pet.
- Damage: **0.80× ATK per living target**.
- Each target resolves its own hit/Crit/damage through Battle Core.
- If the Pet is dead/absent, no Pet portion is redirected or added to the Hero.

**Inferno Rush**
- Direct single-target.
- Damage: **1.70× ATK**.

### Base rotation above/equal 50%

`Flame Bite -> Attack -> Flame Breath -> Attack -> repeat`

### Below-50% phase

After Enrage triggers, future cycles use:

`Flame Bite -> Inferno Rush -> Flame Breath -> Attack -> repeat`

Phase transition rules:

- do not reset the cycle to step 1 merely because HP crossed 50%;
- preserve the current cycle position;
- from that point onward, the first Basic-Attack slot in the cycle maps to Inferno Rush;
- the final Basic-Attack slot remains a normal Basic Attack;
- Enrage direct-damage +20% applies to Flame Bite, Flame Breath, Inferno Rush and Basic Attack.

---

## 7. Frost Warden — Defensive / control

### Skills

**Frost Strike**
- Direct single-target.
- Damage: **1.20× ATK**.

**Frozen Shackles**
- Direct single-target.
- Damage: **0.90× ATK**.
- Stun chance: **25%**.
- Stun duration: **1 Turn**.

**Ice Fortress**
- Self utility action.
- Shared DEF Up.
- Duration: **2 Turns**.
- Deals no damage.

### Rotation

`Frost Strike -> Frozen Shackles -> Attack -> Ice Fortress -> repeat`

Below 50%:

- keep the same rotation;
- global Enrage increases only Frost Warden's direct damaging actions;
- Ice Fortress remains a normal repeatable rotation action;
- DEF Up refreshes but does not stack strength.

No separate Freeze status is introduced in V2.

---

## 8. Targeting and action ownership

### Single-target enemy actions

Use the existing authoritative Dungeon enemy-target selection behavior. WAVE 1.5 must not create a parallel targeting resolver only for skills.

### Multi-hit

All hits belong to one enemy Action:

- turn/cooldown/cycle progress advances once for the Action;
- action-level trigger limits from shared Battle Core remain authoritative;
- individual hits still resolve damage/hit/Crit according to the shared resolver.

### AoE

Flame Breath targets each living allied combat unit specified by this contract exactly once.

- Hero living + Pet living -> two targets.
- Hero living + Pet dead/absent -> Hero only.
- Do not duplicate, transfer or redistribute a missing target's damage.

### Guard / utility

Shell Guard, Iron Shell, Overgrowth and Ice Fortress:

- consume one Action;
- deal no damage;
- do not include an automatic Basic Attack;
- use the shared DEF Up implementation rather than a new buff type.

---

## 9. Determinism / checkpoint / Skip

The following are authoritative battle state and must survive serialization:

- enemy action-cycle position;
- Elite/Boss skill identity required by the encounter;
- Boss phase/enrage flag;
- Moss King one-time Overgrowth phase flag/pending action where applicable;
- Ember Drake phase-2 rotation state.

Required parity:

- normal manual progression;
- Auto;
- Skip;
- checkpoint save/reload/resume

must not select different enemy skills solely because the presentation/execution path changed.

No action-cycle state may depend on React-only/UI-only counters.

---

## 10. Implementation boundaries

WAVE 1.5 may minimally extend the shared Battle Core where a generic/default-neutral action spec or AI representation is required.

Hard rules:

- Battle Core remains the single damage/status/turn resolver.
- Default behavior for actors without Monster Skill V2 data must remain unchanged.
- Arena and Raid must not inherit Dungeon-only skill cycles accidentally.
- No Reward V2, item economy, crafting, Enhance/Empower, Mythic Set or Raid/Wings work enters WAVE 1.5.
- No schema/migration is expected unless implementation proves unavoidable; any such need must be returned to Project Lead before publication.
- Do not invent additional status types such as Freeze/Burn for this wave.

---

## 11. Required QA contract

At minimum verify:

### Normal / Elite
- all six normal cycles;
- all six Elite substitutions;
- exact multipliers/status chances/durations;
- Wing/Razor Flurry hit counts;
- guard skills consume an Action and add no free attack;
- Poison indirect damage values;
- Armor Break affects subsequent damage rather than the proc hit.

### Bosses
- each base rotation;
- Moss King one-time Overgrowth phase insertion;
- Ember Drake phase-2 slot replacement without cycle reset;
- Flame Breath living-target behavior;
- Frost Warden repeatable Ice Fortress;
- Enrage strict <50%, exact-once and +20% direct resolved damage;
- Poison/DoT not increased by Enrage.

### Integration
- Auto/Skip/checkpoint/resume deterministic parity;
- Battle Core source/Worker parity if shared core changes;
- Dungeon result/save/persistence;
- Arena regression;
- Raid regression;
- existing-player compatibility;
- full focused and relevant regression suites;
- `node build.js`;
- generated `index.html` current;
- `git diff --check`;
- Worker syntax/Wrangler validation if Worker changes.

---

## 12. Source-of-truth boundary

This document owns:

- Dungeon Normal Monster skill definitions;
- Elite skill variants;
- deterministic enemy action cycles;
- Chapter Boss skill kits/rotations;
- Boss phase behavior around Enrage;
- Dungeon enemy-skill targeting rules;
- Monster Skill V2 checkpoint/Skip determinism.

Related contracts:

- Dungeon encounter/stat scaling -> `DUNGEON-STAT-SCALING-V2.md`
- Dungeon rewards/economy -> `DUNGEON-REWARD-PROGRESSION-V2.md`
- shared damage/status/turn rules -> Battle Core / `HERO-SKILL-SYSTEM-V1.md` where shared status semantics are defined
- Floor Select/presentation -> `DUNGEON-FLOOR-V1.md`
