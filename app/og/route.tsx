/**
 * GET /og
 * 
 * 动态生成 OG 图片
 * 
 * 使用 Next.js ImageResponse API 生成 OG 图片
 */

import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"

export const runtime = "edge"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const title = searchParams.get("title") || "Family Mosaic Maker"
    const description = searchParams.get("description") || "Turn Memories Into Family Moments"

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0a0a",
            backgroundImage: "linear-gradient(to bottom, #1a1a1a, #0a0a0a)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "80px",
              maxWidth: "1200px",
            }}
          >
            <h1
              style={{
                fontSize: "72px",
                fontWeight: "bold",
                color: "#ffffff",
                marginBottom: "24px",
                textAlign: "center",
                lineHeight: "1.2",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                fontSize: "32px",
                color: "#a0a0a0",
                textAlign: "center",
                lineHeight: "1.5",
                maxWidth: "900px",
              }}
            >
              {description}
            </p>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    )
  } catch (error) {
    console.error("Error generating OG image:", error)
    return new Response("Failed to generate OG image", { status: 500 })
  }
}



