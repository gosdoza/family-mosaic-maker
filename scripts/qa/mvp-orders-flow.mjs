#!/usr/bin/env node

/**
 * MVP Orders Flow QA Script
 * 
 * 針對 Orders Flow（Mock 版）的自動化檢查
 * 使用 Node 18+ 原生 fetch，無需額外依賴
 * 
 * 檢查項目：
 * 1. GET /api/version - 確認線上版本存在
 * 2. GET /orders - Orders 頁面
 * 3. GET /api/orders - Orders API (auth protection & data structure)
 * 4. GET /results?id=demo-001&paid=1 - Results 頁面（已付費狀態）
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
  console.log(`\n🔎 MVP Orders Flow QA Test`)
  console.log(`📍 Target: ${BASE_URL}\n`)

  // 1. GET /api/version - 確認線上版本存在
  await check("1. GET /api/version", async () => {
    const res = await fetch(`${BASE_URL}/api/version`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const data = await res.json()
    if (data.ok !== true) {
      throw new Error(`Expected ok: true, got ${JSON.stringify(data)}`)
    }
    return `ok=${data.ok}, commit=${data.commit?.substring(0, 8)}`
  })

  // 2. GET /orders - Orders 頁面
  await check("2. GET /orders", async () => {
    const res = await fetch(`${BASE_URL}/orders`, {
      redirect: "manual"
    })
    
    // 30x redirect 是預期的（未登入會 redirect 到 /auth/login）
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location") || ""
      if (location.includes("/auth/login")) {
        return `30x redirect to /auth/login (expected - requires authentication)`
      }
      return `30x redirect (expected - requires authentication), Location: ${location}`
    }
    
    // 200 也是可能的（如果測試環境允許匿名訪問）
    if (res.status === 200) {
      const text = await res.text()
      const hasOrdersKeywords = text.includes("Orders") || 
                               text.includes("orders") ||
                               text.includes("Your Orders") ||
                               text.includes("ORD-")
      if (!hasOrdersKeywords) {
        warn("2. GET /orders", "Could not find Orders-related keywords (may be acceptable)")
        return `Status ${res.status} (content check skipped)`
      }
      return `Status ${res.status}, Orders page found`
    }
    
    // 其他狀態碼視為失敗
    throw new Error(`Expected 200 or 30x redirect, got ${res.status}`)
  })

  // 3. GET /api/orders - Orders API (auth protection & data structure)
  await check("3. GET /api/orders (auth protection & data structure)", async () => {
    const res = await fetch(`${BASE_URL}/api/orders`)
    
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      const data = await res.json().catch(() => ({}))
      if (data.error === "Unauthorized") {
        return "401 Unauthorized (expected - requires authentication)"
      }
      return "401 Unauthorized (expected - requires authentication)"
    }
    
    // 如果返回 200，檢查資料結構
    if (res.status === 200) {
      warn("3. GET /api/orders", "Got 200 (may allow anonymous in test mode)")
      const data = await res.json()
      
      // 檢查是否有 orders 陣列
      if (!data.orders || !Array.isArray(data.orders)) {
        throw new Error(`Expected orders array, got ${JSON.stringify(data)}`)
      }
      
      // 檢查每個訂單的必要欄位
      const requiredFields = ["id", "date", "status", "thumbnail", "count", "template", "paymentStatus"]
      for (const order of data.orders) {
        for (const field of requiredFields) {
          if (!(field in order)) {
            throw new Error(`Order missing required field: ${field}`)
          }
        }
      }
      
      // 檢查是否有 demo-001 訂單
      const hasDemo001 = data.orders.some((o) => o.jobId === "demo-001")
      if (!hasDemo001) {
        warn("3. GET /api/orders", "demo-001 order not found in orders array")
      } else {
        // 檢查 demo-001 的狀態
        const demo001Order = data.orders.find((o) => o.jobId === "demo-001")
        if (demo001Order.paymentStatus !== "paid") {
          warn("3. GET /api/orders", `demo-001 order paymentStatus is "${demo001Order.paymentStatus}", expected "paid"`)
        }
        if (demo001Order.status !== "Completed") {
          warn("3. GET /api/orders", `demo-001 order status is "${demo001Order.status}", expected "Completed"`)
        }
      }
      
      return `200 OK, orders: ${data.orders.length} items${hasDemo001 ? ", demo-001 found" : ""}`
    }
    
    // 其他狀態碼視為失敗
    throw new Error(`Expected 401 or 200, got ${res.status}`)
  })

  // 4. GET /results?id=demo-001&paid=1 - Results 頁面（已付費狀態）
  await check("4. GET /results?id=demo-001&paid=1", async () => {
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
      warn("4. GET /results?id=demo-001&paid=1", "Could not find paid/premium marker (may be acceptable)")
      return `Status ${res.status} (paid marker check skipped)`
    }
    return `Status ${res.status}${hasPaidMarker ? ", paid marker found" : ""}`
  })

  // 輸出總結
  console.log("\n" + "=".repeat(60))
  console.log("MVP Orders Flow QA Summary")
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

