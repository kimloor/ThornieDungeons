# ThornieDungeons — Dungeon Stat Scaling V2

Status: **ACTIVE-DESIGN / USER-APPROVED**

Scope: Dungeon Normal Monster, Elite, pack, and Chapter Boss combat-stat scaling.

Implementation status: **DESIGN CONTRACT ONLY — not yet production behavior.**

This document defines the approved Dungeon V2 stat-scaling direction. Current production formulas in `src/systems/stats.js` remain the live implementation until a separate implementation task replaces them.

---

## 1. Balance assumptions

The approved scaling is designed around the following player-side assumptions:

- Character Stat Points remain **5 points per character level**.
- Existing stat meanings remain unchanged unless separately redesigned.
- Equipment Tier/Rarity follows `DUNGEON-REWARD-PROGRESSION-V2.md`.
- The approved base equipment-stat budget may be considered when validating combat pacing.
- **Enhance V2, Empower V2, Mythic Boss Weapon Signatures, and Azure/Robot/Skeleton Set Effects are now locked in `DUNGEON-REWARD-PROGRESSION-V2.md`.** They remain additional player-power headroom rather than mandatory baseline power for every character.
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

Existing approved monster-skill identities remain attached to these monsters, including the previously designed families such as Toxic Spores, Heavy Cleave, Wing Flurry, Bone Bash, Shell Guard, and related Elite variants.

Do not flatten all monsters back to identical stats merely because they share the same Floor base.

---

## 6. Multi-monster pack scaling

Normal multi-monster encounters soften each monster's HP and ATK.

| Encounter size | HP per monster | ATK per monster | DEF |
| --- | ---: | ---: | ---: |
| 1 monster | ×1.00 | ×1.00 | unchanged |
| 2 monsters | ×0.72 | ×0.72 | unchanged |
| 3 monsters | ×0.55 | ×0.55 | unchanged |

Approximate total encounter HP pool:

- 1 monster = 100%
- 2 monsters = 144%
- 3 monsters = 165%

This makes larger packs meaningfully harder without making them a literal 2× or 3× copy of a solo encounter.

---

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

Previously approved Boss skills/mechanics remain part of each Boss identity and are not redefined by this document.

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

## 11. Deferred final stress test

Before implementation/release, repeat combat simulations using the now-locked Enhance, Empower, Mythic Boss Weapon Signature, and Set Effect rules.

Required stress-test profiles should include at minimum:

1. balanced stat allocation + ordinary expected gear;
2. offense-heavy stat allocation;
3. strong/high-rarity gear;
4. high-end Enhance/Empower;
5. full Mythic Set builds and mixed 4+2 / 2+2+2 builds;
6. Boss Weapon Signature contribution;
7. Hero Skill + Pet + Critical Hit contribution.

The purpose is to verify headroom, not to redesign the approved base curve unless testing identifies a concrete progression failure.

---

## 12. Migration / implementation boundary

Current production does not yet implement this document.

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

- Dungeon rewards/economy → `DUNGEON-REWARD-PROGRESSION-V2.md`
- shared damage/status/turn rules → `BATTLE-SYSTEM-V1.md` / Battle Core
- Floor Select UI and pre-battle presentation → `DUNGEON-FLOOR-V1.md`
- Enhance / Empower / Mythic Boss Weapon Signature / Set Effect rules → `DUNGEON-REWARD-PROGRESSION-V2.md`
