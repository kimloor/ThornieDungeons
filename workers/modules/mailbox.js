export function createMailboxHandlers(deps) {
  const { json, nowIso, verifyPlayer, verifyOwnedCharacter, parseJsonColumn } = deps;

// W9.8 QA boundary: reward delivery remains mailbox-backed and replay-safe.
// Server-side reward mutations (UPDATE characters/items directly) get silently
// clobbered by this project's client-authoritative full-sync save model — the next
// saveCharacterProgress/syncItems push from the client overwrites them with its own
// stale local copy. So ANY server-granted reward (raid, and future PvP/guild/event)
// must go through here instead: drop a mail row, let the client claim it and merge
// the reward into its own local state, then the normal autosave persists it correctly.
function newMailId() {
  return `mail-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
async function sendMail(db, characterId, title, body, reward, sourceKey = "") {
  const r = reward || {};
  const key = String(sourceKey || "");
  // SQLite/D1 cannot target a partial unique index with ON CONFLICT(source_key).
  // Guard only non-empty source keys; legacy mail intentionally permits repeated
  // empty keys.  The INSERT remains one statement and is safe under the unique
  // index when two reward finalizers race.
  await db.prepare(
    `INSERT INTO mailbox (mail_id, character_id, title, body, gold, diamonds, junk_json, items_json, claimed, created_at, claimed_at, source_key)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, '', ?
     WHERE ? = '' OR NOT EXISTS (SELECT 1 FROM mailbox WHERE source_key = ? AND source_key <> '')`
  ).bind(newMailId(), characterId, title || "", body || "", Number(r.gold) || 0, Number(r.diamonds) || 0,
    r.junk && r.junk.length ? JSON.stringify(r.junk) : "", r.items && r.items.length ? JSON.stringify(r.items) : "",
    nowIso(), key, key, key).run();
}
async function handleGetMailbox(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  const res = await db
    .prepare(`SELECT mail_id, title, body, gold, diamonds, junk_json, items_json, claimed, created_at FROM mailbox WHERE character_id = ? ORDER BY created_at DESC LIMIT 50`)
    .bind(characterId)
    .all();
  const mails = (res.results || []).map((m) => ({
    mailId: m.mail_id, title: m.title, body: m.body, gold: Number(m.gold) || 0, diamonds: Number(m.diamonds) || 0,
    junk: m.junk_json ? JSON.parse(m.junk_json) : [], items: m.items_json ? JSON.parse(m.items_json) : [],
    claimed: !!Number(m.claimed), createdAt: m.created_at,
  }));
  return json({ ok: true, mails });
}
async function handleClaimMail(db, id, session, characterId, mailId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!mailId) return json({ error: "missing_fields" });

  const mail = await db.prepare(`SELECT * FROM mailbox WHERE mail_id = ? AND character_id = ?`).bind(mailId, characterId).first();
  if (!mail) return json({ error: "not_found" });
  if (Number(mail.claimed)) return json({ error: "already_claimed" });

  const guard = await db.prepare(`UPDATE mailbox SET claimed = 1, claimed_at = ? WHERE mail_id = ? AND claimed = 0`).bind(nowIso(), mailId).run();
  if (!guard.meta || !guard.meta.changes) return json({ error: "already_claimed" });

  return json({
    ok: true, mailId, gold: Number(mail.gold) || 0, diamonds: Number(mail.diamonds) || 0,
    junk: mail.junk_json ? JSON.parse(mail.junk_json) : [], items: mail.items_json ? JSON.parse(mail.items_json) : [],
  });
}
async function handleClaimAllMail(db, id, session, characterId, requestId = "") {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const receiptKey = requestId ? `mailbox:claim-all:${characterId}:${String(requestId).slice(0, 128)}` : "";
  if (receiptKey) {
    const prior = await db.prepare(`SELECT mail_ids_json, reward_json FROM mailbox_claim_receipts WHERE receipt_key = ? AND character_id = ?`).bind(receiptKey, characterId).first();
    if (prior) return json({ ok: true, replayed: true, mailIds: parseJsonColumn(prior.mail_ids_json, []), ...parseJsonColumn(prior.reward_json, {}) });
  }
  const unclaimed = await db.prepare(`SELECT * FROM mailbox WHERE character_id = ? AND claimed = 0 ORDER BY created_at ASC, mail_id ASC`).bind(characterId).all();
  const rows = unclaimed.results || [];
  if (!rows.length) {
    const empty = { ok: true, mailIds: [], gold: 0, diamonds: 0, junk: [], items: [] };
    if (receiptKey) {
      await db.prepare(`INSERT INTO mailbox_claim_receipts (receipt_key, character_id, mail_ids_json, reward_json, created_at) VALUES (?, ?, '[]', ?, ?) ON CONFLICT(receipt_key) DO NOTHING`).bind(receiptKey, characterId, JSON.stringify(empty), nowIso()).run();
      const canonical = await db.prepare(`SELECT mail_ids_json, reward_json FROM mailbox_claim_receipts WHERE receipt_key = ? AND character_id = ?`).bind(receiptKey, characterId).first();
      return json({ ok: true, replayed: true, mailIds: parseJsonColumn(canonical?.mail_ids_json, []), ...parseJsonColumn(canonical?.reward_json, empty) });
    }
    return json(empty);
  }

  const now = nowIso();
  const claimResults = await db.batch(rows.map((m) => db.prepare(`UPDATE mailbox SET claimed = 1, claimed_at = ? WHERE mail_id = ? AND character_id = ? AND claimed = 0`).bind(now, m.mail_id, characterId)));
  const claimedRows = rows.filter((m, index) => Number(claimResults?.[index]?.meta?.changes) === 1);

  let gold = 0, diamonds = 0;
  const junkTotals = {};
  const items = [];
  claimedRows.forEach((m) => {
    gold += Number(m.gold) || 0;
    diamonds += Number(m.diamonds) || 0;
    (m.junk_json ? JSON.parse(m.junk_json) : []).forEach((j) => { junkTotals[j.junkId] = (junkTotals[j.junkId] || 0) + (Number(j.quantity) || 0); });
    (m.items_json ? JSON.parse(m.items_json) : []).forEach((it) => items.push(it));
  });
  const junk = Object.keys(junkTotals).map((junkId) => ({ junkId, quantity: junkTotals[junkId] }));
  const reward = { gold, diamonds, junk, items };
  if (receiptKey) {
    await db.prepare(`INSERT INTO mailbox_claim_receipts (receipt_key, character_id, mail_ids_json, reward_json, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(receipt_key) DO NOTHING`)
      .bind(receiptKey, characterId, JSON.stringify(claimedRows.map((m) => m.mail_id)), JSON.stringify(reward), now).run();
    // A concurrent request with the same receipt key may have won the insert.
    // Always return the stored canonical payload so retries and concurrent calls
    // are byte-for-byte reward-equivalent and cannot lose the winner's reward.
    const canonical = await db.prepare(`SELECT mail_ids_json, reward_json FROM mailbox_claim_receipts WHERE receipt_key = ? AND character_id = ?`).bind(receiptKey, characterId).first();
    return json({ ok: true, replayed: true, mailIds: parseJsonColumn(canonical?.mail_ids_json, []), ...parseJsonColumn(canonical?.reward_json, reward) });
  }
  return json({ ok: true, replayed: false, mailIds: claimedRows.map((m) => m.mail_id), ...reward });
}
// Deletes only CLAIMED mail — deleting an unclaimed one would silently discard whatever
// reward it was carrying, so the WHERE clause refuses to touch claimed=0 rows regardless
// of what the client asks for.
async function handleDeleteMail(db, id, session, characterId, mailId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!mailId) return json({ error: "missing_fields" });

  const result = await db.prepare(`DELETE FROM mailbox WHERE mail_id = ? AND character_id = ? AND claimed = 1`).bind(mailId, characterId).run();
  if (!result.meta || !result.meta.changes) return json({ error: "not_found_or_unclaimed" });
  return json({ ok: true, mailId });
}
async function handleDeleteMails(db, id, session, characterId, mailIds) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  if (!Array.isArray(mailIds) || !mailIds.length) return json({ error: "missing_fields" });

  const placeholders = mailIds.map(() => "?").join(",");
  const result = await db
    .prepare(`DELETE FROM mailbox WHERE character_id = ? AND claimed = 1 AND mail_id IN (${placeholders})`)
    .bind(characterId, ...mailIds)
    .run();
  return json({ ok: true, deleted: result.meta ? result.meta.changes : 0 });
}
// Deletes ALL claimed mail for this character in one shot — the common "clean up my old
// read mail" action, without the client needing to enumerate every id first.
async function handleDeleteAllClaimedMail(db, id, session, characterId) {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });

  const result = await db.prepare(`DELETE FROM mailbox WHERE character_id = ? AND claimed = 1`).bind(characterId).run();
  return json({ ok: true, deleted: result.meta ? result.meta.changes : 0 });
}

// ---------- Phase 4: Crafting ----------


  return {
    newMailId,
    sendMail,
    handleGetMailbox,
    handleClaimMail,
    handleClaimAllMail,
    handleDeleteMail,
    handleDeleteMails,
    handleDeleteAllClaimedMail
  };
}

