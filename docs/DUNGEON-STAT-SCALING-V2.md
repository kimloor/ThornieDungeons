# ThornieDungeons — Dungeon Stat Scaling V2

Status: **ACTIVE-PRODUCTION — WAVE 1 RELEASED 2026-10-01**

Scope: Dungeon Normal Monster, Elite, pack, and Chapter Boss combat-stat scaling.

Implementation status: **PRODUCTION — implemented via PR #40 / merge e2e0a45ae828f57118d9c7fc1e5e9809439b5d42.**

This document defines the approved Dungeon V2 stat-scaling direction. Current production formulas in `src/systems/stats.js` remain the live implementation until a separate implementation task replaces them.

---

## 1. Balance assumptions

The approved scaling is designed around the following player-side assumptions:

- Character Stat Points remain **5 points per character level**.
- Existing stat meanings remain unchanged unless separately redesigned.
- Equipment Tier/Rarity follows `DUNGEON-REWARD-PROGRESSION-V2.md`.
- The approved base equipment-stat budget may be considered when validating combat pacing.
- **Enhance V2, Empower V2, Mythic Boss Weapon Signatures, Azure/Robot/Skeleton Set Effects, Raid Wings, and Raid reward gear rules are locked in `DUNGEON-REWARD-PROGRESSION-V2.md`.** They remain additional player-power headroom rather than mandatory baseline power for every character.
- Pet, Hero Skill, Critical Hit, and other build effects are also additional combat power and should not be assumed as mandatory baseline power.

The target is not to make every build require the same number of actions. Offensive builds should clear faster while accepting lower survivability.

---

## 2. Encounter structure dependency

Dungeon V2 encounter structure:

- 1 Chapter = 10 Floors.
- Normal encounters occupy ordinary floors.
- Elite encounters occur at the chapter midpoint pattern such as F5, F15, F25...
- Chapter Boss encounters occur at F10, F20, F30...
- Normal / Elite / Chapter Boss are distinct encounter types.

Legacy production behavior that treats every F5 as Boss and every F10 as Elite Boss is not the intended V2 structure.

---

## 3. Production comparison baseline

Current production Normal Monster base formulas are approximately:

~~~text
HP  = round(18 + Floor × 7)
ATK = round(3 + Floor × 1.6)
DEF = floor(Floor × 0.7)
~~~

Dungeon V2 intentionally scales above these production values, with a larger increase to HP than ATK so late-game enemies can absorb rising player damage without turning normal encounters into excessive one-shot risk.

---

## 4. Approved V2 Normal Monster reference outputs

The latest approved V2 curve includes the additional **+15% HP / ATK / DEF uplift** requested after the prior candidate.

The floors below are **reference/sample floors only**. They represent early-, mid-, late-, and endgame checks. They are **not** progression breakpoints, special encounter floors, Tier boundaries, or hidden gameplay events.

| Reference Floor | Production HP / ATK / DEF | Approved V2 HP / ATK / DEF | HP change | ATK change | DEF change |
| --- | --- | --- | ---: | ---: | ---: |
| F1 | 25 / 5 / 0 | **29 / 6 / 1** | +16% | +20% | minimum 1 |
| F30 | 228 / 51 / 21 | **328 / 64 / 28** | +43.9% | +25.5% | +33.3% |
| F71 | 515 / 117 / 49 | **829 / 155 / 70** | +61.0% | +32.5% | +42.9% |
| F105 | 753 / 171 / 73 | **1,300 / 236 / 109** | +72.6% | +38.0% | +49.3% |

Design direction:

- HP receives the largest long-term uplift.
- DEF receives a moderate uplift.
- ATK receives the smallest uplift to reduce unnecessary one-shot pressure.
- Scaling between reference points must remain continuous/smooth; these sample floors must not create gameplay jumps.
- Exact implementation interpolation/extrapolation must be validated against the approved reference outputs before release.

---

## 5. Normal Monster identity profiles

Apply the monster identity profile after the V2 Normal Monster base stat has been resolved.

| Monster | HP | ATK | DEF | Speed adjustment | Dodge | Identity |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Jelly Slime | ×1.00 | ×0.90 | ×0.90 | +0 | 0% | Balanced |
| Spore Cap | ×0.90 | ×0.85 | ×0.85 | +1 | 2% | Glass / Poison |
| Tusky Boar | ×1.30 | ×1.25 | ×1.05 | -1 | 0% | Heavy bruiser |
| Bramble Bat | ×0.70 | ×0.90 | ×0.65 | +4 | 12% | Fast / evasive |
| Bone Rattler | ×1.10 | ×0.95 | ×1.35 | -1 | 0% | Defensive |
| Sandy Crab | ×1.20 | ×0.75 | ×1.55 | -2 | 0% | Tank |

Monster-skill identities and exact mechanics are authoritative in `DUNGEON-MONSTER-SKILLS-V2.md`, including Normal skills, Elite variants, deterministic cycles and Boss skill/phase mechanics.

Do not flatten all monsters back to identical stats merely because they share the same Floor base.

---


## 6. Multi-monster pack scaling

Normal multi-monster encounters soften each monster's HP and ATK.

| Encounter size | HP per monster | ATK per monster | DEF |
| --- | ---: | ---: | ---: |
| 1 monster | ×1.00 | ×1.00 | unchanged |
| 2 monsters | ×0.72 | ×0.72 | unchanged |
| 3 monsters | **×0.605** | **×0.605** | unchanged |

The 3-monster value is the approved **+10% relative increase** from the earlier ×0.55 candidate:

~~~text
0.55 × 1.10 = 0.605
~~~

Approximate total encounter HP pool:

- 1 monster = 100%
- 2 monsters = 144%
- 3 monsters = **181.5%**

DEF remains unchanged per monster.

This keeps larger packs meaningfully harder while avoiding literal 2× / 3× solo copies. The ×0.605 choice is intentionally retained for V2 even though the shared subtractive damage model can make high-DEF builds strong against multi-target ATK; any later balance adjustment belongs to an explicit V3 pass.

## 7. Elite scaling

Elite is based on the resolved V2 Normal Monster + that monster's identity profile.

Then apply:

~~~text
Elite HP  ×1.30
Elite ATK ×1.10
Elite DEF ×1.05
~~~

Elite keeps the source monster's identity. For example, an Elite Tusky Boar remains a heavy bruiser rather than becoming a generic stat template.

Elite skill variants already approved for the monster family remain separate from these stat multipliers.

---

## 8. Chapter Boss profiles

Chapter Bosses use the V2 base scaling and then apply their approved Boss profile directly.

Do **not** apply a separate generic Boss ×2 HP layer on top of these Boss profiles.

| Boss | HP | ATK | DEF | Status Resist | Identity |
| --- | ---: | ---: | ---: | ---: | --- |
| Moss King | ×3.00 | ×1.15 | ×1.35 | 10% | Tank / sustain-pressure |
| Ember Drake | ×3.20 | ×1.35 | ×1.10 | 15% | Aggressive |
| Frost Warden | ×3.60 | ×1.15 | ×1.50 | 20% | Defensive |

Boss skills/mechanics are authoritative in `DUNGEON-MONSTER-SKILLS-V2.md`; this document owns only Boss stat profiles and the shared Enrage stat/damage threshold contract.

---

## 9. Boss Enrage

Every Chapter Boss uses the approved Enrage rule:

- Trigger when Boss HP falls below **50%**.
- Trigger **once per battle**.
- Boss damage increases by **20%** for the remainder of that battle.
- Enrage must not reset/retrigger repeatedly around the 50% threshold.

The stat curve should leave enough combat duration for the Enrage phase to matter in ordinary progression instead of the Boss immediately dying after entering the phase.

---

## 10. Player-build balance intent

The system intentionally permits meaningful build divergence:

- high-STR / offensive builds can kill enemies significantly faster;
- balanced builds trade kill speed for survivability and utility;
- defensive builds may require more actions but withstand more incoming damage.

Dungeon scaling must not dynamically normalize enemies against the player's exact build or equipped items.

The player should be allowed to become stronger through build choices, equipment, Pet, Hero Skills, and later Enhance/Empower investment.

---


## 11. V2 validation decision

The major player-power package was reviewed during design against representative early/mid/late/endgame Dungeon values, including high-rarity gear, Enhance, Empower, Mythic Sets, Boss Weapons, skills, pets, and multi-monster packs.

The Project Lead explicitly decided that **another mandatory full stress-test pass is not required before V2 implementation**.

Reason:

- the current V2 package remains playable enough to ship as the agreed baseline;
- further tuning without live evidence risks extending design indefinitely;
- if real play later shows concrete balance problems, open an explicit **V3 balance pass** rather than silently changing V2 values.

Implementation still requires ordinary correctness/regression QA for the formulas and encounter generation. This decision removes only the extra balance-simulation gate.

## 12. Migration / implementation boundary

Production implements this document as of the combined WAVE 1 + WAVE 1.5 release on 2026-10-01.

Implementation must intentionally replace or adapt legacy behavior including:

- legacy Normal Monster HP/ATK/DEF formulas;
- legacy F5 Boss / F10 Elite Boss classification;
- legacy Boss stat multipliers;
- any remote-config monster rows that override intended V2 profiles;
- encounter generation assumptions that conflict with the approved V2 encounter structure.

Do not modify Battle Core damage resolution to compensate for Dungeon stat balance. Dungeon stat generation should feed valid unit stats into the shared resolver.

---

## 13. Source-of-truth boundary

This document owns:

- Dungeon Normal Monster base stat-scaling direction;
- Normal Monster identity multipliers;
- pack stat scaling;
- Elite stat multipliers;
- Chapter Boss stat profiles;
- Chapter Boss Enrage stat effect.

It does not own:

- Dungeon monster/Elite/Boss skills and action cycles → `DUNGEON-MONSTER-SKILLS-V2.md`
- Dungeon rewards/economy → `DUNGEON-REWARD-PROGRESSION-V2.md`
- shared damage/status/turn rules → `BATTLE-SYSTEM-V1.md` / Battle Core
- Floor Select UI and pre-battle presentation → `DUNGEON-FLOOR-V1.md`
- Enhance / Empower / Mythic Boss Weapon Signature / Set Effect rules → `DUNGEON-REWARD-PROGRESSION-V2.md`
