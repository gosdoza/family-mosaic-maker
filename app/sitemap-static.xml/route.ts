/**
 * GET /sitemap-static.xml
 * 
 * 静态页面 sitemap（带 hreflang）
 */

import { NextRequest, NextResponse } from "next/server"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : "https://example.com")

export const dynamic = "force-dynamic"
export const revalidate = 3600

function generateSitemapXML(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>`
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date().toISOString().split("T")[0]

    const pages = [
      { path: "/", priority: 1.0, changefreq: "daily" },
      { path: "/generate", priority: 0.9, changefreq: "daily" },
      { path: "/pricing", priority: 0.8, changefreq: "weekly" },
      { path: "/help", priority: 0.7, changefreq: "monthly" },
    ]

    const urls = pages.map((page) => {
      const enPath = page.path
      const zhPath = `/zh${page.path}`

      return `  <url>
    <loc>${BASE_URL}${enPath}</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${BASE_URL}${enPath}" />
    <xhtml:link rel="alternate" hreflang="zh" href="${BASE_URL}${zhPath}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${enPath}" />
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
    })

    const xml = generateSitemapXML(urls)

    return new NextResponse(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    })
  } catch (error) {
    console.error("Error generating static sitemap:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

