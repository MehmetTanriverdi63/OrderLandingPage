#!/usr/bin/env bash
set -euo pipefail
mkdir -p .cache
if ! curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
  nohup npm run preview -- --ip 0.0.0.0 > .cache/codespaces-preview.log 2>&1 &
fi
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8787/api/health >/dev/null 2>&1; then
    echo 'Restaurant gestartet. Unter Ports → 8787 im Browser öffnen; Sichtbarkeit Private beibehalten. Dashboard: /admin.'
    exit 0
  fi
  sleep 1
done
echo 'Start fehlgeschlagen. Siehe .cache/codespaces-preview.log.' >&2
exit 1
