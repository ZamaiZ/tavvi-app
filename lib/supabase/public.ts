import "server-only"

import { createClient } from "@supabase/supabase-js"

import { getSupabasePublicEnv } from "./config"

export function createSupabasePublicClient() {
  const { url, publishableKey } = getSupabasePublicEnv()

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
