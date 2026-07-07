// Telos Service Worker — 让静态 SPA 可安装、可离线。
// 策略：① 导航(HTML) network-first —— 始终拿最新外壳，避免缓存旧 HTML 引用已失效的 chunk
//          （与 ChunkGuard 互补），离线时回退缓存的外壳；
//        ② 同源静态资源(_next 的 hash 文件、图标等) cache-first —— hash 文件名天然安全长缓存，离线可用；
//        ③ 跨源请求（倒推 runtime / Supabase / LLM provider）一律不拦 —— 实时、不缓存。
const CACHE = "telos-v2";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 跨源（API/provider）不拦，保持实时

  // 导航：network-first（拿最新外壳），失败回退缓存外壳
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
          return res;
        } catch {
          return (await caches.match(req)) || (await caches.match("./")) || Response.error();
        }
      })(),
    );
    return;
  }

  // 同源静态资源：cache-first（命中即返回，未命中走网络并缓存）
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") {
          const cache = await caches.open(CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })(),
  );
});
