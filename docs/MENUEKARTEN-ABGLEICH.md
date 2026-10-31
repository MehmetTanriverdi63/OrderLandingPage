# Übernahme der Restaurantkarte

## Umfang

Quelle: fünf bereitgestellte Fotos der gedruckten Karte plus ein zusätzliches Gesamtfoto. Die Fotos wurden nur zur Übertragung gelesen; die Originaldateien werden nicht im öffentlichen Repository gespeichert. Prüfbare Textdaten: `data/menu-card.json`.

- 8 Salate/überbackene Vorspeisen
- 14 Drehspieß-/Falafel-/Lahmacun-Gerichte
- 26 Pizzen
- 26 Pasta-Gerichte
- 6 Pide
- 4 Schnitzel
- 4 Beilagen/Snacks
- Zusätzlich: das bereits beauftragte 9,90-Euro-Instagram-Angebot (nicht auf der gedruckten Karte)

Gesamt: 88 Kartenpositionen, 89 bestellbare Produkte inklusive Projektangebot. Nummern aus der Karte sind an Produkten sichtbar und durchsuchbar. Bei neuen Kategorien stehen illustrative Symbole statt unzutreffender Produktfotos.

## Bestätigungen und Grenzen

- Nr.44 Spaghetti Frutti di Mare: vom Betreiber im Chat zunächst 10,90, unmittelbar danach ausdrücklich auf **13,90 Euro korrigiert**. Ausschließlich 13,90 Euro wird verwendet; das Gesamtfoto bestätigt den Preis.
- Nr.20 Lahmacun: das Gesamtfoto bestätigt „mit Salat und Dönerfleisch“.
- Adresse: Friedrich-Ebert-Str. 50, 67549 Worms.
- Telefon: 06241 2107548.
- Montag bis Freitag: 11:30–22:00; Samstag/Sonntag: 12:00–22:00, Europe/Berlin.
- Instagram: https://www.instagram.com/mediterranekucheworms/ — vom Betreiber verlinkt, als externer Link in Kontakt und Footer eingebunden. Kein Instagram-Feed, keine fremden Beiträge oder Bilder kopiert.
- Legende der Allergen- und Zusatzstoffcodes fehlt: keine Zuordnung aus den Buchstaben/Zahlen geraten. Ein Hinweis ist in Speisekarte und rechtlichen Hinweisen sichtbar.
- Keine Pizzagrößen, Getränkepreisliste oder weiteren Soßenpreise auf den Fotos. Bisherige Soßen-/Getränkeauswahl des Projektangebots bleibt als Projektkonfiguration bestehen. Keine neuen Getränkepreise erfunden.
- Extras laut Foto: Sardellen, Artischocken, Champignons, Mozzarella, Thunfisch, Feta, Gorgonzola je 2,00; Dönerfleisch 2,90; Parmesan 2,60. „Funghi“ mit 2,00 ist nicht noch einmal als identisches Champignon-Extra angelegt.
- Chicken Wings/Nuggets: 6 Stück 6,50 Euro, mit Pommes insgesamt 9,00 Euro. Döner-/Falafelteller bieten Pommes oder Reis ohne Aufpreis laut Karte.

## Datenübernahme

Die additive D1-Migration ergänzt `products.menu_number`, aktualisiert die vorhandenen Pilot-Testprodukte und ergänzt die weiteren Gerichte. Sie ändert keine anderen Restaurants und löscht keine Bestellungen. Preise in bestehenden Bestell-Snapshots bleiben unverändert. Bestehende lokale Warenkörbe werden mit dem aktuellen Menü geprüft; alte Optionen können eine Aktualisierung verlangen.

Die SQL-Dateien sind versioniert. Das Hilfsskript `scripts/generate-menu-migration.mjs` dokumentiert ihre Erstellung aus der JSON-Datei; nach ausgelieferten Migrationen künftige Preisänderungen per Admin-Dashboard oder neuer Migration vornehmen, nicht alte Migrationen erneut ausführen. Weitere Änderungen an Öffnungszeiten/Preisen im Dashboard bleiben bei einem normalen Neustart erhalten.

## Prüfungen

TypeScript/Vite-Build, 20 bestehende Fach-/Integrationstests und API-Smoke gegen echte lokale D1-Emulation. Acht Browserprüfungen (vier Szenarien je Mobil/Desktop) decken den Bestellfluss, Warenkorb-Persistenz, Nummernsuche Nr.44, Such-Leerzustand, Kategorieauswahl, mehrere reversible Pizza-Extras, Preisaddition, Kontakt und Öffnungszeiten ab. Zusätzlich alle fünf Migrationen auf einer frischen separaten lokalen Datenbank angewendet und Kartenpositionen mit der Quelle verglichen.

Stripe und Telegram bleiben ausgeschaltet. Keine öffentliche Website-Veröffentlichung.

## Bildauswahl und Sortiment (31.10.2026)

Die aktive Karte enthält 84 Gerichte plus Instagram-Angebot. Die vier Schnitzelgerichte (76–79) wurden auf Wunsch entfernt. Historische Bestellungen und die ursprüngliche Kartentranskription bleiben erhalten. Die Änderung gilt nur für das Pilotrestaurant.

Die ergänzten Speisenfotos sind KI-generierte, illustrative Beispielbilder. `data/menu-artwork.json` ordnet die Motive den Gerichten zu. Die WebP-Bildtafeln werden proportional skaliert und ausgeschnitten; ihre Seitenverhältnisse werden nicht verzerrt. Unterschiedliche Pizza-, Pasta-, Pide- und Snackmotive ersetzen die bisherigen Symbole.

Migration `0006_food_photos_remove_schnitzel.sql` speichert die Bilder und entfernt die Schnitzelprodukte dauerhaft. Im angemeldeten Codespace ausführen:

```sh
git pull --ff-only
node scripts/tool.mjs wrangler d1 migrations apply orders-db --remote
```

Bis zur Migration sorgt die API bereits für die passenden Bilder und sperrt die entfernten Gerichte auch beim Bestellen.

## Telefonnummer und Telegram

Die Checkout-Telefonnummer bleibt Pflicht und steht mit Telefon-Symbol in der Telegram-Bestellnachricht. Telegram liefert die Kundennummer nicht automatisch. Browser-Ausfüllhilfe wird unterstützt; auf unterstützten Geräten kann der Kunde seinen eigenen Kontakt auswählen. Eine vorgeschlagene Nummer wird erst nach „Übernehmen“ eingetragen und kann abgelehnt werden. Lokales Merken ist freiwillig, erfolgt erst nach erfolgreicher Bestellung und lässt sich wieder löschen. Es findet kein stiller Zugriff auf SIM-, Instagram- oder Telegram-Daten statt.

### Korrektur für Smartphone-Ausfüllhilfe

Eindeutig erkennbare deutsche Mobilnummern ohne Vorwahl-Null (z. B. `15119137118`) werden vor der Übernahme und serverseitig vor dem Speichern zu `015119137118` ergänzt. Bereits internationale Nummern (`+49…`, `0049…`) bleiben erhalten. Ein deutsches Mobilformat mit `49` ohne Pluszeichen erhält das Pluszeichen. Unbekannte lokale Nummern und ausländische Landesvorwahlen werden nicht geraten oder umgeschrieben. Die Korrektur betrifft neue Bestellungen; historische Telefonnummern werden nicht rückwirkend verändert.
