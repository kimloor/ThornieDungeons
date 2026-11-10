export function createLeaderboardHandlers(deps) {
  const {
    json, nowIso, combatPowerFromCharacter, petCombatPower,
    getOrCreateActiveRaid, raidBossDefById, raidDateKey,
  } = deps;

  const LEADERBOARD_HISTORY_RETENTION_DAYS = 7;
  function dateKeyDaysAgo(days) {
    return new Date(Date.now() + 7 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
  
  // Snapshots every character into leaderboard_stats. Called by scheduled() (nightly cron)
  // and also exposed as an admin action so Kimmie can force a refresh without waiting for
  // the cron to fire (e.g. right after deploying this).
  async function runLeaderboardSnapshot(db) {
    const chars = await db.prepare(`SELECT * FROM characters`).all();
    const characters = chars.results || [];
    const now = nowIso();
    let updated = 0;
  
    for (const ch of characters) {
      const itemsRes = await db
        .prepare(`SELECT atk, def, hp, mp, enhance_level, extra_json FROM items WHERE character_id = ? AND equipped = 1`)
        .bind(ch.character_id)
        .all();
      const totalCp = combatPowerFromCharacter(ch, itemsRes.results || []);
  
      let petCp = 0;
      if (ch.active_pet_id) {
        try {
          const parsed = JSON.parse(ch.pets_json || "[]");
          // pets_json is backward-compatible: legacy rows are a bare array, current rows
          // are `{list, dup}` (dup = star-up duplicate pool) — see pets.js star-up system.
          const pets = Array.isArray(parsed) ? parsed : (parsed && parsed.list) || [];
          const active = pets.find((p) => p.instId === ch.active_pet_id);
          if (active) petCp = petCombatPower(active);
        } catch (e) { /* malformed pets_json — leave pet_cp at 0 for this character */ }
      }
  
      await db
        .prepare(
          `INSERT INTO leaderboard_stats (character_id, player_id, name, max_floor, total_cp, pet_cp, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(character_id) DO UPDATE SET
             player_id=excluded.player_id, name=excluded.name, max_floor=excluded.max_floor,
             total_cp=excluded.total_cp, pet_cp=excluded.pet_cp, updated_at=excluded.updated_at`
        )
        .bind(ch.character_id, ch.player_id, ch.name || "", Number(ch.unlocked_floor) || 1, totalCp, petCp, now)
        .run();
  
      // Append-only archive (Phase 2.1) — same values, but keyed by date too so today's
      // snapshot doesn't erase yesterday's like the upsert above does. Uses raidDateKey()
      // (Thai midnight) so every board's history lines up on the same date boundary.
      await db
        .prepare(
          `INSERT INTO leaderboard_history (date, character_id, player_id, name, max_floor, total_cp, pet_cp, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(date, character_id) DO UPDATE SET
             player_id=excluded.player_id, name=excluded.name, max_floor=excluded.max_floor,
             total_cp=excluded.total_cp, pet_cp=excluded.pet_cp, created_at=excluded.created_at`
        )
        .bind(raidDateKey(), ch.character_id, ch.player_id, ch.name || "", Number(ch.unlocked_floor) || 1, totalCp, petCp, now)
        .run();
      updated++;
    }
  
    // Retention: keep only the last LEADERBOARD_HISTORY_RETENTION_DAYS days of history (and of
    // raid data, which doubles as that board's own history — see handleGetLeaderboardHistory)
    // so these tables don't grow forever.
    const cutoff = dateKeyDaysAgo(LEADERBOARD_HISTORY_RETENTION_DAYS);
    await db.prepare(`DELETE FROM leaderboard_history WHERE date < ?`).bind(cutoff).run();
    await db.prepare(`DELETE FROM raid_boss_state WHERE date < ?`).bind(cutoff).run(); // cascades to raid_participants
  
    return { updated, at: now };
  }
  
  const LEADERBOARD_BOARD_COLS = { floor: "max_floor", cp: "total_cp", pet_cp: "pet_cp" };
  
  async function handleGetLeaderboard(db, board) {
    if (board === "raid") {
      const raid = await getOrCreateActiveRaid(db);
      const def = raidBossDefById(raid.boss_def_id);
      const res = await db
        .prepare(`SELECT character_id, player_id, name, total_damage, total_contribution FROM raid_participants WHERE raid_id = ? ORDER BY total_contribution DESC LIMIT 50`)
        .bind(raid.raid_id)
        .all();
      return json({ ok: true, board, raidId: raid.raid_id, bossName: def.name, hpMax: Number(raid.boss_hp_max), hpCurrent: Number(raid.boss_hp_current), rows: res.results || [], availableDates: recentDateKeys() });
    }
    // Compatibility board key "pvp" now reads the authoritative Arena V2 season.
    // Global Leaderboard keeps its existing public shape while V1 pvp_ranking is retired.
    if (board === "pvp") {
      const season = await db.prepare(
        `SELECT season_id, season_number, ends_at FROM arena_seasons WHERE status = 'active' ORDER BY season_number DESC LIMIT 1`
      ).first();
      if (!season) return json({ ok: true, board, rows: [] });
      const res = await db.prepare(`
        SELECT p.character_id, c.player_id, c.name, p.rating,
               p.attack_wins AS wins, p.attack_losses AS losses, p.attack_draws AS draws
        FROM arena_season_players p
        JOIN characters c ON c.character_id = p.character_id
        WHERE p.season_id = ?
          AND (p.attack_wins + p.attack_draws + p.attack_losses) > 0
        ORDER BY p.rating DESC, p.attack_wins DESC, p.rating_reached_at ASC, p.character_id ASC
        LIMIT 50
      `).bind(season.season_id).all();
      return json({ ok: true, board, seasonId: season.season_id, seasonNumber: Number(season.season_number) || 0, seasonEndsAt: season.ends_at, rows: res.results || [] });
    }
    const col = LEADERBOARD_BOARD_COLS[board];
    if (!col) return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS).concat(["raid", "pvp"]) });
    const res = await db
      .prepare(`SELECT character_id, player_id, name, max_floor, total_cp, pet_cp, updated_at FROM leaderboard_stats ORDER BY ${col} DESC LIMIT 50`)
      .all();
    return json({ ok: true, board, rows: res.results || [], availableDates: recentDateKeys() });
  }
  
  // Returns the last LEADERBOARD_HISTORY_RETENTION_DAYS calendar dates (today first) so the
  // client can render a date picker without needing a separate "which dates have data" call —
  // picking an empty day just renders an empty list, which is a fine, simple UX for this.
  function recentDateKeys() {
    const out = [];
    for (let i = 0; i < LEADERBOARD_HISTORY_RETENTION_DAYS; i++) out.push(dateKeyDaysAgo(i));
    return out;
  }
  
  async function handleGetLeaderboardHistory(db, board, date) {
    const dateKey = date || raidDateKey();
    if (board === "raid") {
      // Raid never had a separate history table — raid_boss_state/raid_participants already
      // carry the date a boss was fought on, so "history" is just querying them directly.
      // Multiple bosses can spawn in one day (respawn-on-death, or the forced daily reset), so
      // this aggregates every raid instance that date per character rather than picking one.
      const raidsThatDay = await db.prepare(`SELECT raid_id FROM raid_boss_state WHERE date = ?`).bind(dateKey).all();
      const raidIds = (raidsThatDay.results || []).map((r) => r.raid_id);
      if (!raidIds.length) return json({ ok: true, board, date: dateKey, availableDates: recentDateKeys(), rows: [] });
      const placeholders = raidIds.map(() => "?").join(",");
      const res = await db
        .prepare(
          `SELECT character_id, MAX(player_id) as player_id, MAX(name) as name, MAX(total_damage) as total_damage, SUM(total_contribution) as total_contribution
           FROM raid_participants WHERE raid_id IN (${placeholders}) GROUP BY character_id ORDER BY total_contribution DESC LIMIT 50`
        )
        .bind(...raidIds)
        .all();
      return json({ ok: true, board, date: dateKey, availableDates: recentDateKeys(), rows: res.results || [] });
    }
    // pvp has no history table (see handleGetLeaderboard) — the client only shows the date
    // picker for boards that support it, but guard here too in case that ever changes.
    if (board === "pvp") return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS).concat(["raid"]) });
  
    const col = LEADERBOARD_BOARD_COLS[board];
    if (!col) return json({ error: "invalid_board", allowed: Object.keys(LEADERBOARD_BOARD_COLS).concat(["raid"]) });
    const res = await db
      .prepare(`SELECT character_id, player_id, name, max_floor, total_cp, pet_cp, created_at FROM leaderboard_history WHERE date = ? ORDER BY ${col} DESC LIMIT 50`)
      .bind(dateKey)
      .all();
    return json({ ok: true, board, date: dateKey, availableDates: recentDateKeys(), rows: res.results || [] });
  }
  
  // NEW — server-owned reward cycle (source of truth; client only displays what this returns,
  // never computes its own reward, so a tampered client can't grant itself diamonds).
  // Day 3/5 grant existing raid materials (see JUNK_INFO: iron/manaOre/bossHorn/bossHide),
  // day 7 resolves to one random Azure set piece via randomAzureItemDesc() (defined further
  // down, in the Raid Boss section) at claim time — the preview below just flags
  // `azureRandom: true` rather than pre-rolling it, so browsing the preview can't
  // waste/predetermine that roll before the player actually claims.

  return { runLeaderboardSnapshot, handleGetLeaderboard, handleGetLeaderboardHistory };
}
