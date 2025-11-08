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

### Required Environment Variables

See `.env.local.example` for the complete list of required environment variables.

