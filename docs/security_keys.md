# 安全密鑰管理文檔

**版本**: v1.0.0  
**最後更新**: 2025-01-16

本文档说明安全密鑰管理原则、最小权限原则和检查清单。

## 📋 目錄

- [密鑰概述](#密鑰概述)
- [最小權限原則](#最小權限原則)
- [環境變數管理](#環境變數管理)
- [檢查清單](#檢查清單)
- [安全最佳實踐](#安全最佳實踐)

## 🔐 密鑰概述

### 密鑰類型

| 密鑰類型 | 用途 | 使用位置 | 權限級別 |
|---------|------|---------|---------|
| **SUPABASE_SERVICE_ROLE_KEY** | 後端操作（清理、稽核） | 僅後端 | 最高權限 |
| **NEXT_PUBLIC_SUPABASE_URL** | Supabase 連接 | 前端/後端 | 公開 |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | 前端認證 | 僅前端 | 受限權限 |

### 密鑰安全級別

| 安全級別 | 說明 | 示例 |
|---------|------|------|
| **最高** | 絕對不能暴露在前端 | `SUPABASE_SERVICE_ROLE_KEY` |
| **中等** | 可暴露但需保護 | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **最低** | 可公開 | `NEXT_PUBLIC_SUPABASE_URL` |

## 🔒 最小權限原則

### 原則說明

1. **僅授予必要權限**: 僅授予執行任務所需的最小權限
2. **分離環境**: 不同環境使用不同的密鑰
3. **定期輪換**: 定期更換密鑰（建議每 90 天）
4. **監控使用**: 監控密鑰使用情況，發現異常立即撤銷

### 權限矩陣

| 操作 | Service Role Key | Anon Key | 說明 |
|------|-----------------|----------|------|
| **讀取用戶數據** | ✅ | ✅（僅本人） | 用戶可讀取自己的數據 |
| **寫入用戶數據** | ✅ | ✅（僅本人） | 用戶可寫入自己的數據 |
| **讀取所有數據** | ✅ | ❌ | 僅 Service Role 可讀取所有數據 |
| **清理過期文件** | ✅ | ❌ | 僅 Service Role 可執行清理 |
| **管理功能開關** | ✅ | ❌ | 僅 Service Role 可管理功能開關 |

## 🌍 環境變數管理

### Vercel 環境變數

#### Production 環境

**設置位置**: Vercel Dashboard → Project Settings → Environment Variables

**環境變數列表**:
- `SUPABASE_SERVICE_ROLE_KEY` (Production)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### Preview 環境

**設置位置**: Vercel Dashboard → Project Settings → Environment Variables

**環境變數列表**:
- `SUPABASE_SERVICE_ROLE_KEY` (Preview)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 環境變數檢查

**驗證命令**:
```bash
# 檢查 Vercel 環境變數
vercel env ls

# 預期輸出: 看到 SUPABASE_SERVICE_ROLE_KEY（Encrypted）
```

### 本地環境變數

**文件**: `.env.local`

**環境變數列表**:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# 其他
CRON_SECRET=your_cron_secret
```

**注意**: `.env.local` 不應提交到版本控制系統

## ✅ 檢查清單

### 密鑰安全檢查

- [ ] `SUPABASE_SERVICE_ROLE_KEY` 僅在後端使用
- [ ] 前端 bundle 不包含 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Vercel 環境變數已設置（Production 和 Preview 分離）
- [ ] 本地 `.env.local` 不提交到版本控制
- [ ] 密鑰定期輪換（每 90 天）

### 前端安全檢查

- [ ] 前端代碼不讀取 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 前端僅使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 前端 bundle 檢查：不包含 service key 字串

### 後端安全檢查

- [ ] 清理腳本使用 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 稽核腳本使用 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 健康檢查端點使用 `SUPABASE_SERVICE_ROLE_KEY`（僅讀取）

### 環境變數檢查

- [ ] Production 環境變數已設置
- [ ] Preview 環境變數已設置
- [ ] 本地環境變數已設置（`.env.local`）

## 🛡️ 安全最佳實踐

### 1. 密鑰存儲

**✅ 正確做法**:
- 使用環境變數存儲密鑰
- 使用 Vercel 環境變數（加密存儲）
- 本地使用 `.env.local`（不提交到版本控制）

**❌ 錯誤做法**:
- 硬編碼密鑰在代碼中
- 將密鑰提交到版本控制系統
- 在前端代碼中使用 Service Role Key

### 2. 密鑰使用

**✅ 正確做法**:
- 後端操作使用 Service Role Key
- 前端操作使用 Anon Key
- 定期檢查密鑰使用情況

**❌ 錯誤做法**:
- 在前端使用 Service Role Key
- 在公開端點暴露密鑰
- 在日誌中記錄密鑰

### 3. 密鑰輪換

**✅ 正確做法**:
- 每 90 天輪換一次密鑰
- 輪換前通知相關人員
- 輪換後更新所有環境變數

**❌ 錯誤做法**:
- 長期不更換密鑰
- 輪換後不更新環境變數
- 輪換後不測試系統

### 4. 密鑰監控

**✅ 正確做法**:
- 監控密鑰使用情況
- 發現異常立即撤銷
- 記錄密鑰使用日誌

**❌ 錯誤做法**:
- 不監控密鑰使用
- 發現異常不處理
- 不記錄密鑰使用日誌

## 🔍 驗收命令

### 1. 檢查 Vercel 環境變數

```bash
vercel env ls
```

**預期輸出**: 看到 `SUPABASE_SERVICE_ROLE_KEY`（Encrypted）

### 2. 檢查前端 Bundle

```bash
# 建置前端
pnpm build

# 檢查 bundle 中是否包含 service key
grep -r "SUPABASE_SERVICE_ROLE_KEY" .next/static || echo "✅ 未找到 service key"
```

**預期輸出**: `✅ 未找到 service key`

### 3. 檢查環境變數使用

```bash
# 檢查前端代碼中是否使用 service key
grep -r "SUPABASE_SERVICE_ROLE_KEY" app/ components/ lib/ --exclude-dir=node_modules || echo "✅ 前端代碼未使用 service key"
```

**預期輸出**: `✅ 前端代碼未使用 service key`

### 4. 檢查後端代碼使用

```bash
# 檢查後端代碼中是否使用 service key
grep -r "SUPABASE_SERVICE_ROLE_KEY" app/api/ scripts/ --exclude-dir=node_modules && echo "✅ 後端代碼正確使用 service key"
```

**預期輸出**: `✅ 後端代碼正確使用 service key`

## 📝 相關文檔

- [Retention 排程 Runbook](./retention_runbook.md)
- [健康檢查合約](./health_contract.md)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，定義安全密鑰管理原則和檢查清單



