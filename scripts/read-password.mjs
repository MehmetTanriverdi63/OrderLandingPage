// Read a password directly from a terminal without echoing it or storing it in history.
export function readPassword(message = 'Neues Passwort (Eingabe bleibt unsichtbar): ') {
  if (!process.stdin.isTTY) throw new Error('Bitte diesen Befehl direkt im Codespaces-Terminal ausführen.');
  return new Promise((resolve, reject) => {
    const wasRaw = process.stdin.isRaw;
    let password = '';
    process.stdout.write(message);
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    function finish(error) {
      process.stdin.off('data', input);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error); else resolve(password);
    }
    function input(chunk) {
      for (const char of chunk) {
        if (char === '\u0003' || char === '\u0004') return finish(new Error('Eingabe abgebrochen.'));
        if (char === '\r' || char === '\n') return finish();
        if (char === '\u007f' || char === '\b') password = password.slice(0,-1);
        else if (char >= ' ') password += char;
      }
    }
    process.stdin.on('data', input);
  });
}
