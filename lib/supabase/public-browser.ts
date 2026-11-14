"use client"

import { createClient } from "@supabase/supabase-js"

import { getSupabasePublicEnv } from "./config"

let client: ReturnType<typeof createClient> | null = null

export function createSupabasePublicBrowserClient() {
  if (client) return client
  const { url, publishableKey } = getSupabasePublicEnv()
  client = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  return client
}
