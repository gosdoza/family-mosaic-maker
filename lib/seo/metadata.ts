/**
 * SEO Metadata Helper
 * 
 * 生成 SEO 元数据，包括：
 * - canonical URL
 * - hreflang 标签
 * - Open Graph 标签
 * - Twitter Card 标签
 */

export interface SEOConfig {
  title: string
  description: string
  canonical?: string
  ogImage?: string
  ogType?: string
  locale?: string
  alternateLocales?: Array<{ lang: string; url: string }>
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://example.com"

/**
 * 生成 canonical URL
 */
export function getCanonicalURL(path: string): string {
  // 移除语言前缀（/zh）以生成 canonical URL
  const cleanPath = path.startsWith("/zh") ? path.replace("/zh", "") : path
  return `${BASE_URL}${cleanPath}`
}

/**
 * 生成 hreflang 标签
 */
export function generateHreflangTags(path: string): Array<{ rel: string; hreflang: string; href: string }> {
  const cleanPath = path.startsWith("/zh") ? path.replace("/zh", "") : path
  const enUrl = `${BASE_URL}${cleanPath}`
  const zhUrl = `${BASE_URL}/zh${cleanPath}`

  return [
    { rel: "alternate", hreflang: "en", href: enUrl },
    { rel: "alternate", hreflang: "zh", href: zhUrl },
    { rel: "alternate", hreflang: "x-default", href: enUrl },
  ]
}

/**
 * 生成 SEO 元数据
 */
export function generateSEOMetadata(config: SEOConfig) {
  // 处理 canonical URL
  let canonical: string
  if (config.canonical) {
    canonical = config.canonical.startsWith("http") 
      ? config.canonical 
      : `${BASE_URL}${config.canonical.startsWith("/") ? config.canonical : `/${config.canonical}`}`
  } else {
    canonical = typeof window !== "undefined" 
      ? getCanonicalURL(window.location.pathname) 
      : BASE_URL
  }

  const ogImage = config.ogImage || `${BASE_URL}/og?title=${encodeURIComponent(config.title)}&description=${encodeURIComponent(config.description)}`
  const ogType = config.ogType || "website"
  const locale = config.locale || "en_US"

  // 生成 hreflang 标签
  const hreflangTags = config.alternateLocales || generateHreflangTags(canonical)

  return {
    title: config.title,
    description: config.description,
    canonical,
    openGraph: {
      title: config.title,
      description: config.description,
      url: canonical,
      siteName: "Family Mosaic Maker",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: config.title,
        },
      ],
      locale,
      type: ogType,
      alternateLocales: hreflangTags.map((tag) => tag.href),
    },
    twitter: {
      card: "summary_large_image",
      title: config.title,
      description: config.description,
      images: [ogImage],
    },
  }
}

