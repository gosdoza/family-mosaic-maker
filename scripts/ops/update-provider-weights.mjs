#!/usr/bin/env node

/**
 * 更新 Provider 权重配置
 * 
 * 用法:
 *   node scripts/ops/update-provider-weights.mjs '{"fal":0.9,"runware":0.1}' production
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ 错误: 缺少 Supabase 环境变量')
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const weightsStr = process.argv[2]
const environment = process.argv[3] || 'production'

if (!weightsStr) {
  console.error('❌ 错误: 请提供权重配置')
  console.error('用法: node scripts/ops/update-provider-weights.mjs \'{"fal":0.9,"runware":0.1}\' [production|preview]')
  process.exit(1)
}

// 验证 JSON 格式
let weights
try {
  weights = JSON.parse(weightsStr)
} catch (error) {
  console.error('❌ 错误: 无效的 JSON 格式')
  console.error('示例: \'{"fal":0.9,"runware":0.1}\'')
  process.exit(1)
}

// 验证权重格式
if (!weights.fal || !weights.runware) {
  console.error('❌ 错误: 权重配置必须包含 fal 和 runware')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function updateWeights() {
  try {
    console.log(`📋 更新 Provider 权重配置 (${environment})...`)
    console.log(`   权重: ${weightsStr}`)
    console.log('')

    // 更新 feature_flags
    const { data, error } = await supabase
      .from('feature_flags')
      .upsert(
        {
          flag_key: 'GEN_PROVIDER_WEIGHTS',
          flag_value: false,
          flag_value_text: weightsStr,
          description: `Provider weights: ${(weights.fal * 100).toFixed(0)}% FAL, ${(weights.runware * 100).toFixed(0)}% Runware (${environment})`,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'flag_key',
        }
      )
      .select()

    if (error) {
      console.error('❌ 更新失败:', error.message)
      process.exit(1)
    }

    console.log('✅ 权重配置已更新')
    console.log('')
    console.log('📊 更新详情:')
    console.log(`   Flag Key: GEN_PROVIDER_WEIGHTS`)
    console.log(`   权重配置: ${weightsStr}`)
    console.log(`   更新时间: ${new Date().toISOString()}`)
    console.log('')
    console.log('⏳ 等待配置生效（5秒缓存）...')
    await new Promise((resolve) => setTimeout(resolve, 6000))
    console.log('✅ 配置已生效')
    console.log('')
    console.log('📝 验收命令:')
    console.log('   1. 验证健康检查:')
    console.log('      curl -s https://<prod>/api/health | jq \'.providers\'')
    console.log('')
    console.log('   2. 验证流量分配（SQL）:')
    console.log('      SELECT')
    console.log('        event_data->>\'provider\' as provider,')
    console.log('        COUNT(*) as count,')
    console.log('        COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () as percentage')
    console.log('      FROM analytics_logs')
    console.log('      WHERE event_type = \'gen_route\'')
    console.log('        AND created_at >= NOW() - INTERVAL \'10 minutes\'')
    console.log('      GROUP BY event_data->>\'provider\'')
    console.log('      ORDER BY provider;')
    console.log('')
    console.log('   预期结果: provider=runware 约 8-12%')
  } catch (error) {
    console.error('❌ 错误:', error.message)
    process.exit(1)
  }
}

updateWeights()



