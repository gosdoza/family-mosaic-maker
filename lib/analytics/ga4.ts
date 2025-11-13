/**
 * Google Analytics 4 (GA4) Client
 * 
 * 实现九个核心 GA4 事件追踪：
 * 1. page_view - 页面浏览
 * 2. generate_start - 开始生成
 * 3. generate_success - 生成成功
 * 4. generate_fail - 生成失败
 * 5. payment_start - 开始支付
 * 6. purchase_success - 购买成功
 * 7. download_click - 点击下载
 * 8. login_request - 登录请求
 * 9. login_success - 登录成功
 */

declare global {
  interface Window {
    gtag?: (
      command: string,
      targetId: string,
      config?: Record<string, any>
    ) => void
    dataLayer?: any[]
  }
}

const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID

/**
 * 初始化 GA4（已由 layout.tsx 中的 Script 组件处理）
 * 此函数保留用于向后兼容，但实际初始化在 layout.tsx 中完成
 */
export function initGA4() {
  // GA4 初始化已由 layout.tsx 中的 Script 组件处理
  // 此函数保留用于向后兼容
}

/**
 * 发送 GA4 事件
 */
export function trackGA4Event(
  eventName: string,
  parameters?: Record<string, any>
) {
  if (typeof window === "undefined" || !window.gtag || !GA4_MEASUREMENT_ID) {
    return
  }

  window.gtag("event", eventName, {
    ...parameters,
    send_to: GA4_MEASUREMENT_ID,
  })
}

/**
 * 九个核心 GA4 事件
 */

/**
 * 1. page_view - 页面浏览
 */
export function trackPageView(path?: string) {
  trackGA4Event("page_view", {
    page_path: path || window.location.pathname,
    page_title: document.title,
  })
}

/**
 * 2. generate_start - 开始生成
 */
export function trackGenerateStart(jobId: string, metadata?: Record<string, any>) {
  trackGA4Event("generate_start", {
    job_id: jobId,
    ...metadata,
  })
}

/**
 * 3. generate_success - 生成成功
 */
export function trackGenerateSuccess(jobId: string, metadata?: Record<string, any>) {
  trackGA4Event("generate_success", {
    job_id: jobId,
    ...metadata,
  })
}

/**
 * 4. generate_fail - 生成失败
 */
export function trackGenerateFail(jobId: string, error?: string, metadata?: Record<string, any>) {
  trackGA4Event("generate_fail", {
    job_id: jobId,
    error_message: error,
    ...metadata,
  })
}

/**
 * 5. payment_start - 开始支付
 */
export function trackPaymentStart(jobId: string, amount?: string, currency?: string) {
  trackGA4Event("payment_start", {
    job_id: jobId,
    value: amount ? parseFloat(amount) : undefined,
    currency: currency || "USD",
  })
}

/**
 * 6. purchase_success - 购买成功
 */
export function trackPurchaseSuccess(
  jobId: string,
  orderId: string,
  amount: string,
  currency: string = "USD"
) {
  trackGA4Event("purchase", {
    transaction_id: orderId,
    value: parseFloat(amount),
    currency,
    items: [
      {
        item_id: jobId,
        item_name: "Family Mosaic Generation",
        price: parseFloat(amount),
        quantity: 1,
      },
    ],
  })
}

/**
 * 7. download_click - 点击下载
 */
export function trackDownloadClick(jobId: string, quality?: string, metadata?: Record<string, any>) {
  trackGA4Event("download_click", {
    job_id: jobId,
    quality,
    ...metadata,
  })
}

/**
 * 8. login_request - 登录请求
 */
export function trackLoginRequest(emailHash?: string) {
  trackGA4Event("login", {
    method: "magic_link",
    email_hash: emailHash,
  })
}

/**
 * 9. login_success - 登录成功
 */
export function trackLoginSuccess(userId?: string, emailHash?: string) {
  trackGA4Event("login", {
    method: "magic_link",
    user_id: userId,
    email_hash: emailHash,
  })
}

