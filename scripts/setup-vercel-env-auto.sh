#!/usr/bin/env bash

set -euo pipefail

# Go project root
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Check deps
command -v vercel >/dev/null 2>&1 || { echo "❌ Vercel CLI not installed. Run: npm i -g vercel"; exit 1; }

# Ensure login and link
if ! vercel whoami >/dev/null 2>&1; then
  echo "🔐 Please login Vercel in this terminal…"
  vercel login
fi
vercel link --yes >/dev/null 2>&1 || true

# Read .env.local
if [[ ! -f .env.local ]]; then
  echo "❌ .env.local not found."
  exit 1
fi

NEXT_PUBLIC_SUPABASE_URL="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | cut -d= -f2- || true)"
NEXT_PUBLIC_SUPABASE_ANON_KEY="$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2- || true)"

if [[ -z "${NEXT_PUBLIC_SUPABASE_URL}" || -z "${NEXT_PUBLIC_SUPABASE_ANON_KEY}" ]]; then
  echo "❌ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  exit 1
fi

# Try read existing DOMAINs on Vercel
PREVIEW_DOMAIN="$(vercel env ls 2>/dev/null | awk '/^DOMAIN[[:space:]]+Preview/{print $3}' | sed 's#https://##' || true)"
PROD_DOMAIN="$(vercel env ls 2>/dev/null | awk '/^DOMAIN[[:space:]]+Production/{print $3}' | sed 's#https://##' || true)"

# Export for quick script
export SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL}"
export SUPABASE_ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
export PREVIEW_DOMAIN
export PROD_DOMAIN

echo "🧪 Using:"
echo "  SUPABASE_URL=${SUPABASE_URL}"
echo "  PREVIEW_DOMAIN=${PREVIEW_DOMAIN:-<unset>}"
echo "  PROD_DOMAIN=${PROD_DOMAIN:-<unset>}"

bash ./scripts/setup-vercel-env-quick.sh
