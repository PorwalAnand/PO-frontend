"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, Send, Edit3, Loader2 } from "lucide-react"
import type { AIInvoiceResponse } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import SendInvoiceDialog from "@/components/send-invoice-dialog"

interface AIInvoicePreviewProps {
  invoiceData: AIInvoiceResponse
  poNumber: string
  onApprove?: (invoiceData: AIInvoiceResponse) => Promise<void>
  onReject?: (invoiceData: AIInvoiceResponse) => Promise<void>
  onSend?: (invoiceData: AIInvoiceResponse) => Promise<void>
  onEdit?: (invoiceData: AIInvoiceResponse) => void
  isReadOnly?: boolean
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

const formatDate = (dateString: string) => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
  } catch {
    return dateString
  }
}

export default function AIInvoicePreview({
  invoiceData,
  poNumber,
  onApprove,
  onReject,
  onSend,
  onEdit,
  isReadOnly = false,
}: AIInvoicePreviewProps) {
  const [isApproved, setIsApproved] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSent, setIsSent] = useState(false)
  const [sentTo, setSentTo] = useState<string>("")
  const { toast } = useToast()

  const handleApprove = async () => {
    if (!onApprove) return
    setIsProcessing(true)
    try {
      await onApprove(invoiceData)
      setIsApproved(true)
      setIsRejected(false)
      toast({
        title: "Invoice Approved",
        description: `Invoice ${invoiceData.invoice_id} has been approved.`,
      })
    } catch (error) {
      toast({
        title: "Approval Failed",
        description: "Could not approve the invoice.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!onReject) return
    setIsProcessing(true)
    try {
      await onReject(invoiceData)
      setIsRejected(true)
      setIsApproved(false)
      toast({
        title: "Invoice Rejected",
        description: `Invoice ${invoiceData.invoice_id} has been rejected.`,
      })
    } catch (error) {
      toast({
        title: "Rejection Failed",
        description: "Could not reject the invoice.",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendSuccess = (recipient: string, message: string) => {
    setIsSent(true)
    setSentTo(recipient)
    // Also call the parent onSend callback if provided
    if (onSend) {
      onSend(invoiceData).catch(console.error)
    }
  }

  const handleSendError = (error: string) => {
    console.error("Send invoice error:", error)
    // Error handling is already done in the dialog component
  }

  const handleEdit = () => {
    if (onEdit) {
      onEdit(invoiceData)
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Invoice Preview */}
      <Card className="bg-slate-800 text-white border-slate-700 shadow-2xl">
        <CardHeader className="bg-slate-900 border-b border-slate-700">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl">Generated Invoice Preview</CardTitle>
            <div className="flex items-center gap-2">
              <Badge
                variant={invoiceData.payment_status === "Paid" ? "default" : "secondary"}
                className="bg-slate-700 text-white"
              >
                {invoiceData.payment_status}
              </Badge>
              {isApproved && (
                <Badge className="bg-green-600 text-white">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Approved
                </Badge>
              )}
              {isRejected && (
                <Badge className="bg-red-600 text-white">
                  <XCircle className="mr-1 h-3 w-3" />
                  Rejected
                </Badge>
              )}
              {isSent && (
                <Badge className="bg-blue-600 text-white">
                  <Send className="mr-1 h-3 w-3" />
                  Sent to {sentTo}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 bg-slate-800">
          {/* Invoice Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-white">INVOICE</h1>
              <div className="space-y-1 text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Invoice #:</span>
                  <span className="text-white">{invoiceData.invoice_id}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Date:</span>
                  <span className="text-white">{formatDate(invoiceData.invoice_date)}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Due Date:</span>
                  <span className="text-white">{formatDate(invoiceData.due_date)}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
              </div>
            </div>

            {/* Vendor Information */}
            <div className="text-right space-y-1">
              <h3 className="font-semibold text-slate-300 mb-2">From</h3>
              <div className="text-white space-y-1">
                <div className="flex items-center justify-end gap-2">
                  <span className="font-semibold">{invoiceData.vendor.company}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-slate-300">{invoiceData.vendor.contact}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-slate-300">{invoiceData.vendor.address}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <span className="text-slate-300">{invoiceData.vendor.phone}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          <div className="mb-8">
            <h3 className="font-semibold text-slate-300 mb-3">Bill To</h3>
            <div className="bg-slate-700 p-4 rounded-lg">
              <div className="space-y-1 text-white">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{invoiceData.bill_to.company}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">{invoiceData.bill_to.contact}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">{invoiceData.bill_to.address}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">{invoiceData.bill_to.phone}</span>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                </div>
                {invoiceData.bill_to.email && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">{invoiceData.bill_to.email}</span>
                    {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-8">
            <div className="bg-slate-700 rounded-lg overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 p-4 bg-slate-600 text-slate-200 font-semibold text-sm">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-center">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {/* Table Body */}
              <div className="divide-y divide-slate-600">
                {invoiceData.items.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-12 gap-4 p-4 text-white hover:bg-slate-600/50 transition-colors"
                  >
                    <div className="col-span-6 flex items-center gap-2">
                      <span>{item.description}</span>
                      {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                    </div>
                    <div className="col-span-2 text-center flex items-center justify-center gap-2">
                      <span>{item.qty}</span>
                      {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                    </div>
                    <div className="col-span-2 text-right flex items-center justify-end gap-2">
                      <span>{formatCurrency(item.unit_price)}</span>
                      {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer" />}
                    </div>
                    <div className="col-span-2 text-right font-semibold">{formatCurrency(item.total)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary Section */}
          <div className="flex justify-end mb-8">
            <div className="w-full max-w-sm space-y-3">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal:</span>
                <span className="text-white font-semibold">{formatCurrency(invoiceData.summary.subtotal)}</span>
              </div>

              {invoiceData.summary.discount > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Discount:</span>
                  <span className="text-white">-{formatCurrency(invoiceData.summary.discount)}</span>
                </div>
              )}

              {invoiceData.summary.freight > 0 && (
                <div className="flex justify-between text-slate-300">
                  <span>Freight:</span>
                  <span className="text-white">{formatCurrency(invoiceData.summary.freight)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-300">
                <span>Tax:</span>
                <span className="text-white">{formatCurrency(invoiceData.summary.tax)}</span>
              </div>

              <Separator className="bg-slate-600" />

              <div className="flex justify-between text-xl font-bold">
                <span className="text-white">Total:</span>
                <span className="text-white">{formatCurrency(invoiceData.summary.total)}</span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {invoiceData.notes && (
            <div className="mb-8">
              <h3 className="font-semibold text-slate-300 mb-3">Notes:</h3>
              <div className="bg-slate-700 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <p className="text-slate-200 whitespace-pre-wrap">{invoiceData.notes}</p>
                  {!isReadOnly && <Edit3 className="h-3 w-3 text-slate-500 hover:text-slate-300 cursor-pointer mt-1" />}
                </div>
              </div>
            </div>
          )}

          {/* Payment Terms */}
          <div className="text-sm text-slate-400 space-y-1">
            <p>
              <strong>Payment Terms:</strong> {invoiceData.payment_terms}
            </p>
            <p>
              <strong>Shipping Method:</strong> {invoiceData.shipping_method}
            </p>
          </div>
        </CardContent>

        {/* Action Buttons */}
        {!isReadOnly && !isRejected && (
          <div className="flex justify-end gap-3 p-6 bg-slate-900 border-t border-slate-700">
            {!isApproved ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="border-red-600 text-red-600 hover:bg-red-600 hover:text-white"
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
              </>
            ) : (
              <SendInvoiceDialog
                invoiceData={invoiceData}
                poNumber={poNumber}
                onSendSuccess={handleSendSuccess}
                onSendError={handleSendError}
                trigger={
                  <Button disabled={isProcessing || isSent} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Send className="mr-2 h-4 w-4" />
                    {isSent ? `Sent to ${sentTo}` : "Send Final Invoice"}
                  </Button>
                }
              />
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
