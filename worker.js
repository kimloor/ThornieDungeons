// ---------- ThornieDungeons Pages Worker ----------
// IMPORTANT SCOPE NOTE (network/race-condition audit):
// This worker only serves static site assets and R2-hosted game art (`/assets/*`). It has
// no knowledge of game actions/transactions — login, saveProgress, syncItems, Salvage,
// Enhance, etc. are all handled by a *separate* Cloudflare Worker (the D1-backed API at
// DEFAULT_SERVER_URL in save.js, e.g. thornie-dungeons-api.ekqtjl.workers.dev), whose source
// isn't part of this repo. Real atomic/idempotent transaction handling for those actions
// (e.g. "reject a duplicate Enhance if the same idempotency key was already processed") has
// to be added over there, not here — this file has nothing to make atomic.
// What IS hardened below, within this file's actual job of serving assets:
//   1. Only GET/HEAD are accepted for asset requests (anything else is rejected fast).
//   2. The R2 key is sanitized against path traversal (`..`, encoded slashes) before being
//      used to look up an object — previously it was passed straight from the URL to
//      env.GAME_ASSETS.get() unchecked.
//   3. Concurrent duplicate GETs for the *same* R2 key (e.g. several UI elements requesting
//      the same sprite layer at once) are coalesced into a single R2 read per isolate instead
//      of hitting R2 once per request.
const inFlightAssetReads = new Map();

function sanitizeAssetKey(pathname) {
  let key;
  try {
    key = decodeURIComponent(pathname.substring("/assets/".length));
  } catch (e) {
    return null; // malformed percent-encoding
  }
  // Reject traversal / absolute-escape attempts and empty keys.
  if (!key || key.includes("..") || key.startsWith("/") || key.includes("\\")) return null;
  return key;
}

async function readAssetObject(env, key) {
  if (inFlightAssetReads.has(key)) return inFlightAssetReads.get(key);
  const p = env.GAME_ASSETS.get(key).finally(() => inFlightAssetReads.delete(key));
  inFlightAssetReads.set(key, p);
  return p;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/assets/")) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method not allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD" }
        });
      }

      const key = sanitizeAssetKey(url.pathname);
      if (!key) {
        return new Response("Invalid asset path", { status: 400 });
      }

      let object;
      try {
        object = await readAssetObject(env, key);
      } catch (e) {
        return new Response(`R2 lookup failed: ${key}`, { status: 502 });
      }

      if (!object) {
        return new Response(`R2 object not found: ${key}`, {
          status: 404
        });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      // Sprite/manifest assets are content-addressed by path and don't change in place —
      // safe to let browsers/CDN cache them aggressively.
      if (!headers.has("cache-control")) {
        headers.set("cache-control", "public, max-age=86400");
      }

      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    return env.ASSETS.fetch(request);
  }
};
