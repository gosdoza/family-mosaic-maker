/**
 * CMP (Consent Management Platform) Cookie 同意管理
 * 
 * 管理 Cookie 同意状态：
 * - 分析 Cookie（GA4）
 * - 行销 Cookie（Pixel）
 * - 功能 Cookie（reCAPTCHA）
 * 
 * 拒绝分析/行销时停用 GA4/Pixel/reCAPTCHA
 */

"use client"

const CONSENT_COOKIE_NAME = "cookie_consent"
const CONSENT_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 // 1 年

export type ConsentCategory = "necessary" | "analytics" | "marketing" | "functional"

export interface ConsentPreferences {
  necessary: boolean // 始终为 true
  analytics: boolean
  marketing: boolean
  functional: boolean
}

/**
 * 获取 Cookie 同意状态
 */
export function getConsentPreferences(): ConsentPreferences {
  if (typeof window === "undefined") {
    return {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    }
  }

  try {
    const consentCookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`))

    if (!consentCookie) {
      return {
        necessary: true,
        analytics: false,
        marketing: false,
        functional: false,
      }
    }

    const consentValue = consentCookie.split("=")[1]
    const preferences = JSON.parse(decodeURIComponent(consentValue)) as ConsentPreferences

    return {
      necessary: true, // 始终为 true
      analytics: preferences.analytics ?? false,
      marketing: preferences.marketing ?? false,
      functional: preferences.functional ?? false,
    }
  } catch (error) {
    console.error("Error parsing consent cookie:", error)
    return {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    }
  }
}

/**
 * 设置 Cookie 同意状态
 */
export function setConsentPreferences(preferences: Partial<ConsentPreferences>): void {
  if (typeof window === "undefined") {
    return
  }

  const currentPreferences = getConsentPreferences()
  const newPreferences: ConsentPreferences = {
    necessary: true, // 始终为 true
    analytics: preferences.analytics ?? currentPreferences.analytics,
    marketing: preferences.marketing ?? currentPreferences.marketing,
    functional: preferences.functional ?? currentPreferences.functional,
  }

  const cookieValue = encodeURIComponent(JSON.stringify(newPreferences))
  document.cookie = `${CONSENT_COOKIE_NAME}=${cookieValue}; path=/; max-age=${CONSENT_COOKIE_MAX_AGE}; SameSite=Lax`

  // 触发自定义事件，通知其他组件
  window.dispatchEvent(new CustomEvent("consent-updated", { detail: newPreferences }))
}

/**
 * 检查是否允许分析 Cookie
 */
export function isAnalyticsAllowed(): boolean {
  return getConsentPreferences().analytics
}

/**
 * 检查是否允许行销 Cookie
 */
export function isMarketingAllowed(): boolean {
  return getConsentPreferences().marketing
}

/**
 * 检查是否允许功能 Cookie
 */
export function isFunctionalAllowed(): boolean {
  return getConsentPreferences().functional
}



