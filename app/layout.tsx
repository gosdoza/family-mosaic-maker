import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import Script from "next/script"
import { Toaster } from "@/components/ui/toaster"
import { CookieBanner } from "@/components/cmp/cookie-banner"
import { ConditionalAnalytics } from "@/components/cmp/conditional-analytics"
import "./globals.css"
import "../styles/theme.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

import { generateSEOMetadata } from "@/lib/seo/metadata"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://example.com"

const baseMetadata = generateSEOMetadata({
  title: "Family Mosaic Maker - Turn Memories Into Family Moments",
  description: "Transform single portraits into beautiful full family photos using the magic of generative AI",
  ogImage: `${BASE_URL}/og?title=Family%20Mosaic%20Maker&description=Turn%20Memories%20Into%20Family%20Moments`,
  canonical: BASE_URL,
})

export const metadata: Metadata = {
  ...baseMetadata,
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
  alternates: {
    canonical: baseMetadata.canonical,
    languages: {
      en: baseMetadata.canonical,
      "zh-CN": `${baseMetadata.canonical}/zh`,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <ConditionalAnalytics />
      <body className={`font-sans antialiased`}>
        {children}
        <Toaster />
        <Analytics />
        <CookieBanner />
      </body>
    </html>
  )
}
