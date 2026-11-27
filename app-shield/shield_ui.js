/* DEXXUS Shield – gemeinsame Oberfläche «Layout D» (25.11.2026) für WEB Shield (Seitenleiste) und App Shield (Mobile).
   Nur 3 Seiten: Hauptseite (Eingabe → In Arbeit → Antwort), Verlauf, Einstellungen. Dazu: Prüfen (wenn eingeschaltet),
   Antwort lesen (aus dem Verlauf) und in der App die Kamera «Scannen».
   Plattform-Teil: window.ShieldPlatt aus sidepanel.js bzw. app.js – muss VOR dieser Datei geladen sein.
   Engine (redact.js), Dokumente (dokumente*.js), Lizenz (lizenz.js) und Texte (shield_texte.js) bleiben unverändert. */
"use strict";
(function () {
const P = window.ShieldPlatt;
const APP = !!P.app;
const K = P.keys;                      // Speicher-Schlüssel je Plattform
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const KIS = ["Claude", "ChatGPT", "Copilot", "Gemini", "Perplexity"];
const KI_GRENZE = { Copilot: 10000, ChatGPT: 30000, Perplexity: 30000, Gemini: 100000, Claude: 150000 };   // ca., Gratis-Konten

function neueSitzung() { return { karte: {}, eintraege: [], hinweisGesendet: false, dokNr: 0 }; }
const S = { seite: "haupt", zustand: "eingabe", doks: [], text: "", frage: "", offenA: -1, vorschauA: -1, vorL: false, fehler: "", ki: null,
  sitzung: neueSitzung(), wahl: new Set(), lesenId: null, lizBox: false, lizFehler: "", lizText: "", neuBegriff: "", kam: [], kamStrom: null, kamFehler: false,
  arbeitInfo: "", offen: null, pruef: null, basis: null, einfFeld: false, antwortFeld: "", demo: false, heikel: [], dokNrVorher: 0,
  spName: "", spFirma: "", spMail: "", spAgb: false, spInfo: "", spInfoRot: false };
let EINST = { ki: "auto", datum: true, hinweis: true, eigene: "", pruefen: false, sprache: "auto", letzteKI: "" };
let LIZ = { start: null, zaehler: null, lizenz: null };
let UEB = [];
let lauf = 0;

/* ---------- Sprache ---------- */
const SPR = ["de", "en", "fr", "it", "es"];
const LOC = { de: "de-CH", en: "en-GB", fr: "fr-CH", it: "it-CH", es: "es-ES" };
function sprache() {
  const s = EINST.sprache && EINST.sprache !== "auto" ? EINST.sprache : String(P.sprache() || "").slice(0, 2).toLowerCase();
  return SPR.includes(s) ? s : "en";
}
function T(k, ...a) {
  const L = window.SHIELD_TEXTE;
  let t = (L[sprache()] || {})[k];
  if (t == null) t = L.en[k];
  if (t == null) t = L.de[k];
  if (t == null) return k;
  return t.replace(/\{(\d)\}/g, (m, i) => a[i] != null ? a[i] : "");
}
const datum = iso => new Date(iso).toLocaleDateString(LOC[sprache()], { day: "2-digit", month: "2-digit", year: "numeric" });
const datumZeit = iso => new Date(iso).toLocaleString(LOC[sprache()], { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const tsd = n => Number(n).toLocaleString(LOC[sprache()]);
const seitenText = n => n === 1 ? T("seite1") : T("seitenN", n);

/* ---------- Speicher ---------- */
const sichern = (k, v) => { if (!S.demo && k) return P.speicher.set(k, v); };
const einstSichern = () => sichern(K.einst, EINST);
const lizSichern = () => sichern(K.liz, LIZ);
const uebSichern = () => sichern(K.ueb, UEB);
function sitzungSichern() { if (K.sitzung) { sichern(K.sitzung, S.sitzung); sichern(K.offen, S.offen); } }
const eigeneListe = () => (EINST.eigene || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);

/* ---------- Kleinigkeiten ---------- */
function meldung(t, ms) {
  let m = $("shMeld");
  if (!m) { m = document.createElement("div"); m.id = "shMeld"; m.className = "sh-meld"; ($("sh").parentNode || document.body).appendChild(m); }
  m.textContent = t; m.classList.add("an");
  clearTimeout(meldung.t); meldung.t = setTimeout(() => m.classList.remove("an"), ms || 3000);
}
async function kopieren(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) {
    const t = document.createElement("textarea"); t.value = text; t.style.position = "fixed"; t.style.opacity = "0"; document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (x) { /* nein */ } t.remove(); return ok;
  }
}
function fehler(t) { S.fehler = t; zeigen(); }
const oeffne = url => P.oeffne(url);
const freigeschaltet = () => S.demo || !APP || (!!(LIZ.lizenz && LIZ.lizenz.daten) && ShieldLizenz.status(LIZ).art === "abo");

/* ---------- KI-Floskeln weg (24.11.2026) – nur die eigentliche Antwort zeigen und speichern ---------- */
const FLOSKEL_ANFANG = /^(?:danke|vielen dank|herzlichen dank|gerne|gern|klar|alles klar|super|perfekt|verstanden|okay|ok|natürlich|selbstverständlich|hier (?:ist|sind|kommt|kommen)|thanks|thank you|sure|of course|here (?:is|are))\b/i;
const FLOSKEL_SATZ = /platzhalter|placeholder|bereitstellung (?:des|der|dieses)|für (?:das|den|die) (?:dokument|text|hochladen|teilen)|ich (?:übernehme|behalte|lasse) die/i;
const FLOSKEL_ENDE = /^(?:wenn (?:du|sie|ihr)\b|falls (?:du|sie|ihr)\b|möchtest du|möchten sie|willst du|wollen sie|soll ich|sollen wir|darf ich|ich kann (?:dir |ihnen |euch )?(?:auch|gerne|gern|zusätzlich)|gerne kann ich|gern kann ich|auf wunsch|lass(?: mich)? (?:es )?(?:mich )?wissen|sag(?:en sie)? mir|melde dich|if you(?:'d)? (?:like|want)|would you like|let me know|i can also)/i;
function kiFloskelnEntfernen(t) {
  let z = String(t || "").replace(/\r/g, "").split("\n");
  const leer = x => !x.trim();
  const satzWeg = x => (x.match(/[^.!?]+[.!?]*\s*/g) || [x]).filter(s => !(FLOSKEL_SATZ.test(s) || (FLOSKEL_ANFANG.test(s.trim()) && s.length < 160))).join("").trim();
  for (let n = 0; n < 6 && z.length; n++) {
    while (z.length && leer(z[0])) z.shift();
    if (!z.length) break;
    const erste = z[0].trim();
    if (erste.length > 400 || !(FLOSKEL_ANFANG.test(erste) || FLOSKEL_SATZ.test(erste))) break;
    const rest = satzWeg(erste);
    if (rest === erste) break;
    if (rest) { z[0] = rest; break; } else z.shift();
  }
  for (let n = 0; n < 4 && z.length; n++) {
    while (z.length && leer(z[z.length - 1])) z.pop();
    if (!z.length) break;
    const letzte = z[z.length - 1].trim();
    if (letzte.length < 600 && FLOSKEL_ENDE.test(letzte)) z.pop(); else break;
  }
  const r = z.join("\n").trim();
  return r || String(t || "").trim();
}
/* Antwort als Dokument (Überschriften, Aufzählungen, Absätze) – Eingabe ist bereits HTML-sicher */
function alsDokument(html) {
  const z = html.split("\n"), aus = [];
  let liste = null, absatz = [];
  const fett = x => x.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  const absatzZu = () => { if (absatz.length) { aus.push('<p class="d-p">' + fett(absatz.join("<br>")) + "</p>"); absatz = []; } };
  const listeZu = () => { if (liste) { aus.push("<" + liste.t + ' class="d-l">' + liste.p.map(x => "<li>" + fett(x) + "</li>").join("") + "</" + liste.t + ">"); liste = null; } };
  for (const roh of z) {
    const x = roh.trim();
    if (!x) { absatzZu(); listeZu(); continue; }
    let m;
    if ((m = /^#{1,6}\s+(.*)$/.exec(x))) { absatzZu(); listeZu(); aus.push('<h4 class="d-h">' + fett(m[1]) + "</h4>"); continue; }
    if ((m = /^(?:[-•*·]|&#8226;)\s+(.*)$/.exec(x)) || (m = /^(\d+)[.)]\s+(.*)$/.exec(x))) {
      absatzZu();
      const t = m.length === 3 ? "ol" : "ul", inhalt = m.length === 3 ? m[2] : m[1];
      if (!liste || liste.t !== t) { listeZu(); liste = { t, p: [] }; }
      liste.p.push(inhalt); continue;
    }
    if (liste && /^\s{2,}/.test(roh)) { liste.p[liste.p.length - 1] += "<br>" + x; continue; }
    listeZu();
    if (x.length <= 70 && !/[.,;:!?]$/.test(x) && /^\*\*.*\*\*$|^[A-ZÄÖÜ0-9]/.test(x) && !absatz.length) { aus.push('<h4 class="d-h">' + fett(x.replace(/^\*\*|\*\*$/g, "")) + "</h4>"); continue; }
    absatz.push(x);
  }
  absatzZu(); listeZu();
  return aus.join("");
}
const DOK_CSS = '<style>.d-h{font-size:12.5pt;color:#1E3A8A;margin:14pt 0 4pt}.d-p{margin:0 0 8pt}.d-l{margin:0 0 8pt 18pt;padding:0}.d-l li{margin:0 0 3pt}.echt{background:none}</style>';
const antwortRoh = e => kiFloskelnEntfernen(e.antwortRoh != null ? e.antwortRoh : (e.antwort || ""));
const antwortEcht = e => ShieldEngine.deanonymisieren(antwortRoh(e), e.karte || {});
function antwortHTML(e) {
  return ShieldEngine.deanonTeile(antwortRoh(e), e.karte || {})
    .map(t => t.t !== undefined ? esc(t.t) : '<span class="echt" title="' + esc(t.ph) + '">' + esc(t.echt) + '</span>').join("");
}
const antwortDokHTML = e => alsDokument(antwortHTML(e));
function titelAus(e) {
  // nur eine Überschrift (# … oder **…**) oder eine kurze Titelzeile wird zum Titel – nie eine Anrede mit Namen
  const roh = antwortEcht(e).split("\n").map(x => x.trim()).filter(Boolean)[0] || "";
  const erste = roh.replace(/^#{1,6}\s+/, "").replace(/^\*\*|\*\*$/g, "").trim();
  const anrede = /^(sehr geehrte|liebe|lieber|guten tag|hallo|grüezi|dear|hello|hi|bonjour|madame|monsieur|cher|chère|gentile|egregio|caro|cara|buongiorno|estimad|hola|querid)/i.test(erste);
  if (!anrede && erste.length >= 3 && erste.length <= 80 && !/[.!?:,;]$/.test(erste) && (/^#{1,6}\s|^\*\*.+\*\*$/.test(roh) || erste.length <= 60)) return erste;
  return (e.frage || e.text || (e.doks || []).join(", ") || T("antwort")).replace(/\s+/g, " ").slice(0, 70);
}

/* ---------- Bausteine ---------- */
const DATEI = '<svg class="ds" width="28" height="34" viewBox="0 0 24 30" aria-hidden="true"><path d="M2 2h14l6 6v20H2z" fill="#3B82F6"/><path d="M16 2v6h6" fill="#FAFAFF" opacity=".6"/><path d="M6 15h12M6 19h12M6 23h8" stroke="#FAFAFF" stroke-width="1.6"/></svg>';
const AUGE = '<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>';
const KORB = '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const btn = (txt, act, cls, extra) => '<button type="button" class="btn ' + (cls || "") + '" data-act="' + act + '"' + (extra || "") + '>' + txt + '</button>';
const tl = (txt, act) => '<button type="button" class="tl" data-act="' + act + '">' + txt + '</button>';
const hauptName = () => APP ? T("schwaerzenKopieren") : T("ausfuehren");
const keineKI = () => !APP && EINST.ki !== "universal" && !S.ki;
const fehlerHTML = () => S.fehler ? '<div class="rottext">' + esc(S.fehler) + '</div>' : "";
function feld(art, platz, min) {
  return '<textarea class="feld" data-feld="' + art + '" rows="1" style="min-height:' + min + 'px" placeholder="' + esc(platz) + '">' + esc(S[art] || "") + '</textarea>';
}
function kopf() {
  return '<div class="kopf"><div class="logo">DX</div><div class="t"><b>DEXXUS<sup>®</sup> ' + (APP ? "App" : "WEB") + ' Shield</b>' +
    '<small>Swiss made · <a href="https://dexxus.ch" target="_blank" rel="noopener" data-url="https://dexxus.ch">dexxus.ch</a></small></div></div>';
}
function lizStatus() {
  if (S.demo) return { art: "abo", kurz: T("aboBis", "31.12.2027"), lang: T("aboAktivBis", "31.12.2027") };
  const s = ShieldLizenz.status(LIZ);
  if (s.art === "abo") {
    const d = LIZ.lizenz.daten, test = /test/i.test(d.paket || ""), bis = d.bis && !d.unbefristet ? ShieldLizenz.datumCH(d.bis) : "";
    return { art: "abo", test, kurz: test ? T("testBis", bis) : (bis ? T("aboBis", bis) : T("aboAktiv")), lang: test ? T("testAktivBis", bis) : (bis ? T("aboAktivBis", bis) : T("aboAktiv")) };
  }
  if (APP) return { art: "keine", kurz: T("nichtFrei"), lang: T("nichtFreiLang") };
  if (s.art === "test") return { art: "test", kurz: s.restTage === 1 ? T("tagGratis") : T("tageGratis", s.restTage), lang: T("gratisTestNoch", s.restTage) };
  return { art: "gratis", frei: s.frei, kurz: T("gratisVorbei"), lang: T("gratisVorbeiLang") };
}
function leiste() {
  let links, rot = false;
  if (APP) links = T("bereit");
  else if (EINST.ki === "universal") links = T("vonHand");
  else if (S.ki) links = T("verbunden", S.ki);
  else { links = T("keineKI"); rot = true; }
  const st = lizStatus();
  const rechts = st.art === "abo" && !st.test ? '<span class="abozt">' + esc(st.kurz) + '</span>'
    : '<span class="abozt">' + esc(st.kurz) + ' <button type="button" class="kaufknopf" data-act="kaufen">' + T("kaufen") + '</button></span>';
  return '<div class="leiste' + (rot ? " rot" : "") + '"><span class="zst">' + (rot ? "" : '<span class="punkt"></span>') + '<i>' + esc(links) + '</i></span>' + rechts + '</div>';
}
function fuss(an) {
  return '<div class="links">' + [["haupt", T("neu")], ["verlauf", T("verlaufN", UEB.length)], ["einstellungen", T("einstellungen")]]
    .map(x => '<button type="button" class="fl' + (an === x[0] ? " an" : "") + '" data-go="' + x[0] + '">' + esc(x[1]) + '</button>').join("") + '</div>';
}
function kiReihe() { const l = EINST.letzteKI; return KIS.includes(l) ? [l].concat(KIS.filter(x => x !== l)) : KIS.slice(); }

/* ---------- Zeichen zählen, zu lang ---------- */
const zeichen = () => (S.text || "").length + (S.frage || "").length + S.doks.reduce((s, d) => s + (d.text ? d.text.length : 0), 0);
const kiFuerGrenze = () => !APP && EINST.ki !== "universal" && S.ki && KI_GRENZE[S.ki] ? S.ki : "";
const grenze = () => KI_GRENZE[kiFuerGrenze()] || 30000;
function zaehlerHTML() {
  const n = zeichen(); if (!n) return "";
  let h = '<div class="zaehler">' + esc(T("zeichenN", tsd(n))) + '</div>';
  const g = grenze(); if (n <= g) return h;
  const teile = Math.ceil(n / (g * 0.85)), ki = kiFuerGrenze();
  return h + '<div class="zulang"><div class="rottext">' + esc(ki ? T("zuLangKI", ki, tsd(g)) : T("zuLang", tsd(g))) + '</div><div class="zeile eng">' +
    btn(T("inTeilen", teile), "teile", "klein") + (ki && ki !== "Claude" ? btn(T("claudeWaehlen"), "claude", "w klein") : "") + '</div></div>';
}

/* ---------- Hauptseite ---------- */
function dokKarte(d, i) {
  let info;
  if (d.laedt) info = '<span class="dreh mini"></span>' + esc(d.info || T("wirdGelesen"));
  else if (d.fehler) info = '<span class="rottext">' + esc(d.fehler) + '</span>';
  else info = esc(seitenText(d.seiten || 1)) + (d.ocr ? " · " + esc(T("textErkannt")) : "");
  const kopie = !APP && !d.laedt && d.dok && d.dok.seiten && d.dok.seiten.some(s => s.hatBild) ? ' · <button type="button" class="tl" data-kopie="' + d.id + '">' + T("geschwKopie") + '</button>' : "";
  return '<div class="dateikarte fest"><span class="nr">' + (S.sitzung.dokNr + i + 1) + '</span>' + DATEI +
    '<div class="dk-t"><b>' + esc(T("dokumentN", S.sitzung.dokNr + i + 1)) + ': ' + esc(d.name) + '</b><div class="hinw">' + info + kopie + '</div></div>' +
    '<button type="button" class="btn rot klein" data-weg="' + d.id + '">' + T("entfernen") + '</button></div>';
}
function dokListeHTML() {
  if (!S.doks.length) return "";
  const seiten = S.doks.reduce((s, d) => s + (d.seiten || 1), 0);
  return (S.doks.length > 1 ? '<div class="lab">' + esc(T("dokSumme", S.doks.length, seitenText(seiten))) + '</div>' : "") +
    '<div class="dokliste">' + S.doks.map(dokKarte).join("") + '</div>';
}
function hauptKnopf() { return keineKI() ? '<button type="button" class="btn aus" disabled>' + T("ausfuehren") + '</button>' : btn(hauptName(), "los", "haupt"); }
function antwortKarte(e, i) {
  const offen = S.offenA === i;
  return '<div class="dateikarte" data-oa="' + i + '">' + DATEI + '<div class="dk-t"><b>' + esc(e.titel) + '</b><div class="hinw">' + T(offen ? "antippenZu" : "antippenLesen") + '</div></div></div>' +
    (offen ? '<div class="karte antw">' + antwortDokHTML(e) + '<div class="hinw lk"><button type="button" class="tl" data-vor="' + i + '">' + T(S.vorschauA === i ? "vorschauZu" : "vorschau") + '</button></div>' +
      (S.vorschauA === i ? vorschauHTML(e) : "") + '</div>' : "");
}
const vorschauHTML = e => '<pre class="vor">' + esc(e.gesendet || "").replace(/\[[^\]]+ \d+\]/g, m => '<span class="ph">' + m + '</span>') + '</pre>';
const aktuelle = () => S.sitzung.eintraege[S.offenA >= 0 ? S.offenA : S.sitzung.eintraege.length - 1];

function haupt() {
  let h = kopf() + leiste() + '<div class="inhalt">';
  if (APP && !freigeschaltet()) return h + sperreHTML() + '</div>' + fuss("haupt");
  if (APP && S.zustand === "eingabe") h += installHTML();
  if (keineKI() && S.zustand !== "laeuft") h += '<div class="rottext fett">' + T("welcheKI") + '</div><div class="kiwahl">' +
    kiReihe().map((k, i) => '<button type="button" class="btn klein' + (i ? " w" : "") + '" data-ki="' + k + '">' + k + '</button>').join("") + '</div>';
  if (S.zustand === "eingabe") {
    h += APP ? feld("text", T("textPlatz"), 110) : '<div class="ablage" id="ablage" data-act="dok">' + T("ablage") + '<small>' + T("ablageKlein") + '</small></div>';
    h += dokListeHTML();
    h += '<div class="zeile">' + btn(T("dateiWaehlen"), "dok", "w") + (APP ? btn(T("scannen"), "kamera", "w") : "") + '</div>';
    h += '<div class="lab">' + T("frageAuftrag") + '</div>' + feld("frage", S.doks.length > 1 ? T("fragePlatz2") : T("fragePlatz"), 80);
    h += '<div id="zaehler">' + zaehlerHTML() + '</div>' + fehlerHTML() + '<div class="platz"></div>' + hauptKnopf();
  } else if (S.zustand === "kopiert") {
    const o = S.offen || { teile: null, teilNr: 0 };
    h += '<div class="status ok">' + (APP ? T("kopiertApp") : T("kopiertPC")) + '</div>';
    if (o.teile) h += '<div class="hinw lk fett">' + T("teilKopiert", o.teilNr + 1, o.teile.length) + '</div>' +
      (o.teilNr + 1 < o.teile.length ? btn(T("naechsterTeil", o.teilNr + 2, o.teile.length), "naechsterTeil", "w") : "");
    if (APP) h += (S.einfFeld ? feld("antwortFeld", T("einfFeldPlatz"), 90) : "") + fehlerHTML() + '<div class="platz"></div>' + btn(T("antwortEinfuegen"), "einfuegen", "g haupt");
    else h += feld("antwortFeld", T("uniPlatz"), 110) + fehlerHTML() + '<div class="platz"></div>' + btn(T("antwortUebernehmen"), "uniFertig", "haupt");
    h += '<div class="hinw">' + tl(T("nochmalKopieren"), "nochmal") + ' · ' + tl(T("zurueck"), "zurueck") + '</div>';
  } else {
    h += S.sitzung.eintraege.map(antwortKarte).join("");
    if (S.zustand === "laeuft") {
      h += '<div class="dateikarte fest arbeit"><span class="dreh"></span><div class="dk-t"><b>' + T("inArbeit") + '</b>' + (S.arbeitInfo ? '<div class="hinw">' + esc(S.arbeitInfo) + '</div>' : "") + '</div>' + tl(T("abbrechen"), "abbrechen") + '</div><div class="platz"></div>';
    } else {
      const e = aktuelle(), gesp = !!e && UEB.some(x => x.id === e.id);
      h += '<div class="zeile">' + btn(gesp ? T("imVerlauf") : T("inVerlaufSpeichern"), "inverlauf", "w klein" + (gesp ? " aus" : "")) +
        (APP ? btn(T("teilen"), "teilen", "w klein") : btn(T("kopieren"), "kop", "w klein") + btn(T("speichern"), "speichern", "w klein")) + '</div>';
      if (S.heikel.length) h += '<div class="rottext">' + esc(T("heikel", S.heikel.join(", "))) + '</div>';
      if (lizStatus().art === "gratis") h += '<div class="werbung"><span>' + esc(T("werbung")) + '</span><button type="button" class="kaufknopf" data-act="kaufen">' + T("kaufen") + '</button></div>';
      h += '<div class="platz"></div><div class="trenn"></div>' + dokListeHTML() + feld("frage", T("weiterePlatz"), 48) +
        '<div id="zaehler">' + zaehlerHTML() + '</div>' + fehlerHTML() + hauptKnopf();
    }
  }
  return h + '</div>' + fuss("haupt");
}

/* ---------- Prüfen (nur wenn in den Einstellungen eingeschaltet) ---------- */
const pruefHTML = text => esc(text).replace(/\[[^\]]+ \d+\]/g, m => '<span class="ph" data-p="' + m + '">' + m + '</span>');
function pruefen() {
  return kopf() + '<div class="inhalt"><div class="lab">' + T("pruefTitel") + '</div>' +
    '<div class="feld vtext" id="vtext">' + S.pruef.html + '</div><div class="hinw lk">' + T("pruefHinweis") + '</div>' +
    '<div class="zeile">' + btn(T("markiertes"), "markieren", "w") + '</div>' + btn(hauptName(), "senden", "haupt") +
    '<div class="hinw">' + tl(T("zurueck"), "pruefZurueck") + '</div></div>';
}

/* ---------- Kamera (nur App) ---------- */
function kamera() {
  const n = S.kam.length;
  return kopf() + '<div class="inhalt"><div class="kambild">' + (S.kamStrom ? '<video id="kamVideo" autoplay playsinline muted></video>' : '<span>' + T(S.kamFehler ? "kamFoto" : "kamBild") + '</span>') +
    (n ? '<span class="kamzahl">' + esc(seitenText(n)) + '</span>' : "") + '</div>' +
    btn(n ? T("naechsteSeite") : T("seiteScannen"), "scanSeite", "haupt") + (n ? btn(T("fertigN", seitenText(n)), "scanFertig", "g") : "") +
    '<div class="hinw">' + tl(T("zurueck"), "kamZurueck") + '</div></div>';
}

/* ---------- Verlauf ---------- */
function verlauf() {
  let h = kopf() + '<div class="inhalt">';
  if (!UEB.length) h += '<div class="leer">' + T("verlaufLeer") + '</div>';
  else h += '<div class="vliste">' + UEB.map(e => '<div class="dateikarte fest">' + DATEI + '<div class="dk-t"><b>' + esc(e.titel) + '</b><div class="hinw">' + datum(e.zeit) + '</div></div>' +
    '<button type="button" class="btn w klein nw" data-lesen="' + e.id + '">' + AUGE + T("antwort") + '</button>' +
    '<input type="checkbox" class="kast" data-wahl="' + e.id + '"' + (S.wahl.has(e.id) ? " checked" : "") + ' aria-label="' + esc(e.titel) + '"></div>').join("") + '</div>';
  h += '<div class="platz"></div>';
  if (UEB.length) h += '<div class="hinw lk">' + T(APP ? "ankreuzenApp" : "ankreuzen") + '</div><div class="zeile">' +
    (APP ? btn(T("teilen"), "vTeilen", "w klein") : btn(T("speichern"), "vSpeichern", "w klein")) + btn(T("loeschen"), "vLoeschen", "rot klein") + '</div>';
  return h + '</div>' + fuss("verlauf");
}
function lesen() {
  const e = UEB.find(x => x.id === S.lesenId);
  if (!e) { S.seite = "verlauf"; return verlauf(); }
  return kopf() + '<div class="inhalt"><div class="dateikarte flach">' + DATEI + '<div class="dk-t"><b>' + esc(e.titel) + '</b><div class="hinw">' + datumZeit(e.zeit) +
    (e.doks && e.doks.length ? " · " + esc(e.doks.join(", ")) : "") + '</div></div></div>' +
    '<div class="karte antw voll">' + antwortDokHTML(e) + '<div class="hinw lk">' + tl(T(S.vorL ? "vorschauZu" : "vorschau"), "vorL") + '</div>' + (S.vorL ? vorschauHTML(e) : "") + '</div>' +
    '<div class="zeile">' + (APP ? btn(T("teilen"), "lTeilen", "w klein") : btn(T("kopieren"), "lKop", "w klein") + btn(T("speichern"), "lSpeichern", "w klein")) + btn(T("loeschen"), "lLoeschen", "rot klein") + '</div>' +
    '<button type="button" class="btn w" data-go="verlauf">‹ ' + T("zurueckVerlauf") + '</button></div>';
}

/* ---------- Einstellungen ---------- */
function lizBoxHTML() {
  return '<div class="lizbox">' + feld("lizText", T("lizPlatz"), 60) + '<div class="zeile">' + btn(T("dateiWaehlen"), "lizDatei", "w klein") + btn(T("uebernehmen"), "lizOk", "klein") + '</div>' +
    (S.lizFehler ? '<div class="rottext">' + esc(S.lizFehler) + '</div>' : "") + '</div>';
}
function einstellungen() {
  const st = lizStatus(), titel = t => '<div class="kt">' + t + '</div>', begr = eigeneListe();
  let h = kopf() + '<div class="inhalt einst">';
  h += '<div class="karte">' + titel(T("abo")) + '<div>' + esc(st.lang) + '</div><div class="zeile">' + (st.art !== "abo" || st.test ? btn(T("aboKaufen"), "kaufen", "klein") : "") +
    btn(APP ? T("lizenzFrei") : T("lizenzEinlesen"), "lizBox", "w klein") + '</div>' + (S.lizBox ? lizBoxHTML() : "") + '</div>';
  h += '<div class="karte">' + titel(T("verlauf")) + '<div class="hinw lk">' + T("gespeicherteAntworten") + '</div>' + btn(T("verlaufLoeschen"), "verlaufWeg", "rot klein") + '</div>';
  h += '<div class="karte">' + titel(T("schwaerzen")) +
    '<label class="chk"><input type="checkbox" data-chk="pruefen"' + (EINST.pruefen ? " checked" : "") + '> ' + T("vorSenden") + '</label>' +
    '<label class="chk"><input type="checkbox" data-chk="datum"' + (EINST.datum ? " checked" : "") + '> ' + T("datumSchwaerzen") + '</label>' +
    '<div>' + T("immerSchwaerzen") + '</div><div class="zeile eng"><input class="feld ein" data-feld="neuBegriff" value="' + esc(S.neuBegriff) + '" placeholder="' + esc(T("begriffPlatz")) + '">' +
    btn(T("hinzufuegen"), "begriffDazu", "klein fest") + '</div>' +
    (begr.length ? '<div class="begriffe">' + begr.map((b, i) => '<div class="begriff"><span>' + esc(b) + '</span><button type="button" class="korb" data-bweg="' + i + '" title="' + esc(T("loeschen")) + '" aria-label="' + esc(T("loeschen") + ": " + b) + '">' + KORB + '</button></div>').join("") + '</div>'
      : '<div class="hinw lk">' + T("keineBegriffe") + '</div>') + '</div>';
  h += '<div class="karte">' + titel(T("sprache")) + '<div class="sprachen">' +
    [["auto", T("automatisch")], ["de", "Deutsch"], ["en", "English"], ["fr", "Français"], ["it", "Italiano"], ["es", "Español"]]
      .map(x => '<button type="button" class="btn klein' + ((EINST.sprache || "auto") === x[0] ? "" : " w") + '" data-spr="' + x[0] + '">' + x[1] + '</button>').join("") +
    '</div><div class="hinw lk">' + T(APP ? "autoMobile" : "autoBrowser") + '</div></div>';
  h += '<div class="hinw">' + tl(T("hilfe"), "hilfe") + ' · ' + (APP ? tl(T("weiterempfehlen"), "empfehlen") : tl(T(EINST.ki === "universal" ? "autoKI" : "andereKI"), "universal")) + '</div>';
  return h + '</div>' + fuss("einstellungen");
}

/* ---------- App: Sperre (ohne Lizenz) und Startbildschirm-Kasten ---------- */
function sperreHTML() {
  return '<div class="karte"><div class="kt">' + T("freischalten") + '</div><div class="hinw lk">' + T("sperreText") + '</div></div>' +
    '<div class="karte"><div class="kt">' + T("testAnfordern") + '</div>' +
    '<input class="feld ein" data-feld="spName" autocomplete="name" value="' + esc(S.spName) + '" placeholder="' + esc(T("spName")) + '">' +
    '<input class="feld ein" data-feld="spFirma" autocomplete="organization" value="' + esc(S.spFirma) + '" placeholder="' + esc(T("spFirma")) + '">' +
    '<input class="feld ein" type="email" data-feld="spMail" autocomplete="email" value="' + esc(S.spMail) + '" placeholder="' + esc(T("spMail")) + '">' +
    '<label class="chk"><input type="checkbox" data-chk2="spAgb"' + (S.spAgb ? " checked" : "") + '> ' + T("agb", '<a href="https://dexxus.ch/agb.html" target="_blank" rel="noopener">AGB</a>') + '</label>' +
    btn(T("testAnfordernK"), "spAnfordern", "klein") + (S.spInfo ? '<div class="' + (S.spInfoRot ? "rottext" : "oktext") + '">' + esc(S.spInfo) + '</div>' : "") + '</div>' +
    '<div class="karte"><div class="kt">' + T("lizErhalten") + '</div><div class="hinw lk">' + T("lizErhaltenText") + '</div>' + lizBoxHTML() + '</div>' +
    btn(T("jetztKaufen"), "kaufen", "g");
}
function installHTML() {
  const i = P.installInfo ? P.installInfo() : null;
  if (!i) return "";
  return '<div class="install"><b>' + T("installTitel") + '</b><span>' + esc(i.text) + '</span><div class="zeile eng">' +
    (i.knopf ? btn(T("installKnopf"), "install", "g klein") : "") + tl(T("spaeter"), "installSpaeter") + '</div></div>';
}

/* ---------- Anzeigen ---------- */
const SEITEN = { haupt, pruefen, kamera, verlauf, lesen, einstellungen };
function zeigen() {
  const root = $("sh"); if (!root) return;
  const akt = document.activeElement;
  const fokus = akt && root.contains(akt) && akt.dataset && akt.dataset.feld ? { f: akt.dataset.feld, a: akt.selectionStart, b: akt.selectionEnd } : null;
  const alt = root.querySelector(".inhalt"), scroll = alt ? alt.scrollTop : 0, schluessel = S.seite + "|" + S.zustand, gleich = zeigen.letzte === schluessel;
  root.className = "sh" + (APP ? " app" : "") + (gleich ? "" : " neu");
  root.innerHTML = SEITEN[S.seite]();
  root.querySelectorAll("textarea[data-feld]").forEach(wachsen);
  const neuI = root.querySelector(".inhalt");
  if (gleich && neuI) neuI.scrollTop = scroll;
  zeigen.letzte = schluessel;
  if (fokus) { const f = root.querySelector('[data-feld="' + fokus.f + '"]'); if (f) { f.focus(); try { f.setSelectionRange(fokus.a, fokus.b); } catch (e) { /* egal */ } } }
  const v = $("kamVideo"); if (v && S.kamStrom) { v.srcObject = S.kamStrom; v.play().catch(() => {}); }
  document.documentElement.lang = sprache();
}
let sanftT = null;
function zeigenSanft() { if (sanftT) return; sanftT = setTimeout(() => { sanftT = null; zeigen(); }, 250); }
function wachsen(f) {
  const root = $("sh"), max = Math.max(120, Math.round((root ? root.clientHeight : 600) * 0.35));
  f.style.height = "auto"; f.style.height = Math.min(f.scrollHeight + 4, max) + "px"; f.style.overflowY = f.scrollHeight + 4 > max ? "auto" : "hidden";
}

/* ---------- Neu ---------- */
function neu() {
  lauf++;
  Object.assign(S, { seite: "haupt", zustand: "eingabe", doks: [], text: "", frage: "", offenA: -1, vorschauA: -1, fehler: "", offen: null, pruef: null,
    heikel: [], antwortFeld: "", einfFeld: false, sitzung: neueSitzung() });
  sitzungSichern();
}

/* ---------- Ausführen ---------- */
function hinweisPrefix() {
  return EINST.hinweis && !S.sitzung.hinweisGesendet ? ShieldEngine.hinweisKI.replace(/\s*$/, " Antworte direkt, ohne Einleitung, ohne Dank und ohne Angebote am Schluss. Gliedere die Antwort wie ein Dokument: Überschriften, kurze Absätze, Aufzählungen.\n\n") : "";
}
function los(inTeilen) {
  S.fehler = "";
  if (!freigeschaltet()) return zeigen();
  if (S.doks.some(d => d.laedt)) return fehler(T("dokLaedt"));
  const st = lizStatus(); if (st.art === "gratis" && st.frei <= 0) return fehler(T("gratisVorbeiLang"));
  const text = (S.text || "").trim(), frage = (S.frage || "").trim(), doks = S.doks.filter(d => !d.fehler && d.text);
  if (!text && !frage && !doks.length) return fehler(T(APP ? "leerApp" : "leerPC"));
  S.dokNrVorher = S.sitzung.dokNr;
  let roh = "";
  if (text) roh += text + "\n\n";
  doks.forEach(d => { S.sitzung.dokNr++; roh += "--- Dokument " + S.sitzung.dokNr + " ---\n" + d.text.trim() + "\n\n"; });
  if (S.doks.length > doks.length) S.sitzung.dokNr = S.dokNrVorher + S.doks.length;     // Nummern bleiben wie auf den Karten
  if (frage) roh += (text || doks.length ? "Frage/Auftrag: " : "") + frage;
  roh = roh.trim();
  const vorher = Object.keys(S.sitzung.karte).length;
  const r = ShieldEngine.anonymisieren(roh, eigeneListe().filter(s => s.length >= 2), S.sitzung.karte, { datum: EINST.datum });
  S.sitzung.karte = r.karte;
  S.neuAnz = Object.keys(r.karte).length - vorher;
  S.heikel = ShieldEngine.heikleThemen(roh);
  S.basis = { frage, text, doks: doks.map(d => d.name), teilen: !!inTeilen };
  if (EINST.pruefen) { S.pruef = { html: pruefHTML(r.text) }; S.seite = "pruefen"; return zeigen(); }
  senden(r.text);
}
function teileBauen(text, g) {
  const max = Math.floor(g * 0.85), stuecke = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    stuecke.push(rest.slice(0, cut)); rest = rest.slice(cut).replace(/^\s+/, "");
  }
  stuecke.push(rest);
  const n = stuecke.length; if (n < 2) return null;
  return stuecke.map((s, i) => i < n - 1
    ? "[Teil " + (i + 1) + " von " + n + "] Bitte nur lesen und mit «OK» antworten. Der Auftrag folgt im letzten Teil.\n\n" + s
    : "[Teil " + n + " von " + n + "] Das ist der letzte Teil. Bitte jetzt den Auftrag am Schluss ausführen und alle Teile berücksichtigen.\n\n" + s);
}
async function senden(text) {
  const gesendet = hinweisPrefix() + text;
  const basis = Object.assign({}, S.basis, { gesendet });
  const teile = basis.teilen ? teileBauen(gesendet, grenze()) : null;
  S.seite = "haupt"; S.fehler = "";
  if (APP || EINST.ki === "universal") {                    // über die Zwischenablage
    S.offen = { basis, teile, teilNr: 0, dokNrVorher: S.dokNrVorher };
    S.zustand = "kopiert"; S.antwortFeld = ""; S.einfFeld = false;
    if (APP) { LIZ = ShieldLizenz.zaehlen(LIZ); lizSichern(); }
    sitzungSichern();
    if (!(await kopieren(teile ? teile[0] : gesendet))) S.fehler = T("kopierenNein");
    return zeigen();
  }
  const mein = ++lauf;
  S.zustand = "laeuft"; S.arbeitInfo = S.neuAnz ? (S.neuAnz === 1 ? T("geschwaerzt1") : T("geschwaerztN", S.neuAnz)) : ""; zeigen();
  try {
    let antwort;
    if (teile) {
      for (let i = 0; i < teile.length; i++) {
        S.arbeitInfo = T("teilVon", i + 1, teile.length); zeigen();
        antwort = await P.senden(teile[i]);
        if (mein !== lauf) return;
      }
    } else antwort = await P.senden(gesendet);
    if (mein !== lauf) return;
    S.sitzung.hinweisGesendet = true;
    abschliessen(basis, antwort);
  } catch (e) {
    if (mein !== lauf) return;
    S.sitzung.dokNr = S.dokNrVorher;
    S.zustand = S.sitzung.eintraege.length ? "antwort" : "eingabe"; S.fehler = e.message || String(e); zeigen();
  }
}
function abschliessen(basis, roh) {
  const e = { id: rid(), zeit: new Date().toISOString(), frage: basis.frage, text: basis.text, doks: basis.doks, gesendet: basis.gesendet,
    antwortRoh: kiFloskelnEntfernen(roh), karte: Object.assign({}, S.sitzung.karte), ki: APP ? "" : (EINST.ki === "universal" ? "Universal" : (S.ki || "")) };
  e.titel = titelAus(e);
  S.sitzung.eintraege.push(e);
  if (!APP) { LIZ = ShieldLizenz.zaehlen(LIZ); lizSichern(); }
  Object.assign(S, { text: "", frage: "", doks: [], offen: null, zustand: "antwort", offenA: -1, vorschauA: -1, antwortFeld: "", einfFeld: false, fehler: "" });
  sitzungSichern();
  zeigen();
  const offen = ShieldEngine.offenePlatzhalter(antwortEcht(e));
  if (offen.length) meldung(T("platzhalterOffen", offen.length), 5000);
}
function antwortUebernehmen(a) {
  a = (a || "").trim();
  if (!a) return fehler(T("zuerstAntwort"));
  if (!S.offen) return;
  if (a === S.offen.basis.gesendet.trim() || (S.offen.teile && S.offen.teile.some(t => t.trim() === a))) return fehler(T("eigenerText"));
  S.sitzung.hinweisGesendet = true;
  abschliessen(S.offen.basis, a);
}
async function einfuegen() {
  if (S.einfFeld && (S.antwortFeld || "").trim()) return antwortUebernehmen(S.antwortFeld);
  try {
    const t = await navigator.clipboard.readText();
    if (t && t.trim()) return antwortUebernehmen(t);
    fehler(T("ablageLeer"));
  } catch (x) {
    S.einfFeld = true; S.fehler = ""; zeigen();
    const f = $("sh").querySelector('[data-feld="antwortFeld"]'); if (f) f.focus();
    meldung(T("einfFeldHinweis"), 4000);
  }
}

/* ---------- Speichern / Teilen ---------- */
function alsText(liste) {
  return liste.map(e => datumZeit(e.zeit) + " – " + e.titel + "\n\n" + (e.frage ? T("lFrage") + ": " + e.frage + "\n" : "") +
    (e.doks && e.doks.length ? T("lDoks") + ": " + e.doks.join(", ") + "\n" : "") + "\n" +
    antwortEcht(e).replace(/^#{1,6}\s+(.*)$/gm, (m, h) => "\n" + h.toUpperCase()).replace(/^[-*]\s+/gm, "• ").replace(/\*\*/g, "") + "\n").join("\n------------------------------\n\n");
}
function alsHTML(liste) {
  const teile = liste.map(e => '<h2 style="font-size:14pt;color:#1D4ED8;margin:18pt 0 4pt">' + esc(e.titel) + '</h2>' +
    '<p style="color:#64748B;font-size:9pt;margin:0 0 6pt">' + datumZeit(e.zeit) + (e.doks && e.doks.length ? ' · ' + esc(T("lDoks")) + ': ' + esc(e.doks.join(", ")) : '') + '</p>' +
    (e.frage ? '<p><b>' + esc(T("lFrage")) + ':</b> ' + esc(e.frage) + '</p>' : '') + '<div>' + alsDokument(esc(antwortEcht(e))) + '</div>').join('<hr style="border:0;border-top:1px solid #E5E7EB;margin:16pt 0">');
  return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>' + esc(T("lTitel")) + '</title>' + DOK_CSS + '</head>' +
    '<body style="font-family:Segoe UI,Arial;font-size:11pt;line-height:1.45;color:#0F172A">' + teile + '</body></html>';
}
/* Kleines PDF ohne fremde Bibliothek: Helvetica, A4, Zeilenumbruch, mehrere Seiten */
function pdfStr(t) {
  const map = { "€": 128, "‚": 130, "„": 132, "…": 133, "‘": 145, "’": 146, "“": 147, "”": 148, "•": 149, "–": 150, "—": 151 };
  let o = "";
  for (const c of t) {
    let k = c.charCodeAt(0);
    if (map[c]) k = map[c]; else if (k > 255) k = 63;
    o += c === "(" || c === ")" || c === "\\" ? "\\" + c : String.fromCharCode(k);
  }
  return o;
}
function pdfBauen(liste) {
  const zeilen = [];
  liste.forEach((e, k) => {
    if (k) zeilen.push({ t: "", s: 14 });
    zeilen.push({ t: e.titel, b: 1, s: 15 });
    zeilen.push({ t: datumZeit(e.zeit), s: 9, g: 1 });
    if (e.frage) zeilen.push({ t: T("lFrage") + ": " + e.frage, s: 10, g: 1 });
    zeilen.push({ t: "", s: 8 });
    antwortEcht(e).replace(/\r/g, "").split("\n").forEach(l => {
      const x = l.trim(); let m;
      if (!x) zeilen.push({ t: "", s: 7 });
      else if ((m = /^#{1,6}\s+(.*)$/.exec(x))) zeilen.push({ t: m[1].replace(/\*\*/g, ""), b: 1, s: 12.5 });
      else if ((m = /^[-•*·]\s+(.*)$/.exec(x))) zeilen.push({ t: "•  " + m[1].replace(/\*\*/g, ""), s: 11, e: 12 });
      else zeilen.push({ t: x.replace(/\*\*/g, ""), s: 11 });
    });
  });
  const W = 595.28, H = 841.89, R = 50, breite = W - 2 * R, seiten = [];
  let ops = [], y = H - R;
  const bv = (s, size, b) => { let w = 0; for (const c of s) w += /[il.,;:'!|]/.test(c) ? 0.26 : /[fjrt()\-\s]/.test(c) ? 0.34 : /[mwMW]/.test(c) ? 0.84 : /[A-ZÄÖÜ]/.test(c) ? 0.68 : 0.55; return w * size * (b ? 1.06 : 1); };
  for (const z of zeilen) {
    const lh = z.s * 1.38;
    if (!z.t) { y -= lh * 0.6; continue; }
    const out = []; let zeile = ""; const ein = z.e || 0;
    for (const w of z.t.split(/\s+/)) { const probe = zeile ? zeile + " " + w : w; if (zeile && bv(probe, z.s, z.b) > breite - ein) { out.push(zeile); zeile = w; } else zeile = probe; }
    if (zeile) out.push(zeile);
    out.forEach((t, i) => {
      if (y - lh < R) { seiten.push(ops); ops = []; y = H - R; }
      y -= lh;
      const farbe = z.g ? "0.39 0.45 0.55 rg" : z.b ? "0.12 0.23 0.54 rg" : "0.06 0.09 0.16 rg";
      ops.push("BT /" + (z.b ? "F2" : "F1") + " " + z.s + " Tf " + farbe + " " + (R + (i ? ein : 0)).toFixed(2) + " " + y.toFixed(2) + " Td (" + pdfStr(t) + ") Tj ET");
    });
    if (z.b) y -= 3;
  }
  seiten.push(ops);
  const obj = [];
  obj[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  obj[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  obj[4] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
  const kids = []; let n = 5;
  seiten.forEach(o => {
    const inhalt = o.join("\n");
    obj[n] = "<< /Length " + inhalt.length + " >>\nstream\n" + inhalt + "\nendstream";
    obj[n + 1] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + n + " 0 R >>";
    kids.push((n + 1) + " 0 R"); n += 2;
  });
  obj[2] = "<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + kids.length + " >>";
  let s = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const off = [];
  for (let i = 1; i < n; i++) { off[i] = s.length; s += i + " 0 obj\n" + obj[i] + "\nendobj\n"; }
  const x = s.length;
  s += "xref\n0 " + n + "\n0000000000 65535 f \n";
  for (let i = 1; i < n; i++) s += String(off[i]).padStart(10, "0") + " 00000 n \n";
  s += "trailer\n<< /Size " + n + " /Root 1 0 R >>\nstartxref\n" + x + "\n%%EOF";
  const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255;
  return new Blob([b], { type: "application/pdf" });
}
function blobFuer(liste, ext) {
  if (ext === "pdf") return pdfBauen(liste);
  if (ext === "txt") return new Blob(["﻿" + alsText(liste)], { type: "text/plain;charset=utf-8" });
  return new Blob([alsHTML(liste)], { type: "application/msword" });
}
/* «Speichern» öffnet immer das Speichern-Fenster: Ort und Dateiart (Word, PDF, Text) wählt der Kunde dort */
async function speichern(liste) {
  if (!liste.length) return;
  const name = "Shield-Antwort_" + new Date().toISOString().slice(0, 10);
  if (window.showSaveFilePicker) {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: name + ".doc", types: [
        { description: "Word", accept: { "application/msword": [".doc"] } },
        { description: "PDF", accept: { "application/pdf": [".pdf"] } },
        { description: T("textDatei"), accept: { "text/plain": [".txt"] } }] });
      const ext = (h.name.split(".").pop() || "doc").toLowerCase();
      const w = await h.createWritable(); await w.write(blobFuer(liste, ext)); await w.close();
      return meldung(T("gespeichertAls", h.name));
    } catch (e) { if (e && e.name === "AbortError") return; }
  }
  P.herunterladen(blobFuer(liste, "doc"), name + ".doc");
}
async function teilen(liste) {
  if (!liste.length) return;
  const text = liste.length === 1 ? antwortEcht(liste[0]) : alsText(liste);
  if (navigator.share) { try { await navigator.share({ title: liste[0].titel, text }); } catch (x) { /* abgebrochen */ } return; }
  meldung(await kopieren(text) ? T("teilenNein") : T("kopierenNein"));
}
function gewaehlte() { const l = UEB.filter(e => S.wahl.has(e.id)); if (!l.length) meldung(T("zuerstAnkreuzen")); return l; }

/* ---------- Dokumente ---------- */
async function dateienHinzu(liste) {
  if (!freigeschaltet()) return;
  if (S.seite !== "haupt") S.seite = "haupt";
  for (const f of liste) {
    const d = { id: rid(), name: f.name || "Foto.jpg", laedt: true, info: "" };
    S.doks.push(d); zeigen();
    try {
      const r = await ShieldDokBasis.lesen(f, { fortschritt: (a, m) => { d.info = m; zeigenSanft(); } });
      d.text = r.text || ""; d.dok = r.dok || null;
      const bild = !!(d.dok && d.dok.seiten && d.dok.seiten.some(s => s.hatBild));
      d.ocr = bild || /^image\//.test(f.type || "");
      if (!d.text.trim() && !bild) d.fehler = T("keinText");
      if (r.warnungen && r.warnungen.length) meldung(d.name + ": " + r.warnungen[0], 6000);
    } catch (e) { d.fehler = e.message || String(e); }
    d.laedt = false; d.info = "";
    d.seiten = d.dok && d.dok.seiten ? d.dok.seiten.length : Math.max(1, Math.ceil((d.text || "").length / 3000));
    zeigen();
  }
}
function textAlsDok(t) {
  S.doks.push({ id: rid(), name: T("eingefuegt"), text: t, seiten: Math.max(1, Math.ceil(t.length / 3000)) });
  S.seite = "haupt"; zeigen();
}

/* ---------- Kamera (App): mehrere Seiten scannen ---------- */
async function kameraStart() {
  if (!freigeschaltet()) return;
  S.kam = []; S.kamFehler = false; S.seite = "kamera"; zeigen();
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("x");
    S.kamStrom = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch (e) { S.kamStrom = null; S.kamFehler = true; }
  if (S.seite === "kamera") zeigen(); else kameraStop();
}
function kameraStop() { if (S.kamStrom) { S.kamStrom.getTracks().forEach(t => t.stop()); S.kamStrom = null; } }
async function scanSeite() {
  const v = $("kamVideo");
  if (S.kamStrom && v && v.videoWidth) {
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0);
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
    if (b) { S.kam.push(b); zeigen(); }
  } else $("shFoto").click();
}
async function scanFertig() {
  const seiten = S.kam.slice(); kameraStop(); S.kam = []; S.seite = "haupt";
  const nr = S.doks.filter(d => d.scan).length + 1;
  const d = { id: rid(), name: T("scanN", nr), laedt: true, info: "", scan: true, ocr: true, seiten: seiten.length };
  S.doks.push(d); zeigen();
  const texte = [];
  for (let i = 0; i < seiten.length; i++) {
    try {
      const f = new File([seiten[i]], "scan_" + (i + 1) + ".jpg", { type: "image/jpeg" });
      const r = await ShieldDokBasis.lesen(f, { fortschritt: (a, m) => { d.info = T("teilVon", i + 1, seiten.length) + " · " + m; zeigenSanft(); } });
      if (r.text && r.text.trim()) texte.push(r.text.trim());
    } catch (e) { /* Seite ohne Text */ }
  }
  d.text = texte.join("\n\n"); d.laedt = false; d.info = "";
  if (!d.text) d.fehler = T("keinText");
  zeigen();
}

/* ---------- Lizenz ---------- */
function b64Text(s) { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); return new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); }
async function lizenzUebernehmen(t) {
  t = (t || "").trim();
  if (!t) { S.lizFehler = T("lizLeer"); return zeigen(); }
  const ml = /lizenz=([A-Za-z0-9_-]{40,})/.exec(t);          // kopierter Link des Knopfs «App Shield freischalten»
  if (ml) { try { t = b64Text(ml[1]); } catch (e) { S.lizFehler = T("linkKaputt"); return zeigen(); } }
  const r = await ShieldLizenz.pruefen(t);
  if (!r.ok) { S.lizFehler = r.fehler; return zeigen(); }
  LIZ.lizenz = { daten: r.daten, text: t }; await lizSichern();
  S.lizBox = false; S.lizText = ""; S.lizFehler = "";
  zeigen(); meldung(T("freigeschaltetDanke"), 4000);
}

/* ---------- Klicks ---------- */
async function klick(ev) {
  const ph = ev.target.closest && ev.target.closest("#vtext .ph, #vtext .ph-aus");
  if (ph) {
    if (ph.classList.contains("ph")) { ph.textContent = S.sitzung.karte[ph.dataset.p] || ph.dataset.p; ph.className = "ph-aus"; }
    else { ph.textContent = ph.dataset.p; ph.className = "ph"; }
    S.pruef.html = $("vtext").innerHTML; return;
  }
  const a0 = ev.target.closest && ev.target.closest("a[data-url]");
  if (a0) { ev.preventDefault(); return oeffne(a0.dataset.url); }
  const t = ev.target.closest && ev.target.closest("[data-act],[data-go],[data-ki],[data-oa],[data-vor],[data-lesen],[data-weg],[data-bweg],[data-spr],[data-kopie]");
  if (!t || t.disabled) return;
  const d = t.dataset;
  if (d.go) {
    if (d.go === "haupt") neu();
    else { S.seite = d.go; S.vorL = false; }
    return zeigen();
  }
  if (d.ki) { P.kiOeffnen(d.ki); return; }
  if (d.oa !== undefined) { const i = +d.oa; S.offenA = S.offenA === i ? -1 : i; S.vorschauA = -1; return zeigen(); }
  if (d.vor !== undefined) { const i = +d.vor; S.vorschauA = S.vorschauA === i ? -1 : i; return zeigen(); }
  if (d.lesen) { S.lesenId = d.lesen; S.seite = "lesen"; S.vorL = false; return zeigen(); }
  if (d.weg) { S.doks = S.doks.filter(x => x.id !== d.weg); return zeigen(); }
  if (d.bweg !== undefined) { const l = eigeneListe(); l.splice(+d.bweg, 1); EINST.eigene = l.join("\n"); einstSichern(); return zeigen(); }
  if (d.spr) { EINST.sprache = d.spr; einstSichern(); zeigen(); return meldung(T("spracheGesetzt", d.spr === "auto" ? T("automatisch") : t.textContent)); }
  if (d.kopie) return P.editor && P.editor(d.kopie);
  const e = aktuelle(), eL = UEB.find(x => x.id === S.lesenId);
  switch (d.act) {
    case "kaufen": return oeffne(ShieldLizenz.KAUF_URL);
    case "dok": return $("shDatei").click();
    case "kamera": return kameraStart();
    case "los": return los(false);
    case "teile": return los(true);
    case "claude": return P.kiOeffnen("Claude");
    case "senden": { const box = $("vtext"); return senden(box ? box.textContent : ""); }
    case "pruefZurueck": S.seite = "haupt"; S.sitzung.dokNr = S.dokNrVorher; S.zustand = S.sitzung.eintraege.length ? "antwort" : "eingabe"; return zeigen();
    case "markieren": {
      const sel = getSelection(), box = $("vtext");
      if (!sel || sel.isCollapsed || !box.contains(sel.anchorNode)) return meldung(T("markZuerst"));
      const wort = sel.toString().trim(); if (!wort) return meldung(T("markZuerst"));
      let n = 1; while (S.sitzung.karte["[Ergänzt " + n + "]"]) n++;
      const p = "[Ergänzt " + n + "]"; S.sitzung.karte[p] = wort;
      const sp = document.createElement("span"); sp.className = "ph"; sp.dataset.p = p; sp.textContent = p;
      const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(sp); sel.removeAllRanges();
      S.pruef.html = box.innerHTML; return;
    }
    case "abbrechen": lauf++; S.sitzung.dokNr = S.dokNrVorher; S.zustand = S.sitzung.eintraege.length ? "antwort" : "eingabe"; zeigen(); return meldung(T("abgebrochen"));
    case "inverlauf": if (e && !UEB.some(x => x.id === e.id)) { UEB.unshift(e); uebSichern(); meldung(T("gespeichertVerlauf")); } return zeigen();
    case "kop": if (e) meldung(await kopieren(antwortEcht(e)) ? T("kopiert") : T("kopierenNein")); return;
    case "speichern": return e && speichern([e]);
    case "teilen": return e && teilen([e]);
    case "naechsterTeil": if (S.offen && S.offen.teile) { S.offen.teilNr++; sitzungSichern(); meldung(await kopieren(S.offen.teile[S.offen.teilNr]) ? T("kopiertTeil", S.offen.teilNr + 1, S.offen.teile.length) : T("kopierenNein")); } return zeigen();
    case "nochmal": if (S.offen) meldung(await kopieren(S.offen.teile ? S.offen.teile[S.offen.teilNr] : S.offen.basis.gesendet) ? T("kopiertTeil", (S.offen.teilNr || 0) + 1, S.offen.teile ? S.offen.teile.length : 1) : T("kopierenNein")); return;
    case "zurueck": if (S.offen) S.sitzung.dokNr = S.offen.dokNrVorher || 0; S.offen = null; S.fehler = ""; S.zustand = S.sitzung.eintraege.length ? "antwort" : "eingabe"; sitzungSichern(); return zeigen();
    case "einfuegen": return einfuegen();
    case "uniFertig": return antwortUebernehmen(S.antwortFeld);
    case "scanSeite": return scanSeite();
    case "scanFertig": return scanFertig();
    case "kamZurueck": kameraStop(); S.kam = []; S.seite = "haupt"; return zeigen();
    case "vSpeichern": { const l = gewaehlte(); if (l.length) speichern(l); return; }
    case "vTeilen": { const l = gewaehlte(); if (l.length) teilen(l); return; }
    case "vLoeschen": {
      const l = gewaehlte(); if (!l.length || !confirm(T("loeschenFrage", l.length))) return;
      UEB = UEB.filter(x => !S.wahl.has(x.id)); S.wahl.clear(); uebSichern(); zeigen(); return meldung(T("geloescht"));
    }
    case "vorL": S.vorL = !S.vorL; return zeigen();
    case "lKop": if (eL) meldung(await kopieren(antwortEcht(eL)) ? T("kopiert") : T("kopierenNein")); return;
    case "lSpeichern": return eL && speichern([eL]);
    case "lTeilen": return eL && teilen([eL]);
    case "lLoeschen": if (!eL || !confirm(T("loeschenEins", eL.titel))) return;
      UEB = UEB.filter(x => x.id !== eL.id); S.wahl.delete(eL.id); uebSichern(); S.seite = "verlauf"; zeigen(); return meldung(T("geloescht"));
    case "lizBox": S.lizBox = !S.lizBox; S.lizFehler = ""; return zeigen();
    case "lizDatei": return $("shLiz").click();
    case "lizOk": return lizenzUebernehmen(S.lizText);
    case "verlaufWeg": if (!confirm(T("alleLoeschen"))) return; UEB = []; S.wahl.clear(); uebSichern(); zeigen(); return meldung(T("alleGeloescht"));
    case "begriffDazu": {
      const v = (S.neuBegriff || "").trim(); if (!v) return meldung(T("begriffZuerst"));
      const l = eigeneListe(); if (!l.some(x => x.toLowerCase() === v.toLowerCase())) l.push(v);
      EINST.eigene = l.join("\n"); S.neuBegriff = ""; einstSichern(); zeigen();
      const b = $("sh").querySelector(".begriffe"); if (b) b.scrollTop = b.scrollHeight;
      const f = $("sh").querySelector('[data-feld="neuBegriff"]'); if (f) f.focus(); return;
    }
    case "hilfe": return oeffne("https://www.dexxus.ch/hilfe.html#block-sh");
    case "universal": EINST.ki = EINST.ki === "universal" ? "auto" : "universal"; einstSichern(); zeigen(); kiPruefen(); return meldung(T(EINST.ki === "universal" ? "universalAn" : "universalAus"), 4500);
    case "empfehlen": {
      const tx = T("empfehlenText"), u = "https://dexxus.ch/app-shield/";
      if (navigator.share) { try { await navigator.share({ title: "App Shield", text: tx, url: u }); } catch (x) { /* abgebrochen */ } }
      else meldung(await kopieren(tx + " " + u) ? T("kopiert") : T("kopierenNein"));
      return;
    }
    case "spAnfordern": {
      const name = S.spName.trim(), firma = S.spFirma.trim(), mail = S.spMail.trim();
      S.spInfoRot = true;
      if (!name) S.spInfo = T("spFehlerName");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) S.spInfo = T("spFehlerMail");
      else if (!S.spAgb) S.spInfo = T("spFehlerAgb");
      else {
        const text = ["Bitte senden Sie mir eine Gratis-Test-Lizenz (30 Tage) für DEXXUS WEB Shield / App Shield.", "", "Name: " + name, "Firma: " + (firma || "-"), "E-Mail: " + mail, "Gerät: Mobile (App Shield)", "Sprache: " + sprache(), "AGB akzeptiert: ja"].join("\n");
        location.href = "mailto:info@dexxus.ch?subject=" + encodeURIComponent("Gratis-Test App Shield: " + name) + "&body=" + encodeURIComponent(text);
        S.spInfoRot = false; S.spInfo = T("spInfoOk");
      }
      return zeigen();
    }
    case "install": return P.install && P.install();
    case "installSpaeter": if (P.installSpaeter) P.installSpaeter(); return zeigen();
  }
}

/* ---------- Eingaben ---------- */
function eingabe(ev) {
  const f = ev.target.dataset && ev.target.dataset.feld; if (!f) return;
  S[f] = ev.target.value;
  if (ev.target.tagName === "TEXTAREA") wachsen(ev.target);
  if (f === "text" || f === "frage") { const z = $("zaehler"); if (z) z.innerHTML = zaehlerHTML(); }
}
function aenderung(ev) {
  const t = ev.target, d = t.dataset || {};
  if (d.chk) { EINST[d.chk] = t.checked; einstSichern(); }
  else if (d.chk2) S[d.chk2] = t.checked;
  else if (d.wahl) { if (t.checked) S.wahl.add(d.wahl); else S.wahl.delete(d.wahl); }
}
function taste(ev) {
  const f = ev.target.dataset && ev.target.dataset.feld;
  if (ev.key === "Enter" && ev.ctrlKey && (f === "frage" || f === "text") && S.seite === "haupt" && !keineKI()) { ev.preventDefault(); los(false); }
  else if (ev.key === "Enter" && f === "neuBegriff") { ev.preventDefault(); klick({ target: $("sh").querySelector('[data-act="begriffDazu"]') }); }
}

/* ---------- KI-Status (nur PC) ---------- */
let kiLaeuft = false;
async function kiPruefen() {
  if (APP || kiLaeuft) return;
  kiLaeuft = true;
  try {
    const n = await P.kiStatus();
    if (n !== S.ki) {
      S.ki = n;
      if (n && KIS.includes(n) && EINST.letzteKI !== n) { EINST.letzteKI = n; einstSichern(); }
      if (S.seite === "haupt") zeigen();
    }
  } catch (e) { /* später nochmals */ }
  kiLaeuft = false;
}

/* ---------- Vorführung (App: Werbebilder ?ansicht=1..4 und Verkaufsseite) – erfundene Daten, nichts wird gespeichert ---------- */
function vorfuehren(n) {
  S.demo = true; neu();
  const auftrag = T("demoAuftrag");
  const brief = "Sehr geehrte Frau Erika Muster\n\nIhre Rechnung Nr. 2026-118 über CHF 1'250.00 ist noch offen. Bitte überweisen Sie auf IBAN CH93 0076 2011 6238 5295 7.\n\nFreundliche Grüsse\nHans Beispiel, Beispiel AG";
  S.text = brief; S.frage = auftrag;
  if (n === 1) return zeigen();
  const r = ShieldEngine.anonymisieren(brief + "\n\nFrage/Auftrag: " + auftrag, [], {}, { datum: true });
  S.sitzung.karte = r.karte;
  const basis = { frage: auftrag, text: brief, doks: [], gesendet: r.text };
  if (n === 2) { S.offen = { basis, teile: null, teilNr: 0 }; S.zustand = "kopiert"; return zeigen(); }
  const ph = Object.keys(r.karte), personen = ph.filter(k => k.startsWith("[Person")).sort((a, b) => (/Erika/.test(r.karte[b]) ? 1 : 0) - (/Erika/.test(r.karte[a]) ? 1 : 0));
  const iban = ph.find(k => k.startsWith("[IBAN")) || "";
  const antwort = "Freundliche Zahlungserinnerung\n\nSehr geehrte Frau " + (personen[0] || "") + "\n\nsicher ist es Ihnen entgangen: Unsere Rechnung Nr. 2026-118 über CHF 1'250.00 ist noch offen. Wir danken Ihnen, wenn Sie den Betrag in den nächsten 10 Tagen auf " + iban + " überweisen.\n\nFreundliche Grüsse\n" + (personen[1] || "");
  const e = { id: "v1", frage: auftrag, text: brief, doks: [], gesendet: r.text, zeit: new Date().toISOString(), antwortRoh: antwort, karte: r.karte, titel: T("demoTitel") };
  S.sitzung.eintraege = [e]; S.text = ""; S.frage = ""; S.zustand = "antwort"; S.offenA = 0;
  UEB = [e,
    { id: "v2", frage: "Fasse den Mietvertrag in 3 Punkten zusammen", doks: ["Mietvertrag.pdf"], zeit: new Date(Date.now() - 864e5).toISOString(), antwortRoh: "1. Mieter: Hans Beispiel\n2. Mietzins CHF 1'850.– pro Monat\n3. Kündigungsfrist 3 Monate", karte: {}, titel: "Mietvertrag in 3 Punkten" },
    { id: "v3", frage: "Antworte höflich auf die Reklamation", doks: [], zeit: new Date(Date.now() - 2 * 864e5).toISOString(), antwortRoh: "Sehr geehrte Damen und Herren der Muster AG, vielen Dank für Ihre Rückmeldung …", karte: {}, titel: "Antwort auf Reklamation" }];
  if (n === 3) return zeigen();
  S.seite = "verlauf"; zeigen();
}

/* ---------- Start ---------- */
function dateiFeld(id, accept, multiple, capture, fn) {
  const i = document.createElement("input"); i.type = "file"; i.id = id; i.hidden = true; i.accept = accept;
  if (multiple) i.multiple = true; if (capture) i.setAttribute("capture", capture);
  i.onchange = () => { const l = [...i.files]; i.value = ""; if (l.length) fn(l); };
  document.body.appendChild(i);
}
async function start() {
  EINST = Object.assign(EINST, await P.speicher.get(K.einst, {}));
  LIZ = Object.assign(LIZ, await P.speicher.get(K.liz, {}));
  if (!APP && !LIZ.start) { LIZ.start = ShieldLizenz.heute(); await lizSichern(); }
  if (APP) {                                                    // Freischalt-Link aus der Lizenz-Mail (#lizenz=… oder ?lizenz=…)
    const hl = /[#&]lizenz=([A-Za-z0-9_-]+)/.exec(location.hash) || /[?&]lizenz=([A-Za-z0-9_-]+)/.exec(location.search);
    if (hl) {
      history.replaceState(null, "", location.pathname + (/[?&]app=1/.test(location.search) ? "?app=1" : ""));
      let t = ""; try { t = b64Text(hl[1]); } catch (e) { /* kaputt */ }
      const r = t ? await ShieldLizenz.pruefen(t) : { ok: false, fehler: T("linkKaputt") };
      if (r.ok) { LIZ.lizenz = { daten: r.daten, text: t }; await lizSichern(); setTimeout(() => meldung(T("freigeschaltetDanke"), 5000), 300); }
      else S.lizFehler = r.fehler;
    }
  }
  if (LIZ.lizenz && !P.ohnePruefung) {                          // gespeicherte Lizenz bei jedem Start neu prüfen
    const r = LIZ.lizenz.text ? await ShieldLizenz.pruefen(LIZ.lizenz.text) : { ok: false };
    if (!r.ok && (APP || !r.daten)) { LIZ.lizenz = null; await lizSichern(); }
  }
  UEB = await P.speicher.get(K.ueb, []);
  if (K.sitzung) {
    const s = await P.speicher.get(K.sitzung, null);
    if (s && s.karte) { S.sitzung = Object.assign(neueSitzung(), s); if (S.sitzung.eintraege.length) S.zustand = "antwort"; }
    const o = await P.speicher.get(K.offen, null);
    if (o && o.basis) S.offen = o;
    else if (o && o.gesendet) S.offen = { basis: { frage: o.frage || "", text: "", doks: o.doks || [], gesendet: o.gesendet }, teile: null, teilNr: 0 };   // altes Format
    if (S.offen) S.zustand = "kopiert";
  }
  dateiFeld("shDatei", ShieldDokBasis.akzeptiert, true, null, dateienHinzu);
  dateiFeld("shLiz", ".dxlic,.json,.txt", false, null, async l => { let t = ""; try { t = await l[0].text(); } catch (e) { /* nein */ } lizenzUebernehmen(t); });
  dateiFeld("shFoto", "image/*", false, "environment", l => { S.kam.push(l[0]); zeigen(); });
  const root = $("sh");
  root.addEventListener("click", klick);
  root.addEventListener("input", eingabe);
  root.addEventListener("change", aenderung);
  root.addEventListener("keydown", taste);
  // Dokumente hineinziehen (überall auf der Seite) und einfügen (Strg+V)
  ["dragenter", "dragover"].forEach(n => document.addEventListener(n, e => { if (!e.dataTransfer || ![...(e.dataTransfer.types || [])].includes("Files")) return; e.preventDefault(); const a = $("ablage"); if (a) a.classList.add("drueber"); }));
  document.addEventListener("dragleave", e => { if (e.target === document.documentElement || !e.relatedTarget) { const a = $("ablage"); if (a) a.classList.remove("drueber"); } });
  document.addEventListener("drop", async e => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault(); const a = $("ablage"); if (a) a.classList.remove("drueber");
    const fs = [...e.dataTransfer.files];
    if (S.seite === "einstellungen" || /\.dxlic$/i.test(fs[0].name)) return lizenzUebernehmen(await fs[0].text());
    if (S.zustand === "laeuft" || S.zustand === "kopiert") return;
    dateienHinzu(fs);
  });
  document.addEventListener("paste", e => {
    const t = e.target, feldName = t && t.dataset && t.dataset.feld;
    if (APP && feldName === "antwortFeld") { setTimeout(() => antwortUebernehmen(S.antwortFeld), 150); return; }
    if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) return;
    if (S.seite !== "haupt" || S.zustand === "laeuft" || S.zustand === "kopiert" || !freigeschaltet()) return;
    const cd = e.clipboardData; if (!cd) return;
    if (cd.files && cd.files.length) { e.preventDefault(); return dateienHinzu([...cd.files]); }
    const tx = cd.getData("text/plain"); if (tx && tx.trim()) { e.preventDefault(); textAlsDok(tx.trim()); }
  });
  if (APP) document.addEventListener("visibilitychange", () => {            // zurück aus der KI-App: «Antwort einfügen» hervorheben
    if (document.visibilityState !== "visible" || S.zustand !== "kopiert") return;
    const k = $("sh").querySelector('[data-act="einfuegen"]'); if (!k) return;
    k.scrollIntoView({ behavior: "smooth", block: "center" }); k.classList.add("puls"); setTimeout(() => k.classList.remove("puls"), 2400);
  });
  zeigen();
  kiPruefen();
  try { ShieldEngine.orteSetzen(await (await fetch("orte_ch.txt")).text()); } catch (e) { /* ohne Ortsliste weiter */ }
  if (P.nachStart) P.nachStart();
}

window.ShieldUI = { S, T, zeigen, kiPruefen, vorfuehren, dateienHinzu, meldung, kopieren, neu, freigeschaltet,
  sprache, einst: () => EINST, eigeneListe, start, _test: { kiFloskelnEntfernen, alsDokument, teileBauen, pdfBauen, alsText, titelAus } };
start();
})();
