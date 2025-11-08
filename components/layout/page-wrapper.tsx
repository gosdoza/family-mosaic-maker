import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"

interface PageWrapperProps {
  children: React.ReactNode
  className?: string
}

export function PageWrapper({ children, className = "" }: PageWrapperProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      <Navigation />
      {children}
      <Footer />
    </div>
  )
}

