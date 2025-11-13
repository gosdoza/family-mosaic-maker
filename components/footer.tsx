"use client"

import { Heart } from "lucide-react"
import Link from "next/link"
import { t } from "@/lib/i18n-client"

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {t("footer.madeWith")} <Heart className="w-4 h-4 text-primary fill-primary" /> {t("footer.by")}
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("footer.privacyPolicy")}
            </Link>
            <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("footer.refundPolicy")}
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("footer.settings")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
