# Migration Guide

This guide helps you migrate from mock mode to production with real APIs.

## 1. Environment Variables

Update your `.env.local` (or Vercel environment variables):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Runware API (for image generation)
RUNWARE_API_KEY=your_runware_api_key

# PayPal
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret

# Sentry (optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn

# Disable mock mode
NEXT_PUBLIC_USE_MOCK=false
```

## 2. Database Setup

1. Create the database schema (see `docs/database-schema.md`)
2. Enable Row Level Security (RLS) on all tables
3. Set up RLS policies for user access

## 3. API Integration

### Runware API Integration

Update `/app/api/generate/route.ts` to call Runware API:

```typescript
// Example Runware API call
const response = await fetch('https://api.runware.com/v1/generate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.RUNWARE_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    files: uploadedFiles,
    style,
    template,
  }),
})
const { jobId } = await response.json()
```

### PayPal Integration

Update `/app/api/payments/create/route.ts` to create PayPal orders:

```typescript
// Example PayPal API call
const response = await fetch('https://api-m.sandbox.paypal.com/v2/checkout/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${paypalAccessToken}`,
  },
  body: JSON.stringify({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: 'USD',
        value: amount.toString(),
      },
    }],
  }),
})
```

## 4. Testing

1. **Local Testing**:
   ```bash
   NEXT_PUBLIC_USE_MOCK=false pnpm dev
   pnpm check:api
   ```

2. **E2E Testing**:
   ```bash
   NEXT_PUBLIC_USE_MOCK=true pnpm test:e2e
   ```

3. **Health Check**:
   ```bash
   pnpm health:check
   ```

## 5. Deployment Checklist

- [ ] Set `NEXT_PUBLIC_USE_MOCK=false` in production
- [ ] Configure all environment variables in Vercel
- [ ] Set up database schema and RLS policies
- [ ] Test API endpoints with real credentials
- [ ] Configure PayPal webhook URL
- [ ] Set up Sentry monitoring
- [ ] Run health check on preview deployment
- [ ] Monitor error logs after deployment

