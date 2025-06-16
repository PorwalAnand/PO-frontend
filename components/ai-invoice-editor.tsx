"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Save, Edit3, Check, X, Plus, Trash2, AlertTriangle, Loader2 } from "lucide-react"
import type { AIInvoiceResponse, InvoiceContact, InvoiceItemData, InvoiceUpdatePayload } from "@/lib/types"
import { useToast } from "@/components/ui/use-toast"
import { updateInvoice } from "@/lib/ai-invoice-service"

interface AIInvoiceEditorProps {
  initialInvoiceData: AIInvoiceResponse
  poNumber: string
  onInvoiceUpdate?: (updatedInvoice: AIInvoiceResponse) => void
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

const EditableField: React.FC<{
  value: string | number | undefined | null
  onChange: (newValue: string | number) => void
  label: string
  isNumeric?: boolean
  isTextarea?: boolean
  isEditing: boolean
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  className?: string
}> = ({
  value,
  onChange,
  label,
  isNumeric = false,
  isTextarea = false,
  isEditing,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  className = "",
}) => {
  // Safe value handling with proper defaults
  const safeValue = value ?? (isNumeric ? 0 : "")
  const [currentValue, setCurrentValue] = useState(safeValue.toString())

  useEffect(() => {
    const newSafeValue = value ?? (isNumeric ? 0 : "")
    setCurrentValue(newSafeValue.toString())
  }, [value, isNumeric])

  const handleSave = () => {
    const processedValue = isNumeric ? Number.parseFloat(currentValue) || 0 : currentValue
    onChange(processedValue)
    onSaveEdit()
  }

  const handleCancel = () => {
    const safeCancelValue = value ?? (isNumeric ? 0 : "")
    setCurrentValue(safeCancelValue.toString())
    onCancelEdit()
  }

  if (isEditing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {isTextarea ? (
          <Textarea
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            aria-label={label}
            className="text-sm p-2 border rounded min-h-[60px]"
            autoFocus
          />
        ) : (
          <Input
            type={isNumeric ? "number" : "text"}
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            aria-label={label}
            className="text-sm h-8 p-2 border rounded"
            autoFocus
            step={isNumeric ? "0.01" : undefined}
          />
        )}
        <Button size="icon" variant="ghost" onClick={handleSave} aria-label={`Save ${label}`}>
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancel} aria-label={`Cancel ${label}`}>
          <X className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    )
  }

  const displayValue = safeValue
  return (
    <span
      onClick={onStartEdit}
      className={`hover:bg-yellow-100 dark:hover:bg-yellow-800 p-1 rounded cursor-pointer min-h-[2rem] block group ${className}`}
    >
      {isTextarea && typeof displayValue === "string"
        ? displayValue.split("\n").map((line, i) => (
            <React.Fragment key={i}>
              {line}
              <br />
            </React.Fragment>
          ))
        : displayValue}
      <Edit3 className="h-3 w-3 ml-1 inline-block opacity-0 group-hover:opacity-50 transition-opacity" />
    </span>
  )
}

export default function AIInvoiceEditor({ initialInvoiceData, poNumber, onInvoiceUpdate }: AIInvoiceEditorProps) {
  // Ensure we have safe defaults for all required fields
  const safeInitialData: AIInvoiceResponse = {
    invoice_id: initialInvoiceData?.invoice_id || "",
    invoice_date: initialInvoiceData?.invoice_date || new Date().toLocaleDateString(),
    due_date: initialInvoiceData?.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
    payment_terms: initialInvoiceData?.payment_terms || "Net 30",
    shipping_method: initialInvoiceData?.shipping_method || "Standard",
    bill_to: {
      company: initialInvoiceData?.bill_to?.company || "",
      contact: initialInvoiceData?.bill_to?.contact || "",
      address: initialInvoiceData?.bill_to?.address || "",
      phone: initialInvoiceData?.bill_to?.phone || "",
      email: initialInvoiceData?.bill_to?.email || "",
    },
    vendor: {
      company: initialInvoiceData?.vendor?.company || "",
      contact: initialInvoiceData?.vendor?.contact || "",
      address: initialInvoiceData?.vendor?.address || "",
      phone: initialInvoiceData?.vendor?.phone || "",
      email: initialInvoiceData?.vendor?.email || "",
    },
    items: initialInvoiceData?.items || [],
    summary: {
      subtotal: initialInvoiceData?.summary?.subtotal || 0,
      discount: initialInvoiceData?.summary?.discount || 0,
      freight: initialInvoiceData?.summary?.freight || 0,
      tax: initialInvoiceData?.summary?.tax || 0,
      total: initialInvoiceData?.summary?.total || 0,
    },
    notes: initialInvoiceData?.notes || "",
    payment_status: initialInvoiceData?.payment_status || "Pending",
  }

  const [invoiceData, setInvoiceData] = useState<AIInvoiceResponse>(safeInitialData)
  const [editingFields, setEditingFields] = useState<Record<string, boolean>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (initialInvoiceData) {
      setInvoiceData(safeInitialData)
      setHasUnsavedChanges(false)
    }
  }, [initialInvoiceData])

  const startEdit = (fieldName: string) => {
    setEditingFields((prev) => ({ ...prev, [fieldName]: true }))
  }

  const saveEdit = (fieldName: string) => {
    setEditingFields((prev) => ({ ...prev, [fieldName]: false }))
    setHasUnsavedChanges(true)
  }

  const cancelEdit = (fieldName: string) => {
    setEditingFields((prev) => ({ ...prev, [fieldName]: false }))
  }

  const handleFieldChange = (field: keyof AIInvoiceResponse, value: any) => {
    setInvoiceData((prev) => ({ ...prev, [field]: value }))
  }

  const handleContactChange = (contactType: "bill_to" | "vendor", field: keyof InvoiceContact, value: string) => {
    setInvoiceData((prev) => ({
      ...prev,
      [contactType]: {
        ...prev[contactType],
        [field]: value,
      },
    }))
  }

  const handleItemChange = (index: number, field: keyof InvoiceItemData, value: string | number) => {
    const newItems = [...invoiceData.items]
    const item = { ...newItems[index] }
    ;(item[field] as any) = value

    if (field === "qty" || field === "unit_price") {
      item.total = (Number(item.qty) || 0) * (Number(item.unit_price) || 0)
    }
    newItems[index] = item
    setInvoiceData((prev) => ({ ...prev, items: newItems }))
    recalculateTotals(newItems)
  }

  const addNewItem = () => {
    const newItem: InvoiceItemData = {
      description: "New Item",
      qty: 1,
      unit: "Each",
      unit_price: 0,
      total: 0,
    }
    const newItems = [...invoiceData.items, newItem]
    setInvoiceData((prev) => ({ ...prev, items: newItems }))
    setHasUnsavedChanges(true)
  }

  const removeItem = (index: number) => {
    const newItems = invoiceData.items.filter((_, i) => i !== index)
    setInvoiceData((prev) => ({ ...prev, items: newItems }))
    recalculateTotals(newItems)
    setHasUnsavedChanges(true)
  }

  const recalculateTotals = useCallback(
    (items: InvoiceItemData[]) => {
      const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0)
      const discount = invoiceData.summary.discount
      const freight = invoiceData.summary.freight
      const tax = invoiceData.summary.tax
      const total = subtotal - discount + freight + tax

      setInvoiceData((prev) => ({
        ...prev,
        summary: {
          ...prev.summary,
          subtotal: Number(subtotal.toFixed(2)),
          total: Number(total.toFixed(2)),
        },
      }))
      setHasUnsavedChanges(true)
    },
    [invoiceData.summary.discount, invoiceData.summary.freight, invoiceData.summary.tax],
  )

  const handleSummaryChange = (field: keyof typeof invoiceData.summary, value: number) => {
    const newSummary = { ...invoiceData.summary, [field]: value }

    if (field === "discount" || field === "freight" || field === "tax") {
      const total = newSummary.subtotal - newSummary.discount + newSummary.freight + newSummary.tax
      newSummary.total = Number(total.toFixed(2))
    }

    setInvoiceData((prev) => ({ ...prev, summary: newSummary }))
  }

  const handleSaveInvoice = async () => {
    setIsSaving(true)
    try {
      const updatePayload: InvoiceUpdatePayload = {
        invoice_id: invoiceData.invoice_id,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        payment_terms: invoiceData.payment_terms,
        shipping_method: invoiceData.shipping_method,
        bill_to: invoiceData.bill_to,
        vendor: invoiceData.vendor,
        items: invoiceData.items,
        summary: invoiceData.summary,
        notes: invoiceData.notes,
        payment_status: invoiceData.payment_status,
      }

      const result = await updateInvoice(updatePayload)

      if (result.success && result.invoice) {
        setInvoiceData(result.invoice)
        setHasUnsavedChanges(false)
        onInvoiceUpdate?.(result.invoice)
        toast({
          title: "Invoice Saved",
          description: `Invoice for PO ${poNumber} has been successfully updated.`,
        })
      } else {
        throw new Error(result.error || "Failed to save invoice")
      }
    } catch (error: any) {
      toast({
        title: "Save Failed",
        description: error.message || "Could not save invoice changes.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="mt-6 shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">AI Generated Invoice</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={invoiceData.payment_status === "Paid" ? "default" : "secondary"}>
              {invoiceData.payment_status}
            </Badge>
            {hasUnsavedChanges && (
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                Unsaved Changes
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 bg-white dark:bg-slate-800 rounded text-sm">
        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-1">INVOICE</h2>
            <p>
              <strong>Invoice ID:</strong> {invoiceData.invoice_id}
            </p>
            <p>
              <strong>Date:</strong>{" "}
              <EditableField
                label="Invoice Date"
                value={invoiceData.invoice_date}
                onChange={(val) => handleFieldChange("invoice_date", val)}
                isEditing={editingFields["invoice_date"] || false}
                onStartEdit={() => startEdit("invoice_date")}
                onSaveEdit={() => saveEdit("invoice_date")}
                onCancelEdit={() => cancelEdit("invoice_date")}
              />
            </p>
            <p>
              <strong>Due Date:</strong>{" "}
              <EditableField
                label="Due Date"
                value={invoiceData.due_date}
                onChange={(val) => handleFieldChange("due_date", val)}
                isEditing={editingFields["due_date"] || false}
                onStartEdit={() => startEdit("due_date")}
                onSaveEdit={() => saveEdit("due_date")}
                onCancelEdit={() => cancelEdit("due_date")}
              />
            </p>
            <p>
              <strong>Payment Terms:</strong>{" "}
              <EditableField
                label="Payment Terms"
                value={invoiceData.payment_terms}
                onChange={(val) => handleFieldChange("payment_terms", val)}
                isEditing={editingFields["payment_terms"] || false}
                onStartEdit={() => startEdit("payment_terms")}
                onSaveEdit={() => saveEdit("payment_terms")}
                onCancelEdit={() => cancelEdit("payment_terms")}
              />
            </p>
          </div>
          <div className="text-right">
            <h3 className="font-semibold text-md mb-1">From</h3>
            <EditableField
              label="Vendor Company"
              value={invoiceData.vendor.company}
              onChange={(val) => handleContactChange("vendor", "company", val as string)}
              isEditing={editingFields["vendor_company"] || false}
              onStartEdit={() => startEdit("vendor_company")}
              onSaveEdit={() => saveEdit("vendor_company")}
              onCancelEdit={() => cancelEdit("vendor_company")}
            />
            <EditableField
              label="Vendor Contact"
              value={invoiceData.vendor.contact}
              onChange={(val) => handleContactChange("vendor", "contact", val as string)}
              isEditing={editingFields["vendor_contact"] || false}
              onStartEdit={() => startEdit("vendor_contact")}
              onSaveEdit={() => saveEdit("vendor_contact")}
              onCancelEdit={() => cancelEdit("vendor_contact")}
            />
            <EditableField
              label="Vendor Address"
              value={invoiceData.vendor.address}
              onChange={(val) => handleContactChange("vendor", "address", val as string)}
              isEditing={editingFields["vendor_address"] || false}
              onStartEdit={() => startEdit("vendor_address")}
              onSaveEdit={() => saveEdit("vendor_address")}
              onCancelEdit={() => cancelEdit("vendor_address")}
            />
            <EditableField
              label="Vendor Phone"
              value={invoiceData.vendor.phone}
              onChange={(val) => handleContactChange("vendor", "phone", val as string)}
              isEditing={editingFields["vendor_phone"] || false}
              onStartEdit={() => startEdit("vendor_phone")}
              onSaveEdit={() => saveEdit("vendor_phone")}
              onCancelEdit={() => cancelEdit("vendor_phone")}
            />
          </div>
        </div>

        {/* Bill To Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-md mb-1">Bill To</h3>
          <EditableField
            label="Bill To Company"
            value={invoiceData.bill_to.company}
            onChange={(val) => handleContactChange("bill_to", "company", val as string)}
            isEditing={editingFields["bill_to_company"] || false}
            onStartEdit={() => startEdit("bill_to_company")}
            onSaveEdit={() => saveEdit("bill_to_company")}
            onCancelEdit={() => cancelEdit("bill_to_company")}
          />
          <EditableField
            label="Bill To Contact"
            value={invoiceData.bill_to.contact}
            onChange={(val) => handleContactChange("bill_to", "contact", val as string)}
            isEditing={editingFields["bill_to_contact"] || false}
            onStartEdit={() => startEdit("bill_to_contact")}
            onSaveEdit={() => saveEdit("bill_to_contact")}
            onCancelEdit={() => cancelEdit("bill_to_contact")}
          />
          <EditableField
            label="Bill To Address"
            value={invoiceData.bill_to.address}
            onChange={(val) => handleContactChange("bill_to", "address", val as string)}
            isEditing={editingFields["bill_to_address"] || false}
            onStartEdit={() => startEdit("bill_to_address")}
            onSaveEdit={() => saveEdit("bill_to_address")}
            onCancelEdit={() => cancelEdit("bill_to_address")}
          />
          <EditableField
            label="Bill To Phone"
            value={invoiceData.bill_to.phone}
            onChange={(val) => handleContactChange("bill_to", "phone", val as string)}
            isEditing={editingFields["bill_to_phone"] || false}
            onStartEdit={() => startEdit("bill_to_phone")}
            onSaveEdit={() => saveEdit("bill_to_phone")}
            onCancelEdit={() => cancelEdit("bill_to_phone")}
          />
          {invoiceData.bill_to.email && (
            <EditableField
              label="Bill To Email"
              value={invoiceData.bill_to.email}
              onChange={(val) => handleContactChange("bill_to", "email", val as string)}
              isEditing={editingFields["bill_to_email"] || false}
              onStartEdit={() => startEdit("bill_to_email")}
              onSaveEdit={() => saveEdit("bill_to_email")}
              onCancelEdit={() => cancelEdit("bill_to_email")}
            />
          )}
        </div>

        {/* Items Table */}
        <Table className="mb-6">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Description</TableHead>
              <TableHead className="text-center">Qty</TableHead>
              <TableHead className="text-center">Unit</TableHead>
              <TableHead className="text-right">Unit Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoiceData.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  <EditableField
                    label={`Item ${index + 1} Description`}
                    value={item.description}
                    onChange={(val) => handleItemChange(index, "description", val as string)}
                    isEditing={editingFields[`item_${index}_description`] || false}
                    onStartEdit={() => startEdit(`item_${index}_description`)}
                    onSaveEdit={() => saveEdit(`item_${index}_description`)}
                    onCancelEdit={() => cancelEdit(`item_${index}_description`)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <EditableField
                    label={`Item ${index + 1} Quantity`}
                    value={item.qty}
                    onChange={(val) => handleItemChange(index, "qty", val as number)}
                    isNumeric
                    isEditing={editingFields[`item_${index}_qty`] || false}
                    onStartEdit={() => startEdit(`item_${index}_qty`)}
                    onSaveEdit={() => saveEdit(`item_${index}_qty`)}
                    onCancelEdit={() => cancelEdit(`item_${index}_qty`)}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <EditableField
                    label={`Item ${index + 1} Unit`}
                    value={item.unit}
                    onChange={(val) => handleItemChange(index, "unit", val as string)}
                    isEditing={editingFields[`item_${index}_unit`] || false}
                    onStartEdit={() => startEdit(`item_${index}_unit`)}
                    onSaveEdit={() => saveEdit(`item_${index}_unit`)}
                    onCancelEdit={() => cancelEdit(`item_${index}_unit`)}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <EditableField
                    label={`Item ${index + 1} Unit Price`}
                    value={item.unit_price}
                    onChange={(val) => handleItemChange(index, "unit_price", val as number)}
                    isNumeric
                    isEditing={editingFields[`item_${index}_unit_price`] || false}
                    onStartEdit={() => startEdit(`item_${index}_unit_price`)}
                    onSaveEdit={() => saveEdit(`item_${index}_unit_price`)}
                    onCancelEdit={() => cancelEdit(`item_${index}_unit_price`)}
                  />
                </TableCell>
                <TableCell className="text-right">{formatCurrency(item.total)}</TableCell>
                <TableCell className="text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItem(index)}
                    className="h-8 w-8 text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-start mb-4">
          <Button variant="outline" onClick={addNewItem} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>

        {/* Summary Section */}
        <div className="flex justify-end mb-6">
          <div className="w-full max-w-xs space-y-1">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>{formatCurrency(invoiceData.summary.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Discount:</span>
              <EditableField
                label="Discount"
                value={invoiceData.summary.discount}
                onChange={(val) => handleSummaryChange("discount", val as number)}
                isNumeric
                isEditing={editingFields["summary_discount"] || false}
                onStartEdit={() => startEdit("summary_discount")}
                onSaveEdit={() => saveEdit("summary_discount")}
                onCancelEdit={() => cancelEdit("summary_discount")}
                className="text-right"
              />
            </div>
            <div className="flex justify-between items-center">
              <span>Freight:</span>
              <EditableField
                label="Freight"
                value={invoiceData.summary.freight}
                onChange={(val) => handleSummaryChange("freight", val as number)}
                isNumeric
                isEditing={editingFields["summary_freight"] || false}
                onStartEdit={() => startEdit("summary_freight")}
                onSaveEdit={() => saveEdit("summary_freight")}
                onCancelEdit={() => cancelEdit("summary_freight")}
                className="text-right"
              />
            </div>
            <div className="flex justify-between items-center">
              <span>Tax:</span>
              <EditableField
                label="Tax"
                value={invoiceData.summary.tax}
                onChange={(val) => handleSummaryChange("tax", val as number)}
                isNumeric
                isEditing={editingFields["summary_tax"] || false}
                onStartEdit={() => startEdit("summary_tax")}
                onSaveEdit={() => saveEdit("summary_tax")}
                onCancelEdit={() => cancelEdit("summary_tax")}
                className="text-right"
              />
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total:</span>
              <span>{formatCurrency(invoiceData.summary.total)}</span>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="mb-6">
          <h3 className="font-semibold text-md mb-1">Notes:</h3>
          <EditableField
            label="Notes"
            value={invoiceData.notes || ""}
            onChange={(val) => handleFieldChange("notes", val as string)}
            isTextarea
            isEditing={editingFields["notes"] || false}
            onStartEdit={() => startEdit("notes")}
            onSaveEdit={() => saveEdit("notes")}
            onCancelEdit={() => cancelEdit("notes")}
          />
        </div>

        {/* Unsaved Changes Alert */}
        {hasUnsavedChanges && (
          <Alert className="mb-4 bg-orange-50 border-orange-200">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              You have unsaved changes. Click "Save Invoice" to persist your modifications.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Click on any field to edit. Changes are highlighted and must be saved.
        </div>
        <Button
          onClick={handleSaveInvoice}
          disabled={isSaving || !hasUnsavedChanges}
          className="flex items-center gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Saving..." : "Save Invoice"}
        </Button>
      </CardFooter>
    </Card>
  )
}
