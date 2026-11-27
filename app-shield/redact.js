/* DEXXUS Shield – Schwärz-Engine (Browser).  1:1-Übertragung von anonymisieren()/deanonymisieren() aus SHIELD.py.
   Regeln kommen aus daten.js (automatisch aus SHIELD.py erzeugt).  Alles läuft lokal, nichts wird gesendet.
   26.11.2026: international (DE/FR/IT/EN UK+USA/ES) – gleiche Schritte wie SHIELD.py (Vornamen gross, Mittelnamen,
   Partikel, zweiter Nachname, Initiale + Nachname, Muster mit Gruppe «w», Kleinschreibung ist kein Name). */
"use strict";
(function (glob) {
  const D = typeof SHIELD_DATEN !== "undefined" ? SHIELD_DATEN : glob.SHIELD_DATEN;
  const W = "\\p{L}\\p{N}_";                       // Python-\w (Unicode)

  /* Python-Regex -> JS: \w und \b Unicode-fähig, (?P<name> -> (?<name>. (?i:...) / (?-i:...) versteht Chrome/Edge direkt. */
  function rx(src, flags) {
    let out = "", inKl = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === "\\") {
        const n = src[i + 1];
        if (n === "w") { out += inKl ? W : "[" + W + "]"; i++; continue; }
        if (n === "b" && !inKl) { out += "(?:(?<=[" + W + "])(?![" + W + "])|(?<![" + W + "])(?=[" + W + "]))"; i++; continue; }
        // Python erlaubt «\"», «\-» usw., der Unicode-Modus von JS nicht -> Zeichen ohne Rückstrich
        if (n !== undefined && !/[A-Za-z0-9]/.test(n) && !"^$\\.*+?()[]{}|/".includes(n) && !(inKl && n === "-")) { out += n; i++; continue; }
        out += c + n; i++; continue;
      }
      if (c === "(" && !inKl && src.startsWith("(?P<", i)) { out += "(?<"; i += 3; continue; }
      if (c === "[" && !inKl) inKl = true;
      else if (c === "]" && inKl) inKl = false;
      out += c;
    }
    return new RegExp(out, "gu" + (flags || ""));
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
  const lowerSet = arr => new Set(arr.map(x => x.toLowerCase()));
  const istGross = w => /^\p{Lu}/u.test(w || ""), istKlein = w => /^\p{Ll}/u.test(w || "");

  // Ergänzung zu Shield PC: häufige Schweizer Vornamen, die dort fehlen
  const VN_EXTRA = ["Hans", "Fritz", "Kurt", "Rolf", "Ernst", "Hansjörg", "Hansueli", "Köbi", "Sepp", "Jan", "Nils", "Lars",
                    "Mia", "Ella", "Lara", "Nora", "Elin", "Leni", "Luana", "Gian", "Flurin", "Seraina", "Ladina", "Jürgen", "Hedi"];
  const VORNAMEN = [...new Set([...D.ANON_VORNAMEN, ...VN_EXTRA])], VN_KLEIN = lowerSet(VORNAMEN);
  const KEINE_NAMEN_KL = lowerSet(D.ANON_KEINE_NAMEN), RECHTSFORMEN = new Set(D.ANON_RECHTSFORMEN);
  const FUNKTION = new Set(D.ANON_FUNKTIONSWOERTER), ROLLEN_ALLG = new Set(D.ANON_ROLLEN_ALLGEMEIN);
  const NOMEN_STOP = new Set(D.ANON_NOMEN_STOP), NOMEN_END = D.ANON_NOMEN_ENDUNGEN;
  const CAPS_STOP = new Set(D.ANON_CAPS_STOP);
  const BANK_STOP = new Set([...D.ANON_BANK_STOPWORTE, ...D.ANON_BANK_STOPWORTE_EXTRA]);
  const MEHRD = lowerSet(D.ANON_VORNAMEN_MEHRDEUTIG || []), NACH = lowerSet(D.ANON_NACHNAMEN || []);
  const PARTIKEL = new Set(D.ANON_PARTIKEL || []);
  const endetNomen = w => NOMEN_END.some(e => w.endsWith(e));

  const MUSTER = D.ANON_MUSTER.map(([a, p]) => [a, rx(p)]);
  const DATUM = D.ANON_DATUM.map(([a, p]) => [a, rx(p)]);
  const VN_SORT = [...VORNAMEN].sort((a, b) => b.length - a.length);
  const VN_ALT = VN_SORT.map(esc).join("|");
  const RX_MAILNAME = rx("[\"']{0,2}([A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ'’]+(?:[ -][A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ'’]+){1,2})[\"']{0,2}\\s*<");
  const RX_ROLLE = new RegExp(rx("(?i:(?<!\\w)(?:(?:" + D.ANON_ROLLEN + (D.ANON_ROLLEN_GROSS ? "|(?-i:" + D.ANON_ROLLEN_GROSS + ")" : "") +
                              ")\\s+)+((?:[A-ZÀ-Þ]\\.\\s?){0,2}[A-Za-zÀ-ÖØ-öø-ÿ][\\w'’\\-]+(?:[ \\t](?:[A-ZÀ-Þ]\\.|[A-Za-zÀ-ÖØ-öø-ÿ][\\w'’\\-]*)){0,3})(?![\\w]))").source, "gud");
  const RX_VORNAME = rx("(?i:(?<![\\w'’\\-])(" + VN_ALT + ")(-[A-ZÀ-Þ][\\w]+)?((?:[ \\t](?:[A-ZÀ-Þ]\\.|[A-Za-zÀ-ÖØ-öø-ÿ][\\w'’]*" +
                        "(?:-[A-Za-zÀ-ÖØ-öø-ÿ][\\w'’]*)?)){0,4})(?![\\w'’]))");
  const RX_INITIALE = rx("(?<![\\w.])([A-ZÀ-Þ]\\.(?:[ \\t][A-ZÀ-Þ]\\.)?[ \\t])([A-ZÀ-Þ][a-zß-öø-ÿ'’]{2,}(?:-[A-ZÀ-Þ][a-zß-öø-ÿ]+)?)(?![\\w])");
  const RX_CAPS = rx("(?<![\\w])((?:" + VN_SORT.map(v => esc(v.toUpperCase())).join("|") +
                     ")(?:[ \\-](?:[A-ZÀ-Þ]\\.?[ ])?[A-ZÀ-Þ][A-ZÀ-Þ'’\\-]+){1,2})(?![\\w])");
  const RX_KONTOZEILE = new RegExp(rx("(?i:" + (D.ANON_KONTOZEILE || "gutschrift|belastung|zahlungseingang|überweisung|auftraggeber|" +
                                  "begünstigt|empfänger|einzahler|zahlung von|zahlung an") + ")").source, "u");
  const RX_CAPS2 = rx("(?<![\\w])([A-ZÀ-Þ][A-ZÀ-Þ'\\-]{1,}(?:[ \\t][A-ZÀ-Þ][A-ZÀ-Þ'\\-]{1,}){1,2})(?![\\w])");
  const RX_ARTIKEL_VOR = /(?:^|\s)(?:die|der|das|den|dem|des|eine?|the|a|an|la|le|les|il|lo|el|los|las|una?|un)\s+$/i;
  const RX_INI_WORT = /^\p{Lu}\.?$/u;
  const RX_VN_VOR_PERSON = rx("\\b(" + VN_ALT + ")[ \\t](\\[Person \\d+\\])");
  const RX_GROSSWORT = rx("\\b[A-ZÄÖÜ][\\wäöüÀ-ÿ\\-]+(?:\\s[A-ZÄÖÜ][\\wäöüÀ-ÿ\\-]+){0,2}\\b");
  const RX_BANKWORT = /bank|banque|banca|banco|kasse|cassa|caja|caixa|cr[ée]dit|finan|savings|raiffeisen|^[A-Z]{2,5}$/i;

  let ORTE = null, RX_ORT_S = null, RX_ORT_K = null;
  function orteSetzen(textDatei) {                  // Inhalt von orte_ch.txt
    const sicher = [], kontext = [];
    for (let z of textDatei.split(/\r?\n/)) {
      z = z.trim();
      if (!z || z.startsWith("#")) continue;
      (z.startsWith("*") ? kontext : sicher).push(z.replace(/^\*+/, ""));
    }
    const lang = a => a.sort((x, y) => y.length - x.length);
    ORTE = [lang(sicher), lang(kontext)];
    const s = ORTE[0].filter(o => o.length >= 4).map(esc).join("|");
    RX_ORT_S = s ? rx("(?<![\\w\\[-])(" + s + ")(?![\\w\\]-])") : null;
    RX_ORT_K = ORTE[1].length ? rx("\\b((?:wohnhaft )?(?:in|aus|nach|von|bei|Gemeinde|Ortschaft) )(" + ORTE[1].map(esc).join("|") + ")(?![\\w\\]-])") : null;
  }

  /* text, eigeneNamen[], karte{platzhalter: original}, optionen{datum:true} -> {text, karte} */
  function anonymisieren(text, namen, karte, opt) {
    karte = karte || {}; opt = opt || {};
    const rueck = {};
    for (const [k, v] of Object.entries(karte)) rueck[v.toLowerCase()] = k;
    const zaehler = {};

    function platz(art, original) {
      original = original.trim();
      const key = original.toLowerCase();
      if (key in rueck) return rueck[key];
      if (art === "Person") {
        const basis = original.endsWith("s") ? original.replace(/(?<=[\p{L}\p{N}_])s$/u, "") : original;
        for (const [ph, v] of Object.entries(karte)) {
          if (!ph.startsWith("[Person ")) continue;
          const vl = v.toLowerCase(), letzt = vl.split(/\s+/).slice(-1)[0];
          if (letzt === key || vl === basis.toLowerCase() || letzt === basis.toLowerCase()) { rueck[key] = ph; return ph; }
        }
      }
      if (!(art in zaehler)) zaehler[art] = Object.keys(karte).filter(k => k.startsWith("[" + art + " ")).length;
      zaehler[art] += 1;
      const ph = "[" + art + " " + zaehler[art] + "]";
      karte[ph] = original; rueck[key] = ph;
      return ph;
    }

    // 1) Namen direkt im Text
    const dyn = new Set();
    for (const m of text.matchAll(RX_MAILNAME)) dyn.add(m[1]);
    for (const m of text.matchAll(RX_ROLLE)) {
      let rolle = text.slice(m.index, m.indices[1][0]).split(/\s+/).filter(Boolean);
      rolle = rolle.length ? rolle[rolle.length - 1].toLowerCase() : "";
      if (ROLLEN_ALLG.has(rolle)) {
        const erstes = m[1].split(/\s+/)[0].toLowerCase();
        if (!VN_KLEIN.has(erstes) && (NOMEN_STOP.has(erstes) || endetNomen(erstes))) continue;
      }
      const woerter = [], teile = m[1].split(/\s+/);
      for (let k = 0; k < teile.length; k++) {
        const w = teile[k];
        if (PARTIKEL.has(w.toLowerCase()) && woerter.length && k + 1 < teile.length && istGross(teile[k + 1])) { woerter.push(w); continue; }
        if (FUNKTION.has(w.toLowerCase()) || !istGross(w)) break;
        if (woerter.length && (NOMEN_STOP.has(w.toLowerCase()) || endetNomen(w.toLowerCase()))) break;
        if (!KEINE_NAMEN_KL.has(w.toLowerCase())) woerter.push(w);
      }
      while (woerter.length && PARTIKEL.has(woerter[woerter.length - 1].toLowerCase())) woerter.pop();
      const n = woerter.join(" ").trim();
      if (n.length >= 3 && !KEINE_NAMEN_KL.has(n.toLowerCase())) {
        dyn.add(n);
        if (n.includes(" ")) dyn.add(n.split(" ").slice(-1)[0]);
      }
    }
    // Vorname + Nachname(n): nur gross geschrieben, in derselben Zeile, Mittelname/Initiale, Partikel, zweiter Nachname
    for (const m of text.matchAll(RX_VORNAME)) {
      if (!istGross(m[1])) continue;
      const vn = m[1] + (m[2] || "");
      const teile = (m[3] || "").split(/\s+/).filter(Boolean);
      const name = [vn];
      let nach = [], part = [];
      for (let k = 0; k < teile.length; k++) {
        const w = teile[k], wl = w.toLowerCase(), nxt = teile[k + 1] || "";
        if (PARTIKEL.has(wl) && w.length <= 5 && istGross(nxt)) { part.push(w); continue; }
        if (!istGross(w) || FUNKTION.has(wl) || KEINE_NAMEN_KL.has(wl)) break;
        if (RX_INI_WORT.test(w)) {
          if (nach.length || !istGross(nxt)) break;
          name.push(w); continue;
        }
        if (!nach.length) {
          if (VN_KLEIN.has(wl) && !MEHRD.has(wl) && !part.length && istGross(nxt) &&
              !FUNKTION.has(nxt.toLowerCase()) && !KEINE_NAMEN_KL.has(nxt.toLowerCase())) { name.push(w); continue; }
          nach = part.concat([w]); part = []; continue;
        }
        if (part.length || NACH.has(wl)) { nach = nach.concat(part, [w]); part = []; continue; }
        break;
      }
      if (MEHRD.has(vn.toLowerCase()) && (!nach.length || RX_ARTIKEL_VOR.test(text.slice(Math.max(0, m.index - 8), m.index)))) continue;
      if (nach.length) {
        dyn.add(name.concat(nach).join(" "));
        const echte = nach.filter(x => !PARTIKEL.has(x.toLowerCase()));
        for (const x of echte) if (x.length >= 3 && !VN_KLEIN.has(x.toLowerCase())) dyn.add(x);
        dyn.add(nach.join(" "));
        if (echte.length) dyn.add(echte[echte.length - 1]);
      }
      dyn.add(vn);
    }
    // Initiale + Nachname ohne Anrede: «J. Morris»
    for (const m of text.matchAll(RX_INITIALE)) {
      const nn = m[2], l = nn.toLowerCase();
      if (VN_KLEIN.has(l) || FUNKTION.has(l) || KEINE_NAMEN_KL.has(l) || NOMEN_STOP.has(l) || endetNomen(l) || ["M.", "D."].includes(m[1].trim())) continue;
      dyn.add(m[0]); dyn.add(nn);
    }
    // 1b) GROSSBUCHSTABEN-Namen (bekannter Vorname) und Kontoauszüge
    for (const m of text.matchAll(RX_CAPS)) {
      const w = m[1].split(/\s+/);
      if (!w.slice(1).some(x => CAPS_STOP.has(x) || FUNKTION.has(x.toLowerCase()) || KEINE_NAMEN_KL.has(x.toLowerCase()))) {
        dyn.add(m[1]);
        if (w[w.length - 1].length >= 3) dyn.add(w[w.length - 1]);
      }
    }
    const zeilenC = text.split("\n");
    zeilenC.forEach((zeile, i) => {
      if (!RX_KONTOZEILE.test(zeile)) return;
      for (const kand of [zeile, zeilenC[i + 1] || ""]) {
        for (const m of kand.matchAll(RX_CAPS2)) {
          const w = m[1].split(/\s+/);
          if (!w.some(x => CAPS_STOP.has(x.replace(/^['-]+|['-]+$/g, "")) || x.length < 3)) { dyn.add(m[1]); break; }
        }
      }
    });
    const eigene = (namen || []).filter(n => n && n.trim().length >= 3).map(n => n.trim());
    const auto = new Set([...dyn].filter(d => d.length >= 3 && !eigene.includes(d)));
    const alle = [...new Set([...eigene, ...auto])].sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));   // gleich wie SHIELD.py

    // 3) Muster (IBAN, AHV, Telefon, Adressen, Orte mit PLZ …), Datum wahlweise; Gruppe «w» = nur dieser Teil
    const liste = MUSTER.concat(opt.datum === false ? [] : DATUM);
    for (const [art, r] of liste) {
      text = text.replace(r, (...a) => {
        const g = typeof a[a.length - 1] === "object" ? a[a.length - 1] : null;
        if (g && g.w !== undefined) {
          const m0 = a[0], p = m0.lastIndexOf(g.w);      // «w» steht immer am Ende des Treffers
          return m0.slice(0, p) + platz(art, g.w) + m0.slice(p + g.w.length);
        }
        return platz(art, a[0]);
      });
    }

    // 3b) Bankname im Satz mit IBAN/Konto
    const bank = s => s.includes("[IBAN") || s.includes("[Bankverbindung") || s.includes("[Finanzkonto");
    if (bank(text)) {
      const namenW = new Set(alle.flatMap(n => n.split(/\s+/)).filter(w => w.length >= 3).map(w => w.toLowerCase()));
      text = text.split("\n").map(zeile => {
        if (!bank(zeile)) return zeile;
        const saetze = zeile.split(/(?<=[.;!?])(?![^\[]*\])(\s+)/);   // nicht innerhalb «[AHV-Nr. 1]» trennen
        return saetze.map(satz => {
          if (!bank(satz)) return satz;
          const teile = satz.split(/(\[[^\]]+\])/);
          return teile.map((t, j) => {
            if (t.startsWith("[")) return t;
            return t.replace(RX_GROSSWORT, (m0, off) => {
              if (j === 0 && off === 0) return m0;
              const w = m0.split(/\s+/);
              if (w.some(x => BANK_STOP.has(x.toLowerCase()) || namenW.has(x.toLowerCase()) || x.length < 4)) return m0;
              if (w.length === 1 && !RX_BANKWORT.test(w[0])) return m0;    // einzelnes Wort nur, wenn es nach Bank aussieht
              return platz("Bank", m0);
            });
          }).join("");
        }).join("");
      }).join("\n");
    }

    // 4) Personennamen (auch Genitiv); automatisch gefundene Namen klein geschrieben sind Wörter («petit», «rosa»)
    for (const n of alle) {
      const r = rx("(?<![\\w\\[])" + esc(n) + "(s)?(?![\\w\\]])", "i");
      text = text.replace(r, (m0, s) => {
        if (auto.has(n) && istGross(n) && istKlein(m0)) return m0;
        return platz("Person", m0.slice(0, m0.length - (s || "").length)) + (s || "");
      });
    }
    // 5) Vorname vor ersetztem Nachnamen
    for (let k = 0; k < 2; k++) text = text.replace(RX_VN_VOR_PERSON, (m0, vn, ph) => platz("Person", vn + " " + (karte[ph] || "")));
    // 6) Ortschaften ohne PLZ
    if (RX_ORT_S) {
      const teile = text.split(/(\[[^\]]+\])/);
      for (let i = 0; i < teile.length; i += 2) {
        teile[i] = teile[i].replace(RX_ORT_S, (m0, o, off, s) => {
          const vor = s.slice(Math.max(0, off - 8), off);
          return ["Kanton ", "Kantons ", "Stadt ", "Universität "].some(e => vor.endsWith(e)) ? o : platz("Ort", o);
        });
        if (RX_ORT_K) teile[i] = teile[i].replace(RX_ORT_K, (m0, a, o) => a + platz("Ort", o));
      }
      text = teile.join("");
    }
    return { text, karte };
  }

  /* Platzhalter zurück – tolerant ([person 1], [Person1], [Person 1, Herr], «Person 1» ohne Klammern).
     Liefert Teile [{t:text}|{echt:original, ph:platzhalter}] für die Anzeige mit Markierung. */
  function deanonTeile(text, karte) {
    if (!karte || !Object.keys(karte).length) return [{ t: text }];
    const nachArt = {};
    for (const [ph, v] of Object.entries(karte)) {
      const m = ph.match(/^\[(.+?) (\d+)\]$/);
      if (m) nachArt[m[1].toLowerCase() + "|" + m[2]] = { v, ph };
    }
    const arten = [...new Set(Object.keys(nachArt).map(k => k.split("|")[0]))].sort((a, b) => b.length - a.length).map(esc).join("|");
    const r = new RegExp("\\[\\s*(" + arten + ")\\s*(\\d+)\\s*(?:[,;:][^\\]]{0,40})?\\]|(?<![\\p{L}\\p{N}_\\[])(" + arten + ") (\\d+)(?![\\p{L}\\p{N}_\\]])", "giu");
    const teile = []; let pos = 0;
    for (const m of text.matchAll(r)) {
      const art = (m[1] || m[3]).trim().toLowerCase(), nr = m[2] || m[4];
      const e = nachArt[art + "|" + nr];
      if (!e) continue;
      if (m.index > pos) teile.push({ t: text.slice(pos, m.index) });
      teile.push({ echt: e.v, ph: e.ph });
      pos = m.index + m[0].length;
    }
    if (pos < text.length) teile.push({ t: text.slice(pos) });
    return teile;
  }
  const deanonymisieren = (text, karte) => deanonTeile(text, karte).map(x => x.t !== undefined ? x.t : x.echt).join("");

  function offenePlatzhalter(text) {
    return [...new Set((text.match(/\[(?:Person|Ort|Adresse|IBAN|E-Mail|Telefon|AHV-Nr\.|Datum|Kontrollschild|Vertrags-Nr\.|Jahrgang|Konto|Bankverbindung|Bank|Behörde|Objekt|Geburtsdatum|Zeit|Firma|Projekt|Finanzkonto|Aktenzeichen|Steuer-Nr\.|Sozialvers\.-Nr\.) \d+\]/g) || []))].sort();
  }
  function heikleThemen(text) {
    return Object.entries(D.ANON_HEIKEL).filter(([, p]) => new RegExp(p, "i").test(text || "")).map(([b]) => b);
  }

  glob.ShieldEngine = { anonymisieren, deanonymisieren, deanonTeile, offenePlatzhalter, heikleThemen, orteSetzen,
                        hinweisKI: D.BR_HINWEIS, bereit: () => !!ORTE };
})(typeof window !== "undefined" ? window : globalThis);
