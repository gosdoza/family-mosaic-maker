import type { Metadata } from "next"
import { generateSEOMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = generateSEOMetadata({
  title: "Generate Family Mosaic - Family Mosaic Maker",
  description: "Create beautiful AI-generated family photos from single portraits. Choose your style and template.",
  canonical: "/generate",
  ogImage: "/og?title=Generate%20Family%20Mosaic&description=Create%20beautiful%20AI-generated%20family%20photos",
})

export default function GenerateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}



