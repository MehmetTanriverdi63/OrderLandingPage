import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const [tool, ...args] = process.argv.slice(2);
if (!['wrangler', 'playwright'].includes(tool)) throw new Error('Unsupported development tool');
const config = resolve('.cache/config');
mkdirSync(config, { recursive: true });
const env = { ...process.env, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || config, WRANGLER_SEND_METRICS: 'false', PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || resolve('.cache/browsers') };
if (!env.PLAYWRIGHT_CHROMIUM_EXECUTABLE && existsSync('/usr/bin/chromium')) env.PLAYWRIGHT_CHROMIUM_EXECUTABLE = '/usr/bin/chromium';
// Local D1 setup must not wait for an invisible prompt in Codespaces hooks.
// Do not change the interactive behavior of deployments or remote databases.
const localD1 = tool === 'wrangler' && args[0] === 'd1' && args.includes('--local') && !args.includes('--remote');
if (localD1) env.CI = 'true';
const child = spawn(resolve(`node_modules/.bin/${tool}`), args, {
  stdio: localD1 ? ['ignore', 'inherit', 'inherit'] : 'inherit',
  env,
  ...(localD1 ? { timeout: 120_000 } : {})
});
if (localD1) console.log('Lokale D1-Einrichtung ohne Eingabeaufforderung (Zeitlimit: 120 Sekunden).');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', e => { console.error(e.message); process.exit(1); });
child.on('exit', (code, signal) => {
  if (localD1 && signal) console.error('Lokale D1-Einrichtung abgebrochen oder Zeitlimit erreicht. Bitte die letzte Wrangler-Ausgabe prüfen.');
  process.exit(code ?? (signal ? 1 : 0));
});
