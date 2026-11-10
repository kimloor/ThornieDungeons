# Battle V1 implementation notes

This branch follows `BATTLE-SYSTEM-V1.md` when it overrides an older TBD note in the Hero/Pet documents.

## Provisional playtest values

The user approved defining currently-unlocked values provisionally and tuning them later. They are centralized in `HERO_SKILL_V1_PLAYTEST` rather than embedded in combat branches:

| Mechanic | V1 playtest value |
|---|---:|
| Toxic Strike | 12 SP, CD 2 |
| Stunning Blow | 16 SP, CD 3 |
| Silent Edge | 18 SP, CD 3 |
| Counter | 18 SP, CD 4 |
| Disruption | 22 SP, CD 5 |
| Disruption Stun selection weight at R1/R2 | 0.5 versus 1.0 |
| Thorned Aegis R5 Counter Stun chance | 35% |
| Survival Instinct Reflect cap | 10% Hero Max HP per incoming hit |
| Global harmful-status proc cap | 90% |

Pet playtest values live separately in `PET_V2_PLAYTEST`: Hell Wolf Poison is 20% Pet ATK for 3 Turns.

These values are balance configuration, not separate mechanics. Adjust the centralized object after playtest; do not fork resolver behavior.

## Persistence rollout

Migration v11 is already deployed and must not be replayed. `migrations/auto/0012_battle_persistence_v1.sql` is additive and must run before the Battle V1 Worker because it:

- copies the legacy player-keyed `run_state` rows into additive `character_run_state` rows with a real per-character primary key;
- adds action-boundary battle checkpoints;
- adds battle completion receipts keyed by stable battle identity;
- adds per-character cloud Quick Slots.

Run this collision preflight before applying v12; any returned row is a stop condition:

```sql
WITH mapped AS (
  SELECT COALESCE(NULLIF(TRIM(rs.character_id), ''), (
    SELECT c.character_id FROM characters c
    LEFT JOIN players p ON p.id = c.player_id
    WHERE c.player_id = rs.player_id
    ORDER BY CASE WHEN c.slot_index = COALESCE(p.active_slot, 0) THEN 0 ELSE 1 END,
      c.slot_index ASC LIMIT 1
  )) AS character_id
  FROM run_state rs
)
SELECT character_id, COUNT(*) AS row_count
FROM mapped
WHERE character_id IS NOT NULL
GROUP BY character_id
HAVING COUNT(*) > 1;
```

The primary-key insert intentionally fails rather than choosing a legacy checkpoint if this preflight is skipped and an unexpected duplicate exists.
