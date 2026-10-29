"use client"

import { createBrowserClient } from "@supabase/ssr"

import { getSupabaseCookieOptions, getSupabasePublicEnv, type AuthSurface } from "./config"

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>

const clients = new Map<AuthSurface, BrowserSupabaseClient>()

export function createSupabaseBrowserClient(surface: AuthSurface) {
  const existingClient = clients.get(surface)

  if (existingClient) {
    return existingClient
  }

  const { url, publishableKey } = getSupabasePublicEnv()
  const client = createBrowserClient(url, publishableKey, {
    cookieOptions: getSupabaseCookieOptions(surface),
    isSingleton: false,
  })

  clients.set(surface, client)
  return client
}