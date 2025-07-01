"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { AlertTriangle, CheckCircle, FileText, Loader2, Upload, X } from "lucide-react"

interface ComparisonResult {
  status: string
  mismatches?: string[]
}

interface ComparePOInvoiceDialogProps {
  poNumber: string
  trigger: React.ReactNode
}

export default function ComparePOInvoiceDialog({ poNumber, trigger }: ComparePOInvoiceDialogProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null)
  const [comparisonError, setComparisonError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (file.type !== "application/pdf") {
        toast({
          title: "Invalid File Type",
          description: "Please select a PDF file.",
          variant: "destructive",
        })
        return
      }

      // Validate file size (e.g., max 10MB)
      const maxSize = 10 * 1024 * 1024 // 10MB
      if (file.size > maxSize) {
        toast({
          title: "File Too Large",
          description: "Please select a file smaller than 10MB.",
          variant: "destructive",
        })
        return
      }

      setSelectedFile(file)
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleCompare = async () => {
    setIsComparing(true)
    setComparisonError(null)
    setComparisonResult(null)

    try {
      console.log(`ComparePOInvoiceDialog: Starting comparison for PO ${poNumber}`)

      // Create FormData for multipart/form-data request
      const formData = new FormData()
      formData.append("po_number", poNumber)

      if (selectedFile) {
        formData.append("invoice_file", selectedFile)
        console.log(`ComparePOInvoiceDialog: Including file: ${selectedFile.name}`)
      }

      const response = await fetch(`${API_BASE_URL}/ai/compare-po-invoice`, {
        method: "POST",
        body: formData, // Don't set Content-Type header, let browser set it with boundary
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to compare PO and Invoice" }))
        throw new Error(errorData.message || `Server responded with ${response.status}`)
      }

      const data = await response.json()
      console.log("ComparePOInvoiceDialog: Comparison result:", data)

      setComparisonResult(data)

      if (data.status === "PO and Invoice match perfectly") {
        toast({
          title: "✅ Perfect Match",
          description: "PO and Invoice match perfectly - no discrepancies found.",
        })
      } else if (data.mismatches && data.mismatches.length > 0) {
        toast({
          title: "⚠️ Mismatches Found",
          description: `Found ${data.mismatches.length} discrepancy${data.mismatches.length !== 1 ? "ies" : ""} between PO and Invoice.`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Comparison Complete",
          description: "Comparison completed successfully.",
        })
      }
    } catch (error) {
      console.error("ComparePOInvoiceDialog: Error comparing PO and Invoice:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to compare PO and Invoice"
      setComparisonError(errorMessage)
      toast({
        title: "Comparison Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsComparing(false)
    }
  }

  const handleDialogClose = () => {
    setIsOpen(false)
    // Reset state when dialog closes
    setComparisonResult(null)
    setComparisonError(null)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Compare PO and Invoice
          </DialogTitle>
          <DialogDescription>
            Compare PO {poNumber} with an invoice. Upload a PDF file to compare with a third-party invoice, or leave
            empty to compare with the stored invoice in the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Section */}
          <div className="space-y-2">
            <Label htmlFor="invoice-file">Invoice PDF (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="invoice-file"
                type="file"
                accept=".pdf"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={isComparing}
                className="flex-1"
              />
              {selectedFile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isComparing}
                  className="shrink-0 bg-transparent"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{selectedFile.name}</span>
                <span>({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              {selectedFile
                ? "Will compare PO with the uploaded invoice file."
                : "Will compare PO with the stored invoice in the database."}
            </p>
          </div>

          {/* Comparison Results */}
          {comparisonResult && (
            <div className="space-y-3">
              <h4 className="font-semibold">Comparison Results:</h4>
              {comparisonResult.status === "PO and Invoice match perfectly" ? (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    ✅ PO and Invoice match perfectly - no discrepancies found.
                  </AlertDescription>
                </Alert>
              ) : comparisonResult.mismatches && comparisonResult.mismatches.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-medium">⚠️ Discrepancies Found:</p>
                      <ul className="space-y-1 ml-4">
                        {comparisonResult.mismatches.map((mismatch, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-red-500 mt-1">•</span>
                            <span>{mismatch}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>Comparison completed with no specific details provided.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Error Display */}
          {comparisonError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">Comparison Failed:</p>
                  <p>{comparisonError}</p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isComparing && (
            <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              <AlertDescription>
                Comparing PO {poNumber} with {selectedFile ? "uploaded invoice" : "stored invoice"}. This may take a few
                moments...
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={handleDialogClose} disabled={isComparing}>
            {comparisonResult || comparisonError ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleCompare} disabled={isComparing}>
            {isComparing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Comparing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Compare
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
