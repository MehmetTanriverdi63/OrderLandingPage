import { readFileSync, existsSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, chmodSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readPassword } from './read-password.mjs';
export function readSavedToken(text) {
  const line=text.split(/\r?\n/).find(line=>/^\s*TELEGRAM_BOT_TOKEN\s*=/.test(line));
  if(!line)return '';
  const value=line.slice(line.indexOf('=')+1).trim();
  if(value.startsWith('"')) { try{return JSON.parse(value);}catch{return '';} }
  if(value.startsWith("'"))return value.endsWith("'") ? value.slice(1,-1) : '';
  return value.split(/\s+#/)[0].trim();
}
export function withSettings(text, settings) {
  let output=text;
  for(const [name,value] of Object.entries(settings)) {
    const pattern=new RegExp(`^\\s*${name}\\s*=.*$`,'gm');
    output=output.replace(pattern,'').replace(/\n{3,}/g,'\n\n');
    if(output && !output.endsWith('\n'))output+='\n';
    output+=`${name}=${JSON.stringify(value)}\n`;
  }
  return output;
}
export async function configure(chatId) {
  if(process.env.CODESPACES!=='true')throw new Error('Dieser Befehl ist für den privaten Codespace und seine lokale Testdatenbank vorgesehen.');
  if(!/^-?[1-9]\d{0,19}$/.test(chatId || ''))throw new Error('Bitte eine gültige Chat-ID als Argument angeben.');
  try{execFileSync('git',['check-ignore','--quiet','.dev.vars'],{stdio:'ignore'});}
  catch{throw new Error('.dev.vars muss von Git ausgeschlossen und darf nicht eingecheckt sein. Konfiguration abgebrochen.');}
  const original=existsSync('.dev.vars')?readFileSync('.dev.vars','utf8'):'';
  const token=(process.env.TELEGRAM_BOT_TOKEN || readSavedToken(original) || await readPassword('Telegram Bot-Token (unsichtbar eingeben): ')).trim();
  if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))throw new Error('Tokenformat ungültig. Vollständigen BotFather-Token verwenden.');
  let response;
  try{response=await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`,{signal:AbortSignal.timeout(15000)});}
  catch{throw new Error('Telegram nicht erreichbar. Es wurde keine Konfiguration gespeichert.');}
  if(!response.ok)throw new Error(`Telegram konnte Token und Chat nicht bestätigen (HTTP ${response.status}). Den Bot-Token nicht im Chat teilen.`);
  const data=await response.json();
  if(!data.ok || String(data.result?.id)!==chatId)throw new Error('Chat nicht bestätigt. Zuerst /start an diesen Bot senden.');
  mkdirSync('.cache',{recursive:true});
  const directory=mkdtempSync('.cache/telegram-setup-'),file=`${directory}/chat.sql`;
  try {
    writeFileSync(file,`UPDATE restaurants SET telegram_chat_id='${chatId}' WHERE id='mediterrane-worms' RETURNING id;`,{mode:0o600});
    const output=execFileSync('node',['scripts/tool.mjs','wrangler','d1','execute','orders-db','--local','--file',file,'--json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const results=JSON.parse(output.slice(output.indexOf('[')));
    if(!results.some(result=>result.success && result.results?.some(row=>row.id==='mediterrane-worms')))throw new Error('Pilotrestaurant nicht vorhanden.');
  } catch { throw new Error('Die lokale Datenbank konnte nicht konfiguriert werden. Bitte zuerst npm run db:local ausführen.'); }
  finally{rmSync(directory,{recursive:true,force:true});}
  writeFileSync('.dev.vars',withSettings(original,{TELEGRAM_BOT_TOKEN:token,TELEGRAM_ENABLED:'false'}),{mode:0o600});
  chmodSync('.dev.vars',0o600);
  console.log(`Chat-ID ${chatId} dem Pilotrestaurant lokal zugeordnet. Token ausschließlich in der ignorierten .dev.vars gespeichert.`);
  console.log('Telegram bleibt DEAKTIVIERT. Es wurde keine Nachricht gesendet.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)configure(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
