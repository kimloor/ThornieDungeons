-- Shop stock V2: each character's equipment offers live for a fixed window (30 min from the roll)
-- and the manual refresh button has a short server-enforced cooldown.
-- Additive only. Existing rows keep NULL and are treated as expired, so the next shop open rolls a fresh 5-offer stock.
ALTER TABLE character_shop_offers ADD COLUMN expires_at TEXT;
ALTER TABLE character_shop_offers ADD COLUMN refresh_available_at TEXT;
