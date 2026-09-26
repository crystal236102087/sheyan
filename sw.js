/* ============================================================
   奢眼 Service Worker
   策略：网络优先（Network-First）—— 只要在线，永远加载最新版本；
   离线时回退到缓存。因此 GitHub 上更新文件后，所有已安装的
   App 在下次打开时自动拿到新版本，无需重新安装。
   ============================================================ */
const CACHE = "sheyan-cache-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
