import { toast } from "@/components/ui/use-toast" // Assuming useToast can be imported here
import type { UserActionLogPayload } from "./types"

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

/**
 * Logs a user action to the backend.
 * @param poNumber The purchase order number related to the action.
 * @param actionDescription A string describing the action performed.
 * @param actorId Identifier for the user performing the action.
 * @param isApproved Boolean indicating if the action was approved.
 * @returns Promise<boolean> True if logging was successful, false otherwise.
 */
export async function logUserAction(
  poNumber: string,
  actionDescription: string,
  actorId: string, // In a real app, this would come from auth state
  isApproved: boolean,
): Promise<boolean> {
  if (!API_BASE_URL) {
    console.error("ActionLogger: NEXT_PUBLIC_API_BASE_URL is not set. Cannot log action.")
    // Depending on requirements, you might not want to toast for this config error repeatedly
    toast({
      title: "Logging Configuration Error",
      description: "API Base URL is not configured for logging.",
      variant: "destructive",
    })
    return false
  }

  const payload: UserActionLogPayload = {
    po_number: poNumber,
    action: actionDescription,
    actor: actorId,
    approved: isApproved,
  }

  try {
    const response = await fetch(`${API_BASE_URL}/log-action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error("ActionLogger: Failed to log action", { status: response.status, errorData, payload })
      toast({
        title: "Logging Failed",
        description: `Could not log action: ${actionDescription}. Server responded with ${response.status}. ${errorData.message || ""}`,
        variant: "destructive",
      })
      return false
    }

    // const result = await response.json(); // If the API returns a meaningful success response
    console.log("ActionLogger: Action logged successfully", payload)
    toast({
      title: "Action Logged",
      description: `${actionDescription} for PO ${poNumber} has been logged.`,
    })
    return true
  } catch (error) {
    console.error("ActionLogger: Error logging action:", { error, payload })
    toast({
      title: "Logging Error",
      description: `An unexpected error occurred while logging action: ${actionDescription}.`,
      variant: "destructive",
    })
    return false
  }
}
