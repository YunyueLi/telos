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

# Top-level clean route aliases for public product surfaces. The canonical
# static app still lives under /app, while these aliases keep visible URLs such
# as /account and /settings usable on Cloudflare Pages.
for route in account cert diagnose me privacy pro review settings store streak studio terms; do
  if [ -d "web/out/$route" ]; then
    rm -rf "deploy/$route"
    cp -R "web/out/$route" "deploy/$route"
  fi
done

find deploy -name '.DS_Store' -delete

cat > deploy/_redirects <<'EOF'
/app /app/ 301
/account /account/index.html 200
/cert /cert/index.html 200
/diagnose /diagnose/index.html 200
/me /me/index.html 200
/privacy /privacy/index.html 200
/pro /pro/index.html 200
/review /review/index.html 200
/settings /settings/index.html 200
/store /store/index.html 200
/streak /streak/index.html 200
/studio /studio/index.html 200
/terms /terms/index.html 200
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

/
  Cache-Control: no-cache

/index.html
  Cache-Control: no-cache

/app/
  Cache-Control: no-cache

/app/index.html
  Cache-Control: no-cache

/account/
  Cache-Control: no-cache

/account/index.html
  Cache-Control: no-cache

/settings/
  Cache-Control: no-cache

/settings/index.html
  Cache-Control: no-cache

/pro/
  Cache-Control: no-cache

/pro/index.html
  Cache-Control: no-cache

/cert/
  Cache-Control: no-cache

/cert/index.html
  Cache-Control: no-cache

/diagnose/
  Cache-Control: no-cache

/diagnose/index.html
  Cache-Control: no-cache

/me/
  Cache-Control: no-cache

/me/index.html
  Cache-Control: no-cache

/privacy/
  Cache-Control: no-cache

/privacy/index.html
  Cache-Control: no-cache

/review/
  Cache-Control: no-cache

/review/index.html
  Cache-Control: no-cache

/store/
  Cache-Control: no-cache

/store/index.html
  Cache-Control: no-cache

/streak/
  Cache-Control: no-cache

/streak/index.html
  Cache-Control: no-cache

/studio/
  Cache-Control: no-cache

/studio/index.html
  Cache-Control: no-cache

/terms/
  Cache-Control: no-cache

/terms/index.html
  Cache-Control: no-cache

/app/account/
  Cache-Control: no-cache

/app/account/index.html
  Cache-Control: no-cache

/app/cert/
  Cache-Control: no-cache

/app/cert/index.html
  Cache-Control: no-cache

/app/diagnose/
  Cache-Control: no-cache

/app/diagnose/index.html
  Cache-Control: no-cache

/app/me/
  Cache-Control: no-cache

/app/me/index.html
  Cache-Control: no-cache

/app/privacy/
  Cache-Control: no-cache

/app/privacy/index.html
  Cache-Control: no-cache

/app/pro/
  Cache-Control: no-cache

/app/pro/index.html
  Cache-Control: no-cache

/app/review/
  Cache-Control: no-cache

/app/review/index.html
  Cache-Control: no-cache

/app/settings/
  Cache-Control: no-cache

/app/settings/index.html
  Cache-Control: no-cache

/app/store/
  Cache-Control: no-cache

/app/store/index.html
  Cache-Control: no-cache

/app/streak/
  Cache-Control: no-cache

/app/streak/index.html
  Cache-Control: no-cache

/app/studio/
  Cache-Control: no-cache

/app/studio/index.html
  Cache-Control: no-cache

/app/terms/
  Cache-Control: no-cache

/app/terms/index.html
  Cache-Control: no-cache

/app/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/app/portraits/*
  Cache-Control: public, max-age=31536000, immutable

/app/seals/*
  Cache-Control: public, max-age=31536000, immutable

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/app/sw.js
  Cache-Control: no-cache

/app/manifest.webmanifest
  Cache-Control: public, max-age=3600
EOF
