-- Friend System V1 (Phase 2) — see docs/FRIEND-SYSTEM-V1.md. Depends on Phase 1 Social
-- Foundation (migration 0014: characters.last_active_at, character_blocks). Does not
-- touch migration_v3 or 0014.

-- Directional friend requests. One row per request; resolved requests (accepted/
-- rejected/cancelled/expired) are kept rather than deleted for history, same as this
-- schema already does for resolved raid/battle rows.
CREATE TABLE friend_requests (
  request_id TEXT PRIMARY KEY,
  sender_character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  receiver_character_id TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resolved_at TEXT
);
-- Enforces "cannot create duplicate pending request" (FRIEND-SYSTEM-V1.md §4) at the DB
-- level. Partial index only over pending rows — a pair can have many resolved history
-- rows but at most one live pending one in either direction combination.
CREATE UNIQUE INDEX idx_friend_requests_pending_pair ON friend_requests(sender_character_id, receiver_character_id) WHERE status = 'pending';
CREATE INDEX idx_friend_requests_receiver_status ON friend_requests(receiver_character_id, status);
CREATE INDEX idx_friend_requests_sender_status ON friend_requests(sender_character_id, status);

-- One canonical row per friendship pair (§6) — never A-B and B-A duplicates. Pair is
-- normalized so character_id_a < character_id_b (application code always inserts in
-- that order); the CHECK constraint rejects a reversed/self insert outright.
CREATE TABLE friendships (
  character_id_a TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  character_id_b TEXT NOT NULL REFERENCES characters(character_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (character_id_a, character_id_b),
  CHECK (character_id_a < character_id_b)
);
CREATE INDEX idx_friendships_b ON friendships(character_id_b);

-- Character-name search (§3/§4). Expression index on the lowercased name so
-- `WHERE LOWER(name) LIKE LOWER(?) || '%'` (used instead of a bare `LIKE` so the search
-- stays correct — not just fast — as the character list grows) doesn't force a full
-- table scan.
CREATE INDEX idx_characters_name_lower ON characters(LOWER(name));
