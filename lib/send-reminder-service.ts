const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export interface SendReminderPayload {
  po_number: string
}

export interface SendReminderResponse {
  status: "reminder_sent"
}

export interface SendReminderResult {
  success: boolean
  message?: string
  error?: string
  details?: any
}

/**
 * Validates the PO number before sending reminder
 */
function validatePoNumber(poNumber: string): string | null {
  if (!poNumber || typeof poNumber !== "string") {
    return "PO number is required"
  }

  const trimmedPoNumber = poNumber.trim()
  if (trimmedPoNumber === "") {
    return "PO number cannot be empty"
  }

  // Basic PO number format validation (adjust regex as needed)
  const poNumberPattern = /^[A-Z0-9\-_]+$/i
  if (!poNumberPattern.test(trimmedPoNumber)) {
    return "PO number contains invalid characters"
  }

  return null // No validation errors
}

/**
 * Sends a reminder for a purchase order via the API
 */
export async function sendReminder(poNumber: string): Promise<SendReminderResult> {
  console.log("SendReminderService: Starting reminder send process for PO:", poNumber)

  if (!API_BASE_URL) {
    console.error("SendReminderService: API_BASE_URL not configured")
    return {
      success: false,
      error: "API configuration error: Base URL not set",
    }
  }

  // Validate input data
  const validationError = validatePoNumber(poNumber)
  if (validationError) {
    console.error("SendReminderService: Validation failed:", validationError)
    return {
      success: false,
      error: validationError,
    }
  }

  const trimmedPoNumber = poNumber.trim()

  try {
    // Construct the API payload
    const payload: SendReminderPayload = {
      po_number: trimmedPoNumber,
    }

    console.log("SendReminderService: Sending reminder with payload:", payload)

    const response = await fetch(`${API_BASE_URL}/ai/send-reminder`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log(`SendReminderService: Response status: ${response.status}`)

    if (!response.ok) {
      let errorMessage = `Server responded with ${response.status}`
      try {
        const errorData = await response.json()
        console.error("SendReminderService: Error response:", errorData)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (parseError) {
        console.error("SendReminderService: Could not parse error response:", parseError)
        errorMessage = response.statusText || errorMessage
      }

      return {
        success: false,
        error: `Failed to send reminder: ${errorMessage}`,
        details: { status: response.status },
      }
    }

    // Parse successful response
    const responseData: SendReminderResponse = await response.json()
    console.log("SendReminderService: Success response:", responseData)

    if (responseData.status === "reminder_sent") {
      return {
        success: true,
        message: `Reminder successfully sent for Purchase Order ${trimmedPoNumber}`,
      }
    } else {
      return {
        success: false,
        error: `Unexpected response status: ${responseData.status}`,
        details: responseData,
      }
    }
  } catch (error) {
    console.error("SendReminderService: Network or processing error:", error)

    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        return {
          success: false,
          error: "Network error: Unable to connect to the server. Please check your connection and try again.",
        }
      }
      return {
        success: false,
        error: `Error sending reminder: ${error.message}`,
      }
    }

    return {
      success: false,
      error: "An unexpected error occurred while sending the reminder",
    }
  }
}

/**
 * Logs the send reminder action for audit purposes
 */
export async function logSendReminderAction(poNumber: string, success: boolean, errorMessage?: string): Promise<void> {
  if (!API_BASE_URL) {
    console.warn("SendReminderService: Cannot log action - API_BASE_URL not set")
    return
  }

  try {
    await fetch(`${API_BASE_URL}/log-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        po_number: poNumber,
        action: success ? "REMINDER_SENT_SUCCESS" : "REMINDER_SENT_FAILED",
        actor: "system", // In a real app, this would be the current user
        approved: success,
        details: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      }),
    })
  } catch (error) {
    console.warn("SendReminderService: Failed to log send reminder action:", error)
  }
}

/**
 * Determines if a reminder can be sent for a given PO
 */
export function canSendReminder(poNumber: string): boolean {
  return validatePoNumber(poNumber) === null
}

/**
 * Gets a user-friendly message for reminder sending
 */
export function getReminderMessage(poNumber: string): string {
  return `This will send a reminder notification for Purchase Order ${poNumber}. The reminder will be sent to the relevant parties to follow up on the order status.`
}
