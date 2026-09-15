#!/bin/sh
set -eu
cd /workspace
if [ -f /workspace/.grok/supabase.env ]; then
  set -a
  # server-only; file is gitignored under .grok/
  . /workspace/.grok/supabase.env
  set +a
fi
export HYBRID_RAG="${HYBRID_RAG:-1}"
node scripts/preview.mjs stop || true
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
npm run dev >>/tmp/app-startup.log 2>&1 &
