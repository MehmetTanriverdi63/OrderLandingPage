import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
if (process.env.CODESPACES !== 'true') { console.error('Dieser Helfer ist nur für eine private GitHub-Codespaces-Vorschau vorgesehen.'); process.exit(1); }
mkdirSync('.cache', { recursive: true });
const credentialsPath = '.cache/codespaces-admin.json';
const credentials = existsSync(credentialsPath) ? JSON.parse(readFileSync(credentialsPath, 'utf8')) : { email: 'preview@restaurant.local', password: randomBytes(24).toString('base64url') };
const salt = randomBytes(24).toString('hex');
const hash = `100000:${salt}:${pbkdf2Sync(credentials.password, salt, 100000, 32, 'sha256').toString('hex')}`;
const q = s => "'" + s.replaceAll("'", "''") + "'";
const sqlPath = '.cache/codespaces-admin.sql';
writeFileSync(sqlPath, `INSERT INTO admins(id,restaurant_id,email,password_hash,demo) VALUES ('codespaces-preview-admin','mediterrane-worms',${q(credentials.email)},${q(hash)},0) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash;`, { mode: 0o600 });
try { execFileSync('node', ['scripts/tool.mjs', 'wrangler', 'd1', 'execute', 'orders-db', '--local', '--file', sqlPath], { stdio: 'pipe' }); }
finally { unlinkSync(sqlPath); }
writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
console.log('Privater Vorschau-Admin eingerichtet. Zugangsdaten nur im eigenen Codespace ansehen: cat .cache/codespaces-admin.json');
