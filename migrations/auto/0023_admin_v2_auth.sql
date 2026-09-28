-- ThornieDungeons Admin V2 Phase 0
-- Dedicated Admin allowlist/session/audit tables.
-- NOTE: W9 already owns migration 0022 on its active feature branch.
-- This migration is intentionally numbered 0023 to avoid collision.
-- Do not deploy/merge this migration ahead of 0022 without an explicit release-order decision.

PRAGMA foreign_keys = ON;

CREATE TABLE admin_users (
  player_id TEXT PRIMARY KEY
    REFERENCES players(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('owner', 'admin')),
  enabled INTEGER NOT NULL DEFAULT 1
    CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE admin_sessions (
  session_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL
    REFERENCES admin_users(player_id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT
);

CREATE INDEX idx_admin_sessions_player
  ON admin_sessions(player_id);

CREATE INDEX idx_admin_sessions_token_hash
  ON admin_sessions(token_hash);

CREATE UNIQUE INDEX idx_admin_sessions_one_active
  ON admin_sessions(player_id)
  WHERE revoked_at IS NULL;

CREATE TABLE admin_audit_log (
  audit_id TEXT PRIMARY KEY,
  player_id TEXT
    REFERENCES players(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_admin_audit_created
  ON admin_audit_log(created_at DESC);

CREATE INDEX idx_admin_audit_player
  ON admin_audit_log(player_id, created_at DESC);

-- Deliberately no production Admin seed row here.
-- The approved owner Player ID must be provisioned explicitly before release.
