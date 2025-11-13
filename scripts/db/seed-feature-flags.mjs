#!/usr/bin/env node

/**
 * 种子 feature_flags
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

async function seedFeatureFlags() {
  try {
    // Upsert gen_provider_weights
    const { data, error } = await supabase
      .from('feature_flags')
      .upsert({
        key: 'gen_provider_weights',
        value: { fal: 0, runware: 1 },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'key',
      })
      .select()

    if (error) {
      console.error('❌ 写入失败:', error.message)
      process.exit(1)
    }

    console.log('✅ feature_flags 已更新: gen_provider_weights = { fal: 0, runware: 1 }')

    // 查询所有 feature_flags
    const { data: flags, error: queryError } = await supabase
      .from('feature_flags')
      .select('key, value')
      .order('key')

    if (queryError) {
      console.error('⚠️ 查询失败:', queryError.message)
    } else {
      console.log('\n当前 feature_flags 记录:')
      flags.forEach(flag => {
        console.log(`  - ${flag.key}: ${JSON.stringify(flag.value)}`)
      })
    }
  } catch (error) {
    console.error('❌ 执行失败:', error.message)
    process.exit(1)
  }
}

seedFeatureFlags()



