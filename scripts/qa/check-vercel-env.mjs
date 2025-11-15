#!/usr/bin/env node

/**
 * Vercel 环境变量检查脚本
 * 
 * 检查本地 .env.local 和 Vercel 环境变量是否符合规范
 * 
 * Usage: node scripts/qa/check-vercel-env.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

// 从 spec 文档读取环境变量列表（简化版，直接定义）
const ENV_SPEC = {
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL': {
    category: 'Supabase',
    description: 'Supabase 项目 URL',
    devValue: 'https://xxxxx.supabase.co',
    vercelValue: 'https://xxxxx.supabase.co',
    validate: (value, isVercel) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      if (!value.includes('supabase.co')) return { ok: false, reason: 'SUSPECT', message: '格式不正确，应包含 supabase.co' }
      return { ok: true }
    }
  },
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': {
    category: 'Supabase',
    description: 'Supabase 匿名密钥',
    devValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    vercelValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    validate: (value) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      if (value.length < 50) return { ok: false, reason: 'SUSPECT', message: '密钥长度异常' }
      return { ok: true }
    },
    sensitive: true
  },
  'SUPABASE_SERVICE_ROLE_KEY': {
    category: 'Supabase',
    description: 'Supabase 服务角色密钥',
    devValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    vercelValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    validate: (value) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      if (value.length < 50) return { ok: false, reason: 'SUSPECT', message: '密钥长度异常' }
      return { ok: true }
    },
    sensitive: true
  },
  // Runware
  'RUNWARE_API_KEY': {
    category: 'Runware',
    description: 'Runware API 密钥',
    devValue: 'rw_xxxxx',
    vercelValue: 'rw_xxxxx',
    validate: (value) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      return { ok: true }
    },
    sensitive: true
  },
  'RUNWARE_BASE_URL': {
    category: 'Runware',
    description: 'Runware API 基础 URL',
    devValue: 'https://api.runware.ai',
    vercelValue: 'https://api.runware.ai',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      if (!value.startsWith('https://')) return { ok: false, reason: 'SUSPECT', message: '应使用 https://' }
      return { ok: true }
    }
  },
  // FAL
  'FAL_API_KEY': {
    category: 'FAL',
    description: 'FAL AI API 密钥',
    devValue: 'fal-xxxxx',
    vercelValue: 'fal-xxxxx',
    validate: (value) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      return { ok: true }
    },
    sensitive: true
  },
  'FAL_MODEL_ID': {
    category: 'FAL',
    description: 'FAL 模型 ID',
    devValue: 'fal-ai/flux/schnell',
    vercelValue: 'fal-ai/flux/schnell',
    validate: (value) => {
      if (!value) return { ok: true } // 有默认值
      return { ok: true }
    }
  },
  // PayPal
  'PAYPAL_CLIENT_ID': {
    category: 'PayPal',
    description: 'PayPal 客户端 ID',
    devValue: 'sb-xxxxx',
    vercelValue: 'sb-xxxxx (preview) / AeA1QIZXiflr1_xxxxx (prod)',
    validate: (value) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      return { ok: true }
    },
    sensitive: true
  },
  'PAYPAL_CLIENT_SECRET': {
    category: 'PayPal',
    description: 'PayPal 客户端密钥',
    devValue: 'xxxxx',
    vercelValue: 'xxxxx',
    validate: (value) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      return { ok: true }
    },
    sensitive: true
  },
  'PAYPAL_WEBHOOK_ID': {
    category: 'PayPal',
    description: 'PayPal Webhook ID',
    devValue: 'xxxxx',
    vercelValue: 'xxxxx',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      return { ok: true }
    }
  },
  'PAYPAL_ENV': {
    category: 'PayPal',
    description: 'PayPal 环境',
    devValue: 'sandbox',
    vercelValue: 'sandbox (preview) / production (prod)',
    validate: (value) => {
      if (!value) return { ok: true } // 有自动检测
      if (!['sandbox', 'production'].includes(value)) {
        return { ok: false, reason: 'SUSPECT', message: '应为 sandbox 或 production' }
      }
      return { ok: true }
    }
  },
  // Feature Flag
  'GEN_PROVIDER_PRIMARY': {
    category: 'Feature Flag',
    description: '主要生成提供商',
    devValue: 'fal',
    vercelValue: 'fal',
    validate: (value) => {
      if (!value) return { ok: true } // 有默认值
      return { ok: true }
    }
  },
  'GEN_PROVIDER_WEIGHTS': {
    category: 'Feature Flag',
    description: '提供商权重配置（JSON）',
    devValue: '{"fal":0,"runware":1}',
    vercelValue: "'{\"fal\":0,\"runware\":1}'",
    validate: (value, isVercel) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      try {
        // Vercel 可能用单引号包裹，需要先去除
        let jsonStr = value
        if (isVercel && value.startsWith("'") && value.endsWith("'")) {
          jsonStr = value.slice(1, -1)
        }
        const parsed = JSON.parse(jsonStr)
        if (typeof parsed !== 'object' || !parsed.hasOwnProperty('runware')) {
          return { ok: false, reason: 'SUSPECT', message: 'JSON 格式错误或缺少 runware key' }
        }
        if (typeof parsed.runware !== 'number' || parsed.runware < 0 || parsed.runware > 1) {
          return { ok: false, reason: 'SUSPECT', message: 'runware 权重应在 0-1 之间' }
        }
        return { ok: true }
      } catch (e) {
        return { ok: false, reason: 'SUSPECT', message: `JSON 解析失败: ${e.message}` }
      }
    }
  },
  'GEN_TIMEOUT_MS': {
    category: 'Feature Flag',
    description: '生成超时时间（毫秒）',
    devValue: '8000',
    vercelValue: '8000',
    validate: (value) => {
      if (!value) return { ok: true } // 有默认值
      const num = parseInt(value, 10)
      if (isNaN(num) || num < 1000) {
        return { ok: false, reason: 'SUSPECT', message: '应为大于 1000 的数字' }
      }
      return { ok: true }
    }
  },
  'GEN_RETRY': {
    category: 'Feature Flag',
    description: '重试次数',
    devValue: '2',
    vercelValue: '2',
    validate: (value) => {
      if (!value) return { ok: true } // 有默认值
      const num = parseInt(value, 10)
      if (isNaN(num) || num < 0) {
        return { ok: false, reason: 'SUSPECT', message: '应为非负整数' }
      }
      return { ok: true }
    }
  },
  'GEN_FAILOVER': {
    category: 'Feature Flag',
    description: '是否启用故障切换',
    devValue: 'true',
    vercelValue: 'true',
    validate: (value) => {
      if (!value) return { ok: true } // 有默认值
      if (!['true', 'false'].includes(value)) {
        return { ok: false, reason: 'SUSPECT', message: '应为 true 或 false' }
      }
      return { ok: true }
    }
  },
  // Domain
  'DOMAIN': {
    category: 'Domain',
    description: '应用域名',
    devValue: 'http://localhost:3000',
    vercelValue: 'https://family-mosaic-maker.vercel.app',
    validate: (value, isVercel) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      if (isVercel) {
        if (!value.startsWith('https://')) {
          return { ok: false, reason: 'SUSPECT', message: 'Vercel 环境必须使用 https://' }
        }
        if (value.includes('localhost')) {
          return { ok: false, reason: 'SUSPECT', message: 'Vercel 环境禁止使用 localhost' }
        }
      } else {
        // Dev 环境允许 localhost
        if (!value.startsWith('http://') && !value.startsWith('https://')) {
          return { ok: false, reason: 'SUSPECT', message: '应包含协议（http:// 或 https://）' }
        }
      }
      return { ok: true }
    }
  },
  'NEXT_PUBLIC_SITE_URL': {
    category: 'Domain',
    description: 'Magic Link redirect URL base（用于 Supabase Auth）',
    devValue: 'http://localhost:3000',
    vercelValue: 'https://family-mosaic-maker.vercel.app',
    validate: (value, isVercel) => {
      if (!value) {
        return { ok: false, reason: 'MISSING', message: '缺少此变量可能导致 Magic Link redirect_to 指向 preview domain' }
      }
      // 验证是否为有效的 URL 格式
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return { ok: false, reason: 'SUSPECT', message: '应包含协议（http:// 或 https://）' }
      }
      if (isVercel) {
        // Vercel 环境建议使用正式 domain
        if (value.includes('localhost')) {
          return { ok: false, reason: 'SUSPECT', message: 'Vercel 环境禁止使用 localhost' }
        }
        // 检查是否为 preview domain（包含随机字符串的 vercel.app）
        if (value.includes('.vercel.app') && value.match(/family-mosaic-maker-[a-z0-9-]+\.vercel\.app/)) {
          return { ok: false, reason: 'SUSPECT', message: '建议改为正式 domain: https://family-mosaic-maker.vercel.app' }
        }
        if (!value.startsWith('https://')) {
          return { ok: false, reason: 'SUSPECT', message: 'Vercel 环境必须使用 https://' }
        }
      }
      return { ok: true }
    }
  },
  // Feature Flag
  'NEXT_PUBLIC_USE_MOCK': {
    category: 'Feature Flag',
    description: '是否启用 Mock 模式',
    devValue: 'true',
    vercelValue: 'true (preview) / false (prod)',
    validate: (value, isVercel, envType) => {
      if (!value) return { ok: false, reason: 'MISSING' }
      if (!['true', 'false'].includes(value)) {
        return { ok: false, reason: 'SUSPECT', message: '应为 true 或 false' }
      }
      if (isVercel && envType === 'production' && value === 'true') {
        return { ok: false, reason: 'SUSPECT', message: 'Production 环境不应启用 Mock 模式' }
      }
      return { ok: true }
    }
  },
  'ALLOW_TEST_LOGIN': {
    category: 'QA & Test',
    description: '允许测试登录端点',
    devValue: 'true',
    vercelValue: 'false 或不设置',
    validate: (value, isVercel) => {
      if (isVercel && value === 'true') {
        return { ok: false, reason: 'SUSPECT', message: 'Vercel 环境不应启用测试登录' }
      }
      return { ok: true }
    }
  },
  // Analytics
  'NEXT_PUBLIC_GA4_MEASUREMENT_ID': {
    category: 'Analytics',
    description: 'Google Analytics 4 测量 ID',
    devValue: 'G-XXXXXX',
    vercelValue: 'G-XXXXXX',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      if (!value.startsWith('G-')) {
        return { ok: false, reason: 'SUSPECT', message: 'GA4 ID 应以 G- 开头' }
      }
      return { ok: true }
    }
  },
  // Incident
  'SLACK_WEBHOOK_URL': {
    category: 'Incident',
    description: 'Slack Webhook URL',
    devValue: 'https://hooks.slack.com/services/...',
    vercelValue: 'https://hooks.slack.com/services/...',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      if (!value.startsWith('https://hooks.slack.com/')) {
        return { ok: false, reason: 'SUSPECT', message: 'Slack Webhook URL 格式不正确' }
      }
      return { ok: true }
    },
    sensitive: true
  },
  'SLACK_ONCALL_CHANNEL': {
    category: 'Incident',
    description: 'Slack 告警频道',
    devValue: '#oncall',
    vercelValue: '#oncall',
    validate: (value) => {
      if (!value) return { ok: true } // 有默认值
      return { ok: true }
    }
  },
  // Monitoring
  'NEXT_PUBLIC_SENTRY_DSN': {
    category: 'Monitoring',
    description: 'Sentry DSN',
    devValue: 'https://xxxxx@sentry.io/xxxxx',
    vercelValue: 'https://xxxxx@sentry.io/xxxxx',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      if (!value.startsWith('https://') || !value.includes('@sentry.io/')) {
        return { ok: false, reason: 'SUSPECT', message: 'Sentry DSN 格式不正确' }
      }
      return { ok: true }
    },
    sensitive: true
  },
  'SENTRY_ORG': {
    category: 'Monitoring',
    description: 'Sentry 组织',
    devValue: 'your-org',
    vercelValue: 'your-org',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      return { ok: true }
    }
  },
  'SENTRY_PROJECT': {
    category: 'Monitoring',
    description: 'Sentry 项目',
    devValue: 'your-project',
    vercelValue: 'your-project',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      return { ok: true }
    }
  },
  'SENTRY_AUTH_TOKEN': {
    category: 'Monitoring',
    description: 'Sentry 认证令牌',
    devValue: 'xxxxx',
    vercelValue: 'xxxxx',
    validate: (value) => {
      if (!value) return { ok: true } // 可选
      return { ok: true }
    },
    sensitive: true
  }
}

/**
 * 读取 .env 文件
 */
function readEnvFile(filePath) {
  const env = {}
  if (!existsSync(filePath)) {
    return env
  }
  
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    
    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      let value = match[2].trim()
      // 移除引号
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  }
  
  return env
}

/**
 * 遮罩敏感值
 */
function maskValue(value, showLength = 4) {
  if (!value || value.length <= showLength) {
    return '***'
  }
  return value.substring(0, showLength) + '***'
}

/**
 * 检查 Vercel CLI 是否可用
 */
function checkVercelCLI() {
  try {
    execSync('which vercel', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * 尝试从 Vercel CLI 读取环境变量
 */
function getVercelEnv(envType = 'preview') {
  if (!checkVercelCLI()) {
    return null
  }
  
  try {
    const output = execSync(`vercel env ls ${envType} --json`, { 
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    const envs = JSON.parse(output)
    const result = {}
    for (const env of envs) {
      result[env.key] = env.value
    }
    return result
  } catch (error) {
    return null
  }
}

/**
 * 主函数
 */
function main() {
  console.log('='.repeat(60))
  console.log('Vercel 环境变量检查')
  console.log('='.repeat(60))
  console.log()
  
  // 读取本地环境变量
  const envLocal = readEnvFile(join(PROJECT_ROOT, '.env.local'))
  const envVercel = readEnvFile(join(PROJECT_ROOT, '.env.vercel'))
  
  // 尝试从 Vercel CLI 读取
  let vercelEnvPreview = null
  let vercelEnvProduction = null
  if (checkVercelCLI()) {
    console.log('📡 尝试从 Vercel CLI 读取环境变量...')
    vercelEnvPreview = getVercelEnv('preview')
    vercelEnvProduction = getVercelEnv('production')
    if (vercelEnvPreview || vercelEnvProduction) {
      console.log('✅ 成功从 Vercel CLI 读取环境变量')
    } else {
      console.log('⚠️  无法从 Vercel CLI 读取环境变量（可能需要登录）')
    }
    console.log()
  } else {
    console.log('⚠️  Vercel CLI 未安装或不可用')
    console.log()
  }
  
  // 检查 process.env（如果在 Vercel 环境中运行）
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  const vercelEnvType = process.env.VERCEL_ENV || (isVercel ? 'production' : null)
  const processEnv = isVercel ? process.env : {}
  
  // 合并 Vercel 环境变量（优先使用 CLI 读取的）
  const vercelEnv = vercelEnvPreview || vercelEnvProduction || envVercel || processEnv
  
  console.log('📋 环境变量检查结果')
  console.log('-'.repeat(60))
  console.log()
  
  // 表格头部
  console.log(
    '变量名称'.padEnd(30) +
    '本地(.env.local)'.padEnd(18) +
    'Vercel'.padEnd(18) +
    '状态'.padEnd(15) +
    '备注'
  )
  console.log('-'.repeat(100))
  
  const results = {
    local: { missing: [], suspect: [] },
    vercel: { missing: [], suspect: [] }
  }
  
  // 检查每个环境变量
  for (const [key, spec] of Object.entries(ENV_SPEC)) {
    const localValue = envLocal[key]
    const vercelValue = vercelEnv[key]
    
    const localExists = !!localValue
    const vercelExists = !!vercelValue
    
    // 验证本地值
    let localStatus = 'OK'
    let localNote = ''
    if (localExists) {
      const validation = spec.validate(localValue, false, null)
      if (!validation.ok) {
        localStatus = validation.reason
        localNote = validation.message || ''
        if (validation.reason === 'MISSING') {
          results.local.missing.push(key)
        } else {
          results.local.suspect.push({ key, reason: validation.reason, message: localNote })
        }
      }
    } else {
      localStatus = 'MISSING'
      results.local.missing.push(key)
    }
    
    // 验证 Vercel 值
    let vercelStatus = 'OK'
    let vercelNote = ''
    if (vercelExists) {
      const validation = spec.validate(vercelValue, true, vercelEnvType)
      if (!validation.ok) {
        vercelStatus = validation.reason
        vercelNote = validation.message || ''
        if (validation.reason === 'MISSING') {
          results.vercel.missing.push(key)
        } else {
          results.vercel.suspect.push({ key, reason: validation.reason, message: vercelNote })
        }
      }
    } else {
      vercelStatus = 'MISSING'
      // 某些变量在 Vercel 中是可选的
      if (['ALLOW_TEST_LOGIN', 'BASE_URL', 'DATABASE_URL'].includes(key)) {
        vercelStatus = 'OK (可选)'
      } else {
        results.vercel.missing.push(key)
      }
    }
    
    // 显示值（遮罩敏感信息）
    const localDisplay = localExists 
      ? (spec.sensitive ? maskValue(localValue) : localValue.substring(0, 30))
      : '否'
    const vercelDisplay = vercelExists
      ? (spec.sensitive ? maskValue(vercelValue) : vercelValue.substring(0, 30))
      : '否'
    
    // 状态显示
    const statusDisplay = localStatus === 'OK' && vercelStatus === 'OK' 
      ? '✅ OK'
      : localStatus !== 'OK' && vercelStatus !== 'OK'
        ? '❌ 两者都有问题'
        : localStatus !== 'OK'
          ? '⚠️  本地有问题'
          : '⚠️  Vercel有问题'
    
    const note = localNote || vercelNote || ''
    
    console.log(
      key.padEnd(30) +
      (localExists ? '是' : '否').padEnd(18) +
      (vercelExists ? '是' : '否').padEnd(18) +
      statusDisplay.padEnd(15) +
      note
    )
  }
  
  console.log()
  console.log('='.repeat(60))
  console.log('📊 总结')
  console.log('='.repeat(60))
  console.log()
  
  // 本地环境总结
  console.log('🔵 本地开发环境 (.env.local):')
  if (results.local.missing.length === 0 && results.local.suspect.length === 0) {
    console.log('  ✅ 所有必需变量已正确设置')
  } else {
    if (results.local.missing.length > 0) {
      console.log(`  ❌ 缺少变量 (${results.local.missing.length}):`)
      for (const key of results.local.missing) {
        const spec = ENV_SPEC[key]
        console.log(`     - ${key} (${spec.category}): ${spec.description}`)
        console.log(`       建议值: ${spec.devValue}`)
      }
    }
    if (results.local.suspect.length > 0) {
      console.log(`  ⚠️  可疑变量 (${results.local.suspect.length}):`)
      for (const item of results.local.suspect) {
        console.log(`     - ${item.key}: ${item.message || item.reason}`)
      }
    }
  }
  console.log()
  
  // Vercel 环境总结
  console.log('🟢 Vercel 环境:')
  if (results.vercel.missing.length === 0 && results.vercel.suspect.length === 0) {
    console.log('  ✅ 所有必需变量已正确设置')
  } else {
    if (results.vercel.missing.length > 0) {
      console.log(`  ❌ 缺少变量 (${results.vercel.missing.length}):`)
      for (const key of results.vercel.missing) {
        const spec = ENV_SPEC[key]
        console.log(`     - ${key} (${spec.category}): ${spec.description}`)
        console.log(`       建议值: ${spec.vercelValue}`)
      }
    }
    if (results.vercel.suspect.length > 0) {
      console.log(`  ⚠️  可疑变量 (${results.vercel.suspect.length}):`)
      for (const item of results.vercel.suspect) {
        console.log(`     - ${item.key}: ${item.message || item.reason}`)
      }
    }
  }
  console.log()
  
  // Vercel CLI 提示
  if (!checkVercelCLI() || (!vercelEnvPreview && !vercelEnvProduction)) {
    console.log('⚠️  无法通过 Vercel CLI 读取远程环境变量')
    console.log('   请手动在 Vercel Dashboard 中比对环境变量与 /docs/vercel-env-spec.md')
    console.log()
  }
  
  // 退出码
  const hasErrors = (results.local.missing.length > 0 || results.local.suspect.length > 0) ||
                    (results.vercel.missing.length > 0 || results.vercel.suspect.length > 0)
  process.exit(hasErrors ? 1 : 0)
}

main()

