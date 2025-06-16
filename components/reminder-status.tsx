"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BellRing, Clock, CheckCircle } from "lucide-react"

interface ReminderStatusProps {
  poNumber: string
}

interface ReminderActivity {
  timestamp: string
  status: "sent" | "failed"
  message: string
}

export default function ReminderStatus({ poNumber }: ReminderStatusProps) {
  const [recentActivity, setRecentActivity] = useState<ReminderActivity | null>(null)

  // This would typically fetch from an API or local storage
  // For now, we'll use a simple localStorage approach
  useEffect(() => {
    const checkRecentActivity = () => {
      try {
        const stored = localStorage.getItem(`reminder_activity_${poNumber}`)
        if (stored) {
          const activity: ReminderActivity = JSON.parse(stored)
          // Only show activity from the last 5 minutes
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
          if (new Date(activity.timestamp).getTime() > fiveMinutesAgo) {
            setRecentActivity(activity)
          }
        }
      } catch (error) {
        console.warn("Failed to load reminder activity:", error)
      }
    }

    checkRecentActivity()

    // Check for updates every 30 seconds
    const interval = setInterval(checkRecentActivity, 30000)

    return () => clearInterval(interval)
  }, [poNumber])

  if (!recentActivity) {
    return null
  }

  const timeAgo = new Date(recentActivity.timestamp).toLocaleTimeString()

  return (
    <Alert className="mt-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2">
        {recentActivity.status === "sent" ? (
          <CheckCircle className="h-4 w-4 text-green-600" />
        ) : (
          <BellRing className="h-4 w-4 text-orange-600" />
        )}
        <Clock className="h-3 w-3 text-muted-foreground" />
      </div>
      <AlertDescription className="flex items-center justify-between">
        <span>{recentActivity.message}</span>
        <Badge variant="outline" className="text-xs">
          {timeAgo}
        </Badge>
      </AlertDescription>
    </Alert>
  )
}
