/**
 * PayPal Webhook Signature Verification
 * 
 * Verifies PayPal webhook signatures using PayPal's verification API
 * Reference: https://developer.paypal.com/docs/api-basics/notifications/webhooks/verify-webhook-signature/
 */

interface PayPalWebhookHeaders {
  "paypal-transmission-id": string
  "paypal-transmission-time": string
  "paypal-cert-url": string
  "paypal-auth-algo": string
  "paypal-transmission-sig": string
}

interface PayPalWebhookVerificationRequest {
  auth_algo: string
  cert_url: string
  transmission_id: string
  transmission_sig: string
  transmission_time: string
  webhook_id: string
  webhook_event: any
}

/**
 * Verify PayPal webhook signature
 */
export async function verifyPayPalWebhookSignature(
  headers: Headers,
  body: any,
  webhookId: string
): Promise<boolean> {
  try {
    // Extract PayPal headers
    const transmissionId = headers.get("paypal-transmission-id")
    const transmissionTime = headers.get("paypal-transmission-time")
    const certUrl = headers.get("paypal-cert-url")
    const authAlgo = headers.get("paypal-auth-algo")
    const transmissionSig = headers.get("paypal-transmission-sig")

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      console.error("Missing required PayPal webhook headers")
      return false
    }

    // Determine PayPal API base URL (sandbox or production)
    const isSandbox = process.env.PAYPAL_CLIENT_ID?.includes("sandbox") || 
                     process.env.PAYPAL_CLIENT_ID?.includes("sb-") ||
                     !process.env.PAYPAL_CLIENT_ID
    const baseUrl = isSandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com"

    // Get PayPal access token
    const accessToken = await getPayPalAccessToken()
    if (!accessToken) {
      console.error("Failed to get PayPal access token")
      return false
    }

    // Prepare verification request
    const verificationRequest: PayPalWebhookVerificationRequest = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: body,
    }

    // Call PayPal verification API
    const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(verificationRequest),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("PayPal verification API error:", response.status, errorText)
      return false
    }

    const verificationResult = await response.json()
    
    // Check verification status
    if (verificationResult.verification_status === "SUCCESS") {
      return true
    }

    console.error("PayPal webhook signature verification failed:", verificationResult.verification_status)
    return false
  } catch (error) {
    console.error("Error verifying PayPal webhook signature:", error)
    return false
  }
}

/**
 * Get PayPal access token for API calls
 */
async function getPayPalAccessToken(): Promise<string | null> {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET

    if (!clientId || !clientSecret) {
      console.error("PayPal credentials not configured")
      return null
    }

    // Determine PayPal API base URL (sandbox or production)
    const isSandbox = clientId.includes("sandbox") || clientId.includes("sb-")
    const baseUrl = isSandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com"

    // Get access token
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("PayPal OAuth error:", response.status, errorText)
      return null
    }

    const data = await response.json()
    return data.access_token || null
  } catch (error) {
    console.error("Error getting PayPal access token:", error)
    return null
  }
}

