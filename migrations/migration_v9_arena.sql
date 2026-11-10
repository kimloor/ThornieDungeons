-- ThornieDungeons migration_v9_arena
-- Applied: 2026-09-09 (already applied live via Cloudflare D1 MCP)
-- Adds PvP Arena attack tickets to characters. pvp_ranking / pvp_snapshots /
-- pvp_match_log already existed from migration_v3.sql (Phase 5 fills them in).

ALTER TABLE characters ADD COLUMN pvp_tickets INTEGER NOT NULL DEFAULT 5;
ALTER TABLE characters ADD COLUMN pvp_tickets_updated_at TEXT NOT NULL DEFAULT '';
