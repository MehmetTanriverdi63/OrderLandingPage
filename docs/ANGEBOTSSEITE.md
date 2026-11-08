# Instagram → Angebotsseite → Bestellung

Werbeziel: **https://instagram-to-order.m-verdi.workers.dev/angebot**

Optional mit Kampagnenparametern: `https://instagram-to-order.m-verdi.workers.dev/angebot?utm_source=instagram&utm_medium=paid_social&utm_campaign=doener-menu`. Die Parameter fügen keine Analyse- oder Werbetracker hinzu; es wird keine automatische Conversion-Messung zugesichert.

Die separate mobile Angebotsseite stellt Döner + Pommes + Getränk und den Preis in den Vordergrund. „Menü zusammenstellen“ öffnet die gemeinsame Produktauswahl mit Soßen, Getränk, optionalen kostenpflichtigen Extras und Menge. Nach dem Hinzufügen öffnet sich direkt der Warenkorb. Der Warenkorb ist mit der normalen Speisekarte identisch und bleibt beim Wechsel zwischen Start- und Angebotsseite lokal erhalten. Kein zweiter Checkout, keine separate Datenbank und keine neuen kostenpflichtigen Dienste.

Die bisherige Startseite und `/#angebot` bleiben erhalten. Der obere „Jetzt entdecken“-Link führt nun zur neuen Angebotsseite. Angebotsverfügbarkeit und Preis stammen aus der gleichen API wie die Speisekarte. Bei Ladefehlern gibt es eine Wiederholen-Funktion; ein fehlendes Produkt lässt sich nicht bestellen. Die Fotos sind sichtbar als illustrative KI-Beispielbilder gekennzeichnet; es werden keine Instagram-Fotos kopiert oder Bewertungen erfunden.

## Lieferbedingungen

Abholung ohne Mindestbestellwert. Lieferung ab **20,00 € Warenwert**, bis **12 km Luftlinie** vom Restaurant, **16:00–21:30 Uhr** innerhalb der Öffnungszeiten. Liefergebühr im Test 0 €. Die 20-€-Grenze wird anhand der serverseitig errechneten Gerichte-/Extraspreise geprüft, nicht anhand eines vom Browser behaupteten Gesamtbetrags. Unterhalb der Grenze erscheint im Checkout der fehlende Betrag mit einem direkten Weg zurück zum Warenkorb. Zwei Menüs ohne Extras ergeben 19,80 € und sind damit noch nicht lieferfähig. Bestehende Bestellungen werden nicht nachträglich geändert.

Bestellannahme und Weiterbearbeitung bleiben bei Telegram und Dashboard. Echte Onlinezahlungen werden nicht aktiviert. Die sichtbare Online-Testvorschau und die optionale Stripe-Testintegration bleiben unverändert.

## Rechtliche Seiten

- `/impressum`: bekannte Restaurantanschrift, Telefon, Bild-/Lizenzhinweise; sichtbare Platzhalter für Betreibername/Firma, E-Mail und abhängig von der tatsächlichen Unternehmensform weitere Pflichtangaben.
- `/datenschutz`: dokumentierte technische Datenflüsse für Bestellungen, Cloudflare, lokale Speicherung, Lieferadressprüfung, Telegram/Fahrerweitergabe und Online-Testzahlung; sichtbare Platzhalter für Verantwortlichen, Rechtsgrundlagen, konkrete Verträge, Transfers und Löschprozesse.
- `/allergene`: allgemeine Übersicht der 14 Allergengruppen, Hinweis auf KI-Bilder und Bestellbedingungen; keine erfundene Zuordnung zu Gerichten oder unbelegte Allergenfreiheit. Die bestätigte Allergen-/Zusatzstofflegende und Angaben zu Kreuzkontamination bleiben ausdrücklich als fehlend gekennzeichnet.

Auf ausdrücklichen Betreiberwunsch bleiben fehlende Angaben als gelbe **NOCH ERGÄNZEN**-Felder sichtbar. Diese Seiten sind keine bereits vervollständigten oder abschließend geprüften Rechtstexte. Sie müssen vor echten Kundenbestellungen mit den tatsächlichen Betreiber- und Produktangaben ergänzt und geprüft werden. Es wird keine automatische Löschfunktion oder vollständige rechtliche Konformität behauptet.

Der Footer verlinkt die direkt aufrufbaren Seiten. Die Checkout-Einwilligungszeile enthält direkt zugängliche Links, die sich in einem neuen Tab öffnen, damit der Warenkorb erhalten bleibt. Kein neues Konto oder manueller Datenbankeingriff ist für dieses Update erforderlich.

### Verständliche Allergeninformationen

`/allergene` bietet nun 14 klar benannte, durchsuchbare Gruppen mit aufklappbaren Erklärungen und einer direkten Telefon-Schaltfläche. Die Übersicht wird ausdrücklich nicht als bestätigte Zuordnung zu Gerichten dargestellt. Offene Betreiberaufgaben sind in „Welche Angaben fehlen dem Restaurant noch?“ gebündelt. In der Speisekarte und vor dem Hinzufügen eines Produkts steht ein kurzer Hinweis mit Link und Restaurantnummer. Es werden keine Allergene aus KI-Bildern oder Gerichtsnamen geraten. Die Bestätigung der tatsächlichen Zutaten und Zusatzstoffe durch das Restaurant steht weiterhin aus.
