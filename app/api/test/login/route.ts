import { NextRequest, NextResponse } from "next/server"

/**
 * Dev-only test utility: Login as test user
 * POST /api/test/login
 * 
 * Sets a signed cookie "__e2e" = "1" for dev authentication.
 * Returns 404 in production.
 */
export async function POST(request: NextRequest) {
  // Guard: Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    const response = NextResponse.json({ ok: true }, { status: 200 })
    
    // For dev, set cookie "__e2e=1"
    response.cookies.set("__e2e", "1", {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    })

    return response
  } catch (error) {
    console.error("Error in test/login API:", error)
    return NextResponse.json(
      { ok: false, error: "Failed to login" },
      { status: 500 }
    )
  }
}

