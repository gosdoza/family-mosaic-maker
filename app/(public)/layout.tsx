import type { Metadata } from "next"
import { generateSEOMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = generateSEOMetadata({
  title: "Family Mosaic Maker - Turn Memories Into Family Moments",
  description: "Transform single portraits into beautiful full family photos using the magic of generative AI",
  canonical: "/",
  ogImage: "/og?title=Family%20Mosaic%20Maker&description=Turn%20Memories%20Into%20Family%20Moments",
})

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}



