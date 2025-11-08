#!/bin/bash

# 資料庫建置腳本
# 此腳本會提示你選擇建置方式

set -e

echo "🗄️  資料庫建置腳本"
echo ""

# 檢查 Supabase CLI 是否安裝
if command -v supabase &> /dev/null; then
  echo "✅ Supabase CLI 已安裝"
  echo ""
  echo "請選擇建置方式："
  echo "1. 使用 Supabase CLI (supabase db push)"
  echo "2. 顯示 SQL 語句（手動在 Supabase Dashboard 執行）"
  echo ""
  read -p "請選擇 (1/2): " choice

  case $choice in
    1)
      echo ""
      echo "使用 Supabase CLI 建置..."
      echo ""
      echo "⚠️  請確保："
      echo "  1. 已登入 Supabase: supabase login"
      echo "  2. 已連結專案: supabase link --project-ref your-project-ref"
      echo ""
      read -p "是否繼續？(y/n): " confirm
      if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
        supabase db push
        echo ""
        echo "✅ 資料庫建置完成"
      else
        echo "已取消"
        exit 0
      fi
      ;;
    2)
      echo ""
      echo "📋 SQL 語句位置："
      echo "   docs/database-schema.md"
      echo ""
      echo "請在 Supabase Dashboard → SQL Editor 中執行這些 SQL 語句"
      ;;
    *)
      echo "無效選擇"
      exit 1
      ;;
  esac
else
  echo "⚠️  Supabase CLI 未安裝"
  echo ""
  echo "請選擇："
  echo "1. 安裝 Supabase CLI"
  echo "2. 手動在 Supabase Dashboard 執行 SQL"
  echo ""
  read -p "請選擇 (1/2): " choice

  case $choice in
    1)
      echo ""
      echo "安裝 Supabase CLI..."
      npm install -g supabase
      echo ""
      echo "✅ 安裝完成，請重新運行此腳本"
      ;;
    2)
      echo ""
      echo "📋 SQL 語句位置："
      echo "   docs/database-schema.md"
      echo ""
      echo "請在 Supabase Dashboard → SQL Editor 中執行這些 SQL 語句"
      ;;
    *)
      echo "無效選擇"
      exit 1
      ;;
  esac
fi

