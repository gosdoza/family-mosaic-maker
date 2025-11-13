#!/usr/bin/env node

/**
 * Vercel 线上环境健检脚本
 * 检查 Preview 和 Production 环境的健康状态
 */

import { execSync } from 'child_process'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

/**
 * 遮罩敏感值
 */
function maskSensitive(obj, path = '') {
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  
  const sensitiveKeys = ['key', 'secret', 'token', 'password', 'api_key', 'anon_key', 'service_role_key']
  const masked = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = sensitiveKeys.some(sk => lowerKey.includes(sk))
    
    if (isSensitive && typeof value === 'string') {
      masked[key] = value.length > 4 ? value.substring(0, 4) + '***' : '***'
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitive(value, `${path}.${key}`)
    } else {
      masked[key] = value
    }
  }
  
  return masked
}

/**
 * 执行 curl 请求
 */
function curl(url, options = {}) {
  try {
    const method = options.method || 'GET'
    const headers = options.headers || {}
    const body = options.body
    
    let cmd = `curl -s -w "\\nHTTP_CODE:%{http_code}" -X ${method}`
    
    for (const [key, value] of Object.entries(headers)) {
      cmd += ` -H "${key}: ${value}"`
    }
    
    if (body) {
      cmd += ` -d '${JSON.stringify(body)}'`
    }
    
    cmd += ` "${url}"`
    
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' })
    const parts = output.split('HTTP_CODE:')
    const bodyText = parts[0].trim()
    const statusCode = parseInt(parts[1]?.trim() || '0', 10)
    
    let jsonBody = null
    try {
      jsonBody = JSON.parse(bodyText)
    } catch {
      jsonBody = bodyText
    }
    
    return {
      status: statusCode,
      body: jsonBody,
      raw: bodyText
    }
  } catch (error) {
    return {
      status: 0,
      body: null,
      error: error.message,
      raw: ''
    }
  }
}

/**
 * 获取 Preview URL
 */
function getPreviewUrl() {
  try {
    const output = execSync('vercel ls', { encoding: 'utf-8', stdio: 'pipe' })
    const urls = output.match(/https:\/\/[a-zA-Z0-9\-\.]+\.vercel\.app/g) || []
    const previewUrl = urls.find(url => !url.includes('family-mosaic-maker.vercel.app'))
    return previewUrl || null
  } catch {
    return null
  }
}

/**
 * 读取环境变量
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
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      value = value.replace(/\\n/g, '').replace(/\n/g, '').trim()
      env[key] = value
    }
  }
  
  return env
}

/**
 * 主函数
 */
function main() {
  console.log('='.repeat(100))
  console.log('Vercel 线上环境健检')
  console.log('='.repeat(100))
  console.log()
  
  // 读取环境变量
  const envPreview = readEnvFile(join(PROJECT_ROOT, '.env.vercel.preview'))
  const envProd = readEnvFile(join(PROJECT_ROOT, '.env.vercel.prod'))
  
  // 获取 URL
  const previewUrl = getPreviewUrl()
  const prodUrl = 'https://family-mosaic-maker.vercel.app'
  
  const report = {
    preview: {
      url: previewUrl || '暂未找到（请检查 Vercel 部署）',
      health: null,
      testLogin: null,
      useMock: envPreview['NEXT_PUBLIC_USE_MOCK'] || 'unknown',
      allowTestLogin: envPreview['ALLOW_TEST_LOGIN'] || 'unknown'
    },
    production: {
      url: prodUrl,
      health: null,
      testLogin: null,
      useMock: envProd['NEXT_PUBLIC_USE_MOCK'] || 'unknown',
      allowTestLogin: envProd['ALLOW_TEST_LOGIN'] || 'unknown'
    }
  }
  
  // 检查 Preview
  console.log('📋 Preview 环境检查')
  console.log('-'.repeat(100))
  console.log(`URL: ${report.preview.url}`)
  console.log(`NEXT_PUBLIC_USE_MOCK: ${report.preview.useMock}`)
  console.log(`ALLOW_TEST_LOGIN: ${report.preview.allowTestLogin}`)
  console.log()
  
  if (previewUrl) {
    // Health check
    console.log('1. 健康检查: GET /api/health')
    const healthResponse = curl(`${previewUrl}/api/health`)
    report.preview.health = {
      status: healthResponse.status,
      body: healthResponse.body
    }
    console.log(`   HTTP Status: ${healthResponse.status}`)
    if (healthResponse.body) {
      const maskedBody = maskSensitive(healthResponse.body)
      console.log(`   Response: ${JSON.stringify(maskedBody, null, 2)}`)
      
      if (healthResponse.body.overall) {
        console.log(`   overall.ok: ${healthResponse.body.overall.ok}`)
      }
      if (healthResponse.body.providers?.runware) {
        console.log(`   providers.runware.ok: ${healthResponse.body.providers.runware.ok}`)
      }
    } else {
      console.log(`   Response: ${healthResponse.raw || healthResponse.error}`)
    }
    console.log()
    
    // Test login
    console.log('2. 测试登录端点: POST /api/test/login')
    if (report.preview.allowTestLogin === 'true') {
      const testLoginResponse = curl(`${previewUrl}/api/test/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { email: 'test@example.com' }
      })
      report.preview.testLogin = {
        status: testLoginResponse.status,
        body: testLoginResponse.body
      }
      console.log(`   HTTP Status: ${testLoginResponse.status}`)
      if (testLoginResponse.body) {
        const maskedBody = maskSensitive(testLoginResponse.body)
        console.log(`   Response: ${JSON.stringify(maskedBody, null, 2)}`)
      } else {
        console.log(`   Response: ${testLoginResponse.raw || testLoginResponse.error}`)
      }
    } else {
      // 检查 404/401 是否合理
      const testLoginResponse = curl(`${previewUrl}/api/test/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: { email: 'test@example.com' }
      })
      report.preview.testLogin = {
        status: testLoginResponse.status,
        expected: '404 或 401（ALLOW_TEST_LOGIN=false 时合理）',
        body: testLoginResponse.body
      }
      console.log(`   HTTP Status: ${testLoginResponse.status}`)
      if (testLoginResponse.status === 404 || testLoginResponse.status === 401) {
        console.log(`   ✅ 合理（ALLOW_TEST_LOGIN=false，端点应不可用）`)
      } else {
        console.log(`   ⚠️  预期 404 或 401，实际: ${testLoginResponse.status}`)
      }
    }
    console.log()
  } else {
    console.log('⚠️  无法获取 Preview URL，跳过检查')
    console.log()
  }
  
  // 检查 Production
  console.log('📋 Production 环境检查')
  console.log('-'.repeat(100))
  console.log(`URL: ${report.production.url}`)
  console.log(`NEXT_PUBLIC_USE_MOCK: ${report.production.useMock}`)
  console.log(`ALLOW_TEST_LOGIN: ${report.production.allowTestLogin}`)
  if (report.production.useMock === 'false') {
    console.log('⚠️  注意: 这是实际 Runware / PayPal 路径，请小心测试')
  }
  console.log()
  
  // Health check
  console.log('1. 健康检查: GET /api/health')
  const prodHealthResponse = curl(`${prodUrl}/api/health`)
  report.production.health = {
    status: prodHealthResponse.status,
    body: prodHealthResponse.body
  }
  console.log(`   HTTP Status: ${prodHealthResponse.status}`)
  if (prodHealthResponse.body) {
    const maskedBody = maskSensitive(prodHealthResponse.body)
    console.log(`   Response: ${JSON.stringify(maskedBody, null, 2)}`)
    
    if (prodHealthResponse.body.overall) {
      console.log(`   overall.ok: ${prodHealthResponse.body.overall.ok}`)
    }
    if (prodHealthResponse.body.providers?.runware) {
      console.log(`   providers.runware.ok: ${prodHealthResponse.body.providers.runware.ok}`)
    }
  } else {
    console.log(`   Response: ${prodHealthResponse.raw || prodHealthResponse.error}`)
  }
  console.log()
  
  // Test login
  console.log('2. 测试登录端点: POST /api/test/login')
  if (report.production.allowTestLogin === 'true') {
    const prodTestLoginResponse = curl(`${prodUrl}/api/test/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { email: 'test@example.com' }
    })
    report.production.testLogin = {
      status: prodTestLoginResponse.status,
      body: prodTestLoginResponse.body
    }
    console.log(`   HTTP Status: ${prodTestLoginResponse.status}`)
    if (prodTestLoginResponse.body) {
      const maskedBody = maskSensitive(prodTestLoginResponse.body)
      console.log(`   Response: ${JSON.stringify(maskedBody, null, 2)}`)
    } else {
      console.log(`   Response: ${prodTestLoginResponse.raw || prodTestLoginResponse.error}`)
    }
  } else {
    // 检查 404/401 是否合理
    const prodTestLoginResponse = curl(`${prodUrl}/api/test/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: { email: 'test@example.com' }
    })
    report.production.testLogin = {
      status: prodTestLoginResponse.status,
      expected: '404 或 401（ALLOW_TEST_LOGIN=false 时合理）',
      body: prodTestLoginResponse.body
    }
    console.log(`   HTTP Status: ${prodTestLoginResponse.status}`)
    if (prodTestLoginResponse.status === 404 || prodTestLoginResponse.status === 401) {
      console.log(`   ✅ 合理（ALLOW_TEST_LOGIN=false，端点应不可用）`)
    } else {
      console.log(`   ⚠️  预期 404 或 401，实际: ${prodTestLoginResponse.status}`)
    }
  }
  console.log()
  
  // 生成报告
  return report
}

const report = main()


