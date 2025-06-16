"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  ArrowLeft,
  FileText,
  Send,
  BellRing,
  ThumbsUp,
  ThumbsDown,
  Info,
  Loader2,
  AlertTriangle,
  Bug,
} from "lucide-react"
import type { PurchaseOrderDetail, AISuggestion, Address, AIInvoiceResponse } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import { generateAIInvoice } from "@/lib/ai-invoice-service"
import AIInvoicePreview from "./ai-invoice-preview"
import SendReminderDialog from "@/components/send-reminder-dialog"

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

const AddressDisplay = ({ address, title }: { address: Address; title: string }) => (
  <div>
    <h4 className="font-semibold text-sm text-muted-foreground">{title}</h4>
    <p className="text-sm">{address.name}</p>
    <p className="text-sm">{address.street}</p>
    <p className="text-sm">{address.cityStateZip}</p>
    {address.country && <p className="text-sm">{address.country}</p>}
  </div>
)

export default function PoDetailClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const poNumber = params.po_number as string

  const [poDetail, setPoDetail] = useState<PurchaseOrderDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAISuggestionLoading, setIsAISuggestionLoading] = useState<Record<string, boolean>>({})
  const [isAIActionLoading, setIsAIActionLoading] = useState<Record<string, boolean>>({})
  const [generatedInvoice, setGeneratedInvoice] = useState<AIInvoiceResponse | null>(null)
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false)
  const [invoiceGenerationError, setInvoiceGenerationError] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null) // For debugging API responses

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

  useEffect(() => {
    if (poNumber) {
      console.log(`Fetching details for PO Number: ${poNumber}`)
      const fetchPoDetail = async () => {
        setIsLoading(true)
        try {
          const apiUrl = `${API_BASE_URL}/po/${poNumber}`
          console.log(`API URL: ${apiUrl}`)

          const response = await fetch(apiUrl)
          if (!response.ok) {
            if (response.status === 404) {
              toast({
                title: "Not Found",
                description: `Purchase Order ${poNumber} not found.`,
                variant: "destructive",
              })
              router.push("/")
            } else {
              const errorText = await response.text()
              throw new Error(`Failed to fetch PO details. Status: ${response.status}, Message: ${errorText}`)
            }
            return
          }
          const rawData = await response.json()

          const parseAddress = (apiAddress: any): Address => {
            const fullAddress = apiAddress.address || ""
            const parts = fullAddress.split(",")
            let street = fullAddress
            let cityStateZip = ""
            if (parts.length >= 2) {
              cityStateZip = parts.slice(-2).join(",").trim()
              street = parts.slice(0, -2).join(",").trim()
            } else if (parts.length === 1 && !apiAddress.company) {
              street = parts[0].trim()
            } else if (parts.length === 1 && apiAddress.company) {
              street = ""
            }

            return {
              name: apiAddress.company || apiAddress.contact || "N/A",
              street: street,
              cityStateZip: cityStateZip,
            }
          }

          const mappedPoDetail: PurchaseOrderDetail = {
            poNumber: rawData.po.po_number,
            date: rawData.po.date,
            paymentTerms: rawData.po.payment_terms,
            shippingMethod: rawData.po.shipping_method,
            promiseDate: rawData.po.promise_date,
            billTo: parseAddress(rawData.po.bill_to),
            vendor: parseAddress(rawData.po.vendor),
            items: rawData.po.items.map((item: any, index: number) => ({
              id: item._id || `item-${index}`,
              description: item.description,
              qty: item.qty,
              unit: item.unit,
              unitPrice: item.unit_price,
              total: item.total,
            })),
            summary: rawData.po.summary,
            notes: rawData.po.notes,
            red_flags: rawData.po.red_flags || [],
            emails: rawData.emails.map((email: any) => ({
              id: email._id,
              from: email.sender,
              to: email.receiver,
              subject: email.subject,
              body: email.body,
              timestamp: email.date,
              avatarFallback: email.sender ? email.sender.substring(0, 2).toUpperCase() : "??",
            })),
          }
          setPoDetail(mappedPoDetail)
        } catch (error: any) {
          console.error("Error fetching PO details:", error)
          toast({ title: "Error", description: error.message || "Could not fetch PO details.", variant: "destructive" })
          setPoDetail(null)
        } finally {
          setIsLoading(false)
        }
      }
      fetchPoDetail()
    } else {
      setIsLoading(false)
      if (!params.po_number) {
        toast({
          title: "Missing PO Number",
          description: "Cannot fetch details without a PO number in the URL.",
          variant: "destructive",
        })
      }
    }
  }, [poNumber, toast, router, API_BASE_URL, params.po_number])

  const handleGenerateAIInvoice = async () => {
    if (!poDetail) {
      toast({
        title: "Error",
        description: "PO details not available for invoice generation.",
        variant: "destructive",
      })
      return
    }

    // Reset previous states
    setIsGeneratingInvoice(true)
    setInvoiceGenerationError(null)
    setGeneratedInvoice(null)
    setDebugInfo(null)

    console.log(`PoDetailClient: Starting invoice generation for PO ${poDetail.poNumber}`)

    try {
      const result = await generateAIInvoice(poDetail.poNumber)
      console.log("PoDetailClient: Invoice generation result:", result)

      if (result.success && result.invoice) {
        // Validate the invoice ID
        if (!result.invoice.invoice_id || result.invoice.invoice_id.trim() === "") {
          console.error("PoDetailClient: Received invoice with empty invoice_id")
          throw new Error("Generated invoice is missing a valid invoice ID")
        }

        console.log("PoDetailClient: Successfully generated/retrieved invoice:", result.invoice)
        setGeneratedInvoice(result.invoice)

        // Provide different messages based on source
        let successMessage = ""
        switch (result.source) {
          case "database":
            successMessage = `Existing invoice ${result.invoice.invoice_id} retrieved from database for PO ${poDetail.poNumber}.`
            break
          case "api":
            successMessage = `New AI invoice ${result.invoice.invoice_id} generated for PO ${poDetail.poNumber}.`
            break
          case "generated":
            successMessage = `Fallback invoice ${result.invoice.invoice_id} created for PO ${poDetail.poNumber}. Please review and update the details.`
            break
          default:
            successMessage = `Invoice ${result.invoice.invoice_id} is ready for PO ${poDetail.poNumber}.`
        }

        toast({
          title: "Invoice Ready",
          description: successMessage,
          variant: result.source === "generated" ? "default" : "default",
        })

        // Log the action
        try {
          await fetch(`${API_BASE_URL}/log-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              po_number: poDetail.poNumber,
              action: `INVOICE_${result.source?.toUpperCase()}_GENERATED`,
              actor: "system", // In a real app, this would be the current user
              approved: true,
              details: {
                invoice_id: result.invoice.invoice_id,
                source: result.source,
              },
            }),
          })
        } catch (logError) {
          console.warn("PoDetailClient: Failed to log invoice generation action:", logError)
        }
      } else {
        const errorMessage = result.error || "Unknown error occurred during invoice generation"
        console.error("PoDetailClient: Invoice generation failed:", errorMessage)

        // Store debug information if available
        if (result.rawResponse) {
          setDebugInfo({
            ...result.rawResponse,
            source: result.source,
            timestamp: new Date().toISOString(),
          })
          console.error("PoDetailClient: Raw API response for debugging:", result.rawResponse)
        }

        setInvoiceGenerationError(errorMessage)
        toast({
          title: "Invoice Generation Failed",
          description: errorMessage,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("PoDetailClient: Invoice generation error:", error)
      const errorMessage = error instanceof Error ? error.message : "Unexpected error during invoice generation"
      setInvoiceGenerationError(errorMessage)

      setDebugInfo({
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        poNumber: poDetail.poNumber,
      })

      toast({
        title: "Invoice Generation Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsGeneratingInvoice(false)
    }
  }

  const handleInvoiceUpdate = (updatedInvoice: AIInvoiceResponse) => {
    setGeneratedInvoice(updatedInvoice)
  }

  const handleSendReminder = async (poNumber: string) => {
    // This function is now handled by the SendReminderDialog component
    // We can add any additional logic here if needed
    console.log("PO Detail: Send reminder initiated for PO:", poNumber)
  }

  const handleReminderSuccess = (poNumber: string, message: string) => {
    console.log("PO Detail: Reminder sent successfully:", { poNumber, message })
    // Additional success handling can be added here
  }

  const handleReminderError = (error: string) => {
    console.error("PO Detail: Reminder send failed:", error)
    // Additional error handling can be added here
  }

  const handleAIAction = async (actionType: "send-po-ack" | "send-reminder", poDetails: PurchaseOrderDetail) => {
    setIsAIActionLoading((prev) => ({ ...prev, [actionType]: true }))
    let endpoint = ""
    const payload: any = { poNumber: poDetails.poNumber }
    let successMessage = ""

    switch (actionType) {
      case "send-po-ack":
        endpoint = `${API_BASE_URL}/ai/send-invoice`
        payload.invoiceId = `PO-ACK-${poDetails.poNumber}`
        payload.recipientEmail =
          poDetails.billTo.email || `${poDetails.billTo.name.toLowerCase().replace(/\s/g, ".")}@example.com`
        payload.subject = `Acknowledgement for PO ${poDetails.poNumber}`
        payload.body = `Dear ${poDetails.billTo.name},\n\nThis is to acknowledge receipt of your Purchase Order ${poDetails.poNumber}.\n\nThank you.`
        successMessage = `PO Acknowledgement for ${poDetails.poNumber} sending process initiated.`
        break
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "AI action failed")

      toast({ title: "Success", description: result.message || successMessage })
    } catch (error: any) {
      toast({ title: "Error", description: error.message || `Failed to ${actionType}.`, variant: "destructive" })
    } finally {
      setIsAIActionLoading((prev) => ({ ...prev, [actionType]: false }))
    }
  }

  const handleSuggestionAction = async (suggestion: AISuggestion, action: "Approve" | "Reject") => {
    setIsAISuggestionLoading((prev) => ({ ...prev, [suggestion.id]: true }))
    try {
      const response = await fetch(`${API_BASE_URL}/log-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poNumber: poDetail?.poNumber,
          actionType: action === "Approve" ? "approve_suggestion" : "reject_suggestion",
          itemId: suggestion.id,
          details: { suggestionType: suggestion.type },
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "Failed to log action")
      toast({ title: "Logged", description: `Suggestion ${action.toLowerCase()}ed and logged.` })
      setPoDetail((prev) =>
        prev
          ? {
              ...prev,
              aiSuggestions: prev.aiSuggestions?.filter((s) => s.id !== suggestion.id),
            }
          : null,
      )
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to log action.", variant: "destructive" })
    } finally {
      setIsAISuggestionLoading((prev) => ({ ...prev, [suggestion.id]: false }))
    }
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading PO Details...</div>
  }

  if (!poDetail) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-6 text-center">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <Info className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Purchase Order details could not be loaded or the PO was not found.</AlertDescription>
        </Alert>
        <Button onClick={() => router.push("/")} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <Button variant="outline" onClick={() => router.back()} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
      </Button>

      <Card className="mb-6 bg-gradient-to-r from-slate-50 to-sky-50 dark:from-slate-800 dark:to-sky-900">
        <CardHeader>
          <CardTitle>AI Assistant for PO: {poDetail.poNumber}</CardTitle>
          <CardDescription>Quick actions and suggestions powered by AI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleGenerateAIInvoice} disabled={isGeneratingInvoice} className="relative">
              {isGeneratingInvoice ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              {isGeneratingInvoice ? "Generating Invoice..." : "Generate AI Invoice"}
            </Button>
            <Button onClick={() => handleAIAction("send-po-ack", poDetail)} disabled={isAIActionLoading["send-po-ack"]}>
              <Send className="mr-2 h-4 w-4" />
              {isAIActionLoading["send-po-ack"] ? "Sending Ack..." : "Send PO Ack"}
            </Button>
            <SendReminderDialog
              poNumber={poDetail.poNumber}
              onSendSuccess={handleReminderSuccess}
              onSendError={handleReminderError}
              trigger={
                <Button variant="outline">
                  <BellRing className="mr-2 h-4 w-4" />
                  Send Reminder
                </Button>
              }
            />
          </div>

          {/* Invoice Generation Status */}
          {isGeneratingInvoice && (
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                AI is generating your invoice for PO {poDetail.poNumber}. This may take a few moments...
              </AlertDescription>
            </Alert>
          )}

          {invoiceGenerationError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Invoice Generation Failed</AlertTitle>
              <AlertDescription>
                <div className="space-y-2">
                  <p>{invoiceGenerationError}</p>
                  {debugInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium flex items-center gap-1">
                        <Bug className="h-3 w-3" />
                        Debug Information (Click to expand)
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40">
                        {JSON.stringify(debugInfo, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {poDetail.aiSuggestions && poDetail.aiSuggestions.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 text-sm">AI Suggestions:</h4>
              <div className="space-y-3">
                {poDetail.aiSuggestions.map((suggestion) => (
                  <Alert key={suggestion.id} variant="default" className="bg-white dark:bg-slate-700">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="flex justify-between items-center">
                      <span>{suggestion.text}</span>
                      <div className="flex gap-2 shrink-0 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSuggestionAction(suggestion, "Approve")}
                          disabled={isAISuggestionLoading[suggestion.id]}
                          className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
                        >
                          <ThumbsUp className="mr-1 h-4 w-4" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSuggestionAction(suggestion, "Reject")}
                          disabled={isAISuggestionLoading[suggestion.id]}
                          className="bg-red-50 hover:bg-green-100 text-red-700 border-red-300"
                        >
                          <ThumbsDown className="mr-1 h-4 w-4" /> Reject
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Invoice Preview */}
      {generatedInvoice && (
        <AIInvoicePreview
          invoiceData={generatedInvoice}
          poNumber={poDetail.poNumber}
          onApprove={async (invoice) => {
            // Handle approval logic
            console.log("Invoice approved:", invoice)
          }}
          onReject={async (invoice) => {
            // Handle rejection logic
            console.log("Invoice rejected:", invoice)
          }}
          onSend={async (invoice) => {
            // Handle send logic
            console.log("Invoice sent:", invoice)
          }}
          onEdit={(invoice) => {
            // Switch to edit mode or open editor
            console.log("Edit invoice:", invoice)
          }}
        />
      )}

      <div className="grid md:grid-cols-3 gap-6 mt-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Purchase Order Details</CardTitle>
              <CardDescription>PO Number: {poDetail.poNumber}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-semibold text-muted-foreground">PO Date:</span>{" "}
                  {new Date(poDetail.date).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Payment Terms:</span> {poDetail.paymentTerms}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Shipping Method:</span>{" "}
                  {poDetail.shippingMethod}
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Promise Date:</span>{" "}
                  {new Date(poDetail.promiseDate).toLocaleDateString()}
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AddressDisplay address={poDetail.billTo} title="Bill To" />
                <AddressDisplay address={poDetail.vendor} title="Vendor" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {poDetail.items.map((item, index) => (
                    <TableRow key={item.id || index}>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-center">{item.qty}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="flex flex-col items-end space-y-1 pt-4 border-t">
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span>Subtotal:</span>
                <span>{formatCurrency(poDetail.summary.subtotal)}</span>
              </div>
              {poDetail.summary.discount > 0 && (
                <div className="flex justify-between w-full max-w-xs text-sm">
                  <span>Discount:</span>
                  <span>{formatCurrency(poDetail.summary.discount)}</span>
                </div>
              )}
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span>Tax:</span>
                <span>{formatCurrency(poDetail.summary.tax)}</span>
              </div>
              {poDetail.summary.freight > 0 && (
                <div className="flex justify-between w-full max-w-xs text-sm">
                  <span>Freight:</span>
                  <span>{formatCurrency(poDetail.summary.freight)}</span>
                </div>
              )}
              <Separator className="my-1 w-full max-w-xs" />
              <div className="flex justify-between w-full max-w-xs font-semibold text-base">
                <span>Total:</span>
                <span>{formatCurrency(poDetail.summary.total)}</span>
              </div>
            </CardFooter>
          </Card>

          {poDetail.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{poDetail.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Email Thread</CardTitle>
              <CardDescription>Communications related to this PO.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
              <ScrollArea className="h-[calc(100vh-10rem)] md:h-[600px] pr-3">
                <div className="space-y-4">
                  {poDetail.emails.length > 0 ? (
                    poDetail.emails.map((email) => (
                      <div key={email.id} className="flex items-start gap-3">
                        <Avatar>
                          <AvatarImage
                            src={`https://api.dicebear.com/8.x/initials/svg?seed=${email.from.split("@")[0]}`}
                          />
                          <AvatarFallback>
                            {email.avatarFallback || email.from.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 p-3 rounded-lg bg-slate-100 dark:bg-slate-700 shadow-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-sm">{email.from}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(email.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium mb-1">{email.subject}</p>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">{email.body}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No emails found for this PO.</p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
