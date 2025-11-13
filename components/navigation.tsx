"use client"

import Link from "next/link"
import { Menu, X, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { t } from "@/lib/i18n-client"

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 group">
            <Sparkles className="w-6 h-6 text-primary transition-transform group-hover:scale-110" />
            <span className="text-xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Family Mosaic Maker
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/generate" className="text-sm font-medium hover:text-primary transition-colors">
              {t("nav.generate")}
            </Link>
            <Link href="/pricing" className="text-sm font-medium hover:text-primary transition-colors">
              {t("nav.pricing")}
            </Link>
            <Link href="/orders" className="text-sm font-medium hover:text-primary transition-colors">
              {t("nav.orders")}
            </Link>
            <Link href="/help" className="text-sm font-medium hover:text-primary transition-colors">
              {t("nav.help")}
            </Link>
            <Link href="/auth/login">
              <Button size="sm" className="rounded-full">
                {t("nav.signIn")}
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4 space-y-3 border-t border-border/50">
            <Link
              href="/generate"
              className="block text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("nav.generate")}
            </Link>
            <Link
              href="/pricing"
              className="block text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("nav.pricing")}
            </Link>
            <Link
              href="/orders"
              className="block text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("nav.orders")}
            </Link>
            <Link
              href="/help"
              className="block text-sm font-medium hover:text-primary transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("nav.help")}
            </Link>
            <Link href="/auth/login" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" className="w-full rounded-full">
                {t("nav.signIn")}
              </Button>
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
