-- W6 destructive cutover: remove only obsolete pre-V2 special equipment that was
-- explicitly approved for deletion. Valid V2 items, recipes, materials, currencies,
-- ordinary equipment, and unrelated save data are preserved.
--
-- Target identity is metadata-based, never name-based:
--   1) pre-V2 Raid Wings: slot_type=wings + rarity=raid
--   2) pre-V2 Azure/crafted Set gear: equipment slot + rarity=azure
-- Rows carrying either V2 marker are preserved conservatively.
--
-- Snapshot every target row before deletion for production auditability. This table is
-- append-only evidence only; W6 does not auto-restore or compensate deleted items.

CREATE TABLE IF NOT EXISTS w6_legacy_item_cleanup_audit (
  item_id TEXT PRIMARY KEY,
  player_id TEXT,
  character_id TEXT,
  reason TEXT NOT NULL,
  slot_type TEXT,
  rarity TEXT,
  name TEXT,
  equipped INTEGER NOT NULL DEFAULT 0,
  inventory_slot TEXT,
  item_template_id TEXT,
  extra_json TEXT,
  deleted_at TEXT NOT NULL
);

INSERT OR IGNORE INTO w6_legacy_item_cleanup_audit (
  item_id, player_id, character_id, reason, slot_type, rarity, name,
  equipped, inventory_slot, item_template_id, extra_json, deleted_at
)
SELECT
  item_id,
  player_id,
  character_id,
  CASE
    WHEN LOWER(COALESCE(rarity, '')) = 'raid' AND slot_type = 'wings'
      THEN 'legacy_raid_wing'
    ELSE 'legacy_azure_set'
  END,
  slot_type,
  rarity,
  name,
  COALESCE(equipped, 0),
  inventory_slot,
  item_template_id,
  extra_json,
  datetime('now')
FROM items
WHERE
  (
    (slot_type = 'wings' AND LOWER(COALESCE(rarity, '')) = 'raid')
    OR
    (
      slot_type IN ('weapon', 'helmet', 'chest', 'gloves', 'boots', 'accessory', 'wings')
      AND LOWER(COALESCE(rarity, '')) = 'azure'
    )
  )
  AND COALESCE(
    CASE WHEN json_valid(extra_json)
      THEN CAST(json_extract(extra_json, '$.itemModelVersion') AS INTEGER)
      ELSE 0
    END,
    0
  ) <> 2
  AND COALESCE(
    CASE WHEN json_valid(extra_json)
      THEN CAST(json_extract(extra_json, '$.rewardVersion') AS INTEGER)
      ELSE 0
    END,
    0
  ) <> 2;

DELETE FROM items
WHERE item_id IN (SELECT item_id FROM w6_legacy_item_cleanup_audit);
