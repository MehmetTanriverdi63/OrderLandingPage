import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readPassword } from './read-password.mjs';
if (process.env.CODESPACES !== 'true') { console.error('Dieser Helfer ist nur für eine private GitHub-Codespaces-Vorschau vorgesehen.'); process.exit(1); }
mkdirSync('.cache', { recursive: true });
const credentialsPath = '.cache/codespaces-admin.json';
const credentials = existsSync(credentialsPath) ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : { email: 'preview@restaurant.local', password: randomBytes(24).toString('base64url') };
const requestedUsername = process.argv[2];
if (requestedUsername) {
  if (!/^[A-Za-z][A-Za-z0-9._-]{2,59}$/.test(requestedUsername)) throw new Error('Benutzername: 3–60 Zeichen, Buchstaben/Ziffern/Punkt/Unterstrich/Bindestrich.');
  const password = await readPassword();
  if (password.length < 4 || password.length > 200) throw new Error('Für die private Testvorschau 4–200 Zeichen eingeben. Für öffentlichen Betrieb mindestens 12 Zeichen verwenden.');
  credentials.email = requestedUsername.toLowerCase();
  credentials.username = requestedUsername;
  credentials.password = password;
}
const salt = randomBytes(24).toString('hex');
const hash = `100000:${salt}:${pbkdf2Sync(credentials.password, salt, 100000, 32, 'sha256').toString('hex')}`;
const q = s => "'" + s.replaceAll("'", "''") + "'";
const sqlPath = '.cache/codespaces-admin.sql';
writeFileSync(sqlPath, `INSERT INTO admins(id,restaurant_id,email,password_hash,demo) VALUES ('codespaces-preview-admin','mediterrane-worms',${q(credentials.email)},${q(hash)},0) ON CONFLICT(id) DO UPDATE SET email=excluded.email,password_hash=excluded.password_hash WHERE admins.restaurant_id=excluded.restaurant_id; DELETE FROM sessions WHERE admin_id='codespaces-preview-admin' AND EXISTS (SELECT 1 FROM admins WHERE id='codespaces-preview-admin' AND restaurant_id='mediterrane-worms' AND email=${q(credentials.email)});`, { mode: 0o600 });
try { execFileSync('node', ['scripts/tool.mjs', 'wrangler', 'd1', 'execute', 'orders-db', '--local', '--file', sqlPath], { stdio: 'pipe' }); }
finally { unlinkSync(sqlPath); }
writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
console.log('Privater Vorschau-Admin eingerichtet. Zugangsdaten nur im eigenen Codespace ansehen: cat .cache/codespaces-admin.json');
