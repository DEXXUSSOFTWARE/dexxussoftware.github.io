# -*- coding: utf-8 -*-
"""Baut DEXXUS_Pressemappe.pdf neu: gleiches Design wie bisher (Farben/Schriften/Kartenraster),
neue Gewichtung/Reihenfolge der Inhalte gemaess Vorgabe."""
import os
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

PAGE_W, PAGE_H = A4  # 595.2756 x 841.8898

DARK = (15/255, 23/255, 42/255)        # #0F172A
BLUE = (37/255, 99/255, 235/255)       # #2563EB
GREY_BODY = (71/255, 85/255, 105/255)  # #475569 (Karten-Fliesstext)
DARKISH = (31/255, 41/255, 55/255)     # #1F2937 (Absatz-Fliesstext)
BORDER = (226/255, 232/255, 240/255)   # #E2E8F0
MUTED = (100/255, 116/255, 139/255)    # #64748B (Hinweis/Footer)

F_REG = "Helvetica"
F_BOLD = "Helvetica-Bold"

L = 57.02362            # linker/rechter Rand Haupttext
GRID_L = 51.02362        # linker Rand Kartenraster (6pt "Bleed" fuer blauen Akzentbalken)
CONTENT_W = 481.2283     # Breite Haupttext (= Trennlinienlaenge)
COL_W = 235.2756         # Kartenbreite
GUTTER = 11.3386         # Abstand zwischen den zwei Spalten
COL2_X = GRID_L + COL_W + GUTTER

def wrap(c, text, font, size, max_w):
    words = text.split(" ")
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if c.stringWidth(test, font, size) <= max_w or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines

def draw_header(c):
    """Logo + Tagline + Trennlinie - identisch zum bereits korrigierten Stand."""
    c.setFont(F_BOLD, 30)
    c.setFillColorRGB(*DARK)
    logo_baseline = PAGE_H - 57.6 - 21.6  # = 760.5354 (unveraendert zum Fix)
    c.drawString(L, logo_baseline, "DEXXUS")

    c.setFont(F_BOLD, 10.5)
    c.setFillColorRGB(*BLUE)
    tagline_baseline = 748.5354  # = 764.5354 - 16 (korrigierter Abstand)
    c.drawString(L, tagline_baseline, "DATA · WISSEN · RECHT · ERP   ·   powered by avotec AG")

    line_y = 741.4354
    c.setStrokeColorRGB(*BORDER)
    c.setLineWidth(1.1)
    c.setLineCap(1)
    c.line(L, line_y, L + CONTENT_W, line_y)
    return line_y

def draw_wrapped_paragraph(c, x, top_y, text, font=F_REG, size=10.3, leading=15, color=DARKISH, max_w=CONTENT_W):
    lines = wrap(c, text, font, size, max_w)
    c.setFont(font, size)
    c.setFillColorRGB(*color)
    y = top_y
    for ln in lines:
        c.drawString(x, y, ln)
        y -= leading
    return y  # y nach der letzten Zeile (Baseline der letzten Zeile)

def draw_heading(c, x, y, text, size=14):
    c.setFont(F_BOLD, size)
    c.setFillColorRGB(*DARK)
    c.drawString(x, y, text)

CARD_PAD_X = 9
CARD_PAD_TOP_TITLE = 3.7      # Abstand Boxoberkante -> Titel-Baseline-Offset (wie Original ~)
TITLE_SIZE, TITLE_LEAD = 10.3, 14
BODY_SIZE, BODY_LEAD = 9.3, 12.5
TITLE_TO_BODY_GAP = 12        # Luecke zwischen Titelzeile und erster Fliesstextzeile

def card_height(c, title_lines_n, body_lines_n):
    # Oben: Padding bis Titel-Baseline, dann Titelzeile(n) -> Luecke -> Body-Zeilen -> unteres Padding.
    return title_lines_n * TITLE_LEAD + TITLE_TO_BODY_GAP + body_lines_n * BODY_LEAD + 8

def draw_card(c, x, top_y, title, body, width=COL_W):
    title_lines = wrap(c, title, F_BOLD, TITLE_SIZE, width - 2 * CARD_PAD_X)
    body_lines = wrap(c, body, F_REG, BODY_SIZE, width - 2 * CARD_PAD_X)
    h = card_height(c, len(title_lines), len(body_lines))
    bottom_y = top_y - h

    c.setStrokeColorRGB(*BORDER)
    c.setLineWidth(0.7)
    c.setLineJoin(1)
    c.line(x, top_y, x + width, top_y)
    c.line(x, bottom_y, x + width, bottom_y)
    c.line(x, bottom_y, x, top_y)
    c.line(x + width, bottom_y, x + width, top_y)
    c.setStrokeColorRGB(*BLUE)
    c.setLineWidth(2.4)
    c.line(x, bottom_y, x, top_y)

    c.setFont(F_BOLD, TITLE_SIZE)
    c.setFillColorRGB(*DARK)
    ty = top_y - TITLE_LEAD + 3.0
    for ln in title_lines:
        c.drawString(x + CARD_PAD_X, ty, ln)
        ty -= TITLE_LEAD

    c.setFont(F_REG, BODY_SIZE)
    c.setFillColorRGB(*GREY_BODY)
    by = ty - (TITLE_TO_BODY_GAP - TITLE_LEAD)
    for ln in body_lines:
        c.drawString(x + CARD_PAD_X, by, ln)
        by -= BODY_LEAD

    return h

def draw_grid(c, top_y, cards):
    """cards: Liste von (title, body). Zwei Spalten, Zeile fuer Zeile, Zeilenhoehe = max beider Karten."""
    y = top_y
    it = iter(cards)
    for left, right in zip(it, it):
        tl_l = len(wrap(c, left[0], F_BOLD, TITLE_SIZE, COL_W - 2 * CARD_PAD_X))
        tl_r = len(wrap(c, right[0], F_BOLD, TITLE_SIZE, COL_W - 2 * CARD_PAD_X))
        bl_l = len(wrap(c, left[1], F_REG, BODY_SIZE, COL_W - 2 * CARD_PAD_X))
        bl_r = len(wrap(c, right[1], F_REG, BODY_SIZE, COL_W - 2 * CARD_PAD_X))
        h_l = card_height(c, tl_l, bl_l)
        h_r = card_height(c, tl_r, bl_r)
        row_h = max(h_l, h_r)
        draw_card(c, GRID_L, y, left[0], left[1], width=COL_W)
        draw_card(c, COL2_X, y, right[0], right[1], width=COL_W)
        y -= row_h + 7.5
    return y

UEBER_TEXT = (
    "DEXXUS ist eine Schweizer Büro-Software mit eigener interner KI, die direkt auf dem PC arbeitet – "
    "Ihre Daten verlassen das Gerät nie. Für bekannte Online-KI wie Claude, ChatGPT, Copilot, Gemini "
    "oder DeepL sorgt der DEXXUS-Shield-Schutz dafür, dass Namen, Adressen und weitere Personendaten vorher "
    "automatisch geschwärzt werden – derselbe Schutz schützt eigenständig auch andere "
    "Büroanwendungen wie bexio, SelectLine, Abacus oder Praxis-Software. Dazu kommen Offerten, Rechnungen mit "
    "QR-Einzahlungsschein, Dokumente und Akten in einem Programm – sowie ein selbst zusammengestelltes Team "
    "virtueller Mitarbeiter, das Routinearbeit erledigt und an Sie rapportiert. DEXXUS ist ein Produkt der avotec AG."
)

CARDS = [
    ("Interne KI – alles bleibt auf dem PC",
     "Die eingebaute KI läuft lokal auf Ihrem Computer. Ihre Daten verlassen das Gerät nie – keine Cloud nötig."),
    ("Online-KI mit DEXXUS-Shield-Schutz",
     "Claude, ChatGPT, Copilot, Gemini, DeepL – DEXXUS schwärzt Namen, Adressen und Nummern automatisch, "
     "mit Vorschau vor dem Senden."),
    ("Shield-Schutz auch für bexio, SelectLine, Abacus & Co.",
     "Dieselbe Schwärzung eigenständig für Ihre bestehenden Büroanwendungen – bexio, SelectLine, "
     "Abacus, Praxis-Software. Per Kopieren/Einfügen, einmalig ab CHF 49.–."),
    ("Virtuelle Mitarbeiter – Ihr eigenes KI-Team",
     "Selbst zusammengestellt (Funktion, Kompetenzen, Pflichtenheft) – erledigt Routinearbeit und rapportiert an Sie."),
    ("Swiss made",
     "Entwickelt und betreut in der Schweiz. QR-Rechnung, MWST 8.1 %, AHV-Nr., Fedlex-Gesetze, "
     "Schweizer Rechtschreibung."),
    ("Kein Abo-Zwang",
     "Lizenz einmal kaufen; Pakete ab CHF 19.90/Monat, 30 Tage gratis testen. Starter und Privat als Fixpreis."),
    ("Ein Programm statt fünf",
     "ERP, Akten/Recht, Dokumente & Wissen und KI – statt mehrerer Insellösungen."),
    ("Für jede Grösse",
     "Vom Privathaushalt über KMU bis Treuhand und Kanzlei – Module jederzeit zuschaltbar."),
]

PAKETE_TEXT = (
    "Starter · Privat · ERP Start · KMU · KMU Plus · Treuhand · Kanzlei. DEXXUS Shield als "
    "eigenständiges Produkt ab CHF 49.–. Virtuelle Mitarbeiter ab Paket KMU inklusive. Aktuelle Preise und "
    "Details auf dexxus.ch."
)

SCHWAERZT_TEXT = (
    "Namen & Firmen, Adressen, Orte/PLZ, Telefon, E-Mail, IBAN/Konto, AHV-Nummer, Kennzeichen, "
    "Vertrags-/Aktenzeichen, Behörde, Objekt/Parzelle, Geburtsdatum. Bei heiklen Themen (Gesundheit, "
    "Strafverfahren, Sozialhilfe u. a.) warnt DEXXUS und empfiehlt die lokale KI."
)

HINWEIS_TEXT = (
    "Hinweis: ChatGPT, Claude, Copilot, Gemini, DeepL, bexio, SelectLine, Abacus und weitere Namen sind Marken "
    "ihrer Inhaber; DEXXUS ist mit diesen Anbietern nicht verbunden. Stand: November 2026."
)

def new_page_header_continued(c):
    """Fuer Seite 2: kein Logo-Header noetig, einfacher oberer Rand."""
    return PAGE_H - 92  # Startabstand oben auf Folgeseiten

def main():
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "media", "DEXXUS_Pressemappe.pdf")
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("DEXXUS – Pressemappe")
    c.setAuthor("avotec AG")

    line_y = draw_header(c)
    y = line_y - 42.0
    c.setFont(F_BOLD, 26)
    c.setFillColorRGB(*DARK)
    c.drawString(L, y, "Pressemappe")
    y -= 23.0
    c.setFont(F_BOLD, 10.5)
    c.setFillColorRGB(*BLUE)
    c.drawString(L, y, "Büro-Software mit KI aus der Schweiz – Datenschutz zuerst")

    y -= 29.0
    draw_heading(c, L, y, "Über DEXXUS")
    y -= 23.6
    y = draw_wrapped_paragraph(c, L, y, UEBER_TEXT)

    y -= 29.0
    draw_heading(c, L, y, "Die wichtigsten Punkte")
    y -= 20.5
    y = draw_grid(c, y, CARDS)

    y -= 14.0
    draw_heading(c, L, y, "Pakete & Preise (Auszug)")
    y -= 23.6
    y = draw_wrapped_paragraph(c, L, y, PAKETE_TEXT)

    y -= 24.0
    draw_heading(c, L, y, "Was DEXXUS schwärzt")
    y -= 23.6

    PAGE_BOTTOM = 58
    lines = wrap(c, SCHWAERZT_TEXT, F_REG, 10.3, CONTENT_W)
    c.setFont(F_REG, 10.3)
    c.setFillColorRGB(*DARKISH)
    for ln in lines:
        if y < PAGE_BOTTOM:
            c.showPage()
            y = new_page_header_continued(c)
            c.setFont(F_REG, 10.3)
            c.setFillColorRGB(*DARKISH)
        c.drawString(L, y, ln)
        y -= 15

    y -= 20.0
    if y < PAGE_BOTTOM + 60:
        c.showPage()
        y = new_page_header_continued(c)
    c.setStrokeColorRGB(*BORDER)
    c.setLineWidth(1.1)
    c.line(L, y, L + CONTENT_W, y)
    y -= 29.0
    draw_heading(c, L, y, "Unternehmen & Pressekontakt")
    y -= 23.0
    c.setFont(F_REG, 10.5)
    c.setFillColorRGB(*DARKISH)
    c.drawString(L, y, "avotec AG, Schweiz   ·   Web: dexxus.ch   ·   E-Mail: info@dexxus.ch")
    y -= 24.0
    c.setFont(F_REG, 8.6)
    c.setFillColorRGB(*MUTED)
    for ln in wrap(c, HINWEIS_TEXT, F_REG, 8.6, CONTENT_W):
        c.drawString(L, y, ln)
        y -= 11.5

    c.showPage()
    c.save()
    print("written", out)

if __name__ == "__main__":
    main()
