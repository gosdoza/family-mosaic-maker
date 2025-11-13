#!/usr/bin/env node

/**
 * 更新 Provider 权重配置到 D2 阶段 (50% FAL, 50% Runware)
 * 并在 analytics_logs 记录变更事件
 * 
 * 用法:
 *   node scripts/ops/update-provider-weights-d2.mjs
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ 错误: 缺少 Supabase 环境变量')
  console.error('请设置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const weights = { fal: 0.5, runware: 0.5 }
const weightsStr = JSON.stringify(weights)
const environment = 'production'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function updateWeights() {
  try {
    console.log(`📋 更新 Provider 权重配置到 D2 阶段 (${environment})...`)
    console.log(`   权重: ${weightsStr}`)
    console.log('')

    // 1. 更新 feature_flags
    const { data: flagData, error: flagError } = await supabase
      .from('feature_flags')
      .upsert(
        {
          flag_key: 'GEN_PROVIDER_WEIGHTS',
          flag_value: false,
          flag_value_text: weightsStr,
          description: `Provider weights: ${(weights.fal * 100).toFixed(0)}% FAL, ${(weights.runware * 100).toFixed(0)}% Runware (${environment} - D2 Stage)`,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'flag_key',
        }
      )
      .select()

    if (flagError) {
      console.error('❌ 更新 feature_flags 失败:', flagError.message)
      process.exit(1)
    }

    console.log('✅ 权重配置已更新')
    console.log('')

    // 2. 记录变更事件到 analytics_logs
    const { error: logError } = await supabase
      .from('analytics_logs')
      .insert({
        event_type: 'gen_weights_updated',
        event_data: {
          old_weights: { fal: 0.9, runware: 0.1 },
          new_weights: weights,
          environment: environment,
          stage: 'D2',
          reason: '灰度发布 D2 阶段 - 50% Runware 流量测试',
          updated_by: 'auto_script',
        },
        created_at: new Date().toISOString(),
      })

    if (logError) {
      console.error('⚠️  记录变更事件失败:', logError.message)
      console.error('   权重已更新，但事件记录失败')
    } else {
      console.log('✅ 变更事件已记录到 analytics_logs')
    }

    console.log('')
    console.log('📊 更新详情:')
    console.log(`   Flag Key: GEN_PROVIDER_WEIGHTS`)
    console.log(`   权重配置: ${weightsStr}`)
    console.log(`   更新时间: ${new Date().toISOString()}`)
    console.log(`   事件类型: gen_weights_updated`)
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
    console.log('   预期结果: provider 分布 ≈ 50/50')
    console.log('')
    console.log('   3. 验证变更事件:')
    console.log('      SELECT event_type, event_data, created_at')
    console.log('      FROM analytics_logs')
    console.log('      WHERE event_type = \'gen_weights_updated\'')
    console.log('      ORDER BY created_at DESC')
    console.log('      LIMIT 1;')
  } catch (error) {
    console.error('❌ 错误:', error.message)
    process.exit(1)
  }
}

updateWeights()



