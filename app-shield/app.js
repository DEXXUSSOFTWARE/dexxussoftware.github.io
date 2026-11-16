/* DEXXUS WEB Shield – Handy-Version (Web-App).
   Ablauf: 1 Eingeben (Text, Foto, Datei) → Schwärzen und kopieren → 2 in der KI-App einfügen → 3 Antwort einfügen → echte Namen.
   Alles lokal im Handy-Browser (localStorage), nichts wird hochgeladen. Engine/Lizenz/Dokumente wie in der PC-Erweiterung. */
"use strict";
const $ = id => document.getElementById(id);
const speicher = {
  get: (k, std) => { try { const v = localStorage.getItem("ws_" + k); return v === null ? std : JSON.parse(v); } catch (e) { return std; } },
  set: (k, v) => { try { localStorage.setItem("ws_" + k, JSON.stringify(v)); } catch (e) { meldung("Speichern im Handy nicht möglich (privater Modus?)."); } }
};
let EINST = Object.assign({ datum: true, hinweis: true, eigene: "" }, speicher.get("einstellungen", {}));
let LIZ = speicher.get("lizenz", {});
if (!LIZ.start) { LIZ.start = ShieldLizenz.heute(); speicher.set("lizenz", LIZ); }
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
  b.className = "abo-banner" + (st.art === "abo" ? " ok" : "");
  b.innerHTML = "<span>" + esc(st.text) + "</span><a href=\"" + ShieldLizenz.KAUF_URL + "\" target=\"_blank\" rel=\"noopener\">Jetzt kaufen</a>";
  $("lizStatus").className = "liz-status" + (st.art === "abo" ? " ok" : "");
  $("lizStatus").textContent = st.art === "abo" ? st.text : st.art === "test" ? st.text : "Gratis-Version";
}
$("lizUebernehmen").onclick = async () => {
  const t = $("lizText").value.trim(); if (!t) return meldung("Bitte die Lizenz aus der E-Mail einfügen.");
  const r = await ShieldLizenz.pruefen(t);
  if (!r.ok) { $("lizStatus").className = "liz-status leer"; $("lizStatus").textContent = r.fehler; return; }
  LIZ.lizenz = { daten: r.daten, text: t }; speicher.set("lizenz", LIZ); $("lizText").value = ""; bannerZeigen();
  meldung("Abo aktiv – danke!", 4000);
};

/* ---------- Dokumente (Foto, PDF, Word, Text) ---------- */
async function dateienHinzu(liste) {
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
    const leer = !$("frageFeld").value.trim();
    box.hidden = false; box.className = "dok-bereit";
    box.innerHTML = (ok === 1 ? "Dokument bereit" : ok + " Dokumente bereit") + "<small>" + (leer ? "Jetzt unten eingeben, was die KI tun soll." : "Jetzt «Schwärzen und kopieren» tippen.") + "</small>";
    $("frageFeld").classList.toggle("dran", leer);
  } else { box.hidden = true; $("frageFeld").classList.remove("dran"); }
}
$("fotoWahl").onchange = e => { dateienHinzu([...e.target.files]); e.target.value = ""; };
$("dateiWahl").accept = ShieldDokumente.akzeptiert;
$("dateiWahl").onchange = e => { dateienHinzu([...e.target.files]); e.target.value = ""; };
$("frageFeld").addEventListener("input", dokListeZeigen);

/* ---------- 1 → 2: Schwärzen und kopieren ---------- */
$("knopfSchwaerzen").onclick = async () => {
  if (DOKS.some(d => d.laedt)) return meldung("Dokument wird noch gelesen …");
  const st = ShieldLizenz.status(LIZ);
  if (st.frei <= 0) { meldung("Ihre Gratis-Zeit ist vorbei – jetzt kaufen und unbegrenzt weiterarbeiten.", 5000); return; }
  const text = $("textFeld").value.trim(), frage = $("frageFeld").value.trim(), doks = DOKS.filter(d => !d.fehler && d.text);
  if (!text && !frage && !doks.length) return meldung("Bitte Text, Foto/Datei oder Frage/Auftrag eingeben.");
  let roh = "";
  if (text) roh += text + "\n\n";
  doks.forEach(d => { SITZUNG.dokNr++; roh += "--- Dokument " + SITZUNG.dokNr + " ---\n" + d.text.trim() + "\n\n"; });
  if (frage) roh += (text || doks.length ? "Frage/Auftrag: " : "") + frage;
  roh = roh.trim();
  const eigene = (EINST.eigene || "").split(/\r?\n/).map(s => s.trim()).filter(s => s.length >= 2);
  const vorher = Object.keys(SITZUNG.karte).length;
  const r = ShieldEngine.anonymisieren(roh, eigene, SITZUNG.karte, { datum: EINST.datum });
  SITZUNG.karte = r.karte;
  const gesendet = (EINST.hinweis && !SITZUNG.hinweisGesendet ? ShieldEngine.hinweisKI : "") + r.text;
  SITZUNG.hinweisGesendet = SITZUNG.hinweisGesendet || EINST.hinweis;
  const neu = Object.keys(r.karte).length - vorher;
  OFFEN = { frage, text, doks: doks.map(d => d.name), gesendet, zeit: new Date().toISOString() };
  speicher.set("offen", OFFEN); sitzungSichern();
  LIZ = ShieldLizenz.zaehlen(LIZ); speicher.set("lizenz", LIZ); bannerZeigen();
  const ok = await kopieren(gesendet);
  $("kopiertInfo").innerHTML = (ok ? "Kopiert" : "Bitte «Nochmals kopieren» tippen") + " – " + (neu ? neu + " Angabe" + (neu === 1 ? "" : "n") + " geschwärzt." : vorher ? "bekannte Angaben bleiben geschwärzt." : "keine persönlichen Angaben gefunden.") +
    "<small>Jetzt die KI öffnen und einfügen.</small>";
  $("vorschau").innerHTML = esc(gesendet).replace(/\[[^\]]+ \d+\]/g, m => '<span class="platz">' + m + '</span>');
  $("schritt1").hidden = true; $("schritt2").hidden = false; $("schritt3").hidden = false; $("fussArbeit").hidden = false; stufe(2);
  $("schritt2").scrollIntoView({ behavior: "smooth", block: "start" });
};
$("knopfNochmal").onclick = async () => { if (OFFEN) meldung(await kopieren(OFFEN.gesendet) ? "Nochmals kopiert." : "Kopieren nicht möglich."); };
$("knopfVorschau").onclick = () => { $("vorschau").hidden = !$("vorschau").hidden; };

/* ---------- 3: Antwort einfügen → echte Namen ---------- */
async function antwortUebernehmen(a) {
  a = (a || "").trim();
  if (!a) return meldung("Zuerst in der KI die Antwort kopieren.");
  if (!OFFEN) return meldung("Bitte zuerst «Schwärzen und kopieren».");
  const e = Object.assign({}, OFFEN, { id: Math.random().toString(36).slice(2), antwort: a, karte: Object.assign({}, SITZUNG.karte),
    titel: (OFFEN.frage || OFFEN.text || OFFEN.doks.join(", ") || "Antwort").slice(0, 60) });
  SITZUNG.eintraege.push(e); sitzungSichern();
  UEB.unshift(e); speicher.set("uebersicht", UEB); $("anzUeb").textContent = UEB.length;
  OFFEN = null; speicher.set("offen", null);
  $("antwortFeld").value = ""; $("textFeld").value = ""; $("frageFeld").value = ""; DOKS = []; dokListeZeigen();
  $("frageFeld").placeholder = "Weitere Frage oder weiterer Auftrag (gleiche Zuordnung), z. B. «Mach es kürzer»";
  $("schritt2").hidden = true; $("schritt3").hidden = true; $("schritt1").hidden = false;
  verlaufZeigen(); stufe(3);
  const st = ShieldLizenz.status(LIZ);
  if (st.art === "gratis") $("verlauf").insertAdjacentHTML("beforeend", '<div class="werbe-karte"><b>' + esc(st.text) + '</b><a href="' + ShieldLizenz.KAUF_URL + '" target="_blank" rel="noopener">Jetzt kaufen</a></div>');
  const letzte = $("verlauf").querySelector(".eintrag:last-of-type"); if (letzte) letzte.scrollIntoView({ behavior: "smooth", block: "start" });
}
const antwortEcht = e => ShieldEngine.deanonymisieren(e.antwort, e.karte);
$("knopfEinfuegen").onclick = async () => {
  const feld = $("antwortFeld").value; if (feld.trim()) return antwortUebernehmen(feld);
  try { const t = await navigator.clipboard.readText(); if (t && t.trim()) return antwortUebernehmen(t); meldung("Zwischenablage ist leer – zuerst in der KI die Antwort kopieren."); }
  catch (e) { $("antwortFeld").focus(); meldung("Bitte ins Feld tippen, lange drücken und «Einfügen» wählen.", 4000); }
};
// Einfügen ins Feld (lange drücken → Einfügen) übernimmt die Antwort sofort; Tippen nicht (sonst mehrfach)
$("antwortFeld").addEventListener("paste", () => setTimeout(() => antwortUebernehmen($("antwortFeld").value), 150));

function verlaufZeigen() {
  $("verlauf").innerHTML = SITZUNG.eintraege.map((e, i) => {
    const teile = ShieldEngine.deanonTeile(e.antwort, e.karte).map(x => x.t !== undefined ? esc(x.t) : '<span class="echt">' + esc(x.echt) + '</span>').join("");
    return '<div class="eintrag"><div class="frage">Frage/Auftrag ' + (i + 1) + ' · ' + datum(e.zeit) + ' · ✓ gespeichert' + (e.frage ? '<br>«' + esc(e.frage) + '»' : '') + '</div>' +
      '<div class="antw"><div class="antw-kopf"><span>Antwort · mit echten Namen</span><span>entschwärzt</span></div>' + teile + '</div>' +
      '<div class="antw-knoepfe"><button class="gross w" data-kop="' + e.id + '">Kopieren</button><button class="gross w" data-teil="' + e.id + '">Teilen</button></div></div>';
  }).join("");
  $("verlauf").querySelectorAll("[data-kop]").forEach(b => b.onclick = async () => { const e = SITZUNG.eintraege.find(x => x.id === b.dataset.kop); meldung(await kopieren(antwortEcht(e)) ? "Antwort kopiert." : "Kopieren nicht möglich."); });
  $("verlauf").querySelectorAll("[data-teil]").forEach(b => b.onclick = () => teilen(SITZUNG.eintraege.find(x => x.id === b.dataset.teil)));
}
async function teilen(e) {
  const t = antwortEcht(e);
  if (navigator.share) { try { await navigator.share({ title: e.titel, text: t }); } catch (x) { /* abgebrochen */ } }
  else meldung(await kopieren(t) ? "Teilen nicht möglich – Antwort wurde kopiert." : "Teilen nicht möglich.");
}
$("knopfNeu").onclick = () => {
  if (!confirm("Neues Thema beginnen? Die Zuordnung der Namen startet neu (gespeicherte Antworten bleiben in der Übersicht).")) return;
  SITZUNG = neueSitzung(); sitzungSichern(); OFFEN = null; speicher.set("offen", null);
  $("verlauf").innerHTML = ""; stufe(1); $("schritt1").hidden = false; $("schritt2").hidden = true; $("schritt3").hidden = true; $("fussArbeit").hidden = true;
  $("frageFeld").placeholder = "Frage oder Auftrag an die KI, z. B. «Schreibe daraus eine freundliche Mahnung»";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ---------- Übersicht ---------- */
function uebersichtZeigen() {
  $("anzUeb").textContent = UEB.length;
  const q = $("suche").value.trim().toLowerCase();
  const liste = UEB.filter(e => !q || (e.titel + " " + antwortEcht(e) + " " + (e.frage || "")).toLowerCase().includes(q));
  $("ueberInfo").textContent = WAHL.size ? WAHL.size + " ausgewählt" : "";
  $("alleWahl").checked = liste.length > 0 && liste.every(e => WAHL.has(e.id));
  if (!liste.length) { $("uebListe").innerHTML = '<div class="leer">' + (UEB.length ? "Nichts gefunden." : "Noch keine Antworten gespeichert.<br>Jede Antwort wird hier automatisch abgelegt.") + '</div>'; return; }
  $("uebListe").innerHTML = liste.map(e => '<div class="wisch" data-wid="' + e.id + '"><div class="wisch-l">Kopieren</div><div class="wisch-r">Löschen</div>' +
    '<label class="ueb"><input type="checkbox" data-id="' + e.id + '"' + (WAHL.has(e.id) ? " checked" : "") + '><span class="t"><b>' + esc(e.titel) + '</b><small>' + datum(e.zeit) + '</small>' +
    '<span class="vorsch">' + esc(antwortEcht(e).slice(0, 200)) + '</span></span></label></div>').join("");
  $("uebListe").querySelectorAll("input[data-id]").forEach(c => c.onchange = () => { c.checked ? WAHL.add(c.dataset.id) : WAHL.delete(c.dataset.id); $("ueberInfo").textContent = WAHL.size ? WAHL.size + " ausgewählt" : ""; });
  $("uebListe").querySelectorAll(".wisch").forEach(wischEinrichten);
}
$("suche").oninput = uebersichtZeigen;
$("alleWahl").onchange = () => { const q = $("suche").value.trim().toLowerCase(); UEB.filter(e => !q || (e.titel + " " + antwortEcht(e)).toLowerCase().includes(q)).forEach(e => $("alleWahl").checked ? WAHL.add(e.id) : WAHL.delete(e.id)); uebersichtZeigen(); };
function gewaehlte() { const l = UEB.filter(e => WAHL.has(e.id)); if (!l.length) meldung("Bitte zuerst Antworten anhaken (oder «alle auswählen»)."); return l; }
const FORMAT_NAME = { doc: "Word", pdf: "PDF", txt: "Text" };
let FORMAT = "doc";
document.querySelectorAll("#formatWahl button").forEach(b => b.onclick = () => {
  FORMAT = b.dataset.f; document.querySelectorAll("#formatWahl button").forEach(x => x.classList.toggle("an", x === b));
  $("knopfSpeichern").textContent = "Als " + FORMAT_NAME[FORMAT] + " speichern";
});
function alsText(l) { return l.map(e => datum(e.zeit) + " – " + e.titel + "\n\n" + (e.frage ? "Frage/Auftrag: " + e.frage + "\n" : "") + "\nAntwort:\n" + antwortEcht(e) + "\n").join("\n------------------------------\n\n"); }
function alsHTML(l) {
  return '<html><head><meta charset="utf-8"><title>WEB-Shield-Antworten</title></head><body style="font-family:Arial;font-size:11pt;line-height:1.45;color:#0F172A"><h1 style="font-size:16pt">Antworten (DEXXUS WEB Shield)</h1>' +
    l.map(e => '<h2 style="font-size:13pt;color:#2563EB;margin:16pt 0 4pt">' + esc(e.titel) + '</h2><p style="color:#64748B;font-size:9pt">' + datum(e.zeit) + '</p>' +
      (e.frage ? '<p><b>Frage/Auftrag:</b> ' + esc(e.frage) + '</p>' : '') + '<div style="white-space:pre-wrap">' + esc(antwortEcht(e)) + '</div>').join("") + '</body></html>';
}
$("knopfSpeichern").onclick = async () => {
  const l = gewaehlte(); if (!l.length) return;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  if (FORMAT === "pdf") {     // Handy: Druckansicht öffnen, dort «Als PDF speichern» / «Teilen»
    const w = window.open("", "_blank"); if (!w) return meldung("Bitte Pop-ups erlauben.");
    w.document.write(alsHTML(l)); w.document.close(); setTimeout(() => w.print(), 400); return;
  }
  const blob = FORMAT === "txt" ? new Blob(["﻿" + alsText(l)], { type: "text/plain;charset=utf-8" }) : new Blob(["﻿" + alsHTML(l)], { type: "application/msword" });
  const name = "WEB-Shield-Antworten_" + stamp + "." + FORMAT;
  const datei = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [datei] })) { try { await navigator.share({ files: [datei], title: name }); return; } catch (e) { /* abgebrochen → herunterladen */ } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  meldung("Gespeichert: " + name);
};
$("knopfLoeschen").onclick = () => {
  const l = gewaehlte(); if (!l.length) return;
  if (!confirm(l.length + " Antwort" + (l.length === 1 ? "" : "en") + " löschen?")) return;
  UEB = UEB.filter(e => !WAHL.has(e.id)); WAHL.clear(); speicher.set("uebersicht", UEB); uebersichtZeigen();
};

/* ---------- Wischen ---------- */
async function wischAktion(id, richtung) {
  const e = UEB.find(x => x.id === id); if (!e) return;
  if (richtung > 0) { meldung(await kopieren(antwortEcht(e)) ? "Antwort kopiert." : "Kopieren nicht möglich."); return; }
  if (!confirm("Diese Antwort löschen? – «" + e.titel + "»")) return;
  UEB = UEB.filter(x => x.id !== id); WAHL.delete(id); speicher.set("uebersicht", UEB); uebersichtZeigen(); meldung("Antwort gelöscht.");
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
function reiterWechseln(name) { const b = document.querySelector('.reiter button[data-r="' + name + '"]'); if (b) b.click(); }
(function () {
  let start = null; const frei = t => !t.closest(".wisch, textarea, input, select, .fenster, .ki-wahl");
  document.addEventListener("touchstart", e => { const t = e.touches[0]; start = frei(e.target) ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
  document.addEventListener("touchend", e => {
    if (!start) return; const t = e.changedTouches[0], x = t.clientX - start.x, y = t.clientY - start.y; start = null;
    if (Math.abs(x) > 80 && Math.abs(x) > Math.abs(y) * 2) reiterWechseln(x < 0 ? "uebersicht" : "arbeiten");
  }, { passive: true });
})();

/* ---------- Reiter, Einstellungen ---------- */
document.querySelectorAll(".reiter button").forEach(b => b.onclick = () => {
  document.querySelectorAll(".reiter button").forEach(x => x.classList.toggle("an", x === b));
  document.querySelectorAll(".ansicht").forEach(a => a.classList.toggle("an", a.id === b.dataset.r));
  if (b.dataset.r === "uebersicht") uebersichtZeigen();
});
$("knopfEinst").onclick = () => { $("eDatum").checked = EINST.datum; $("eHinweis").checked = EINST.hinweis; $("eEigene").value = EINST.eigene || ""; bannerZeigen(); $("fensterEinst").hidden = false; };
document.querySelectorAll("[data-zu]").forEach(b => b.onclick = () => { b.closest(".fenster").hidden = true; });
$("fensterEinst").addEventListener("click", e => { if (e.target.id === "fensterEinst") e.target.hidden = true; });
$("eSpeichern").onclick = () => { EINST = { datum: $("eDatum").checked, hinweis: $("eHinweis").checked, eigene: $("eEigene").value }; speicher.set("einstellungen", EINST); $("fensterEinst").hidden = true; meldung("Gespeichert."); };
$("eAllesLoeschen").onclick = () => { if (!confirm("Wirklich ALLE gespeicherten Antworten löschen?")) return; UEB = []; WAHL.clear(); speicher.set("uebersicht", UEB); uebersichtZeigen(); meldung("Alle Antworten gelöscht."); };

$("eWhatsapp").href = "https://wa.me/?text=" + encodeURIComponent("Schau dir das an: DEXXUS WEB Shield schwärzt Namen, Adressen und IBAN, bevor sie zu ChatGPT, Claude & Co. gehen – auch auf dem Handy. 30 Tage gratis: https://dexxus.ch/web-shield.html");

/* ---------- Vorführ-Ansichten für Werbebilder: index.html?ansicht=1..4 (erfundene Daten, nichts wird gespeichert) ---------- */
function vorfuehren(n) {
  speicher.set = () => {};                       // nichts speichern
  SITZUNG = neueSitzung(); UEB = []; OFFEN = null;
  const auftrag = "Mach daraus eine freundliche Mahnung";
  const brief = "Sehr geehrte Frau Erika Muster\n\nIhre Rechnung Nr. 2026-118 über CHF 1'250.00 ist noch offen. Bitte überweisen Sie auf IBAN CH93 0076 2011 6238 5295 7.\n\nFreundliche Grüsse\nHans Beispiel, Beispiel AG";
  $("textFeld").value = brief; $("frageFeld").value = auftrag;
  if (n === 1) return;
  const r = ShieldEngine.anonymisieren(brief + "\n\nFrage/Auftrag: " + auftrag, [], {}, { datum: true });
  SITZUNG.karte = r.karte;
  OFFEN = { frage: auftrag, text: brief, doks: [], gesendet: r.text, zeit: new Date().toISOString() };
  const ph = Object.keys(r.karte);
  if (n === 2) {
    $("kopiertInfo").innerHTML = "Kopiert – " + ph.length + " Angaben geschwärzt.<small>Jetzt die KI öffnen und einfügen.</small>";
    $("vorschau").innerHTML = esc(r.text).replace(/\[[^\]]+ \d+\]/g, m => '<span class="platz">' + m + '</span>'); $("vorschau").hidden = false;
    $("schritt1").hidden = true; $("schritt2").hidden = false; $("schritt3").hidden = false; stufe(2); return;
  }
  const personen = ph.filter(k => k.startsWith("[Person")).sort((a, b) => (/Erika/.test(r.karte[b]) ? 1 : 0) - (/Erika/.test(r.karte[a]) ? 1 : 0));
  const iban = ph.find(k => k.startsWith("[IBAN")) || "";
  const antwort = "Sehr geehrte Frau " + (personen[0] || "") + "\n\nsicher ist es Ihnen entgangen: Unsere Rechnung Nr. 2026-118 über CHF 1'250.00 ist noch offen. Wir danken Ihnen, wenn Sie den Betrag in den nächsten 10 Tagen auf " + iban + " überweisen.\n\nFreundliche Grüsse\n" + (personen[1] || "");
  const e = { id: "v1", frage: auftrag, text: brief, doks: [], gesendet: r.text, zeit: new Date().toISOString(), antwort, karte: r.karte, titel: auftrag };
  SITZUNG.eintraege = [e];
  UEB = [e,
    { id: "v2", frage: "Fasse den Mietvertrag in 3 Punkten zusammen", doks: ["Mietvertrag.pdf"], zeit: new Date(Date.now() - 864e5).toISOString(), antwort: "1. Mieter: Hans Beispiel\n2. Mietzins CHF 1'850.– pro Monat\n3. Kündigungsfrist 3 Monate", karte: {}, titel: "Fasse den Mietvertrag in 3 Punkten zusammen" },
    { id: "v3", frage: "Antworte höflich auf die Reklamation", doks: [], zeit: new Date(Date.now() - 2 * 864e5).toISOString(), antwort: "Sehr geehrte Damen und Herren der Muster AG, vielen Dank für Ihre Rückmeldung …", karte: {}, titel: "Antworte höflich auf die Reklamation" }];
  OFFEN = null; $("textFeld").value = ""; $("frageFeld").value = "";
  verlaufZeigen(); $("fussArbeit").hidden = false; $("anzUeb").textContent = UEB.length;
  if (n === 3) { stufe(3); return; }
  reiterWechseln("uebersicht");
}

/* ---------- Start ---------- */
(async function () {
  bannerZeigen(); $("anzUeb").textContent = UEB.length;
  try { ShieldEngine.orteSetzen(await (await fetch("orte_ch.txt")).text()); } catch (e) { /* ohne Ortsliste weiter */ }
  OFFEN = speicher.get("offen", null);
  if (SITZUNG.eintraege.length) { verlaufZeigen(); $("fussArbeit").hidden = false; $("frageFeld").placeholder = "Weitere Frage oder weiterer Auftrag (gleiche Zuordnung), z. B. «Mach es kürzer»"; }
  if (OFFEN) {        // App wurde zum Einfügen in der KI verlassen und neu geöffnet → direkt bei Schritt 2/3 weiter
    $("kopiertInfo").innerHTML = "Geschwärzter Text ist bereit.<small>In der KI einfügen, Antwort kopieren und unten einfügen.</small>";
    $("vorschau").textContent = OFFEN.gesendet;
    $("schritt1").hidden = true; $("schritt2").hidden = false; $("schritt3").hidden = false; $("fussArbeit").hidden = false; stufe(2);
  }
  const vf = +new URLSearchParams(location.search).get("ansicht");
  if (vf) { vorfuehren(vf); return; }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  setTimeout(() => { try { ShieldDokumente.vorwaermen().catch(() => {}); } catch (e) { /* später */ } }, 2500);
})();
