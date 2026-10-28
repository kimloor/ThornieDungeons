// Client Systems V1 / PR-C: one place that classifies API error codes and owns the shared
// player-facing text. Screens keep their own wording as overrides on top of this catalog.
// Raw server codes, stacks and SQL must never be shown as player text (fallbacks only).
//
// Kinds:
//   session    - the login session is no longer valid (re-login)
//   transient  - network/server hiccup, safe to try again
//   rate_limit - too many requests / cooldown
//   conflict   - same or competing operation already in flight or already applied
//   validation - the request itself was malformed or out of range
//   business   - a game rule said no (not enough gold, not a member, locked, ...)
//   admin      - Admin V2 authentication
//   fatal      - configuration / contract problem, not fixable by the player
const ERROR_KIND_BY_CODE = Object.freeze({
  // session (4)
  invalid_session: "session",
  session_expired: "session",
  session_replaced: "session",
  session_revoked: "session",
  // transient (2)
  network_error: "transient",
  server_error: "transient",
  // rate_limit (6)
  admin_rate_limited: "rate_limit",
  arena_refresh_cooldown: "rate_limit",
  arena_surrender_cooldown: "rate_limit",
  chat_rate_limited: "rate_limit",
  rate_limited: "rate_limit",
  shop_refresh_cooldown: "rate_limit",
  // conflict (22)
  active_battle_conflict: "conflict",
  arena_action_conflict: "conflict",
  arena_activation_conflict: "conflict",
  arena_combat_conflict: "conflict",
  arena_match_already_done: "conflict",
  arena_match_in_progress: "conflict",
  arena_refresh_conflict: "conflict",
  arena_ticket_purchase_conflict: "conflict",
  battle_identity_conflict: "conflict",
  blacksmith_conflict: "conflict",
  blacksmith_version_conflict: "conflict",
  checkpoint_context_conflict: "conflict",
  claim_conflict: "conflict",
  craft_capacity_conflict: "conflict",
  craft_conflict: "conflict",
  donation_conflict: "conflict",
  idempotency_conflict: "conflict",
  operation_conflict: "conflict",
  operation_in_progress: "conflict",
  operation_request_conflict: "conflict",
  salvage_conflict: "conflict",
  stamina_conflict: "conflict",
  // validation (61)
  battle_result_too_large: "validation",
  checkpoint_too_large: "validation",
  invalid_arena_setup: "validation",
  invalid_battle_context: "validation",
  invalid_battle_result: "validation",
  invalid_blacksmith_action: "validation",
  invalid_blacksmith_request: "validation",
  invalid_board: "validation",
  invalid_checkpoint: "validation",
  invalid_credentials: "validation",
  invalid_dungeon_checkpoint: "validation",
  invalid_empower_cost: "validation",
  invalid_empower_item_type: "validation",
  invalid_empower_slot: "validation",
  invalid_equip_slot: "validation",
  invalid_guild_name: "validation",
  invalid_inventory_slot: "validation",
  invalid_item_reference: "validation",
  invalid_item_slot_type: "validation",
  invalid_items: "validation",
  invalid_join_policy: "validation",
  invalid_json: "validation",
  invalid_legacy_empower_shape: "validation",
  invalid_pet_action: "validation",
  invalid_player_id: "validation",
  invalid_potion_request: "validation",
  invalid_presentation_state: "validation",
  invalid_quantity: "validation",
  invalid_quick_slots: "validation",
  invalid_rarity: "validation",
  invalid_recipient: "validation",
  invalid_recovery: "validation",
  invalid_request_id: "validation",
  invalid_reward_context: "validation",
  invalid_reward_plan: "validation",
  invalid_salvage_request: "validation",
  invalid_sell_item: "validation",
  invalid_sell_quantity: "validation",
  invalid_sell_request: "validation",
  invalid_sheet: "validation",
  invalid_shop_purchase: "validation",
  invalid_shop_quantity: "validation",
  invalid_shop_resource: "validation",
  invalid_skill_allocation: "validation",
  invalid_slot: "validation",
  invalid_stat_allocation: "validation",
  invalid_target: "validation",
  invalid_v2_empower_shape: "validation",
  inventory_too_large: "validation",
  message_empty: "validation",
  message_too_long: "validation",
  missing_fields: "validation",
  missing_match_id: "validation",
  missing_query: "validation",
  missing_request_id: "validation",
  not_legacy_item: "validation",
  not_v2_item: "validation",
  password_mismatch: "validation",
  request_body_too_large: "validation",
  request_id_required: "validation",
  skill_requirement: "validation",
  // business (81)
  all_empower_slots_locked: "business",
  already_claimed: "business",
  already_friends: "business",
  already_in_guild: "business",
  application_not_found: "business",
  application_not_pending: "business",
  arena_action_illegal: "business",
  arena_action_invalid: "business",
  arena_locked: "business",
  arena_match_expired: "business",
  arena_match_not_active: "business",
  arena_match_not_found: "business",
  arena_match_state_invalid: "business",
  arena_no_ticket: "business",
  arena_not_attacker_turn: "business",
  arena_opponent_not_found: "business",
  arena_replay_not_found: "business",
  arena_tickets_full: "business",
  battle_checkpoint_missing: "business",
  battle_result_not_after_checkpoint: "business",
  blocked_relationship: "business",
  boss_already_dead: "business",
  cannot_block_self: "business",
  cannot_lock_all_empower_slots: "business",
  cannot_request_self: "business",
  character_not_found: "business",
  donation_item_not_allowed: "business",
  dungeon_floor_locked: "business",
  dungeon_preview_stale: "business",
  duplicate_equipped_slot: "business",
  empower_slots_full: "business",
  enhance_max: "business",
  forbidden: "business",
  friend_limit_reached: "business",
  guild_closed: "business",
  guild_create_level_too_low: "business",
  guild_leader_must_transfer_first: "business",
  guild_name_taken: "business",
  guild_not_found: "business",
  insufficient_diamonds: "business",
  insufficient_gold: "business",
  insufficient_materials: "business",
  insufficient_pet_duplicates: "business",
  insufficient_protection_stones: "business",
  insufficient_quantity: "business",
  insufficient_stat_points: "business",
  inventory_overflow_pending: "business",
  item_equipped: "business",
  item_favorited: "business",
  item_locked: "business",
  item_not_found: "business",
  item_not_owned: "business",
  leader_must_transfer_first: "business",
  mythic_salvage_source_invalid: "business",
  name_taken: "business",
  no_participation: "business",
  no_skills_to_reset: "business",
  no_stamina: "business",
  no_stats_to_reset: "business",
  not_found: "business",
  not_found_or_unclaimed: "business",
  not_friends: "business",
  not_guild_leader: "business",
  not_guild_member: "business",
  outgoing_request_cap_reached: "business",
  pet_not_owned: "business",
  pet_star_max: "business",
  potion_not_owned: "business",
  protection_not_eligible: "business",
  recipe_not_found: "business",
  registration_unavailable: "business",
  request_already_exists: "business",
  request_expired: "business",
  request_not_found: "business",
  request_not_pending: "business",
  salvage_not_eligible: "business",
  shop_offer_expired: "business",
  shop_offer_invalid: "business",
  shop_offer_not_found: "business",
  slot_occupied: "business",
  target_not_guild_member: "business",
  // admin (7) + W2-D delete-safety validation (3) + W2-E filter validation (1)
  invalid_filter: "validation",
  feature_disabled: "business",
  audit_not_restorable: "business",
  operation_pending: "business",
  character_in_run: "business",
  item_state_changed: "business",
  admin_audit_failed: "admin",
  confirm_mismatch: "validation",
  invalid_reason: "validation",
  reason_required: "validation",
  admin_auth_failed: "admin",
  admin_key_not_configured: "admin",
  admin_session_expired: "admin",
  admin_session_invalid: "admin",
  admin_session_required: "admin",
  admin_session_revoked: "admin",
  // fatal (10)
  arena_action_replay_corrupt: "fatal",
  character_progress_requires_authoritative_operation: "fatal",
  cors_origin_not_allowed: "fatal",
  daily_reward_contract_unavailable: "fatal",
  dungeon_battle_not_authorized: "fatal",
  invalid_config: "fatal",
  method_not_allowed: "fatal",
  missing_action_key: "fatal",
  unknown_action: "fatal",
  untrusted_v2_item: "fatal"
});

// Shared text that is identical on every screen today. Anything screen-specific stays in that
// screen's override table (see friendErrorText / chatErrorText / guildErrorText / mailboxErrorText).
const ERROR_TEXT_TH = Object.freeze({
  invalid_session: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
  session_expired: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
  session_replaced: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่",
  session_revoked: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่"
});

function errorCodeOf(value) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") return String(value.error || value.code || "");
  return "";
}

function errorKind(value) {
  const code = errorCodeOf(value);
  return Object.prototype.hasOwnProperty.call(ERROR_KIND_BY_CODE, code) ? ERROR_KIND_BY_CODE[code] : "unknown";
}

function isSessionErrorCode(value) {
  return errorKind(value) === "session";
}

function errorCodesOfKind(kind) {
  return Object.keys(ERROR_KIND_BY_CODE).filter(code => ERROR_KIND_BY_CODE[code] === kind);
}

// Resolution order: screen override -> shared catalog text -> caller fallback.
// The raw code is never returned as text.
function errorMessage(value, { overrides = null, fallback = "" } = {}) {
  const code = errorCodeOf(value);
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, code) && overrides[code]) return overrides[code];
  if (Object.prototype.hasOwnProperty.call(ERROR_TEXT_TH, code)) return ERROR_TEXT_TH[code];
  return fallback;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ERROR_KIND_BY_CODE, ERROR_TEXT_TH, errorKind, errorMessage, isSessionErrorCode, errorCodesOfKind, errorCodeOf };
}
