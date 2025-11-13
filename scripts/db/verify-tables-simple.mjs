#!/usr/bin/env node

/**
 * 验证表是否存在（通过 Supabase REST API）
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 缺少必需的环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function verifyTables() {
  const tables = ['orders', 'analytics_logs', 'feature_flags']
  const results = {}

  for (const table of tables) {
    try {
      // 尝试查询表（只取第一条记录）
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1)

      if (error && error.code === 'PGRST205') {
        results[table] = '❌ 不存在'
      } else {
        results[table] = '✅ 存在'
      }
    } catch (error) {
      results[table] = '❌ 错误: ' + error.message
    }
  }

  console.log('\n表验证结果:')
  Object.entries(results).forEach(([table, status]) => {
    console.log(`  - ${table}: ${status}`)
  })

  const allExist = Object.values(results).every(status => status.includes('✅'))
  process.exit(allExist ? 0 : 1)
}

verifyTables()



