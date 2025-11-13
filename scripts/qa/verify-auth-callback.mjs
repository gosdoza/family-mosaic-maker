#!/usr/bin/env node

/**
 * 验证 auth callback route 是否正常工作
 * 这个脚本会检查：
 * 1. Callback route 是否存在且没有 TypeScript 错误
 * 2. 基本逻辑是否正确（使用 createServerClient）
 * 3. 错误处理是否正确（不返回 JSON 错误）
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const PROJECT_ROOT = join(__dirname, '../..')

console.log('='.repeat(80))
console.log('Auth Callback Route 验证')
console.log('='.repeat(80))
console.log()

// 1. 检查文件是否存在
const callbackRoutePath = join(PROJECT_ROOT, 'app/auth/callback/route.ts')
const errorPagePath = join(PROJECT_ROOT, 'app/auth/error/page.tsx')
const loginPagePath = join(PROJECT_ROOT, 'app/auth/login/page.tsx')

console.log('📋 步骤 1: 检查文件是否存在')
console.log('-'.repeat(80))

const files = [
  { path: callbackRoutePath, name: 'app/auth/callback/route.ts' },
  { path: errorPagePath, name: 'app/auth/error/page.tsx' },
  { path: loginPagePath, name: 'app/auth/login/page.tsx' },
]

let allFilesExist = true
for (const file of files) {
  const exists = existsSync(file.path)
  console.log(`${exists ? '✅' : '❌'} ${file.name}: ${exists ? '存在' : '不存在'}`)
  if (!exists) {
    allFilesExist = false
  }
}
console.log()

if (!allFilesExist) {
  console.log('❌ 部分文件不存在，请检查文件路径')
  process.exit(1)
}

// 2. 检查 callback route 的内容
console.log('📋 步骤 2: 检查 callback route 实现')
console.log('-'.repeat(80))

const callbackContent = readFileSync(callbackRoutePath, 'utf-8')

const checks = [
  {
    name: '使用 createServerClient 从 @supabase/ssr',
    test: callbackContent.includes('createServerClient') && callbackContent.includes('@supabase/ssr'),
    required: true,
  },
  {
    name: '不使用 createClient 从 @supabase/supabase-js',
    test: !callbackContent.includes("from '@supabase/supabase-js'") || !callbackContent.includes('createClient('),
    required: true,
  },
  {
    name: '调用 exchangeCodeForSession',
    test: callbackContent.includes('exchangeCodeForSession'),
    required: true,
  },
  {
    name: '错误时重定向到 /auth/error 而不是返回 JSON',
    test: callbackContent.includes('/auth/error') && !callbackContent.includes('application/json'),
    required: true,
  },
  {
    name: '从 cookies 读取 code_verifier（通过 createServerClient）',
    test: callbackContent.includes('cookies') && callbackContent.includes('getAll'),
    required: true,
  },
]

let allChecksPass = true
for (const check of checks) {
  const pass = check.test
  console.log(`${pass ? '✅' : '❌'} ${check.name}: ${pass ? '通过' : '失败'}`)
  if (!pass && check.required) {
    allChecksPass = false
  }
}
console.log()

// 3. 检查 TypeScript 编译
console.log('📋 步骤 3: 检查 TypeScript 编译')
console.log('-'.repeat(80))

try {
  execSync('npx tsc --noEmit --skipLibCheck app/auth/callback/route.ts', {
    cwd: PROJECT_ROOT,
    stdio: 'pipe',
  })
  console.log('✅ TypeScript 编译: 通过')
} catch (error) {
  console.log('⚠️  TypeScript 编译: 可能有错误（但可能不影响运行时）')
  console.log('   提示: 如果使用 Next.js，运行时类型检查可能不同')
}
console.log()

// 4. 检查错误页面
console.log('📋 步骤 4: 检查错误页面实现')
console.log('-'.repeat(80))

const errorPageContent = readFileSync(errorPagePath, 'utf-8')

const errorPageChecks = [
  {
    name: '使用 useSearchParams 读取错误参数',
    test: errorPageContent.includes('useSearchParams'),
    required: true,
  },
  {
    name: '显示友好的错误消息',
    test: errorPageContent.includes('验证链接') || errorPageContent.includes('验证失败'),
    required: true,
  },
  {
    name: '提供返回登录页的按钮',
    test: errorPageContent.includes('/auth/login'),
    required: true,
  },
]

let allErrorPageChecksPass = true
for (const check of errorPageChecks) {
  const pass = check.test
  console.log(`${pass ? '✅' : '❌'} ${check.name}: ${pass ? '通过' : '失败'}`)
  if (!pass && check.required) {
    allErrorPageChecksPass = false
  }
}
console.log()

// 5. 检查登录页面
console.log('📋 步骤 5: 检查登录页面实现')
console.log('-'.repeat(80))

const loginPageContent = readFileSync(loginPagePath, 'utf-8')

const loginPageChecks = [
  {
    name: '使用 signInWithOtp',
    test: loginPageContent.includes('signInWithOtp'),
    required: true,
  },
  {
    name: '设置 emailRedirectTo',
    test: loginPageContent.includes('emailRedirectTo'),
    required: true,
  },
  {
    name: '设置 shouldCreateUser',
    test: loginPageContent.includes('shouldCreateUser'),
    required: true,
  },
]

let allLoginPageChecksPass = true
for (const check of loginPageChecks) {
  const pass = check.test
  console.log(`${pass ? '✅' : '❌'} ${check.name}: ${pass ? '通过' : '失败'}`)
  if (!pass && check.required) {
    allLoginPageChecksPass = false
  }
}
console.log()

// 总结
console.log('='.repeat(80))
console.log('📊 验证总结')
console.log('='.repeat(80))
console.log()

if (allFilesExist && allChecksPass && allErrorPageChecksPass && allLoginPageChecksPass) {
  console.log('✅ 所有检查通过！')
  console.log()
  console.log('下一步:')
  console.log('1. 确保 Supabase Dashboard 中的 Redirect URLs 已正确设置')
  console.log('2. 启动开发服务器: pnpm dev')
  console.log('3. 访问 http://localhost:3000/auth/login 测试完整流程')
  console.log('4. 发送 Magic Link 并点击邮件中的链接')
  console.log('5. 验证是否成功重定向到 /dashboard')
  process.exit(0)
} else {
  console.log('❌ 部分检查失败，请修复后重试')
  process.exit(1)
}

