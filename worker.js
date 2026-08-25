export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/test-asset/")) {
      const key = decodeURIComponent(
        url.pathname.substring("/test-asset/".length)
      );

      const object = await env.GAME_ASSETS.get(key);

      if (!object) {
        return new Response(`R2 object not found: ${key}`, {
          status: 404
        });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);

      return new Response(object.body, { headers });
    }

    return env.ASSETS.fetch(request);
  }
};
