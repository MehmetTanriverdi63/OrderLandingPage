import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { writeFileSync, chmodSync } from 'node:fs';
// Password is read only from process environment and never written to stdout.
const [email, restaurantId = 'mediterrane-worms', output = '/tmp/instagram-admin.sql'] = process.argv.slice(2);
const password = process.env.ADMIN_PASSWORD;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 12) {
  console.error('Usage: ADMIN_PASSWORD=<secure value> npm run admin:create -- email restaurant_id /tmp/admin.sql\nUse a password of at least 12 characters. Prefer a secret environment injection or read -s; do not paste passwords in chat.'); process.exit(1);
}
const salt = randomBytes(24).toString('hex');
const hash = `100000:${salt}:${pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex')}`;
const q = s => "'" + s.replaceAll("'", "''") + "'";
writeFileSync(output, `INSERT INTO admins(id,restaurant_id,email,password_hash,demo) VALUES (${[crypto.randomUUID(), restaurantId, email.toLowerCase(), hash].map(q).join(',')},0);\n`, { mode: 0o600 });
chmodSync(output, 0o600);
console.log(`Admin-SQL mit Passwort-Hash gespeichert: ${output}. Mit wrangler d1 execute orders-db --local/--remote --file anwenden; danach Datei löschen.`);
