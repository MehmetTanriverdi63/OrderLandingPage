# Online-Zahlung: kostenlos testen

Die Plattform nutzt Stripe Checkout als gehostete Zahlungsseite. Im Testmodus wird kein Geld bewegt und es fällt keine Zahlungsgebühr an. Es ist kein kostenpflichtiges UI- oder Feed-Abonnement erforderlich. Echte Kartenzahlungen sind dagegen nicht kostenlos: Zahlungsdienstleister berechnen üblicherweise Transaktionsgebühren. Aktuelle Konditionen für das Restaurant vor dem Echtbetrieb beim Anbieter prüfen. Diese Version akzeptiert ausschließlich `sk_test_`-Schlüssel und weist Live-Webhooks zurück.

## Einmalige Kontoeinstellungen durch den Betreiber

1. Ein eigenes Stripe-Konto anlegen und den **Testmodus / eine Test-Sandbox** öffnen. Keine Live-Schlüssel verwenden.
2. Dort einen Test-Webhook für die veröffentlichte Website anlegen: `https://instagram-to-order.m-verdi.workers.dev/api/stripe/webhook`. Ereignis: `checkout.session.completed`. Das Signing Secret beginnt mit `whsec_`.
3. Im bei Cloudflare angemeldeten Codespace ausführen:

```sh
git pull --ff-only
node scripts/configure-stripe-test.mjs --cloudflare
```

Der Helfer fragt den geheimen Testschlüssel (`sk_test_…`) und das Signing Secret (`whsec_…`) unsichtbar ab. Diese Werte niemals in den Chat, Screenshots oder Git einfügen. Er prüft den Schlüssel lesend bei Stripe, prüft den Build, speichert die beiden Werte als Cloudflare-Secrets und deployt den Worker. Er erzeugt selbst weder Zahlung noch Bestellung. Andere Cloudflare-Secrets, Restaurantdaten und Telegram-Einstellungen bleiben erhalten. Bei einem Fehler können frühere Schritte bereits gespeichert sein; die genannte Phase prüfen und den Befehl erneut aufrufen.

Der Worker erlaubt den Testmodus erst, wenn Flag, Testschlüssel und Webhook-Secret vorhanden sind. Ohne diese Konfiguration bleibt nur Barzahlung verfügbar. Das Flag in `wrangler.worker.jsonc` erlaubt Testzahlungen nach dieser Einrichtung und bleibt bei späteren Git-Deployments erhalten. Pages bleibt standardmäßig deaktiviert.

## Testablauf

- Eine neue Bestellung erstellen und „Online bezahlen · TEST“ auswählen.
- Auf Stripe Checkout beispielsweise die Stripe-Testkarte `4242 4242 4242 4242`, ein zukünftiges Ablaufdatum und einen beliebigen dreistelligen CVC eingeben. Keine echten Kartendaten verwenden.
- Erst der korrekt signierte Test-Webhook mit passender Summe, Währung und Restaurantzuordnung setzt die Bestellung auf bezahlt. Die Rückleitung allein ist kein Zahlungsnachweis.
- Dashboard und ggf. die bereits aktivierte Telegram-Zustellung prüfen. Unbezahlte Online-Bestellungen können nicht angenommen werden; abgebrochene Zahlungen lassen sich über den privaten Bestellstatus erneut starten.
- Auch einen Abbruch und eine abgelehnte Testkarte ausprobieren. Die Plattform erkennt Preise serverseitig und behandelt wiederholte Webhooks idempotent.

Lokal: `node scripts/configure-stripe-test.mjs --local` schreibt nur die ignorierte `.dev.vars`. Vorschau neu starten und mit der Stripe CLI Test-Webhooks an `http://localhost:8787/api/stripe/webhook` weiterleiten; dafür das vom lokalen Listener ausgegebene Test-Signing-Secret verwenden. Der Einrichtungshelfer legt keinen Webhook automatisch an und prüft nicht, ob sein Signing Secret zu genau diesem Endpunkt gehört; diesen Zusammenhang durch eine Testbestellung bestätigen.

Zum Abschalten `STRIPE_ENABLED` im verwendeten Worker-Konfigurationsfile auf `false` setzen und deployen. Ein kommerzieller Echtbetrieb braucht eine separate bewusste Freigabe und Umsetzung; Live-Schlüssel allein können ihn hier nicht aktivieren.
