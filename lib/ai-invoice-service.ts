import type { AIInvoicePayload, AIInvoiceResponse, InvoiceUpdatePayload } from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export interface InvoiceGenerationResult {
  success: boolean
  invoice?: AIInvoiceResponse
  error?: string
  rawResponse?: any
  source?: "api" | "database" | "generated" // Track where the invoice came from
}

export interface InvoiceUpdateResult {
  success: boolean
  invoice?: AIInvoiceResponse
  error?: string
}

/**
 * Generates a fallback invoice ID if none is provided
 */
function generateFallbackInvoiceId(poNumber: string): string {
  const timestamp = Date.now()
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")
  return `INV-${poNumber}-${timestamp}-${random}`
}

/**
 * Validates and normalizes the API response structure with enhanced error handling
 */
function validateAndNormalizeInvoiceResponse(rawResponse: any, poNumber?: string): AIInvoiceResponse | null {
  console.log("AIInvoiceService: Validating raw response:", rawResponse)
  console.log("AIInvoiceService: Response type:", typeof rawResponse)

  if (!rawResponse || typeof rawResponse !== "object") {
    console.error("AIInvoiceService: Response is not an object:", rawResponse)
    return null
  }

  // Handle different response wrapper patterns
  let actualData = rawResponse
  const possibleWrappers = ["data", "invoice", "result", "response"]

  for (const wrapper of possibleWrappers) {
    if (rawResponse[wrapper] && typeof rawResponse[wrapper] === "object") {
      console.log(`AIInvoiceService: Found ${wrapper} wrapper, using nested data`)
      actualData = rawResponse[wrapper]
      break
    }
  }

  console.log("AIInvoiceService: Using actual data:", actualData)
  console.log("AIInvoiceService: Available keys:", actualData ? Object.keys(actualData) : "No keys")

  // Check for invoice_id with multiple possible field names
  let invoiceId = actualData.invoice_id || actualData.invoiceId || actualData.id || actualData.invoice_number

  if (!invoiceId || typeof invoiceId !== "string" || invoiceId.trim() === "") {
    console.warn("AIInvoiceService: invoice_id missing or invalid, generating fallback")
    if (poNumber) {
      invoiceId = generateFallbackInvoiceId(poNumber)
      console.log("AIInvoiceService: Generated fallback invoice_id:", invoiceId)
    } else {
      console.error("AIInvoiceService: Cannot generate fallback invoice_id without PO number")
      return null
    }
  }

  // Validate other required fields with fallbacks
  const requiredFields = ["invoice_date", "due_date", "bill_to", "vendor", "items", "summary"]
  const missingFields = requiredFields.filter((field) => {
    const hasField = field in actualData && actualData[field] !== null && actualData[field] !== undefined
    if (!hasField) {
      console.warn(`AIInvoiceService: Missing field '${field}', will use fallback`)
    }
    return !hasField
  })

  if (missingFields.length > 0) {
    console.warn("AIInvoiceService: Missing fields will use fallbacks:", missingFields)
  }

  // Create normalized response with comprehensive fallbacks
  const normalizedResponse: AIInvoiceResponse = {
    invoice_id: invoiceId.trim(),
    invoice_date: actualData.invoice_date || actualData.invoiceDate || new Date().toISOString().split("T")[0],
    due_date:
      actualData.due_date ||
      actualData.dueDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    payment_terms: actualData.payment_terms || actualData.paymentTerms || "Net 30",
    shipping_method: actualData.shipping_method || actualData.shippingMethod || "Standard",
    bill_to: {
      company: actualData.bill_to?.company || actualData.billTo?.company || "Unknown Company",
      contact: actualData.bill_to?.contact || actualData.billTo?.contact || "Unknown Contact",
      address: actualData.bill_to?.address || actualData.billTo?.address || "Unknown Address",
      phone: actualData.bill_to?.phone || actualData.billTo?.phone || "",
      email: actualData.bill_to?.email || actualData.billTo?.email || "",
    },
    vendor: {
      company: actualData.vendor?.company || "Unknown Vendor",
      contact: actualData.vendor?.contact || "Unknown Contact",
      address: actualData.vendor?.address || "Unknown Address",
      phone: actualData.vendor?.phone || "",
      email: actualData.vendor?.email || "",
    },
    items: Array.isArray(actualData.items)
      ? actualData.items.map((item: any, index: number) => ({
          description: item.description || `Item ${index + 1}`,
          qty: Number(item.qty) || 1,
          unit: item.unit || "Each",
          unit_price: Number(item.unit_price) || Number(item.unitPrice) || 0,
          total: Number(item.total) || 0,
        }))
      : [],
    summary: {
      subtotal: Number(actualData.summary?.subtotal) || 0,
      discount: Number(actualData.summary?.discount) || 0,
      freight: Number(actualData.summary?.freight) || 0,
      tax: Number(actualData.summary?.tax) || 0,
      total: Number(actualData.summary?.total) || 0,
    },
    notes: actualData.notes || "",
    payment_status: actualData.payment_status || actualData.paymentStatus || "Pending",
  }

  console.log("AIInvoiceService: Normalized response:", normalizedResponse)
  return normalizedResponse
}

/**
 * Attempts to retrieve an existing invoice from the database
 */
async function getExistingInvoiceFromDatabase(poNumber: string): Promise<AIInvoiceResponse | null> {
  if (!API_BASE_URL) {
    console.warn("AIInvoiceService: API_BASE_URL not set, skipping database check")
    return null
  }

  try {
    console.log(`AIInvoiceService: Checking for existing invoice for PO ${poNumber}`)

    const response = await fetch(`${API_BASE_URL}/invoices/by-po/${poNumber}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (response.status === 404) {
      console.log("AIInvoiceService: No existing invoice found in database")
      return null
    }

    if (!response.ok) {
      console.warn(`AIInvoiceService: Database check failed with status ${response.status}`)
      return null
    }

    const existingInvoice = await response.json()
    console.log("AIInvoiceService: Found existing invoice in database:", existingInvoice)

    const normalizedInvoice = validateAndNormalizeInvoiceResponse(existingInvoice, poNumber)
    return normalizedInvoice
  } catch (error) {
    console.warn("AIInvoiceService: Error checking database for existing invoice:", error)
    return null
  }
}

/**
 * Saves invoice to database for future retrieval
 */
async function saveInvoiceToDatabase(invoice: AIInvoiceResponse, poNumber: string): Promise<boolean> {
  if (!API_BASE_URL) {
    console.warn("AIInvoiceService: API_BASE_URL not set, skipping database save")
    return false
  }

  try {
    console.log(`AIInvoiceService: Saving invoice to database for PO ${poNumber}`)

    const response = await fetch(`${API_BASE_URL}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...invoice,
        po_number: poNumber,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    })

    if (response.ok) {
      console.log("AIInvoiceService: Invoice saved to database successfully")
      return true
    } else {
      console.warn(`AIInvoiceService: Failed to save invoice to database: ${response.status}`)
      return false
    }
  } catch (error) {
    console.warn("AIInvoiceService: Error saving invoice to database:", error)
    return false
  }
}

/**
 * Generates an AI invoice for a given purchase order with comprehensive error handling
 */
export async function generateAIInvoice(poNumber: string): Promise<InvoiceGenerationResult> {
  if (!poNumber || poNumber.trim() === "") {
    return {
      success: false,
      error: "Purchase Order number is required",
    }
  }

  const trimmedPoNumber = poNumber.trim()
  console.log(`AIInvoiceService: Starting invoice generation for PO ${trimmedPoNumber}`)

  // Step 1: Check if invoice already exists in database
  try {
    const existingInvoice = await getExistingInvoiceFromDatabase(trimmedPoNumber)
    if (existingInvoice) {
      console.log("AIInvoiceService: Returning existing invoice from database")
      return {
        success: true,
        invoice: existingInvoice,
        source: "database",
      }
    }
  } catch (error) {
    console.warn("AIInvoiceService: Database check failed, continuing with API generation:", error)
  }

  // Step 2: Generate new invoice via API
  if (!API_BASE_URL) {
    console.error("AIInvoiceService: NEXT_PUBLIC_API_BASE_URL is not set")
    return {
      success: false,
      error: "API configuration error: Base URL not set",
    }
  }

  const payload: AIInvoicePayload = {
    po_number: trimmedPoNumber,
  }

  try {
    console.log(`AIInvoiceService: Calling API to generate invoice`)
    console.log(`AIInvoiceService: API URL: ${API_BASE_URL}/ai/invoice`)
    console.log(`AIInvoiceService: Payload:`, payload)

    const response = await fetch(`${API_BASE_URL}/ai/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    console.log(`AIInvoiceService: Response status: ${response.status}`)

    if (!response.ok) {
      let errorMessage = `Server responded with ${response.status}`
      try {
        const errorData = await response.json()
        console.error("AIInvoiceService: Error response data:", errorData)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch (parseError) {
        console.error("AIInvoiceService: Could not parse error response:", parseError)
        errorMessage = response.statusText || errorMessage
      }

      console.error("AIInvoiceService: API error", { status: response.status, message: errorMessage })
      return {
        success: false,
        error: `Failed to generate invoice: ${errorMessage}`,
      }
    }

    // Parse response
    const responseText = await response.text()
    console.log("AIInvoiceService: Raw response text length:", responseText.length)

    let rawResponseData: any
    try {
      rawResponseData = JSON.parse(responseText)
      console.log("AIInvoiceService: Successfully parsed JSON response")
    } catch (parseError) {
      console.error("AIInvoiceService: Failed to parse JSON response:", parseError)
      return {
        success: false,
        error: "Invalid JSON response from server",
        rawResponse: responseText,
      }
    }

    // Validate and normalize response
    const normalizedInvoice = validateAndNormalizeInvoiceResponse(rawResponseData, trimmedPoNumber)

    if (!normalizedInvoice) {
      console.error("AIInvoiceService: Failed to normalize response")
      return {
        success: false,
        error: "Invalid response structure from API. The response may be missing required fields.",
        rawResponse: rawResponseData,
      }
    }

    // Step 3: Save to database for future retrieval
    try {
      await saveInvoiceToDatabase(normalizedInvoice, trimmedPoNumber)
    } catch (saveError) {
      console.warn("AIInvoiceService: Failed to save to database, but continuing:", saveError)
    }

    console.log("AIInvoiceService: Invoice generation successful")
    return {
      success: true,
      invoice: normalizedInvoice,
      source: "api",
    }
  } catch (error) {
    console.error("AIInvoiceService: Network or processing error:", error)

    // Step 4: Fallback - create a basic invoice structure if all else fails
    if (error instanceof Error && error.message.includes("fetch")) {
      console.log("AIInvoiceService: Network error detected, attempting to create fallback invoice")

      try {
        const fallbackInvoice: AIInvoiceResponse = {
          invoice_id: generateFallbackInvoiceId(trimmedPoNumber),
          invoice_date: new Date().toISOString().split("T")[0],
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          payment_terms: "Net 30",
          shipping_method: "Standard",
          bill_to: {
            company: "Unknown Company",
            contact: "Unknown Contact",
            address: "Unknown Address",
            phone: "",
            email: "",
          },
          vendor: {
            company: "Unknown Vendor",
            contact: "Unknown Contact",
            address: "Unknown Address",
            phone: "",
            email: "",
          },
          items: [],
          summary: {
            subtotal: 0,
            discount: 0,
            freight: 0,
            tax: 0,
            total: 0,
          },
          notes: `Fallback invoice generated for PO ${trimmedPoNumber} due to API unavailability. Please update with correct information.`,
          payment_status: "Pending",
        }

        console.log("AIInvoiceService: Created fallback invoice")
        return {
          success: true,
          invoice: fallbackInvoice,
          source: "generated",
        }
      } catch (fallbackError) {
        console.error("AIInvoiceService: Failed to create fallback invoice:", fallbackError)
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred during invoice generation",
    }
  }
}

/**
 * Updates an existing invoice with enhanced validation
 */
export async function updateInvoice(updatePayload: InvoiceUpdatePayload): Promise<InvoiceUpdateResult> {
  if (!API_BASE_URL) {
    console.error("AIInvoiceService: NEXT_PUBLIC_API_BASE_URL is not set")
    return {
      success: false,
      error: "API configuration error: Base URL not set",
    }
  }

  if (!updatePayload.invoice_id || updatePayload.invoice_id.trim() === "") {
    return {
      success: false,
      error: "Invoice ID is required for updates",
    }
  }

  try {
    console.log(`AIInvoiceService: Updating invoice ${updatePayload.invoice_id}`)

    const response = await fetch(`${API_BASE_URL}/ai/invoice/${updatePayload.invoice_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    })

    console.log(`AIInvoiceService: Update response status: ${response.status}`)

    if (!response.ok) {
      let errorMessage = `Server responded with ${response.status}`
      try {
        const errorData = await response.json()
        console.error("AIInvoiceService: Update error response:", errorData)
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }

      return {
        success: false,
        error: `Failed to update invoice: ${errorMessage}`,
      }
    }

    const rawResponseData = await response.json()
    const normalizedInvoice = validateAndNormalizeInvoiceResponse(rawResponseData, updatePayload.invoice_id)

    if (!normalizedInvoice) {
      return {
        success: false,
        error: "Invalid response structure from update API",
      }
    }

    console.log("AIInvoiceService: Invoice update successful")
    return {
      success: true,
      invoice: normalizedInvoice,
    }
  } catch (error) {
    console.error("AIInvoiceService: Network or parsing error during update:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred during invoice update",
    }
  }
}

/**
 * Validates invoice ID format
 */
export function validateInvoiceId(invoiceId: string): boolean {
  if (!invoiceId || typeof invoiceId !== "string") {
    return false
  }

  const trimmed = invoiceId.trim()
  if (trimmed.length === 0) {
    return false
  }

  // Basic format validation - adjust regex as needed for your invoice ID format
  const invoiceIdPattern = /^[A-Z0-9\-_]+$/i
  return invoiceIdPattern.test(trimmed)
}
