// ---------- W6 Shared Phaser Texture Registry ----------
function phaserTextureKeyForUrl(url) {
  return `thornie-${String(url || "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(-150)}`;
}

function createPhaserTextureRegistry({ resolver = SHARED_PHASER_ASSET_RESOLVER } = {}) {
  const keyToUrl = new Map();
  const urlToKey = new Map();

  function keyFor(reference) {
    const url = resolver.resolve(reference);
    if (!url) return "";
    if (urlToKey.has(url)) return urlToKey.get(url);
    const key = phaserTextureKeyForUrl(url);
    urlToKey.set(url, key);
    keyToUrl.set(key, url);
    return key;
  }

  function urlFor(key) {
    return keyToUrl.get(String(key || "")) || "";
  }

  function forget(key) {
    const normalizedKey = String(key || "");
    const url = keyToUrl.get(normalizedKey);
    if (url) urlToKey.delete(url);
    keyToUrl.delete(normalizedKey);
  }

  function queue(scene, references) {
    if (!scene?.load || !scene?.textures) return [];
    return resolver.resolveAll(references).map(url => {
      const key = keyFor(url);
      const exists = key && scene.textures.exists(key);
      if (key && !exists) scene.load.image(key, url);
      return { key, url, queued: !!(key && !exists) };
    }).filter(entry => entry.key);
  }

  return Object.freeze({
    keyFor,
    urlFor,
    forget,
    queue,
    entries() { return [...keyToUrl.entries()]; }
  });
}
