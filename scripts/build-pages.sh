#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Cloudflare Pages production defaults. These values are public client config;
# secrets and service-role keys stay in Worker/Supabase secret stores.
export NEXT_PUBLIC_TELOS_DERIVE_URL="${NEXT_PUBLIC_TELOS_DERIVE_URL:-https://telos-api.ungetsu.net/derive}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://SUPABASE_PROJECT_REF_REDACTED.supabase.co}"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-SUPABASE_PUBLISHABLE_KEY_REDACTED}"

if [ ! -d web/node_modules ]; then
  npm ci --prefix web --legacy-peer-deps
fi

npm --prefix web run build

rm -rf deploy
mkdir -p deploy/app
cp -R landing/. deploy/
cp -R web/out/. deploy/app/

if [ -f web/out/404.html ]; then
  cp web/out/404.html deploy/404.html
fi

cat > deploy/_redirects <<'EOF'
/account /app/account/ 302
/cert /app/cert/ 302
/diagnose /app/diagnose/ 302
/me /app/me/ 302
/privacy /app/privacy/ 302
/pro /app/pro/ 302
/review /app/review/ 302
/settings /app/settings/ 302
/store /app/store/ 302
/streak /app/streak/ 302
/studio /app/studio/ 302
/terms /app/terms/ 302
/app/account /app/account/ 301
/app/cert /app/cert/ 301
/app/diagnose /app/diagnose/ 301
/app/me /app/me/ 301
/app/privacy /app/privacy/ 301
/app/pro /app/pro/ 301
/app/review /app/review/ 301
/app/settings /app/settings/ 301
/app/store /app/store/ 301
/app/streak /app/streak/ 301
/app/studio /app/studio/ 301
/app/terms /app/terms/ 301
EOF

cat > deploy/_headers <<'EOF'
/*
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()

/app/*
  Cache-Control: no-cache

/app/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/app/sw.js
  Cache-Control: no-cache

/app/manifest.webmanifest
  Cache-Control: public, max-age=3600
EOF
