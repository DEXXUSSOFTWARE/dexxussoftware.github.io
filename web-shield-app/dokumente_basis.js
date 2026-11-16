/* DEXXUS Shield – Dokumente lesen (Testversion 1): Text, Word (.docx).  PDF, Scans und Bilder über dokumente.js
   (window.ShieldDokumente).  Alles lokal, nichts wird hochgeladen. */
"use strict";
(function (glob) {
  const endung = n => (n.split(".").pop() || "").toLowerCase();

  async function inflate(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const strom = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(strom).arrayBuffer());
  }

  /* Minimaler ZIP-Leser (für .docx). Liefert {pfad: Uint8Array} für die gewünschten Dateien. */
  async function zipLesen(buf, filter) {
    const dv = new DataView(buf), u8 = new Uint8Array(buf);
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("Datei ist kein gültiges Word-Dokument (ZIP fehlt).");
    const anzahl = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const td = new TextDecoder();
    const aus = {};
    for (let n = 0; n < anzahl; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const methode = dv.getUint16(p + 10, true), groesse = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), kl = dv.getUint16(p + 32, true);
      const lokal = dv.getUint32(p + 42, true);
      const name = td.decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + xl + kl;
      if (!filter(name)) continue;
      const lnl = dv.getUint16(lokal + 26, true), lxl = dv.getUint16(lokal + 28, true);
      const daten = u8.subarray(lokal + 30 + lnl + lxl, lokal + 30 + lnl + lxl + groesse);
      if (methode === 0) aus[name] = daten;
      else if (methode === 8) aus[name] = await inflate(daten);
    }
    return aus;
  }

  function xmlText(xml) {
    return xml
      .replace(/<w:tab\/>/g, "\t").replace(/<w:br[^>]*\/>/g, "\n").replace(/<\/w:p>/g, "\n").replace(/<\/w:tc>/g, "\t")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&amp;/g, "&")
      .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  async function docx(datei) {
    const teile = await zipLesen(await datei.arrayBuffer(), n => /^word\/(document|header\d*|footer\d*|footnotes)\.xml$/.test(n));
    const td = new TextDecoder("utf-8");
    const reihenfolge = Object.keys(teile).sort((a, b) => (a.includes("header") ? 0 : a.includes("document") ? 1 : 2) - (b.includes("header") ? 0 : b.includes("document") ? 1 : 2));
    return reihenfolge.map(n => xmlText(td.decode(teile[n]))).filter(Boolean).join("\n\n");
  }

  async function text(datei) {
    const buf = await datei.arrayBuffer();
    let t = new TextDecoder("utf-8").decode(buf);
    if ((t.match(/�/g) || []).length > 3) t = new TextDecoder("windows-1252").decode(buf);
    return t;
  }

  async function lesen(datei, opt) {
    const e = endung(datei.name);
    if (glob.ShieldDokumente && glob.ShieldDokumente.lesen && ["pdf", "png", "jpg", "jpeg", "webp", "tif", "tiff"].includes(e)) {
      const d = await glob.ShieldDokumente.lesen(datei, opt);   // dokumente.js: PDF, Scans, Bilder, Pläne
      return { name: datei.name, text: d.text, warnungen: d.warnungen || [], dok: d };
    }
    return lesenOhneBild(datei);
  }

  async function lesenOhneBild(datei) {
    const e = endung(datei.name);
    if (["txt", "md", "csv"].includes(e)) return { name: datei.name, text: await text(datei), warnungen: [] };
    if (e === "docx") return { name: datei.name, text: await docx(datei), warnungen: [] };
    if (e === "doc") throw new Error("Altes Word-Format (.doc): bitte in Word als .docx speichern.");
    if (e === "pdf") throw new Error("PDF kommt in Testversion 2. Bis dahin: Text im PDF markieren, kopieren und ins Textfeld einfügen.");
    if (["png", "jpg", "jpeg", "webp", "tif", "tiff"].includes(e)) throw new Error("Bilder und Scans kommen in Testversion 2.");
    throw new Error("Dateityp ." + e + " wird nicht unterstützt.");
  }

  glob.ShieldDokBasis = { lesen, lesenOhneBild, akzeptiert: ".txt,.md,.csv,.docx,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif" };
})(window);
