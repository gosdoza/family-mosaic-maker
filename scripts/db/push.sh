#!/usr/bin/env bash

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "❌ 未找到 supabase CLI，請安裝後執行："
  echo "  npm i -g supabase"
  exit 1
fi

echo "🚀 推送本地 migrations 至本地 Supabase（需事先 supabase start）..."

supabase db push

echo "✅ push 完成"



