"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import type { User } from "@supabase/supabase-js"

export function useAuth(redirectToLogin = false) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const isMock = process.env.NEXT_PUBLIC_USE_MOCK === "true"

  useEffect(() => {
    // In mock mode, skip authentication
    if (isMock) {
      // Check for __e2e cookie for E2E testing
      const e2eCookie = document.cookie.split("; ").find((row) => row.startsWith("__e2e="))
      if (e2eCookie) {
        setUser({ id: "e2e-user", email: "e2e@test.local" } as User)
      } else {
        setUser({ id: "mock-user", email: "mock@example.com" } as User)
      }
      setLoading(false)
      return
    }

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)

      if (redirectToLogin && !session?.user) {
        router.push("/auth/login")
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)

      if (redirectToLogin && !session?.user) {
        router.push("/auth/login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [redirectToLogin, router, isMock])

  return { user, loading }
}

