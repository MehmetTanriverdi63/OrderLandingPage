# Statistik, Monatsbericht und operative Kontaktdaten

Im Dashboard ist der Bereich **Statistik & Daten** verfügbar. Er kombiniert Verkaufsstatistik, Seitenaufrufe, Monatsberichte und eine ausdrücklich bestätigte Bereinigung alter Kontaktdaten. Echte Zahlungen, Rechnungsstellung und Buchführung werden dadurch nicht aktiviert.

## Einmalige Datenbankeinrichtung auf Cloudflare

Die neue Migration 0008 erstellt ausschließlich Tabellen für tägliche aggregierte Seitenaufrufe und die gespeicherte Frist. Sie löscht keine Bestellungen. Im angemeldeten Codespace:

```sh
git pull --ff-only
node scripts/tool.mjs wrangler d1 migrations apply orders-db --config wrangler.worker.jsonc --remote
```

Ohne diese Migration bleiben Bestellungen und Verkaufsberichte nutzbar. Die Besucherstatistik wird als nicht eingerichtet angezeigt, und Fristen lassen sich noch nicht speichern. Vergangene Seitenaufrufe können nicht rückwirkend rekonstruiert werden. Der E-Mail-Einrichtungshelfer wendet offene Migrationen ebenfalls vor dem Deployment an.

## Verkaufsstatistik

- Zeitraum 7, 30, 90 oder 365 Tage, Kalenderdaten in Europe/Berlin inklusive Sommer-/Winterzeit.
- Artikel, verkaufte Mengen und historische Preise werden aus den gespeicherten Bestellpositionen berechnet. Kundennamen, Telefonnummern oder Adressen sind für diese Berechnung nicht nötig.
- Der ausgewiesene Bar-Betrag enthält nur abgeschlossene (`completed`) und als bezahlt (`paid`) markierte Barbestellungen. Die Website befindet sich weiterhin im Testbetrieb; die Darstellung ist kein Nachweis echter Umsätze und kein steuerlicher Buchhaltungsnachweis.
- Stripe-Testbeträge bleiben separat. Online-Vorschauen, abgelehnte/stornierte und unbezahlte Bestellungen erhöhen den ausgewiesenen Bar-Betrag nicht.
- Tagesgruppen verwenden den **Zeitpunkt des Bestelleingangs**. Ein separater späterer Kassenabschluss-/Zahlungszeitpunkt wird bisher nicht erfasst. Die UI bezeichnet diese Gruppierung entsprechend.
- Die Auswertung ist auf 10.000 Bestellungen pro gewähltem Zeitraum begrenzt und zeigt bei Überschreitung einen Hinweis. Ein monatlicher Export wird bei Überschreitung verweigert, damit kein unvollständiger Bericht stillschweigend als vollständig ausgegeben wird.

## Aufrufe statt identifizierter Besucher

Die Anwendung zählt `/` und `/angebot` pro Tag und Restaurant. Sie speichert dafür nur Restaurant-ID, Kalendertag, Seitentyp und Anzahl. Keine IP-Adresse, kein vollständiger URL/Querystring, kein Referrer, kein Tracking-Cookie, kein Fingerprint und keine dauerhafte Besucherkennung. Ein neu geladener Aufruf zählt erneut. DNT und Global Privacy Control werden berücksichtigt; private Bestellstatus-, Admin- und Rechtstextseiten werden nicht gezählt. Einfache Bot-User-Agents werden ausgeschlossen, das ersetzt keine perfekte Bot-Erkennung.

Die Zählung ist eine Näherung für Seitenaufrufe, **keine Zahl unterschiedlicher Menschen** und keine garantierte Werbe-Conversion-Analyse. Technische Cloudflare-Protokolle sind getrennt davon zu beurteilen. Der öffentliche Endpoint kann wie viele clientseitige Zähler durch künstliche Anfragen beeinflusst werden. Es wird kein zusätzlicher kostenpflichtiger Analysedienst verwendet.

## Monatsbericht als CSV oder E-Mail

Monat auswählen und **CSV herunterladen**: UTF-8 mit BOM, Semikolon als Trennzeichen und Dezimalkomma für Excel. Der Bericht enthält Kennzahlen, Artikel/Mengen/Beträge, Tagesübersichten und Seitenaufrufe. Formelausführende Zellanfänge werden neutralisiert. Es werden keine Kundennamen, Telefonnummern, E-Mails oder Lieferadressen exportiert.

**Bericht per E-Mail senden** erfordert eine ausdrücklich eingegebene Empfängeradresse und den aktiv eingerichteten E-Mail-Dienst; ohne Einrichtung bleibt die Schaltfläche deaktiviert. Der Export kann trotzdem heruntergeladen und manuell als Anhang versendet werden. Nur der angemeldete Restaurantadministrator kann Berichte des eigenen Mandanten abrufen oder versenden. Der Versand teilt das lokale Limit von höchstens 50 Versandversuchen pro UTC-Tag mit Bestellbestätigungen; zusätzlich höchstens fünf Berichtsversuche pro Admin und Stunde. Wiederholte identische Berichte verwenden einen stabilen Provider-Idempotenzschlüssel. Der Versandstatus bestätigt nur die Annahme durch den Dienst, kein Lesen und keinen Posteingang. E-Mail-Einrichtung: [EMAIL.md](EMAIL.md).

## Alte operative Kontaktdaten entfernen

Die voreingestellten **30 Tage sind ein editierbarer Vorschlag**, keine gesetzlich vorgeschriebene Frist. Es gibt **keinen automatischen Löschjob**. Die gespeicherte Frist steuert nur die Auswahl für die Vorschau.

1. Frist wählen und gegebenenfalls speichern.
2. Vorschau abrufen: Bestellnummer, Datum, Status und Warenwert, ohne erneute Offenlegung der Kontaktdaten.
3. Gesetzlich erforderliche Buchungs-/Rechnungsunterlagen, offene Fälle und externe Kopien gesondert prüfen.
4. Die Prüfung per Checkbox bestätigen und exakt `KONTAKTDATEN ENTFERNEN` eintippen.
5. Erst die abschließende Schaltfläche entfernt die operativen Angaben der zuvor angezeigten Bestellungen.

Es werden höchstens 100 Bestellungen pro Durchlauf bearbeitet. Nur abgeschlossene oder abgelehnte Bestellungen oberhalb der Altersgrenze sind wählbar. Aktive Bestellungen sowie abgelehnte und noch als bezahlt markierte Fälle bleiben ausgespart. Eine geänderte Vorschau muss erneut bestätigt werden. Jede Aktualisierung prüft Restaurant-ID und vorherige Datenwerte. Zwischenzeitlich geänderte Zeilen werden übersprungen statt unbemerkt überschrieben.

Entfernt werden Name (durch neutralen Platzhalter ersetzt), Telefonnummer, E-Mail, Lieferadresse, Zustellhinweise und freie Bestellnotiz. Alte private Statuslinks werden durch Ersetzen ihres Token-Hashes ungültig. Zufällige technische Bestell-/Anfragekennungen bleiben zur Konsistenz und Idempotenz erhalten. Bestellnummer, Bestelleingang, Gerichte, Mengen, historische Preise, Gesamtsumme, Zahlungsart/-status und Bestellstatus bleiben für die Statistik erhalten. Deshalb ist dies bewusst **keine Zusicherung vollständiger Anonymisierung gegenüber anderen Unterlagen oder Diensten**.

Telegram-Nachrichten, Fahrer-Weiterleitungen, E-Mail-Postfächer, Anbieterprotokolle, Backups und steuerlich aufzubewahrende Unterlagen werden nicht automatisch durch diese Aktion bereinigt. Eine Rechnung mit erforderlichen Empfängerdaten darf nicht durch eine pauschale Frist unzulässig verändert werden. Eine nur verschlüsselte, wiederherstellbare Namensangabe wäre ebenfalls weiterhin personenbezogen; hier wird kein entschlüsselbarer Name aufbewahrt.

Keine bestehenden Cloudflare-Kundendaten wurden während der Entwicklung entfernt. Der API-Test bereinigt ausschließlich einen eigens neu erzeugten, lokalen historischen Testdatensatz und bricht ab, falls andere Datensätze in dessen Vorschau auftauchen.
