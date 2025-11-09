#!/bin/bash

# Setup Vercel Environment Variables Script
# This script helps you set up environment variables for Preview and Production environments
#
# Usage:
#   ./scripts/setup-vercel-env.sh
#
# Or with environment variables:
#   SUPABASE_URL="https://your-project.supabase.co" \
#   SUPABASE_ANON_KEY="your-anon-key" \
#   ./scripts/setup-vercel-env.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Vercel Environment Variables Setup                            ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 0) Check Vercel login
echo "📋 Step 0: Checking Vercel login status..."
if ! vercel whoami >/dev/null 2>&1; then
  echo -e "${YELLOW}⚠️  Not logged in to Vercel. Please login...${NC}"
  vercel login
else
  echo -e "${GREEN}✅ Logged in to Vercel${NC}"
  vercel whoami
fi
echo ""

# 1) Link project
echo "📋 Step 1: Linking Vercel project..."
if [ -f ".vercel/project.json" ]; then
  echo -e "${GREEN}✅ Project already linked${NC}"
  cat .vercel/project.json
else
  echo -e "${YELLOW}⚠️  Project not linked. Linking now...${NC}"
  vercel link --yes || true
fi
echo ""

# Function to prompt for value or use environment variable
prompt_or_env() {
  local var_name=$1
  local prompt_text=$2
  local default_value=$3
  
  # Check if environment variable is set
  if [ -n "${!var_name}" ]; then
    echo "${!var_name}"
    return
  fi
  
  # Prompt user for input
  read -p "$prompt_text: " value
  if [ -z "$value" ] && [ -n "$default_value" ]; then
    echo "$default_value"
  else
    echo "$value"
  fi
}

# Function to set environment variable
set_env_var() {
  local env_name=$1
  local env_type=$2
  local value=$3
  
  if [ -z "$value" ]; then
    echo -e "${YELLOW}⚠️  Skipping $env_name (empty value)${NC}"
    return
  fi
  
  echo "Setting $env_name for $env_type..."
  # Remove existing if exists
  vercel env rm "$env_name" "$env_type" -y >/dev/null 2>&1 || true
  # Add new value
  echo "$value" | vercel env add "$env_name" "$env_type"
  echo -e "${GREEN}✅ Set $env_name for $env_type${NC}"
}

# Collect values
echo "📋 Step 2: Collecting environment variable values..."
echo ""

# Supabase Configuration
SUPABASE_URL=$(prompt_or_env "SUPABASE_URL" "Enter Supabase URL (e.g., https://your-project.supabase.co)")
SUPABASE_ANON_KEY=$(prompt_or_env "SUPABASE_ANON_KEY" "Enter Supabase Anon Key")

# Domain Configuration
PREVIEW_DOMAIN=$(prompt_or_env "PREVIEW_DOMAIN" "Enter Preview Domain (e.g., family-mosaic-maker-abc123.vercel.app)" "family-mosaic-maker.vercel.app")
PROD_DOMAIN=$(prompt_or_env "PROD_DOMAIN" "Enter Production Domain (e.g., family-mosaic-maker.vercel.app)" "family-mosaic-maker.vercel.app")

# PayPal Configuration (optional)
PAYPAL_CLIENT_ID=$(prompt_or_env "PAYPAL_CLIENT_ID" "Enter PayPal Client ID (optional, press Enter to skip)" "")
PAYPAL_CLIENT_SECRET=$(prompt_or_env "PAYPAL_CLIENT_SECRET" "Enter PayPal Client Secret (optional, press Enter to skip)" "")

echo ""
echo "📋 Step 3: Setting Preview environment variables..."
echo ""

# Set Preview environment variables
set_env_var "NEXT_PUBLIC_SUPABASE_URL" "preview" "$SUPABASE_URL"
set_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "preview" "$SUPABASE_ANON_KEY"
set_env_var "DOMAIN" "preview" "https://$PREVIEW_DOMAIN"
set_env_var "NEXT_PUBLIC_USE_MOCK" "preview" "true"

if [ -n "$PAYPAL_CLIENT_ID" ]; then
  set_env_var "PAYPAL_CLIENT_ID" "preview" "$PAYPAL_CLIENT_ID"
fi

if [ -n "$PAYPAL_CLIENT_SECRET" ]; then
  set_env_var "PAYPAL_CLIENT_SECRET" "preview" "$PAYPAL_CLIENT_SECRET"
fi

echo ""
echo "📋 Step 4: Setting Production environment variables..."
echo ""

# Set Production environment variables
set_env_var "NEXT_PUBLIC_SUPABASE_URL" "production" "$SUPABASE_URL"
set_env_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "production" "$SUPABASE_ANON_KEY"
set_env_var "DOMAIN" "production" "https://$PROD_DOMAIN"
set_env_var "NEXT_PUBLIC_USE_MOCK" "production" "false"

if [ -n "$PAYPAL_CLIENT_ID" ]; then
  set_env_var "PAYPAL_CLIENT_ID" "production" "$PAYPAL_CLIENT_ID"
fi

if [ -n "$PAYPAL_CLIENT_SECRET" ]; then
  set_env_var "PAYPAL_CLIENT_SECRET" "production" "$PAYPAL_CLIENT_SECRET"
fi

echo ""
echo "📋 Step 5: Redeploying Preview environment..."
echo ""

# Redeploy Preview
vercel --prebuilt --prod=false --yes

echo ""
echo "📋 Step 6: Health check..."
echo ""

# Health check
PREVIEW_URL="https://$PREVIEW_DOMAIN"
echo "Testing health endpoint: $PREVIEW_URL/api/health"

if curl -sSf "$PREVIEW_URL/api/health" >/dev/null 2>&1; then
  echo -e "${GREEN}✅ Health check passed${NC}"
  curl -sS "$PREVIEW_URL/api/health" | jq . || curl -sS "$PREVIEW_URL/api/health"
else
  echo -e "${YELLOW}⚠️  Health check failed (deployment may still be in progress)${NC}"
  echo "You can check the deployment status in Vercel Dashboard"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║  Setup Complete!                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📚 Next steps:"
echo "  1. Verify environment variables in Vercel Dashboard"
echo "  2. Configure Supabase Redirect URLs (see docs/deploy/supabase-auth-urls.md)"
echo "  3. Test your deployment: $PREVIEW_URL"
echo ""

