# Validierung des MVP

In der bereitgestellten Cloud-Maschine ausgeführt:

- `npm test`: 20 Tests bestanden (Preis-/Optionsberechnung, Checkout-Eingaben, Berlin-Abholslots inklusive Zeitumstellung, Passwort-/Tokenprüfung, Stripe-Signaturen/Testmodus/Betragsprüfung/Idempotenz, Telegram-Opt-in mit simuliertem Versand, Sperre des öffentlichen Demo-Logins).
- `npm run build`: TypeScript und Vite-Produktionsbuild bestanden. Die Zod-Abhängigkeit erzeugt harmlose Rollup-Hinweise zu entfernten Kommentar-Annotationen; kein Typ-/Buildfehler.
- `npm run test:api`: bestanden gegen den lokalen eigenständigen Worker und gegen Pages Functions. Enthält echte lokale D1-Zugriffe, Barbestellung, aktuelle Preise/Preisänderung, doppelte Anfrage, Bearer-Status, Admin-Session, Statusfolge und Ablehnung sowie fremde Mandanten-IDs und CSRF.
- `npm run test:e2e`: vier Chromium-Prüfungen bestanden, je zwei auf 390×844 und 1440×1000. Vollständiger Bestell-/Admin-/Statusfluss und Warenkorb-Persistenz mit Mengenänderung und Escape-Schließen.
- `npm audit --omit=dev`: keine bekannten Schwachstellen in Laufzeitabhängigkeiten zum Prüfzeitpunkt. Dies ist kein vollständiges Sicherheitsaudit.
- `npm ci --dry-run`: Lockfile und Paketinstallation konsistent.
- `npm run setup` erneut ausgeführt: lokale Konfiguration bleibt erhalten, Produktionsbuild erfolgreich, bereits angewendete D1-Migrationen werden nicht wiederholt.
- Desktop-/Mobilansicht visuell geprüft; alle neun eingebundenen Fotoelemente werden lokal erfolgreich geladen; kein horizontaler Überlauf im geprüften mobilen Bestellfluss.
- Pages-Produktionsadapter kompiliert und die lokale API erfolgreich bedient. Vite/Worker nach Konfigurationswechsel neu gestartet und nochmals geprüft.

Nicht ausgeführt: externes Cloudflare-Deployment, GitHub Actions auf einem Remote-Runner, Stripe mit einem echten Testkonto, Telegram mit einem echten Testbot und Browser auf iOS Safari/Firefox. Stripe-/Telegram-Aufrufe in den Integrationstests sind simuliert; Flags bleiben ausgeschaltet. Keine echte Zahlung und keine produktive Nachricht ausgelöst.

Cloud-Setup-Entwurf: `install_script` und `start_skill` gespeichert. Das ist eine gespeicherte Konfiguration, keine Veröffentlichung der Cloud-Umgebung oder der Restaurant-App. Eine neue Aufgabe aus einem veröffentlichten Snapshot wurde noch nicht geprüft.
