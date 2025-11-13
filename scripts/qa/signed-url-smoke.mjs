#!/usr/bin/env node

/**
 * Signed URL Smoke Test
 * 
 * 测试：
 * - 上传一张测试档 → 产签名 URL → 成功下载
 * - 等待过期再验 401/403
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { join } from "path"

const BASE_URL = process.env.BASE_URL || "http://localhost:3000"
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ 缺少 Supabase 环境变量：NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const BUCKET_NAME = "originals"
const TEST_FILE_NAME = `smoke-test-${Date.now()}.jpg`
const TEST_FILE_PATH = join(process.cwd(), "public", "placeholder.jpg") // 使用占位图片

async function main() {
  console.log("==========================================")
  console.log("Signed URL Smoke Test")
  console.log("==========================================")
  console.log(`Bucket: ${BUCKET_NAME}`)
  console.log(`Test file: ${TEST_FILE_NAME}`)
  console.log("")

  let testFileData = null
  let signedUrl = null
  let testPassed = true

  try {
    // ===== 1️⃣ 上传测试文件 =====
    console.log("1️⃣ 上传测试文件")
    console.log("----------------------------------------")

    // 读取测试文件
    try {
      testFileData = readFileSync(TEST_FILE_PATH)
      console.log(`✅ 读取测试文件: ${TEST_FILE_PATH}`)
    } catch (error) {
      // 如果文件不存在，创建一个虚拟文件
      testFileData = Buffer.from("test image data")
      console.log(`⚠️  测试文件不存在，使用虚拟数据`)
    }

    // 上传到 Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(TEST_FILE_NAME, testFileData, {
        contentType: "image/jpeg",
        upsert: false,
      })

    if (uploadError) {
      console.error(`❌ 上传失败: ${uploadError.message}`)
      testPassed = false
      throw uploadError
    }

    console.log(`✅ 上传成功: ${uploadData.path}`)
    console.log("")

    // ===== 2️⃣ 生成签名 URL =====
    console.log("2️⃣ 生成签名 URL")
    console.log("----------------------------------------")

    const EXPIRY_SECONDS = 10 // 10 秒过期（用于测试）

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(TEST_FILE_NAME, EXPIRY_SECONDS)

    if (signedUrlError) {
      console.error(`❌ 生成签名 URL 失败: ${signedUrlError.message}`)
      testPassed = false
      throw signedUrlError
    }

    signedUrl = signedUrlData.signedUrl
    console.log(`✅ 签名 URL 生成成功（有效期 ${EXPIRY_SECONDS} 秒）`)
    console.log(`   URL: ${signedUrl.substring(0, 80)}...`)
    console.log("")

    // ===== 3️⃣ 立即下载（应该成功）=====
    console.log("3️⃣ 立即下载（应该成功）")
    console.log("----------------------------------------")

    const downloadResponse = await fetch(signedUrl, {
      method: "GET",
    })

    if (downloadResponse.ok) {
      console.log(`✅ 下载成功: status = ${downloadResponse.status}`)
      const contentLength = downloadResponse.headers.get("content-length")
      if (contentLength) {
        console.log(`   文件大小: ${contentLength} bytes`)
      }
    } else {
      console.error(`❌ 下载失败: status = ${downloadResponse.status}`)
      testPassed = false
    }

    console.log("")

    // ===== 4️⃣ 等待过期 =====
    console.log("4️⃣ 等待签名 URL 过期")
    console.log("----------------------------------------")

    const waitTime = EXPIRY_SECONDS + 2 // 多等 2 秒确保过期
    console.log(`   等待 ${waitTime} 秒...`)

    await new Promise((resolve) => setTimeout(resolve, waitTime * 1000))

    console.log("✅ 等待完成")
    console.log("")

    // ===== 5️⃣ 过期后下载（应该失败 401/403）=====
    console.log("5️⃣ 过期后下载（应该失败 401/403）")
    console.log("----------------------------------------")

    const expiredResponse = await fetch(signedUrl, {
      method: "GET",
    })

    // 接受 400/401/403 作为过期响应（Supabase 可能返回 400 "signature expired"）
    if ([400, 401, 403].includes(expiredResponse.status)) {
      console.log(`✅ 过期后下载正确返回 ${expiredResponse.status}`)
    } else {
      console.error(
        `❌ 过期后下载返回 ${expiredResponse.status}（预期 400、401 或 403）`
      )
      testPassed = false
    }

    console.log("")

    // ===== 6️⃣ 清理测试文件 =====
    console.log("6️⃣ 清理测试文件")
    console.log("----------------------------------------")

    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([TEST_FILE_NAME])

    if (deleteError) {
      console.error(`⚠️  删除测试文件失败: ${deleteError.message}`)
    } else {
      console.log(`✅ 测试文件已删除`)
    }

    console.log("")

    // ===== 总结 =====
    console.log("==========================================")
    console.log("测试总结")
    console.log("==========================================")

    if (testPassed) {
      console.log("✅ 所有测试通过")
      process.exit(0)
    } else {
      console.log("❌ 部分测试失败")
      process.exit(1)
    }
  } catch (error) {
    console.error("❌ 测试过程中发生错误:", error.message)
    process.exit(1)
  }
}

main()

