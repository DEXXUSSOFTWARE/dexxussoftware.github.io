/* Leiste unter dem Menü (alle Seiten): dexxus.ch weiterempfehlen (WhatsApp, Threema, Telegram, SMS, E-Mail)
   und «Shield kaufen» mit Auswahl: WEB Shield (inkl. App Shield), PC Shield oder Shield komplett.
   Entscheid Markus 16.11.2026: App Shield im WEB-Shield-Abo inklusive; Shield komplett 1 Jahr CHF 139.– */
(function () {
  "use strict";
  var LINK = "https://dexxus.ch";
  var ZAHLUNG = "https://autoteileexpress.payrexx.com/pay?tid=86ce70f3";   // gleiche Payrexx-Seite wie alle DEXXUS-Pakete
  var e = encodeURIComponent(LINK);
  var kopf = document.querySelector(".dxw-top");
  if (!kopf || document.querySelector(".dx-leiste")) return;

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
      '<span class="dx-l-sp"></span>' +
      '<button class="dx-l kauf" type="button" id="dx-shield-kaufen">Shield kaufen</button>' +
    '</div>';
  kopf.insertAdjacentElement("afterend", leiste);

  var ov = document.createElement("div");
  ov.className = "dx-sk-ov"; ov.hidden = true;
  ov.innerHTML =
    '<div class="dx-sk" role="dialog" aria-modal="true" aria-labelledby="dx-sk-t">' +
      '<button class="dx-sk-zu" type="button" aria-label="Schliessen">&times;</button>' +
      '<h3 id="dx-sk-t">Welches Shield möchten Sie?</h3>' +
      '<p class="dx-sk-u">Alle Shields schwärzen Namen, Adressen und IBAN, bevor etwas an ChatGPT &amp; Co. geht.</p>' +
      '<label class="dx-sk-w"><input type="radio" name="dxsk" value="web" checked><span><b>WEB Shield + App Shield</b><small>Im Browser (Edge, Chrome) und auf dem Handy · Abo 1, 2 oder 3 Jahre · Team-Lizenzen möglich</small></span><em>ab CHF 9.90/Mt</em></label>' +
      '<label class="dx-sk-w"><input type="radio" name="dxsk" value="pc"><span><b>PC Shield</b><small>Programm für Windows · für Dateien, PDFs und jede KI</small></span><em>CHF 49.– einmalig</em></label>' +
      '<label class="dx-sk-w beste"><input type="radio" name="dxsk" value="komplett"><span><b>Shield komplett</b><small>PC Shield + WEB Shield + App Shield · 1 Jahr</small><i>Sie sparen CHF 28.80</i></span><em>CHF 139.–<s>CHF 167.80</s></em></label>' +
      '<label class="dx-sk-agb" id="dx-sk-agb-z" hidden><input type="checkbox" id="dx-sk-agb"> Ich akzeptiere die <a href="agb.html" target="_blank">AGB</a>. Die Lizenz kommt nach der Zahlung per E-Mail.</label>' +
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
    if (w === "web") { location.href = "web-shield.html?kauf=1"; return; }
    if (w === "pc") { location.href = "shield.html?kauf=1"; return; }
    if (!ov.querySelector("#dx-sk-agb").checked) { agbZ.classList.add("rot"); return; }
    var paket = "DEXXUS Shield komplett";
    var q = new URLSearchParams({ invoice_amount: "139.00", invoice_currency: "1", invoice_number: paket + ", 12 Monate", contact_country: "204", referenceId: ["WEB", paket, 12].join("|") });
    location.href = ZAHLUNG + (ZAHLUNG.indexOf("?") > -1 ? "&" : "?") + q.toString();
  });
})();
