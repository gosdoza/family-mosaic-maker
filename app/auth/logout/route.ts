import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { redirect } from "next/navigation"

/**
 * Logout Route - Server Route Handler
 * 
 * 行為：
 * - 清除 Supabase session（包括所有 cookies）
 * - Redirect 到首頁 (/)
 * 
 * 使用方式：
 * - GET /auth/logout
 * - 或 <Link href="/auth/logout">Sign out</Link>
 */
export async function GET(request: NextRequest) {
  try {
    // 取得 Supabase server client
    const supabase = await createClient()

    // 清除 session（會自動清除所有相關 cookies）
    await supabase.auth.signOut()

    // Redirect 到首頁
    return NextResponse.redirect(new URL("/", request.url), { status: 302 })
  } catch (error) {
    // 即使登出失敗，也 redirect 到首頁（避免卡在錯誤狀態）
    console.error("Logout error:", error)
    return NextResponse.redirect(new URL("/", request.url), { status: 302 })
  }
}

