#!/bin/bash

# Health check script for non-mock API endpoints
# Usage: ./scripts/health-check.sh [BASE_URL]

set -e

BASE_URL="${1:-http://localhost:3000}"

echo "🔍 Health Check - API Endpoints"
echo "Base URL: $BASE_URL"
echo ""

# Check generate endpoint
echo "1. Testing POST /api/generate"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{}' || echo '{"error":"Connection failed"}')
STATUS=$(echo "$RESPONSE" | jq -r '.error // "ok"')
if [ "$STATUS" = "ok" ]; then
  echo "✅ Generate endpoint accessible"
else
  echo "⚠️  Generate endpoint: $STATUS"
fi
echo ""

# Check progress endpoint
echo "2. Testing GET /api/progress/test-job"
RESPONSE=$(curl -s "${BASE_URL}/api/progress/test-job" || echo '{"error":"Connection failed"}')
STATUS=$(echo "$RESPONSE" | jq -r '.error // "ok"')
if [ "$STATUS" = "ok" ]; then
  echo "✅ Progress endpoint accessible"
else
  echo "⚠️  Progress endpoint: $STATUS"
fi
echo ""

# Check results endpoint
echo "3. Testing GET /api/results/test-job"
RESPONSE=$(curl -s "${BASE_URL}/api/results/test-job" || echo '{"error":"Connection failed"}')
STATUS=$(echo "$RESPONSE" | jq -r '.error // "ok"')
if [ "$STATUS" = "ok" ]; then
  echo "✅ Results endpoint accessible"
else
  echo "⚠️  Results endpoint: $STATUS"
fi
echo ""

# Check orders endpoint
echo "4. Testing GET /api/orders"
RESPONSE=$(curl -s "${BASE_URL}/api/orders" || echo '{"error":"Connection failed"}')
STATUS=$(echo "$RESPONSE" | jq -r '.error // "ok"')
if [ "$STATUS" = "ok" ]; then
  echo "✅ Orders endpoint accessible"
else
  echo "⚠️  Orders endpoint: $STATUS"
fi
echo ""

echo "✅ Health check complete"

