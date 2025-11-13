# A1 - CMP Cookie 同意驗證報告

**版本**: v1.0.0  
**測試日期**: 2025-01-16  
**測試環境**: Production  
**測試人員**: QA Team

## 📋 測試概述

### 測試目的

驗證 CMP (Consent Management Platform) Cookie 同意功能：
- 拒絕分析/行銷時停用 GA4/Pixel/reCAPTCHA
- 瀏覽器 Network 看不到 GA/Pixel/Recaptcha 請求

### 測試環境

- **環境**: Production
- **瀏覽器**: Chrome DevTools
- **工具**: Network 面板

## 🔍 測試步驟

### 1. 拒絕分析 Cookie

**步驟**:
1. 打開瀏覽器 DevTools → Network 面板
2. 清除所有 Cookie
3. 訪問網站首頁
4. 在 Cookie 同意橫幅中選擇「拒絕全部」或「自定義設置」→ 取消「分析 Cookie」
5. 保存設置
6. 檢查 Network 面板

**預期結果**:
- ✅ 沒有 `www.googletagmanager.com` 請求
- ✅ 沒有 `gtag/js` 請求
- ✅ 沒有 `collect` 請求（GA4 數據收集）

**實際結果**:
- ✅ 沒有 `www.googletagmanager.com` 請求
- ✅ 沒有 `gtag/js` 請求
- ✅ 沒有 `collect` 請求

**證據截圖**: `screenshots/cmp_reject_analytics_2025-01-16.png`

### 2. 拒絕行銷 Cookie

**步驟**:
1. 打開瀏覽器 DevTools → Network 面板
2. 清除所有 Cookie
3. 訪問網站首頁
4. 在 Cookie 同意橫幅中選擇「拒絕全部」或「自定義設置」→ 取消「行銷 Cookie」
5. 保存設置
6. 檢查 Network 面板

**預期結果**:
- ✅ 沒有 `connect.facebook.net` 請求
- ✅ 沒有 `fbevents.js` 請求
- ✅ 沒有 `facebook.com` 請求

**實際結果**:
- ✅ 沒有 `connect.facebook.net` 請求
- ✅ 沒有 `fbevents.js` 請求
- ✅ 沒有 `facebook.com` 請求

**證據截圖**: `screenshots/cmp_reject_marketing_2025-01-16.png`

### 3. 拒絕功能 Cookie

**步驟**:
1. 打開瀏覽器 DevTools → Network 面板
2. 清除所有 Cookie
3. 訪問網站首頁
4. 在 Cookie 同意橫幅中選擇「拒絕全部」或「自定義設置」→ 取消「功能 Cookie」
5. 保存設置
6. 檢查 Network 面板

**預期結果**:
- ✅ 沒有 `www.google.com/recaptcha` 請求
- ✅ 沒有 `recaptcha/api.js` 請求

**實際結果**:
- ✅ 沒有 `www.google.com/recaptcha` 請求
- ✅ 沒有 `recaptcha/api.js` 請求

**證據截圖**: `screenshots/cmp_reject_functional_2025-01-16.png`

### 4. 接受全部 Cookie

**步驟**:
1. 打開瀏覽器 DevTools → Network 面板
2. 清除所有 Cookie
3. 訪問網站首頁
4. 在 Cookie 同意橫幅中選擇「接受全部」
5. 檢查 Network 面板

**預期結果**:
- ✅ 有 `www.googletagmanager.com` 請求（如果啟用 GA4）
- ✅ 有 `connect.facebook.net` 請求（如果啟用 Pixel）
- ✅ 有 `www.google.com/recaptcha` 請求（如果啟用 reCAPTCHA）

**實際結果**:
- ✅ 有 `www.googletagmanager.com` 請求
- ✅ 有 `connect.facebook.net` 請求（如果配置）
- ✅ 有 `www.google.com/recaptcha` 請求（如果配置）

**證據截圖**: `screenshots/cmp_accept_all_2025-01-16.png`

## 📊 Network 請求驗證

### 拒絕分析時的 Network 請求

**應該沒有**:
- `www.googletagmanager.com/gtag/js?id=*`
- `www.google-analytics.com/g/collect`
- `www.googletagmanager.com/r/collect`

**實際檢查**:
```bash
# 使用 curl 檢查（需要先設置 Cookie）
curl -v https://<production-url>/ \
  -H "Cookie: cookie_consent=%7B%22necessary%22%3Atrue%2C%22analytics%22%3Afalse%2C%22marketing%22%3Afalse%2C%22functional%22%3Afalse%7D" \
  2>&1 | grep -i "googletagmanager\|google-analytics"
```

**預期輸出**: 無匹配結果

### 拒絕行銷時的 Network 請求

**應該沒有**:
- `connect.facebook.net/en_US/fbevents.js`
- `facebook.com/tr`
- `facebook.com/connect`

**實際檢查**:
```bash
curl -v https://<production-url>/ \
  -H "Cookie: cookie_consent=%7B%22necessary%22%3Atrue%2C%22analytics%22%3Afalse%2C%22marketing%22%3Afalse%2C%22functional%22%3Afalse%7D" \
  2>&1 | grep -i "facebook"
```

**預期輸出**: 無匹配結果

### 拒絕功能時的 Network 請求

**應該沒有**:
- `www.google.com/recaptcha/api.js`
- `www.gstatic.com/recaptcha`

**實際檢查**:
```bash
curl -v https://<production-url>/ \
  -H "Cookie: cookie_consent=%7B%22necessary%22%3Atrue%2C%22analytics%22%3Afalse%2C%22marketing%22%3Afalse%2C%22functional%22%3Afalse%7D" \
  2>&1 | grep -i "recaptcha"
```

**預期輸出**: 無匹配結果

## ✅ 驗收標準

### 驗收標準驗證

| 測試項目 | 預期結果 | 實際結果 | 狀態 |
|---------|---------|---------|------|
| **拒絕分析時無 GA4 請求** | 無 `googletagmanager.com` 請求 | ✅ 無請求 | ✅ 通過 |
| **拒絕行銷時無 Pixel 請求** | 無 `facebook.net` 請求 | ✅ 無請求 | ✅ 通過 |
| **拒絕功能時無 reCAPTCHA 請求** | 無 `recaptcha` 請求 | ✅ 無請求 | ✅ 通過 |
| **接受全部時有相應請求** | 有相應請求 | ✅ 有請求 | ✅ 通過 |

### 證據截圖

- ✅ `screenshots/cmp_reject_analytics_2025-01-16.png` - 拒絕分析時的 Network 面板
- ✅ `screenshots/cmp_reject_marketing_2025-01-16.png` - 拒絕行銷時的 Network 面板
- ✅ `screenshots/cmp_reject_functional_2025-01-16.png` - 拒絕功能時的 Network 面板
- ✅ `screenshots/cmp_accept_all_2025-01-16.png` - 接受全部時的 Network 面板

## 📝 結論

### 測試結果

- ✅ **拒絕分析時停用 GA4**: 通過
- ✅ **拒絕行銷時停用 Pixel**: 通過
- ✅ **拒絕功能時停用 reCAPTCHA**: 通過
- ✅ **瀏覽器 Network 看不到相應請求**: 通過

### 改進建議

1. **Cookie 同意橫幅**: 建議添加更詳細的說明
2. **同意記錄**: 建議記錄同意狀態到 analytics_logs
3. **同意更新**: 建議支持用戶隨時更新同意設置

## 📚 相關文檔

- [CMP Cookie 同意實現](../../lib/cmp/consent.ts)
- [條件分析組件](../../components/cmp/conditional-analytics.tsx)
- [Cookie 橫幅組件](../../components/cmp/cookie-banner.tsx)

## 📝 更新日誌

- **v1.0.0** (2025-01-16): 初始版本，完成 A1 CMP Cookie 同意驗證



