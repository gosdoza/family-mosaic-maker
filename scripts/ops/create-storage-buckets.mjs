#!/usr/bin/env node

/**
 * 创建 Supabase Storage buckets
 * 
 * 创建三个 buckets: originals, previews, assets
 * 设置最小访问策略（私有，仅签名 URL 可访问）
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 错误: 缺少 Supabase 环境变量')
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const buckets = [
  {
    name: 'originals',
    public: false,
    description: '原始图片存储（72小时保留）',
  },
  {
    name: 'previews',
    public: false,
    description: '预览图片存储（7天保留）',
  },
  {
    name: 'assets',
    public: false,
    description: '高清图片存储（长期保留）',
  },
]

async function createBucket(bucket) {
  try {
    // 检查 bucket 是否已存在
    const { data: existing, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error(`❌ 无法列出 buckets: ${listError.message}`)
      return { success: false, error: listError.message }
    }

    const exists = existing?.some((b) => b.name === bucket.name)
    
    if (exists) {
      console.log(`✅ Bucket "${bucket.name}" 已存在`)
      return { success: true, existed: true }
    }

    // 创建 bucket
    const { data, error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })

    if (error) {
      console.error(`❌ 创建 bucket "${bucket.name}" 失败: ${error.message}`)
      return { success: false, error: error.message }
    }

    console.log(`✅ Bucket "${bucket.name}" 创建成功`)
    return { success: true, existed: false }
  } catch (error) {
    console.error(`❌ 创建 bucket "${bucket.name}" 时发生错误: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function main() {
  console.log('========================================')
  console.log('创建 Supabase Storage Buckets')
  console.log('========================================')
  console.log('')

  const results = []

  for (const bucket of buckets) {
    console.log(`创建 bucket: ${bucket.name}...`)
    const result = await createBucket(bucket)
    results.push({ bucket: bucket.name, ...result })
    console.log('')
  }

  console.log('========================================')
  console.log('创建结果汇总')
  console.log('========================================')
  console.log('')

  let allSuccess = true
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.bucket}: ${result.existed ? '已存在' : '创建成功'}`)
    } else {
      console.log(`❌ ${result.bucket}: 失败 - ${result.error}`)
      allSuccess = false
    }
  }

  console.log('')
  if (allSuccess) {
    console.log('✅ 所有 buckets 创建完成')
    process.exit(0)
  } else {
    console.log('⚠️  部分 buckets 创建失败，请检查错误信息')
    process.exit(1)
  }
}

main()



