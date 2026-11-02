import approvedWorker from "../thornie-dungeons-api-entry.js";
import {
  P0_ROLLBACK_FAULT_MODE,
  claimFaultInjection,
  configuredFaultScope,
  constantTimeSecretEqual,
  createRewardSettlementFaultBinding,
} from "./p0-rollback-fault.js";

const MAX_REQUEST_BODY_BYTES = 512 * 1024;

function json(payload, status) {
  return Response.json(payload, { status });
}

function withFaultEvidence(response, state) {
  const headers = new Headers(response.headers);
  headers.set("X-P0-Rollback-Injection", "executed");
  headers.set("X-P0-Rollback-Matched-Batches", String(state.matchedBatches));
  headers.set("X-P0-Rollback-Injected-After", String(state.injectedAfterStatements));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env, ctx) {
    const requestedMode = request.headers.get("X-P0-Rollback-Fault");
    if (!requestedMode) return approvedWorker.fetch(request, env, ctx);
    if (requestedMode !== P0_ROLLBACK_FAULT_MODE) return json({ error: "qa_fault_mode_invalid" }, 400);
    if (request.method !== "POST") return json({ error: "qa_fault_request_invalid" }, 400);
    const declaredLength = Number(request.headers.get("Content-Length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BODY_BYTES) {
      return json({ error: "request_body_too_large" }, 413);
    }
    if (request.body && (await request.clone().arrayBuffer()).byteLength > MAX_REQUEST_BODY_BYTES) {
      return json({ error: "request_body_too_large" }, 413);
    }

    let body;
    try {
      body = await request.clone().json();
    } catch (_) {
      return json({ error: "invalid_json" }, 400);
    }
    if (body?.action !== "completeBattle" || body?.result?.result !== "victory") {
      return json({ error: "qa_fault_request_invalid" }, 400);
    }

    const authorized = await constantTimeSecretEqual(
      request.headers.get("X-P0-Rollback-Key"),
      env?.P0_ROLLBACK_TEST_KEY
    );
    if (!authorized) return json({ error: "qa_fault_unauthorized" }, 401);

    const nonce = request.headers.get("X-P0-Rollback-Nonce");
    const scope = configuredFaultScope(env, body, nonce);
    if (!scope) return json({ error: "qa_fault_scope_mismatch" }, 403);

    const claimed = await claimFaultInjection(env.DB, scope);
    if (!claimed) return json({ error: "qa_fault_already_used_or_ineligible" }, 409);

    const { binding, state } = createRewardSettlementFaultBinding(env.DB, scope);
    const response = await approvedWorker.fetch(request, { ...env, DB: binding }, ctx);
    if (state.injections !== 1 || state.matchedBatches !== 1) {
      return json({ error: "qa_fault_settlement_boundary_not_reached" }, 500);
    }
    if (response.status < 500) {
      return json({ error: "qa_fault_did_not_abort_settlement" }, 500);
    }
    return withFaultEvidence(response, state);
  },
};
