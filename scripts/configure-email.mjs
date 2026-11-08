import { existsSync,readFileSync,writeFileSync,chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readPassword } from './read-password.mjs';
import { withSettings } from './configure-telegram.mjs';
export async function configureEmail(target,{read=readPassword,run=execFileSync}={}){
 if(!['--local','--cloudflare'].includes(target))throw new Error('Ziel angeben: --local oder --cloudflare. Zuerst Versandkonto und Absender bestätigen.');
 if(target==='--local')try{run('git',['check-ignore','--quiet','.dev.vars'],{stdio:'ignore'});}catch{throw new Error('.dev.vars muss von Git ausgeschlossen sein.');}
 const sender=String(await read('Bestätigter Absender, z. B. Mediterrane Küche Worms <bestellung@eigene-domain.de>: ')).trim();
 if(!/^[^\r\n<>]+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(sender))throw new Error('Absenderformat ungültig. Anzeigename <adresse@domain.de> verwenden.');
 const key=String(await read('Resend-API-Schlüssel (re_…, unsichtbar): ')).trim();
 if(!/^re_[A-Za-z0-9_-]{12,}$/.test(key))throw new Error('Ungültiges Schlüsselformat. Keine Zugangsdaten im Chat teilen.');
 const settings={EMAIL_PROVIDER:'resend',EMAIL_ENABLED:'true',EMAIL_FROM:sender,RESEND_API_KEY:key,EMAIL_DAILY_LIMIT:'50'};
 if(target==='--local'){
  const original=existsSync('.dev.vars')?readFileSync('.dev.vars','utf8'):'';
  writeFileSync('.dev.vars',withSettings(original,settings),{mode:0o600});chmodSync('.dev.vars',0o600);
  console.log('E-Mail-Versand lokal konfiguriert. Server neu starten. Nur mit eigener Test-E-Mail-Adresse testen. Kein Versand ausgelöst.');return;
 }
 const options={encoding:'utf8',stdio:['pipe','pipe','pipe']};
 try{run('npm',['run','build'],options);}catch{throw new Error('Build fehlgeschlagen. Noch keine Cloudflare-Einstellung geändert.');}
 let stage='Datenbankmigration prüfen';
 try{
  run('node',['scripts/tool.mjs','wrangler','d1','migrations','apply','orders-db','--config','wrangler.worker.jsonc','--remote'],{...options,env:{...process.env,CI:'true'}});
  // Enable last; partial setup must not activate a sender without its credentials.
  for(const name of ['EMAIL_FROM','RESEND_API_KEY','EMAIL_DAILY_LIMIT','EMAIL_PROVIDER','EMAIL_ENABLED']){stage=`${name} speichern`;run('node',['scripts/tool.mjs','wrangler','secret','put',name,'--config','wrangler.worker.jsonc'],{...options,input:settings[name]+'\n'});}
  stage='Worker deployen';run('node',['scripts/tool.mjs','wrangler','deploy','--config','wrangler.worker.jsonc'],options);
 }catch{throw new Error(`${stage} fehlgeschlagen. Frühere Schritte können bereits gespeichert sein. Cloudflare-Anmeldung prüfen; Schlüssel nicht im Chat teilen.`);}
 console.log('E-Mail-Versand konfiguriert. Absender-Verifizierung und Kontingent müssen im Versanddienst geprüft sein. Keine E-Mail und keine Bestellung ausgelöst.');
 console.log('Jetzt eine neue Testbestellung mit eigener E-Mail-Adresse aufgeben und im Dashboard annehmen. Den Versand im Resend-Dashboard prüfen.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)configureEmail(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
