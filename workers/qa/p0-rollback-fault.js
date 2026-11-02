const STATEMENT_META = Symbol("p0RollbackStatementMeta");

export const P0_ROLLBACK_FAULT_MODE = "reward-settlement-batch";
export const P0_ROLLBACK_OPERATION = "p0_rollback_fault";

function wrapStatement(statement, sql, values = []) {
  const meta = { statement, sql: String(sql || ""), values };
  return new Proxy(statement, {
    get(target, property, receiver) {
      if (property === STATEMENT_META) return meta;
      if (property === "bind") {
        return (...nextValues) => wrapStatement(target.bind(...nextValues), sql, nextValues);
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
function statementMeta(statement) {
  return statement?.[STATEMENT_META] || null;
}

function normalizedSql(statement) {
  return String(statementMeta(statement)?.sql || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function settlementBoundary(statements) {
  const sql = statements.map(normalizedSql);
  const completionIndex = sql.findIndex(value => value.includes("insert into battle_completions") && value.includes("on conflict(battle_id) do nothing"));
  const characterIndex = sql.findIndex(value => value.includes("update characters set gold = gold +"));
  const playerIndex = sql.findIndex(value => value.includes("update players set diamonds = diamonds + 0"));
  const completionReadIndex = sql.findIndex(value => value.includes("select character_id, result_json, completed_at from battle_completions"));
  const checkpointIndex = sql.findIndex(value => value.includes("update battle_checkpoints set state = 'completed'"));
  const settledIndex = sql.findIndex(value => value.includes("update battle_authority set settled_at ="));
  const itemIndex = sql.findIndex(value => value.includes("insert into items"));
  const provenanceIndex = sql.findIndex(value => value.includes("insert or ignore into item_provenance"));
  const ownershipIndex = sql.findIndex(value => value.includes("insert or ignore into item_ownership_events"));
  const exactOrder = completionIndex === 0
    && characterIndex === 1
    && playerIndex === 2
    && completionReadIndex > playerIndex
    && checkpointIndex === completionReadIndex + 1
    && settledIndex === completionReadIndex + 2;
  const itemCoverage = itemIndex > playerIndex && itemIndex < completionReadIndex
    && provenanceIndex > itemIndex && provenanceIndex < completionReadIndex
    && ownershipIndex > provenanceIndex && ownershipIndex < completionReadIndex;
  return exactOrder && itemCoverage ? { completionReadIndex, statementCount: statements.length } : null;
}

export function createRewardSettlementFaultBinding(db, scope) {
  const state = {
    matchedBatches: 0,
    injections: 0,
    injectedAfterStatements: 0,
    originalStatementCount: 0,
  };
  const binding = new Proxy(db, {
    get(target, property, receiver) {
      if (property === "prepare") {
        return sql => wrapStatement(target.prepare(sql), sql);
      }
      if (property === "batch") {
        return async statements => {
          const list = Array.isArray(statements) ? statements : [];
          const boundary = settlementBoundary(list);
          const unwrapped = list.map(statement => statementMeta(statement)?.statement || statement);
          if (!boundary) return target.batch(unwrapped);

          state.matchedBatches += 1;
          state.injections += 1;
          state.injectedAfterStatements = boundary.completionReadIndex;
          state.originalStatementCount = boundary.statementCount;
          const faultStatement = target.prepare(
            `INSERT INTO battle_completions (battle_id, character_id, result_json, completed_at)
             VALUES (?, NULL, ?, ?)`
          ).bind(
            `qa-fault:${scope.battleId}:${scope.nonce}`,
            JSON.stringify({ qaFault: P0_ROLLBACK_FAULT_MODE, battleId: scope.battleId, nonce: scope.nonce }),
            new Date().toISOString()
          );
          return target.batch([
            ...unwrapped.slice(0, boundary.completionReadIndex),
            faultStatement,
            ...unwrapped.slice(boundary.completionReadIndex),
          ]);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { binding, state };
}

export async function constantTimeSecretEqual(provided, expected) {
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(provided || ""))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(expected || ""))),
  ]);
  const left = new Uint8Array(providedHash);
  const right = new Uint8Array(expectedHash);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0 && String(expected || "").length > 0;
}

export function configuredFaultScope(env, body, nonce) {
  const configured = {
    playerId: String(env?.P0_ROLLBACK_PLAYER_ID || ""),
    characterId: String(env?.P0_ROLLBACK_CHARACTER_ID || ""),
    battleId: String(env?.P0_ROLLBACK_BATTLE_ID || ""),
  };
  if (!configured.playerId || !configured.characterId || !configured.battleId) return null;
  if (String(body?.characterId || "") !== configured.characterId) return null;
  if (String(body?.battleId || "") !== configured.battleId) return null;
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(String(nonce || ""))) return null;
  return { ...configured, nonce: String(nonce) };
}

export async function claimFaultInjection(db, scope, now = new Date().toISOString()) {
  const operationToken = `p0-rollback:${scope.battleId}`;
  const payload = JSON.stringify({
    mode: P0_ROLLBACK_FAULT_MODE,
    playerId: scope.playerId,
    characterId: scope.characterId,
    battleId: scope.battleId,
    nonce: scope.nonce,
  });
  const result = await db.prepare(
    `INSERT OR IGNORE INTO character_operation_receipts
       (character_id, operation, request_id, operation_token, payload_json, result_json, created_at)
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1
       FROM battle_authority ba
       JOIN characters c ON c.character_id = ba.character_id
       WHERE ba.battle_id = ? AND ba.character_id = ? AND c.player_id = ?
         AND ba.outcome = 'victory' AND ba.settled_at = ''
     )`
  ).bind(
    scope.characterId,
    P0_ROLLBACK_OPERATION,
    scope.battleId,
    operationToken,
    payload,
    JSON.stringify({ status: "armed" }),
    now,
    scope.battleId,
    scope.characterId,
    scope.playerId
  ).run();
  return Number(result?.meta?.changes) === 1;
}
