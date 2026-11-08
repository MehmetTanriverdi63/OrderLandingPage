# Abholung, Lieferung und Online-Vorschau

Stand 08.11.2026. Der Checkout bietet Abholung und Lieferung an. Die Lieferfunktion ist für den Pilotmandanten `mediterrane-worms` eingerichtet; andere Restaurants erhalten keine Lieferzeiten und können keine Lieferbestellungen für dieses Liefergebiet anlegen.

## Liefergebiet und Zeitfenster

- Höchstens **12 km Luftlinie** ab Friedrich-Ebert-Straße 50, 67549 Worms. Referenzkoordinaten: 49.6340817, 8.3498238 (OpenStreetMap-Gebäude way/297347515, am 08.11.2026 lesend geprüft). Keine Berechnung ab dem Stadt- oder PLZ-Mittelpunkt; keine Fahrstreckenberechnung.
- Lieferzeiten täglich **16:00 bis einschließlich 21:30 Uhr**, innerhalb der Restaurantöffnungszeiten. Geschlossene Tage und mindestens 30 Minuten Vorlauf bleiben berücksichtigt. Zeitzone Europe/Berlin, einschließlich Sommer-/Winterzeit.
- Straße, Hausnummer, fünfstellige Postleitzahl und Ort sind Pflicht; Zustellhinweise optional. Im Test ist die Liefergebühr 0 €, es wird kein externer Lieferdienst beauftragt.
- Der Nutzer prüft die eingegebene Adresse ausdrücklich per Schaltfläche. Danach berechnet der Server die Entfernung. Beim Absenden prüft das Backend die Adresse und den Zeitrahmen erneut; vom Client gesendete Koordinaten werden nicht verwendet. Außerhalb des Radius oder bei nicht eindeutig gefundener Adresse wird keine Bestellung angelegt. Bestätigte Lieferzeiten im Dashboard müssen ebenfalls im Zeitfenster liegen.

## Kostenloser Adressdienst

Verwendet wird der öffentliche OpenStreetMap-Nominatim-Dienst ohne kostenpflichtiges Konto, kein Browser-GPS und keine kostenpflichtige Kartenbibliothek. Vor dem Klick steht ein Datenübermittlungshinweis am Formular. Nur Straße, Hausnummer, PLZ und Ort werden übermittelt, keine Kundennamen, Telefonnummern, Bestellinhalte oder Zustellhinweise. Der Rückgabedatensatz muss Straße, Hausnummer, PLZ und Deutschland bestätigen. Orts- oder Straßenmittelpunkte ohne Hausnummer werden nicht akzeptiert.

Die App identifiziert sich mit eigenem User-Agent, verwendet keine Autovervollständigung und begrenzt alle Geocoder-Netzwerkanfragen über einen gemeinsamen D1-Schlüssel auf höchstens eine Anfrage pro Sekunde. Ergebnis-Koordinaten werden in Cloudflare Cache für maximal 15 Minuten unter einem gehashten Adressschlüssel zwischengespeichert. Keine Namen oder Telefonnummern im Cache. Ein wiederholter Checkout kann damit ohne neue Drittanfrage prüfen. Bei Überlastung oder Ausfall wird Lieferung nicht ungeprüft zugelassen; Abholung bleibt verfügbar. OpenStreetMap-Attribution ist direkt im Formular verlinkt. Nutzungsrichtlinie: https://operations.osmfoundation.org/policies/nominatim/

Über die optionale Worker-Variable `GEOCODING_URL` kann der Betreiber einen anderen Nominatim-kompatiblen HTTPS-Endpunkt einsetzen, ohne Code zu ändern. Bei kommerzieller Skalierung Fair-Use und Kapazität prüfen und gegebenenfalls den Dienst wechseln. Der öffentliche Dienst bietet keine Verfügbarkeitsgarantie.

## Speicherung und Restaurantansicht

Die neuen Bestellangaben werden im bestehenden D1-Bestelldatensatz gespeichert. Dafür enthält `orders.note` bei neuen Bestellungen einen versionierten JSON-Umschlag `[order-details:v1]` mit normaler Notiz, Bestellart und Adresse. Die API dekodiert ihn in `note`, `fulfillment_method` und `delivery_address`; der Umschlag selbst wird nicht als Kundennotiz angezeigt. Bestehende Freitextnotizen werden weiterhin als Abholung gelesen. Neue Notizen werden immer eingepackt, damit Kundeneingaben den Metadaten-Umschlag nicht vortäuschen können. Somit ist für dieses Update keine Remote-Schemamigration nötig; beim späteren Ausbau können die versionierten Daten in eigene Spalten überführt werden.

Dashboard und Telegram zeigen Bestellart, Lieferadresse, Zustellhinweise, Telefonnummer und Lieferwunsch. Der private Bestellstatus verwendet Lieferbereit/Zugestellt statt Abholbereit/Abgeholt. Bestehende Zugriffskontrollen und Restaurantfilter bleiben bestehen.

## Sichtbare Onlinezahlung ohne Zahlungsanbieter-Konto

Onlinezahlung ist im Formular immer auswählbar. Erst beim Absenden erscheint ein mobil bedienbarer Bestätigungs-Popover mit dem Hinweis „Onlinezahlung nur zu Testzwecken“. Vor der Bestätigung wird weder eine Bestellung angelegt noch eine Zahlungsseite geöffnet. „Zurück“ lässt die Eingaben erhalten.

Ohne eingerichtetes Stripe-Testkonto erzeugt die Bestätigung eine **unbezahlte Online-Testvorschau** mit `payment_method=online_demo` und `payment_status=test_only`. Es werden keine Kartendaten erfasst, keine Stripe-Anfragen gesendet und niemals ein Bezahlt-Status vorgetäuscht. Dashboard, Bestellstatus und Telegram kennzeichnen dies ausdrücklich. Auch nach Abschluss bleibt die Vorschau als nicht bezahlt markiert. Das Restaurant erhält sie wie andere Testbestellungen und kann den Testablauf bearbeiten.

Bei eingerichtetem Stripe-Testkonto erfolgt nach demselben Hinweis die Weiterleitung zum echten Stripe-Testcheckout. Nur dessen signierter Webhook kann eine Stripe-Testzahlung als bezahlt bestätigen. Live-Schlüssel bleiben gesperrt. Die bestehende Einrichtungsanleitung [ONLINE-ZAHLUNG.md](ONLINE-ZAHLUNG.md) gilt weiterhin für diesen optionalen Schritt.
