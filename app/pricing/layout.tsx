import type { Metadata } from "next"
import { generateSEOMetadata } from "@/lib/seo/metadata"

export const metadata: Metadata = generateSEOMetadata({
  title: "Pricing - Family Mosaic Maker",
  description: "Choose your plan: Free tier for testing or Premium for HD downloads and commercial use.",
  canonical: "/pricing",
  ogImage: "/og?title=Pricing&description=Choose%20your%20plan%20for%20Family%20Mosaic%20Maker",
})

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}



