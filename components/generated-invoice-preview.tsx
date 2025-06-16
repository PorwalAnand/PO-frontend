"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, XCircle, Send, Edit3, Save } from "lucide-react"
import type { GeneratedInvoiceData, InvoiceItem, Address } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast" // Corrected import path

interface GeneratedInvoicePreviewProps {
  initialInvoiceData: GeneratedInvoiceData
  poNumber: string
  onApprove: (invoiceData: GeneratedInvoiceData) => Promise<void>
  onReject: (invoiceData: GeneratedInvoiceData) => Promise<void>
  onSend: (invoiceData: GeneratedInvoiceData) => Promise<void>
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

const EditableField: React.FC<{
  value: string | number
  onChange: (newValue: string | number) => void
  label: string
  isNumeric?: boolean
  isTextarea?: boolean
  isEditable: boolean
}> = ({ value, onChange, label, isNumeric = false, isTextarea = false, isEditable }) => {
  const [isEditing, setIsEditing] = useState(false)
  const [currentValue, setCurrentValue] = useState(value.toString())

  useEffect(() => {
    setCurrentValue(value.toString())
  }, [value])

  const handleSave = () => {
    onChange(isNumeric ? Number.parseFloat(currentValue) || 0 : currentValue)
    setIsEditing(false)
  }

  if (isEditing && isEditable) {
    return (
      <div className="flex items-center gap-1">
        {isTextarea ? (
          <Textarea
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            aria-label={label}
            className="text-sm p-1 border rounded min-h-[60px]"
            autoFocus
          />
        ) : (
          <Input
            type={isNumeric ? "number" : "text"}
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            aria-label={label}
            className="text-sm h-8 p-1 border rounded"
            autoFocus
            step={isNumeric ? "0.01" : undefined}
          />
        )}
        <Button size="icon" variant="ghost" onClick={handleSave} aria-label={`Save ${label}`}>
          <Save className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <span
      onClick={() => isEditable && setIsEditing(true)}
      className={`${isEditable ? "hover:bg-yellow-100 dark:hover:bg-yellow-800 p-1 rounded cursor-pointer" : "p-1"} min-h-[2rem] block group`}
    >
      {isTextarea && typeof value === "string"
        ? value.split("\n").map((line, i) => (
            <React.Fragment key={i}>
              {line}
              <br />
            </React.Fragment>
          ))
        : value}
      {isEditable && (
        <Edit3 className="h-3 w-3 ml-1 inline-block opacity-0 group-hover:opacity-50 transition-opacity" />
      )}
    </span>
  )
}

export default function GeneratedInvoicePreview({
  initialInvoiceData,
  poNumber,
  onApprove,
  onReject,
  onSend,
}: GeneratedInvoicePreviewProps) {
  const [invoiceData, setInvoiceData] = useState<GeneratedInvoiceData>(initialInvoiceData)
  const [isApproved, setIsApproved] = useState(false)
  const [isRejected, setIsRejected] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    setInvoiceData(initialInvoiceData)
    setIsApproved(false)
    setIsRejected(false)
  }, [initialInvoiceData])

  const isInvoiceEditable = !isApproved && !isRejected

  const handleFieldChange = (field: keyof GeneratedInvoiceData, value: any) => {
    setInvoiceData((prev) => ({ ...prev, [field]: value }))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...invoiceData.items]
    const item = { ...newItems[index] }
    ;(item[field] as any) = value

    if (field === "qty" || field === "unitPrice") {
      item.total = (Number(item.qty) || 0) * (Number(item.unitPrice) || 0)
    }
    newItems[index] = item
    setInvoiceData((prev) => ({ ...prev, items: newItems }))
  }

  const recalculateTotals = useCallback((currentData: GeneratedInvoiceData): Partial<GeneratedInvoiceData> => {
    const subtotal = currentData.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
    const discountAmount = currentData.discountPercentage
      ? subtotal * (Number(currentData.discountPercentage) / 100) // Assuming percentage is 0-100
      : Number(currentData.discountAmount) || 0
    const taxableAmount = subtotal - discountAmount
    const taxAmount = currentData.taxRate
      ? taxableAmount * (Number(currentData.taxRate) / 100) // Assuming percentage is 0-100
      : Number(currentData.taxAmount) || 0
    const total = taxableAmount + taxAmount

    return {
      subtotal: Number.parseFloat(subtotal.toFixed(2)),
      discountAmount: Number.parseFloat(discountAmount.toFixed(2)),
      taxAmount: Number.parseFloat(taxAmount.toFixed(2)),
      total: Number.parseFloat(total.toFixed(2)),
    }
  }, [])

  useEffect(() => {
    setInvoiceData((prev) => ({
      ...prev,
      ...recalculateTotals(prev),
    }))
  }, [
    invoiceData.items,
    invoiceData.discountPercentage,
    invoiceData.taxRate,
    invoiceData.discountAmount, // Added these to dependencies
    invoiceData.taxAmount, // Added these to dependencies
    recalculateTotals,
  ])

  const handleApprove = async () => {
    setIsProcessing(true)
    try {
      await onApprove(invoiceData)
      setIsApproved(true)
      setIsRejected(false)
      toast({ title: "Invoice Approved", description: `Invoice ${invoiceData.invoiceNumber} has been approved.` })
    } catch (e) {
      toast({ title: "Approval Failed", description: "Could not approve the invoice.", variant: "destructive" })
    }
    setIsProcessing(false)
  }

  const handleReject = async () => {
    setIsProcessing(true)
    try {
      await onReject(invoiceData)
      setIsRejected(true)
      setIsApproved(false)
      toast({ title: "Invoice Rejected", description: `Invoice ${invoiceData.invoiceNumber} has been rejected.` })
    } catch (e) {
      toast({ title: "Rejection Failed", description: "Could not reject the invoice.", variant: "destructive" })
    }
    setIsProcessing(false)
  }

  const handleSend = async () => {
    setIsProcessing(true)
    try {
      await onSend(invoiceData)
      toast({ title: "Invoice Sent", description: `Invoice ${invoiceData.invoiceNumber} has been sent.` })
    } catch (e) {
      toast({ title: "Send Failed", description: "Could not send the invoice.", variant: "destructive" })
    }
    setIsProcessing(false)
  }

  const AddressBlock: React.FC<{
    address: Address
    title: string
    onAddressChange: (field: keyof Address, value: string) => void
    isEditable: boolean
  }> = ({ address, title, onAddressChange, isEditable }) => (
    <div>
      <h3 className="font-semibold text-md mb-1">{title}</h3>
      <EditableField
        label={`${title} Name`}
        value={address.name}
        onChange={(val) => onAddressChange("name", val as string)}
        isEditable={isEditable}
      />
      <EditableField
        label={`${title} Street`}
        value={address.street}
        onChange={(val) => onAddressChange("street", val as string)}
        isEditable={isEditable}
      />
      <EditableField
        label={`${title} City/State/Zip`}
        value={address.cityStateZip}
        onChange={(val) => onAddressChange("cityStateZip", val as string)}
        isEditable={isEditable}
      />
      {address.country !== undefined && (
        <EditableField
          label={`${title} Country`}
          value={address.country}
          onChange={(val) => onAddressChange("country", val as string)}
          isEditable={isEditable}
        />
      )}
    </div>
  )

  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Generated Invoice Preview</CardTitle>
        {isApproved && (
          <p className="text-green-600 font-semibold flex items-center">
            <CheckCircle className="mr-2 h-5 w-5" /> Invoice Approved
          </p>
        )}
        {isRejected && (
          <p className="text-red-600 font-semibold flex items-center">
            <XCircle className="mr-2 h-5 w-5" /> Invoice Rejected
          </p>
        )}
      </CardHeader>
      <CardContent className="p-6 bg-white dark:bg-slate-800 rounded text-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">INVOICE</h2>
            <p>
              <strong>Invoice #:</strong>{" "}
              <EditableField
                label="Invoice Number"
                value={invoiceData.invoiceNumber}
                onChange={(val) => handleFieldChange("invoiceNumber", val)}
                isEditable={isInvoiceEditable}
              />
            </p>
            <p>
              <strong>Date:</strong>{" "}
              <EditableField
                label="Invoice Date"
                value={invoiceData.invoiceDate}
                onChange={(val) => handleFieldChange("invoiceDate", val)}
                isEditable={isInvoiceEditable}
              />
            </p>
            <p>
              <strong>Due Date:</strong>{" "}
              <EditableField
                label="Due Date"
                value={invoiceData.dueDate}
                onChange={(val) => handleFieldChange("dueDate", val)}
                isEditable={isInvoiceEditable}
              />
            </p>
          </div>
          <div className="text-right">
            <AddressBlock
              title="From"
              address={invoiceData.vendor}
              onAddressChange={(field, value) => {
                const newVendor = { ...invoiceData.vendor, [field]: value }
                handleFieldChange("vendor", newVendor)
              }}
              isEditable={isInvoiceEditable}
            />
          </div>
        </div>

        <div className="mb-6">
          <AddressBlock
            title="Bill To"
            address={invoiceData.billTo}
            onAddressChange={(field, value) => {
              const newBillTo = { ...invoiceData.billTo, [field]: value }
              handleFieldChange("billTo", newBillTo)
            }}
            isEditable={isInvoiceEditable}
          />
        </div>

        <Table className="mb-6">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Description</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceData.items.map((item, index) => (
              <TableRow key={item.id || index}>
                <TableCell>
                  <EditableField
                    label={`Item ${index + 1} Description`}
                    value={item.description}
                    onChange={(val) => handleItemChange(index, "description", val as string)}
                    isEditable={isInvoiceEditable}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <EditableField
                    label={`Item ${index + 1} Quantity`}
                    value={item.qty}
                    onChange={(val) => handleItemChange(index, "qty", val as number)}
                    isNumeric
                    isEditable={isInvoiceEditable}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <EditableField
                    label={`Item ${index + 1} Unit Price`}
                    value={item.unitPrice}
                    onChange={(val) => handleItemChange(index, "unitPrice", val as number)}
                    isNumeric
                    isEditable={isInvoiceEditable}
                  />
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-end mb-6">
          <div className="w-full max-w-xs space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(invoiceData.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Discount (%):</span> {/* Assuming percentage is 0-100 */}
              <EditableField
                label="Discount Percentage"
                value={invoiceData.discountPercentage ? invoiceData.discountPercentage * 100 : 0}
                onChange={(val) => handleFieldChange("discountPercentage", (val as number) / 100)}
                isNumeric
                isEditable={isInvoiceEditable}
              />
            </div>
            <div className="flex justify-between">
              <span>Discount Amount:</span>
              <span>{formatCurrency(invoiceData.discountAmount || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Tax Rate (%):</span> {/* Assuming percentage is 0-100 */}
              <EditableField
                label="Tax Rate"
                value={invoiceData.taxRate ? invoiceData.taxRate * 100 : 0}
                onChange={(val) => handleFieldChange("taxRate", (val as number) / 100)}
                isNumeric
                isEditable={isInvoiceEditable}
              />
            </div>
            <div className="flex justify-between">
              <span>Tax Amount:</span>
              <span>{formatCurrency(invoiceData.taxAmount || 0)}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>{formatCurrency(invoiceData.total)}</span>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-semibold text-md mb-1">Notes:</h3>
          <EditableField
            label="Notes"
            value={invoiceData.notes || ""}
            onChange={(val) => handleFieldChange("notes", val as string)}
            isTextarea
            isEditable={isInvoiceEditable}
          />
        </div>
      </CardContent>
      {!isRejected && (
        <CardFooter className="flex justify-end gap-2 pt-4 border-t">
          {!isApproved ? (
            <>
              <Button variant="outline" onClick={handleReject} disabled={isProcessing}>
                <XCircle className="mr-2 h-4 w-4" /> Reject
              </Button>
              <Button onClick={handleApprove} disabled={isProcessing}>
                <CheckCircle className="mr-2 h-4 w-4" /> Approve
              </Button>
            </>
          ) : (
            <Button onClick={handleSend} disabled={isProcessing}>
              <Send className="mr-2 h-4 w-4" /> Send Final Invoice
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
