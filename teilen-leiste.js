/* Leiste unter dem Menü (alle Seiten): dexxus.ch weiterempfehlen (WhatsApp, Threema, Telegram, SMS, E-Mail)
   und «Shield kaufen» mit Auswahl: WEB Shield (inkl. App Shield), PC Shield oder Shield komplett.
   Entscheid Markus 16.11.2026: App Shield im WEB-Shield-Abo inklusive; Shield komplett 1 Jahr CHF 139.– */
(function () {
  "use strict";
  var LINK = "https://dexxus.ch";
  var ZAHLUNG = "https://autoteileexpress.payrexx.com/pay?tid=86ce70f3";   // gleiche Payrexx-Seite wie alle DEXXUS-Pakete
  var e = encodeURIComponent(LINK);
  var nurMenue = !!(document.currentScript && document.currentScript.hasAttribute("data-nur-menue"));   // z.B. Demo: nur Menü, keine Leiste/Kauf-Knöpfe
  var kopf = document.querySelector(".dxw-top");
  if (!kopf || document.querySelector(".dx-leiste")) return;

  if (!nurMenue) {
  var leiste = document.createElement("div");
  leiste.className = "dx-leiste";
  leiste.innerHTML =
    '<div class="in">' +
      '<span class="dx-l-text">dexxus.ch weiterempfehlen:</span>' +
      '<a class="dx-l wa" href="https://wa.me/?text=' + e + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '<a class="dx-l th" href="https://threema.id/compose?text=' + e + '" target="_blank" rel="noopener">Threema</a>' +
      '<a class="dx-l tm" href="https://t.me/share/url?url=' + e + '" target="_blank" rel="noopener">Telegram</a>' +
      '<a class="dx-l sms" href="sms:?&amp;body=' + e + '">SMS</a>' +
      '<a class="dx-l mail" href="mailto:?subject=' + encodeURIComponent("DEXXUS – Schweizer Bürosoftware mit KI-Datenschutz") + '&amp;body=' + e + '">E-Mail</a>' +
      '<button class="dx-l teilen" type="button" id="dx-teilen">Mit Freunden teilen</button>' +
      '<span class="dx-l-sp"></span>' +
      '<button class="dx-l kauf" type="button" id="dx-shield-kaufen">Shield kaufen</button>' +
    '</div>';
  kopf.insertAdjacentElement("afterend", leiste);

  /* Mobile: «Mit Freunden teilen» öffnet das Teilen-Menü des Mobiles (sonst die Messenger-Liste ein-/ausblenden) */
  document.getElementById("dx-teilen").addEventListener("click", function () {
    if (navigator.share) { navigator.share({ title: "DEXXUS", text: "DEXXUS – Schweizer Bürosoftware mit KI-Datenschutz", url: LINK }).catch(function () {}); return; }
    leiste.classList.toggle("offen");
  });
  }

  /* 17.11.2026: Reiter «Shield» – Auswahl mit drei Kacheln (PC Shield, WEB Shield, App Shield) */
  var SHIELDS = [["PC Shield", "/shield.html", "Programm für Windows"], ["WEB Shield", "/web-shield.html", "Im Browser neben der KI"], ["App Shield", "/app-shield/", "Auf dem Mobile"]];
  var schildSvg = '<svg viewBox="0 0 48 56" aria-hidden="true"><path d="M24 3 6 10v14c0 13 7.7 23.4 18 28 10.3-4.6 18-15 18-28V10L24 3z" fill="rgba(250,250,255,.18)" stroke="#FAFAFF" stroke-width="3" stroke-linejoin="round"/><path d="m15 28 6.5 6.5L34 21" fill="none" stroke="#FAFAFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var sReiter = kopf.querySelector("[data-shield]");
  if (sReiter) {
    var sp = document.createElement("div");
    sp.className = "dx-shield-panel"; sp.hidden = true;
    sp.innerHTML = '<div class="dx-sp-in">' + SHIELDS.map(function (x) {
      return '<a class="dx-sk-kachel" href="' + x[1] + '">' + schildSvg + '<b>' + x[0] + '</b><small>' + x[2] + '</small></a>';
    }).join("") + '</div>';
    kopf.appendChild(sp);
    var spZu = function () { sp.hidden = true; sReiter.classList.remove("offen"); };
    sReiter.addEventListener("click", function (ev) {
      if (window.innerWidth <= 860 || document.documentElement.classList.contains("dx-eng")) return;
      ev.preventDefault(); sp.hidden = !sp.hidden; sReiter.classList.toggle("offen", !sp.hidden);
    });
    document.addEventListener("click", function (ev) { if (!sp.hidden && !ev.target.closest(".dx-shield-panel, [data-shield]")) spZu(); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") spZu(); });
  }

  /* Mobile: Menü-Knopf in der Kopfzeile – alle Reiter als Liste */
  var nav = kopf.querySelector(".dxw-menu"), innen = kopf.querySelector(".in");
  if (nav && innen) {
    var mk = document.createElement("button");
    mk.type = "button"; mk.className = "dx-menue-knopf"; mk.setAttribute("aria-expanded", "false"); mk.setAttribute("aria-label", "Menü öffnen");
    mk.innerHTML = "<span></span><span></span><span></span><b>Menü</b>";
    innen.appendChild(mk);
    var liste = document.createElement("nav");
    liste.className = "dx-menue-liste"; liste.hidden = true; liste.setAttribute("aria-label", "Hauptmenü");
    liste.innerHTML = nav.innerHTML;
    var ls = liste.querySelector("[data-shield]");      // Mobile: die drei Shields einzeln
    if (ls) {
      ls.insertAdjacentHTML("afterend", '<span class="dx-ml-titel">Shield</span>' + SHIELDS.map(function (x) { return '<a class="dx-ml-sub" href="' + x[1] + '">' + x[0] + '</a>'; }).join(""));
      ls.remove();
    }
    kopf.appendChild(liste);
    mk.addEventListener("click", function () {
      liste.hidden = !liste.hidden; mk.setAttribute("aria-expanded", String(!liste.hidden)); mk.classList.toggle("an", !liste.hidden);
    });
    liste.addEventListener("click", function (ev) { if (ev.target.closest("a")) { liste.hidden = true; mk.classList.remove("an"); mk.setAttribute("aria-expanded", "false"); } });
    /* 28.11.2026: passt das Menü nicht in die Kopfzeile (viele Reiter, grosse Schrift), Menü-Knopf statt Reiter */
    var eng = function () {
      var h = document.documentElement;
      h.classList.remove("dx-eng");
      if (window.innerWidth > 860 && nav.scrollWidth > nav.clientWidth + 1) h.classList.add("dx-eng");
      else if (window.innerWidth > 860) { liste.hidden = true; mk.classList.remove("an"); mk.setAttribute("aria-expanded", "false"); }
    };
    eng();
    window.addEventListener("resize", eng);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(eng);
  }
  if (nurMenue) return;

  var ov = document.createElement("div");
  ov.className = "dx-sk-ov"; ov.hidden = true;
  ov.innerHTML =
    '<div class="dx-sk" role="dialog" aria-modal="true" aria-labelledby="dx-sk-t">' +
      '<button class="dx-sk-zu" type="button" aria-label="Schliessen">&times;</button>' +
      '<h3 id="dx-sk-t">Welches Shield möchten Sie?</h3>' +
      '<p class="dx-sk-u">Alle Shields schwärzen Namen, Adressen und IBAN, bevor etwas an ChatGPT &amp; Co. geht.</p>' +
      '<label class="dx-sk-w"><input type="radio" name="dxsk" value="web" checked><span><b>WEB Shield Abo</b><small>WEB Shield + App Shield · im Browser (Edge, Chrome) und auf dem Mobile · Abo 1, 2 oder 3 Jahre · Team-Lizenzen möglich</small></span><em>ab CHF 9.90/Mt</em></label>' +
      '<label class="dx-sk-w"><input type="radio" name="dxsk" value="pc"><span><b>PC Shield</b><small>Programm für Windows · für Dateien, PDFs und jede KI</small></span><em>CHF 49.– einmalig</em></label>' +
      '<label class="dx-sk-w beste"><input type="radio" name="dxsk" value="komplett"><span><b>Shield komplett</b><small>PC Shield + WEB Shield + App Shield · 1 Jahr</small><i>Sie sparen CHF 28.80</i></span><em>CHF 139.–<s>CHF 167.80</s></em></label>' +
      '<label class="dx-sk-agb" id="dx-sk-agb-z" hidden><input type="checkbox" id="dx-sk-agb"> Ich akzeptiere die <a href="/agb.html" target="_blank">AGB</a>. Die Lizenz kommt nach der Zahlung per E-Mail.</label>' +
      '<button class="dx-sk-los" type="button" id="dx-sk-los">Weiter</button>' +
    '</div>';
  document.body.appendChild(ov);

  var wahl = function () { return ov.querySelector('input[name="dxsk"]:checked').value; };
  var los = ov.querySelector("#dx-sk-los"), agbZ = ov.querySelector("#dx-sk-agb-z");
  function zeigen() {
    var w = wahl();
    agbZ.hidden = w !== "komplett";
    los.textContent = w === "komplett" ? "Jetzt bezahlen – CHF 139.–" : w === "pc" ? "Weiter zu PC Shield" : "Weiter zu WEB Shield";
  }
  ov.addEventListener("change", zeigen);
  function auf() { ov.hidden = false; zeigen(); los.focus(); }
  function zu() { ov.hidden = true; }
  document.getElementById("dx-shield-kaufen").addEventListener("click", auf);
  ov.querySelector(".dx-sk-zu").addEventListener("click", zu);
  ov.addEventListener("click", function (ev) { if (ev.target === ov) zu(); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !ov.hidden) zu(); });
  los.addEventListener("click", function () {
    var w = wahl();
    if (w === "web") { location.href = "/web-shield.html?kauf=1"; return; }
    if (w === "pc") { location.href = "/shield.html?kauf=1"; return; }
    if (!ov.querySelector("#dx-sk-agb").checked) { agbZ.classList.add("rot"); return; }
    var paket = "DEXXUS Shield komplett";
    var q = new URLSearchParams({ invoice_amount: "139.00", invoice_currency: "1", invoice_number: paket + ", 12 Monate", contact_country: "204", referenceId: ["WEB", paket, 12].join("|") });
    location.href = ZAHLUNG + (ZAHLUNG.indexOf("?") > -1 ? "&" : "?") + q.toString();
  });

  /* 17.11.2026: Banner «No leaks …» unten auf jeder Seite + grüner schwebender Kauf-Knopf.
     Shield-Seiten: Kaufen öffnet die Shield-Auswahl; ERP-Seiten: Kaufen führt zur Preisseite mit den Paketen. */
  var istShield = /shield/i.test(location.pathname);
  var kaufen = function (ev) {
    if (ev) ev.preventDefault();
    if (istShield) { auf(); return; }
    location.href = "/preise.html";
  };
  var fuss = document.querySelector("footer.dxw-foot, footer.mk-fuss");
  if (fuss && !document.querySelector(".gross-band, .dx-band")) {
    var band = document.createElement("section");
    band.className = "dx-band" + (fuss.classList.contains("mk-fuss") ? " dx-band-app" : "");
    band.innerHTML = '<div class="in"><div><b><span>No leaks.</span> <span>No tracking.</span> <span>No identity theft.</span></b>' +
      (istShield ? '<span class="t">Namen, Adressen und IBAN gehören nicht ins Web – sondern zu Ihnen. KI benutzen ohne Risiko – mit DEXXUS Shield.</span>'
                 : '<span class="t">Kunden, Offerten und Rechnungen bleiben auf Ihrem PC – Bürosoftware mit KI und echtem Datenschutz: DEXXUS.</span>') +
      '</div><a class="dx-band-k" href="' + (istShield ? "#kaufen" : "/preise.html") + '">' + (istShield ? "Jetzt kaufen" : "Pakete und Preise") + '</a></div>';
    fuss.parentNode.insertBefore(band, fuss);
    band.querySelector(".dx-band-k").addEventListener("click", kaufen);
  }
  var sw = document.getElementById("schwebe");
  if (!sw) {
    sw = document.createElement("a");
    sw.className = "schwebe dx-schwebe"; sw.id = "schwebe"; sw.href = istShield ? "#kaufen" : "/preise.html";
    sw.textContent = istShield ? "Jetzt kaufen · ab CHF 9.90" : "Jetzt kaufen · ab CHF 19.90";
    if (fuss && fuss.classList.contains("mk-fuss")) sw.classList.add("dx-schwebe-app");
    document.body.appendChild(sw);
    sw.addEventListener("click", kaufen);
    addEventListener("scroll", function () { sw.classList.toggle("an", scrollY > innerHeight * 0.9); }, { passive: true });
  }
  /* Kauf-Knopf ausblenden, sobald die Fusszeile (Impressum, Datenschutz, AGB) sichtbar ist – sonst verdeckt er die Links */
  if (sw && fuss && "IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { sw.classList.toggle("weg", e[0].isIntersecting); }).observe(fuss);
  }
})();
