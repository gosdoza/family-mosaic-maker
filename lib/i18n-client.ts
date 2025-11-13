"use client"

import { getLocale } from "./i18n"

// Import locale data
// Note: Using require for JSON imports in client components
const en = require("@/locales/en.json")
const zh = require("@/locales/zh.json")
const ja = require("@/locales/ja.json")

type LocaleData = typeof en

const locales: Record<string, LocaleData> = {
  en,
  zh,
  ja,
}

export function t(key: string): string {
  const locale = getLocale()
  const data = locales[locale] || locales.en

  const keys = key.split(".")
  let value: any = data

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k]
    } else {
      // Fallback to English if key not found
      const enValue = (locales.en as any)[k]
      if (enValue && typeof enValue === "object") {
        value = enValue
        continue
      }
      return key // Return key if not found
    }
  }

  return typeof value === "string" ? value : key
}

