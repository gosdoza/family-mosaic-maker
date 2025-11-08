// Legacy client for backward compatibility
// New code should use lib/supabase/client.ts
import { createClient } from "./supabase/client"

export const supabase = createClient()

