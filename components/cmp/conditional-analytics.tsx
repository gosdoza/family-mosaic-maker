"use client"

import { useEffect } from "react"
import Script from "next/script"
import { isAnalyticsAllowed, isMarketingAllowed, isFunctionalAllowed } from "@/lib/cmp/consent"

const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID
const FACEBOOK_PIXEL_ID = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

/**
 * 条件加载分析脚本（基于 Cookie 同意）
 */
export function ConditionalAnalytics() {
  useEffect(() => {
    // 监听同意更新事件
    const handleConsentUpdate = () => {
      const analyticsAllowed = isAnalyticsAllowed()
      const marketingAllowed = isMarketingAllowed()
      const functionalAllowed = isFunctionalAllowed()

      // 如果分析被拒绝，移除 GA4
      if (!analyticsAllowed && window.gtag) {
        // 禁用 GA4
        window.dataLayer = window.dataLayer || []
        window.gtag = function() {
          // 空函数，禁用 GA4
        }
      }

      // 如果行销被拒绝，移除 Pixel
      if (!marketingAllowed && window.fbq) {
        // 禁用 Facebook Pixel
        window.fbq = function() {
          // 空函数，禁用 Pixel
        }
      }

      // 如果功能被拒绝，移除 reCAPTCHA
      if (!functionalAllowed && window.grecaptcha) {
        // 禁用 reCAPTCHA
        window.grecaptcha = undefined
      }
    }

    window.addEventListener("consent-updated", handleConsentUpdate)

    return () => {
      window.removeEventListener("consent-updated", handleConsentUpdate)
    }
  }, [])

  const analyticsAllowed = isAnalyticsAllowed()
  const marketingAllowed = isMarketingAllowed()
  const functionalAllowed = isFunctionalAllowed()

  return (
    <>
      {/* GA4 - 仅在分析同意时加载 */}
      {GA4_MEASUREMENT_ID && analyticsAllowed && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA4_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}

      {/* Facebook Pixel - 仅在行销同意时加载 */}
      {FACEBOOK_PIXEL_ID && marketingAllowed && (
        <Script id="facebook-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '${FACEBOOK_PIXEL_ID}');fbq('track', 'PageView');`}
        </Script>
      )}

      {/* reCAPTCHA - 仅在功能同意时加载 */}
      {RECAPTCHA_SITE_KEY && functionalAllowed && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`}
          strategy="lazyOnload"
        />
      )}
    </>
  )
}

