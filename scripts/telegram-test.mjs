import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { readSavedToken } from './configure-telegram.mjs';
export async function sendTest(chatId) {
  if(process.env.CODESPACES!=='true')throw new Error('Bitte im privaten Codespace ausführen.');
  if(!/^-?[1-9]\d{0,19}$/.test(chatId || ''))throw new Error('Gültige Chat-ID angeben.');
  const config=existsSync('.dev.vars')?readFileSync('.dev.vars','utf8'):'';
  const token=(process.env.TELEGRAM_BOT_TOKEN || readSavedToken(config) || '').trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw new Error('Kein gültiger gespeicherter Bot-Token. Zuerst configure-telegram.mjs ausführen.');
  mkdirSync('.cache',{recursive:true});
  const key=createHash('sha256').update(`${token}:${chatId}`).digest('hex');
  const receiptPath=`.cache/telegram-test-${key}.json`;
  try{writeFileSync(receiptPath,JSON.stringify({status:'pending',chatId,startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});}
  catch(error){if(error.code==='EEXIST'){console.log('Für diesen Bot und Chat wurde bereits ein Test gestartet. Keine weitere Nachricht gesendet. Bitte Telegram und die letzte Terminalausgabe prüfen.');return;}throw error;}
  let response;
  try{
    response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:chatId,text:'🧪 Verbindungstest · Mediterrane Küche am Wasserturm\nDie Telegram-Verbindung funktioniert.\nDies ist keine Bestellung. Automatische Bestellbenachrichtigungen werden durch diesen Test nicht aktiviert.'}),signal:AbortSignal.timeout(15000)});
  }catch{throw new Error('Zustellstatus unklar: Telegram nicht erreichbar oder Zeitlimit überschritten. Bitte zuerst im Telegram-Chat nachsehen. Kein automatischer Wiederholungsversuch.');}
  if(!response.ok)throw new Error(`Telegram hat den Versand nicht bestätigt (HTTP ${response.status}). Bitte diese Fehlermeldung ohne Token weitergeben.`);
  const data=await response.json();
  if(!data.ok || !Number.isSafeInteger(data.result?.message_id) || String(data.result?.chat?.id)!==chatId)throw new Error('Keine passende Versandbestätigung von Telegram erhalten. Bitte im Chat prüfen.');
  writeFileSync(receiptPath,JSON.stringify({status:'sent',chatId,messageId:data.result.message_id,sentAt:new Date().toISOString()}),{mode:0o600});
  console.log(`Testnachricht an Chat ${chatId} erfolgreich gesendet (Nachricht ${data.result.message_id}).`);
  console.log('Automatische Bestellbenachrichtigungen wurden nicht aktiviert. Es wurde keine Bestellung angelegt.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)sendTest(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
