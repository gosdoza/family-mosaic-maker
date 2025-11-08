import type { Metadata } from "next"

// Default metadata for results page
// Dynamic metadata is updated client-side in the page component
export const metadata: Metadata = {
  title: "Family Mosaic · Results",
  description: "AI-generated family photo — HD download after purchase.",
  openGraph: {
    title: "Family Mosaic · Results",
    description: "AI-generated family photo — HD download after purchase.",
    images: [
      {
        url: "/og-placeholder.jpg", // Branded placeholder
        width: 1200,
        height: 630,
        alt: "Family Mosaic Result",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Family Mosaic · Results",
    description: "AI-generated family photo — HD download after purchase.",
    images: ["/og-placeholder.jpg"],
  },
}

export default function ResultsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

