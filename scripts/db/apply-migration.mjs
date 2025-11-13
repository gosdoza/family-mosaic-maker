#!/usr/bin/env node

/**
 * 直接通过 Supabase JS 客户端执行 migration
 * 适用于远程 Supabase 实例
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必需的环境变量:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const migrationFile = join(__dirname, '../../supabase/migrations/20251112_min_tables.sql')
const sql = readFileSync(migrationFile, 'utf8')

// 分割 SQL 语句（按分号分割，但保留 CREATE TABLE 语句完整）
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

console.log('🚀 开始执行 migration...')
console.log(`📄 文件: ${migrationFile}`)
console.log(`📊 语句数: ${statements.length}`)
console.log('')

let successCount = 0
let errorCount = 0

for (let i = 0; i < statements.length; i++) {
  const statement = statements[i] + ';'
  console.log(`执行语句 ${i + 1}/${statements.length}...`)
  
  try {
    // 使用 Supabase REST API 直接执行 SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ sql: statement }),
    })

    if (!response.ok) {
      // 如果 exec_sql 函数不存在，尝试使用 PostgREST 的方式
      // 或者直接通过 Supabase Dashboard 执行
      console.log('⚠️  无法通过 API 执行 SQL（需要 Postgres 函数支持）')
      console.log('')
      console.log('📋 请使用以下方式之一执行 migration:')
      console.log('')
      console.log('方案 1: Supabase Dashboard SQL Editor')
      console.log(`   1. 打开: ${supabaseUrl.replace('/rest/v1', '')}`)
      console.log('   2. 进入 SQL Editor')
      console.log('   3. 执行以下 SQL:')
      console.log('')
      console.log(sql)
      console.log('')
      console.log('方案 2: 使用 psql')
      console.log('   psql $DATABASE_URL -f supabase/migrations/20251112_min_tables.sql')
      process.exit(1)
    }

    const result = await response.json()
    console.log(`   ✅ 成功`)
    successCount++
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}`)
    errorCount++
  }
}

console.log('')
console.log('📊 执行结果:')
console.log(`   ✅ 成功: ${successCount}`)
console.log(`   ❌ 失败: ${errorCount}`)

if (errorCount === 0) {
  console.log('')
  console.log('✅ Migration 执行完成！')
  console.log('')
  console.log('验证表是否存在:')
  console.log('SELECT table_name FROM information_schema.tables')
  console.log("WHERE table_schema = 'public'")
  console.log("AND table_name IN ('orders','feature_flags','analytics_logs');")
} else {
  process.exit(1)
}



