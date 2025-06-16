export interface InvoiceError {
    code: string
    message: string
    details?: any
    timestamp: string
    poNumber?: string
  }
  
  export class InvoiceErrorHandler {
    private static instance: InvoiceErrorHandler
    private errors: InvoiceError[] = []
  
    static getInstance(): InvoiceErrorHandler {
      if (!InvoiceErrorHandler.instance) {
        InvoiceErrorHandler.instance = new InvoiceErrorHandler()
      }
      return InvoiceErrorHandler.instance
    }
  
    logError(error: Partial<InvoiceError>): void {
      const fullError: InvoiceError = {
        code: error.code || "UNKNOWN_ERROR",
        message: error.message || "An unknown error occurred",
        details: error.details,
        timestamp: new Date().toISOString(),
        poNumber: error.poNumber,
      }
  
      this.errors.push(fullError)
      console.error("InvoiceErrorHandler:", fullError)
  
      // Keep only last 50 errors to prevent memory issues
      if (this.errors.length > 50) {
        this.errors = this.errors.slice(-50)
      }
    }
  
    getErrors(poNumber?: string): InvoiceError[] {
      if (poNumber) {
        return this.errors.filter((error) => error.poNumber === poNumber)
      }
      return [...this.errors]
    }
  
    clearErrors(poNumber?: string): void {
      if (poNumber) {
        this.errors = this.errors.filter((error) => error.poNumber !== poNumber)
      } else {
        this.errors = []
      }
    }
  
    handleInvoiceGenerationError(error: any, poNumber: string): string {
      let errorCode = "INVOICE_GENERATION_FAILED"
      let errorMessage = "Failed to generate invoice"
  
      if (error instanceof Error) {
        if (error.message.includes("invoice_id")) {
          errorCode = "MISSING_INVOICE_ID"
          errorMessage =
            "Invoice ID is missing from the response. This has been automatically handled with a fallback ID."
        } else if (error.message.includes("fetch")) {
          errorCode = "NETWORK_ERROR"
          errorMessage = "Network error occurred. Please check your connection and try again."
        } else if (error.message.includes("JSON")) {
          errorCode = "INVALID_RESPONSE"
          errorMessage = "Server returned an invalid response format."
        } else {
          errorMessage = error.message
        }
      }
  
      this.logError({
        code: errorCode,
        message: errorMessage,
        details: error,
        poNumber,
      })
  
      return errorMessage
    }
  }
  
  export const invoiceErrorHandler = InvoiceErrorHandler.getInstance()
  