# Character Status and Hero Skills

This document records the current Character-page behavior and the approved Hero Skill System V1 direction.

## Character page

- The Character screen has two tabs: `Status` and `Skills`.
- Status allocation uses draft values first. `+` / `-` changes are not permanent until the player confirms.
- Previewed stat changes use one consistent highlight style.
- Reset actions require confirmation before spending diamonds.
- Character progression and skill data must remain backward-compatible with existing saves.

## Skills page UI direction

Keep the current Character-page visual language rather than introducing a separate full-screen skill-tree style.

- Remove the old `Skill Points Left` bar.
- Use that area for three branch tabs:
  - Assault — red accent
  - Guard — blue accent
  - Tactic — purple accent
- Unselected tabs remain in the normal dark-navy ThornieDungeons style.
- Skills are a vertical mobile-first list, grouped by `T1`, `T2`, `T3`, `T4`, then `Keystone`.
- Each skill row shows icon, name, type, short effect information, current Rank/Lv, and state (`Locked`, `Upgradable`, `Max`).
- Active rows show compact combat data such as `Active • SP • Damage`.
- Passive rows show `Passive • short effect`.
- Keystone rows show `Keystone • core mechanic`.
- Selecting a skill opens a detail panel/modal using the same interaction pattern as Dungeon Floor Detail. Full rank values, SP cost, cooldown, effects, prerequisites, and Upgrade action belong there rather than in the list.
- Active-skill slot management already exists in Inventory/Combat and is not duplicated here.

## Hero Skill System V1

Three branches:

1. `Assault` — damage, crit, Fury, burst and low-HP offense.
2. `Guard` — DEF, survival, counter and Aegis.
3. `Tactic` — debuffs, cooldown efficiency, SP recovery and buff stealing.

Progression rules:

- Active skills: Rank 1–3, 1 Skill Point per Rank.
- Passive skills: Lv1–5, 1 Skill Point per level; learned passives work automatically.
- Keystone: Rank 1–5, 2 Skill Points per Rank.
- Multiple learned Keystones may operate simultaneously.
- Character max level is 99; normal progression targets roughly 98 total Skill Points.
- Tier gates:
  - T1: Lv1 / 0 branch investment
  - T2: Lv15 + 8 SP in branch
  - T3: Lv30 + 20 SP in branch
  - T4: Lv50 + 35 SP in branch
  - Keystone: 40 SP in branch + at least one Rank in a T4 skill
- After Keystone R1 is unlocked, later Keystone ranks have no additional level gate.
- Use branch investment plus selective prerequisites; do not turn every skill into a hard prerequisite chain.

## Global status rules

- Poison: damage over time; reapply refreshes duration, not damage stacking.
- Stun: lose one Action/Turn; 1 Turn; no stacking or duration extension.
- Armor Break: DEF -15%; normally 2 Turns; strength does not stack.
- Silence: cannot use Active skills; Basic Attack remains available.
- DEF Up: Damage Taken -30%; strength does not stack.
- Freeze and Bleed are not part of Hero Skill System V1.

Boss/Raid conversion is a global status rule:

- successful Stun proc on Boss/Raid Boss -> Critical Hit instead;
- successful Silence proc on Boss/Raid Boss -> Armor Pierce for that hit (V1 target: 30% DEF pierce);
- Combat Log must show the conversion.

## Global anti-loop rules

- Combined passive/Keystone cooldown reduction: max 1 Turn per Action.
- An action that causes cooldown reduction cannot reduce its own cooldown in that same action.
- Passive/Keystone triggers occur at most once per Action unless a skill explicitly says `per Hit`.
- One enemy multi-hit Action grants at most one Aegis stack.
- Special resources `Fury`, `Aegis`, and `Scheme` are not normal buffs and cannot be stolen.
- Boss phase/mechanic/immunity buffs are unstealable.
- Life Drain requires a healing cap per Action.
- Last Stand requires an internal cooldown.

## Source and build rules

- Gameplay logic lives in source modules under `src/`; do not treat generated `index.html` as editable source.
- Run `node build.js` after source changes.
- `index.html` is the single generated app entrypoint.
