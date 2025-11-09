# Vercel Environment Variables Checklist

This document provides step-by-step instructions for setting up environment variables in Vercel Dashboard for both Preview and Production environments.

## Environment Variables

### Preview Environment

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | ✅ Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | ✅ Yes | Your Supabase anonymous key |
| `DOMAIN` | `family-mosaic-maker.vercel.app` | ⚠️ Optional | Your Vercel domain |
| `NEXT_PUBLIC_USE_MOCK` | `true` | ✅ Yes | Enable mock mode for preview |
| `PAYPAL_CLIENT_ID` | `your-paypal-client-id` | ⚠️ Optional | PayPal client ID for testing |
| `PAYPAL_CLIENT_SECRET` | `your-paypal-client-secret` | ⚠️ Optional | PayPal client secret for testing |

### Production Environment

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` | ✅ Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` | ✅ Yes | Your Supabase anonymous key |
| `DOMAIN` | `family-mosaic-maker.vercel.app` | ⚠️ Optional | Your production domain |
| `NEXT_PUBLIC_USE_MOCK` | `false` | ✅ Yes | Disable mock mode for production |
| `PAYPAL_CLIENT_ID` | `your-paypal-client-id` | ✅ Yes | PayPal client ID for production |
| `PAYPAL_CLIENT_SECRET` | `your-paypal-client-secret` | ✅ Yes | PayPal client secret for production |

## Step-by-Step: Setting Environment Variables in Vercel Dashboard

### 1. Navigate to Project Settings

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project: **family-mosaic-maker**
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar

### 2. Add Environment Variables

For each variable:

1. Click **Add New** button
2. Enter the **Name** (e.g., `NEXT_PUBLIC_SUPABASE_URL`)
3. Enter the **Value** (your actual value)
4. Select the **Environment(s)**:
   - ✅ **Preview** (for preview deployments)
   - ✅ **Production** (for production deployments)
   - ⚠️ **Development** (optional, for local development)
5. Click **Save**

### 3. Repeat for All Variables

Add all required variables from the tables above:

- `NEXT_PUBLIC_SUPABASE_URL` (Preview + Production)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Preview + Production)
- `DOMAIN` (Preview + Production, optional)
- `NEXT_PUBLIC_USE_MOCK` (Preview: `true`, Production: `false`)
- `PAYPAL_CLIENT_ID` (Preview + Production, optional for preview)
- `PAYPAL_CLIENT_SECRET` (Preview + Production, optional for preview)

### 4. Redeploy After Adding Variables

After adding environment variables, you need to redeploy:

**For Preview:**
```bash
pnpm vercel:preview:redeploy
```

**For Production:**
```bash
pnpm vercel:prod:redeploy
```

Or manually trigger a redeploy from Vercel Dashboard:
1. Go to **Deployments** tab
2. Click the **⋯** (three dots) on the latest deployment
3. Click **Redeploy**

## Quick Reference

### Copy-Paste Steps

1. **Vercel Dashboard** → **family-mosaic-maker** → **Settings** → **Environment Variables**
2. Click **Add New**
3. Name: `NEXT_PUBLIC_SUPABASE_URL`, Value: `https://your-project.supabase.co`, Environments: ✅ Preview ✅ Production
4. Click **Save**
5. Repeat for all variables
6. Redeploy: `pnpm vercel:preview:redeploy` or `pnpm vercel:prod:redeploy`

## Verification

After setting environment variables and redeploying, verify:

1. **Health Check:**
   ```bash
   curl https://family-mosaic-maker.vercel.app/api/health
   ```
   Should return: `{"ok":true,"time":"..."}`

2. **Check Environment:**
   - Preview deployments should have `NEXT_PUBLIC_USE_MOCK=true`
   - Production deployments should have `NEXT_PUBLIC_USE_MOCK=false`

## Security Notes

⚠️ **Never commit real secrets to Git!**

- Use `.env.preview.example` and `.env.production.example` as templates
- Only store actual values in Vercel Dashboard
- Keep `.env.local` in `.gitignore`

## Troubleshooting

### Variables Not Working?

1. **Check Environment Selection:** Ensure variables are set for the correct environment (Preview/Production)
2. **Redeploy:** Environment variables only take effect after redeployment
3. **Check Variable Names:** Ensure exact spelling (case-sensitive)
4. **Check Build Logs:** Look for errors in Vercel deployment logs

### Health Endpoint Returns 404?

1. Verify `/app/api/health/route.ts` exists
2. Check deployment logs for build errors
3. Wait a few minutes for deployment to propagate
4. Try accessing the preview URL directly

## Related Files

- `.env.preview.example` - Preview environment template
- `.env.production.example` - Production environment template
- `scripts/print-vercel-env-guide.ts` - Automated guide script
- `app/api/health/route.ts` - Health check endpoint

