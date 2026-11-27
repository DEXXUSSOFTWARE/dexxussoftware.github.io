/* App Shield – Plattform-Teil fürs Mobile (25.11.2026, Layout D).
   Die Oberfläche steht in shield_ui.js (gleich wie WEB Shield). Hier nur: Speicher im Mobile-Browser (localStorage),
   Symbol auf dem Startbildschirm, Vorführung auf der Verkaufsseite und Werbebilder (?ansicht=1..4).
   Alles lokal im Mobile, nichts wird hochgeladen. */
"use strict";
(function () {
const $ = id => document.getElementById(id);
const U = () => window.ShieldUI;
const T = (k, ...a) => U() ? U().T(k, ...a) : k;
const q = new URLSearchParams(location.search);
const ANSICHT = +q.get("ansicht") || 0;

const speicher = {
  get: async (k, std) => { try { const v = localStorage.getItem("ws_" + k); return v === null ? std : JSON.parse(v); } catch (e) { return std; } },
  set: async (k, v) => { try { localStorage.setItem("ws_" + k, JSON.stringify(v)); } catch (e) { /* privater Modus */ } }
};

/* ---------- Symbol auf dem Startbildschirm ---------- */
const istApp = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
const istIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const istAndroid = () => /Android/i.test(navigator.userAgent);
const imMailBrowser = () => istAndroid() && /; wv\)/.test(navigator.userAgent);
let INSTALL = null, INSTALL_TEXT = "";
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); INSTALL = e; if (U()) U().zeigen(); });
window.addEventListener("appinstalled", () => { INSTALL = null; try { sessionStorage.setItem("install_spaeter", "1"); } catch (e) { /* egal */ } if (U()) { U().zeigen(); U().meldung(T("installiert"), 5000); } });
function chromeLink() {          // Mail-App öffnet oft den eingebauten Browser: in Chrome öffnen, Lizenz im Link mitgeben
  let qs = "app=1&c=1";
  try {
    const l = JSON.parse(localStorage.getItem("ws_lizenz") || "{}");
    if (l.lizenz && l.lizenz.text) qs += "&lizenz=" + btoa(String.fromCharCode(...new TextEncoder().encode(l.lizenz.text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) { /* ohne Lizenz */ }
  return "intent://" + location.host + location.pathname + "?" + qs + "#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=" + encodeURIComponent(location.origin + location.pathname + "?" + qs) + ";end";
}
function installInfo() {
  if (istApp() || ANSICHT || VORFUEHRUNG || !U() || !U().freigeschaltet() || U().S.demo) return null;
  try { if (sessionStorage.getItem("install_spaeter")) return null; } catch (e) { /* egal */ }
  if (INSTALL_TEXT) return { text: INSTALL_TEXT, knopf: false };
  if (INSTALL || (istAndroid() && !imMailBrowser())) return { text: T("installEins"), knopf: true };
  if (istAndroid()) return { text: T("installChromeOeffnen"), knopf: true };
  if (istIOS()) return { text: T("installIOS"), knopf: false };
  return { text: T("installAndere"), knopf: false };
}
async function install() {
  if (imMailBrowser() && !INSTALL) { location.href = chromeLink(); return; }
  // Chrome gibt die Installation erst nach dem ersten Tippen frei -> dieser Tipp zählt, kurz warten
  for (let i = 0; !INSTALL && i < 30; i++) await new Promise(r => setTimeout(r, 100));
  if (!INSTALL) {
    const ua = navigator.userAgent;
    INSTALL_TEXT = /EdgA/.test(ua) ? T("installEdge") : /SamsungBrowser/.test(ua) ? T("installSamsung") : T("installChrome");
    U().zeigen(); return;
  }
  const e = INSTALL; INSTALL = null;
  try { e.prompt(); await e.userChoice; } catch (x) { /* abgelehnt */ }
  U().zeigen();
}

/* ---------- Vorführung auf der Verkaufsseite (PC, ohne Lizenz): wechselt alle 3.5 s, Antippen = selbst ausprobieren ---------- */
let VORFUEHRUNG = false;
function vorfuehrungStarten() {
  VORFUEHRUNG = true;
  const h = document.querySelector(".handy"); if (!h) return;
  const s = document.createElement("div"); s.className = "vf-schild"; s.textContent = "Vorführung · antippen und selbst ausprobieren"; h.appendChild(s);
  let n = 1; U().vorfuehren(1);
  const t = setInterval(() => { n = n % 4 + 1; U().vorfuehren(n); }, 3500);
  h.addEventListener("click", ev => { ev.stopPropagation(); ev.preventDefault(); clearInterval(t); location.href = location.pathname + "?selbst=1#app"; }, { once: true, capture: true });
}

window.ShieldPlatt = {
  app: true,
  keys: { einst: "einstellungen", ueb: "uebersicht", liz: "lizenz", sitzung: "sitzung", offen: "offen" },
  speicher,
  ohnePruefung: !!ANSICHT,
  sprache: () => navigator.language || (navigator.languages && navigator.languages[0]) || "en",
  oeffne: url => { const w = window.open(url, "_blank", "noopener"); if (!w) location.href = url; },
  herunterladen(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  },
  installInfo, install,
  installSpaeter() { try { sessionStorage.setItem("install_spaeter", "1"); } catch (e) { /* egal */ } },
  nachStart() {
    try { if (/[?&]c=1/.test(location.search)) sessionStorage.setItem("aus_chrome_knopf", "1"); } catch (e) { /* egal */ }
    if (ANSICHT) { U().vorfuehren(ANSICHT); return; }
    // Verkaufsseite am PC ohne Lizenz -> Vorführung läuft von selbst
    if (!U().freigeschaltet() && matchMedia("(min-width: 900px)").matches && !q.get("selbst")) { vorfuehrungStarten(); return; }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
    setTimeout(() => { try { ShieldDokumente.vorwaermen().catch(() => {}); } catch (e) { /* später */ } }, 2500);
  }
};
})();
