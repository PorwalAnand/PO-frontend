"use client"

import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AlertTriangle, CheckCircle2, Hourglass, Eye } from "lucide-react"
import type { PurchaseOrderListItem } from "@/lib/types" // Removed POStatusFilter
import { useToast } from "@/components/ui/use-toast"

const POStatusIcon = ({ status }: { status: PurchaseOrderListItem["status"] }) => {
  if (status === "Completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === "In Progress") return <Hourglass className="h-5 w-5 text-yellow-500" />
  if (status === "Received") return <Hourglass className="h-5 w-5 text-blue-500" />
  return null
}

export default function PoTable() {
  const [pos, setPos] = useState<PurchaseOrderListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

  const fetchPOs = useCallback(async () => {
    if (!API_BASE_URL) {
      console.warn("NEXT_PUBLIC_API_BASE_URL is not set. Skipping API calls.")
      setIsLoading(false)
      setPos([])
      toast({
        title: "Configuration Error",
        description: "API Base URL is not configured.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // Fetching all POs, no status filter parameter
      const fetchUrl = `${API_BASE_URL}/po-list`
      console.log(`Fetching all POs from URL: ${fetchUrl}`)

      const response = await fetch(fetchUrl)
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`API Error (${response.status}): ${errorText}`)
        throw new Error(`Failed to fetch POs. Server responded with ${response.status}.`)
      }
      const data = await response.json()
      const rawPOs = Array.isArray(data) ? data : data.results || []

      const mappedPOs: PurchaseOrderListItem[] = rawPOs.map((po: any) => ({
        po_number: po.po_number,
        date: po.date,
        bill_to: po.bill_to,
        vendor: po.vendor,
        summary: po.summary,
        status: po.status as PurchaseOrderListItem["status"],
        payment_status: po.payment_status,
        red_flags: Array.isArray(po.red_flags) ? po.red_flags.map(String) : [],
      }))

      console.log(`Received ${mappedPOs.length} total POs.`)
      setPos(mappedPOs)
    } catch (error: any) {
      console.error("Error fetching POs:", error)
      toast({
        title: "Error Fetching POs",
        description: error.message || "Could not fetch purchase orders.",
        variant: "destructive",
      })
      setPos([])
    } finally {
      setIsLoading(false)
    }
  }, [toast, API_BASE_URL])

  useEffect(() => {
    fetchPOs()
  }, [fetchPOs])

  const formatCurrency = (amount: number | undefined) => {
    if (typeof amount !== "number") return "N/A"
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  return (
    <div className="mt-6">
      {/* Filter Tabs UI and logic removed */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">PO Number</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Bill To</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-center">Red Flags</TableHead>
              <TableHead className="text-center">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`loading-${i}`}>
                  <TableCell colSpan={9} className="h-12 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ))
            ) : pos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No purchase orders found.
                </TableCell>
              </TableRow>
            ) : (
              pos.map((po) => (
                <TableRow key={po.po_number}>
                  <TableCell className="font-medium">{po.po_number}</TableCell>
                  <TableCell>{new Date(po.date).toLocaleDateString()}</TableCell>
                  <TableCell>{po.bill_to}</TableCell>
                  <TableCell>{po.vendor}</TableCell>
                  <TableCell className="text-right">{formatCurrency(po.summary?.total)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        po.status === "Completed" ? "default" : po.status === "In Progress" ? "secondary" : "outline"
                      }
                      className="flex items-center gap-1 w-fit"
                    >
                      <POStatusIcon status={po.status} />
                      {po.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        po.payment_status === "Paid"
                          ? "default"
                          : po.payment_status === "Overdue"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {po.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {po.red_flags && po.red_flags.length > 0 ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-red-100 dark:hover:bg-red-900 rounded-full"
                          >
                            <span role="img" aria-label="Red Flag" className="text-xl">
                              🔴
                            </span>
                            <span className="ml-1 text-xs text-red-600">({po.red_flags.length})</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="grid gap-4">
                            <div className="space-y-2">
                              <h4 className="font-medium leading-none flex items-center">
                                <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                                Red Flag Details
                              </h4>
                              {po.red_flags.map((flag, index) => (
                                <p key={index} className="text-sm text-muted-foreground">
                                  - {flag}
                                </p>
                              ))}
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/po/${po.po_number}`}>
                        <Eye className="h-4 w-4 mr-1 md:mr-2" />
                        <span className="hidden md:inline">View</span>
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
