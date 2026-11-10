-- Guild System V1 Core (Phase 4) — see docs/GUILD-SYSTEM-V1.md. Core only: no donation,
-- no Guild Chat, no rename. Extends the legacy guilds/guild_members tables from
-- migration_v3.sql (confirmed empty in production) rather than recreating them.
-- migration_v3 itself is not touched or replayed.
--
-- Legacy guild_members already carries `CREATE UNIQUE INDEX idx_guild_member_char ON
-- guild_members (character_id)` — this alone enforces "one character = one Guild"
-- (§2) at the DB level, and is reused directly by the join/accept transactions below
-- via ON CONFLICT(character_id) DO NOTHING. Not re-declared here.

-- Guild fields the legacy table doesn't have yet. normalized_name backs case-insensitive
-- uniqueness (§3) — the legacy idx_guild_name is case-SENSITIVE exact-match only and is
-- left in place (harmless, still correct) rather than dropped.
ALTER TABLE guilds ADD COLUMN normalized_name TEXT NOT NULL DEFAULT '';
ALTER TABLE guilds ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE guilds ADD COLUMN join_policy TEXT NOT NULL DEFAULT 'open'; -- 'open' | 'application' | 'closed'
ALTER TABLE guilds ADD COLUMN level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE guilds ADD COLUMN exp INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX idx_guilds_normalized_name ON guilds(normalized_name);

-- Personal contribution (§10) — placeholder column only, no donation behavior in this
-- phase (explicitly out of scope). Added now so it doesn't require a second migration
-- with historical-data concerns once donation ships.
ALTER TABLE guild_members ADD COLUMN contribution INTEGER NOT NULL DEFAULT 0;

-- Applications (§5, §13). Partial unique index over status='pending' prevents a
-- duplicate pending application to the same Guild by the same character at the DB
-- level — same pattern as friend_requests' idx_friend_requests_pending_pair.
CREATE TABLE guild_applications (
  application_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES guilds(guild_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | cancelled
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE UNIQUE INDEX idx_guild_app_pending_pair ON guild_applications(guild_id, character_id) WHERE status = 'pending';
CREATE INDEX idx_guild_app_character_status ON guild_applications(character_id, status);
CREATE INDEX idx_guild_app_guild_status ON guild_applications(guild_id, status, created_at DESC);
