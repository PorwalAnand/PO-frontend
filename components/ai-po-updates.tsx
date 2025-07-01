"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useToast } from "@/components/ui/use-toast"
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp, Info, Loader2, RefreshCw, X } from "lucide-react"

interface AIUpdateResponse {
  email_summary?: string[]
  item_updates?: Array<{
    item_id: string
    field: string
    old_value: any
    new_value: any
    confidence: number
    source: string
  }>
  red_flags?: string[]
}

interface AIPOUpdatesProps {
  poNumber: string
  existingRedFlags: string[]
  onPOUpdated: () => void
}

export default function AIPOUpdates({ poNumber, existingRedFlags, onPOUpdated }: AIPOUpdatesProps) {
  const { toast } = useToast()
  const [aiUpdates, setAiUpdates] = useState<AIUpdateResponse | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isItemUpdatesOpen, setIsItemUpdatesOpen] = useState(true)
  const [isRedFlagsOpen, setIsRedFlagsOpen] = useState(true)
  const [isEmailSummaryOpen, setIsEmailSummaryOpen] = useState(true)
  const [resolvingFlags, setResolvingFlags] = useState<Set<string>>(new Set())

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

  const handleAnalyzeEmails = async () => {
    setIsAnalyzing(true)
    setAnalysisError(null)
    setAiUpdates(null)

    try {
      console.log(`AIPOUpdates: Starting email analysis for PO ${poNumber}`)

      const response = await fetch(`${API_BASE_URL}/ai/update-po-from-emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ po_number: poNumber }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to analyze emails" }))
        throw new Error(errorData.message || `Server responded with ${response.status}`)
      }

      const data = await response.json()
      console.log("AIPOUpdates: Analysis result:", data)

      setAiUpdates(data)

      // Show appropriate toast based on results
      const hasUpdates = data.item_updates && data.item_updates.length > 0
      const hasRedFlags = data.red_flags && data.red_flags.length > 0
      const hasEmailSummary = data.email_summary && data.email_summary.length > 0

      if (hasUpdates || hasRedFlags || hasEmailSummary) {
        let message = "Email analysis completed. "
        if (hasEmailSummary) message += `Found email summary. `
        if (hasUpdates) message += `Found ${data.item_updates.length} suggested update(s). `
        if (hasRedFlags) message += `Found ${data.red_flags.length} red flag(s). `

        toast({
          title: "✅ Analysis Complete",
          description: message.trim(),
        })
      } else {
        toast({
          title: "📧 Analysis Complete",
          description: "No updates, red flags, or email summary found in recent communications.",
        })
      }
    } catch (error) {
      console.error("AIPOUpdates: Error analyzing emails:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze emails"
      setAnalysisError(errorMessage)
      toast({
        title: "Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleResolveRedFlag = async (flag: string) => {
    setResolvingFlags((prev) => new Set(prev).add(flag))

    try {
      const response = await fetch(`${API_BASE_URL}/po/resolve-red-flag`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          po_number: poNumber,
          resolved_flag: flag,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to resolve red flag" }))
        throw new Error(errorData.message || `Server responded with ${response.status}`)
      }

      const result = await response.json()
      console.log("AIPOUpdates: Red flag resolved:", result)

      toast({
        title: "✅ Red Flag Resolved",
        description: `"${flag}" has been marked as resolved.`,
      })

      // Refresh the PO details to update the red flags list
      onPOUpdated()

      // Remove the resolved flag from AI updates display
      setAiUpdates((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          red_flags: prev.red_flags?.filter((f) => f !== flag) || [],
        }
      })
    } catch (error) {
      console.error("AIPOUpdates: Error resolving red flag:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to resolve red flag"
      toast({
        title: "Resolution Failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setResolvingFlags((prev) => {
        const newSet = new Set(prev)
        newSet.delete(flag)
        return newSet
      })
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800 border-green-300"
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800 border-yellow-300"
    return "bg-red-100 text-red-800 border-red-300"
  }

  const formatValue = (value: any) => {
    if (typeof value === "number") {
      return value.toLocaleString()
    }
    return String(value)
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AI Suggestions for PO Updates</span>
          <Button onClick={handleAnalyzeEmails} disabled={isAnalyzing} variant="outline" size="sm">
            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isAnalyzing ? "Analyzing..." : "Analyze Emails"}
          </Button>
        </CardTitle>
        <CardDescription>
          AI-powered analysis of email communications to suggest PO updates and identify potential issues.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Analysis Status */}
        {isAnalyzing && (
          <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              AI is analyzing email communications for PO {poNumber}. This may take a few moments...
            </AlertDescription>
          </Alert>
        )}

        {analysisError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Analysis Failed</AlertTitle>
            <AlertDescription>{analysisError}</AlertDescription>
          </Alert>
        )}

        {/* Email Summary Section */}
        {aiUpdates && (
          <Collapsible open={isEmailSummaryOpen} onOpenChange={setIsEmailSummaryOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  📧 Email Summary
                  {aiUpdates.email_summary && aiUpdates.email_summary.length > 0 && (
                    <Badge variant="secondary">{aiUpdates.email_summary.length}</Badge>
                  )}
                </h3>
                {isEmailSummaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                {aiUpdates.email_summary && aiUpdates.email_summary.length > 0 ? (
                  <ul className="space-y-2 text-left">
                    {aiUpdates.email_summary.map((summary, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-gray-400 mt-1">•</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{summary}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-left">No email summary available.</p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Item Updates Section */}
        {aiUpdates && (
          <Collapsible open={isItemUpdatesOpen} onOpenChange={setIsItemUpdatesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  📝 Item Updates
                  {aiUpdates.item_updates && aiUpdates.item_updates.length > 0 && (
                    <Badge variant="secondary">{aiUpdates.item_updates.length}</Badge>
                  )}
                </h3>
                {isItemUpdatesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {aiUpdates.item_updates && aiUpdates.item_updates.length > 0 ? (
                <div className="space-y-3">
                  {aiUpdates.item_updates.map((update, index) => (
                    <Alert key={index} className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertDescription>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Item: {update.item_id}</span>
                            <Badge className={getConfidenceColor(update.confidence)}>
                              {Math.round(update.confidence * 100)}% confidence
                            </Badge>
                          </div>
                          <div className="text-sm">
                            <span className="font-medium">Field:</span> {update.field}
                          </div>
                          <div className="text-sm grid grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium text-red-600">Old:</span> {formatValue(update.old_value)}
                            </div>
                            <div>
                              <span className="font-medium text-green-600">New:</span> {formatValue(update.new_value)}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Source:</span> {update.source}
                          </div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>No item updates suggested based on email analysis.</AlertDescription>
                </Alert>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Red Flags Section */}
        {aiUpdates && (
          <Collapsible open={isRedFlagsOpen} onOpenChange={setIsRedFlagsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  🚩 Red Flags
                  {aiUpdates.red_flags && aiUpdates.red_flags.length > 0 && (
                    <Badge variant="destructive">{aiUpdates.red_flags.length}</Badge>
                  )}
                </h3>
                {isRedFlagsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              {aiUpdates.red_flags && aiUpdates.red_flags.length > 0 ? (
                <div className="space-y-3">
                  {aiUpdates.red_flags.map((flag, index) => (
                    <Alert key={index} variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="flex justify-between items-center">
                        <span>{flag}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResolveRedFlag(flag)}
                          disabled={resolvingFlags.has(flag)}
                          className="ml-4 bg-white hover:bg-gray-50"
                        >
                          {resolvingFlags.has(flag) ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          ) : (
                            <X className="mr-1 h-3 w-3" />
                          )}
                          {resolvingFlags.has(flag) ? "Resolving..." : "Mark as Resolved"}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              ) : (
                <Alert className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    No red flags identified in email communications.
                  </AlertDescription>
                </Alert>
              )}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Show existing red flags from PO data */}
        {existingRedFlags && existingRedFlags.length > 0 && (
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  ⚠️ Existing Red Flags
                  <Badge variant="destructive">{existingRedFlags.length}</Badge>
                </h3>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {existingRedFlags.map((flag, index) => (
                  <Alert key={index} variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="flex justify-between items-center">
                      <span>{flag}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResolveRedFlag(flag)}
                        disabled={resolvingFlags.has(flag)}
                        className="ml-4 bg-white hover:bg-gray-50"
                      >
                        {resolvingFlags.has(flag) ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <X className="mr-1 h-3 w-3" />
                        )}
                        {resolvingFlags.has(flag) ? "Resolving..." : "Mark as Resolved"}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* No data state */}
        {!aiUpdates && !isAnalyzing && !analysisError && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Click "Analyze Emails" to get AI-powered suggestions for PO updates based on email communications.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
