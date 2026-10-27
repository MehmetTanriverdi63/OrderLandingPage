# Instagram-to-Order – Implementierungsplan

## MVP und Reihenfolge
1. React-/TypeScript-Projekt mit Tailwind, Vite und Cloudflare Worker/D1 anlegen.
2. Mobile Landingpage für „Mediterrane Küche, Worms“, Instagram-Menü für 9,90 €, Speisekarte, konfigurierbare Produkte und persistenter Warenkorb.
3. Gast-Checkout mit serverseitig geprüften Preisen, Öffnungszeiten und Abholslots; Barzahlung und private Bestellverfolgung.
4. D1-Datenmodell mit restaurant_id, geschützten Admin-Sitzungen, konsequenter Mandantenprüfung, Bestellannahme/-ablehnung, Abholzeit, Produkt-/Preis- und Öffnungszeitenverwaltung.
5. Automatische Aktualisierung des Dashboards per kurzem Polling; vorbereitete Telegram-Nachrichten und Stripe-Testzahlungen, standardmäßig ausgeschaltet.
6. Unit-, API- und Browserprüfungen, Produktionsbuild, Dokumentation und reproduzierbare Cloudflare-Konfiguration.

## Struktur
- src/: React-Oberfläche, Kundenfluss und Dashboard
- shared/: gemeinsame Typen und Preis-/Validierungsregeln
- worker/: API, Authentifizierung, D1-Zugriff, optionale Integrationen
- migrations/: versioniertes D1-Schema und Test-Speisekarte
- tests/: fachliche Tests und API-/Browserprüfungen
- scripts/: lokale Einrichtung und Adminanlage
- docs/: Betrieb, Architektur, verbleibende Freigaben

## Architektur und Sicherheitsgrenzen
Ein Cloudflare Worker liefert die gebaute React-Anwendung und /api aus. Cloudflare Pages kann alternativ das Frontend ausliefern und /api an denselben Worker routen; der MVP nutzt bewusst eine gemeinsame Origin für sichere HttpOnly-Cookies. D1 speichert alle Restaurantdaten mit restaurant_id. Admin-Sitzungen sind serverseitig und nur dem zugehörigen Restaurant zugeordnet. Öffentliche Bestellansichten verlangen einen zufälligen Zugriffstoken. Preise, Extras und Abholzeiten werden serverseitig neu validiert.

Keine echten Zahlungsdaten, keine produktiven Telegram-Nachrichten: Stripe akzeptiert im MVP ausschließlich Testschlüssel, Telegram ist explizit opt-in. Demo-Zugang ist nur lokal verfügbar. Keine Veröffentlichung ohne Kontozugriff/Freigabe. Bilder und Restaurantangaben sind Testinhalte und vor Veröffentlichung zu ersetzen. Polling liefert zeitnahe Aktualisierung, keine garantierte Push-Zustellung.

## Erforderliche Prüfungen
Preisberechnung/Varianten, Eingabevalidierung, Mandantenisolation, Login und Statuswechsel, Barbestellung inklusive Bestellverfolgung, Öffnungszeiten, Build/TypeScript und mobiler Browserfluss. Externe Stripe-/Telegram-End-to-End-Prüfung erst mit freigegebenen Testzugängen. Veröffentlichung und echte Integrationen sind separate Freigaben.
