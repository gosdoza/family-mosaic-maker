"use client"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Sparkles, User, Package, ArrowRight, CheckCircle2, Clock, LogOut, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"

interface DashboardClientProps {
  email: string
}

interface Order {
  id: string
  jobId?: string
  status: string
  date?: string
  createdAt?: string
  amount?: number
  currency?: string
  paymentStatus?: "paid" | "unpaid"
}

export function DashboardClient({ email }: DashboardClientProps) {
  // Placeholder for user type (will be replaced with real data later)
  const userType = "Free" // or "Paid"

  // Phase 2: State declarations for orders
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  // Phase 2: useEffect to fetch orders from /api/orders
  useEffect(() => {
    let cancelled = false

    async function loadOrders() {
      try {
        setOrdersLoading(true)
        setOrdersError(null)

        const res = await fetch("/api/orders")
        if (!res.ok) {
          throw new Error(`Failed to load orders: ${res.status}`)
        }

        const data = await res.json()
        if (!cancelled) {
          // Handle API response structure: { orders: [...] } or [...]
          const list = Array.isArray(data) ? data : data.orders ?? []
          
          // Sort by createdAt (most recent first) and take top 3
          const sorted = list.sort((a: Order, b: Order) => {
            const dateA = new Date(a.createdAt || a.date || 0).getTime()
            const dateB = new Date(b.createdAt || b.date || 0).getTime()
            return dateB - dateA
          })
          
          setRecentOrders(sorted.slice(0, 3))
          setOrdersError(null)
        }
      } catch (err: any) {
        if (!cancelled) {
          setOrdersError(err?.message ?? "Failed to load orders")
          // Degrade gracefully - show empty state
          setRecentOrders([])
        }
      } finally {
        if (!cancelled) {
          setOrdersLoading(false)
        }
      }
    }

    loadOrders()

    return () => {
      cancelled = true
    }
  }, [])

  const getStatusBadge = (status: string) => {
    if (status === "Completed") {
      return (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </Badge>
      )
    }
    if (status === "Processing") {
      return (
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          Processing
        </Badge>
      )
    }
    return <Badge variant="outline">{status}</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-4xl sm:text-5xl font-bold text-balance">
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </span>
        </h1>
        <p className="text-lg text-muted-foreground text-pretty">
          Welcome back! Here's what's happening with your account.
        </p>
      </div>

      {/* Cards Grid - 2 columns on desktop, 1 column on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Next Step */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-2xl">Next Step</CardTitle>
            </div>
            <CardDescription>
              Create a beautiful family mosaic with AI-powered generation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/generate">
              <Button size="lg" className="w-full rounded-full h-12 shadow-lg group">
                Generate a new family mosaic
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Card 2: Your Account */}
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="w-5 h-5 text-primary" />
              </div>
              <CardTitle className="text-2xl">Your Account</CardTitle>
            </div>
            <CardDescription>Account information and subscription status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="text-base font-semibold break-all">{email}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Account Type</p>
              <div className="flex items-center gap-2">
                <Badge variant={userType === "Paid" ? "default" : "secondary"}>
                  {userType} User
                </Badge>
                {userType === "Free" && (
                  <Link href="/pricing">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                      Upgrade
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <Link href="/auth/logout">
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign out
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 3: Recent Orders - Full width */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Recent Orders</CardTitle>
                <CardDescription>Your latest family mosaic orders</CardDescription>
              </div>
            </div>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="gap-2">
                View All
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {/* Phase 3: Stable Recent Orders UI with proper error handling */}
          {ordersLoading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading recent orders…</p>
            </div>
          ) : ordersError ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm text-destructive">{ordersError}</p>
              <p className="text-xs text-muted-foreground mt-2">Failed to load recent orders. Please try again later.</p>
            </div>
          ) : !recentOrders || recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-sm text-muted-foreground">No orders yet. Generate a family photo to see it here.</p>
              <Link href="/generate">
                <Button variant="outline" className="mt-4 rounded-full">
                  Create your first mosaic
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* TODO: Replace mock /api/orders with real DB-backed orders when we integrate Stripe/PayPal fully. */}
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-background/50 border border-border hover:bg-background/70 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-primary/5">
                      <Package className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{order.jobId || order.id}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm text-muted-foreground">
                          {new Date(order.date || order.createdAt || Date.now()).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        {order.amount && (
                          <span className="text-sm font-medium">
                            ${order.amount.toFixed(2)} {order.currency || "USD"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(order.status)}
                    {order.paymentStatus && (
                      <Badge variant={order.paymentStatus === "paid" ? "default" : "outline"} className="rounded-full">
                        {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </Badge>
                    )}
                    <Link href={`/results/${order.jobId || order.id}${order.paymentStatus === "paid" ? "?paid=1" : ""}`}>
                      <Button variant="ghost" size="sm" className="gap-1">
                        View
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

