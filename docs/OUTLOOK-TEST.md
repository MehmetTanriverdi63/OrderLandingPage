# Testversand aus dem eigenen Outlook-Postfach

Der Microsoft-Provider sendet über Microsoft Graph **aus dem persönlich verbundenen Outlook-Konto**. Für den Pilot ist `m.verdi@outlook.de` vorgesehen. Es wird kein Outlook-Passwort gespeichert und kein Resend-Konto oder eigene Absenderdomain benötigt. Die Funktion bleibt ohne Appregistrierung, Cloudflare-Einstellungen und persönliche Freigabe deaktiviert.

Die Anwendung bucht keinen kostenpflichtigen Microsoft-Tarif. Für ein vorhandenes privates Outlook.com-Postfach sind kleine Graph-Tests grundsätzlich ohne eigenes Versandabonnement vorgesehen; Microsoft-Kontobedingungen und Versand-/Missbrauchsgrenzen gelten weiterhin. Appregistrierungen hängen vom verfügbaren Microsoft-/Entra-Verzeichnis ab. **Wenn das Portal ein Azure-Abo, Zahlungsdaten oder kostenpflichtige Einrichtung verlangt, nicht fortfahren, sondern den angezeigten Schritt prüfen.** Es wird kein kostenpflichtiges Konto automatisch angelegt.

## 1. Microsoft-App einmal registrieren

Beim eigenen Microsoft-Konto anmelden:
https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade

- „Neue Registrierung“, Name zum Beispiel `Restaurant-Bestellplattform Test`.
- Ein Kontotyp, der **persönliche Microsoft-Konten** unterstützt: „Nur persönliche Microsoft-Konten“ oder „Konten in beliebigen Organisationsverzeichnissen und persönliche Microsoft-Konten“. Kein ausschließlich organisationsinternes/single-tenant Konto wählen.
- Umleitungs-URI, Plattform **Web**:

```text
https://instagram-to-order.m-verdi.workers.dev/api/admin/outlook/callback
```

- Nach der Registrierung die **Anwendungs-ID (Client-ID)** notieren.
- Unter „Zertifikate & Geheimnisse“ ein **Clientgeheimnis** anlegen. Den **Wert**, nicht die Geheimnis-ID, direkt für die Cloudflare-Einstellung kopieren. Nicht in Chat, Git, Screenshots oder öffentliche Logs einfügen.
- Die Anwendung nutzt delegierte Rechte `User.Read`, `Mail.Send` und `offline_access`. Unter API-Berechtigungen gegebenenfalls Microsoft Graph → delegierte Berechtigungen → `Mail.Send` ergänzen; `User.Read` ist häufig voreingestellt. Es wird **kein** `Mail.Read`, kein fremdes Postfach und keine organisationsweite Anwendungsberechtigung benötigt.

## 2. Datenbanktabelle anlegen

Im angemeldeten Codespace:

```sh
git pull --ff-only
node scripts/tool.mjs wrangler d1 migrations apply orders-db --config wrangler.worker.jsonc --remote
```

Wenn Codespace nicht verfügbar ist, in Cloudflare D1 → `orders-db` → Console ausführen:

```sql
CREATE TABLE IF NOT EXISTS outlook_connections (
  restaurant_id TEXT PRIMARY KEY REFERENCES restaurants(id),
  account_email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  connected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Hier wird später nur ein verschlüsselter Refresh-Token abgelegt; niemals selbst einen unverschlüsselten Token eintragen. Bestehende Bestellungen werden nicht verändert.

## 3. Cloudflare-Konfiguration

Cloudflare → Workers & Pages → `instagram-to-order` → Settings → Variables and Secrets. Eintragen und deployen:

| Name | Typ | Wert |
|---|---|---|
| `EMAIL_PROVIDER` | Variable | `microsoft` |
| `EMAIL_ENABLED` | Variable | `true` |
| `MICROSOFT_CLIENT_ID` | Variable | Anwendungs-ID aus Schritt 1 |
| `MICROSOFT_CLIENT_SECRET` | **Secret** | Geheimnis-**Wert** aus Schritt 1 |
| `MICROSOFT_MAILBOX` | Variable | `m.verdi@outlook.de` |
| `EMAIL_DAILY_LIMIT` | Variable | zum Beispiel `10` für kleine Tests |

Falls `EMAIL_ENABLED` oder `EMAIL_PROVIDER` bereits als Secret angelegt sind, den vorhandenen Eintrag passend bearbeiten und nicht gleichzeitig als Variable duplizieren. Der bisherige Resend-Helfer wird für Outlook nicht ausgeführt; er würde den Provider zurück auf Resend stellen. Stripe-/Telegram-Einstellungen bleiben unverändert.

Standardziel für Testmails ist das konfigurierte Microsoft-Postfach selbst. Optional kann der Betreiber `EMAIL_TEST_RECIPIENT` auf genau **eine andere eigene/freigegebene Testadresse** setzen; es gibt keinen uneingeschränkten Kundenversand im Outlook-Testmodus. Gast-Eingaben können diese Einschränkung nicht umgehen. Das gemeinsame Anwendungslimit beträgt weiterhin höchstens 50 Sendungsversuche pro UTC-Tag, auch wenn ein höherer Wert eingetragen wird.

Bei einer späteren eigenen Website-Domain `PUBLIC_SITE_URL` und die bei Microsoft registrierte Redirect-URI konsistent auf die eigene HTTPS-Domain ändern. Die Standardadresse passt zur oben genannten workers.dev-Website.

## 4. Persönlich freigeben

Auf der **veröffentlichten Cloudflare-Website**, nicht in der lokalen Codespace-Vorschau:

1. Unter `/admin` anmelden.
2. „Statistik & Daten“ → „Outlook für Test-E-Mails“.
3. „Microsoft-Konto verbinden“ anklicken.
4. Bei Microsoft **m.verdi@outlook.de** wählen und die Profil-/Versandrechte prüfen und freigeben.
5. Nach Rückleitung ins Dashboard die verbundene Adresse prüfen.

Die Freigabe verbindet das Postfach, versendet aber **noch keine Nachricht**. Ein falsches Microsoft-Konto wird abgewiesen. Die öffentliche Bestellseite meldet E-Mail-Versand erst als verfügbar, wenn die Verbindung gespeichert ist. Rechtefreigaben und Tokens sind nicht im Browser-JavaScript verfügbar.

## 5. Funktionstest

Eine neue Bestellung anlegen und als freiwillige Kunden-E-Mail `m.verdi@outlook.de` eintragen. Dann im Dashboard annehmen. Eingangsbestätigung, Annahmebestätigung, bestätigte Zeit und privaten Statuslink im Posteingang prüfen; auch Spam und **Gesendet** ansehen. Jede Nachricht trägt `[TEST]`. Monatsberichte können gezielt an das gleiche Testpostfach gesendet werden. Alte Bestellungen werden nicht automatisch nachversendet.

Microsoft Graph bestätigt den Versand zunächst mit HTTP 202. Das ist kein Nachweis für Lesen oder Posteingang. Bei unklarem Ergebnis nach einer Netzunterbrechung wird die Bestellnachricht als **Versandstatus unklar** markiert und nicht blind wiederholt. Zuerst im Outlook-Ordner „Gesendet“ prüfen. Microsoft sendMail hat keine mit Resend identische Idempotenzgarantie; die Anwendung verwendet deshalb zusätzliche persistente Sperren und einen konservativen Wiederholungsstopp.

## Sicherheit und spätere Umstellung

- OAuth-Authorization-Code-Flow mit PKCE, kurzem verschlüsseltem HttpOnly/Secure/SameSite-Lax-State-Cookie und Bindung an die angemeldete Admin-/Restaurant-Sitzung.
- Der angemeldete Microsoft-Account wird über `/me` gegen die festgelegte Postfachadresse geprüft.
- Refresh-Tokens werden per AES-GCM mit zweck- und restaurantgebundener Zusatzinformation verschlüsselt. Der Schlüssel wird aus dem in Cloudflare geschützten Clientgeheimnis abgeleitet. Tokens werden bei Erneuerung aktualisiert; keine Roh-Tokens in Ausgaben.
- Nach Rotation/Ablauf des Microsoft-Clientgeheimnisses die Verbindung erneut herstellen. Wird das Microsoft-Konto widerrufen, muss ebenfalls neu verbunden werden.
- „Verbindung entfernen“ löscht die lokale gespeicherte Berechtigung. Zusätzlich kann der Kontoinhaber unter https://account.live.com/consent/Manage die Appfreigabe bei Microsoft widerrufen. Bereits versendete Nachrichten im Postfach werden dadurch nicht gelöscht.
- Zum späteren Wechsel auf eine geschäftliche Absenderdomain kann der vorhandene Resend-Provider wieder eingerichtet werden. Es wird kein bezahlter Dienst ohne Betreiberentscheidung aktiviert.

## Prüfgrenzen

Automatische Tests verwenden ausschließlich simulierte Microsoft-Antworten. Sie prüfen PKCE, Cookie-Schutz, Admin-/Restaurantbindung, Kontoprüfung, verschlüsselte Speicherung/Rotation, Empfängerbegrenzung, keinen Posteingangs-Lesezugriff und konservative Behandlung unklarer Sends. Eine echte Microsoft-Anmeldung und Zustellung sind erst nach den persönlichen Einrichtungsschritten prüfbar. Der Artikel `docs/EMAIL.md` beschreibt zusätzlich die allgemeinen Bestellnachrichten und Versandgrenzen.
