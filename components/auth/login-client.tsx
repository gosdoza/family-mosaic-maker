"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Mail, Sparkles, Send, Loader2, TestTube } from "lucide-react"
import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

interface LoginClientProps {
  allowTestLogin?: boolean
}

export function LoginClient({ allowTestLogin = false }: LoginClientProps) {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 強制所有環境使用 window.location.origin 作為 redirectTo
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://family-mosaic-maker.vercel.app")
      const redirectTo = `${origin}/auth/callback`

      console.log("[login] emailRedirectTo", redirectTo)
      console.log("📋 開 DevTools → Network → 找 /auth/v1/otp → 檢查 redirect_to Query String")

      // Step 3: 若 redirectTo 不是 preview，直接阻止送出
      try {
        const url = new URL(redirectTo)
        const host = url.hostname
        if (host === "family-mosaic-maker.vercel.app") {
          alert("⚠️ WARNING：目前 redirectTo 是 Production！你應該在 Preview login 打開。")
          setLoading(false)
          return
        }
      } catch (e) {
        console.error("Invalid redirectTo URL", redirectTo)
      }

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
        },
      })

      if (error) {
        throw error
      }

      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send magic link")
      setSent(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="p-8 sm:p-12 glass">
      <div className="text-center space-y-6 mb-8">
        {/* Glowing envelope illustration */}
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 mb-2">
            <Mail className="w-10 h-10 text-primary" />
          </div>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-3">
            Welcome to Your{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Family Story
            </span>
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Sign in with your magic link to start creating beautiful family memories
          </p>
        </div>
      </div>

      <form onSubmit={handleSendLink} className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 glass"
              required
            />
          </div>
        </div>

        <Button type="submit" size="lg" className="w-full rounded-full h-12 shadow-lg" disabled={sent || loading}>
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Sending...
            </>
          ) : sent ? (
            <>
              <Sparkles className="w-5 h-5 mr-2" />
              Magic Link Sent!
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Send Magic Link
            </>
          )}
        </Button>

        {error && (
          <div className="text-center p-4 rounded-2xl bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {sent && !error && (
          <div className="text-center p-4 rounded-2xl bg-primary/5 border border-primary/10">
            <p className="text-sm text-primary">Check your inbox! We've sent you a secure login link.</p>
          </div>
        )}
      </form>

      {/* Test Login Button (Dev Only) */}
      {allowTestLogin && (
        <div className="mt-6 pt-6 border-t border-border">
          <TestLoginButton />
        </div>
      )}
    </Card>
  )
}

/**
 * Test Login Button Component
 * Only shown when NEXT_PUBLIC_ALLOW_TEST_LOGIN=true (dev mode only)
 */
function TestLoginButton() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTestLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      // Use test@example.com as default test user
      const testEmail = "test@example.com"
      const testPassword = "test-password-123"

      // Call /api/test/login endpoint
      const response = await fetch("/api/test/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Test login failed")
      }

      // Wait a bit for cookies to be set, then redirect
      // Get redirect target from URL params or default to /dashboard
      const redirectTo = searchParams.get("redirect") || "/dashboard"
      
      // Small delay to ensure cookies are set
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Use window.location.href for full page reload to ensure cookies are sent
      window.location.href = redirectTo
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to test login")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-xs text-muted-foreground mb-2">Development Only</p>
        <Button
          type="button"
          variant="outline"
          onClick={handleTestLogin}
          disabled={loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Logging in...
            </>
          ) : (
            <>
              <TestTube className="w-4 h-4 mr-2" />
              Test Login (Dev Only)
            </>
          )}
        </Button>
      </div>
      {error && (
        <div className="text-center p-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}

