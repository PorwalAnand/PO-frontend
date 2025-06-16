"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, CheckCircle, Clock, CreditCard } from "lucide-react"
import type { DashboardMetrics, MetricItem } from "@/lib/types"

const iconMap = {
  total_orders: Briefcase,
  in_progress: Clock,
  completed: CheckCircle,
  payment_pending: CreditCard,
}

export default function MetricsCards() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      setIsLoading(true)
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
      try {
        const response = await fetch(`${API_BASE_URL}/metrics`)
        if (!response.ok) throw new Error("Failed to fetch metrics")
        const data = await response.json()
        setMetrics(data)
      } catch (error) {
        console.error("Error fetching metrics:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchMetrics()
  }, [])

  const displayMetrics: MetricItem[] = metrics
    ? [
        { label: "Total Orders Received", value: metrics.total_orders, icon: iconMap.total_orders },
        { label: "In Progress", value: metrics.in_progress, icon: iconMap.in_progress },
        { label: "Completed", value: metrics.completed, icon: iconMap.completed },
        { label: "Payment Pending", value: metrics.payment_pending, icon: iconMap.payment_pending },
      ]
    : Array(4)
        .fill({ label: "Loading...", value: "..." })
        .map((item, idx) => ({
          ...item,
          icon: Object.values(iconMap)[idx % Object.values(iconMap).length],
        }))

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
      {displayMetrics.map((metric, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
            {isLoading && !metrics ? (
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
            ) : (
              metric.icon && <metric.icon className="h-4 w-4 text-muted-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading && !metrics ? (
              <div className="h-8 w-1/2 bg-gray-200 rounded animate-pulse" />
            ) : (
              <div className="text-2xl font-bold">{metric.value}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
