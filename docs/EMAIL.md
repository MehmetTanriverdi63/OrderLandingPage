# Gastbestellung mit freiwilliger E-Mail

Telefonnummer bleibt Pflicht; die E-Mail-Adresse ist optional. Ein Kundenkonto wird nicht angelegt. Die Adresse wird nur für Bestellinformationen gespeichert, nicht automatisch für Werbung verwendet. Ohne aktivierten Versand funktionieren Bestellung und Browserstatus weiterhin. Im Checkout wird transparent auf einen noch nicht eingerichteten Versand hingewiesen.

## Was implementiert ist

- Eingangsbestätigung nach erstmaliger Anlage einer Bestellung: ausdrücklich noch keine Annahme durch das Restaurant.
- Annahmebestätigung nach erfolgreicher Annahme im Dashboard, mit bestätigter Abhol-/Lieferzeit.
- Privater Statuslink mit dem vorhandenen Bestelltoken, serverseitig gegen den gespeicherten Hash geprüft. Link-Domain kommt aus der Betreiberkonfiguration, nicht aus einer Kundenangabe oder einem fremden Host-Header.
- Deutscher Text und HTML ohne externe Bilder oder selbst eingebundene Tracking-Pixel. Kundeneingaben werden für HTML escaped.
- Versand über die Resend-HTTP-API, nur bei explizitem `EMAIL_ENABLED=true`, Schlüssel und gültigem Absender. Die Einrichtung ist auf das Pilotrestaurant begrenzt. Andere Mandanten verwenden nicht unbeabsichtigt denselben Restaurantabsender.
- Versandstatus je Nachricht im versionierten Bestell-Metadatenumschlag; keine Remote-Schemamigration nötig. Historische Bestellungen ohne E-Mail bleiben gültig.
- Persistente optimistische Versand-Sperre und stabile Idempotenzschlüssel gegen Doppelsendungen. Unsichere Sendungen außerhalb von 23 Stunden werden nicht automatisch erneut versendet; dann zuerst im Versanddienst prüfen. Bereits angenommene Nachrichten werden nie erneut versendet.
- Fehler blockieren keine Bestellung oder Annahme. Das Dashboard bietet bei fehlgeschlagenen Nachrichten einen manuellen Wiederholungsversuch. Nach Zustandsänderungen kann die Anzeige bis zum nächsten 5-Sekunden-Abruf benötigen.
- Tagesgrenze von höchstens 50 API-Versandversuchen insgesamt pro UTC-Tag. `EMAIL_DAILY_LIMIT` kann diese Grenze reduzieren, nicht erhöhen. Zwei erfolgreiche Nachrichten pro Bestellung verbrauchen zwei Versuche. Fehlversuche können ebenfalls das lokale Limit verbrauchen. Es werden keine Tarife gebucht oder automatische Upgrades ausgelöst.

„Vom Versanddienst angenommen“ ist die Bestätigung der API, nicht eine Zusicherung von Posteingang, Zustellung, Spamfreiheit oder Lesen. Bounce-/Zustell-Webhooks und Öffnungstracking sind nicht eingebaut. Für tiefergehende Zustellfehler das Anbieter-Dashboard prüfen. E-Mail-Adressen oder rohe Provider-Fehler werden nicht in Konsolenlogs geschrieben; Kundendaten werden nicht in Idempotenz-Headern verwendet.

## Noch einmalig vom Betreiber einzurichten

1. Eigenes Konto bei Resend anlegen und den kostenlosen Tarif sowie dessen **aktuelle** Tages-/Monatsgrenzen und Bedingungen prüfen. Kostenlose Kontingente sind begrenzt; das lokale Limit ersetzt die Tarifprüfung nicht und berücksichtigt keine E-Mails, die andere Anwendungen über dasselbe Konto senden.
2. Für Tests mit der Resend-Testdomain ist der Empfängerkreis eingeschränkt (typischerweise die eigene Konto-Adresse). Für beliebige Kunden eine eigene Absenderdomain mit den vom Anbieter angegebenen DNS-Einträgen verifizieren. Eine neu gekaufte Domain verursacht üblicherweise jährliche Kosten; hier wird keine gekauft und kein bezahlter Versandtarif aktiviert. Eine vorhandene Restaurantdomain kann genutzt werden, sofern DNS-Zugriff besteht.
3. Absender beispielsweise `Mediterrane Küche Worms <bestellung@eigene-domain.de>` festlegen. Öffnungs-/Klicktracking beim Anbieter deaktivieren. DPA, Datenschutzangaben und Löschfristen ergänzen; das Impressum benötigt weiterhin die tatsächliche Betreiber-E-Mail.
4. Einen passenden Resend-Sendeschlüssel erstellen und im angemeldeten Codespace ausführen:

```sh
git pull --ff-only
node scripts/configure-email.mjs --cloudflare
```

Der Helfer fragt Absender und Schlüssel unsichtbar ab, prüft den Build und speichert Konfiguration/Schlüssel über Standardeingabe als Cloudflare-Secrets. `EMAIL_ENABLED` wird zuletzt gesetzt. Secrets bleiben bei späteren Deployments erhalten. Er prüft die Formate, nicht die Domainverifizierung oder den Tarif. Keine E-Mail wird allein durch die Einrichtung versendet. Bei einem Fehler können frühere Einstellungen bereits gespeichert sein; die benannte Phase prüfen.

Lokal alternativ `node scripts/configure-email.mjs --local`; die ignorierte `.dev.vars` wird mit Dateirechten 0600 geschrieben. Server neu starten. Auch lokal kann diese ausdrücklich aktivierte Konfiguration echte E-Mails versenden – nur die eigene Testadresse verwenden. Im Repository sind weder Schlüssel noch aktive E-Mail-Konfiguration vorhanden.

5. Eine neue Testbestellung mit eigener E-Mail-Adresse anlegen. Eingangsbestätigung und Link prüfen; dann im Dashboard annehmen und die zweite Nachricht sowie die bestätigte Zeit prüfen. Späteres Abschalten: `EMAIL_ENABLED` in der verwendeten Umgebung auf `false` setzen. Alte Bestellungen werden bei Aktivierung nicht automatisch nachträglich versendet.

## Daten und Löschung

Die gespeicherte E-Mail und Versand-Metadaten sind personenbezogene Bestelldaten. Es gibt noch keinen automatischen Löschjob. Fristen für operative Kontaktdaten, gesetzlich erforderliche Buchungsunterlagen und Providerprotokolle müssen separat festgelegt und umgesetzt werden. Eine Datenschutzerklärung allein löscht nichts. Telegram- und Fahrer-Kopien werden durch Datenbanklöschung nicht automatisch entfernt.

## Prüfung

Automatische Prüfungen simulieren ausschließlich externe Anbieteraufrufe. Sie decken optionale/ungültige E-Mails, deaktivierten Versand, Mandantentrennung, private Links, HTML-Escaping, zwei unterschiedliche Nachrichtentypen, Wiederholungen, konkurrierende Zustellung, Anbieterfehler, Tageslimit und die endliche Idempotenzfrist ab. Kein echter Resend-Account oder Posteingang wurde hier getestet.
