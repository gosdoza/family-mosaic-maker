/**
 * POST /api/analytics/ga4/export
 * 
 * 手动触发 GA4 报表导出
 * 也可以配置为每日自动执行（通过 Vercel Cron）
 */

import { NextRequest, NextResponse } from "next/server"
import { exportGA4Report } from "@/lib/analytics/ga4-report"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const date = body.date || undefined // 可选：指定日期，格式 YYYY-MM-DD

    const success = await exportGA4Report(date)

    if (!success) {
      return NextResponse.json(
        { error: "Failed to export GA4 report", success: false },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "GA4 report exported successfully",
      date: date || new Date().toISOString().split("T")[0],
    })
  } catch (error: any) {
    console.error("Error exporting GA4 report:", error)
    return NextResponse.json(
      { error: "Failed to export GA4 report", message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/analytics/ga4/export
 * 
 * 获取最近的 GA4 报表
 */
export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: "Missing Supabase credentials" },
        { status: 500 }
      )
    }

    const { createClient } = require("@supabase/supabase-js")
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 查询最近的 GA4 报表
    const { data, error } = await supabase
      .from("analytics_logs")
      .select("event_data, created_at")
      .eq("event_type", "ga_report")
      .order("created_at", { ascending: false })
      .limit(10)

    if (error) {
      console.error("Failed to fetch GA4 reports:", error)
      return NextResponse.json(
        { error: "Failed to fetch GA4 reports" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reports: data || [],
      count: data?.length || 0,
    })
  } catch (error: any) {
    console.error("Error fetching GA4 reports:", error)
    return NextResponse.json(
      { error: "Failed to fetch GA4 reports", message: error.message },
      { status: 500 }
    )
  }
}



