-- One-time reset of existing active Dungeon Checkpoints for the shared recovery contract.
-- Non-terminal battles are abandoned; terminal outcomes awaiting settlement are preserved.
-- Keep closed rows for audit and durable action-receipt integrity.

UPDATE battle_authority
SET outcome = 'abandoned',
    updated_at = datetime('now')
WHERE outcome = ''
  AND settled_at = ''
  AND battle_id IN (
    SELECT battle_id
    FROM battle_checkpoints
    WHERE state = 'active'
  );

UPDATE battle_checkpoints
SET state = 'closed',
    updated_at = datetime('now')
WHERE state = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM battle_authority
    WHERE battle_authority.battle_id = battle_checkpoints.battle_id
      AND battle_authority.character_id = battle_checkpoints.character_id
      AND battle_authority.outcome IN ('victory', 'defeat', 'fled')
      AND battle_authority.settled_at = ''
  );
