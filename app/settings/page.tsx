"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { User, Globe, Moon, Loader2, Activity } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/useAuth"
import { getLocale, setLocale } from "@/lib/i18n"
import { t } from "@/lib/i18n-client"

interface AnalyticsEvent {
  event_type: string
  request_id: string | null
  created_at: string
  summary: string
}

export default function SettingsPage() {
  const [language, setLanguage] = useState<"en" | "zh" | "ja">("en")
  const [darkMode, setDarkMode] = useState(false)
  const [events, setEvents] = useState<AnalyticsEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(false)
  const { user, loading } = useAuth(true)

  useEffect(() => {
    setLanguage(getLocale())
  }, [])

  useEffect(() => {
    if (user) {
      loadEvents()
    }
  }, [user])

  const loadEvents = async () => {
    setLoadingEvents(true)
    try {
      const response = await fetch("/api/analytics/events")
      if (response.ok) {
        const data = await response.json()
        setEvents(data.events || [])
      }
    } catch (error) {
      console.error("Failed to load events:", error)
    } finally {
      setLoadingEvents(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 pt-24 pb-16 flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (!user) {
    return null // Will redirect via useAuth
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 pt-24 pb-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl">
          <div className="space-y-4 mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-balance">
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Settings</span>
            </h1>
            <p className="text-lg text-muted-foreground text-pretty">Manage your preferences and account</p>
          </div>

          <div className="space-y-6">
            {/* Profile Section */}
            <Card className="p-6 glass">
              <div className="flex items-center gap-3 mb-6">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Profile</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" placeholder="John Doe" className="glass" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="john@example.com" className="glass" />
                </div>

                <Button className="rounded-full">Save Changes</Button>
              </div>
            </Card>

            {/* Language Section */}
            <Card className="p-6 glass">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Language</h2>
              </div>

              <div className="flex flex-wrap gap-3">
                {[
                  { code: "en" as const, label: "EN" },
                  { code: "zh" as const, label: "中文" },
                  { code: "ja" as const, label: "日本語" },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code)
                      setLocale(lang.code)
                    }}
                    className={`px-6 py-3 rounded-full transition-all ${
                      language === lang.code ? "bg-primary text-primary-foreground" : "glass hover:scale-105"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
            </Card>

            {/* Theme Section */}
            <Card className="p-6 glass">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="w-5 h-5 text-primary" />
                  <div>
                    <h2 className="text-xl font-semibold">Dark Mode</h2>
                    <p className="text-sm text-muted-foreground">Toggle dark theme</p>
                  </div>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
            </Card>

            {/* Event Diagnostics Section */}
            <Card className="p-6 glass">
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Event Diagnostics</h2>
              </div>

              {loadingEvents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : events.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No events found. Upload some files to see events here.
                </p>
              ) : (
                <div className="space-y-3">
                  {events.map((event, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-lg bg-background/50 border border-border"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{event.event_type}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{event.summary}</p>
                      {event.request_id && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          ID: {event.request_id}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
