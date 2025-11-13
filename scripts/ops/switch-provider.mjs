#!/usr/bin/env node
/**
 * Provider Switch Script
 * 
 * 一键切换模型供应商：fal|runware|mock
 * 
 * 使用方法:
 *   node scripts/ops/switch-provider.mjs <provider>
 * 
 * 示例:
 *   node scripts/ops/switch-provider.mjs fal
 *   node scripts/ops/switch-provider.mjs mock
 *   node scripts/ops/switch-provider.mjs runware
 */

import { createClient } from '@supabase/supabase-js'

const PROVIDER_FLAG_KEY = 'provider'
const VALID_PROVIDERS = ['fal', 'runware', 'mock']
const DEFAULT_PROVIDER = 'fal'

// 获取命令行参数
const provider = process.argv[2]?.toLowerCase()

// 验证参数
if (!provider) {
  console.error('❌ 错误: 请指定 provider (fal|runware|mock)')
  console.error('')
  console.error('使用方法:')
  console.error('  node scripts/ops/switch-provider.mjs <provider>')
  console.error('')
  console.error('示例:')
  console.error('  node scripts/ops/switch-provider.mjs fal')
  console.error('  node scripts/ops/switch-provider.mjs mock')
  console.error('  node scripts/ops/switch-provider.mjs runware')
  process.exit(1)
}

if (!VALID_PROVIDERS.includes(provider)) {
  console.error(`❌ 错误: 无效的 provider "${provider}"`)
  console.error(`有效值: ${VALID_PROVIDERS.join(', ')}`)
  process.exit(1)
}

// 获取环境变量
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 错误: 缺少 Supabase 凭据')
  console.error('请设置以下环境变量:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * 获取当前 provider
 */
async function getCurrentProvider() {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('flag_value_text')
      .eq('flag_key', PROVIDER_FLAG_KEY)
      .maybeSingle()

    if (error && !error.message.includes('does not exist')) {
      throw error
    }

    return data?.flag_value_text || DEFAULT_PROVIDER
  } catch (error) {
    console.error('❌ 获取当前 provider 失败:', error.message)
    throw error
  }
}

/**
 * 切换 provider
 */
async function switchProvider(newProvider) {
  try {
    // 获取当前 provider
    const currentProvider = await getCurrentProvider()
    
    if (currentProvider === newProvider) {
      console.log(`ℹ️  Provider 已经是 "${newProvider}"，无需切换`)
      return { success: true, current: newProvider, previous: currentProvider }
    }

    console.log(`🔄 切换 provider: ${currentProvider} → ${newProvider}`)

    // 更新 feature_flags
    const { error: upsertError } = await supabase
      .from('feature_flags')
      .upsert(
        {
          flag_key: PROVIDER_FLAG_KEY,
          flag_value: false, // 保持 boolean 兼容
          flag_value_text: newProvider,
          description: `Model provider: fal|runware|mock (current: ${newProvider})`,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'flag_key',
        }
      )

    if (upsertError) {
      throw upsertError
    }

    // 记录到 analytics_logs
    await supabase.from('analytics_logs').insert({
      event_type: 'provider_switched',
      event_data: {
        previous_provider: currentProvider,
        new_provider: newProvider,
        switched_by: 'manual',
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    })

    console.log(`✅ Provider 已切换: ${currentProvider} → ${newProvider}`)
    console.log(`📝 已记录到 analytics_logs`)

    return { success: true, current: newProvider, previous: currentProvider }
  } catch (error) {
    console.error('❌ 切换 provider 失败:', error.message)
    throw error
  }
}

/**
 * 验证切换结果
 */
async function verifyProvider() {
  try {
    const currentProvider = await getCurrentProvider()
    console.log(`✅ 验证: 当前 provider = "${currentProvider}"`)
    return currentProvider
  } catch (error) {
    console.error('❌ 验证失败:', error.message)
    throw error
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 Provider 切换脚本')
    console.log('')
    console.log(`目标 provider: ${provider}`)
    console.log('')

    // 切换 provider
    const result = await switchProvider(provider)

    // 验证切换结果
    await verifyProvider()

    console.log('')
    console.log('✅ 切换完成')
    console.log(`   之前: ${result.previous}`)
    console.log(`   现在: ${result.current}`)
    console.log('')
    console.log('📋 下一步:')
    console.log('  1. 检查 /api/health 确认设置生效')
    console.log('  2. 监控生成请求是否正常')
    console.log('  3. 如需回滚，运行: node scripts/ops/switch-provider.mjs <previous_provider>')
  } catch (error) {
    console.error('')
    console.error('❌ 切换失败:', error.message)
    process.exit(1)
  }
}

// 运行主函数
main()



