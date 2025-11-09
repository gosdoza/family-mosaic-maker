# Family Mosaic Maker

A Next.js application for creating beautiful family mosaics.

## Getting Started

1. Copy `.env.local.example` to `.env.local` and fill in your environment variables
2. Install dependencies: `pnpm install`
3. Run the development server: `pnpm dev`

## Vercel Env

### Environment Variables Configuration

When deploying to Vercel, configure the following environment variables:

#### Mock Mode

- **Preview**: Set `NEXT_PUBLIC_USE_MOCK=true` for preview deployments (allows testing without real API integrations)
- **Production**: Set `NEXT_PUBLIC_USE_MOCK=false` for production deployments (requires real API credentials)

#### Supabase Configuration

Configure Supabase Redirect URLs in your Supabase Dashboard:

- Add `{DOMAIN}/auth/callback` to allowed redirect URLs
- Add `{DOMAIN}/auth/*` to allowed redirect URLs

Where `{DOMAIN}` is your Vercel deployment URL (e.g., `https://your-app.vercel.app`)

**📚 Full Guide:** See [Supabase Auth URL Configuration](./docs/deploy/supabase-auth-urls.md) for detailed setup instructions.

### Required Environment Variables

See `.env.local.example` for the complete list of required environment variables.

## Authentication

### Local Verification

Before deploying, verify that the authentication callback route works locally:

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

### Supabase Configuration

**📚 Complete Guide:** See [Supabase Auth URL Configuration Guide](./docs/deploy/supabase-auth-urls.md) for:
- Step-by-step Supabase Dashboard configuration
- Development, Preview, and Production URL setup
- Troubleshooting tips
- Quick reference checklist

**Quick Setup Checklist:**
- [ ] Site URL set to `http://localhost:3000` (for development)
- [ ] `http://localhost:3000/auth/callback` added to Redirect URLs
- [ ] Preview domain pattern added: `https://family-mosaic-maker-*.vercel.app/auth/callback`
- [ ] Production domain added when ready: `https://family-mosaic-maker.vercel.app/auth/callback`

