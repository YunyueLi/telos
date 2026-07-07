// Telos Service Worker — 让静态 SPA 可安装、可离线。
// 策略：① 导航(HTML) network-first + cache reload —— 始终拿最新外壳，避免缓存旧 HTML 引用已失效的 chunk
//          （与 ChunkGuard 互补），离线时回退缓存的外壳；
//        ② JS/CSS chunk network-first —— Turbopack 文件名不总是足够稳定地表达内容变化；
//        ③ 其他同源静态资源 cache-first —— 图标/图片离线可用；
//        ④ 跨源请求（倒推 runtime / Supabase / LLM provider）一律不拦 —— 实时、不缓存。
const CACHE = "telos-v5";

function reloadRequest(req) {
  return new Request(req, { cache: "reload" });
}

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
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(reloadRequest(req));
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

  if (url.pathname.endsWith("/sw.js") || url.pathname.endsWith("/sw-v4.js") || url.pathname.endsWith("/sw-v5.js")) {
    event.respondWith(fetch(reloadRequest(req)));
    return;
  }

  if (url.pathname.includes("/_next/static/chunks/")) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(reloadRequest(req));
          if (res.ok && res.type === "basic") {
            const cache = await caches.open(CACHE);
            cache.put(req, res.clone());
          }
          return res;
        } catch {
          return (await caches.match(req)) || Response.error();
        }
      })(),
    );
    return;
  }

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
