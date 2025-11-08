import { Heart } from "lucide-react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-card/30 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            Made with <Heart className="w-4 h-4 text-primary fill-primary" /> by Family Mosaic Maker
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/help" className="text-muted-foreground hover:text-foreground transition-colors">
              Refund Policy
            </Link>
            <Link href="/settings" className="text-muted-foreground hover:text-foreground transition-colors">
              Settings
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
