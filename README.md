# Instagram-to-Order

Lauffähiger Restaurant-Bestell-MVP für **Mediterrane Küche · Worms**. React, TypeScript, Tailwind, Cloudflare Pages/Workers und D1. Keine WordPress- oder kostenpflichtigen UI-Abhängigkeiten.

## Lokal starten

Voraussetzung: Node.js 24 und npm. In `/workspace/OrderLandingPage`:

```bash
npm ci
npm run setup
npm run dev
```

Der Startbefehl betreibt Vite auf Port 5173 und die lokale Worker-/D1-API auf Port 8787. Die Oberfläche liegt am Vite-Port, das Dashboard unter `/admin`. Alle Daten bleiben in der lokalen D1-Emulation unter `.wrangler/`. `npm run setup` kann erneut ausgeführt werden: Migrationen werden nur einmal angewendet, bestehende lokale Einstellungen bleiben erhalten.

**Nur lokal:** E-Mail `demo@mediterrane.local`, Passwort `Demo-2026!`. Der Demo-Zugang funktioniert ausschließlich auf localhost/127.0.0.1 mit `DEMO_MODE=true`. Öffentlich wird er auch dann abgewiesen, wenn das Flag versehentlich gesetzt ist.

## Enthalten

- Mobile Landingpage mit Instagram-Menü für anfänglich 9,90 €, Kategorien, lokalen Beispielbildern, Soßen, Extras und Getränken.
- Persistenter Warenkorb, centgenaue Preise, Gast-Checkout und Barzahlung bei Abholung.
- Öffnungszeitabhängige Abholslots, private Bestellbestätigung und Statusverfolgung.
- Geschütztes Dashboard: Bestellungen annehmen/ablehnen, Abholzeit bestätigen, Zubereitung/Abholung dokumentieren.
- Produkte anlegen, Namen/Beschreibung/Preise/Verfügbarkeit bearbeiten und Wochenöffnungszeiten konfigurieren.
- Mehrmandantenfähige D1-API mit restaurant_id und serverseitigen Zugriffskontrollen.
- Dashboard und Kundenstatus aktualisieren sich alle fünf Sekunden per Polling.
- Stripe **ausschließlich im Testmodus** und Telegram als ausgeschaltete, vorbereitete Integrationen.

**Es werden keine echten Zahlungen oder Nachrichten ausgelöst.** Die lokal mitgelieferten Fotos sind KI-generierte Illustrationen, keine Fotos des Pilotrestaurants. Keine echten personenbezogenen Daten eingeben.

## Prüfen

```bash
npm test             # 20 Fach-, Sicherheits- und Integrationsprüfungen
npm run build        # TypeScript und Produktionsbundle
npm run test:api      # Gegen laufende lokale API, nutzt/erzeugt Testdaten
npm run test:e2e      # Gegen laufendes npm run dev, Chromium mobil + Desktop
npm audit --omit=dev
```

Browser: Der Tool-Wrapper nutzt `/usr/bin/chromium`, falls vorhanden. Andernfalls einmal `node scripts/tool.mjs playwright install chromium` ausführen. Für Linux-Systembibliotheken ggf. `playwright install --with-deps chromium` außerhalb eingeschränkter Umgebungen nutzen. Kein TLS- oder Signaturcheck wird abgeschaltet.

**Die API-/Browserprüfungen verändern ausschließlich die lokale Testdatenbank.** Nicht gegen produktive Daten ausführen. API-Smoke deckt Barbestellung, serverseitige Preisprüfung, Idempotenz, Auth/Logout, Mandantentrennung, Statuswechsel, Ablehnung, Preisverwaltung, Öffnungszeiten und CSRF ab. Stripe-Netzwerkaufrufe sind im Test simuliert; es gibt keinen verifizierten externen Stripe-/Telegram-Test ohne freigegebene Testzugänge.

## Deployment

Noch nicht veröffentlicht. [Betrieb und notwendige Kontoeinstellungen](docs/BETRIEB.md) beschreibt Cloudflare Pages (Standard), den alternativen eigenständigen Worker und die optionalen Integrationen. Für einen öffentlichen Pilotbetrieb müssen Restaurant-/Pflichtangaben und Allergene vervollständigt werden.

[Implementierungsplan](docs/IMPLEMENTIERUNGSPLAN.md) · [Architektur und API](docs/ARCHITEKTUR.md)
