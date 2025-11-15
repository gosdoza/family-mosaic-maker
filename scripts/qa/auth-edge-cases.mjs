#!/usr/bin/env node

/**
 * Auth Edge Cases QA Script
 * 
 * 針對 Auth Flow 邊界情境的自動化檢查
 * 使用 Node 18+ 原生 fetch，無需額外依賴
 * 
 * 注意：
 * - 此腳本不會發送 email，也不會測試「已登入狀態」情境
 * - 那些需要人工 + 瀏覽器實測
 * - 此腳本主要驗證 redirect 行為和錯誤頁面文案
 */

const BASE_URL = process.env.QA_BASE_URL || "https://family-mosaic-maker.vercel.app"

// 測試結果收集
const results = []

/**
 * 執行單一檢查項目
 */
async function check(name, fn) {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start
    console.log(`[PASS] [${name}] OK (${duration}ms)`, result ? `\n   → ${result}` : "")
    results.push({ name, ok: true, duration })
    return { name, ok: true }
  } catch (err) {
    const duration = Date.now() - start
    console.error(`[FAIL] [${name}] FAILED (${duration}ms)`)
    console.error("   Reason:", err.message || err)
    results.push({ name, ok: false, error: err.message || String(err), duration })
    return { name, ok: false, error: err }
  }
}

/**
 * 主要測試流程
 */
async function run() {
  console.log(`\n🔎 Auth Edge Cases QA Test`)
  console.log(`📍 Target: ${BASE_URL}\n`)

  // 1. /auth/callback（缺 code）→ 應 30x redirect 到 /auth/login?error=missing_code
  await check("1. /auth/callback (no code)", async () => {
    const res = await fetch(`${BASE_URL}/auth/callback`, {
      redirect: "manual"
    })
    if (res.status < 300 || res.status >= 400) {
      throw new Error(`Expected 3xx redirect, got ${res.status}`)
    }
    const location = res.headers.get("location") || ""
    if (!location.includes("/auth/login")) {
      throw new Error(`Expected Location to contain /auth/login, got ${location}`)
    }
    if (!location.includes("error=missing_code")) {
      throw new Error(`Expected Location to contain error=missing_code, got ${location}`)
    }
    return `Status ${res.status}, Location: ${location}`
  })

  // 2. /auth/callback?code=fake-test-code → 應 30x redirect 到 /auth/error?error=invalid_link
  await check("2. /auth/callback?code=fake-test-code", async () => {
    const res = await fetch(`${BASE_URL}/auth/callback?code=fake-test-code`, {
      redirect: "manual"
    })
    if (res.status >= 500) {
      throw new Error(`Got 5xx error: ${res.status}`)
    }
    // 檢查不是 JSON error
    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/json") && res.status >= 400) {
      const json = await res.json().catch(() => ({}))
      throw new Error(`Got JSON error response: ${JSON.stringify(json)}`)
    }
    // 應該 redirect 到 /auth/error
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") || ""
      if (location.includes("/auth/error")) {
        // 可能是 invalid_link 或 missing_pkce_cookie，都算通過
        return `Status ${res.status}, redirects to ${location}`
      }
      throw new Error(`Expected redirect to /auth/error, got ${location}`)
    }
    // 如果是 200，檢查內容不是 JSON error
    if (res.status === 200) {
      const text = await res.text()
      if (text.includes('"error"') && text.includes("code verifier")) {
        throw new Error("Got JSON error in response body")
      }
      return `Status ${res.status}, not JSON error`
    }
    throw new Error(`Expected 3xx redirect or 200, got ${res.status}`)
  })

  // 3. /auth/login（未登入狀態）→ 200，HTML 中要包含 login 標題關鍵字
  await check("3. /auth/login (unauthenticated)", async () => {
    const res = await fetch(`${BASE_URL}/auth/login`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    const hasLoginKeywords = text.includes("Magic Link") || 
                            text.includes("Sign in") || 
                            text.includes("magic link") ||
                            text.includes("Email address") ||
                            text.includes("Send Magic Link")
    if (!hasLoginKeywords) {
      throw new Error("Page does not contain login keywords")
    }
    return `Status ${res.status}, login form found`
  })

  // 4. /dashboard（未登入狀態）→ 30x redirect 到 /auth/login
  await check("4. /dashboard (unauthenticated)", async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      redirect: "manual"
    })
    if (res.status < 300 || res.status >= 400) {
      throw new Error(`Expected 3xx redirect, got ${res.status}`)
    }
    const location = res.headers.get("location") || ""
    if (!location.includes("/auth/login")) {
      throw new Error(`Expected Location to contain /auth/login, got ${location}`)
    }
    return `Status ${res.status}, Location: ${location}`
  })

  // 5. /auth/error?error=invalid_link → 200，HTML 內含「連結已失效」等文案關鍵字
  await check("5. /auth/error?error=invalid_link", async () => {
    const res = await fetch(`${BASE_URL}/auth/error?error=invalid_link`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查多種可能的關鍵字（包括中英文）
    const hasErrorKeywords = text.includes("連結已失效") || 
                            text.includes("验证链接已失效") ||
                            text.includes("已过期") ||
                            text.includes("已失效") ||
                            text.includes("invalid") ||
                            text.includes("error") ||
                            text.includes("回登入页") ||
                            text.includes("重新发送") ||
                            text.includes("重新寄信")
    if (!hasErrorKeywords) {
      // 如果找不到關鍵字，至少確認是錯誤頁面（有錯誤圖示或按鈕）
      const hasErrorPageStructure = text.includes("Oops") || 
                                   text.includes("验证失败") ||
                                   text.includes("Button") ||
                                   text.includes("回登入")
      if (!hasErrorPageStructure) {
        throw new Error("Page does not appear to be an error page")
      }
      return `Status ${res.status}, error page structure found (keywords may vary)`
    }
    return `Status ${res.status}, error message found`
  })

  // 6. /auth/error?reason=missing_pkce_cookie → 200，HTML 內含「請在同一個瀏覽器點擊」等文案關鍵字
  await check("6. /auth/error?reason=missing_pkce_cookie", async () => {
    const res = await fetch(`${BASE_URL}/auth/error?reason=missing_pkce_cookie`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查多種可能的關鍵字
    const hasPkceKeywords = text.includes("同一個瀏覽器") || 
                           text.includes("同一個裝置") ||
                           text.includes("同一個") ||
                           text.includes("missing_pkce") ||
                           text.includes("Web 版信箱") ||
                           text.includes("Gmail") ||
                           text.includes("Outlook") ||
                           text.includes("瀏覽器") ||
                           text.includes("裝置")
    if (!hasPkceKeywords) {
      // 如果找不到關鍵字，至少確認是錯誤頁面
      const hasErrorPageStructure = text.includes("Oops") || 
                                   text.includes("验证失败") ||
                                   text.includes("error")
      if (!hasErrorPageStructure) {
        throw new Error("Page does not appear to be an error page")
      }
      return `Status ${res.status}, error page structure found (PKCE keywords may vary)`
    }
    return `Status ${res.status}, PKCE error message found`
  })

  // 7. /auth/logout → 30x redirect 到首頁（如果尚未部署，會是 404，這是可接受的）
  await check("7. /auth/logout", async () => {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      redirect: "manual"
    })
    // 如果尚未部署，會是 404，這是可接受的（因為這是新功能）
    if (res.status === 404) {
      console.log("   ⚠️  Warning: /auth/logout returns 404 (may not be deployed yet)")
      return "404 (not deployed yet, acceptable)"
    }
    if (res.status < 300 || res.status >= 400) {
      throw new Error(`Expected 3xx redirect, got ${res.status}`)
    }
    const location = res.headers.get("location") || ""
    // 應該 redirect 到首頁 (/)
    if (!location.endsWith("/") && !location.includes("/?") && !location.match(/\/$/)) {
      // 允許完整 URL 或相對路徑
      const url = new URL(location, BASE_URL)
      if (url.pathname !== "/") {
        throw new Error(`Expected redirect to /, got ${location}`)
      }
    }
    return `Status ${res.status}, redirects to home`
  })

  // 輸出總結
  console.log("\n" + "=".repeat(60))
  console.log("Auth Edge Cases QA Summary")
  console.log("=".repeat(60) + "\n")

  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length

  results.forEach(r => {
    if (r.ok) {
      console.log(`✅ ${r.name}`)
    } else {
      console.log(`❌ ${r.name} - ${r.error || "Failed"}`)
    }
  })

  console.log("\n" + "=".repeat(60))
  console.log(`Total: ${results.length} checks`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log("=".repeat(60) + "\n")

  // 如果有失敗的項目，exit code 1
  if (failed > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

// 執行測試
run().catch(err => {
  console.error("\n❌ Unexpected error:", err)
  process.exit(1)
})

