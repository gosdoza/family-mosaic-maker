import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// 驗證 Cron Secret（可選，用於安全驗證）
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * GET /api/cron/retention
 * 
 * Edge Cron 觸發的 Retention 清理任務
 * 
 * 驗證: 可選的 CRON_SECRET 驗證
 */
export async function GET(request: Request) {
  try {
    // 可選的 Cron Secret 驗證
    if (CRON_SECRET) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // 執行清理任務（這裡調用清理邏輯）
    // 注意: 實際清理邏輯應該在 scripts/retention/cleanup.mjs 中
    // 這裡可以調用該腳本或直接執行清理邏輯
    
    const result = {
      ok: true,
      time: new Date().toISOString(),
      message: "Retention cleanup triggered",
      note: "Actual cleanup should be executed via scripts/retention/cleanup.mjs",
    };

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Retention cron error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}



