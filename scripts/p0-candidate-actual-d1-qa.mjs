import fs from "node:fs";
import crypto from "node:crypto";

const CFG = {
  workerUrl: process.env.P0_WORKER_URL || "",
  workerName: process.env.P0_WORKER_NAME || "thornie-dungeons-p0-candidate-qa",
  sourceSha: process.env.P0_CANDIDATE_SHA || "",
  dbId: "c16e0b11-cf83-468c-a533-0ecbf522082f",
  productionDbId: "2f6d52b4-3de7-4e78-98d4-fc143a4d29e2",
  dbName: "thornie-dungeons-staging",
  playerId: process.env.P0_QA_PLAYER_ID || "P0_QA_ROLLBACK_02",
  characterId: process.env.P0_QA_CHARACTER_ID || "char-p0-rollback-20261102-r02",
  battleId: process.env.P0_QA_BATTLE_ID || "dungeon-p0-rollback-20261102-r02",
  sessionId: process.env.P0_QA_SESSION_ID || "sess-p0-rollback-P0_QA_ROLLBACK_02",
  templatePlayerId: "P0_QA_ROLLBACK_01",
  templateCharacterId: "char-p0-rollback-20261102",
  templateBattleId: "dungeon-p0-rollback-20261102"
};

const required = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "P0_ROLLBACK_TEST_KEY"];
for (const key of required) {
  if (!process.env[key]) throw new Error("Missing required environment variable: " + key);
}
const token = process.env.P0_ROLLBACK_TEST_KEY;
const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const apiBase = "https://api.cloudflare.com/client/v4";
const evidence = {
  test: "P0 Candidate Actual D1 Rollback R01-R04",
  worker: CFG.workerName,
  workerUrl: CFG.workerUrl,
  sourceSha: CFG.sourceSha,
  stagingDatabaseId: CFG.dbId,
  productionDatabaseIdRefused: CFG.productionDbId,
  fixture: { playerId: CFG.playerId, characterId: CFG.characterId, battleId: CFG.battleId },
  startedAt: new Date().toISOString(),
  cases: {}
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function quote(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}
async function cf(path, options = {}) {
  const response = await fetch(apiBase + path, {
    method: options.method || "GET",
    headers: {
      Authorization: "Bearer " + process.env.CLOUDFLARE_API_TOKEN,
      ...(options.body ? { "Content-Type": "application/json" } : {})
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  const payload = await response.json();
  assert(response.ok && payload.success === true, "Cloudflare API request failed: " + path + " " + JSON.stringify(payload.errors || payload));
  return payload.result;
}
async function d1(sql) {
  const result = await cf("/accounts/" + accountId + "/d1/database/" + CFG.dbId + "/query", {
    method: "POST",
    body: { sql }
  });
  assert(Array.isArray(result) && result.every(item => item.success === true), "Staging D1 query failed");
  return result;
}
async function verifyIsolation() {
  const api = "/accounts/" + accountId + "/workers/scripts/" + CFG.workerName;
  const [versions, deployments, schedules] = await Promise.all([
    cf(api + "/versions?per_page=50"),
    cf(api + "/deployments?per_page=50"),
    cf(api + "/schedules")
  ]);
  assert(CFG.dbId !== CFG.productionDbId, "Refusing Production D1");
  assert(Array.isArray(schedules.schedules) && schedules.schedules.length === 0, "Unexpected Worker cron schedule");
  const sourceVersions = (versions.items || []).filter(v => v.annotations && v.annotations["workers/tag"] === CFG.sourceSha);
  assert(sourceVersions.length > 0, "Pinned QA source version tag not found");
  sourceVersions.sort((a, b) => String(a.metadata?.created_on || "").localeCompare(String(b.metadata?.created_on || "")));
  const sourceId = sourceVersions[sourceVersions.length - 1].id;
  const activeDeployment = (deployments.deployments || []).slice().sort((a, b) => String(b.created_on).localeCompare(String(a.created_on)))[0];
  assert(activeDeployment && Array.isArray(activeDeployment.versions) && activeDeployment.versions.length === 1
    && activeDeployment.versions[0].percentage === 100, "Expected exactly one active Worker version at 100%");
  const activeId = activeDeployment.versions[0].version_id;
  const [source, active] = await Promise.all([
    cf(api + "/versions/" + sourceId),
    cf(api + "/versions/" + activeId)
  ]);
  const sourceEtag = source.resources?.script?.etag;
  assert(sourceEtag && source.annotations?.["workers/tag"] === CFG.sourceSha, "Pinned source version identity mismatch");
  assert(active.resources?.script?.etag === sourceEtag, "Active Worker source differs from reviewed QA source");
  const bindings = active.resources?.bindings || [];
  const d1Bindings = bindings.filter(b => b.type === "d1");
  assert(d1Bindings.length === 1 && d1Bindings[0].name === "DB"
    && (d1Bindings[0].database_id || d1Bindings[0].id) === CFG.dbId, "Worker D1 binding is not exclusively Staging");
  assert(!bindings.some(b => b.type === "d1" && (b.database_id || b.id) === CFG.productionDbId), "Production D1 binding detected");
  assert(bindings.some(b => b.name === "P0_ROLLBACK_TEST_KEY" && b.type === "secret_text"), "QA-only secret binding missing");
  for (const [name, value] of [
    ["P0_ROLLBACK_PLAYER_ID", CFG.playerId],
    ["P0_ROLLBACK_CHARACTER_ID", CFG.characterId],
    ["P0_ROLLBACK_BATTLE_ID", CFG.battleId]
  ]) {
    assert(bindings.some(b => b.name === name && b.type === "plain_text" && b.text === value), "QA binding mismatch: " + name);
  }
  assert(bindings.length === 5, "Unexpected Worker binding count");
  evidence.isolation = {
    activeVersionId: activeId,
    sourceVersionId: sourceId,
    sourceEtag,
    d1Binding: CFG.dbId,
    cronSchedules: 0,
    bindingNames: bindings.map(b => b.name).sort()
  };
}
async function seedFreshFixture() {
  const q = quote;
  const ids = await d1(
    "SELECT " +
    "(SELECT COUNT(*) FROM players WHERE id=" + q(CFG.playerId) + ") AS player_count, " +
    "(SELECT COUNT(*) FROM characters WHERE character_id=" + q(CFG.characterId) + ") AS character_count, " +
    "(SELECT COUNT(*) FROM battle_authority WHERE battle_id=" + q(CFG.battleId) + ") AS authority_count, " +
    "(SELECT COUNT(*) FROM battle_checkpoints WHERE battle_id=" + q(CFG.battleId) + ") AS checkpoint_count"
  );
  assert(ids[0].results?.[0]?.player_count === 0 && ids[0].results?.[0]?.character_count === 0
    && ids[0].results?.[0]?.authority_count === 0 && ids[0].results?.[0]?.checkpoint_count === 0,
    "Fresh QA fixture IDs already exist; refusing to overwrite any row");

  const template = await d1(
    "SELECT ba.battle_id, ba.character_id, ba.state_rev, ba.initial_state_json, ba.state_json, ba.outcome, " +
    "ba.last_action_key, ba.last_action_request_json, ba.last_action_result_json, " +
    "bc.state AS checkpoint_state, bc.checkpoint_seq, bc.payload_json " +
    "FROM battle_authority ba JOIN battle_checkpoints bc ON bc.battle_id=ba.battle_id AND bc.character_id=ba.character_id " +
    "WHERE ba.battle_id=" + q(CFG.templateBattleId) + " AND ba.character_id=" + q(CFG.templateCharacterId) +
    " AND ba.outcome='victory' AND ba.settled_at<>'' AND bc.state='completed'"
  );
  assert(template[0].results?.length === 1, "Settled source fixture template is missing or ambiguous");
  const now = new Date().toISOString();

  const player = await d1(
    "INSERT INTO players (id,password,created_at,diamonds,active_slot,password_hash,recovery_code_hash,auth_version) " +
    "SELECT " + q(CFG.playerId) + ",password,created_at,diamonds,active_slot,password_hash,recovery_code_hash,auth_version " +
    "FROM players WHERE id=" + q(CFG.templatePlayerId)
  );
  assert(Number(player[0].meta?.changes) === 1, "Unable to create isolated QA player");

  const character = await d1(
    "INSERT INTO characters (character_id,player_id,slot_index,name,level,xp,stat_points,str,vit,agi,dex,luk,gold,unlocked_floor,potions,protection_stones,chest_pity,pets_json,active_pet_id,created_at,updated_at,raid_stamina,raid_stamina_updated_at,pvp_tickets,pvp_tickets_updated_at,last_active_at) " +
    "SELECT " + q(CFG.characterId) + "," + q(CFG.playerId) + ",slot_index,'P0 Fresh QA',1,0,0,str,vit,agi,dex,luk,0,10,potions,protection_stones,chest_pity,'[]','',created_at," + q(now) + ",raid_stamina,raid_stamina_updated_at,pvp_tickets,pvp_tickets_updated_at,last_active_at " +
    "FROM characters WHERE character_id=" + q(CFG.templateCharacterId) + " AND player_id=" + q(CFG.templatePlayerId)
  );
  assert(Number(character[0].meta?.changes) === 1, "Unable to create isolated QA character");

  const authority = await d1(
    "INSERT INTO battle_authority (battle_id,character_id,state_rev,initial_state_json,state_json,outcome,last_action_key,last_action_request_json,last_action_result_json,settled_at,created_at,updated_at) " +
    "SELECT " + q(CFG.battleId) + "," + q(CFG.characterId) + ",state_rev," +
    "replace(initial_state_json," + q(CFG.templateBattleId) + "," + q(CFG.battleId) + ")," +
    "replace(state_json," + q(CFG.templateBattleId) + "," + q(CFG.battleId) + ")," +
    "outcome,last_action_key,replace(last_action_request_json," + q(CFG.templateBattleId) + "," + q(CFG.battleId) + ")," +
    "replace(last_action_result_json," + q(CFG.templateBattleId) + "," + q(CFG.battleId) + "),''," +
    q(now) + "," + q(now) + " FROM battle_authority WHERE battle_id=" + q(CFG.templateBattleId) +
    " AND character_id=" + q(CFG.templateCharacterId) + " AND outcome='victory' AND settled_at<>''"
  );
  assert(Number(authority[0].meta?.changes) === 1, "Unable to create fresh unsettled battle authority row");

  const checkpoint = await d1(
    "INSERT INTO battle_checkpoints (battle_id,character_id,checkpoint_seq,payload_json,state,created_at,updated_at) " +
    "SELECT " + q(CFG.battleId) + "," + q(CFG.characterId) + ",checkpoint_seq," +
    "replace(payload_json," + q(CFG.templateBattleId) + "," + q(CFG.battleId) + "),'active'," +
    q(now) + "," + q(now) + " FROM battle_checkpoints WHERE battle_id=" + q(CFG.templateBattleId) +
    " AND character_id=" + q(CFG.templateCharacterId) + " AND state='completed'"
  );
  assert(Number(checkpoint[0].meta?.changes) === 1, "Unable to create fresh active checkpoint");

  const verify = await d1(
    "SELECT COUNT(*) AS n FROM battle_authority ba JOIN characters c ON c.character_id=ba.character_id " +
    "JOIN players p ON p.id=c.player_id JOIN battle_checkpoints cp ON cp.battle_id=ba.battle_id AND cp.character_id=ba.character_id " +
    "LEFT JOIN battle_completions bc ON bc.battle_id=ba.battle_id " +
    "WHERE ba.battle_id=" + q(CFG.battleId) + " AND ba.character_id=" + q(CFG.characterId) +
    " AND c.player_id=" + q(CFG.playerId) + " AND ba.outcome='victory' AND ba.settled_at='' " +
    "AND json_extract(ba.initial_state_json,'$.floor')=10 " +
    "AND json_extract(ba.state_json,'$.serverContext.role')='chapter_boss' " +
    "AND cp.state='active' AND bc.battle_id IS NULL"
  );
  assert(verify[0].results?.[0]?.n === 1, "Fresh fixture did not reach exact unsettled Chapter Boss state");

  const clean = await d1(
    "SELECT " +
    "(SELECT COUNT(*) FROM character_operation_receipts WHERE character_id=" + q(CFG.characterId) + ") AS receipts, " +
    "(SELECT COUNT(*) FROM items WHERE character_id=" + q(CFG.characterId) + ") AS items, " +
    "(SELECT COUNT(*) FROM item_provenance WHERE original_character_id=" + q(CFG.characterId) + ") AS provenance, " +
    "(SELECT COUNT(*) FROM item_ownership_events WHERE to_character_id=" + q(CFG.characterId) + ") AS ownership"
  );
  assert(Object.values(clean[0].results?.[0] || {}).every(value => Number(value) === 0),
    "Fresh QA fixture is not economically empty");
  evidence.fixtureSeed = { status: "PASS", templateBattleId: CFG.templateBattleId, playerId: CFG.playerId,
    characterId: CFG.characterId, battleId: CFG.battleId, emptyEconomy: true, createdAt: now };
}

async function refreshFixtureSession() {
  const now = new Date();
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const tokenHash = crypto.createHash("sha256").update(token).digest("base64url");
  const sql = "INSERT INTO auth_sessions (session_id, player_id, token_hash, created_at, expires_at, revoked_at, revoke_reason, remember_login) VALUES (" +
    [CFG.sessionId, CFG.playerId, tokenHash, createdAt, expiresAt].map(quote).join(", ") +
    ", NULL, NULL, 0) ON CONFLICT(session_id) DO UPDATE SET token_hash=excluded.token_hash, created_at=excluded.created_at, expires_at=excluded.expires_at, revoked_at=NULL, revoke_reason=NULL, remember_login=0 WHERE auth_sessions.player_id=excluded.player_id";
  await d1(sql);
  const check = await d1("SELECT COUNT(*) AS n FROM auth_sessions s JOIN characters c ON c.player_id=s.player_id WHERE s.session_id=" +
    quote(CFG.sessionId) + " AND s.player_id=" + quote(CFG.playerId) + " AND c.character_id=" + quote(CFG.characterId) +
    " AND s.token_hash=" + quote(tokenHash) + " AND s.revoked_at IS NULL AND s.expires_at > " + quote(createdAt));
  assert(check[0].results?.[0]?.n === 1, "Unable to refresh exact QA bearer session");
}
async function snapshot(battleId) {
  const q = quote;
  const sql = [
    "SELECT json_object(",
    "'character', (SELECT json_object('level',level,'xp',xp,'stat_points',stat_points,'gold',gold,'unlocked_floor',unlocked_floor,'pets_json',pets_json,'active_pet_id',active_pet_id) FROM characters WHERE character_id=" + q(CFG.characterId) + " AND player_id=" + q(CFG.playerId) + "),",
    "'player', (SELECT json_object('diamonds',diamonds) FROM players WHERE id=" + q(CFG.playerId) + "),",
    "'items', json(COALESCE((SELECT json_group_array(json_object('item_id',item_id,'player_id',player_id,'character_id',character_id,'quantity',quantity,'extra_json',extra_json)) FROM (SELECT item_id,player_id,character_id,quantity,extra_json FROM items WHERE character_id=" + q(CFG.characterId) + " ORDER BY item_id)), '[]')),",
    "'provenance', json(COALESCE((SELECT json_group_array(json_object('item_id',item_id,'original_player_id',original_player_id,'original_character_id',original_character_id,'origin_type',origin_type,'origin_source_id',origin_source_id)) FROM (SELECT item_id,original_player_id,original_character_id,origin_type,origin_source_id FROM item_provenance WHERE original_character_id=" + q(CFG.characterId) + " ORDER BY item_id)), '[]')),",
    "'ownership', json(COALESCE((SELECT json_group_array(json_object('event_id',event_id,'item_id',item_id,'to_player_id',to_player_id,'to_character_id',to_character_id,'event_type',event_type)) FROM (SELECT event_id,item_id,to_player_id,to_character_id,event_type FROM item_ownership_events WHERE to_character_id=" + q(CFG.characterId) + " ORDER BY event_id)), '[]')),",
    "'completion', (SELECT json_object('battle_id',battle_id,'character_id',character_id,'result_json',result_json,'completed_at',completed_at) FROM battle_completions WHERE battle_id=" + q(battleId) + "),",
    "'checkpoint', (SELECT json_object('state',state,'checkpoint_seq',checkpoint_seq,'payload_json',payload_json) FROM battle_checkpoints WHERE battle_id=" + q(battleId) + " AND character_id=" + q(CFG.characterId) + "),",
    "'authority', (SELECT json_object('state_rev',state_rev,'state_json',state_json,'outcome',outcome,'settled_at',settled_at) FROM battle_authority WHERE battle_id=" + q(battleId) + " AND character_id=" + q(CFG.characterId) + ")",
    ") AS snapshot"
  ].join(" ");
  const result = await d1(sql);
  const raw = result[0].results?.[0]?.snapshot;
  assert(typeof raw === "string", "Unable to read exact QA snapshot for battle " + battleId);
  return JSON.parse(raw);
}
async function receiptEvidence(nonce) {
  const result = await d1("SELECT operation,request_id,operation_token,payload_json,result_json FROM character_operation_receipts WHERE character_id=" +
    quote(CFG.characterId) + " AND operation='p0_rollback_fault'");
  const rows = result[0].results || [];
  assert(rows.length === 1, "Expected exactly one P0 fault-control receipt");
  const payload = JSON.parse(rows[0].payload_json);
  assert(rows[0].operation_token === "p0-rollback:" + CFG.battleId && payload.nonce === nonce
    && payload.battleId === CFG.battleId && payload.playerId === CFG.playerId
    && payload.characterId === CFG.characterId, "Fault-control receipt scope/nonce mismatch");
  return { operation: rows[0].operation, requestId: rows[0].request_id, operationToken: rows[0].operation_token, payload, result: JSON.parse(rows[0].result_json) };
}
async function workerPost(body, extraHeaders = {}) {
  const response = await fetch(CFG.workerUrl, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...extraHeaders
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000)
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch (_) { payload = { raw: text.slice(0, 1000) }; }
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body: payload };
}
async function resolveBattle(started) {
  let state = started.state;
  let rev = started.stateRev;
  for (let index = 0; index < 500 && !state.result; index += 1) {
    const actor = state.units?.[state.queue?.[state.queueIndex]] || Object.values(state.units || {})
      .filter(unit => !unit.dead && Number(unit.hp) > 0)
      .sort((left, right) => Number(right.speed) - Number(left.speed) || left.tieOrder - right.tieOrder || left.id.localeCompare(right.id))[0];
    assert(actor, "Battle queue has no active actor");
    const enemy = Object.values(state.units || {}).find(unit => unit.side === "enemy" && !unit.dead && Number(unit.hp) > 0);
    const command = actor.kind === "hero"
      ? (state.heroTurnCount >= 5 ? { type: "skip_battle" } : { type: "basic", targetId: enemy?.id })
      : { type: "advance" };
    const result = await workerPost({
      action: "submitDungeonBattleAction",
      characterId: CFG.characterId,
      battleId: started.battleId,
      expectedRev: rev,
      actionKey: "p0-r04-" + started.battleId + "-" + rev,
      command
    });
    assert(result.status === 200 && result.body?.ok === true, "R04 battle action failed: " + JSON.stringify(result.body));
    state = result.body.state;
    rev = result.body.stateRev;
  }
  assert(state?.result === "victory", "R04 legal battle did not resolve to victory");
  return { state, stateRev: rev };
}
async function startBattle(floor) {
  const response = await workerPost({ action: "startDungeonBattle", characterId: CFG.characterId, floor });
  assert(response.status === 200 && response.body?.ok === true, "Unable to start R04 floor " + floor + ": " + JSON.stringify(response.body));
  assert(response.body.context?.floor === floor, "Unexpected R04 battle floor");
  return { battleId: response.body.battleId, state: response.body.state, stateRev: response.body.stateRev, context: response.body.context };
}
async function main() {
  assert(process.env.GITHUB_REF === "refs/heads/main", "Actual D1 QA may only run from main");
  assert(CFG.workerUrl && CFG.sourceSha, "Missing candidate Worker URL or source SHA");
  assert(CFG.dbId !== CFG.productionDbId, "Refusing Production D1");
  await verifyIsolation();
  await seedFreshFixture();
  await refreshFixtureSession();
  const preflight = await d1(
    "SELECT COUNT(*) AS n FROM battle_authority ba JOIN characters c ON c.character_id=ba.character_id " +
    "JOIN players p ON p.id=c.player_id LEFT JOIN battle_completions bc ON bc.battle_id=ba.battle_id " +
    "WHERE ba.battle_id=" + quote(CFG.battleId) + " AND ba.character_id=" + quote(CFG.characterId) +
    " AND c.player_id=" + quote(CFG.playerId) + " AND ba.outcome='victory' AND ba.settled_at='' " +
    "AND json_extract(ba.initial_state_json,'$.floor')=10 AND json_extract(ba.state_json,'$.serverContext.role')='chapter_boss' AND bc.battle_id IS NULL"
  );
  assert(preflight[0].results?.[0]?.n === 1, "Exact unsettled Chapter Boss fixture is not eligible");
  const existingReceipt = await d1("SELECT COUNT(*) AS n FROM character_operation_receipts WHERE character_id=" + quote(CFG.characterId) + " AND operation='p0_rollback_fault'");
  assert(existingReceipt[0].results?.[0]?.n === 0, "Fault injection already consumed; refusing a second R01");

  const before = await snapshot(CFG.battleId);
  assert(before.character && before.player && before.authority?.outcome === "victory"
    && before.authority.settled_at === "" && before.checkpoint?.state === "active"
    && before.completion === null, "Pre-R01 snapshot does not match expected unsettled state");
  evidence.beforeR01 = before;

  const nonce = "p0-rollback-" + process.env.GITHUB_RUN_ID + "-" + process.env.GITHUB_RUN_ATTEMPT;
  const faultResponse = await workerPost({
    action: "completeBattle",
    characterId: CFG.characterId,
    battleId: CFG.battleId,
    result: { result: "victory", reward: { gold: 999999, diamonds: 999999 } }
  }, {
    "X-P0-Rollback-Fault": "reward-settlement-batch",
    "X-P0-Rollback-Key": token,
    "X-P0-Rollback-Nonce": nonce
  });
  const injectedAfter = Number(faultResponse.headers["x-p0-rollback-injected-after"] || 0);
  assert(faultResponse.status === 500 && faultResponse.body?.error === "server_error", "R01 did not return the expected D1 batch failure: " + JSON.stringify(faultResponse));
  assert(faultResponse.headers["x-p0-rollback-injection"] === "executed"
    && faultResponse.headers["x-p0-rollback-matched-batches"] === "1" && injectedAfter >= 6,
    "R01 did not prove one injection inside the actual settlement batch");
  const afterFailure = await snapshot(CFG.battleId);
  assert(JSON.stringify(afterFailure) === JSON.stringify(before), "R01 atomic rollback failed: one or more reward/authority rows changed");
  const receipt = await receiptEvidence(nonce);
  evidence.cases.R01 = {
    status: "PASS",
    httpStatus: faultResponse.status,
    error: faultResponse.body.error,
    injection: faultResponse.headers["x-p0-rollback-injection"],
    matchedBatches: faultResponse.headers["x-p0-rollback-matched-batches"],
    injectedAfterStatements: injectedAfter,
    rewardStateUnchanged: true,
    controlReceipt: receipt
  };
  evidence.afterR01 = afterFailure;

  const recovery = await workerPost({
    action: "completeBattle",
    characterId: CFG.characterId,
    battleId: CFG.battleId,
    result: { result: "victory" }
  });
  assert(recovery.status === 200 && recovery.body?.ok === true && recovery.body.firstCompletion === true,
    "R02 recovery did not settle exactly once: " + JSON.stringify(recovery.body));
  const recovered = await snapshot(CFG.battleId);
  const reward = recovery.body.result?.reward;
  assert(reward?.rewardRole === "chapter_boss" && Number(reward.floor) === 10
    && Number(reward.gold) > 0 && Number(reward.xp) > 0, "R02 persisted reward is not the server-derived Chapter Boss reward");
  assert(recovered.authority?.outcome === "victory" && recovered.authority.settled_at
    && recovered.completion?.character_id === CFG.characterId && recovered.checkpoint?.state === "completed",
    "R02 completion/checkpoint/authority settlement state is incomplete");
  assert(Number(recovered.character.gold) === Number(reward.gold), "R02 Gold does not match persisted server reward");
  assert(Number(recovered.player.diamonds) === Number(before.player.diamonds), "R02 unexpectedly changed Diamonds");
  assert(recovered.items.length > before.items.length && recovered.provenance.length > before.provenance.length
    && recovered.ownership.length > before.ownership.length, "R02 did not persist Chapter Boss item/provenance/ownership records");
  evidence.cases.R02 = {
    status: "PASS",
    httpStatus: recovery.status,
    firstCompletion: recovery.body.firstCompletion,
    rewardRole: reward.rewardRole,
    floor: reward.floor,
    gold: reward.gold,
    xp: reward.xp,
    itemsAdded: recovered.items.length - before.items.length,
    provenanceAdded: recovered.provenance.length - before.provenance.length,
    ownershipEventsAdded: recovered.ownership.length - before.ownership.length,
    diamondsUnchanged: true,
    settledAt: recovered.authority.settled_at
  };
  evidence.afterR02 = recovered;

  const concurrent = await Promise.all(Array.from({ length: 4 }, () => workerPost({
    action: "completeBattle",
    characterId: CFG.characterId,
    battleId: CFG.battleId,
    result: { result: "victory" }
  })));
  assert(concurrent.every(r => r.status === 200 && r.body?.ok === true && r.body.firstCompletion === false),
    "R03 concurrent retries were not all idempotent replays: " + JSON.stringify(concurrent.map(r => ({ status: r.status, body: r.body }))));
  const afterConcurrent = await snapshot(CFG.battleId);
  assert(JSON.stringify(afterConcurrent) === JSON.stringify(recovered), "R03 concurrent replay changed settled reward or authority state");
  evidence.cases.R03 = {
    status: "PASS",
    concurrentRequests: concurrent.length,
    allReplayed: true,
    firstCompletionCount: concurrent.filter(r => r.body.firstCompletion === true).length,
    settledStateUnchanged: true
  };

  // The Chapter Boss settlement in R02 used the no-injection path. Now verify the same
  // Worker wrapper also delegates a legal Normal battle unchanged, with no fault headers.
  const normalStart = await startBattle(11);
  assert(normalStart.context.role === "normal", "R04 expected a legal Normal encounter on floor 11");
  await resolveBattle(normalStart);
  const normalCompletion = await workerPost({
    action: "completeBattle",
    characterId: CFG.characterId,
    battleId: normalStart.battleId,
    result: { result: "victory" }
  });
  assert(normalCompletion.status === 200 && normalCompletion.body?.ok === true
    && normalCompletion.body.firstCompletion === true
    && normalCompletion.body.result?.reward?.rewardRole === "normal"
    && Number(normalCompletion.body.result?.floor) === 11,
    "R04 Normal no-injection parity failed: " + JSON.stringify(normalCompletion.body));
  const normalSnapshot = await snapshot(normalStart.battleId);
  assert(normalSnapshot.authority?.settled_at && normalSnapshot.completion?.character_id === CFG.characterId
    && normalSnapshot.checkpoint?.state === "completed", "R04 Normal battle did not settle normally");
  const finalReceiptCount = await d1("SELECT COUNT(*) AS n FROM character_operation_receipts WHERE character_id=" + quote(CFG.characterId) + " AND operation='p0_rollback_fault'");
  assert(finalReceiptCount[0].results?.[0]?.n === 1, "R04 no-injection path unexpectedly created another fault-control receipt");
  evidence.cases.R04 = {
    status: "PASS",
    chapterBossNoInjection: true,
    chapterBossRewardRole: reward.rewardRole,
    normalBattleId: normalStart.battleId,
    normalFloor: 11,
    normalRewardRole: normalCompletion.body.result.reward.rewardRole,
    normalFirstCompletion: normalCompletion.body.firstCompletion,
    noAdditionalFaultReceipt: true
  };
  evidence.finalNormalBattle = normalSnapshot;
  evidence.finishedAt = new Date().toISOString();
  evidence.result = "PASS";
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/p0-candidate-actual-d1-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ result: evidence.result, cases: evidence.cases, artifact: "artifacts/p0-candidate-actual-d1-evidence.json" }, null, 2));
}

main().catch(error => {
  evidence.result = "BLOCKED";
  evidence.error = String(error?.stack || error);
  evidence.finishedAt = new Date().toISOString();
  fs.mkdirSync("artifacts", { recursive: true });
  fs.writeFileSync("artifacts/p0-candidate-actual-d1-evidence.json", JSON.stringify(evidence, null, 2) + "\n");
  console.error(error?.stack || error);
  process.exitCode = 1;
});
