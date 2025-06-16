"use client"

import type React from "react"

import { useState } from "react"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { BellRing, Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { sendReminder, logSendReminderAction, getReminderMessage } from "@/lib/send-reminder-service"

interface SendReminderDialogProps {
  poNumber: string
  trigger?: React.ReactNode
  onSendSuccess?: (poNumber: string, message: string) => void
  onSendError?: (error: string) => void
  disabled?: boolean
}

export default function SendReminderDialog({
  poNumber,
  trigger,
  onSendSuccess,
  onSendError,
  disabled = false,
}: SendReminderDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null)
  const { toast } = useToast()

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (!open) {
      // Reset state when dialog closes
      setSendResult(null)
    }
  }

  const handleSendReminder = async () => {
    setIsSending(true)
    setSendResult(null)

    try {
      console.log("SendReminderDialog: Initiating reminder send for PO:", poNumber)

      const result = await sendReminder(poNumber)

      console.log("SendReminderDialog: Send result:", result)

      if (result.success) {
        const successMessage = result.message || `Reminder sent successfully for PO ${poNumber}`
        setSendResult({ success: true, message: successMessage })

        toast({
          title: "Reminder Sent",
          description: successMessage,
          action: <CheckCircle className="h-5 w-5 text-green-500" />,
        })

        // Log successful action
        await logSendReminderAction(poNumber, true)

        // Notify parent component
        onSendSuccess?.(poNumber, successMessage)

        // Close dialog after a short delay to show success message
        setTimeout(() => {
          setIsOpen(false)
        }, 2000)
      } else {
        const errorMessage = result.error || "Failed to send reminder"
        setSendResult({ success: false, message: errorMessage })

        toast({
          title: "Reminder Failed",
          description: errorMessage,
          variant: "destructive",
        })

        // Log failed action
        await logSendReminderAction(poNumber, false, errorMessage)

        // Notify parent component
        onSendError?.(errorMessage)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unexpected error occurred"
      console.error("SendReminderDialog: Error sending reminder:", error)

      setSendResult({ success: false, message: errorMessage })

      toast({
        title: "Reminder Error",
        description: errorMessage,
        variant: "destructive",
      })

      onSendError?.(errorMessage)
    } finally {
      setIsSending(false)
    }
  }

  const defaultTrigger = (
    <Button disabled={disabled} variant="outline">
      <BellRing className="mr-2 h-4 w-4" />
      Send Reminder
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger || defaultTrigger}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Send Reminder
            <Badge variant="outline" className="ml-2">
              {poNumber}
            </Badge>
          </DialogTitle>
          <DialogDescription>Send a reminder notification for this Purchase Order</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Information Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>{getReminderMessage(poNumber)}</AlertDescription>
          </Alert>

          {/* PO Details */}
          <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Purchase Order Details</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">PO Number:</span>
                <span className="font-medium">{poNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Action:</span>
                <span>Send Follow-up Reminder</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recipients:</span>
                <span>Relevant parties will be notified</span>
              </div>
            </div>
          </div>

          {/* Send Result */}
          {sendResult && (
            <Alert variant={sendResult.success ? "default" : "destructive"}>
              {sendResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertDescription>{sendResult.message}</AlertDescription>
            </Alert>
          )}

          {/* Warning for multiple sends */}
          <Alert
            variant="default"
            className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
          >
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> This will send a reminder to all relevant parties. Please ensure this action is
              necessary to avoid excessive notifications.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSending}>
            {sendResult?.success ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={handleSendReminder}
            disabled={isSending || sendResult?.success}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending Reminder...
              </>
            ) : (
              <>
                <BellRing className="mr-2 h-4 w-4" />
                Send Reminder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
