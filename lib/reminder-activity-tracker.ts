interface ReminderActivity {
    timestamp: string
    status: "sent" | "failed"
    message: string
  }
  
  /**
   * Tracks reminder activity in localStorage for recent activity display
   */
  export function trackReminderActivity(poNumber: string, status: "sent" | "failed", message: string): void {
    try {
      const activity: ReminderActivity = {
        timestamp: new Date().toISOString(),
        status,
        message,
      }
  
      localStorage.setItem(`reminder_activity_${poNumber}`, JSON.stringify(activity))
  
      // Clean up old entries (older than 1 hour)
      cleanupOldReminderActivity()
    } catch (error) {
      console.warn("Failed to track reminder activity:", error)
    }
  }
  
  /**
   * Cleans up old reminder activity entries from localStorage
   */
  function cleanupOldReminderActivity(): void {
    try {
      const oneHourAgo = Date.now() - 60 * 60 * 1000
  
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith("reminder_activity_")) {
          const stored = localStorage.getItem(key)
          if (stored) {
            const activity: ReminderActivity = JSON.parse(stored)
            if (new Date(activity.timestamp).getTime() < oneHourAgo) {
              localStorage.removeItem(key)
            }
          }
        }
      }
    } catch (error) {
      console.warn("Failed to cleanup old reminder activity:", error)
    }
  }
  
  /**
   * Gets recent reminder activity for a PO
   */
  export function getRecentReminderActivity(poNumber: string): ReminderActivity | null {
    try {
      const stored = localStorage.getItem(`reminder_activity_${poNumber}`)
      if (stored) {
        const activity: ReminderActivity = JSON.parse(stored)
        // Only return activity from the last hour
        const oneHourAgo = Date.now() - 60 * 60 * 1000
        if (new Date(activity.timestamp).getTime() > oneHourAgo) {
          return activity
        }
      }
    } catch (error) {
      console.warn("Failed to get reminder activity:", error)
    }
  
    return null
  }
  