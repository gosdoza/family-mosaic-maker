#!/usr/bin/env bash

set -euo pipefail

# Go project root
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

# Ensure linked
vercel link --yes >/dev/null 2>&1 || true

# Read vars from env (no prompt); if empty, skip setting
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
PREVIEW_DOMAIN="${PREVIEW_DOMAIN:-}"
PROD_DOMAIN="${PROD_DOMAIN:-}"

add_var () {
  local KEY="$1"
  local VALUE="$2"
  local TARGET="$3" # preview | production

  if [[ -z "$VALUE" ]]; then
    echo "⏩ Skip $KEY ($TARGET) – empty value"
    return 0
  fi

  echo -n "$VALUE" | vercel env add "$KEY" "$TARGET" >/dev/null
  echo "✅ Set $KEY ($TARGET)"
}

rm_var () {
  local KEY="$1"
  local TARGET="$2"
  vercel env rm "$KEY" "$TARGET" --yes >/dev/null 2>&1 || true
}

echo "🧹 Remove old values (if any)…"
for T in preview production; do
  for K in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY DOMAIN NEXT_PUBLIC_USE_MOCK; do
    rm_var "$K" "$T"
  done
done

echo "🧩 Set Preview envs…"
add_var "NEXT_PUBLIC_SUPABASE_URL"  "$SUPABASE_URL"         "preview"
add_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" "preview"
[[ -n "$PREVIEW_DOMAIN" ]] && add_var "DOMAIN" "https://${PREVIEW_DOMAIN}" "preview" || echo "⏩ Skip DOMAIN (preview)"
# Mock on preview by default
add_var "NEXT_PUBLIC_USE_MOCK" "true" "preview"

echo "🚀 Set Production envs…"
add_var "NEXT_PUBLIC_SUPABASE_URL"  "$SUPABASE_URL"         "production"
add_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" "production"
[[ -n "$PROD_DOMAIN" ]] && add_var "DOMAIN" "https://${PROD_DOMAIN}" "production" || echo "⏩ Skip DOMAIN (production)"
# Mock off in production
add_var "NEXT_PUBLIC_USE_MOCK" "false" "production"

echo "🔁 Trigger preview redeploy…"
DEPLOY_OUTPUT="$(vercel --prod=false --yes 2>&1)"
PREVIEW_URL="$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[a-zA-Z0-9-]+\.vercel\.app' | head -n1 || echo "")"
if [[ -z "$PREVIEW_URL" ]]; then
  PREVIEW_URL="$(echo "$DEPLOY_OUTPUT" | grep -i 'deployment\|preview\|ready' | grep -oE 'https://[^\s]+' | head -n1 || echo "")"
fi
if [[ -n "$PREVIEW_URL" ]]; then
  echo "🟢 Preview: ${PREVIEW_URL}"
else
  echo "⚠️ Could not extract preview URL from deployment output"
  echo "Check Vercel Dashboard for deployment URL"
fi

echo "🩺 Health check…"
set +e
curl -fsS "${PREVIEW_URL%/}/api/health" && echo || echo "⚠️ Health endpoint not ready yet."
set -e

echo "🎉 Done."
