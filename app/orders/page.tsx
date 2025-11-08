"use client"

import { Navigation } from "@/components/navigation"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Download, Package, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/useAuth"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Order {
  id: string
  date: string
  status: string
  thumbnail: string
  count: number
  template: string
  style?: string
  paymentStatus: "paid" | "unpaid"
  jobId?: string
}

export default function OrdersPage() {
  const [filter, setFilter] = useState<string>("All")
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, loading: authLoading } = useAuth(true)
  const router = useRouter()

  // Fetch orders from API
  useEffect(() => {
    if (authLoading || !user) return

    async function fetchOrders() {
      try {
        setLoading(true)
        const response = await fetch("/api/orders")
        
        if (!response.ok) {
          throw new Error("Failed to fetch orders")
        }

        const { orders: fetchedOrders } = await response.json()
        setOrders(fetchedOrders || [])
      } catch (err) {
        console.error("Error fetching orders:", err)
        setError(err instanceof Error ? err.message : "Failed to load orders")
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()
  }, [authLoading, user])

  const filteredOrders = orders.filter((order) => {
    if (filter === "All") return true
    if (filter === "Completed") return order.status === "Completed" || order.status === "completed"
    if (filter === "Processing") return order.status === "Processing" || order.status === "processing" || order.status === "pending"
    return order.status === filter
  })

  if (authLoading || loading) {
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

      <main
        {...(process.env.NODE_ENV !== "production" ? { "data-testid": "orders-page" } : {})}
        className="flex-1 pt-24 pb-16"
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-12">
            <div className="space-y-2">
              <h1 className="text-4xl sm:text-5xl font-bold text-balance">
                Your{" "}
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Orders</span>
              </h1>
              <p className="text-lg text-muted-foreground text-pretty">Access all your generated family mosaics</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              {["All", "Completed", "Processing"].map((status) => (
                <Button
                  key={status}
                  variant={filter === status ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(status)}
                  className="rounded-full"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {error ? (
            <Card className="p-12 glass text-center">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={() => window.location.reload()} className="rounded-full">
                Retry
              </Button>
            </Card>
              ) : filteredOrders.length > 0 ? (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      {...(process.env.NODE_ENV !== "production" ? { "data-testid": "order-card" } : {})}
                    >
                      <Card
                        {...(process.env.NODE_ENV !== "production" ? { "data-testid": "order-item" } : {})}
                        className="p-6 glass hover:shadow-lg transition-all"
                      >
                    <div className="flex flex-col sm:flex-row gap-6">
                      <div className="w-32 h-32 rounded-xl overflow-hidden shrink-0">
                        <img
                          src={order.thumbnail || "/placeholder.svg"}
                          alt={`Order ${order.id}`}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-lg">{order.id}</h3>
                              <span className="text-2xl">
                                {order.template === "Christmas" ? "🎄" : order.template === "Birthday" ? "🎂" : order.template === "Wedding" ? "💒" : "📸"}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {new Date(order.date).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <Badge
                              variant={order.status === "Completed" || order.status === "completed" ? "default" : "secondary"}
                              className="rounded-full"
                            >
                              {order.status === "Completed" || order.status === "completed" ? "Completed" : "Processing"}
                            </Badge>
                            <Badge
                              variant={order.paymentStatus === "paid" ? "default" : "outline"}
                              className="rounded-full"
                            >
                              {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {order.template && (
                            <Badge variant="outline" className="rounded-full">
                              {order.template}
                            </Badge>
                          )}
                          {order.style && (
                            <Badge variant="outline" className="rounded-full">
                              {order.style}
                            </Badge>
                          )}
                          <span className="text-sm text-muted-foreground">
                            {order.count} {order.count === 1 ? "variation" : "variations"}
                          </span>
                        </div>

                            {order.status === "Completed" || order.status === "completed" ? (
                              <a
                                {...(process.env.NODE_ENV !== "production" ? { "data-testid": "order-view-link" } : {})}
                                href={`/results?id=${order.jobId || order.id}`}
                                className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4"
                              >
                                <Download className="w-4 h-4 mr-2" />
                                View Results
                              </a>
                            ) : (
                              <Button variant="outline" className="rounded-full" size="sm" disabled>
                                Processing...
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
          ) : (
            <Card className="p-12 glass text-center">
              <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No {filter.toLowerCase()} orders</h3>
              <p className="text-muted-foreground mb-6">
                {filter === "All"
                  ? "Start creating beautiful family mosaics today"
                  : `No ${filter.toLowerCase()} orders found`}
              </p>
              <Button className="rounded-full">Create Your First Mosaic</Button>
            </Card>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
