"use client"

import Link from "next/link"
import { useEffect, useState, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle2, Hourglass, Eye } from "lucide-react"
import type { PurchaseOrderListItem, POStatusFilter } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

const POStatusIcon = ({ status }: { status: PurchaseOrderListItem["status"] }) => {
  if (status === "Completed") return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === "In Progress") return <Hourglass className="h-5 w-5 text-yellow-500" />
  if (status === "Recently Received") return <Hourglass className="h-5 w-5 text-blue-500" />
  return null
}

export default function PoDashboardClient() {
  const [pos, setPos] = useState<PurchaseOrderListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTab, setCurrentTab] = useState<POStatusFilter>("Recently Received")
  const { toast } = useToast()

  const fetchPOs = useCallback(
    async (status: POStatusFilter) => {
      setIsLoading(true)
      try {
        const response = await fetch(`/api/po-list?status=${status}`)
        if (!response.ok) throw new Error("Failed to fetch POs")
        const data = await response.json()
        setPos(data)
      } catch (error) {
        console.error(error)
        toast({
          title: "Error",
          description: "Could not fetch purchase orders.",
          variant: "destructive",
        })
        setPos([])
      } finally {
        setIsLoading(false)
      }
    },
    [toast],
  )

  useEffect(() => {
    fetchPOs(currentTab)
  }, [currentTab, fetchPOs])

  const handleTabChange = (value: string) => {
    setCurrentTab(value as POStatusFilter)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
  }

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6">Purchase Order Dashboard</h1>
      <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex mb-4">
          <TabsTrigger value="Recently Received">Recently Received</TabsTrigger>
          <TabsTrigger value="In Progress">In Progress</TabsTrigger>
          <TabsTrigger value="Completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value={currentTab} className="mt-0">
          {" "}
          {/* Simplified, always render table */}
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
                      No purchase orders found for this status.
                    </TableCell>
                  </TableRow>
                ) : (
                  pos.map((po) => (
                    <TableRow key={po.poNumber}>
                      <TableCell className="font-medium">{po.poNumber}</TableCell>
                      <TableCell>{new Date(po.date).toLocaleDateString()}</TableCell>
                      <TableCell>{po.billTo}</TableCell>
                      <TableCell>{po.vendor}</TableCell>
                      <TableCell className="text-right">{formatCurrency(po.totalAmount)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            po.status === "Completed"
                              ? "default"
                              : po.status === "In Progress"
                                ? "secondary"
                                : "outline" // Recently Received
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
                            po.payment === "Paid" ? "default" : po.payment === "Overdue" ? "destructive" : "secondary"
                          }
                        >
                          {po.payment}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {po.redFlags > 0 ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit mx-auto">
                            <AlertTriangle className="h-4 w-4" />
                            {po.redFlags}
                          </Badge>
                        ) : (
                          <span className="text-green-500">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/po/${po.poNumber}`}>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
