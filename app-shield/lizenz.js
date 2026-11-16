/* DEXXUS WEB Shield – Lizenz und Gratis-Grenzen.
   Lizenzen sind normale DEXXUS-Lizenzen (Lizenzverwaltung, Payrexx), unterschrieben mit dem avotec-Schlüssel (Ed25519).
   Geprüft wird lokal mit dem öffentlichen Schlüssel – keine Verbindung ins Internet nötig. */
"use strict";
(function (glob) {
  const PUB_SPKI_B64 = "MCowBQYDK2VwAyEApnivIZYUdI+Ho4qndR7o4BbgkzqEaLdn9AO7o58fZQk=";   // dexxus_lizenz_pub.pem (öffentlich)
  const GRATIS_PRO_TAG = 3, GRATIS_TAGE = 30;
  const KAUF_URL = "https://www.dexxus.ch/web-shield.html?kauf=1";   // eigene WEB-Shield-Seite mit Payrexx-Kauf
  const WERBUNG = [
    "Jetzt kaufen und profitieren – unbegrenzt ab CHF 9.90/Mt",
    "Ihre KI. Ihre Regeln. – jetzt Abo sichern",
    "3 Jahre = 20 % sparen – jetzt profitieren",
    "Jeder Prompt ohne Shield ist ein offenes Fenster – jetzt schliessen",
    "Jetzt kaufen – oder sollen Ihre Daten im Web erscheinen?"
  ];
  const ABOS = [
    { jahre: 1, chf: "118.80", text: "1 Jahr", hinweis: "CHF 9.90/Monat" },
    { jahre: 2, chf: "213.85", text: "2 Jahre", hinweis: "−10 %" },                // = DEXXUS-Rechnung (auf 5 Rp. gerundet)
    { jahre: 3, chf: "285.10", text: "3 Jahre", hinweis: "−20 %" }
  ];

  /* JSON so lesen, dass Zahlen genau so bleiben, wie Python sie geschrieben hat (z. B. 49.0) */
  function parseRoh(s) {
    let i = 0;
    const ws = () => { while (/\s/.test(s[i])) i++; };
    function wert() {
      ws();
      const c = s[i];
      if (c === "{") { i++; const o = {}; ws(); if (s[i] === "}") { i++; return { t: "o", v: o }; }
        for (;;) { ws(); const k = str(); ws(); i++; /* : */ o[k] = wert(); ws(); if (s[i] === ",") { i++; continue; } i++; return { t: "o", v: o }; } }
      if (c === "[") { i++; const a = []; ws(); if (s[i] === "]") { i++; return { t: "a", v: a }; }
        for (;;) { a.push(wert()); ws(); if (s[i] === ",") { i++; continue; } i++; return { t: "a", v: a }; } }
      if (c === '"') return { t: "s", v: str() };
      const m = /^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(s.slice(i));
      if (!m) throw new Error("Lizenz-Text ist beschädigt.");
      i += m[0].length; return { t: "r", v: m[0] };
    }
    function str() {
      const start = i; i++;
      while (s[i] !== '"') { if (s[i] === "\\") i++; i++; if (i > s.length) throw new Error("Lizenz-Text ist beschädigt."); }
      i++; return JSON.parse(s.slice(start, i));
    }
    return wert();
  }
  // wie Python json.dumps(sort_keys=True, ensure_ascii=False, separators=(",", ":"))
  function kanonisch(n) {
    if (n.t === "s") return JSON.stringify(n.v);
    if (n.t === "r") return n.v;
    if (n.t === "a") return "[" + n.v.map(kanonisch).join(",") + "]";
    return "{" + Object.keys(n.v).sort().map(k => JSON.stringify(k) + ":" + kanonisch(n.v[k])).join(",") + "}";
  }
  function normal(n) {
    if (n.t === "s") return n.v;
    if (n.t === "r") return JSON.parse(n.v);
    if (n.t === "a") return n.v.map(normal);
    const o = {}; for (const k of Object.keys(n.v)) o[k] = normal(n.v[k]); return o;
  }
  const b64 = s => Uint8Array.from(atob(s.replace(/\s+/g, "")), c => c.charCodeAt(0));

  /* text = Inhalt der Lizenzdatei (.dxlic) -> {ok, daten, fehler} */
  async function pruefen(text, pubTest) {               // pubTest nur für den Selbsttest
    try {
      const wurzel = parseRoh(String(text || "").trim());
      if (wurzel.t !== "o" || !wurzel.v.daten || !wurzel.v.signatur) return { ok: false, fehler: "Das ist keine DEXXUS-Lizenz." };
      const bytes = new TextEncoder().encode(kanonisch(wurzel.v.daten));
      const sig = b64(normal(wurzel.v.signatur));
      const key = await crypto.subtle.importKey("spki", b64(pubTest || PUB_SPKI_B64), { name: "Ed25519" }, false, ["verify"]);
      const echt = await crypto.subtle.verify({ name: "Ed25519" }, key, sig, bytes);
      if (!echt) return { ok: false, fehler: "Unterschrift ungültig – die Lizenz ist nicht von avotec oder wurde verändert." };
      const daten = normal(wurzel.v.daten);
      const passt = /web\s*shield/i.test(daten.paket || "") || (daten.module || []).includes("web_shield");
      if (!passt) return { ok: false, fehler: "Diese Lizenz gilt nicht für DEXXUS WEB Shield (Paket: " + (daten.paket || "?") + ")." };
      if (!daten.unbefristet && daten.bis && daten.bis < heute()) return { ok: false, daten, fehler: "Die Lizenz ist am " + datumCH(daten.bis) + " abgelaufen." };
      return { ok: true, daten };
    } catch (e) {
      return { ok: false, fehler: e && e.name === "NotSupportedError" ? "Dieser Browser ist zu alt für die Lizenzprüfung. Bitte Edge/Chrome aktualisieren." : (e.message || "Lizenz konnte nicht geprüft werden.") };
    }
  }

  const heute = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const datumCH = iso => iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4) : "";
  const tageZwischen = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400000);

  /* Status aus gespeicherten Werten: {start, zaehler:{tag,anzahl}, lizenz:{daten}} */
  function status(sp) {
    const t = heute();
    if (sp.lizenz && sp.lizenz.daten) {
      const d = sp.lizenz.daten;
      if (d.unbefristet || !d.bis || d.bis >= t) return { art: "abo", frei: Infinity, bis: d.bis, text: (/test/i.test(d.paket || "") ? "Gratis-Test" : "Abo aktiv") + (d.bis && !d.unbefristet ? " bis " + datumCH(d.bis) : "") };
    }
    // Entscheid Markus 16.11.: 30 Tage gratis OHNE Grenze; danach still auf 3 pro Tag + Kauf-Banner (Grenze nicht bewerben)
    const start = sp.start || t;
    const restTage = GRATIS_TAGE - tageZwischen(start, t);
    const heuteGenutzt = sp.zaehler && sp.zaehler.tag === t ? sp.zaehler.anzahl : 0;
    if (restTage > 0) return { art: "test", frei: Infinity, restTage, text: "Gratis-Test: noch " + restTage + " Tag" + (restTage === 1 ? "" : "e") };
    const frei = Math.max(0, GRATIS_PRO_TAG - heuteGenutzt);
    return { art: "gratis", frei, restTage: 0, heuteGenutzt, text: WERBUNG[(new Date().getDate() + heuteGenutzt) % WERBUNG.length] };
  }
  function zaehlen(sp) {
    const t = heute();
    sp.zaehler = sp.zaehler && sp.zaehler.tag === t ? { tag: t, anzahl: sp.zaehler.anzahl + 1 } : { tag: t, anzahl: 1 };
    return sp;
  }

  glob.ShieldLizenz = { pruefen, status, zaehlen, heute, datumCH, ABOS, KAUF_URL, GRATIS_PRO_TAG, GRATIS_TAGE, WERBUNG };
})(window);
