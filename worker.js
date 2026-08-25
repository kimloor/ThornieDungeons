export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ทดสอบดึงไฟล์จาก R2
    if (url.pathname.startsWith("/test-asset/")) {
      const key = decodeURIComponent(
        url.pathname.substring("/test-asset/".length)
      );

      if (!key) {
        return new Response("Missing R2 object key", {
          status: 400
        });
      }

      const object = await env.GAME_ASSETS.get(key);

      if (!object) {
        return new Response(
          `R2 object not found: ${key}`,
          { status: 404 }
        );
      }

      const headers = new Headers();

      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);

      return new Response(object.body, {
        headers
      });
    }

    // ทุกอย่างที่ไม่ใช่ /test-asset/
    // ให้ Static Assets จัดการตามปกติ
    return env.ASSETS.fetch(request);
  }
};
