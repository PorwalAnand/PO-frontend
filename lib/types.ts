import type React from "react"

// RedFlagItem is no longer an object, so we can remove it or comment it out
// export interface RedFlagItem {
//   id: string
//   reason: string
//   aiSuggestion: string
// }

export interface PurchaseOrderListItem {
  po_number: string
  date: string
  bill_to: string
  vendor: string
  summary: {
    total: number
  }
  status: "Received" | "In Progress" | "Completed"
  payment_status: string
  red_flags: string[] // Updated to array of strings
}

// This type will be used for the filter state
export type ClientSidePOStatusFilter = "All" | "Received" | "In Progress" | "Completed"

export type POStatusFilter = "Received" | "In Progress" | "Completed" | "All" // This was for server-side

export interface MetricItem {
  label: string
  value: number | string
  icon?: React.ElementType
}

export interface DashboardMetrics {
  totalOrders: number
  inProgress: number
  completed: number
  paymentPending: number
}

export interface NotificationItem {
  id: string
  po_number: string
  type: "Red Flag" | "Payment Reminder" | "Action Required"
  message: string
  ai_suggestion: string
  timestamp: string
}

export interface LogActionPayload {
  poNumber: string
  actionType: "acknowledge_red_flag" | "approve_suggestion" | "reject_suggestion" | "approve_invoice" | "reject_invoice"
  itemId?: string
  details?: Record<string, any>
}
export interface PurchaseOrderDetail {
  poNumber: string
  date: string
  paymentTerms: string
  shippingMethod: string
  promiseDate: string
  billTo: Address
  vendor: Address
  items: PurchaseOrderItem[]
  summary: Summary
  notes?: string
  emails: Email[]
  aiSuggestions?: AISuggestion[]
  red_flags?: string[]
}

export interface PurchaseOrderItem {
  id?: string
  description: string
  qty: number
  unit?: string
  unitPrice: number
  total: number
}

export interface Summary {
  subtotal: number
  discount: number
  tax: number
  freight: number
  total: number
}

export interface Address {
  name: string
  street: string
  cityStateZip: string
  country?: string
}

export interface Email {
  id: string
  from: string
  to: string
  subject: string
  body: string
  timestamp: string
  avatarFallback: string
}

export interface AISuggestion {
  id: string
  text: string
  type: string
}

export interface InvoiceItem extends PurchaseOrderItem {}

export interface GeneratedInvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  billTo: Address
  vendor: Address
  items: InvoiceItem[]
  subtotal: number
  discountPercentage?: number
  discountAmount?: number
  taxRate?: number
  taxAmount?: number
  total: number
  notes?: string
}

export interface UserActionLogPayload {
  po_number: string
  action: string // e.g., "SENT_PO_ACKNOWLEDGEMENT", "UPDATED_PO_STATUS"
  actor: string // User ID or name
  approved: boolean
}

// New type for AI Invoice API payload
export interface AIInvoicePayload {
  po_number: string
}

// Updated types to match the new API response structure
export interface InvoiceContact {
  company: string
  contact: string
  address: string
  phone: string
  email?: string
}

export interface InvoiceItemData {
  description: string
  qty: number
  unit: string
  unit_price: number
  total: number
}

export interface InvoiceSummary {
  subtotal: number
  discount: number
  freight: number
  tax: number
  total: number
}

export interface AIInvoiceResponse {
  invoice_id: string
  invoice_date: string
  due_date: string
  payment_terms: string
  shipping_method: string
  bill_to: InvoiceContact
  vendor: InvoiceContact
  items: InvoiceItemData[]
  summary: InvoiceSummary
  notes: string
  payment_status: string
}

// Add this interface to track invoice sources
export interface InvoiceGenerationMetadata {
  source: "api" | "database" | "generated"
  timestamp: string
  attempts?: number
  fallbackUsed?: boolean
}

// Update the existing AIInvoiceResponse to include metadata
export interface AIInvoiceResponseWithMetadata extends AIInvoiceResponse {
  metadata?: InvoiceGenerationMetadata
}

// Type for saving invoice updates
export interface InvoiceUpdatePayload {
  invoice_id: string
  invoice_date?: string
  due_date?: string
  payment_terms?: string
  shipping_method?: string
  bill_to?: InvoiceContact
  vendor?: InvoiceContact
  items?: InvoiceItemData[]
  summary?: InvoiceSummary
  notes?: string
  payment_status?: string
}
