-- W9 final closeout: remove retired Arena V1 storage after the V2-only Worker cutover was production-verified.
-- Keep characters.pvp_tickets / pvp_tickets_updated_at as inert compatibility columns;
-- removing those would require a risky characters-table rebuild for no runtime benefit.
DROP TABLE IF EXISTS pvp_matches;
DROP TABLE IF EXISTS pvp_match_log;
DROP TABLE IF EXISTS pvp_snapshots;
DROP TABLE IF EXISTS pvp_ranking;
