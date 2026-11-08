import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readPassword } from './read-password.mjs';
import { withSettings } from './configure-telegram.mjs';

export async function configureStripeTest(target,{read=readPassword,run=execFileSync,fetcher=fetch}={}) {
  if(!['--local','--cloudflare'].includes(target))throw new Error('Ziel angeben: --local oder --cloudflare. Ausschließlich kostenlose Stripe-Testzahlungen.');
  if(target==='--local') {
    try{run('git',['check-ignore','--quiet','.dev.vars'],{stdio:'ignore'});}catch{throw new Error('.dev.vars muss vor dem Speichern von Git ausgeschlossen sein.');}
  }
  const key=String(await read('Stripe TEST-Geheimschlüssel (sk_test_…, unsichtbar): ')).trim();
  if(!/^sk_test_[A-Za-z0-9_]{8,}$/.test(key))throw new Error('Nur sk_test_-Schlüssel werden akzeptiert. Keine Live-Schlüssel verwenden.');
  const webhook=String(await read('Signing Secret des TEST-Webhooks (whsec_…, unsichtbar): ')).trim();
  if(!/^whsec_[A-Za-z0-9_]{8,}$/.test(webhook))throw new Error('Ungültiges Webhook-Secret. Das Secret des Test-Endpunkts verwenden.');
  let response;
  try{response=await fetcher('https://api.stripe.com/v1/account',{headers:{Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(15000)});}catch{throw new Error('Stripe nicht erreichbar. Keine Konfiguration geändert.');}
  if(!response.ok)throw new Error('Stripe bestätigt den Testschlüssel nicht. Keine Konfiguration geändert.');
  const account=await response.json().catch(()=>null);
  if(!/^acct_/.test(account?.id || ''))throw new Error('Kein gültiges Stripe-Testkonto bestätigt.');
  const settings={STRIPE_ENABLED:'true',STRIPE_SECRET_KEY:key,STRIPE_WEBHOOK_SECRET:webhook};
  if(target==='--local') {
    const original=existsSync('.dev.vars')?readFileSync('.dev.vars','utf8'):'';
    writeFileSync('.dev.vars',withSettings(original,settings),{mode:0o600});chmodSync('.dev.vars',0o600);
    console.log('Stripe-Testzahlung lokal konfiguriert. Vorschau neu starten; für Zahlungsbestätigungen Test-Webhooks an /api/stripe/webhook weiterleiten.');
    return;
  }
  const options={encoding:'utf8',stdio:['pipe','pipe','pipe']};
  try{run('npm',['run','build'],options);}catch{throw new Error('Build fehlgeschlagen. Noch keine Cloudflare-Secrets geändert.');}
  let stage='Testschlüssel speichern';
  try{
    for(const name of ['STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']) {
      stage=`${name} speichern`;
      run('node',['scripts/tool.mjs','wrangler','secret','put',name,'--config','wrangler.worker.jsonc'],{...options,input:settings[name]+'\n'});
    }
    stage='Worker veröffentlichen';
    run('node',['scripts/tool.mjs','wrangler','deploy','--config','wrangler.worker.jsonc'],options);
  }catch{throw new Error(`${stage} fehlgeschlagen. Vorherige Schritte können bereits gespeichert sein. Cloudflare-Anmeldung prüfen und erneut ausführen. Keine Schlüssel im Chat teilen.`);}
  console.log('Stripe-Testzahlung auf Cloudflare eingerichtet. Keine echte Zahlung und keine Bestellung ausgelöst. Jetzt mit einer Stripe-Testkarte prüfen.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)configureStripeTest(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
