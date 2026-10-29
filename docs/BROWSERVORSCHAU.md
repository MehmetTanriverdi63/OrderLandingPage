# Ohne lokale Installation im Browser testen

Die Codex-Cloud-Onboarding-Oberfläche unterstützt zurzeit keine anklickbaren Webvorschauen oder Portfreigaben. Die Anwendung kann hier gestartet und automatisiert im Browser geprüft werden; ein localhost-Link ist vom eigenen Computer nicht erreichbar.

## Einfachster interaktiver Weg: GitHub Codespaces

Voraussetzung: Der vollständige neue Projektcode muss im GitHub-Repository gespeichert sein. Der vollständige Projektcode enthält unter anderem package.json, src/, worker/ und .devcontainer/. Das Speichern auf GitHub veröffentlicht den Quellcode, startet aber kein öffentliches Website-Deployment. Die Codespaces-Portfreigabe bleibt privat.

Die vorbereitete `.devcontainer/devcontainer.json` installiert und startet die Anwendung automatisch:

1. GitHub-Repository öffnen → **Code → Codespaces → Create codespace**.
2. Warten, bis die Einrichtung fertig ist. Es werden ausschließlich die lokale D1-Testdatenbank und der Test-Server im Codespace verwendet. Cloudflare-Konto, echte D1-Datenbank, Stripe und Telegram sind dafür nicht nötig.
3. Im Bereich **Ports** bei **8787** die Sichtbarkeit **Private** beibehalten und **Open in Browser** anklicken. Der Link funktioniert nur mit berechtigter GitHub-Anmeldung. Die Startseite ist die Kunden-Landingpage; für das Dashboard `/admin` an den Browserlink anhängen.
4. Für den geschützten Admin-Zugang im Codespaces-Terminal `cat .cache/codespaces-admin.json` eingeben. Der Codespace erzeugt ein individuelles zufälliges Vorschaupasswort. Nicht teilen oder in Git einchecken. Das bekannte localhost-Demopasswort wird auf externen Vorschauhosts absichtlich nicht akzeptiert.
5. Testdaten benutzen. Nach dem Test den Codespace stoppen, damit kein unnötiger Verbrauch entsteht. GitHub bietet abhängig vom Konto ein Freikontingent, darüber können Kosten entstehen.

Es wird kein Cloudflare-Deployment durchgeführt, kein öffentlicher Tunnel angelegt und keine Zahlungs- oder Telegram-Integration aktiviert. Die Codespaces-Konfiguration ist vorbereitet, aber noch nicht in einem tatsächlich angelegten Codespace ausgeführt worden.

Wenn die Vorschau nach einem Neustart nicht automatisch läuft: Im Codespaces-Terminal `bash .devcontainer/start.sh` ausführen. Bei der ersten Einrichtung stehen Fehlerdetails im Terminal, spätere Serverlogs in `.cache/codespaces-preview.log`.

## Ersteinrichtung bleibt bei `npm run db:local` hängen

Wenn Installation und Build beendet sind, aber `wrangler d1 migrations apply orders-db --local` lange ohne Fortschritt läuft, ist der lokale D1-Schritt blockiert. Eine interaktive Bestätigungsfrage im Lifecycle-Terminal ist eine mögliche Ursache, nicht allein aus einer Prozessliste beweisbar. Der Tool-Wrapper erzwingt deshalb nur für explizit lokale D1-Aufrufe `CI=true`, schließt deren Standardeingabe und begrenzt die Laufzeit auf 120 Sekunden. Remote-Datenbanken und Deployments behalten ihre bisherigen interaktiven Bestätigungen.

In einem zweiten Bash-Terminal des eigenen Codespaces den hängenden lokalen Migrationsaufruf gezielt stoppen (keine VS-Code-/Editorprozesse beenden):

```bash
pkill -TERM -f '[w]rangler.*d1 migrations apply orders-db --local'
git pull --ff-only
npm run db:local && node scripts/codespaces-admin.mjs && npm run preview -- --ip 0.0.0.0
```

Die Migrationen sind wiederholbar und ihre Anwendung wird in D1 verzeichnet. Dieser Schritt löscht die Datenbank nicht. Er nutzt den schon fertigen Build, richtet den privaten Vorschau-Admin ein und startet die Vorschau nur bei Erfolg. Falls das Zwei-Minuten-Limit erneut erreicht wird, die letzte angezeigte Wrangler-Fehlermeldung prüfen; weitere Ursachen wie ein Laufzeit- oder Speicherproblem sind damit nicht ausgeschlossen. Keine zweite Migration parallel starten.

## Eigenen Vorschau-Benutzernamen und Passwort setzen

Im privaten Codespace kann der automatisch angelegte Vorschau-Admin umbenannt werden, z. B.:

```bash
node scripts/codespaces-admin.mjs Amedspor21
```

Der Befehl fragt das Passwort im Terminal unsichtbar ab. Er ändert ausschließlich den bekannten Vorschau-Admin in der **lokalen** D1-Datenbank und meldet dessen alte Sitzungen ab. Restaurantdaten und andere Admins bleiben erhalten. Die Anmeldung akzeptiert anschließend Benutzername oder E-Mail; Groß-/Kleinschreibung des Benutzernamens ist unerheblich. Das Passwort wird nicht im Git-Verlauf abgelegt. In `.cache/codespaces-admin.json` bleibt es wie beim ursprünglichen Vorschau-Admin nur lokal für den Codespace-Besitzer lesbar gespeichert; `.cache/` ist von Git ausgeschlossen. Automatische Wiederholung ohne Benutzernamen erhält die zuletzt gesetzten Zugangsdaten.

Vierstellige Passwörter sind hier nur für den privaten Testbetrieb vorgesehen. Für einen öffentlich betriebenen Dienst weiterhin `scripts/create-admin.mjs` mit mindestens zwölf Zeichen verwenden.
