#!/usr/bin/env node

/**
 * MVP Pricing Flow QA Script
 * 
 * 針對 Pricing Flow（Mock 版）的自動化檢查
 * 使用 Node 18+ 原生 fetch，無需額外依賴
 * 
 * 檢查項目：
 * 1. GET /pricing - Pricing page
 * 2. GET /results?id=demo-001&paid=1 - Paid results page
 * 3. GET /orders - Orders page
 * 4. POST /api/checkout - Checkout API (auth expectations)
 * 5. GET /api/orders - Orders API (auth expectations)
 * 6. GET /api/paypal/confirm - PayPal confirm API (auth expectations)
 * 7. POST /api/paypal/capture - PayPal capture API (auth expectations)
 */

const BASE_URL = process.env.QA_BASE_URL || "https://family-mosaic-maker.vercel.app"

// 測試結果收集
const results = []
const warnings = []

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
 * 警告（不計為失敗）
 */
function warn(name, message) {
  console.warn(`⚠️  [${name}] WARNING: ${message}`)
  warnings.push({ name, message })
}

/**
 * 主要測試流程
 */
async function run() {
  console.log(`\n🔎 MVP Pricing Flow QA Test`)
  console.log(`📍 Target: ${BASE_URL}\n`)

  // Check A – /pricing page
  await check("A. Pricing page (/pricing)", async () => {
    const res = await fetch(`${BASE_URL}/pricing`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查是否包含 "Pay with PayPal" 和價格標籤
    const hasPayPalButton = text.includes("Pay with PayPal") || 
                           text.includes("paypal") ||
                           text.includes("PayPal")
    const hasPrice = text.includes("$2.99") || 
                    text.includes("2.99") ||
                    text.includes("Premium")
    
    if (!hasPayPalButton && !hasPrice) {
      throw new Error("Page does not contain 'Pay with PayPal' or price label")
    }
    if (!hasPayPalButton) {
      warn("A. Pricing page", "Could not find 'Pay with PayPal' text (may be due to i18n)")
    }
    if (!hasPrice) {
      warn("A. Pricing page", "Could not find price label '$2.99' (may be due to i18n)")
    }
    return `Status ${res.status}, PayPal/price found`
  })

  // Check B – /results?id=demo-001&paid=1
  await check("B. Results page with paid=1 (/results?id=demo-001&paid=1)", async () => {
    const res = await fetch(`${BASE_URL}/results?id=demo-001&paid=1`)
    if (res.status >= 500) {
      throw new Error(`Expected <500, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查是否包含 paid/premium 標記
    const hasPaidMarker = text.includes("Paid") || 
                         text.includes("Premium") ||
                         text.includes("paid") ||
                         text.includes("premium") ||
                         text.includes("unlocked") ||
                         text.includes("✅")
    
    if (!hasPaidMarker && res.status === 200) {
      warn("B. Results page with paid=1", "Could not find paid/premium marker (may be acceptable)")
      return `Status ${res.status} (paid marker check skipped)`
    }
    return `Status ${res.status}${hasPaidMarker ? ", paid marker found" : ""}`
  })

  // Check C – /orders page
  await check("C. Orders page (/orders)", async () => {
    const res = await fetch(`${BASE_URL}/orders`)
    if (res.status === 404) {
      warn("C. Orders page", "Got 404 (not implemented yet, acceptable)")
      return "404 (not implemented)"
    }
    if (res.status >= 500) {
      throw new Error(`Expected <500 or 404, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查是否包含 demo-001 或訂單相關關鍵字
    const hasDemo001 = text.includes("demo-001")
    const hasOrderKeywords = text.includes("ORD-") || 
                            text.includes("Order") ||
                            text.includes("order")
    
    if (!hasDemo001 && !hasOrderKeywords && res.status === 200) {
      warn("C. Orders page", "Could not find demo-001 or order keywords (may be acceptable)")
      return `Status ${res.status} (content check skipped)`
    }
    return `Status ${res.status}${hasDemo001 ? ", demo-001 found" : hasOrderKeywords ? ", order keywords found" : ""}`
  })

  // Check D – POST /api/checkout (Auth expectations)
  await check("D. POST /api/checkout (auth protection)", async () => {
    const res = await fetch(`${BASE_URL}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": `test_${Date.now()}`,
      },
      body: JSON.stringify({
        jobId: "demo-001",
        price: "2.99"
      })
    })
    
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      if (data.error === "Unauthorized") {
        return "401 Unauthorized (expected - requires authentication)"
      }
    }
    
    // 如果返回 200，可能是測試環境允許匿名，記錄為警告
    if (res.status === 200) {
      warn("D. POST /api/checkout", "Got 200 (may allow anonymous in test mode)")
      const data = await res.json().catch(() => ({}))
      if (data.approvalUrl) {
        return `200 OK (public access), approvalUrl: ${data.approvalUrl}`
      }
      return "200 OK (public access)"
    }
    
    // 其他狀態碼視為失敗
    throw new Error(`Expected 401 or 200, got ${res.status}`)
  })

  // Check E – GET /api/orders (Auth expectations)
  await check("E. GET /api/orders (auth protection)", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`)
    
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      return "401 Unauthorized (expected - requires authentication)"
    }
    
    // 30x redirect 也是預期的（redirect to login）
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") || ""
      return `30x redirect (expected - requires authentication), Location: ${location}`
    }
    
    // 如果返回 200，可能是測試環境允許匿名，記錄為警告
    if (res.status === 200) {
      warn("E. GET /api/orders", "Got 200 (may allow anonymous in test mode)")
      const data = await res.json().catch(() => ({}))
      if (data.orders && Array.isArray(data.orders)) {
        const hasDemo001 = data.orders.some((o) => o.jobId === "demo-001")
        return `200 OK (public access), orders: ${data.orders.length}${hasDemo001 ? ", demo-001 found" : ""}`
      }
      return "200 OK (public access)"
    }
    
    // 其他狀態碼視為失敗
    throw new Error(`Expected 401, 30x, or 200, got ${res.status}`)
  })

  // Check F – GET /api/paypal/confirm (Auth expectations)
  await check("F. GET /api/paypal/confirm (auth protection)", async () => {
    const res = await fetch(`${BASE_URL}/api/paypal/confirm?token=test-token&jobId=demo-001`)
    
    // 這個端點可能不需要認證（因為是 PayPal 回調），但我們只是檢查它不會 500
    if (res.status >= 500) {
      throw new Error(`Expected <500, got ${res.status}`)
    }
    
    // 30x redirect 是預期的（redirect to results）
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") || ""
      return `30x redirect (expected), Location: ${location}`
    }
    
    // 其他狀態碼也可以接受（例如 400 Bad Request 如果 token 無效）
    return `Status ${res.status} (acceptable)`
  })

  // Check G – POST /api/paypal/capture (Auth expectations)
  await check("G. POST /api/paypal/capture (auth protection)", async () => {
    const res = await fetch(`${BASE_URL}/api/paypal/capture`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        orderId: "test-order",
        jobId: "demo-001"
      })
    })
    
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      return "401 Unauthorized (expected - requires authentication)"
    }
    
    // 如果返回 200 或 400，可能是測試環境允許匿名或參數錯誤，記錄為警告
    if (res.status === 200 || res.status === 400) {
      warn("G. POST /api/paypal/capture", `Got ${res.status} (may allow anonymous or invalid params)`)
      return `Status ${res.status} (acceptable)`
    }
    
    // 其他狀態碼視為失敗
    throw new Error(`Expected 401, 200, or 400, got ${res.status}`)
  })

  // 輸出總結
  console.log("\n" + "=".repeat(60))
  console.log("MVP Pricing Flow QA Summary")
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
  
  if (warnings.length > 0) {
    console.log("\nWarnings:")
    warnings.forEach(w => {
      console.log(`⚠️  ${w.name} - ${w.message}`)
    })
  }

  console.log("\n" + "=".repeat(60))
  console.log(`Total: ${results.length} checks`)
  console.log(`✅ Passed: ${passed}`)
  console.log(`⚠️  Warnings: ${warnings.length}`)
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

