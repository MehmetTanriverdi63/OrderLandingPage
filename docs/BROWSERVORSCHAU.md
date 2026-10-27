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
