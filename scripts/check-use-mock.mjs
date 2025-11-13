#!/usr/bin/env node

/**
 * 检查 NEXT_PUBLIC_USE_MOCK 环境变量值
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// 尝试从 .env.local 读取
try {
  const envPath = join(process.cwd(), '.env.local')
  const envContent = readFileSync(envPath, 'utf-8')
  const envLines = envContent.split('\n')
  
  for (const line of envLines) {
    if (line.startsWith('NEXT_PUBLIC_USE_MOCK=')) {
      const value = line.split('=')[1]?.trim()
      console.log('📋 .env.local 中的值:')
      console.log(`   NEXT_PUBLIC_USE_MOCK=${value}`)
      break
    }
  }
} catch (error) {
  console.log('⚠️  无法读取 .env.local 文件')
}

// 检查进程环境变量
console.log('')
console.log('📋 进程环境变量:')
console.log(`   NEXT_PUBLIC_USE_MOCK=${process.env.NEXT_PUBLIC_USE_MOCK || 'undefined'}`)

// 检查 Vercel 环境变量（如果已链接）
console.log('')
console.log('📋 Vercel 环境变量:')
console.log('   运行以下命令查看:')
console.log('   vercel env ls | grep NEXT_PUBLIC_USE_MOCK')



