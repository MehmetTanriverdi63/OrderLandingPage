import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readSavedToken } from './configure-telegram.mjs';
const config='wrangler.worker.jsonc';
const runOptions={encoding:'utf8',stdio:['pipe','pipe','pipe']};
function failed(error,stage) {
  const raw=String(error?.stderr || '')+String(error?.stdout || '');
  const hint=/not authenticated|authentication error|10000|not logged in/i.test(raw)?' Zuerst node scripts/tool.mjs wrangler login --device --browser=false ausführen.':'';
  return new Error(`${stage} konnte nicht bestätigt werden.${hint} Vorherige Schritte können bereits gespeichert sein. Token niemals im Chat teilen.`);
}
export async function activateCloudflareTelegram(chatId,{run=execFileSync,fetcher=fetch}={}) {
  if(process.env.CODESPACES!=='true')throw new Error('Bitte im angemeldeten Codespace ausführen.');
  if(!/^-?[1-9]\d{0,19}$/.test(chatId || ''))throw new Error('Bestätigte Chat-ID angeben.');
  const original=existsSync('.dev.vars')?readFileSync('.dev.vars','utf8'):'';
  const token=(process.env.TELEGRAM_BOT_TOKEN || readSavedToken(original) || '').trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw new Error('Kein gespeicherter Token im Codespace gefunden. Zuerst configure-telegram.mjs verwenden.');
  console.log('Ziel: Cloudflare-Worker instagram-to-order und Remote-Datenbank orders-db. Stripe bleibt deaktiviert.');
  let response;
  try{response=await fetcher(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,{signal:AbortSignal.timeout(15000)});}catch{throw new Error('Telegram nicht erreichbar. Noch keine Cloudflare-Änderung ausgeführt.');}
  if(!response.ok)throw new Error(`Telegram bestätigt den gespeicherten Token/Chat nicht (HTTP ${response.status}).`);
  const data=await response.json();
  if(!data.ok || String(data.result?.id)!==chatId)throw new Error('Telegram-Empfänger stimmt nicht überein. Keine Cloudflare-Änderung ausgeführt.');
  // Build first so a compilation failure cannot leave a partial remote setup.
  console.log('1/4 Produktionsbuild prüfen …');
  try{run('npm',['run','build'],runOptions);}catch(error){throw failed(error,'Produktionsbuild');}
  console.log('2/4 Chat-ID dem Restaurant in Cloudflare zuordnen …');
  try{
    const sql=`UPDATE restaurants SET telegram_chat_id='${chatId}' WHERE id='mediterrane-worms' RETURNING id,telegram_chat_id;`;
    const output=run('node',['scripts/tool.mjs','wrangler','d1','execute','orders-db','--config',config,'--remote','--command',sql,'--json','--yes'],runOptions);
    const results=JSON.parse(String(output).slice(String(output).indexOf('[')));
    if(!results.some(result=>result.success && result.results?.some(row=>row.id==='mediterrane-worms' && String(row.telegram_chat_id)===chatId)))throw new Error('Restaurant nicht bestätigt.');
  }catch(error){throw failed(error,'Remote-Chatzuordnung');}
  console.log('3/4 Bot-Token als verschlüsseltes Cloudflare-Secret speichern …');
  try{run('node',['scripts/tool.mjs','wrangler','secret','put','TELEGRAM_BOT_TOKEN','--config',config,'--name','instagram-to-order'],{...runOptions,input:token+'\n'});}catch(error){throw failed(error,'Speichern des Cloudflare-Secrets');}
  console.log('4/4 Worker mit Telegram aktivieren …');
  try{run('node',['scripts/tool.mjs','wrangler','deploy','--config',config,'--name','instagram-to-order'],runOptions);}catch(error){throw failed(error,'Worker-Deployment');}
  console.log(`Telegram für NEUE Cloudflare-Bestellungen aktiviert. Empfänger: ${chatId}.`);
  console.log('Jetzt eine neue Bar-Testbestellung auf der .workers.dev-Website aufgeben. Alte Bestellungen werden nicht nachträglich versendet.');
  console.log('Der Codespace kann danach gestoppt werden; Cloudflare betreibt die Website. Dieser Einrichtungsbefehl hat selbst keine Nachricht und keine Bestellung ausgelöst.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)activateCloudflareTelegram(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
