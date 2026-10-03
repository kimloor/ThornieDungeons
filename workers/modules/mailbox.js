export function createMailboxHandlers(deps) {
  const { json, nowIso, verifyPlayer, verifyOwnedCharacter, parseJsonColumn, buildRewardStatements, getSnapshot } = deps;

// Mail reward claims commit the claim marker and authoritative resource/item credit as one
// server transaction. The mailbox row remains as compatible claim history after completion.
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
  let replayed = !!Number(mail.claimed);
  if (!replayed) {
    const claimedAt = `${nowIso()}#${crypto.randomUUID()}`;
    const statements = [db.prepare(`UPDATE mailbox SET claimed = 1, claimed_at = ? WHERE mail_id = ? AND character_id = ? AND claimed = 0`).bind(claimedAt, mailId, characterId)];
    statements.push(...await buildRewardStatements(db, id, characterId, mail, claimedAt, 0, null, {}));
    const results = await db.batch(statements);
    replayed = !(Number(results?.[0]?.meta?.changes) > 0);
    const latest = await db.prepare(`SELECT claimed FROM mailbox WHERE mail_id = ? AND character_id = ?`).bind(mailId, characterId).first();
    if (!Number(latest?.claimed)) return json({ error: "claim_conflict" }, 409);
  }
  return json({ ok: true, mailId, replayed, ...(await getSnapshot(db, id, characterId)) });
}
async function handleClaimAllMail(db, id, session, characterId, requestId = "") {
  const auth = await verifyPlayer(db, id, session);
  if (auth.error) return json({ error: auth.error });
  const owned = await verifyOwnedCharacter(db, id, characterId);
  if (owned.error) return json({ error: owned.error });
  // Keep the requestId argument for client compatibility. Exact-once is enforced per
  // mail row by claimed=0 plus a unique claim token gating every credit statement.
  void requestId;

  const rows = (await db.prepare(`SELECT * FROM mailbox WHERE character_id = ? AND claimed = 0 ORDER BY created_at ASC, mail_id ASC`).bind(characterId).all()).results || [];
  const settlementState = {};
  const statements = [];
  const claimIndices = [];
  const mailIds = [];
  for (const mail of rows) {
    const claimedAt = `${nowIso()}#${crypto.randomUUID()}`;
    claimIndices.push(statements.length);
    statements.push(db.prepare(`UPDATE mailbox SET claimed = 1, claimed_at = ? WHERE mail_id = ? AND character_id = ? AND claimed = 0`).bind(claimedAt, mail.mail_id, characterId));
    statements.push(...await buildRewardStatements(db, id, characterId, mail, claimedAt, 0, null, settlementState));
    mailIds.push(mail.mail_id);
  }
  const results = statements.length ? await db.batch(statements) : [];
  const claimedAny = claimIndices.some(index => Number(results?.[index]?.meta?.changes) > 0);
  return json({ ok: true, replayed: !claimedAny, mailIds: claimedAny ? mailIds : [], ...(await getSnapshot(db, id, characterId)) });
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
