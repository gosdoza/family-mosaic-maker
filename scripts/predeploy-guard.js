#!/usr/bin/env node
/**
 * Pre-deploy Guard Script
 * 
 * 在部署前检查必要的环境变量
 * 如果 target=Production 且 USE_MOCK=false → 必须存在非空的 FAL_API_KEY
 * 如果所有权重 >0 的供应商任一不可用（缺 Key）→ 阻挡部署
 * 否则退出非零码，阻止部署
 */

const fs = require('fs')
const path = require('path')

// 从环境变量获取配置
const target = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development'
const useMock = process.env.NEXT_PUBLIC_USE_MOCK === 'true' || process.env.USE_MOCK === 'true'
const falApiKey = process.env.FAL_API_KEY
const runwareApiKey = process.env.RUNWARE_API_KEY

/**
 * 解析供应商权重配置
 */
function parseProviderWeights() {
  const weightsEnv = process.env.GEN_PROVIDER_WEIGHTS
  if (!weightsEnv) {
    return { fal: 1.0, runware: 0.0 } // 默认权重
  }

  try {
    const weights = JSON.parse(weightsEnv)
    // 归一化权重
    const total = (weights.fal || 0) + (weights.runware || 0)
    if (total === 0) {
      return { fal: 1.0, runware: 0.0 }
    }
    return {
      fal: (weights.fal || 0) / total,
      runware: (weights.runware || 0) / total,
    }
  } catch (error) {
    console.error('⚠️  无法解析 GEN_PROVIDER_WEIGHTS，使用默认权重')
    return { fal: 1.0, runware: 0.0 }
  }
}

/**
 * 检查权重 >0 的供应商是否有 API Key
 */
function checkWeightedProviders() {
  const weights = parseProviderWeights()
  const errors = []

  // 检查 FAL
  if (weights.fal > 0) {
    if (!falApiKey || falApiKey.trim() === '') {
      errors.push(`❌ FAL 权重为 ${weights.fal}，但 FAL_API_KEY 未配置`)
    } else {
      console.log(`✅ FAL 权重 ${weights.fal}，FAL_API_KEY 已配置`)
    }
  }

  // 检查 Runware
  if (weights.runware > 0) {
    if (!runwareApiKey || runwareApiKey.trim() === '') {
      errors.push(`❌ Runware 权重为 ${weights.runware}，但 RUNWARE_API_KEY 未配置`)
    } else {
      console.log(`✅ Runware 权重 ${weights.runware}，RUNWARE_API_KEY 已配置`)
    }
  }

  return errors
}

// 检查逻辑
function checkPreDeploy() {
  const errors = []
  const warnings = []

  // 如果是 Production 环境
  if (target === 'production') {
    // 如果 NEXT_PUBLIC_USE_MOCK=false，检查权重 >0 的供应商
    if (!useMock) {
      // 检查所有权重 >0 的供应商是否有 API Key
      const providerErrors = checkWeightedProviders()
      errors.push(...providerErrors)

      // 如果没有配置任何供应商，至少需要 FAL_API_KEY（向后兼容）
      const weights = parseProviderWeights()
      if (weights.fal === 0 && weights.runware === 0) {
        if (!falApiKey || falApiKey.trim() === '') {
          errors.push('❌ Production 环境且 NEXT_PUBLIC_USE_MOCK=false 时，必须配置至少一个供应商的 API Key（FAL_API_KEY 或 RUNWARE_API_KEY）')
        }
      }
    } else {
      // Production 使用 Mock 模式只警告，不阻止
      warnings.push('⚠️  Production 环境使用 NEXT_PUBLIC_USE_MOCK=true（Mock 模式），这是封测期允许的')
    }
  }

  // 如果是 Preview 环境
  if (target === 'preview') {
    const weights = parseProviderWeights()
    if (weights.fal > 0 && (!falApiKey || falApiKey.trim() === '')) {
      warnings.push('⚠️  Preview 环境 FAL 权重 >0 但未配置 FAL_API_KEY，将使用 Mock 模式')
    }
    if (weights.runware > 0 && (!runwareApiKey || runwareApiKey.trim() === '')) {
      warnings.push('⚠️  Preview 环境 Runware 权重 >0 但未配置 RUNWARE_API_KEY，将使用 Mock 模式')
    }
  }

  // 输出结果
  if (warnings.length > 0) {
    console.log('\n⚠️  警告:')
    warnings.forEach(warning => console.log(`  ${warning}`))
  }

  if (errors.length > 0) {
    console.error('\n❌ 错误:')
    errors.forEach(error => console.error(`  ${error}`))
    console.error('\n部署被阻止。请配置缺失的 API Key 或设置 NEXT_PUBLIC_USE_MOCK=true')
    process.exit(1)
  }

  console.log('\n✅ Pre-deploy 检查通过')
  process.exit(0)
}

// 运行检查
checkPreDeploy()

