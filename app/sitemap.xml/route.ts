/**
 * GET /sitemap.xml
 * 
 * 生成分片 sitemap
 * 
 * 支持多语言（EN/ZH）和分片 sitemap
 */

import { NextRequest, NextResponse } from "next/server"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : "https://example.com")
const MAX_URLS_PER_SITEMAP = 50000 // Google 推荐的最大值

export const dynamic = "force-dynamic"
export const revalidate = 3600 // 每小时重新生成

/**
 * 获取所有静态页面
 */
function getStaticPages(): Array<{ path: string; priority: number; changefreq: string }> {
  return [
    { path: "/", priority: 1.0, changefreq: "daily" },
    { path: "/generate", priority: 0.9, changefreq: "daily" },
    { path: "/pricing", priority: 0.8, changefreq: "weekly" },
    { path: "/help", priority: 0.7, changefreq: "monthly" },
    { path: "/auth/login", priority: 0.6, changefreq: "monthly" },
  ]
}

/**
 * 获取所有语言版本的页面
 */
function getLocalizedPages(): Array<{ path: string; lang: string; priority: number; changefreq: string }> {
  const staticPages = getStaticPages()
  const languages = ["en", "zh"]

  return staticPages.flatMap((page) =>
    languages.map((lang) => ({
      ...page,
      lang,
      path: lang === "en" ? page.path : `/${lang}${page.path}`,
    }))
  )
}

/**
 * 生成 sitemap XML
 */
function generateSitemapXML(urls: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: number }>): string {
  const urlEntries = urls
    .map(
      (url) => `  <url>
    <loc>${url.loc}</loc>
    ${url.lastmod ? `<lastmod>${url.lastmod}</lastmod>` : ""}
    ${url.changefreq ? `<changefreq>${url.changefreq}</changefreq>` : ""}
    ${url.priority ? `<priority>${url.priority}</priority>` : ""}
  </url>`
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urlEntries}
</urlset>`
}

/**
 * 生成 sitemap index XML
 */
function generateSitemapIndexXML(sitemaps: Array<{ loc: string; lastmod?: string }>): string {
  const sitemapEntries = sitemaps
    .map(
      (sitemap) => `  <sitemap>
    <loc>${sitemap.loc}</loc>
    ${sitemap.lastmod ? `<lastmod>${sitemap.lastmod}</lastmod>` : ""}
  </sitemap>`
    )
    .join("\n")

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`
}

/**
 * 生成带 hreflang 的 URL
 */
function generateURLWithHreflang(
  path: string,
  priority: number,
  changefreq: string,
  lastmod?: string
): string {
  const languages = [
    { code: "en", path: path.startsWith("/zh") ? path.replace("/zh", "") : path },
    { code: "zh", path: path.startsWith("/zh") ? path : `/zh${path}` },
  ]

  const urlEntries = languages
    .map(
      (lang) => `    <xhtml:link rel="alternate" hreflang="${lang.code}" href="${BASE_URL}${lang.path}" />`
    )
    .join("\n")

  const defaultPath = path.startsWith("/zh") ? path.replace("/zh", "") : path

  return `  <url>
    <loc>${BASE_URL}${defaultPath}</loc>
    ${urlEntries}
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

/**
 * GET /sitemap.xml
 * 
 * 返回主 sitemap index 或分片 sitemap
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const pathname = url.pathname

    // 如果是 sitemap.xml，返回 sitemap index
    if (pathname === "/sitemap.xml") {
      const now = new Date().toISOString().split("T")[0]

      // 生成分片 sitemap 列表
      const sitemaps = [
        { loc: `${BASE_URL}/sitemap-static.xml`, lastmod: now },
        { loc: `${BASE_URL}/sitemap-pages.xml`, lastmod: now },
      ]

      const xml = generateSitemapIndexXML(sitemaps)

      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      })
    }

    // 如果是 sitemap-static.xml，返回静态页面
    if (pathname === "/sitemap-static.xml") {
      const now = new Date().toISOString().split("T")[0]
      const localizedPages = getLocalizedPages()

      const urls = localizedPages.map((page) => ({
        loc: `${BASE_URL}${page.path}`,
        lastmod: now,
        changefreq: page.changefreq,
        priority: page.priority,
      }))

      const xml = generateSitemapXML(urls)

      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      })
    }

    // 如果是 sitemap-pages.xml，返回动态页面（如果有）
    if (pathname === "/sitemap-pages.xml") {
      const now = new Date().toISOString().split("T")[0]

      // 这里可以添加动态页面（如结果页）
      // 目前返回空 sitemap
      const urls: Array<{ loc: string; lastmod: string; changefreq: string; priority: number }> = []

      const xml = generateSitemapXML(urls)

      return new NextResponse(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      })
    }

    return new NextResponse("Not Found", { status: 404 })
  } catch (error) {
    console.error("Error generating sitemap:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}

