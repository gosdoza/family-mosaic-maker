/**
 * GA4 Report Exporter
 * 
 * 每日自动导出 GA4 报表至 analytics_logs（type='ga_report'）
 * 
 * 使用 Google Analytics Data API 获取报表数据
 */

import { createClient } from "@supabase/supabase-js"

const GA4_PROPERTY_ID = process.env.GA4_PROPERTY_ID
const GA4_CLIENT_EMAIL = process.env.GA4_CLIENT_EMAIL
const GA4_PRIVATE_KEY = process.env.GA4_PRIVATE_KEY

/**
 * 获取 GA4 访问令牌（使用 Service Account）
 */
async function getGA4AccessToken(): Promise<string | null> {
  if (!GA4_CLIENT_EMAIL || !GA4_PRIVATE_KEY) {
    console.warn("[GA4] Missing GA4 credentials")
    return null
  }

  try {
    // 使用 Node.js crypto 模块创建 JWT
    const crypto = await import("crypto")
    const now = Math.floor(Date.now() / 1000)

    const header = {
      alg: "RS256",
      typ: "JWT",
    }

    const payload = {
      iss: GA4_CLIENT_EMAIL,
      sub: GA4_CLIENT_EMAIL,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600, // 1 hour
      iat: now,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
    }

    // Base64URL 编码
    const base64UrlEncode = (str: string) => {
      return Buffer.from(str)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "")
    }

    const headerB64 = base64UrlEncode(JSON.stringify(header))
    const payloadB64 = base64UrlEncode(JSON.stringify(payload))

    // 签名
    const privateKey = GA4_PRIVATE_KEY.replace(/\\n/g, "\n")
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(`${headerB64}.${payloadB64}`)
      .sign(privateKey, "base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "")

    const token = `${headerB64}.${payloadB64}.${signature}`

    // 获取访问令牌
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[GA4] Failed to get access token:", errorText)
      return null
    }

    const data = await response.json()
    return data.access_token || null
  } catch (error) {
    console.error("[GA4] Error getting access token:", error)
    return null
  }
}

/**
 * 获取 GA4 报表数据
 */
async function getGA4Report(
  startDate: string,
  endDate: string
): Promise<any | null> {
  if (!GA4_PROPERTY_ID) {
    console.warn("[GA4] Missing GA4_PROPERTY_ID")
    return null
  }

  const accessToken = await getGA4AccessToken()
  if (!accessToken) {
    return null
  }

  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate,
              endDate,
            },
          ],
          dimensions: [
            { name: "eventName" },
            { name: "date" },
          ],
          metrics: [
            { name: "eventCount" },
            { name: "totalUsers" },
          ],
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("[GA4] Failed to get report:", errorText)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error("[GA4] Error getting report:", error)
    return null
  }
}

/**
 * 导出 GA4 报表到 analytics_logs
 */
export async function exportGA4Report(date?: string): Promise<boolean> {
  try {
    const targetDate = date || new Date().toISOString().split("T")[0] // YYYY-MM-DD
    const startDate = targetDate
    const endDate = targetDate

    // 获取 GA4 报表数据
    const reportData = await getGA4Report(startDate, endDate)
    if (!reportData) {
      console.warn("[GA4] No report data available")
      return false
    }

    // 保存到 analytics_logs
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[GA4] Missing Supabase credentials")
      return false
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // 格式化报表数据
    const report = {
      date: targetDate,
      start_date: startDate,
      end_date: endDate,
      events: reportData.rows?.map((row: any) => ({
        event_name: row.dimensionValues?.[0]?.value,
        date: row.dimensionValues?.[1]?.value,
        event_count: row.metricValues?.[0]?.value,
        total_users: row.metricValues?.[1]?.value,
      })) || [],
      summary: {
        total_events: reportData.totals?.[0]?.metricValues?.[0]?.value || 0,
        total_users: reportData.totals?.[0]?.metricValues?.[1]?.value || 0,
      },
      exported_at: new Date().toISOString(),
    }

    // 插入到 analytics_logs
    const { error } = await supabase.from("analytics_logs").insert({
      event_type: "ga_report",
      event_data: report,
      user_id: null,
      created_at: new Date().toISOString(),
    })

    if (error) {
      console.error("[GA4] Failed to save report:", error)
      return false
    }

    console.log(`[GA4] Report exported for ${targetDate}`)
    return true
  } catch (error) {
    console.error("[GA4] Error exporting report:", error)
    return false
  }
}

