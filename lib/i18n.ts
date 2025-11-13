"use client"

type Locale = "en" | "zh" | "ja"

export function getLocale(): Locale {
  if (typeof window === "undefined") return "en"

  // Prefer cookie "lang"
  const cookieLang = document.cookie
    .split("; ")
    .find((row) => row.startsWith("lang="))
    ?.split("=")[1] as Locale | undefined

  if (cookieLang && ["en", "zh", "ja"].includes(cookieLang)) {
    return cookieLang
  }

  // Fallback to navigator.language
  const navLang = navigator.language.toLowerCase()
  if (navLang.startsWith("zh")) return "zh"
  if (navLang.startsWith("ja")) return "ja"

  // Default to "en"
  return "en"
}

export function setLocale(locale: Locale) {
  document.cookie = `lang=${locale}; path=/; max-age=31536000` // 1 year
  window.location.reload()
}



