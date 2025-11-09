import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // During build, if env vars are missing, return a mock client
  if (!url || !key) {
    // Return a minimal mock client that won't crash during build
    return {
      auth: {
        signInWithOtp: async () => ({ error: { message: "Supabase not configured" } }),
        getUser: async () => ({ data: { user: null }, error: null }),
      },
    } as any
  }

  return createBrowserClient(url, key)
}

