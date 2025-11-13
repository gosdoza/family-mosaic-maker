#!/usr/bin/env node

/**
 * 验证最小表是否存在
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
  console.log('🔍 验证表是否存在...')
  console.log('')

  try {
    // 查询表
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        select table_name 
        from information_schema.tables
        where table_schema='public'
          and table_name in ('orders','analytics_logs','feature_flags')
        order by table_name;
      `,
    })

    if (error) {
      // 如果 exec_sql 不存在，尝试直接查询
      const { data: tables, error: queryError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .in('table_name', ['orders', 'analytics_logs', 'feature_flags'])

      if (queryError) {
        console.error('❌ 无法查询表:', queryError.message)
        console.log('')
        console.log('请手动在 Supabase Dashboard SQL Editor 中执行:')
        console.log('')
        console.log("select table_name from information_schema.tables")
        console.log("where table_schema='public'")
        console.log("  and table_name in ('orders','analytics_logs','feature_flags');")
        process.exit(1)
      }

      const foundTables = tables?.map((t) => t.table_name) || []
      const expectedTables = ['orders', 'analytics_logs', 'feature_flags']
      const missingTables = expectedTables.filter((t) => !foundTables.includes(t))

      if (missingTables.length === 0) {
        console.log('✅ 所有表都存在:')
        foundTables.forEach((t) => console.log(`   - ${t}`))
        return true
      } else {
        console.log('❌ 缺少以下表:')
        missingTables.forEach((t) => console.log(`   - ${t}`))
        console.log('')
        console.log('请执行 migration: supabase/migrations/20251112_min_tables.sql')
        return false
      }
    } else {
      console.log('✅ 查询成功')
      return true
    }
  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    return false
  }
}

verifyTables().then((success) => {
  process.exit(success ? 0 : 1)
})



