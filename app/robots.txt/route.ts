/**
 * GET /robots.txt
 * 
 * 生成 robots.txt
 */

import { NextRequest, NextResponse } from "next/server"

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}` 
  : "https://example.com")

export const dynamic = "force-dynamic"
export const revalidate = 86400 // 每天重新生成

export async function GET(request: NextRequest) {
  const robotsTxt = `User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/
Disallow: /_next/
Disallow: /admin/

Sitemap: ${BASE_URL}/sitemap.xml
`

  return new NextResponse(robotsTxt, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  })
}

