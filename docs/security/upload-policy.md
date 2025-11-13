# 上傳 MIME 白名單與簽名上傳流程

**版本**: v1.0.0  
**最後更新**: 2025-11-09

本文档定义上传策略，包括 MIME 白名单、EXIF 清理、签名 URL 流程和风险提示。

## 📋 目錄

- [上傳策略概述](#上傳策略概述)
- [MIME 白名單](#mime-白名單)
- [EXIF 清理](#exif-清理)
- [簽名 URL 流程](#簽名-url-流程)
- [風險提示](#風險提示)
- [實施建議](#實施建議)

## 🔍 上傳策略概述

### 上傳策略目的

確保上傳文件的安全性和合規性，防止惡意文件上傳和隱私洩露。

### 上傳策略範圍

- **MIME 類型驗證**: 只允許白名單中的 MIME 類型
- **EXIF 數據清理**: 清除所有 EXIF 元數據
- **簽名 URL**: 使用簽名 URL 進行安全上傳
- **文件驗證**: 驗證文件內容和格式

### 上傳策略原則

- **最小權限**: 只允許必要的文件類型
- **隱私保護**: 清除所有可能洩露隱私的元數據
- **安全上傳**: 使用簽名 URL 防止未授權上傳
- **風險防範**: 拒絕高風險文件格式

## 📋 MIME 白名單

### 白名單定義

**允許的 MIME 類型**:
- `image/jpeg` - JPEG 圖片
- `image/png` - PNG 圖片

**拒絕的 MIME 類型**:
- `image/heic` - HEIC 圖片（Apple 格式）
- `image/heif` - HEIF 圖片（Apple 格式）
- `image/gif` - GIF 動圖
- `image/webp` - WebP 圖片（動態 WebP）
- `image/svg+xml` - SVG 向量圖
- `image/bmp` - BMP 位圖
- `image/tiff` - TIFF 圖片
- 其他所有 MIME 類型

### MIME 驗證規則

**驗證時機**:
1. **客戶端驗證**: 文件選擇時立即驗證
2. **服務端驗證**: 上傳前再次驗證（雙重驗證）

**驗證方式**:
- **MIME 類型檢查**: 檢查文件的 `Content-Type` header
- **文件擴展名檢查**: 檢查文件擴展名（輔助驗證）
- **文件內容檢查**: 檢查文件魔數（Magic Number）以確認實際格式

**驗證流程**:
```
1. 客戶端選擇文件
   ↓
2. 檢查 MIME 類型（image/jpeg 或 image/png）
   ↓
3. 檢查文件擴展名（.jpg, .jpeg, .png）
   ↓
4. 服務端接收文件
   ↓
5. 再次檢查 MIME 類型
   ↓
6. 檢查文件魔數（確認實際格式）
   ↓
7. 如果通過，繼續處理；否則拒絕
```

### MIME 白名單表

| MIME 類型 | 文件擴展名 | 狀態 | 說明 |
|-----------|-----------|------|------|
| `image/jpeg` | `.jpg`, `.jpeg` | ✅ 允許 | JPEG 圖片 |
| `image/png` | `.png` | ✅ 允許 | PNG 圖片 |
| `image/heic` | `.heic`, `.heif` | ❌ 拒絕 | Apple HEIC 格式（見風險提示） |
| `image/gif` | `.gif` | ❌ 拒絕 | GIF 動圖（見風險提示） |
| `image/webp` | `.webp` | ❌ 拒絕 | WebP 圖片（可能包含動畫） |
| `image/svg+xml` | `.svg` | ❌ 拒絕 | SVG 向量圖（可能包含腳本） |
| `image/bmp` | `.bmp` | ❌ 拒絕 | BMP 位圖 |
| `image/tiff` | `.tiff`, `.tif` | ❌ 拒絕 | TIFF 圖片 |

### MIME 驗證範例

**客戶端驗證（JavaScript）**:

```typescript
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png']

function validateFile(file: File): { valid: boolean; error?: string } {
  // 1. 檢查 MIME 類型
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `File type ${file.type} is not allowed. Only JPEG and PNG are supported.` }
  }
  
  // 2. 檢查文件擴展名
  const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: `File extension ${extension} is not allowed. Only .jpg, .jpeg, and .png are supported.` }
  }
  
  return { valid: true }
}
```

**服務端驗證（Node.js）**:

```typescript
import { fileTypeFromBuffer } from 'file-type'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']

async function validateFileContent(buffer: Buffer): Promise<{ valid: boolean; error?: string }> {
  // 1. 檢查文件魔數（Magic Number）
  const fileType = await fileTypeFromBuffer(buffer)
  
  if (!fileType) {
    return { valid: false, error: 'Unable to determine file type' }
  }
  
  // 2. 檢查實際 MIME 類型
  if (!ALLOWED_MIME_TYPES.includes(fileType.mime)) {
    return { valid: false, error: `File type ${fileType.mime} is not allowed. Only JPEG and PNG are supported.` }
  }
  
  return { valid: true }
}
```

## 🧹 EXIF 清理

### EXIF 清理說明

**EXIF（Exchangeable Image File Format）** 是圖片元數據格式，可能包含以下敏感信息：
- **位置信息**: GPS 坐標、拍攝地點
- **設備信息**: 相機型號、拍攝參數
- **時間信息**: 拍攝時間、修改時間
- **個人信息**: 作者、版權信息

### EXIF 清理策略

**清理原則**: **全清** - 清除所有 EXIF 元數據

**清理時機**:
1. **上傳時清理**: 文件上傳後立即清理
2. **處理時清理**: 圖片處理過程中清理
3. **存儲前清理**: 存儲到數據庫前清理

**清理方式**:
- **使用庫**: 使用 `sharp` 或 `exif-parser` 庫清理 EXIF
- **清理範圍**: 清除所有 EXIF 標籤（包括 GPS、設備信息、時間信息等）
- **保留信息**: 只保留必要的圖片數據（像素數據）

### EXIF 清理流程

```
1. 接收上傳文件
   ↓
2. 讀取文件內容
   ↓
3. 檢測 EXIF 數據
   ↓
4. 清除所有 EXIF 元數據
   ↓
5. 重新編碼圖片（不包含 EXIF）
   ↓
6. 存儲清理後的文件
```

### EXIF 清理範例

**使用 sharp 清理 EXIF**:

```typescript
import sharp from 'sharp'

async function stripExif(inputBuffer: Buffer): Promise<Buffer> {
  // 使用 sharp 重新編碼圖片，自動清除 EXIF
  const cleanedBuffer = await sharp(inputBuffer)
    .jpeg({ quality: 90, mozjpeg: true }) // 或 .png() 對於 PNG
    .toBuffer()
  
  return cleanedBuffer
}
```

**使用 exif-parser 清理 EXIF**:

```typescript
import { ExifImage } from 'exif'
import sharp from 'sharp'

async function stripExif(inputBuffer: Buffer): Promise<Buffer> {
  // 1. 檢測 EXIF 數據
  const hasExif = await checkExif(inputBuffer)
  
  if (!hasExif) {
    return inputBuffer // 沒有 EXIF，直接返回
  }
  
  // 2. 使用 sharp 重新編碼，清除 EXIF
  const cleanedBuffer = await sharp(inputBuffer)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer()
  
  return cleanedBuffer
}
```

### EXIF 清理驗證

**驗證方式**:
- **EXIF 檢查**: 上傳後檢查文件是否包含 EXIF 數據
- **自動測試**: 定期測試 EXIF 清理功能
- **日誌記錄**: 記錄清理的 EXIF 數據類型（用於審計）

**驗證範例**:

```typescript
import { ExifImage } from 'exif'

async function verifyExifRemoved(buffer: Buffer): Promise<boolean> {
  try {
    const exifData = await parseExif(buffer)
    return Object.keys(exifData).length === 0 // 應該為空
  } catch (error) {
    return true // 無法解析 EXIF，視為已清理
  }
}
```

## 🔐 簽名 URL 流程

### 簽名 URL 說明

**簽名 URL** 是一種臨時、安全的 URL，用於授權文件上傳和下載。

**簽名 URL 特點**:
- **臨時性**: 有有效期限制（10 分鐘）
- **安全性**: 包含簽名，防止篡改
- **授權性**: 只有擁有簽名 URL 的用戶才能上傳/下載

### 簽名 URL 有效期

**有效期**: **10 分鐘**

**有效期計算**:
- **生成時間**: 簽名 URL 生成時間
- **過期時間**: 生成時間 + 10 分鐘
- **驗證方式**: 服務端驗證簽名和過期時間

**有效期範例**:
```
生成時間: 2025-11-09T13:00:00Z
過期時間: 2025-11-09T13:10:00Z
有效期: 10 分鐘
```

### 簽名 URL 生成流程

```
1. 用戶請求上傳
   ↓
2. 服務端驗證用戶身份
   ↓
3. 生成簽名 URL（包含過期時間）
   ↓
4. 返回簽名 URL 給客戶端
   ↓
5. 客戶端使用簽名 URL 上傳文件
   ↓
6. 服務端驗證簽名 URL（檢查簽名和過期時間）
   ↓
7. 如果有效，處理上傳；否則拒絕
```

### 簽名 URL 生成範例

**Supabase 簽名 URL 生成**:

```typescript
import { createClient } from '@/lib/supabase/server'

async function generateUploadUrl(bucket: string, filePath: string): Promise<string> {
  const supabase = await createClient()
  
  // 生成簽名 URL（有效期 10 分鐘）
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(filePath, {
      upsert: false, // 不允許覆蓋現有文件
    })
  
  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`)
  }
  
  // 返回簽名 URL（包含過期時間）
  return data.signedUrl
}
```

**自定義簽名 URL 生成**:

```typescript
import crypto from 'crypto'

function generateSignedUrl(
  bucket: string,
  filePath: string,
  expiresIn: number = 600 // 10 分鐘（秒）
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn
  const secret = process.env.UPLOAD_SECRET_KEY!
  
  // 生成簽名
  const stringToSign = `${bucket}/${filePath}:${expiresAt}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex')
  
  // 構建簽名 URL
  const baseUrl = process.env.STORAGE_BASE_URL!
  const signedUrl = `${baseUrl}/${bucket}/${filePath}?expires=${expiresAt}&signature=${signature}`
  
  return signedUrl
}
```

### 簽名 URL 驗證範例

**驗證簽名 URL**:

```typescript
import crypto from 'crypto'

function verifySignedUrl(
  url: string,
  bucket: string,
  filePath: string
): { valid: boolean; error?: string } {
  const urlObj = new URL(url)
  const expires = parseInt(urlObj.searchParams.get('expires') || '0')
  const signature = urlObj.searchParams.get('signature') || ''
  
  // 1. 檢查過期時間
  const now = Math.floor(Date.now() / 1000)
  if (expires < now) {
    return { valid: false, error: 'Signed URL has expired' }
  }
  
  // 2. 驗證簽名
  const secret = process.env.UPLOAD_SECRET_KEY!
  const stringToSign = `${bucket}/${filePath}:${expires}`
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('hex')
  
  if (signature !== expectedSignature) {
    return { valid: false, error: 'Invalid signature' }
  }
  
  return { valid: true }
}
```

## ⚠️ 風險提示

### HEIC/動圖拒絕策略

**風險說明**:

1. **HEIC 格式風險**:
   - **兼容性問題**: HEIC 格式在非 Apple 設備上可能無法正常顯示
   - **處理複雜性**: HEIC 格式需要特殊的解碼庫，增加處理複雜度
   - **文件大小**: HEIC 文件可能較大，影響上傳和處理性能
   - **專利問題**: HEIC 格式涉及專利，可能導致法律問題

2. **動圖風險**:
   - **處理複雜性**: 動圖（GIF、動態 WebP）需要逐幀處理，增加處理複雜度
   - **文件大小**: 動圖文件通常較大，影響上傳和處理性能
   - **安全風險**: 動圖可能包含惡意代碼或腳本
   - **隱私風險**: 動圖可能包含多幀敏感信息

### 拒絕策略

**拒絕方式**:
- **客戶端拒絕**: 文件選擇時立即拒絕，顯示錯誤訊息
- **服務端拒絕**: 上傳時再次檢查，如果檢測到 HEIC 或動圖，立即拒絕

**拒絕訊息**:
- **HEIC 格式**: "HEIC format is not supported. Please convert to JPEG or PNG."
- **動圖格式**: "Animated images (GIF, animated WebP) are not supported. Please use static JPEG or PNG images."

### 風險提示表

| 文件格式 | 風險類型 | 風險級別 | 拒絕原因 | 建議 |
|---------|---------|---------|---------|------|
| **HEIC/HEIF** | 兼容性、專利 | 🔴 高 | 兼容性問題、專利問題 | 拒絕，建議轉換為 JPEG/PNG |
| **GIF** | 處理複雜性、安全 | 🔴 高 | 動圖處理複雜、可能包含惡意代碼 | 拒絕，建議使用靜態圖片 |
| **動態 WebP** | 處理複雜性、安全 | 🔴 高 | 動圖處理複雜、可能包含惡意代碼 | 拒絕，建議使用靜態圖片 |
| **SVG** | 安全風險 | 🔴 高 | 可能包含腳本、XSS 風險 | 拒絕，建議使用光柵圖片 |
| **BMP** | 文件大小 | 🟡 中 | 文件通常較大 | 拒絕，建議使用 JPEG/PNG |
| **TIFF** | 兼容性 | 🟡 中 | 兼容性問題 | 拒絕，建議使用 JPEG/PNG |

### 風險防範措施

**1. 客戶端驗證**:
- 文件選擇時立即檢查 MIME 類型和文件擴展名
- 如果檢測到 HEIC 或動圖，立即拒絕並顯示錯誤訊息
- 提供轉換建議（如使用在線轉換工具）

**2. 服務端驗證**:
- 上傳時再次檢查 MIME 類型和文件內容
- 使用文件魔數（Magic Number）確認實際格式
- 如果檢測到 HEIC 或動圖，立即拒絕並返回錯誤

**3. 文件內容檢查**:
- 檢查文件是否為動圖（GIF、動態 WebP）
- 檢查文件是否為 HEIC 格式
- 如果檢測到，立即拒絕

### 風險提示範例

**客戶端風險提示**:

```typescript
function validateFile(file: File): { valid: boolean; error?: string } {
  // 1. 檢查 HEIC 格式
  if (file.type === 'image/heic' || file.type === 'image/heif' || 
      file.name.toLowerCase().endsWith('.heic') || 
      file.name.toLowerCase().endsWith('.heif')) {
    return {
      valid: false,
      error: 'HEIC format is not supported. Please convert to JPEG or PNG using an online converter.'
    }
  }
  
  // 2. 檢查動圖格式
  if (file.type === 'image/gif' || 
      (file.type === 'image/webp' && file.name.toLowerCase().endsWith('.webp'))) {
    return {
      valid: false,
      error: 'Animated images (GIF, animated WebP) are not supported. Please use static JPEG or PNG images.'
    }
  }
  
  // 3. 檢查其他不支持的格式
  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not supported. Only JPEG and PNG are allowed.`
    }
  }
  
  return { valid: true }
}
```

**服務端風險提示**:

```typescript
import { fileTypeFromBuffer } from 'file-type'

async function validateFileContent(buffer: Buffer): Promise<{ valid: boolean; error?: string }> {
  const fileType = await fileTypeFromBuffer(buffer)
  
  if (!fileType) {
    return { valid: false, error: 'Unable to determine file type' }
  }
  
  // 1. 檢查 HEIC 格式
  if (fileType.mime === 'image/heic' || fileType.mime === 'image/heif') {
    return {
      valid: false,
      error: 'HEIC format is not supported. Please convert to JPEG or PNG.'
    }
  }
  
  // 2. 檢查動圖格式
  if (fileType.mime === 'image/gif') {
    return {
      valid: false,
      error: 'Animated images (GIF) are not supported. Please use static JPEG or PNG images.'
    }
  }
  
  // 3. 檢查動態 WebP
  if (fileType.mime === 'image/webp') {
    // 檢查是否為動態 WebP（需要額外檢查）
    const isAnimated = await checkAnimatedWebP(buffer)
    if (isAnimated) {
      return {
        valid: false,
        error: 'Animated WebP images are not supported. Please use static JPEG or PNG images.'
      }
    }
  }
  
  // 4. 只允許 JPEG 和 PNG
  if (!['image/jpeg', 'image/png'].includes(fileType.mime)) {
    return {
      valid: false,
      error: `File type ${fileType.mime} is not supported. Only JPEG and PNG are allowed.`
    }
  }
  
  return { valid: true }
}
```

## 🛠️ 實施建議

### 實施步驟

**1. MIME 白名單驗證**:
- 在客戶端和服務端都實現 MIME 類型驗證
- 使用文件魔數（Magic Number）確認實際格式
- 拒絕所有不在白名單中的 MIME 類型

**2. EXIF 清理**:
- 使用 `sharp` 或 `exif-parser` 庫清理 EXIF
- 在上傳時立即清理所有 EXIF 元數據
- 驗證清理後的文件不包含 EXIF 數據

**3. 簽名 URL 流程**:
- 使用 Supabase 或自定義簽名 URL 生成
- 設置有效期為 10 分鐘
- 驗證簽名 URL 的簽名和過期時間

**4. 風險防範**:
- 拒絕 HEIC 和動圖格式
- 在客戶端和服務端都實現風險檢查
- 提供清晰的錯誤訊息和轉換建議

### 實施範例

**完整上傳流程**:

```typescript
// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'
import { fileTypeFromBuffer } from 'file-type'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png']

export async function POST(request: NextRequest) {
  try {
    // 1. 驗證用戶身份
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // 2. 接收文件
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    
    // 3. 驗證 MIME 類型
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type ${file.type} is not allowed. Only JPEG and PNG are supported.` },
        { status: 400 }
      )
    }
    
    // 4. 讀取文件內容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // 5. 驗證文件內容（檢查實際格式）
    const fileType = await fileTypeFromBuffer(buffer)
    if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
      return NextResponse.json(
        { error: 'File content does not match declared type. Only JPEG and PNG are supported.' },
        { status: 400 }
      )
    }
    
    // 6. 清理 EXIF
    const cleanedBuffer = await sharp(buffer)
      .jpeg({ quality: 90, mozjpeg: true }) // 或 .png() 對於 PNG
      .toBuffer()
    
    // 7. 生成文件路徑
    const filePath = `${user.id}/${Date.now()}_${file.name}`
    
    // 8. 生成簽名 URL（10 分鐘有效期）
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('uploads')
      .createSignedUploadUrl(filePath, {
        upsert: false,
      })
    
    if (signedUrlError || !signedUrlData) {
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      )
    }
    
    // 9. 上傳文件到簽名 URL
    const uploadResponse = await fetch(signedUrlData.signedUrl, {
      method: 'PUT',
      body: cleanedBuffer,
      headers: {
        'Content-Type': fileType.mime,
      },
    })
    
    if (!uploadResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }
    
    // 10. 返回成功響應
    return NextResponse.json({
      success: true,
      filePath,
      url: signedUrlData.path,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## 📊 策略總結表

| 策略類型 | 規則 | 說明 |
|---------|------|------|
| **MIME 白名單** | `image/jpeg`, `image/png` | 只允許 JPEG 和 PNG |
| **EXIF 清理** | 全清 | 清除所有 EXIF 元數據 |
| **簽名 URL 有效期** | 10 分鐘 | 簽名 URL 有效期為 10 分鐘 |
| **HEIC 拒絕** | 拒絕 | 拒絕 HEIC/HEIF 格式 |
| **動圖拒絕** | 拒絕 | 拒絕 GIF 和動態 WebP |

## 📚 相關文檔

- [Rate Limit 規範備忘錄](./rate-limit.md)
- [事件字典 v1](../observability/events-v1.md)

## 📝 更新日誌

- **v1.0.0** (2025-11-09): 初始版本，定義 MIME 白名單、EXIF 清理、簽名 URL 流程和風險提示



