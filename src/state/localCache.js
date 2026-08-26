// window.storage only exists inside the Claude.ai artifact preview; the real deployed site
// (Cloudflare Pages) needs a real localStorage fallback or caching silently no-ops there.
async function kvGet(key) {
  try {
    if (window.storage && window.storage.get) {
      const r = await window.storage.get(key);
      return r && r.value ? r.value : null;
    }
  } catch (e) {}
  try {
    return window.localStorage ? window.localStorage.getItem(key) : null;
  } catch (e) {}
  return null;
}
async function kvSet(key, value) {
  try {
    if (window.storage && window.storage.set) {
      await window.storage.set(key, value);
      return;
    }
  } catch (e) {}
  try {
    if (window.localStorage) window.localStorage.setItem(key, value);
  } catch (e) {}
}
