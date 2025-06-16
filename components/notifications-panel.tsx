"use client"

import { useEffect, useState, useCallback } from "react"
import { Bell, AlertCircle, MailWarning, AlertTriangle, CheckCircle, Hourglass } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { NotificationItem } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { useToast } from "@/components/ui/use-toast"

const NotificationIcon = ({ type }: { type: NotificationItem["type"] }) => {
  switch (type) {
    case "Red Flag":
      return <AlertTriangle className="h-4 w-4 mr-2 text-red-500 shrink-0" />
    case "Payment Reminder":
      return <MailWarning className="h-4 w-4 mr-2 text-yellow-500 shrink-0" />
    case "Action Required":
      return <AlertCircle className="h-4 w-4 mr-2 text-blue-500 shrink-0" />
    default:
      return <Bell className="h-4 w-4 mr-2 text-gray-500 shrink-0" />
  }
}

export default function NotificationsPanel() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMarkingRead, setIsMarkingRead] = useState<Record<string, boolean>>({}) // To track loading state for individual items
  const { toast } = useToast()

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

  const fetchNotifications = useCallback(async () => {
    if (!API_BASE_URL) {
      setIsLoading(false)
      setNotifications([])
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/notifications`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to fetch notifications" }))
        throw new Error(errorData.message || "Failed to fetch notifications")
      }
      const data: any[] = await response.json()

      const mappedData: NotificationItem[] = data.map((item, index) => ({
        id: item.id || `${item.po_number}-${item.timestamp}-${index}`,
        po_number: item.po_number || "N/A",
        type: item.type || "General",
        message: item.message || "No message content.",
        ai_suggestion: item.ai_suggestion || "No suggestion available.",
        timestamp: item.timestamp || new Date().toISOString(),
      }))

      setNotifications(mappedData)
    } catch (error: any) {
      console.error("Error fetching notifications:", error)
      toast({
        title: "Error Fetching Notifications",
        description: error.message || "Could not fetch notifications.",
        variant: "destructive",
      })
      setNotifications([])
    } finally {
      setIsLoading(false)
    }
  }, [API_BASE_URL, toast])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const handleMarkNotificationAsRead = async (notificationToMark: NotificationItem) => {
    if (!API_BASE_URL) {
      toast({ title: "Configuration Error", description: "API URL not set.", variant: "destructive" })
      return
    }
    if (isMarkingRead[notificationToMark.id]) return // Prevent multiple clicks

    setIsMarkingRead((prev) => ({ ...prev, [notificationToMark.id]: true }))

    try {
      const payload = {
        po_number: notificationToMark.po_number,
        title: notificationToMark.type, // Using 'type' as 'title' for the API
      }
      const response = await fetch(`${API_BASE_URL}/notifications/mark-read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to mark as read" }))
        throw new Error(errorData.message || "Server error marking notification as read.")
      }

      toast({
        title: "Notification Marked as Read",
        description: `${notificationToMark.type} for PO ${notificationToMark.po_number} marked as read.`,
        action: <CheckCircle className="h-5 w-5 text-green-500" />,
      })

      // Remove the notification from the local list
      setNotifications((prevNotifications) => prevNotifications.filter((n) => n.id !== notificationToMark.id))
    } catch (error: any) {
      console.error("Error marking notification as read:", error)
      toast({
        title: "Error",
        description: error.message || "Could not mark notification as read.",
        variant: "destructive",
      })
    } finally {
      setIsMarkingRead((prev) => ({ ...prev, [notificationToMark.id]: false }))
    }
  }

  // Determine if there are unread notifications based on the current list length
  const hasUnread = notifications.length > 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 md:w-96 max-h-[70vh] overflow-y-auto">
        <DropdownMenuLabel className="px-2 py-1.5">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <DropdownMenuItem disabled className="px-2 py-1.5">
            Loading notifications...
          </DropdownMenuItem>
        ) : notifications.length === 0 ? (
          <DropdownMenuItem disabled className="px-2 py-1.5">
            No new notifications
          </DropdownMenuItem>
        ) : (
          notifications.slice(0, 10).map((notif) => (
            <DropdownMenuItem
              key={notif.id}
              className="flex flex-col items-start p-2 cursor-pointer hover:bg-accent focus:bg-accent"
              onClick={() => handleMarkNotificationAsRead(notif)}
              disabled={isMarkingRead[notif.id]}
            >
              <div className="flex items-start w-full mb-1">
                <NotificationIcon type={notif.type as NotificationItem["type"]} />
                <div className="flex-1">
                  <span className="font-semibold text-sm block">
                    {notif.po_number} - {notif.type}
                  </span>
                  <p className="text-xs text-muted-foreground whitespace-normal break-words">{notif.message}</p>
                </div>
                {isMarkingRead[notif.id] && <Hourglass className="h-4 w-4 animate-spin ml-2" />}
              </div>
              {notif.ai_suggestion && (
                <p
                  className="text-xs text-blue-600 dark:text-blue-400 mt-1 ml-6 whitespace-normal break-words"
                  title={notif.ai_suggestion}
                >
                  <span className="font-medium">AI Suggestion:</span> {notif.ai_suggestion}
                </p>
              )}
              <p className="text-xs text-muted-foreground self-end mt-1">
                {formatDistanceToNow(new Date(notif.timestamp), { addSuffix: true })}
              </p>
            </DropdownMenuItem>
          ))
        )}
        {notifications.length > 10 && !isLoading && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center text-sm text-blue-600 hover:underline px-2 py-1.5">
              View all notifications ({notifications.length})
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
