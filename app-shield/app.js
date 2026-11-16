/* App Shield – DEXXUS WEB Shield für das Mobile (Web-App).
   Ablauf (17.11.2026 vereinfacht, ein Schritt pro Bildschirm): 1 Eingeben → Schwärzen und kopieren → 2 KI öffnen, einfügen → «Antwort einfügen» → 3 Antwort mit echten Namen: Kopieren / Teilen / Speichern.
   Alles lokal im Handy-Browser (localStorage), nichts wird hochgeladen. Engine/Lizenz/Dokumente wie in der PC-Erweiterung. */
"use strict";
const $ = id => document.getElementById(id);
const speicher = {
  get: (k, std) => { try { const v = localStorage.getItem("ws_" + k); return v === null ? std : JSON.parse(v); } catch (e) { return std; } },
  set: (k, v) => { try { localStorage.setItem("ws_" + k, JSON.stringify(v)); } catch (e) { meldung("Speichern im Handy nicht möglich (privater Modus?)."); } }
};
let EINST = Object.assign({ datum: true, hinweis: true, eigene: "" }, speicher.get("einstellungen", {}));
let LIZ = speicher.get("lizenz", {});
// 17.11.2026: kein automatischer Gratis-Test mehr – nur mit gültiger Lizenz (Kauf oder angeforderter 30-Tage-Test)
const freigeschaltet = () => !!(LIZ.lizenz && LIZ.lizenz.daten) && ShieldLizenz.status(LIZ).art === "abo";
function sperreZeigen() {
  const zu = !freigeschaltet();
  document.body.classList.toggle("gesperrt", zu); $("sperre").hidden = !zu;
}
let SITZUNG = speicher.get("sitzung", null) || neueSitzung();
let UEB = speicher.get("uebersicht", []);
let DOKS = [], WAHL = new Set(), OFFEN = null;     // OFFEN: gesendeter Auftrag, wartet auf Antwort

function stufe(n) {
  document.querySelectorAll(".stufe").forEach(x => { const k = +x.dataset.s; x.classList.toggle("an", k === n); x.classList.toggle("ok", k < n); x.querySelector("i").textContent = k < n ? "✓" : k; });
}
function neueSitzung() { return { karte: {}, eintraege: [], hinweisGesendet: false, dokNr: 0 }; }
function sitzungSichern() { speicher.set("sitzung", SITZUNG); }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const datum = iso => new Date(iso).toLocaleString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
function meldung(t, ms) { const m = $("meldung"); m.textContent = t; m.hidden = false; clearTimeout(meldung.t); meldung.t = setTimeout(() => { m.hidden = true; }, ms || 3000); }
async function kopieren(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (e) { const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; }
}

/* ---------- Banner / Lizenz ---------- */
function bannerZeigen() {
  const st = ShieldLizenz.status(LIZ), b = $("aboBanner");
  sperreZeigen();
  b.className = "abo-banner" + (st.art === "abo" ? " ok" : "");
  b.innerHTML = "<span>" + esc(st.text) + "</span><a href=\"" + ShieldLizenz.KAUF_URL + "\" target=\"_blank\" rel=\"noopener\">Jetzt kaufen</a>";
  $("lizStatus").className = "liz-status" + (st.art === "abo" ? " ok" : "");
  $("lizStatus").textContent = st.art === "abo" ? st.text : st.art === "test" ? st.text : "Gratis-Version";
}
async function lizenzUebernehmen(t, fehler) {
  t = (t || "").trim(); if (!t) { fehler("Bitte die Lizenz aus der E-Mail einfügen."); return false; }
  const r = await ShieldLizenz.pruefen(t);
  if (!r.ok) { fehler(r.fehler); return false; }
  LIZ.lizenz = { daten: r.daten, text: t }; speicher.set("lizenz", LIZ); bannerZeigen();
  meldung("Freigeschaltet – danke!", 4000); return true;
}
$("lizUebernehmen").onclick = async () => {
  if (await lizenzUebernehmen($("lizText").value, f => { $("lizStatus").className = "liz-status leer"; $("lizStatus").textContent = f; })) $("lizText").value = "";
};
$("spUebernehmen").onclick = async () => {
  $("spFehler").hidden = true;
  if (await lizenzUebernehmen($("spLizenz").value, f => { $("spFehler").textContent = f; $("spFehler").hidden = false; })) $("spLizenz").value = "";
};
// Lizenz-Datei (.dxlic) aus dem E-Mail-Anhang wählen
async function lizenzDatei(inp, fehler, ok) {
  const f = inp.files && inp.files[0]; inp.value = ""; if (!f) return;
  let t = ""; try { t = await f.text(); } catch (e) { return fehler("Datei konnte nicht gelesen werden."); }
  if (await lizenzUebernehmen(t, fehler)) ok();
}
$("spLizDatei").onchange = e => { $("spFehler").hidden = true; lizenzDatei(e.target, f => { $("spFehler").textContent = f; $("spFehler").hidden = false; }, () => {}); };
$("lizDatei").onchange = e => lizenzDatei(e.target, f => { $("lizStatus").className = "liz-status leer"; $("lizStatus").textContent = f; }, () => {});
$("spAnfordern").onclick = () => {
  const name = $("spName").value.trim(), firma = $("spFirma").value.trim(), mail = $("spMail").value.trim(), info = $("spInfo");
  info.className = "sp-info rot"; info.hidden = false;
  if (!name) { info.textContent = "Bitte Vorname und Name eingeben."; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { info.textContent = "Bitte eine gültige E-Mail-Adresse eingeben."; return; }
  if (!$("spAgb").checked) { info.textContent = "Bitte die AGB akzeptieren."; return; }
  const text = ["Bitte senden Sie mir eine Gratis-Test-Lizenz (30 Tage) für DEXXUS WEB Shield / App Shield.", "", "Name: " + name, "Firma: " + (firma || "-"), "E-Mail: " + mail, "Gerät: Mobile (App Shield)", "AGB akzeptiert: ja"].join("\n");
  location.href = "mailto:info@dexxus.ch?subject=" + encodeURIComponent("Gratis-Test App Shield: " + name) + "&body=" + encodeURIComponent(text);
  info.className = "sp-info";
  info.textContent = "Ihr E-Mail-Programm öffnet sich – bitte dort auf «Senden» tippen. Die Test-Lizenz kommt per E-Mail; dann oben einfügen.";
};

/* ---------- Schritte: immer nur ein Bildschirm sichtbar (17.11.2026 vereinfacht) ---------- */
let AKTUELL = null;          // Antwort, die in Schritt 3 oder im Verlauf offen ist
function zeigeSchritt(n) {
  [1, 2, 3].forEach(k => { $("schritt" + k).hidden = k !== n; });
  stufe(n);
  if (n === 1) themaZeigen();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function themaZeigen() {
  const n = SITZUNG.eintraege.length, t = $("themaInfo");
  t.hidden = !n;
  if (n) t.innerHTML = "Gleiches Thema · " + n + " Antwort" + (n === 1 ? "" : "en") + " · bekannte Namen bleiben geschwärzt <button class=\"link\" id=\"themaNeu\">Neues Thema</button>";
  if (n) $("themaNeu").onclick = neuesThema;
  $("textFeld").placeholder = n ? "Weitere Frage oder weiterer Auftrag, z. B. «Mach es kürzer»"
    : "Text einfügen oder Frage/Auftrag schreiben, z. B. Brief an Frau Muster … «Mach daraus eine freundliche Mahnung»";
}

/* ---------- Dokumente (Foto, PDF, Word, Text) ---------- */
async function dateienHinzu(liste) {
  if (!freigeschaltet()) { sperreZeigen(); return; }
  for (const f of liste) {
    const d = { id: Math.random().toString(36).slice(2), name: f.name || "Foto.jpg", laedt: true, info: "" };
    DOKS.push(d); dokListeZeigen();
    try {
      const r = await ShieldDokBasis.lesen(f, { fortschritt: (a, m) => { d.info = m; dokListeZeigen(); } });
      d.text = r.text; if (!d.text.trim()) d.fehler = "kein Text gefunden";
    } catch (e) { d.fehler = e.message; }
    d.laedt = false; dokListeZeigen();
    if (d.fehler) meldung(d.name + ": " + d.fehler, 5000);
  }
}
function dokListeZeigen() {
  $("dokListe").innerHTML = DOKS.map(d => '<div class="dok' + (d.laedt ? " laedt" : d.fehler ? " fehler" : "") + '"><span>' + esc(d.name) + '</span><small>' +
    (d.laedt ? esc(d.info || "wird gelesen …") : d.fehler ? esc(d.fehler) : d.text.length.toLocaleString("de-CH") + " Zeichen") +
    '</small><button data-weg="' + d.id + '" aria-label="entfernen">&times;</button></div>').join("");
  $("dokListe").querySelectorAll("[data-weg]").forEach(b => b.onclick = () => { DOKS = DOKS.filter(x => x.id !== b.dataset.weg); dokListeZeigen(); });
  const laeuft = DOKS.some(d => d.laedt), ok = DOKS.filter(d => !d.laedt && !d.fehler && d.text).length, box = $("dokBereit");
  if (laeuft) { box.hidden = false; box.className = "dok-bereit laedt"; box.innerHTML = "Dokument wird gelesen …<small>bitte einen Moment</small>"; }
  else if (ok) {
    const leer = !$("textFeld").value.trim();
    box.hidden = false; box.className = "dok-bereit";
    box.innerHTML = (ok === 1 ? "Dokument bereit" : ok + " Dokumente bereit") + "<small>" + (leer ? "Jetzt oben schreiben, was die KI tun soll." : "Jetzt «Schwärzen und kopieren» tippen.") + "</small>";
    $("textFeld").classList.toggle("dran", leer);
  } else { box.hidden = true; $("textFeld").classList.remove("dran"); }
}
$("fotoWahl").onchange = e => { dateienHinzu([...e.target.files]); e.target.value = ""; };
$("dateiWahl").accept = ShieldDokumente.akzeptiert;
$("dateiWahl").onchange = e => { dateienHinzu([...e.target.files]); e.target.value = ""; };
$("textFeld").addEventListener("input", dokListeZeigen);

/* ---------- 1 → 2: Schwärzen und kopieren ---------- */
$("knopfSchwaerzen").onclick = async () => {
  if (!freigeschaltet()) { sperreZeigen(); meldung("Bitte zuerst App Shield freischalten (Gratis-Test oder Lizenz).", 5000); return; }
  if (DOKS.some(d => d.laedt)) return meldung("Dokument wird noch gelesen …");
  const text = $("textFeld").value.trim(), doks = DOKS.filter(d => !d.fehler && d.text);
  if (!text && !doks.length) return meldung("Bitte Text oder Frage/Auftrag eingeben – oder ein Foto/eine Datei wählen.");
  let roh = "";
  doks.forEach(d => { SITZUNG.dokNr++; roh += "--- Dokument " + SITZUNG.dokNr + " ---\n" + d.text.trim() + "\n\n"; });
  if (text) roh += (doks.length ? "Frage/Auftrag: " : "") + text;
  roh = roh.trim();
  const eigene = (EINST.eigene || "").split(/\r?\n/).map(s => s.trim()).filter(s => s.length >= 2);
  const vorher = Object.keys(SITZUNG.karte).length;
  const r = ShieldEngine.anonymisieren(roh, eigene, SITZUNG.karte, { datum: EINST.datum });
  SITZUNG.karte = r.karte;
  const gesendet = (EINST.hinweis && !SITZUNG.hinweisGesendet ? ShieldEngine.hinweisKI : "") + r.text;
  SITZUNG.hinweisGesendet = SITZUNG.hinweisGesendet || EINST.hinweis;
  const neu = Object.keys(r.karte).length - vorher;
  OFFEN = { frage: text, text: "", doks: doks.map(d => d.name), gesendet, zeit: new Date().toISOString(), neu, vorher };
  speicher.set("offen", OFFEN); sitzungSichern();
  LIZ = ShieldLizenz.zaehlen(LIZ); speicher.set("lizenz", LIZ);
  const ok = await kopieren(gesendet);
  schritt2Zeigen(ok);
};
function schritt2Zeigen(kopiert) {
  const neu = OFFEN.neu || 0;
  $("kopiertInfo").innerHTML = (kopiert ? "Geschwärzt und kopiert" : "Geschwärzt – bitte «Nochmals kopieren» tippen") +
    "<small>" + (neu ? neu + " persönliche Angabe" + (neu === 1 ? "" : "n") + " ersetzt." : OFFEN.vorher ? "Bekannte Angaben bleiben geschwärzt." : "Keine persönlichen Angaben gefunden.") + "</small>";
  $("vorschau").innerHTML = esc(OFFEN.gesendet).replace(/\[[^\]]+ \d+\]/g, m => '<span class="platz">' + m + '</span>');
  $("vorschau").hidden = true; $("antwortFeld").hidden = true; $("antwortFeld").value = "";
  zeigeSchritt(2);
}
$("knopfNochmal").onclick = async () => { if (OFFEN) meldung(await kopieren(OFFEN.gesendet) ? "Nochmals kopiert." : "Kopieren nicht möglich."); };
$("knopfVorschau").onclick = () => { $("vorschau").hidden = !$("vorschau").hidden; };
$("knopfZurueck").onclick = () => { OFFEN = null; speicher.set("offen", null); zeigeSchritt(1); };
// Zurück aus der KI-App: grossen Knopf «Antwort einfügen» hervorheben
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && OFFEN && !$("schritt2").hidden) {
    const k = $("knopfEinfuegen"); k.scrollIntoView({ behavior: "smooth", block: "center" });
    k.classList.add("puls"); setTimeout(() => k.classList.remove("puls"), 2400);
  }
});

/* ---------- 2 → 3: Antwort einfügen → echte Namen ---------- */
async function antwortUebernehmen(a) {
  a = (a || "").trim();
  if (!a) return meldung("Zuerst in der KI die Antwort kopieren.");
  if (!OFFEN) return meldung("Bitte zuerst «Schwärzen und kopieren».");
  if (a === OFFEN.gesendet.trim()) return meldung("Das ist noch Ihr eigener Text. Bitte in der KI die ANTWORT kopieren.", 5000);
  const e = { id: Math.random().toString(36).slice(2), frage: OFFEN.frage, text: "", doks: OFFEN.doks, gesendet: OFFEN.gesendet, zeit: OFFEN.zeit,
    antwort: a, karte: Object.assign({}, SITZUNG.karte), titel: (OFFEN.frage || OFFEN.doks.join(", ") || "Antwort").slice(0, 60) };
  SITZUNG.eintraege.push(e); sitzungSichern();
  UEB.unshift(e); speicher.set("uebersicht", UEB); $("anzUeb").textContent = UEB.length;
  OFFEN = null; speicher.set("offen", null);
  $("antwortFeld").value = ""; $("textFeld").value = ""; DOKS = []; dokListeZeigen();
  schritt3Zeigen(e);
}
function antwortHTML(e) {
  return ShieldEngine.deanonTeile(e.antwort, e.karte).map(x => x.t !== undefined ? esc(x.t) : '<span class="echt">' + esc(x.echt) + '</span>').join("");
}
function schritt3Zeigen(e) {
  AKTUELL = e;
  $("antwortAnzeige").innerHTML = antwortHTML(e);
  zeigeSchritt(3);
}
const antwortEcht = e => ShieldEngine.deanonymisieren(e.antwort, e.karte);
$("knopfEinfuegen").onclick = async () => {
  const feld = $("antwortFeld");
  if (!feld.hidden && feld.value.trim()) return antwortUebernehmen(feld.value);
  try { const t = await navigator.clipboard.readText(); if (t && t.trim()) return antwortUebernehmen(t); meldung("Zwischenablage ist leer – zuerst in der KI die Antwort kopieren.", 4000); }
  catch (x) { feld.hidden = false; feld.focus(); meldung("Bitte ins Feld tippen, lange drücken und «Einfügen» wählen.", 4000); }
};
// Einfügen ins Feld übernimmt die Antwort sofort
$("antwortFeld").addEventListener("paste", () => setTimeout(() => antwortUebernehmen($("antwortFeld").value), 150));

$("knopfWeiter").onclick = () => zeigeSchritt(1);
function neuesThema() {
  SITZUNG = neueSitzung(); sitzungSichern(); OFFEN = null; speicher.set("offen", null);
  $("textFeld").value = ""; DOKS = []; dokListeZeigen(); zeigeSchritt(1); meldung("Neues Thema – leere Zuordnung.");
}
$("knopfNeu").onclick = neuesThema;

/* ---------- Kopieren / Teilen / Speichern (gleich in Schritt 3 und im Verlauf) ---------- */
async function teilen(e) {
  const t = antwortEcht(e);
  if (navigator.share) { try { await navigator.share({ title: e.titel, text: t }); } catch (x) { /* abgebrochen */ } }
  else meldung(await kopieren(t) ? "Teilen nicht möglich – Antwort wurde kopiert." : "Teilen nicht möglich.");
}
function alsText(l) { return l.map(e => datum(e.zeit) + " – " + e.titel + "\n\n" + (e.frage ? "Frage/Auftrag: " + e.frage + "\n" : "") + "\nAntwort:\n" + antwortEcht(e) + "\n").join("\n------------------------------\n\n"); }
function alsHTML(l) {
  return '<html><head><meta charset="utf-8"><title>App-Shield-Antwort</title></head><body style="font-family:Arial;font-size:11pt;line-height:1.45;color:#0F172A">' +
    l.map(e => '<h2 style="font-size:13pt;color:#2563EB;margin:16pt 0 4pt">' + esc(e.titel) + '</h2><p style="color:#64748B;font-size:9pt">' + datum(e.zeit) + '</p>' +
      (e.frage ? '<p><b>Frage/Auftrag:</b> ' + esc(e.frage) + '</p>' : '') + '<div style="white-space:pre-wrap">' + esc(antwortEcht(e)) + '</div>').join("") + '</body></html>';
}
async function speichernAls(l, format) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  if (format === "pdf") {     // Mobile: Druckansicht öffnen, dort «Als PDF speichern» / «Teilen»
    const w = window.open("", "_blank"); if (!w) return meldung("Bitte Pop-ups erlauben.");
    w.document.write(alsHTML(l)); w.document.close(); setTimeout(() => w.print(), 400); return;
  }
  const blob = format === "txt" ? new Blob(["﻿" + alsText(l)], { type: "text/plain;charset=utf-8" }) : new Blob(["﻿" + alsHTML(l)], { type: "application/msword" });
  const name = "App-Shield-Antwort_" + stamp + "." + format;
  const datei = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) { try { await navigator.share({ files: [datei], title: name }); return; } catch (x) { /* abgebrochen → herunterladen */ } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  meldung("Gespeichert: " + name);
}
let SPEICHERN = null;
document.querySelectorAll("#fensterSpeichern [data-f]").forEach(b => b.onclick = () => { $("fensterSpeichern").hidden = true; if (SPEICHERN) speichernAls([SPEICHERN], b.dataset.f); });
async function aktion(art, e) {
  if (!e) return;
  if (art === "kopieren") return meldung(await kopieren(antwortEcht(e)) ? "Antwort kopiert." : "Kopieren nicht möglich.");
  if (art === "teilen") return teilen(e);
  SPEICHERN = e; $("fensterSpeichern").hidden = false;
}
document.querySelectorAll("[data-akt]").forEach(b => b.onclick = () => aktion(b.dataset.akt, AKTUELL));
document.querySelectorAll("[data-vakt]").forEach(b => b.onclick = () => aktion(b.dataset.vakt, VERLAUF_OFFEN));

/* ---------- Verlauf: antippen = öffnen, wischen rechts = kopieren, links = löschen ---------- */
let VERLAUF_OFFEN = null;
function uebersichtZeigen() {
  $("anzUeb").textContent = UEB.length;
  $("verlaufListe").hidden = false; $("verlaufEintrag").hidden = true;
  const q = $("suche").value.trim().toLowerCase();
  const liste = UEB.filter(e => !q || (e.titel + " " + antwortEcht(e) + " " + (e.frage || "")).toLowerCase().includes(q));
  if (!liste.length) { $("uebListe").innerHTML = '<div class="leer">' + (UEB.length ? "Nichts gefunden." : "Noch keine Antworten.<br>Jede Antwort wird hier automatisch gespeichert.") + '</div>'; return; }
  $("uebListe").innerHTML = liste.map(e => '<div class="wisch" data-wid="' + e.id + '"><div class="wisch-l">Kopieren</div><div class="wisch-r">Löschen</div>' +
    '<div class="ueb"><span class="t"><b>' + esc(e.titel) + '</b><small>' + datum(e.zeit) + '</small>' +
    '<span class="vorsch">' + esc(antwortEcht(e).slice(0, 140)) + '</span></span><span class="pfeil">›</span></div></div>').join("") +
    '<div class="wisch-tipp">Antippen = öffnen · nach rechts wischen = kopieren · nach links = löschen</div>';
  $("uebListe").querySelectorAll(".wisch").forEach(el => {
    wischEinrichten(el);
    el.addEventListener("click", () => { if (!el.dataset.gewischt) eintragOeffnen(el.dataset.wid); });
  });
}
function eintragOeffnen(id) {
  const e = UEB.find(x => x.id === id); if (!e) return;
  VERLAUF_OFFEN = e;
  $("eintragKopf").innerHTML = "<b>" + esc(e.titel) + "</b><small>" + datum(e.zeit) + (e.doks && e.doks.length ? " · " + esc(e.doks.join(", ")) : "") + "</small>";
  $("eintragAntwort").innerHTML = antwortHTML(e);
  $("verlaufListe").hidden = true; $("verlaufEintrag").hidden = false; window.scrollTo({ top: 0 });
}
$("knopfListe").onclick = uebersichtZeigen;
$("knopfEintragLoeschen").onclick = () => {
  const e = VERLAUF_OFFEN; if (!e || !confirm("Diese Antwort löschen? – «" + e.titel + "»")) return;
  UEB = UEB.filter(x => x.id !== e.id); speicher.set("uebersicht", UEB); VERLAUF_OFFEN = null; uebersichtZeigen(); meldung("Antwort gelöscht.");
};
$("suche").oninput = uebersichtZeigen;
async function wischAktion(id, richtung) {
  const e = UEB.find(x => x.id === id); if (!e) return;
  if (richtung > 0) { meldung(await kopieren(antwortEcht(e)) ? "Antwort kopiert." : "Kopieren nicht möglich."); return; }
  if (!confirm("Diese Antwort löschen? – «" + e.titel + "»")) return;
  UEB = UEB.filter(x => x.id !== id); speicher.set("uebersicht", UEB); uebersichtZeigen(); meldung("Antwort gelöscht.");
}
function wischEinrichten(el) {
  const karte = el.querySelector(".ueb"); let start = null, dx = 0, aktiv = false;
  const setzen = x => { dx = x; karte.style.transform = "translateX(" + x + "px)"; el.classList.toggle("links", x < -20); el.classList.toggle("rechts", x > 20); };
  const fertig = () => { karte.style.transition = "transform .18s"; const d = dx; setzen(0); setTimeout(() => { karte.style.transition = ""; el.classList.remove("links", "rechts"); }, 200); if (Math.abs(d) >= 90) wischAktion(el.dataset.wid, d); };
  el.addEventListener("pointerdown", e => { start = { x: e.clientX, y: e.clientY }; aktiv = false; });
  el.addEventListener("pointermove", e => {
    if (!start) return; const x = e.clientX - start.x, y = e.clientY - start.y;
    if (!aktiv && Math.abs(x) > 12 && Math.abs(x) > Math.abs(y) * 1.5) { aktiv = true; el.setPointerCapture(e.pointerId); }
    if (aktiv) { e.preventDefault(); setzen(Math.max(-160, Math.min(160, x))); }
  });
  const ende = () => { if (aktiv) { fertig(); el.dataset.gewischt = "1"; setTimeout(() => delete el.dataset.gewischt, 50); } start = null; aktiv = false; };
  el.addEventListener("pointerup", ende); el.addEventListener("pointercancel", ende);
  el.addEventListener("click", e => { if (el.dataset.gewischt) { e.preventDefault(); e.stopPropagation(); } }, true);
}

/* ---------- Reiter, Einstellungen ---------- */
document.querySelectorAll(".reiter button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".reiter button").forEach(x => x.classList.toggle("an", x === b));
  document.querySelectorAll(".ansicht").forEach(a => a.classList.toggle("an", a.id === b.dataset.r));
  if (b.dataset.r === "uebersicht") uebersichtZeigen();
  window.scrollTo({ top: 0 });
});
function reiterWechseln(name) { const b = document.querySelector('.reiter button[data-r="' + name + '"]'); if (b) b.click(); }
$("knopfEinst").onclick = () => { $("eDatum").checked = EINST.datum; $("eHinweis").checked = EINST.hinweis; $("eEigene").value = EINST.eigene || ""; bannerZeigen(); $("fensterEinst").hidden = false; };
document.querySelectorAll("[data-zu]").forEach(b => b.onclick = () => { b.closest(".fenster").hidden = true; });
document.querySelectorAll(".fenster").forEach(f => f.addEventListener("click", e => { if (e.target === f) f.hidden = true; }));
$("eSpeichern").onclick = () => { EINST = { datum: $("eDatum").checked, hinweis: $("eHinweis").checked, eigene: $("eEigene").value }; speicher.set("einstellungen", EINST); $("fensterEinst").hidden = true; meldung("Gespeichert."); };
$("eAllesLoeschen").onclick = () => { if (!confirm("Wirklich ALLE gespeicherten Antworten löschen?")) return; UEB = []; speicher.set("uebersicht", UEB); uebersichtZeigen(); meldung("Alle Antworten gelöscht."); };
$("eWhatsapp").href = "https://wa.me/?text=" + encodeURIComponent("Schau dir das an: App Shield schwärzt Namen, Adressen und IBAN, bevor sie zu ChatGPT, Claude & Co. gehen – direkt auf dem Mobile. https://dexxus.ch/app-shield/");

/* ---------- Vorführ-Ansichten für Werbebilder: index.html?ansicht=1..4 (erfundene Daten, nichts wird gespeichert) ---------- */
function vorfuehren(n) {
  speicher.set = () => {};                       // nichts speichern
  document.body.classList.remove("gesperrt"); $("sperre").hidden = true;
  $("aboBanner").className = "abo-banner ok"; $("aboBanner").innerHTML = "<span>Abo aktiv bis 31.12.2027</span>";
  SITZUNG = neueSitzung(); UEB = []; OFFEN = null;
  const auftrag = "Mach daraus eine freundliche Mahnung";
  const brief = "Sehr geehrte Frau Erika Muster\n\nIhre Rechnung Nr. 2026-118 über CHF 1'250.00 ist noch offen. Bitte überweisen Sie auf IBAN CH93 0076 2011 6238 5295 7.\n\nFreundliche Grüsse\nHans Beispiel, Beispiel AG";
  $("textFeld").value = brief + "\n\n" + auftrag;
  if (n === 1) { zeigeSchritt(1); return; }
  const r = ShieldEngine.anonymisieren(brief + "\n\n" + auftrag, [], {}, { datum: true });
  SITZUNG.karte = r.karte;
  const ph = Object.keys(r.karte);
  OFFEN = { frage: auftrag, text: "", doks: [], gesendet: r.text, zeit: new Date().toISOString(), neu: ph.length, vorher: 0 };
  if (n === 2) { schritt2Zeigen(true); return; }
  const personen = ph.filter(k => k.startsWith("[Person")).sort((a, b) => (/Erika/.test(r.karte[b]) ? 1 : 0) - (/Erika/.test(r.karte[a]) ? 1 : 0));
  const iban = ph.find(k => k.startsWith("[IBAN")) || "";
  const antwort = "Sehr geehrte Frau " + (personen[0] || "") + "\n\nsicher ist es Ihnen entgangen: Unsere Rechnung Nr. 2026-118 über CHF 1'250.00 ist noch offen. Wir danken Ihnen, wenn Sie den Betrag in den nächsten 10 Tagen auf " + iban + " überweisen.\n\nFreundliche Grüsse\n" + (personen[1] || "");
  const e = { id: "v1", frage: auftrag, text: "", doks: [], gesendet: r.text, zeit: new Date().toISOString(), antwort, karte: r.karte, titel: auftrag };
  SITZUNG.eintraege = [e];
  UEB = [e,
    { id: "v2", frage: "Fasse den Mietvertrag in 3 Punkten zusammen", doks: ["Mietvertrag.pdf"], zeit: new Date(Date.now() - 864e5).toISOString(), antwort: "1. Mieter: Hans Beispiel\n2. Mietzins CHF 1'850.– pro Monat\n3. Kündigungsfrist 3 Monate", karte: {}, titel: "Fasse den Mietvertrag in 3 Punkten zusammen" },
    { id: "v3", frage: "Antworte höflich auf die Reklamation", doks: [], zeit: new Date(Date.now() - 2 * 864e5).toISOString(), antwort: "Sehr geehrte Damen und Herren der Muster AG, vielen Dank für Ihre Rückmeldung …", karte: {}, titel: "Antworte höflich auf die Reklamation" }];
  OFFEN = null; $("textFeld").value = ""; $("anzUeb").textContent = UEB.length;
  if (n === 3) { schritt3Zeigen(e); return; }
  reiterWechseln("uebersicht");
}

/* ---------- Start ---------- */
(async function () {
  // Freischalt-Link aus der Lizenz-Mail: dexxus.ch/app-shield/#lizenz=… (der #-Teil geht nie an den Server)
  const hl = /[#&]lizenz=([A-Za-z0-9_-]+)/.exec(location.hash);
  if (hl) {
    history.replaceState(null, "", location.pathname + location.search);
    let t = "";
    try { const b = atob(hl[1].replace(/-/g, "+").replace(/_/g, "/")); t = new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0))); } catch (e) { /* kaputt */ }
    const r = t ? await ShieldLizenz.pruefen(t) : { ok: false, fehler: "Der Link ist unvollständig. Bitte den ganzen Link aus der E-Mail antippen." };
    if (r.ok) { LIZ.lizenz = { daten: r.daten, text: t }; speicher.set("lizenz", LIZ); setTimeout(() => meldung("App Shield ist freigeschaltet – danke!", 5000), 300); }
    else setTimeout(() => { $("spFehler").textContent = r.fehler; $("spFehler").hidden = false; }, 300);
  }
  // gespeicherte Lizenz bei jedem Start neu prüfen (Unterschrift, Ablaufdatum)
  if (LIZ.lizenz && !new URLSearchParams(location.search).get("ansicht")) {
    const r = LIZ.lizenz.text ? await ShieldLizenz.pruefen(LIZ.lizenz.text) : { ok: false };
    if (!r.ok) { delete LIZ.lizenz; speicher.set("lizenz", LIZ); }
  }
  bannerZeigen(); $("anzUeb").textContent = UEB.length; themaZeigen();
  try { ShieldEngine.orteSetzen(await (await fetch("orte_ch.txt")).text()); } catch (e) { /* ohne Ortsliste weiter */ }
  OFFEN = speicher.get("offen", null);
  if (OFFEN) schritt2Zeigen(true);      // App wurde zum Einfügen in der KI verlassen → direkt bei Schritt 2 weiter
  const vf = +new URLSearchParams(location.search).get("ansicht");
  if (vf) { vorfuehren(vf); return; }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  setTimeout(() => { try { ShieldDokumente.vorwaermen().catch(() => {}); } catch (e) { /* später */ } }, 2500);
})();
