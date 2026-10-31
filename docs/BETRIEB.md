# Betrieb und Freigaben

## Was bereits ohne Konten funktioniert

Die vollständige Barbestellung inklusive Restaurant-Dashboard läuft lokal auf der Cloudflare-D1-Emulation. `npm ci && npm run setup && npm run dev` reproduziert diesen Zustand. Es werden vorhandene Checkouts genutzt; kein zusätzlicher Git-Worktree ist notwendig. Installierte Dateien und D1-Daten bleiben auf der Maschine, laufende Server müssen nach einem Neustart neu gestartet werden.

## Was der Betreiber vor einer Veröffentlichung freigibt

1. Cloudflare-Konto und Zielprojekt/Domain; keine Zugangsdaten in Chat oder Git hinterlegen.
2. Echte Restaurantanschrift, Telefon, Betreiber-/Impressums- und Datenschutzangaben, bestätigte Produktdaten/Allergene/Zusatzstoffe, Bilder, Pfand sowie Preise.
3. Öffnungszeiten und Restaurant-Admin-E-Mail. Ein individuelles Admin-Passwort wird sicher gesetzt.
4. Erst separat: Stripe-Testkonto oder Telegram-Testchat. Produktive Telegram-Nachrichten benötigen ausdrückliche Freigabe. Echte Stripe-Zahlungen sind im MVP absichtlich technisch gesperrt und brauchen vor Aktivierung eine weitere Implementierungs-/Prüfrunde.

## Cloudflare Pages mit Functions – Standard

Das Repository enthält `wrangler.jsonc` für Pages, `functions/api/[[path]].ts` für die API und D1-Migrationen. Alle Oberflächen-/API-Anfragen laufen unter derselben Origin.

Nach Kontofreigabe:

```bash
node scripts/tool.mjs wrangler login
node scripts/tool.mjs wrangler d1 create orders-db
```

Für das Pilotkonto ist `database_id` in beiden Wrangler-Konfigurationen auf `a334a646-3362-4a96-a707-3c74a1de62d9` gesetzt (vom Betreiber angelegte Cloudflare-Datenbank `orders-db`). `preview_database_id` bleibt für die lokale Entwicklung auf der bisherigen Null-ID, damit vorhandene lokale Daten, Admin-Zugänge und Bestellungen erhalten bleiben. Bei Verwendung eines anderen Cloudflare-Kontos dessen eigene D1-ID eintragen. Die ID ist keine Zugangsdatenfreigabe; Remote-Zugriff benötigt Cloudflare-Anmeldung.

```bash
node scripts/tool.mjs wrangler d1 migrations apply orders-db --remote
npm run build
node scripts/tool.mjs wrangler pages project create instagram-to-order --production-branch master
npm run deploy:pages
```

Alternativ Pages-Git-Integration: Projektverzeichnis = Repository-Root, Build = `npm ci && npm run build`, Ausgabe = `dist`, Node-Version = 24; D1-Binding `DB` setzen. Migrationen werden separat vor Deployment angewendet. Keine produktive `.dev.vars` hochladen und DEMO_MODE öffentlich nicht setzen. Der enthaltene Demo-Admin ist öffentlich serverseitig gesperrt; vor Produktion zusätzlich aus der Remote-Datenbank entfernen.

Einen echten Admin anlegen (Terminal, Passwort nicht als Klartext im Shell-Verlauf):

```bash
read -rs -p 'Neues Admin-Passwort (mindestens 12 Zeichen): ' ADMIN_PASSWORD
export ADMIN_PASSWORD
npm run admin:create -- admin@example.de mediterrane-worms /tmp/restaurant-admin.sql
unset ADMIN_PASSWORD
node scripts/tool.mjs wrangler d1 execute orders-db --remote --file /tmp/restaurant-admin.sql
rm /tmp/restaurant-admin.sql
```

`admin@example.de` durch die Betreiberadresse ersetzen. Die SQL-Datei enthält nur einen gesalzenen PBKDF2-Hash, ist trotzdem vertraulich und wird nicht eingecheckt. Die Restaurant-ID muss bereits existieren. Cookie-Sitzungen gelten zwölf Stunden; öffentlich Secure, HttpOnly und SameSite=Strict. Passwortänderungen und Admin-Verwaltung erfolgen im MVP per Administrationsskript/SQL, kein Selbstbedienungs-Reset.

Lokaler Pages-Produktionscheck: `npm run build && npm run preview:pages` (Port 8788). Anschließend z. B. `TEST_API_URL=http://127.0.0.1:8788 npm run test:api`. Das nutzt dieselbe lokale Datenbank.

## Alternativ: eigenständiger Cloudflare Worker

`wrangler.worker.jsonc` liefert die React-Dateien über Worker Static Assets und dieselbe API aus. Die D1-ID des Pilotkontos ist bereits eingetragen. Nach separater Veröffentlichungsfreigabe: `npm run deploy`. Lokal: `npm run preview` für den Produktionsbuild oder `npm run dev` für Vite mit API-Proxy. Pages und Worker sind alternative Bereitstellungen; es müssen nicht beide parallel betrieben werden.

## Stripe – nur nach Freigabe im Testmodus

Standard: `STRIPE_ENABLED=false`. Zur Testaktivierung einen **sk_test_**-Schlüssel sicher als `STRIPE_SECRET_KEY` und den Webhook-Schlüssel als `STRIPE_WEBHOOK_SECRET` hinterlegen, dann `STRIPE_ENABLED=true` setzen. Bei Pages: Projekt-Einstellungen → Variables and Secrets; bei Worker: `wrangler secret put ... --config wrangler.worker.jsonc`. Niemals geheime Schlüssel in Vite-Variablen oder Repositorydateien schreiben.

Webhook: `/api/stripe/webhook`, Ereignis `checkout.session.completed`. Nur signierte, frische Ereignisse mit `livemode=false`, passender Restaurant-/Bestell-ID, EUR-Währung und exaktem Betrag werden angenommen. Der Client-Redirect gilt nie als Zahlungsnachweis. Checkout verwendet Karten-Zahlung und eine Idempotenz-ID pro Bestellung. Abgebrochene Zahlungen können im privaten Statusfenster fortgesetzt werden; unbezahlte Online-Bestellungen können nicht zur Zubereitung angenommen werden.

Live-Schlüssel **sk_live_** werden selbst bei aktiviertem Flag abgewiesen. Rückerstattungen sind nicht automatisiert. Bei Ablehnung einer bezahlten Testbestellung weist das Dashboard ausdrücklich auf die separate Erstattung im Stripe-Dashboard hin. Nicht bezahlte Altbestellungen müssen im Dashboard abgelehnt werden.

Externer Stripe-Test wurde mangels freigegebener Testzugänge nicht durchgeführt. Lokale Vertragstests simulieren Checkout und Webhooks einschließlich Fehler-/Replay-Fällen. Erforderliches Netzwerkziel bei späterer Aktivierung: `api.stripe.com`.

## Telegram – explizit ausgeschaltet

Vor Aktivierung Testbot über BotFather und einen freigegebenen Chat einrichten, Bot zum Chat hinzufügen. Token sicher als `TELEGRAM_BOT_TOKEN` hinterlegen; die Chat-ID wird pro Restaurant in `restaurants.telegram_chat_id` gespeichert. Erst nach Freigabe `TELEGRAM_ENABLED=true` setzen. Netzwerkziel: `api.telegram.org`.

Nachrichten werden nur für neu gespeicherte Barbestellungen oder bestätigte Stripe-Testzahlungen ausgelöst, nicht bei idempotenten Checkout-Wiederholungen. Der Bot ist eine zusätzliche Benachrichtigung; das Dashboard bleibt die maßgebliche Bestellquelle. Versandfehler werden protokolliert, ohne eine gespeicherte Bestellung zurückzunehmen. Es gibt im MVP noch keine dauerhaft gespeicherte Zustellwarteschlange oder automatische Zustellwiederholung. Externe Zustellung ist ohne freigegebenen Bot nicht geprüft.

## Kosten und Betrieb

Cloudflare Pages/Workers/D1 können im kleinen Pilotbetrieb in kostenlosen Tarifen betrieben werden, abhängig von jeweils aktuellen Grenzen. Fünf-Sekunden-Polling verursacht Anfragen und D1-Lesezugriffe: Limits beobachten, mehrere offene Dashboard-Tabs vermeiden. Stripe erhebt bei späteren echten Zahlungen eigene Gebühren. Es wird kein bezahlter Tarif eingerichtet.

Vor produktivem Betrieb Löschfristen, Sicherungen, Datenexport, Auftragsverarbeitung und Überwachung festlegen. Der MVP hat keine automatische personenbezogene Datenlöschung, kein Inventar-/Kapazitätsmanagement, keine E-Mail/SMS, keine Lieferung, keine Sitzplätze und keine zentrale Plattform-Superadmin-Oberfläche. Fehlerseiten und Datenbankzugriff sind vorhanden; Produktionsalarme und Wiederherstellung sind Betreiberaufgaben für die nächste Phase.

### Empfohlen im Codespace: Geräteanmeldung ohne localhost

Die verwendete Wrangler-Version 4.154.0 unterstützt die Geräteanmeldung:

```bash
node scripts/tool.mjs wrangler login --device --browser=false
```

Den im Terminal angezeigten Verifizierungslink im Browser öffnen, gegebenenfalls den angezeigten Gerätecode eingeben und den Zugriff bestätigen. Das Terminal bis zur Erfolgsmeldung weiterlaufen lassen. Es wird keine localhost-Rückleitung und kein zweites Terminal benötigt. Danach `node scripts/tool.mjs wrangler whoami` prüfen. Gerätecode und Anmeldeinformationen nicht im Chat teilen. Der Befehl allein veröffentlicht keine Website und aktiviert keinen Tarif. Bei einem abgelaufenen Gerätecode den Befehl neu starten.

### Alternative: Browser öffnet nicht / localhost-Rückleitung

Kein Browserpaket installieren. Zwei Bash-Terminals verwenden:

1. `git pull --ff-only`, dann `node scripts/tool.mjs wrangler login --browser=false` im ersten Terminal starten und weiterlaufen lassen. Den **neu ausgegebenen** Cloudflare-Link zeitnah im Browser öffnen und den Zugriff erlauben. Alte Links nach einer Zeitüberschreitung nicht wiederverwenden.
2. Wenn der Browser nach der Freigabe zu `http://localhost:8976/oauth/callback?...` wechselt und eine Verbindungsfehlermeldung zeigt: Die **vollständige Adresse aus der Browser-Adressleiste** kopieren. Sie enthält einen einmaligen Anmeldecode: nicht im Chat, Screenshot oder Git teilen.
3. In einem zweiten Codespaces-Terminal `node scripts/cloudflare-complete-login.mjs` ausführen. Die kopierte Rückleitungsadresse unsichtbar einfügen und Enter drücken. Der Helfer akzeptiert ausschließlich den lokalen Callback-Port/Pfad und gibt die Parameter nur an den noch laufenden Wrangler-Anmeldeprozess auf demselben Codespace weiter. Er speichert die Adresse nicht und folgt keinen externen Redirects.
4. Im ersten Terminal auf die erfolgreiche Anmeldung warten; danach `node scripts/tool.mjs wrangler whoami` prüfen. Bei erneutem Timeout den Login neu beginnen.

Die Anmeldung selbst erstellt kein Deployment, aktiviert keinen kostenpflichtigen Tarif und ändert keine Produktionsdaten. Sie ermöglicht die nachfolgenden, separat ausgeführten Cloudflare-Befehle.
