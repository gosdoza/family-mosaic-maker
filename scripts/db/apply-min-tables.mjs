#!/usr/bin/env node

/**
 * 应用最小表 migration
 * 通过 Supabase JS 客户端执行 SQL
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
  console.error('')
  console.error('请使用 Supabase Dashboard SQL Editor 手动执行 migration:')
  console.error('  1. 打开: ' + (supabaseUrl || 'https://your-project.supabase.co'))
  console.error('  2. 进入 SQL Editor')
  console.error('  3. 执行以下 SQL:')
  console.error('')
  const sqlFile = join(__dirname, '../../supabase/migrations/20251112_min_tables.sql')
  console.log(readFileSync(sqlFile, 'utf8'))
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

console.log('🚀 开始执行 migration...')
console.log(`📄 文件: ${migrationFile}`)
console.log('')

// 由于 Supabase JS 客户端无法直接执行 DDL，我们需要使用 REST API 或提示用户使用 Dashboard
console.log('⚠️  Supabase JS 客户端无法直接执行 DDL 语句')
console.log('')
console.log('请使用以下方式之一执行 migration:')
console.log('')
console.log('方案 1: Supabase Dashboard SQL Editor（推荐）')
console.log(`   1. 打开: ${supabaseUrl.replace('/rest/v1', '')}`)
console.log('   2. 进入 SQL Editor')
console.log('   3. 执行以下 SQL:')
console.log('')
console.log(sql)
console.log('')
console.log('方案 2: 使用 psql')
console.log('   psql $DATABASE_URL -f supabase/migrations/20251112_min_tables.sql')
console.log('')
console.log('方案 3: 使用 Supabase CLI（如果已链接项目）')
console.log('   supabase db push')
console.log('')

process.exit(0)



