import { copyFileSync, existsSync, constants } from 'node:fs';
if (!existsSync('.dev.vars')) { copyFileSync('.dev.vars.example', '.dev.vars', constants.COPYFILE_EXCL); console.log('Lokale Demo-Konfiguration angelegt.'); }
else console.log('Bestehende lokale Konfiguration beibehalten.');
