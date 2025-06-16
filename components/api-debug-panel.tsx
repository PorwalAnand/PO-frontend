"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, TestTube } from "lucide-react"

export default function APIDebugPanel() {
  const [testPoNumber, setTestPoNumber] = useState("")
  const [isTestingAPI, setIsTestingAPI] = useState(false)
  const [apiTestResult, setApiTestResult] = useState<any>(null)

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

  const testAPIEndpoint = async () => {
    if (!testPoNumber.trim()) {
      setApiTestResult({ error: "Please enter a PO number to test" })
      return
    }

    setIsTestingAPI(true)
    setApiTestResult(null)

    try {
      console.log(`Testing API endpoint: ${API_BASE_URL}/ai/invoice`)

      const response = await fetch(`${API_BASE_URL}/ai/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ po_number: testPoNumber.trim() }),
      })

      const responseHeaders = Object.fromEntries(response.headers.entries())
      const responseText = await response.text()

      let responseData
      let parseError = null
      try {
        responseData = JSON.parse(responseText)
      } catch (err) {
        parseError = err instanceof Error ? err.message : "Unknown parse error"
        responseData = responseText
      }

      // Check for invoice_id specifically
      let invoiceIdCheck = "Not found"
      if (responseData && typeof responseData === "object") {
        if (responseData.invoice_id) {
          invoiceIdCheck = `Found: "${responseData.invoice_id}" (type: ${typeof responseData.invoice_id})`
        } else if (responseData.data && responseData.data.invoice_id) {
          invoiceIdCheck = `Found in data wrapper: "${responseData.data.invoice_id}"`
        } else if (responseData.invoice && responseData.invoice.invoice_id) {
          invoiceIdCheck = `Found in invoice wrapper: "${responseData.invoice.invoice_id}"`
        } else {
          invoiceIdCheck = `Missing - Available keys: ${Object.keys(responseData).join(", ")}`
        }
      }

      setApiTestResult({
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: responseData,
        rawText: responseText,
        parseError,
        invoiceIdCheck,
        contentType: responseHeaders["content-type"],
        responseSize: responseText.length,
      })
    } catch (error) {
      setApiTestResult({
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      })
    } finally {
      setIsTestingAPI(false)
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          API Debug Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter PO Number (e.g., PO-2024-001)"
            value={testPoNumber}
            onChange={(e) => setTestPoNumber(e.target.value)}
            className="flex-1"
          />
          <Button onClick={testAPIEndpoint} disabled={isTestingAPI}>
            {isTestingAPI ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test API
          </Button>
        </div>

        {apiTestResult && (
          <Alert>
            <AlertDescription>
              <details>
                <summary className="cursor-pointer font-medium">API Test Result (Click to expand)</summary>
                <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-96">
                  {JSON.stringify(apiTestResult, null, 2)}
                </pre>
              </details>
            </AlertDescription>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground">
          <p>
            <strong>API Base URL:</strong> {API_BASE_URL || "Not configured"}
          </p>
          <p>
            <strong>Endpoint:</strong> POST /ai/invoice
          </p>
          <p>
            <strong>Expected Response:</strong> JSON object with invoice_id field
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
