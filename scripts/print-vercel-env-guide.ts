#!/usr/bin/env tsx

/**
 * Print Vercel Environment Variables Setup Guide
 * 
 * Usage: pnpm env:guide
 */

console.log(`
╔════════════════════════════════════════════════════════════════╗
║  Vercel Environment Variables Setup Guide                    ║
╚════════════════════════════════════════════════════════════════╝

📋 STEP 1: Navigate to Vercel Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Go to: https://vercel.com/dashboard
2. Select project: family-mosaic-maker
3. Click: Settings → Environment Variables

📝 STEP 2: Add Environment Variables
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each variable, click "Add New" and fill in:

┌─────────────────────────────────────────────────────────────┐
│ PREVIEW ENVIRONMENT                                          │
└─────────────────────────────────────────────────────────────┘

✅ NEXT_PUBLIC_SUPABASE_URL
   Value: https://your-project.supabase.co
   Environments: ✅ Preview

✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: your-anon-key
   Environments: ✅ Preview

✅ NEXT_PUBLIC_USE_MOCK
   Value: true
   Environments: ✅ Preview

⚠️  DOMAIN (optional)
   Value: family-mosaic-maker.vercel.app
   Environments: ✅ Preview

⚠️  PAYPAL_CLIENT_ID (optional)
   Value: your-paypal-client-id
   Environments: ✅ Preview

⚠️  PAYPAL_CLIENT_SECRET (optional)
   Value: your-paypal-client-secret
   Environments: ✅ Preview

┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION ENVIRONMENT                                       │
└─────────────────────────────────────────────────────────────┘

✅ NEXT_PUBLIC_SUPABASE_URL
   Value: https://your-project.supabase.co
   Environments: ✅ Production

✅ NEXT_PUBLIC_SUPABASE_ANON_KEY
   Value: your-anon-key
   Environments: ✅ Production

✅ NEXT_PUBLIC_USE_MOCK
   Value: false
   Environments: ✅ Production

⚠️  DOMAIN (optional)
   Value: family-mosaic-maker.vercel.app
   Environments: ✅ Production

✅ PAYPAL_CLIENT_ID
   Value: your-paypal-client-id
   Environments: ✅ Production

✅ PAYPAL_CLIENT_SECRET
   Value: your-paypal-client-secret
   Environments: ✅ Production

🚀 STEP 3: Redeploy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After adding all variables, redeploy:

Preview:
  $ pnpm vercel:preview:redeploy

Production:
  $ pnpm vercel:prod:redeploy

Or manually:
  1. Go to Deployments tab
  2. Click ⋯ on latest deployment
  3. Click Redeploy

✅ STEP 4: Verify
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Health check:
  $ curl https://family-mosaic-maker.vercel.app/api/health

Should return: {"ok":true,"time":"..."}

📚 Documentation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Full guide: docs/deploy/env-checklist.md

⚠️  Security Reminder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Never commit real secrets to Git!
- Use .env.preview.example and .env.production.example as templates
- Only store actual values in Vercel Dashboard
- Keep .env.local in .gitignore

`);

