"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Mail, Sparkles, Send, Loader2 } from "lucide-react"
import { useState } from "react"
import { supabase } from "@/lib/supabaseClient"

export function LoginClient() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 使用 window.location.origin 動態產生 redirectTo
      // 讓「Production 登 Production、Preview 登 Preview、本機登本機」
      const redirectTo =
        typeof window !== "undefined"
          ? window.location.origin + "/auth/callback"
          : "/auth/callback"

      // DEBUG: 明確印出 redirectTo 值（在實際使用的 login component 中）
      console.log("DEBUG redirectTo in REAL login component:", redirectTo)
      alert("redirectTo=" + redirectTo)

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
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

        {/* DEBUG: 顯示當前 redirectTo 值（超明顯的紅色 debug 標籤） */}
        <p data-debug-redirect className="mt-4 text-xs text-center text-red-600 font-mono">
          DEBUG redirectTo (runtime):{" "}
          {typeof window !== "undefined"
            ? window.location.origin + "/auth/callback"
            : "(server)"}
        </p>
      </form>
    </Card>
  )
}

