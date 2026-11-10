-- Phase 3: Raid Boss — additive only, no data loss risk
ALTER TABLE raid_participants ADD COLUMN attempts_used INTEGER NOT NULL DEFAULT 0;
ALTER TABLE raid_participants ADD COLUMN total_contribution INTEGER NOT NULL DEFAULT 0;
ALTER TABLE raid_participants ADD COLUMN milestone_claimed TEXT NOT NULL DEFAULT '';
ALTER TABLE raid_boss_state ADD COLUMN settled_at TEXT NOT NULL DEFAULT '';
