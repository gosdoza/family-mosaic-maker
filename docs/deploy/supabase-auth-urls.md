# Supabase Auth URL Configuration Guide

This guide explains how to configure Supabase authentication URLs for local development, preview deployments, and production.

## Overview

Supabase requires you to configure allowed redirect URLs in the Supabase Dashboard. This ensures that authentication callbacks only work from trusted domains.

## Configuration Steps

### 1. Navigate to Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on **Authentication** in the left sidebar
4. Click on **URL Configuration** (or **Settings** → **Auth** → **URL Configuration**)

### 2. Configure Site URL

**For Development:**
- **Site URL**: `http://localhost:3000`

**For Production (when ready):**
- **Site URL**: `https://family-mosaic-maker.vercel.app` (or your custom domain)

### 3. Configure Redirect URLs (Allow List)

Add the following URLs to the **Redirect URLs** list:

#### Development
- ✅ `http://localhost:3000`
- ✅ `http://localhost:3000/auth/callback`

#### Preview Deployments
- ✅ `https://family-mosaic-maker-*.vercel.app/auth/callback`
- ✅ `https://family-mosaic-maker-*.vercel.app/*`

**Note:** The `*` wildcard matches any preview deployment URL (e.g., `https://family-mosaic-maker-abc123.vercel.app`)

#### Production (when ready)
- ✅ `https://family-mosaic-maker.vercel.app/auth/callback`
- ✅ `https://family-mosaic-maker.vercel.app/*`
- ✅ `https://your-custom-domain.com/auth/callback` (if using custom domain)

### 4. Complete Configuration Checklist

Use this checklist to ensure all URLs are configured:

- [ ] Site URL set to `http://localhost:3000` (for development)
- [ ] `http://localhost:3000` added to Redirect URLs
- [ ] `http://localhost:3000/auth/callback` added to Redirect URLs
- [ ] Preview domain pattern added: `https://family-mosaic-maker-*.vercel.app/auth/callback`
- [ ] Production domain added: `https://family-mosaic-maker.vercel.app/auth/callback` (when ready)
- [ ] Custom domain added (if applicable)

## Screenshots Reference

### Screenshot 1: Authentication Settings Location
**Where to find:** Supabase Dashboard → Your Project → Authentication → URL Configuration

```
[Placeholder: Screenshot showing Supabase Dashboard navigation to Auth settings]
```

### Screenshot 2: Site URL Configuration
**What to set:** Site URL field with `http://localhost:3000` (for dev) or production domain

```
[Placeholder: Screenshot showing Site URL input field]
```

### Screenshot 3: Redirect URLs List
**What to add:** Redirect URLs list with all allowed callback URLs

```
[Placeholder: Screenshot showing Redirect URLs list with multiple entries]
```

## Switching from Development to Production

When you're ready to deploy to production:

1. **Update Site URL:**
   - Change from `http://localhost:3000` to `https://family-mosaic-maker.vercel.app`

2. **Keep Preview URLs:**
   - Keep preview deployment URLs in the Redirect URLs list
   - This allows both preview and production deployments to work

3. **Add Production URLs:**
   - Add `https://family-mosaic-maker.vercel.app/auth/callback` to Redirect URLs
   - Add your custom domain if applicable

## Local Verification

Before deploying, verify that the callback route works locally:

1. Start the development server:
   ```bash
   pnpm dev
   ```

2. Open the callback page in your browser:
   ```
   http://localhost:3000/auth/callback?code=dev-ok
   ```

3. You should see a "Callback OK" page with the code parameter displayed.

4. If the page renders correctly, the route is configured properly.

## Troubleshooting

### Callback Returns 404

- Verify that `/app/auth/callback/page.tsx` exists
- Check that the route is not blocked by middleware
- Ensure the URL matches exactly (case-sensitive)

### "Invalid redirect URL" Error

- Check that the exact URL is in the Supabase Redirect URLs list
- Ensure there are no trailing slashes or extra parameters
- Verify the URL matches exactly what Supabase is redirecting to

### Authentication Not Working in Preview

- Ensure preview domain pattern is in Redirect URLs: `https://family-mosaic-maker-*.vercel.app/auth/callback`
- Check that environment variables are set correctly in Vercel
- Verify that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured

## Related Documentation

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Vercel Environment Variables Guide](./env-checklist.md)
- [Local Development Setup](../../README.md#auth)

## Quick Reference

**Supabase Dashboard Path:**
```
Dashboard → Your Project → Authentication → URL Configuration
```

**Required URLs for Development:**
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000`, `http://localhost:3000/auth/callback`

**Required URLs for Production:**
- Site URL: `https://family-mosaic-maker.vercel.app`
- Redirect URLs: `https://family-mosaic-maker.vercel.app/auth/callback`, `https://family-mosaic-maker-*.vercel.app/auth/callback`

