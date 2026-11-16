/* DEXXUS WEB Shield (Handy) – Offline-Speicher: App-Dateien bleiben auf dem Handy, damit sie schnell und ohne Netz startet. */
const STAND = "as-app-6";
const DATEIEN = ["./", "index.html", "app.css", "app.js", "daten.js", "redact.js", "lizenz.js", "dokumente_basis.js", "dokumente.js", "orte_ch.txt", "manifest.webmanifest", "icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(STAND).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== STAND).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // erst Netz (neueste Version), sonst Speicher; Bibliotheken (lib/) einmal laden und behalten
  if (e.request.url.includes("/lib/")) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(n => { const k = n.clone(); caches.open(STAND).then(c => c.put(e.request, k)); return n; })));
    return;
  }
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then(n => { const k = n.clone(); caches.open(STAND).then(c => c.put(e.request, k)); return n; }).catch(() => caches.match(e.request)));
});
