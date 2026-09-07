# Character Status and Skills

The redesigned Character page is implemented in `src/ui/components.js` and styled in
`src/data/styles.js`. `index.html` and `app-v2.html` are generated outputs; run
`node build.js` after changing source modules.

## Confirm-before-save upgrades

- Status `+` / `-` buttons only change component-local draft values.
- Skill `+` / `-` buttons only change component-local draft values.
- A draft becomes permanent only through the gold confirm button.
- All changed preview values use the single `md-preview-value` cyan style.
- The paid reset button intentionally occupies roughly one quarter of the action row; the
  confirmation button fills the remaining space.

## Paid resets

`STAT_RESET_COST` and `SKILL_RESET_COST` are both 100 blue diamonds. A confirmation modal is
required before charging. A status reset returns every allocated STR/VIT/AGI/DEX/LUK point. A
skill reset removes committed skill levels and returns the computed skill-point budget.

## Skill progression and persistence

- Characters earn one skill point every five character levels.
- Missing skill-level entries mean level 1, so pre-feature saves remain compatible.
- Each committed skill level increases damage multipliers by 8% of the base multiplier, or
  healing by 3 percentage points, up to `SKILL_MAX_LEVEL`.
- Skill levels are stored under `skills` in the existing `pets_json` character envelope:
  `{ list, dup, skills }`. This is deliberate. It keeps progression cloud-persistent without a
  production D1 schema migration. Preserve all three keys whenever that envelope is serialized.

The combat path calls `skillAtLevel()` before resolving a skill, so UI upgrades affect real
combat rather than presentation only.
