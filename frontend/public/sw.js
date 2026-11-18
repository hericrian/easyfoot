// Service worker do EasyFoot: app shell offline.
// Navegação: rede primeiro (sempre pega a versão nova), cache como fallback.
// Assets do mesmo domínio: cache primeiro (arquivos do build têm hash no nome).
const CACHE = "easyfoot-v2";
// Saída do Vite: /assets/nome-HASH.js|css — conteúdo imutável, pode vir do cache.
const HASHED = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.(?:js|css)$/;
const SHELL = ["/", "/manifest.webmanifest", "/assets/easyfoot-logo.webp", "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && !res.redirected) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || Response.error())),
    );
    return;
  }

  const put = (res) => {
    if (res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };

  // Arquivos sem hash no nome (manifest, ícones, logo): rede primeiro, para que
  // ícone/nome novos cheguem; cache só quando estiver offline.
  if (!HASHED.test(url.pathname)) {
    event.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r || Response.error())));
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
