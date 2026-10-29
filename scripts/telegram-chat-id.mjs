import { pathToFileURL } from 'node:url';
import { readPassword } from './read-password.mjs';
export function findChats(updates) {
  const chats=new Map();
  for(const update of updates || []) {
    const chat=(update.message || update.edited_message || update.channel_post)?.chat;
    if(chat && Number.isSafeInteger(chat.id)) chats.set(String(chat.id), {id:String(chat.id),type:chat.type});
  }
  return [...chats.values()];
}
export async function main() {
  const token=(process.env.TELEGRAM_BOT_TOKEN || await readPassword('Telegram Bot-Token (unsichtbar eingeben): ')).trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token)) throw new Error('Tokenformat ungültig. Den vollständigen Token aus BotFather verwenden.');
  let response;
  try { response=await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=100&timeout=0`,{signal:AbortSignal.timeout(15000)}); }
  catch { throw new Error('Telegram ist nicht erreichbar. Bitte die Netzwerkverbindung prüfen.'); }
  if(!response.ok) {
    if(response.status===401 || response.status===404) throw new Error('Telegram akzeptiert den Token nicht. Bitte bei BotFather prüfen.');
    if(response.status===409) throw new Error('Ein anderer Bot-Prozess oder Webhook verhindert das Auslesen. Bestehende Bot-Anbindungen zuerst prüfen.');
    throw new Error(`Telegram-Anfrage fehlgeschlagen (HTTP ${response.status}).`);
  }
  const data=await response.json();
  if(!data.ok) throw new Error('Telegram hat die Anfrage nicht bestätigt.');
  const chats=findChats(data.result);
  if(!chats.length) { console.log('Noch kein Chat gefunden. Im Telegram-Chat mit genau diesem Bot /start senden und diesen Befehl erneut ausführen.');return; }
  console.log('Gefundene Chats:');
  for(const chat of chats) console.log(`Chat-ID: ${chat.id} (${chat.type})`);
  console.log('Es wurde keine Nachricht gesendet und keine Benachrichtigung aktiviert. Den Bot-Token nicht im Chat teilen.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) main().catch(error=>{console.error(error.message);process.exitCode=1;});
