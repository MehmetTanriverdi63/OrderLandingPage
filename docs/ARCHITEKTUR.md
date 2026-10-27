# Architektur

## Datenfluss

React → same-origin `/api` → Cloudflare Worker/Pages Functions → D1. Die fünfsekündige Aktualisierung ist Polling, kein WebSocket-Push. Produktbilder und Schriften werden lokal ausgeliefert, keine Tracker oder externen Bild-/Fontanfragen. KI-generierte Demo-Bilder sind unter `public/images/` gespeichert; Schriftlizenzen liegen in den jeweiligen @fontsource-Paketen.

Der Pilot verwendet `mediterrane-worms` in `shared/model.ts`. Die API kann weitere Restaurants über `/api/menu?restaurant=<id>` bedienen; ein weiterer Mandant benötigt einen restaurants-Datensatz, Produkte und einen zugeordneten Admin. Eigene Landingpage-/Domain-Zuordnung und Restaurantanlage sind im MVP manuelle Konfiguration, kein öffentliches Self-Service-Onboarding.

## Daten und Schutz

- `restaurants`: Stammdaten, Wochenöffnungszeiten, optionale Telegram-Chat-ID.
- `products`: restaurant_id, Centpreis, Verfügbarkeit und vordefinierte Optionsgruppen mit Centaufschlägen.
- `admins`: genau ein Restaurant pro Admin, gesalzenes PBKDF2-SHA256-Passwort, kein Klartext.
- `sessions`: nur SHA256 des zufälligen Session-Tokens, zwölf Stunden Laufzeit.
- `orders`: restaurant_id, pro Restaurant atomar vergebene Bestellnummer, Gastkontakt, Status, Zahlung, Wunsch-/Bestätigungszeit und unveränderlicher Snapshot der bestellten Namen/Optionen/Preise.
- `payment_events`: IDs verifizierter Testereignisse; Zahlungsstatus-Update ist idempotent.
- `rate_limits` / `login_attempts`: zeitlich begrenzte IP-basierte Limits auf Bestellanlage/Zahlungswiederholung/Login. Abgelaufene Zeilen werden bei erneutem Zugriff zurückgesetzt; periodische physische Bereinigung ist noch nicht eingerichtet.

Admin-Endpunkte leiten restaurant_id ausschließlich aus der serverseitigen Session ab. Änderungen und Leseabfragen filtern immer auf dieses Restaurant; eine im Request übermittelte fremde ID kann diese Prüfung nicht überschreiben. Öffentliche Menüs enthalten keine privaten Bestelldaten. Öffentliche Bestellstatus-Anfragen benötigen einen starken Bearer-Token, dessen Hash in D1 liegt. Dieser Status enthält keine Namen, Telefonnummern oder Notizen. Der private Link darf nicht geteilt werden und nutzt `Referrer-Policy: no-referrer`.

Alle Preise werden aus D1 neu berechnet. Ein zusätzlich übermittelter Gesamtpreis ist bedeutungslos; `quotedTotal` muss dem aktuellen Datenbankpreis entsprechen, sonst wird ein erneuter Warenkorbcheck verlangt. Optionen, Mengen und Abholzeiten werden serverseitig validiert. `requestId` verhindert doppelte Bestellungen beim Wiederholen derselben Checkout-Anfrage. D1-Abfragen sind parametrisiert, JSON-Eingaben werden mit Zod validiert. Schreibende Browseranfragen brauchen JSON und eine erlaubte Origin; kein CORS für fremde Websites.

Öffnungszeiten: genau sieben Wochentage, eine zusammenhängende Öffnungsphase pro Tag, keine Nachtöffnung. Abholung in 15-Minuten-Schritten, mindestens 30 Minuten Vorlauf, maximal 72 Stunden; Europe/Berlin inklusive Sommer-/Winterzeit. Das Restaurant kann beim Annehmen eine neue verfügbare Zeit bestätigen (mindestens fünf Minuten Vorlauf). Eine Bestellung garantiert noch keine Annahme.

## API

| Methode | Pfad | Zweck |
|---|---|---|
| GET | /api/health | D1-Readiness |
| GET | /api/menu?restaurant=... | Menü, Öffnungszeiten, Abholslots, Testzahlungsflag |
| POST | /api/orders | Gastbestellung, optional Stripe-Testcheckout |
| GET | /api/orders/:id | Privater, datensparsamer Status mit Bearer-Token |
| POST | /api/orders/:id/payment | Testzahlung mit demselben privaten Token fortsetzen |
| POST | /api/admin/login | Session-Cookie erstellen |
| GET | /api/admin/me | Eigene Restaurantzuordnung |
| POST | /api/admin/logout | Session serverseitig löschen |
| GET | /api/admin/orders | Letzte 100 Bestellungen des eigenen Restaurants |
| PATCH | /api/admin/orders/:id | Status und bestätigte Abholzeit |
| GET/POST | /api/admin/products | Eigene Produkte lesen/anlegen |
| PATCH | /api/admin/products/:id | Name, Beschreibung, Preis, Verfügbarkeit |
| PUT | /api/admin/hours | Wochenöffnungszeiten |
| POST | /api/stripe/webhook | Signiertes Stripe-Testereignis |

Statusfluss: `pending → accepted → ready → completed`, `pending/accepted → rejected`. Online-Bestellungen werden erst nach bestätigter Zahlung angenommen. Beim Abschluss einer Barbestellung bestätigt der Admin zugleich die Barzahlung; der Zahlungsstatus wird auf `paid` gesetzt. Bereits abgeschlossene/abgelehnte Bestellungen können nicht beliebig umgeschaltet werden. Status-Updates verwenden einen Vergleich des vorherigen Status, damit parallele Admins keine Änderung überschreiben.

## Grenzen dieses MVP

Preis-/Namens-/Verfügbarkeitsverwaltung und neue einfache Produkte sind über das Dashboard verfügbar; frei editierbare Optionsgruppen, Bild-Uploads, Steuer-/Pfandregeln, mehrteilige Öffnungsphasen und Feiertage sind Erweiterungen. Das Dashboard zeigt die jüngsten 100 Bestellungen und daraus berechnete Kennzahlen, keine vollständige Umsatzbuchhaltung. Ein öffentlicher Betrieb benötigt vollständige Betreiber-/Datenschutz-/Allergenangaben sowie einen geprüften Echtzahlungs- und Erstattungsprozess. Diese Demo ersetzt das nicht.
