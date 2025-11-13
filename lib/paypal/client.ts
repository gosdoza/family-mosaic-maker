/**
 * PayPal API 客户端
 * 
 * 包含 OAuth 认证、订单创建、支付捕获等功能
 */

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET
const PAYPAL_ENV = process.env.PAYPAL_ENV || (PAYPAL_CLIENT_ID?.includes("sandbox") || PAYPAL_CLIENT_ID?.startsWith("sb-") ? "sandbox" : "production")
const PAYPAL_BASE_URL = PAYPAL_ENV === "sandbox" 
  ? "https://api.sandbox.paypal.com"
  : "https://api.paypal.com"

/**
 * 获取 PayPal Access Token
 */
export async function getPayPalAccessToken(): Promise<string | null> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials not configured")
  }

  try {
    const authHeader = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64")
    
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Language": "en_US",
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${authHeader}`,
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    })

    if (!response.ok) {
      throw new Error(`PayPal OAuth failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.access_token
  } catch (error: any) {
    console.error("Failed to get PayPal access token:", error)
    throw error
  }
}

/**
 * 创建 PayPal 订单
 */
export async function createPayPalOrder(params: {
  jobId: string
  amount: string // "2.99"
  currency?: string
  idempotencyKey?: string
}): Promise<{
  id: string
  status: string
  links: Array<{ href: string; rel: string; method: string }>
}> {
  const accessToken = await getPayPalAccessToken()

  const orderData = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: params.jobId,
        custom_id: params.jobId,
        amount: {
          currency_code: params.currency || "USD",
          value: params.amount,
        },
      },
    ],
    application_context: {
      brand_name: "Family Mosaic Maker",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/paypal/confirm`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/results/${params.jobId}`,
    },
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`,
    "PayPal-Request-Id": params.idempotencyKey || `req_${Date.now()}`,
  }

  if (params.idempotencyKey) {
    headers["PayPal-Request-Id"] = params.idempotencyKey
  }

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(orderData),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`PayPal order creation failed: ${response.status} ${JSON.stringify(error)}`)
  }

  return await response.json()
}

/**
 * 捕获 PayPal 支付
 */
export async function capturePayPalOrder(orderId: string): Promise<{
  id: string
  status: string
  payer: any
  purchase_units: any[]
}> {
  const accessToken = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`PayPal capture failed: ${response.status} ${JSON.stringify(error)}`)
  }

  return await response.json()
}

/**
 * 获取 PayPal 订单详情
 */
export async function getPayPalOrder(orderId: string): Promise<{
  id: string
  status: string
  purchase_units: any[]
}> {
  const accessToken = await getPayPalAccessToken()

  const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(`PayPal order fetch failed: ${response.status} ${JSON.stringify(error)}`)
  }

  return await response.json()
}

/**
 * 映射 PayPal 状态到内部状态
 */
export function mapPayPalStatusToInternal(paypalStatus: string): "pending" | "paid" | "failed" | "refunded" {
  const statusMap: Record<string, "pending" | "paid" | "failed" | "refunded"> = {
    "CREATED": "pending",
    "SAVED": "pending",
    "APPROVED": "pending",
    "VOIDED": "failed",
    "COMPLETED": "paid",
    "CAPTURED": "paid",
    "PENDING": "pending",
    "FAILED": "failed",
    "REFUNDED": "refunded",
    "PARTIALLY_REFUNDED": "refunded",
  }

  return statusMap[paypalStatus] || "pending"
}

