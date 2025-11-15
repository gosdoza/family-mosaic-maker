#!/usr/bin/env node

/**
 * Mock E2E Pipeline Runner
 * 
 * 總管腳本：依序執行所有 Mock MVP E2E QA 腳本
 * - mvp-e2e-smoke.mjs
 * - auth-edge-cases.mjs
 * - mvp-generate-flow.mjs
 * - mvp-pricing-flow.mjs
 * - mvp-orders-flow.mjs
 */

import { spawn } from "node:child_process"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 定義要執行的腳本列表
const scripts = [
  { label: "MVP E2E Smoke", file: "mvp-e2e-smoke.mjs" },
  { label: "Auth Edge Cases", file: "auth-edge-cases.mjs" },
  { label: "MVP Generate Flow", file: "mvp-generate-flow.mjs" },
  { label: "MVP Pricing Flow", file: "mvp-pricing-flow.mjs" },
  { label: "MVP Orders Flow", file: "mvp-orders-flow.mjs" },
]

/**
 * 執行單一腳本
 */
function runScript(label, scriptFile) {
  return new Promise((resolve, reject) => {
    const scriptPath = resolve(__dirname, scriptFile)
    const nodeProcess = spawn("node", [scriptPath], {
      env: { ...process.env }, // 傳遞所有環境變數（包含 QA_BASE_URL）
      stdio: "inherit", // 直接輸出到父進程的 stdio
      shell: false,
    })

    nodeProcess.on("close", (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Exit code: ${code}`))
      }
    })

    nodeProcess.on("error", (err) => {
      reject(err)
    })
  })
}

/**
 * 主執行流程
 */
async function main() {
  console.log("\n🚀 Starting Mock E2E Pipeline...\n")
  
  if (process.env.QA_BASE_URL) {
    console.log(`📍 Base URL: ${process.env.QA_BASE_URL}\n`)
  } else {
    console.log("📍 Base URL: (using default from each script)\n")
  }

  for (const { label, file } of scripts) {
    try {
      console.log(`\n=== [${label}] 開始 ===\n`)
      
      await runScript(label, file)
      
      console.log(`\n[OK] ${label}`)
    } catch (err) {
      console.error(`\n[FAIL] ${label} (${err.message})`)
      console.error("\n❌ Mock E2E pipeline failed.")
      process.exit(1)
    }
  }

  console.log("\n✅ Mock E2E pipeline finished successfully.\n")
}

main().catch((err) => {
  console.error("\n❌ Mock E2E pipeline failed.")
  console.error("Error:", err.message || err)
  process.exit(1)
})

