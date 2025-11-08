// Shared configuration for server and client
export const IS_MOCK = process.env.USE_MOCK === "true"
export const IS_MOCK_CLIENT = process.env.NEXT_PUBLIC_USE_MOCK === "true"
export const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID ?? ""

// Feature flags
export const FEATURES = {
  PAYPAL_CHECKOUT: !IS_MOCK || IS_MOCK_CLIENT,
  WEBHOOK_VERIFICATION: !IS_MOCK && !!PAYPAL_WEBHOOK_ID,
  ORDER_TRACKING: true,
} as const

