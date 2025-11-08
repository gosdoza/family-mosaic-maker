import { withSentryConfig } from "@sentry/nextjs"

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    // ⚠️ 關鍵：避免 build 預渲染 global-error
    appDir: true,
    turbo: {
      resolveAlias: {
        '@/_global-error': false,
      },
    },
    instrumentationHook: true,
  },
}

// Wrap with Sentry config (only if DSN is set)
const sentryConfig = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      // For all available options, see:
      // https://github.com/getsentry/sentry-webpack-plugin#options

      // Suppresses source file uploading in CI
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    })
  : nextConfig

export default sentryConfig
