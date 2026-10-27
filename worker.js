// ---------- ThornieDungeons Pages Worker ----------
// Serves static site assets and R2-hosted game art (/assets/*).
// Game actions/transactions are handled by the separate D1-backed API Worker.

const inFlightAssetReads = new Map();

function sanitizeAssetKey(pathname) {
  let key;
  try {
    key = decodeURIComponent(pathname.substring("/assets/".length));
  } catch (e) {
    return null;
  }
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) return null;
  return key;
}

async function readAssetObject(env, key) {
  if (inFlightAssetReads.has(key)) return inFlightAssetReads.get(key);
  const p = env.GAME_ASSETS.get(key).finally(() => inFlightAssetReads.delete(key));
  inFlightAssetReads.set(key, p);
  return p;
}

async function handleR2Admin(request, env, url) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405, headers: { Allow: "GET" } });
  }

  const configuredToken = env.R2_ADMIN_TOKEN;
  if (!configuredToken) return new Response("R2 admin endpoint is not configured", { status: 503 });

  const suppliedToken = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!suppliedToken || suppliedToken !== configuredToken) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }

  const prefix = url.searchParams.get("prefix") || "";
  if (prefix.includes("..") || prefix.startsWith("/") || prefix.includes("\\")) {
    return new Response("Invalid prefix", { status: 400 });
  }

  const limitRaw = Number(url.searchParams.get("limit") || "100");
  const limit = Number.isInteger(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 100;
  const cursor = url.searchParams.get("cursor") || undefined;

  try {
    const result = await env.GAME_ASSETS.list({ prefix, limit, cursor });
    return Response.json({
      bucket: "assets",
      prefix,
      objects: result.objects.map((object) => ({
        key: object.key,
        size: object.size,
        etag: object.etag,
        uploaded: object.uploaded
      })),
      truncated: result.truncated,
      cursor: result.truncated ? result.cursor : null
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return new Response("R2 listing failed", { status: 502 });
  }
}

// W2-C (ADMIN-V2.md 22.4): CSP + security headers for the Admin page only. Game pages are untouched.
// connect-src lists the one API origin admin-app.js talks to (SERVER_URL).
const ADMIN_API_ORIGIN = "https://thornie-dungeons-api.ekqtjl.workers.dev";
const ADMIN_PATHS = new Set(["/admin", "/admin/", "/admin.html"]);
const ADMIN_SCRIPT_PATH = "/admin-app.js";
const ADMIN_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  `connect-src 'self' ${ADMIN_API_ORIGIN}`,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join("; ");

function withAdminSecurityHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  if (pathname === ADMIN_SCRIPT_PATH) {
    headers.set("Cache-Control", "no-store");
  } else {
    headers.set("Content-Security-Policy", ADMIN_CSP);
    headers.set("Referrer-Policy", "no-referrer");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/__admin/r2/list") {
      return handleR2Admin(request, env, url);
    }

    if (url.pathname.startsWith("/assets/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }

      const key = sanitizeAssetKey(url.pathname);
      if (!key) return new Response("Invalid asset path", { status: 400 });

      let object;
      try {
        object = await readAssetObject(env, key);
      } catch (e) {
        return new Response(`R2 lookup failed: ${key}`, { status: 502 });
      }

      if (!object) return new Response(`R2 object not found: ${key}`, { status: 404 });

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      if (!headers.has("cache-control")) headers.set("cache-control", "public, max-age=86400");

      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    // Static Assets owns the normal site entrypoint. index.html is the only generated app entrypoint.
    if (ADMIN_PATHS.has(url.pathname) || url.pathname === ADMIN_SCRIPT_PATH) {
      return withAdminSecurityHeaders(await env.ASSETS.fetch(request), url.pathname);
    }
    return env.ASSETS.fetch(request);
  }
};
