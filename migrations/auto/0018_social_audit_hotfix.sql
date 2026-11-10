-- Social Phase 3+4 Audit Hotfix — see the hotfix dev prompt. Adds only what's needed for
-- issue #3 (Chat send idempotency). Issues #1, #2, #5, #6 are logic-only fixes in
-- workers/thornie-dungeons-api.js with no schema change. migration_v3.sql, 0016, and
-- 0017 are not touched or replayed.

-- Client-generated retry nonce (§3). Scoped per-sender rather than globally unique — a
-- client regenerates a fresh nonce per logical send attempt (crypto.randomUUID()-class
-- entropy), and only needs to be unique against that same character's own prior sends
-- for retry-safety to hold. NULL for any row sent without a nonce (older clients, or
-- if a request omits it) — never enforced as NOT NULL so this stays backward compatible.
ALTER TABLE chat_messages ADD COLUMN client_nonce TEXT;
CREATE UNIQUE INDEX idx_chat_sender_nonce ON chat_messages(from_character_id, client_nonce) WHERE client_nonce IS NOT NULL;
