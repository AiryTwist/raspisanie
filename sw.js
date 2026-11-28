// Push-уведомления OneSignal
try { importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"); } catch (e) {}

// Офлайн-режим: сайт и последнее загруженное расписание открываются без интернета.
const V = "raspisanie-v244";
const TILES = "map-tiles-v2";
const DCACHE = "raspisanie-data";   // расписание и прочие .json — отдельно, не стирается при обновлении версии
const DATA = ["data.json", "overrides.json", "changes.json", "campus.json", "shared.json", "status.json"];
const SHELL = ["./", "index.html", "style.css?v=244", "app.js?v=244", "cards.js?v=12", "manifest-zh.json", "manifest-ru.json", "icon.svg", "herzen.png", "hats/santa.png", "art/carnation.png", "art/star.svg", "art/bell.svg", "art/bouquet.svg", "art/bouquet-sep.svg", "art/bouquet-teach.svg", "icon-192.png", "icon-512.png", "icon-180.png", "icon-ru-192.png", "icon-ru-512.png", "icon-ru-180.png", "fonts/inter-cyr.woff2", "fonts/inter-lat.woff2"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(async c => {
    await c.addAll(SHELL);
    // сразу сохраняем расписание, чтобы оно было доступно без интернета с первого визита
    await Promise.all(DATA.map(f => fetch(f, {cache: "no-store"}).then(r => r.ok && caches.open(DCACHE).then(d => d.put(new URL(f, self.registration.scope).toString(), r))).catch(() => {})));
  }).then(() => self.skipWaiting()));
});
const ART = ["art/apple.png","art/bouquet.svg","art/bouquet-sep.svg","art/bouquet-teach.svg","art/bell.svg","art/cap.png","art/carnation.png","art/heart.png","art/moon.png","art/star.svg","art/tulip.png",
  "hats/santa.png","fool/cat1.jpg","fool/cat2.jpg","fool/redpanda.jpg","fool/shiba.jpg","fool/corgi.jpg","fool/fox.jpg","fool/panda.jpg","fool/golden.jpg","fool/hamster.jpg","fool/bernese.jpg"];
self.addEventListener("activate", e => {
  caches.open(DCACHE).then(c => Promise.all(ART.map(f => { const u = new URL(f, self.registration.scope).toString(); return c.match(u).then(h => h || fetch(u).then(r => r.ok && c.put(u, r))).catch(() => {}); })));
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== TILES && k !== DCACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// ключ кэша без ?v=… — чтобы офлайн находилась последняя версия файла
const keyOf = req => { const u = new URL(req.url); u.search = ""; return u.toString(); };

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  // кусочки карты: из кэша, чтобы уже открытая карта работала без интернета
  if (new URL(req.url).hostname === "tiles.openfreemap.org") {
    e.respondWith(caches.open(TILES).then(c => c.match(req).then(hit => { const net = fetch(req).then(r => { if (r.ok) { c.put(req, r.clone()); c.keys().then(ks => { if (ks.length > 600) ks.slice(0, ks.length - 500).forEach(k => c.delete(k)); }); } return r; }); return hit || net; })));
    return;
  }
  if (new URL(req.url).origin !== location.origin) return;
  const url = new URL(req.url);
  if (url.searchParams.has("u")) return;   // проверка обновлений — только из сети, в кэш не кладём
  if (/\/check\.bin$/.test(url.pathname)) return;   // проверка кода доступа — только из сети
  if (req.mode === "navigate") {
    const isShell = /\/(index\.html)?$/.test(url.pathname);
    e.respondWith(fetch(req.url, {cache: "no-cache"}).then(r => {
      if (r.ok && isShell && (r.headers.get("content-type") || "").includes("text/html")) { const copy = r.clone(); caches.open(V).then(c => c.put("./", copy)); }   // в кэш — только сама страница приложения
      return r; })
      .catch(() => caches.match("./")));
    return;
  }
  // Словарь (gym/data.json ~6 МБ и рисунки глав gym/fig-*.json): сразу из памяти телефона, а свежую копию тянем в фоне —
  // раньше при каждом открытии ждали сеть и заново качали мегабайты. Обновлённый словарь появится со следующего открытия
  if (/\/gym\/[^/]+\.json$/.test(url.pathname)) {
    e.respondWith(caches.open(DCACHE).then(c => c.match(keyOf(req)).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) c.put(keyOf(req), r.clone()); return r; });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net.catch(() => new Response("", {status: 503}));
    })));
    return;
  }
  if (/\.(json|ics)$/.test(url.pathname)) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(DCACHE).then(c => c.put(keyOf(req), copy)); }
      return r;
    }).catch(() => caches.open(DCACHE).then(c => c.match(keyOf(req))).then(r => r || caches.match(keyOf(req))).then(r => r || new Response("", {status: 503}))));
    return;
  }
  // картинки праздников, фото преподавателей и зверей — в постоянном кэше (не стирается при обновлении версии)
  if (/\/tphoto\//.test(url.pathname)) {   // фото преподавателей (зашифрованы): сначала из сети, копия — без интернета
    e.respondWith(fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(DCACHE).then(c => c.put(keyOf(req), copy)); } return r; })
      .catch(() => caches.open(DCACHE).then(c => c.match(keyOf(req))).then(r => r || new Response("", {status: 503}))));
    return;
  }
  if (/\/(art|hats|fool|gym-audio|cards-audio|tts\/a)\//.test(url.pathname)) {   // записи карточек — тоже в постоянном кэше
    e.respondWith(caches.open(DCACHE).then(c => c.match(keyOf(req)).then(hit => {
      const net = fetch(req).then(r => { if (r.ok) c.put(keyOf(req), r.clone()); return r; }).catch(() => hit);
      return hit || net; })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok) { const copy = r.clone(); caches.open(V).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
