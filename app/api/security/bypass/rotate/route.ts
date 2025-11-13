/**
 * POST /api/security/bypass/rotate
 * 
 * 輪替 Preview 的 bypass key
 * - 生成新的 bypass key
 * - 標註舊鍵註銷時間
 * - 返回新鍵
 */

import { NextRequest, NextResponse } from "next/server"
import { generateBypassKey, getAllBypassKeys } from "@/lib/security/bypass-rotation"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // 驗證請求者是否有權限（例如：檢查 service role key）
    const authHeader = request.headers.get("Authorization")
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // 獲取環境參數（默認為 preview）
    const body = await request.json().catch(() => ({}))
    const environment = (body.environment || "preview") as "preview" | "production"

    // 獲取舊的 bypass keys（用於記錄）
    const oldKeys = await getAllBypassKeys(environment)

    // 生成新的 bypass key
    const newKey = await generateBypassKey(environment)

    // 獲取更新後的 bypass keys
    const allKeys = await getAllBypassKeys(environment)

    return NextResponse.json({
      success: true,
      environment,
      new_key: newKey,
      old_keys: oldKeys.map((key) => ({
        id: key.id,
        status: key.status,
        created_at: key.created_at,
        revoked_at: key.revoked_at,
      })),
      all_keys: allKeys.map((key) => ({
        id: key.id,
        status: key.status,
        created_at: key.created_at,
        revoked_at: key.revoked_at,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("Error rotating bypass key:", error)
    return NextResponse.json(
      { error: "Failed to rotate bypass key", message: error.message },
      { status: 500 }
    )
  }
}



