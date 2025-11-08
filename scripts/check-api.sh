#!/bin/bash

# Script to check API endpoints when mock is disabled
# Usage: ./scripts/check-api.sh

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "🔍 Checking API endpoints (mock disabled)..."
echo ""

# Check generate endpoint
echo "1. Testing POST /api/generate"
RESPONSE=$(curl -s -X POST "${BASE_URL}/api/generate" \
  -H "Content-Type: application/json" \
  -d '{}' || echo '{"error":"Connection failed"}')
echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
JOB_ID=$(echo "$RESPONSE" | jq -r '.jobId // empty')
echo ""

if [ -z "$JOB_ID" ] || [ "$JOB_ID" = "null" ]; then
  echo "⚠️  Warning: No jobId returned. This is expected if mock is disabled and API is not fully implemented."
  JOB_ID="demo-001"
fi

# Check progress endpoint
echo "2. Testing GET /api/progress/${JOB_ID}"
curl -s "${BASE_URL}/api/progress/${JOB_ID}" | jq '.' || echo "Failed to fetch progress"
echo ""

# Check results endpoint
echo "3. Testing GET /api/results/${JOB_ID}"
RESPONSE=$(curl -s "${BASE_URL}/api/results/${JOB_ID}")
echo "$RESPONSE" | jq '.' || echo "$RESPONSE"
echo ""

# Validate results format
echo "4. Validating results format..."
HAS_JOB_ID=$(echo "$RESPONSE" | jq -r 'has("jobId")')
HAS_IMAGES=$(echo "$RESPONSE" | jq -r 'has("images")')
HAS_PAYMENT_STATUS=$(echo "$RESPONSE" | jq -r 'has("paymentStatus")')
HAS_CREATED_AT=$(echo "$RESPONSE" | jq -r 'has("createdAt")')

if [ "$HAS_JOB_ID" = "true" ] && [ "$HAS_IMAGES" = "true" ] && [ "$HAS_PAYMENT_STATUS" = "true" ] && [ "$HAS_CREATED_AT" = "true" ]; then
  echo "✅ Results API format is correct: { jobId, images, paymentStatus, createdAt }"
else
  echo "❌ Results API format is missing required fields"
  echo "   Expected: { jobId, images, paymentStatus, createdAt }"
fi

