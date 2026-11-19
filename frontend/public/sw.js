// Service worker do EasyFoot: app shell offline.
// Navegação: rede primeiro (sempre pega a versão nova), cache como fallback.
// Assets do mesmo domínio: cache primeiro (arquivos do build têm hash no nome).
const CACHE = "easyfoot-v4";
// Saída do Vite: /assets/nome-HASH.js|css — conteúdo imutável, pode vir do cache.
const HASHED = /^\/assets\/.+-[A-Za-z0-9_-]{8}\.(?:js|css)$/;
const SHELL = ["/", "/manifest.webmanifest", "/assets/easyfoot-logo.svg", "/assets/easyfoot-logo-inline.svg", "/icons/icon-192.png"];

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
  // API e login (proxy do Firebase) sempre direto na rede, nunca em cache
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/__/")) return;

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

// ---------- Notificações push (funcionam com o app fechado) ----------
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "EasyFoot", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "EasyFoot";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-64.png",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    vibrate: [250, 120, 250, 120, 250],
    data: { url: data.url || "/" },
  };
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // App aberto e visível já tocou o som: mostra em silêncio. (Sempre mostrar é exigido
      // pelo Safari/iOS — push sem notificação visível faz o sistema cancelar a inscrição.)
      const visible = wins.some((w) => w.visibilityState === "visible");
      return self.registration.showNotification(title, visible ? { ...options, silent: true, vibrate: undefined } : options);
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) return win.focus().then((w) => w && w.navigate(target));
      return self.clients.openWindow(target);
    }),
  );
});
