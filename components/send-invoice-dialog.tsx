"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Send, Loader2, CheckCircle, AlertTriangle, Mail } from "lucide-react"
import type { AIInvoiceResponse } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import { sendInvoice, getDefaultRecipient, logSendInvoiceAction } from "@/lib/send-invoice-service"

interface SendInvoiceDialogProps {
  invoiceData: AIInvoiceResponse
  poNumber: string
  trigger?: React.ReactNode
  onSendSuccess?: (recipient: string, message: string) => void
  onSendError?: (error: string) => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

export default function SendInvoiceDialog({
  invoiceData,
  poNumber,
  trigger,
  onSendSuccess,
  onSendError,
}: SendInvoiceDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [recipient, setRecipient] = useState("")
  const [customMessage, setCustomMessage] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)
  const { toast } = useToast()

  // Initialize recipient when dialog opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open && !recipient) {
      const defaultRecipient = getDefaultRecipient(invoiceData)
      setRecipient(defaultRecipient)
      setCustomMessage(
        `Dear ${invoiceData.bill_to.company || "Valued Customer"},\n\nPlease find attached the invoice for Purchase Order ${poNumber}.\n\nThank you for your business.\n\nBest regards`,
      )
    }
    if (!open) {
      // Reset state when dialog closes
      setSendResult(null)
    }
  }

  const handleSendInvoice = async () => {
    if (!recipient.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a recipient email address.",
        variant: "destructive",
      })
      return
    }

    setIsSending(true)
    setSendResult(null)

    try {
      console.log("SendInvoiceDialog: Initiating send for invoice:", invoiceData.invoice_id)

      const result = await sendInvoice(invoiceData, poNumber, recipient.trim())

      console.log("SendInvoiceDialog: Send result:", result)

      if (result.success) {
        const successMessage = result.message || "Invoice sent successfully"
        setSendResult({ success: true, message: successMessage })

        toast({
          title: "Invoice Sent",
          description: `${successMessage} Sent to: ${recipient.trim()}`,
          action: <CheckCircle className="h-5 w-5 text-green-500" />,
        })

        // Log successful action
        await logSendInvoiceAction(poNumber, invoiceData.invoice_id, recipient.trim(), true)

        // Notify parent component
        onSendSuccess?.(recipient.trim(), successMessage)

        // Close dialog after a short delay to show success message
        setTimeout(() => {
          setIsOpen(false)
        }, 2000)
      } else {
        const errorMessage = result.error || "Failed to send invoice"
        setSendResult({ success: false, message: errorMessage })

        toast({
          title: "Send Failed",
          description: errorMessage,
          variant: "destructive",
        })

        // Log failed action
        await logSendInvoiceAction(poNumber, invoiceData.invoice_id, recipient.trim(), false, errorMessage)

        // Notify parent component
        onSendError?.(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unexpected error occurred"
      console.error("SendInvoiceDialog: Error sending invoice:", error)

      setSendResult({ success: false, message: errorMessage })

      toast({
        title: "Send Error",
        description: errorMessage,
        variant: "destructive",
      })

      onSendError?.(errorMessage)
    } finally {
      setIsSending(false)
    }
  }

  const defaultTrigger = (
    <Button className="bg-blue-600 hover:bg-blue-700 text-white">
      <Send className="mr-2 h-4 w-4" />
      Send Invoice
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Invoice
          </DialogTitle>
          <DialogDescription>
            Send invoice {invoiceData.invoice_id} for Purchase Order {poNumber} via email.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Summary */}
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              Invoice Summary
              <Badge variant="outline">{invoiceData.invoice_id}</Badge>
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-muted-foreground">Bill To:</span>
                <p>{invoiceData.bill_to.company}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Vendor:</span>
                <p>{invoiceData.vendor.company}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Total Amount:</span>
                <p className="font-semibold">{formatCurrency(invoiceData.summary.total)}</p>
              </div>
              <div>
                <span className="font-medium text-muted-foreground">Items:</span>
                <p>{invoiceData.items.length} item(s)</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Recipient Email */}
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient Email Address *</Label>
            <Input
              id="recipient"
              type="email"
              placeholder="Enter recipient email address"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={isSending}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">The invoice will be sent to this email address</p>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Email Message (Optional)</Label>
            <Textarea
              id="message"
              placeholder="Enter a custom message to include with the invoice..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={isSending}
              rows={4}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">This message will be included in the email body</p>
          </div>

          {/* Send Result */}
          {sendResult && (
            <Alert variant={sendResult.success ? "default" : "destructive"}>
              {sendResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertDescription>{sendResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Items Preview */}
          <div className="space-y-2">
            <Label>Invoice Items ({invoiceData.items.length})</Label>
            <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg max-h-32 overflow-y-auto">
              <div className="space-y-1 text-sm">
                {invoiceData.items.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="truncate mr-2">{item.description}</span>
                    <span className="font-medium whitespace-nowrap">
                      {item.qty} × {formatCurrency(item.unit_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending}>
            {sendResult?.success ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={handleSendInvoice}
            disabled={isSending || !recipient.trim() || sendResult?.success}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
