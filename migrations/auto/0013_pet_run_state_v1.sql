-- Pet V2 run-state carry support.
--
-- Additive only: existing Hero/run columns and legacy run_state remain untouched.
-- Old rows receive an empty object, which clients interpret as the historical
-- full-HP Pet fallback. Apply after 0012_battle_persistence_v1.sql.
ALTER TABLE character_run_state
ADD COLUMN pet_state_json TEXT NOT NULL DEFAULT '{}';
