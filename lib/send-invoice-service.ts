import type { AIInvoiceResponse } from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export interface SendInvoicePayload {
  recipient: string
  invoice: {
    po_number: string
    bill_to: string
    vendor: string
    total: number
    items: string[]
  }
}

export interface SendInvoiceResponse {
  success: boolean
  message: string
}

export interface SendInvoiceResult {
  success: boolean
  message?: string
  error?: string
  details?: any
}

/**
 * Maps AI invoice data to the send invoice API payload format
 */
function mapInvoiceToPayload(invoiceData: AIInvoiceResponse, poNumber: string, recipient: string): SendInvoicePayload {
  return {
    recipient: recipient.trim(),
    invoice: {
      po_number: poNumber,
      bill_to: invoiceData.bill_to.company || "Unknown Company",
      vendor: invoiceData.vendor.company || "Unknown Vendor",
      total: invoiceData.summary.total,
      items: invoiceData.items.map(
        (item) => `${item.description} (Qty: ${item.qty}, Unit Price: $${item.unit_price.toFixed(2)})`,
      ),
    },
  }
}

/**
 * Validates the invoice data before sending
 */
function validateInvoiceData(invoiceData: AIInvoiceResponse, recipient: string): string | null {
  if (!recipient || recipient.trim() === "") {
    return "Recipient email address is required"
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(recipient.trim())) {
    return "Please provide a valid email address"
  }

  if (!invoiceData.invoice_id || invoiceData.invoice_id.trim() === "") {
    return "Invoice ID is missing"
  }

  if (!invoiceData.summary || typeof invoiceData.summary.total !== "number") {
    return "Invoice total is invalid"
  }

  if (!invoiceData.items || invoiceData.items.length === 0) {
    return "Invoice must contain at least one item"
  }

  return null // No validation errors
}

/**
 * Determines the recipient email address from invoice data
 */
export function getDefaultRecipient(invoiceData: AIInvoiceResponse): string {
  // Try to get email from bill_to first, then vendor
  if (invoiceData.bill_to.email && invoiceData.bill_to.email.trim() !== "") {
    return invoiceData.bill_to.email.trim()
  }

  if (invoiceData.vendor.email && invoiceData.vendor.email.trim() !== "") {
    return invoiceData.vendor.email.trim()
  }

  // Generate a placeholder email based on company name
  const companyName = invoiceData.bill_to.company || invoiceData.vendor.company || "company"
  const sanitizedName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "")
  return `${sanitizedName}@example.com`
}

/**
 * Sends an invoice via the API
 */
export async function sendInvoice(
  invoiceData: AIInvoiceResponse,
  poNumber: string,
  recipient?: string,
): Promise<SendInvoiceResult> {
  console.log("SendInvoiceService: Starting invoice send process")

  if (!API_BASE_URL) {
    console.error("SendInvoiceService: API_BASE_URL not configured")
    return {
      success: false,
      error: "API configuration error: Base URL not set",
    }
  }

  // Use provided recipient or determine default
  const finalRecipient = recipient || getDefaultRecipient(invoiceData)

  // Validate input data
  const validationError = validateInvoiceData(invoiceData, finalRecipient)
  if (validationError) {
    console.error("SendInvoiceService: Validation failed:", validationError)
    return {
      success: false,
      error: validationError,
    }
  }

  try {
    // Map invoice data to API payload format
    const payload = mapInvoiceToPayload(invoiceData, poNumber, finalRecipient)

    console.log("SendInvoiceService: Sending invoice with payload:", {
      ...payload,
      recipient: payload.recipient, // Log recipient for debugging
    })

    const response = await fetch(`${API_BASE_URL}/ai/send-invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log(`SendInvoiceService: Response status: ${response.status}`)

    if (!response.ok) {
      let errorMessage = `Server responded with ${response.status}`
      try {
        const errorData = await response.json()
        console.error("SendInvoiceService: Error response:", errorData)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (parseError) {
        console.error("SendInvoiceService: Could not parse error response:", parseError)
        errorMessage = response.statusText || errorMessage
      }

      return {
        success: false,
        error: `Failed to send invoice: ${errorMessage}`,
        details: { status: response.status },
      }
    }

    // Parse successful response
    const responseData: SendInvoiceResponse = await response.json()
    console.log("SendInvoiceService: Success response:", responseData)

    if (responseData.success) {
      return {
        success: true,
        message: responseData.message || "Invoice sent successfully",
      }
    } else {
      return {
        success: false,
        error: responseData.message || "Unknown error occurred while sending invoice",
      }
    }
  } catch (error) {
    console.error("SendInvoiceService: Network or processing error:", error)

    if (error instanceof Error) {
      if (error.message.includes("fetch")) {
        return {
          success: false,
          error: "Network error: Unable to connect to the server. Please check your connection and try again.",
        }
      }
      return {
        success: false,
        error: `Error sending invoice: ${error.message}`,
      }
    }

    return {
      success: false,
      error: "An unexpected error occurred while sending the invoice",
    }
  }
}

/**
 * Logs the send invoice action for audit purposes
 */
export async function logSendInvoiceAction(
  poNumber: string,
  invoiceId: string,
  recipient: string,
  success: boolean,
  errorMessage?: string,
): Promise<void> {
  if (!API_BASE_URL) {
    console.warn("SendInvoiceService: Cannot log action - API_BASE_URL not set")
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
        action: success ? "INVOICE_SENT_SUCCESS" : "INVOICE_SENT_FAILED",
        actor: "system", // In a real app, this would be the current user
        approved: success,
        details: {
          invoice_id: invoiceId,
          recipient: recipient,
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      }),
    })
  } catch (error) {
    console.warn("SendInvoiceService: Failed to log send action:", error)
  }
}
