import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readSavedToken, withSettings } from './configure-telegram.mjs';
export function enableTelegram(chatId) {
  if(process.env.CODESPACES!=='true')throw new Error('Bitte im privaten Codespace ausführen. Cloudflare-Produktion wird nicht geändert.');
  if(!/^-?[1-9]\d{0,19}$/.test(chatId || ''))throw new Error('Bitte die bestätigte Chat-ID angeben.');
  try{execFileSync('git',['check-ignore','--quiet','.dev.vars'],{stdio:'ignore'});}
  catch{throw new Error('.dev.vars muss von Git ausgeschlossen sein. Aktivierung abgebrochen.');}
  if(!existsSync('.dev.vars'))throw new Error('Bitte zuerst configure-telegram.mjs ausführen.');
  const original=readFileSync('.dev.vars','utf8');
  const token=(process.env.TELEGRAM_BOT_TOKEN || readSavedToken(original) || '').trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw new Error('Kein gültiger gespeicherter Token. Bitte zuerst configure-telegram.mjs ausführen.');
  let recipient;
  try {
    const output=execFileSync('node',['scripts/tool.mjs','wrangler','d1','execute','orders-db','--local','--command',"SELECT telegram_chat_id FROM restaurants WHERE id='mediterrane-worms';",'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const results=JSON.parse(output.slice(output.indexOf('[')));
    recipient=results.filter(result=>result.success).flatMap(result=>result.results || [])[0]?.telegram_chat_id;
  } catch { throw new Error('Lokale Restaurant-Konfiguration konnte nicht gelesen werden. Aktivierung abgebrochen.'); }
  if(String(recipient)!==chatId)throw new Error('Gespeicherte Chat-ID stimmt nicht überein. Bitte zuerst configure-telegram.mjs mit der gewünschten Chat-ID ausführen.');
  writeFileSync('.dev.vars',withSettings(original,{TELEGRAM_BOT_TOKEN:token,TELEGRAM_ENABLED:'true'}),{mode:0o600});
  chmodSync('.dev.vars',0o600);
  console.log(`Telegram für neue Bestellungen im privaten Codespace aktiviert. Empfänger: ${chatId}.`);
  console.log('Den Vorschau-Server neu starten und eine NEUE Bar-Testbestellung aufgeben. Vorhandene Bestellungen werden nicht nachträglich versendet.');
  console.log('Admin-Dashboard und Stripe-Einstellungen bleiben unverändert. Dieser Befehl selbst versendet keine Nachricht.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){try{enableTelegram(process.argv[2]);}catch(error){console.error(error.message);process.exitCode=1;}}
