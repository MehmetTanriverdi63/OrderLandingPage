import { randomBytes, pbkdf2Sync, randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { readPassword } from './read-password.mjs';
export function adminSQL(login, password) {
  if(!login || !(/^[A-Za-z][A-Za-z0-9._-]{2,59}$/.test(login) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login)) || login.length>200)throw new Error('Gültigen Benutzernamen oder eine E-Mail-Adresse angeben.');
  if(typeof password!=='string' || password.length<12 || password.length>200)throw new Error('Für den Cloudflare-Admin ein Passwort mit 12–200 Zeichen verwenden.');
  const salt=randomBytes(24).toString('hex');
  const hash=`100000:${salt}:${pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}`;
  const q=s=>"'"+s.replaceAll("'","''")+"'";
  const email=q(login.toLowerCase()), restaurant="'mediterrane-worms'";
  return `INSERT INTO admins(id,restaurant_id,email,password_hash,demo) VALUES (${q(randomUUID())},${restaurant},${email},${q(hash)},0) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash WHERE admins.restaurant_id=excluded.restaurant_id AND admins.demo=0 RETURNING id,restaurant_id,email;\nDELETE FROM sessions WHERE admin_id IN (SELECT id FROM admins WHERE restaurant_id=${restaurant} AND email=${email} AND demo=0);\n`;
}
export async function configureAdmin(login) {
  if(!login)throw new Error('Aufruf: node scripts/cloudflare-admin.mjs DEIN_BENUTZERNAME');
  console.log(`Cloudflare-Admin für das Pilotrestaurant: ${login}. Ziel: Remote-Datenbank orders-db.`);
  console.log('Ein bereits vorhandener gleichnamiger Admin dieses Restaurants erhält ein neues Passwort; seine alten Sitzungen werden beendet. Andere Konten und Bestellungen bleiben erhalten.');
  let password=process.env.ADMIN_PASSWORD;
  if(!password){password=await readPassword('Neues Cloudflare-Admin-Passwort (mindestens 12 Zeichen, unsichtbar): ');const repeated=await readPassword('Passwort wiederholen (unsichtbar): ');if(password!==repeated)throw new Error('Passwörter stimmen nicht überein. Es wurde nichts geändert.');}
  const sql=adminSQL(login,password);
  try{execFileSync('git',['check-ignore','--quiet','.cache/cloudflare-admin-check.sql'],{stdio:'ignore'});}catch{throw new Error('.cache muss von Git ausgeschlossen sein. Einrichtung abgebrochen.');}
  mkdirSync('.cache',{recursive:true});const directory=mkdtempSync('.cache/cloudflare-admin-'),file=`${directory}/admin.sql`;
  try {
    writeFileSync(file,sql,{mode:0o600});
    const output=execFileSync('node',['scripts/tool.mjs','wrangler','d1','execute','orders-db','--config','wrangler.worker.jsonc','--remote','--file',file,'--json','--yes'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
    const results=JSON.parse(output.slice(output.indexOf('[')));
    if(!results.some(result=>result.success && result.results?.some(row=>row.email===login.toLowerCase() && row.restaurant_id==='mediterrane-worms')))throw new Error('Name ist bereits einem anderen Konto zugeordnet.');
  }catch{throw new Error('Cloudflare-Admin konnte nicht bestätigt werden. Bitte Cloudflare-Anmeldung, Datenbankmigrationen und mögliche Namenskonflikte prüfen. Ein erneuter Aufruf setzt das Passwort dieses Zugangs erneut.');}
  finally{rmSync(directory,{recursive:true,force:true});}
  console.log(`Cloudflare-Admin ${login} erfolgreich eingerichtet. Anmeldung auf der Cloudflare-Website unter /admin mit deinem neuen Passwort.`);
  console.log('Kein Klartextpasswort gespeichert oder ausgegeben. Lokaler Codespace-Admin, Stripe und Telegram unverändert.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)configureAdmin(process.argv[2]).catch(error=>{console.error(error.message);process.exitCode=1;});
