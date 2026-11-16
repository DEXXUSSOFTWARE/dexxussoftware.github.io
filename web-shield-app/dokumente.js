/* DEXXUS WEB Shield – Dokumente lesen (PDF, Scans, Bilder, Pläne) mit Wortpositionen.
   Alles lokal: pdf.js 4.10.38 und Tesseract.js 5.1.1 liegen in lib/ (kein CDN, nichts wird hochgeladen).
   Schnittstelle laut Auftrag P1: window.ShieldDokumente.lesen(datei, opt) -> ShieldDokument */
"use strict";
(function (glob) {
  const BILD = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff"];
  const endung = n => (n.split(".").pop() || "").toLowerCase();
  const basis = opt => (opt && opt.libPfad) || new URL("lib/", document.baseURI).href;
  const DPI = 150, MAX_OCR = 4000, MAX_BILD = 6000, MAX_SEITE = 2400;

  /* ---------- pdf.js ---------- */
  let pdfjs = null;
  async function pdfLaden(opt) {
    if (pdfjs) return pdfjs;
    pdfjs = await import(basis(opt) + "pdfjs/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = basis(opt) + "pdfjs/pdf.worker.min.mjs";
    return pdfjs;
  }

  /* ---------- Tesseract: mehrere Worker parallel (eine Seite je Worker), vorgewärmt beim Öffnen ---------- */
  const POOL = [];            // {w, frei, melden}
  let warteschlange = [], tessLaden = null;
  async function tessSkript(opt) {
    if (glob.Tesseract) return;
    if (!tessLaden) tessLaden = new Promise((ok, nok) => {
      const s = document.createElement("script"); s.src = basis(opt) + "tesseract/tesseract.min.js";
      s.onload = ok; s.onerror = () => nok(new Error("Texterkennung konnte nicht geladen werden.")); document.head.appendChild(s);
    });
    await tessLaden;
  }
  function workerErstellen(opt) {
    const b = basis(opt), slot = { w: null, frei: false, melden: null };
    slot.bereit = new Promise((ok, nok) => {
      const zeit = setTimeout(() => nok(new Error("Texterkennung startet nicht (Zeitüberschreitung).")), 40000);
      glob.Tesseract.createWorker((opt && opt.sprachen) || "deu", 1, {
        workerPath: b + "tesseract/worker.min.js", corePath: b + "tesseract/", langPath: b + "sprachen",
        gzip: true, workerBlobURL: false, cacheMethod: "none",
        logger: m => { if (slot.melden && m.status === "recognizing text") slot.melden(m.progress); },
        errorHandler: e => { clearTimeout(zeit); nok(e instanceof Error ? e : new Error(String(e))); }
      }).then(w => { clearTimeout(zeit); slot.w = w; slot.frei = true; ok(slot); naechster(); }, e => { clearTimeout(zeit); nok(e); });
    });
    slot.bereit.catch(() => { const i = POOL.indexOf(slot); if (i >= 0) POOL.splice(i, 1); });
    POOL.push(slot);
    return slot.bereit;
  }
  const ZIEL = opt => (opt && opt.maxWorker) || Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  async function zuruecksetzen() {          // nur für Messungen: alle Worker beenden
    for (const x of POOL.splice(0)) { try { await x.w.terminate(); } catch (e) { /* egal */ } }
  }
  async function vorwaermen(opt) {
    await tessSkript(opt);
    if (!POOL.length) await workerErstellen(opt);
  }
  function naechster() {
    while (warteschlange.length) {
      const slot = POOL.find(x => x.frei); if (!slot) return;
      slot.frei = false; warteschlange.shift()(slot);
    }
  }
  async function workerHolen(opt, gebraucht) {
    await tessSkript(opt);
    const fehlend = Math.min(ZIEL(opt), gebraucht) - POOL.length;
    for (let i = 0; i < fehlend; i++) workerErstellen(opt).catch(() => {});
    if (!POOL.length) await workerErstellen(opt);
    return new Promise(ok => { warteschlange.push(ok); naechster(); });
  }

  /* Canvas -> Wörter mit Position (Koordinaten im Pixelraum von canvas) */
  async function ocr(canvas, opt, melden, gebraucht) {
    let quelle = canvas, f = 1;
    const gross = Math.max(canvas.width, canvas.height);
    const skala = Math.min((opt && opt.ocrSkala) || 1, MAX_OCR / gross);
    if (skala < 1) {                          // grosse Pläne verkleinern, Koordinaten danach zurückrechnen
      f = skala; quelle = document.createElement("canvas");
      quelle.width = Math.round(canvas.width * f); quelle.height = Math.round(canvas.height * f);
      quelle.getContext("2d").drawImage(canvas, 0, 0, quelle.width, quelle.height);
    }
    const slot = await workerHolen(opt, gebraucht || 1);
    let data;
    try { slot.melden = melden; data = (await slot.w.recognize(quelle, {}, { blocks: true, text: true })).data; }
    finally { slot.melden = null; slot.frei = true; naechster(); }
    const woerter = []; let zeile = 0, summe = 0, n = 0;
    for (const bl of data.blocks || []) for (const pa of bl.paragraphs || []) for (const li of pa.lines || []) {
      for (const wo of li.words || []) {
        const t = (wo.text || "").trim(); if (!t) continue;
        const bb = wo.bbox;
        woerter.push({ t, x: bb.x0 / f, y: bb.y0 / f, w: (bb.x1 - bb.x0) / f, h: (bb.y1 - bb.y0) / f, zeile, sicherheit: Math.round(wo.confidence) });
        summe += wo.confidence; n++;
      }
      zeile++;
    }
    return { woerter, text: zeilenText(woerter), sicherheit: n ? Math.round(summe / n) : 0 };
  }

  /* Seitenbild erst erzeugen, wenn es gebraucht wird (Editor) – spart Zeit beim Lesen */
  function bildSpaeter(seite, canvas, q) {
    let url = null; seite.hatBild = true;
    Object.defineProperty(seite, "bild", { enumerable: true, configurable: true,
      get() { if (url === null) { url = canvas.toDataURL("image/jpeg", q); canvas = null; } return url; } });
  }

  function zeilenText(woerter) {
    const z = [];
    for (const w of woerter) (z[w.zeile] = z[w.zeile] || []).push(w.t);
    return z.filter(Boolean).map(a => a.join(" ")).join("\n");
  }

  /* pdf.js-Textstücke in Wörter mit Pixelposition zerlegen und zu Zeilen gruppieren */
  function pdfWoerter(inhalt, viewport) {
    const roh = [];
    for (const it of inhalt.items) {
      if (!it.str || !it.str.trim()) continue;
      const m = pdfjs.Util.transform(viewport.transform, it.transform);
      const hoehe = Math.hypot(m[2], m[3]) || 10;
      const breite = it.width * viewport.scale;
      const x0 = m[4], yBase = m[5];
      const zeichen = it.str.length || 1;
      let pos = 0;
      for (const teil of it.str.split(/(\s+)/)) {
        if (teil && !/^\s+$/.test(teil)) roh.push({ t: teil, x: x0 + breite * pos / zeichen, y: yBase - hoehe, w: breite * teil.length / zeichen, h: hoehe * 1.15 });
        pos += teil.length;
      }
    }
    roh.sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.5 ? a.x - b.x : a.y - b.y));
    let zeile = -1, letzteY = null, letzteH = 0;
    for (const w of roh) {
      if (letzteY === null || Math.abs(w.y - letzteY) > Math.min(w.h, letzteH) * 0.5) { zeile++; letzteY = w.y; letzteH = w.h; }
      w.zeile = zeile;
    }
    return roh;
  }

  async function pdfLesen(datei, opt, melden) {
    const lib = await pdfLaden(opt);
    let doc;
    try { doc = await lib.getDocument({ data: new Uint8Array(await datei.arrayBuffer()), isEvalSupported: false }).promise; }
    catch (e) { throw new Error(e && e.name === "PasswordException" ? "PDF ist passwortgeschützt – bitte ohne Kennwort speichern." : "PDF kann nicht gelesen werden."); }
    const total = Math.min(doc.numPages, (opt && opt.maxSeiten) || 200);
    const seiten = [], warnungen = []; let ocrVerwendet = false;
    if (doc.numPages > total) warnungen.push("Nur die ersten " + total + " von " + doc.numPages + " Seiten gelesen.");
    const modus = (opt && opt.ocr) || "auto", ocrSeiten = [], ocrLaeuft = [], anteil = {};
    const zeigen = () => {
      const n = Math.max(ocrSeiten.length, 1), fertig = Object.values(anteil).reduce((x, y) => x + y, 0) / n;
      melden(0.2 + 0.8 * fertig, "Texterkennung " + Math.round(fertig * 100) + " %");
    };
    const seiteErkennen = async (seite, canvas) => {
      anteil[seite.nr] = 0; ocrVerwendet = true;
      const r = await ocr(canvas, opt, p => { anteil[seite.nr] = p; zeigen(); }, Math.max(2, total));
      anteil[seite.nr] = 1; zeigen();
      seite.woerter = r.woerter; seite.text = r.text;
      if (r.sicherheit && r.sicherheit < 70) warnungen.push("Seite " + seite.nr + ": Texterkennung unsicher (" + r.sicherheit + " %) – Ergebnis prüfen.");
    };
    for (let nr = 1; nr <= total; nr++) {
      if (!ocrSeiten.length) melden((nr - 1) / total * 0.2, "Seite " + nr + " von " + total + " …");
      const page = await doc.getPage(nr);
      let scale = DPI / 72;
      const v1 = page.getViewport({ scale: 1 });
      const maxPx = (opt && opt.maxPx) || MAX_SEITE;   // A4 mit 150 dpi ≈ 1754 px; grosse Seiten (z. B. Scans mit falscher Seitengrösse) begrenzen
      if (Math.max(v1.width, v1.height) * scale > maxPx) scale = maxPx / Math.max(v1.width, v1.height);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const woerter = pdfWoerter(await page.getTextContent(), viewport);
      const seite = { nr, breite: canvas.width, hoehe: canvas.height, text: zeilenText(woerter), woerter };
      bildSpaeter(seite, canvas, 0.9);
      if (modus === "immer" || (modus === "auto" && seite.text.replace(/\s/g, "").length < 20)) ocrSeiten.push(seite);
      seiten.push(seite);
      page.cleanup();
      // Texterkennung sofort starten, während die nächste Seite gerendert wird
      if (ocrSeiten[ocrSeiten.length - 1] === seite) ocrLaeuft.push(seiteErkennen(seite, canvas));
    }
    await Promise.all(ocrLaeuft);
    await doc.destroy();
    return { typ: "pdf", seiten, warnungen, ocrVerwendet };
  }

  async function bildLesen(datei, opt, melden) {
    let bmp;
    try { bmp = await createImageBitmap(datei); }
    catch (e) { throw new Error(/tiff?$/.test(endung(datei.name)) ? "TIFF kann der Browser nicht öffnen – bitte als PNG oder JPG speichern." : "Bild kann nicht geöffnet werden."); }
    let f = Math.min(1, MAX_BILD / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * f); canvas.height = Math.round(bmp.height * f);
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#FFFFFF"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    melden(0, "Texterkennung wird gestartet …");
    const r = await ocr(canvas, opt, p => melden(p, "Texterkennung " + Math.round(p * 100) + " % …"));
    const warnungen = [];
    if (r.sicherheit && r.sicherheit < 70) warnungen.push("Texterkennung unsicher (" + r.sicherheit + " %) – Ergebnis prüfen.");
    const seite = { nr: 1, breite: canvas.width, hoehe: canvas.height, text: r.text, woerter: r.woerter };
    bildSpaeter(seite, canvas, 0.92);
    return { typ: "bild", seiten: [seite], warnungen, ocrVerwendet: true };
  }

  async function lesen(datei, opt) {
    opt = opt || {};
    const start = performance.now();
    const melden = (a, m) => { try { opt.fortschritt && opt.fortschritt(Math.max(0, Math.min(1, a)), m); } catch (e) { /* Anzeige egal */ } };
    const e = endung(datei.name);
    let r;
    if (e === "pdf") r = await pdfLesen(datei, opt, melden);
    else if (BILD.includes(e) || /^image\//.test(datei.type)) r = await bildLesen(datei, opt, melden);
    else if (glob.ShieldDokBasis) {
      const b = await glob.ShieldDokBasis.lesenOhneBild(datei);
      r = { typ: e === "docx" ? "docx" : "txt", seiten: [{ nr: 1, breite: 0, hoehe: 0, text: b.text, woerter: [], bild: null }], warnungen: b.warnungen || [], ocrVerwendet: false };
    } else throw new Error("Dateityp ." + e + " wird nicht unterstützt.");
    melden(1, "fertig");
    return {
      name: datei.name, typ: r.typ, text: r.seiten.map(s => s.text).join("\n\n"), seiten: r.seiten, warnungen: r.warnungen,
      meta: { seitenTotal: r.seiten.length, ocrVerwendet: r.ocrVerwendet, dauerMs: Math.round(performance.now() - start) }
    };
  }

  glob.ShieldDokumente = { lesen, vorwaermen, zuruecksetzen, akzeptiert: ".pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.bmp,.gif" };
})(window);
