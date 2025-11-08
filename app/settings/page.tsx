"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { User, Globe, Moon, Loader2 } from "lucide-react"
import { useState } from "react"
import { useAuth } from "@/lib/useAuth"

export default function SettingsPage() {
  const [language, setLanguage] = useState("en")
  const [darkMode, setDarkMode] = useState(false)
  const { user, loading } = useAuth(true)

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
                  { code: "en", label: "EN" },
                  { code: "zh", label: "中文" },
                  { code: "ja", label: "日本語" },
                ].map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
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
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
