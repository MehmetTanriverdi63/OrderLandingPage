import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readPassword } from './read-password.mjs';
const restaurant='mediterrane-worms';
const q=s=>"'"+s.replaceAll("'","''")+"'";
function validateLogin(login) {
  if(!login || !(/^[A-Za-z][A-Za-z0-9._-]{2,59}$/.test(login) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) || login.length>200)throw new Error('Gültigen Benutzernamen oder eine E-Mail-Adresse angeben.');
}
function prepareAdmin(login,password) {
  validateLogin(login);
  if(typeof password!=='string' || password.length<12 || password.length>200)throw new Error('Für den Cloudflare-Admin ein Passwort mit 12–200 Zeichen verwenden.');
  const salt=randomBytes(24).toString('hex');
  const hash=`100000:${salt}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}`;
  const email=q(login.toLowerCase());
  const sql=`INSERT INTO admins(id,restaurant_id,email,password_hash,demo) VALUES (${q(randomUUID())},${q(restaurant)},${email},${q(hash)},0) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash WHERE admins.restaurant_id=excluded.restaurant_id AND admins.demo=0;\nDELETE FROM sessions WHERE admin_id IN (SELECT id FROM admins WHERE restaurant_id=${q(restaurant)} AND email=${email} AND demo=0);\n`;
  return {sql,hash};
}
export function adminSQL(login,password) { return prepareAdmin(login,password).sql; }
const baseArgs=['scripts/tool.mjs','wrangler','d1','execute','orders-db','--config','wrangler.worker.jsonc','--remote'];
const options={encoding:'utf8',stdio:['ignore','pipe','pipe']};
function parseResults(output) {
  const text=String(output),start=text.indexOf('[');
  if(start<0)throw new Error('Cloudflare lieferte keine gültige JSON-Bestätigung.');
  const results=JSON.parse(text.slice(start));
  if(!Array.isArray(results) || !results.length || results.some(result=>result.success!==true))throw new Error('Cloudflare hat die Datenbankoperation nicht bestätigt.');
  return results;
}
function safeFailure(error,phase) {
  const raw=String(error?.stderr || '')+String(error?.stdout || '');
  if(/not authenticated|authentication error|10000|not logged in/i.test(raw))return new Error('Cloudflare-Anmeldung fehlt oder ist abgelaufen. Zuerst node scripts/tool.mjs wrangler login --device --browser=false ausführen.');
  if(/no such table/i.test(raw))return new Error('Admin-Tabelle fehlt. Zuerst die D1-Migrationen mit --remote anwenden.');
  if(/SQLITE_AUTH|not authorized|permission denied|9109/i.test(raw))return new Error('Cloudflare verweigert den Datenbankzugriff. D1-Schreibberechtigung und ausgewähltes Konto prüfen.');
  return new Error(`${phase} fehlgeschlagen. Konto und Remote-Datenbank orders-db prüfen. Es wurden keine Zugangsdaten ausgegeben.`);
}
function readAdmin(login,run,includeHash=false) {
  const columns=`id,restaurant_id,email,demo${includeHash?',password_hash':''}`;
  try {
    const output=run('node',[...baseArgs,'--command',`SELECT ${columns} FROM admins WHERE email=${q(login.toLowerCase())} LIMIT 1;`,'--json'],options);
    return parseResults(output).flatMap(result=>result.results || [])[0];
  } catch(error){throw safeFailure(error,'Remote-Abfrage');}
}
export function checkAdmin(login,{run=execFileSync}={}) {
  validateLogin(login);const row=readAdmin(login,run);
  if(!row){console.log(`Kein Cloudflare-Admin ${login} gefunden. Mit node scripts/cloudflare-admin.mjs ${login} anlegen.`);return false;}
  if(row.restaurant_id!==restaurant || Number(row.demo)!==0)throw new Error('Dieser Name ist einem anderen Konto oder einem gesperrten Demo-Zugang zugeordnet.');
  console.log(`Cloudflare-Admin ${login} ist vorhanden und für das Pilotrestaurant freigeschaltet. Es wurde nichts geändert.`);
  console.log('Mit dem zuletzt in cloudflare-admin.mjs eingegebenen langen Passwort auf der Cloudflare-Website unter /admin anmelden.');return true;
}
export async function configureAdmin(login,{run=execFileSync,prompt=readPassword}={}) {
  validateLogin(login);
  console.log(`Cloudflare-Admin für das Pilotrestaurant: ${login}. Ziel: Remote-Datenbank orders-db.`);
  console.log('Ein bereits vorhandener gleichnamiger Admin dieses Restaurants erhält ein neues Passwort; seine alten Sitzungen werden beendet. Andere Konten und Bestellungen bleiben erhalten.');
  let password=process.env.ADMIN_PASSWORD;
  if(!password){password=await prompt('Neues Cloudflare-Admin-Passwort (mindestens 12 Zeichen, unsichtbar): ');const repeated=await prompt('Passwort wiederholen (unsichtbar): ');if(password!==repeated)throw new Error('Passwörter stimmen nicht überein. Es wurde nichts geändert.');}
  const {sql,hash}=prepareAdmin(login,password);
  try{run('git',['check-ignore','--quiet','.cache/cloudflare-admin-check.sql'],{stdio:'ignore'});}catch{throw new Error('.cache muss von Git ausgeschlossen sein. Einrichtung abgebrochen.');}
  mkdirSync('.cache',{recursive:true});const directory=mkdtempSync('.cache/cloudflare-admin-'),file=`${directory}/admin.sql`;
  try {
    writeFileSync(file,sql,{mode:0o600});
    try{parseResults(run('node',[...baseArgs,'--file',file,'--json','--yes'],options));}
    catch(error){throw safeFailure(error,'Admin-Import');}
    // Remote --file returns import statistics, not SQL RETURNING rows.
    // Confirm with a separate read and compare the actual hash without printing it.
    const row=readAdmin(login,run,true);
    if(!row || row.email!==login.toLowerCase() || row.restaurant_id!==restaurant || Number(row.demo)!==0 || row.password_hash!==hash)throw new Error('Import beendet, aber der gewünschte Admin mit diesem Passwort konnte nicht bestätigt werden. Mit --check prüfen; mögliche Namenskonflikte klären.');
  }finally{rmSync(directory,{recursive:true,force:true});}
  console.log(`Cloudflare-Admin ${login} erfolgreich eingerichtet. Anmeldung auf der Cloudflare-Website unter /admin mit deinem neuen Passwort.`);
  console.log('Kein Klartextpasswort gespeichert oder ausgegeben. Lokaler Codespace-Admin, Stripe und Telegram unverändert.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  Promise.resolve().then(()=>process.argv.includes('--check')?checkAdmin(process.argv[2]):configureAdmin(process.argv[2])).catch(error=>{console.error(error.message);process.exitCode=1;});
}
