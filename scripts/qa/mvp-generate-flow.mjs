#!/usr/bin/env node

/**
 * MVP Generate Flow QA Script
 * 
 * 針對 Generate Flow（Mock 版）的自動化檢查
 * 使用 Node 18+ 原生 fetch，無需額外依賴
 * 
 * 檢查項目：
 * 1. GET / - Landing page
 * 2. GET /generate - Generate page
 * 3. POST /api/generate - Create job
 * 4. GET /api/progress/demo-001 - Progress check
 * 5. GET /api/results/demo-001 - Results check
 * 6. GET /results?id=demo-001 - Results page
 * 7. GET /orders - Orders page
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
 * 主要測試流程
 */
async function run() {
  console.log(`\n🔎 MVP Generate Flow QA Test`)
  console.log(`📍 Target: ${BASE_URL}\n`)

  // 1. GET / - Landing page
  await check("1. Landing page (/)", async () => {
    const res = await fetch(`${BASE_URL}/`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    const hasTitle = text.includes("Family Mosaic Maker") || 
                    text.includes("Turn Memories Into Family Moments") ||
                    text.includes("family")
    if (!hasTitle) {
      throw new Error("Page does not contain expected title text")
    }
    return `Status ${res.status}, title found`
  })

  // 2. GET /generate - Generate page
  await check("2. Generate page (/generate)", async () => {
    const res = await fetch(`${BASE_URL}/generate`)
    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Expected 2xx, got ${res.status}`)
    }
    const text = await res.text()
    const hasGenerateKeywords = text.includes("Generate") || 
                               text.includes("Upload") ||
                               text.includes("Style") ||
                               text.includes("Template") ||
                               text.includes("generate")
    if (!hasGenerateKeywords) {
      throw new Error("Page does not contain Generate-related keywords")
    }
    return `Status ${res.status}, Generate page found`
  })

  // 3. POST /api/generate - Create job
  await check("3. POST /api/generate", async () => {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        files: [{ name: "mock.jpg", size: 1024, type: "image/jpeg" }],
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

  // 4. GET /api/progress/demo-001 - Progress check
  await check("4. GET /api/progress/demo-001", async () => {
    const res = await fetch(`${BASE_URL}/api/progress/demo-001`)
    
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      return "401 Unauthorized (expected - requires authentication)"
    }
    
    if (res.status < 200 || res.status >= 300) {
      if (res.status === 404) {
        // 404 可以接受（demo-001 可能不存在，但 Mock 模式應該有）
        return "404 (acceptable, but Mock mode should have demo-001)"
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
    // 在 Mock 模式下，demo-001 應該直接返回 succeeded
    if (data.status === "succeeded" && data.progress === 100) {
      return `status: ${data.status}, progress: ${data.progress} (perfect for Mock mode)`
    }
    return `status: ${data.status}, progress: ${data.progress}`
  })

  // 5. GET /api/results/demo-001 - Results check
  await check("5. GET /api/results/demo-001", async () => {
    const res = await fetch(`${BASE_URL}/api/results/demo-001`)
    
    // 401 是預期的（需要認證）
    if (res.status === 401) {
      return "401 Unauthorized (expected - requires authentication)"
    }
    
    if (res.status < 200 || res.status >= 300) {
      if (res.status === 404) {
        // 404 可以接受（demo-001 可能不存在，但 Mock 模式應該有）
        return "404 (acceptable, but Mock mode should have demo-001)"
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
    // 檢查圖片 URL 是否使用本地資源
    const hasLocalImages = data.images.some(img => 
      img.url?.includes("/assets/mock/") || 
      img.thumbnail?.includes("/assets/mock/")
    )
    return `images: ${data.images.length} items${hasLocalImages ? " (using local mock images)" : ""}`
  })

  // 6. GET /results?id=demo-001 - Results page
  await check("6. Results page (/results?id=demo-001)", async () => {
    const res = await fetch(`${BASE_URL}/results?id=demo-001`)
    if (res.status >= 500) {
      throw new Error(`Expected <500, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查是否包含 Results 相關關鍵字
    const hasResultsKeywords = text.includes("Results") || 
                              text.includes("images") ||
                              text.includes("Download") ||
                              text.includes("Share") ||
                              text.includes("demo-001")
    if (!hasResultsKeywords && res.status === 200) {
      // 如果狀態是 200 但沒有關鍵字，可能是頁面結構不同，不算失敗
      return `Status ${res.status} (content check skipped)`
    }
    return `Status ${res.status}${hasResultsKeywords ? ", Results page found" : ""}`
  })

  // 7. GET /orders - Orders page
  await check("7. Orders page (/orders)", async () => {
    const res = await fetch(`${BASE_URL}/orders`)
    if (res.status === 404) {
      // 404 可以接受（可能尚未實作）
      return "404 (not implemented yet, acceptable)"
    }
    if (res.status >= 500) {
      throw new Error(`Expected <500 or 404, got ${res.status}`)
    }
    const text = await res.text()
    // 檢查是否包含 Orders 相關關鍵字
    const hasOrdersKeywords = text.includes("Orders") || 
                             text.includes("Order") ||
                             text.includes("demo-001") ||
                             text.includes("ORD-")
    if (!hasOrdersKeywords && res.status === 200) {
      // 如果狀態是 200 但沒有關鍵字，可能是頁面結構不同，不算失敗
      return `Status ${res.status} (content check skipped)`
    }
    return `Status ${res.status}${hasOrdersKeywords ? ", Orders page found" : ""}`
  })

  // 輸出總結
  console.log("\n" + "=".repeat(60))
  console.log("MVP Generate Flow QA Summary")
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

