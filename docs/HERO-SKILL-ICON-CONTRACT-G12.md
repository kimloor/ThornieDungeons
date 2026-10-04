# Hero Skill Icon Contract — G12

## Status

Approved production family. Runtime integration version: `g12_r1`.

## Authority and coverage

`src/systems/heroSkillsV1.js` is the authoritative Hero skill catalog. Every entry in `HERO_SKILLS_V1` must have exactly one manifest entry under `assets.heroSkillIcons` using the same skill ID. Basic Attack and Pet skills are outside this family.

The current production family contains 36 icons:

- Assault: `power_strike`, `weapon_mastery`, `killer_instinct`, `heavy_blow`, `bloodlust`, `armor_break_mastery`, `blade_storm`, `life_drain`, `finishing_blow`, `rampage`, `critical_mastery`, `relentless_fury`.
- Guard: `guard`, `toughness`, `iron_body`, `shield_wall`, `recovery`, `last_stand`, `counter`, `battle_hardened`, `second_wind`, `fortress`, `survival_instinct`, `thorned_aegis`.
- Tactic: `toxic_strike`, `exploit_weakness`, `debilitating_edge`, `stunning_blow`, `spirit_drain`, `toxic_mastery`, `silent_edge`, `quick_recovery`, `skill_efficiency`, `disruption`, `master_tactician`, `usurper`.

## Production asset contract

- R2 path: `ui/skill-icons/hero/<skill_id>.png`
- Runtime source: `r2-upload/ui/skill-icons/hero/`
- Manifest group: `assets.heroSkillIcons`
- Canvas: 256×256 PNG
- Alpha: transparent outside the medallion
- Encoded size: 36,293–42,321 bytes in `g12_r1`
- Shared G10.5 budget: PASS; every icon is below the 120 KB target ceiling and 200 KB hard limit
- Runtime URL is versioned with `?v=g12_r1`

Do not ship high-resolution masters from the review package as runtime assets.

## Runtime contract

All Hero Skill UI surfaces must use `resolveHeroSkillIconUrl` / `HeroSkillIcon` from `src/assets/manifest.js`. Do not create screen-local icon maps.

Required consumers:

1. Character > Skills
2. Dungeon Battle quick slots and assignment picker
3. Arena Setup skill slots 1–4
4. Arena Battle skill controls

An absent manifest entry, failed request, or decode failure renders the shared non-emoji `✦` fallback. Asset failure must never change skill IDs, action behavior, saved setup, cooldowns, or combat authority.

## Future changes

Any new authoritative Hero skill must add a budget-compliant icon and manifest entry in the same batch. No new Hero skill may ship with a missing icon or a screen-local emoji mapping.
