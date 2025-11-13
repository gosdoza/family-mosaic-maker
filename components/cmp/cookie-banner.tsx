"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { getConsentPreferences, setConsentPreferences, type ConsentPreferences } from "@/lib/cmp/consent"
import { X, Settings, Check } from "lucide-react"

export function CookieBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [preferences, setPreferences] = useState<ConsentPreferences>({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: false,
  })

  useEffect(() => {
    // 检查是否已有同意记录
    const currentPreferences = getConsentPreferences()
    const hasConsent = document.cookie.includes("cookie_consent=")

    if (!hasConsent) {
      setShowBanner(true)
      setPreferences(currentPreferences)
    }
  }, [])

  const handleAcceptAll = () => {
    const allConsent: ConsentPreferences = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    }
    setConsentPreferences(allConsent)
    setShowBanner(false)
    // 重新加载页面以应用新的同意设置
    window.location.reload()
  }

  const handleRejectAll = () => {
    const minimalConsent: ConsentPreferences = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    }
    setConsentPreferences(minimalConsent)
    setShowBanner(false)
    // 重新加载页面以应用新的同意设置
    window.location.reload()
  }

  const handleSaveSettings = () => {
    setConsentPreferences(preferences)
    setShowSettings(false)
    setShowBanner(false)
    // 重新加载页面以应用新的同意设置
    window.location.reload()
  }

  if (!showBanner) {
    return null
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/95 backdrop-blur-sm border-t">
      <Card className="max-w-4xl mx-auto p-6">
        {!showSettings ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Cookie 同意</h3>
              <p className="text-sm text-muted-foreground">
                我们使用 Cookie 来改善您的体验。请选择您同意的 Cookie 类型。
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowSettings(true)}>
                <Settings className="w-4 h-4 mr-2" />
                自定义设置
              </Button>
              <Button variant="outline" onClick={handleRejectAll}>
                拒绝全部
              </Button>
              <Button onClick={handleAcceptAll}>
                <Check className="w-4 h-4 mr-2" />
                接受全部
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Cookie 设置</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">必要 Cookie</p>
                  <p className="text-sm text-muted-foreground">
                    网站运行所必需的 Cookie，无法禁用
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.necessary}
                  disabled
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">分析 Cookie</p>
                  <p className="text-sm text-muted-foreground">
                    用于分析网站使用情况（GA4）
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) =>
                    setPreferences({ ...preferences, analytics: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">行销 Cookie</p>
                  <p className="text-sm text-muted-foreground">
                    用于广告和营销（Pixel）
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) =>
                    setPreferences({ ...preferences, marketing: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">功能 Cookie</p>
                  <p className="text-sm text-muted-foreground">
                    用于网站功能（reCAPTCHA）
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.functional}
                  onChange={(e) =>
                    setPreferences({ ...preferences, functional: e.target.checked })
                  }
                  className="w-5 h-5"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleRejectAll}>
                拒绝全部
              </Button>
              <Button onClick={handleSaveSettings}>
                <Check className="w-4 h-4 mr-2" />
                保存设置
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}



