ALTER TABLE players ADD COLUMN password_hash TEXT;
ALTER TABLE players ADD COLUMN recovery_code_hash TEXT;
ALTER TABLE players ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX idx_players_id_nocase ON players(LOWER(id));

CREATE TABLE auth_sessions (
  session_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT,
  remember_login INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_auth_sessions_player ON auth_sessions(player_id);
CREATE INDEX idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE UNIQUE INDEX idx_auth_sessions_one_active
  ON auth_sessions(player_id) WHERE revoked_at IS NULL;

CREATE TABLE auth_rate_limits (
  rate_key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_auth_rate_limits_updated ON auth_rate_limits(updated_at);
