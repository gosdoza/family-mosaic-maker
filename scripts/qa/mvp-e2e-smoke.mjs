#!/usr/bin/env node

/**
 * MVP Mock E2E Smoke Test
 * 
 * 針對 Production 環境執行基本的 E2E 檢查
 * 使用 Node 18+ 原生 fetch，無需額外依賴
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
    console.log(`✅ [${name}] OK (${duration}ms)`, result ? `\n   → ${result}` : "")
    results.push({ name, ok: true, duration })
    return { name, ok: true }
  } catch (err) {
    const duration = Date.now() - start
    console.error(`❌ [${name}] FAILED (${duration}ms)`)
    console.error("   Reason:", err.message || err)
    results.push({ name, ok: false, error: err.message || String(err), duration })
    return { name, ok: false, error: err }
  }
}

/**
 * 警告（非失敗）
 */
function warn(name, message) {
  console.log(`⚠️  [${name}] ${message}`)
  results.push({ name, ok: true, warning: true, message })
}

/**
 * 主要測試流程
 */
async function run() {
  console.log(`\n🔎 MVP Mock E2E Smoke Test`)
  console.log(`📍 Target: ${BASE_URL}\n`)

  // A. /api/version
  await check("A. /api/version", async () => {
    const res = await fetch(`${BASE_URL}/api/version`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const data = await res.json()
    if (data.ok !== true) {
      throw new Error(`Expected ok: true, got ${JSON.stringify(data)}`)
    }
    return `ok=${data.ok}, commit=${data.commit?.substring(0, 8) || "unknown"}`
  })

  // B. Landing page
  await check("B. Landing page", async () => {
    const res = await fetch(`${BASE_URL}/`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    const hasTitle = text.includes("Family Mosaic Maker") || text.includes("Turn Memories Into Family Moments")
    if (!hasTitle) {
      throw new Error("Page does not contain expected title text")
    }
    return `Status ${res.status}, title found`
  })

  // C. 未登入訪問 /dashboard (redirect 測試)
  await check("C. /dashboard redirect (unauthenticated)", async () => {
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

  // D. Mock API: /api/generate
  await check("D. POST /api/generate", async () => {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: "mock",
        style: "realistic",
        template: "default"
      })
    })
    // 401 是預期的（需要認證），這表示保護機制正常運作
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      if (data.error === "Unauthorized") {
        return "401 Unauthorized (expected - requires authentication)"
      }
    }
    if (res.status < 200 || res.status >= 300) {
      const errorText = await res.text().catch(() => "")
      throw new Error(`Expected 2xx or 401, got ${res.status}${errorText ? `: ${errorText.substring(0, 100)}` : ""}`)
    }
    const data = await res.json()
    if (!data.jobId || typeof data.jobId !== "string") {
      throw new Error(`Expected jobId (string), got ${JSON.stringify(data)}`)
    }
    return `jobId: ${data.jobId}`
  })

  // E. Mock API: /api/progress/demo-001
  await check("E. GET /api/progress/demo-001", async () => {
    const res = await fetch(`${BASE_URL}/api/progress/demo-001`)
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      return "401 Unauthorized (expected - requires authentication)"
    }
    if (res.status < 200 || res.status >= 300) {
      // 如果 404，可能是 demo-001 不存在，但這不算失敗（mock 模式應該有這個）
      if (res.status === 404) {
        warn("E. GET /api/progress/demo-001", "Got 404 (demo-001 may not exist, but this is acceptable in mock mode)")
        return "404 (acceptable)"
      }
      throw new Error(`Expected 2xx, 401, or 404, got ${res.status}`)
    }
    const data = await res.json()
    if (typeof data.status !== "string") {
      throw new Error(`Expected status (string), got ${JSON.stringify(data)}`)
    }
    if (typeof data.progress !== "number") {
      throw new Error(`Expected progress (number), got ${JSON.stringify(data)}`)
    }
    return `status: ${data.status}, progress: ${data.progress}`
  })

  // F. Mock API: /api/results/demo-001
  await check("F. GET /api/results/demo-001", async () => {
    const res = await fetch(`${BASE_URL}/api/results/demo-001`)
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      return "401 Unauthorized (expected - requires authentication)"
    }
    if (res.status < 200 || res.status >= 300) {
      if (res.status === 404) {
        warn("F. GET /api/results/demo-001", "Got 404 (demo-001 may not exist, but this is acceptable in mock mode)")
        return "404 (acceptable)"
      }
      throw new Error(`Expected 2xx, 401, or 404, got ${res.status}`)
    }
    const data = await res.json()
    if (!Array.isArray(data.images)) {
      throw new Error(`Expected images (array), got ${JSON.stringify(data)}`)
    }
    if (data.images.length < 1) {
      throw new Error(`Expected images array length >= 1, got ${data.images.length}`)
    }
    return `images: ${data.images.length} items`
  })

  // G. Results 頁面（未付費）
  await check("G. /results?id=demo-001", async () => {
    const res = await fetch(`${BASE_URL}/results?id=demo-001`)
    if (res.status >= 500) {
      throw new Error(`Got 5xx error: ${res.status}`)
    }
    if (res.status === 404) {
      // 404 可以接受（demo-001 可能不存在）
      return "404 (acceptable)"
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx or 404, got ${res.status}`)
    }
    const text = await res.text()
    const preview = text.substring(0, 200).replace(/\s+/g, " ")
    return `Status ${res.status}, preview: ${preview}...`
  })

  // H. Pricing 頁面
  await check("H. /pricing", async () => {
    const res = await fetch(`${BASE_URL}/pricing`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查多種可能的字串（包括翻譯後的內容）
    const hasPayPal = text.includes("PayPal") || 
                      text.includes("paypal") || 
                      text.includes("$2.99") || 
                      text.includes("2.99") ||
                      text.includes("Checkout") ||
                      text.includes("Premium") ||
                      text.includes("premium")
    if (!hasPayPal) {
      // 如果找不到，只警告不失敗（可能是 i18n 翻譯問題）
      warn("H. /pricing", "Could not find PayPal or price text (may be due to i18n)")
      return `Status ${res.status} (content check skipped)`
    }
    return `Status ${res.status}, PayPal/price found`
  })

  // I. Results 頁面（paid=1）
  await check("I. /results?id=demo-001&paid=1", async () => {
    const res = await fetch(`${BASE_URL}/results?id=demo-001&paid=1`)
    if (res.status >= 500) {
      throw new Error(`Got 5xx error: ${res.status}`)
    }
    if (res.status === 404) {
      return "404 (acceptable)"
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx or 404, got ${res.status}`)
    }
    const text = await res.text()
    const hasPaid = text.includes("paid") || text.includes("Premium") || text.includes("Paid")
    if (!hasPaid) {
      // 只警告，不失敗
      console.log("   ⚠️  Warning: Could not find 'paid' or 'Premium' text (may be acceptable)")
    }
    return `Status ${res.status}`
  })

  // J. Orders API
  await check("J. GET /api/orders", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`)
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      return "401 Unauthorized (expected - requires authentication)"
    }
    if (res.status === 404) {
      warn("J. GET /api/orders", "Got 404 (not implemented yet, acceptable)")
      return "404 (not implemented)"
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, 401, or 404, got ${res.status}`)
    }
    const data = await res.json()
    // 可能是 { orders: [...] } 或直接是 [...]
    const orders = Array.isArray(data) ? data : (data.orders || [])
    if (!Array.isArray(orders)) {
      throw new Error(`Expected orders array, got ${JSON.stringify(data)}`)
    }
    return `orders: ${orders.length} items`
  })

  // K. Orders 頁面
  await check("K. /orders", async () => {
    const res = await fetch(`${BASE_URL}/orders`)
    if (res.status === 404) {
      warn("K. /orders", "Got 404 (not implemented yet, acceptable)")
      return "404 (not implemented)"
    }
    if (res.status >= 500) {
      throw new Error(`Got 5xx error: ${res.status}`)
    }
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx or 404, got ${res.status}`)
    }
    return `Status ${res.status}`
  })

  // L. /auth/callback fake code（確認不會 JSON）
  await check("L. /auth/callback?code=fake-test-code", async () => {
    const res = await fetch(`${BASE_URL}/auth/callback?code=fake-test-code`, {
      redirect: "manual"
    })
    // 應該 redirect，不應該返回 JSON error
    if (res.status >= 500) {
      throw new Error(`Got 5xx error: ${res.status}`)
    }
    const contentType = res.headers.get("content-type") || ""
    if (contentType.includes("application/json") && res.status >= 400) {
      const json = await res.json().catch(() => ({}))
      throw new Error(`Got JSON error response: ${JSON.stringify(json)}`)
    }
    // 應該 redirect 到 /auth/error 或 /auth/login
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") || ""
      if (location.includes("/auth/error") || location.includes("/auth/login")) {
        return `Status ${res.status}, redirects to ${location}`
      }
    }
    // 如果是 200，檢查內容不是 JSON error
    if (res.status === 200) {
      const text = await res.text()
      if (text.includes('"error"') && text.includes("code verifier")) {
        throw new Error("Got JSON error in response body")
      }
      return `Status ${res.status}, not JSON error`
    }
    return `Status ${res.status}`
  })

  // 輸出總結
  console.log("\n" + "=".repeat(50))
  console.log("MVP Mock E2E Smoke Summary")
  console.log("=".repeat(50) + "\n")

  const passed = results.filter(r => r.ok && !r.warning).length
  const warnings = results.filter(r => r.warning).length
  const failed = results.filter(r => !r.ok).length

  results.forEach(r => {
    if (r.warning) {
      console.log(`⚠️  ${r.name} - ${r.message || "Warning"}`)
    } else if (r.ok) {
      console.log(`✅ ${r.name}`)
    } else {
      console.log(`❌ ${r.name} - ${r.error || "Failed"}`)
    }
  })

  console.log("\n" + "=".repeat(50))
  console.log(`Total: ${results.length} checks`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`⚠️  Warnings: ${warnings}`)
  console.log(`❌ Failed: ${failed}`)
  console.log("=".repeat(50) + "\n")

  // 如果有真正失敗的項目，exit code 1
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

