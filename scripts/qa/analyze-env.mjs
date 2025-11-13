#!/usr/bin/env node

/**
 * 环境变量分析脚本
 * 读取 .env.local 和 Vercel 环境变量，生成对比报告
 */

import { readFileSync, existsSync } from 'fs'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

// 从 spec 文档读取环境变量规范
const ENV_SPEC = {
  'NEXT_PUBLIC_SUPABASE_URL': { category: 'Supabase', required: true },
  'NEXT_PUBLIC_SUPABASE_ANON_KEY': { category: 'Supabase', required: true },
  'SUPABASE_SERVICE_ROLE_KEY': { category: 'Supabase', required: true },
  'FAL_API_KEY': { category: 'FAL', required: false },
  'FAL_MODEL_ID': { category: 'FAL', required: false },
  'RUNWARE_API_KEY': { category: 'Runware', required: false },
  'RUNWARE_BASE_URL': { category: 'Runware', required: false },
  'PAYPAL_CLIENT_ID': { category: 'PayPal', required: false },
  'PAYPAL_CLIENT_SECRET': { category: 'PayPal', required: false },
  'PAYPAL_WEBHOOK_ID': { category: 'PayPal', required: false },
  'PAYPAL_ENV': { category: 'PayPal', required: false },
  'GEN_PROVIDER_PRIMARY': { category: 'Feature Flag', required: false },
  'GEN_PROVIDER_WEIGHTS': { category: 'Feature Flag', required: false },
  'GEN_TIMEOUT_MS': { category: 'Feature Flag', required: false },
  'GEN_RETRY': { category: 'Feature Flag', required: false },
  'GEN_FAILOVER': { category: 'Feature Flag', required: false },
  'DOMAIN': { category: 'Domain', required: true },
  'NEXT_PUBLIC_USE_MOCK': { category: 'Feature Flag', required: true },
  'ALLOW_TEST_LOGIN': { category: 'QA & Test', required: false },
  'NEXT_PUBLIC_GA4_MEASUREMENT_ID': { category: 'Analytics', required: false },
  'SLACK_WEBHOOK_URL': { category: 'Incident', required: false },
  'SLACK_ONCALL_CHANNEL': { category: 'Incident', required: false },
  'NEXT_PUBLIC_SENTRY_DSN': { category: 'Monitoring', required: false },
  'SENTRY_ORG': { category: 'Monitoring', required: false },
  'SENTRY_PROJECT': { category: 'Monitoring', required: false },
  'SENTRY_AUTH_TOKEN': { category: 'Monitoring', required: false },
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
      // 移除引号（包括双引号和单引号）
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      // 移除换行符和转义字符
      value = value.replace(/\\n/g, '').replace(/\n/g, '').trim()
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
 * 验证值格式
 */
function validateFormat(key, value) {
  if (!value) return { ok: false, reason: '空值' }
  
  switch (key) {
    case 'DOMAIN':
      if (value.includes('localhost')) {
        return { ok: true, reason: '本地开发允许 localhost' }
      }
      if (!value.startsWith('http://') && !value.startsWith('https://')) {
        return { ok: false, reason: '缺少协议' }
      }
      return { ok: true }
    
    case 'GEN_PROVIDER_WEIGHTS':
      try {
        let jsonStr = value
        if (value.startsWith("'") && value.endsWith("'")) {
          jsonStr = value.slice(1, -1)
        }
        JSON.parse(jsonStr)
        return { ok: true }
      } catch (e) {
        return { ok: false, reason: 'JSON 格式错误' }
      }
    
    case 'NEXT_PUBLIC_SUPABASE_URL':
      if (!value.includes('supabase.co')) {
        return { ok: false, reason: '格式不正确' }
      }
      return { ok: true }
    
    case 'NEXT_PUBLIC_USE_MOCK':
      if (!['true', 'false'].includes(value)) {
        return { ok: false, reason: '应为 true 或 false' }
      }
      return { ok: true }
    
    default:
      return { ok: true }
  }
}

/**
 * 主函数
 */
function main() {
  console.log('='.repeat(80))
  console.log('环境变量分析报告')
  console.log('='.repeat(80))
  console.log()
  
  // 1. 读取本地 .env.local
  console.log('📋 步骤 1: 分析本地 .env.local')
  console.log('-'.repeat(80))
  const envLocal = readEnvFile(join(PROJECT_ROOT, '.env.local'))
  
  console.log('变量名称'.padEnd(35) + '本机是否存在'.padEnd(18) + '格式是否合理'.padEnd(18) + '备注')
  console.log('-'.repeat(80))
  
  const localKeys = Object.keys(envLocal).sort()
  for (const key of localKeys) {
    const exists = '✅ 是'
    const value = envLocal[key]
    const validation = validateFormat(key, value)
    const formatOk = validation.ok ? '✅ 是' : `❌ 否 (${validation.reason})`
    const displayValue = (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN') || key.includes('DSN'))
      ? maskValue(value)
      : value.substring(0, 30)
    const note = validation.ok ? '' : validation.reason
    
    console.log(
      key.padEnd(35) +
      exists.padEnd(18) +
      formatOk.padEnd(18) +
      note
    )
  }
  console.log()
  
  // 2. 检查 Vercel CLI 并拉取环境变量
  console.log('📋 步骤 2: 从 Vercel 拉取环境变量')
  console.log('-'.repeat(80))
  
  let vercelLoggedIn = false
  try {
    execSync('vercel whoami', { stdio: 'ignore' })
    vercelLoggedIn = true
    console.log('✅ Vercel CLI 已登录')
  } catch {
    console.log('⚠️  Vercel CLI 未登录，请执行: vercel login')
    console.log('   跳过 Vercel 环境变量拉取')
  }
  
  let envPreview = {}
  let envProd = {}
  
  if (vercelLoggedIn) {
    try {
      console.log('📥 拉取 Preview 环境变量...')
      execSync('vercel env pull .env.vercel.preview --environment=preview --yes', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe'
      })
      envPreview = readEnvFile(join(PROJECT_ROOT, '.env.vercel.preview'))
      console.log(`✅ Preview 环境变量已拉取 (${Object.keys(envPreview).length} 个变量)`)
    } catch (error) {
      console.log('⚠️  无法拉取 Preview 环境变量:', error.message)
    }
    
    try {
      console.log('📥 拉取 Production 环境变量...')
      execSync('vercel env pull .env.vercel.prod --environment=production --yes', {
        cwd: PROJECT_ROOT,
        stdio: 'pipe'
      })
      envProd = readEnvFile(join(PROJECT_ROOT, '.env.vercel.prod'))
      console.log(`✅ Production 环境变量已拉取 (${Object.keys(envProd).length} 个变量)`)
    } catch (error) {
      console.log('⚠️  无法拉取 Production 环境变量:', error.message)
    }
  }
  console.log()
  
  // 3. 生成总表
  console.log('📋 步骤 3: 环境变量对比总表')
  console.log('-'.repeat(80))
  console.log(
    '变量名称'.padEnd(35) +
    '本机'.padEnd(10) +
    'Preview'.padEnd(10) +
    'Prod'.padEnd(10) +
    '备注'
  )
  console.log('-'.repeat(80))
  
  // 合并所有可能的 key
  const allKeys = new Set([
    ...Object.keys(ENV_SPEC),
    ...Object.keys(envLocal),
    ...Object.keys(envPreview),
    ...Object.keys(envProd)
  ])
  
  const missingLocal = []
  const missingPreview = []
  const missingProd = []
  const issues = []
  
  for (const key of Array.from(allKeys).sort()) {
    const spec = ENV_SPEC[key] || { category: 'Other', required: false }
    const localExists = envLocal.hasOwnProperty(key) ? '✅ 有' : '❌ 无'
    const previewExists = envPreview.hasOwnProperty(key) ? '✅ 有' : '❌ 无'
    const prodExists = envProd.hasOwnProperty(key) ? '✅ 有' : '❌ 无'
    
    let note = ''
    if (spec.required) {
      if (!envLocal[key]) {
        missingLocal.push(key)
        note += '本地缺少(必需); '
      }
      if (!envPreview[key]) {
        missingPreview.push(key)
        note += 'Preview缺少(必需); '
      }
      if (!envProd[key]) {
        missingProd.push(key)
        note += 'Prod缺少(必需); '
      }
    }
    
    // 特殊检查
    if (key === 'GEN_PROVIDER_WEIGHTS') {
      const localVal = envLocal[key]
      const previewVal = envPreview[key]
      const prodVal = envProd[key]
      if (localVal && !localVal.match(/^\{"fal":/)) {
        note += '本地格式建议: {"fal":0,"runware":1}; '
      }
      if (previewVal && !previewVal.match(/^'?\{/)) {
        note += 'Preview格式建议: \'{"fal":0,"runware":1}\'; '
      }
      if (prodVal && !prodVal.match(/^'?\{/)) {
        note += 'Prod格式建议: \'{"fal":0,"runware":1}\'; '
      }
    }
    
    if (key === 'DOMAIN') {
      const previewVal = envPreview[key]
      const prodVal = envProd[key]
      if (previewVal && (previewVal.includes('localhost') || !previewVal.startsWith('https://'))) {
        note += 'Preview DOMAIN 必须 https 且不含 localhost; '
        issues.push('Preview DOMAIN 格式错误')
      }
      if (prodVal && (prodVal.includes('localhost') || !prodVal.startsWith('https://'))) {
        note += 'Prod DOMAIN 必须 https 且不含 localhost; '
        issues.push('Prod DOMAIN 格式错误')
      }
    }
    
    if (key === 'NEXT_PUBLIC_USE_MOCK') {
      const previewVal = envPreview[key]
      const prodVal = envProd[key]
      if (previewVal && previewVal !== 'true') {
        note += 'Preview 应为 true; '
        issues.push('Preview NEXT_PUBLIC_USE_MOCK 应为 true')
      }
      if (prodVal && prodVal !== 'false') {
        note += 'Prod 应为 false; '
        issues.push('Prod NEXT_PUBLIC_USE_MOCK 应为 false')
      }
    }
    
    if (!note) {
      note = spec.required ? '' : '(可选)'
    }
    
    console.log(
      key.padEnd(35) +
      localExists.padEnd(10) +
      previewExists.padEnd(10) +
      prodExists.padEnd(10) +
      note
    )
  }
  console.log()
  
  // 4. 三行总结
  console.log('='.repeat(80))
  console.log('📊 三行总结')
  console.log('='.repeat(80))
  console.log()
  
  // 核心变量列表
  const coreVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 
                     'SUPABASE_SERVICE_ROLE_KEY', 'DOMAIN', 'NEXT_PUBLIC_USE_MOCK']
  const optionalVars = Object.keys(ENV_SPEC).filter(k => !ENV_SPEC[k].required)
  
  const missingCoreLocal = coreVars.filter(k => !envLocal[k])
  const missingOptionalLocal = optionalVars.filter(k => !envLocal[k])
  
  console.log('1. 本机 env 状态:')
  if (missingCoreLocal.length === 0) {
    console.log('   ✅ 核心变量完整')
  } else {
    console.log(`   ❌ 缺少核心变量: ${missingCoreLocal.join(', ')}`)
  }
  if (missingOptionalLocal.length > 0) {
    console.log(`   ⚠️  缺少可选变量 (${missingOptionalLocal.length}): ${missingOptionalLocal.slice(0, 5).join(', ')}${missingOptionalLocal.length > 5 ? '...' : ''}`)
  }
  console.log()
  
  console.log('2. Vercel Preview env 状态:')
  const previewCore = coreVars.filter(k => envPreview[k])
  const previewHasRunware = !!envPreview['RUNWARE_API_KEY']
  const previewHasPaypal = !!envPreview['PAYPAL_CLIENT_ID']
  const previewUseMock = envPreview['NEXT_PUBLIC_USE_MOCK'] === 'true'
  
  if (previewCore.length === coreVars.length && previewUseMock) {
    console.log('   ✅ 核心变量完整，Mock 模式已启用')
  } else {
    console.log(`   ⚠️  核心变量: ${previewCore.length}/${coreVars.length} 个`)
    if (!previewUseMock) {
      console.log('   ❌ NEXT_PUBLIC_USE_MOCK 应为 true')
    }
  }
  console.log(`   ${previewHasRunware ? '✅' : '❌'} Runware API Key: ${previewHasRunware ? '有' : '无'} (${previewUseMock ? 'Mock 模式不需要' : '需要'})`)
  console.log(`   ${previewHasPaypal ? '✅' : '⚠️ '} PayPal: ${previewHasPaypal ? '有' : '无'} (可选)`)
  console.log()
  
  console.log('3. Vercel Production env 状态:')
  const prodCore = coreVars.filter(k => envProd[k])
  const prodHasRunware = !!envProd['RUNWARE_API_KEY']
  const prodHasPaypal = !!envProd['PAYPAL_CLIENT_ID']
  const prodUseMock = envProd['NEXT_PUBLIC_USE_MOCK'] === 'false'
  const prodDomain = envProd['DOMAIN']
  const prodDomainOk = prodDomain && prodDomain.startsWith('https://') && !prodDomain.includes('localhost')
  
  if (prodCore.length === coreVars.length && prodUseMock && prodDomainOk) {
    console.log('   ✅ 核心变量完整，Mock 模式已关闭，DOMAIN 格式正确')
  } else {
    console.log(`   ⚠️  核心变量: ${prodCore.length}/${coreVars.length} 个`)
    if (!prodUseMock) {
      console.log('   ❌ NEXT_PUBLIC_USE_MOCK 应为 false')
    }
    if (!prodDomainOk) {
      console.log('   ❌ DOMAIN 必须 https 且不含 localhost')
    }
  }
  console.log(`   ${prodHasRunware ? '✅' : '❌'} Runware API Key: ${prodHasRunware ? '有' : '无'} (${prodHasRunware ? '可正常产图' : '无法产图'})`)
  console.log(`   ${prodHasPaypal ? '✅' : '❌'} PayPal: ${prodHasPaypal ? '有' : '无'} (${prodHasPaypal ? '可正常支付' : '无法支付'})`)
  console.log()
  
  if (issues.length > 0) {
    console.log('⚠️  发现的问题:')
    for (const issue of issues) {
      console.log(`   - ${issue}`)
    }
    console.log()
  }
}

main()

